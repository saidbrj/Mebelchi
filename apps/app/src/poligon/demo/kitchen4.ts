// ПОЛИГОН · Kitchen #4 — шеф-остров и пенальная группа. Четвёртая работа корпуса.
//
// Первая кухня, у которой есть мебель, НЕ СТОЯЩАЯ У СТЕНЫ. До сих пор каждый лист опирался на
// стену: она задавала глубину, держала от опрокидывания и прятала заднюю сторону. Остров не
// получает ничего из этого даром.
//
//        ┌──────────────────────────────────────┐
//        │  стена-пеналы  (добор 50 + три 600)  │   потолок 2700
//        └──────────────────────────────────────┘
//
//                ┌───────────── рабочая ────────────┐   560
//                ├──── зазор 74 · трубы, кабель ────┤    74
//                ├──────────── хребет 16 ───────────┤    16
//                └───────────── столовая ───────────┘   350
//                                                      ─────
//                                                       1000 габарит
//
// Три вещи, которых не было ни в одной из трёх предыдущих:
//
//   1. Остров глубиной 1000 — это ДВА ряда спиной к спине. Направляющих глубже 650 в ходовых
//      каталогах нет, поэтому «один глубокий ящик» физически не собирается. Между рядами идёт
//      зазор под канализацию, силовую линию варочной и плоский воздуховод.
//   2. Столешница 1200 в ширину не ложится на постформинговую полосу 600 никак. Движок это
//      ловит ДО заказа и предлагает выходы, а не упирается.
//   3. Пенал холодильника — это дымоход: воздух входит решёткой в цоколе и выходит наверху.
//      Полка во всю глубину режет канал поперёк, поэтому полки в этом отсеке — ДРУГАЯ деталь.

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type LineId, type Opening, type Segment, type Sheet, type SheetProfile,
} from "../model/sheet";
import type { Role } from "../model/roles";
import type { CabinetFill, FillPart } from "../model/fill";
import { ISLAND, TALL } from "../model/settings";
import type { DualDepth, TipInput, OverhangInput, BackInput } from "../model/island";
import { reliefShelf } from "../model/tall";
import type { Chimney, TallLoad, LiftClearance } from "../model/tall";
import type { DropIn, UnderCarcass } from "../model/dropin";
import { STANDARDS } from "./kitchen1";

// ─── [1] стена пеналов ────────────────────────────────────────────────────────────────────────

/** Потолок 2700 — ташкентская новостройка. Пеналы 2100, над ними антресоль, и остаётся зазор. */
export const CEILING_MM = 2700;
export const TALL_TOP_MM = STANDARDS.plinthMm + 2100;   // 2250
export const ANTRESOL_TOP_MM = 2600;
/** Сколько остаётся подъёмнику антресоли до потолка. */
export const LIFT_HEADROOM_MM = CEILING_MM - ANTRESOL_TOP_MM;

/** Добор к стене: без него дверь холодильника не отходит за 90° и полки не вынимаются. */
export const SCRIBE_MM = TALL.applianceScribeMm;

export const LINEUP_TALL = [
  { w: 600, id: "t-холодильник" },
  { w: 600, id: "t-духовка" },
  { w: 600, id: "t-кладовая" },
] as const;

export const WALL_TALL: Opening = {
  width: SCRIBE_MM + LINEUP_TALL.reduce((n, c) => n + c.w, 0),
  height: CEILING_MM,
  ends: { left: "against-wall", right: "against-wall" },
};

// ─── [2] остров ───────────────────────────────────────────────────────────────────────────────

/** Габарит по глубине. Из него вычитаются два ряда и хребет — остаток и есть шахта. */
export const ISLAND_DEPTH_MM = 1000;
export const WORKING_DEPTH_MM = 560;
export const DINING_DEPTH_MM = ISLAND.diningDepthMm;

export const DUAL: DualDepth = {
  totalMm: ISLAND_DEPTH_MM,
  workingMm: WORKING_DEPTH_MM,
  diningMm: DINING_DEPTH_MM,
  spine: true,
};

/** Внутренний габарит между боковинами острова. Боковины объявлены отдельно — см. [4]. */
export const ISLAND_INNER_MM = 2400;
export const ISLAND_OUTER_MM = ISLAND_INNER_MM + 2 * 16;   // 2432

