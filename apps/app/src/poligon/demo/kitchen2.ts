// ПОЛИГОН · Kitchen #2 — Г-образная. Вторая работа корпуса.
//
// Kitchen #1 доказала прямую стену. Здесь проверяется то, ради чего строился R87: две стены,
// угол между ними, и НИ ОДНОГО трёхмерного объёма в этом углу.
//
// Стены остаются двумя обычными плоскими листами, которые движок уже умеет. Всё, что они знают
// друг о друге, — одно число: сколько места у края ведомой стены занял ведущий ряд вместе с
// доборным бруском. Ведущая стена про ведомую не знает вообще ничего.
//
// РАСКЛАДКА. Стена-окно (ведущая, 3600) доходит до угла и владеет им: её ряд идёт на всю длину,
// а последняя тумба — угловая, с глухой частью, уходящей за угол. Стена-дверь (ведомая, 2453)
// начинает свои шкафы после 600 глубины соседа плюс 53 бруска = 653, и на остаток 1800 встают
// ровно три шестисотки.
//
// 653 не выбрано, а посчитано: 600 + (фасад 18 + ручка 30 + запас 5). Возьми 50 «на глаз» —
// и ящик духовки на стене-двери найдёт ручку угловой тумбы на стене-окне.

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type LineId, type Opening, type Segment, type Sheet, type SheetProfile,
} from "../model/sheet";
import type { Role } from "../model/roles";
import type { CabinetFill } from "../model/fill";
import { minFillerMm, type CornerBinding } from "../model/corner";
import { STANDARDS } from "./kitchen1";

/** Ведущая стена: её ряд доходит до угла. */
export const WALL_A: Opening = {
  width: 3600, height: 2400, ends: { left: "against-wall", right: "against-wall" },
};

/** Ведомая: её шкафы начинаются после угла. */
export const WALL_B: Opening = {
  width: 2453, height: 2400, ends: { left: "against-wall", right: "against-wall" },
};

export const BINDING: CornerBinding = {
  leaderWall: "стена-окно",
  followerWall: "стена-дверь",
  angleDeg: 90,
  leaderDepthMm: 600,
  handles: "surface",
  miter: "EURO_MITER",
};

export const FILLER_MM = minFillerMm(BINDING.handles);

/** Слева направо по каждой стене. Сумма проверяется тестом, а не глазами. */
export const LINEUP_A = [
  { w: 600, id: "a-мойка", type: "SinkBase" },
  { w: 600, id: "a-пмм", type: "IntegratedDishwasherFrontBase" },
  { w: 800, id: "a-ящики", type: "BaseDrawerPack" },
  { w: 900, id: "a-кастрюли", type: "BaseDrawerPack" },
  { w: 700, id: "a-угол", type: "BlindCornerBase" },
] as const;

export const LINEUP_B = [
  { w: 600, id: "b-духовка", type: "OvenHousingBase" },
  { w: 600, id: "b-варочная", type: "BaseDrawerPack" },
  { w: 600, id: "b-шкаф", type: "BaseDoor" },
] as const;

export interface Wall {
  sheet: Sheet;
  vs: LineId[];
  boundariesMm: number[];
}

