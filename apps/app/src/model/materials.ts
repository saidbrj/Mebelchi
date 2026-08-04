// The SEED material catalogue — the decors the app ships with. model/catalog.ts turns this
// into the shop's own editable list; read it through `listMaterials()`, never directly.
//
// PRICES ARE IN USD, the app's base currency (see settings.ts `Currency`) — the same anchor
// as `DEFAULT_RATE_OVERRIDES`, and these figures are calibrated to it (sheet $7.5/m²,
// facade $19/m², back $3.3/m², from the real Chin Wood price list). They are honest
// ballpark defaults, not a live supplier feed: every shop's actual buy price differs, which
// is the whole reason Каталог lets them be edited.

import type { FinishKey } from "./cabinet";

/** Board/stock TYPE — what the thing is made of, independent of where it's used. Free text,
 *  not a union: a shop that buys «Фанера» or «Компакт-ламинат» must be able to type it in.
 *  MATERIAL_KINDS below is the suggestion list the catalog editor offers, not a limit. */
export const MATERIAL_KINDS = ["ЛДСП", "МДФ", "ХДФ", "Массив", "Камень", "Стекло", "Фурнитура"] as const;

export interface EmanMaterial {
  id: string;
  code?: string; // Role code tag: "A1", "A2", "B1", "C1", "W1"...
  name: string;
  /** what it's made of — "ЛДСП", "МДФ", "Камень"… (see MATERIAL_KINDS) */
  kind?: string;
  desc: string; // e.g. "Ручка, черная"
  thickness: string; // e.g. "18mm"
  thicknessMm?: number; // e.g. 18
  sheetW?: number; // e.g. 2750
  sheetH?: number; // e.g. 1830
  /** how much of it is on the shop's own shelf right now, in whole sheets (1.2 = "a sheet
   *  and a bit"). Purely informational — a badge on the picker so a designer doesn't spec a
   *  decor that has to be ordered in. Nothing reserves or decrements it. */
  stockSheets?: number; // e.g. 1.2
  /** PURCHASE price in USD, the app's base currency — the same anchor as settings.rates, so
   *  the display converts to сум/тенге via the seller's fx rate instead of showing a raw
   *  number with the wrong symbol. This is what the SHOP pays, not what the customer is
   *  quoted: the quote is computed per m² from settings.rates and does not read this yet. */
  price: number;
  /** how many units that price buys — 1 for a sheet, 2 for a pack of two handles. Display
   *  only ("$4.40 за 2"); no calculation divides by it. */
  per: number;
  color: string; // swatch
  part: FinishKey | "back"; // which render colour or part role this material drives
  en?: string; // English material descriptor for the AI render prompt
  tex?: string; // PBR texture key (three/pbr.ts TEX) — drives the live 3D surface
}

