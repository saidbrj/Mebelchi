// ПОЛИГОН · R91–R93 — остров: мебель без стены.
//
// Все 114 законов до этого стояли на негласной аксиоме: шкаф стоит у стены. Стена держала от
// опрокидывания, прятала сырое ХДФ, маскировала трубы и задавала плоскость. Остров убирает её всю
// сразу.
//
// ПОЧЕМУ ОПРОКИДЫВАНИЕ СЧИТАЕТСЯ, А НЕ БЕРЁТСЯ ПО ПОРОГУ.
//
// Исследование предлагало правило: «глубина меньше 900 — анкер обязателен», и выводило его из
// расчёта 75 кг × 0.65 м = 48.75 против 120 × 0.30 = 36.0. Число 0.65 в тексте не объяснено: при
// вылете 500 из корпуса 600 груз физически не может оказаться на 650 мм впереди ребра. При
// честном плече тот же остров даёт 18.75 против 36 и НЕ падает.
//
// Риск при этом настоящий — просто не такой, как написано. Считаю честно:
//
//   груз ящиков, центр массы на вылете/2   18.75  стоит
//   весь груз на самом краю                37.50  падает
//   ребёнок 30 кг на краю ящика            15.00  стоит
//   груз и ребёнок вместе                  52.50  падает
//
// Поэтому здесь РАСЧЁТ, а не порог. Тяжёлый остров с каменной столешницей не упадёт и анкера не
// требует; лёгкий с глубокими нагруженными ящиками — упадёт и на 900 мм глубины. Порог по
// глубине запретил бы первое и пропустил бы второе.
//
// И это ровно то, о чём просил основатель: инструмент не должен быть барьером. Анкер в пол — не
// всегда возможен (тёплый пол в стяжке), и требовать его там, где физика не требует, значит
// запрещать мастеру то, что он вправе сделать.

import { ISLAND, OVERHANG_LIMIT_MM } from "./settings";

export interface IslandProblem {
  law: string;
  detail: string;
  setting: string;
}

// ─── опрокидывание ────────────────────────────────────────────────────────────────────────────

export interface TipInput {
  /** глубина базы, мм */
  depthMm: number;
  /** собственный вес острова с столешницей, кг */
  deadWeightKg: number;
  /** ящики, которые могут быть открыты одновременно */
  drawers: { loadKg: number; extensionMm: number }[];
  /** утоплен ли цоколь — он смещает ребро опрокидывания назад */
  plinthSetbackMm?: number;
  /** учитывать ли ребёнка, вставшего на открытый ящик */
  withChild?: boolean;
  /** закреплён ли к полу */
  anchored?: boolean;
}

export interface TipResult {
  /** ребро, вокруг которого вращается: передняя грань цоколя, мм от задней стенки */
  fulcrumMm: number;
  tippingKgM: number;
  restoringKgM: number;
  /** во сколько раз удерживающий больше опрокидывающего */
  factor: number;
  stable: boolean;
}

/**
 * Момент считается вокруг ПЕРЕДНЕЙ ГРАНИ ЦОКОЛЯ, а не корпуса: утопленный цоколь отодвигает ребро
 * назад и делает остров МЕНЕЕ устойчивым. Это ровно тот случай, где красивая деталь стоит
 * устойчивости, и знать об этом надо до, а не после.
 */
export function tipCheck(t: TipInput, s = ISLAND): TipResult {
  const setback = t.plinthSetbackMm ?? 0;
  const fulcrumMm = t.depthMm - setback;

  // Центр массы выдвинутого ящика: половина его вылета впереди фасада. Худший разумный случай —
  // груз сдвинут к самому краю, и именно его и берём: посуду ставят спереди, а не в глубину.
  const drawerLoad = t.drawers.reduce((n, d) => n + d.loadKg * (d.extensionMm / 1000), 0);
  const childArm = Math.max(...t.drawers.map((d) => d.extensionMm), 0) / 1000;
  const childLoad = t.withChild ? s.childLoadKg * childArm : 0;

  const tippingKgM = drawerLoad + childLoad;
  const restoringKgM = t.deadWeightKg * (fulcrumMm / 2000);
  const factor = tippingKgM === 0 ? Infinity : restoringKgM / tippingKgM;

  return {
    fulcrumMm, tippingKgM: round2(tippingKgM), restoringKgM: round2(restoringKgM),
    factor: round2(factor),
    stable: t.anchored === true || factor >= s.tipSafety,
  };
}

