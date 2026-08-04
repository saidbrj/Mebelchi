// THE MERGED CARCASS — four wall units built as one box instead of four.
//
// Two things have to be true, and they pull against each other:
//   1. Merging must SAVE — fewer sides, fewer backs, fewer hangers, less banding, less assembly.
//      If it doesn't, the seller has no reason to offer it and the whole feature is decoration.
//   2. Merging must not LEAK — an untagged project has to price to the same сум it always did.
//      This is a live app with saved quotes in it.
//
// The suite asserts both, and it asserts the geometry that makes the saving legitimate (the fronts
// are untouched, so the kitchen the client sees is identical) rather than just the totals.

import { describe, it, expect } from "vitest";
import type { Module, MaterialSelection, Project } from "../../schema/src/index.js";
import { carcassPanels, modulePanels } from "../src/parts.js";
import { groupCarcasses, hangingCount, DEFAULT_PRODUCTION, carcassWidth } from "../src/carcass.js";
import { carcassJoints } from "../src/constants.js";
import { buildBom } from "../src/buildBom.js";
import { priceProject } from "../src/priceProject.js";
import { seedRateTable } from "../src/seedRateTable.js";

const MATS: MaterialSelection = {
  carcassId: "carcass",
  facadeId: "facade",
  edgeVisibleId: "edgeV",
  edgeHiddenId: "edgeH",
  worktopId: "worktop",
};

/** A 600×720×320 wall unit with a door and one shelf — the row the workshop wants to merge. */
const upper = (id: string, over: Partial<Module> = {}): Module => ({
  id,
  kind: "upper",
  w: 600,
  h: 720,
  d: 320,
  fill: "shelves",
  count: 1,
  dividers: 0,
  door: { style: "flat" },
  handle: { type: "bar" },
  ...over,
});

/** Four of them, tagged into one box. */
const merged = (): Module[] =>
  ["a", "b", "c", "d"].map((id) => upper(id, { carcassGroup: "row-1" }));
const separate = (): Module[] => ["a", "b", "c", "d"].map((id) => upper(id));

const project = (run: Module[]): Project => ({
  id: "p",
  name: "t",
  ownerId: "o",
  units: "mm",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  schemaVersion: 1,
  space: { source: "manual", shape: "i", wallLength: 3000, ceilingHeight: 2700, waterWall: "none", constraints: [] },
  run,
  materials: MATS,
  pricing: { rateTableId: seedRateTable.id, snapshotAt: "2026-01-01T00:00:00Z" },
});

/** Total quantity of one BOM ref, across the whole project. */
const qty = (run: Module[], kind: string, ref: string): number =>
  buildBom(project(run))
    .filter((l) => l.kind === kind && l.ref === ref)
    .reduce((n, l) => n + l.qty, 0);

const panelsOf = (run: Module[]) => groupCarcasses(run).flatMap((c) => carcassPanels(c, MATS));
const named = (run: Module[], name: string) => panelsOf(run).filter((p) => p.name === name);

