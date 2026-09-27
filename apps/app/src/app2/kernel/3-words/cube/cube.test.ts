import { describe, it, expect } from "vitest";
import { run, start } from "../../index";
import { build, CUBE_600, dims } from "../../testkit";

describe("CUBE", () => {
  it("[spec:W03] 600×720×560 → боковины 16×720×560, дно и крышка 568 между ними, пространство 568×688×560", () => {
    const { state } = build(CUBE_600);
    const b = state.evaluation.boxes;
    expect(state.graph.order).toEqual(["U1", "P1", "P2", "P3", "P4", "S1"]);
    expect(dims(b.P1)).toEqual([16, 720, 560]);
    expect(dims(b.P2)).toEqual([16, 720, 560]);
    expect(dims(b.P3)).toEqual([568, 16, 560]);
    expect(dims(b.P4)).toEqual([568, 16, 560]);
    expect(dims(b.S1)).toEqual([568, 688, 560]);
  });

  it("[spec:G13] толщина каждой доски знает, откуда она", () => {
    const { state } = build(CUBE_600);
    expect(state.evaluation.trace.P1![0]!.from).toBe("profile:qorasu carcassThicknessMm = 16 мм");
  });

  it("[spec:P08] второй CUBE — это App 1", () => {
    const r = run(build(CUBE_600), CUBE_600);
    expect(r.result.accepted).toBe(false);
    expect(r.result.findings[0]!.code).toBe("REF-OUT-OF-SCOPE-APP1");
  });

  it("[spec:L5] габарит меньше minCarcassMm отказан", () => {
    const r = run(start(), { word: "CUBE", w: 100, h: 720, d: 560 });
    expect(r.result.findings[0]!.code).toBe("REF-TOO-SMALL");
  });
});