export function checkTipping(t: TipInput, s = ISLAND): IslandProblem[] {
  const r = tipCheck(t, s);
  if (r.stable) return [];
  return [{
    law: "ISLAND-ANTI-TIP",
    setting: "tables/island.tipSafetyFactor",
    detail:
      `остров ${t.depthMm}мм весом ${t.deadWeightKg}кг: опрокидывающий момент ` +
      `${r.tippingKgM} кг·м против удерживающего ${r.restoringKgM}, запас ${r.factor} ` +
      `при требуемом ${s.tipSafety}. ` +
      (t.plinthSetbackMm
        ? `Цоколь утоплен на ${t.plinthSetbackMm}мм — ребро опрокидывания сдвинуто назад, и это ` +
          `забирает устойчивость. `
        : ``) +
      `Нужен анкер в пол, либо больше веса, либо короче вылет. ` +
      `Анкер не всегда возможен: в стяжке с тёплым полом сверлить нельзя без тепловизора.`,
  }];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// ─── свес под барные стулья ───────────────────────────────────────────────────────────────────

export interface OverhangInput {
  /** ключ материала в таблице пределов */
  material: string;
  overhangMm: number;
  /** длина свеса вдоль острова — от неё считается число кронштейнов */
  runLengthMm: number;
  /** объявлены ли стальные кронштейны */
  brackets?: boolean;
  /** объявлены ли опоры в пол или боковина-водопад */
  endPosts?: boolean;
}

export interface OverhangResult {
  limitMm: number;
  problems: IslandProblem[];
  /** сколько кронштейнов нужно, если они нужны */
  bracketsNeeded: number;
}

/**
 * R92 — свес. Ключевое: предел материала НЕ ЗАПРЕЩАЕТ свес, он требует опор. Мастер, объявивший
 * кронштейны, вправе сделать 300; объявивший ноги в пол — 400. Отказ остаётся ровно там, где
 * физика: дальше `endPostMm` одни кронштейны не держат.
 */
export function checkOverhang(o: OverhangInput, s = ISLAND): OverhangResult {
  const limitMm = OVERHANG_LIMIT_MM[o.material] ?? 0;
  const problems: IslandProblem[] = [];
  const bracketsNeeded = Math.max(2, Math.ceil(o.runLengthMm / s.bracketPitchMm) + 1);

  if (limitMm === 0) {
    problems.push({
      law: "ISLAND-OVERHANG",
      setting: "tables/island.overhangLimits",
      detail:
        `для материала «${o.material}» предел свеса не объявлен. Это не запрет — это пробел ` +
        `в таблице: допишите строку, и движок посчитает.`,
    });
    return { limitMm, problems, bracketsNeeded };
  }

  if (o.overhangMm > s.endPostMm && !o.endPosts) {
    problems.push({
      law: "ISLAND-OVERHANG",
      setting: "tables/island.overhangEndPostMm",
      detail:
        `свес ${o.overhangMm}мм больше ${s.endPostMm}мм — одни кронштейны его не держат, ` +
        `какой бы толщины они ни были. Нужна опора в пол: ноги, боковина-водопад или ` +
        `замкнутый торец.`,
    });
    return { limitMm, problems, bracketsNeeded };
  }

  if (o.overhangMm > limitMm && !o.brackets && !o.endPosts) {
    problems.push({
      law: "ISLAND-OVERHANG",
      setting: "tables/island.overhangLimits",
      detail:
        `свес ${o.overhangMm}мм при пределе ${limitMm}мм для «${o.material}» без опор. ` +
        `Это НЕ запрет: объявите стальные кронштейны — их нужно ${bracketsNeeded} шт ` +
        `с шагом ${s.bracketPitchMm}мм — и свес законен.`,
    });
  }

  return { limitMm, problems, bracketsNeeded };
}

// ─── задняя сторона ───────────────────────────────────────────────────────────────────────────

export type IslandBack = "cladding" | "cabinets" | "hdf" | "open";

export interface BackInput {
  kind: IslandBack;
  /** толщина облицовки, если она объявлена */
  thicknessMm?: number;
}

/**
 * R91 — задняя сторона острова смотрит в гостиную. Сырое ХДФ 3 мм со скобами наружу — это то,
 * что движок обязан не выпустить.
 *
 * Но «облицовка» — не единственный законный ответ. Мелкие шкафы спиной к спине, открытые полки
 * или намеренно голый щит — тоже ответы. Отказ ровно один: черновое ХДФ наружу.
 */
export function checkIslandBack(b: BackInput, s = ISLAND): IslandProblem[] {
  if (b.kind === "hdf") {
    return [{
      law: "ISLAND-BACK",
      setting: "tables/island.claddingMinMm",
      detail:
        `задняя сторона острова — черновое ХДФ. Оно смотрит в гостиную скобами наружу. ` +
        `Нужна облицовка от ${s.claddingMinMm}мм фасадным материалом, мелкие шкафы спиной ` +
        `к спине, или открытые полки — но не сырой лист.`,
    }];
  }
  if (b.kind === "cladding" && (b.thicknessMm ?? 0) < s.claddingMinMm) {
    return [{
      law: "ISLAND-BACK",
      setting: "tables/island.claddingMinMm",
      detail:
        `облицовка ${b.thicknessMm ?? 0}мм тоньше ${s.claddingMinMm}мм: на трёхметровом ` +
        `острове тонкий щит поведёт, и это будет видно из гостиной.`,
    }];
  }
  return [];
}

/** Полный разбор острова — всё, что должно сойтись, прежде чем он пойдёт в работу. */
export const checkIsland = (
  tip: TipInput, over: OverhangInput, back: BackInput,
): IslandProblem[] => [
  ...checkTipping(tip),
  ...checkOverhang(over).problems,
  ...checkIslandBack(back),
];

// ─── R94 · спина к спине ──────────────────────────────────────────────────────────────────────
//
// Остров глубиной 900–1200 никогда не собирают из одного глубокого ящика: направляющих глубже
// 650 в ходовых каталогах просто нет. Он собирается из ДВУХ параллельных рядов, связанных
// продольной перегородкой — и эта перегородка не декор, а то, что превращает две коробки в одну
// коробчатую балку.
//
// Между рядами — зазор под трубы, кабель силовой линии варочной и плоский воздуховод вытяжки.
// Забыть его значит потом сверлить перегородку насквозь по месту.

import { ISLAND as ISL } from "./settings";

export interface DualDepth {
  /** общая глубина острова */
  totalMm: number;
  /** рабочий ряд со стороны кухни */
  workingMm: number;
  /** мелкий ряд со стороны гостиной */
  diningMm: number;
  /** есть ли продольная перегородка */
  spine: boolean;
}

/** Что осталось между рядами после двух глубин и перегородки. */
export const chaseOf = (d: DualDepth, s = ISL): number =>
  d.totalMm - d.workingMm - d.diningMm - (d.spine ? s.spineThicknessMm : 0);

export function checkDualDepth(d: DualDepth, s = ISL): IslandProblem[] {
  const out: IslandProblem[] = [];
  const chase = chaseOf(d, s);

  if (chase < s.chaseMinMm) {
    out.push({
      law: "ISLAND-SPINE",
      setting: "tables/island.chaseMinMm",
      detail:
        `между рядами остаётся ${chase}мм при минимуме ${s.chaseMinMm}мм. ` +
        `Туда идут канализация, силовая линия варочной и плоский воздуховод — ` +
        `забыть зазор значит потом сверлить перегородку по месту.`,
    });
  }

  if (!d.spine) {
    out.push({
      law: "ISLAND-SPINE",
      setting: "tables/island.spineThicknessMm",
      detail:
        `два ряда без продольной перегородки — это две отдельные коробки, стоящие рядом. ` +
        `Перегородка связывает их в коробчатую балку; без неё остров ведёт по диагонали.`,
    });
  }

  return out;
}

// ─── R94 · заготовка столешницы острова ───────────────────────────────────────────────────────

export interface TopStock {
  /** сколько нужно */
  needLengthMm: number;
  needWidthMm: number;
  /** что есть на складе */
  stockLengthMm: number;
  stockWidthMm: number;
  /** объявлен ли продольный шов на стяжках */
  longitudinalJoint?: boolean;
}

export interface StockAdvice {
  fits: boolean;
  problems: IslandProblem[];
  /** что предложить вместо: заказная плита или шов */
  jumbo: { lengthMm: number; widthMm: number };
}

/**
 * R94.1 — ловушка постформинга 600.
 *
 * Стандартная полоса в Ташкенте — 600 в ширину. Остров требует 900–1200. Сюда её не положить
 * никак, и узнать об этом надо ДО заказа, а не когда привезли.
 *
 * Но отказ — не единственный выход, и это важно: мастер вправе склеить из двух полос с
 * продольным швом на стяжках. Движок должен посчитать этот вариант, а не упереться.
 */
export function checkTopStock(t: TopStock, s = ISL): StockAdvice {
  const jumbo = { lengthMm: s.jumboLengthMm, widthMm: s.jumboWidthMm };
  const fits = t.needLengthMm <= t.stockLengthMm && t.needWidthMm <= t.stockWidthMm;
  if (fits) return { fits: true, problems: [], jumbo };

  if (t.longitudinalJoint && t.needWidthMm <= t.stockWidthMm * 2) {
    return {
      fits: true, jumbo,
      problems: [{
        law: "ISLAND-TOP-STOCK",
        setting: "things/materials/",
        detail:
          `столешница ${t.needWidthMm}мм шире полосы ${t.stockWidthMm}мм, но объявлен ` +
          `продольный шов: две полосы на стяжках. Шов пойдёт вдоль острова — учтите, что он ` +
          `будет виден, и поставьте его не под мойкой.`,
      }],
    };
  }

  return {
    fits: false, jumbo,
    problems: [{
      law: "ISLAND-TOP-STOCK",
      setting: "things/materials/",
      detail:
        `столешница ${t.needLengthMm}×${t.needWidthMm}мм не ложится на полосу ` +
        `${t.stockLengthMm}×${t.stockWidthMm}мм. Стандартный постформинг идёт шириной ` +
        `${t.stockWidthMm} — для острова его не хватает никак. Варианты: заказная плита ` +
        `${jumbo.lengthMm}×${jumbo.widthMm}, двусторонний постформинг нужной ширины, ` +
        `или продольный шов на стяжках — объявите его, и движок посчитает.`,
    }],
  };
}
