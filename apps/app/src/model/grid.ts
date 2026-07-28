// THE WALL GRID — the spreadsheet itself, now with A COLUMN TRACK PER BAND.
//
// The first version shared ONE column track across the whole wall, so every vertical line ran
// floor-to-ceiling and the uppers were forced onto the bases' boundaries. That is domain-wrong —
// pros plan the uppers independent of the lowers, a sink base is 800 but the cabinet above it needn't
// be — and it made adding a cabinet a chore, because splitting the top split the bottom too.
//
// So columns move ONTO EACH ROW. The floor band (bases) owns its column track; each wall band
// (uppers) owns its own. Rows stay shared per-wall — a run of uppers really does hang at one height.
// The consequences:
//
//   • each ROW's column widths sum to the wall length. Always, per band. By construction.
//   • two modules can overlap ONLY IF they are in the SAME band — a 600 upper over an 800 base is
//     fine, and is the whole point. Collision is checked per row.
//   • alignment between bands is now a SNAP you reach for, not a law. The auto-generator still emits
//     aligned tracks by default, so tidy stays the default.
//   • x / y / w / h are still PROJECTED out of the tracks by prefix sum (see `applyGrid`).
//
// A TALL / PANTRY spans floor→ceiling. It is a FLOOR-band cell whose cabinet kind is `tall` (its
// full height is derived); the wall bands above it are kept clear by a blocked span, not by a
// shadow column — see sheet.blockersFor and `tallClash` below.
//
// The free layer (islands, dining tables, corner units) stays OUT of the grid, on the px/pz layer.
//
// Pure. No React, no store. Everything here returns a new object or null-when-unchanged.

import type { Cabinet, CellRef } from "./cabinet";
import { GEOM } from "./layout";

export type { CellRef };

/** narrowest / widest a column may be dragged to (mm) */
export const COL_MIN = 150;
export const COL_MAX = 1200;
/** the width a freshly-added cabinet takes (mm) — a standard 600, stolen from the widest neighbour */
export const COL_DEFAULT = 600;
/** shortest a row that holds modules may be (mm) */
export const ROW_MIN = 200;
/** a void row may vanish entirely */
export const VOID_MIN = 0;
/** The floor row IS the counter height (plinth + carcass + worktop), so it has its own range. */
export const FLOOR_MIN = GEOM.plinth + 550 + GEOM.worktop;
export const FLOOR_MAX = GEOM.plinth + 1000 + GEOM.worktop;

export type RowKind = "floor" | "wall" | "void";

export interface GridCol {
  id: string;
  /** mm */
  w: number;
  /** STRUCTURAL width — a cleared corner zone. Cannot be resized, split, merged, or nudged in a
   *  cascade; the width is derived from the corner unit both walls clear for. A locked column can
   *  still be OCCUPIED (the reach strip beside a shallow corner upper) — lock is about the width,
   *  not about whether a module may stand there. */
  lock?: boolean;
  /** DEAD — nothing may ever be placed here, and it is never offered as a "+" cell. The deep half of
   *  a corner zone (the corner unit itself is free-placed and stands in it). Always `lock` too. */
  dead?: boolean;
  /** THE SHADOW OF A TALL. A floor-to-ceiling pantry/fridge occupies a floor cell; the wall bands
   *  above it must reserve that exact x-span so nothing is placed there AND so an "equalise" (add /
   *  drop column) redistributes only the space BESIDE the tall, not across it. Marked `lock+dead`,
   *  plus this flag so `reconcileTalls` can clear a stale shadow when the tall moves or is deleted. */
  tall?: boolean;
}

export interface GridRow {
  id: string;
  kind: RowKind;
  /** mm */
  h: number;
  /** how deep this row's modules are (mm) — decides how far the row reaches into a corner zone. */
  depth: number;
  /** THIS BAND's own column track. Σ widths === the wall length. */
  cols: GridCol[];
}

export interface WallGrid {
  run: number;
  wallLen: number;
  ceiling: number;
  /** wall-space x of run-local zero — resolve.cornerOffset(run). See applyGrid: it is SUBTRACTED
   *  when writing Cabinet.x, which is run-local. */
  off: number;
  /** BOTTOM → TOP. Columns live on each row now. */
  rows: GridRow[];
}

let _seq = 0;
const _tag = Math.random().toString(36).slice(2, 6);
const uid = (p: string) => `${p}${++_seq}${_tag}`;
const col = (w: number, extra: Partial<GridCol> = {}): GridCol => ({ id: uid("c"), w, ...extra });

const gridded = (c: Cabinet, run: number): boolean => !!c.cell && c.px == null && (c.run ?? 0) === run;

// ── GEOMETRY: the prefix sums. The ONLY place a position is computed. ──────────────────────────

/** left edge of every column in a ROW, in WALL space (mm). `xs[i]` is column i's left edge. */
export function colEdges(row: GridRow): number[] {
  const xs = [0];
  for (const c of row.cols) xs.push(xs[xs.length - 1] + c.w);
  return xs;
}

/** bottom of every row, mm above the floor. `ys[j]` is row j's underside; `ys[n]` is the ceiling. */
export function rowEdges(g: WallGrid): number[] {
  const ys = [0];
  for (const r of g.rows) ys.push(ys[ys.length - 1] + r.h);
  return ys;
}

export const rowIndex = (g: WallGrid, id: string) => g.rows.findIndex((r) => r.id === id);
export const colIndexIn = (row: GridRow, id: string) => row.cols.findIndex((c) => c.id === id);

/** {row index, column index} for a cell — both −1 when stale. */
export function locate(g: WallGrid, ref: CellRef): { j: number; i: number } {
  const j = rowIndex(g, ref.r);
  if (j < 0) return { j: -1, i: -1 };
  return { j, i: colIndexIn(g.rows[j], ref.c) };
}

/** The rectangle a cell reference covers, in WALL space (mm above the floor for y). Null when stale. */
export function cellRect(g: WallGrid, ref: CellRef): { x: number; w: number; y0: number; y1: number } | null {
  const { j, i } = locate(g, ref);
  if (j < 0 || i < 0) return null;
  const row = g.rows[j];
  const xs = colEdges(row);
  const ys = rowEdges(g);
  const i1 = Math.min(row.cols.length, i + Math.max(1, ref.cs ?? 1));
  return { x: xs[i], w: xs[i1] - xs[i], y0: ys[j], y1: ys[j + 1] };
}

