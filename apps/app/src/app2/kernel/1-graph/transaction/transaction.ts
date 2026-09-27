// Транзакция «всё или ничего» (SPEC G11), отчёт изменений (G15), история (G18), внешние правки (G19).
import { finding, type Finding, type Outcome } from "../../0-base/findings/findings";
import { partsOf, type Graph } from "../model/model";
import { evaluate, type Box, type Env, type Evaluation } from "../evaluate/evaluate";
import { EMPTY_COUNTERS } from "../../0-base/ids/ids";

/** Черновик, который построило слово, и сколько деталей оно ОБЪЯВИЛО (G14). */
export interface Draft {
  graph: Graph;
  declares: { parts: number };
  /** что сделано, одной строкой для журнала */
  summary: string;
}

/** Закон или проверка: смотрит на граф и геометрию, возвращает находки, ничего не чинит. */
export type Check = (g: Graph, ev: Evaluation) => Finding[];

export interface State {
  graph: Graph;
  evaluation: Evaluation;
  env: Env;
  /** стоящие находки: блокирующие и советы */
  findings: Finding[];
  previous: State | null;
  /** журнал принятых команд */
  journal: readonly string[];
}

export interface Change {
  id: string;
  kind: "added" | "removed" | "changed";
  before?: Box;
  after?: Box;
}

export interface Result {
  state: State;
  accepted: boolean;
  findings: Finding[];
  changes: Change[];
}

export function initialState(env: Env): State {
  const graph: Graph = { nodes: {}, order: [], counters: EMPTY_COUNTERS };
  return { graph, evaluation: evaluate(graph, env), env, findings: [], previous: null, journal: [] };
}

const sameBox = (a: Box, b: Box) =>
  (["x", "y", "z"] as const).every((k) => a.min[k] === b.min[k] && a.max[k] === b.max[k]);

/** Отчёт изменений (G15): добавленные, удалённые и сдвинувшиеся узлы в порядке создания. */
export function diff(before: State, graph: Graph, ev: Evaluation): Change[] {
  const out: Change[] = [];
  const old = before.evaluation.boxes;
  for (const id of before.graph.order) {
    if (!(id in graph.nodes)) out.push({ id, kind: "removed", before: old[id] });
  }
  for (const id of graph.order) {
    const a = old[id];
    const b = ev.boxes[id];
    if (!(id in before.graph.nodes)) out.push({ id, kind: "added", after: b });
    else if (a && b && !sameBox(a, b)) out.push({ id, kind: "changed", before: a, after: b });
  }
  return out;
}

export function commit(prev: State, draft: Outcome<Draft>, checks: readonly Check[]): Result {
  const refused = (findings: Finding[]): Result => ({ state: prev, accepted: false, findings, changes: [] });
  if (!draft.ok) return refused(draft.findings);

  const { graph, declares, summary } = draft.value;
  const ev = evaluate(graph, prev.env);
  const geometry = ev.problems.filter((f) => f.severity === "refusal");
  if (geometry.length) return refused(geometry);

  const found = checks.flatMap((c) => c(graph, ev));
  const refusals = found.filter((f) => f.severity === "refusal");
  if (refusals.length) return refused(refusals);

  const delta = partsOf(graph).length - partsOf(prev.graph).length;
  if (delta !== declares.parts) {
    throw new Error(`G14: «${summary}» объявило ${declares.parts} деталей, а изменилось ${delta}`);
  }

  const standing = found.filter((f) => f.severity !== "refusal");
  const state: State = {
    graph, evaluation: ev, env: prev.env, findings: standing, previous: prev, journal: [...prev.journal, summary],
  };
  return { state, accepted: true, findings: standing, changes: diff(prev, graph, ev) };
}

/** Отменяет последнюю принятую команду: возвращает прежний объект состояния (G18). */
export const undo = (s: State): State => s.previous ?? s;

/** Что изменит правка профиля, ДО её принятия (G19). */
export function impactOf(s: State, env: Env): { changes: Change[]; problems: Finding[] } {
  const ev = evaluate(s.graph, env);
  return { changes: diff(s, s.graph, ev), problems: ev.problems };
}

/** Принимает правку профиля. Отказать не может (G19): поломки → блокирующие предупреждения. */
export function reprofile(s: State, env: Env, checks: readonly Check[], summary: string): Result {
  const ev = evaluate(s.graph, env);
  const broken = [...ev.problems, ...checks.flatMap((c) => c(s.graph, ev)).filter((f) => f.severity === "refusal")];
  const external = broken.map((f) =>
    finding("WARN-EXTERNAL-CONFLICT", f.nodes, f.text, ["отменить правку профиля", "поправить модуль"]),
  );
  const standing = [...external, ...checks.flatMap((c) => c(s.graph, ev)).filter((f) => f.severity !== "refusal")];
  const state: State = {
    graph: s.graph, evaluation: ev, env, findings: standing, previous: s, journal: [...s.journal, summary],
  };
  return { state, accepted: true, findings: standing, changes: diff(s, s.graph, ev) };
}
