// ПОЛИГОН · маркировка детали: сборщик и станок читают одно и то же разными глазами.
//
// ЧТО БЫЛО. В деталировке стояло «bottom / bottom» и «side / side»: колонка «Модуль» повторяла
// колонку «Деталь», потому что у сквозной доски нет одного модуля — она общая. Сборщик берёт
// деталь в руки и не знает ни куда её ставить, ни какой стороной.
//
// ЧТО ДЕЛАЕТ ОТРАСЛЬ. Станки Biesse, Homag и SCM не принимают кириллицу в именах управляющих
// программ (.bprc, .mpr, .dxf). Сборщик не читает `drawer-side`. Поэтому имя двуязычное: чистая
// латиница уходит в файл для ЧПУ, кириллица — на этикетку и в бланк.
//
// ФОРМУЛА:
//   [где стоит] · [что это, двумя языками] · [габарит]
//
//   M03-MOYKA   · BOK_EXT / Боковина внешняя Лев · 720×560
//   WALL-A      · DNO_RUN / Единое дно (M01–M03) · 2389×560
//
// Сборщик видит «TSARGA / Боковина ящика Прав» и перепутать не может. Станок получает
// `W_A_M03_BOK_EXT_L` — без пробелов, без кириллицы, без спецсимволов.

import { ROLE_NAMES, HAND_SUFFIX } from "./settings";

export type Hand = "left" | "right" | "none";

export interface PartNaming {
  /** к какой стене и какому модулю относится; для сквозной — сама стена и диапазон */
  where: string;
  /** латинский код для ЧПУ */
  code: string;
  /** русское название на этикетку */
  ru: string;
  /** габарит, как его читают в цехе */
  size: string;
  /** полная строка для бланка и наклейки */
  label: string;
  /** имя файла для станка: только латиница, цифры и подчёркивания */
  cnc: string;
}

export interface NamingInput {
  role: string;
  wall: string;
  /** модуль, если деталь принадлежит одному; пусто у сквозной */
  module?: string;
  /** какие модули проходит сквозная деталь */
  spans?: string[];
  hand?: Hand;
  lengthMm: number;
  widthMm: number;
  no: number;
}

/** Кириллица → латиница. Вырезать её нельзя: роль «нечто-новое» превратилась бы в ПУСТУЮ строку,
 *  а пустое имя файла на станке — это либо отказ загрузки, либо затирание чужой программы.
 *  Поймано тестом на неизвестной роли. */
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const latin = (s: string): string => {
  const t = [...s.toLowerCase()].map((c) => CYR[c] ?? c).join("");
  return t.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
};

/**
 * Имя детали. Отвечает на три вопроса, которые сборщик задаёт, держа доску в руках: к какому
 * шкафу, что это, какой стороной.
 */
export function nameOf(p: NamingInput): PartNaming {
  const role = ROLE_NAMES[p.role] ?? { code: latin(p.role), ru: p.role };
  const hand = p.hand && p.hand !== "none" ? HAND_SUFFIX[p.hand] : undefined;

  // СКВОЗНАЯ деталь не принадлежит модулю — она принадлежит СТЕНЕ, и говорит, какие модули
  // проходит. Именно здесь раньше был дубль «bottom / bottom».
  const where = p.module
    ? p.module
    : p.spans?.length
      ? `${p.wall} (${p.spans[0]}–${p.spans[p.spans.length - 1]})`
      : p.wall;

  const code = hand ? `${role.code}_${hand.code}` : role.code;
  const ru = hand ? `${role.ru} ${hand.ru}` : role.ru;
  const size = `${p.lengthMm}×${p.widthMm}`;

  return {
    where, code, ru, size,
    label: `${where} · ${code} / ${ru} · ${size}`,
    cnc: latin(`${p.wall}_${p.module ?? "RUN"}_${code}_${p.no}`),
  };
}

/** Колонка «Деталь» в бланке: код и русское название рядом. */
export const partColumn = (n: PartNaming): string => `${n.code} / ${n.ru}`;

/** Колонка «Модуль»: где стоит, без дубля с ролью. */
export const moduleColumn = (n: PartNaming): string => n.where;
