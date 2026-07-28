// Catalog of modules the user can ADD in the constructor (Phase C). Each template is
// a partial Cabinet fed to `mk()` by `store.addCab`, which auto-fits it into the first
// free gap on a wall run. Grouped with section headings (IKEA-style) so the picker
// stays readable as the catalog grows; the chip itself is the visual one-tap "category"
// level. When the real Eman feed (photos + prices) lands, a chip can open a leaf
// product-list — the grouping here is the level above that.
//
// Two sheets mirror the bottom toolbar's pickers:
//   Шкафы (cabinets)     → pickCab  → CABINET_GROUPS
//   Бытовая (appliances) → pickAppl → APPLIANCE_GROUPS
// Corner units carry `corner:true` and are dropped free-floating (no straight-run gap
// fits a diagonal unit); everything else tiles into a run.

import type { Cabinet } from "./cabinet";
import { CORNER_UPPER_MM } from "./runPlan";

export interface AddTemplate {
  id: string;
  name: string;
  sub: string;
  /** glyph shown on the chip (text/emoji so it needs no new icon assets) */
  glyph: string;
  cab: Partial<Cabinet>;
  /** seat this in the TOPMOST wall row of the target run rather than at the default mounting
   *  height — the store resolves it against the rows that actually exist (mountY, height, depth).
   *  A marker on the template, not a property of the cabinet it makes. */
  topBand?: boolean;
}

/** A titled section of templates — rendered as a heading + a grid of chips. */
export interface AddGroup {
  heading: string;
  items: AddTemplate[];
}

const TALL_H = 2100;
const BASE_H = 720;

export const CABINET_GROUPS: AddGroup[] = [
  {
    heading: "Напольные",
    items: [
      { id: "base-door", name: "Распашной", sub: "600", glyph: "▢", cab: { kind: "base", w: 600, h: BASE_H, fill: "shelves", count: 2, door: 0 } },
      { id: "base-drawers", name: "С ящиками", sub: "600", glyph: "▤", cab: { kind: "base", w: 600, h: BASE_H, fill: "drawers", count: 3, door: 0 } },
      { id: "sink-base", name: "Под мойку", sub: "800", glyph: "◑", cab: { kind: "base", w: 800, h: BASE_H, fill: "open", count: 0, door: 0, appliance: "sink" } },
    ],
  },
  {
    heading: "Навесные",
    items: [{ id: "upper", name: "Навесной", sub: "600", glyph: "▭", cab: { kind: "upper", w: 600, h: BASE_H, fill: "shelves", count: 2, door: 0 } }],
  },
  {
    heading: "Высокие",
    items: [{ id: "tall", name: "Пенал", sub: "Колонна · 600", glyph: "▯", cab: { kind: "tall", w: 600, h: TALL_H, fill: "shelves", count: 5, door: 0 } }],
  },
  {
    heading: "Угловые",
    items: [
      { id: "corner", name: "Угловой", sub: "840", glyph: "◣", cab: { kind: "base", w: 840, depth: 840, h: BASE_H, fill: "shelves", count: 2, door: 0, corner: true } },
      // Corner WALL cabinets. The square is CORNER_UPPER_MM (613) — this template used to say
      // 600×350, which `healCornerUnits` silently rewrote to 613 on the next heal; now it just says
      // what it is. Both BODIES are offered: real kitchens use the chamfer and the L-shaped box.
      { id: "corner-upper", name: "Угловой навесной", sub: "Диагональный · 613", glyph: "◸", cab: { kind: "upper", w: CORNER_UPPER_MM, depth: CORNER_UPPER_MM, h: 720, fill: "shelves", count: 2, door: 0, corner: true, cornerShape: "diagonal" } },
      { id: "corner-upper-l", name: "Угловой навесной Г", sub: "Г-образный · 613", glyph: "◱", cab: { kind: "upper", w: CORNER_UPPER_MM, depth: CORNER_UPPER_MM, h: 720, fill: "shelves", count: 2, door: 0, corner: true, cornerShape: "l" } },
      // …and one for the TOP row. `topBand` is resolved by the store against the wall rows that
      // actually exist on the target run, so it lands at the antresol's height AND depth (a deep
      // top row needs the big 840 square, not 613).
      { id: "corner-upper-top", name: "Угловой · антресоль", sub: "Верхний ряд", glyph: "◰", topBand: true, cab: { kind: "upper", w: CORNER_UPPER_MM, depth: CORNER_UPPER_MM, h: 460, fill: "shelves", count: 1, door: 0, corner: true } },
      // OUTER corners — the ANGLED END UNIT that caps a run where the room turns a convex corner:
      // one front corner cut at 45°, open display shelves, no zone reserved. NO depth/armDepth here
      // on purpose — the store gives it the depth of the row it joins, so it lines up with its
      // neighbour whatever that kitchen's rows are.
      { id: "corner-outer", name: "Внешний угол", sub: "Скошенный · 400", glyph: "◿", cab: { kind: "base", w: 400, h: BASE_H, fill: "open", count: 2, door: 0, corner: true, cornerShape: "outer" } },
      { id: "corner-outer-upper", name: "Внешний угол навесной", sub: "Скошенный · 300", glyph: "◿", cab: { kind: "upper", w: 300, h: 720, fill: "open", count: 2, door: 0, corner: true, cornerShape: "outer" } },
    ],
  },
  {
    // free-standing island — a real base counter dropped in the middle of the room (never
    // tiles a wall run); rendered with a seating overhang + bar stools, priced as a base module
    heading: "Остров",
    items: [
      { id: "island", name: "Остров", sub: "1200×700", glyph: "▣", cab: { kind: "base", island: true, w: 1200, depth: 700, h: BASE_H, fill: "drawers", count: 3, door: 0 } },
      { id: "island-lg", name: "Остров · большой", sub: "1800×900", glyph: "▨", cab: { kind: "base", island: true, w: 1800, depth: 900, h: BASE_H, fill: "drawers", count: 3, door: 0 } },
    ],
  },
];

