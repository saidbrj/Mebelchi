// Стыки (SPEC E14): выводятся из геометрии, хранится только то, что изменил мастер.
import { toMm, type Mm10 } from "../../0-base/units/units";
import { AXES, partsOf, type Axis, type Graph, type JointNode, type PartNode } from "../../1-graph/model/model";
import type { Box, Evaluation } from "../../1-graph/evaluate/evaluate";

export type JointKind = "touch" | "cross";

export interface Joint {
  /** имя стыка — это его место: пара деталей (R05) */
  id: string;
  a: string;
  b: string;
  /** касание гранями или пересечение объёмов, разрешённое сквозностью */
  kind: JointKind;
  /** ось, вдоль которой детали соприкасаются (у пересечения — ось, по которой режут) */
  axis: Axis;
  /** площадь соприкосновения, мм² — по ней стыки сортируются в режиме стыков */
  areaMm2: number;
  /** какая деталь проходит насквозь; `null` — сложены пластями, сквозной нет */
  through: string | null;
  /** откуда взялась сквозность: ранги профиля, решение мастера или сама геометрия */
  throughFrom: "профиль" | "мастер" | "геометрия";
  method: string;
  /** способ изменён мастером на этом стыке */
  overridden: boolean;
}

export const jointId = (a: string, b: string): string => [a, b].sort().join("×");

const depth = (x: Box, y: Box, a: Axis): Mm10 => Math.min(x.max[a], y.max[a]) - Math.max(x.min[a], y.min[a]);

/**
 * Все стыки графа: пары деталей, которые касаются гранями (по одной оси зазор ноль, по двум другим
 * есть общая площадь). Пересечение объёмов стыком не является: его запрещает закон L1a.
 */
export function jointsOf(
  g: Graph,
  ev: Evaluation,
  methodFor: (a: string, b: string) => string,
  /** кто сквозной по рангам профиля: решение не зависит от порядка команд (R37) */
  rankThrough: (typeA: string, typeB: string) => boolean = () => false,
): Joint[] {
  const parts = partsOf(g).filter((p) => p.type !== "front" && p.type !== "back" && ev.boxes[p.id]);
  const overrides = new Map<string, JointNode>();
  for (const id of g.order) {
    const n = g.nodes[id]!;
    if (n.kind === "joint") overrides.set(jointId(n.pair[0], n.pair[1]), n);
  }
  const out: Joint[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!;
      const b = parts[j]!;
      const d = AXES.map((ax) => depth(ev.boxes[a.id]!, ev.boxes[b.id]!, ax));
      const positive = d.filter((v) => v > 0).length;
      const touching = d.filter((v) => v === 0).length === 1 && positive === AXES.length - 1;
      // перекрестье — это доски под прямым углом. Две доски в одной плоскости пересекаться не могут:
      // это столкновение, и его ловит закон L1a.
      const crossing = positive === AXES.length && a.normal !== b.normal;
      if (!touching && !crossing) continue;

      const id = jointId(a.id, b.id);
      const node = overrides.get(id);
      const decided = node?.through && [a.id, b.id].includes(node.through)
        ? { through: node.through as string | null, from: "мастер" as const }
        : touching
          ? { through: passesThrough(a, b, AXES[d.indexOf(0)]!), from: "геометрия" as const }
          : { through: rankThrough(a.type, b.type) ? a.id : b.id, from: "профиль" as const };

      // у перекрестья ось реза — нормаль сквозной детали: именно поперёк неё режут вторую
      const axis = touching
        ? AXES[d.indexOf(0)]!
        : (decided.through === a.id ? a.normal : b.normal);
      const [w, h] = (touching ? d.filter((v) => v > 0) : crossArea(d, axis)) as [Mm10, Mm10];

      out.push({
        id, a: a.id, b: b.id, kind: touching ? "touch" : "cross", axis,
        areaMm2: Math.round(toMm(w) * toMm(h)),
        through: decided.through,
        throughFrom: decided.from,
        method: node?.method ?? methodFor(a.type, b.type),
        overridden: Boolean(node?.method),
      });
    }
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : 1));
}

/** У пересечения площадь считается по двум осям, кроме оси реза. */
function crossArea(d: Mm10[], axis: Axis): Mm10[] {
  return AXES.flatMap((ax, i) => (ax === axis ? [] : [d[i]!]));
}

/** Насквозь идёт та деталь, к чьей ГРАНИ пришла вторая: её нормаль совпадает с осью касания. */
function passesThrough(a: PartNode, b: PartNode, axis: Axis): string | null {
  const byA = a.normal === axis;
  const byB = b.normal === axis;
  if (byA === byB) return null;
  return byA ? a.id : b.id;
}

export const jointAt = (joints: Joint[], id: string): Joint | undefined => joints.find((j) => j.id === id);
