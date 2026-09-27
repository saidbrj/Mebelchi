// Фасад ядра App 2: единственная дверь для UI и ИИ (SPEC A05). Команды приходят в мм, внутри
// всё в mm10. Здесь слова соединяются с транзакцией и законами; сами слои друг о друге не знают.
import { finding, type Finding } from "./0-base/findings/findings";
import { fromMm, type Mm10 } from "./0-base/units/units";
import type { Axis, CellRule, Face, PlaneRef, Span } from "./1-graph/model/model";
import {
  commit, impactOf, initialState, reprofile, type Change, type Check, type Result, type State,
} from "./1-graph/transaction/transaction";
import { EMPTY_COUNTERS, mergeMax, type Counters } from "./0-base/ids/ids";
import { QORASU, envOf, setValue, type Profile } from "./2-settings/profile/profile";
import { cube } from "./3-words/cube/cube";
import { pattern, type PatternCommand } from "./3-words/pattern/pattern";
import { place, type PlaceRelation } from "./3-words/place/place";
import { drag } from "./3-words/drag/drag";
import { group } from "./3-words/group/group";
import { replace } from "./3-words/replace/replace";
import { scope, type ScopeTarget } from "./3-words/scope/scope";
import { jointsOf, type Joint } from "./4-constraints/joints/joints";
import { segmentsOf, type Segment } from "./4-constraints/joints/joints.segments";
import { disagreements, toFillParts, type Disagreement, type FillPart } from "./9-bridge/to-poligon/to-poligon";
import { METHODS, methodFor, nameOf } from "./2-settings/types/types";
import { runsThrough } from "./2-settings/profile/profile";
import { DEFAULT_SLOTS, materialOf, slotForType } from "./2-settings/slots/slots";
import { fullSpan } from "./3-words/word/word";
import { overlap } from "./5-laws/l1-overlap/overlap";

export type { State, Result, Change, Finding, Profile };
export { extent } from "./1-graph/evaluate/evaluate";
export type { Box } from "./1-graph/evaluate/evaluate";

/** Законы, которые проверяются после каждой команды. */
/** Пересечение, разрешённое стыком, законом не считается (R37). */
const checksFor = (profile: Profile): readonly Check[] => [
  (g, ev) => {
    const resolved = new Set(
      jointsOf(g, ev, methodFor, (x, y) => runsThrough(profile, x, y))
        .filter((j) => j.kind === "cross" && j.through)
        .map((j) => j.id),
    );
    return overlap(g, ev, resolved);
  },
];

/** Законы, которые проверяются после каждой команды (профиль подставляет сессия). */
export const CHECKS: readonly Check[] = [overlap];

export type CellInput = { ratio: number } | { fixed: number } | "flex";
export type SpanInput = "full" | { from: PlaneRef; offset: number; size: number } | { from: PlaneRef; to: PlaneRef };

/** Команды пользователя. Все длины — в мм. */
export type Command =
  | { word: "CUBE"; w: number; h: number; d: number; neighbours?: Partial<Record<Face, "unit" | "wall" | "free">> }
  | { word: "PATTERN"; op: "create"; space: string; axis: Axis; gaps: readonly CellInput[]; member: string | null; fill?: { type: string; face: Face } }
  | { word: "PATTERN"; op: "ratio"; pattern: string; gaps: readonly CellInput[] }
  | { word: "PATTERN"; op: "insert"; gap: string }
  | { word: "PATTERN"; op: "remove"; member: string }
  | { word: "PATTERN"; op: "detach"; member: string }
  | { word: "PATTERN"; op: "release"; pattern: string }
  | { word: "PATTERN"; op: "dissolve"; pattern: string }
  | {
      word: "PLACE"; host: string; type: string;
      relation: { kind: "on"; plane: PlaneRef; side?: "inside" | "outside"; offset: number } | { kind: "against"; plane: PlaneRef };
      spans: Partial<Record<Axis, SpanInput>>; thickness?: number;
    }
  | { word: "DRAG"; target: "unit"; axis: Axis; size: number }
  | { word: "DRAG"; target: "part"; part: string; delta: number }
  | { word: "DRAG"; target: "size"; part: string; axis: Axis; size: number }
  | { word: "SCOPE"; target: ScopeTarget; key: "slot"; value: string }
  | { word: "SCOPE"; joint: [string, string]; key: "method" | "through"; value: string }
  | { word: "GROUP"; op: "create"; members: string[]; name?: string }
  | { word: "GROUP"; op: "add" | "remove"; group: string; member: string }
  | { word: "GROUP"; op: "ungroup"; group: string }
  | { word: "REPLACE"; part: string; with: "nothing" };

