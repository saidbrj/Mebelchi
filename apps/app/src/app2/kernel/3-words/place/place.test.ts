import { describe, it, expect } from "vitest";
import { run } from "../../index";
import { build, CUBE_600, dims, origin } from "../../testkit";

const SHELF_300 = {
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 300 },
} as const;

describe("PLACE", () => {
  it("[spec:W06] [spec:R24] полка on S1.bottom inside +300: 568×16×538 — отступы типа из профиля", () => {
    const { state } = build(CUBE_600, SHELF_300);
    expect(dims(state.evaluation.boxes.P5)).toEqual([568, 16, 538]); // 560 − 20 спереди − 2 сзади
    expect(origin(state.evaluation.boxes.P5)).toEqual([16, 316, 20]);
  });

  it("[spec:W06] on верхней грани inside растёт вниз", () => {
    const { state } = build(CUBE_600, { ...SHELF_300, relation: { kind: "on", plane: { node: "S1", face: "top" }, side: "inside", offset: 100 } });
    expect(origin(state.evaluation.boxes.P5)[1]).toBe(704 - 100 - 16);
  });

  it("[spec:W06] against грани доски: толщина растёт от неё; объявленная толщина главнее", () => {
    const { state } = build(CUBE_600, {
      word: "PLACE", host: "S1", type: "spacer", thickness: 25, spans: { y: "full", z: "full" },
      relation: { kind: "against", plane: { node: "P1", face: "right" } },
    });
    expect(dims(state.evaluation.boxes.P5)).toEqual([25, 688, 560]);
    expect(origin(state.evaluation.boxes.P5)[0]).toBe(16);
  });

  it("[spec:W06] [rt:J4] on без inside|outside — REF-AMBIGUOUS, граф тот же", () => {
    const s = build(CUBE_600);
    const r = run(s, { ...SHELF_300, relation: { kind: "on", plane: { node: "S1", face: "bottom" }, offset: 300 } });
    expect(r.result.findings[0]!.code).toBe("REF-AMBIGUOUS");
    expect(r.session).toBe(s);
  });

  it("[spec:W06] без пролёта по одной оси — REF-AMBIGUOUS", () => {
    const r = run(build(CUBE_600), { ...SHELF_300, spans: { x: "full" } });
    expect(r.result.findings[0]!.code).toBe("REF-AMBIGUOUS");
  });

  it("[spec:L1a] вторая полка в то же место — REF-OVERLAP, не создана", () => {
    const s = build(CUBE_600, SHELF_300);
    const r = run(s, SHELF_300);
    expect(r.result.findings[0]!.code).toBe("REF-OVERLAP");
    expect(r.result.findings[0]!.nodes).toEqual(["P5", "P6"]);
    expect(r.session).toBe(s);
  });

  it("[spec:W06] деталь может выйти за пространство (боковина до пола наружу)", () => {
    const r = run(build(CUBE_600), {
      word: "PLACE", host: "S1", type: "side", spans: { y: { from: { node: "U1", face: "bottom" }, offset: -100, size: 820 }, z: "full" },
      relation: { kind: "against", plane: { node: "P1", face: "left" } },
    });
    expect(r.result.accepted).toBe(true);
    expect(origin(r.session.state.evaluation.boxes.P5)).toEqual([-16, -100, 0]);
  });
});
