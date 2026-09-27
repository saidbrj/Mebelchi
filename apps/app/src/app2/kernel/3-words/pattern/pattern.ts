// PATTERN (SPEC E08, R04): пять операций, каждая называет место, а не порядковый номер.
import { allocate, allocateMany } from "../../0-base/ids/ids";
import { finding, ok, refuse, type Outcome } from "../../0-base/findings/findings";
import { toMm, type Mm10 } from "../../0-base/units/units";
import { extent, type Evaluation } from "../../1-graph/evaluate/evaluate";
import {
  AXES, FACE, dependentsOf, facesOf, type Face, withNodes, type Axis, type CellRule, type Graph, type Node,
  type PartNode, type PatternNode, type PlaneRef, type SpaceNode,
} from "../../1-graph/model/model";
import type { Draft } from "../../1-graph/transaction/transaction";
import { fullSpan, type Word } from "../word/word";

export type PatternCommand =
  | {
      op: "create"; space: string; axis: Axis; gaps: CellRule[]; member: string | null;
      /** фасадный паттерн: ячейки заполняются деталями на этой грани (Q20, Q70) */
      fill?: { type: string; face: Face };
    }
  | { op: "ratio"; pattern: string; gaps: CellRule[] }
  | { op: "insert"; gap: string }
  | { op: "remove"; member: string }
  | { op: "detach"; member: string }
  | { op: "move"; member: string; delta: Mm10 }
  | { op: "release"; pattern: string }
  | { op: "dissolve"; pattern: string };

const CARCASS = { from: "profile", key: "carcassThicknessMm" } as const;
/** Зазор между фасадами и поле по краю — значения профиля цеха (Q20), а не числа в коде. */
const FRONT_GAP = { from: "profile", key: "fill:frontGapMm" } as const;
const FRONT_MARGIN = { from: "profile", key: "fill:frontEdgeMarginMm" } as const;

const patternOf = (g: Graph, id: string): PatternNode | undefined =>
  g.order.map((i) => g.nodes[i]!).find((n): n is PatternNode => n.kind === "pattern" && (n.id === id || n.host === id));

const owningPattern = (g: Graph, nodeId: string): PatternNode | undefined =>
  g.order.map((i) => g.nodes[i]!).find(
    (n): n is PatternNode => n.kind === "pattern" && (n.gapIds.includes(nodeId) || n.memberIds.includes(nodeId)),
  );

const orphan = (nodes: string[], what: string) =>
  refuse<Draft>(finding("REF-ORPHAN", nodes, `${what}: ${nodes.join(", ")}`, nodes.map((n) => `сначала убрать или перенести ${n}`)));

/** Что мешает убрать узлы: их зависимые, кроме самих уходящих и паттерна. */
function blockers(g: Graph, leaving: string[], pattern: string): string[] {
  const gone = new Set([...leaving, pattern]);
  return [...new Set(leaving.flatMap((id) => dependentsOf(g, id)))].filter((d) => !gone.has(d));
}

const share = (c: CellRule): number => (c.kind === "ratio" ? c.weight : c.kind === "flex" ? 1 : 0);

/** Половинки правила промежутка при вставке: доля делится пополам, постоянный размер — тоже. */
function halves(c: CellRule, thickness: Mm10): [CellRule, CellRule] {
  if (c.kind === "fixed") {
    const each = Math.floor((c.size - thickness) / 2);
    return [{ kind: "fixed", size: each }, { kind: "fixed", size: c.size - thickness - each }];
  }
  const w = share(c) / 2;
  return [{ kind: "ratio", weight: w }, { kind: "ratio", weight: w }];
}

/** Правило слитого промежутка: доли складываются, постоянные — тоже, вместе с толщиной участника. */
function merged(a: CellRule, b: CellRule, thickness: Mm10, sizeA: Mm10, sizeB: Mm10): CellRule {
  if (a.kind === "fixed" && b.kind === "fixed") return { kind: "fixed", size: a.size + thickness + b.size };
  if (share(a) > 0 && share(b) > 0) return { kind: "ratio", weight: share(a) + share(b) };
  return { kind: "fixed", size: sizeA + thickness + sizeB };
}

