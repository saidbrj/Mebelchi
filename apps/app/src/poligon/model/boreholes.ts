// ПОЛИГОН · R69 correction 2 — the borehole paradox on a shared panel.
//
// The red-team found the hole in R69 and it is a real one. The contract says the shared side board
// belongs to the host and each cabinet is opaque to the other. Physically the board is ONE piece
// of 16mm chipboard, and it is drilled from BOTH faces: drawer runners on the left, shelf pins on
// the right. If the two cabinets cannot see each other, nothing checks whether a 50mm confirmat
// coming from the left lands on top of one coming from the right.
//
// It does not merely look bad. Two confirmats meeting head-on inside 16mm of chipboard blow the
// core out, and the board is scrap — after it has been cut, banded and drilled.
//
// So encapsulation holds for LAYOUT and breaks, deliberately and in exactly one place, for
// DRILLING. The shared panel aggregates both cabinets' hole maps and checks them against each
// other. Neither cabinet learns anything about the other's interior: they hand their holes to the
// panel, and the panel answers.

import type { SharedPanel } from "./ports";
// the number itself is a shop setting and lives in things/tables/junction-rank/
import { CONFIRMAT_STAGGER_MM } from "./settings";

export { CONFIRMAT_STAGGER_MM };

export type Face = "A" | "B";

export interface Hole {
  /** which cabinet asked for it — for the refusal message, not for geometry */
  owner: string;
  face: Face;
  /** position ON the panel, in panel coordinates (mm) */
  x: number;
  y: number;
  diameterMm: number;
  /** how deep into the board. A through hole equals the board thickness. */
  depthMm: number;
  kind: "confirmat" | "dowel" | "cam" | "shelf-pin" | "hinge-cup" | "through";
}

export interface HoleProblem {
  law: string;
  detail: string;
  at: { x: number; y: number };
  holes: [Hole, Hole];
}

/** Two holes are in each other's way when they are close enough in the panel's plane that their
 *  bodies overlap. Half the larger diameter is the honest radius to use. */
const overlapsInPlane = (a: Hole, b: Hole): boolean => {
  const r = Math.max(a.diameterMm, b.diameterMm) / 2;
  return Math.hypot(a.x - b.x, a.y - b.y) < r;
};

export interface BoreholeCheck {
  /** every hole on the panel, from both sides, in one list */
  holes: Hole[];
  problems: HoleProblem[];
}

/**
 * Aggregate both cabinets' holes onto one panel and check them against each other.
 *
 * `minMeatMm` is the chipboard that must remain between two opposed blind holes. The factory
 * number the founder locked is 32mm of stagger between confirmats; expressed as remaining
 * material it is the same law seen from the other side, and remaining material is the form that
 * also catches a deep cam seat facing a shallow dowel.
 */
export function checkBoreholes(
  panel: SharedPanel, left: Hole[], right: Hole[], minMeatMm = 2,
): BoreholeCheck {
  const holes = [...left, ...right];
  const problems: HoleProblem[] = [];

  for (const a of left) {
    for (const b of right) {
      if (a.face === b.face) continue;          // same face: not an opposed pair
      if (!overlapsInPlane(a, b)) continue;     // they miss each other in the plane

      const meat = panel.thicknessMm - a.depthMm - b.depthMm;

      // a through hole meeting anything at all is a breakout, whatever the arithmetic says
      if (a.kind === "through" || b.kind === "through") {
        problems.push({
          law: "R69-BOREHOLE", at: { x: a.x, y: a.y }, holes: [a, b],
          detail:
            `a through hole from ${a.owner} meets a ${b.kind} from ${b.owner} at ` +
            `${Math.round(a.x)},${Math.round(a.y)} on the shared panel — it will break out the far face`,
        });
        continue;
      }

      if (meat < minMeatMm) {
        problems.push({
          law: "R69-BOREHOLE", at: { x: a.x, y: a.y }, holes: [a, b],
          detail:
            `${a.kind} from ${a.owner} (${a.depthMm}mm) and ${b.kind} from ${b.owner} ` +
            `(${b.depthMm}mm) meet head-on at ${Math.round(a.x)},${Math.round(a.y)} in a ` +
            `${panel.thicknessMm}mm panel — ${meat.toFixed(1)}mm of material left where ` +
            `${minMeatMm}mm is the minimum. Stagger them, or use cam locks on one side.`,
        });
      }
    }
  }
  return { holes, problems };
}

export function confirmatStagger(
  left: Hole[], right: Hole[], minStaggerMm = CONFIRMAT_STAGGER_MM,
): HoleProblem[] {
  const out: HoleProblem[] = [];
  for (const a of left.filter((h) => h.kind === "confirmat")) {
    for (const b of right.filter((h) => h.kind === "confirmat")) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d >= minStaggerMm) continue;
      out.push({
        law: "R69-BOREHOLE", at: { x: a.x, y: a.y }, holes: [a, b],
        detail:
          `confirmats from ${a.owner} and ${b.owner} are ${d.toFixed(1)}mm apart on opposite ` +
          `faces of one panel — the shop's minimum stagger is ${minStaggerMm}mm. ` +
          `Two 50mm screws meeting inside 16mm of chipboard blow the core out.`,
      });
    }
  }
  return out;
}