export interface Session {
  state: State;
  profile: Profile;
  /** сессия до последней принятой команды или правки профиля (G18) */
  previous: Session | null;
  /** выданные uid: счётчик только растёт и не откатывается отменой (R02) */
  issued: Counters;
  /** слоты материалов проекта (E12): имя слота → материал */
  slots: Readonly<Record<string, string>>;
}

export function start(profile: Profile = QORASU): Session {
  return { state: initialState(envOf(profile)), profile, previous: null, issued: EMPTY_COUNTERS, slots: DEFAULT_SLOTS };
}

const next = (session: Session, result: Result, profile: Profile = session.profile): Session =>
  result.accepted
    ? {
        state: result.state, profile, previous: session, slots: session.slots,
        issued: mergeMax(session.issued, result.state.graph.counters),
      }
    : session;

/** Граф, из которого слово берёт новые uid: счётчик поднят до отметки «что уже выдавалось». */
const forWord = (session: Session) => ({
  ...session.state.graph,
  counters: mergeMax(session.state.graph.counters, session.issued),
});

class Precision extends Error {
  constructor(readonly what: string, readonly mm: number) {
    super(what);
  }
}

/** мм → mm10, иначе отказ REF-PRECISION (U06): ядро не округляет молча. */
function mm10(what: string, mm: number): Mm10 {
  const v = fromMm(mm);
  if (v === null) throw new Precision(what, mm);
  return v;
}

function cellOf(c: CellInput): CellRule {
  if (c === "flex") return { kind: "flex" };
  if ("ratio" in c) return { kind: "ratio", weight: c.ratio };
  return { kind: "fixed", size: mm10("постоянная ячейка", c.fixed) };
}

function spanOf(host: string, axis: Axis, s: SpanInput | undefined): Span | undefined {
  if (s === undefined) return undefined;
  if (s === "full") return fullSpan(host, axis);
  if ("to" in s) return { kind: "between", from: s.from, to: s.to };
  return { kind: "sized", from: s.from, offset: mm10("отступ пролёта", s.offset), size: mm10("длина пролёта", s.size) };
}

export function run(session: Session, cmd: Command): { session: Session; result: Result } {
  const { state, profile } = session;
  const ctx = { profile, evaluation: state.evaluation };
  let result: Result;
  try {
    const g = forWord(session);
    switch (cmd.word) {
      case "CUBE":
        result = commit(state, cube(g, { size: { x: mm10("ширина", cmd.w), y: mm10("высота", cmd.h), z: mm10("глубина", cmd.d) }, ...(cmd.neighbours ? { neighbours: cmd.neighbours } : {}) }, ctx), checksFor(profile));
        break;
      case "PATTERN": {
        const p: PatternCommand =
          cmd.op === "create" ? { op: "create", space: cmd.space, axis: cmd.axis, gaps: cmd.gaps.map(cellOf), member: cmd.member, ...(cmd.fill ? { fill: cmd.fill } : {}) }
            : cmd.op === "ratio" ? { op: "ratio", pattern: cmd.pattern, gaps: cmd.gaps.map(cellOf) }
              : cmd;
        result = commit(state, pattern(g, p, ctx), checksFor(profile));
        break;
      }
      case "PLACE": {
        const relation: PlaceRelation = cmd.relation.kind === "on"
          ? { ...cmd.relation, offset: mm10("отступ", cmd.relation.offset) }
          : cmd.relation;
        const spans = Object.fromEntries(
          (["x", "y", "z"] as const).map((a) => [a, spanOf(cmd.host, a, cmd.spans[a])]).filter(([, s]) => s),
        );
        result = commit(state, place(g, {
          host: cmd.host, type: cmd.type, relation, spans,
          thickness: cmd.thickness === undefined ? undefined : mm10("толщина", cmd.thickness),
        }, ctx), checksFor(profile));
        break;
      }
      case "SCOPE":
        result = commit(state, scope(g, cmd.key === "slot"
          ? { target: cmd.target, key: "slot", value: cmd.value }
          : { target: { kind: "joint", joint: cmd.joint }, key: cmd.key, value: cmd.value }, ctx), checksFor(profile));
        break;
      case "GROUP":
        result = commit(state, group(g, cmd.op === "create"
          ? { op: "create", members: cmd.members, ...(cmd.name ? { name: cmd.name } : {}) }
          : cmd.op === "ungroup" ? { op: "ungroup", group: cmd.group }
            : { op: cmd.op, group: cmd.group, member: cmd.member }, ctx), checksFor(profile));
        break;
      case "REPLACE":
        result = commit(state, replace(g, { part: cmd.part, with: cmd.with }, ctx), checksFor(profile));
        break;
      case "DRAG":
        result = commit(state, drag(g,
          cmd.target === "unit" ? { kind: "unit", axis: cmd.axis, size: mm10("размер", cmd.size) }
            : cmd.target === "part" ? { kind: "part", part: cmd.part, delta: mm10("сдвиг", cmd.delta) }
              : { kind: "size", part: cmd.part, axis: cmd.axis, size: mm10("длина", cmd.size) },
          ctx), checksFor(profile));
        break;
    }
  } catch (e) {
    if (!(e instanceof Precision)) throw e;
    result = { state, accepted: false, changes: [], findings: [finding("REF-PRECISION", [], `${e.what} = ${e.mm} мм`)] };
  }
  return { session: next(session, result), result };
}