const spaceOfGap = (id: string, pattern: string, index: number): SpaceNode => ({
  kind: "space", id, host: "", shape: { kind: "cell", division: pattern, index },
});

export const pattern: Word<PatternCommand> = (g, cmd, ctx) => {
  switch (cmd.op) {
    case "create": return create(g, cmd);
    case "ratio": return ratio(g, cmd);
    case "insert": return insert(g, cmd, ctx.evaluation);
    case "remove": return remove(g, cmd, ctx.evaluation);
    case "detach": return detach(g, cmd, ctx.evaluation);
    case "move": return move(g, cmd, ctx.evaluation);
    case "release": return release(g, cmd, ctx.evaluation);
    case "dissolve": return dissolve(g, cmd);
  }
};

function create(g: Graph, cmd: Extract<PatternCommand, { op: "create" }>): Outcome<Draft> {
  const host = g.nodes[cmd.space];
  // фасад закрывает ЮНИТ снаружи, поэтому его хозяин — юнит; доски делят пространство внутри
  const hostOk = cmd.fill ? host && (host.kind === "space" || host.kind === "unit") : host && host.kind === "space";
  if (!host || !hostOk) return refuse(finding("REF-MISSING-REF", [cmd.space], `узла ${cmd.space} нет или он не может быть хозяином`));
  if (patternOf(g, cmd.space)) return refuse(finding("REF-AMBIGUOUS", [cmd.space], `${cmd.space} уже поделено; меняйте доли или вставляйте участника`));
  const bad = cmd.gaps.find((c) => (c.kind === "ratio" && !(c.weight > 0)) || (c.kind === "fixed" && !(c.size > 0)));
  const least = cmd.fill ? 1 : 2;                      // одна створка — законный фасад
  if (cmd.gaps.length < least || bad) {
    return refuse(finding("REF-AMBIGUOUS", [cmd.space], `нужно хотя бы ${least} ячеек, и каждая больше нуля`));
  }
  if (!cmd.fill) {
    const inside = dependentsOf(g, cmd.space);
    if (inside.length) return orphan(inside, `${cmd.space} уже занято`);
  }

  const [[id], c1] = allocateMany(g.counters, "A", 1);
  // у фасадного паттерна ячейка — это сам фасад, отдельных пространств не появляется
  const [gapIds, c2] = allocateMany(c1, "S", cmd.fill ? 0 : cmd.gaps.length);
  const parts = cmd.fill ? cmd.gaps.length : cmd.member ? cmd.gaps.length - 1 : 0;
  const [memberIds, counters] = allocateMany(c2, "P", parts);
  const node: PatternNode = {
    kind: "pattern", id: id!, host: cmd.space, axis: cmd.axis, gaps: cmd.gaps.map((c) => ({ ...c })),
    member: cmd.member && !cmd.fill ? { type: cmd.member, thickness: CARCASS } : null, gapIds, memberIds,
    ...(cmd.fill
      ? { fill: { type: cmd.fill.type, face: cmd.fill.face, thickness: CARCASS, spacing: FRONT_GAP, margin: FRONT_MARGIN } }
      : {}),
  };
  const rule = cmd.gaps.map((c) => (c.kind === "fixed" ? `${toMm(c.size)}` : c.kind === "flex" ? "flex" : `${c.weight}`)).join(":");
  return ok({
    graph: withNodes(g, [node, ...nodesOf(node, cmd.space)], [], counters),
    declares: { parts: memberIds.length },
    summary: `PATTERN ${cmd.space} по ${cmd.axis} [${rule}]${cmd.member ? ` · ${cmd.member}` : ""}`,
  });
}

