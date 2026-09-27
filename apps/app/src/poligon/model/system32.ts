// ПОЛИГОН · R96 + R98 — программа присадки как ФУНКЦИЯ ТОЛЩИНЫ.
//
// ПОЧЕМУ ЭТО СРОЧНЕЕ, ЧЕМ ВЫГЛЯДИТ. В профиле цеха уже написано `thicknessClasses: 16,18`, а в
// файле петли уже написано `overlay: 16`. То есть движок СЕЙЧАС разрешает переключить плиту на
// 18 и при этом продолжает считать наложение, посчитанное для 16. Это не отсутствующая
// возможность, это работающая ложь: дверь выйдет с зазором 7 вместо 3, и регулировочный винт
// петли (±2) её не вытянет.
//
// Поэтому здесь нет ни одной таблицы «для 16 столько, для 18 столько». Есть две формулы:
//
//   ось присадки в торец      Y = T / 2
//   наложение фасада          D = C + K − H        (европейская четырёхшарнирная петля)
//
// Из первой сами собой выходят 8.0 и 9.0 из каталогов, а заодно и 11.0 для плиты 22, которой ни
// в одном каталоге нет. Из второй — что переход 16→18 обязан сдвинуть сверление чашки с 3.5 на
// 5.5, иначе 3.5 мм боковины остаются голыми.
//
// ЧТО ЗДЕСЬ НЕ РЕАЛИЗОВАНО НАМЕРЕННО. Исследование даёт таблицу с готовыми 8.0/9.0 и предлагает
// переключать программы. Таблица — это то же самое знание, записанное так, что третья толщина
// требует правки файла. Формула не требует.

import { SYSTEM32, CONFIRMAT, HINGE } from "./settings";

/** Миллиметры до сотых. Станок не умеет точнее, и сравнивать глубже — сравнивать шум с шумом. */
const mm = (v: number): number => Math.round(v * 100) / 100;

export interface BoringProblem {
  law: string;
  detail: string;
  setting: string;
}

// ─── R96 · растр ──────────────────────────────────────────────────────────────────────────────

export interface Snap {
  /** куда просили */
  askedMm: number;
  /** куда встало — ближайшая ось растра */
  atMm: number;
  /** номер отверстия от базы */
  index: number;
  movedMm: number;
}

/**
 * База (Y=0) — ВЕРХНЯЯ плоскость дна, а не низ боковины и не пол. Дно уже съело свою толщину,
 * и всё, что стоит внутри корпуса, меряется от него. Сменить базу на низ боковины значит
 * получить сдвиг ровно в одну толщину плиты на каждом отверстии — и это та ошибка, которую в
 * цеху находят, когда ящик не встаёт.
 */
export function snapToRaster(askedMm: number, offsetMm = 0, s = SYSTEM32): Snap {
  const index = Math.round((askedMm - offsetMm) / s.pitchMm);
  const atMm = index * s.pitchMm + offsetMm;
  return { askedMm, atMm, index, movedMm: Math.abs(atMm - askedMm) };
}

/** Ось винта направляющей: отверстие растра плюс объявленное смещение. */
export const slideAxis = (askedMm: number, s = SYSTEM32): Snap =>
  snapToRaster(askedMm, s.slideAxisOffsetMm, s);

/**
 * Привязка — не молчаливое действие. Подвинуть ящик на 3 мм можно, на 15 — уже нет: это другой
 * проект, и решать должен человек. Порог объявлен в файле, а не выбран здесь.
 */
export function checkSnap(snap: Snap, s = SYSTEM32): BoringProblem[] {
  if (snap.movedMm <= s.maxSnapMm) return [];
  return [{
    law: "SYSTEM-32-RASTER",
    setting: "tables/system32.maxSnapMm",
    detail:
      `позиция ${snap.askedMm}мм лежит в ${snap.movedMm}мм от ближайшей оси растра ` +
      `(${snap.atMm}мм), а двигать разрешено не дальше ${s.maxSnapMm}. Сверлить мимо растра ` +
      `станок умеет, но каждое такое отверстие — отдельный плунж вместо одного общего: ` +
      `другая цена и другое время. Подвиньте сами или объявьте это осознанно.`,
  }];
}

