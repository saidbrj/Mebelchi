// THE canonical layout model. Every view — 3D, front elevation, 2D plan, PDF drawings — must
// read a module's geometry from here and nowhere else.
//
// Why this exists: placement used to be re-derived independently in kitchen3d.ts,
// the front elevation, ConfigScreen's `elev` remap and drawings.ts, each with its own depth
// table, its own vertical constants and its own idea of how long a run is. They disagreed —
// e.g. a tall's height moved it in the front view but not in 3D, corners drew as flat boxes,
// and a rotated mid-room module was drawn flush on the wall. Resolving once kills all of that
// by construction.
//
// Pure. No React, no store.

import type { Cabinet } from "./cabinet";
import { GEOM } from "./layout";
import { cabBand, cabDepth, spansOverlap, HOOD_BOTTOM, UPPER_BOTTOM, type Band } from "./bands";
import { cabFootprints, objectOverlapIds, type Foot } from "./footprint";
import { planRuns, runReach as reachOf, CORNER_MM, type KitchenLayout, type PlannedRun } from "./runPlan";
import {
  defaultOpeningHeight,
  defaultOpeningSill,
  defaultFittingHeight,
  fittingCentreY,
  fittingKind,
  pipeDiameter,
  pipeSegments,
  type Pt,
  type Opening,
  type Fitting,
} from "./room";

// THE vertical stack lives in ./bands (it has to sit below footprint.ts in the import graph so the
// clash test can read a module's height). Re-exported here so every existing `from "./resolve"`
// import keeps working — resolve stays the one door onto the resolved layout.
export { cabBand, cabDepth, bandsOverlap, spansOverlap, HOOD_BOTTOM, UPPER_BOTTOM, type Band } from "./bands";

/** The worktop surface height (mm). Read from the REAL base modules, not a constant — the
 *  seller can raise the whole counter (store.setBaseHeight), and a gizmo/dim line that
 *  measures from a hardcoded 860 lies the moment they do. Falls back to the default stack. */
export function counterTop(cabs: Cabinet[]): number {
  const bases = cabs.filter((c) => c.kind === "base" && !c.furniture);
  if (!bases.length) return GEOM.plinth + GEOM.baseH + GEOM.worktop;
  return Math.max(...bases.map((c) => cabBand(c).y1));
}

/** A module is tiled into a run only if it has a run-local `x` and hasn't been freed. */
export const isTiled = (c: Cabinet): boolean => c.x != null && c.px == null;
/** Never occupies a wall row: scribe fillers, free-standing furniture, islands. */
export const isPlaceable = (c: Cabinet): boolean => !c.furniture && c.appliance !== "filler" && !c.island;

/** WALL space = the run plus its cleared corner zones. Elevation x is measured from the wall
 *  start, so a corner unit sits at 0 (or wallLen−w) instead of needing an ad-hoc "extension". */
export function cornerOffset(run: PlannedRun): number {
  return run.cornerStart ? CORNER_MM : 0;
}
export function cornerEndOffset(run: PlannedRun): number {
  return run.cornerEnd ? CORNER_MM : 0;
}
/** The FULL reserved zone at each end of a wall run, in WALL space (mm): the corner square PLUS the
 *  filler reveal. The two are mutually exclusive (a corner end reserves 840 and takes no reveal), so
 *  this is one or the other. Run-local x=0 sits exactly `startOffset` along the wall, so every
 *  wall↔run-local conversion — the elevation x below, the grid `off` (sheet.ts) — measures from here.
 *  Use these, not cornerOffset, anywhere that maps a run into wall space. */
export function startOffset(run: PlannedRun): number {
  return cornerOffset(run) + (run.revealStart ?? 0);
}
export function endOffset(run: PlannedRun): number {
  return cornerEndOffset(run) + (run.revealEnd ?? 0);
}
export function wallLen(run: PlannedRun): number {
  return run.len + startOffset(run) + endOffset(run);
}