/** Узлы промежутков и участников по текущему состоянию паттерна. */
function nodesOf(p: PatternNode, host: string): Node[] {
  const others = AXES.filter((a) => a !== p.axis);
  const gaps = p.gapIds.map((id, index): SpaceNode => ({ ...spaceOfGap(id, p.id, index), host }));
  if (p.fill) {
    // фасад заполняет ячейку: его геометрию считает сама раскладка паттерна, пролётов у него нет
    return [
      ...gaps,
      ...p.memberIds.map((id, index): PartNode => ({
        kind: "part", id, type: p.fill!.type, host, origin: "place", thickness: p.fill!.thickness,
        normal: FACE[p.fill!.face].axis, position: { kind: "fill", pattern: p.id, index }, spans: {},
      })),
    ];
  }
  return [
    ...gaps,
    ...p.memberIds.map((id, index): PartNode => ({
      kind: "part", id, type: p.member!.type, host, origin: "split", thickness: p.member!.thickness, normal: p.axis,
      position: { kind: "member", division: p.id, index },
      spans: Object.fromEntries(others.map((a) => [a, fullSpan(host, a)])),
    })),
  ];
}

function ratio(g: Graph, cmd: Extract<PatternCommand, { op: "ratio" }>): Outcome<Draft> {
  const p = g.nodes[cmd.pattern];
  if (!p || p.kind !== "pattern") return refuse(finding("REF-MISSING-REF", [cmd.pattern], `паттерна ${cmd.pattern} нет`));
  if (cmd.gaps.length !== p.gaps.length) {
    // у фасада ячейка ничего не держит, поэтому число створок меняется долями (R04 про содержимое)
    if (!p.fill) {
      return refuse(finding("REF-AMBIGUOUS", [p.id],
        `долями количество не меняют: сейчас промежутков ${p.gaps.length}, прислано ${cmd.gaps.length}`,
        ["вставить участника", "убрать участника"]));
    }
    const keep = Math.min(p.memberIds.length, cmd.gaps.length);
    const [fresh, counters] = allocateMany(g.counters, "P", cmd.gaps.length - keep);
    const memberIds = [...p.memberIds.slice(0, keep), ...fresh];
    const gone = p.memberIds.slice(keep);
    const next: PatternNode = { ...p, gaps: cmd.gaps.map((c) => ({ ...c })), memberIds };
    return ok({
      graph: withNodes(g, [next, ...nodesOf(next, p.host)], gone, counters),
      declares: { parts: memberIds.length - p.memberIds.length },
      summary: `PATTERN ${p.id}: створок ${memberIds.length}`,
    });
  }
  return ok({
    graph: withNodes(g, [{ ...p, gaps: cmd.gaps.map((c) => ({ ...c })) }]),
    declares: { parts: 0 },
    summary: `PATTERN ${p.id} доли изменены`,
  });
}

function insert(g: Graph, cmd: Extract<PatternCommand, { op: "insert" }>, ev: Evaluation): Outcome<Draft> {
  const p = owningPattern(g, cmd.gap);
  if (!p || !p.gapIds.includes(cmd.gap)) return refuse(finding("REF-MISSING-REF", [cmd.gap], `${cmd.gap} — не промежуток паттерна`));
  if (!p.member) return refuse(finding("REF-AMBIGUOUS", [p.id], "в этом паттерне нет участников; создайте паттерн с деталью"));
  const at = p.gapIds.indexOf(cmd.gap);
  const box = ev.boxes[cmd.gap];
  const thickness = box ? Math.min(extent(box, p.axis), thicknessOf(p, ev)) : thicknessOf(p, ev);

  const [[gap], c1] = allocateMany(g.counters, "S", 1);
  const [[member], counters] = allocateMany(c1, "P", 1);
  const [lower, upper] = halves(p.gaps[at]!, thickness);
  const gaps = [...p.gaps]; gaps.splice(at, 1, lower, upper);
  const gapIds = [...p.gapIds]; gapIds.splice(at + 1, 0, gap!);
  const memberIds = [...p.memberIds]; memberIds.splice(at, 0, member!);
  const next: PatternNode = { ...p, gaps, gapIds, memberIds };
  return ok({
    graph: withNodes(g, [next, ...nodesOf(next, p.host)], [], counters),
    declares: { parts: 1 },
    summary: `PATTERN ${p.id}: участник ${member} внутри ${cmd.gap}, новый промежуток ${gap}`,
  });
}

