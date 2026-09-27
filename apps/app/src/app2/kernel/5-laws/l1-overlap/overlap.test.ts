import { describe, it, expect } from "vitest";
import { overlap } from "./overlap";
import { build, CUBE_600 } from "../../testkit";

describe("L1a overlap", () => {
  it("[law:L1a] доски корпуса касаются, но не пересекаются", () => {
    const { state } = build(CUBE_600);
    expect(overlap(state.graph, state.evaluation)).toEqual([]);
  });

  it("[law:L1a] полка, касающаяся дна, законна", () => {
    const { state } = build(CUBE_600, {
      word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
      relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 0 },
    });
    expect(overlap(state.graph, state.evaluation)).toEqual([]);
  });
});
