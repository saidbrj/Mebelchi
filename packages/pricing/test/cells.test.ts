// The cell tree is now the ONLY decomposition (parts.ts `moduleInterior`). Before it, a module
// was decomposed from its flat `fill`/`count`/`dividers` fields.
//
// This file pins that swap down. `legacyPanels` / `legacyCounts` below are the OLD code, copied
// verbatim, and the parity block asserts the tree reproduces them EXACTLY for every cabinet shape
// a real project can contain. If a future edit to the walk changes what an ordinary cabinet cuts,
// these fail — which is the point: existing quotes must not move.
//
// Shapes are "reachable" per the catalogue (model/addCatalog.ts) and the variant generator
// (model/layout.ts): dividers are never set, every `open` cabinet has `count: 0`, and the drawer
// count stepper is only offered on shelf cabinets. The divergences block at the bottom documents
// the shapes where the tree deliberately differs — all of them unreachable, all of them cases
// where the old code was simply wrong.

import { describe, it, expect } from "vitest";
import type { Module, MaterialSelection, FrontProfile } from "../../schema/src/index.js";
import { modulePanels, moduleInterior, shelfCount, drawerCount, cutFronts } from "../src/parts.js";
import { deriveLayout, walkInterior } from "../src/cells.js";
import { buildBom } from "../src/buildBom.js";
import { frontOf, innerRect, mullionsFor, millContourMm, fluteAreaMm2, MULLION_MM } from "../src/fronts.js";
import { CARCASS_THICKNESS_MM, GLASS_THICKNESS_MM, hingesForDoorHeight } from "../src/constants.js";

const MATS: MaterialSelection = {
  carcassId: "carcass",
  facadeId: "facade",
  worktopId: "worktop",
  edgeVisibleId: "edge-vis",
  edgeHiddenId: "edge-hid",
};

