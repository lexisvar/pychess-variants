import { h, init } from "snabbdom";
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';
import style from 'snabbdom/modules/style';

import * as cg from 'chessgroundx/types';
import { dragNewPiece } from 'chessgroundx/drag';
import { Color, dimensions } from 'chessgroundx/types';
//import { setDropMode, cancelDropMode } from 'chessgroundx/drop';

import { VARIANTS, roleToSan, lc } from './chess';
import RoundController from './roundCtrl';
import AnalysisController from './analysisCtrl';

const patch = init([klass, attributes, properties, style, listeners]);

type Position = 'top' | 'bottom';

const eventNames = ['mousedown', 'touchstart'];

export function pocketView(ctrl: RoundController | AnalysisController, color: Color, position: Position) {
  const pocket = ctrl.pockets[position === 'top' ? 0 : 1];
  const roles = Object.keys(pocket);
  return h('div.pocket.' + position, {
    class: { usable: true },
    style: {
        '--pocketLength': String(roles!.length),
        '--files': String(dimensions[VARIANTS[ctrl.variant].geometry].width),
        '--ranks': String(dimensions[VARIANTS[ctrl.variant].geometry].height),
    },
    hook: {
      insert: vnode => {
        eventNames.forEach(name => {
          (vnode.elm as HTMLElement).addEventListener(name, (e: cg.MouchEvent) => {
                drag(ctrl, e);
          })
        });
      }
    }
  }, roles.map(role => {
    let nb = pocket[role] || 0;
    return h('piece.' + role + '.' + color, {
      attrs: {
        'data-role': role,
        'data-color': color,
        'data-nb': nb,
      }
    });
  }));
}

export function drag(ctrl: RoundController | AnalysisController, e: cg.MouchEvent): void {
    if (e.button !== undefined && e.button !== 0) return; // only touch or left click
    if (ctrl.spectator && ctrl instanceof RoundController) return;
    const el = e.target as HTMLElement,
    role = el.getAttribute('data-role') as cg.Role,
    color = el.getAttribute('data-color') as cg.Color,
    number = el.getAttribute('data-nb');
    if (!role || !color || number === '0') return;
    if (ctrl.clickDropEnabled && ctrl.clickDrop !== undefined && role === ctrl.clickDrop.role) {
        ctrl.clickDrop = undefined;
        ctrl.chessground.selectSquare(null);
        //cancelDropMode(ctrl.chessground.state);
        return;
    } else {
        //setDropMode(ctrl.chessground.state, number !== '0' ? { color, role } : undefined);
    };

    // Show possible drop dests on my turn only not to mess up predrop
    if (ctrl.clickDropEnabled && ctrl.turnColor === ctrl.mycolor) {
        const dropDests = { 'z0': ctrl.dests[roleToSan[role] + "@"] };
        // console.log("     new piece to z0", role);
        ctrl.chessground.newPiece({"role": role, "color": color}, 'z0')
        ctrl.chessground.set({
            turnColor: color,
            movable: {
                dests: dropDests,
                showDests: ctrl.showDests,
            },
        });
        ctrl.chessground.selectSquare('z0');
        ctrl.chessground.set({ lastMove: ctrl.lastmove });
    }
    e.stopPropagation();
    e.preventDefault();
    dragNewPiece(ctrl.chessground.state, { color, role }, e);
}

export function dropIsValid(dests: cg.Dests, role: cg.Role, key: cg.Key): boolean {
    const drops = dests[roleToSan[role] + "@"];
    // console.log("drops:", drops)

    if (drops === undefined || drops === null) return false;

    return drops.indexOf(key) !== -1;
}

// TODO: after 1 move made only 1 pocket update needed at once, no need to update both
export function updatePockets(ctrl: RoundController | AnalysisController, vpocket0, vpocket1): void {
    // update pockets from FEN
    if (ctrl.hasPockets) {
        const parts = ctrl.fullfen.split(" ");
        const fen_placement = parts[0];
        let pockets = "";
        const bracketPos = fen_placement.indexOf("[");
        if (bracketPos !== -1) {
            pockets = fen_placement.slice(bracketPos);
        }

        const c = ctrl.mycolor;
        const o = ctrl.oppcolor;
        const rc = VARIANTS[ctrl.variant].pocketRoles(c) ?? [];
        const ro = VARIANTS[ctrl.variant].pocketRoles(o) ?? [];
        let pc = {};
        let po = {};
        rc.forEach(role => pc[role] = lc(pockets, roleToSan[role].toLowerCase(), c==='white'));
        ro.forEach(role => po[role] = lc(pockets, roleToSan[role].toLowerCase(), o==='white'));
        if (ctrl.flip) {
            ctrl.pockets = [pc, po];
        } else {
            ctrl.pockets = [po, pc];
        }
        // console.log(o,c,po,pc);
        ctrl.vpocket0 = patch(vpocket0, pocketView(ctrl, (ctrl.flip) ? ctrl.mycolor : ctrl.oppcolor, "top"));
        ctrl.vpocket1 = patch(vpocket1, pocketView(ctrl, (ctrl.flip) ? ctrl.oppcolor : ctrl.mycolor, "bottom"));
    }
}