/** Свес под барные места — со стороны столовой. */
export const OVERHANG_MM = 200;
export const TOP_LENGTH_MM = ISLAND_OUTER_MM;
export const TOP_WIDTH_MM = ISLAND_DEPTH_MM + OVERHANG_MM;

/** Постформинг едет полосой 600 в ширину и 4100 в длину. Это и есть ловушка. */
export const STRIP = { stockLengthMm: 4100, stockWidthMm: 600 };

export const LINEUP_WORK = [
  { w: 900, id: "i-варочная" },
  { w: 600, id: "i-мойка" },
  { w: 900, id: "i-ящики" },
] as const;

export const LINEUP_DINE = [
  { w: 900, id: "d-полки-лево" },
  { w: 600, id: "d-ниша" },
  { w: 900, id: "d-полки-право" },
] as const;

/**
 * Боковины острова принадлежат ОБОИМ рядам сразу: одна плита 1000 в глубину закрывает и рабочий
 * ряд, и столовый. Поэтому оба листа объявляют свои концы как `against-wall` — граница здесь
 * чужая конструкция, ровно в том смысле, в каком у стены ею была стена.
 */
export const ISLAND_ROW: Opening = {
  width: ISLAND_INNER_MM, height: 2400,
  ends: { left: "against-wall", right: "against-wall" },
};

// ─── [3] что именно проверяется ───────────────────────────────────────────────────────────────

/** Пенал холодильника. Решётка цоколя, выход наверху, отсек техники без ХДФ, полки усечены. */
export const CHIMNEY: Chimney = {
  widthMm: 600,
  plinthGrilleHeightMm: 40,
  topExhaust: true,
  applianceBack: false,
  shelvesTruncated: true,
};

/**
 * Отсек духовки. Прибор стоит НА полке, поэтому полка остаётся полной 560: встраиваемый шкаф
 * опирается на неё почти всей длиной. Воздух идёт двумя угловыми вырезами у задней кромки — их
 * берут на форматно-раскроечной, а не на фрезере, которого в половине цехов нет.
 */
export const OVEN_BAY: Chimney = {
  widthMm: 600, plinthGrilleHeightMm: 40, topExhaust: true,
  applianceBack: false, applianceOnShelf: true, shelvesTruncated: false,
};

/** Полка под духовкой: полная глубина, два выреза, и полоса под прибор между ними. */
export const ovenShelf = (p: SheetProfile) =>
  reliefShelf(WORKING_DEPTH_MM, 600 - 2 * p.boardMm);

/** Пенал духовки: корпус + духовка + СВЧ + наполнение. */
export const OVEN_LOAD: TallLoad = {
  widthMm: 600, totalKg: 165, legs: TALL.legsHeavyCount, outerLegOffsetMm: 15,
};

/** Подъёмник антресоли. Дуга — свойство механизма, читается из его файла. */
export const liftAt = (sweepMm: number): LiftClearance =>
  ({ sweepMm, availableMm: LIFT_HEADROOM_MM });

/**
 * Опрокидывание. Вес честный: корпуса двух рядов ~120, столешница ЛДСП-38 2432×1200 ~80.
 * Цоколь утоплен на 50 — и это ОТНИМАЕТ устойчивость, а не добавляет.
 */
export const TIP: TipInput = {
  depthMm: ISLAND_DEPTH_MM,
  deadWeightKg: 200,
  drawers: [
    { loadKg: 20, extensionMm: 500 },
    { loadKg: 20, extensionMm: 500 },
    { loadKg: 20, extensionMm: 500 },
  ],
  plinthSetbackMm: 50,
  withChild: true,
};

export const OVERHANG: OverhangInput = {
  material: "ldsp-38",
  overhangMm: OVERHANG_MM,
  runLengthMm: ISLAND_OUTER_MM,
};

/** Спиной к спине: заднюю сторону закрывают мелкие шкафы столового ряда, а не облицовка. */
export const BACK: BackInput = { kind: "cabinets" };

// ─── [4] детали, которых нет в фасадной проекции ───────────────────────────────────────────────
//
// Лист — это ФАСАД. Хребет и боковины острова лежат в глубину, поперёк листа, и вывести их из
// него нельзя: у листа нет третьего измерения. Поэтому они объявлены здесь явно — это честное
// ограничение модели, а не забытые детали. В раскрой они уходят наравне со всеми.