/** How far a column may reach into the CLEARED CORNER ZONES at either end of its run, in
 *  RUN-LOCAL mm. Derived from the zone geometry, NOT from the corner unit's current width — a
 *  corner unit that has been resized is broken data (healCornerUnits repairs it), and letting a
 *  column chase it would drag the whole row out of position.
 *
 *  A 560-deep module fills the 840 zone exactly, so it stops at the zone. A 350-deep wall unit needs
 *  only a 613 corner, so it reaches the last 227mm in. That is `runReach`, which lives in runPlan
 *  because the variant generator needs it too. */
export { runReach } from "./runPlan";

export function runFloor(run: PlannedRun | undefined, depthMm: number): number {
  if (!run?.cornerStart) return 0;
  const r = reachOf(depthMm);
  return r === 0 ? 0 : -r; // never hand back -0
}

export function runCeil(run: PlannedRun | undefined, depthMm: number, runLenMm: number): number {
  if (!run?.cornerEnd) return runLenMm;
  return runLenMm + reachOf(depthMm);
}

/** Everything on a wall that ISN'T a cabinet — a window, a door, a socket, a radiator. The
 *  front view used to draw only cabinets, so a window read as empty wall: you would add a unit
 *  into the gap and only discover the clash in 3D. `blocks` marks the ones a cabinet cannot
 *  share space with.
 *
 *  WALL space == the inner wall, measured from its start — `wallLen(run)` is exactly the inner
 *  wall length, so an opening's stored `t` (0..1 along that wall) maps straight onto it. */
export interface WallFeature {
  id: string;
  kind: "window" | "door" | "opening" | "socket" | "heating" | "vent" | "plumbing";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  blocks: boolean;
  label: string;
}

export function wallFeatures(run: PlannedRun, wallLenMm: number, openings: Opening[], fittings: Fitting[] = []): WallFeature[] {
  if (run.kind !== "wall" || run.wall < 0) return [];
  const out: WallFeature[] = [];
  const span = (t: number, w: number) => ({ x0: t * wallLenMm - w / 2, x1: t * wallLenMm + w / 2 });

  for (const o of openings) {
    if (o.wall !== run.wall) continue;
    const y0 = o.sill ?? defaultOpeningSill(o.kind, o.design);
    const y1 = y0 + (o.height ?? defaultOpeningHeight(o.kind));
    out.push({
      id: o.id,
      kind: o.kind === "window" ? "window" : o.kind === "opening" ? "opening" : "door",
      ...span(o.t, o.width),
      y0,
      y1,
      blocks: true, // you cannot hang a cabinet over glass or across a doorway
      label: o.name,
    });
  }

  // fitting geometry mirrors the 3D (three/ThreeScene fittingMesh) so the two agree
  for (const f of fittings) {
    if (f.wall !== run.wall) continue;
    // THE INSTANCE'S OWN WIDTH WINS. Every fitting is created (and re-created on replace) carrying
    // its kind's width, and the room editor lets the seller change it — so reading the catalog back
    // over the top silently threw that edit away. It matters most for a pipe, where the diameter IS
    // the notch, but a resized radiator was equally being ignored.
    const w = f.width || fittingKind(f.category, f.kind)?.width || 120;
    const h = f.category === "electric" ? 120 : f.height ?? defaultFittingHeight(f.category);
    // ONE definition of how high an item hangs (model/room), shared with the 3D and the dimension
    // chain — a number the overlay disagrees with is a number the fitter cannot use
    const yc = fittingCentreY(f);
    const label = fittingKind(f.category, f.kind)?.name ?? f.kind;

    // A PIPE IS A PATH, so it is not one rectangle but one PER SEGMENT. That is the whole reason
    // the path is stored in wall space: a bend needs no new geometry downstream — the notch
    // derivation, the "+"-cell blocking and the elevation all take rectangles, and a bent pipe is
    // simply several of them. `pipeSegments` resolves a legacy straight run to a single segment, so
    // nothing here has two behaviours to keep in step.
    if (f.category === "plumbing") {
      // the DIAMETER, not `f.width` — on a horizontal run that field holds the length
      const r = pipeDiameter(f) / 2;
      pipeSegments(f, wallLenMm).forEach((sg, i) => {
        // A BARREL IS FAT ACROSS ITS AXIS, NOT ALONG IT. Its ends are flat and sit ON the path's
        // points, so growing the box by the radius in both directions would lengthen the pipe by a
        // diameter — and cut the cabinet for pipe that isn't there. Grow only perpendicular: for a
        // unit direction (ux,uy) that is r·|uy| across and r·|ux| up, which is exactly r and 0 for
        // the vertical and horizontal runs almost every pipe is.
        const dx = sg.a1 - sg.a0;
        const dy = sg.y1 - sg.y0;
        const len = Math.hypot(dx, dy) || 1;
        const growX = (r * Math.abs(dy)) / len;
        const growY = (r * Math.abs(dx)) / len;
        out.push({
          id: `${f.id}#${i}`,
          kind: "plumbing",
          x0: Math.min(sg.a0, sg.a1) - growX,
          x1: Math.max(sg.a0, sg.a1) + growX,
          y0: Math.min(sg.y0, sg.y1) - growY,
          y1: Math.max(sg.y0, sg.y1) + growY,
          blocks: false, // a cabinet still goes here; its back is cut to fit (model/cutouts.ts)
          label,
        });
      });
      continue;
    }

    out.push({
      id: f.id,
      kind: f.category === "electric" ? "socket" : f.category,
      ...span(f.t, w),
      y0: yc - h / 2,
      y1: yc + h / 2,
      // A socket doesn't stop a cabinet (it ends up behind one all the time) — a radiator does.
      // A PIPE does not either, and that is the whole point of it being here: the cabinet still
      // goes in, and its back is cut to fit around the pipe (model/cutouts.ts).
      blocks: f.category === "heating",
      label,
    });
  }
  return out;
}

