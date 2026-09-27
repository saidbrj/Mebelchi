// REPLACE (SPEC W11): убрать деталь. Зависимые не удаляются каскадом, пространства переезжают.
import { finding, ok, refuse } from "../../0-base/findings/findings";
import {
  FACE, dependentsOf, withNodes, type Node, type PartNode, type PlaneRef, type SpaceNode,
} from "../../1-graph/model/model";
import type { Word } from "../word/word";

export interface ReplaceCommand {
  part: string;
  with: "nothing";
}

export const replace: Word<ReplaceCommand> = (g, cmd) => {
  const p = g.nodes[cmd.part];
  if (!p || p.kind !== "part") return refuse(finding("REF-MISSING-REF", [cmd.part], `детали ${cmd.part} нет`));
  if (p.position.kind === "member") {
    return refuse(finding("REF-AMBIGUOUS", [p.id], "это деталь паттерна", ["убрать её операцией паттерна"]));
  }

  // пространства не зависимые: их грань переезжает на грань хозяина (G16)
  const moved: Node[] = [];
  const stuck: string[] = [];
  for (const id of dependentsOf(g, cmd.part)) {
    const n = g.nodes[id]!;
    if (n.kind === "space" && n.shape.kind === "bounds") {
      const bounds = { ...n.shape.bounds };
      for (const [face, ref] of Object.entries(bounds) as [keyof typeof FACE, PlaneRef][]) {
        if (ref.node === cmd.part) bounds[face] = { node: n.host ?? ref.node, face };
      }
      moved.push({ ...n, shape: { kind: "bounds", bounds } } as SpaceNode);
      continue;
    }
    stuck.push(id);
  }
  if (stuck.length) {
    return refuse(finding("REF-HAS-DEPENDENTS", stuck, `на ${cmd.part} ссылаются: ${stuck.join(", ")}`,
      stuck.map((d) => `сначала убрать или перенести ${d}`)));
  }
  return ok({
    graph: withNodes(g, moved, [cmd.part]),
    declares: { parts: -1 },
    summary: `REPLACE ${cmd.part} → ничего`,
  });
};
