// ПОЛИГОН · R86 — разворачивание наполнения: где терялись 73 детали.
//
// Kitchen #1 дала 18 деталей. Настоящая кухня на семь секций — около девяноста. Разница не в
// ошибке счёта: движок компилировал только НАРУЖНЫЙ контур стены — боковины, дно, столешницу.
// Всё, что внутри шкафа, оставалось в суб-листе (R69) и никуда не разворачивалось.
//
// Здесь это разворачивается. Правило одно: каждая деталь выводится из ГЕОМЕТРИИ проёма и чисел
// из файлов, и ни одно из этих чисел не написано тут.
//
// Четыре размера, которые надо не перепутать, — и их путают чаще всего:
//
//   W_col     ширина колонки по осевым линиям стойек            800
//   W_inner   световой проём: минус ПОЛОВИНА каждой стойки       800 − 8 − 8 = 784
//             (половина, потому что стойка общая — вторая её половина принадлежит соседу)
//   W_front   фасад: колонка минус зазор, одинаковый по стене    800 − 3 = 797
//             фасад НЕ равен проёму: он наезжает на стойку и закрывает её
//   W_box     короб ящика: проём минус направляющие с двух сторон 784 − 25 = 759
//
// Фасад шире проёма, короб уже проёма. Взять для фасада размер проёма — получить щель на всю
// стену; взять для короба размер колонки — ящик не влезет.

import { BACK, FILL, hingeCount, SHELF_SETBACK_MM, SHOP_PROFILE } from "./settings";
import type { BackMode } from "./settings";
import type { SheetProfile } from "./sheet";

// ─── что стоит внутри шкафа ───────────────────────────────────────────────────────────────────

export type FillKind =
  | { kind: "door"; leaves: 1 | 2 }
  /** фальш-панель: выглядит как фасад ящика, ящика за ней нет (мойка) */
  | { kind: "false-front" }
  /** фасад, принадлежащий технике: считается в фурнитуре, не в раскрое */
  | { kind: "appliance-door" }
  | { kind: "drawers"; count: number }
  | { kind: "shelves"; count: number }
  | { kind: "open" };

/** Одно наполнение и его доля высоты. Мойка — это фальш-панель СВЕРХУ и двери под ней, и
 *  выразить её одним наполнением нельзя: шкаф держит стопку. */
export interface FillSlot {
  what: FillKind;
  /** высота этой доли; не указана — делит остаток поровну с другими неуказанными */
  heightMm?: number;
}

export interface CabinetFill {
  id: string;
  /** ширина колонки по осевым */
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** толщина стойки слева и справа; половина каждой принадлежит этому шкафу */
  sideMm: { left: number; right: number };
  fill: FillKind | FillSlot[];
  /** есть ли задняя стенка */
  back: boolean;
}

export interface FillPart {
  cabinet: string;
  role: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** для чего она — чтобы мастер в пачке понимал, что держит */
  note: string;
}

export interface Hardware {
  cabinet: string;
  item: "hinge" | "slide" | "shelf-pin";
  qty: number;
  /** длина направляющей или накладка петли */
  sizeMm?: number;
  note: string;
}

export interface FillResult {
  parts: FillPart[];
  hardware: Hardware[];
}

// ─── размеры ──────────────────────────────────────────────────────────────────────────────────

/** Световой проём: минус ПОЛОВИНА каждой стойки. Вторая половина — соседа. */
export const innerWidthMm = (c: CabinetFill): number =>
  c.widthMm - c.sideMm.left / 2 - c.sideMm.right / 2;

/** Фасад: колонка минус наружный зазор с двух сторон (Q20: по 1.5, у соседей вместе — один зазор).
 *  Шире проёма — он закрывает стойку. */
export const frontWidthMm = (c: CabinetFill, f = FILL): number => c.widthMm - 2 * f.frontEdgeMarginMm;

/** Q20 — одна формула для любой группы фасадов по любой оси: наружные края берут по поле,
 *  между соседями — полный зазор, остаток делится поровну. */
export const frontCellMm = (sideMm: number, count: number, f = FILL): number =>
  (sideMm - 2 * f.frontEdgeMarginMm - (count - 1) * f.frontGapMm) / count;

/** Сколько глубины полка отдаёт задней стенке — выводится из способа крепления задника. */
export const backZoneMm = (mode: BackMode = BACK.mode, b = BACK): number =>
  mode === "overlay" ? b.overlayShelfGapMm
    : mode === "groove" ? b.grooveOffsetMm + b.grooveWidthMm + b.grooveShelfGapMm
      : 0;

