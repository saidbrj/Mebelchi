// GROUP (SPEC E10, W08): список узлов для совместного управления. Ничем не владеет.
import { allocate } from "../../0-base/ids/ids";
import { finding, ok, refuse } from "../../0-base/findings/findings";
import { withNodes, type GroupNode } from "../../1-graph/model/model";
import type { Word } from "../word/word";

export type GroupCommand =
  | { op: "create"; members: string[]; name?: string }
  | { op: "add"; group: string; member: string }
  | { op: "remove"; group: string; member: string }
  | { op: "ungroup"; group: string };

export const group: Word<GroupCommand> = (g, cmd) => {
  if (cmd.op === "create") {
    if (cmd.members.length === 0) return refuse(finding("REF-AMBIGUOUS", [], "в группе должен быть хотя бы один узел"));
    const missing = cmd.members.filter((id) => !g.nodes[id]);
    if (missing.length) return refuse(finding("REF-MISSING-REF", missing, `нет: ${missing.join(", ")}`));
    const [id, counters] = allocate(g.counters, "G");
    const node: GroupNode = { kind: "group", id, name: cmd.name ?? id, members: [...new Set(cmd.members)] };
    return ok({
      graph: withNodes(g, [node], [], counters),
      declares: { parts: 0 },
      summary: `GROUP ${node.name}: ${node.members.join(", ")}`,
    });
  }

  const node = g.nodes[cmd.group];
  if (!node || node.kind !== "group") return refuse(finding("REF-MISSING-REF", [cmd.group], `группы ${cmd.group} нет`));

  if (cmd.op === "ungroup") {
    return ok({ graph: withNodes(g, [], [node.id]), declares: { parts: 0 }, summary: `GROUP ${node.name} распущена` });
  }
  if (cmd.op === "add") {
    if (!g.nodes[cmd.member]) return refuse(finding("REF-MISSING-REF", [cmd.member], `узла ${cmd.member} нет`));
    if (node.members.includes(cmd.member)) {
      return refuse(finding("REF-AMBIGUOUS", [cmd.member], `${cmd.member} уже в группе ${node.name}`));
    }
    return ok({
      graph: withNodes(g, [{ ...node, members: [...node.members, cmd.member] }]),
      declares: { parts: 0 },
      summary: `GROUP ${node.name}: добавлен ${cmd.member}`,
    });
  }
  if (!node.members.includes(cmd.member)) {
    return refuse(finding("REF-MISSING-REF", [cmd.member], `${cmd.member} не в группе ${node.name}`));
  }
  return ok({
    graph: withNodes(g, [{ ...node, members: node.members.filter((m) => m !== cmd.member) }]),
    declares: { parts: 0 },
    summary: `GROUP ${node.name}: убран ${cmd.member}`,
  });
};
