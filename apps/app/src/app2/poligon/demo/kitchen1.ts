// ПОЛИГОН · Kitchen #1 — Golden Master из R74 §4.
//
// Не демонстрация, а ПРИЁМОЧНЫЙ ТЕСТ. Одна кухня, зафиксированная целиком: стена → типы →
// раскрой. Смысл золотого мастера в том, что он замораживает наблюдаемое правильное поведение
// и ловит непреднамеренные изменения — любое расхождение завтра будет видно как диff.
//
// Спецификация R74 §4.3, дословно: семь тумб слева направо, в сумме ровно 4500.
//   400  выкатная под дверью
//   600  духовка встроенная, варочная над ней
//   800  ящики, пакет из трёх
//   600  посудомойка встроенная
//   600  мойка, фальш-фасад
//   600  ящики, пакет из двух
//   900  ящики под кастрюли
//
// Главная проверка — §4.4 B: столешница 4500 из заготовки короче требует шва, и шов обязан лечь
// на x = 3000, ровно на границу между мойкой и следующей тумбой. Это канонический регрессионный
// тест «шов не режет шкаф»: 3000 попадает на стык, а не в середину корпуса.

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type LineId, type Opening, type Segment, type Sheet, type SheetProfile,
} from "../model/sheet";
import type { Role } from "../model/roles";

/** R74 §4.2 — стена одним прямым прогоном, без препятствий, чтобы тест был детерминирован. */
export const OPENING: Opening = {
  width: 4500,
  height: 2400,
  ends: { left: "against-wall", right: "against-wall" },
};

/** R74 §4.2 — стандарты цеха для этого заказа. */
export const STANDARDS = {
  plinthMm: 150,
  baseCarcassMm: 720,
  /** 150 + 720 — и это ровно та отметка, на которой профиль ставит стяжную полку */
  worktopMm: 870,
  upperLowMm: 1450,
  upperTopMm: 2100,
  /** центр подводки воды, под мойкой */
  servicesAtMm: 2700,
};

/** R74 §4.3 — ширины слева направо. Сумма проверяется тестом, а не глазами. */
export const LINEUP = [
  { w: 400, id: "base-pullout", type: "BaseDoor" },
  { w: 600, id: "oven-housing", type: "OvenHousingBase" },
  { w: 800, id: "drawers-3", type: "BaseDrawerPack" },
  { w: 600, id: "dishwasher", type: "IntegratedDishwasherFrontBase" },
  { w: 600, id: "sink-base", type: "SinkBase" },
  { w: 600, id: "drawers-2", type: "BaseDrawerPack" },
  { w: 900, id: "pan-drawers", type: "BaseDrawerPack" },
] as const;

/** Верхний ряд: шкафы над первыми тремя, вытяжка над варочной, дальше пусто. */
const UPPER: Record<string, "unit" | "hood" | "none"> = {
  "base-pullout": "unit",
  "oven-housing": "hood",
  "drawers-3": "unit",
  dishwasher: "unit",
  "sink-base": "none",
  "drawers-2": "none",
  "pan-drawers": "none",
};

export interface Kitchen1 {
  sheet: Sheet;
  /** вертикальные линии по нарастающей, включая обе стены */
  vs: LineId[];
  hs: Record<string, LineId>;
  /** границы тумб в мм — то, на что обязан сесть шов */
  boundariesMm: number[];
}