/**
 * Объявлены — но НЕ в обход шлюза. Раньше эти три ехали прямо в раскрой мимо P6: предел
 * заготовки, транспортный предел и текстура их не касались. Теперь они входят в `compile` как
 * `declared` и проходят ровно тот же путь, что любая деталь, выведенная из листа.
 */
export const islandExtras = (p: SheetProfile): FillPart[] => [
  {
    cabinet: "i-остров", role: "side", lengthMm: ISLAND_INNER_MM,
    widthMm: STANDARDS.baseCarcassMm, thicknessMm: ISLAND.spineThicknessMm,
    note: "хребет: продольная перегородка, связывает два ряда в коробчатую балку",
  },
  {
    cabinet: "i-остров", role: "side", lengthMm: STANDARDS.baseCarcassMm,
    widthMm: ISLAND_DEPTH_MM, thicknessMm: p.boardMm,
    note: "боковина острова слева, во всю глубину — на оба ряда сразу",
  },
  {
    cabinet: "i-остров", role: "side", lengthMm: STANDARDS.baseCarcassMm,
    widthMm: ISLAND_DEPTH_MM, thicknessMm: p.boardMm,
    note: "боковина острова справа, во всю глубину — на оба ряда сразу",
  },
];

// ─── [5] листы ────────────────────────────────────────────────────────────────────────────────

export interface Wall { sheet: Sheet; vs: LineId[]; boundariesMm: number[] }

const cell = (id: string, kind: "block" | "void" | "reserved",
              v0: LineId, v1: LineId, h0: LineId, h1: LineId) =>
  ({ id, kind, layer: "carcass" as const, bounds: { v0, v1, h0, h1 } });

const seg = (line: LineId, from: LineId, to: LineId, boards: 1 | 2, role: Role): Segment =>
  ({ line, from, to, boards, role });

/** Общий скелет: вертикали по раскладке, горизонтали по объявленным отметкам. */
function frame(opening: Opening, lineup: readonly { w: number; id: string }[],
               startAtMm: number, marks: [string, number][], p: SheetProfile) {
  let s = createSheet(opening, p);
  const m0 = resolvePositions(s).mm;
  const [left, right] = linesOn(s, "v", m0);
  const [floor, ceil] = linesOn(s, "h", m0);

  const H: Record<string, LineId> = { floor: floor!.id, ceil: ceil!.id };
  for (const [name, mm] of marks) {
    const r = addLine(s, "h", { kind: "authored", mm });
    s = r.sheet; H[name] = r.id;
  }

  const inner: LineId[] = [];
  let x = startAtMm;
  if (startAtMm > 0) {
    const r = addLine(s, "v", { kind: "authored", mm: startAtMm });
    s = r.sheet; inner.push(r.id);
  }
  for (const c of lineup.slice(0, -1)) {
    x += c.w;
    const r = addLine(s, "v", { kind: "authored", mm: x });
    s = r.sheet; inner.push(r.id);
  }
  const vs = [left!.id, ...inner, right!.id];
  return { s, H, vs, carcassV: startAtMm > 0 ? vs.slice(1) : vs };
}

/**
 * Стена пеналов. Две коробки друг на друге: пенал и антресоль. Боковины РАЗРЕЗАНЫ на отметке
 * 2250 — сплошная шла бы 2450 и не прошла бы ни в лифт, ни под транспортный предел 2400.
 */
