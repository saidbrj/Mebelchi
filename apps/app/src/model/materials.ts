// Eman.uz material catalogue (placeholder). The real product feed — names,
// thicknesses and live pricing — will be wired in later; for now this seeds the
// "Стиль" picker so the furniture-editor flow is complete and demonstrable.

import { fmtSum } from "./format";
import type { FinishKey } from "./cabinet";

export interface EmanMaterial {
  id: string;
  name: string;
  desc: string; // e.g. "Ручка, черная"
  thickness: string; // e.g. "10mm"
  price: number; // sum, per pack
  per: number; // pack size ("за N")
  color: string; // swatch
  part: FinishKey; // which render colour this material drives
  en?: string; // English material descriptor for the AI render prompt
  tex?: string; // PBR texture key (three/pbr.ts TEX) — drives the live 3D surface
}

export const EMAN_MATERIALS: EmanMaterial[] = [
  { id: "bagannas-bk", name: "Скоба чёрная", desc: "Ручка, черная", thickness: "10mm", price: 6000, per: 2, color: "#2b2b2b", part: "handle", en: "matte black tubular metal handles" },
  { id: "bagannas-st", name: "Скоба сталь", desc: "Ручка, сталь", thickness: "10mm", price: 7000, per: 2, color: "#b9bdc1", part: "handle", en: "brushed stainless-steel tubular handles" },
  { id: "vinstaa", name: "Белый глянец", desc: "Фасад, белый глянец", thickness: "18mm", price: 142000, per: 1, color: "#f3f0ea", part: "facade", en: "white high-gloss lacquered cabinet fronts" },
  { id: "ekbacken", name: "Дуб", desc: "Столешница, дуб", thickness: "28mm", price: 210000, per: 1, color: "#caa777", part: "worktop", en: "warm solid oak butcher-block countertop", tex: "wood_oak" },
  { id: "sibbarp", name: "Бетон", desc: "Стеновая панель, бетон", thickness: "13mm", price: 96000, per: 1, color: "#9b9a96", part: "carcass", en: "grey concrete-look panels" },
  { id: "lerhyttan", name: "Орех", desc: "Фасад, орех", thickness: "18mm", price: 168000, per: 1, color: "#5a4636", part: "facade", en: "walnut solid-wood cabinet fronts", tex: "wood_walnut" },
  { id: "voxtorp", name: "Антрацит матовый", desc: "Фасад, матовый антрацит", thickness: "18mm", price: 158000, per: 1, color: "#5d5b57", part: "facade", en: "matte anthracite handleless cabinet fronts" },
  { id: "stensund", name: "Бежевый", desc: "Фасад, бежевый", thickness: "18mm", price: 149000, per: 1, color: "#cdbfa3", part: "facade", en: "soft beige shaker cabinet fronts" },
  { id: "bodbyn", name: "Серый матовый", desc: "Фасад, серый", thickness: "18mm", price: 152000, per: 1, color: "#9ea29b", part: "facade", en: "warm grey shaker cabinet fronts" },
  { id: "torhamn", name: "Дуб натуральный", desc: "Фасад, дуб", thickness: "18mm", price: 175000, per: 1, color: "#c8a878", part: "facade", en: "natural oak solid-wood cabinet fronts", tex: "wood_oak" },
  { id: "maximera", name: "Доводчик", desc: "Ящик, доводчик", thickness: "—", price: 88000, per: 1, color: "#d6dadd", part: "carcass" },
  { id: "utrusta", name: "Стекло закалённое", desc: "Полка, закалённое стекло", thickness: "5mm", price: 42000, per: 1, color: "#cdeaf5", part: "carcass" },
  { id: "kungsbacka", name: "Антрацит", desc: "Фасад, антрацит", thickness: "18mm", price: 161000, per: 1, color: "#4a4640", part: "facade", en: "matte dark anthracite cabinet fronts" },
  { id: "ringhult", name: "Светло-серый глянец", desc: "Фасад, светло-серый глянец", thickness: "18mm", price: 156000, per: 1, color: "#dcd9d2", part: "facade", en: "light grey high-gloss cabinet fronts" },
  { id: "kasker", name: "Мрамор белый", desc: "Столешница, мрамор", thickness: "30mm", price: 320000, per: 1, color: "#e6e4e0", part: "worktop", en: "white marble countertop", tex: "marble" },
  { id: "saeljan", name: "Мрамор чёрный", desc: "Столешница, чёрный мрамор", thickness: "28mm", price: 180000, per: 1, color: "#3c3b3a", part: "worktop", en: "black marble countertop", tex: "marble" },
  { id: "ekestad", name: "Серый дуб", desc: "Фасад, серый дуб", thickness: "18mm", price: 171000, per: 1, color: "#6b6258", part: "facade", en: "grey-oak wood cabinet fronts", tex: "wood_ash" },
  { id: "askersund", name: "Тёмное дерево", desc: "Фасад, тёмное дерево", thickness: "18mm", price: 166000, per: 1, color: "#43352a", part: "facade", en: "dark wenge wood cabinet fronts", tex: "wood_wenge" },
  // trending flat-colour facades (PLACEHOLDER prices — real supplier pricing wired next launch)
  { id: "fac-white-matte", name: "Белый матовый", desc: "Фасад, белый мат", thickness: "18mm", price: 148000, per: 1, color: "#eef0ec", part: "facade", en: "matte white cabinet fronts" },
  { id: "fac-cream", name: "Кремовый", desc: "Фасад, кремовый", thickness: "18mm", price: 150000, per: 1, color: "#e7ddc7", part: "facade", en: "warm cream ivory matte cabinet fronts" },
  { id: "fac-sage", name: "Шалфей", desc: "Фасад, шалфейный", thickness: "18mm", price: 156000, per: 1, color: "#9caf88", part: "facade", en: "sage green matte cabinet fronts" },
  { id: "fac-olive", name: "Оливковый", desc: "Фасад, оливковый", thickness: "18mm", price: 156000, per: 1, color: "#6f743f", part: "facade", en: "olive green matte cabinet fronts" },
  { id: "fac-forest", name: "Лесной зелёный", desc: "Фасад, тёмно-зелёный", thickness: "18mm", price: 158000, per: 1, color: "#33503f", part: "facade", en: "deep forest green matte cabinet fronts" },
  { id: "fac-navy", name: "Тёмно-синий", desc: "Фасад, синий", thickness: "18mm", price: 158000, per: 1, color: "#2c3a4d", part: "facade", en: "navy blue matte cabinet fronts" },
  { id: "fac-dusty-blue", name: "Пыльно-синий", desc: "Фасад, пыльно-синий", thickness: "18mm", price: 156000, per: 1, color: "#8098a6", part: "facade", en: "dusty blue matte cabinet fronts" },
  { id: "fac-terracotta", name: "Терракота", desc: "Фасад, терракотовый", thickness: "18mm", price: 156000, per: 1, color: "#a9563b", part: "facade", en: "terracotta clay matte cabinet fronts" },
  { id: "fac-taupe", name: "Тауп", desc: "Фасад, серо-бежевый", thickness: "18mm", price: 152000, per: 1, color: "#8d8578", part: "facade", en: "warm taupe greige matte cabinet fronts" },
  { id: "fac-black-matte", name: "Чёрный матовый", desc: "Фасад, чёрный мат", thickness: "18mm", price: 160000, per: 1, color: "#202020", part: "facade", en: "matte black cabinet fronts" },
  // additional flat-colour worktops (PLACEHOLDER prices)
  { id: "wt-white", name: "Белый камень", desc: "Столешница, белый", thickness: "38mm", price: 195000, per: 1, color: "#edeae3", part: "worktop", en: "white solid-surface stone countertop" },
  { id: "wt-black", name: "Чёрный камень", desc: "Столешница, чёрный", thickness: "38mm", price: 205000, per: 1, color: "#262528", part: "worktop", en: "black solid-surface stone countertop" },
  { id: "wt-grey", name: "Серый камень", desc: "Столешница, серый", thickness: "38mm", price: 190000, per: 1, color: "#8b8a85", part: "worktop", en: "grey stone countertop" },
  { id: "wt-sand", name: "Песочный", desc: "Столешница, песочный", thickness: "38mm", price: 190000, per: 1, color: "#cabf9f", part: "worktop", en: "sand beige stone countertop" },
  { id: "wt-graphite", name: "Графит", desc: "Столешница, графит", thickness: "38mm", price: 200000, per: 1, color: "#3b3d40", part: "worktop", en: "graphite stone countertop" },
  { id: "wt-marble-grey", name: "Мрамор серый", desc: "Столешница, серый мрамор", thickness: "30mm", price: 240000, per: 1, color: "#cbcbc5", part: "worktop", en: "grey veined marble countertop", tex: "marble" },
  // carcass (Корпус) body finishes — more options than the original 3
  { id: "ldsp-white", name: "ЛДСП", desc: "Корпус, белый", thickness: "16mm", price: 78000, per: 1, color: "#f0efe9", part: "carcass" },
  { id: "ldsp-grey", name: "ЛДСП", desc: "Корпус, светло-серый", thickness: "16mm", price: 82000, per: 1, color: "#c9c8c3", part: "carcass" },
  { id: "ldsp-sand", name: "ЛДСП", desc: "Корпус, песочный", thickness: "16mm", price: 84000, per: 1, color: "#cdbfa3", part: "carcass" },
  { id: "ldsp-oak", name: "ЛДСП", desc: "Корпус, дуб", thickness: "16mm", price: 96000, per: 1, color: "#c8a878", part: "carcass", tex: "wood_oak" },
  { id: "ldsp-walnut", name: "ЛДСП", desc: "Корпус, орех", thickness: "16mm", price: 98000, per: 1, color: "#5a4636", part: "carcass", tex: "wood_walnut" },
  { id: "ldsp-anthracite", name: "ЛДСП", desc: "Корпус, антрацит", thickness: "16mm", price: 90000, per: 1, color: "#46474a", part: "carcass" },
  { id: "ldsp-black", name: "ЛДСП", desc: "Корпус, чёрный", thickness: "16mm", price: 88000, per: 1, color: "#232323", part: "carcass" },
  { id: "ldsp-cappuccino", name: "ЛДСП", desc: "Корпус, капучино", thickness: "16mm", price: 86000, per: 1, color: "#b39d82", part: "carcass" },
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
