import { describe, it, expect } from "vitest";
import { run } from "../../index";
import { build, CUBE_600, dims } from "../../testkit";
import type { Command } from "../../index";

const SHELF: Command = {
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 300 },
};
/** Доска, положенная прямо на полку: она на полку и опирается. */
const ON_SHELF: Command = {
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "against", plane: { node: "P5", face: "top" } },
};

describe("REPLACE → ничего [spec:W11]", () => {
  it("[spec:W11] свободная деталь убирается", () => {
    const s = build(CUBE_600, SHELF);
    const r = run(s, { word: "REPLACE", part: "P5", with: "nothing" });
    expect(r.result.accepted).toBe(true);
    expect(r.session.state.graph.nodes.P5).toBeUndefined();
    expect(r.result.changes.some((c) => c.kind === "removed" && c.id === "P5")).toBe(true);
  });

  it("[spec:G16] [spec:R14] на деталь опираются — отказ со списком, каскада нет", () => {
    const s = build(CUBE_600, SHELF, ON_SHELF);
    const r = run(s, { word: "REPLACE", part: "P5", with: "nothing" });
    expect(r.result.findings[0]!.code).toBe("REF-HAS-DEPENDENTS");
    expect(r.result.findings[0]!.nodes).toEqual(["P6"]);
    expect(r.session).toBe(s);
  });

  it("[spec:G16] убрали дно — получился стол: пространство доехало до габарита", () => {
    const s = build(CUBE_600);
    expect(dims(s.state.evaluation.boxes.S1)).toEqual([568, 688, 560]);
    const r = run(s, { word: "REPLACE", part: "P3", with: "nothing" });
    expect(r.result.accepted).toBe(true);
    expect(dims(r.session.state.evaluation.boxes.S1)).toEqual([568, 704, 560]);
    expect(r.result.changes.some((c) => c.id === "S1" && c.kind === "changed")).toBe(true);
  });

  it("[spec:W11] деталь паттерна убирают операцией паттерна", () => {
    const s = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }], member: "shelf" });
    const r = run(s, { word: "REPLACE", part: "P5", with: "nothing" });
    expect(r.result.findings[0]!.code).toBe("REF-AMBIGUOUS");
    expect(r.result.findings[0]!.options).toContain("убрать её операцией паттерна");
  });
});