/** Where a module shows in a wall elevation. `null` = it isn't on any wall (island, rotated
 *  mid-room module, free furniture) — the old front view drew those flush on the wall anyway. */
export interface ElevSlot {
  run: number;
  x: number; // left edge in WALL space
  corner: "start" | "end" | null;
}

export interface ResolvedCab {
  id: string;
  cab: Cabinet;
  mode: "run" | "free";
  run: number; // meaningful when mode === "run"
  x: number; // run-local left edge, mm
  w: number;
  depth: number;
  band: Band;
  /** which wall elevations this module appears in (a corner unit is on TWO walls) */
  elev: ElevSlot[];
  foot: Foot | null; // plan/3D footprint (null for fillers, which never render in plan)
}

/** A band of wall units hanging at the same height — ONE row of the front-view spreadsheet.
 *
 *  Rows are DERIVED, never stored. A kitchen with an antresol is just wall units at a higher
 *  `mountY`; clustering them by band is what turns that into a second row, with no field on
 *  Cabinet and no migration for projects saved before rows existed. (The sheet used to take the
 *  min/max ENVELOPE of every upper on the wall, so a stacked antresol didn't create a row — it
 *  silently stretched the one row to swallow both bands, and the "+" cells were then computed
 *  against the union of the two.) */
export interface WallRow {
  y0: number;
  y1: number;
  ids: string[];
}

/** Cluster the wall units of one elevation into stacked rows, bottom → top.
 *
 *  Two units share a row when their bands overlap: that's the same test everything else uses for
 *  "these compete for the same space" (bands.spansOverlap), so a row is exactly "the units you
 *  cannot put side by side vertically". A hood is excluded — it hangs at its own height over the
 *  hob and is not part of any run of wall units. */
export function wallRows(cells: ResolvedCab[], tol = 30): WallRow[] {
  const uppers = cells
    .filter((rc) => rc.cab.kind === "upper" && rc.cab.appliance !== "hood" && !rc.cab.furniture)
    .sort((a, b) => a.band.y0 - b.band.y0);

  const rows: WallRow[] = [];
  for (const rc of uppers) {
    const row = rows[rows.length - 1];
    if (row && spansOverlap(row, rc.band, tol)) {
      row.y0 = Math.min(row.y0, rc.band.y0);
      row.y1 = Math.max(row.y1, rc.band.y1);
      row.ids.push(rc.id);
    } else {
      rows.push({ y0: rc.band.y0, y1: rc.band.y1, ids: [rc.id] });
    }
  }
  return rows;
}

