// МИНИМАЛЬНЫЙ ПРОЁМ — the gate that stops a compartment being drawn smaller than what it is
// supposed to hold.
//
// WHY THIS EXISTS. The Fill Editor lets you split a module freely, and its only floor was
// `MIN_CELL = 0.12` — a FRACTION of the cabinet, not a millimetre. In a 400mm upper that is a 48mm
// compartment; in a 720mm base, 86mm. Tap the drawer tool on either and the app accepts it: the
// quote prices it, the cut list cuts a front for it, the CNC drills for it. Nobody finds out until
// the fitter is holding a drawer runner that does not fit the hole. There is no smaller drawer to
// buy — 80mm is the floor of the whole market, not of one brand's range.
//
// This is the app-side half of the "minimum content envelope" the shop's research corpus specifies
// (`37_MINIMUM_SIZE_GATE.md`). That document describes three gates against three profiles; two of
// them are for a component marketplace we do not have. Ours are the two that are real here:
//
//   • edit time  → WARN. An amber mark on the offending compartment while the master is still
//                  drawing. Blocking mid-gesture would punish exploring.
//   • export     → BLOCK. The cut list and the machine file are the last honest moment.
//
// SCOPE. Only drawers are gated, because only drawers have a cited number. The research doc's other
// content types (wardrobe rod depth, finger clearance, door swing) are all recorded there as
// UNGROUNDED — no manufacturer source in hand — and a made-up minimum that blocks an export is
// worse than no minimum at all. Add them when their citation arrives, not before.
//
// Pure. No React, no store.

import type { Cabinet, Cell } from "./cabinet";
import { cabinetInterior, cellSizes, isLeaf } from "./cabinet";
import { constructionOf } from "./construction";

/** Drawer classes by the interior height each needs, smallest first.
 *
 *  Source: Blum *Catalogue and technical manual 2024-2025*, printed p.198, LEGRABOX "Overview –
 *  applications" table, **Space requirement Height** column. These are the clear opening the
 *  mechanism needs, not the steel side's own height — the two are different conventions in Blum's
 *  own literature and must never be averaged or interpolated across product lines.
 *
 *  The local market builds shop-made wooden drawer boxes on GTV VERSALITE H45 ball-bearing slides,
 *  and GTV publishes no minimum height for those (the box is the master's own). LEGRABOX N is used
 *  as the cross-brand floor: it is the smallest cited drawer anywhere in the corpus, so a
 *  compartment under it cannot hold ANY catalogued mechanism. */
export const DRAWER_CLASSES: { id: string; minInteriorMm: number }[] = [
  { id: "N", minInteriorMm: 80 },
  { id: "M", minInteriorMm: 106 },
  { id: "K", minInteriorMm: 144 },
];

/** The hard floor: below this no standard drawer mechanism exists at all. */
export const DRAWER_MIN_INTERIOR_MM = DRAWER_CLASSES[0].minInteriorMm;

/** One compartment that cannot hold what has been put in it.
 *
 *  The rect is in the module's INTERIOR fraction space — x right from the left inner face, y UP
 *  from the inner bottom, both 0..1 — which is the space the Fill Editor draws in, so it can
 *  outline the finding without recomputing anything. */
export interface MinSizeFinding {
  cabId: string;
  kind: "drawer";
  /** the clear opening this compartment offers (mm) */
  haveMm: number;
  /** the smallest catalogued mechanism needs this (mm) */
  needMm: number;
  fx0: number;
  fy0: number;
  fx1: number;
  fy1: number;
}

/** Does this leaf sit behind a front that makes it a compartment of its own? */
const isDrawer = (c: Cell): boolean => c.front === "drawer";

/**
 * Every drawer compartment in one module that is too short for a mechanism.
 *
 * The walk is over OPENINGS, not over cut parts — which is why it does not go through pricing's
 * `walkInterior`. That one reports each front's face rect (fronts overlay the carcass, so a face
 * rect is bigger than the hole behind it); this one reports the hole. The hole is the quantity Blum
 * publishes a minimum for.
 *
 * Two stacked drawers have no panel between them — they hang on slides screwed to the sides — so
 * their openings meet with nothing in between. Every other boundary carries a real panel, and a
 * panel straddling a boundary takes half its thickness from each neighbour.
 */
export function drawerFindings(cab: Cabinet): MinSizeFinding[] {
  if (cab.furniture || cab.appliance) return []; // an appliance housing holds a machine, not a drawer
  const t = constructionOf(cab).boardThickness;
  const innerH = cab.h - 2 * t;
  if (innerH <= 0) return [];

  const out: MinSizeFinding[] = [];

  /** `fy0`/`fy1` bound this cell in interior fractions; `padBelow`/`padAbove` are the panel
   *  thicknesses (mm) already eaten off this cell's bottom and top by its bounding separators. */
  const walk = (cell: Cell, fx0: number, fy0: number, fx1: number, fy1: number, padBelow: number, padAbove: number) => {
    if (isDrawer(cell)) {
      const haveMm = innerH * (fy1 - fy0) - padBelow - padAbove;
      if (haveMm < DRAWER_MIN_INTERIOR_MM) {
        out.push({ cabId: cab.id, kind: "drawer", haveMm: Math.round(haveMm), needMm: DRAWER_MIN_INTERIOR_MM, fx0, fy0, fx1, fy1 });
      }
      return; // a front owns its whole rect; what is behind it is that drawer's own business
    }
    if (isLeaf(cell)) return;

    const kids = cell.children!;
    const sizes = cellSizes(cell);
    const rows = cell.split === "rows";
    let f = rows ? fy0 : fx0;
    const span = rows ? fy1 - fy0 : fx1 - fx0;
    for (let i = 0; i < kids.length; i++) {
      const s = span * sizes[i];
      // a panel sits on every internal boundary EXCEPT between two drawers, and it takes half its
      // thickness from the compartment on each side of it
      const below = rows && i > 0 && !(isDrawer(kids[i - 1]) && isDrawer(kids[i])) ? t / 2 : 0;
      const above = rows && i < kids.length - 1 && !(isDrawer(kids[i + 1]) && isDrawer(kids[i])) ? t / 2 : 0;
      if (rows) walk(kids[i], fx0, f, fx1, f + s, (i === 0 ? padBelow : 0) + below, (i === kids.length - 1 ? padAbove : 0) + above);
      else walk(kids[i], f, fy0, f + s, fy1, padBelow, padAbove);
      f += s;
    }
  };

  walk(cabinetInterior(cab), 0, 0, 1, 1, 0, 0);
  return out;
}

/** The whole run's findings, for the export gate. Empty is the normal case and the answer the
 *  handoff screen wants: nothing here is drawn too small to build. */
export function minSizeFindings(cabs: Cabinet[]): MinSizeFinding[] {
  return cabs.flatMap(drawerFindings);
}
