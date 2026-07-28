// THE interior model, and the one place it is flattened into countable parts.
//
// A module's interior is a recursive `Cell` tree (schema/module.ts): a cell either splits into
// rows/cols, or is a leaf carrying its own front (door / drawer / nothing). A front placed on a
// SPLIT node covers all of it — the children become the compartments behind it. That's what lets
// one cabinet mix drawers, doors and open niches in any arrangement.
//
// Two functions:
//   deriveLayout()  legacy `fill`/`count`/`dividers` → the equivalent tree. The compatibility
//                   shim: a module (or a project saved before the tree existed) that has no
//                   `layout` still decomposes through the same code path.
//   walkInterior()  tree → { fronts, shelves, dividers }, as FRACTIONS of the module face.
//                   parts.ts turns those into mm. Everything downstream — panels, edge banding,
//                   hinges, slides, drill holes — is counted from this one walk.
//
// Fractions, not mm, because a front tiles the module FACE (w × h) while a separator tiles the
// INTERIOR (w − 2t): the two have different origins but the same fractions. Keeping the walk in
// fraction space means neither caller can pick the wrong one.
//
// Pure. No I/O.

import type { Cell, DoorOpening, HandlePos, ModuleFill } from "../../schema/src/index.js";

/** A cell with no children — a single compartment, whatever its front. */
export const isLeaf = (c: Cell): boolean => !c.split || !c.children || c.children.length === 0;

/** Normalized child sizes (sum to 1); falls back to an equal split. */
export function cellSizes(c: Cell): number[] {
  const n = c.children?.length ?? 0;
  if (!n) return [];
  const s = c.sizes && c.sizes.length === n ? c.sizes : Array(n).fill(1 / n);
  const total = s.reduce((a, b) => a + b, 0) || 1;
  return s.map((v) => v / total);
}

/** Evenly spread `n` separators across 0..1. */
export function evenFractions(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => (i + 1) / (n + 1));
}

/** Where a door's handle sits by default given its opening side — opposite the hinge. */
export function defaultHandlePos(opening: DoorOpening): HandlePos {
  return opening === "left" ? "right" : opening === "right" ? "left" : opening === "top" ? "bottom" : "top";
}

/** The legacy whole-cabinet interior fields. Both the app's `Cabinet` and the schema's `Module`
 *  satisfy this structurally, so one derivation serves both.
 *
 *  `dividerXs` (the app's freeform column positions) wins over `dividers` (the schema's plain
 *  count) when present. */
export interface LegacyInterior {
  fill: ModuleFill;
  count: number;
  dividers?: number;
  dividerXs?: number[];
  opening?: DoorOpening;
  handlePos?: HandlePos;
}

/** Legacy fill/count → the equivalent cell tree. This is the shape the 3D and the elevation have
 *  always rendered for a module with no custom interior, so deriving it here (rather than keeping
 *  a second, flat decomposition) is what makes the tree the single source of truth. */
export function deriveLayout(m: LegacyInterior): Cell {
  const n = Math.max(0, m.count ?? 0);
  const opn: DoorOpening = m.opening ?? "left";

  // NOTE `sizes` is deliberately left undefined on an even split. cellSizes() already reads that
  // as "equal", and walkInterior can then DIVIDE the span instead of multiplying it by 1/n —
  // which is what keeps a 6-drawer bank's fronts at exactly 120mm rather than 119.99999999999999.
  if (m.fill === "drawers") {
    const k = Math.max(1, n);
    const handle: HandlePos = m.handlePos ?? "top";
    if (k === 1) return { front: "drawer", handle };
    return { split: "rows", children: Array.from({ length: k }, () => ({ front: "drawer" as const, handle })) };
  }

  if (m.fill === "open") {
    // OPEN MEANS OPEN — no front. (The pre-tree decomposition cut a door here anyway, which was
    // only ever accidentally right: the cabinets that use `open` are the sink / dishwasher /
    // washer, and those DO carry a facade. The app resolves their interior explicitly — see
    // FRONTED_APPLIANCES in the app's toProject.ts — rather than relying on that accident.)
    if (n <= 0) return {};
    return { split: "rows", children: Array.from({ length: n + 1 }, () => ({})) };
  }

  // shelves: a door over a rows-split of `count + 1` open compartments (the separators ARE the
  // shelves), repeated per column when the module is split by vertical dividers.
  const door: Cell = { front: "door", opening: opn, handle: m.handlePos ?? defaultHandlePos(opn) };
  const shelved = (base: Cell): Cell =>
    n > 0 ? { ...base, split: "rows", children: Array.from({ length: n + 1 }, () => ({})) } : base;

  const cols = m.dividerXs?.length ? m.dividerXs.length + 1 : (m.dividers ?? 0) > 0 ? (m.dividers as number) + 1 : 0;
  if (cols > 1) {
    return { split: "cols", children: Array.from({ length: cols }, () => shelved({ ...door })) };
  }
  return shelved(door);
}