/** The invariant, per band: EACH row's columns sum to the wall length, and the rows sum to the
 *  ceiling. If this fails the bug is in an edit op, not in a view. */
export function gridOk(g: WallGrid, tol = 1): boolean {
  const h = g.rows.reduce((a, r) => a + r.h, 0);
  if (Math.abs(h - g.ceiling) > tol) return false;
  return g.rows.every((r) => Math.abs(r.cols.reduce((a, c) => a + c.w, 0) - g.wallLen) <= tol);
}

// ── COLUMN EDITS — all within ONE row now. Every one preserves that row's sum. ────────────────

/** Absorb a border drag through a sequence of sizes, nearest-neighbour-first, clamped so the total
 *  is fixed. What cannot be absorbed is never applied — the border simply stops. */
function dragBorder(
  sizes: number[],
  i: number,
  delta: number,
  min: (k: number) => number,
  max: (k: number) => number,
): number[] | null {
  if (i < 0 || i >= sizes.length - 1) return null;
  const growRoom = Math.min(
    max(i) - sizes[i],
    sizes.slice(i + 1).reduce((a, s, k) => a + (s - min(i + 1 + k)), 0),
  );
  const shrinkRoom = Math.min(
    sizes[i] - min(i),
    sizes.slice(i + 1).reduce((a, s, k) => a + (max(i + 1 + k) - s), 0),
  );
  const d = Math.round(Math.max(-shrinkRoom, Math.min(growRoom, delta)));
  if (d === 0) return null;

  const out = sizes.slice();
  out[i] += d;
  let rest = d;
  for (let k = i + 1; k < out.length && rest !== 0; k++) {
    const room = rest > 0 ? out[k] - min(k) : out[k] - max(k);
    const take = rest > 0 ? Math.min(rest, room) : Math.max(rest, room);
    out[k] -= take;
    rest -= take;
  }
  return rest === 0 ? out : null;
}

/** replace one row's columns, returning a new grid (or null if the row index is bad) */
function withRowCols(g: WallGrid, j: number, cols: GridCol[] | null): WallGrid | null {
  if (!cols || !g.rows[j]) return null;
  return { ...g, rows: g.rows.map((r, k) => (k === j ? { ...r, cols } : r)) };
}

/** Drag the border to the right of column `i` in row `j`. The band's total length never changes. */
export function resizeColBorder(g: WallGrid, j: number, i: number, delta: number): WallGrid | null {
  const row = g.rows[j];
  if (!row || row.cols[i]?.lock) return null;
  const next = dragBorder(
    row.cols.map((c) => c.w),
    i,
    delta,
    (k) => (row.cols[k].lock ? row.cols[k].w : COL_MIN),
    (k) => (row.cols[k].lock ? row.cols[k].w : COL_MAX),
  );
  if (!next) return null;
  return withRowCols(g, j, row.cols.map((c, k) => (c.w === next[k] ? c : { ...c, w: next[k] })));
}

/** Set a column's width by typing a number — neighbours absorb it, same as dragging the border. */
export function setColWidth(g: WallGrid, j: number, i: number, mm: number): WallGrid | null {
  const row = g.rows[j];
  if (!row?.cols[i]) return null;
  if (i === row.cols.length - 1) return resizeColBorder(g, j, i - 1, row.cols[i].w - Math.round(mm));
  return resizeColBorder(g, j, i, Math.round(mm) - row.cols[i].w);
}

/** RESIZE A CONTIGUOUS GROUP of columns `[i0..i1]` in band `j` to a new COMBINED width — the multi-
 *  select "resize these together" edit. Grows/shrinks the group's outer edge (the columns past it
 *  absorb, via the same cascade a single border drag uses), then redistributes the group's resulting
 *  total across its members in proportion to their old widths. Refused if the group holds a locked
 *  column (a corner zone / tall) or the edge can't move. */
export function resizeSpan(g: WallGrid, j: number, i0: number, i1: number, newTotal: number): WallGrid | null {
  const row = g.rows[j];
  if (!row || i0 < 0 || i1 >= row.cols.length || i0 > i1) return null;
  for (let k = i0; k <= i1; k++) if (row.cols[k].lock) return null; // a locked col can't be scaled
  const n = i1 - i0 + 1;
  const oldTotal = row.cols.slice(i0, i1 + 1).reduce((a, c) => a + c.w, 0);
  const target = Math.max(COL_MIN * n, Math.round(newTotal));
  const delta = target - oldTotal;
  if (delta === 0) return g;
  const widths = row.cols.map((c) => c.w);
  // 1) scale the GROUP to `target`, proportional to the old widths — the left edge stays put, so the
  //    group's right edge moves by `delta`
  let acc = 0;
  for (let k = i0; k < i1; k++) {
    widths[k] = Math.max(COL_MIN, Math.round((row.cols[k].w / oldTotal) * target));
    acc += widths[k];
  }
  widths[i1] = target - acc;
  if (widths[i1] < COL_MIN) return null; // can't split the target fairly across the members
  // 2) absorb `delta` out of the fillable columns AFTER the group (they give up / take on the slack,
  //    keeping the band's total = wallLen). Refuse if there isn't room.
  let rest = delta;
  for (let k = i1 + 1; k < widths.length && rest !== 0; k++) {
    if (row.cols[k].lock) continue;
    const room = rest > 0 ? widths[k] - COL_MIN : widths[k] - COL_MAX;
    const take = rest > 0 ? Math.min(rest, room) : Math.max(rest, room);
    widths[k] -= take;
    rest -= take;
  }
  if (rest !== 0) return null; // not enough room past the group to absorb the change
  return withRowCols(g, j, row.cols.map((c, k) => (c.w === widths[k] ? c : { ...c, w: widths[k] })));
}

/** Same as `resizeSpan` but anchored on the group's RIGHT edge — the group's LEFT edge moves and the
 *  fillable columns BEFORE it absorb the change. This is the mirror needed so a multi-selection can be
 *  scaled by dragging EITHER outer edge (right → resizeSpan, left → this), each pushing its own
 *  neighbour, both redistributing the group's new total across its members proportionally. */