describe("grouping", () => {
  it("leaves an untagged run as one box per cabinet", () => {
    const boxes = groupCarcasses(separate());
    expect(boxes).toHaveLength(4);
    expect(boxes.every((b) => b.modules.length === 1)).toBe(true);
    // the box id IS the module id when nothing is merged — panel ids downstream are unchanged
    expect(boxes.map((b) => b.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("merges a tagged run into one box", () => {
    const boxes = groupCarcasses(merged());
    expect(boxes).toHaveLength(1);
    expect(boxes[0].modules.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
    expect(carcassWidth(boxes[0])).toBe(2400);
  });

  it("refuses to merge cabinets that cannot share a box", () => {
    // a 900-high unit has no side panel in common with a 720 one, however the tag reads
    const run = [
      upper("a", { carcassGroup: "row-1" }),
      upper("b", { carcassGroup: "row-1", h: 900 }),
      upper("c", { carcassGroup: "row-1" }),
    ];
    const boxes = groupCarcasses(run);
    expect(boxes.map((b) => b.modules.map((m) => m.id))).toEqual([["a"], ["b"], ["c"]]);
    // and the two fragments claiming "row-1" get distinct ids, or panel ids would collide
    expect(new Set(boxes.map((b) => b.id)).size).toBe(3);
  });

  it("splits a group that is not contiguous in the run", () => {
    const run = [
      upper("a", { carcassGroup: "row-1" }),
      upper("x"), // a stranger between them — you cannot build around it
      upper("b", { carcassGroup: "row-1" }),
    ];
    expect(groupCarcasses(run).map((b) => b.modules.map((m) => m.id))).toEqual([["a"], ["x"], ["b"]]);
  });
});

describe("the shell a merged box cuts", () => {
  it("replaces 8 side panels with 2 sides + 3 stiles", () => {
    expect(named(separate(), "side-left")).toHaveLength(4);
    expect(named(separate(), "side-right")).toHaveLength(4);

    expect(named(merged(), "side-left")).toHaveLength(1);
    expect(named(merged(), "side-right")).toHaveLength(1);
    expect(named(merged(), "stile-1")).toHaveLength(1);
    expect(named(merged(), "stile-2")).toHaveLength(1);
    expect(named(merged(), "stile-3")).toHaveLength(1);

    // 8 vertical panels → 5. Each is the same 720×320 board, so this is a straight 3-panel saving.
    const verticals = (run: Module[]) =>
      panelsOf(run).filter((p) => /^(side-left|side-right|stile-\d+)$/.test(p.name));
    expect(verticals(separate())).toHaveLength(8);
    expect(verticals(merged())).toHaveLength(5);
    expect(verticals(merged()).every((p) => p.lengthMm === 720 && p.widthMm === 320)).toBe(true);
  });

  it("cuts one long top, bottom and back instead of four of each", () => {
    expect(named(separate(), "top")).toHaveLength(4);
    expect(named(separate(), "back")).toHaveLength(4);

    const [top] = named(merged(), "top");
    const [bottom] = named(merged(), "bottom");
    const [back] = named(merged(), "back");
    expect(named(merged(), "top")).toHaveLength(1);
    expect(top.lengthMm).toBe(2400 - 32); // the full box interior, not 4 × (600 − 32)
    expect(bottom.lengthMm).toBe(2400 - 32);
    expect(back.lengthMm).toBe(2400);
    expect(back.widthMm).toBe(720);
  });

  it("gives the shell no owning module — it belongs to the box", () => {
    const shell = panelsOf(merged()).filter((p) => p.moduleId === undefined);
    expect(shell.map((p) => p.name).sort()).toEqual(
      ["back", "bottom", "side-left", "side-right", "stile-1", "stile-2", "stile-3", "top"].sort(),
    );
    // every other panel names the cabinet it goes in, or the shop cannot tell the bays apart
    const rest = panelsOf(merged()).filter((p) => p.moduleId !== undefined);
    expect(new Set(rest.map((p) => p.moduleId))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("saves board area", () => {
    const area = (run: Module[]) =>
      panelsOf(run)
        .filter((p) => p.role === "carcass")
        .reduce((a, p) => a + (p.lengthMm * p.widthMm) / 1e6, 0);
    // 5.752 m² → 5.138 m². Three fewer sides and three fewer backs, PART of which is given back:
    // the merged top and bottom are one 2368 board each rather than four 568s, and the bays get
    // wider shelves. So the board saving is a real ~11%, not the ~25% a naive side-count suggests —
    // the rest of the win is in hardware, banding, assembly and delivery, not in board.
    expect(area(separate())).toBeCloseTo(5.752, 2);
    expect(area(merged())).toBeCloseTo(5.138, 2);
    expect(area(separate()) - area(merged())).toBeGreaterThan(0.6); // m²
  });
});

describe("the fronts a merged box cuts — THE THING THAT MUST NOT MOVE", () => {
  it("cuts exactly the same fronts, at exactly the same size", () => {
    const fronts = (run: Module[]) =>
      panelsOf(run)
        .filter((p) => p.role === "facade")
        .map(({ moduleId, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
    // merging is a CARCASS decision. The client's kitchen looks identical — same doors, same sizes,
    // same gaps. If this ever fails, merging has become visible and the feature is wrong.
    expect(fronts(merged())).toEqual(fronts(separate()));
    expect(fronts(merged())).toHaveLength(4);
    expect(fronts(merged()).every((f) => f.widthMm === 600 && f.lengthMm === 720)).toBe(true);
  });

  it("bills the same hinges — a door is a door however the box behind it is built", () => {
    expect(qty(merged(), "hardware", "HNG-CLIP-110")).toBe(qty(separate(), "hardware", "HNG-CLIP-110"));
  });

  it("widens the shelves by half a stile on each shared side", () => {
    // a standalone 600 bay is 600 − 2×16 = 568. Inside the box an internal bay gives up half a
    // stile either side: 600 − 8 − 8 = 584. The two end bays give up one full outer side: 576.
    const shelf = (run: Module[], id: string) =>
      panelsOf(run).find((p) => p.moduleId === id && p.name === "shelf-1")!.lengthMm;
    expect(shelf(separate(), "a")).toBe(568);
    expect(shelf(merged(), "a")).toBe(576); // end bay
    expect(shelf(merged(), "b")).toBe(584); // internal bay
    expect(shelf(merged(), "c")).toBe(584);
    expect(shelf(merged(), "d")).toBe(576); // end bay
    // and they still tile the box exactly: 5 stiles/sides × 16 + 4 bays = 2400
    const bays = ["a", "b", "c", "d"].reduce((s, id) => s + shelf(merged(), id), 0);
    expect(bays + 5 * 16).toBe(2400);
  });
});

describe("hardware, labour and delivery follow the BOX", () => {
  it("hangs a merged row on one set of hangers instead of four", () => {
    // this is the number the workshop actually cares about
    expect(qty(separate(), "hardware", "HANG-BRACKET-01")).toBe(8); // 4 boxes × 2
    expect(qty(merged(), "hardware", "HANG-BRACKET-01")).toBe(2); // 1 box × 2
  });

  it("hangs nothing on a floor cabinet", () => {
    const bases = [upper("a", { kind: "base", h: 720, d: 560 })];
    expect(qty(bases, "hardware", "HANG-BRACKET-01")).toBe(0);
  });

  it("adds a set per span when the shop uses one", () => {
    const [box] = groupCarcasses(merged());
    expect(hangingCount(box, DEFAULT_PRODUCTION)).toBe(2); // span 0 → one set, however wide
    // The span rule asks for ceil(2400/900) = 3 sets × 2 = 6 — but hangingCount caps at
    // `modules.length + 1`, because a навес screws to a SIDE PANEL and this 4-module box has
    // only 5 of them. Billing a 6th bracket would put it somewhere the fitter cannot mount it.
    expect(hangingCount(box, { hangingsPerCarcass: 2, hangingSpanMm: 900 })).toBe(5);
    expect(hangingCount(box, { hangingsPerCarcass: 0, hangingSpanMm: 0 })).toBe(0); // shop fits none
  });

  it("joins the box, not the cabinets — 16 cam/dowel joints become 10", () => {
    expect(carcassJoints(1)).toBe(4); // a standalone cabinet, exactly as before
    expect(carcassJoints(4)).toBe(10); // 5 verticals × top and bottom
    expect(qty(separate(), "hardware", "CAM-MINIFIX-15")).toBe(32); // 4 × 8
    expect(qty(merged(), "hardware", "CAM-MINIFIX-15")).toBe(20); // 10 joints × 2
    expect(qty(merged(), "hardware", "DOWEL-8x30")).toBe(20);
  });

  it("assembles and delivers one box, not four", () => {
    expect(qty(separate(), "labor", "assemblyPerModule")).toBe(4);
    expect(qty(merged(), "labor", "assemblyPerModule")).toBe(1);
    expect(qty(separate(), "delivery", "perModule")).toBe(4);
    expect(qty(merged(), "delivery", "perModule")).toBe(1);
  });

  it("bands less hidden edge — one frame plus three stiles, not four frames", () => {
    expect(qty(separate(), "edge", "edgeH")).toBeCloseTo((4 * 2 * (600 + 720)) / 1000, 6); // 10.56 m
    expect(qty(merged(), "edge", "edgeH")).toBeCloseTo((2 * (2400 + 720) + 3 * 720) / 1000, 6); // 8.4 m
  });

  it("saws fewer panels", () => {
    expect(qty(merged(), "operation", "cutPerPanel")).toBeLessThan(qty(separate(), "operation", "cutPerPanel"));
  });
});

describe("the money", () => {
  /** the same seed refs the app picks (toProject.pickMaterials) — priceProject throws on any ref it
   *  cannot resolve, so the money test has to quote against the real table. */
  const seedMats = (): MaterialSelection => {
    const entries = Object.entries(seedRateTable.materials);
    const byType = (t: string) => entries.find(([, m]) => m.type === t)?.[0];
    const edges = Object.entries(seedRateTable.edge)
      .sort((a, b) => b[1].pricePerM - a[1].pricePerM)
      .map(([id]) => id);
    return {
      carcassId: byType("LDSP") ?? entries[0][0],
      facadeId: byType("MDF") ?? entries[0][0],
      worktopId: Object.keys(seedRateTable.worktop)[0],
      edgeVisibleId: edges[0],
      edgeHiddenId: edges[1] ?? edges[0],
    };
  };
  const priced = (run: Module[]) =>
    priceProject({ ...project(run), materials: seedMats() }, seedRateTable);

  it("makes a merged row cheaper than four separate ones", () => {
    const sep = priced(separate()).total;
    const mrg = priced(merged()).total;
    expect(mrg).toBeLessThan(sep);
    // and the saving is worth a seller's attention, not a rounding error
    expect((sep - mrg) / sep).toBeGreaterThan(0.08);
  });

  it("puts the saving where the workshop said it would be", () => {
    const sep = priced(separate()).groups;
    const mrg = priced(merged()).groups;
    expect(mrg.hardware).toBeLessThan(sep.hardware); // hangers, cams, dowels
    expect(mrg.carcassFacade).toBeLessThan(sep.carcassFacade); // board + assembly
    expect(mrg.cnc).toBeLessThan(sep.cnc); // fewer panels sawn, fewer holes drilled
    expect(mrg.delivery).toBeLessThan(sep.delivery); // one box on the van
  });

  it("does not move an UNTAGGED project by a single сум", () => {
    // the guarantee that lets this ship: every saved quote in the app has no carcassGroup on any
    // module, so it must decompose to precisely what it always did. `modulePanels` is the old name
    // and the old contract; a one-module box has to agree with it exactly.
    for (const m of [upper("x"), upper("y", { fill: "drawers", count: 3 }), upper("z", { kind: "base", d: 560, dividers: 1 })]) {
      const [box] = groupCarcasses([m]);
      expect(carcassPanels(box, MATS)).toEqual(modulePanels(m, MATS));
    }
  });
});