/** A front (door or drawer face), in mm. */
export interface FrontSpec {
  kind: "door" | "drawer";
  /** the face this front covers, in mm */
  wMm: number;
  hMm: number;
  /** where it sits on the module face — offset from the BOTTOM-LEFT corner, mm. (Pricing ignores
   *  this; the elevation drawings place fronts with it.) y grows upward, matching the cell tree:
   *  `children[0]` of a rows split is the bottom compartment. */
  xMm: number;
  yMm: number;
  opening?: DoorOpening;
  handle?: HandlePos;
}

/** The interior, flattened into cuttable parts. Separators carry the span they actually cover —
 *  a shelf inside one column of a divided cabinet is narrower than the cabinet. */
export interface InteriorSpec {
  fronts: FrontSpec[];
  /** horizontal separators (shelves), each as long as its cell's slice of the INTERIOR width */
  shelves: { lengthMm: number }[];
  /** vertical separators (dividers), each as tall as its cell's slice of the module height */
  dividers: { lengthMm: number }[];
}

/** The module dimensions a walk needs: the FACE a front covers, and the INTERIOR a shelf spans. */
export interface ModuleBox {
  /** module width (fronts tile this) */
  w: number;
  /** module height */
  h: number;
  /** interior width, w − 2·thickness (shelves span this) */
  innerW: number;
}

/**
 * Flatten a cell tree into fronts + separators.
 *
 * Mirrors what the 3D draws (three/kitchen3d.ts `buildCells`): a node carrying a front emits ONE
 * front over its whole rect and its children become the interior BEHIND it — they get separators
 * but no fronts of their own.
 *
 * The one deliberate departure: **a boundary between two drawer cells is not a panel.** Drawers
 * ride on slides screwed to the carcass sides; there is no shelf between them. (The 3D does draw
 * one, but it is hidden behind the fronts — harmless to look at, wrong to cut.)
 *
 * `combinedDoors` — doors spanning a rectangular block of cells — are added on top, exactly as
 * the 3D adds them: one door front per entry, and the cells beneath keep whatever they have.
 *
 * Dimensions are carried in MM and an equal split DIVIDES rather than multiplying by 1/n: for a
 * 6-drawer bank `h / 6` is exactly 120, while `h * (1/6)` is 119.99999999999999. The panels a
 * plain cabinet cuts have to come out bit-identical to what the flat decomposition produced, and
 * fraction arithmetic quietly breaks that.
 */
export function walkInterior(
  root: Cell,
  box: ModuleBox,
  combinedDoors: { fx0: number; fy0: number; fx1: number; fy1: number; opening?: DoorOpening; handle?: HandlePos }[] = [],
): InteriorSpec {
  const out: InteriorSpec = { fronts: [], shelves: [], dividers: [] };

  /** child span i of a parent span — an exact division when the split is even. */
  const slice = (span: number, cell: Cell, i: number, n: number): number =>
    cell.sizes && cell.sizes.length === n ? span * cellSizes(cell)[i] : span / n;

  const children = (cell: Cell, x: number, y: number, w: number, h: number, innerW: number, behind: boolean) => {
    const kids = cell.children!;
    const n = kids.length;
    const rows = cell.split === "rows";
    let cx = x;
    let cy = y;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        if (rows) {
          // no panel between two drawers — they hang on slides
          const bothDrawers = kids[i - 1].front === "drawer" && kids[i].front === "drawer";
          if (!bothDrawers) out.shelves.push({ lengthMm: innerW });
        } else {
          out.dividers.push({ lengthMm: h });
        }
      }
      const cw = rows ? w : slice(w, cell, i, n);
      const ch = rows ? slice(h, cell, i, n) : h;
      walk(kids[i], cx, cy, cw, ch, rows ? innerW : slice(innerW, cell, i, n), behind);
      if (rows) cy += ch;
      else cx += cw;
    }
  };

  const walk = (cell: Cell, x: number, y: number, w: number, h: number, innerW: number, behind: boolean) => {
    if (cell.front && !behind) {
      out.fronts.push({ kind: cell.front, xMm: x, yMm: y, wMm: w, hMm: h, opening: cell.opening, handle: cell.handle });
      // its children are the compartments behind it: separators only, no sub-fronts
      if (!isLeaf(cell)) children(cell, x, y, w, h, innerW, true);
      return;
    }
    if (isLeaf(cell)) return; // an open compartment — nothing to cut
    children(cell, x, y, w, h, innerW, behind);
  };

  walk(root, 0, 0, box.w, box.h, box.innerW, false);

  for (const cd of combinedDoors) {
    const x0 = Math.min(cd.fx0, cd.fx1);
    const y0 = Math.min(cd.fy0, cd.fy1);
    out.fronts.push({
      kind: "door",
      xMm: box.w * x0,
      yMm: box.h * y0,
      wMm: box.w * Math.abs(cd.fx1 - cd.fx0),
      hMm: box.h * Math.abs(cd.fy1 - cd.fy0),
      opening: cd.opening,
      handle: cd.handle,
    });
  }

  return out;
}
