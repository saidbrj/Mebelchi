// buildBom: Project → normalised BOM (PRICING_AND_SCHEMA.md §3).
//
// Returns RawBomLine[] = Omit<BomLine,'rate'|'amount'|'group'> — quantities and
// refs only. priceProject applies rates, amounts and groups. Pure and
// deterministic: same model → same BOM, no I/O.

import type { Project, Module, RawBomLine } from "../../schema/src/index.js";
import {
  carcassPanels,
  panelAreaM2,
  shelfCount,
  drawerCount,
  cutFronts,
  panelBandMm,
  type DerivedPanel,
} from "./parts.js";
import { groupCarcasses, hangingCount, resolveProduction, carcassWidth, type Carcass } from "./carcass.js";
import { millContourMm, fluteAreaMm2 } from "./fronts.js";
import {
  DEFAULT_HARDWARE_SKUS,
  CAMS_PER_JOINT,
  DOWELS_PER_JOINT,
  carcassJoints,
  HOLES_PER_HINGE,
  HOLES_PER_SHELF,
  HOLES_PER_SLIDE_SET,
  hingesForDoorHeight,
} from "./constants.js";

/** Hinges on a module — counted PER DOOR, by that door's own height. A cabinet whose interior
 *  carries three separate doors needs three sets of hinges, and a short door needs fewer than a
 *  tall one; billing one set for the whole module (as this used to) under-charges every custom
 *  interior. Drawer fronts and open compartments carry none. */
function hingeCount(m: Module): number {
  return cutFronts(m)
    .filter((f) => f.kind === "door")
    .reduce((n, f) => n + hingesForDoorHeight(f.hMm), 0);
}

/** Visible (2mm) edge-banding length for a module, in mm — the perimeter of every front. */
function visibleEdgeMm(m: Module): number {
  return cutFronts(m).reduce((mm, f) => mm + 2 * (f.wMm + f.hMm), 0);
}

/** Routed contour across every front of a module (mm) — the frame groove, the raised panel's edge,
 *  or the pane cut-out. Zero on a flat or fluted front. */
function millMm(m: Module): number {
  return cutFronts(m).reduce((mm, f) => mm + millContourMm(m.door.style, f.wMm, f.hMm), 0);
}

/** Fluted face area across every front of a module (mm²). Zero unless the front is fluted. */
function fluteMm2(m: Module): number {
  return cutFronts(m).reduce((a, f) => a + fluteAreaMm2(m.door.style, f.wMm, f.hMm), 0);
}

/**
 * Hidden (0.4mm) edge-banding for one BOX, in mm — the carcass's front frame.
 *
 * The frame is the perimeter of the box's face, plus the front edge of every shared stile inside it
 * (each is a raw board edge facing the room and has to be banded).
 *
 * Four separate 600×720 uppers band 4 × 2(600+720) = 10 560mm. Merged into one 2400 box:
 * 2(2400+720) + 3×720 = 8 400mm. The saving is real and this is where it shows up.
 *
 * A single-module box gives 2(w + h) — unchanged.
 */
/**
 * VISIBLE banding on the INTERIOR boards of one box (mm).
 *
 * The shelf and divider edges you see when the door is open. This engine counted none of them: the
 * visible tape was the fronts' perimeter and the hidden tape was the box's front frame, and the
 * boards between them fell through the gap. Every shop bands them, so every quote was short by it.
 *
 * Per ROLE (parts.ts `panelBanding`), so a shop that leaves them raw can say so.
 */
function interiorEdgeMm(c: Carcass, panels: DerivedPanel[]): number {
  const byId = new Map(c.modules.map((m) => [m.id, m]));
  return panels.reduce((mm, p) => {
    const m = p.moduleId ? byId.get(p.moduleId) : undefined;
    return m ? mm + panelBandMm(m, p) : mm;
  }, 0);
}

function hiddenEdgeMm(c: Carcass): number {
  const h = c.modules[0].h;
  return 2 * (carcassWidth(c) + h) + (c.modules.length - 1) * h;
}