const mod = (o: Partial<Module>): Module => ({
  id: "m",
  kind: "base",
  w: 600,
  h: 720,
  d: 560,
  fill: "shelves",
  count: 1,
  dividers: 0,
  door: { style: "flat" },
  handle: { type: "bar" },
  ...o,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE OLD CODE, verbatim (pre-cell-tree parts.ts + buildBom.ts helpers).
// ─────────────────────────────────────────────────────────────────────────────────────────────

const legacyShelves = (m: Module) => (m.fill === "shelves" ? Math.max(0, m.count) : 0);
const legacyDrawers = (m: Module) => (m.fill === "drawers" ? Math.max(0, m.count) : 0);
const legacyHasFacade = (m: Module) =>
  m.fill === "open" ? false : legacyDrawers(m) > 0 || m.door.style !== "none";

function legacyPanels(m: Module, mats: MaterialSelection) {
  const t = CARCASS_THICKNESS_MM;
  const carcass = mats.carcassId;
  const facade = m.facadeMaterialId ?? mats.facadeId;
  const innerW = m.w - 2 * t;
  const panels = [
    { role: "carcass", name: "side-left", lengthMm: m.h, widthMm: m.d, materialRef: carcass },
    { role: "carcass", name: "side-right", lengthMm: m.h, widthMm: m.d, materialRef: carcass },
    { role: "carcass", name: "bottom", lengthMm: innerW, widthMm: m.d, materialRef: carcass },
    { role: "carcass", name: "top", lengthMm: innerW, widthMm: m.d, materialRef: carcass },
    { role: "carcass", name: "back", lengthMm: m.w, widthMm: m.h, materialRef: carcass },
  ];
  for (let i = 0; i < legacyShelves(m); i++)
    panels.push({ role: "carcass", name: `shelf-${i + 1}`, lengthMm: innerW, widthMm: m.d, materialRef: carcass });
  for (let i = 0; i < m.dividers; i++)
    panels.push({ role: "carcass", name: `divider-${i + 1}`, lengthMm: m.h, widthMm: m.d, materialRef: carcass });

  const drawers = legacyDrawers(m);
  if (drawers > 0) {
    const frontH = m.h / drawers;
    for (let i = 0; i < drawers; i++)
      panels.push({ role: "facade", name: `drawer-front-${i + 1}`, lengthMm: frontH, widthMm: m.w, materialRef: facade, profile: m.door.style });
  } else if (m.fill !== "drawers" && m.door.style !== "none") {
    panels.push({ role: "facade", name: "door", lengthMm: m.h, widthMm: m.w, materialRef: facade, profile: m.door.style });
  }
  return panels;
}

/** The counts buildBom derived from a module: hinges, slides, shelf-pin rows, visible edge. */
function legacyCounts(m: Module) {
  const drawers = legacyDrawers(m);
  const hinges = m.fill !== "drawers" && m.door.style !== "none" ? hingesForDoorHeight(m.h) : 0;
  let visibleEdgeMm = 0;
  if (legacyHasFacade(m)) {
    visibleEdgeMm = drawers > 0 ? 2 * drawers * m.w + 2 * m.h : 2 * (m.w + m.h);
  }
  return { hinges, slides: drawers, shelves: legacyShelves(m), visibleEdgeMm };
}

// the same counts, from the tree
function treeCounts(m: Module) {
  const fronts = cutFronts(m);
  return {
    hinges: fronts.filter((f) => f.kind === "door").reduce((n, f) => n + hingesForDoorHeight(f.hMm), 0),
    slides: drawerCount(m),
    shelves: shelfCount(m),
    visibleEdgeMm: fronts.reduce((mm, f) => mm + 2 * (f.wMm + f.hMm), 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The profiles that are ONE piece of MDF — the blank is the same, only the routing differs. These
 *  must still cut byte-identical panels; what a profile costs is machine time, not parts. Glass and
 *  grid are deliberately NOT here: they genuinely add a pane (and bars), and get their own block. */
const SOLID_STYLES: FrontProfile[] = ["flat", "shaker", "raised", "fluted", "none"];

/** Every cabinet shape a real project can contain.
 *
 *  `open` is deliberately absent: the only `open` cabinets in the catalogue and the generator are
 *  the sink / dishwasher / washer (which the app resolves to a single door front — see the
 *  appliance test below) and the hood (`door: "none"`, nothing to cut). A bare `open` module with
 *  a door style is not a shape the app can produce; see the divergences block. */
function reachable(): Module[] {
  const out: Module[] = [];
  for (const kind of ["base", "tall", "upper"] as const) {
    for (const style of SOLID_STYLES) {
      // shelf cabinets: the count stepper offers 0..8
      for (let count = 0; count <= 8; count++) out.push(mod({ kind, fill: "shelves", count, door: { style } }));
      // drawer banks: templates ship 2..4, the generator never emits 0
      for (let count = 1; count <= 8; count++) out.push(mod({ kind, fill: "drawers", count, door: { style } }));
    }
    // the hood: open, nothing inside, no front
    out.push(mod({ kind, fill: "open", count: 0, door: { style: "none" } }));
  }
  return out;
}

/** The panels as the SAW sees them — provenance stripped.
 *
 *  `moduleId` says which cabinet inside a merged box a panel belongs to; it is bookkeeping for the
 *  cut list, not a property of the part. `legacyPanels` below is a verbatim copy of the pre-tree
 *  code and predates the field, so parity is asserted on the geometry, which is the thing that must
 *  never move. */
const cut = (panels: ReturnType<typeof modulePanels>) =>
  panels.map(({ moduleId, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars

describe("cell tree — parity with the pre-tree decomposition", () => {
  const shapes = reachable();

  it("covers every reachable shape", () => {
    expect(shapes.length).toBe(3 * (5 * (9 + 8) + 1));
  });

  it("cuts exactly the same panels", () => {
    for (const m of shapes) {
      expect(cut(modulePanels(m, MATS)), `panels for ${m.kind}/${m.fill}/${m.count}/${m.door.style}`).toEqual(
        legacyPanels(m, MATS),
      );
    }
  });

  it("derives the same hinges, slides and shelf rows", () => {
    for (const m of shapes) {
      const { visibleEdgeMm: _t, ...tree } = treeCounts(m);
      const { visibleEdgeMm: _l, ...legacy } = legacyCounts(m);
      expect(tree, `counts for ${m.kind}/${m.fill}/${m.count}/${m.door.style}`).toEqual(legacy);
    }
  });

  it("bands the same length of visible edge", () => {
    for (const m of shapes) {
      // The tree sums a perimeter per front where the old code used a closed form, so a bank of
      // 7 drawers lands on 9840.000000000002mm instead of 9840mm. That is IEEE summation dust,
      // not a difference: the BOM converts mm→m and rounds the amount to whole UZS, so it cannot
      // reach a quote. (Panel dimensions ARE bit-identical — see the panels test above.)
      expect(treeCounts(m).visibleEdgeMm, `edge for ${m.kind}/${m.fill}/${m.count}/${m.door.style}`).toBeCloseTo(
        legacyCounts(m).visibleEdgeMm,
        6,
      );
    }
  });

  it("is unchanged when the derived tree is passed in explicitly", () => {
    // the app always sends `layout` — sending it must be identical to letting pricing derive it
    for (const m of shapes) {
      expect(modulePanels({ ...m, layout: deriveLayout(m) }, MATS)).toEqual(modulePanels(m, MATS));
    }
  });
});

describe("cell tree — what a custom interior actually cuts", () => {
  // the case the whole change exists for: 3 drawers on the left, a door with 2 shelves on the
  // right. Before, this was priced and cut from the cabinet's stale pre-edit fill/count.
  const mixed = mod({
    w: 900,
    h: 800,
    fill: "shelves", // STALE — the Fill Editor never updates it. The tree must win.
    count: 1,
    layout: {
      split: "cols",
      sizes: [1 / 3, 2 / 3],
      children: [
        {
          split: "rows",
          sizes: [1 / 3, 1 / 3, 1 / 3],
          children: [{ front: "drawer" }, { front: "drawer" }, { front: "drawer" }],
        },
        { front: "door", split: "rows", sizes: [1 / 3, 1 / 3, 1 / 3], children: [{}, {}, {}] },
      ],
    },
  });

  it("ignores the stale fill/count entirely", () => {
    const spec = moduleInterior(mixed);
    expect(spec.fronts).toHaveLength(4); // 3 drawers + 1 door
    expect(spec.dividers).toHaveLength(1); // the vertical split
    expect(spec.shelves).toHaveLength(2); // behind the door — NOT between the drawers
  });

  it("sizes every front to its own cell", () => {
    const facades = modulePanels(mixed, MATS).filter((p) => p.role === "facade");
    expect(facades).toHaveLength(4);
    // 3 drawer fronts: 300 wide (1/3 of 900) × 266.67 tall (1/3 of 800)
    for (const d of facades.filter((p) => p.name.startsWith("drawer-front"))) {
      expect(d.widthMm).toBeCloseTo(300);
      expect(d.lengthMm).toBeCloseTo(800 / 3);
    }
    // 1 door: 600 wide (2/3 of 900) × full 800 tall
    const door = facades.find((p) => p.name === "door")!;
    expect(door.widthMm).toBeCloseTo(600);
    expect(door.lengthMm).toBeCloseTo(800);
  });

  it("bills a hinge set per door, sized by that door's own height", () => {
    const twoDoors = mod({
      h: 2000,
      layout: {
        split: "rows",
        sizes: [0.25, 0.75],
        children: [{ front: "door" }, { front: "door" }], // 500mm and 1500mm
      },
    });
    const hinges = cutFronts(twoDoors)
      .filter((f) => f.kind === "door")
      .map((f) => hingesForDoorHeight(f.hMm));
    expect(hinges).toEqual([2, 3]); // ≤900 → 2, ≤1600 → 3
  });

  it("does not put a shelf between two drawers", () => {
    const box = { w: 600, h: 720, innerW: 568 };
    const drawers = walkInterior(
      { split: "rows", sizes: [0.5, 0.5], children: [{ front: "drawer" }, { front: "drawer" }] },
      box,
    );
    expect(drawers.shelves).toHaveLength(0);
    // but an open compartment above a drawer DOES sit on one
    const mixedRows = walkInterior(
      { split: "rows", sizes: [0.5, 0.5], children: [{ front: "drawer" }, {}] },
      box,
    );
    expect(mixedRows.shelves).toHaveLength(1);
  });

  it("cuts a combined door spanning a block of cells", () => {
    const combined = mod({
      w: 800,
      h: 700,
      layout: { split: "cols", sizes: [0.5, 0.5], children: [{}, {}] },
      combinedDoors: [{ fx0: 0, fy0: 0, fx1: 1, fy1: 1 }],
    });
    const facades = modulePanels(combined, MATS).filter((p) => p.role === "facade");
    expect(facades).toHaveLength(1);
    expect(facades[0]).toMatchObject({ name: "door", widthMm: 800, lengthMm: 700 });
  });

  it("numbers multiple doors, keeping a lone door unsuffixed", () => {
    const one = modulePanels(mod({}), MATS).filter((p) => p.role === "facade");
    expect(one.map((p) => p.name)).toEqual(["door"]);

    const two = modulePanels(
      mod({ layout: { split: "cols", sizes: [0.5, 0.5], children: [{ front: "door" }, { front: "door" }] } }),
      MATS,
    ).filter((p) => p.role === "facade");
    // the cut list's partRu()/shortPart() split on a trailing -<digits>, so the base must stay ASCII
    expect(two.map((p) => p.name)).toEqual(["door-1", "door-2"]);
  });

  it("a door style of 'none' drops door leaves but keeps drawer fronts", () => {
    const noDoor = mod({
      door: { style: "none" },
      layout: { split: "rows", sizes: [0.5, 0.5], children: [{ front: "door" }, { front: "drawer" }] },
    });
    expect(cutFronts(noDoor).map((f) => f.kind)).toEqual(["drawer"]);
  });
});

describe("cell tree — an appliance cabinet keeps its front", () => {
  // The sink / dishwasher / washer are modelled `fill: "open"` (nothing to shelve inside) but they
  // DO carry a facade. The app resolves their interior to a single door front (toProject.ts
  // FRONTED_APPLIANCES) — this is the module it produces. Reading `open` literally would have
  // silently dropped the panel, which is the one way this change could have under-cut a kitchen.
  const sink = mod({ w: 800, fill: "open", count: 0, door: { style: "flat" }, layout: { front: "door" } });

  it("cuts the same door panel the old code cut", () => {
    const legacyFacades = legacyPanels(mod({ w: 800, fill: "open", count: 0 }), MATS).filter((p) => p.role === "facade");
    const treeFacades = cut(modulePanels(sink, MATS)).filter((p) => p.role === "facade");
    expect(treeFacades).toEqual(legacyFacades);
    expect(treeFacades).toHaveLength(1);
  });

  it("now also BANDS that door — the old code cut it and billed no edge for it", () => {
    // legacy `hasFacade()` returned false for any `open` module, so the door it had just cut got
    // zero visible edge banding. An unbanded door is a factory defect, so this is a fix, and it is
    // the one place an existing quote moves: + the door's perimeter of 2mm PVC.
    expect(legacyCounts(mod({ w: 800, fill: "open", count: 0 })).visibleEdgeMm).toBe(0);
    expect(treeCounts(sink).visibleEdgeMm).toBe(2 * (800 + 720));
  });
});

describe("cell tree — deliberate divergences from the old code", () => {
  // These shapes are unreachable from the catalogue and the generator. In each the old code was
  // wrong and the tree is right; they are pinned here so the difference is a decision on record
  // rather than a surprise if a future feature makes them reachable.

  it("a bare OPEN module no longer cuts a phantom door", () => {
    const m = mod({ fill: "open", count: 0, door: { style: "flat" } });
    // old: `open` still fell through to the door branch, so an open niche was cut a door (and
    // billed 2 hinges for it) that no view ever drew.
    expect(legacyPanels(m, MATS).filter((p) => p.role === "facade")).toHaveLength(1);
    expect(legacyCounts(m).hinges).toBe(2);
    expect(modulePanels(m, MATS).filter((p) => p.role === "facade")).toHaveLength(0);
    expect(treeCounts(m).hinges).toBe(0);
  });

  it("an OPEN cabinet with shelves now actually cuts them", () => {
    const m = mod({ fill: "open", count: 2, door: { style: "none" } });
    expect(legacyShelves(m)).toBe(0); // old: `open` carried no shelves at all
    expect(shelfCount(m)).toBe(2); // new: two separators → two shelf panels
  });

  it("a divided cabinet gets a door and shelves PER COLUMN", () => {
    const m = mod({ dividers: 1, count: 2 });
    // old: one full-width door + 2 full-width shelves + 1 divider — a door spanning a divider,
    // and shelves passing through it. new: each column is its own doored, shelved compartment.
    expect(legacyPanels(m, MATS).filter((p) => p.role === "facade")).toHaveLength(1);
    expect(modulePanels(m, MATS).filter((p) => p.role === "facade")).toHaveLength(2);
    expect(shelfCount(m)).toBe(4); // 2 per column
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE FRONT'S PROFILE (fronts.ts). A front is ONE piece of MDF with its shape routed in — so a
// profile buys MACHINE TIME, not parts. Glass is the exception: the middle is routed clean out and
// a pane is bought to fit.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const MATS_GLASS: MaterialSelection = { ...MATS, glassId: "glass" };

describe("front profiles", () => {
  it("reads the legacy door index when no profile is set", () => {
    expect(frontOf({ door: 0 })).toBe("flat");
    expect(frontOf({ door: 1 })).toBe("shaker"); // «Фрезер» — an index nothing used to render
    expect(frontOf({ door: 2 })).toBe("glass");
    expect(frontOf({ door: 3 })).toBe("none");
    expect(frontOf({})).toBe("flat");
    expect(frontOf({ front: "fluted", door: 2 })).toBe("fluted"); // an explicit profile wins
  });

  it("derives a sane mullion grid from the door's size — never zero", () => {
    expect(mullionsFor(400, 900)).toEqual({ cols: 1, rows: 3 }); // tall + narrow
    expect(mullionsFor(600, 700)).toEqual({ cols: 2, rows: 2 }); // wide
    expect(mullionsFor(150, 150)).toEqual({ cols: 1, rows: 1 }); // clamped, not 0
    expect(mullionsFor(2000, 3000)).toEqual({ cols: 4, rows: 5 }); // clamped at the top too
  });

  it("bills routing by contour, and fluting by area", () => {
    const r = innerRect(600, 720); // 60mm frame → 480 × 600
    expect(r).toEqual({ w: 480, h: 600 });
    expect(millContourMm("flat", 600, 720)).toBe(0);
    expect(millContourMm("fluted", 600, 720)).toBe(0); // fluting is an AREA, not a contour
    expect(millContourMm("shaker", 600, 720)).toBe(2 * (480 + 600));
    expect(millContourMm("raised", 600, 720)).toBe(2 * 2 * (480 + 600)); // frame + the field's edge
    expect(fluteAreaMm2("fluted", 600, 720)).toBe(600 * 720);
    expect(fluteAreaMm2("shaker", 600, 720)).toBe(0);
  });

  it("cuts the SAME panels for a milled front — the profile is machine time, not parts", () => {
    const flat = modulePanels(mod({ door: { style: "flat" } }), MATS);
    for (const style of ["shaker", "raised", "fluted"] as const) {
      const milled = modulePanels(mod({ door: { style } }), MATS);
      expect(milled.map(({ profile: _p, ...rest }) => rest)).toEqual(
        flat.map(({ profile: _q, ...rest }) => rest),
      );
    }
  });

  it("a glass front buys the full blank AND a pane", () => {
    const panels = modulePanels(mod({ w: 600, h: 720, door: { style: "glass" } }), MATS_GLASS);
    const facades = panels.filter((p) => p.role === "facade");
    const panes = panels.filter((p) => p.role === "glass");
    // the blank is the WHOLE door — you buy the sheet and rout the middle out of it
    expect(facades).toHaveLength(1);
    expect(facades[0]).toMatchObject({ name: "door", widthMm: 600, lengthMm: 720 });
    expect(panes).toHaveLength(1);
    expect(panes[0]).toMatchObject({ name: "glass-1", widthMm: 480, lengthMm: 600, materialRef: "glass" });
    expect(GLASS_THICKNESS_MM).toBe(4);
  });

  it("a glass grid also cuts its mullion bars", () => {
    const panels = modulePanels(mod({ w: 600, h: 720, door: { style: "grid" } }), MATS_GLASS);
    const bars = panels.filter((p) => p.name.startsWith("mullion"));
    expect(bars).toHaveLength(1); // ONE equivalent panel: bar width × total bar length
    const { cols, rows } = mullionsFor(600, 720); // 2 × 2
    expect(bars[0]).toMatchObject({
      role: "facade",
      widthMm: MULLION_MM,
      lengthMm: (cols - 1) * 600 + (rows - 1) * 480, // vertical bars + horizontal bars
      materialRef: "facade", // thin MDF strips, cut from the facade sheet
    });
  });

  it("a pane is not a sawn panel", () => {
    const project = (style: FrontProfile) => ({
      id: "p", name: "p", ownerId: "o", units: "mm" as const,
      createdAt: "", updatedAt: "", schemaVersion: 1 as const,
      space: { shape: "i" as const, wallLenMm: 3000, ceilingMm: 2700 },
      run: [mod({ door: { style } })],
      materials: MATS_GLASS,
      pricing: { rateTableId: "r", snapshotAt: "" },
    });
    const cutQty = (style: FrontProfile) =>
      buildBom(project(style)).find((l) => l.ref === "cutPerPanel")!.qty;
    // glass adds a panel line but NOT a cut: it arrives cut to size from the glazier
    expect(cutQty("glass")).toBe(cutQty("flat"));
  });

  it("a FLAT kitchen bills no routing at all — no existing quote moves", () => {
    const project = (style: FrontProfile) => ({
      id: "p", name: "p", ownerId: "o", units: "mm" as const,
      createdAt: "", updatedAt: "", schemaVersion: 1 as const,
      space: { shape: "i" as const, wallLenMm: 3000, ceilingMm: 2700 },
      run: [mod({ door: { style } })],
      materials: MATS,
      pricing: { rateTableId: "r", snapshotAt: "" },
    });
    const ops = (style: FrontProfile) =>
      buildBom(project(style)).filter((l) => l.ref === "millPerM" || l.ref === "flutePerM2");
    expect(ops("flat")).toHaveLength(0);
    expect(ops("none")).toHaveLength(0);
    // and the milled ones DO bill it — the line exists, the seeded rate is what keeps it free
    expect(ops("shaker")).toEqual([{ kind: "operation", ref: "millPerM", qty: 2 * (480 + 600) / 1000, unit: "m" }]);
    expect(ops("fluted")).toEqual([{ kind: "operation", ref: "flutePerM2", qty: 600 * 720 / 1e6, unit: "m2" }]);
  });
});
