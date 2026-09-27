// Узлы графа конструкции (SPEC G01–G05). Только объявления: ни одного вычисленного числа.
import type { Mm10 } from "../../0-base/units/units";
import type { Counters } from "../../0-base/ids/ids";

export type Axis = "x" | "y" | "z";
export const AXES: readonly Axis[] = ["x", "y", "z"];

export type Face = "left" | "right" | "bottom" | "top" | "front" | "back";

/** ось грани и её сторона: -1 = меньшая координата, +1 = большая */
export const FACE: Record<Face, { axis: Axis; side: -1 | 1 }> = {
  left: { axis: "x", side: -1 },
  right: { axis: "x", side: 1 },
  bottom: { axis: "y", side: -1 },
  top: { axis: "y", side: 1 },
  front: { axis: "z", side: -1 },
  back: { axis: "z", side: 1 },
};

export const facesOf = (axis: Axis): [Face, Face] =>
  axis === "x" ? ["left", "right"] : axis === "y" ? ["bottom", "top"] : ["front", "back"];

/** Грань узла: модуля, пространства или детали. */
export interface PlaneRef {
  node: string;
  face: Face;
}

/** Толщина или зазор: ключ настроек («carcassThicknessMm», «fill:frontGapMm») или объявленное число. */
export type Thickness =
  | { from: "profile"; key: string }
  | { from: "declared"; mm10: Mm10 };

export type Span =
  | { kind: "between"; from: PlaneRef; to: PlaneRef }
  | { kind: "sized"; from: PlaneRef; offset: Mm10; size: Mm10 };

/** Как деталь держится за грань: `frame` — доска корпуса (двигается только с габаритом модуля),
 *  `on` — лежит на открытой плоскости с отступом, `against` — прижата к грани другой доски. */
export type Relation = "frame" | "on" | "against";

export type PartPosition =
  | { kind: "plane"; relation: Relation; plane: PlaneRef; dir: -1 | 1; offset: Mm10 }
  /** участник паттерна: стоит МЕЖДУ промежутками */
  | { kind: "member"; division: string; index: number }
  /** деталь, ЗАПОЛНЯЮЩАЯ ячейку паттерна: фасад, дверь (Q70) */
  | { kind: "fill"; pattern: string; index: number };

export type CellRule = { kind: "ratio"; weight: number } | { kind: "fixed"; size: Mm10 } | { kind: "flex" };

export interface UnitNode {
  kind: "unit";
  id: string;
  size: Record<Axis, Mm10>;
  profile: string;
  /**
   * Что стоит рядом с каждой стороной — факт из App 1 (R60). Там, где сосед-юнит, стойка общая,
   * и фасад закрывает только половину её: до оси, а не до наружной грани.
   */
  neighbours?: Partial<Record<Face, "unit" | "wall" | "free">>;
}

export interface SpaceNode {
  kind: "space";
  id: string;
  /** пространство-хозяин (null у корневого S модуля) */
  host: string | null;
  shape: { kind: "bounds"; bounds: Record<Face, PlaneRef> } | { kind: "cell"; division: string; index: number };
}

/** Повторение одного типа вдоль одной оси (SPEC E08). Распределение описывает ПРОМЕЖУТКИ (Q70);
 *  участники паттерна стоят между ними. */
export interface PatternNode {
  kind: "pattern";
  id: string;
  host: string;
  axis: Axis;
  /** правило каждого промежутка; их всегда на один больше, чем участников */
  gaps: CellRule[];
  /** чем разделено: тип участника и его толщина; null — деление без деталей */
  member: { type: string; thickness: Thickness } | null;
  /**
   * Фасадный паттерн (Q20, Q70): ячейки заполняются деталями на названной грани, между ними
   * воздух `spacing`, по краям поле `margin`. Доски-участника при этом нет.
   */
  fill?: { type: string; face: Face; thickness: Thickness; spacing: Thickness; margin: Thickness };
  /** uid промежутков: меняются только при вставке и удалении (R04) */
  gapIds: string[];
  /** uid участников */
  memberIds: string[];
}