function thicknessOf(p: PatternNode, ev: Evaluation): Mm10 {
  const first = p.memberIds[0];
  const box = first ? ev.boxes[first] : undefined;
  return box ? extent(box, p.axis) : 0;
}

function remove(g: Graph, cmd: Extract<PatternCommand, { op: "remove" }>, ev: Evaluation): Outcome<Draft> {
  const p = owningPattern(g, cmd.member);
  if (!p || !p.memberIds.includes(cmd.member)) return refuse(finding("REF-MISSING-REF", [cmd.member], `${cmd.member} — не участник паттерна`));
  const at = p.memberIds.indexOf(cmd.member);
  const keep = p.gapIds[at]!;
  const dying = p.gapIds[at + 1]!;
  const stuck = blockers(g, [cmd.member], p.id).filter((d) => d !== dying && d !== keep);
  if (stuck.length) return orphan(stuck, `на ${cmd.member} опирается`);

  const sizeA = ev.boxes[keep] ? extent(ev.boxes[keep]!, p.axis) : 0;
  const sizeB = ev.boxes[dying] ? extent(ev.boxes[dying]!, p.axis) : 0;
  const gaps = [...p.gaps];
  gaps.splice(at, 2, merged(p.gaps[at]!, p.gaps[at + 1]!, thicknessOf(p, ev), sizeA, sizeB));
  const gapIds = p.gapIds.filter((id) => id !== dying);
  const memberIds = p.memberIds.filter((id) => id !== cmd.member);
  const next: PatternNode = { ...p, gaps, gapIds, memberIds };

  const moved = rehost(g, ev, dying, keep, p.axis);
  return ok({
    graph: withNodes({ ...g, nodes: { ...g.nodes, ...moved } }, [next, ...nodesOf(next, p.host)], [dying, cmd.member], g.counters),
    declares: { parts: -1 },
    summary: `PATTERN ${p.id}: участник ${cmd.member} убран, промежутки ${keep} и ${dying} объединены в ${keep}`,
  });
}

/**
 * Переносит ссылки с исчезающего промежутка на слитый, **сохраняя место**: отступ поправлен на
 * разницу граней, а пролёт, опиравшийся на исчезнувшую грань, закреплён своим текущим числом (R04).
 */
function rehost(g: Graph, ev: Evaluation, dying: string, keep: string, axis: Axis): Record<string, Node> {
  const out: Record<string, Node> = {};
  const coord = (node: string, face: PlaneRef["face"]): Mm10 | undefined => {
    const b = ev.boxes[node];
    if (!b) return undefined;
    const f = FACE[face];
    return f.side < 0 ? b.min[f.axis] : b.max[f.axis];
  };
  for (const id of dependentsOf(g, dying)) {
    const n = g.nodes[id]!;
    if (n.kind !== "part") continue;
    let part: PartNode = { ...n, host: n.host === dying ? keep : n.host };
    if (part.position.kind === "plane" && part.position.plane.node === dying) {
      const face = part.position.plane.face;
      const from = coord(dying, face);
      const to = coord(keep, face);
      const shift = from !== undefined && to !== undefined ? (from - to) * part.position.dir : 0;
      part = { ...part, position: { ...part.position, plane: { node: keep, face }, offset: part.position.offset + shift } };
    }
    const spans = { ...part.spans };
    for (const a of AXES) {
      const s = spans[a];
      if (!s || s.kind !== "between") continue;
      if (s.from.node !== dying && s.to.node !== dying) continue;
      const box = ev.boxes[id];
      if (a === axis && box) {
        spans[a] = { kind: "sized", from: { node: keep, face: facesOf(a)[0] }, offset: box.min[a] - (coord(keep, facesOf(a)[0]) ?? box.min[a]), size: extent(box, a) };
      } else {
        spans[a] = { kind: "between", from: { ...s.from, node: s.from.node === dying ? keep : s.from.node }, to: { ...s.to, node: s.to.node === dying ? keep : s.to.node } };
      }
    }
    out[id] = { ...part, spans };
  }
  return out;
}

