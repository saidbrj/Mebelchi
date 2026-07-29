// Eman.uz material catalogue (placeholder). The real product feed — names,
// thicknesses and live pricing — will be wired in later; for now this seeds the
// "Стиль" picker so the furniture-editor flow is complete and demonstrable.

import { fmtSum } from "./format";
import type { FinishKey } from "./cabinet";

export interface EmanMaterial {
  id: string;
  code?: string; // Role code tag: "A1", "A2", "B1", "C1", "W1"...
  name: string;
  desc: string; // e.g. "Ручка, черная"
  thickness: string; // e.g. "18mm"
  thicknessMm?: number; // e.g. 18
  sheetW?: number; // e.g. 2750
  sheetH?: number; // e.g. 1830
  stockSheets?: number; // e.g. 1.2
  price: number; // sum, per pack
  per: number; // pack size ("за N")
  color: string; // swatch
  part: FinishKey | "back"; // which render colour or part role this material drives
  en?: string; // English material descriptor for the AI render prompt
  tex?: string; // PBR texture key (three/pbr.ts TEX) — drives the live 3D surface
}

export const EMAN_MATERIALS: EmanMaterial[] = [
  // A · Фасады (A1, A2...)
  { id: "torhamn", code: "A1", name: "Дуб Сонома", desc: "ЛДСП 2750×1830 · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 1.2, price: 175000, per: 1, color: "#c8a878", part: "facade", tex: "wood_oak", en: "Sonoma oak LDSP cabinet fronts" },
  { id: "fac-graphite-enamel", code: "A2", name: "Графит эмаль", desc: "МДФ 2800×2070 · 19мм", thickness: "19mm", thicknessMm: 19, sheetW: 2800, sheetH: 2070, stockSheets: 0.0, price: 168000, per: 1, color: "#46474a", part: "facade", en: "matte graphite enamel MDF fronts" },
  { id: "vinstaa", code: "A3", name: "Белый глянец", desc: "Фасад, белый глянец · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 2.5, price: 142000, per: 1, color: "#f3f0ea", part: "facade", en: "white high-gloss lacquered cabinet fronts" },
  { id: "lerhyttan", code: "A4", name: "Орех", desc: "Фасад, орех · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 0.8, price: 168000, per: 1, color: "#5a4636", part: "facade", en: "walnut solid-wood cabinet fronts", tex: "wood_walnut" },
  { id: "fac-sage", code: "A5", name: "Шалфей", desc: "Фасад, шалфейный · 18мм", thickness: "18mm", thicknessMm: 18, sheetW: 2750, sheetH: 1830, stockSheets: 1.0, price: 156000, per: 1, color: "#9caf88", part: "facade", en: "sage green matte cabinet fronts" },

  // B · Корпус (B1, B2...)
  { id: "ldsp-egger-white", code: "B1", name: "Egger W1000 белый", desc: "ЛДСП 2750×1830 · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 2.0, price: 85000, per: 1, color: "#f0efe9", part: "carcass", en: "Egger premium white carcass LDSP" },
  { id: "ldsp-walnut-dark", code: "B2", name: "Орех тёмный", desc: "ЛДСП 2750×1830 · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 0.6, price: 98000, per: 1, color: "#5a4636", part: "carcass", tex: "wood_walnut", en: "dark walnut carcass LDSP" },
  { id: "ldsp-grey", code: "B3", name: "ЛДСП Серый", desc: "Корпус, светло-серый · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 1.5, price: 82000, per: 1, color: "#c9c8c3", part: "carcass" },
  { id: "ldsp-anthracite", code: "B4", name: "ЛДСП Антрацит", desc: "Корпус, антрацит · 16мм", thickness: "16mm", thicknessMm: 16, sheetW: 2750, sheetH: 1830, stockSheets: 1.1, price: 90000, per: 1, color: "#46474a", part: "carcass" },

  // C · Задняя стенка (C1, C2...)
  { id: "hdf-white", code: "C1", name: "ХДФ белёный", desc: "ХДФ 2745×1700 · 3мм", thickness: "3mm", thicknessMm: 3, sheetW: 2745, sheetH: 1700, stockSheets: 0.5, price: 45000, per: 1, color: "#f6f5f0", part: "back", en: "white HDF back panel sheet" },
  { id: "hdf-oak", code: "C2", name: "ХДФ дуб", desc: "ХДФ 2745×1700 · 3мм", thickness: "3mm", thicknessMm: 3, sheetW: 2745, sheetH: 1700, stockSheets: 0.3, price: 48000, per: 1, color: "#d2b48c", part: "back", tex: "wood_oak", en: "oak HDF back panel sheet" },

  // W / M · Столешница (W1, W2...)
  { id: "wt-stone-matte", code: "W1", name: "Камень матовый", desc: "Камень 3200×1600 · 38мм", thickness: "38mm", thicknessMm: 38, sheetW: 3200, sheetH: 1600, stockSheets: 0.0, price: 280000, per: 1, color: "#dcdbd7", part: "worktop", en: "matte white solid stone countertop" },
  { id: "ekbacken", code: "W2", name: "Дуб массивная", desc: "Столешница, дуб · 28мм", thickness: "28mm", thicknessMm: 28, sheetW: 3000, sheetH: 1200, stockSheets: 1.0, price: 210000, per: 1, color: "#caa777", part: "worktop", tex: "wood_oak", en: "warm solid oak butcher-block countertop" },
  { id: "kasker", code: "W3", name: "Мрамор белый", desc: "Столешница, мрамор · 30мм", thickness: "30mm", thicknessMm: 30, sheetW: 3200, sheetH: 1600, stockSheets: 0.5, price: 320000, per: 1, color: "#e6e4e0", part: "worktop", tex: "marble", en: "white marble countertop" },

  // Handles & Hardware
  { id: "bagannas-bk", code: "H1", name: "Скоба чёрная", desc: "Ручка, черная", thickness: "10mm", price: 6000, per: 2, color: "#2b2b2b", part: "handle", en: "matte black tubular metal handles" },
  { id: "bagannas-st", code: "H2", name: "Скоба сталь", desc: "Ручка, сталь", thickness: "10mm", price: 7000, per: 2, color: "#b9bdc1", part: "handle", en: "brushed stainless-steel tubular handles" },
];

/** hex string ("#rrggbb") → the colour int the renderer + finish overrides use. */
export const hexToInt = (hex: string) => parseInt(hex.replace("#", ""), 16);

/** the catalog material a finish colour came from (exact colour+part match), or undefined
 *  — lets the 3D recover the picked material's PBR texture from the stored finish. */
export function catalogByColor(colorInt: number | undefined, part: FinishKey): EmanMaterial | undefined {
  if (colorInt == null) return undefined;
  return EMAN_MATERIALS.find((m) => m.part === part && hexToInt(m.color) === colorInt);
}

// `money` defaults to UZS (`fmtSum`); pass a `useMoney()` formatter to honour the
// user's chosen currency (the price is a UZS base amount).
export const matPriceLabel = (m: EmanMaterial, money: (n: number) => string = fmtSum) => `${money(m.price)} за ${m.per}`;
