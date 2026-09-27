// ПОЛИГОН · R75 — внутренние ящики, и удар, которого они ждут.
//
// Внутренний ящик стоит внутри уже закрытой ячейки — за внешним фасадом ящика или за распашной
// дверью. У него нет наружного фасада: вместо него утопленная царга, и живёт он целиком внутри
// SubSheet (R69). Ни одной линии на стене он не рождает, и это проверяется, а не обещается.
//
// ЧЕМ ОН ОПАСЕН. Распашная дверь на обычной петле 110° открывается так, что створка остаётся
// ВНУТРИ светового проёма примерно на 30 мм. Ящик, выезжающий мимо неё, бьёт в неё торцом. Это не
// теория: так ломают только что собранную кухню при первой демонстрации заказчику.
//
// ДВА ВЫХОДА, и оба объявлены в файлах, а не здесь:
//   · петля 155° с нулевым вхождением — цех Карасу закупает именно её, она в профиле по умолчанию;
//   · планка-проставка со стороны ПЕТЕЛЬ, отодвигающая ящик за габарит открытой створки.
//
// Движок не выбирает молча. Он отказывает, называет обе двери и говорит, какая из них уже лежит
// в каталоге.

import type { SheetProfile } from "./sheet";

export type DrawerVariant = "external" | "inner";

export interface SlideSpec {
  uid: string;
  /** зазор НА СТОРОНУ между корпусом и коробом ящика */
  clearancePerSideMm: number;
  allowedLengthsMm: number[];
}

export interface HingeSpec {
  uid: string;
  openingAngleDeg: number;
  /** насколько открытая створка входит в световой проём */
  protrusionMm: number;
}

export interface SpacerSpec {
  uid: string;
  widthMm: number;
  side: "hinge" | "handle" | "both";
}

export interface DrawerInstance {
  id: string;
  variant: DrawerVariant;
  /** световой проём корпуса, в который он ставится */
  openingWidthMm: number;
  openingDepthMm: number;
  /** только для inner: насколько царга утоплена от края проёма */
  innerFrontInsetMm?: number;
  /** распашная дверь перед ним, если она есть */
  door?: HingeSpec;
  /** планка, если поставлена */
  spacer?: SpacerSpec;
}

export interface DrawerRefusal {
  law: string;
  detail: string;
  /** что именно разрешит операцию — Law E: отказ, на который нельзя нажать, это баг */
  settings: string[];
}

export interface DrawerBox {
  /** ширина короба после вычета направляющих и планки */
  widthMm: number;
  /** длина направляющей из объявленного ряда — ближайшая НЕ БОЛЬШЕ глубины проёма */
  slideLengthMm: number;
  /** остаток глубины, не покрытый направляющей */
  depthSlackMm: number;
}

/** Ближайшая объявленная длина направляющей, не превышающая глубину. Выбирать длиннее нельзя:
 *  направляющая упрётся в заднюю стенку. */
export function pickSlideLength(openingDepthMm: number, slide: SlideSpec): number | undefined {
  const fit = slide.allowedLengthsMm.filter((l) => l <= openingDepthMm).sort((a, b) => b - a);
  return fit[0];
}

/**
 * R75 — построить короб, или отказать.
 *
 * Ширина: проём минус зазор направляющей с двух сторон, минус планка, если она стоит. Планка
 * односторонняя — она со стороны петель, — поэтому вычитается один раз, а не дважды.
 */
export function deriveDrawerBox(
  d: DrawerInstance, slide: SlideSpec, profile: SheetProfile,
): { ok: true; box: DrawerBox } | { ok: false; refusals: DrawerRefusal[] } {
  const refusals: DrawerRefusal[] = [];

  // ── удар о распашную дверь ────────────────────────────────────────────────────────────────
  if (d.variant === "inner" && d.door && d.door.protrusionMm > 0) {
    const covered = d.spacer !== undefined && d.spacer.side !== "handle"
      && d.spacer.widthMm >= d.door.protrusionMm;
    if (!covered) {
      refusals.push({
        law: "R75-DOORHIT",
        detail:
          `внутренний ящик за распашной дверью: петля ${d.door.openingAngleDeg}° оставляет ` +
          `${d.door.protrusionMm}мм створки В ПРОЁМЕ, и ящик ударит в неё при первом выезде. ` +
          `Нужна петля с нулевым вхождением либо планка-проставка от ${d.door.protrusionMm}мм ` +
          `со стороны петель.`,
        settings: ["profile.defaultHinge", "things/hinges/", "things/spacers/"],
      });
    }
  }

  // ── длина направляющей ────────────────────────────────────────────────────────────────────
  const slideLengthMm = pickSlideLength(d.openingDepthMm, slide);
  if (slideLengthMm === undefined) {
    refusals.push({
      law: "R75-SLIDE",
      detail:
        `проём ${d.openingDepthMm}мм мельче самой короткой объявленной направляющей ` +
        `(${Math.min(...slide.allowedLengthsMm)}мм) — ящик сюда не встаёт.`,
      settings: ["things/slides/"],
    });
  }

  const spacerMm = d.spacer && d.spacer.side !== "handle" ? d.spacer.widthMm : 0;
  const widthMm = d.openingWidthMm - slide.clearancePerSideMm * 2 - spacerMm;
  if (widthMm <= profile.minInterior.block) {
    refusals.push({
      law: "R75-SLIDE",
      detail:
        `после зазоров направляющей (${slide.clearancePerSideMm * 2}мм) и планки (${spacerMm}мм) ` +
        `от проёма ${d.openingWidthMm}мм остаётся ${widthMm}мм — меньше минимума ` +
        `${profile.minInterior.block}мм.`,
      settings: ["profile.minCarcassMm", "things/slides/", "things/spacers/"],
    });
  }

  if (refusals.length) return { ok: false, refusals };
  return {
    ok: true,
    box: { widthMm, slideLengthMm: slideLengthMm!, depthSlackMm: d.openingDepthMm - slideLengthMm! },
  };
}

/** Внутренний ящик не имеет наружного фасада — у него утопленная царга. Число из профиля. */
export const innerFrontInset = (d: DrawerInstance, fallbackMm: number): number =>
  d.variant === "inner" ? (d.innerFrontInsetMm ?? fallbackMm) : 0;
