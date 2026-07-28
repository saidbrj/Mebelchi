// THE SHEET — the wall grid, bound to a real room.
//
// grid.ts is pure arithmetic: it knows about column widths and row heights and nothing else. It has
// no idea how long a wall is, where the corner zones are, or which modules are standing on which
// run. This file is the bridge: it asks resolveLayout those questions and hands grid.ts the numbers.
//
// It is also where a wall gets its sheet FOR THE FIRST TIME — either derived from the kitchen that
// is already standing there (a project saved before the grid existed), or, on a bare wall, conjured
// out of nothing. That second case is the one that matters: an empty room is not empty. It already
// has columns and rows, drawn and draggable, waiting to be filled. Furniture is what you put IN the
// sheet, not what the sheet is made of.
//
// Pure. No React, no store.

import type { Cabinet } from "./cabinet";
import {
  defaultGrid,
  gridFromSeeds,
  applyGrid,
  reconcileTalls,
  evictUnderTalls,
  colEdges,
  rowEdges,
  emptyCells,
  type WallGrid,
  type GridSeed,
  type CellRef,
} from "./grid";
import { resolveLayout, counterTop, isPlaceable, wallFeatures, startOffset, endOffset, type Room, type ResolvedLayout } from "./resolve";
import { cabDepth, cabBand } from "./bands";
import { runReach } from "./runPlan";
import { editRows, type RowEdit } from "./rowOps";
import { dockToRun } from "./footprint";
import type { Fitting } from "./room";

/** A TALL standing flush against a wall MUST be a grid citizen. Free-floating (px≠null) it is invisible
 *  to `reconcileTalls` — which skips any `px != null` tall — so it reserves no shadow, the wall band
 *  equalises its columns straight over the pantry, and the uppers land underneath it and clash (red).
 *  A tall gets freed by a stray 3D nudge/drag, or arrives free from an older save; re-tile it. Because
 *  `dockToRun` only bites when the module is genuinely flush AND aligned, a tall dragged out into the
 *  middle of the room stays free. Returns the SAME array (===) when nothing docked, so callers can skip
 *  the write. */
function dockFlushTalls(cabs: Cabinet[], room: Room): Cabinet[] {
  let changed = false;
  const out = cabs.map((c) => {
    // ANY module (not just a tall) that a 3D move parked flush against a wall gets re-tiled, so the
    // two views never disconnect: a cabinet moved in the scene re-enters the grid and stays editable
    // in the front view. The floating layer — islands, corner units, free-standing furniture — is
    // left alone (dockToRun also only bites when the module is genuinely flush + aligned).
    if (c.px == null || c.pz == null || c.island || c.corner || c.furniture) return c;
    const d = dockToRun(c, room.points, room.waterWall, room.layout, room.openings, cabs, room.reveal);
    if (!d) return c;
    changed = true;
    return { ...c, run: d.run, x: d.x, px: undefined, pz: undefined, rot: undefined, cell: undefined };
  });
  return changed ? out : cabs;
}

/** Every wall's sheet, by run index. */
export type Grids = Record<number, WallGrid>;

/** A module belongs in the SHEET when it tiles a wall. Corner units, islands, dining tables and
 *  anything the user has dragged out into the room are the FLOATING layer — they sit on top of the
 *  grid the way a chart floats over a spreadsheet, and they keep their px/pz. Trying to force them
 *  into cells is what makes grid models fall apart on real kitchens. */
export const inSheet = (c: Cabinet): boolean =>
  isPlaceable(c) && !c.corner && !c.island && !c.furniture && c.px == null;

/** Is this wall's sheet still valid? A room edit that moves a wall changes the length the columns
 *  were tiled to sum to, so the grid must be rebuilt against the new wall. */
const stale = (g: WallGrid | undefined, wallLen: number, ceiling: number, off: number): boolean =>
  !g || Math.abs(g.wallLen - wallLen) > 1 || Math.abs(g.ceiling - ceiling) > 1 || g.off !== off;

/** Width of the trailing DEAD corner columns in the floor band = the reserved END zone. Tall shadows
 *  (lock+dead+tall) don't count — only the corner square does. `stale` keys on the START offset (`off`)
 *  and the wall length, neither of which changes when a wall merely GAINS or LOSES its END corner (the
 *  "all" shape's dynamic corners), so this is how ensureSheet notices that and rebuilds. */
