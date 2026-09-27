// apps/app/src/app2/catalogPresets.ts
//
// CATALOG PRESETS FOR APP 2 3-LEVEL BOTTOM TRAY (Step 3 / ROADMAP §2.2).
//
// 3 Gallery Levels:
// 1. "type" (★ Типы) — Complete compositions (Japandi TV wall, handleless Gola kitchen, tall oven/microwave unit, asymmetric etagere).
// 2. "module" (⊞ Модули) — Standard parametric cabinet modules (Wall cabinet 720, 3-drawer base, double sink base, tall pantry 2040).
// 3. "component" (📦 Компоненты) — Reusable sub-assemblies (5-piece drawer box, wine rack, 100mm pylon spacer, open shelf unit).

import type { Design, Gallery } from "../poligon/model/space";

export interface CatalogPreset {
  id: string;
  name: string;
  category: Gallery; // "type" | "module" | "component"
  icon: string;
  subtitle: string;
  dims: { w: number; h: number; d: number };
  design: Design;
  tags: string[];
}

export const CATALOG_PRESETS: CatalogPreset[] = [
  // ── 1. ★ ТИПЫ (Готовые композиции) ──────────────────────────────────────────
  {
    id: "type-japandi-tv-wall",
    name: "Japandi ТВ-стена",
    category: "type",
    icon: "📺",
    subtitle: "4 секции · скрытый нижний захват (-18 мм)",
    dims: { w: 2400, h: 420, d: 400 },
    tags: ["Готовая композиция", "ТВ-зона", "Japandi"],
    design: {
      envelope: { w: 2400, h: 420, d: 400 },
      root: {
        id: "tv-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "x",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "bay-1" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "bay-2" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "bay-3" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "bay-4" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [
        {
          id: "tv-door-1",
          covers: ["bay-1"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 18 },
        },
        {
          id: "tv-door-2",
          covers: ["bay-2"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 18 },
        },
        {
          id: "tv-door-3",
          covers: ["bay-3"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "right" },
          delta: { bottom: 18 },
        },
        {
          id: "tv-door-4",
          covers: ["bay-4"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "right" },
          delta: { bottom: 18 },
        },
      ],
    },
  },
  {
    id: "type-kitchen-handleless",
    name: "Кухня без ручек Gola",
    category: "type",
    icon: "🍳",
    subtitle: "Gola Grip (+20 мм) · 2 глубоких ящика",
    dims: { w: 800, h: 870, d: 560 },
    tags: ["Кухня", "Без ручек", "Gola"],
    design: {
      envelope: { w: 800, h: 870, d: 560 },
      root: {
        id: "gola-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "fixed", mm: 140 }, space: { id: "drw-cutlery" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "drw-pots" } },
          ],
          between: [{ kind: "board", slot: "carcass" }],
        },
      },
      fronts: [
        {
          id: "gola-front-top",
          covers: ["drw-cutlery"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: -20 },
        },
        {
          id: "gola-front-bot",
          covers: ["drw-pots"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "type-tall-oven-microwave",
    name: "Пенал Духовка + СВЧ",
    category: "type",
    icon: "🥘",
    subtitle: "Ниша 595 мм + ниша 380 мм + антресоль",
    dims: { w: 600, h: 2040, d: 560 },
    tags: ["Пенал", "Встраиваемая техника"],
    design: {
      envelope: { w: 600, h: 2040, d: 560 },
      root: {
        id: "tall-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "fixed", mm: 600 }, space: { id: "oven-base" } },
            { rule: { rule: "fixed", mm: 595 }, space: { id: "oven-niche" } },
            { rule: { rule: "fixed", mm: 380 }, space: { id: "mw-niche" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "oven-top" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [
        {
          id: "door-oven-base",
          covers: ["oven-base"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "door-oven-top",
          covers: ["oven-top"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "type-asymmetric-etagere",
    name: "Асимметричный стеллаж",
    category: "type",
    icon: "📚",
    subtitle: "Золотое сечение 1:1.618 · открытые полки",
    dims: { w: 900, h: 1800, d: 320 },
    tags: ["Стеллаж", "Гостиная", "Архитектура"],
    design: {
      envelope: { w: 900, h: 1800, d: 320 },
      root: {
        id: "etg-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "ratio", weight: 1.618 }, space: { id: "etg-bot" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "etg-mid" } },
            { rule: { rule: "ratio", weight: 1.618 }, space: { id: "etg-top" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [],
    },
  },

  // ── 2. ⊞ МОДУЛИ (Параметрические корпуса) ─────────────────────────────────
  {
    id: "mod-internal-drawer-cabinet",
    name: "Шкаф со скрытым ящиком",
    category: "module",
    icon: "🗄️",
    subtitle: "Петли 110° · скрытый ящик · Закон 1 (интерлок)",
    dims: { w: 600, h: 720, d: 560 },
    tags: ["Нижняя база", "Скрытый ящик", "Закон 1"],
    design: {
      envelope: { w: 600, h: 720, d: 560 },
      root: {
        id: "cab-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            {
              rule: { rule: "fixed", mm: 240 },
              space: {
                id: "cell-inner-drawer",
              },
            },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "cell-top" } },
          ],
          between: [{ kind: "board", slot: "carcass" }],
        },
      },
      fronts: [
        {
          id: "door-1",
          covers: ["cab-root"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "inner-drawer-front",
          covers: ["cell-inner-drawer"],
          slot: "carcass",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "mod-wall-cabinet-720",
    name: "Верхний шкаф 720",
    category: "module",
    icon: "🗄️",
    subtitle: "Свес -25 мм под нижний захват · 1 полка",
    dims: { w: 600, h: 720, d: 300 },
    tags: ["Верхний модуль", "Распашной"],
    design: {
      envelope: { w: 600, h: 720, d: 300 },
      root: {
        id: "cab-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "cell-bot" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "cell-top" } },
          ],
          between: [{ kind: "board", slot: "carcass" }],
        },
      },
      fronts: [
        {
          id: "door-1",
          covers: ["cab-root"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 25 },
        },
      ],
    },
  },
  {
    id: "mod-base-3-drawers",
    name: "База с 3 ящиками",
    category: "module",
    icon: "🗃️",
    subtitle: "140 мм приборы + 2 равных ящика",
    dims: { w: 600, h: 870, d: 560 },
    tags: ["Нижняя база", "Ящики"],
    design: {
      envelope: { w: 600, h: 870, d: 560 },
      root: {
        id: "base-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "fixed", mm: 140 }, space: { id: "drw-1" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "drw-2" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "drw-3" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [
        {
          id: "front-drw-1",
          covers: ["drw-1"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "front-drw-2",
          covers: ["drw-2"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "front-drw-3",
          covers: ["drw-3"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "mod-sink-base-double",
    name: "Мойка распашная 800",
    category: "module",
    icon: "🚰",
    subtitle: "2 створки · открытый проём под чашу",
    dims: { w: 800, h: 870, d: 560 },
    tags: ["Мойка", "Двустворчатый"],
    design: {
      envelope: { w: 800, h: 870, d: 560 },
      root: {
        id: "sink-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "x",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "sink-left" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "sink-right" } },
          ],
        },
      },
      fronts: [
        {
          id: "sink-door-l",
          covers: ["sink-left"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "sink-door-r",
          covers: ["sink-right"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "right" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "mod-tall-pantry-2040",
    name: "Пенал-колонна 2040",
    category: "module",
    icon: "🏛️",
    subtitle: "Высота 2040 мм · 5 полок на System 32",
    dims: { w: 600, h: 2040, d: 560 },
    tags: ["Пенал", "Хранение"],
    design: {
      envelope: { w: 600, h: 2040, d: 560 },
      root: {
        id: "pantry-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "pantry-1" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "pantry-2" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "pantry-3" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "pantry-4" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "pantry-5" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [
        {
          id: "pantry-door-bot",
          covers: ["pantry-1", "pantry-2"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
        {
          id: "pantry-door-top",
          covers: ["pantry-3", "pantry-4", "pantry-5"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },

  // ── 3. 📦 КОМПОНЕНТЫ (Сборные узлы) ───────────────────────────────────────
  {
    id: "comp-drawer-box-5p",
    name: "5-детальный ящик",
    category: "component",
    icon: "📥",
    subtitle: "Боковины 16 мм · зазоры 12.7 мм под шариковые направляющие",
    dims: { w: 600, h: 260, d: 500 },
    tags: ["Сборный узел", "Ящик"],
    design: {
      envelope: { w: 600, h: 260, d: 500 },
      root: {
        id: "drw-box-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
        },
      },
      fronts: [
        {
          id: "drw-front",
          covers: ["drw-box-root"],
          slot: "facade",
          mount: { thing: "slide_h45", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "comp-wine-rack-lattice",
    name: "Винная решётка",
    category: "component",
    icon: "🍷",
    subtitle: "Сетка 3 × 4 под бутылки 100 мм",
    dims: { w: 300, h: 720, d: 300 },
    tags: ["Сборный узел", "Винный модуль"],
    design: {
      envelope: { w: 300, h: 720, d: 300 },
      root: {
        id: "wine-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "wine-r1" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "wine-r2" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "wine-r3" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "wine-r4" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [],
    },
  },
  {
    id: "comp-pylon-spacer-100",
    name: "Пилон / Добор 100 мм",
    category: "component",
    icon: "📏",
    subtitle: "Компенсатор неровностей стен и наличников",
    dims: { w: 100, h: 870, d: 560 },
    tags: ["Добор", "Пилон"],
    design: {
      envelope: { w: 100, h: 870, d: 560 },
      root: {
        id: "pylon-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
        },
      },
      fronts: [
        {
          id: "pylon-front",
          covers: ["pylon-root"],
          slot: "facade",
          mount: { thing: "hinge_standard", side: "left" },
          delta: { bottom: 0 },
        },
      ],
    },
  },
  {
    id: "comp-open-shelf-unit",
    name: "Полочный блок System 32",
    category: "component",
    icon: "📖",
    subtitle: "3 открытых отсека с шагом 32 мм",
    dims: { w: 600, h: 720, d: 300 },
    tags: ["Полки", "Открытый"],
    design: {
      envelope: { w: 600, h: 720, d: 300 },
      root: {
        id: "shelf-root",
        faces: {
          left: { kind: "board", slot: "carcass" },
          right: { kind: "board", slot: "carcass" },
          bottom: { kind: "board", slot: "carcass" },
          top: { kind: "board", slot: "carcass" },
        },
        split: {
          axis: "y",
          children: [
            { rule: { rule: "ratio", weight: 1 }, space: { id: "sh-1" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "sh-2" } },
            { rule: { rule: "ratio", weight: 1 }, space: { id: "sh-3" } },
          ],
          between: [
            { kind: "board", slot: "carcass" },
            { kind: "board", slot: "carcass" },
          ],
        },
      },
      fronts: [],
    },
  },
];
