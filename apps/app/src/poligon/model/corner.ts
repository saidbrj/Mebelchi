// ПОЛИГОН · R87 — угол и вторая стена.
//
// 85% кухонь в СНГ — Г-образные или П-образные. До сих пор движок знал одну плоскую стену.
//
// РЕШЕНИЕ, и оно про то, ЧЕГО здесь нет. Соблазн — сделать угол трёхмерным: два объёма, булевы
// операции, поиск пересечений. Именно на этом Саидислом застрял на месяцы: в 3D общая боковина
// базы (560 глубиной) и навесного (300) — не параллелепипед, а ступенчатый многогранник, и
// каждая попытка подвинуть шкаф кончалась либо наползанием, либо вылетом из сетки.
//
// Стены остаются ПЛОСКИМИ 2D-листами. Каждая знает про другую ровно одно: сколько места у её
// края занял сосед. Это `CornerBinding` — контракт в одну структуру, без единого булева
// пересечения, и вся математика драга, снапа и упорядочивания граней (T1–T5) работает дальше
// без изменений.
//
// ЧТО СТОИТ В САМОМ УГЛУ. Между двумя ортогональными рядами обязан быть доборный брусок, и его
// ширина — не украшение. Фасад стены A открывается ручкой наружу; ящик стены B выезжает мимо
// него. Без бруска ручка и ящик встречаются. Ширина бруска = толщина фасада + вылет ручки +
// запас, и все три числа в файле.
//
// И глубины ярусов разные — низ 560, верх 300 — поэтому резерв угла ЛЕСТНИЦА, а не прямоугольник
// (это уже сделано в ports.ts, R69 поправка 1; здесь оно используется).

import { CORNER, STRUCTURAL } from "./settings";
import type { HeightBand } from "./settings";
import { reserveCorner, reservedAt, type CornerReservation } from "./ports";

export type MiterKind = "EURO_MITER" | "ALU_PROFILE" | "STRAIGHT";
export type HandleKind = "surface" | "gola" | "push";

export interface CornerBinding {
  /** ведущая стена: её ряд доходит до угла и владеет им */
  leaderWall: string;
  /** ведомая: начинает свои шкафы ПОСЛЕ занятого угла */
  followerWall: string;
  angleDeg: 90;
  /** глубина ведущего ряда в поясе, где встречаются: её и занимает угол */
  leaderDepthMm: number;
  /** какие ручки на фасадах — от этого зависит, бить ли по ящику соседа */
  handles: HandleKind;
  miter: MiterKind;
}

export interface CornerProblem {
  law: string;
  detail: string;
  setting: string;
}

// ─── доборный брусок ──────────────────────────────────────────────────────────────────────────

/**
 * R87 §1.2 — минимальная ширина доборного бруска.
 *
 * Накладной фасад: толщина фасада + вылет ручки + запас. Ручка стены A торчит в проём, куда
 * выезжает ящик стены B, и «впритык» тут означает «задевает через месяц».
 *
 * Безручечный (Gola, push-to-open): бить нечему, и брусок нужен уже только на толщину фасада с
 * запасом — число объявлено отдельно, а не выведено, потому что профиль Gola занимает своё.
 */
export function minFillerMm(handles: HandleKind, c = CORNER): number {
  if (handles === "surface") return c.frontThicknessMm + c.handleProtrusionMm + c.clearanceMm;
  return c.golaFillerMm;
}

export function checkFiller(
  b: CornerBinding, fillerMm: number, c = CORNER,
): CornerProblem[] {
  const need = minFillerMm(b.handles, c);
  if (fillerMm >= need) return [];
  return [{
    law: "CORNER-HANDLE",
    setting: "tables/corner.handleProtrusionMm",
    detail:
      `доборный брусок в углу ${fillerMm}мм при минимуме ${need}мм ` +
      (b.handles === "surface"
        ? `(фасад ${c.frontThicknessMm} + ручка ${c.handleProtrusionMm} + запас ${c.clearanceMm}). ` +
          `Ящик стены «${b.followerWall}» ударит в ручку стены «${b.leaderWall}» при первом выезде.`
        : `для безручечных фасадов. Профиль занимает своё место, и без бруска створка не откроется.`),
  }];
}

// ─── где ведомая стена начинает свои шкафы ────────────────────────────────────────────────────

export interface WallOffset {
  wall: string;
  /** с какой координаты можно ставить шкафы */
  startsAtMm: number;
  /** из чего сложилось */
  fromDepthMm: number;
  fromFillerMm: number;
}

/** R87 §1.3 — ведомая стена отступает на глубину соседа плюс брусок. Одно число, и никакого 3D. */
export function followerOffset(b: CornerBinding, fillerMm: number): WallOffset {
  return {
    wall: b.followerWall,
    startsAtMm: b.leaderDepthMm + fillerMm,
    fromDepthMm: b.leaderDepthMm,
    fromFillerMm: fillerMm,
  };
}

/**
 * Резерв угла ПО ЯРУСАМ. Низ занимает 560+добор, верх — 300+добор, и одна колонка на всю высоту
 * оставила бы наверху дыру, в которую нечего поставить (ред-тим R72, поправка 1).
 */
export function cornerReservation(
  b: CornerBinding, bands: HeightBand[], bandDepths: { band: string; mm: number }[],
  fillerMm: number,
): CornerReservation {
  return reserveCorner(b.followerWall, b.leaderWall, "start", bands, bandDepths, fillerMm);
}