function endZoneDead(g: WallGrid | undefined): number {
  const floor = g?.rows.find((r) => r.kind === "floor");
  if (!floor) return 0;
  let w = 0;
  for (let i = floor.cols.length - 1; i >= 0; i--) {
    const c = floor.cols[i];
    if (c.dead && !c.tall) w += c.w;
    else break;
  }
  return w;
}

/** A per-module depth edit (the 3D depth arrow, the plan's depth line, the module editor's field)
 *  writes `c.depth`, but depth is a property of the BAND, not the module: a wall band's columns and
 *  its corner-zone reach were tiled to ONE depth, and applyGrid projects that one depth back onto
 *  every upper in the row. `stale()` keys on wall length / ceiling / offset and is blind to a depth
 *  change, so without this the sheet is never rebuilt after a depth edit — the row is left ragged
 *  (some uppers deep, some shallow, the front faces stepped) and the corner reach is wrong. Detect
 *  when a WALL band's stored depth no longer matches the depth its uppers now carry, so ensureSheet
 *  rebuilds and the whole band re-tiles to one depth. Floor bands are deliberately fixed at
 *  DEPTH_FLOOR (gridFromSeeds), so bases are left out — their depth isn't grid-owned. */
function wallBandDepthDrift(cabs: Cabinet[], g: WallGrid, run: number): boolean {
  const ys = rowEdges(g);
  for (const c of cabs) {
    if (c.kind !== "upper" || !inSheet(c) || (c.run ?? 0) !== run || !c.cell) continue;
    const b = cabBand(c);
    let j = -1;
    let best = 0;
    for (let k = 0; k < g.rows.length; k++) {
      if (g.rows[k].kind !== "wall") continue;
      const ov = Math.min(ys[k + 1], b.y1) - Math.max(ys[k], b.y0);
      if (ov > best) { best = ov; j = k; }
    }
    if (j < 0) continue;
    if (Math.abs(g.rows[j].depth - cabDepth(c)) > 1) return true;
  }
  return false;
}

/** BUILD (or rebuild) one wall's sheet, and give every module on it a cell address.
 *
 *  With modules standing on the wall the track is READ OFF THEM — the distinct edges become the
 *  column lines, clustered so near-misses collapse onto one. That is what turns the auto-solver's
 *  ragged 600 / 600 / 587 / 583 uppers over 600 / 650 / 550 / 560 bases into a single track the
 *  whole wall shares: the uppers stop being *nearly* aligned with the bases and start being exactly
 *  aligned, because they now reference the same column.
 *
 *  With a bare wall you get `defaultGrid` — cells with nothing in them, which is the entire point. */
export function buildSheet(cabs: Cabinet[], room: Room, ceiling: number, run: number, L?: ResolvedLayout): { grid: WallGrid; cabs: Cabinet[] } {
  const lay = L ?? resolveLayout(cabs, room);
  const wallLen = lay.wallLen(run);
  const counter = counterTop(cabs);

  // WALL space — the coordinate the sheet is drawn in (it includes the cleared corner zones), which
  // is exactly what `elevation()` hands back.
  const seeds: GridSeed[] = lay
    .elevation(run)
    .filter((rc) => inSheet(rc.cab))
    .map((rc) => ({
      id: rc.id,
      x: rc.x,
      w: rc.w,
      y0: rc.band.y0,
      y1: rc.band.y1,
      depth: cabDepth(rc.cab),
      kind: rc.cab.kind,
    }));

  // WALL SPACE ↔ RUN-LOCAL. `elevation()` gives wall-space x (corner zone + filler reveal included);
  // `Cabinet.x` is run-local. The grid carries the offset so `applyGrid` can convert back when it
  // writes c.x. `startOffset` bundles the corner square AND the reveal, so the reveal becomes a dead
  // zone at the run start (zoneCols) that no module can tile into — the gap the filler panel fills.
  const off = lay.runs[run] ? startOffset(lay.runs[run]) : 0;
  // Each band now builds its OWN corner columns from its OWN depth, so the grid needs the reach as a
  // FUNCTION of depth: a 560mm floor band clears the full 840 (reach 0), a 350mm wall band reaches
  // the last 227mm in. `runReach` is exactly that map — grid.ts stays free of the runPlan import.
  const built = gridFromSeeds(run, wallLen, ceiling, seeds, counter, off, lay.runs[run]?.len, runReach);
  const addressed = cabs.map((c) => {
    const ref = built.cells.get(c.id);
    return ref ? { ...c, run, cell: ref } : c;
  });
  // reserve each pantry/tall's x-span in the bands above it (buildSheet doesn't go through editSheet,
  // which is the other place this happens), then drop any upper caught inside a shadow
  const grid = reconcileTalls(built.grid, addressed);
  const kept = evictUnderTalls(addressed, grid);
  return { grid, cabs: applyGrid(kept, grid) ?? kept };
}