/**
 * Отмена последней принятой команды или правки профиля (G18): граф возвращается побитово,
 * а отметка выданных uid **не откатывается** (R02). Иначе после отмены следующий узел получил бы
 * uid уже существовавшего, и ссылки, журнал и мост в Полигон начали бы означать разное.
 */
/** Слот детали: назначенный мастером или умолчание по типу детали (E12). */
export function slotOf(session: Session, part: string): string {
  const n = session.state.graph.nodes[part];
  if (!n || n.kind !== "part") return "—";
  return n.slot ?? slotForType(n.type);
}

/** Материал слота проекта. */
export const material = (session: Session, slot: string): string => materialOf(session.slots, slot);

/**
 * Сменить материал слота (E12): меняется всё, что на этот слот ссылается, одним действием.
 * Геометрию это не трогает, поэтому граф остаётся прежним; в отчёте — кого коснулось.
 */
export function setSlotMaterial(session: Session, slot: string, value: string): { session: Session; touched: string[] } {
  const touched = session.state.graph.order.filter((id) => slotOf(session, id) === slot);
  return { session: { ...session, slots: { ...session.slots, [slot]: value }, previous: session }, touched };
}

/** Все слоты проекта и их материалы. */
export const slots = (session: Session): Readonly<Record<string, string>> => session.slots;

/** Все стыки юнита: выводятся из геометрии, способ — из профиля или местного изменения (E14). */
export const joints = (session: Session): Joint[] =>
  jointsOf(session.state.graph, session.state.evaluation, methodFor, (a, b) => runsThrough(session.profile, a, b));

/** Что поедет в раскрой: целые детали и отрезки тех, кого режет сквозной сосед (R37). */
export const segments = (session: Session): Segment[] =>
  segmentsOf(session.state.graph, session.state.evaluation, joints(session));

export type { Segment };

/** Что уедет в Полигон: детали в его терминах, размеры — наши (P04). */
export const cutList = (session: Session): FillPart[] =>
  toFillParts({ graph: session.state.graph, evaluation: session.state.evaluation, segments: segments(session) });

/** Сверка «одна правда»: пусто — ядро и Полигон согласны; непусто — разошёлся смысл. */
export const crossCheck = (session: Session): Disagreement[] =>
  disagreements({ graph: session.state.graph, evaluation: session.state.evaluation, segments: segments(session) });

export type { Disagreement, FillPart };

export type { Joint };

/** Способы соединения из настроек цеха и человеческие имена типов — одно имя везде. */
export { METHODS, nameOf };

export const undo = (session: Session): Session =>
  session.previous ? { ...session.previous, issued: session.issued } : session;

/** Что изменит правка профиля, ДО её принятия (G19). */
export function previewProfile(session: Session, key: string, value: number | string):
  { ok: true; changes: Change[]; problems: Finding[] } | { ok: false; findings: Finding[] } {
  const p = setValue(session.profile, key, value);
  if (!p.ok) return p;
  return { ok: true, ...impactOf(session.state, envOf(p.value)) };
}

/** Правка профиля (M03). Вне диапазона — отказ; иначе принимается, поломки — WARN-EXTERNAL-CONFLICT. */
export function setProfile(session: Session, key: string, value: number | string): { session: Session; result: Result } {
  const p = setValue(session.profile, key, value);
  if (!p.ok) return { session, result: { state: session.state, accepted: false, findings: p.findings, changes: [] } };
  const result = reprofile(session.state, envOf(p.value), CHECKS, `ПРОФИЛЬ ${key} = ${value}`);
  return { session: next(session, result, p.value), result };
}