export function kitchen1(p: SheetProfile): Kitchen1 {
  let s = createSheet(OPENING, p);
  const m0 = resolvePositions(s).mm;
  const [wallL, wallR] = linesOn(s, "v", m0);
  const [floor, ceil] = linesOn(s, "h", m0);

  // горизонтали
  const H: Record<string, LineId> = { floor: floor!.id, ceil: ceil!.id };
  for (const [name, mm] of [
    ["plinth", STANDARDS.plinthMm],
    ["worktop", STANDARDS.worktopMm],
    ["upperLow", STANDARDS.upperLowMm],
    ["upperTop", STANDARDS.upperTopMm],
  ] as const) {
    const r = addLine(s, "h", { kind: "authored", mm });
    s = r.sheet; H[name] = r.id;
  }

  // вертикали: границы тумб по нарастающей
  const boundariesMm: number[] = [];
  const inner: LineId[] = [];
  let x = 0;
  for (const c of LINEUP.slice(0, -1)) {
    x += c.w;
    boundariesMm.push(x);
    const r = addLine(s, "v", { kind: "authored", mm: x });
    s = r.sheet; inner.push(r.id);
  }
  const vs = [wallL!.id, ...inner, wallR!.id];

  const seg = (line: LineId, from: LineId, to: LineId, boards: 1 | 2, role: Role): Segment =>
    ({ line, from, to, boards, role });

  const segments: Segment[] = [
    // createSheet объявил наружные вертикали пустыми (стена с обеих сторон); крайние тумбы
    // всё равно несут свои боковины, поэтому эти сегменты заменяются
    ...s.segments.filter((x) => x.line !== wallL!.id && x.line !== wallR!.id),

    // боковины корпусов: от дна корпуса до столешницы, на каждой границе и по краям
    ...vs.map((v) => seg(v, H.plinth!, H.worktop!, 1, "side")),
    // дно корпусов — сплошным прогоном; боковины его режут по рангу
    seg(H.plinth!, vs[0]!, vs[vs.length - 1]!, 1, "bottom"),
    // столешница поверх всего ряда
    seg(H.worktop!, vs[0]!, vs[vs.length - 1]!, 1, "worktop"),
    // цоколь — свой слой, поэтому просто доска на линии пола
    seg(H.floor!, vs[0]!, vs[vs.length - 1]!, 1, "plinth"),

    // верхний ряд: боковины только там, где шкафы есть
    ...vs.slice(0, 5).map((v) => seg(v, H.upperLow!, H.upperTop!, 1, "side")),
    seg(H.upperLow!, vs[0]!, vs[4]!, 1, "bottom"),
    seg(H.upperTop!, vs[0]!, vs[4]!, 1, "top"),
  ];

  // блоки: 7 колонок × 5 рядов, каркасный слой обязан быть полным
  const cell = (
    id: string, kind: "block" | "void" | "reserved",
    v0: LineId, v1: LineId, h0: LineId, h1: LineId, tags?: string[],
  ) => ({ id, kind, layer: "carcass" as const, bounds: { v0, v1, h0, h1 }, ...(tags ? { tags } : {}) });

  const blocks = LINEUP.flatMap((c, i) => {
    const v0 = vs[i]!, v1 = vs[i + 1]!;
    const upper = UPPER[c.id]!;
    return [
      cell(`${c.id}-цоколь`, "void", v0, v1, H.floor!, H.plinth!),
      cell(c.id, c.id === "dishwasher" ? "reserved" : "block", v0, v1, H.plinth!, H.worktop!, [c.type]),
      cell(`${c.id}-фартук`, "void", v0, v1, H.worktop!, H.upperLow!),
      cell(`${c.id}-верх`,
           upper === "unit" ? "block" : upper === "hood" ? "reserved" : "void",
           v0, v1, H.upperLow!, H.upperTop!, upper === "hood" ? ["hood"] : undefined),
      cell(`${c.id}-тепа`, "void", v0, v1, H.upperTop!, H.ceil!),
    ];
  });

  return { sheet: normalizeSegments({ ...s, segments, blocks }), vs, hs: H, boundariesMm };
}


// ─── наполнение (R86) ─────────────────────────────────────────────────────────────────────────
//
// До этого места описан КОНТУР стены: боковины, дно, столешница. Всё, что стоит внутри тумб,
// не было объявлено вовсе — поэтому Kitchen #1 и давала 22 детали каркаса и ни одного фасада.
//
// Здесь объявляется начинка. Ни одного размера: только что стоит внутри. Ширины, высоты, зазоры
// и длины направляющих выводятся из геометрии и файлов — так и задумано.

import type { CabinetFill } from "../model/fill";

const BASE_H = STANDARDS.worktopMm - STANDARDS.plinthMm;   // корпус базы, 720
const UPPER_H = STANDARDS.upperTopMm - STANDARDS.upperLowMm; // корпус верха, 650

/** Стойка общая, поэтому шкафу принадлежит половина каждой — это и есть контракт R69. */
const side = (t: number) => ({ left: t, right: t });

export function kitchen1Fill(p: SheetProfile): CabinetFill[] {
  const t = p.boardMm;
  const base = (id: string, widthMm: number, fill: CabinetFill["fill"], back = true): CabinetFill =>
    ({ id, widthMm, heightMm: BASE_H, depthMm: 560, sideMm: side(t), fill, back });
  const upper = (id: string, widthMm: number, fill: CabinetFill["fill"]): CabinetFill =>
    ({ id, widthMm, heightMm: UPPER_H, depthMm: 300, sideMm: side(t), fill, back: true });

  return [
    // ── нижний ряд, слева направо, как в R74 §4.3 ───────────────────────────────────────────
    base("base-pullout", 400, { kind: "door", leaves: 1 }),
    // духовка сама себе фасад: её дверь принадлежит технике и в раскрой не идёт
    base("oven-housing", 600, { kind: "appliance-door" }, false),
    base("drawers-3", 800, { kind: "drawers", count: 3 }),
    base("dishwasher", 600, { kind: "appliance-door" }, false),
    // мойка: фальш-панель сверху (за ней чаша), распашные двери под ней
    base("sink-base", 600, [
      { what: { kind: "false-front" }, heightMm: 140 },
      { what: { kind: "door", leaves: 2 } },
    ]),
    base("drawers-2", 600, { kind: "drawers", count: 2 }),
    base("pan-drawers", 900, { kind: "drawers", count: 2 }),

    // ── верхний ряд ─────────────────────────────────────────────────────────────────────────
    upper("up-pullout", 400, [
      { what: { kind: "door", leaves: 1 } },
      { what: { kind: "shelves", count: 1 }, heightMm: 0 },
    ]),
    upper("up-drawers-3", 800, [
      { what: { kind: "door", leaves: 2 } },
      { what: { kind: "shelves", count: 2 }, heightMm: 0 },
    ]),
    upper("up-dishwasher", 600, [
      { what: { kind: "door", leaves: 1 } },
      { what: { kind: "shelves", count: 1 }, heightMm: 0 },
    ]),
    // над варочной — вытяжка: ни фасада, ни полок
  ];
}
