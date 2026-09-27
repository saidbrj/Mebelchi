import { describe, it, expect } from "vitest";
import { EMPTY_COUNTERS } from "../../0-base/ids/ids";
import { dependentsOf, withNodes, type Graph, type Node } from "./model";

const EMPTY: Graph = { nodes: {}, order: [], counters: EMPTY_COUNTERS };
const mod: Node = { kind: "unit", id: "U1", size: { x: 6000, y: 7200, z: 5600 }, profile: "qorasu" };
const side: Node = {
  kind: "part", id: "P1", type: "side", host: "U1", origin: "cube",
  thickness: { from: "profile", key: "carcassThicknessMm" }, normal: "x",
  position: { kind: "plane", relation: "frame", plane: { node: "U1", face: "left" }, dir: 1, offset: 0 },
  spans: {
    y: { kind: "between", from: { node: "U1", face: "bottom" }, to: { node: "U1", face: "top" } },
    z: { kind: "between", from: { node: "U1", face: "front" }, to: { node: "U1", face: "back" } },
  },
};

describe("model", () => {
  it("[spec:G01] граф не мутируется: withNodes возвращает новый", () => {
    const g = withNodes(EMPTY, [mod]);
    expect(EMPTY.order).toEqual([]);
    expect(g.order).toEqual(["U1"]);
  });

  it("[spec:G16] зависимые — те, кто ссылается", () => {
    const g = withNodes(withNodes(EMPTY, [mod]), [side]);
    expect(dependentsOf(g, "U1")).toEqual(["P1"]);
    expect(dependentsOf(g, "P1")).toEqual([]);
  });

  it("[spec:G17] порядок создания сохраняется при замене узла", () => {
    const g = withNodes(withNodes(EMPTY, [mod]), [side]);
    const g2 = withNodes(g, [{ ...mod, size: { x: 8000, y: 7200, z: 5600 } } as Node]);
    expect(g2.order).toEqual(["U1", "P1"]);
  });
});
