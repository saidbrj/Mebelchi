// PER-ROLE PANEL OVERRIDES — the first-class panel model, at the granularity that is useful.
//
// Every panel in a box has always been derived from the module, and every one of them took the
// carcass's own depth. That is right for a side and wrong for a shelf: shops routinely cut shelves
// shallower so a door closes clean over the front edge, and there was no way to say so — the cut
// list ordered a full-depth board and the 3D drew one.
//
// Keyed by ROLE, not by individual panel. A shop does not decide that THIS shelf is 500 and the one
// above it is 520; it decides that shelves are 500. Per-individual-panel control is a different and
// much larger feature, and this is deliberately not it.

import { describe, it, expect } from "vitest";
import type { Module, MaterialSelection } from "../../schema/src/index.js";
import { modulePanels, carcassPanels, panelDepth, panelBanding, panelBandMm } from "../src/parts.js";
import { buildBom } from "../src/buildBom.js";
import { seedRateTable } from "../src/seedRateTable.js";

const MATS: MaterialSelection = {
  carcassId: "carcass",
  facadeId: "facade",
  worktopId: "worktop",
  edgeVisibleId: "edge2",
  edgeHiddenId: "edge04",
};

const mod = (over: Partial<Module> = {}): Module => ({
  id: "m1",
  kind: "base",
  w: 800,
  h: 720,
  d: 560,
  fill: "shelves",
  count: 2,
  dividers: 0,
  door: { style: "flat" },
  handle: { type: "bar" },
  ...over,
});

const byPart = (m: Module, part: string) => modulePanels(m, MATS).filter((p) => p.part === part);

describe("every panel says what it IS", () => {
  it("tags the shell", () => {
    const parts = new Set(modulePanels(mod(), MATS).map((p) => p.part));
    for (const p of ["side", "bottom", "top", "back", "shelf"]) expect(parts.has(p as never)).toBe(true);
  });

  it("tags a stile only where a box is actually merged", () => {
    expect(byPart(mod(), "stile")).toHaveLength(0);
    const merged = carcassPanels({ id: "box", modules: [mod(), mod({ id: "m2" })] }, MATS);
    expect(merged.filter((p) => p.part === "stile")).toHaveLength(1);
  });

  it("tells a drawer front from a door", () => {
    expect(byPart(mod({ fill: "drawers", count: 3 }), "drawer")).toHaveLength(3);
    expect(byPart(mod({ fill: "drawers", count: 3 }), "door")).toHaveLength(0);
    expect(byPart(mod(), "door").length).toBeGreaterThan(0);
  });

  it("tags the pane of a glazed front separately from its blank", () => {
    const glazed = mod({ door: { style: "glass" } });
    expect(byPart(glazed, "glass").length).toBeGreaterThan(0);
    expect(byPart(glazed, "door").length).toBeGreaterThan(0);
  });
});

describe("cutting a role shallower than its box", () => {
  it("takes the carcass depth when nothing says otherwise", () => {
    expect(panelDepth(mod(), "shelf")).toBe(560);
    expect(byPart(mod(), "shelf")[0].widthMm).toBe(560);
  });

  it("cuts the shelves to the override and leaves the sides alone", () => {
    // THE CASE THIS EXISTS FOR: a shelf set back so the door closes clean over its front edge
    const m = mod({ panels: { shelf: { depthMm: 500 } } });
    expect(byPart(m, "shelf").every((p) => p.widthMm === 500)).toBe(true);
    expect(byPart(m, "side").every((p) => p.widthMm === 560)).toBe(true);
  });

  it("overrides dividers independently of shelves", () => {
    const m = mod({ dividers: 1, panels: { divider: { depthMm: 520 } } });
    expect(byPart(m, "divider").every((p) => p.widthMm === 520)).toBe(true);
    expect(byPart(m, "shelf").every((p) => p.widthMm === 560)).toBe(true);
  });

  it("refuses a panel DEEPER than the box it lives in", () => {
    // an override is a preference, and one that cannot be built is not a preference
    expect(panelDepth(mod({ panels: { shelf: { depthMm: 900 } } }), "shelf")).toBe(560);
  });

  it("refuses a panel with no depth at all", () => {
    expect(panelDepth(mod({ panels: { shelf: { depthMm: 0 } } }), "shelf")).toBe(50);
  });

  it("leaves the BACK measured by height, not by depth", () => {
    // the back is a sheet across the box's face; its second dimension was never a depth
    const m = mod({ panels: { back: { depthMm: 100 } } });
    expect(byPart(m, "back")[0].widthMm).toBe(720);
  });
});