/** Полка: глубина корпуса минус передний отступ (профиль) минус зона задника. */
export const shelfDepthMm = (c: CabinetFill, mode: BackMode = BACK.mode): number =>
  c.depthMm - SHELF_SETBACK_MM - backZoneMm(mode);

/** Задняя стенка по ширине: внахлёст закрывает колонку до осей стоек; в паз — проём плюс два паза. */
export const backWidthMm = (c: CabinetFill, mode: BackMode = BACK.mode, b = BACK): number =>
  mode === "groove" ? innerWidthMm(c) + 2 * b.grooveDepthMm : c.widthMm;

/** Короб ящика: проём минус направляющие с двух сторон. */
export const boxWidthMm = (c: CabinetFill, clearancePerSideMm: number): number =>
  innerWidthMm(c) - clearancePerSideMm * 2;

/** Дно ящика в паз: короб минус два паза. */
export const boxBottomWidthMm = (
  c: CabinetFill, clearancePerSideMm: number, f = FILL, sideMm = SHOP_PROFILE.boardMm,
): number =>
  // E10 (основатель 2026-09-18): глубина паза фиксирована упором фрезы; от толщины бока растёт
  // только остаток стенки. Дно = внутренний проём короба + паз с каждой стороны.
  boxWidthMm(c, clearancePerSideMm) - 2 * sideMm + 2 * f.drawerGrooveMm;

/** Направляющая: глубина корпуса минус зазор до задней стенки, вниз до объявленного шага. */
export function slideLengthMm(
  depthMm: number, allowed: number[], f = FILL,
): number | undefined {
  const want = depthMm - f.slideBackGapMm;
  return [...allowed].filter((l) => l <= want).sort((a, b) => b - a)[0];
}

// ─── разворачивание ───────────────────────────────────────────────────────────────────────────

export interface FillContext {
  profile: SheetProfile;
  /** способ крепления задника; по умолчанию — из профиля цеха */
  backMode?: BackMode;
  /** зазор направляющей на сторону, из файла направляющей */
  slideClearancePerSideMm: number;
  slideLengthsMm: number[];
  fill?: typeof FILL;
}

/** Разложить стопку наполнений по высоте: явные доли берут своё, остальные делят остаток. */
function slotsOf(c: CabinetFill): { what: FillKind; heightMm: number }[] {
  const stack: FillSlot[] = Array.isArray(c.fill) ? c.fill : [{ what: c.fill }];
  const fixed = stack.reduce((n, s) => n + (s.heightMm ?? 0), 0);
  const free = stack.filter((s) => s.heightMm === undefined).length;
  const each = free > 0 ? (c.heightMm - fixed) / free : 0;
  return stack.map((s) => ({ what: s.what, heightMm: s.heightMm ?? each }));
}