export function resizeSpanLeft(g: WallGrid, j: number, i0: number, i1: number, newTotal: number): WallGrid | null {
  const row = g.rows[j];
  if (!row || i0 < 0 || i1 >= row.cols.length || i0 > i1) return null;
  for (let k = i0; k <= i1; k++) if (row.cols[k].lock) return null;
  const n = i1 - i0 + 1;
  const oldTotal = row.cols.slice(i0, i1 + 1).reduce((a, c) => a + c.w, 0);
  const target = Math.max(COL_MIN * n, Math.round(newTotal));
  const delta = target - oldTotal;
  if (delta === 0) return g;
  const widths = row.cols.map((c) => c.w);
  // 1) scale the GROUP to `target`, proportional to the old widths, with the RIGHT edge held put — so
  //    the group's LEFT edge moves by `delta` (grows leftward).
  let acc = 0;
  for (let k = i1; k > i0; k--) {
    widths[k] = Math.max(COL_MIN, Math.round((row.cols[k].w / oldTotal) * target));
    acc += widths[k];
  }
  widths[i0] = target - acc;
  if (widths[i0] < COL_MIN) return null;
  // 2) absorb `delta` out of the fillable columns BEFORE the group, keeping the band total = wallLen.
  let rest = delta;
  for (let k = i0 - 1; k >= 0 && rest !== 0; k--) {
    if (row.cols[k].lock) continue;
    const room = rest > 0 ? widths[k] - COL_MIN : widths[k] - COL_MAX;
    const take = rest > 0 ? Math.min(rest, room) : Math.max(rest, room);
    widths[k] -= take;
    rest -= take;
  }
  if (rest !== 0) return null;
  return withRowCols(g, j, row.cols.map((c, k) => (c.w === widths[k] ? c : { ...c, w: widths[k] })));
}

/** DISTRIBUTE EQUALLY — make every column in the contiguous group `[i0..i1]` the same width, keeping
 *  their COMBINED width (and therefore the band's total) unchanged. "Distribute equally" for a
 *  multi-selection. Refused if the group holds a locked column. */
export function equalizeSpan(g: WallGrid, j: number, i0: number, i1: number): WallGrid | null {
  const row = g.rows[j];
  if (!row || i0 < 0 || i1 >= row.cols.length || i0 > i1) return null;
  for (let k = i0; k <= i1; k++) if (row.cols[k].lock) return null;
  const n = i1 - i0 + 1;
  if (n < 2) return null;
  const total = row.cols.slice(i0, i1 + 1).reduce((a, c) => a + c.w, 0);
  const base = Math.floor(total / n);
  const rem = total - base * n; // spread one-per-column so the group sums EXACTLY (edges never move)
  return withRowCols(g, j, row.cols.map((c, k) => (k >= i0 && k <= i1 ? { ...c, w: base + (k - i0 < rem ? 1 : 0) } : c)));
}

/** Split column `i` of row `j` at `atMm` from its left edge — the two halves sum to the original. */
export function splitCol(g: WallGrid, j: number, i: number, atMm: number): WallGrid | null {
  const row = g.rows[j];
  const c = row?.cols[i];
  if (!c || c.lock) return null;
  const a = Math.round(atMm);
  if (a < COL_MIN || c.w - a < COL_MIN) return null;
  const cols = row.cols.slice();
  cols.splice(i, 1, { id: c.id, w: a }, col(c.w - a));
  return withRowCols(g, j, cols);
}

/** Merge columns `i…i+n-1` of row `j` into one. Refused if the result exceeds a fillable width. */
export function mergeCols(g: WallGrid, j: number, i: number, n: number): WallGrid | null {
  const row = g.rows[j];
  if (!row || n < 2 || i < 0 || i + n > row.cols.length) return null;
  const slice = row.cols.slice(i, i + n);
  if (slice.some((c) => c.lock)) return null;
  const w = slice.reduce((a, c) => a + c.w, 0);
  if (w > COL_MAX) return null;
  const cols = row.cols.slice();
  cols.splice(i, n, { id: slice[0].id, w });
  return withRowCols(g, j, cols);
}

/** ADD A COLUMN to a band — the seller's "+ another cabinet".
 *
 *  Appends the new column at the END of the band's fillable run and RE-DISTRIBUTES the whole run to
 *  EQUAL widths. A kitchen row is a row of equal cabinets, so "one more" should mean "now they're all
 *  a bit narrower and there's a fresh slot on the end" — not "an odd gap appears next to the first
 *  cabinet." (That was the earlier steal-from-widest behaviour, and it read as weird exactly because
 *  it left the other cabinets untouched and dumped the slack in the middle.) The user drags a border
 *  only when they *want* an unequal width; the default stays tidy on its own.
 *
 *  Refused when the band is already so full that another equal column would fall below COL_MIN. The
 *  locked corner zones keep their structural widths and only the run between them is equalised. */
export function addColumn(g: WallGrid, j: number): WallGrid | null {
  const row = g.rows[j];
  if (!row) return null;
  const lockedW = row.cols.reduce((a, c) => a + (c.lock ? c.w : 0), 0);
  const fillCount = row.cols.reduce((a, c) => a + (c.lock ? 0 : 1), 0);
  if (fillCount === 0) return null;

  const total = g.wallLen - lockedW; // the fillable span
  const n = fillCount + 1;
  const base = Math.floor(total / n);
  if (base < COL_MIN) return null; // no room for another equal column — the band is at capacity
  const rem = total - base * n; // 0..n−1 mm of rounding, spread one-per-column so all stay within 1mm

  // Emit the locked columns in place; give every fillable column an equal width; and append the new
  // (empty) column right after the LAST fillable one — the right end of the run.
  const lastFill = row.cols.reduce((last, c, i) => (c.lock ? last : i), -1);
  const widths = Array.from({ length: n }, (_, k) => base + (k < rem ? 1 : 0));
  const out: GridCol[] = [];
  let w = 0;
  row.cols.forEach((c, i) => {
    if (c.lock) {
      out.push(c);
      return;
    }
    out.push({ ...c, w: widths[w++] });
    if (i === lastFill) out.push(col(widths[w++])); // the fresh slot on the end
  });
  return withRowCols(g, j, out);
}

/** DROP the last column of a band — the "−" to `addColumn`'s "+". Removes the rightmost fillable
 *  column and RE-EQUALISES the rest, so the row stays a row of equal cabinets (four 450s become three
 *  600s). Keeps at least one fillable column, and refuses when the survivors would be too wide to
 *  fill (a 1600mm wall can't collapse to one cabinet).
 *
 *  The caller (store.gridDropCol) is responsible for deleting whatever cabinet was ANCHORED in the
 *  removed column — it has nowhere to go. A cabinet merely SPANNING into it just loses a column and
 *  shrinks (applyGrid clamps the span). */