/** Get the wall's sheet, building it on first sight. Returns null when nothing had to change, so
 *  the store can skip the set(). */
export function ensureSheet(
  grids: Grids,
  cabs: Cabinet[],
  room: Room,
  ceiling: number,
  run: number,
): { grids: Grids; cabs: Cabinet[] } | null {
  // A floating tall flush against a wall is invisible to the shadow system — dock it first so it
  // becomes an orphan that `adopt` (or the rebuild) then addresses and reserves. `use` === `cabs`
  // when nothing docked. If a dock DID happen we must commit `use` even when this run's grid is
  // otherwise unchanged, or the freed tall would linger.
  const use = dockFlushTalls(cabs, room);
  const dockedChanged = use !== cabs;
  const L = resolveLayout(use, room);
  const wallLen = L.wallLen(run);
  if (!wallLen) return dockedChanged ? { grids, cabs: use } : null;
  const off = L.runs[run] ? startOffset(L.runs[run]) : 0;
  // an END corner appearing/disappearing (dynamic "all" corners) leaves wallLen and the START offset
  // unchanged, so `stale` is blind to it — compare the reserved end zone against what the run now wants
  // (corner square + filler reveal, so a run that gains/loses either rebuilds)
  const wantEnd = L.runs[run] ? endOffset(L.runs[run]) : 0;

  const have = grids[run];
  // A tall just docked back onto THIS wall (px cleared, no cell yet). Its floor columns have to be
  // re-derived from where it now stands — `adopt` can only snap it into whatever columns already
  // exist, so two 600 talls falling into one leftover 1200 cell would stack (1200mm overlap). Rebuild
  // this run from the docked modules; the shadows and column edges then come out right.
  // ANY module just docked onto THIS wall (px cleared, no cell yet) → re-derive the run's columns
  // from where it now stands. `adopt` can only snap it into whatever columns already exist, so a
  // module dropped between two existing ones would land in an occupied cell (overlap); a rebuild
  // clusters the real edges instead.
  const dockedHere = dockedChanged && use.some((c) => c.px == null && (c.run ?? 0) === run && !c.cell && inSheet(c));
  if (dockedHere) {
    const built = buildSheet(use, room, ceiling, run, L);
    return { grids: { ...grids, [run]: built.grid }, cabs: built.cabs };
  }
  // already good — but a module may still have arrived without an address (added from the catalog,
  // dropped by the variant generator, or just docked above), so adopt any stragglers into the track.
  // A depth edit leaves wallLen/ceiling/off untouched, so `stale` can't see it — `wallBandDepthDrift`
  // is what makes a resized row re-tile instead of scattering.
  if (!stale(have, wallLen, ceiling, off) && Math.abs(endZoneDead(have) - wantEnd) <= 1 && !wallBandDepthDrift(use, have, run)) {
    const orphans = use.some((c) => inSheet(c) && (c.run ?? 0) === run && !c.cell);
    if (orphans) {
      const adopted = adopt(use, have, L, run);
      if (adopted) return { grids: { ...grids, [run]: adopted.grid }, cabs: adopted.cabs };
      return dockedChanged ? { grids, cabs: use } : null;
    }
    // SELF-HEAL the tall shadows on every pass. A tall can move (a column beside it resized) or be
    // deleted without the grid being rebuilt, and this is called on every cabs change — so the stored
    // grid can never drift out of sync with the pantries actually standing on the wall, and the front
    // view always reserves their space. Idempotent: returns null when nothing had to change.
    const healed = reconcileTalls(have, use);
    if (healed === have) return dockedChanged ? { grids, cabs: use } : null;
    const kept = evictUnderTalls(use, healed);
    return { grids: { ...grids, [run]: healed }, cabs: applyGrid(kept, healed) ?? kept };
  }

  const built = buildSheet(use, room, ceiling, run, L);
  return { grids: { ...grids, [run]: built.grid }, cabs: built.cabs };
}

