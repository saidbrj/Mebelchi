// Sheet nesting — packs the cut list onto real boards so the workshop cuts economically
// (the Romchi "save material" pitch). GUILLOTINE packing (First-Fit-Decreasing-Height
// shelves): every cut runs edge-to-edge, so the layout is valid for a panel saw AND a CNC.
// Panels are grouped by board (material + thickness — you can't cut a 16mm carcass part from
// an 18mm facade sheet), grained facades are never rotated, and user-entered offcuts
// ("remains") are filled before new sheets. Pure; the UI renders the result + exports DXF.

import { production } from "./cncExport";
import type { Cabinet } from "./cabinet";

/** A single part to place. `grain` = orientation is locked (a wood-grain facade can't be
 *  rotated 90° or the grain runs the wrong way). */
export interface NestPanel {
  id: string;
  w: number; // mm (length, along grain for facades)
  h: number; // mm (width)
  part: string; // ASCII part code (side-left, door, shelf-2…) — used in the DXF
  partRu: string; // human label (Бок левый, Полка 1…) — used in the cut map
  module: string; // owning module label ("3. Напольный 600") — the cabinet number leads it
  group: string; // board key = material + thickness
  material: string;
  thickness: number;
  grain: boolean;
}

export interface Placed {
  panel: NestPanel;
  x: number; // mm from the sheet's top-left
  y: number;
  w: number; // placed dims (swapped from the panel if rot)
  h: number;
  rot: boolean;
}

export interface NestedSheet {
  n: number; // 1-based index within the whole result
  group: string;
  material: string;
  thickness: number;
  W: number;
  H: number;
  isRemain: boolean;
  placed: Placed[];
  usedArea: number; // mm² of parts on this sheet
  leftovers: Leftover[]; // the unused rectangles (usable remnant vs true waste)
}

/** A leftover rectangle on a board. `usable` = big enough to keep as stock (a remnant),
 *  else it's true waste. */
export interface Leftover {
  x: number;
  y: number;
  w: number;
  h: number;
  usable: boolean;
}

/** An offcut is worth keeping as stock if its short side is at least this (mm). */
export const REMNANT_MIN = 250;

export interface NestStats {
  sheetCount: number;
  standardCount: number;
  remainCount: number;
  sheetAreaM2: number; // area of all boards used
  partAreaM2: number; // area of the parts
  wastePct: number; // TRUE waste (small offcuts) ÷ board area × 100
  remnantAreaM2: number; // large reusable offcuts kept as stock
  cutLengthM: number; // ≈ total guillotine cut length
  partCount: number;
  unplaced: number; // parts too big for any sheet
}

export interface RemainSheet {
  w: number;
  h: number;
}

export interface NestOptions {
  sheetW: number;
  sheetH: number;
  kerf: number; // saw blade width (mm) between parts + shelves
  respectGrain: boolean;
  remains: RemainSheet[]; // offcuts to fill first (assigned to the largest board group)
}