export interface PartNode {
  kind: "part";
  id: string;
  /** тип детали: полка, боковина, перегородка — данные, а не ветка кода (SPEC E07) */
  type: string;
  /** пространство или юнит, которому деталь принадлежит */
  host: string;
  /** кто её объявил — для отчёта и для «ничего автоматически» */
  origin: "cube" | "split" | "place";
  thickness: Thickness;
  /** ось толщины */
  normal: Axis;
  position: PartPosition;
  /** пролёты по двум осям, кроме нормали */
  spans: Partial<Record<Axis, Span>>;
  /** слот материала (SPEC E12): деталь ссылается на слот проекта, а не на материал */
  slot?: string;
}

/** Группа (SPEC E10, R13): просто список узлов, которыми мастер управляет вместе. Ничем не владеет. */
export interface GroupNode {
  kind: "group";
  id: string;
  name: string;
  members: string[];
}

/**
 * Переопределение стыка (SPEC E14, R34). Сам стык **выводится** из геометрии: он есть везде, где
 * две детали соприкасаются. Узел появляется только тогда, когда мастер изменил этот стык — так
 * переопределение видно, считается и отменяется.
 */
export interface JointNode {
  kind: "joint";
  id: string;
  /** пара деталей, отсортированная: стык принадлежит месту, а не порядку выбора */
  pair: [string, string];
  method?: string;
  /** кто из пары идёт насквозь — решение мастера; без него действуют ранги профиля (R37) */
  through?: string;
}

export type Node = UnitNode | SpaceNode | PatternNode | PartNode | JointNode | GroupNode;

export interface Graph {
  nodes: Readonly<Record<string, Node>>;
  /** порядок создания — порядок вычисления и отчёта (детерминизм, G17) */
  order: readonly string[];
  counters: Counters;
}

/** Ссылки узла на другие узлы — всё, от чего его объявление зависит. */
export function referencesOf(n: Node): string[] {
  switch (n.kind) {
    case "unit":
      return [];
    case "space":
      return n.shape.kind === "cell"
        ? [n.shape.division]
        : [...(n.host ? [n.host] : []), ...Object.values(n.shape.bounds).map((p) => p.node)];
    case "pattern":
      return [n.host];
    case "joint":
      return [...n.pair];
    case "group":
      return [...n.members];
    case "part": {
      const refs = [n.host];
      if (n.position.kind === "plane") refs.push(n.position.plane.node);
      else if (n.position.kind === "fill") refs.push(n.position.pattern);
      else refs.push(n.position.division);
      for (const s of Object.values(n.spans)) {
        if (!s) continue;
        refs.push(s.from.node);
        if (s.kind === "between") refs.push(s.to.node);
      }
      return refs;
    }
  }
}

/** Узлы, чьи объявления ссылаются на `id` (G16), в порядке создания. */
export function dependentsOf(g: Graph, id: string): string[] {
  return g.order.filter((other) => other !== id && referencesOf(g.nodes[other]!).includes(id));
}

export const partsOf = (g: Graph): PartNode[] =>
  g.order.map((id) => g.nodes[id]!).filter((n): n is PartNode => n.kind === "part");

export const unitOf = (g: Graph): UnitNode | undefined =>
  g.order.map((id) => g.nodes[id]!).find((n): n is UnitNode => n.kind === "unit");

/** Новый граф с заменёнными / добавленными / удалёнными узлами. Исходный не меняется.
 *  Заменённый узел сохраняет место в порядке создания; новый встаёт в конец. */
export function withNodes(g: Graph, put: Node[], remove: string[] = [], counters: Counters = g.counters): Graph {
  const nodes: Record<string, Node> = { ...g.nodes };
  for (const id of remove) delete nodes[id];
  const order = g.order.filter((id) => !remove.includes(id));
  for (const n of put) {
    if (!order.includes(n.id)) order.push(n.id);
    nodes[n.id] = n;
  }
  return { nodes, order, counters };
}