export function dropColumn(g: WallGrid, j: number): WallGrid | null {
  const row = g.rows[j];
  if (!row) return null;
  const fillCount = row.cols.reduce((a, c) => a + (c.lock ? 0 : 1), 0);
  if (fillCount < 2) return null; // a band keeps at least one fillable column
  const lockedW = row.cols.reduce((a, c) => a + (c.lock ? c.w : 0), 0);
  const total = g.wallLen - lockedW;
  const n = fillCount - 1;
  const base = Math.floor(total / n);
  if (base > COL_MAX) return null; // the survivors would be un-fillably wide
  const rem = total - base * n;
  const lastFill = row.cols.reduce((last, c, i) => (c.lock ? last : i), -1);
  const widths = Array.from({ length: n }, (_, k) => base + (k < rem ? 1 : 0));
  const out: GridCol[] = [];
  let w = 0;
  row.cols.forEach((c, i) => {
    if (c.lock) {
      out.push(c);
      return;
    }
    if (i === lastFill) return; // drop the rightmost fillable column
    out.push({ ...c, w: widths[w++] });
  });
  return withRowCols(g, j, out);
}

/** The id of the rightmost fillable column of a band — the one `dropColumn` removes, so the store
 *  knows which cabinet to delete with it. Null when the band has no fillable column. */
export function lastFillColId(row: GridRow): string | null {
  for (let i = row.cols.length - 1; i >= 0; i--) if (!row.cols[i].lock) return row.cols[i].id;
  return null;
}

/** REMOVE a column from a band — its width is DISTRIBUTED over the fillable neighbours, nearest
 *  first, each only up to COL_MAX. Refused when the width can't fit without leaving an over-wide
 *  (un-fillable) column: on a fixed-length wall you cannot always drop a column, and pretending you
 *  can is what produced a 1800mm cell the fuzz caught. */
export function removeColumn(g: WallGrid, j: number, i: number): WallGrid | null {
  const row = g.rows[j];
  const c = row?.cols[i];
  if (!c || c.lock || row.cols.length < 2) return null;
  const add = new Array(row.cols.length).fill(0);
  let rest = c.w;
  for (let d = 1; d < row.cols.length && rest > 0; d++) {
    for (const k of [i + d, i - d]) {
      if (k < 0 || k >= row.cols.length || k === i || row.cols[k].lock) continue;
      const give = Math.min(rest, COL_MAX - (row.cols[k].w + add[k]));
      add[k] += Math.max(0, give);
      rest -= Math.max(0, give);
      if (rest <= 0) break;
    }
  }
  if (rest > 0) return null; // nowhere to put the width without an over-wide column
  const cols = row.cols.map((cc, k) => (add[k] ? { ...cc, w: cc.w + add[k] } : cc)).filter((_, k) => k !== i);
  return withRowCols(g, j, cols);
}

// ── ROW EDITS ─────────────────────────────────────────────────────────────────────────────────

export function resizeRowBorder(g: WallGrid, j: number, delta: number): WallGrid | null {
  const minOf = (k: number) => (g.rows[k].kind === "void" ? VOID_MIN : g.rows[k].kind === "floor" ? FLOOR_MIN : ROW_MIN);
  const maxOf = (k: number) => (g.rows[k].kind === "floor" ? FLOOR_MAX : Infinity);
  const next = dragBorder(g.rows.map((r) => r.h), j, delta, minOf, maxOf);
  if (!next) return null;
  return { ...g, rows: g.rows.map((r, k) => (r.h === next[k] ? r : { ...r, h: next[k] })) };
}

/** Split a row — how an антресоль is born: carve a band out of DEAD WALL. Only a void may be split
 *  (you cannot cut a second row out of the counter, and the fuzz proved that corrupts a base into a
 *  floating upper). Both halves inherit a COPY of the band's column track. */
export function splitRow(g: WallGrid, j: number, atMm: number, kind: RowKind, depth?: number): WallGrid | null {
  const r = g.rows[j];
  if (!r || r.kind !== "void") return null;
  const a = Math.round(atMm);
  if (a < 1 || r.h - a < 1) return null;
  const copy = (): GridCol[] => r.cols.map((c) => ({ ...c, id: uid("c") }));
  const rows = g.rows.slice();
  rows.splice(
    j,
    1,
    { id: r.id, kind, h: a, depth: depth ?? r.depth, cols: r.cols },
    { id: uid("r"), kind: r.kind, h: r.h - a, depth: r.depth, cols: copy() },
  );
  return { ...g, rows };
}

/** Turn dead wall into a band that holds modules, or back. Never touches the FLOOR row — the
 *  counter is not a band you can toggle off. */
export function setRowKind(g: WallGrid, j: number, kind: RowKind): WallGrid | null {
  const r = g.rows[j];
  if (!r || r.kind === kind || r.kind === "floor" || kind === "floor") return null;
  return { ...g, rows: g.rows.map((x, k) => (k === j ? { ...x, kind } : x)) };
}

export function setRowHeight(g: WallGrid, j: number, mm: number): WallGrid | null {
  if (!g.rows[j]) return null;
  if (j === g.rows.length - 1) return resizeRowBorder(g, j - 1, g.rows[j].h - Math.round(mm));
  return resizeRowBorder(g, j, Math.round(mm) - g.rows[j].h);
}

// ── BUILDING A GRID ───────────────────────────────────────────────────────────────────────────

const DEPTH_FLOOR = 560;
const DEPTH_WALL = 350;

/** Tile a length in the widths a kitchen is built from: standard 600s, the last one absorbing the
 *  remainder (3800 → 600·5 + 800, never 633·6). Must tile EXACTLY. */
function tile(total: number, pref = COL_DEFAULT): number[] {
  const L = Math.max(COL_MIN, Math.round(total));
  if (L <= COL_MAX) return [L];
  const n = Math.max(1, Math.floor(L / pref));
  const out = Array.from({ length: n }, () => pref);
  const rem = L - n * pref;
  if (rem > 0) {
    if (out[n - 1] + rem <= COL_MAX) out[n - 1] += rem;
    else if (rem >= COL_MIN) out.push(rem);
    else out[n - 1] += rem;
  }
  return out;
}

