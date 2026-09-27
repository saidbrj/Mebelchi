// ПОЛИГОН · R88 — направление волокна.
//
// ЧТО СЛУЧИЛОСЬ. В Kitchen #1 семь деталей ушли без объявленного направления, и пре-флайт сказал
// это семь раз подряд. Молча приняли.
//
// ЧЕМ ЭТО КОНЧАЕТСЯ. Оптимизатор раскроя видит деталь без ограничения и крутит её на 90°, чтобы
// выиграть 3% листа. Тумба на три ящика приезжает с двумя горизонтальными фасадами и одним
// вертикальным. Заказчик отказывается от кухни целиком — и он прав. Три процента листа против
// переделки всей партии.
//
// И второе, менее заметное: высокая стойка 2400, выпиленная поперёк волокна, теряет около
// четверти прочности на продольный изгиб. Она не сломается на сборке — она прогнётся через год.
//
// ТРИ ЯРУСА, и решает первый же сработавший:
//   1  материал  — белый ЛДСП текстуры не имеет, крутить можно как угодно
//   2  роль      — фасад и видимый бок строго вдоль; задняя стенка ХДФ — куда угодно
//   3  коллекция — дизайнер может объявить горизонтальную текстуру на все фасады

import { ROLE_GRAIN, YIELD_PCT } from "./settings";

/** Как деталь разрешено класть на лист. */
export type GrainLock =
  /** вдоль длины детали; поворот на 90° запрещён */
  | "lengthwise"
  /** поперёк; редкость, но бывает у коллекций */
  | "crosswise"
  /** крутить можно как угодно */
  | "free";

export interface GrainInput {
  role: string;
  /** есть ли у материала направление вообще */
  materialHasGrain: boolean;
  /** ярус 3: объявление коллекции, перекрывает роль */
  collectionOverride?: GrainLock;
}

/**
 * R88 §2.2 — три яруса, первый сработавший решает.
 *
 * Материал без текстуры снимает все ограничения: крутить белый ЛДСП можно как угодно, и не
 * пользоваться этим — терять десять процентов листа впустую.
 */
export function grainLock(g: GrainInput): GrainLock {
  if (!g.materialHasGrain) return "free";
  if (g.collectionOverride) return g.collectionOverride;
  return ROLE_GRAIN[g.role] ?? "lengthwise";
}

export interface GrainProblem {
  law: string;
  detail: string;
  setting: string;
  where?: { part?: number };
}

/**
 * Деталь из текстурного материала, для роли которой направление не объявлено, — это деталь,
 * которую пила повернёт по своему усмотрению. Отказ, а не предупреждение: предупреждение
 * пропустят, как пропустили семь штук в Kitchen #1.
 */
export function checkGrainDeclared(
  parts: { no: number; role: string }[], materialHasGrain: boolean,
): GrainProblem[] {
  if (!materialHasGrain) return [];
  return parts
    .filter((p) => ROLE_GRAIN[p.role] === undefined)
    .map((p) => ({
      law: "R88-GRAIN",
      where: { part: p.no },
      setting: "tables/grain.roleGrain",
      detail:
        `деталь ${p.no} («${p.role}»): материал текстурный, а направление для этой роли не ` +
        `объявлено. Оптимизатор повернёт её на 90° ради трёх процентов листа, и партия уедет ` +
        `с разнонаправленными фасадами.`,
    }));
}

// ─── связки: текстура насквозь ────────────────────────────────────────────────────────────────

/**
 * R88 §2.3 — фасады одной тумбы обязаны продолжать друг друга.
 *
 * Три фасада ящиков, выпиленные из разных мест листа, дают три разных рисунка на одной тумбе.
 * Чтобы текстура шла насквозь, их выкраивают ОДНИМ прямоугольником и разрезают на месте — тогда
 * рисунок продолжается через зазоры.
 */
export interface TextureCluster {
  id: string;
  flow: "vertical" | "horizontal";
  /** детали по порядку сверху вниз или слева направо */
  parts: { no: number; lengthMm: number; widthMm: number }[];
  gapMm: number;
}

export interface ClusterBlank {
  cluster: string;
  /** один прямоугольник, который кладётся на лист целиком */
  lengthMm: number;
  widthMm: number;
  /** где потом резать */
  cutsAtMm: number[];
}

/** Габарит связки: сумма деталей плюс зазоры между ними. */
export function clusterBlank(c: TextureCluster): ClusterBlank {
  const along = c.flow === "vertical" ? c.parts.map((p) => p.lengthMm) : c.parts.map((p) => p.widthMm);
  const across = c.flow === "vertical" ? c.parts.map((p) => p.widthMm) : c.parts.map((p) => p.lengthMm);
  const total = along.reduce((a, b) => a + b, 0) + (c.parts.length - 1) * c.gapMm;

  const cutsAtMm: number[] = [];
  let x = 0;
  for (const a of along.slice(0, -1)) { x += a; cutsAtMm.push(x); x += c.gapMm; }

  return c.flow === "vertical"
    ? { cluster: c.id, lengthMm: total, widthMm: Math.max(...across), cutsAtMm }
    : { cluster: c.id, lengthMm: Math.max(...across), widthMm: total, cutsAtMm };
}

// ─── что текстура стоит ───────────────────────────────────────────────────────────────────────

/**
 * R88 §2.4 — выход листа падает, и это надо говорить вслух ДО раскроя, а не показывать счётом
 * после. Свободное вращение ~90%, запертая текстура ~79%, связки ~71%.
 */
export function expectedYieldPct(locks: GrainLock[], hasClusters: boolean): number {
  if (hasClusters) return YIELD_PCT.cluster;
  return locks.some((l) => l !== "free") ? YIELD_PCT.locked : YIELD_PCT.free;
}

export const yieldCostPct = (locks: GrainLock[], hasClusters: boolean): number =>
  YIELD_PCT.free - expectedYieldPct(locks, hasClusters);
