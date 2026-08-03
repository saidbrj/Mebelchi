// "Fill empty space" — after a module is deleted/duplicated (the run isn't
// re-flowed), gaps and overlaps appear in a row. This grows the SELECTED module to
// swallow the empty space beside it, stopping at the NEAREST neighbour on each side
// (and never expanding into/over an overlapping module). Pure: the caller supplies
// the run's usable length so this stays free of the run-planning geometry.

import type { Cabinet } from "./cabinet";
import { bandsOverlap, spansOverlap } from "./bands";
import { resolveLayout, startOffset, wallLen, type Room } from "./resolve";

// Two modules only compete for the same horizontal space when their vertical bands OVERLAP — so a
// base and the upper mounted above it don't block each other, but a TALL column (floor→ceiling)
// blocks BOTH the bases and the uppers beside it.

/** A module is in a tiled row only if it has a run-local `x` and hasn't been freed
 *  into a plan transform (px/pz). Fillers never count. */
const inRow = (c: Cabinet) => c.x != null && c.px == null && c.appliance !== "filler";

const rowMates = (cabs: Cabinet[], ref: Cabinet) =>
  cabs.filter((c) => (c.run ?? 0) === (ref.run ?? 0) && bandsOverlap(c, ref) && inRow(c));

const TOL = 4;

/** The grown `{ x, w }` for `cab` if it can fill empty space beside it in its row,
 *  else null. Bounds are the NEAREST neighbour on each side (including corner units and wall ends);
 *  an OVERLAPPING module blocks growth on its side, so fill never spans over a module. */
export function fillGapSpan(
  cabs: Cabinet[],
  cab: Cabinet,
  room: Room,
  run: number,
): { x: number; w: number } | null {
  if (cab.appliance === "filler" || cab.furniture || cab.corner) return null;
  const L = resolveLayout(cabs, room);
  const pr = L.runs[run];
  if (!pr) return null;

  const off = startOffset(pr);
  const wl = wallLen(pr);

  const targetRc = L.elevation(run).find((rc) => rc.cab.id === cab.id);
  if (!targetRc) return null;

  const x0 = targetRc.x;
  const x1 = x0 + targetRc.w;

  let left = 0;
  let right = wl;

  for (const rc of L.elevation(run)) {
    if (rc.cab.id === cab.id || rc.cab.furniture || rc.cab.appliance === "filler") continue;
    if (!spansOverlap(rc.band, targetRc.band)) continue;

    const cx0 = rc.x;
    const cx1 = rc.x + rc.w;

    if (cx1 <= x0 + TOL) {
      if (cx1 > left) left = cx1;
    } else if (cx0 >= x1 - TOL) {
      if (cx0 < right) right = cx0;
    } else {
      if (cx0 < x0) left = Math.max(left, x0);
      if (cx1 > x1) right = Math.min(right, x1);
    }
  }

  if (right - left <= targetRc.w + TOL) return null;

  const newX = Math.round(left - off);
  const newW = Math.round(right - left);

  return { x: newX, w: newW };
}

/** Where to drop a duplicate of width `w` in `ref`'s row: the first gap big enough
 *  to hold it (so duplicating fills empty space directly), else the end of the row. */
export function parkX(cabs: Cabinet[], ref: Cabinet, w: number): number {
  const mates = rowMates(cabs, ref).sort((a, b) => (a.x as number) - (b.x as number));
  let cursor = 0;
  for (const c of mates) {
    const cx0 = c.x as number;
    if (cx0 - cursor >= w - TOL) break; // a gap before this module fits the copy
    cursor = Math.max(cursor, cx0 + c.w);
  }
  return Math.round(cursor);
}

/** The left edge for a NEW module of width `w` on wall `run`, scanning left→right for the first gap
 *  (or the run end) that fits within `runLen`. Returns null when the run is full — the caller then
 *  drops it free-floating.
 *
 *  `probe` is the module being placed: only the modules whose bands OVERLAP it are obstacles. This
 *  used to synthesise a probe from an `isUpper` boolean, hard-coding the default [1520, 2240] wall
 *  band — so a second-row wall unit was fitted against the FIRST row's occupancy and shoved to the
 *  end of the run (or dropped free-floating) even when the wall above was empty. */
export function firstFitX(cabs: Cabinet[], run: number, probe: Cabinet, runLen: number, w: number): number | null {
  const mates = cabs
    .filter((c) => (c.run ?? 0) === run && bandsOverlap(c, probe) && c.x != null && c.px == null && c.appliance !== "filler")
    .sort((a, b) => (a.x as number) - (b.x as number));
  let cursor = 0;
  for (const c of mates) {
    const cx0 = c.x as number;
    if (cx0 - cursor >= w - TOL) break; // a gap before this module fits the new one
    cursor = Math.max(cursor, cx0 + c.w);
  }
  return cursor + w <= runLen + TOL ? Math.round(cursor) : null;
}