/** THE CORNER ZONE, as this band's columns. Depth-aware now that each row builds its own: a 560mm
 *  floor band clears the full 840 (all dead — the corner base is free-placed), a 350mm wall band
 *  clears 613 dead + a 227 reach strip that a shallow corner upper legitimately fills. */
function zoneCols(zoneLen: number, reach: number, atEnd: boolean): GridCol[] {
  if (zoneLen <= 0) return [];
  const r = Math.min(Math.max(0, Math.round(reach)), zoneLen);
  if (r < COL_MIN || zoneLen - r < COL_MIN) return [col(zoneLen, { lock: true, dead: true })];
  const deep = col(zoneLen - r, { lock: true, dead: true });
  const strip = col(r, { lock: true }); // fillable
  return atEnd ? [strip, deep] : [deep, strip];
}

/** Build one band's column track: start corner zone, the usable run tiled into 600s, end corner
 *  zone — each zone sized for THIS band's depth. `reachFor` maps a depth to its corner reach
 *  (sheet.ts supplies runPlan.runReach; grid.ts stays free of that dependency). */
function bandCols(off: number, usable: number, endZone: number, depth: number, reachFor: (d: number) => number): GridCol[] {
  const reach = reachFor(depth);
  return [
    ...zoneCols(off, reach, false),
    ...tile(usable).map((w) => col(w)),
    ...zoneCols(endZone, reach, true),
  ];
}

const noReach = () => 0;

/** THE EMPTY ROOM'S SHEET — a bare wall already has bands, each with columns and fillable cells. */
export function defaultGrid(
  run: number,
  wallLen: number,
  ceiling: number,
  off = 0,
  runLen?: number,
  reachFor: (d: number) => number = noReach,
): WallGrid {
  const counter = GEOM.plinth + GEOM.baseH + GEOM.worktop; // 860
  const wallTop = Math.min(ceiling, GEOM.upperBottom + GEOM.upperH); // 2220
  const L = Math.round(wallLen);
  const usable = Math.round(runLen ?? L - off);
  const endZone = Math.max(0, L - off - usable);
  const cols = (depth: number) => bandCols(off, usable, endZone, depth, reachFor);

  const rows: GridRow[] = [
    { id: uid("r"), kind: "floor", h: counter, depth: DEPTH_FLOOR, cols: cols(DEPTH_FLOOR) },
    { id: uid("r"), kind: "void", h: Math.max(0, GEOM.upperBottom - counter), depth: DEPTH_WALL, cols: cols(DEPTH_WALL) },
    { id: uid("r"), kind: "wall", h: Math.max(ROW_MIN, wallTop - GEOM.upperBottom), depth: DEPTH_WALL, cols: cols(DEPTH_WALL) },
  ];
  const used = rows.reduce((a, r) => a + r.h, 0);
  rows.push({ id: uid("r"), kind: "void", h: Math.max(0, ceiling - used), depth: DEPTH_WALL, cols: cols(DEPTH_WALL) });
  return { run, wallLen: L, ceiling: Math.round(ceiling), off, rows };
}

/** Cluster edge positions into a track: any two within `tol` collapse onto one line at their mean.
 *  Per BAND now, so it no longer has to reconcile the uppers against the bases — each band clusters
 *  only its own module edges, which is simpler and lets the two bands differ. */
function cluster(edges: number[], total: number, tol: number): number[] {
  const pts = [...edges, 0, total].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket: number[] = [];
  const flush = () => {
    if (!bucket.length) return;
    out.push(Math.round(bucket.reduce((a, b) => a + b, 0) / bucket.length));
    bucket = [];
  };
  for (const p of pts) {
    if (bucket.length && p - bucket[0] > tol) flush();
    bucket.push(p);
  }
  flush();
  out[0] = 0;
  out[out.length - 1] = total;
  if (total < 2 * COL_MIN) return [0, total];
  const kept = [0];
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i] - kept[kept.length - 1] >= COL_MIN && total - out[i] >= COL_MIN) kept.push(out[i]);
  }
  kept.push(total);
  return kept;
}

export interface GridSeed {
  id: string;
  /** left edge in WALL space (mm) */
  x: number;
  w: number;
  /** occupied band (mm above the floor) */
  y0: number;
  y1: number;
  depth: number;
  kind: Cabinet["kind"];
}

/** Build one band's column track from the modules that sit in it — its distinct edges, clustered,
 *  with the corner zones prepended/appended (they are structural and never clustered). Talls are
 *  excluded from the WALL bands' edges: a tall is a floor cell, and the wall band above it is kept
 *  clear by a blocked span, not a column. */
function bandColsFromSeeds(
  bandSeeds: GridSeed[],
  off: number,
  usable: number,
  endZone: number,
  depth: number,
  reachFor: (d: number) => number,
  tol: number,
): GridCol[] {
  const lo = off;
  const hi = off + usable;
  const inner = bandSeeds
    .flatMap((s) => [s.x, s.x + s.w])
    .filter((x) => x > lo + COL_MIN / 2 && x < hi - COL_MIN / 2);
  const lines = cluster(inner.map((x) => x - lo), Math.max(COL_MIN, usable), tol);
  const cols: GridCol[] = [...zoneCols(off, reachFor(depth), false)];
  for (let i = 1; i < lines.length; i++) {
    const w = lines[i] - lines[i - 1];
    for (const part of w > COL_MAX ? tile(w) : [w]) cols.push(col(part));
  }
  cols.push(...zoneCols(endZone, reachFor(depth), true));
  return cols;
}

/** MIGRATION — read an existing wall back into a per-band sheet. Bands come from the modules'
 *  y-spans (as before); each band's columns come from ITS OWN modules' edges. Then every module
 *  gets a cell address in its band. */
