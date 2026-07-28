// Footprint geometry for a kitchen run — shared by the 2D plan editor
// (ConstructorPlan) and the 3D editor (VariantScene) so both read identical
// centres/axes for every module. A module's footprint honours its free plan
// transform (px/pz/rot) when present, otherwise the solver's wall-run placement.
// cx/cy are the footprint centre in ABSOLUTE room mm (same space as roomPoints).

import { polygonBoundsMm, type Pt, type Opening } from "./room";
import { planRuns, DEFAULT_REVEAL, type KitchenLayout } from "./runPlan";
import { cabBand, spansOverlap, cornerShapeOf, cornerArm, FOOT_DEPTH_MM } from "./bands";
import type { Cabinet, FinishKey } from "./cabinet";

export { FOOT_DEPTH_MM };
const DEG = 180 / Math.PI;

export interface Foot {
  id: string;
  appliance: Cabinet["appliance"];
  cx: number;
  cy: number;
  ux: number;
  uy: number; // width axis (unit)
  ix: number;
  iy: number; // depth axis (unit)
  w: number;
  depth: number;
  rotDeg: number;
  hbx: number; // axis-aligned half-extents (for snapping / overlap)
  hby: number;
  upper: boolean; // wall-mounted (drawn dashed, sits over the base)
  /** the module's VERTICAL extent (mm above the floor) — see model/bands.ts.
   *
   *  A footprint used to carry only the `upper` boolean, which made "same layer" mean "same kind".
   *  That is wrong in both directions: two wall units STACKED (an antresol on the main uppers) were
   *  flagged as a clash, and a tall column running straight through a wall unit was not flagged at
   *  all. A real interval fixes both. */
  y0: number;
  y1: number;
  corner?: boolean; // corner unit (drawn chamfered / notched in the plan)
  /** the corner BODY and the depth of the runs it butts into — the 2D plan draws the corner polygon
   *  itself (a twin of kitchen3d's), so it needs the same two inputs the 3D does */
  cornerShape: "diagonal" | "l" | "outer";
  armDepth: number;
  /** OUTER corner only — the world point the cut corner looks toward (see cabinet.cornerFace). */
  cornerFace?: { x: number; y: number };
  /** OUTER corner only — the 45° cut's leg (mm); absent = the full cut (see cabinet.chamfer). */
  chamfer?: number;
  furniture?: boolean; // free-standing table/chair — exempt from overlap warnings
  finish?: Partial<Record<FinishKey, number>>; // per-module colour overrides
}

const SIGNS: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

// axis-aligned half-extents of a (possibly rotated) footprint, for snapping
export function halfExtents(ux: number, uy: number, ix: number, iy: number, w: number, depth: number) {
  const hw = w / 2;
  const hd = depth / 2;
  return {
    hbx: Math.max(...SIGNS.map(([su, si]) => Math.abs(ux * su * hw + ix * si * hd))),
    hby: Math.max(...SIGNS.map(([su, si]) => Math.abs(uy * su * hw + iy * si * hd))),
  };
}

// the four corners of an oriented footprint rectangle
export function rectCorners(cx: number, cy: number, ux: number, uy: number, ix: number, iy: number, w: number, depth: number) {
  const hw = w / 2;
  const hd = depth / 2;
  return SIGNS.map(([su, si]) => ({ x: cx + ux * su * hw + ix * si * hd, y: cy + uy * su * hw + iy * si * hd }));
}

// separating-axis test for two oriented footprints (touching shared edges don't count)
export function footsOverlap(a: Foot, b: Foot): boolean {
  const ca = rectCorners(a.cx, a.cy, a.ux, a.uy, a.ix, a.iy, a.w, a.depth);
  const cb = rectCorners(b.cx, b.cy, b.ux, b.uy, b.ix, b.iy, b.w, b.depth);
  const axes = [{ x: a.ux, y: a.uy }, { x: a.ix, y: a.iy }, { x: b.ux, y: b.uy }, { x: b.ix, y: b.iy }];
  const EPS = 12;
  for (const ax of axes) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const p of ca) { const d = p.x * ax.x + p.y * ax.y; if (d < amin) amin = d; if (d > amax) amax = d; }
    for (const p of cb) { const d = p.x * ax.x + p.y * ax.y; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
    if (amax <= bmin + EPS || bmax <= amin + EPS) return false;
  }
  return true;
}