// ─── R98.2 · ось присадки в торец ─────────────────────────────────────────────────────────────

/** Ось всегда посередине торца. Никаких «восьми»: восемь — это 16/2 и больше ничего. */
export const boreAxisMm = (thicknessMm: number): number => thicknessMm / 2;

export interface BorePlan {
  thicknessMm: number;
  /** где программа реально сверлит */
  programAxisMm: number;
  /** правильная ось для этой толщины */
  correctAxisMm: number;
  /** плита, оставшаяся с тонкой стороны */
  thinWallMm: number;
}

export function borePlan(
  thicknessMm: number, programAxisMm = boreAxisMm(thicknessMm), c = CONFIRMAT,
): BorePlan {
  const correctAxisMm = boreAxisMm(thicknessMm);
  const near = Math.min(programAxisMm, thicknessMm - programAxisMm);
  return {
    thicknessMm, programAxisMm, correctAxisMm,
    thinWallMm: mm(near - c.coreDiameterMm / 2),
  };
}

/**
 * R98.2 — ловушка одного миллиметра.
 *
 * Плиту 18 сверлят программой для 16: ось уходит на миллиметр от середины, с тонкой стороны
 * остаётся 5.5 вместо 6.5. Конфирмат — винт с распорной резьбой; он эту стенку разрывает, и
 * наружу вылезает не трещина, а пузырь ламината. Деталь уже отпилена, окромлена и присажена.
 */
export function checkBorePlan(p: BorePlan, c = CONFIRMAT): BoringProblem[] {
  const out: BoringProblem[] = [];

  if (mm(p.programAxisMm) !== mm(p.correctAxisMm)) {
    out.push({
      law: "SYSTEM-32-CENTERLINE",
      setting: "profile.carcassThicknessMm",
      detail:
        `программа сверлит торец по оси ${p.programAxisMm}мм, а плита ${p.thicknessMm}мм — её ` +
        `ось ${p.correctAxisMm}. Ось торца это всегда половина толщины, а не число из ` +
        `прошлого заказа. Смена класса плиты обязана пересчитать программу.`,
    });
  }

  if (p.thinWallMm < c.minWallMm) {
    out.push({
      law: "SYSTEM-32-CENTERLINE",
      setting: "joints/confirmat-7x50.minWallMm",
      detail:
        `с тонкой стороны остаётся ${p.thinWallMm}мм плиты при минимуме ${c.minWallMm}. ` +
        `Конфирмат распирает торец изнутри: тонкая стенка не трескается, а вздувается ` +
        `пузырём ламината наружу — и видно это уже на собранном корпусе.`,
    });
  }

  return out;
}

// ─── R98.1 · кинематика петли ─────────────────────────────────────────────────────────────────

export interface HingeFit {
  /** какое наложение требуется от геометрии корпуса */
  needOverlayMm: number;
  /** на какой планке остановились */
  plateMm: number;
  /** где сверлить чашку от края фасада */
  cupDistanceMm: number;
  problems: BoringProblem[];
}

/**
 * Сколько фасад ОБЯЗАН закрыть. У крайней боковины — всю её толщину минус половина шва до
 * соседа; у общей перегородки — половину толщины минус та же половина шва, потому что вторую
 * половину закрывает соседний фасад.
 */
export const overlayNeeded = (
  thicknessMm: number, shared: boolean, revealMm = HINGE.revealMm,
): number => (shared ? thicknessMm / 2 : thicknessMm) - revealMm / 2;

/**
 * D = C + K − H, решённое относительно K при выбранной планке.
 *
 * Петля не «имеет наложение». Она имеет плечо; наложение получается из плеча, планки и того,
 * где просверлена чашка. Пока это записано как готовое число в файле петли, смена толщины плиты
 * молча ломает дверь — и ровно это сейчас и заложено в каталоге.
 */