export function wallTall(p: SheetProfile): Wall {
  const { s: s0, H, vs, carcassV } = frame(
    WALL_TALL, LINEUP_TALL, SCRIBE_MM,
    [["plinth", STANDARDS.plinthMm], ["tall", TALL_TOP_MM], ["antresol", ANTRESOL_TOP_MM]], p,
  );
  const first = carcassV[0]!, last = carcassV[carcassV.length - 1]!;

  const segments: Segment[] = [
    ...s0.segments.filter((q) => q.line !== vs[0] && q.line !== vs[vs.length - 1]),
    ...carcassV.map((v) => seg(v, H.plinth!, H.tall!, 1, "side")),
    ...carcassV.map((v) => seg(v, H.tall!, H.antresol!, 1, "side")),
    seg(H.plinth!, first, last, 1, "bottom"),
    seg(H.tall!, first, last, 1, "top"),
    seg(H.antresol!, first, last, 1, "top"),
    seg(H.floor!, first, last, 1, "plinth"),
    // добор к стене: щит на всю высоту пенала, он же закрывает щель у стены
    seg(vs[0]!, H.plinth!, H.tall!, 1, "filler"),
  ];

  const blocks = [
    cell("добор-цоколь", "void", vs[0]!, vs[1]!, H.floor!, H.plinth!),
    cell("добор", "reserved", vs[0]!, vs[1]!, H.plinth!, H.tall!),
    cell("добор-верх", "void", vs[0]!, vs[1]!, H.tall!, H.ceil!),
  ];
  LINEUP_TALL.forEach((c, i) => {
    const v0 = carcassV[i]!, v1 = carcassV[i + 1]!;
    blocks.push(
      cell(`${c.id}-цоколь`, "void", v0, v1, H.floor!, H.plinth!),
      cell(c.id, c.id.includes("духовка") || c.id.includes("холодильник") ? "reserved" : "block",
           v0, v1, H.plinth!, H.tall!),
      cell(`${c.id}-антресоль`, "block", v0, v1, H.tall!, H.antresol!),
      cell(`${c.id}-запотолок`, "void", v0, v1, H.antresol!, H.ceil!),
    );
  });

  return { sheet: normalizeSegments({ ...s0, segments, blocks }), vs, boundariesMm: [] };
}

/** Ряд острова — рабочий или столовый. Оба листа плоские и друг о друге не знают. */
function islandRow(lineup: readonly { w: number; id: string }[], p: SheetProfile): Wall {
  const { s: s0, H, vs, carcassV } = frame(
    ISLAND_ROW, lineup, 0,
    [["plinth", STANDARDS.plinthMm], ["worktop", STANDARDS.worktopMm]], p,
  );
  const first = carcassV[0]!, last = carcassV[carcassV.length - 1]!;

  const segments: Segment[] = [
    ...s0.segments.filter((q) => q.line !== vs[0] && q.line !== vs[vs.length - 1]),
    ...carcassV.map((v) => seg(v, H.plinth!, H.worktop!, 1, "side")),
    seg(H.plinth!, first, last, 1, "bottom"),
    seg(H.worktop!, vs[0]!, vs[vs.length - 1]!, 1, "worktop"),
    seg(H.floor!, first, last, 1, "plinth"),
  ];

  const blocks: ReturnType<typeof cell>[] = [];
  lineup.forEach((c, i) => {
    const v0 = carcassV[i]!, v1 = carcassV[i + 1]!;
    blocks.push(
      cell(`${c.id}-цоколь`, "void", v0, v1, H.floor!, H.plinth!),
      cell(c.id, "block", v0, v1, H.plinth!, H.worktop!),
      cell(`${c.id}-верх`, "void", v0, v1, H.worktop!, H.ceil!),
    );
  });

  return { sheet: normalizeSegments({ ...s0, segments, blocks }), vs, boundariesMm: [] };
}

export const islandWork = (p: SheetProfile): Wall => islandRow(LINEUP_WORK, p);
export const islandDine = (p: SheetProfile): Wall => islandRow(LINEUP_DINE, p);

// ─── [6] наполнение ───────────────────────────────────────────────────────────────────────────

const BASE_H = STANDARDS.worktopMm - STANDARDS.plinthMm;
const TALL_H = TALL_TOP_MM - STANDARDS.plinthMm;
const ANTRESOL_H = ANTRESOL_TOP_MM - TALL_TOP_MM;

/** Глубина полки в отсеке техники — усечённая, чтобы не резать шахту поперёк. */
export const CHIMNEY_SHELF_DEPTH_MM = WORKING_DEPTH_MM - TALL.chimneySetbackMm;