/** R86 §2.3 — развернуть один шкаф в детали и фурнитуру. */
export function expandCabinet(c: CabinetFill, ctx: FillContext): FillResult {
  const f = ctx.fill ?? FILL;
  const t = ctx.profile.boardMm;
  const parts: FillPart[] = [];
  const hardware: Hardware[] = [];

  const fw = frontWidthMm(c, f);
  const inner = innerWidthMm(c);
  const backMode = ctx.backMode ?? BACK.mode;

  for (const slot of slotsOf(c)) expandSlot(slot.what, slot.heightMm);

  function expandSlot(kind: FillKind, heightMm: number): void {
  switch (kind.kind) {
    case "door": {
      const leaves = kind.kind === "door" ? kind.leaves : 1;
      // две створки делят зазор ещё раз: между ними он такой же, как до соседей
      const leafW = frontCellMm(c.widthMm, leaves, f);
      for (let i = 0; i < leaves; i++) {
        parts.push({
          cabinet: c.id, role: "front", lengthMm: round1(frontCellMm(heightMm, 1, f)),
          widthMm: Math.round(leafW * 10) / 10, thicknessMm: t,
          note: leaves === 1 ? "фасад распашной" : `фасад распашной, створка ${i + 1} из ${leaves}`,
        });
      }
      const n = hingeCount(heightMm);
      hardware.push({
        cabinet: c.id, item: "hinge", qty: n * leaves, sizeMm: f.crankSharedMm,
        note: `${n} на створку по высоте ${round1(heightMm)}мм; накладка ${f.crankSharedMm}мм — стойка общая`,
      });
      break;
    }

    case "false-front":
      // фальш-панель мойки: фасад есть, ящика за ним нет
      parts.push({
        cabinet: c.id, role: "front", lengthMm: round1(frontCellMm(heightMm, 1, f)),
        widthMm: round1(fw), thicknessMm: t,
        note: "фальш-панель мойки: за ней чаша, ящика нет",
      });
      break;

    case "appliance-door":
      // дверь принадлежит технике; в раскрой не идёт, но петли считаются
      hardware.push({
        cabinet: c.id, item: "hinge", qty: 2,
        note: "дверь встроенной техники: в раскрой не идёт, крепёж свой",
      });
      break;

    case "drawers": {
      const n = kind.kind === "drawers" ? kind.count : 1;
      const boxW = boxWidthMm(c, ctx.slideClearancePerSideMm);
      const bottomW = boxBottomWidthMm(c, ctx.slideClearancePerSideMm, f, t);
      const slide = slideLengthMm(c.depthMm, ctx.slideLengthsMm, f);
      const frontH = frontCellMm(heightMm, n, f);

      for (let i = 0; i < n; i++) {
        const tag = `ящик ${i + 1} из ${n}`;
        // R86 §2.2 — пять деталей на ящик: два бока, зад, дно ХДФ, царга
        parts.push({ cabinet: c.id, role: "front", lengthMm: Math.round(frontH * 10) / 10,
          widthMm: Math.round(fw * 10) / 10, thicknessMm: t, note: `фасад, ${tag}` });
        for (const side of ["левый", "правый"]) {
          parts.push({ cabinet: c.id, role: "drawer-side", lengthMm: slide ?? 0,
            widthMm: f.drawerSideHeightMm, thicknessMm: t, note: `бок ${side}, ${tag}` });
        }
        parts.push({ cabinet: c.id, role: "drawer-back", lengthMm: Math.round(boxW * 10) / 10,
          widthMm: f.drawerSideHeightMm, thicknessMm: t, note: `задняя стенка короба, ${tag}` });
        parts.push({ cabinet: c.id, role: "drawer-bottom", lengthMm: slide ?? 0,
          widthMm: Math.round(bottomW * 10) / 10, thicknessMm: f.backThicknessMm,
          note: `дно ХДФ в паз ${f.drawerGrooveMm}мм, ${tag}` });
      }
      if (slide) {
        hardware.push({ cabinet: c.id, item: "slide", qty: n, sizeMm: slide,
          note: `${n} комплект(ов) ${slide}мм: глубина ${c.depthMm} минус ${f.slideBackGapMm} до задней стенки` });
      }
      break;
    }

    case "shelves": {
      const sh = kind.kind === "shelves" ? kind.count : 0;
      for (let i = 0; i < sh; i++) {
        parts.push({ cabinet: c.id, role: "shelf", lengthMm: Math.round(inner * 10) / 10,
          widthMm: round1(shelfDepthMm(c, backMode)), thicknessMm: t,
          note: `полка ${i + 1} из ${sh}, съёмная` });
      }
      if (sh) hardware.push({ cabinet: c.id, item: "shelf-pin", qty: sh * 4,
        note: "по четыре на полку" });
      break;
    }

    case "open":
      break;
  }
  }

  if (c.back && backMode !== "none") {
    parts.push({
      cabinet: c.id, role: "back", lengthMm: c.heightMm,
      widthMm: round1(backWidthMm(c, backMode)), thicknessMm: f.backThicknessMm,
      note: backMode === "groove"
        ? `задняя стенка ХДФ ${f.backThicknessMm}мм в паз`
        : `задняя стенка ХДФ ${f.backThicknessMm}мм внахлёст на задние торцы`,
    });
  }

  return { parts, hardware };
}

/** Развернуть весь ряд. */
export function expandAll(cabinets: CabinetFill[], ctx: FillContext): FillResult {
  const all = cabinets.map((c) => expandCabinet(c, ctx));
  return {
    parts: all.flatMap((r) => r.parts),
    hardware: all.flatMap((r) => r.hardware),
  };
}

/**
 * R86 §2.2 — проверка полноты через сохранение количества.
 *
 * N = каркас + фасады + 5·ящики + полки + задние стенки + доборы
 *
 * Смысл не в том, чтобы сверить с заранее известным числом — а в том, чтобы обнаружить потерю,
 * НЕ зная правильного ответа. Считаем ожидаемое из деклараций и сверяем с выпущенным.
 */
const round1 = (v: number) => Math.round(v * 10) / 10;

export function expectedCount(cabinets: CabinetFill[], backMode: BackMode = BACK.mode): number {
  let n = 0;
  for (const c of cabinets) {
    for (const slot of slotsOf(c)) {
    switch (slot.what.kind) {
      case "door": n += slot.what.leaves; break;
      case "false-front": n += 1; break;
      case "appliance-door": break;               // в раскрой не идёт
      case "drawers": n += slot.what.count * 5; break;
      case "shelves": n += slot.what.count; break;
      case "open": break;
    }
    }
    if (c.back && backMode !== "none") n += 1;
  }
  return n;
}