export const cupDistanceFor = (
  needOverlayMm: number, plateMm: number, armMm = HINGE.armConstantMm,
): number => Math.round((needOverlayMm - armMm + plateMm) * 100) / 100;

export function fitHinge(
  thicknessMm: number, shared: boolean, h = HINGE,
): HingeFit {
  const needOverlayMm = overlayNeeded(thicknessMm, shared, h.revealMm);

  // планки перебираются от нулевой вверх: чем ниже планка, тем жёстче узел
  const options = h.plateHeightsMm
    .map((plateMm) => ({ plateMm, cupDistanceMm: cupDistanceFor(needOverlayMm, plateMm, h.armConstantMm) }))
    .filter((o) => o.cupDistanceMm >= h.cupMinMm && o.cupDistanceMm <= h.cupMaxMm);

  if (options.length > 0) {
    const best = options[0]!;
    return { needOverlayMm, plateMm: best.plateMm, cupDistanceMm: best.cupDistanceMm, problems: [] };
  }

  // ни одна планка не дотягивает — и отказ обязан сказать, НАСКОЛЬКО не дотягивает
  const all = h.plateHeightsMm.map((plateMm) => cupDistanceFor(needOverlayMm, plateMm, h.armConstantMm));
  const nearest = all.reduce((a, b) =>
    Math.abs(b - (b < h.cupMinMm ? h.cupMinMm : h.cupMaxMm)) < Math.abs(a - (a < h.cupMinMm ? h.cupMinMm : h.cupMaxMm)) ? b : a);
  const missMm = mm(nearest < h.cupMinMm ? h.cupMinMm - nearest : nearest - h.cupMaxMm);

  return {
    needOverlayMm, plateMm: h.plateHeightsMm[0]!, cupDistanceMm: nearest,
    problems: [{
      law: "HINGE-K-SHIFT",
      setting: "hinges/blum-clip-top-110.cupDistanceMaxMm",
      detail:
        `плита ${thicknessMm}мм требует наложения ${needOverlayMm}мм, а эта петля с плечом ` +
        `${h.armConstantMm} на планках ${h.plateHeightsMm.join("/")} даёт чашку ` +
        `${nearest}мм — мимо диапазона ${h.cupMinMm}..${h.cupMaxMm} на ${missMm}мм. ` +
        `Регулировочный винт тянет ±${h.adjustRangeMm}, этого не хватит. Нужна петля другого ` +
        `класса или другой ряд планок.`,
    }],
  };
}

/**
 * R98 — сам сдвиг. Одна и та же петля на плите 16 и на плите 18 требует РАЗНОГО сверления
 * чашки, и разница не в допуске, а в миллиметрах. Если цех держит одну программу на обе
 * толщины, боковина остаётся голой и шов между дверьми расходится.
 */
export function checkThicknessShift(
  fromMm: number, toMm: number, shared = false, h = HINGE,
): BoringProblem[] {
  const a = fitHinge(fromMm, shared, h);
  const b = fitHinge(toMm, shared, h);
  const shiftMm = mm(b.cupDistanceMm - a.cupDistanceMm);
  if (shiftMm === 0) return [];

  // сколько боковины останется голой, если программу НЕ пересчитать
  const bareMm = mm(b.needOverlayMm - a.needOverlayMm);
  const gapMm = mm(h.revealMm + 2 * bareMm);

  return [{
    law: "HINGE-K-SHIFT",
    setting: "profile.carcassThicknessMm",
    detail:
      `переход ${fromMm}→${toMm}мм сдвигает сверление чашки с ${a.cupDistanceMm} на ` +
      `${b.cupDistanceMm}мм (${shiftMm > 0 ? "+" : ""}${shiftMm}). Со старой программой ` +
      `${bareMm}мм боковины останутся голыми с каждой стороны, а шов между соседними фасадами ` +
      `разойдётся с ${h.revealMm} до ${gapMm}мм — регулировка петли тянет ±${h.adjustRangeMm}.`,
  }];
}
