// Module → panels decomposition. This is the "turn a Project into a list of
// parts using the engine" step: `modulesToParts` emits engine `Part` objects
// (mm10 geometry, the engine's own contract) that could be fed straight to
// solveFull for the manufacturing path. `modulePanels` is the same decomposition
// carrying the material ref each panel is priced against — buildBom reads it.
//
// THE INTERIOR COMES FROM THE CELL TREE, AND ONLY FROM THERE. `moduleInterior()` walks
// `m.layout` — or, for a module that has none (an old saved project, an API caller), the tree its
// legacy `fill`/`count`/`dividers` describe. There is deliberately no second, flat decomposition
// beside it: the app used to price a Fill-Editor cabinet from its stale pre-edit `fill`/`count`
// while the 3D drew the tree, and two rival decompositions is exactly how that drift happens.
// One walk feeds panels, edge banding, hinges, slides and drill holes.
//
// Pure: no I/O, no engine solve, deterministic from the model alone.

import type { Module, MaterialSelection, FrontProfile } from "../../schema/src/index.js";
import type { Part } from "../../../engine/contracts/types.js";
import { mmToMm10 } from "../../../engine/core/units.js";
import { CARCASS_THICKNESS_MM, FACADE_THICKNESS_MM, GLASS_THICKNESS_MM } from "./constants.js";
import { deriveLayout, walkInterior, type FrontSpec, type InteriorSpec } from "./cells.js";
import { glassRect, mullionBar } from "./fronts.js";
import { groupCarcasses, type Carcass } from "./carcass.js";

/** `glass` is a bought pane, not a cut board — 4mm, no edge banding, its own material. */
export type PanelRole = "carcass" | "facade" | "glass";

/** A priced panel: engine-style geometry (mm) plus the material it's cut from. */
export interface DerivedPanel {
  role: PanelRole;
  name: string;
  /** X extent (mm) — maps to the engine Part's length. */
  lengthMm: number;
  /** Y extent (mm) — maps to the engine Part's width. */
  widthMm: number;
  /** RateTable material UUID this panel is priced against. */
  materialRef: string;
  /** the front body this panel belongs to — the shop needs to know what to rout. Absent on carcass. */
  profile?: FrontProfile;
  /** WHICH MODULE this panel belongs to. Absent on the SHARED SHELL of a merged carcass (the outer
   *  sides, the stiles, the one long top/bottom/back) — those belong to the box, not to any one
   *  cabinet in it, and the cut list has to say so or the shop will cut four of them. */
  moduleId?: string;
}

/** The interior width a module's shelves span. Standalone that is the module less both its sides;
 *  inside a merged carcass a shelf reaches into the shared stile, so the bay is wider. */
function defaultInnerW(m: Module): number {
  return m.w - 2 * CARCASS_THICKNESS_MM;
}

/** THE interior of a module: its cell tree, or the tree its legacy fields describe.
 *
 *  `innerW` overrides the interior width the SEPARATORS span — a module inside a merged carcass
 *  owns a bay bounded by shared stiles rather than by its own sides. Fronts are unaffected: they
 *  tile the module FACE (w × h), which merging never changes. */
export function moduleInterior(m: Module, innerW: number = defaultInnerW(m)): InteriorSpec {
  const box = { w: m.w, h: m.h, innerW };
  return walkInterior(m.layout ?? deriveLayout(m), box, m.combinedDoors ?? []);
}

/** The fronts actually cut. A door style of "none" ("Без") means the module has no door leaf;
 *  drawer fronts are unaffected by it. */
export function cutFronts(m: Module): FrontSpec[] {
  const { fronts } = moduleInterior(m);
  return m.door.style === "none" ? fronts.filter((f) => f.kind !== "door") : fronts;
}

/** Shelf panels in a module — every horizontal separator in the interior. */
export function shelfCount(m: Module): number {
  return moduleInterior(m).shelves.length;
}