export function gridFromSeeds(
  run: number,
  wallLen: number,
  ceiling: number,
  seeds: GridSeed[],
  counter: number,
  off = 0,
  runLen?: number,
  reachFor: (d: number) => number = noReach,
  tol = 60,
): { grid: WallGrid; cells: Map<string, CellRef> } {
  if (!seeds.length) return { grid: defaultGrid(run, wallLen, ceiling, off, runLen, reachFor), cells: new Map() };

  const WL = Math.round(wallLen);
  const usable = Math.round(runLen ?? WL - off);
  const endZone = Math.max(0, WL - off - usable);

  // ── rows: the floor band, the wall bands the uppers hang in, and the voids between.
  const uppers = seeds.filter((s) => s.kind === "upper").sort((a, b) => a.y0 - b.y0);
  const bands: { y0: number; y1: number; depth: number }[] = [];
  for (const u of uppers) {
    const last = bands[bands.length - 1];
    if (last && Math.min(last.y1, u.y1) - Math.max(last.y0, u.y0) > 30) {
      last.y0 = Math.min(last.y0, u.y0);
      last.y1 = Math.max(last.y1, u.y1);
      last.depth = Math.max(last.depth, u.depth);
    } else bands.push({ y0: u.y0, y1: u.y1, depth: u.depth });
  }

  // floor band seeds = the bases (and talls, which the floor track carves a column for)
  const floorSeeds = seeds.filter((s) => s.kind !== "upper");

  const rows: GridRow[] = [
    {
      id: uid("r"),
      kind: "floor",
      h: Math.round(counter),
      depth: DEPTH_FLOOR,
      cols: bandColsFromSeeds(floorSeeds, off, usable, endZone, DEPTH_FLOOR, reachFor, tol),
    },
  ];
  let y = Math.round(counter);
  if (!bands.length) {
    // NO wall units are standing — but still lay out the STANDARD upper band (empty), exactly like a
    // fresh wall (`defaultGrid`) does, so «Навесные» can be placed on this wall like a base. Without
    // this, any rebuild off base-only seeds (adding a corner, docking a module, a stale grid) would
    // collapse everything above the worktop into one void, and you could place nothing but bases —
    // the "I can only add base cabinets after building" bug.
    const wallTop = Math.min(ceiling, GEOM.upperBottom + GEOM.upperH);
    const back = Math.round(GEOM.upperBottom - counter);
    if (back > 0) rows.push({ id: uid("r"), kind: "void", h: back, depth: DEPTH_WALL, cols: bandCols(off, usable, endZone, DEPTH_WALL, reachFor) });
    if (wallTop - GEOM.upperBottom >= ROW_MIN) {
      rows.push({ id: uid("r"), kind: "wall", h: Math.round(wallTop - GEOM.upperBottom), depth: DEPTH_WALL, cols: bandCols(off, usable, endZone, DEPTH_WALL, reachFor) });
      y = Math.round(wallTop);
    } else {
      y = Math.round(counter + Math.max(0, back));
    }
  } else
  for (const b of bands) {
    const gap = Math.round(b.y0) - y;
    if (gap > 0) {
      rows.push({ id: uid("r"), kind: "void", h: gap, depth: DEPTH_WALL, cols: bandCols(off, usable, endZone, DEPTH_WALL, reachFor) });
    }
    const bandSeeds = uppers.filter((s) => Math.min(b.y1, s.y1) - Math.max(b.y0, s.y0) > 30);
    rows.push({
      id: uid("r"),
      kind: "wall",
      h: Math.max(1, Math.round(b.y1 - b.y0)),
      depth: b.depth,
      cols: bandColsFromSeeds(bandSeeds, off, usable, endZone, b.depth, reachFor, tol),
    });
    y = Math.round(b.y1);
  }
  if (ceiling - y > 0) {
    rows.push({ id: uid("r"), kind: "void", h: Math.round(ceiling - y), depth: DEPTH_WALL, cols: bandCols(off, usable, endZone, DEPTH_WALL, reachFor) });
  }
  const hSum = rows.reduce((a, r) => a + r.h, 0);
  if (hSum !== Math.round(ceiling)) rows[rows.length - 1].h += Math.round(ceiling) - hSum;

  const grid: WallGrid = { run, wallLen: WL, ceiling: Math.round(ceiling), off, rows };

  // ── addresses: snap each module onto ITS band's track
  const ys = rowEdges(grid);
  const nearest = (arr: number[], v: number) =>
    arr.reduce((best, p, i) => (Math.abs(p - v) < Math.abs(arr[best] - v) ? i : best), 0);

  const cells = new Map<string, CellRef>();
  for (const s of seeds) {
    // which row does this module belong to? the band whose y-span it best overlaps
    let j = -1;
    let bestOv = 0;
    for (let k = 0; k < grid.rows.length; k++) {
      if (grid.rows[k].kind === "void") continue;
      const ov = Math.min(ys[k + 1], s.y1) - Math.max(ys[k], s.y0);
      if (ov > bestOv) { bestOv = ov; j = k; }
    }
    if (j < 0) continue;
    const xs = colEdges(grid.rows[j]);
    const c0 = nearest(xs, s.x);
    const c1 = Math.max(c0 + 1, nearest(xs, s.x + s.w));
    if (c0 >= grid.rows[j].cols.length) continue;
    cells.set(s.id, {
      c: grid.rows[j].cols[c0].id,
      r: grid.rows[j].id,
      cs: Math.min(c1 - c0, grid.rows[j].cols.length - c0),
    });
  }
  return { grid, cells };
}

// ── TALL SHADOWS: a floor-to-ceiling module reserves its x-span in the bands above it. ────────

/** Split a band's columns at `atX` (wall-space mm) if that falls INSIDE a column — idempotent when
 *  `atX` is already a boundary or outside the band. The left part keeps the original id + flags. */
function splitColsAt(cols: GridCol[], atX: number): GridCol[] {
  let x = 0;
  for (let i = 0; i < cols.length; i++) {
    const a = x;
    const b = x + cols[i].w;
    if (atX > a + 0.5 && atX < b - 0.5) {
      const c = cols[i];
      return [
        ...cols.slice(0, i),
        { ...c, w: atX - a },
        { id: uid("c"), w: b - atX, lock: c.lock, dead: c.dead, tall: c.tall },
        ...cols.slice(i + 1),
      ];
    }
    x = b;
  }
  return cols;
}

/** Reserve `[x0,x1]` (wall space) as a tall shadow in one band: split at both ends, then mark every
 *  column that now lies inside the span as `lock+dead+tall`. */
function carveShadow(cols: GridCol[], x0: number, x1: number): GridCol[] {
  const out = splitColsAt(splitColsAt(cols, x0), x1);
  let x = 0;
  return out.map((c) => {
    const a = x;
    x += c.w;
    const inside = a >= x0 - 0.5 && x <= x1 + 0.5;
    if (!inside) return c;
    return c.lock && c.dead && c.tall ? c : { ...c, lock: true, dead: true, tall: true };
  });
}