export interface Room {
  points: Pt[];
  waterWall: number | null;
  layout: KitchenLayout;
  openings: Opening[];
  /** filler «добор» gap (mm) reserved at wall-butting run ends; absent → DEFAULT_REVEAL. */
  reveal?: number;
}

export interface ResolvedLayout {
  runs: PlannedRun[];
  cabs: ResolvedCab[];
  byId: Map<string, ResolvedCab>;
  /** ids of modules whose 3D footprints clash with another same-layer module */
  clashing: Set<string>;
  /** modules that appear on this wall's elevation, left→right, in WALL space */
  elevation: (run: number) => ResolvedCab[];
  wallLen: (run: number) => number;
}

/** A corner unit is free-placed (px/pz) but belongs to the cleared corner zone that BOTH
 *  adjacent runs exclude from their usable `len`. It is therefore on TWO walls at once — an
 *  L's diagonal base closes the end of one wall AND the start of the next — so this returns a
 *  slot per adjacent run. Returning only the best one left the other wall's corner zone
 *  looking like empty wall you could add a cabinet into (which would then overlap the corner). */
function cornerSlots(c: Cabinet, runs: PlannedRun[], cx: number, cy: number): ElevSlot[] {
  if (c.px == null || c.pz == null) return [];
  const mx = (c.px - cx) / 1000;
  const mz = (c.pz - cy) / 1000;
  const best = new Map<number, { slot: ElevSlot; err: number }>();
  runs.forEach((run, r) => {
    if (run.kind !== "wall") return;
    const p = run.placement;
    // must actually be in front of this wall, not across the room
    const into = (mx - p.ax) * p.ix + (mz - p.az) * p.iz;
    if (into < -0.5 || into > 1.6) return;
    const along = (mx - p.ax) * p.ux + (mz - p.az) * p.uz; // metres from the wall start
    const xMm = Math.round((along - p.startS) * 1000 - c.w / 2); // run-local left edge
    const add = (slot: ElevSlot, err: number) => {
      const cur = best.get(r);
      if (!cur || err < cur.err) best.set(r, { slot, err });
    };
    // the corner zone sits BEFORE a run that starts in one (x < 0) and PAST one that ends in
    // one (x + w > len); in wall space it is flush against that end
    if (run.cornerStart && xMm < 0) add({ run: r, x: 0, corner: "start" }, Math.abs(xMm + CORNER_MM / 2));
    if (run.cornerEnd && xMm + c.w > run.len) add({ run: r, x: wallLen(run) - c.w, corner: "end" }, Math.abs(xMm - run.len));
  });
  return [...best.values()].map((v) => v.slot);
}

/** Where a FREE module (px/pz — dragged, or placed free by the generator) shows on a wall.
 *
 *  This deliberately does NOT reuse footprint.dockToRun. That function answers a different
 *  question ("can this be re-tiled into a run slot?") and its gates are wrong for drawing:
 *    • it rejects anything crossing `run.len`, but run.len EXCLUDES the 840mm corner zone —
 *      so a cabinet beside the corner was dropped from the sheet while the 3D still drew it,
 *      leaving a "+" over a module that already exists;
 *    • its depth tolerance (180mm) drops a cabinet nudged slightly off the wall.
 *  The sheet must be a projection of what the 3D draws, so this measures in WALL space (which
 *  includes the corner zones) and is forgiving about how flush the module is.
 *
 *  It still refuses modules that aren't really ON this wall — an island, a table, a cabinet
 *  rotated across the room — because those genuinely don't belong in a wall elevation. */