/** Give an address to a module that turned up on a wall without one — snap it to the nearest
 *  existing column/row lines. It lands in the cells it visually occupies, so the user sees it
 *  exactly where they put it; from then on the grid owns it.
 *
 *  Returns the grid TOO, because a TALL adopted from the catalog (a fridge, a pantry) has to carve
 *  its shadow into the wall bands — without that the front view never reserves its space and the
 *  uppers read as overlapping it. */
function adopt(cabs: Cabinet[], grid: WallGrid, L: ResolvedLayout, run: number): { grid: WallGrid; cabs: Cabinet[] } | null {
  const ys = rowEdges(grid);
  const near = (arr: number[], v: number) =>
    arr.reduce((best, p, i) => (Math.abs(p - v) < Math.abs(arr[best] - v) ? i : best), 0);
  const elev = new Map(L.elevation(run).map((rc) => [rc.id, rc]));

  let changed = false;
  const out = cabs.map((c) => {
    if (!inSheet(c) || (c.run ?? 0) !== run || c.cell) return c;
    const rc = elev.get(c.id);
    if (!rc) return c;
    // pick the BAND by best y-overlap (columns are per-band now), then snap x within it
    let j = -1;
    let bestOv = 0;
    for (let k = 0; k < grid.rows.length; k++) {
      if (grid.rows[k].kind === "void") continue;
      const ov = Math.min(ys[k + 1], rc.band.y1) - Math.max(ys[k], rc.band.y0);
      if (ov > bestOv) { bestOv = ov; j = k; }
    }
    if (j < 0) return c;
    const xs = colEdges(grid.rows[j]);
    const c0 = Math.min(grid.rows[j].cols.length - 1, near(xs, rc.x));
    const c1 = Math.max(c0 + 1, near(xs, rc.x + rc.w));
    changed = true;
    return {
      ...c,
      cell: {
        c: grid.rows[j].cols[c0].id,
        r: grid.rows[j].id,
        cs: Math.min(c1 - c0, grid.rows[j].cols.length - c0),
      } as CellRef,
    };
  });
  if (!changed) return null;
  // carve shadows for any adopted tall, drop an upper caught inside one, then project
  const g = reconcileTalls(grid, out);
  const kept = evictUnderTalls(out, g);
  return { grid: g, cabs: applyGrid(kept, g) ?? kept };
}

/** RE-HANG THE CORNER UNITS after a row edit.
 *
 *  A corner unit is on the FLOATING layer — it is free-placed (px/pz) because the 3D needs a real
 *  diagonal/L body for it, and it stands in TWO walls at once, so it can belong to no single wall's
 *  column track. `applyGrid` therefore skips it, and that is correct… except vertically.
 *
 *  Height is the one thing a corner unit genuinely shares with the row beside it: a corner wall unit
 *  that doesn't move when you drag the Верх row's border is just a cabinet hanging at the wrong
 *  height, with a step where it meets its neighbour. (Re-hanging is safe in a way that resizing is
 *  not — `mountY`/`h` are purely vertical and never touch its px/pz seat, which is structural.)
 *
 *  Matching is by BAND, not by run: `c.run` on a corner is a polite fiction (it is set to 0 while
 *  the unit stands on two walls), so filtering by run left it behind. We ask instead: which wall row
 *  was this corner hanging in BEFORE the edit? Then move it to where that row is now.
 *
 *  That also covers the indirect case, which is easy to miss: raising the FLOOR row pushes every row
 *  above it upward, so a corner must follow even though its own row was never touched.
 *
 *  Returns null when nothing moved. */