/** Деталь, снятая с управления паттерном: стоит на своём отступе от грани хозяина (R31). */
function standalone(p: PatternNode, part: PartNode, ev: Evaluation, host: string): PartNode {
  const [minFace] = facesOf(p.axis);
  const box = ev.boxes[part.id];
  const hostBox = ev.boxes[host];
  const offset = box && hostBox ? box.min[p.axis] - hostBox.min[p.axis] : 0;
  return {
    ...part, host,
    position: { kind: "plane", relation: "on", plane: { node: host, face: minFace }, dir: 1, offset },
  };
}

/** Промежуток без паттерна: его границы — грани соседних деталей, а по краям грани хозяина. */
function boundedGap(id: string, host: string, axis: Axis, below: string | undefined, above: string | undefined): SpaceNode {
  const [minFace, maxFace] = facesOf(axis);
  const others = AXES.filter((a) => a !== axis);
  const bounds = {
    [minFace]: below ? { node: below, face: maxFace } : { node: host, face: minFace },
    [maxFace]: above ? { node: above, face: minFace } : { node: host, face: maxFace },
  } as Record<PlaneRef["face"], PlaneRef>;
  for (const a of others) {
    const [lo, hi] = facesOf(a);
    bounds[lo] = { node: host, face: lo };
    bounds[hi] = { node: host, face: hi };
  }
  return { kind: "space", id, host, shape: { kind: "bounds", bounds } };
}

/** Кусок паттерна после отвязки: либо снова паттерн в своей области, либо один обычный промежуток. */
function piece(
  g: Graph, p: PatternNode, gapIds: string[], memberIds: string[], rules: CellRule[],
  region: { id: string; below?: string; above?: string }, counters: typeof g.counters,
): { nodes: Node[]; counters: typeof g.counters } {
  if (gapIds.length === 1) {
    return { nodes: [boundedGap(gapIds[0]!, p.host, p.axis, region.below, region.above)], counters };
  }
  const [[id], next] = allocateMany(counters, "A", 1);
  const space = boundedGap(region.id, p.host, p.axis, region.below, region.above);
  const node: PatternNode = { ...p, id: id!, host: region.id, gaps: rules, gapIds, memberIds };
  return { nodes: [space, node, ...nodesOf(node, region.id)], counters: next };
}

/** Отвязать один: паттерн делится на два, остальные не двигаются (Q68, Z04). */
function detach(g: Graph, cmd: Extract<PatternCommand, { op: "detach" }>, ev: Evaluation): Outcome<Draft> {
  const p = owningPattern(g, cmd.member);
  if (!p || !p.memberIds.includes(cmd.member)) return refuse(finding("REF-MISSING-REF", [cmd.member], `${cmd.member} — не участник паттерна`));
  const at = p.memberIds.indexOf(cmd.member);
  const part = g.nodes[cmd.member] as PartNode;

  const lowGaps = p.gapIds.slice(0, at + 1);
  const lowMembers = p.memberIds.slice(0, at);
  const highGaps = p.gapIds.slice(at + 1);
  const highMembers = p.memberIds.slice(at + 1);

  let counters = g.counters;
  const regions: string[] = [];
  for (const gaps of [lowGaps, highGaps]) {
    if (gaps.length > 1) {
      const [[id], next] = allocateMany(counters, "S", 1);
      regions.push(id!);
      counters = next;
    } else regions.push(gaps[0] ?? "");
  }
  const free = standalone(p, part, ev, p.host);
  const low = piece(g, p, lowGaps, lowMembers, p.gaps.slice(0, at + 1), { id: regions[0]!, above: cmd.member }, counters);
  counters = low.counters;
  const high = piece(g, p, highGaps, highMembers, p.gaps.slice(at + 1), { id: regions[1]!, below: cmd.member }, counters);
  counters = high.counters;

  return ok({
    graph: withNodes(g, [free, ...low.nodes, ...high.nodes], [p.id], counters),
    declares: { parts: 0 },
    summary: `PATTERN ${p.id}: ${cmd.member} отвязан, паттерн разделён`,
  });
}