function freeSlot(c: Cabinet, runs: PlannedRun[], cx: number, cy: number): ElevSlot[] {
  if (c.px == null || c.pz == null) return [];
  const mx = (c.px - cx) / 1000;
  const mz = (c.pz - cy) / 1000;
  const depthM = cabDepth(c) / 1000;
  const cands: { slot: ElevSlot; err: number }[] = [];
  runs.forEach((run, r) => {
    if (run.kind !== "wall") return;
    const p = run.placement;
    const into = (mx - p.ax) * p.ix + (mz - p.az) * p.iz; // centre's inward distance from the wall
    const back = into - depthM / 2; // gap between the module's BACK and the wall
    if (back < -0.25 || back > 0.35) return; // not against this wall
    const rot = Math.atan2(-p.ix, p.iz) * (180 / Math.PI);
    const dRot = Math.abs((((c.rot ?? 0) - rot + 540) % 360) - 180);
    if (dRot > 30) return; // turned away from this wall — not a wall elevation module
    // WALL space runs from the wall start (corner zones included), and cornerOffset ==
    // placement.startS, so the two cancel: wall x is just the distance along the wall.
    const along = (mx - p.ax) * p.ux + (mz - p.az) * p.uz;
    const x = Math.round(along * 1000 - c.w / 2);
    const wl = wallLen(run);
    if (x + c.w < 60 || x > wl - 60) return; // doesn't overlap this wall at all
    cands.push({ slot: { run: r, x, corner: null }, err: Math.abs(back) });
  });
  if (!cands.length) return [];
  return [cands.reduce((a, b) => (b.err < a.err ? b : a)).slot];
}

export function resolveLayout(cabs: Cabinet[], room: Room): ResolvedLayout {
  // pass `cabs` so the "all" shape's corner zones follow the placed corner units (dynamic corners);
  // ignored for i/l/u. cabFootprints gets them too, so footprints and runs agree on every zone.
  const { runs } = planRuns(room.points, room.waterWall, room.layout, room.openings, cabs, room.reveal);
  const foots = cabFootprints(cabs, room.points, room.waterWall, room.layout, room.openings, room.reveal);
  const footById = new Map(foots.map((f) => [f.id, f]));
  // room centre, for projecting free modules (same basis cabFootprints/dockToRun use)
  const xs = room.points.map((p) => p.x);
  const ys = room.points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const out: ResolvedCab[] = cabs.map((c) => {
    const tiled = isTiled(c);
    const run = c.run ?? 0;
    const depth = cabDepth(c);
    const band = cabBand(c);

    let elev: ElevSlot[] = [];
    if (isPlaceable(c)) {
      if (c.corner) {
        elev = cornerSlots(c, runs, cx, cy);
        // A corner whose vertex the PLANNER never lit up — no reference seat there (a wall cut short
        // by a doorway), or one the user has dragged along the wall — produced NO slot at all. It
        // then vanished from the front view AND from `blockersFor`, so the sheet went on offering
        // "+" cells over a cabinet that is standing right there. It is still a free module against a
        // wall, so fall back to projecting it like one: the sheet must show what the 3D draws.
        if (!elev.length) elev = freeSlot(c, runs, cx, cy);
      } else if (tiled) {
        const r = runs[run];
        if (r?.kind === "wall") elev = [{ run, x: startOffset(r) + (c.x as number), corner: null }];
      } else {
        elev = freeSlot(c, runs, cx, cy);
      }
    }

    return {
      id: c.id,
      cab: c,
      mode: tiled ? "run" : "free",
      run,
      x: c.x ?? 0,
      w: c.w,
      depth,
      band,
      elev,
      foot: footById.get(c.id) ?? null,
    };
  });

  const byId = new Map(out.map((r) => [r.id, r]));
  // modules clashing with another SAME-LAYER module, by real 3D footprint — the same test the
  // 2D plan flags in red, so "red" means one thing across every view
  const clashing = objectOverlapIds(foots);
  return {
    runs,
    cabs: out,
    byId,
    clashing,
    wallLen: (r) => (runs[r] ? wallLen(runs[r]) : 0),
    // `x` on the returned cabs is REWRITTEN to WALL space (the coordinate this elevation is
    // drawn in). ResolvedCab.x is run-local — for a free/corner module it is meaningless, so
    // handing the raw record to a view is a trap: the front view drew every corner unit at
    // x=0, on top of the first cabinet, and shifted a corner-started wall left by 840mm.
    elevation: (r) =>
      out
        .flatMap((rc) => rc.elev.filter((sl) => sl.run === r).map((sl) => ({ ...rc, x: sl.x })))
        .sort((a, b) => a.x - b.x),
  };
}