/** DO THESE TWO MODULES COLLIDE? The one rule — everything that paints something red must call
 *  this and nothing else.
 *
 *  Two modules clash when they overlap BOTH in plan (the SAT test) and in height (their bands).
 *  This used to be `a.upper !== b.upper` — "same kind means same layer" — copy-pasted into five
 *  places, and it was wrong in both directions: an antresol stacked on the wall units was flagged
 *  as an error, while a tall column driven straight through a wall unit was not flagged at all.
 *
 *  Free-standing furniture is exempt: a chair tucked under a table is normal, not a clash. */
export function footsClash(a: Foot, b: Foot): boolean {
  if (a.furniture || b.furniture) return false;
  if (!spansOverlap(a, b)) return false; // one is simply above the other
  return footsOverlap(a, b);
}

/** ids of modules clashing with another module. Wall clashes are handled separately (the editor
 *  pushes back from walls). */
export function objectOverlapIds(foots: Foot[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < foots.length; i++) {
    for (let j = i + 1; j < foots.length; j++) {
      if (footsClash(foots[i], foots[j])) {
        set.add(foots[i].id);
        set.add(foots[j].id);
      }
    }
  }
  return set;
}

/** Footprint of every cabinet (skips render-only fillers). Free transforms
 *  (px/pz/rot) win; otherwise the module is laid out left→right along its run. */
export function cabFootprints(
  cabs: Cabinet[],
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  reveal: number = DEFAULT_REVEAL,
): Foot[] {
  const b = polygonBoundsMm(points);
  // pass the whole set so the "all" shape's corner zones follow the placed corners (dynamic corners);
  // ignored for i/l/u. The run offsets must match resolveLayout's or footprints drift from the grid —
  // including the filler reveal, which shifts every run's startS.
  const placements = planRuns(points, waterWall, layout, openings, cabs, reveal).runs.map((r) => r.placement);
  const toMm = (mx: number, mz: number): Pt => ({ x: mx * 1000 + b.cx, y: mz * 1000 + b.cy });
  const cursor: Record<string, number> = {};
  const foot: Foot[] = [];
  for (const cab of cabs) {
    if (cab.appliance === "filler") continue;
    const upper = cab.kind === "upper";
    const depth = cab.depth ?? FOOT_DEPTH_MM[cab.kind] ?? 560;
    const { y0, y1 } = cabBand(cab);
    // the auto-tile cursor keys on the BAND as well as the kind: two wall units with no explicit
    // `x` on the same run used to tile side by side even when they hang at different heights, so a
    // second row could never be laid out automatically.
    const key = `${cab.run ?? 0}:${cab.kind}:${upper ? Math.round(y0) : 0}`;
    const x0 = cab.x ?? cursor[key] ?? 0;
    cursor[key] = x0 + cab.w;
    if (cab.px != null && cab.pz != null) {
      const r = (cab.rot ?? 0) / DEG;
      const ux = Math.cos(r), uy = Math.sin(r), ix = -Math.sin(r), iy = Math.cos(r);
      foot.push({ id: cab.id, appliance: cab.appliance, cx: cab.px, cy: cab.pz, ux, uy, ix, iy, w: cab.w, depth, rotDeg: cab.rot ?? 0, upper, y0, y1, corner: cab.corner, cornerShape: cornerShapeOf(cab), armDepth: cornerArm(cab), cornerFace: cab.cornerFace, chamfer: cab.chamfer, furniture: !!cab.furniture, finish: cab.finish, ...halfExtents(ux, uy, ix, iy, cab.w, depth) });
      continue;
    }
    const p = placements[cab.run ?? 0] ?? placements[0];
    if (!p) continue;
    const midS = p.startS + (x0 + cab.w / 2) / 1000;
    const dM = depth / 1000;
    const cm = toMm(p.ax + p.ux * midS + p.ix * (dM / 2), p.az + p.uz * midS + p.iz * (dM / 2));
    // capture angle so the free i-axis = the placement's inward normal (keeps the
    // facade facing the room after the module is freed, even on mirrored walls)
    foot.push({ id: cab.id, appliance: cab.appliance, cx: cm.x, cy: cm.y, ux: p.ux, uy: p.uz, ix: p.ix, iy: p.iz, w: cab.w, depth, rotDeg: Math.atan2(-p.ix, p.iz) * DEG, upper, y0, y1, cornerShape: cornerShapeOf(cab), armDepth: cornerArm(cab), furniture: !!cab.furniture, finish: cab.finish, ...halfExtents(p.ux, p.uz, p.ix, p.iz, cab.w, depth) });
  }
  return foot;
}

