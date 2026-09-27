import { describe, it, expect } from "vitest";
import { run } from "../../index";
import { build, CUBE_600 } from "../../testkit";
import type { Command } from "../../index";

const SHELF = (offset: number): Command => ({
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset },
});

describe("GROUP [spec:E10]", () => {
  it("[spec:W08] группа собирается из выбранных узлов и ничего не меняет в геометрии", () => {
    const s = build(CUBE_600, SHELF(200), SHELF(400));
    const before = JSON.stringify(s.state.evaluation.boxes);
    const r = run(s, { word: "GROUP", op: "create", members: ["P5", "P6"], name: "две полки" });
    expect(r.result.accepted).toBe(true);
    const g = r.session.state.graph.nodes.G1;
    expect(g?.kind === "group" && g.members).toEqual(["P5", "P6"]);
    expect(JSON.stringify(r.session.state.evaluation.boxes)).toBe(before);
    expect(r.result.changes.filter((c) => c.kind === "changed")).toEqual([]);
  });

  it("[spec:R13] [spec:Z10] распустить группу — значит забыть список; узлы остаются", () => {
    const s = run(build(CUBE_600, SHELF(200), SHELF(400)), { word: "GROUP", op: "create", members: ["P5", "P6"] }).session;
    const r = run(s, { word: "GROUP", op: "ungroup", group: "G1" });
    expect(r.session.state.graph.nodes.G1).toBeUndefined();
    expect(r.session.state.graph.nodes.P5).toBeDefined();
    expect(r.session.state.graph.nodes.P6).toBeDefined();
  });

  it("[spec:W08] в группу добавляют и убирают по одному; дважды один и тот же — отказ", () => {
    const s = run(build(CUBE_600, SHELF(200), SHELF(400)), { word: "GROUP", op: "create", members: ["P5"] }).session;
    const added = run(s, { word: "GROUP", op: "add", group: "G1", member: "P6" });
    expect((added.session.state.graph.nodes.G1 as { members: string[] }).members).toEqual(["P5", "P6"]);
    expect(run(added.session, { word: "GROUP", op: "add", group: "G1", member: "P6" }).result.findings[0]!.code).toBe("REF-AMBIGUOUS");
    const removed = run(added.session, { word: "GROUP", op: "remove", group: "G1", member: "P5" });
    expect((removed.session.state.graph.nodes.G1 as { members: string[] }).members).toEqual(["P6"]);
  });

  it("[spec:W08] узла нет — отказ, граф тот же", () => {
    const s = build(CUBE_600);
    const r = run(s, { word: "GROUP", op: "create", members: ["P404"] });
    expect(r.result.findings[0]!.code).toBe("REF-MISSING-REF");
    expect(r.session).toBe(s);
  });
});