/** Одна стена: колонки по объявленным ширинам, начиная с `startAtMm`. */
function wall(
  opening: Opening, lineup: readonly { w: number; id: string }[],
  startAtMm: number, p: SheetProfile,
): Wall {
  let s = createSheet(opening, p);
  const m0 = resolvePositions(s).mm;
  const [left, right] = linesOn(s, "v", m0);
  const [floor, ceil] = linesOn(s, "h", m0);

  const H: Record<string, LineId> = { floor: floor!.id, ceil: ceil!.id };
  for (const [name, mm] of [
    ["plinth", STANDARDS.plinthMm], ["worktop", STANDARDS.worktopMm],
  ] as const) {
    const r = addLine(s, "h", { kind: "authored", mm });
    s = r.sheet; H[name] = r.id;
  }

  // угол ведомой стены — отдельная линия: за ней ставить нельзя
  const inner: LineId[] = [];
  const boundariesMm: number[] = [];
  let x = startAtMm;
  if (startAtMm > 0) {
    const r = addLine(s, "v", { kind: "authored", mm: startAtMm });
    s = r.sheet; inner.push(r.id); boundariesMm.push(startAtMm);
  }
  for (const c of lineup.slice(0, -1)) {
    x += c.w;
    boundariesMm.push(x);
    const r = addLine(s, "v", { kind: "authored", mm: x });
    s = r.sheet; inner.push(r.id);
  }
  const vs = [left!.id, ...inner, right!.id];

  const seg = (line: LineId, from: LineId, to: LineId, boards: 1 | 2, role: Role): Segment =>
    ({ line, from, to, boards, role });

  // боковины стоят только там, где есть шкафы — то есть начиная с первой границы
  const carcassV = startAtMm > 0 ? vs.slice(1) : vs;

  const segments: Segment[] = [
    ...s.segments.filter((q) => q.line !== left!.id && q.line !== right!.id),
    ...carcassV.map((v) => seg(v, H.plinth!, H.worktop!, 1, "side")),
    seg(H.plinth!, carcassV[0]!, carcassV[carcassV.length - 1]!, 1, "bottom"),
    // столешница идёт на ВСЮ стену, включая угол: там она и стыкуется с соседней
    seg(H.worktop!, vs[0]!, vs[vs.length - 1]!, 1, "worktop"),
    seg(H.floor!, carcassV[0]!, carcassV[carcassV.length - 1]!, 1, "plinth"),
  ];

  const cell = (id: string, kind: "block" | "void" | "reserved",
                v0: LineId, v1: LineId, h0: LineId, h1: LineId) =>
    ({ id, kind, layer: "carcass" as const, bounds: { v0, v1, h0, h1 } });

  const blocks = [] as ReturnType<typeof cell>[];
  // зона угла у ведомой стены — пустая: её занял сосед
  if (startAtMm > 0) {
    blocks.push(
      cell("угол-цоколь", "void", vs[0]!, vs[1]!, H.floor!, H.plinth!),
      cell("угол-занят", "reserved", vs[0]!, vs[1]!, H.plinth!, H.worktop!),
      cell("угол-верх", "void", vs[0]!, vs[1]!, H.worktop!, H.ceil!),
    );
  }
  lineup.forEach((c, i) => {
    const v0 = carcassV[i]!, v1 = carcassV[i + 1]!;
    blocks.push(
      cell(`${c.id}-цоколь`, "void", v0, v1, H.floor!, H.plinth!),
      cell(c.id, c.id.includes("пмм") || c.id.includes("духовка") ? "reserved" : "block",
           v0, v1, H.plinth!, H.worktop!),
      cell(`${c.id}-верх`, "void", v0, v1, H.worktop!, H.ceil!),
    );
  });

  return { sheet: normalizeSegments({ ...s, segments, blocks }), vs, boundariesMm };
}

export const wallA = (p: SheetProfile): Wall => wall(WALL_A, LINEUP_A, 0, p);
export const wallB = (p: SheetProfile): Wall =>
  wall(WALL_B, LINEUP_B, BINDING.leaderDepthMm + FILLER_MM, p);

// ─── наполнение ───────────────────────────────────────────────────────────────────────────────

const BASE_H = STANDARDS.worktopMm - STANDARDS.plinthMm;

export function kitchen2Fill(p: SheetProfile): CabinetFill[] {
  const t = p.boardMm;
  const base = (id: string, widthMm: number, fill: CabinetFill["fill"], back = true): CabinetFill =>
    ({ id, widthMm, heightMm: BASE_H, depthMm: 560, sideMm: { left: t, right: t }, fill, back });

  return [
    // стена-окно
    base("a-мойка", 600, [
      { what: { kind: "false-front" }, heightMm: 140 },
      { what: { kind: "door", leaves: 2 } },
    ]),
    base("a-пмм", 600, { kind: "appliance-door" }, false),
    base("a-ящики", 800, { kind: "drawers", count: 3 }),
    base("a-кастрюли", 900, { kind: "drawers", count: 2 }),
    // угловая тумба: одна дверь на доступную часть, глухая часть за углом деталей не даёт
    base("a-угол", 700, { kind: "door", leaves: 1 }),

    // стена-дверь
    base("b-духовка", 600, { kind: "appliance-door" }, false),
    base("b-варочная", 600, { kind: "drawers", count: 2 }),
    base("b-шкаф", 600, { kind: "door", leaves: 2 }),
  ];
}