// free-standing furniture (tables + chairs) — added via the "Обеденная" toolbar button,
// placed free-floating in the room (furniture:"table"|"chair" → special 3D geometry).
export const FURNITURE_GROUPS: AddGroup[] = [
  {
    heading: "Столы",
    items: [
      { id: "table-2", name: "Стол · 2", sub: "700×700", glyph: "▢", cab: { furniture: "table", kind: "base", w: 700, depth: 700, h: 740 } },
      { id: "table-4", name: "Стол · 4", sub: "1200×800", glyph: "▭", cab: { furniture: "table", kind: "base", w: 1200, depth: 800, h: 740 } },
      { id: "table-6", name: "Стол · 6", sub: "1800×900", glyph: "▬", cab: { furniture: "table", kind: "base", w: 1800, depth: 900, h: 740 } },
    ],
  },
  {
    heading: "Стулья",
    items: [{ id: "chair", name: "Стул", sub: "460×480", glyph: "🪑", cab: { furniture: "chair", kind: "base", w: 460, depth: 480, h: 900 } }],
  },
];

// kitchen extras (the "Дополнительные" toolbar button) — free-standing visual pieces
// that reuse the furniture system (rendered free-floating, priced as non-cabinet).
export const EXTRA_GROUPS: AddGroup[] = [
  {
    heading: "Мебель и хранение",
    items: [
      { id: "trolley", name: "Тележка", sub: "500×400", glyph: "🛒", cab: { furniture: "trolley", kind: "base", w: 500, depth: 400, h: 850 } },
      { id: "shelf", name: "Полка настенная", sub: "800×250", glyph: "▦", cab: { furniture: "shelf", kind: "base", w: 800, depth: 250, h: 300 } },
    ],
  },
  {
    heading: "Прочее",
    items: [
      { id: "stool", name: "Барный стул", sub: "380×380", glyph: "🪑", cab: { furniture: "stool", kind: "base", w: 380, depth: 380, h: 700 } },
      { id: "bin", name: "Ведро", sub: "350×300", glyph: "🗑", cab: { furniture: "bin", kind: "base", w: 350, depth: 300, h: 600 } },
    ],
  },
];

export const APPLIANCE_GROUPS: AddGroup[] = [
  {
    heading: "Встраиваемая",
    items: [
      { id: "oven", name: "Духовой шкаф", sub: "Пенал", glyph: "⊟", cab: { kind: "tall", w: 600, h: TALL_H, fill: "shelves", count: 2, door: 0, appliance: "oven", builtin: true } },
      { id: "hob", name: "Плита", sub: "Напольная · 600", glyph: "⊞", cab: { kind: "base", w: 600, h: BASE_H, fill: "drawers", count: 2, door: 0, appliance: "hob" } },
      { id: "dishwasher", name: "Посудомойка", sub: "Напольная · 600", glyph: "▥", cab: { kind: "base", w: 600, h: BASE_H, fill: "open", count: 0, door: 0, appliance: "dishwasher" } },
      { id: "hood", name: "Вытяжка", sub: "Навесная · 600", glyph: "△", cab: { kind: "upper", w: 600, h: 350, fill: "open", count: 0, door: 3, handle: 3, appliance: "hood" } },
    ],
  },
  {
    heading: "Отдельностоящая",
    items: [
      { id: "fridge", name: "Холодильник", sub: "600", glyph: "❄", cab: { kind: "tall", w: 600, h: TALL_H, fill: "shelves", count: 0, door: 0, appliance: "fridge", builtin: false } },
      { id: "washer", name: "Стиральная машина", sub: "Напольная · 600", glyph: "◍", cab: { kind: "base", w: 600, h: BASE_H, fill: "open", count: 0, door: 0, appliance: "washer" } },
    ],
  },
];