/** Drawer fronts in a module (one slide set each). */
export function drawerCount(m: Module): number {
  return cutFronts(m).filter((f) => f.kind === "drawer").length;
}

/** Does this module carry any facade at all? An open niche has none. */
export function hasFacade(m: Module): boolean {
  return cutFronts(m).length > 0;
}

/**
 * Decompose ONE BOX into its priced panels (frameless LDSP carcass + facade).
 *
 * A carcass holding n modules cuts:
 *   - 2 outer sides (h × d)
 *   - n−1 SHARED STILES (h × d) — one per internal boundary. This is the whole saving: four
 *     separate cabinets need 8 side panels, one merged carcass needs 2 + 3 = 5.
 *   - one top and one bottom, each spanning the FULL box interior
 *   - one back, spanning the full box
 *   - per module: its interior separators, at its own bay's width, and its fronts, UNCHANGED.
 *
 * n = 1 is an ordinary standalone cabinet, and reduces to exactly the decomposition this has always
 * produced — 2 sides, top, bottom, back at `w − 2t` — down to the last mm. That identity is what
 * makes merging safe to ship: an untagged project cannot move by a single сум.
 *
 * The back is priced as carcass material (the schema's MaterialSelection carries no separate back
 * material — a known simplification).
 */
export function carcassPanels(c: Carcass, mats: MaterialSelection): DerivedPanel[] {
  const t = CARCASS_THICKNESS_MM;
  const carcass = mats.carcassId;
  const ms = c.modules;
  const n = ms.length;
  const h = ms[0].h;
  const d = ms[0].d;
  const boxW = ms.reduce((w, m) => w + m.w, 0);

  // --- the shell: belongs to the BOX, not to any module in it (hence no moduleId) ---
  const panels: DerivedPanel[] = [
    { role: "carcass", name: "side-left", lengthMm: h, widthMm: d, materialRef: carcass },
    { role: "carcass", name: "side-right", lengthMm: h, widthMm: d, materialRef: carcass },
  ];
  for (let i = 1; i < n; i++) {
    panels.push({ role: "carcass", name: `stile-${i}`, lengthMm: h, widthMm: d, materialRef: carcass });
  }
  panels.push(
    { role: "carcass", name: "bottom", lengthMm: boxW - 2 * t, widthMm: d, materialRef: carcass },
    { role: "carcass", name: "top", lengthMm: boxW - 2 * t, widthMm: d, materialRef: carcass },
    { role: "carcass", name: "back", lengthMm: boxW, widthMm: h, materialRef: carcass },
  );

  // --- per module: its bay's interior, and its fronts ---
  ms.forEach((m, i) => {
    const facade = m.facadeMaterialId ?? mats.facadeId;

    // THE BAY this module owns. An end module gives up a whole outer side; an internal boundary is
    // a stile SHARED with the neighbour, so the two bays either side of it give up half each. For
    // n = 1 both ends are outer: `w − 2t`, the historic innerW.
    const left = i === 0 ? t : t / 2;
    const right = i === n - 1 ? t : t / 2;
    const interior = moduleInterior(m, m.w - left - right);

    // a shelf spans its cell's slice of the interior width; a divider its cell's slice of the height
    interior.shelves.forEach((s, k) => {
      panels.push({ role: "carcass", name: `shelf-${k + 1}`, lengthMm: s.lengthMm, widthMm: m.d, materialRef: carcass, moduleId: m.id });
    });
    interior.dividers.forEach((dv, k) => {
      panels.push({ role: "carcass", name: `divider-${k + 1}`, lengthMm: dv.lengthMm, widthMm: m.d, materialRef: carcass, moduleId: m.id });
    });

    // THE FRONTS. Every profile but glass is ONE piece of MDF — the CNC routes the shape into a single
    // blank — so the panel is always the front's FULL face, whatever its body. What the profile adds is
    // a machining operation (see buildBom) and, for a glazed front, a bought pane: the blank's middle is
    // routed out and wasted, so the MDF is still billed at full size.
    //
    // Merging does not touch them. A front tiles the module's FACE, and the face is the same width it
    // was standalone — which is why a merged row looks identical to a separate one.
    const profile = m.door.style;
    const fronts = cutFronts(m);
    const doorTotal = fronts.filter((f) => f.kind === "door").length;
    let doors = 0;
    let drawers = 0;
    let panes = 0;
    let bars = 0;
    for (const f of fronts) {
      // a lone door keeps the bare `door` name (the cut list has always called it that); several
      // doors on one module number themselves. Both `partRu` and `shortPart` split on a -<digits>
      // suffix, so the base must stay ASCII and the suffix must be the last thing in the name.
      const name =
        f.kind === "drawer" ? `drawer-front-${++drawers}` : doorTotal === 1 ? "door" : `door-${++doors}`;
      panels.push({ role: "facade", name, lengthMm: f.hMm, widthMm: f.wMm, materialRef: facade, profile, moduleId: m.id });

      const pane = glassRect(profile, f.wMm, f.hMm);
      if (pane.w > 0 && pane.h > 0) {
        panels.push({ role: "glass", name: `glass-${++panes}`, lengthMm: pane.h, widthMm: pane.w, materialRef: mats.glassId ?? facade, profile, moduleId: m.id });
      }
      // the раскладка bars of a grid front — thin MDF strips, cut from the facade sheet like anything
      // else, so their total length × width is billed as one panel
      const bar = mullionBar(profile, f.wMm, f.hMm);
      if (bar.w > 0 && bar.h > 0) {
        panels.push({ role: "facade", name: `mullion-${++bars}`, lengthMm: bar.h, widthMm: bar.w, materialRef: facade, profile, moduleId: m.id });
      }
    }
  });

  return panels;
}