export interface NestResult {
  sheets: NestedSheet[];
  stats: NestStats;
  ok: boolean; // false when a part didn't fit any sheet
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pack `items` (sorted large-first) onto ONE W×H board with a GUILLOTINE free-rectangle
 *  packer: each part fills the best-fitting free rectangle (least leftover area) and splits
 *  the remainder into two guillotine offcuts (keeping the larger offcut whole). Non-grained
 *  parts try both orientations. Packs much tighter than shelves. Returns placements + the
 *  parts that didn't fit (for the next board). */
function packSheet(items: NestPanel[], W: number, H: number, kerf: number): { placed: Placed[]; rest: NestPanel[]; free: FreeRect[] } {
  const free: FreeRect[] = [{ x: 0, y: 0, w: W, h: H }];
  const placed: Placed[] = [];
  const rest: NestPanel[] = [];
  const EPS = 1;

  for (const it of items) {
    const orients: [number, number, boolean][] = it.grain
      ? [[it.w, it.h, false]]
      : [[it.w, it.h, false], [it.h, it.w, true]];
    let best: { ri: number; w: number; h: number; rot: boolean; leftover: number } | null = null;
    for (let ri = 0; ri < free.length; ri++) {
      const fr = free[ri];
      for (const [ow, oh, rot] of orients) {
        if (ow <= fr.w + EPS && oh <= fr.h + EPS) {
          const leftover = fr.w * fr.h - ow * oh; // best-area-fit → smallest waste
          if (!best || leftover < best.leftover) best = { ri, w: ow, h: oh, rot, leftover };
        }
      }
    }
    if (!best) {
      rest.push(it); // fits no free rect on this board
      continue;
    }
    const fr = free[best.ri];
    placed.push({ panel: it, x: fr.x, y: fr.y, w: best.w, h: best.h, rot: best.rot });
    free.splice(best.ri, 1);
    const rightW = fr.w - best.w - kerf;
    const bottomH = fr.h - best.h - kerf;
    // guillotine split: keep the LARGER offcut whole (split along the shorter leftover axis)
    if (bottomH >= rightW) {
      if (bottomH > EPS) free.push({ x: fr.x, y: fr.y + best.h + kerf, w: fr.w, h: bottomH }); // full-width bottom
      if (rightW > EPS) free.push({ x: fr.x + best.w + kerf, y: fr.y, w: rightW, h: best.h }); // right of the part
    } else {
      if (rightW > EPS) free.push({ x: fr.x + best.w + kerf, y: fr.y, w: rightW, h: fr.h }); // full-height right
      if (bottomH > EPS) free.push({ x: fr.x, y: fr.y + best.h + kerf, w: best.w, h: bottomH }); // below the part
    }
  }
  return { placed, rest, free };
}

/** Rough guillotine cut length for one board — each part contributes about one rip + one
 *  crosscut to free it (an estimate; shared cuts aren't deduped). */
function sheetCutLength(sheet: NestedSheet): number {
  return sheet.placed.reduce((s, p) => s + p.w + p.h, 0);
}

/** Build the packing panels from the run's real cut list (via `production`). */
export function nestPanels(cabs: Cabinet[], respectGrain: boolean): NestPanel[] {
  const prod = production(cabs);
  if (!prod) return [];
  // glass panes arrive cut to size from the glazier — nesting them onto a sheet would invent a
  // cutting plan for a part nobody saws (and buildBom already refuses to bill them a cut)
  return prod.panels.filter((p) => p.role !== "glass").map((p, i) => ({
    id: `p${i}`,
    w: p.lengthMm,
    h: p.widthMm,
    part: p.partEn,
    partRu: p.part,
    module: p.module,
    group: `${p.material} · ${p.thicknessMm}`,
    material: p.material,
    thickness: p.thicknessMm,
    grain: respectGrain && p.thicknessMm >= 18, // facades (18mm) are grained → don't rotate
  }));
}

export function nest(panels: NestPanel[], opts: NestOptions): NestResult {
  const { sheetW, sheetH, kerf, remains } = opts;
  // group by board; process the biggest group first so offcuts help where most board is used
  const groups = new Map<string, NestPanel[]>();
  for (const p of panels) (groups.get(p.group) ?? groups.set(p.group, []).get(p.group)!).push(p);
  const ordered = [...groups.entries()].sort((a, b) => area(b[1]) - area(a[1]));

  const sheets: NestedSheet[] = [];
  const remainPool = [...remains]; // consumed by the first (largest) group only
  let unplaced = 0;
  let n = 0;

  ordered.forEach(([group, gp], gi) => {
    const items = [...gp].sort((a, b) => b.w * b.h - a.w * a.h); // large parts first
    let remaining = items;
    while (remaining.length) {
      // pick the next board: an offcut (first group only), else a standard sheet
      const remain = gi === 0 ? remainPool.shift() : undefined;
      const W = remain ? remain.w : sheetW;
      const H = remain ? remain.h : sheetH;
      const { placed, rest, free } = packSheet(remaining, W, H, kerf);
      if (placed.length === 0) {
        // nothing fit this board. If it was a small OFFCUT, just skip it and try the next
        // board; only a FULL sheet that holds nothing means the part is truly oversized.
        if (remain) continue;
        unplaced += rest.length;
        break;
      }
      const first = gp[0];
      sheets.push({
        n: ++n,
        group,
        material: first.material,
        thickness: first.thickness,
        W,
        H,
        isRemain: !!remain,
        placed,
        usedArea: placed.reduce((s, p) => s + p.w * p.h, 0),
        leftovers: free.map((r) => ({ ...r, usable: Math.min(r.w, r.h) >= REMNANT_MIN })),
      });
      remaining = rest;
    }
  });

  const sheetArea = sheets.reduce((s, sh) => s + sh.W * sh.H, 0);
  const partArea = sheets.reduce((s, sh) => s + sh.usedArea, 0);
  const cutLen = sheets.reduce((s, sh) => s + sheetCutLength(sh), 0);
  const leftArea = (usable: boolean) =>
    sheets.reduce((s, sh) => s + sh.leftovers.filter((l) => l.usable === usable).reduce((a, l) => a + l.w * l.h, 0), 0);
  const wasteArea = leftArea(false); // small offcuts — the TRUE waste
  const remnantArea = leftArea(true); // large reusable offcuts — kept as stock, not waste
  return {
    sheets,
    ok: unplaced === 0,
    stats: {
      sheetCount: sheets.length,
      standardCount: sheets.filter((s) => !s.isRemain).length,
      remainCount: sheets.filter((s) => s.isRemain).length,
      sheetAreaM2: round2(sheetArea / 1e6),
      partAreaM2: round2(partArea / 1e6),
      wastePct: sheetArea ? Math.round((wasteArea / sheetArea) * 100) : 0,
      remnantAreaM2: round2(remnantArea / 1e6),
      cutLengthM: round2(cutLen / 1000),
      partCount: panels.length,
      unplaced,
    },
  };
}

const area = (ps: NestPanel[]) => ps.reduce((s, p) => s + p.w * p.h, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
