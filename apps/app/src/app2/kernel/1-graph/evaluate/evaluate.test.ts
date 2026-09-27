import { describe, it, expect } from "vitest";
import { EMPTY_COUNTERS } from "../../0-base/ids/ids";
import { withNodes, type Graph, type Node } from "../model/model";
import { evaluate, extent, type Env } from "./evaluate";

// Вычисление на графе, собранном руками: без слов и без профиля (Env подставлен тестом).
const ENV: Env = {
  profileName: "test",
  residualPolicy: "leftmost-absorbs",
  thickness: (t) => (t.from === "declared" ? { mm10: t.mm10, from: "объявлено" } : { mm10: 160, from: "test" }),
  inset: () => ({ mm10: 0, from: "тест без отступов" }),
};

const M: Node = { kind: "unit", id: "U1", size: { x: 6000, y: 7200, z: 5600 }, profile: "test" };
const S: Node = {
  kind: "space", id: "S1", host: "U1",
  shape: { kind: "bounds", bounds: {
    left: { node: "U1", face: "left" }, right: { node: "U1", face: "right" }, bottom: { node: "U1", face: "bottom" },
    top: { node: "U1", face: "top" }, front: { node: "U1", face: "front" }, back: { node: "U1", face: "back" },
  } },
};
const graph = (...n: Node[]): Graph => withNodes({ nodes: {}, order: [], counters: EMPTY_COUNTERS }, n);

describe("evaluate", () => {
  it("[spec:O02] модуль — от 0 до габарита; пространство — по граням", () => {
    const ev = evaluate(graph(M, S), ENV);
    expect(extent(ev.boxes.S1!, "x")).toBe(6000);
    expect(ev.problems).toEqual([]);
  });

  it("[spec:U03] деление: сумма ячеек и досок точно равна хозяину", () => {
    const D: Node = {
      kind: "pattern", id: "A1", host: "S1", axis: "y", gaps: [{ kind: "ratio", weight: 1 }, { kind: "ratio", weight: 2 }, { kind: "flex" }],
      member: { type: "shelf", thickness: { from: "profile", key: "carcassThicknessMm" } }, gapIds: ["S2", "S3", "S4"], memberIds: [],
    };
    const cells: Node[] = [0, 1, 2].map((index) => ({ kind: "space", id: `S${index + 2}`, host: "S1", shape: { kind: "cell", division: "A1", index } }));
    const ev = evaluate(graph(M, S, D, ...cells), ENV);
    const total = ["S2", "S3", "S4"].reduce((a, id) => a + extent(ev.boxes[id]!, "y"), 0) + 2 * 160;
    expect(total).toBe(7200);
  });

  it("[spec:G16] висящая ссылка — REF-MISSING-REF, а не исключение", () => {
    const ev = evaluate(graph(M, { ...S, id: "S9", shape: { kind: "cell", division: "A404", index: 0 } } as Node), ENV);
    expect(ev.boxes.S9).toBeUndefined();
  });

  it("[spec:G13] ячейка записывает, из какой доли она получилась", () => {
    const D: Node = {
      kind: "pattern", id: "A1", host: "S1", axis: "x", gaps: [{ kind: "fixed", size: 2000 }, { kind: "ratio", weight: 1 }],
      member: null, gapIds: ["S2", "S3"], memberIds: [],
    };
    const cells: Node[] = [0, 1].map((index) => ({ kind: "space", id: `S${index + 2}`, host: "S1", shape: { kind: "cell", division: "A1", index } }));
    const ev = evaluate(graph(M, S, D, ...cells), ENV);
    expect(ev.trace.S2![0]!.from).toBe("постоянная, объявлена");
    expect(ev.trace.S3![0]!.from).toContain("доля 1 из 1");
  });
});
