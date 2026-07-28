// CORNER EDITS — the two consequences of turning a module into (or out of) a corner, both pure.
//
// They used to live in store.ts as private helpers. They depend on nothing but the model, and the
// reanchor one carries a genuine geometry bug worth pinning in a test, so they moved here. store.ts
// imports them unchanged.
//
// Pure. No React, no store.

import { mk, styleOf, type Cabinet } from "./cabinet";
import { cabDepth } from "./bands";
import { runFloor, runCeil } from "./resolve";
import { cabFootprints } from "./footprint";
import { seatCorner } from "./rowOps";
import { planRuns, CORNER_MM, DEFAULT_REVEAL, type KitchenLayout } from "./runPlan";
import type { Pt, Opening } from "./room";

/** A wall cabinet narrower than this after a corner-zone trim isn't worth keeping — the corner unit
 *  standing there has replaced it, so drop it rather than leave a useless sliver (a 227mm reach stub
 *  read to the user as a phantom "Верхний 227"). Above this it's a real reach-filler that meets the
 *  corner, and is kept. */
const MIN_CORNER_KEEP = 260;

/** Re-fit a wall's tiled modules after a corner is seated or removed at one of its ends.
 *
 *  TWO things change when a vertex gains a corner:
 *   • the START end reserves an 840 zone, which SHIFTS the wall's run-local frame by CORNER_MM — a
 *     cabinet's stored `x` (fixed when there was no start zone) now maps 840mm further along the wall,
 *     so subtract the delta to keep its real WALL position;
 *   • either end that gains a corner has its usable span shrink by 840, so cabinets that used to fit
 *     now poke into the cleared zone where the corner unit stands.
 *
 *  What lands inside a cleared zone cannot stay. The old code clamped every offender's left edge to
 *  the START floor — which piled two or three cabinets onto the SAME x (red clash + the phantom
 *  "extra" cabinets), and it did NOTHING for the END zone at all, so the grid re-tiled the end
 *  neighbour into an 840-wide upper standing on top of the corner (also red). Both are handled the
 *  same way here: clamp each cabinet to its run's legal `[runFloor, runCeil]` (which already carry the
 *  shallow-module reach), DROP the one the corner replaces (nothing real survives the clamp), and keep
 *  everything else exactly where it was. This is the reasoning behind rowOps.healRunStarts, which
 *  never clamps-onto-one-x for the same reason — now applied to BOTH ends.
 *
 *  `prev`/`next` differ only by the corner just seated/removed, so a wall is only touched when its own
 *  start/end corner flags actually changed — untouched walls pass straight through. */
export function reanchorAfterCorner(
  prev: Cabinet[],
  next: Cabinet[],
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  reveal: number = DEFAULT_REVEAL,
): Cabinet[] {
  const prevRuns = planRuns(points, waterWall, layout, openings, prev, reveal).runs;
  const nextRuns = planRuns(points, waterWall, layout, openings, next, reveal).runs;
  let changed = false;
  const out: Cabinet[] = [];
  for (const c of next) {
    if (c.px != null || c.corner || c.island || c.furniture || c.run == null || c.x == null) {
      out.push(c);
      continue;
    }
    const pr = prevRuns[c.run];
    const nr = nextRuns[c.run];
    const startDelta = (nr?.cornerStart ? CORNER_MM : 0) - (pr?.cornerStart ? CORNER_MM : 0);
    const endChanged = (pr?.cornerEnd ?? false) !== (nr?.cornerEnd ?? false);
    if (startDelta === 0 && !endChanged) {
      out.push(c);
      continue;
    }
    changed = true;
    const depth = cabDepth(c);
    const floor = runFloor(nr, depth);
    const ceil = runCeil(nr, depth, nr?.len ?? Number.POSITIVE_INFINITY);
    // keep the cabinet's real WALL position across a start-frame shift, then clamp to the run's legal
    // span — a module reaches `runReach` into a corner zone at whichever end holds a shallow corner.
    const left = c.x - startDelta;
    const right = left + c.w;
    const nl = Math.max(floor, left);
    const nrx = Math.min(ceil, right);
    if (nrx - nl < MIN_CORNER_KEEP) continue; // the corner reclaimed this cabinet's space → drop it
    out.push(nl === left && nrx === right ? { ...c, x: left } : { ...c, x: nl, w: nrx - nl });
  }
  return changed ? out : next;
}

/** COMPLETE THE L. A corner is only clean when BOTH bands have one at the vertex — a lone UPPER corner
 *  still makes the run reserve the FLOOR zone (per-run flags), mangling the end base into an empty 840
 *  square, and a lone base corner leaves the shallower upper's reach strip stranded. So when a corner is
 *  seated, convert the nearest plain module of the OTHER band at that vertex into a corner too — exactly
 *  what the user would do by hand. Returns `cabs` unchanged when the other band is absent / already a
 *  corner / too far. (Caller re-anchors afterwards.) */
export function completeCornerL(
  cabs: Cabinet[],
  newCorner: Cabinet,
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  reveal: number = DEFAULT_REVEAL,
): Cabinet[] {
  const seatX = newCorner.px ?? 0;
  const seatZ = newCorner.pz ?? 0;
  const distTo = (c: Cabinet) => {
    const f = cabFootprints([c], points, waterWall, layout, openings, reveal)[0];
    return f ? Math.hypot(f.cx - seatX, f.cy - seatZ) : Infinity;
  };
  const otherKind: Cabinet["kind"] = newCorner.kind === "upper" ? "base" : "upper";
  if (cabs.some((c) => c.corner && c.kind === otherKind && distTo(c) < 240)) return cabs; // already there
  const victim = cabs
    .filter((c) => c.kind === otherKind && !c.corner && c.px == null && !!c.cell && !c.appliance)
    .map((c) => ({ c, d: distTo(c) }))
    .filter((x) => x.d < 1400)
    .sort((a, b) => a.d - b.d)[0]?.c;
  if (!victim) return cabs;
  const vfoot = cabFootprints([victim], points, waterWall, layout, openings, reveal)[0];
  const cornerCab = mk(
    otherKind === "upper"
      ? { ...styleOf(cabs, "upper"), kind: "upper", corner: true, cornerShape: "diagonal", fill: victim.fill, count: victim.count ?? 2, h: victim.h, mountY: victim.mountY }
      : { ...styleOf(cabs, "base"), kind: "base", corner: true, fill: victim.fill, count: victim.count ?? 2, h: victim.h },
  );
  const seated = seatCorner(
    { ...cornerCab, id: victim.id, px: vfoot?.cx ?? seatX, pz: vfoot?.cy ?? seatZ, cell: undefined, x: undefined, run: 0, armDepth: otherKind === "upper" ? 350 : 560 },
    points, waterWall, layout, openings,
  );
  return cabs.map((c) => (c.id === victim.id ? seated : c));
}
