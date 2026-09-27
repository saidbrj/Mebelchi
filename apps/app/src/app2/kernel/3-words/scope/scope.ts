// SCOPE (SPEC W10, E11, R50–R53): «применить к…». Цель разрешается ОДИН РАЗ в список uid,
// изменение записывается вместе с целями и потом само не оживает.
import { allocate } from "../../0-base/ids/ids";
import { finding, ok, refuse, type Outcome } from "../../0-base/findings/findings";
import {
  partsOf, withNodes, type Graph, type GroupNode, type JointNode, type Node, type PartNode,
} from "../../1-graph/model/model";
import type { Draft } from "../../1-graph/transaction/transaction";
import { methodFor } from "../../2-settings/types/types";
import type { Word } from "../word/word";

/** Кому применить. Условие разрешается в момент команды, живых правил нет (R52). */
export type ScopeTarget =
  | { kind: "part"; id: string }
  | { kind: "type"; type: string }
  | { kind: "group"; id: string }
  | { kind: "unit" }
  | { kind: "joint"; joint: [string, string] };

export type ScopeCommand =
  | { target: ScopeTarget; key: "slot"; value: string }
  | { target: { kind: "joint"; joint: [string, string] }; key: "method" | "through"; value: string };

const named = (t: ScopeTarget): string =>
  t.kind === "part" ? t.id
    : t.kind === "type" ? `все детали типа «${t.type}»`
      : t.kind === "group" ? `группа ${t.id}`
        : t.kind === "unit" ? "весь юнит"
          : `стык ${[...t.joint].sort().join("×")}`;

/** Разрешение цели в список деталей (R50): условие превращается в uid и записывается. */
function resolve(g: Graph, t: ScopeTarget): Outcome<PartNode[]> {
  if (t.kind === "part") {
    const n = g.nodes[t.id];
    return n && n.kind === "part" ? ok([n]) : refuse(finding("REF-MISSING-REF", [t.id], `детали ${t.id} нет`));
  }
  if (t.kind === "type") {
    const found = partsOf(g).filter((p) => p.type === t.type);
    return found.length ? ok(found) : refuse(finding("REF-MISSING-REF", [], `деталей типа «${t.type}» нет`));
  }
  if (t.kind === "group") {
    const n = g.nodes[t.id];
    if (!n || n.kind !== "group") return refuse(finding("REF-MISSING-REF", [t.id], `группы ${t.id} нет`));
    const parts = (n as GroupNode).members.map((id) => g.nodes[id]).filter((x): x is PartNode => x?.kind === "part");
    return parts.length ? ok(parts) : refuse(finding("REF-AMBIGUOUS", [t.id], `в группе ${t.id} нет деталей`));
  }
  if (t.kind === "unit") {
    const all = partsOf(g);
    return all.length ? ok(all) : refuse(finding("REF-MISSING-REF", [], "в юните нет деталей"));
  }
  return refuse(finding("REF-AMBIGUOUS", [], "у стыка меняют способ или сквозную деталь, а не слот"));
}

export const scope: Word<ScopeCommand> = (g, cmd) => {
  if (cmd.key === "slot") return applySlot(g, cmd.target, cmd.value);
  return applyJoint(g, cmd.target.joint, cmd.key, cmd.value);
};

function applySlot(g: Graph, target: ScopeTarget, slot: string): Outcome<Draft> {
  const found = resolve(g, target);
  if (!found.ok) return found;
  const changed = found.value.filter((p) => p.slot !== slot);
  const put: Node[] = changed.map((p) => ({ ...p, slot }));
  return ok({
    graph: withNodes(g, put),
    declares: { parts: 0 },
    summary: `SCOPE ${named(target)}: слот ${slot} → ${changed.length ? changed.map((p) => p.id).join(", ") : "уже был"}`,
  });
}

function applyJoint(g: Graph, joint: [string, string], key: "method" | "through", value: string): Outcome<Draft> {
  const [a, b] = joint;
  for (const id of [a, b]) {
    const n = g.nodes[id];
    if (!n || n.kind !== "part") return refuse(finding("REF-MISSING-REF", [id], `детали ${id} нет`));
  }
  if (key === "through" && !joint.includes(value)) {
    return refuse(finding("REF-AMBIGUOUS", [...joint], `сквозной может быть только ${a} или ${b}`));
  }
  const pair = [a, b].sort() as [string, string];
  const existing = g.order
    .map((id) => g.nodes[id]!)
    .find((n): n is JointNode => n.kind === "joint" && n.pair[0] === pair[0] && n.pair[1] === pair[1]);
  const label = `SCOPE стык ${pair.join("×")}: ${key === "method" ? "способ" : "насквозь"} ${value}`;

  // значение, равное заводскому, — это не исключение: переопределение снимается (E17)
  if (key === "method" && value === methodFor((g.nodes[a] as PartNode).type, (g.nodes[b] as PartNode).type)) {
    const rest = existing && existing.through ? [{ ...existing, method: undefined }] : [];
    return ok({
      graph: existing ? withNodes(g, rest, rest.length ? [] : [existing.id]) : g,
      declares: { parts: 0 },
      summary: `${label} — как в профиле`,
    });
  }
  const patch = key === "method" ? { method: value } : { through: value };
  if (existing) {
    return ok({ graph: withNodes(g, [{ ...existing, ...patch }]), declares: { parts: 0 }, summary: label });
  }
  const [id, counters] = allocate(g.counters, "J");
  const node: JointNode = { kind: "joint", id, pair, ...patch };
  return ok({ graph: withNodes(g, [node], [], counters), declares: { parts: 0 }, summary: label });
}
