// FLAT WALL PANELS in the quote — the фартук and the strip that closes the cabinetry to the
// ceiling. Both were invisible to pricing until now: the ceiling scribe was drawn by the 3D and
// charged for by nobody, and the фартук did not exist at all.
//
// The two of them bill DIFFERENTLY on purpose, and that is what most of this pins: a постформинг
// фартук is cut from the counter slab and bills the counter's running-metre rate; a panel cut from
// a sheet bills per m² with its edges banded.

import { describe, it, expect } from "vitest";
import type { Project, FlatPanel } from "../../schema/src/index.js";
import { priceProject, buildBom, seedRateTable } from "../src/index.js";

const LDSP = "cca8dc43-3ec6-4c8c-980d-05bf4625cc16"; // carcass, 95000/m²
const MDF = "1d2c7bbe-c4c8-4f08-a1b7-85a55823c545"; // facade,  240000/m²
const WORKTOP = "e8b5f6db-2fec-4e55-a3e0-8205087a2ad9"; // 185000/m
const EDGE_2MM = "3f5c7d17-561b-4d84-bb87-4367cfcb769d";
const EDGE_04MM = "ea86c841-0136-43ea-b06e-8fa8f5977408";

const kitchen = (panels?: FlatPanel[]): Project => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "one base cabinet",
  ownerId: "00000000-0000-4000-8000-0000000000aa",
  units: "mm",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  schemaVersion: 1,
  space: { source: "manual", shape: "i", wallLength: 3000, ceilingHeight: 2500, waterWall: "left", constraints: [] },
  run: [
    {
      id: "mod-1",
      kind: "base",
      w: 600,
      h: 720,
      d: 560,
      fill: "shelves",
      count: 1,
      dividers: 0,
      door: { style: "flat" },
      handle: { type: "bar" },
    },
  ],
  ...(panels ? { panels } : {}),
  materials: { carcassId: LDSP, facadeId: MDF, worktopId: WORKTOP, edgeVisibleId: EDGE_2MM, edgeHiddenId: EDGE_04MM },
  pricing: { rateTableId: seedRateTable.id, snapshotAt: "2026-08-29T00:00:00.000Z" },
});

const splash = (over: Partial<FlatPanel> = {}): FlatPanel => ({
  id: "p1",
  kind: "splash",
  w: 2400,
  h: 640,
  t: 6,
  stock: "worktop",
  ...over,
});

const linesOf = (p: Project) => buildBom(p);
const find = (p: Project, kind: string, ref: string) => linesOf(p).filter((l) => l.kind === kind && l.ref === ref);
/** The lines a panel ADDS — the cabinet emits panel/edge lines of its own, so every assertion here
 *  is a difference against the same kitchen without it. */
const added = (p: Project, kind: string, ref: string) => {
  const before = find(kitchen(), kind, ref);
  return find(p, kind, ref).slice(before.length);
};

describe("a project with no panels prices exactly as before", () => {
  it("adds no lines and moves no total", () => {
    const bare = priceProject(kitchen(), seedRateTable);
    const empty = priceProject(kitchen([]), seedRateTable);
    expect(empty.total).toBe(bare.total);
    expect(empty.lines.length).toBe(bare.lines.length);
  });
});

describe("a фартук cut from the counter slab", () => {
  it("bills its LENGTH against the worktop rate, not an invented per-m² one", () => {
    const p = kitchen([splash()]);
    // the cabinet's own 600mm of counter, plus 2400mm of фартук off the same slab
    const wt = find(p, "worktop", WORKTOP);
    expect(wt.map((l) => l.qty)).toEqual([0.6, 2.4]);
    for (const l of wt) expect(l.unit).toBe("m");
  });

  it("is not edge-banded — a постформинг panel arrives with its edge on", () => {
    const p = kitchen([splash()]);
    const bare = kitchen();
    expect(find(p, "edge", EDGE_2MM).length).toBe(find(bare, "edge", EDGE_2MM).length);
  });

  it("moves the total by exactly the slab it uses", () => {
    const before = priceProject(kitchen(), seedRateTable).total;
    const after = priceProject(kitchen([splash()]), seedRateTable).total;
    const rate = seedRateTable.worktop[WORKTOP].pricePerM;
    const cut = seedRateTable.operations.cutPerPanel;
    expect(after - before).toBe(Math.round(2.4 * rate) + Math.round(cut));
  });
});

describe("a panel cut from a sheet", () => {
  it("bills per m² against its stock and bands its two horizontal edges", () => {
    const p = kitchen([splash({ stock: "facade", w: 2400, h: 300, kind: "closer" })]);
    const panel = added(p, "panel", MDF);
    expect(panel).toHaveLength(1);
    expect(panel[0].qty).toBeCloseTo((2400 * 300) / 1e6, 6); // 0.72 m²
    expect(panel[0].unit).toBe("m2");
    // 2 × 2400mm of visible edge — the ends die into the walls and are not banded
    const edge = added(p, "edge", EDGE_2MM);
    expect(edge).toHaveLength(1);
    expect(edge[0].qty).toBeCloseTo(4.8, 6);
  });

  it("uses the carcass board when the decor is a carcass one", () => {
    const p = kitchen([splash({ stock: "carcass" })]);
    expect(added(p, "panel", LDSP)).toHaveLength(1);
    expect(added(p, "panel", MDF)).toHaveLength(0);
  });
});

describe("sockets cut out of a фартук", () => {
  it("bill as routed contour, the same operation a milled front does", () => {
    // one 90×120 socket — the contour the router follows is its perimeter
    const withCuts = kitchen([splash({ stock: "facade", cutouts: [{ x: 400, y: 200, w: 90, h: 120 }] })]);
    const mill = linesOf(withCuts).filter((l) => l.ref === "millPerM");
    expect(mill).toHaveLength(1);
    expect(mill[0].qty).toBeCloseTo(0.42, 6);
    // no cut-outs → no routing line at all
    expect(linesOf(kitchen([splash({ stock: "facade" })])).filter((l) => l.ref === "millPerM")).toHaveLength(0);
  });
});

describe("every panel is a cut panel", () => {
  it("charges one saw cut each, whatever it is made of", () => {
    const p = kitchen([splash(), splash({ id: "p2", stock: "facade" })]);
    const cuts = linesOf(p).filter((l) => l.ref === "cutPerPanel");
    // the cabinet's own panels come as one aggregated line; each flat panel adds its own
    expect(cuts.filter((l) => l.qty === 1)).toHaveLength(2);
  });
});