export function kitchen4Fill(p: SheetProfile): CabinetFill[] {
  const t = p.boardMm;
  const box = (id: string, widthMm: number, heightMm: number, depthMm: number,
               fill: CabinetFill["fill"], back = true): CabinetFill =>
    ({ id, widthMm, heightMm, depthMm, sideMm: { left: t, right: t }, fill, back });

  return [
    // ── пеналы ──────────────────────────────────────────────────────────────────────────────
    // холодильник: ХДФ в отсеке техники ОТКЛЮЧЕНА — она глушит шахту
    box("t-холодильник", 600, TALL_H, WORKING_DEPTH_MM, { kind: "appliance-door" }, false),
    box("t-духовка", 600, TALL_H, WORKING_DEPTH_MM, [
      { what: { kind: "appliance-door" }, heightMm: 1200 },
      { what: { kind: "drawers", count: 2 } },
    ], false),
    box("t-кладовая", 600, TALL_H, WORKING_DEPTH_MM, [
      { what: { kind: "door", leaves: 1 }, heightMm: 1300 },
      { what: { kind: "shelves", count: 3 } },
    ]),

    // ── антресоли: подъёмник, потому что дверь на петлях над головой не открыть ──────────────
    box("t-холодильник-антресоль", 600, ANTRESOL_H, 300, { kind: "door", leaves: 1 }),
    box("t-духовка-антресоль", 600, ANTRESOL_H, 300, { kind: "door", leaves: 1 }),
    box("t-кладовая-антресоль", 600, ANTRESOL_H, 300, { kind: "door", leaves: 1 }),

    // ── остров, рабочий ряд ─────────────────────────────────────────────────────────────────
    // R97 нашёл это в уже сданной работе: под индукционной панелью стоял РАБОЧИЙ верхний ящик.
    // Корпус панели опускается на 50, но охлаждению силовых ключей нужен приток до 75 — ящик
    // глушил его. Сверху теперь фальш-панель, как под мойкой; ниже ящики остаются.
    box("i-варочная", 900, BASE_H, WORKING_DEPTH_MM, [
      { what: { kind: "false-front" }, heightMm: 140 },
      { what: { kind: "drawers", count: 2 } },
    ], false),
    box("i-мойка", 600, BASE_H, WORKING_DEPTH_MM, [
      { what: { kind: "false-front" }, heightMm: 140 },
      { what: { kind: "door", leaves: 2 } },
    ], false),
    box("i-ящики", 900, BASE_H, WORKING_DEPTH_MM, { kind: "drawers", count: 3 }, false),

    // ── остров, столовый ряд: смотрит в гостиную, поэтому открытые полки ─────────────────────
    box("d-полки-лево", 900, BASE_H, DINING_DEPTH_MM, { kind: "shelves", count: 2 }, false),
    box("d-ниша", 600, BASE_H, DINING_DEPTH_MM, { kind: "open" }, false),
    box("d-полки-право", 900, BASE_H, DINING_DEPTH_MM, { kind: "shelves", count: 2 }, false),
  ];
}

// ─── [7] врезка · R97 ─────────────────────────────────────────────────────────────────────────
//
// Мойка и варечная объявлены НА ПРОБЕГЕ рабочего ряда, в его координатах: вырез принадлежит
// столешнице, а не шкафу под ним. Вниз он проецируется сам.

/** Раскладка рабочего ряда: 900 варочная · 600 мойка · 900 ящики. */
const WORK_BOUNDARIES_MM = [900, 1500];

/** Чаша 500 в тумбе 600: по 50 до каждой стойки — ровно объявленный минимум, не меньше. */
export const SINK: DropIn = {
  id: "мойка-500", kind: "sink",
  fromMm: 950, toMm: 1450, frontSetbackMm: 55, depthMm: 430,
};

/** Индукция 560 в тумбе 900. */
export const HOB: DropIn = {
  id: "индукция-560", kind: "hob",
  fromMm: 170, toMm: 730, frontSetbackMm: 60, depthMm: 490,
};

/**
 * Что стоит под столешницей рабочего ряда. Верх коробов объявлен явно: фальш-панель 140 сверху
 * и у мойки, и у варочной — она и есть тот зазор, которого требуют сифон и охлаждение панели.
 */
export const workUnderCarcass = (p: SheetProfile): UnderCarcass => ({
  depthMm: WORKING_DEPTH_MM,
  partitions: WORK_BOUNDARIES_MM.map((atMm, i) => ({
    atMm, thicknessMm: p.boardMm, ref: `M0${i + 1}|M0${i + 2}`, seam: `шов-${atMm}`,
  })),
  // под мойкой горизонтали нет вовсе: там распашные двери, а фальш-панель — это фасад, не
  // деталь каркаса. Под варочной верх короба на 140 — ровно та фальш-панель, что R97 потребовал.
  shelves: [
    { id: "короб-варочная", fromMm: 16, toMm: 884, belowMm: 140, kind: "drawer-box" },
    { id: "короб-ящики", fromMm: 1516, toMm: 2384, belowMm: 40, kind: "drawer-box" },
  ],
});