export function rehangCorners(cabs: Cabinet[], before: WallGrid, after: WallGrid, ceiling: number): Cabinet[] | null {
  const oldYs = rowEdges(before);
  const newYs = rowEdges(after);

  const edits: RowEdit[] = [];
  for (const c of cabs) {
    if (!c.corner || c.kind !== "upper") continue;
    const band = cabBand(c);
    // the wall row it was hanging in, before
    const j = before.rows.findIndex(
      (r, k) => r.kind === "wall" && Math.min(oldYs[k + 1], band.y1) - Math.max(oldYs[k], band.y0) > 30,
    );
    if (j < 0 || j >= after.rows.length) continue;
    const y0 = newYs[j];
    const y1 = newYs[j + 1];
    if (Math.abs(y0 - band.y0) < 1 && Math.abs(y1 - y0 - c.h) < 1) continue;
    edits.push({ id: c.id, mountY: y0, h: y1 - y0 });
  }
  return edits.length ? editRows(cabs, edits, ceiling) : null;
}

/** Everything on this wall a module may NOT stand in, in WALL-space mm: a window, a doorway, a
 *  radiator, and the corner unit / free module standing in the way. Cells overlapping these are
 *  never offered as "+", so the sheet stops inviting you to hang a cabinet over the glass.
 *
 *  Note what is NOT here: other grid modules. They occupy cells, and a cell is either claimed or it
 *  isn't — that is the grid's job, not a geometric test. */
export function blockersFor(
  L: ResolvedLayout,
  run: number,
  openings: Room["openings"],
  fittings: Fitting[],
  band: { y0: number; y1: number },
): { a: number; b: number }[] {
  const pr = L.runs[run];
  if (!pr) return [];
  const hit = (y0: number, y1: number) => Math.min(band.y1, y1) - Math.max(band.y0, y0) > 30;
  const out: { a: number; b: number }[] = [];

  for (const f of wallFeatures(pr, L.wallLen(run), openings, fittings)) {
    if (f.blocks && hit(f.y0, f.y1)) out.push({ a: f.x0, b: f.x1 });
  }
  // the floating layer casts a shadow on the sheet: a corner unit really is standing in those cells
  for (const rc of L.elevation(run)) {
    if (inSheet(rc.cab) || rc.cab.furniture) continue;
    if (!hit(rc.band.y0, rc.band.y1)) continue;
    out.push({ a: rc.x, b: rc.x + rc.w });
  }

  // NOTE what is NOT here any more: the cleared corner zones. Each band now builds its own corner
  // columns (grid.zoneCols) with the deep half marked DEAD and the reach strip fillable, so
  // `emptyCells` skips the dead part directly — no depth-aware span math needed here. And a TALL is
  // handled by openCells' `claimed` set: its full-height band overlaps the wall rows, so its x-span
  // blocks the "+" above it with no special case.
  return out;
}

/** The "+" cells of one row: what the sheet offers you to fill. In an empty room this is the whole
 *  wall, which is the headline — you tap a cell and get a module that is already the right size,
 *  because the CELL has the size. You never type a dimension to add a unit. */
export function openCells(
  grid: WallGrid,
  j: number,
  cabs: Cabinet[],
  L: ResolvedLayout,
  run: number,
  ceiling: number,
  openings: Room["openings"],
  fittings: Fitting[],
) {
  const ys = rowEdges(grid);
  const band = { y0: ys[j], y1: ys[j + 1] };

  // a module claims this row's cells only if it actually reaches into the band — which is what makes
  // a tall column a MERGED CELL: it is standing in the floor row and the wall row at once, so it
  // blocks the "+" in both, exactly as it does in reality
  const claimed = cabs
    .filter((c) => {
      if (!c.cell || (c.run ?? 0) !== run || !inSheet(c)) return false;
      const b = cabBand(c);
      return Math.min(band.y1, b.y1) - Math.max(band.y0, b.y0) > 30;
    })
    // c.x is RUN-LOCAL; the column track is in WALL space — convert, or on a corner-started wall
    // every module reads as 840mm left of where it is and the "+" cells land on top of cabinets
    .map((c) => ({ x: (c.x ?? 0) + grid.off, w: c.w }));

  return emptyCells(grid, j, claimed, blockersFor(L, run, openings, fittings, band));
}