/**
 * Сдвинуть одну полку паттерна: она отвязывается, и **меняются только два соседних промежутка**
 * (Q54, Q68). Остальные промежутки закрепляются своим нынешним размером, поэтому другие полки
 * стоят на месте. UNDO возвращает паттерн и его доли.
 */
function move(g: Graph, cmd: Extract<PatternCommand, { op: "move" }>, ev: Evaluation): Outcome<Draft> {
  const old = owningPattern(g, cmd.member);
  if (!old || !old.memberIds.includes(cmd.member)) return refuse(finding("REF-MISSING-REF", [cmd.member], `${cmd.member} — не участник паттерна`));
  const at = old.memberIds.indexOf(cmd.member);
  const detached = detach(g, { op: "detach", member: cmd.member }, ev);
  if (!detached.ok) return detached;

  // Закрепляются только два куска разделённого паттерна; чужие паттерны (перегородки под полкой,
  // полки за перегородкой) живут своими долями и своей осью.
  const pinned: Node[] = [];
  const size = (id: string): Mm10 => (ev.boxes[id] ? extent(ev.boxes[id]!, old.axis) : 0);
  for (const n of Object.values(detached.value.graph.nodes)) {
    if (n.kind !== "pattern" || g.nodes[n.id] || !n.gapIds.every((id) => old.gapIds.includes(id))) continue;
    const lower = n.gapIds[n.gapIds.length - 1] === old.gapIds[at];   // паттерн под полкой
    const free = lower ? n.gapIds.length - 1 : 0;                      // этот промежуток берёт сдвиг
    pinned.push({ ...n, gaps: n.gapIds.map((id, i) => (i === free ? n.gaps[i]! : { kind: "fixed" as const, size: size(id) })) });
  }
  const part = detached.value.graph.nodes[cmd.member] as PartNode;
  if (part.position.kind !== "plane") return refuse(finding("REF-LOCKED", [cmd.member], "эту деталь двигает паттерн"));
  const moved: PartNode = { ...part, position: { ...part.position, offset: part.position.offset + part.position.dir * cmd.delta } };

  return ok({
    graph: withNodes(detached.value.graph, [moved, ...pinned]),
    declares: { parts: 0 },
    summary: `PATTERN ${old.id}: ${cmd.member} отвязана и сдвинута на ${toMm(cmd.delta)}; соседние промежутки изменились`,
  });
}

/** RELEASE: конец параметрического управления. Ссылки живут, распределение — нет (R31, Q91). */
function release(g: Graph, cmd: Extract<PatternCommand, { op: "release" }>, ev: Evaluation): Outcome<Draft> {
  const p = g.nodes[cmd.pattern];
  if (!p || p.kind !== "pattern") return refuse(finding("REF-MISSING-REF", [cmd.pattern], `паттерна ${cmd.pattern} нет`));
  const members = p.memberIds.map((id) => standalone(p, g.nodes[id] as PartNode, ev, p.host));
  const gaps = p.gapIds.map((id, i) => boundedGap(id, p.host, p.axis, p.memberIds[i - 1], p.memberIds[i]));
  return ok({
    graph: withNodes(g, [...members, ...gaps], [p.id]),
    declares: { parts: 0 },
    summary: `PATTERN ${p.id} отпущен: ${members.length} деталей стали самостоятельными`,
  });
}

function dissolve(g: Graph, cmd: Extract<PatternCommand, { op: "dissolve" }>): Outcome<Draft> {
  const p = g.nodes[cmd.pattern];
  if (!p || p.kind !== "pattern") return refuse(finding("REF-MISSING-REF", [cmd.pattern], `паттерна ${cmd.pattern} нет`));
  const leaving = [...p.gapIds, ...p.memberIds];
  const stuck = blockers(g, leaving, p.id);
  if (stuck.length) return orphan(stuck, "распустить нельзя, в промежутках есть содержимое");
  return ok({
    graph: withNodes(g, [], [p.id, ...leaving]),
    declares: { parts: -p.memberIds.length },
    summary: `PATTERN ${p.id} распущен`,
  });
}