describe("a merged box", () => {
  it("takes the shell's depth from the box, not from each bay", () => {
    // the shell belongs to the BOX — one answer for it however many modules are merged in
    const a = mod({ panels: { side: { depthMm: 500 } } });
    const b = mod({ id: "m2" });
    const sides = carcassPanels({ id: "box", modules: [a, b] }, MATS).filter((p) => p.part === "side");
    expect(sides.every((p) => p.widthMm === 500)).toBe(true);
  });

  it("still lets each bay's own shelves differ", () => {
    const a = mod({ panels: { shelf: { depthMm: 500 } } });
    const b = mod({ id: "m2" });
    const shelves = carcassPanels({ id: "box", modules: [a, b] }, MATS).filter((p) => p.part === "shelf");
    expect(new Set(shelves.map((p) => p.widthMm))).toEqual(new Set([500, 560]));
  });
});

describe("nothing moves for a module that has no overrides", () => {
  it("cuts exactly what it always cut", () => {
    const plain = modulePanels(mod(), MATS).map(({ part, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
    const empty = modulePanels(mod({ panels: {} }), MATS).map(({ part, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
    expect(empty).toEqual(plain);
  });
});

describe("banding the edges you can see", () => {
  // THE GAP THIS CLOSES: an interior board's front edge is banded by every shop — raw chipboard
  // inside a cabinet swells and looks unfinished — and this engine counted none of it. The visible
  // tape was the fronts' perimeter, the hidden tape the box's front frame, and the boards between
  // them fell through. Every quote was short by its shelves.

  it("bands a shelf's front edge by default", () => {
    expect(panelBanding(mod(), "shelf")).toBe("front");
    expect(panelBanding(mod(), "divider")).toBe("front");
  });

  it("measures that as the edge you SEE — the board's span, not its perimeter", () => {
    const shelf = modulePanels(mod(), MATS).find((p) => p.part === "shelf")!;
    expect(panelBandMm(mod(), shelf)).toBe(shelf.lengthMm);
  });

  it("bands all four when a shop asks — an open unit shows every edge", () => {
    const m = mod({ panels: { shelf: { banding: "all" } } });
    const shelf = modulePanels(m, MATS).find((p) => p.part === "shelf")!;
    expect(panelBandMm(m, shelf)).toBe(2 * (shelf.lengthMm + shelf.widthMm));
  });

  it("bands none when a shop genuinely leaves them raw", () => {
    const m = mod({ panels: { shelf: { banding: "none" } } });
    const shelf = modulePanels(m, MATS).find((p) => p.part === "shelf")!;
    expect(panelBandMm(m, shelf)).toBe(0);
  });

  it("leaves the SHELL alone — its frame is billed once for the whole box", () => {
    // counting a side again per panel would bill the box's front frame twice, and would erase the
    // saving that merging is supposed to show
    for (const part of ["side", "stile", "top", "bottom", "back"] as const) {
      expect(panelBanding(mod(), part)).toBe("none");
    }
  });

  it("leaves the FRONTS alone — `visibleEdgeMm` already walks them", () => {
    expect(panelBanding(mod(), "door")).toBe("none");
    expect(panelBanding(mod({ fill: "drawers", count: 3 }), "drawer")).toBe("none");
  });
});

describe("it reaches the quote", () => {
  const project = (m: Module) => ({
    id: "00000000-0000-4000-8000-000000000001",
    name: "one cabinet",
    ownerId: "00000000-0000-4000-8000-0000000000aa",
    units: "mm" as const,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    schemaVersion: 1 as const,
    space: { source: "manual" as const, shape: "i" as const, wallLength: 3000, ceilingHeight: 2500, waterWall: "left" as const, constraints: [] },
    run: [m],
    materials: MATS,
    pricing: { rateTableId: seedRateTable.id, snapshotAt: "2026-08-31T00:00:00.000Z" },
  });

  const edgeM = (m: Module) =>
    buildBom(project(m))
      .filter((l) => l.kind === "edge" && l.ref === MATS.edgeVisibleId)
      .reduce((s, l) => s + l.qty, 0);

  it("adds the shelves' edges to the visible tape", () => {
    const bare = edgeM(mod({ panels: { shelf: { banding: "none" } } }));
    const banded = edgeM(mod());
    expect(banded).toBeGreaterThan(bare);
  });

  // What it COSTS is asserted in priceProject.test.ts, whose hand-worked total moved by exactly
  // this cabinet's one shelf edge — 0.568m at 5500/m. Pricing it again here would need every
  // material ref to be a real seeded UUID for a second, weaker copy of that proof.

  it("bands a SHALLOWER shelf's front edge, which is the same length", () => {
    // depth comes off the front-to-back dimension; the edge you see is the span, so it is unmoved
    expect(edgeM(mod({ panels: { shelf: { depthMm: 400 } } }))).toBeCloseTo(edgeM(mod()), 6);
  });
});
