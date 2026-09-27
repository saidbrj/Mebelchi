// ПОЛИГОН · свобода мастера: независимость — свойство ШВА, а не шкафа.
//
// В старых программах «независимый модуль» — это ящик, у которого отрезано всё: бока, дно и
// крыша. В настоящей мебели так не бывает. Мастер хочет тумбу под тяжёлую духовку собрать
// отдельно на полу — значит боковины раздельные, 16+16. НО столешница над ними идёт сплошной на
// 2.7 метра, и цоколь снизу тоже сплошной.
//
//              СПЛОШНАЯ СТОЛЕШНИЦА  ← не режется ни на одном шве
//   ══════════════════════════════════════════════════
//        │ │ 16+16 раздельные      │ │ 16 общий щит
//   ─────┴─┴───────────────────────┴─┴────────────────
//              СПЛОШНОЙ ЦОКОЛЬ     ← и здесь не режется
//
// Одна тумба может быть независимой по бокам и слитной по низу и верху ОДНОВРЕМЕННО. Значит
// решение принимается не про шкаф, а про каждый шов отдельно.
//
// ДВЕ ОСИ, ДВА РАЗНЫХ ВОПРОСА:
//
//   ВЕРТИКАЛЬНЫЙ ШОВ   сколько досок стоит между двумя шкафами
//                      общий 16 · раздельные 32 · открытый проём
//                      (это `boards` на сегменте, и решается через жизненный цикл порта)
//
//   ГОРИЗОНТАЛЬ НА ПЕРЕСЕЧЕНИИ   режется ли сквозная доска на этом шве
//                      сплошная · разрезанная
//                      (это состояние стыка, и решается флипом)
//
// Движок обе умел и раньше. Не хватало того же, что было у вертикалей: объявленного умолчания,
// тапа мастера поверх него и объяснения, ПОЧЕМУ вышло так.

import type { LineId, Sheet } from "./sheet";
import type { JunctionState } from "./junctions";

// ─── решение по одному шву ────────────────────────────────────────────────────────────────────

export type VerticalSeam = "shared" | "split" | "open";
/** сплошная — доска идёт мимо шва; разрезанная — шов её режет */
export type HorizontalSeam = "uncut" | "cut";

export type SeamDecision =
  | { axis: "v"; at: LineId; from: LineId; to: LineId; state: VerticalSeam }
  | { axis: "h"; v: LineId; h: LineId; state: HorizontalSeam };

export type SeamBy = "auto" | "master";

export interface SeamRecord {
  decision: SeamDecision;
  by: SeamBy;
  /** почему вышло так — в инспектор и в отказ */
  why: string;
}

// ─── умолчание ────────────────────────────────────────────────────────────────────────────────

/**
 * Автоматика предлагает экономить плиту: общий щит вместо двух, сплошная горизонталь вместо
 * нарезанной. Это УМОЛЧАНИЕ, а не закон — мастер переопределяет любой шов одним тапом.
 */
export const AUTO_VERTICAL: VerticalSeam = "shared";
export const AUTO_HORIZONTAL: HorizontalSeam = "uncut";

/** Тап мастера: по кругу, как на экране. */
export const cycleVertical = (s: VerticalSeam): VerticalSeam =>
  s === "shared" ? "split" : s === "split" ? "open" : "shared";

export const cycleHorizontal = (s: HorizontalSeam): HorizontalSeam =>
  s === "uncut" ? "cut" : "uncut";

// ─── применение ───────────────────────────────────────────────────────────────────────────────

/** Вертикальный шов в число досок на сегменте. */
export const boardsFor = (s: VerticalSeam): 0 | 1 | 2 =>
  s === "shared" ? 1 : s === "split" ? 2 : 0;

/** Горизонталь на пересечении в состояние стыка. Сплошная значит: горизонталь проходит. */
export const junctionFor = (s: HorizontalSeam): Exclude<JunctionState, "both"> =>
  s === "uncut" ? "H-through" : "V-through";

export interface SeamPlan {
  sheet: Sheet;
  records: SeamRecord[];
}

/**
 * Применить решения к листу. Вертикальные меняют сегмент, горизонтальные — переопределение стыка.
 *
 * Ключевое: обе оси проходят ЧЕРЕЗ ЭТУ ФУНКЦИЮ, поэтому «сплошная столешница над раздельными
 * боками» перестаёт быть случайным сочетанием двух независимых правок и становится ДВУМЯ
 * объявленными решениями, каждое со своим следом.
 */
export function applySeams(
  sheet: Sheet, decisions: SeamDecision[], by: SeamBy = "master",
): SeamPlan {
  let segments = [...sheet.segments];
  const overrides = [...(sheet.junctionOverrides ?? [])];
  const records: SeamRecord[] = [];

  for (const d of decisions) {
    if (d.axis === "v") {
      const boards = boardsFor(d.state);
      segments = segments.map((sg) => {
        if (sg.line !== d.at || sg.from !== d.from || sg.to !== d.to) return sg;
        if (boards === 0) return { line: sg.line, from: sg.from, to: sg.to, boards: 0 };
        const role = "role" in sg ? sg.role : "side";
        return { ...sg, boards, role };
      });
      records.push({
        decision: d, by,
        why: d.state === "shared"
          ? "один щит на два шкафа: модуль общий, плиты уходит вдвое меньше"
          : d.state === "split"
            ? "два корпуса спиной к спине: собираются отдельно, везутся отдельно"
            : "открытый проём: панели нет вовсе",
      });
      continue;
    }

    const i = overrides.findIndex((o) => o.v === d.v && o.h === d.h);
    const state = junctionFor(d.state);
    if (i >= 0) overrides[i] = { v: d.v, h: d.h, state };
    else overrides.push({ v: d.v, h: d.h, state });

    records.push({
      decision: d, by,
      why: d.state === "uncut"
        ? "горизонталь идёт СПЛОШНОЙ мимо этого шва — одна доска вместо двух, и жёстче"
        : "горизонталь режется на этом шве — два корпуса собираются по отдельности",
    });
  }

  return { sheet: { ...sheet, segments, junctionOverrides: overrides }, records };
}

// ─── что именно мастер поменял ────────────────────────────────────────────────────────────────

export interface SeamDiff {
  /** швы, где решение мастера отличается от автоматики */
  overridden: SeamRecord[];
  /** сколько плиты стоило это решение, в досках */
  extraBoards: number;
}

/**
 * Чем решение мастера отличается от того, что предложила автоматика, и во сколько досок это
 * обошлось. Не упрёк — цифра: мастер вправе разделить корпуса, и вправе знать цену.
 */
export function seamDiff(records: SeamRecord[]): SeamDiff {
  const overridden = records.filter((r) =>
    r.by === "master" &&
    (r.decision.axis === "v"
      ? r.decision.state !== AUTO_VERTICAL
      : r.decision.state !== AUTO_HORIZONTAL));

  const extraBoards = overridden.reduce((n, r) => {
    if (r.decision.axis === "v") {
      return n + (boardsFor(r.decision.state) - boardsFor(AUTO_VERTICAL));
    }
    // разрезанная горизонталь: вместо одной сквозной доски две
    return n + (r.decision.state === "cut" ? 1 : 0);
  }, 0);

  return { overridden, extraBoards };
}