/**
 * Decompose one STANDALONE module — the carcass it is when nothing is merged with it.
 *
 * Kept as the name everything already calls, and as the definition of "unmerged": if this ever
 * stops agreeing with `carcassPanels` on a single-module box, the parity suite says so.
 */
export function modulePanels(m: Module, mats: MaterialSelection): DerivedPanel[] {
  return carcassPanels({ id: m.id, modules: [m] }, mats);
}

/** Face area of a panel, in m² (the unit `panel` BOM lines are priced in). */
export function panelAreaM2(p: DerivedPanel): number {
  return (p.lengthMm * p.widthMm) / 1_000_000;
}

/** How thick a panel is, by role (mm). A glass pane is not a cut board. */
export function panelThicknessMm(role: PanelRole): number {
  return role === "glass" ? GLASS_THICKNESS_MM : role === "facade" ? FACADE_THICKNESS_MM : CARCASS_THICKNESS_MM;
}

/**
 * Turn a project's run into engine `Part` objects — the engine's locked contract
 * (mm10 integers, X along length / Y along width). Operations are left empty:
 * pricing needs counts (derived in buildBom), not placed drill coordinates; the
 * Layer-2 solver fills operations in when the manufacturing path runs.
 */
export function modulesToParts(project: { run: Module[]; materials: MaterialSelection }): Part[] {
  const parts: Part[] = [];
  for (const c of groupCarcasses(project.run)) {
    for (const p of carcassPanels(c, project.materials)) {
      const band = p.role === "facade" ? mmToMm10(2) : 0; // 2mm visible kromka on facades (never glass)
      parts.push({
        // a module's own panels are keyed by it; the SHARED SHELL of a merged box is keyed by the
        // box (nothing else owns it). Unmerged, the box id IS the module id — ids are unchanged.
        id: `${p.moduleId ?? c.id}:${p.name}`,
        name: p.name,
        length_mm10: mmToMm10(p.lengthMm),
        width_mm10: mmToMm10(p.widthMm),
        thickness_mm10: mmToMm10(panelThicknessMm(p.role)),
        grain: "NONE",
        edges: [band, band, band, band],
        operations: [],
      });
    }
  }
  return parts;
}