/** Every module with its run-local `x` resolved: already-tiled cabs pass through; a
 *  free (px/pz) cab flush to a wall is re-tiled onto it (run/x set, transform cleared);
 *  undockable free cabs (mid-room, corners) pass through unchanged. Used so gap/fill math
 *  can "see" free-placed neighbours (not just the originally-tiled ones). */
export function dockAll(
  cabs: Cabinet[],
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  reveal: number = DEFAULT_REVEAL,
): Cabinet[] {
  return cabs.map((c) => {
    if (c.px == null || c.pz == null || c.island) return c; // island stays free-standing mid-room
    const d = dockToRun(c, points, waterWall, layout, openings, cabs, reveal);
    return d ? { ...c, run: d.run, x: d.x, px: undefined, pz: undefined, rot: undefined } : c;
  });
}

/** If a freed module (px/pz) is sitting flush against a wall run and aligned to it,
 *  the run index + run-local left edge (mm) to re-tile it there; else null. Lets the
 *  editor turn a dragged-to-the-wall cabinet back into a tiled run module (so it shows
 *  in the elevation and can fill the gap beside it). */
export function dockToRun(
  cab: Cabinet,
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  allCabs?: Cabinet[],
  reveal: number = DEFAULT_REVEAL,
): { run: number; x: number } | null {
  if (cab.px == null || cab.pz == null) return null;
  const b = polygonBoundsMm(points);
  // `allCabs` carries the corner units so the "all" shape's run offsets match everyone else's; without
  // it (single-cab call) fall back to the static corner reservation. Ignored for i/l/u.
  const runs = planRuns(points, waterWall, layout, openings, allCabs, reveal).runs;
  const depthM = (cab.depth ?? FOOT_DEPTH_MM[cab.kind] ?? 560) / 1000;
  const mx = (cab.px - b.cx) / 1000;
  const mz = (cab.pz - b.cy) / 1000; // module centre, metres (room-centred)
  let best: { run: number; x: number } | null = null;
  let bestErr = Infinity;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    if (run.kind !== "wall") continue;
    const p = run.placement;
    const into = (mx - p.ax) * p.ix + (mz - p.az) * p.iz; // inward distance from the wall
    if (into < 0) continue; // wrong side of the wall
    const depthErr = Math.abs(into - depthM / 2); // back flush → centre sits depth/2 in
    if (depthErr > 0.18) continue;
    const along = (mx - p.ax) * p.ux + (mz - p.az) * p.uz; // distance along the run
    const localX = (along - p.startS) * 1000 - cab.w / 2; // run-local left edge (mm)
    if (localX < -60 || localX + cab.w > run.len + 60) continue; // off the run
    const runRot = Math.atan2(-p.ix, p.iz) * DEG;
    const dRot = Math.abs((((cab.rot ?? 0) - runRot + 540) % 360) - 180);
    if (dRot > 30) continue; // not aligned to this wall
    if (depthErr < bestErr) {
      bestErr = depthErr;
      best = { run: r, x: Math.round(Math.max(0, Math.min(run.len - cab.w, localX))) };
    }
  }
  return best;
}