export const EMAN_MATERIALS: EmanMaterial[] = [
  // A · Фасады (A1, A2...)
  { id: "torhamn", code: "A1", kind: "ЛДСП", name: "Дуб Сонома", desc: "ЛДСП 2750×1830 · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 1.2, price: 55, per: 1, color: "#c8a878", part: "facade", tex: "wood_oak", en: "Sonoma oak LDSP cabinet fronts" },
  { id: "fac-graphite-enamel", code: "A2", kind: "МДФ", name: "Графит эмаль", desc: "МДФ 2800×2070 · 19мм", thickness: "19mm", thicknessMm: 19, sheetW: 2800, sheetH: 2070, stockSheets: 0.0, price: 280, per: 1, color: "#46474a", part: "facade", en: "matte graphite enamel MDF fronts" },
  { id: "vinstaa", code: "A3", kind: "МДФ", name: "Белый глянец", desc: "Фасад, белый глянец · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 2.5, price: 140, per: 1, color: "#f3f0ea", part: "facade", en: "white high-gloss lacquered cabinet fronts" },
  { id: "lerhyttan", code: "A4", kind: "Массив", name: "Орех", desc: "Фасад, орех · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 0.8, price: 190, per: 1, color: "#5a4636", part: "facade", en: "walnut solid-wood cabinet fronts", tex: "wood_walnut" },
  { id: "fac-sage", code: "A5", kind: "МДФ", name: "Шалфей", desc: "Фасад, шалфейный · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 1.0, price: 225, per: 1, color: "#9caf88", part: "facade", en: "sage green matte cabinet fronts" },

  // B · Корпус (B1, B2...)
  { id: "ldsp-egger-white", code: "B1", kind: "ЛДСП", name: "Egger W1000 белый", desc: "ЛДСП 2750×1830 · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 2.0, price: 45, per: 1, color: "#f0efe9", part: "carcass", en: "Egger premium white carcass LDSP" },
  { id: "ldsp-walnut-dark", code: "B2", kind: "ЛДСП", name: "Орех тёмный", desc: "ЛДСП 2750×1830 · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 0.6, price: 42, per: 1, color: "#5a4636", part: "carcass", tex: "wood_walnut", en: "dark walnut carcass LDSP" },
  { id: "ldsp-grey", code: "B3", kind: "ЛДСП", name: "ЛДСП Серый", desc: "Корпус, светло-серый · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 1.5, price: 38, per: 1, color: "#c9c8c3", part: "carcass" },
  { id: "ldsp-anthracite", code: "B4", kind: "ЛДСП", name: "ЛДСП Антрацит", desc: "Корпус, антрацит · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 1.1, price: 40, per: 1, color: "#46474a", part: "carcass" },

  // C · Задняя стенка (C1, C2...)
  { id: "hdf-white", code: "C1", kind: "ХДФ", name: "ХДФ белёный", desc: "ХДФ 2745×1700 · 3мм", thickness: "3mm", thicknessMm: 3, sheetW: 2745, sheetH: 1700, stockSheets: 0.5, price: 15, per: 1, color: "#f6f5f0", part: "back", en: "white HDF back panel sheet" },
  { id: "hdf-oak", code: "C2", kind: "ХДФ", name: "ХДФ дуб", desc: "ХДФ 2745×1700 · 3мм", thickness: "3mm", thicknessMm: 3, sheetW: 2745, sheetH: 1700, stockSheets: 0.3, price: 17, per: 1, color: "#d2b48c", part: "back", tex: "wood_oak", en: "oak HDF back panel sheet" },

  // W / M · Столешница (W1, W2...)
  { id: "wt-stone-matte", code: "W1", kind: "Камень", name: "Камень матовый", desc: "Камень 3200×1600 · 38мм", thickness: "38mm", thicknessMm: 38, sheetW: 3200, sheetH: 1600, stockSheets: 0.0, price: 400, per: 1, color: "#dcdbd7", part: "worktop", en: "matte white solid stone countertop" },
  { id: "ekbacken", code: "W2", kind: "Массив", name: "Дуб массивная", desc: "Столешница, дуб · 28мм", thickness: "28mm", thicknessMm: 28, sheetW: 3000, sheetH: 1200, stockSheets: 1.0, price: 290, per: 1, color: "#caa777", part: "worktop", tex: "wood_oak", en: "warm solid oak butcher-block countertop" },
  { id: "kasker", code: "W3", kind: "Камень", name: "Мрамор белый", desc: "Столешница, мрамор · 30мм", thickness: "30mm", thicknessMm: 30, sheetW: 3200, sheetH: 1600, stockSheets: 0.5, price: 520, per: 1, color: "#e6e4e0", part: "worktop", tex: "marble", en: "white marble countertop" },

  // Handles & Hardware
  { id: "bagannas-bk", code: "H1", kind: "Фурнитура", name: "Скоба чёрная", desc: "Ручка, черная", thickness: "10mm", price: 4.4, per: 2, color: "#2b2b2b", part: "handle", en: "matte black tubular metal handles" },
  { id: "bagannas-st", code: "H2", kind: "Фурнитура", name: "Скоба сталь", desc: "Ручка, сталь", thickness: "10mm", price: 5.6, per: 2, color: "#b9bdc1", part: "handle", en: "brushed stainless-steel tubular handles" },
];

/** hex string ("#rrggbb") → the colour int the renderer + finish overrides use. */
export const hexToInt = (hex: string) => parseInt(hex.replace("#", ""), 16);

// `catalogByColor` used to live here, searching this frozen array. It moved to model/catalog.ts
// so it searches the user's LIVE catalog instead — a decor the shop added themselves has to
// render with its own texture, not fall through to an untextured default.

/** «$45 за 1» / «4.40 за 2». `money` is REQUIRED — it used to default to `fmtSum`, which
 *  appended " сум" to what is now a USD amount and printed a price ~12,600× too small.
 *  Pass `useMoney()` so the label follows the seller's chosen display currency. */
export const matPriceLabel = (m: EmanMaterial, money: (n: number) => string) => `${money(m.price)} за ${m.per}`;
