import { describe, it, expect } from "vitest";
import { run } from "../../index";
import { build, CUBE_600, dims, origin } from "../../testkit";

const SHELF = {
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 300 },
} as const;

describe("DRAG", () => {
  it("[spec:W05] [rt:A1] ширина 600 → 800 при [1, fixed:300, 1]: постоянная держит 300, доли делят остаток, uid те же", () => {
    const s = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "x", gaps: [{ ratio: 1 }, { fixed: 300 }, { ratio: 1 }], member: "divider" });
    const r = run(s, { word: "DRAG", target: "unit", axis: "x", size: 800 });
    const b = r.session.state.evaluation.boxes;
    expect(dims(b.S3)[0]).toBe(300);
    expect(dims(b.S2)[0]).toBe(218); // 800 − 2×16 боковины − 2×16 перегородки − 300 = 436 → 218 + 218
    expect(dims(b.S4)[0]).toBe(218);
    expect(r.session.state.graph.order).toEqual(s.state.graph.order);
    const changed = r.result.changes.map((c) => c.id);
    expect(changed).toContain("P2");
    expect(changed).toContain("S2");
    expect(r.result.changes.every((c) => c.kind === "changed")).toBe(true);
  });

  it("[spec:W05] [rt:A2] модуль уже суммы постоянных ячеек — REF-NO-ROOM, граф тот же", () => {
    const s = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "x", gaps: [{ fixed: 300 }, { fixed: 252 }], member: "divider" });
    const r = run(s, { word: "DRAG", target: "unit", axis: "x", size: 500 });
    expect(r.result.findings[0]!.code).toBe("REF-NO-ROOM");
    expect(r.session).toBe(s);
  });

  it("[spec:W05] сдвиг полки on на +40", () => {
    const r = run(build(CUBE_600, SHELF), { word: "DRAG", target: "part", part: "P5", delta: 40 });
    expect(origin(r.session.state.evaluation.boxes.P5)[1]).toBe(356);
    expect(r.result.changes.map((c) => c.id)).toEqual(["P5"]);
  });

  it("[spec:W05] [spec:Q68] [rt:H1] сдвиг полки из паттерна отвязывает её: соседи стоят, паттерн делится", () => {
    const s = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }, { ratio: 1 }], member: "shelf" });
    const before = s.state.evaluation.boxes;
    const r = run(s, { word: "DRAG", target: "part", part: "P6", delta: 40 });
    expect(r.result.accepted).toBe(true);
    const g = r.session.state.graph;
    expect(g.nodes.A1).toBeUndefined();
    expect(g.order.filter((id) => g.nodes[id]!.kind === "pattern")).toEqual(["A2", "A3"]);
    const after = r.session.state.evaluation.boxes;
    expect(after.P6!.min.y).toBe(before.P6!.min.y + 400);   // сдвинулась только она, на 40 мм
    expect(after.P5!.min.y).toBe(before.P5!.min.y);
    expect(r.result.findings.filter((f) => f.severity === "refusal")).toEqual([]);
    expect(r.session.state.journal.at(-1)).toContain("отвязан");
  });

  it("[spec:W05] доску корпуса не двигают — REF-LOCKED с подсказкой", () => {
    const r = run(build(CUBE_600), { word: "DRAG", target: "part", part: "P1", delta: 10 });
    expect(r.result.findings[0]!.code).toBe("REF-LOCKED");
    expect(r.result.findings[0]!.text).toContain("габарит юнита");
  });

  it("[spec:W05] длина пролёта «от грани до грани» — REF-LOCKED; объявленная числом — меняется", () => {
    const s = build(CUBE_600, {
      word: "PLACE", host: "S1", type: "rail", spans: { x: "full", z: { from: { node: "S1", face: "front" }, offset: 0, size: 80 } },
      relation: { kind: "on", plane: { node: "S1", face: "top" }, side: "inside", offset: 0 },
    });
    expect(run(s, { word: "DRAG", target: "size", part: "P5", axis: "x", size: 300 }).result.findings[0]!.code).toBe("REF-LOCKED");
    const r = run(s, { word: "DRAG", target: "size", part: "P5", axis: "z", size: 100 });
    expect(dims(r.session.state.evaluation.boxes.P5)).toEqual([568, 16, 100]);
  });

  it("[spec:L1a] сдвиг в другую доску — REF-OVERLAP, граф тот же", () => {
    const s = build(CUBE_600, SHELF);
    const r = run(s, { word: "DRAG", target: "part", part: "P5", delta: -310 });
    expect(r.result.findings[0]!.code).toBe("REF-OVERLAP");
    expect(r.session).toBe(s);
  });

  it("[spec:U06] [rt:J8] сдвиг на 0.05 мм — REF-PRECISION, ничего не округлено", () => {
    const s = build(CUBE_600, SHELF);
    const r = run(s, { word: "DRAG", target: "part", part: "P5", delta: 0.05 });
    expect(r.result.findings[0]!.code).toBe("REF-PRECISION");
    expect(r.session).toBe(s);
  });
});