/** Keep the tall shadows in every wall/void band in sync with the talls actually standing on the
 *  floor. Clears every existing shadow first (so a moved or deleted tall leaves nothing behind), then
 *  carves the current talls' x-spans. Idempotent: a grid already reconciled comes back unchanged. */
export function reconcileTalls(grid: WallGrid, cabs: Cabinet[]): WallGrid {
  const floorJ = grid.rows.findIndex((r) => r.kind === "floor");
  if (floorJ < 0) return grid;
  const floor = grid.rows[floorJ];
  const fxs = colEdges(floor);

  const spans: [number, number][] = [];
  for (const c of cabs) {
    if (c.kind !== "tall" || !c.cell || c.px != null || (c.run ?? 0) !== grid.run) continue;
    const i = colIndexIn(floor, c.cell.c);
    if (i < 0) continue;
    const i1 = Math.min(floor.cols.length, i + Math.max(1, c.cell.cs ?? 1));
    spans.push([fxs[i], fxs[i1]]);
  }

  let changed = false;
  const rows = grid.rows.map((row) => {
    const onFloor = row.kind === "floor";
    // clear old tall marks → plain fillable of the same width. A corner-zone column is lock+dead but
    // carries NO `tall` flag, so it is left untouched here.
    let cols = row.cols.some((c) => c.tall) ? row.cols.map((c) => (c.tall ? { id: c.id, w: c.w } : c)) : row.cols;
    // FLOOR band: lock the pantry's OWN column so a base-band equalise (+/−/border-drag) can't resize
    // or slide it. WALL/VOID bands: carve the shadow it casts above. Without the floor lock, a "+" on
    // the base band redistributes the whole row over the fridge — it shrinks, and its shadow re-carves
    // to the new width leaving a sliver in the wall bands (the "192 | 4" the user saw).
    for (const [x0, x1] of spans) cols = onFloor ? lockSpan(cols, x0, x1) : carveShadow(cols, x0, x1);
    // MUST be idempotent: the clear-then-carve above always allocates a new array even when the
    // shadows are already exactly right, so compare by VALUE, not reference — otherwise a grid that
    // is already reconciled reports "changed", ensureSheet's self-heal keeps returning a fresh grid,
    // and ConfigScreen's effect re-fires forever ("Maximum update depth exceeded").
    if (colsEqual(cols, row.cols)) return row;
    changed = true;
    return { ...row, cols };
  });
  return changed ? { ...grid, rows } : grid;
}

/** Lock a tall's OWN floor column(s) at `[x0,x1]`: split at both ends, then mark each column inside as
 *  `lock+tall` — but NOT `dead`, because the pantry OCCUPIES this cell (unlike the shadow it casts in
 *  the bands above, which nothing can fill). Locking is what stops a base-band equalise from resizing
 *  or sliding the pantry. Idempotent: a column already marked comes back untouched. */
function lockSpan(cols: GridCol[], x0: number, x1: number): GridCol[] {
  const out = splitColsAt(splitColsAt(cols, x0), x1);
  let x = 0;
  return out.map((c) => {
    const a = x;
    x += c.w;
    const inside = a >= x0 - 0.5 && x <= x1 + 0.5;
    if (!inside) return c;
    return c.lock && c.tall && !c.dead ? c : { id: c.id, w: c.w, lock: true, tall: true };
  });
}

/** Two column tracks are the same layout: same count, same id/width/flags in order. */
function colsEqual(a: GridCol[], b: GridCol[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (c, i) =>
      c.id === b[i].id &&
      Math.abs(c.w - b[i].w) < 0.5 &&
      !!c.lock === !!b[i].lock &&
      !!c.dead === !!b[i].dead &&
      !!c.tall === !!b[i].tall,
  );
}

// ── PROJECTION: the grid writes the cabinets, never the other way round. ──────────────────────

/** Push each band's track onto the modules in it: x / w / h / mountY / depth become functions of
 *  the cell. A floor cell is a base — UNLESS the cabinet's own kind says `tall`, in which case it
 *  runs full height (a tall is a first-class kind now, not a vertical cell-merge). */
export function applyGrid(cabs: Cabinet[], grid: WallGrid): Cabinet[] | null {
  const ys = rowEdges(grid);
  let changed = false;

  const out = cabs.map((c) => {
    if (!gridded(c, grid.run)) return c;
    const { j, i } = locate(grid, c.cell!);
    if (j < 0 || i < 0) return c; // stale — the healer re-seats it
    const row = grid.rows[j];
    const xs = colEdges(row);
    const i1 = Math.min(row.cols.length, i + Math.max(1, c.cell!.cs ?? 1));

    const x = xs[i] - grid.off; // WALL space → RUN-LOCAL
    const w = xs[i1] - xs[i];
    const y0 = ys[j];
    const y1 = ys[j + 1];
    const depth = row.depth;

    const onFloor = row.kind === "floor";
    const kind: Cabinet["kind"] = onFloor ? (c.kind === "tall" ? "tall" : "base") : "upper";

    const patch: Partial<Cabinet> =
      kind === "base"
        ? { x, w, kind, h: Math.max(300, y1 - GEOM.plinth - GEOM.worktop), depth, mountY: undefined }
        : kind === "tall"
          ? { x, w, kind, h: Math.max(300, grid.ceiling - GEOM.plinth), depth, mountY: undefined }
          : { x, w, kind, h: Math.max(ROW_MIN, y1 - y0), mountY: y0, depth };

    const same = (Object.keys(patch) as (keyof Cabinet)[]).every((k) => c[k] === patch[k]);
    if (same) return c;
    changed = true;
    return { ...c, ...patch };
  });

  return changed ? out : null;
}

// ── THE SHEET: grid + modules, kept consistent. The ONE door for every edit. ──────────────────

/** the index rectangle a module claims within its band: row j, columns [c0,c1) */
interface Claim {
  id: string;
  j: number;
  c0: number;
  c1: number;
  /** wall-space x-span, for the cross-band tall guard */
  x0: number;
  x1: number;
  tall: boolean;
}