/** Сколько занято на данной высоте — вопрос, который задаёт ограничитель драга. */
export const occupiedAtMm = (r: CornerReservation, heightMm: number): number =>
  reservedAt(r, heightMm);

// ─── еврозапил столешницы ─────────────────────────────────────────────────────────────────────

export interface MiterCut {
  /** скос по передней кромке, где закруглённый нос */
  bevelMm: number;
  bevelAngleDeg: 45;
  /** прямой рез на остаток глубины */
  straightMm: number;
  drawBolts: number;
  alignDowels: number;
}

/**
 * R87 §1.1 — почему не просто прямой стык.
 *
 * У постформинга передняя кромка закруглена радиусом 3–6 мм. Состыкуй две такие под 90° впрямую —
 * на носу останется треугольная дыра, которую видно с порога. Поэтому первые 15 мм режутся под
 * 45°, дальше прямой рез на остаток.
 */
export function miterCut(depthMm: number, c = CORNER): MiterCut {
  return {
    bevelMm: c.miterBevelMm,
    bevelAngleDeg: 45,
    straightMm: depthMm - c.miterBevelMm,
    drawBolts: c.drawBoltCount,
    alignDowels: c.alignDowelCount,
  };
}

/**
 * Инвариант опоры: еврозапил обязан лежать НАД перегородкой или угловой перекладиной. Стяжки
 * тянут две плиты друг к другу, и если под швом пусто, они тянут его в провис.
 */
export function checkMiterSupport(
  atMm: number, supportsMm: number[], toleranceMm = STRUCTURAL.jointSearchRadiusMm,
): CornerProblem[] {
  const near = supportsMm.some((s) => Math.abs(s - atMm) <= toleranceMm);
  if (near) return [];
  return [{
    law: "CORNER-MITER",
    setting: "tables/structural.jointSearchRadiusMm",
    detail:
      `еврозапил на ${Math.round(atMm)}мм, а опоры в пределах ${toleranceMm}мм нет. ` +
      `Стяжки притянут две плиты друг к другу и утянут шов в провис. ` +
      `Нужна перегородка или угловая перекладина под швом.`,
  }];
}

/** Полная проверка угла — всё, что должно совпасть, прежде чем угол пойдёт в работу. */
export function checkCorner(
  b: CornerBinding, fillerMm: number, miterAtMm: number, supportsMm: number[],
): CornerProblem[] {
  return [
    ...checkFiller(b, fillerMm),
    ...(b.miter === "EURO_MITER" ? checkMiterSupport(miterAtMm, supportsMm) : []),
  ];
}

// ─── П-образная: проход между встречными рядами ───────────────────────────────────────────────
//
// В Г-образной два ряда смотрят В РАЗНЫЕ стороны, и между ними нет отношения. В П-образной ряды
// на боковых стенах стоят ЛИЦОМ ДРУГ К ДРУГУ, и между ними появляется величина, которой в
// контракте угла не было: проход.
//
// Он не про эстетику. Ящик глубиной 500 выезжает на 500; если напротив выезжает такой же, между
// ними должно остаться место для человека, а не только для двух ящиков. И створка на 110° входит
// в проход своей толщиной.
//
// ЧИСЛА ВЫВЕДЕНЫ МНОЙ ИЗ ЭРГОНОМИКИ, НЕ ИЗ ДОКУМЕНТА. 900 — минимум, чтобы пройти; 1200 — чтобы
// не мешать друг другу вдвоём. Их надо подтвердить на цехе, и они лежат в файле именно поэтому.

export interface Passage {
  /** стены, смотрящие друг на друга */
  between: [string, string];
  /** расстояние между ФАСАДАМИ, а не между стенами */
  clearMm: number;
  /** самый глубокий выезжающий ящик на каждой стороне */
  drawerExtensionMm: [number, number];
}

export function checkPassage(p: Passage, c = CORNER): CornerProblem[] {
  const out: CornerProblem[] = [];

  if (p.clearMm < c.minPassageMm) {
    out.push({
      law: "CORNER-PASSAGE",
      setting: "tables/corner.minPassageMm",
      detail:
        `между «${p.between[0]}» и «${p.between[1]}» остаётся ${Math.round(p.clearMm)}мм при ` +
        `минимуме ${c.minPassageMm}мм. Это меряется между ФАСАДАМИ, а не между стенами — ` +
        `в такой проход не пройти, когда открыт хотя бы один ящик.`,
    });
  } else if (p.clearMm < c.comfortPassageMm) {
    out.push({
      law: "CORNER-PASSAGE",
      setting: "tables/corner.comfortPassageMm",
      detail:
        `проход ${Math.round(p.clearMm)}мм — пройти можно, вдвоём тесно ` +
        `(комфортный ${c.comfortPassageMm}мм). Не отказ: так строят, и заказчик вправе решить сам.`,
    });
  }

  // и отдельный вопрос: два ящика напротив, оба открыты
  const [a, b] = p.drawerExtensionMm;
  const leftover = p.clearMm - a - b;
  if (a > 0 && b > 0 && leftover < 0) {
    out.push({
      law: "CORNER-PASSAGE",
      setting: "things/slides/",
      detail:
        `ящики напротив выезжают на ${a} и ${b}мм в проход ${Math.round(p.clearMm)}мм — ` +
        `они столкнутся торцами. Возьмите направляющие короче или разнесите ящики по высоте.`,
    });
  }
  return out;
}