export function buildBom(project: Project): RawBomLine[] {
  const lines: RawBomLine[] = [];
  const mats = project.materials;
  const prod = resolveProduction(project.production);

  // THE UNIT OF PRODUCTION IS THE BOX, NOT THE CABINET. Untagged modules are each their own box, so
  // an unmerged run iterates exactly as it always did.
  const carcasses = groupCarcasses(project.run);

  for (const c of carcasses) {
    const ms = c.modules;

    // --- panels (carcass + facade) → m² lines, one per panel ---
    const panels = carcassPanels(c, mats);
    for (const p of panels) {
      lines.push({ kind: "panel", ref: p.materialRef, qty: panelAreaM2(p), unit: "m2" });
    }

    // --- edge banding (material). Visible edge is per FRONT, and merging changes no front. ---
    const visM = (ms.reduce((mm, m) => mm + visibleEdgeMm(m), 0) + interiorEdgeMm(c, panels)) / 1000;
    const hidM = hiddenEdgeMm(c) / 1000;
    if (visM > 0) lines.push({ kind: "edge", ref: mats.edgeVisibleId, qty: visM, unit: "m" });
    if (hidM > 0) lines.push({ kind: "edge", ref: mats.edgeHiddenId, qty: hidM, unit: "m" });

    // --- hardware ---
    // hinges and slides hang off FRONTS, so they are per module and merging does not touch them.
    const hinges = ms.reduce((n, m) => n + hingeCount(m), 0);
    const slides = ms.reduce((n, m) => n + drawerCount(m), 0); // one slide set per drawer
    if (hinges > 0) lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.hinge, qty: hinges, unit: "unit" });
    if (slides > 0) lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.slide, qty: slides, unit: "unit" });

    // cams and dowels join the top and bottom to every vertical panel — so they scale with the BOX,
    // not with the cabinets in it. A merged 4-bay box has 5 verticals → 10 joints, where 4 separate
    // boxes had 4 × 4 = 16. carcassJoints(1) === 4, so an unmerged module still bills 8 and 8.
    const joints = carcassJoints(ms.length);
    const dowels = joints * DOWELS_PER_JOINT;
    const cams = joints * CAMS_PER_JOINT;
    lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.dowel, qty: dowels, unit: "unit" });
    lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.cam, qty: cams, unit: "unit" });

    // THE HANGERS. A wall box hangs on one set of навесы however many cabinets it contains — which
    // is the reason a workshop merges a top row in the first place. Four separate 600s need four
    // sets; the 2400 box that replaces them needs one. Floor and tall units get none.
    const hangings = hangingCount(c, prod);
    if (hangings > 0) lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.hanging, qty: hangings, unit: "unit" });

    // --- operations (CNC) ---
    const shelves = ms.reduce((n, m) => n + shelfCount(m), 0);
    const holes =
      hinges * HOLES_PER_HINGE +
      (cams + dowels) +
      shelves * HOLES_PER_SHELF +
      slides * HOLES_PER_SLIDE_SET;
    if (holes > 0) lines.push({ kind: "operation", ref: "drillPerHole", qty: holes, unit: "hole" });
    // a glass pane is bought cut to size — it is not sawn from a board, so it is not a "cut panel"
    lines.push({ kind: "operation", ref: "cutPerPanel", qty: panels.filter((p) => p.role !== "glass").length, unit: "panel" });
    const bandM = visM + hidM;
    if (bandM > 0) lines.push({ kind: "operation", ref: "edgebandPerM", qty: bandM, unit: "m" });

    // THE PROFILE'S COST. A shaker / raised / glazed front is ONE MDF blank with its shape routed
    // in, and a fluted one is the same blank with ribs cut across its face. So the profile buys no
    // extra parts — it buys MACHINE TIME, and this is where that lands.
    //
    // Both rates are seeded at ZERO, exactly as edgebandPerM is: until the seller sets them in
    // Settings, no existing quote moves by a single сум. (Note the default facade material is
    // literally named «МДФ фасад фрезерованный» — so today a flat front already pays for milling it
    // never got, and a milled one gets its routing free.)
    const millM = ms.reduce((mm, m) => mm + millMm(m), 0) / 1000;
    if (millM > 0) lines.push({ kind: "operation", ref: "millPerM", qty: millM, unit: "m" });
    const fluteM2 = ms.reduce((a, m) => a + fluteMm2(m), 0) / 1_000_000;
    if (fluteM2 > 0) lines.push({ kind: "operation", ref: "flutePerM2", qty: fluteM2, unit: "m2" });

    // --- worktop (base modules only, when one is selected) ---
    // still per module: the slab runs the length of the cabinetry either way.
    for (const m of ms) {
      if (m.kind === "base" && mats.worktopId) {
        lines.push({ kind: "worktop", ref: mats.worktopId, qty: m.w / 1000, unit: "m" });
      }
    }
  }

  // --- flat wall panels: the фартук + the strip to the ceiling ---
  //
  // These are NOT modules, so they sit outside the carcass loop entirely: no hinges, no dowels, no
  // assembly line. A panel is a cut, an edge and (if it has sockets in it) some routing.
  for (const fp of project.panels ?? []) {
    if (fp.stock === "worktop") {
      // cut from the counter slab — the same 600-wide постформинг the worktop comes off, so it
      // bills the worktop's running-metre rate rather than a made-up per-m² one
      if (mats.worktopId) lines.push({ kind: "worktop", ref: mats.worktopId, qty: fp.w / 1000, unit: "m" });
    } else {
      lines.push({
        kind: "panel",
        ref: fp.stock === "facade" ? mats.facadeId : mats.carcassId,
        qty: (fp.w * fp.h) / 1_000_000,
        unit: "m2",
      });
      // The TWO HORIZONTAL edges only. Those are always in view; the vertical ends of a wall panel
      // almost always die into a side wall or a column. Banding all four would be the easy call and
      // would overcharge every kitchen — a quote a seller cannot defend is worse than a small one.
      const bandM = (2 * fp.w) / 1000;
      lines.push({ kind: "edge", ref: mats.edgeVisibleId, qty: bandM, unit: "m" });
      lines.push({ kind: "operation", ref: "edgebandPerM", qty: bandM, unit: "m" });
    }
    lines.push({ kind: "operation", ref: "cutPerPanel", qty: 1, unit: "panel" });
    // a socket cut out of a фартук is routed contour, which is exactly what millPerM bills
    const cutoutMm = (fp.cutouts ?? []).reduce((mm, c) => mm + 2 * (c.w + c.h), 0);
    if (cutoutMm > 0) lines.push({ kind: "operation", ref: "millPerM", qty: cutoutMm / 1000, unit: "m" });
  }

  // --- the light built into the cabinetry ---
  //
  // Not a module and not a panel: a length off a reel, the profile it sits in, and the electronics
  // that drive it. The METRES are derived from the layout upstream (model/ledStrips.ts) — nothing
  // here knows or needs to know where a cabinet is.
  const lit = project.lighting;
  if (lit && lit.metres > 0) {
    lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.ledStrip, qty: lit.metres, unit: "m" });
    if (lit.profileM > 0) {
      lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.ledProfile, qty: lit.profileM, unit: "m" });
    }
    if (lit.psu > 0) lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.ledPsu, qty: lit.psu, unit: "unit" });
    if (lit.sensors > 0) {
      lines.push({ kind: "hardware", ref: DEFAULT_HARDWARE_SKUS.ledSensor, qty: lit.sensors, unit: "unit" });
    }
  }

  // --- what was cut OUT of the counter ---
  //
  // A sink's bowl and a cooktop are one operation to the shop: a rectangle routed out of the slab.
  // The counter itself bills by the running metre, so the hole cannot ride on a panel line the way
  // a фартук's sockets do — it is its own contour. Sized upstream, where the sink's MOUNT is known.
  const cutMm = (project.worktopCuts ?? []).reduce((mm, k) => mm + 2 * (k.w + k.d), 0);
  if (cutMm > 0) lines.push({ kind: "operation", ref: "millPerM", qty: cutMm / 1000, unit: "m" });

  // --- labor + delivery (project level) ---
  // BOXES, not cabinets: the shop assembles one merged carcass and puts one carcass on the van.
  // With nothing merged, boxes === modules and both lines are unchanged.
  const boxCount = carcasses.length;
  if (boxCount > 0) {
    lines.push({ kind: "labor", ref: "assemblyPerModule", qty: boxCount, unit: "module" });
  }
  const hardeningCount = project.run.reduce((n, m) => n + (m.hardening?.length ?? 0), 0);
  if (hardeningCount > 0) {
    lines.push({ kind: "labor", ref: "hardeningPerPreset", qty: hardeningCount, unit: "unit" });
  }

  lines.push({ kind: "delivery", ref: "base", qty: 1, unit: "unit" });
  lines.push({ kind: "delivery", ref: "perModule", qty: boxCount, unit: "module" });

  return lines;
}