function claims(cabs: Cabinet[], g: WallGrid): Claim[] {
  const out: Claim[] = [];
  for (const c of cabs) {
    if (!gridded(c, g.run)) continue;
    const { j, i } = locate(g, c.cell!);
    if (j < 0 || i < 0) continue;
    const row = g.rows[j];
    const xs = colEdges(row);
    const c1 = Math.min(row.cols.length, i + Math.max(1, c.cell!.cs ?? 1));
    out.push({ id: c.id, j, c0: i, c1, x0: xs[i], x1: xs[c1], tall: c.kind === "tall" && row.kind === "floor" });
  }
  return out;
}

/** Two modules collide iff they are in the SAME band and their columns overlap — cross-band is now
 *  legal and expected. PLUS the one cross-band rule: a floor TALL runs full height, so an upper may
 *  not stand in its x-span. That is the only place the bands are coupled. */
export function cellsCollide(cabs: Cabinet[], g: WallGrid): boolean {
  const cl = claims(cabs, g);
  for (let a = 0; a < cl.length; a++) {
    for (let b = a + 1; b < cl.length; b++) {
      const p = cl[a];
      const q = cl[b];
      if (p.j === q.j) {
        if (p.c0 < q.c1 && q.c0 < p.c1) return true; // same band, overlapping columns
      } else if (p.tall !== q.tall) {
        // a tall (floor, full height) vs a wall unit — overlap in wall-space x is a real clash
        const wall = p.tall ? q : p;
        const tall = p.tall ? p : q;
        if (g.rows[wall.j].kind !== "floor" && tall.x0 < wall.x1 && wall.x0 < tall.x1) return true;
      }
    }
  }
  return false;
}

/** Re-point modules whose column or row was deleted, from where they currently stand. */
function reanchor(cabs: Cabinet[], g: WallGrid): Cabinet[] {
  const ys = rowEdges(g);
  const near = (arr: number[], v: number) =>
    arr.reduce((best, p, i) => (Math.abs(p - v) < Math.abs(arr[best] - v) ? i : best), 0);

  return cabs.map((c) => {
    if (!gridded(c, g.run)) return c;
    const { j, i } = locate(g, c.cell!);
    if (j >= 0 && i >= 0) return c;

    const x = (c.x ?? 0) + g.off;
    const y0 = c.kind === "upper" ? (c.mountY ?? GEOM.upperBottom) : 0;
    const y1 = c.kind === "upper" ? y0 + c.h : c.kind === "tall" ? GEOM.plinth + c.h : GEOM.plinth + c.h + GEOM.worktop;
    // the band it best overlaps
    let rj = -1;
    let bestOv = -Infinity;
    for (let k = 0; k < g.rows.length; k++) {
      if (g.rows[k].kind === "void") continue;
      const ov = Math.min(ys[k + 1], y1) - Math.max(ys[k], y0);
      if (ov > bestOv) { bestOv = ov; rj = k; }
    }
    if (rj < 0) rj = Math.min(g.rows.length - 1, near(ys, y0));
    const xs = colEdges(g.rows[rj]);
    const c0 = Math.min(g.rows[rj].cols.length - 1, near(xs, x));
    const c1 = Math.max(c0 + 1, near(xs, x + c.w));
    return {
      ...c,
      cell: { c: g.rows[rj].cols[c0].id, r: g.rows[rj].id, cs: Math.min(c1 - c0, g.rows[rj].cols.length - c0) },
    };
  });
}

/** Drop any wall unit that has ended up INSIDE a tall's shadow — a full-height pantry/fridge and a
 *  wall cabinet cannot share the same x, so the cabinet has to go. Normally a no-op (the shadow is
 *  locked, so an equalise never redistributes an upper into it); it only bites when the shadow was
 *  briefly out of sync, and then it clears the mess instead of the whole edit being refused. */
export function evictUnderTalls(cabs: Cabinet[], grid: WallGrid): Cabinet[] {
  return cabs.filter((c) => {
    if (c.kind !== "upper" || !c.cell || c.px != null || (c.run ?? 0) !== grid.run) return true;
    const { j, i } = locate(grid, c.cell);
    return j < 0 || i < 0 || !grid.rows[j].cols[i].tall;
  });
}

/** APPLY A TRACK EDIT — the only supported way to change a sheet. Re-anchors, refuses any edit that
 *  would put two modules in one cell (or a tall under an upper), and re-projects geometry. */
export function editSheet(cabs: Cabinet[], next: WallGrid | null): { grid: WallGrid; cabs: Cabinet[] } | null {
  if (!next || !gridOk(next)) return null;
  // keep the wall bands' tall shadows in sync BEFORE anything anchors to the track — otherwise an
  // "equalise" (add/drop column) redistributes across the space a pantry stands in, and the uppers
  // slide underneath it and clash.
  const g = reconcileTalls(next, cabs);
  if (!gridOk(g)) return null;
  // any upper that the edit pushed into a tall's shadow is removed (it can't share x with a
  // full-height module) — so the edit CLEANS UP instead of being refused on the resulting clash
  const kept = evictUnderTalls(cabs, g);
  const healed = reanchor(kept, g);
  if (cellsCollide(healed, g)) return null;
  return { grid: g, cabs: applyGrid(healed, g) ?? healed };
}

/** The "+" cells of one band that nothing occupies. Dead columns (the deep corner zone) are never
 *  offered; `blocked` spans (windows, radiators, a tall standing full-height below) gate the rest. */
export function emptyCells(
  grid: WallGrid,
  j: number,
  occupied: { x: number; w: number }[],
  blocked: { a: number; b: number }[] = [],
): { c: string; cs: number; x: number; w: number }[] {
  const row = grid.rows[j];
  if (!row || row.kind === "void") return [];
  const xs = colEdges(row);
  const taken = (i: number) => {
    if (row.cols[i].dead) return true;
    const a = xs[i];
    const b = xs[i + 1];
    const hit = (s: { a: number; b: number }) => Math.min(b, s.b) - Math.max(a, s.a) > 30;
    return occupied.some((o) => hit({ a: o.x, b: o.x + o.w })) || blocked.some(hit);
  };
  const out: { c: string; cs: number; x: number; w: number }[] = [];
  for (let i = 0; i < row.cols.length; i++) {
    if (taken(i)) continue;
    out.push({ c: row.cols[i].id, cs: 1, x: xs[i], w: xs[i + 1] - xs[i] });
  }
  return out;
}
