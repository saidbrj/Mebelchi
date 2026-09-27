// Phase C — "Конструктор". Re-skinned to mirror the room editor (Phase A): a live
// 3D stage with its own chrome (price + nav bar on top, a category toolbar on the
// bottom). Bottom-left carries two round toggles like the room editor — a 3D/2D
// view switcher and a render-style switcher (realistic / translucent / wireframe).
// Tapping a module in the scene selects + highlights it and swaps the bottom
// toolbar to per-item actions (edit / open / duplicate / delete).
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, usePanelSpecs } from "../store";
import { useT } from "../i18n/useT";
import { useMoney } from "../useMoney";
import { useDesignPrice, useDesignLighting } from "../pricing/usePrice";
import { LED_TEMPS, ledColor } from "../model/ledStrips";
import { sinkOf, sinkHole, type SinkSpec } from "../model/sink";
import { VariantScene } from "../three/VariantScene";
import { DEFAULT_SUN } from "../three/lighting";
import { RoomScene } from "./RoomScene";
import { ConstructorPlan, type PlanEdit } from "../components/ConstructorPlan";
import { ElevationGrid, type EditDim } from "../components/ElevationGrid";
import { locate, type CellRef, type RowKind } from "../model/grid";
import { V21Cabinet3DStudio } from "../components/V21Cabinet3DStudio";
import { QuickEditBar } from "../components/QuickEditBar";
import { FillEditor } from "../components/FillEditor";
import { DimSlider, DimControls, GlyphW, GlyphH, GlyphD, GlyphShelf } from "../components/DimControls";
import { JourneyBar } from "../components/JourneyBar";
import { planRuns } from "../model/runPlan";
import { fillGapSpan } from "../model/fill";
import { openCells } from "../model/sheet";
import { resolveLayout } from "../model/resolve";
import { cabBand, cabDepth, cornerShapeOf, cornerArm, maxCabH, MIN_H, D_MIN, D_MAX } from "../model/bands";
import type { PanelDecor } from "../model/wallPanels";
import { GEOM, effectiveStyle, type KitchenLayout, type WallBand, type Zone, type FridgeType, type OvenType, type HoodType } from "../model/layout";
import { dockAll, cabFootprints, objectOverlapIds } from "../model/footprint";
import { FRONT_PROFILES, HANDLES, frontOf, defaultHandlePos, mk, type Cabinet, type FrontProfile, type FinishKey, type DoorOpening, type HandlePos, type BackPanelMethod } from "../model/cabinet";
import { constructionOf, shopConstruction, overridesOf, resetToShop, backMountPatch, backSetbackOf } from "../model/construction";
import { hexToInt } from "../model/materials";
import { materialsFor } from "../model/catalog";
import { PART_FINISH } from "../model/parts";
import { CABINET_GROUPS, APPLIANCE_GROUPS, FURNITURE_GROUPS, EXTRA_GROUPS, type AddTemplate } from "../model/addCatalog";
import { listSavedCabs } from "../model/savedCabs";
import { templateThumbnail } from "../lib/cabThumb";
import { FLOOR_COVERINGS } from "../model/floors";
import { wallSegments, type Pt } from "../model/room";
import {
  IconCabinets,
  IconAppliance,
  IconDining,
  IconExtra,
  IconLines,
  IconTransparent,
  IconRealistic,
  IconEditItem,
  IconOpenItem,
  IconDuplicateItem,
  IconDeleteItem,
  IconUndo,
  IconRedo,
  Icon3D,
  IconFront,
  IconPlan,
  IconCamera,
} from "../components/icons";

/** A real built-in appliance (excludes plain modules and render-only fillers). */
const isAppliance = (c: Cabinet) => !!c.appliance && c.appliance !== "none" && c.appliance !== "filler";

/** Catalog-chip thumbnail: the module's PNG render (public/furniture/<id>.png).
 *
 *  Not every template has one — the newer modules (the angled end unit, the L-shaped upper corner,
 *  the corner antresol, the washer) shipped without artwork and fell back to a text glyph, so half
 *  the catalogue read as pictures and half as symbols. When the PNG is missing the module is now
 *  RENDERED from itself, by the same capture «Сохранить» uses on a saved cabinet, in the kitchen's
 *  own colours (lib/cabThumb). The glyph survives only as the last resort, if that render fails
 *  (no WebGL). Rendering happens once per template and is cached across mounts. */
/** Namespaces a «Мои шкафы» entry inside the AddTemplate id space. */
const SAVED_PREFIX = "saved:";

function AddThumb({ id, glyph, cab }: { id: string; glyph: string; cab?: Partial<Cabinet> }) {
  const style = useStore((s) => s.runStyle);
  const [src, setSrc] = useState<string | null>(`/furniture/${id}.png`);
  // a template can appear in several lists at once; keep each copy's fallback in step with the id
  const shownFor = useRef(id);
  if (shownFor.current !== id) {
    shownFor.current = id;
    setSrc(`/furniture/${id}.png`);
  }
  const onMissing = () => setSrc(cab ? templateThumbnail(id, mk(cab), style) : null);
  if (!src) return <span className="add-glyph" aria-hidden="true">{glyph}</span>;
  return (
    <img
      className="add-img"
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={onMissing}
    />
  );
}

type Sheet = null | "pickCab" | "pickAppl" | "editor" | "dining" | "extra" | "resize" | "style" | "cabinets" | "finish";

const MODES = [
  { v: "wire", Icon: IconLines },
  { v: "xray", Icon: IconTransparent },
  { v: "real", Icon: IconRealistic },
] as const;

// batch-style controls (multi-select): front profile labels + the facade colour swatches
const FRONT_LABEL: Record<FrontProfile, string> = {
  flat: "Гладкий", shaker: "Шейкер", raised: "Филёнка", fluted: "Рифлёный", glass: "Стекло", grid: "Решётка", none: "—",
};
const FRONT_CHOICES = FRONT_PROFILES.filter((p) => p !== "none");

// Шкафы-panel filter — categorise a catalog template by what its cabinet IS
const CAB_CATS: { id: string; name: string; ok: (c: Partial<Cabinet>) => boolean }[] = [
  { id: "all", name: "Все", ok: () => true },
  { id: "base", name: "Напольные", ok: (c) => c.kind === "base" && !c.corner && !c.island },
  { id: "wall", name: "Навесные", ok: (c) => c.kind === "upper" && !c.corner },
  { id: "tall", name: "Высокие", ok: (c) => c.kind === "tall" },
  { id: "corner", name: "Угловые", ok: (c) => !!c.corner },
  { id: "island", name: "Острова", ok: (c) => !!c.island },
];

// left-stack glyphs (from the supplied SVGs) — paint with currentColor so the active state can tint them
const GlyphResize = () => (
  <svg width="24" height="24" viewBox="0 0 33 33" fill="currentColor" aria-hidden>
    <path d="M16.5 4.25806L12.2043 8.55378L13.4948 9.84429L15.5874 7.75168V12.8495H17.4126V7.75168L19.5052 9.84429L20.7957 8.55378L16.5 4.25806ZM8.55379 12.2043L4.25806 16.5L8.55379 20.7957L9.84429 19.5052L7.75168 17.4126H13.7621V15.5874H7.75168L9.84429 13.4948L8.55379 12.2043ZM24.4462 12.2043L23.1557 13.4948L25.2483 15.5874H19.2379V17.4126H25.2483L23.1557 19.5052L24.4462 20.7957L28.7419 16.5L24.4462 12.2043ZM15.5874 19.2379V25.2483L13.4948 23.1557L12.2043 24.4462L16.5 28.7419L20.7957 24.4462L19.5052 23.1557L17.4126 25.2483V19.2379H15.5874Z" />
  </svg>
);
const GlyphStyle = () => (
  <svg width="24" height="24" viewBox="0 0 33 33" fill="currentColor" aria-hidden>
    <path d="M6.6001 5.28003V12.5086H22.8001V5.28003H6.6001ZM8.4001 7.08717H21.0001V10.7015H8.4001V7.08717ZM23.7001 7.99074V9.79789H24.6001V13.6381L16.247 16.1511L15.6001 16.3488V18.8336H13.8001V26.9657H19.2001V18.8336H17.4001V17.7041L25.7532 15.1911L26.4001 14.9934V7.99074H23.7001ZM15.6001 20.6407H17.4001V25.1586H15.6001V20.6407Z" />
  </svg>
);
const GlyphCabinets = () => (
  <svg width="24" height="24" viewBox="0 0 33 33" fill="currentColor" aria-hidden>
    <path d="M8 6V27H25V6H8ZM9.7 7.75H23.3V12.125H9.7V7.75ZM14.8 9.5V11.25H18.2V9.5H14.8ZM9.7 13.875H23.3V19.125H9.7V13.875ZM14.8 15.625V17.375H18.2V15.625H14.8ZM9.7 20.875H23.3V25.25H9.7V20.875ZM14.8 21.75V23.5H18.2V21.75H14.8Z" />
  </svg>
);
const GlyphEdit = () => (
  <svg width="24" height="24" viewBox="0 0 33 33" fill="currentColor" aria-hidden>
    <path d="M22.4 6.6c-.8 0-1.5.3-2.1.9l-1.4 1.4 4.2 4.2 1.4-1.4c1.2-1.2 1.2-3 0-4.2-.6-.6-1.3-.9-2.1-.9zM17.5 10.3l-9.9 9.9-.5 2.3-1.1 5 5-1.1 2.3-.5 9.9-9.9-5.7-5.7zM9.1 21.6l-.7-.7 8.4-8.4 1.4 1.4-8.4 8.4-.7-.7z" />
  </svg>
);

// style-panel part-tab glyphs (Фасад / Ручка / Столешница / Корпус)
/** ОТДЕЛКА — палитра отделки и материалов */
const GlyphFinish = () => (
  <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
    <path d="M15.5942 2.96923C15.063 2.98486 14.5161 3.04345 13.9692 3.12548H13.938C8.61376 3.99657 4.30126 8.19189 3.21923 13.5005C2.89501 15.0122 2.91455 16.4224 3.12548 17.813C3.1333 17.8169 3.12548 17.8364 3.12548 17.8442C3.45361 20.1919 6.50048 21.2192 8.21923 19.5005C9.4497 18.27 11.27 18.27 12.5005 19.5005C13.731 20.7309 13.731 22.5513 12.5005 23.7817C10.7817 25.5005 11.8091 28.5474 14.1567 28.8755C14.1645 28.8755 14.1841 28.8677 14.188 28.8755C15.5669 29.0864 16.9692 29.0981 18.4692 28.7817C18.481 28.7817 18.4888 28.7817 18.5005 28.7817C23.8247 27.7895 28.0083 23.3755 28.8755 18.063V18.0317C30.0083 10.3911 24.4224 3.71923 17.1567 3.03173C16.6372 2.98095 16.1255 2.95361 15.5942 2.96923ZM15.6255 4.96923C16.0786 4.95361 16.5278 4.96142 16.9692 5.00048C23.1645 5.56689 27.8755 11.2153 26.9067 17.7505C26.1763 22.227 22.5864 25.9927 18.1255 26.813H18.0942C16.8169 27.0864 15.6372 27.0903 14.438 26.9067C13.6177 26.8052 13.2388 25.8872 13.9067 25.2192C15.8755 23.2505 15.8755 20.063 13.9067 18.0942C11.938 16.1255 8.75048 16.1255 6.78173 18.0942C6.11376 18.7622 5.1958 18.3833 5.09423 17.563C4.91064 16.3638 4.91455 15.1841 5.18798 13.9067C6.10595 9.41845 9.77392 5.8247 14.2505 5.09423C14.7192 5.02392 15.1724 4.98486 15.6255 4.96923ZM14.0005 7.00048C12.895 7.00048 12.0005 7.89501 12.0005 9.00048C12.0005 10.1059 12.895 11.0005 14.0005 11.0005C15.106 11.0005 16.0005 10.1059 16.0005 9.00048C16.0005 7.89501 15.106 7.00048 14.0005 7.00048ZM21.0005 9.00048C19.895 9.00048 19.0005 9.89501 19.0005 11.0005C19.0005 12.1059 19.895 13.0005 21.0005 13.0005C22.106 13.0005 23.0005 12.1059 23.0005 11.0005C23.0005 9.89501 22.106 9.00048 21.0005 9.00048ZM9.00048 11.0005C7.89501 11.0005 7.00048 11.895 7.00048 13.0005C7.00048 14.1059 7.89501 15.0005 9.00048 15.0005C10.106 15.0005 11.0005 14.1059 11.0005 13.0005C11.0005 11.895 10.106 11.0005 9.00048 11.0005ZM23.0005 16.0005C21.895 16.0005 21.0005 16.895 21.0005 18.0005C21.0005 19.1059 21.895 20.0005 23.0005 20.0005C24.106 20.0005 25.0005 19.1059 25.0005 18.0005C25.0005 16.895 24.106 16.0005 23.0005 16.0005ZM19.0005 21.0005C17.895 21.0005 17.0005 21.895 17.0005 23.0005C17.0005 24.1059 17.895 25.0005 19.0005 25.0005C20.106 25.0005 21.0005 24.1059 21.0005 23.0005C21.0005 21.895 20.106 21.0005 19.0005 21.0005Z" />
  </svg>
);

const StyleFront = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="5" y="3" width="14" height="18" rx="1.5" /><circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" /></svg>);
const StyleHandle = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><rect x="6" y="10.5" width="12" height="3" rx="1.5" /><path d="M8 10.5v-1M16 10.5v-1" /></svg>);
const StyleWorktop = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="3" y="6" width="18" height="4" rx="1" /><path d="M6 10v8M18 10v8" /></svg>);
const StyleCarcass = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M9 9v11" /></svg>);


// TAP-TO-PLACE bands. Five categories the way the user thinks about a wall: three rows of cabinets,
// a floor-to-ceiling column, and everything free-standing. Appliances fold into the row they live in
// (Плита→base, Вытяжка→upper, Духовой шкаф/Холодильник→tall). Placement band comes from the cell you
// tap; these tabs pick WHAT to place and keep the choice one tap away.
const _cabs = CABINET_GROUPS.flatMap((g) => g.items);
const _appl = APPLIANCE_GROUPS.flatMap((g) => g.items);
const _furn = FURNITURE_GROUPS.flatMap((g) => g.items);
const _extra = EXTRA_GROUPS.flatMap((g) => g.items);
// The five build BANDS, shown as furniture-image chips (image + label). Tapping a chip arms that
// band's default module and lights up its wall cells; the last one is FREE placement (islands,
// tables, extras) which has no wall to snap to, so it opens a picker instead. `png` is the chip's
// representative render (public/furniture/<png>.png); `items[0]` is what a tap on a wall places.
const PLACE_ROWS: { key: string; label: string; png: string; items: AddTemplate[] }[] = [
  { key: "r1", label: "Нижние", png: "base-door", items: [..._cabs.filter((t) => t.cab.kind === "base" && !t.cab.island && !t.cab.furniture), ..._appl.filter((t) => t.cab.kind === "base")] },
  { key: "r2", label: "Навесные", png: "upper", items: [..._cabs.filter((t) => t.cab.kind === "upper" && !t.topBand), ..._appl.filter((t) => t.cab.kind === "upper")] },
  { key: "r3", label: "Антресоль", png: "upper", items: _cabs.filter((t) => t.cab.kind === "upper" || t.topBand) },
  { key: "tall", label: "Пеналы", png: "tall", items: [..._cabs.filter((t) => t.cab.kind === "tall"), ..._appl.filter((t) => t.cab.kind === "tall")] },
  // NO CORNER CHIPS HERE. Both kinds of corner are placed AFTER the straight runs — an inner corner
  // by turning the cabinet that ends up in the corner (the swap strip, or «угол» in the front view),
  // an end unit from «Свободно» → «Внешний угол», which seats itself. Arming a corner for a wall tap
  // put the cart before the horse: you cannot say which cabinet turns the corner until the wall has
  // cabinets on it.
  { key: "extra", label: "Свободно", png: "island", items: [..._cabs.filter((t) => t.cab.island), ..._furn, ..._extra] },
];

// Everything that stands FREE in the room (no wall run): the island, dining tables/chairs and the
// small extras. The «Свободно» chip opens this as one picker; each pick drops in immediately.
const FREE_GROUPS = [
  { heading: "Остров", items: _cabs.filter((t) => t.cab.island) },
  // OUTER end caps live here too: they seat themselves at a run's exposed end, so — like an island —
  // they drop in on pick rather than arming a wall tap (see addItem).
  { heading: "Внешний угол", items: _cabs.filter((t) => t.cab.cornerShape === "outer") },
  ...FURNITURE_GROUPS,
  ...EXTRA_GROUPS,
];

// Ergonomic kitchen layout compositions (Appliance placement & Triangle rules)
export interface KitchenCompositionPreset {
  id: string;
  name: string;
  subtitle: string;
  fridge: FridgeType;
  oven: OvenType;
  hood: HoodType;
  dishwasher: boolean;
  water?: Zone;
  wallBand: "single" | "antresol";
}

export const KITCHEN_COMPOSITIONS: KitchenCompositionPreset[] = [
  {
    id: "classic-triangle",
    name: "Классический",
    subtitle: "Пенал + встр. холод + ПММ",
    fridge: "integ",
    oven: "tall",
    hood: "integ",
    dishwasher: true,
    wallBand: "antresol",
  },
  {
    id: "compact-under",
    name: "Максимум зоны",
    subtitle: "Духовка под плитой + ПММ",
    fridge: "integ",
    oven: "under",
    hood: "integ",
    dishwasher: true,
    wallBand: "single",
  },
  {
    id: "tall-tower",
    name: "Антресоли",
    subtitle: "Пенал духовки + до потолка",
    fridge: "integ",
    oven: "tall",
    hood: "integ",
    dishwasher: true,
    wallBand: "antresol",
  },
  {
    id: "dome-hood-accent",
    name: "Купольная вытяжка",
    subtitle: "Открытая вытяжка + духовка",
    fridge: "integ",
    oven: "under",
    hood: "dome",
    dishwasher: true,
    wallBand: "single",
  },
  {
    id: "freestanding-fridge",
    name: "Соло-холодильник",
    subtitle: "Отдельный холод. + пенал",
    fridge: "free",
    oven: "tall",
    hood: "integ",
    dishwasher: true,
    wallBand: "single",
  },
  {
    id: "minimal-compact",
    name: "Без пеналов",
    subtitle: "Компактная прямая кухня",
    fridge: "none",
    oven: "under",
    hood: "integ",
    dishwasher: true,
    wallBand: "single",
  },
];

export interface FinishPaletteOption {
  id: string;
  name: string;
  color1: string;
  color2: string;
  facade: number;
  carcass: number;
  worktop: number;
  isCustom?: boolean;
}

export const FINISH_PALETTES: FinishPaletteOption[] = [
  {
    id: "white-wood",
    name: "Белый & Дуб",
    color1: "#fdfdfc",
    color2: "#d4b896",
    facade: 0xf5f5f0,
    carcass: 0xf0ede6,
    worktop: 0xd4b896,
  },
  {
    id: "graphite-walnut",
    name: "Графит & Орех",
    color1: "#373a3c",
    color2: "#6a4a35",
    facade: 0x3a3d40,
    carcass: 0x2b2d30,
    worktop: 0x5c4033,
  },
  {
    id: "cashmere-stone",
    name: "Кашемир & Камень",
    color1: "#ded6cc",
    color2: "#baa998",
    facade: 0xded6cc,
    carcass: 0xede8e1,
    worktop: 0xefedea,
  },
  {
    id: "emerald-gold",
    name: "Изумруд & Мрамор",
    color1: "#1b4d3e",
    color2: "#f3f4f6",
    facade: 0x1b4d3e,
    carcass: 0x223830,
    worktop: 0xf3f4f6,
  },
  {
    id: "loft-concrete",
    name: "Лофт & Бетон",
    color1: "#6e7072",
    color2: "#282828",
    facade: 0x6e7072,
    carcass: 0x4a4c4e,
    worktop: 0x282828,
  },
  {
    id: "black-wood",
    name: "Черный & Дуб",
    color1: "#1e2022",
    color2: "#bfa37c",
    facade: 0x202224,
    carcass: 0x18191a,
    worktop: 0xbfa37c,
  },
];

const CUSTOM_PALS_KEY = "mebelchi.custom_palettes.v1";
const memCustomPals = new Map<string, string>();

export const loadCustomPalettes = (): FinishPaletteOption[] => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOM_PALS_KEY) : null;
    const data = raw || memCustomPals.get(CUSTOM_PALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    const mem = memCustomPals.get(CUSTOM_PALS_KEY);
    return mem ? JSON.parse(mem) : [];
  }
};

export const saveCustomPalettes = (pals: FinishPaletteOption[]) => {
  try {
    const json = JSON.stringify(pals);
    memCustomPals.set(CUSTOM_PALS_KEY, json);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_PALS_KEY, json);
    }
  } catch {
    /* ignore */
  }
};

// 3D Isometric Kitchen Layout Illustrations (Rich 3D aesthetics)
const LayoutThumbI = () => (
  <svg width="96" height="70" viewBox="0 0 120 90" fill="none" className="tpl-illus-svg">
    <defs>
      <linearGradient id="i-wt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E2C9A6" />
        <stop offset="100%" stopColor="#C49A6C" />
      </linearGradient>
      <linearGradient id="i-cab" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F8FAFC" />
        <stop offset="100%" stopColor="#E2E8F0" />
      </linearGradient>
      <linearGradient id="i-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    {/* Floor shadow */}
    <ellipse cx="60" cy="74" rx="46" ry="9" fill="#0F172A" fillOpacity="0.08" />

    {/* Back wall tile accent */}
    <path d="M16 45 L78 24 L86 28 L24 49 Z" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="0.8" />

    {/* Base cabinet plinth */}
    <path d="M22 62 L74 44 L80 47 L28 65 Z" fill="#334155" />

    {/* Base cabinet body */}
    <path d="M18 47 L76 27 L88 34 L30 54 Z" fill="url(#i-cab)" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M18 47 L30 54 L30 68 L18 61 Z" fill="#94A3B8" />
    <path d="M30 54 L88 34 L88 48 L30 68 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />

    {/* Base cabinet door lines */}
    <line x1="50" y1="47" x2="50" y2="61" stroke="#64748B" strokeWidth="1" />
    <line x1="70" y1="40" x2="70" y2="54" stroke="#64748B" strokeWidth="1" />

    {/* Countertop with 3D edge */}
    <path d="M16 45 L77 25 L90 33 L29 53 Z" fill="url(#i-wt)" stroke="#B88A58" strokeWidth="1.2" />
    <path d="M16 45 L29 53 L29 55 L16 47 Z" fill="#9C6F3E" />
    <path d="M29 53 L90 33 L90 35 L29 55 Z" fill="#B88A58" />

    {/* Stainless Sink with mixer faucet */}
    <path d="M36 43 L48 39 L54 42 L42 46 Z" fill="#94A3B8" stroke="#475569" strokeWidth="0.8" />
    <path d="M38 43 L46 40 L50 42 L42 45 Z" fill="#64748B" />
    <path d="M47 38 L47 35 Q47 33 49 33 L51 34" stroke="#CBD5E1" strokeWidth="1.2" fill="none" strokeLinecap="round" />

    {/* Black Ceramic Hob */}
    <path d="M60 35 L74 30 L80 34 L66 38 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="0.8" />
    <circle cx="68" cy="34" r="2.5" fill="#334155" />
    <circle cx="73" cy="32" r="2" fill="#334155" />

    {/* Upper Wall Cabinets */}
    <path d="M28 22 L78 5 L86 10 L36 27 Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.8" />
    <path d="M28 22 L36 27 L36 41 L28 36 Z" fill="#94A3B8" />
    <path d="M36 27 L86 10 L86 24 L36 41 Z" fill="url(#i-glass)" stroke="#94A3B8" strokeWidth="0.8" />
    <line x1="53" y1="21" x2="53" y2="35" stroke="#60A5FA" strokeWidth="0.8" />
    <line x1="70" y1="15" x2="70" y2="29" stroke="#60A5FA" strokeWidth="0.8" />

    {/* Warm LED Under-cabinet glow line */}
    <line x1="36" y1="41.5" x2="86" y2="24.5" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
  </svg>
);

const LayoutThumbL = () => (
  <svg width="96" height="70" viewBox="0 0 120 90" fill="none" className="tpl-illus-svg">
    <defs>
      <linearGradient id="l-wt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E2C9A6" />
        <stop offset="100%" stopColor="#C49A6C" />
      </linearGradient>
      <linearGradient id="l-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    {/* Floor shadow */}
    <ellipse cx="60" cy="75" rx="48" ry="10" fill="#0F172A" fillOpacity="0.08" />

    {/* Left base run */}
    <path d="M12 44 L60 27 L70 33 L22 50 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    {/* Right base return run */}
    <path d="M52 30 L94 47 L82 54 L42 37 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />

    {/* Sides and fronts */}
    <path d="M12 44 L22 50 L22 64 L12 58 Z" fill="#94A3B8" />
    <path d="M22 50 L46 41 L46 55 L22 64 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <path d="M46 41 L82 55 L82 69 L46 55 Z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.8" />
    <path d="M82 55 L94 47 L94 61 L82 69 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />

    {/* L-shaped continuous Countertop */}
    <path d="M10 42 L60 25 L96 45 L83 53 L46 35 L22 49 Z" fill="url(#l-wt)" stroke="#B88A58" strokeWidth="1.2" />
    <path d="M10 42 L22 49 L22 51 L10 44 Z" fill="#9C6F3E" />
    <path d="M22 49 L46 35 L46 37 L22 51 Z" fill="#B88A58" />
    <path d="M46 35 L83 53 L83 55 L46 37 Z" fill="#9C6F3E" />
    <path d="M83 53 L96 45 L96 47 L83 55 Z" fill="#B88A58" />

    {/* Sink on left wing */}
    <path d="M25 43 L35 39 L40 42 L30 46 Z" fill="#64748B" stroke="#475569" strokeWidth="0.6" />
    <path d="M36 39 L36 36 Q36 34 38 34 L39 35" stroke="#CBD5E1" strokeWidth="1" fill="none" strokeLinecap="round" />

    {/* Cooktop on right wing */}
    <path d="M58 39 L70 45 L65 48 L53 42 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="0.6" />
    <circle cx="61" cy="43" r="2" fill="#334155" />

    {/* L-shaped Upper Cabinets */}
    <path d="M22 19 L62 5 L70 10 L30 24 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M22 19 L30 24 L30 37 L22 32 Z" fill="#94A3B8" />
    <path d="M30 24 L70 10 L70 23 L30 37 Z" fill="url(#l-glass)" stroke="#94A3B8" strokeWidth="0.8" />
    {/* Return upper */}
    <path d="M62 8 L84 18 L76 23 L54 13 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M54 13 L76 23 L76 36 L54 26 Z" fill="url(#l-glass)" stroke="#94A3B8" strokeWidth="0.8" />

    {/* LED Under-cabinet glow */}
    <line x1="30" y1="37.5" x2="70" y2="23.5" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    <line x1="54" y1="26.5" x2="76" y2="36.5" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
  </svg>
);

const LayoutThumbU = () => (
  <svg width="96" height="70" viewBox="0 0 120 90" fill="none" className="tpl-illus-svg">
    <defs>
      <linearGradient id="u-wt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E2C9A6" />
        <stop offset="100%" stopColor="#C49A6C" />
      </linearGradient>
    </defs>
    {/* Floor shadow */}
    <ellipse cx="60" cy="74" rx="48" ry="10" fill="#0F172A" fillOpacity="0.08" />

    {/* Left arm base */}
    <path d="M12 36 L32 46 L24 51 L6 40 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <path d="M6 40 L24 51 L24 63 L6 52 Z" fill="#94A3B8" />
    <path d="M32 46 L24 51 L24 63 L32 58 Z" fill="#CBD5E1" />

    {/* Back main run base */}
    <path d="M12 36 L72 17 L82 23 L24 42 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />

    {/* Right arm base */}
    <path d="M72 17 L96 30 L86 36 L62 23 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <path d="M62 23 L86 36 L86 48 L62 35 Z" fill="#94A3B8" />
    <path d="M86 36 L96 30 L96 42 L86 48 Z" fill="#CBD5E1" />

    {/* Full U-shaped Countertop */}
    <path d="M5 38 L16 33 L72 15 L98 29 L86 36 L64 24 L26 36 L33 44 L20 51 Z" fill="url(#u-wt)" stroke="#B88A58" strokeWidth="1.2" />
    <path d="M20 51 L33 44 L33 46 L20 53 Z" fill="#9C6F3E" />
    <path d="M5 38 L20 51 L20 53 L5 40 Z" fill="#B88A58" />
    <path d="M86 36 L98 29 L98 31 L86 38 Z" fill="#B88A58" />

    {/* Sink in back run center */}
    <path d="M42 27 L54 23 L59 26 L47 30 Z" fill="#64748B" stroke="#475569" strokeWidth="0.6" />

    {/* Upper cabinets on back wall */}
    <path d="M28 12 L72 1 L80 6 L36 17 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M36 17 L80 6 L80 18 L36 29 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.8" />

    {/* Warm LED Under-cabinet glow line */}
    <line x1="36" y1="29.5" x2="80" y2="18.5" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
  </svg>
);

const LayoutThumbPeninsula = () => (
  <svg width="96" height="70" viewBox="0 0 120 90" fill="none" className="tpl-illus-svg">
    <defs>
      <linearGradient id="p-wt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E2C9A6" />
        <stop offset="100%" stopColor="#C49A6C" />
      </linearGradient>
      <linearGradient id="p-isl" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="p-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    {/* Floor shadows */}
    <ellipse cx="60" cy="46" rx="40" ry="7" fill="#0F172A" fillOpacity="0.06" />
    <ellipse cx="58" cy="74" rx="32" ry="8" fill="#0F172A" fillOpacity="0.1" />

    {/* Back wall run: tall cabinet + base run */}
    <path d="M16 29 L76 13 L86 19 L26 35 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M16 29 L26 35 L26 47 L16 41 Z" fill="#94A3B8" />
    <path d="M26 35 L86 19 L86 31 L26 47 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />

    {/* Back countertop */}
    <path d="M14 27 L76 11 L88 18 L26 34 Z" fill="url(#p-wt)" stroke="#B88A58" strokeWidth="1" />

    {/* Back upper cabinets */}
    <path d="M26 9 L76 0 L86 5 L36 14 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M36 14 L86 5 L86 16 L36 25 Z" fill="url(#p-glass)" stroke="#94A3B8" strokeWidth="0.8" />
    <line x1="36" y1="25.5" x2="86" y2="16.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />

    {/* Freestanding Waterfall Kitchen Island */}
    <path d="M30 54 L72 41 L82 47 L40 60 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M30 54 L40 60 L40 73 L30 67 Z" fill="#94A3B8" />
    <path d="M40 60 L82 47 L82 60 L40 73 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />

    {/* Island Waterfall Countertop */}
    <path d="M28 52 L72 39 L84 46 L40 59 Z" fill="url(#p-isl)" stroke="#065F46" strokeWidth="1.2" />
    <path d="M28 52 L40 59 L40 73 L28 66 Z" fill="#047857" stroke="#065F46" strokeWidth="0.8" />
    <path d="M40 59 L84 46 L84 48 L40 61 Z" fill="#059669" />
  </svg>
);

const KITCHEN_LAYOUT_CHOICES = [
  { id: "i" as const, title: "Прямая", badge: "Линейная", Thumb: LayoutThumbI },
  { id: "l" as const, title: "Угловая", badge: "Г-образная", Thumb: LayoutThumbL },
  { id: "u" as const, title: "П-образная", badge: "Вместительная", Thumb: LayoutThumbU },
  { id: "peninsula" as const, title: "С островом", badge: "Современная", Thumb: LayoutThumbPeninsula },
];

export function ConfigScreen() {
  const t = useT();
  const money = useMoney();
  const settings = useStore((s) => s.settings);
  // Subscribe (no value needed): the material pickers below call materialsFor() during render,
  // so all this has to do is re-render the screen when Каталог changes the list.
  const showPricing = useStore((s) => s.settings.showPricing && (s.settings.pricingItems || s.settings.pricingSqm));
  const quality = settings.quality;
  const cabs = useStore((s) => s.cabs);
  const price = useDesignPrice(cabs); // USD, per the active pricing mode
  const selIdx = useStore((s) => s.selIdx);
  const mode = useStore((s) => s.mode);
  const constructionRev = useStore((s) => s.constructionRev);
  const runLayout = useStore((s) => s.runLayout);
  const runStyle = useStore((s) => s.runStyle);
  const points = useStore((s) => s.roomPoints);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
  const panelSpecs = usePanelSpecs();
  const led = useStore((s) => s.led);
  const setSplash = useStore((st) => st.setSplash);
  const setCloser = useStore((st) => st.setCloser);
  const setUnderside = useStore((st) => st.setUnderside);
  const setLed = useStore((st) => st.setLed);
  const liftCab = useStore((st) => st.liftCab);
  /** any zone switched on — what decides whether the colour/sensor controls are worth showing */
  const ledLit = led.under || led.plinth || led.cornice || led.interior;
  /** what the light actually came to on THIS kitchen: metres of strip and the drivers it needs */
  const ledMeasured = useDesignLighting();
  const setGrain = useStore((st) => st.setGrain);
  const setCornerDoors = useStore((st) => st.setCornerDoors);
  const splash = panelSpecs.splash;
  const closer = panelSpecs.closer;
  const underside = panelSpecs.underside;
  const openings = useStore((s) => s.openings);
  const interiorWalls = useStore((s) => s.interiorWalls);
  const fittings = useStore((s) => s.fittings);
  const wallSurfaces = useStore((s) => s.wallSurfaces);
  const waterWall = useStore((s) => s.waterWall);
  const setWaterWall = useStore((s) => s.setWaterWall);
  const shape = useStore((s) => s.shape);
  const setShape = useStore((s) => s.setShape);
  const setRoomWidth = useStore((s) => s.setRoomWidth);
  const setRoomDepth = useStore((s) => s.setRoomDepth);
  const setWallLength = useStore((s) => s.setWallLength);
  const setCeilingValue = useStore((s) => s.setCeilingValue);
  const addOpening = useStore((s) => s.addOpening);
  const removeOpening = useStore((s) => s.removeOpening);
  const setFloorCovering = useStore((s) => s.setFloorCovering);
  const generateVariants = useStore((s) => s.generateVariants);
  const applyLayoutTemplate = useStore((s) => s.applyLayoutTemplate);
  const goTo = useStore((s) => s.goTo);
  const floorCovering = useStore((s) => s.floorCovering);
  const selectCab = useStore((s) => s.selectCab);
  const patchCab = useStore((s) => s.patchCab);
  const patchCabLive = useStore((s) => s.patchCabLive);
  const applyFinishToAll = useStore((s) => s.applyFinishToAll);
  const applyStylePackage = useStore((s) => s.applyStylePackage);
  const patchAllCabs = useStore((s) => s.patchAllCabs);
  const fillCabGap = useStore((s) => s.fillCabGap);
  const fillWallRow = useStore((s) => s.fillWallRow);
  const addCab = useStore((s) => s.addCab);
  const replaceCab = useStore((s) => s.replaceCab);
  const removeCab = useStore((s) => s.removeCab);
  const duplicateCab = useStore((s) => s.duplicateCab);
  const saveCab = useStore((s) => s.saveCab);
  const removeSavedCab = useStore((s) => s.removeSavedCab);
  const savedCabsRev = useStore((s) => s.savedCabsRev); // re-render the "My cabinets" list on save/delete
  // Read the saved library ONCE per change instead of hitting localStorage on every render — this
  // screen re-renders on every 3D interaction.
  const savedLib = useMemo(() => listSavedCabs(), [savedCabsRev]);
  const resizeCab = useStore((s) => s.resizeCab);
  // the front sheet's live (no-undo) edits — one snapshot per gesture via beginCabEdit
  const resizeCabLive = useStore((s) => s.resizeCabLive);
  const patchCabDims = useStore((s) => s.patchCabDims);
  const addCabAt = useStore((s) => s.addCabAt);
  // ── the sheet (model/grid.ts) — every front-view edit goes through these
  const grids = useStore((s) => s.grids);
  const openWallSheet = useStore((s) => s.openSheet);
  const addCabInCell = useStore((s) => s.addCabInCell);
  const addCabInTopVoid = useStore((s) => s.addCabInTopVoid);
  const placeCornerInBand = useStore((s) => s.placeCornerInBand);
  const gridSetColW = useStore((s) => s.gridSetColW);
  const gridAddCol = useStore((s) => s.gridAddCol);
  const gridDropCol = useStore((s) => s.gridDropCol);
  const gridFillReach = useStore((s) => s.gridFillReach);
  const addCornerCab = useStore((s) => s.addCornerCab);
  const selIds = useStore((s) => s.selIds);
  const selectOnly = useStore((s) => s.selectOnly);
  const selectMany = useStore((s) => s.selectMany);
  const clearSel = useStore((s) => s.clearSel);
  const toggleSelId = useStore((s) => s.toggleSelId);
  const enterApp2 = useStore((s) => s.enterApp2);
  const applyToSelected = useStore((s) => s.applyToSelected);
  const applyFinishToSelected = useStore((s) => s.applyFinishToSelected);
  const resizeSelectedWidth = useStore((s) => s.resizeSelectedWidth);
  const resizeSelectedSpan = useStore((s) => s.resizeSelectedSpan);
  const dimSelected = useStore((s) => s.dimSelected);
  const equalizeSelected = useStore((s) => s.equalizeSelected);
  const gridSetRowH = useStore((s) => s.gridSetRowH);
  const gridSetRowKind = useStore((s) => s.gridSetRowKind);
  const gridSetCabW = useStore((s) => s.gridSetCabW);
  const healRows = useStore((s) => s.healRows);
  const moveCabPlan = useStore((s) => s.moveCabPlan);
  const beginCabEdit = useStore((s) => s.beginCabEdit);
  const undoCab = useStore((s) => s.undoCab);
  const redoCab = useStore((s) => s.redoCab);
  const canUndoCab = useStore((s) => s.cabsPast.length > 0);
  const canRedoCab = useStore((s) => s.cabsFuture.length > 0);
  const setMode = useStore((s) => s.setMode);
  const saveCurrent = useStore((s) => s.saveCurrent);
  const flash = useStore((s) => s.flash);
  const next = useStore((s) => s.next);

  const labelFor = (c: Cabinet): string => {
    if (c.furniture) return c.furniture === "table" ? `${t.labels.furn.table} ${c.w}` : t.labels.furn[c.furniture] ?? c.furniture;
    if (isAppliance(c)) return t.labels.appl[c.appliance as string] ?? t.config.module;
    // a corner unit read as a plain "Верхний 613 / Навесной шкаф", which is what it is NOT
    if (c.corner) return `${cornerShapeOf(c) === "outer" ? t.fe.cornerOuter : t.config.kindCorner} ${c.w}`;
    if (c.island) return `${t.config.kindIsland} ${c.w}`;
    const k = c.kind === "upper" ? t.config.kindUpper : c.kind === "tall" ? t.config.kindTall : t.config.kindBase;
    return `${k} ${c.w}`;
  };
  const subFor = (c: Cabinet): string => {
    if (c.furniture) return t.config.subFurn;
    if (isAppliance(c)) return t.config.subAppl;
    if (c.corner) {
      // the two things that actually define a corner unit: which body, and how deep the runs it
      // butts into are (its own square follows from that). An END UNIT read «Г-образная» here — the
      // same label as the inner L — so the one module that behaves differently from every other
      // corner was indistinguishable from them on the card. It reads its own DEPTH, not an arm:
      // it stands in the run rather than butting into one.
      const s = cornerShapeOf(c);
      if (s === "outer") return `${t.fe.cornerOuter} · ${t.fe.depth} ${cabDepth(c)}`;
      return `${s === "diagonal" ? t.fe.cornerDiag : t.fe.cornerL} · ${t.fe.cornerArm} ${cornerArm(c)}`;
    }
    return c.kind === "upper" ? t.config.subUpper : c.kind === "tall" ? t.config.subTall : t.config.subBase;
  };
  const modeLabel = (v: (typeof MODES)[number]["v"]) => (v === "wire" ? t.config.mWire : v === "xray" ? t.config.mXray : t.config.mReal);

  const [view, setView] = useState<"3d" | "plan" | "front">("3d");
  const [planGrid, setPlanGrid] = useState(false); // plan: snapping grid overlay
  const [planMagnet, setPlanMagnet] = useState(true); // plan: snap drag/rotate
  const [g3dMagnet, setG3dMagnet] = useState(true); // 3D: snap move/rotate to walls/neighbours/45°
  // THE SHEET, IN THE 3D. Off by default — a room full of green lines is an architectural drawing,
  // not the kitchen you are selling, and the 3D's whole job is to look like the real thing.
  //
  //   off  → the grid appears on the wall of whatever module you TAP, and nowhere else. The room
  //          stays realistic until you reach for the tool.
  //   on   → every wall, always. This is the only way to reach a BARE wall: with nothing standing on
  //          it there is nothing to tap, so nothing could reveal its cells.
  // Show the 3D grid LINES? OFF by default — the scene reads as a realistic room (a lattice on every
  // wall was visual overload). The «Сетка» toggle brings the lines back; the tappable cells stay
  // either way, so you can always place.
  const [gridLines, setGridLines] = useState(false);
  // TAP-TO-PLACE: which band tab is open, and the module armed for the next wall tap. Auto-armed to
  // the 1st-row's first item, so an empty room is build-ready the instant it opens — tap a wall.
  const [placeRow, setPlaceRow] = useState(PLACE_ROWS[0].key);
  const [armedTpl, setArmedTpl] = useState<AddTemplate | null>(PLACE_ROWS[0].items[0] ?? null);
  // switch band → arm that band's first item, so the choice is always ready with zero extra taps.
  // Also DROP the selection: the place chips stay visible while a module is selected (so «Навесные»
  // is always reachable — you no longer have to deselect to switch from bases to uppers), and
  // `placeBand` only lights a band's wall cells when nothing is selected. Clearing here is what turns
  // a chip tap into "start placing this band" instead of a no-op that leaves the old ghost cubes up.
  const pickPlaceRow = (key: string) => {
    setPlaceRow(key);
    const row = PLACE_ROWS.find((r) => r.key === key);
    if (row?.items[0]) setArmedTpl(row.items[0]);
    clearSel();
  };
  // THE CONSTRUCTOR IS AN EDITOR, NOT A CAMERA — but it is lit exactly like one.
  //
  // It runs the Рендер step's «День» rig at the same default sun, with ONE thing taken away: ambient
  // occlusion. So there is no post-processing composer and nothing to wait for after you nudge a module,
  // and the picture is otherwise the picture you will take. Giving the editor a "cheap" light rig of its
  // own was a mistake — the two drifted, and the editor's was the worse of them.
  const [wallIdx, setWallIdx] = useState(0); // which wall run the front view shows
  const [picked, setPicked] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]); // modules with doors/drawers open (3D)
  const [showHint, setShowHint] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [stylePart, setStylePart] = useState<string>("front"); // which part tab the Стиль panel shows
  const [styleAll, setStyleAll] = useState(false); // "Применить ко всем" — style hits EVERY cabinet
  const [cabFilter, setCabFilter] = useState<string>("all"); // Шкафы panel category filter
  const [fillOpen, setFillOpen] = useState(false); // focused full-screen Наполнение editor
  const [sheetClosing, setSheetClosing] = useState(false);
  // when set, picking a catalog item REPLACES this module (instead of adding a new one)
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [ctlMenu, setCtlMenu] = useState<null | "view" | "mode">(null);
  const [menuClosing, setMenuClosing] = useState(false);
  // «Конструкция» disclosure in the Размер panel — shut by default: the shop standard answers it
  // for ~every module, and the eight controls behind it were most of that sheet's weight
  const [conOpen, setConOpen] = useState(false);
  // inline dimension editor for the front view (tap a measurement number)
  const [feEdit, setFeEdit] = useState<{ x: number; y: number; apply: (v: number) => void } | null>(null);
  const [feVal, setFeVal] = useState("");

  const [studioTab, setStudioTab] = useState<"cabs" | "room" | "style">("cabs");
  const [roomEditorOpen, setRoomEditorOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [emptyDismissed, setEmptyDismissed] = useState(false);
  const [tplSetup, setTplSetup] = useState<{
    active: boolean;
    stage: "plan" | "3d";
    layout: KitchenLayout;
    targetWall: number;
    wallBand: "single" | "antresol";
    stylePreset: string;
    paletteId?: string;
    fridge?: FridgeType;
    oven?: OvenType;
    hood?: HoodType;
    dishwasher?: boolean;
    water?: Zone;
  } | null>(null);
  const [tplSubTab, setTplSubTab] = useState<"palette" | "layout">("palette");
  const [tplMinimized, setTplMinimized] = useState(false);

  const [sheetFullscreen, setSheetFullscreen] = useState(false);
  const [customPalettes, setCustomPalettes] = useState<FinishPaletteOption[]>(() => loadCustomPalettes());
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFacade, setCustomFacade] = useState("#f5f5f0");
  const [customWorktop, setCustomWorktop] = useState("#d4b896");
  const [customCarcass, setCustomCarcass] = useState("#f0ede6");
  const [syncCarcassWithFacade, setSyncCarcassWithFacade] = useState(true);
  const [customName, setCustomName] = useState("");
  const [activeFinishPaletteId, setActiveFinishPaletteId] = useState<string | null>(null);

  const dragStartY = useRef<number | null>(null);
  const hasMoved = useRef(false);

  const handleGripPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    hasMoved.current = false;
    const startY = e.clientY;

    const onPointerMove = (evt: PointerEvent) => {
      const diff = evt.clientY - startY;
      if (Math.abs(diff) > 5) {
        hasMoved.current = true;
      }
    };

    const onPointerUp = (evt: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const endY = evt.clientY;
      const deltaY = endY - startY;
      dragStartY.current = null;

      if (deltaY < -25) {
        // Dragged UP -> open to whole screen
        setSheetFullscreen(true);
      } else if (deltaY > 35) {
        // Dragged DOWN ->
        if (sheetFullscreen) {
          setSheetFullscreen(false);
        } else {
          closeSheet();
        }
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleGripClick = () => {
    if (hasMoved.current) return;
    setSheetFullscreen((cur) => !cur);
  };

  // Room geometry helpers for unified Room 1 editing
  const wallSegs = useMemo(() => wallSegments(points, interiorWalls), [points, interiorWalls]);

  // drop the selection if its module was deleted out from under us
  useEffect(() => {
    if (picked && !cabs.some((c) => c.id === picked)) setPicked(null);
  }, [cabs, picked]);
  // repair a saved design whose columns slid into a wall's cleared corner zone — they overlap
  // the corner unit (both go red) and can't be dragged back out. A no-op once clean.
  useEffect(() => {
    healRows();
  }, [cabs, healRows]);
  // an edit panel belongs to a selection — when nothing is selected, close it so no empty sheet lingers
  useEffect(() => {
    if (selIds.length === 0 && (sheet === "resize" || sheet === "style")) setSheet(null);
  }, [selIds.length, sheet]);
  useEffect(() => {
    if (!sheet) setSheetFullscreen(false);
  }, [sheet]);

  const closeSheet = () => {
    setReplaceId(null); // leaving the catalog cancels any pending replace
    setFillOpen(false);
    setSheetFullscreen(false);
    setSheetClosing(true);
    setTimeout(() => {
      setSheet(null);
      setSheetClosing(false);
    }, 230);
  };
  const closeMenu = () => {
    setMenuClosing(true);
    setTimeout(() => {
      setCtlMenu(null);
      setMenuClosing(false);
    }, 200);
  };
  const toggleMenu = (which: "view" | "mode") => {
    if (ctlMenu === which) closeMenu();
    else {
      setMenuClosing(false);
      setCtlMenu(which);
    }
  };
  const pickView = (v: "3d" | "plan" | "front") => {
    setView(v);
    closeMenu();
  };
  const pickMode = (m: (typeof MODES)[number]["v"]) => {
    setMode(m);
    closeMenu();
  };


  // NOTE: no early return when `cabs` is empty — deleting the last module must keep the
  // constructor (and the room) on screen so the user can add more. An early return here
  // was ALSO a React hooks-order crash (a useMemo below it would stop being called →
  // "rendered fewer hooks" → white screen). Everything below tolerates 0 cabs.
  const i = selIdx >= 0 && selIdx < cabs.length ? selIdx : 0;
  // THE SELECTION is a set. One member reads as a single edit; several as a batch (`multi`). When
  // it's a batch there is no single "selected module", so the single-module affordances collapse into
  // the group panels.
  const selCabs = cabs.filter((c) => selIds.includes(c.id));
  const multi = selCabs.length > 1;
  const sel = selCabs.length === 1 ? selCabs[0] : null;
  const selIndex = picked ? cabs.findIndex((c) => c.id === picked) : -1;
  // while the module editor sheet is open, HIDE the on-cabinet selection UI (blue highlight,
  // dimension arrows, move/resize handles) in every view so material/handle changes read
  // clearly — the selection still works in the background (edits target `i`/selIdx).
  const sceneSelId = sheet === "editor" ? null : picked;
  const coveringColor = FLOOR_COVERINGS[floorCovering]?.color ?? "#ecd9b4";
  const floorId = FLOOR_COVERINGS[floorCovering]?.id;
  // the edit panels (from the left stack) are NON-MODAL: no backdrop, so the 3D keeps rotating and
  // the left buttons stay tappable to switch panels. The catalog / full editor stay modal.
  const panelOpen = sheet === "resize" || sheet === "style";
  // THE QUICK EDIT BAR — width + finish for ONE selected module, floating on the scene's bottom
  // edge. Only for a single selection (a width stepper over several modules can't say which one it
  // means) and only while nothing else owns the bottom of the screen. It claims the full-width
  // strip, so the round controls there lift and the camera-walk joystick stands down: that slot
  // walks the camera when nothing is selected and edits the module when something is.
  // It lives in the toolbar head, which an open panel covers anyway — so it tracks the SELECTION
  // alone. Gating it on the panel too would flip the head back to «Добавить шкаф» underneath.
  const quickBar = view === "3d" && !!sel;
  // tapping a left-stack button opens its panel, or closes it if already open (a toggle)
  const openPanel = (k: Sheet) => setSheet((cur) => (cur === k ? null : k));

  // select EXACTLY ONE module (from a chip, or after adding)
  const pick = (id: string | null) => {
    setPicked(id);
    if (id) selectOnly(id);
    else clearSel();
  };
  // a tap in the 3D toggles the module in/out of the selection (no mode — you just keep tapping)
  // DOUBLE TAP on the same module → enter the App 2 cabinet editor ("smart object" pattern)
  const lastTapRef = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const pick3d = (id: string | null) => {
    if (!id) { clearSel(); setPicked(null); return; }
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === id && now - last.t < 400) {
      // DOUBLE TAP → enter App 2 for this cabinet
      lastTapRef.current = { id: "", t: 0 };
      enterApp2(id);
      return;
    }
    lastTapRef.current = { id, t: now };
    // (the «Угловой» chip's tap-to-convert mode lived here. The chip is gone — a corner is made
    // AFTER the run is built, by selecting the cabinet that ended up in the corner and picking
    // «Угловой» from the swap strip, which leads that strip for any plain base/wall unit.)
    toggleSelId(id);
    setPicked(useStore.getState().selIds.slice(-1)[0] ?? null);
  };
  // combined width of the RESIZABLE (gridded) modules — a selected corner/free piece is fixed-size and
  // isn't part of the group resize, so it must not inflate the "Общая ширина" readout/input either
  const selWidth = (() => {
    const grid = selCabs.filter((c) => c.cell && c.px == null);
    return (grid.length ? grid : selCabs).reduce((sum, c) => sum + (c.w ?? 0), 0);
  })();
  // the combined width is EDITABLE only when the selection is a contiguous run of gridded modules on
  // ONE wall band — the same shape resizeSpan needs. Otherwise the readout is display-only.
  const selResizable = (() => {
    // Only the GRIDDED modules can be equalised/resized as a group — a corner (or island / free piece)
    // is fixed-size and free-placed, so IGNORE it instead of letting it disable the whole control. That
    // is why «Распределить поровну» went dead the moment a corner was in the selection.
    const grid = selCabs.filter((c) => c.cell && c.px == null);
    if (grid.length < 2) return false;
    const run = grid[0].run ?? 0;
    if (grid.some((c) => (c.run ?? 0) !== run)) return false;
    const g = grids[run];
    if (!g) return false;
    const locs = grid.map((c) => ({ c, loc: locate(g, c.cell!) }));
    if (locs.some((l) => l.loc.j < 0 || l.loc.i < 0)) return false;
    const j = locs[0].loc.j;
    if (locs.some((l) => l.loc.j !== j)) return false;
    const ranges = locs.map((l) => [l.loc.i, l.loc.i + (l.c.cell!.cs ?? 1) - 1] as [number, number]).sort((a, b) => a[0] - b[0]);
    let i1 = ranges[0][1];
    for (let k = 1; k < ranges.length; k++) { if (ranges[k][0] !== i1 + 1) return false; i1 = ranges[k][1]; }
    return true;
  })();
  // add a NEW module from the catalog: auto-fits into a gap, then selects it so the
  // toolbar switches to per-item actions and the scene highlights the new piece
  const addItem = (tpl: AddTemplate) => {
    if (replaceId) {
      replaceCab(replaceId, tpl.cab); // keep the id → selection stays valid
      pick(replaceId);
      flash(t.config.replaced(tpl.name));
      setReplaceId(null);
      closeSheet();
      return;
    }
    // FREE-STANDING (island / table / chair / trolley…) has no wall run to snap to, so arming it for
    // a wall tap makes no sense — drop it into the room right away and select it. An OUTER end cap is
    // the same: it seats itself at the nearest exposed run end (seatOuterCorner), no cell tap.
    if (tpl.cab.island || tpl.cab.furniture || tpl.cab.cornerShape === "outer") {
      const id = addCab(tpl.cab);
      if (id) {
        pick(id);
        // An END UNIT lands out of sight — it seats itself at the room's exposed corner, which the
        // camera may not even be pointed at. Say what happened rather than leaving it to be found:
        // `cornerFace` is set only when there WAS a corner to cap, and it stands in the run, so the
        // slot it wants may already be taken (the scene tints that red, off-screen).
        const now = useStore.getState().cabs;
        const seated = now.find((c) => c.id === id);
        const outer = tpl.cab.cornerShape === "outer";
        const clash = outer && objectOverlapIds(cabFootprints(now, points, waterWall, runLayout, openings, reveal)).has(id);
        flash(
          outer && !seated?.cornerFace
            ? "В комнате нет выступающего угла — поставлен по центру, перетащите на место"
            : clash
              ? "На торце ряда уже стоит шкаф — подвиньте его или сузьте"
              : t.config.added(tpl.name),
        );
      }
      closeSheet();
      return;
    }
    // TAP-TO-PLACE: picking from the catalog ARMS the module — the next tap on a wall drops it where
    // you choose, instead of auto-fitting it somewhere. Stays armed so you can place several in a row.
    setArmedTpl(tpl);
    flash(`Ставим «${tpl.name}» — нажмите на стену`);
    closeSheet();
  };
  // The catalog that matches the SELECTED module — the same one "Заменять" would open, but
  // laid out as a scrollable strip right on the toolbar. Swapping a module is the single most
  // common edit, and it used to cost three taps (Редактировать → Заменять → pick); now it's one.
  // the swap strip works off a REPRESENTATIVE module — the one selected, or the primary of a group,
  // so the quick-swap options show for a multi-selection too (the tap swaps them all)
  const primary = selCabs[0] ?? null;
  // SHOW ONLY THE ROW'S CABINETS. When a module is selected the quick-swap strip is filtered to the
  // things that belong in ITS band — a base shows base cabinets + base appliances (Распашной … Плита,
  // Посудомойка), a wall unit shows wall cabinets + the hood, a tall shows tall cabinets + oven/fridge.
  // This reuses the exact PLACE_ROWS lists the place chips arm from, so "row = these modules" is defined
  // once. Free-standing pieces (island / table / chair …) keep their own groups.
  const swapItemsRaw: AddTemplate[] = (() => {
    if (!primary) return [];
    if (primary.furniture)
      return (primary.furniture === "table" || primary.furniture === "chair" ? FURNITURE_GROUPS : EXTRA_GROUPS).flatMap((g) => g.items);
    if (primary.island) return PLACE_ROWS.find((r) => r.key === "extra")?.items ?? [];
    const band = primary.kind === "upper" ? "r2" : primary.kind === "tall" ? "tall" : "r1";
    // `topBand` twins (Антресоль) are the same TYPE as their plain sibling — drop them so they don't
    // light up alongside it and block the swap.
    return (PLACE_ROWS.find((r) => r.key === band)?.items ?? []).filter((tpl) => !tpl.topBand);
  })();
  // SURFACE THE CORNER FIRST. "Turn the wall's end cabinet into a corner" (to make an L) must be one
  // VISIBLE tap for a HANGING cabinet exactly like a base — not buried ~7 chips deep where a phone
  // hides it off-screen, which is why the reported workaround was to detach the upper and re-pick it
  // as a corner. So for a plain (non-corner) cabinet, its band's corner template leads the strip:
  // an upper → «Угловой навесной» (613), a base/tall → «Угловой» (840).
  const cornerLeadId =
    primary && !primary.corner && !primary.island && !primary.furniture && !isAppliance(primary)
      ? primary.kind === "upper"
        ? "corner-upper"
        : primary.kind === "base"
          ? "corner"
          : null // a tall has no corner variant — don't lead with an off-band base corner
      : null;
  const cornerLead = cornerLeadId ? swapItemsRaw.find((t) => t.id === cornerLeadId) : undefined;
  // THE USER'S OWN CABINETS BELONG HERE TOO. «Мои шкафы» were reachable only from the full picker
  // sheet, so a cabinet you had deliberately saved to reuse never appeared in the swap strip — you
  // could save one and then never find it again while editing, which reads as the save having done
  // nothing. Only real cabinets (furniture / islands / appliances have their own lists), and only
  // ones of the same kind, so a saved base doesn't offer itself while you're swapping an upper.
  const savedSwapItems: AddTemplate[] = useMemo(
    () =>
      !primary || primary.furniture || primary.island || isAppliance(primary)
        ? []
        : savedLib
            .filter((sc) => (sc.cab.kind ?? "base") === primary.kind)
            .map((sc) => ({ id: SAVED_PREFIX + sc.id, name: sc.name, sub: "", glyph: "▢", cab: sc.cab })),
    [savedLib, primary],
  );
  // corner lead first (see above), then the user's own, then the built-ins — a saved cabinet buried
  // past seven stock chips on a phone is the same as not being there.
  const swapItems: AddTemplate[] = [
    ...(cornerLead ? [cornerLead] : []),
    ...savedSwapItems,
    ...swapItemsRaw.filter((t) => t.id !== cornerLeadId),
  ];
  // WHICH CHIP IS THIS MODULE ALREADY? Match on the template's defining traits, not width — the
  // user resizes modules, and a resized "Распашной" is still a "Распашной".
  //
  // `corner` / `cornerShape` / `island` are part of that identity. Leaving them out meant a selected
  // corner wall unit matched the plain "Навесной" AND every corner template at once: they all lit
  // up, and `swapTo` (which bails on `isCurrent`) refused to swap between them — so a corner cabinet
  // could not be changed into a different corner cabinet at all.
  const isCurrent = (tpl: AddTemplate) =>
    // A saved cabinet is a SPECIFIC configuration (its own cells, sizes and fronts), not a type, so
    // trait-matching would mark it "current" and swapTo() would refuse to apply it — the chip would
    // sit there doing nothing. It is never "already this".
    !tpl.id.startsWith(SAVED_PREFIX) &&
    !!primary &&
    (tpl.cab.kind ?? "base") === primary.kind &&
    (tpl.cab.appliance ?? "none") === (primary.appliance ?? "none") &&
    (tpl.cab.furniture ?? undefined) === (primary.furniture ?? undefined) &&
    (tpl.cab.fill ?? "shelves") === primary.fill &&
    !!tpl.cab.corner === !!primary.corner &&
    !!tpl.cab.island === !!primary.island &&
    // only meaningful between two corners. Read the TEMPLATE's own shape (cornerShapeOf supplies the
    // historic per-kind default when it doesn't name one) — not the selection's, or every corner
    // template would agree with whatever is selected.
    (!primary.corner || cornerShapeOf(tpl.cab as Cabinet) === cornerShapeOf(primary));
  const swapTo = (tpl: AddTemplate) => {
    if (!sel || isCurrent(tpl)) return;
    replaceCab(sel.id, tpl.cab); // keeps the id + its place, so the selection stays valid
    pick(sel.id);
    flash(t.config.replaced(tpl.name));
  };
  // swap EVERY selected module to a template (from the Шкафы panel). replaceCab keeps each id, so the
  // selection stays valid.
  const swapSel = (tpl: AddTemplate) => {
    if (!selIds.length) return;
    selIds.forEach((id) => replaceCab(id, tpl.cab));
    flash(t.config.replaced(tpl.name));
    closeSheet();
  };

  // "Заменять" → open the catalog matching this module's category, in replace mode
  const onReplaceCab = () => {
    const cab = cabs[i];
    if (!cab) return;
    setReplaceId(cab.id);
    const target: Sheet = cab.furniture
      ? cab.furniture === "table" || cab.furniture === "chair"
        ? "dining"
        : "extra"
      : isAppliance(cab)
        ? "pickAppl"
        : "pickCab";
    setSheet(target);
  };

  const openSheet = (kind: Sheet) => setSheet(kind);
  // the user's reusable "My cabinets" library (shown atop the cabinet picker)
  const savedCabs = sheet === "pickCab" ? savedLib : [];

  // selected-module toolbar actions
  const editSel = () => {
    if (!sel) return;
    selectCab(selIndex);
    setSheet("editor");
  };
  // TAP A DOOR, OPEN THAT DOOR — tap it again and it shuts. Only on the module that is already
  // SELECTED: returning false hands the tap back to selection, so the first tap on a cabinet still
  // picks it up rather than swinging something. `openIds` holds either a bare module id (the
  // right-rail button opens everything) or one front's `cabId#n`, so both live in the same list.
  const toggleFront = (key: string): boolean => {
    const cabId = key.includes("#") ? key.slice(0, key.indexOf("#")) : key;
    if (!selIds.includes(cabId)) return false;
    // If user is double-tapping within 400ms on the same cabinet, fall through to pick3d to enter App 2
    const now = Date.now();
    if (lastTapRef.current.id === cabId && now - lastTapRef.current.t < 400) {
      return false;
    }
    setOpenIds((cur) => {
      const rest = cur.filter((k) => k !== cabId && k !== key);
      // whole module already open (via the rail button) → a tap on any of its fronts shuts it,
      // which is what closing "the thing you can see standing open" should do
      if (cur.includes(cabId)) return rest;
      return cur.includes(key) ? rest : [...rest, key];
    });
    return true;
  };
  // toggle the WHOLE selection's doors/drawers open ↔ closed (if any is closed, open all; else close all)
  const openSel = () => {
    const ids = selIds;
    if (!ids.length) return;
    const anyClosed = ids.some((id) => !openIds.includes(id));
    setOpenIds((cur) => (anyClosed ? Array.from(new Set([...cur, ...ids])) : cur.filter((x) => !ids.includes(x))));
  };
  const dupSel = () => {
    const ids = selIds;
    if (!ids.length) return;
    const nids = ids.map((id) => duplicateCab(id)).filter((x): x is string => !!x);
    if (nids.length) { selectMany(nids); setPicked(nids[nids.length - 1]); }
  };
  const delSel = () => {
    const ids = selIds;
    if (!ids.length) return;
    ids.forEach((id) => removeCab(id));
    setOpenIds((cur) => cur.filter((x) => !ids.includes(x)));
    clearSel();
    setPicked(null);
  };

  const ViewIcon = view === "plan" ? IconPlan : view === "front" ? IconFront : Icon3D;
  const ModeIcon = mode === "wire" ? IconLines : mode === "xray" ? IconTransparent : IconRealistic;

  // front (elevation) view shows one wall run at a time — switchable via the wall bar
  const front = view === "front";
  // pass `cabs` so the "all" shape's corner zones follow the placed corners (dynamic corners) — the
  // run lengths/labels/fill spans this drives must match the grid the sheet builds. Ignored for i/l/u.
  // WHAT THIS KITCHEN'S GAP ACTUALLY IS — the strip of bare wall between the top of the columns and
  // the ceiling. It turns «Закрывать щель до» from an abstract limit into a readout the seller can
  // act on: either there is no gap, or there is one and it is (or isn't) inside the limit.
  const ceilGap = useMemo(() => {
    // the BIGGEST gap, not the smallest. Taking the tallest column would report "no gap" for the
    // whole kitchen the moment one пенал happens to reach the ceiling, while the wall units beside
    // it still had 300mm of bare plaster above them — which is the exact case this panel is for.
    const gaps = cabs
      .filter((c) => !c.furniture && c.appliance !== "filler" && (c.kind === "tall" || (c.kind === "upper" && c.appliance !== "hood")))
      .map((c) => ceiling - cabBand(c).y1)
      .filter((g) => g > 2);
    return gaps.length ? Math.max(...gaps) : null;
  }, [cabs, ceiling]);

  const allRuns = useMemo(() => planRuns(points, waterWall, runLayout, openings, cabs, reveal).runs, [points, waterWall, runLayout, openings, cabs, reveal]);
  const runs = front ? allRuns : [];
  // THE canonical layout — the same resolve the 3D, the plan, the drawings and pricing read.
  // This replaces ~110 lines that re-derived elevation placement here with their own fuzz
  // windows, clamps and a corner "extension" hack that had to be un-shifted on save. The
  // front view can no longer disagree with the 3D, because it is no longer a second opinion.
  // EVERY WALL GETS A SHEET — not just the one currently on screen.
  //
  // A wall must not get its grid by being looked at: the 3D draws the cell lattice on all four
  // walls at once, and if the grid were built lazily by the front view, the lattice would only
  // appear on walls you had already visited. It also adopts any module that turned up without an
  // address (added from the catalog, or re-docked after being dragged out into the room).
  //
  // ensureSheet returns null when there is nothing to do, so this settles in one pass rather than
  // looping — building the grid is a migration, not an edit, and takes no undo step.
  useEffect(() => {
    allRuns.forEach((r, i) => {
      if (r.kind === "wall") openWallSheet(i);
    });
  }, [allRuns, openWallSheet, cabs, ceiling]);

  const room = useMemo(
    () => ({ points, waterWall, layout: runLayout, openings, reveal }),
    [points, waterWall, runLayout, openings, reveal],
  );
  // selected module can fill empty space beside it (after a delete, or after being
  // dragged onto a wall) → contextual chip. A freed (px/pz) module flush to a wall is
  // re-docked for the gap test so the chip appears there too.
  const fillSpan = (() => {
    if (!sel || sheet) return null;
    return fillGapSpan(cabs, sel, room, sel.run ?? 0);
  })();
  // «Заполнить стену» — the selected gridded module's ROW has empty cells left. Filling them with a
  // copy of it (both ways to the wall ends) saves placing each unit by hand. Show only when there is
  // actually something to fill.
  const canFillWall = (() => {
    if (!sel || sheet || !sel.cell || sel.px != null) return false;
    const run = sel.run ?? 0;
    const g = grids[run];
    if (!g) return false;
    const j = locate(g, sel.cell).j;
    if (j < 0) return false;
    const L = resolveLayout(cabs, room);
    return openCells(g, j, cabs, L, run, ceiling, openings, fittings).length > 0;
  })();
  // wall runs the sheet can show: every wall (even an empty one — you add to it by tapping an
  // empty cell), in order. The old view only listed walls that already carried a module.
  const runIdxs = front ? runs.map((_, i) => i).filter((i) => runs[i].kind === "wall") : [];
  const wall = runIdxs.includes(wallIdx) ? wallIdx : runIdxs[0] ?? 0;
  const wallPos = Math.max(0, runIdxs.indexOf(wall));
  const runLabel = (r: number) => {
    const k = runs[r]?.kind;
    return k === "island" ? t.config.island : k === "peninsula" ? t.config.peninsula : t.config.wall(runIdxs.indexOf(r) + 1);
  };
  const cycleWall = (dir: 1 | -1) => {
    if (runIdxs.length < 2) return;
    setWallIdx(runIdxs[(wallPos + dir + runIdxs.length) % runIdxs.length]);
  };

  // tap a width/depth number in the 2D PLAN → inline editor → store
  const onEditDim = ({ clientX, clientY, value, cabId, kind }: PlanEdit) => {
    if (!cabs.some((c) => c.id === cabId)) return;
    const apply =
      kind === "w"
        ? (v: number) => resizeCab(cabId, v)
        // DEPTH goes through patchCabDims, so «Применить ко всему ряду» works the same way whichever
        // view the number was tapped in. It owns the clamps (200–900mm).
        : (v: number) => patchCabDims(cabId, { depth: v });
    setFeEdit({ x: clientX, y: clientY, apply });
    setFeVal(String(value));
  };

  // Tap a header chip in the SHEET → type an exact number. This edits a TRACK LINE, not a cabinet:
  // a column width, or a row height. Which is exactly why every module in that column/row follows
  // it without being asked — they reference the line, they don't each carry a copy of the number.
  // Same code path as dragging the border; typing is just a slower drag.
  const onEditTrack = ({ clientX, clientY, value, kind, index, rowId }: EditDim) => {
    const apply =
      kind === "col" && rowId
        ? (v: number) => gridSetColW(wall, rowId, index, v)
        : (v: number) => gridSetRowH(wall, index, v);
    setFeEdit({ x: clientX, y: clientY, apply });
    setFeVal(String(value));
  };

  /** DRAG a dimension arrow in the 2D plan. Width re-tiles the row (the neighbour absorbs it);
   *  depth honours the row-scope mode. Live — `onBeginEdit` already snapshotted on the first move. */
  const onDragDim = (id: string, kind: "w" | "depth", v: number) => {
    if (kind === "w") resizeCabLive(id, v);
    else patchCabDims(id, { depth: v }, true);
  };
  const commitFe = () => {
    if (feEdit) {
      const v = parseInt(feVal, 10);
      if (v && v >= 100) feEdit.apply(v);
    }
    setFeEdit(null);
  };
  // ± buttons on the inline editor: step the dimension by 5 cm and apply LIVE (keep the
  // editor open so the user can keep tapping); onPointerDown-preventDefault keeps the
  // input focused so the button press doesn't blur→commit→close.
  const stepFe = (delta: number) => {
    const v = Math.max(150, Math.min(3000, (parseInt(feVal, 10) || 0) + delta));
    setFeVal(String(v));
    feEdit?.apply(v);
  };
  // ── the front sheet's edits ───────────────────────────────────────────────────────
  // Tap an empty cell → a module appears AT THE CELL'S SIZE. Note what isn't passed: no width, no
  // height, no mounting height, no depth, not even a kind. The CELL has all of those (the row
  // decides base vs wall unit, the columns decide the width), and the grid writes them onto the
  // module. That is what makes adding furniture one tap — and why the new module cannot land on
  // top of anything: a taken cell is simply refused.
  // Place the armed module in a tapped cell — but a CORNER template never lives in a cell (it's a
  // free-standing diagonal box), so route it to the wall's inside corner in that cell's band instead.
  const placeArmed = (run: number, cell: CellRef) => {
    if (armedTpl?.cab.corner) placeCornerInBand(run, cell.r, armedTpl.cab);
    else addCabInCell(run, cell, armedTpl?.cab ?? { fill: "shelves", count: 1 });
  };
  const onAddInCell = (cell: CellRef) => placeArmed(wall, cell);
  // Drag a column border → set that column's width; the columns past it absorb the change. Drag a
  // row border → set that row's height; the rows above absorb it. Both go through grid.editSheet,
  // which refuses anything that would put two modules in one cell — so there is no failure case to
  // handle here. `live` skips the undo stack; beginCabEdit() snapshotted once at pointerdown, so
  // the whole gesture is a single undo step.
  // ElevationGrid (2D front view) always edits the SELECTED wall, so its border-drags carry no run.
  const onColW = (rowId: string, i: number, mm: number, live: boolean) => gridSetColW(wall, rowId, i, mm, live);
  const onAddCol = (rowId: string) => gridAddCol(wall, rowId);
  const onDropCol = (rowId: string) => gridDropCol(wall, rowId);
  const onFillReach = (rowId: string, reachIdx: number) => gridFillReach(wall, rowId, reachIdx);
  const onAddCorner = (rowId: string) => addCornerCab(wall, rowId);
  const onRowH = (j: number, mm: number, live: boolean) => gridSetRowH(wall, j, mm, live);
  // In 3D a grid line can be grabbed on ANY active wall — the scene reports which one (`run`), so we
  // edit that wall's grid, not the currently-selected one.
  const onColW3d = (run: number, rowId: string, i: number, mm: number, live: boolean) => gridSetColW(run, rowId, i, mm, live);
  const onRowH3d = (run: number, j: number, mm: number, live: boolean) => gridSetRowH(run, j, mm, live);
  // group resize (3D): drag one outer edge of a multi-selection → scale them all together. The store
  // resolves the contiguous span from selIds, so the scene only needs to say which edge + the target
  // combined width. `run` is ignored (the selection already knows its wall) but kept for symmetry.
  const onGroupW3d = (_run: number, edge: "left" | "right", mm: number, live: boolean) => resizeSelectedSpan(mm, edge, live);
  // group height/depth arrows → set the dimension on EVERY selected module (same as the panel sliders)
  const onGroupDim3d = (patch: { h?: number; depth?: number }, live: boolean) => dimSelected(patch, live);
  const onRowKind = (j: number, kind: RowKind) => gridSetRowKind(wall, j, kind);

  return (
    <div className="roomscene">
      {/* project name on top; the live price ticker keeps its place underneath when the
          seller has pricing on (it's the one number worth watching while editing) */}
      <JourneyBar
        sub={showPricing && price > 0 ? (
          <span className="cfg-price">{money(price)}<span className="cfg-price-i" aria-hidden>ⓘ</span></span>
        ) : null}
        right={
          <button
            className="step-next"
            onClick={() => goTo("handoff")}
            type="button"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              border: "none",
              fontWeight: "bold",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
              cursor: "pointer",
              padding: "7px 15px",
            }}
          >
            <span>Сдача</span>
            <span>→</span>
          </button>
        }
      />

      {/* front view: switch which wall run / island is shown + edited */}
      {front && runIdxs.length > 0 && (
        <div className="wall-switcher">
          <button className="wall-arrow" onClick={() => cycleWall(-1)} disabled={runIdxs.length < 2} type="button" aria-label={t.config.prevWall}>←</button>
          <span className="wall-label">{runLabel(wall)}</span>
          <button className="wall-arrow" onClick={() => cycleWall(1)} disabled={runIdxs.length < 2} type="button" aria-label={t.config.nextWall}>→</button>
        </div>
      )}

      <div className="scene-area">
        {view === "3d" ? (
          <VariantScene
            points={points}
            ceiling={ceiling}
            reveal={reveal}
            panels={panelSpecs}
            led={led}
            openings={openings}
            coveringColor={coveringColor}
            floorId={floorId}
            interiorWalls={interiorWalls}
            fittings={fittings}
            wallSurfaces={wallSurfaces}
            waterWall={waterWall}
            layout={runLayout}
            style={runStyle}
            cabs={cabs}
            mode={mode}
            // redraw when «Стандарт цеха» changes — the build isn't stored on the cabinets
            constructionRev={constructionRev}
            light={led.preset ?? "evening"}
            ao={false}
            sun={DEFAULT_SUN}
            lampCount={led.ceilingCount ?? 4}
            lampKind={led.ceilingKind ?? "spot"}
            lampSpread={led.ceilingSpread ?? 0.34}
            lampTemp={led.temp ?? 4000}
            lampOffsetMm={led.ceilingOffsetMm ?? 800}
            customPositions={led.customPositions}
            ceilingPerimeter={false}
            quality={quality}
            nav
            openIds={openIds}
            // ONE selected → drive the move/rotate gizmo (selectedId); SEVERAL → just the multi-tint
            // (selectedIds). Editor sheet suppresses both so material changes read cleanly.
            selectedId={sheet === "editor" || selIds.length !== 1 ? null : selIds[0]}
            selectedIds={sheet === "editor" || selIds.length <= 1 ? undefined : selIds}
            grids={grids}
            // 3D grid is OFF unless the «Сетка» toggle turns it on — a clean, realistic scene by
            // default. When on, it shows on every wall. (Placement is moving to tap-to-place.)
            // The wall CELLS are always live (that's the tap target for tap-to-place); the «Сетка»
            // toggle only adds the grid LINES on top. So default = faint tappable cells, no lattice.
            sheet="auto"
            gridLines={gridLines}
            // the armed band drives which row shows tappable cells — but only while the place panel is
            // up (nothing selected); once you select a module, every cell is available again for edits.
            placeBand={selIds.length === 0 ? placeRow : undefined}
            // ── EXCEL, IN THE SCENE ────────────────────────────────────────────────────────────
            // Tap an empty cell on a wall and a module appears at the CELL's size — the same
            // `addCabInCell` the front view calls, with the same address. Drag a cabinet's face and
            // the COLUMN resizes, so its neighbours slide along the wall as you pull. The 3D has no
            // layout code of its own: it is a second input device for the same edits, which is why
            // the two views cannot drift apart.
            onAddInCell={(run, cell) => placeArmed(run, cell)}
            onAddRow={(run, j) => gridSetRowKind(run, j, "wall")}
            onPlaceTopRow={(run) => addCabInTopVoid(run, armedTpl?.cab)}
            onResizeLive={(id, w, edge) => gridSetCabW(id, w, edge, true)}
            // GRAB A GRID LINE: a column border sticks a little into the room so you can catch it and
            // slide it — the same per-band edit as dragging the border in the front view. It shows
            // only on an active wall (contextual, on-grab), so empty walls become editable in 3D too.
            // Grabbing a cabinet's FACE (onResizeLive → gridSetCabW) still resizes its column as well.
            onColW={onColW3d}
            onRowH={onRowH3d}
            onGroupW={onGroupW3d}
            onGroupDim={onGroupDim3d}
            onSelectCab={pick3d}
            // tap a front on the SELECTED module to swing it open / shut; declines (→ selection)
            // for any other module, so picking a cabinet up still works on the first tap
            onOpenFront={toggleFront}
            onMovePlan={moveCabPlan}
            onBeginEdit={beginCabEdit}
            onMountY={(id, mountY) => {
              const idx = cabs.findIndex((c) => c.id === id);
              if (idx < 0) return;
              const c = cabs[idx];
              if (c.kind === "upper") {
                patchCab(idx, { mountY });
                return;
              }
              // A FLOOR MODULE DRAGGED BACK DOWN IS STANDING, not floating a plinth's height off
              // the ground. «Standing» is the ABSENCE of a mountY (model/bands.ts `isFloating`), so
              // committing 120 here would leave a box that looks seated and is priced as hung.
              liftCab(id, mountY <= GEOM.plinth ? null : mountY);
            }}
            onResize={(id, patch) => {
              const idx = cabs.findIndex((c) => c.id === id);
              if (idx < 0) return;
              // A CORNER's depth drag arrives already RESOLVED — arm depth, square and seat together,
              // because for a corner those are one edit. Apply it verbatim; routing its `depth`
              // (which is the square) through patchCabDims would re-read it as an arm depth and blow
              // the square up again.
              if (patch.armDepth != null) {
                patchCab(idx, patch);
                return;
              }
              // WIDTH, when the module lives in the sheet, is not a property of the module at all —
              // it is the width of the COLUMN it stands in. So a face drag in the 3D goes to the
              // grid, the columns beyond absorb it, and the neighbouring cabinets slide along the
              // wall. Dragging a face in the scene and dragging a border in the front view are now
              // literally the same edit; the front view updates as you drag because it is drawing
              // the same track.
              //
              // The `x` / `px` / `pz` the gizmo sends with a width change are ignored for these —
              // a module in the grid has no position of its own to set.
              const cab = cabs[idx];
              if (patch.w != null && cab.cell && cab.px == null) {
                const edge = patch.x != null && patch.x < (cab.x ?? 0) ? "left" : "right";
                gridSetCabW(id, patch.w, edge);
                const { h: gh, depth: gd } = patch;
                if (gh != null || gd != null) patchCabDims(id, { h: gh, depth: gd });
                return;
              }
              // HEIGHT and DEPTH honour «Применить ко всему ряду»; WIDTH does not — a width change
              // re-tiles the row (the neighbour absorbs it), which is a different operation. The
              // width arrow also sends px/pz/x with it, so that part is applied as a plain patch.
              const { h, depth, ...rest } = patch;
              if (Object.keys(rest).length) patchCab(idx, rest);
              if (h != null || depth != null) patchCabDims(id, { h, depth });
            }}
            onReady={() => saveCurrent(true)}
          />
        ) : view === "plan" ? (
          <ConstructorPlan
            points={points}
            openings={openings}
            interiorWalls={interiorWalls}
            coveringColor={coveringColor}
            layout={runLayout}
            waterWall={waterWall}
            reveal={reveal}
            cabs={cabs}
            mode={mode}
            grid={planGrid}
            magnet={planMagnet}
            // single selection drives the drag / rotate / dimension handles; several tint as a group.
            // tap toggles a module in/out of the set — the same batch-select as the 3D + front view.
            selectedId={sheet === "editor" || selIds.length !== 1 ? null : selIds[0]}
            selectedIds={sheet === "editor" || selIds.length <= 1 ? undefined : selIds}
            onSelectCab={pick3d}
            onMovePlan={moveCabPlan}
            onBeginEdit={beginCabEdit}
            onEditDim={onEditDim}
            onDragDim={onDragDim}
            interactiveTemplate={
              tplSetup?.active && tplSetup.stage === "plan"
                ? {
                    active: true,
                    onSnapWall: (wallIdx) => {
                      if (tplSetup.targetWall === wallIdx) return;
                      setTplSetup((s) => (s ? { ...s, targetWall: wallIdx } : null));
                      applyLayoutTemplate(tplSetup.layout, wallIdx, tplSetup.wallBand);
                      flash(`Планировка привязана к Стене ${wallIdx + 1}`);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <ElevationGrid
            cabs={cabs}
            room={room}
            grid={grids[wall]}
            fittings={fittings}
            run={wall}
            ceiling={ceiling}
            panels={panelSpecs}
            led={led}
            style={effectiveStyle(cabs, runStyle)}
            mode={mode}
            selectedId={sceneSelId}
            // tap toggles a module in/out of the selection set — the same batch-select as the 3D
            selectedIds={sheet === "editor" ? undefined : selIds}
            onSelect={pick3d}
            onAddInCell={onAddInCell}
            onAddCol={onAddCol}
            onDropCol={onDropCol}
            onFillReach={onFillReach}
            onAddCorner={onAddCorner}
            onBeginEdit={beginCabEdit}
            onColW={onColW}
            onRowH={onRowH}
            onRowKind={onRowKind}
            onEditDim={onEditTrack}
            className="scene-canvas"
          />
        )}

        {/* selected-module info card (exactly one selected) */}
        {sel && (
          <div className="item-card">
            <div className="item-card-name">
              {labelFor(sel)}
              <span className="item-card-i" aria-hidden>ⓘ</span>
            </div>
            <div className="item-card-desc">{subFor(sel)}</div>
            {/* depth is editable now (the 3D arrow + the editor field), so it belongs in the readout */}
            <div className="item-card-dim">{sel.w} × {sel.h} × {cabDepth(sel)} {t.config.mm}</div>
          </div>
        )}

        {/* group readout — the count + COMBINED measurement across the whole selection */}
        {multi && (
          <div className="item-card">
            <div className="item-card-name">
              {`Выбрано: ${selCabs.length}`}
            </div>
            <div className="item-card-desc">Нажимайте на модули, чтобы добавить или убрать</div>
            {selCabs.length > 0 && (
              selResizable ? (
                <label className="item-card-dim multi-width">
                  Общая ширина:
                  <input
                    type="number"
                    inputMode="numeric"
                    defaultValue={Math.round(selWidth)}
                    key={Math.round(selWidth)}
                    min={150}
                    step={10}
                    onFocus={beginCabEdit}
                    onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && Math.abs(v - selWidth) > 1) resizeSelectedWidth(v); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  {t.config.mm}
                </label>
              ) : (
                <div className="item-card-dim">Общая ширина: {Math.round(selWidth)} {t.config.mm}</div>
              )
            )}
          </div>
        )}

        
        {/* «Заполнить стену» — the selected module's row has room; fill it end-to-end with copies so you
            don't place each unit by hand. Falls back to the smaller gap-fill when the row is already
            full but the module still borders a single gap. */}
        {sel && (canFillWall || fillSpan) && (
          <button
            className="fill-chip"
            onClick={() => (canFillWall ? fillWallRow(sel.id) : fillCabGap(sel.id))}
            type="button"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5v14M20 5v14" />
              <path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" />
            </svg>
            {canFillWall ? "Заполнить стену" : t.config.fill}
          </button>
        )}


        {/* ── EMPTY STATE ONBOARDING (when no cabinets are placed yet) ── */}
        {cabs.length === 0 && !emptyDismissed && !templateModalOpen && !tplSetup?.active && (
          <div className="empty-room-prompt">
            <div className="empty-prompt-card">
              <div className="empty-prompt-badge">Новая кухня</div>
              <h2 className="empty-prompt-title">С чего вы хотите начать?</h2>
              <p className="empty-prompt-sub">
                Выберите готовый шаблон планировки для вашей комнаты или расставьте шкафы вручную.
              </p>
              <div className="empty-prompt-options">
                <button
                  type="button"
                  className="empty-option-btn primary"
                  onClick={() => setTemplateModalOpen(true)}
                >
                  <div className="eob-icon">📐</div>
                  <div className="eob-content">
                    <div className="eob-title">Выбрать готовый шаблон</div>
                    <div className="eob-desc">Прямая, угловая, П-образная или с островом</div>
                  </div>
                  <span className="eob-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="empty-option-btn secondary"
                  onClick={() => {
                    setEmptyDismissed(true);
                    openSheet("cabinets");
                  }}
                >
                  <div className="eob-icon">➕</div>
                  <div className="eob-content">
                    <div className="eob-title">Собрать вручную</div>
                    <div className="eob-desc">Выбирайте и размещайте модули по одному</div>
                  </div>
                  <span className="eob-arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPLATE SELECTION MODAL (2-column 3D illustrated, compact) ── */}
        {templateModalOpen && (
          <div className="template-modal-backdrop" onClick={() => setTemplateModalOpen(false)}>
            <div className="template-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <div className="sheet-title">Выберите шаблон кухни</div>
                <button className="sheet-x" onClick={() => setTemplateModalOpen(false)} type="button">✕</button>
              </div>
              <div className="template-grid">
                {KITCHEN_LAYOUT_CHOICES.map((tpl) => {
                  const Thumb = tpl.Thumb;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      className="template-card-btn"
                      onClick={() => {
                        applyLayoutTemplate(tpl.id, 0, "single");
                        setTplSetup({
                          active: true,
                          stage: "plan",
                          layout: tpl.id,
                          targetWall: 0,
                          wallBand: "single",
                          stylePreset: "classic-triangle",
                          paletteId: "white-wood",
                        });
                        setView("plan");
                        setTemplateModalOpen(false);
                        setEmptyDismissed(true);
                        flash(`Шаблон «${tpl.title}» загружен`);
                      }}
                    >
                      <div className="tpl-card-top">
                        <span className="tpl-card-badge">{tpl.badge}</span>
                      </div>
                      <div className="tpl-card-illus">
                        <Thumb />
                      </div>
                      <div className="tpl-card-title">{tpl.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE 1: 2D FLOOR PLAN BOTTOM BAR (COMPACT & DOES NOT BLOCK PLAN) ── */}
        {tplSetup?.active && tplSetup.stage === "plan" && (
          <div className="tpl-wizard-overlay plan-stage">
            <div className="tpl-plan-bottom-bar">
              <div className="tpl-plan-info">
                <span className="tpl-plan-badge">Стена {(tplSetup.targetWall ?? 0) + 1}</span>
                <span className="tpl-plan-hint">Нажмите на стену на плане</span>
              </div>

              <button
                type="button"
                className="tpl-rotate-btn"
                onClick={() => {
                  const nextWall = ((tplSetup.targetWall ?? 0) + 1) % wallSegs.length;
                  setTplSetup((s) => (s ? { ...s, targetWall: nextWall } : null));
                  applyLayoutTemplate(tplSetup.layout, nextWall, tplSetup.wallBand);
                  flash(`Повернуто к Стене ${nextWall + 1}`);
                }}
                title="Повернуть ориентацию гарнитура"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Повернуть</span>
              </button>

              <button
                type="button"
                className="tpl-plan-next-btn"
                onClick={() => {
                  setTplSetup((s) => (s ? { ...s, stage: "3d" } : null));
                  setView("3d");
                }}
              >
                <span>Далее к 3D →</span>
              </button>

              <button
                type="button"
                className="tpl-plan-close-btn"
                onClick={() => setTplSetup(null)}
                title="Закрыть мастер"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 2: 3D ROWS & COLOR STYLING (BOTTOM SHEET FOR MOBILE & DESKTOP) ── */}
        {tplSetup?.active && tplSetup.stage === "3d" && (
          <div className="tpl-wizard-overlay threed-stage">
            {tplMinimized ? (
              <div className="tpl-minimized-bar">
                {(() => {
                  const activePal = FINISH_PALETTES.find((p) => p.id === (tplSetup.paletteId ?? "white-wood")) ?? FINISH_PALETTES[0];
                  const activeComp = KITCHEN_COMPOSITIONS.find((kc) => kc.id === tplSetup.stylePreset) ?? KITCHEN_COMPOSITIONS[0];
                  return (
                    <div className="tpl-minimized-pill" onClick={() => setTplMinimized(false)} role="button" tabIndex={0}>
                      <div className="tpl-pill-left">
                        <div
                          className="tpl-pill-swatch"
                          style={{
                            background: `linear-gradient(135deg, ${activePal.color1} 0%, ${activePal.color1} 50%, ${activePal.color2} 50%, ${activePal.color2} 100%)`,
                          }}
                        />
                        <div className="tpl-pill-text">
                          <span className="tpl-pill-title">{activePal.name}</span>
                          <span className="tpl-pill-sub">
                            {tplSetup.wallBand === "antresol" ? "3 ряда" : "2 ряда"} · {activeComp.name}
                          </span>
                        </div>
                      </div>
                      <div className="tpl-pill-btn">
                        <span>Настроить</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </div>
                    </div>
                  );
                })()}
                <button
                  type="button"
                  className="tpl-pill-done-btn"
                  onClick={() => {
                    setTplSetup(null);
                    setEmptyDismissed(true);
                    setTplMinimized(false);
                    flash("✓ Кухня настроена!");
                  }}
                >
                  ✓ Готово
                </button>
              </div>
            ) : (
              <div className="tpl-3d-sheet">
                <div className="tpl-3d-sheet-head">
                  <div className="tpl-3d-sheet-title-group">
                    <div className="tpl-3d-sheet-title">Стиль и ряды</div>
                    <button
                      type="button"
                      className="tpl-sheet-collapse-btn"
                      onClick={() => setTplMinimized(true)}
                      title="Свернуть для полного 3D обзора"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      <span>3D Обзор</span>
                    </button>
                  </div>
                  <div className="tpl-3d-sheet-actions">
                    <button
                      type="button"
                      className="tpl-sheet-back-btn"
                      onClick={() => {
                        setTplSetup((s) => (s ? { ...s, stage: "plan" } : null));
                        setView("plan");
                        setTplMinimized(false);
                      }}
                    >
                      ← План
                    </button>
                    <button
                      type="button"
                      className="tpl-sheet-done-btn"
                      onClick={() => {
                        setTplSetup(null);
                        setEmptyDismissed(true);
                        setTplMinimized(false);
                        flash("✓ Кухня настроена!");
                      }}
                    >
                      ✓ Готово
                    </button>
                  </div>
                </div>

                {/* Segmented Sub-Tabs */}
                <div className="tpl-subtabs-bar">
                  <button
                    type="button"
                    className={`tpl-subtab-btn${tplSubTab === "palette" ? " active" : ""}`}
                    onClick={() => setTplSubTab("palette")}
                  >
                    <span>🎨 Палитра отделки</span>
                  </button>
                  <button
                    type="button"
                    className={`tpl-subtab-btn${tplSubTab === "layout" ? " active" : ""}`}
                    onClick={() => setTplSubTab("layout")}
                  >
                    <span>📐 Компоновка техники</span>
                  </button>
                </div>

                {tplSubTab === "palette" ? (
                  <>
                    {/* Row toggle inside palette tab */}
                    <div className="tpl-sheet-row-toggle">
                      <button
                        type="button"
                        className={`tpl-seg-btn${tplSetup.wallBand === "single" ? " active" : ""}`}
                        onClick={() => {
                          setTplSetup((s) => (s ? { ...s, wallBand: "single" } : null));
                          applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, "single", undefined, {
                            fridge: tplSetup.fridge,
                            oven: tplSetup.oven,
                            hood: tplSetup.hood,
                            dishwasher: tplSetup.dishwasher,
                            water: tplSetup.water,
                            wallBand: "single",
                          });
                        }}
                      >
                        <span className="seg-icon">🗄️</span>
                        <span>2 ряда (Стандарт)</span>
                      </button>
                      <button
                        type="button"
                        className={`tpl-seg-btn${tplSetup.wallBand === "antresol" ? " active" : ""}`}
                        onClick={() => {
                          setTplSetup((s) => (s ? { ...s, wallBand: "antresol" } : null));
                          applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, "antresol", undefined, {
                            fridge: tplSetup.fridge,
                            oven: tplSetup.oven,
                            hood: tplSetup.hood,
                            dishwasher: tplSetup.dishwasher,
                            water: tplSetup.water,
                            wallBand: "antresol",
                          });
                        }}
                      >
                        <span className="seg-icon">🏢</span>
                        <span>3 ряда (Антресоль)</span>
                      </button>
                    </div>

                    {/* Palette swatches: bigger vertical cards, 3 columns, split circle */}
                    <div className="tpl-palette-grid">
                      {FINISH_PALETTES.map((p) => {
                        const isSelected = (tplSetup.paletteId ?? "white-wood") === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`tpl-palette-card${isSelected ? " active" : ""}`}
                            onClick={() => {
                              setTplSetup((s) => (s ? { ...s, paletteId: p.id } : null));
                              applyFinishToAll({ facade: p.facade, carcass: p.carcass, worktop: p.worktop });
                              flash(`Палитра: ${p.name}`);
                            }}
                          >
                            <div
                              className="tpl-split-swatch"
                              style={{
                                background: `linear-gradient(135deg, ${p.color1} 0%, ${p.color1} 50%, ${p.color2} 50%, ${p.color2} 100%)`,
                              }}
                            />
                            <span className="tpl-palette-name">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Compositions section */}
                    <div className="tpl-sheet-section">
                      <div className="tpl-sheet-sec-header">
                        <div className="tpl-sheet-sec-lbl">Варианты техники:</div>
                        <button
                          type="button"
                          className="tpl-filter-open-btn"
                          onClick={() => setFilterModalOpen(true)}
                          title="Настроить технику и опции"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14" />
                            <line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" />
                            <line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" />
                            <line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                          </svg>
                          <span>Параметры</span>
                        </button>
                      </div>

                      <div className="tpl-presets-grid">
                        {KITCHEN_COMPOSITIONS.map((kc) => {
                          const isSelected = tplSetup.stylePreset === kc.id;
                          return (
                            <button
                              key={kc.id}
                              type="button"
                              className={`tpl-compact-preset-card${isSelected ? " active" : ""}`}
                              onClick={() => {
                                setTplSetup((s) => (s ? {
                                  ...s,
                                  wallBand: kc.wallBand,
                                  stylePreset: kc.id,
                                  fridge: kc.fridge,
                                  oven: kc.oven,
                                  hood: kc.hood,
                                  dishwasher: kc.dishwasher,
                                  water: kc.water ?? s.water,
                                } : null));
                                applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, kc.wallBand, undefined, {
                                  fridge: kc.fridge,
                                  oven: kc.oven,
                                  hood: kc.hood,
                                  dishwasher: kc.dishwasher,
                                  water: kc.water,
                                  wallBand: kc.wallBand,
                                });
                                flash(`Компоновка: ${kc.name}`);
                              }}
                            >
                              <div className="tpl-compact-name">{kc.name}</div>
                              <div className="tpl-compact-feature">{kc.subtitle}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row toggle inside layout tab too */}
                    <div className="tpl-sheet-row-toggle">
                      <button
                        type="button"
                        className={`tpl-seg-btn${tplSetup.wallBand === "single" ? " active" : ""}`}
                        onClick={() => {
                          setTplSetup((s) => (s ? { ...s, wallBand: "single" } : null));
                          applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, "single", undefined, {
                            fridge: tplSetup.fridge,
                            oven: tplSetup.oven,
                            hood: tplSetup.hood,
                            dishwasher: tplSetup.dishwasher,
                            water: tplSetup.water,
                            wallBand: "single",
                          });
                        }}
                      >
                        <span className="seg-icon">🗄️</span>
                        <span>2 ряда (Стандарт)</span>
                      </button>
                      <button
                        type="button"
                        className={`tpl-seg-btn${tplSetup.wallBand === "antresol" ? " active" : ""}`}
                        onClick={() => {
                          setTplSetup((s) => (s ? { ...s, wallBand: "antresol" } : null));
                          applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, "antresol", undefined, {
                            fridge: tplSetup.fridge,
                            oven: tplSetup.oven,
                            hood: tplSetup.hood,
                            dishwasher: tplSetup.dishwasher,
                            water: tplSetup.water,
                            wallBand: "antresol",
                          });
                        }}
                      >
                        <span className="seg-icon">🏢</span>
                        <span>3 ряда (Антресоль)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── POPUP: LAYOUT OPTIONS & APPLIANCES FILTER MODAL ── */}
        {filterModalOpen && tplSetup && (
          <div className="template-modal-backdrop" onClick={() => setFilterModalOpen(false)}>
            <div className="tpl-filter-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <div className="sheet-title">Параметры и техника кухни</div>
                <button className="sheet-x" onClick={() => setFilterModalOpen(false)} type="button">✕</button>
              </div>

              <div className="tpl-filter-modal-body">
                {/* Rows / WallBand */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Количество рядов:</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.wallBand === "single" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, wallBand: "single" } : null))}
                    >
                      🗄️ 2 ряда (Стандарт)
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.wallBand === "antresol" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, wallBand: "antresol" } : null))}
                    >
                      🏢 3 ряда (Антресоль)
                    </button>
                  </div>
                </div>

                {/* Fridge */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Холодильник:</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${(tplSetup.fridge ?? "integ") === "integ" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, fridge: "integ" } : null))}
                    >
                      Встроенный в пенал
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.fridge === "free" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, fridge: "free" } : null))}
                    >
                      Отдельно стоящий
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.fridge === "none" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, fridge: "none" } : null))}
                    >
                      Без холодильника
                    </button>
                  </div>
                </div>

                {/* Oven placement */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Духовой шкаф:</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${(tplSetup.oven ?? "tall") === "tall" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, oven: "tall" } : null))}
                    >
                      В высокой колонне (на уровне глаз)
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.oven === "under" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, oven: "under" } : null))}
                    >
                      Под варочной панелью
                    </button>
                  </div>
                </div>

                {/* Hood */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Вытяжка:</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${(tplSetup.hood ?? "integ") === "integ" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, hood: "integ" } : null))}
                    >
                      Встроенная (скрытая в шкаф)
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.hood === "dome" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, hood: "dome" } : null))}
                    >
                      Купольная / Наклонная (открытая)
                    </button>
                  </div>
                </div>

                {/* Dishwasher */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Посудомоечная машина (ПММ):</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${(tplSetup.dishwasher ?? true) ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, dishwasher: true } : null))}
                    >
                      ✓ Включить ПММ рядом с мойкой
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.dishwasher === false ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, dishwasher: false } : null))}
                    >
                      Без посудомойки
                    </button>
                  </div>
                </div>

                {/* Water supply location */}
                <div className="filter-group">
                  <div className="filter-group-lbl">Расположение мокрой зоны (мойка):</div>
                  <div className="filter-btn-row">
                    <button
                      type="button"
                      className={`filter-opt-btn${(tplSetup.water ?? "left") === "left" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, water: "left" } : null))}
                    >
                      Слева
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.water === "center" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, water: "center" } : null))}
                    >
                      По центру
                    </button>
                    <button
                      type="button"
                      className={`filter-opt-btn${tplSetup.water === "right" ? " active" : ""}`}
                      onClick={() => setTplSetup((s) => (s ? { ...s, water: "right" } : null))}
                    >
                      Справа
                    </button>
                  </div>
                </div>
              </div>

              <div className="tpl-filter-modal-footer">
                <button
                  type="button"
                  className="tpl-filter-apply-btn"
                  onClick={() => {
                    applyLayoutTemplate(tplSetup.layout, tplSetup.targetWall, tplSetup.wallBand, undefined, {
                      fridge: tplSetup.fridge ?? "integ",
                      oven: tplSetup.oven ?? "tall",
                      hood: tplSetup.hood ?? "integ",
                      dishwasher: tplSetup.dishwasher ?? true,
                      water: tplSetup.water ?? "left",
                      wallBand: tplSetup.wallBand,
                    });
                    setFilterModalOpen(false);
                    flash("✓ Параметры компоновки применены");
                  }}
                >
                  ✓ Применить параметры
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTEXTUAL band control — a vertical stack (+ · columns · −): add / remove a cabinet in the
            SELECTED module's row, right in the 3D. Only for a gridded module. */}
        {view === "3d" && sel && sel.cell && sel.px == null && !panelOpen && (
          <div className="scene-ctl band-ctl">
            <button className="band-btn add" onClick={() => gridAddCol(sel.run ?? 0, sel.cell!.r)} type="button" aria-label="Добавить шкаф в ряд">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 6v12M6 12h12" /></svg>
            </button>
            <span className="band-ico" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M7 5v14M12 5v14M17 5v14" /></svg>
            </span>
            <button className="band-btn" onClick={() => gridDropCol(sel.run ?? 0, sel.cell!.r)} type="button" aria-label="Убрать шкаф из ряда">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 12h12" /></svg>
            </button>
          </div>
        )}

        {/* LEFT stack — what to EDIT about the selection: Size / Style / Cabinets. Each opens a
            bottom panel. Shown whenever anything is selected (one module or many). */}
        {selIds.length >= 1 && (
          <div className={`scene-ctl left-stack${panelOpen ? " raised" : ""}`}>
            <div className="left-group">
              <button type="button" className={`left-btn${sheet === "resize" ? " on" : ""}`} onClick={() => openPanel("resize")} aria-label="Размер">
                <GlyphResize />
              </button>
              <button type="button" className={`left-btn${sheet === "style" ? " on" : ""}`} onClick={() => openPanel("style")} aria-label="Стиль">
                <GlyphStyle />
              </button>
              <button type="button" className={`left-btn${sheet === "editor" ? " on" : ""}`} onClick={() => setSheet("editor")} aria-label="Редактор">
                <GlyphEdit />
              </button>
            </div>
          </div>
        )}

        {/* RIGHT stack — what to DO with the selection: open/close doors · duplicate · delete. Acts
            on every selected module. Delete is separate and red so it can't be a slip of the thumb. */}
        {selIds.length >= 1 && (
          <div className={`scene-ctl item-stack${panelOpen ? " raised" : ""}`}>
            <div className="item-group">
              <button type="button" onClick={openSel} aria-label={t.config.open} title={t.config.open}>
                <IconOpenItem />
              </button>
              <button type="button" onClick={dupSel} aria-label={t.config.duplicate} title={t.config.duplicate}>
                <IconDuplicateItem />
              </button>
            </div>
            <button className="item-del" type="button" onClick={delSel} aria-label={t.config.del} title={t.config.del}>
              <IconDeleteItem />
            </button>
          </div>
        )}

        {/* undo/redo for constructor edits (move/rotate/resize/reorder/edit/…) */}
        <div className="scene-ctl undo-redo">
          <button type="button" onClick={undoCab} disabled={!canUndoCab} aria-label={t.config.undo}>
            <IconUndo />
          </button>
          <button type="button" onClick={redoCab} disabled={!canRedoCab} aria-label={t.config.redo}>
            <IconRedo />
          </button>
        </div>

        {ctlMenu && (
          <>
            <div className="sheet-backdrop" onClick={closeMenu} />
            <div
              className={`view-menu pop-anim${menuClosing ? " closing" : ""}`}
              style={{
                position: "fixed",
                bottom: "76px",
                left: ctlMenu === "mode" ? "76px" : "12px",
                zIndex: 9999,
              }}
            >
              {ctlMenu === "view" ? (
                <>
                  {view === "3d" && (
                    <>
                      <div className="vm-toggle">
                        <span>{t.config.magnet}</span>
                        <button className={`switch${g3dMagnet ? " on" : ""}`} onClick={() => setG3dMagnet((m) => !m)} type="button" aria-pressed={g3dMagnet}><span className="knob" /></button>
                      </div>
                      <div className="vm-sep" />
                    </>
                  )}
                  {/* THE SHEET, in the scene. Off → it appears only on the wall of the module you
                      tap (and vanishes when you deselect), so the room stays a room. On → every
                      wall, which is what you need to fill an EMPTY one: nothing to tap there. */}
                  {view === "3d" && (
                    <>
                      <div className="vm-toggle">
                        <span>{t.config.grid}</span>
                        <button className={`switch${gridLines ? " on" : ""}`} onClick={() => setGridLines((g) => !g)} type="button" aria-pressed={gridLines}><span className="knob" /></button>
                      </div>
                      <div className="vm-sep" />
                    </>
                  )}
                  {/* the front view is a SHEET now — no free drag, so no magnet/guide toggles
                      (a module always sits in a cell; borders snap by construction) */}
                  {view === "plan" && (
                    <>
                      <div className="vm-toggle">
                        <span>{t.config.grid}</span>
                        <button className={`switch${planGrid ? " on" : ""}`} onClick={() => setPlanGrid((g) => !g)} type="button" aria-pressed={planGrid}><span className="knob" /></button>
                      </div>
                      <div className="vm-toggle">
                        <span>{t.config.magnet}</span>
                        <button className={`switch${planMagnet ? " on" : ""}`} onClick={() => setPlanMagnet((m) => !m)} type="button" aria-pressed={planMagnet}><span className="knob" /></button>
                      </div>
                      <div className="vm-sep" />
                    </>
                  )}
                  <button className={view === "3d" ? "vm-on" : ""} onClick={() => pickView("3d")} type="button">
                    <Icon3D /> {t.config.v3d}
                    {view === "3d" && <span className="vm-check">✓</span>}
                  </button>
                  <button className={view === "front" ? "vm-on" : ""} onClick={() => pickView("front")} type="button">
                    <IconFront /> {t.config.vfront}
                    {view === "front" && <span className="vm-check">✓</span>}
                  </button>
                  <button className={view === "plan" ? "vm-on" : ""} onClick={() => pickView("plan")} type="button">
                    <IconPlan /> {t.config.vplan}
                    {view === "plan" && <span className="vm-check">✓</span>}
                  </button>
                </>
              ) : (
                MODES.map(({ v, Icon }) => (
                  <button key={v} className={mode === v ? "vm-on" : ""} onClick={() => pickMode(v)} type="button">
                    <Icon /> {modeLabel(v)}
                    {mode === v && <span className="vm-check">✓</span>}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 5-BUTTON BOTTOM DOCK (like in Render step) ── */}
      <div className="rnd-bar">
        {/* Related Cabinets Carousel when a cabinet is selected */}
        {sel && (
          <div className="cfg-quick-swap-carousel">
            <div className="cfg-quick-swap-head">
              <span className="cfg-quick-swap-title">{labelFor(sel)}: подходящие модули</span>
              <button
                type="button"
                className="quick-sel-close"
                onClick={clearSel}
                aria-label="Снять выделение"
              >
                ✕
              </button>
            </div>
            <div className="cfg-quick-swap-strip">
              {swapItemsRaw.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="cfg-quick-swap-card"
                  onClick={() => swapSel(tpl)}
                  title={`Заменить на: ${tpl.name}`}
                >
                  <span className="cfg-quick-swap-thumb">
                    <AddThumb id={tpl.id} glyph={tpl.glyph} cab={tpl.cab} />
                  </span>
                  <span className="cfg-quick-swap-name">{tpl.name}</span>
                </button>
              ))}
              <button
                type="button"
                className="cfg-quick-swap-card more"
                onClick={() => openSheet("cabinets")}
                title="Все шкафы"
              >
                <span className="cfg-quick-swap-more-icon">⋯</span>
                <span className="cfg-quick-swap-name">Все шкафы</span>
              </button>
            </div>
          </div>
        )}

        <div className="rnd-tabbar">
          {/* 1. 3D / 2D View Button */}
          <button
            type="button"
            className={`rnd-tab ${ctlMenu === "view" ? "on" : ""}`}
            onClick={() => toggleMenu("view")}
          >
            <span className="rnd-tab-ico">
              {view === "3d" ? <Icon3D /> : <IconPlan />}
            </span>
            <span className="rnd-tab-lbl">{view === "3d" ? "3D Вид" : "2D План"}</span>
          </button>

          {/* 2. Transparency / X-ray Button */}
          <button
            type="button"
            className={`rnd-tab ${ctlMenu === "mode" || mode !== "real" ? "on" : ""}`}
            onClick={() => toggleMenu("mode")}
          >
            <span className="rnd-tab-ico">
              <IconTransparent />
            </span>
            <span className="rnd-tab-lbl">Прозрачность</span>
          </button>

          {/* 3. Plus Button: Raised Center Primary (opens cabinet catalog) */}
          <button
            type="button"
            className="rnd-tab rnd-tab-snap"
            onClick={() => openSheet("cabinets")}
          >
            <span className="rnd-tab-ico rnd-tab-ico-snap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="rnd-tab-lbl" style={{ fontWeight: 700 }}>Добавить</span>
          </button>

          {/* 4. "Отделка" (Finishes & Materials) */}
          <button
            type="button"
            className={`rnd-tab ${sheet === "finish" ? "on" : ""}`}
            onClick={() => setSheet((cur) => (cur === "finish" ? null : "finish"))}
          >
            <span className="rnd-tab-ico">
              <GlyphFinish />
            </span>
            <span className="rnd-tab-lbl">Отделка</span>
          </button>

          {/* 5. "Render" Button */}
          <button
            type="button"
            className="rnd-tab"
            onClick={() => goTo("preview")}
          >
            <span className="rnd-tab-ico">
              <IconCamera />
            </span>
            <span className="rnd-tab-lbl">Рендер</span>
          </button>
        </div>
      </div>

      {sheet && !((sheet === "resize" || (sheet === "style" && !sel)) && selIds.length === 0) && (
        <>
          {/* NON-modal edit panels (resize/style/cabinets) get NO backdrop — the 3D above stays live
              and the left buttons stay tappable. The catalog / full editor keep their dimming backdrop. */}
          {!panelOpen && <div className={`sheet-backdrop dim${sheetClosing ? " closing" : ""}`} onClick={closeSheet} />}
          <div className={`bottom-sheet${panelOpen ? " panel" : ""}${sheetFullscreen ? " fullscreen" : ""}${sheet === "pickCab" || sheet === "pickAppl" || sheet === "dining" || sheet === "extra" || sheet === "editor" || sheet === "style" || sheet === "cabinets" || sheet === "resize" || sheet === "finish" ? " tall" : ""}${sheetClosing ? " closing" : ""}`}>
            {/* the edit panels are attached (non-modal) — no drag-grip; the catalog/editor keep theirs */}
            {!panelOpen && (
              <div
                className={`sheet-grip-area${sheetFullscreen ? " expanded" : ""}`}
                onPointerDown={handleGripPointerDown}
                onClick={handleGripClick}
                role="button"
                tabIndex={0}
                aria-label={sheetFullscreen ? "Свернуть панель вниз" : "Развернуть панель на весь экран"}
                title={sheetFullscreen ? "Потяните вниз или нажмите, чтобы свернуть/закрыть" : "Потяните вверх или нажмите, чтобы открыть на весь экран"}
              >
                <div className={`sheet-grip${sheetFullscreen ? " expanded" : ""}`} />
              </div>
            )}

            {(sheet === "pickCab" || sheet === "pickAppl" || sheet === "dining" || sheet === "extra") && (() => {
              const groups = sheet === "pickCab" ? CABINET_GROUPS : sheet === "pickAppl" ? APPLIANCE_GROUPS : sheet === "dining" ? FURNITURE_GROUPS : FREE_GROUPS;
              const title = replaceId
                ? t.config.replaceTo
                : sheet === "pickCab" ? t.config.addCab : sheet === "pickAppl" ? t.config.addAppl : sheet === "dining" ? t.config.addFurn : t.config.addExtra;
              return (
                <>
                  <div className="sheet-head">
                    <div className="sheet-title">{title}</div>
                    <button className="sheet-x" onClick={closeSheet} type="button" aria-label={t.config.close}>✕</button>
                  </div>
                  <div className="cfg-sheet-body">
                    {/* the user's reusable "My cabinets" library, at the top of the cabinet picker */}
                    {sheet === "pickCab" && savedCabs.length > 0 && (
                      <div className="add-group">
                        <div className="add-head">{t.fe.myCabs}</div>
                        <div className="add-grid">
                          {savedCabs.map((sc) => (
                            <button key={sc.id} className="add-chip saved-chip" onClick={() => addItem({ id: sc.id, name: sc.name, sub: "", glyph: "▢", cab: sc.cab })} type="button">
                              <span className="saved-del" role="button" aria-label={t.fe.delete} onClick={(e) => { e.stopPropagation(); removeSavedCab(sc.id); }}>✕</span>
                              {sc.thumbnail
                                ? <img className="add-img" src={sc.thumbnail} alt="" aria-hidden="true" />
                                : <span className="add-glyph" aria-hidden="true">▢</span>}
                              <span className="add-name">{sc.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {groups.map((g) => (
                      <div className="add-group" key={g.heading}>
                        <div className="add-head">{g.heading}</div>
                        <div className="add-grid">
                          {g.items.map((tpl) => (
                            <button key={tpl.id} className="add-chip" onClick={() => addItem(tpl)} type="button">
                              <AddThumb id={tpl.id} glyph={tpl.glyph} cab={tpl.cab} />
                              <span className="add-name">{tpl.name}</span>
                              <span className="add-sub">{tpl.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {sheet === "editor" && sel && (
              <V21Cabinet3DStudio
                cab={sel}
                patchCab={(patch) => patchCab(selIndex, patch)}
                onClose={closeSheet}
                settings={settings}
                style={runStyle}
              />
            )}

            {/* ── РАЗМЕР ── snapping sliders for the selection. One module → W/H/D/shelves; several →
                the combined width (redistributed). "Заполнить" appears when it borders a gap. */}
            {sheet === "resize" && (sel || multi) && (
              <>
                <div className="sheet-head">
                  <div className="sheet-title">Размер</div>
                  <button className="sheet-x" onClick={closeSheet} type="button" aria-label={t.config.close}>✕</button>
                </div>
                {sel && !sel.furniture && (
                  <div className="cab-actions">
                    <button className="cab-act" onClick={() => { saveCab(sel.id, labelFor(sel)); flash(t.fe.savedCab); }} type="button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
                      {t.fe.saveDo}
                    </button>
                  </div>
                )}
                {/* Размер is ONLY about size — swapping the module for another type is the toolbar's
                    job, one row below, and having it in both places made this panel a second menu. */}
                <div className="cfg-sheet-body dim-panel">
                  {sel ? (
                    <>
                      {/* INTERNAL CLEARANCE READOUT. Every number here comes from constructionOf —
                          it used to compute the groove setback at 10мм while the 3D drew it at 12,
                          so the depth quoted to the seller was 2мм short of what got built. */}
                      {(() => {
                        const con = constructionOf(sel);
                        const intW = Math.max(0, sel.w - 2 * con.boardThickness);
                        const intH = Math.max(0, sel.h - 2 * con.boardThickness);
                        const intD = Math.max(0, cabDepth(sel) - backSetbackOf(sel));
                        return (
                          <div style={{ background: "rgba(0,169,97,0.08)", border: "1px solid rgba(0,169,97,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#1b4d3e" }}>
                            <strong>{t.shop.clear}:</strong> {intW} × {intH} × {intD} мм <span style={{ opacity: 0.75 }}>(ЛДСП {con.boardThickness} мм)</span>
                          </div>
                        );
                      })()}
                      <DimControls cab={sel} />
                      {fillSpan && (
                        <button className="dim-fill" onClick={() => { fillCabGap(sel.id); closeSheet(); }} type="button">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5v14M20 5v14" /><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" /></svg>
                          Заполнить пространство
                        </button>
                      )}

                      <button
                        className="dim-fill"
                        style={{ marginTop: 10, background: "#e8effc", color: "#2f6fe4", border: "1px solid #c0d3f8", fontWeight: 650 }}
                        onClick={() => setSheet("editor")}
                        type="button"
                      >
                        📐 Живой чертёж и узлы V21
                      </button>

                      {/* ── КОНСТРУКЦИЯ ── These eight controls used to sit open in this sheet, asked of
                          every cabinet. They are not design decisions: a shop that builds 16мм / задняя
                          в паз / накладное дно builds that way on every cabinet for years, so they are
                          answered ONCE in Настройки → Стандарт цеха and inherited here. What is left is
                          a single row saying which build this module follows — tapped open only for the
                          rare module that must differ. See model/construction.ts. */}
                      {(() => {
                        const shop = shopConstruction();
                        const over = overridesOf(sel);
                        const con = constructionOf(sel);
                        /** picking the shop's own value CLEARS the override rather than pinning it, so
                         *  the module keeps following the shop if the standard later changes */
                        const pick = <K extends keyof typeof shop>(k: K, v: (typeof shop)[K]) =>
                          patchCab(selIndex, { [k]: v === shop[k] ? undefined : v } as Partial<Cabinet>);
                        return (
                          <div style={{ borderTop: "1px solid #eee", marginTop: 14, paddingTop: 12, marginBottom: 8 }}>
                            <button className="con-row" type="button" onClick={() => setConOpen((o) => !o)} aria-expanded={conOpen}>
                              <span className="con-row-lbl">{t.shop.construction}</span>
                              <span className={`con-row-val${over.length ? " changed" : ""}`}>
                                {over.length ? t.shop.changedN(over.length) : t.shop.standard}
                              </span>
                              <span className={`con-row-caret${conOpen ? " open" : ""}`} aria-hidden>›</span>
                            </button>

                            {conOpen && (
                              <div className="con-body">
                                <p className="con-hint">{t.shop.editedInSettings}</p>

                                <span className="con-lbl">{t.shop.boardThickness}</span>
                                <div className="pillrow" style={{ marginTop: 4 }}>
                                  {([16, 18] as const).map((v) => (
                                    <button key={v} className={`chip${con.boardThickness === v ? " sel" : ""}`} onClick={() => pick("boardThickness", v)} type="button">
                                      {v} мм{v === shop.boardThickness ? ` · ${t.shop.standardShort}` : ""}
                                    </button>
                                  ))}
                                </div>

                                <span className="con-lbl">{t.shop.backPanel}</span>
                                <div className="pillrow" style={{ marginTop: 4 }}>
                                  {(["groove", "overlay", "none"] as BackPanelMethod[]).map((m) => (
                                    <button key={m} className={`chip${con.backMount === m ? " sel" : ""}`} onClick={() => patchCab(selIndex, backMountPatch(m))} type="button">
                                      {t.shop.back[m]}{m === shop.backMount ? ` · ${t.shop.standardShort}` : ""}
                                    </button>
                                  ))}
                                </div>

                                {/* фальш-панели are genuinely per-module (they fill THIS gap), so they
                                    stay a per-cabinet field — but they belong behind the disclosure
                                    with the rest of the carcass detail, not in the seller's face. */}
                                <span className="con-lbl">{t.shop.fillers}</span>
                                <div className="con-fillers">
                                  {([["fillerLeft", t.shop.left], ["fillerRight", t.shop.right], ["fillerTop", t.shop.top2]] as const).map(([k, lbl]) => (
                                    <label key={k}>
                                      {lbl}
                                      <input
                                        type="number"
                                        className="set-input"
                                        value={sel[k] ?? 0}
                                        onChange={(e) => patchCab(selIndex, { [k]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                      />
                                    </label>
                                  ))}
                                </div>

                                {over.length > 0 && (
                                  <button className="con-reset" type="button" onClick={() => patchCab(selIndex, resetToShop())}>
                                    ↺ {t.shop.resetToStandard}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    // several selected → H / D / shelves apply to ALL; width is NOT a slider (it would
                    // fight the grid) — instead one button distributes them to equal widths
                    <>
                      <DimSlider icon={<GlyphH />} label="Высота" value={selCabs[0].h} min={MIN_H} max={maxCabH(selCabs[0], ceiling)} step={10}
                        onBegin={beginCabEdit}
                        onLive={(v) => dimSelected({ h: v }, true)}
                        onCommit={(v) => dimSelected({ h: v })} />
                      <DimSlider icon={<GlyphD />} label="Глубина" value={cabDepth(selCabs[0])} min={D_MIN} max={D_MAX} step={10}
                        onBegin={beginCabEdit}
                        onLive={(v) => dimSelected({ depth: v }, true)}
                        onCommit={(v) => dimSelected({ depth: v })} />
                      {selCabs.some((c) => c.kind === "upper") && (
                        <DimSlider icon={<GlyphH />} label="Высота от пола" value={selCabs[0].mountY ?? 1520} min={800} max={ceiling - selCabs[0].h} step={10}
                          onBegin={beginCabEdit}
                          onLive={(v) => applyToSelected({ mountY: v })}
                          onCommit={(v) => applyToSelected({ mountY: v })} />
                      )}
                      <DimSlider icon={<GlyphShelf />} label="Полок" value={selCabs[0].count ?? 0} min={0} max={8} step={1} unit=""
                        onBegin={beginCabEdit}
                        onLive={(v) => applyToSelected({ count: v })}
                        onCommit={(v) => applyToSelected({ count: v })} />
                      <button className="dim-fill" onClick={() => equalizeSelected()} type="button" disabled={!selResizable}>
                        <GlyphW />
                        Распределить поровну
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── СТИЛЬ ── merged Edit+Style. 4 PART TABS across the top (icon only); the active tab
                shows its finishes as an image+label GRID (no price). Applies to the whole selection. */}
            {sheet === "style" && selIds.length >= 1 && (() => {
              const base = selCabs.some((c) => c.kind === "base");
              const TABS: { id: string; name: string; icon: React.ReactNode }[] = [
                { id: "front", name: "Фасад", icon: <StyleFront /> },
                { id: "handle", name: "Ручка", icon: <StyleHandle /> },
                ...(base ? [{ id: "worktop", name: "Столешница", icon: <StyleWorktop /> }] : []),
                // only where there IS a sink — the mount is the one thing that distinguishes one
                // sink from another, and it has nowhere else to be asked
                ...(selCabs[0]?.appliance === "sink" ? [{ id: "sink", name: t.config.sinkTab, icon: <StyleWorktop /> }] : []),
                { id: "carcass", name: "Корпус", icon: <StyleCarcass /> },
              ];
              const activeId = TABS.some((tb) => tb.id === stylePart) ? stylePart : "front";
              const key = PART_FINISH[activeId] as FinishKey;
              // the LIVE catalog (the screen subscribes to catalogRev, so an edit in Каталог
              // re-renders this picker and this call returns the new list)
              const mats = materialsFor(key);
              // the toggle decides scope: OFF = the selection, ON = every cabinet in the kitchen
              const applyStyle = (patch: Partial<Cabinet>) => (styleAll ? patchAllCabs(patch) : applyToSelected(patch));
              const applyFinish = (fin: Partial<Record<FinishKey, number>>) => (styleAll ? applyFinishToAll(fin) : applyFinishToSelected(fin));
              // the PRIMARY module's current settings drive the "which one is selected" highlight
              const pc = selCabs[0];
              const curFront = frontOf(pc);
              const curOpening: DoorOpening = pc.opening ?? "left";
              const curHandlePos: HandlePos = pc.handlePos ?? defaultHandlePos(curOpening);
              const curColor = pc.finish?.[key] ?? (runStyle as unknown as Record<string, number>)[key];
              return (
                <>
                  {sel && !sel.furniture && (
                    <div className="cab-actions">
                      <button className="cab-act" onClick={() => { saveCab(sel.id, labelFor(sel)); flash(t.fe.savedCab); }} type="button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
                        {t.fe.saveDo}
                      </button>
                    </div>
                  )}
                  {/* 4 part tabs: inactive = icon-only circle; ACTIVE = icon + its name (so a first-time
                      user learns what each does), the label truncated to 7 chars so it never overflows */}
                  <div className="style-tabs">
                    {TABS.map((tb) => (
                      <button key={tb.id} className={`style-tab${activeId === tb.id ? " on" : ""}`} onClick={() => setStylePart(tb.id)} type="button" aria-label={tb.name} aria-pressed={activeId === tb.id}>
                        {tb.icon}
                        {activeId === tb.id && (
                          <span className="style-tab-lbl">{tb.name.length > 8 ? tb.name.slice(0, 7) + "…" : tb.name}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="style-applyall">
                    <span>Применить ко всем</span>
                    <button className={`switch${styleAll ? " on" : ""}`} onClick={() => setStyleAll((a) => !a)} type="button" aria-pressed={styleAll}><span className="knob" /></button>
                  </div>
                  {/* keyed on the active part → the content fades/slides in when you switch tabs */}
                  <div className="cfg-sheet-body style-body" key={activeId}>
                    {/* ФАСАД: profile (shape) + which way the door opens */}
                    {activeId === "front" && (
                      <>
                        <div className="style-heading">Профиль</div>
                        <div className="style-profiles">
                          {FRONT_CHOICES.map((p) => (
                            <button key={p} className={`style-profile${curFront === p ? " on" : ""}`} onClick={() => applyStyle({ front: p })} type="button">{FRONT_LABEL[p]}</button>
                          ))}
                        </div>
                        <div className="style-heading">{t.fe.opening}</div>
                        <div className="style-profiles">
                          {(["left", "right", "top", "bottom"] as DoorOpening[]).map((o) => (
                            <button key={o} className={`style-profile${curOpening === o ? " on" : ""}`} onClick={() => applyStyle({ opening: o })} type="button">{t.fe.opt[o]}</button>
                          ))}
                        </div>
                        {/* THIS MODULE'S GRAIN — a wide drawer bank is often laid across while the
                            doors beside it run up. Blank = whatever the kitchen says (Отделка). */}
                        <div className="style-heading">{t.config.grainThis}</div>
                        <div className="style-profiles">
                          {([[undefined, t.config.grainInherit], [false, t.config.grainV], [true, t.config.grainH]] as const).map(([v, label]) => (
                            <button
                              key={String(v)}
                              className={`style-profile${pc.grainHorizontal === v ? " on" : ""}`}
                              onClick={() => applyStyle({ grainHorizontal: v })}
                              type="button"
                            >{label}</button>
                          ))}
                        </div>
                        {/* AN L CORNER CAN CARRY TWO LEAVES — one per arm, each hinged at its own
                            outer end. Only offered where it means something: a diagonal corner has
                            one face, so it has one door. */}
                        {pc.corner && cornerShapeOf(pc) === "l" && (
                          <>
                            <div className="style-heading">{t.config.cornerDoors}</div>
                            <div className="style-profiles">
                              {([["single", t.config.cornerSingle], ["pair", t.config.cornerPair]] as const).map(([v, label]) => (
                                <button
                                  key={v}
                                  className={`style-profile${(pc.cornerDoors ?? "single") === v ? " on" : ""}`}
                                  onClick={() => applyStyle({ cornerDoors: v })}
                                  type="button"
                                >{label}</button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {/* РУЧКА: type + where it sits on the door */}
                    {activeId === "handle" && (
                      <>
                        <div className="style-heading">Тип</div>
                        <div className="style-profiles">
                          {HANDLES.map((h, hi) => (
                            <button key={h} className={`style-profile${(pc.handle ?? 0) === hi ? " on" : ""}`} onClick={() => applyStyle({ handle: hi })} type="button">{h}</button>
                          ))}
                        </div>
                        <div className="style-heading">Расположение</div>
                        <div className="style-profiles">
                          {(["left", "right", "top", "bottom", "center", "none"] as HandlePos[]).map((p) => (
                            <button key={p} className={`style-profile${curHandlePos === p ? " on" : ""}`} onClick={() => applyStyle({ handlePos: p })} type="button">{t.fe.opt[p]}</button>
                          ))}
                        </div>
                      </>
                    )}
                    {activeId === "sink" && (() => {
                      const cur = sinkOf(pc)!;
                      const hole = sinkHole(pc);
                      const setSink = (patch: Partial<SinkSpec>) => applyStyle({ sink: { ...(pc.sink ?? {}), ...patch } });
                      return (
                        <>
                          {/* THE MOUNT is the whole difference between one sink and another: it is
                              where the bowl meets the slab's cut edge, and it is what the client
                              sees. The app drew накладная for every sink until this existed. */}
                          <div className="style-heading">{t.config.sinkMount}</div>
                          <div className="style-profiles">
                            {([
                              ["inset", t.config.sinkInset],
                              ["overmount", t.config.sinkOvermount],
                              ["undermount", t.config.sinkUndermount],
                              ["integrated", t.config.sinkIntegrated],
                            ] as const).map(([m, label]) => (
                              <button
                                key={m}
                                className={`style-profile${cur.mount === m ? " on" : ""}`}
                                onClick={() => setSink({ mount: m })}
                                type="button"
                              >{label}</button>
                            ))}
                          </div>
                          <div className="style-heading">{t.config.sinkBowls}</div>
                          <div className="style-profiles">
                            {([[1, t.config.sinkOne], [2, t.config.sinkTwo]] as const).map(([n, label]) => (
                              <button
                                key={n}
                                className={`style-profile${cur.bowls === n ? " on" : ""}`}
                                onClick={() => setSink({ bowls: n })}
                                type="button"
                              >{label}</button>
                            ))}
                          </div>
                          {/* the opening is DERIVED — a rimmed mount cuts smaller than the bowl,
                              a rimless one cuts it exactly, and both are held inside the rails */}
                          <div className="fin-note">
                            {hole ? t.config.sinkHole(hole.w, hole.d) : t.config.sinkNoHole}
                          </div>
                        </>
                      );
                    })()}
                    {activeId !== "sink" && (
                    <>
                    <div className="style-heading">Цвет</div>
                    <div className="style-grid">
                      {mats.map((m) => {
                        const on = curColor != null && hexToInt(m.color) === curColor;
                        return (
                          <button key={m.id} className={`style-cell${on ? " on" : ""}`} onClick={() => applyFinish({ [key]: hexToInt(m.color) })} type="button">
                            <div className="style-swatch-wrap">
                              <span className="style-swatch" style={{ background: m.color, display: "block", width: "100%", height: "100%" }} />
                              {m.code && <span className="mat-code-badge">{m.code}</span>}
                            </div>
                            <span className="style-name">{m.name}</span>
                            {m.desc && <span className="mat-spec-desc">{m.desc}</span>}
                            {m.stockSheets != null && <span className="mat-spec-desc" style={{ color: "#00ac7a", fontWeight: 500 }}>склад: {m.stockSheets} л</span>}
                          </button>
                        );
                      })}
                    </div>
                    </>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── ОТДЕЛКА ── the two wall panels that are not cabinets. Neither needs a selection:
                they are properties of the KITCHEN, and both are derived from whatever is standing
                there (model/wallPanels.ts) — which is why there is nothing here to place or size
                per wall, only what they are made of and how far they reach. */}
            {sheet === "finish" && (() => {
              const DECORS: { id: PanelDecor; label: string }[] = [
                { id: "worktop", label: t.config.decorWorktop },
                { id: "facade", label: t.config.decorFacade },
                { id: "carcass", label: t.config.decorCarcass },
                { id: "custom", label: t.config.decorCustom },
              ];
              // «Свой» — a фартук is often a decor of its own (скинали, a stone that isn't the
              // counter). Without this the panel could only ECHO another part, which is why
              // changing a material appeared to do nothing to it.
              const splashMats = [...materialsFor("worktop"), ...materialsFor("facade")];
              return (
                <>
                  <div className="sheet-head">
                    <div className="sheet-title">{t.config.finish}</div>
                    <div className="sheet-head-actions">
                      <button
                        className="sheet-expand-btn"
                        onClick={() => setSheetFullscreen((p) => !p)}
                        type="button"
                        title={sheetFullscreen ? "Свернуть панель" : "Развернуть на весь экран"}
                      >
                        {sheetFullscreen ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                        )}
                      </button>
                      <button className="sheet-x" onClick={closeSheet} type="button" aria-label={t.config.close}>✕</button>
                    </div>
                  </div>
                  <div className="cfg-sheet-body style-body">
                    {/* ── ГОТОВЫЕ ПАЛИТРЫ КУХНИ (Kitchen Color Palettes) ── */}
                    <div className="finish-palettes-section">
                      <div className="finish-palettes-title">
                        <span>🎨</span>
                        <span>Готовые палитры кухни</span>
                      </div>
                      <div className="finish-palettes-hint">
                        Применяет цвета фасадов, столешницы и корпуса ко всем шкафам
                      </div>

                      <div className="finish-palettes-grid">
                        {[...FINISH_PALETTES, ...customPalettes].map((p) => {
                          const isSelected = activeFinishPaletteId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`finish-palette-card${isSelected ? " active" : ""}`}
                              onClick={() => {
                                setActiveFinishPaletteId(p.id);
                                applyFinishToAll({ facade: p.facade, carcass: p.carcass, worktop: p.worktop });
                                flash(`Палитра «${p.name}» применена ко всей кухне`);
                              }}
                            >
                              {p.isCustom && (
                                <span
                                  className="custom-pal-del"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = customPalettes.filter((cp) => cp.id !== p.id);
                                    setCustomPalettes(next);
                                    saveCustomPalettes(next);
                                    if (activeFinishPaletteId === p.id) setActiveFinishPaletteId(null);
                                    flash(`Палитра «${p.name}» удалена`);
                                  }}
                                  title="Удалить палитру"
                                >
                                  ✕
                                </span>
                              )}
                              <div
                                className="tpl-split-swatch"
                                style={{
                                  background: `linear-gradient(135deg, ${p.color1} 0%, ${p.color1} 50%, ${p.color2} 50%, ${p.color2} 100%)`,
                                }}
                              />
                              <span className="finish-palette-name">{p.name}</span>
                              {isSelected && <span className="finish-palette-check">✓</span>}
                            </button>
                          );
                        })}

                        {/* "+ Свой цвет" button to toggle custom creator */}
                        <button
                          type="button"
                          className={`finish-palette-card custom-add-card${isCustomOpen ? " active" : ""}`}
                          onClick={() => setIsCustomOpen((o) => !o)}
                          title="Создать свою комбинацию цветов"
                        >
                          <div className="custom-add-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                          <span className="finish-palette-name">+ Свой цвет</span>
                        </button>
                      </div>

                      {/* Custom palette builder */}
                      {isCustomOpen && (
                        <div className="custom-palette-builder">
                          <div className="custom-builder-head">
                            <span className="custom-builder-title">Своя комбинация цветов:</span>
                            <button
                              type="button"
                              className="custom-close-btn"
                              onClick={() => setIsCustomOpen(false)}
                              title="Закрыть конструктор"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="custom-preview-box">
                            <div
                              className="tpl-split-swatch"
                              style={{
                                width: "42px",
                                height: "42px",
                                minWidth: "42px",
                                minHeight: "42px",
                                background: `linear-gradient(135deg, ${customFacade} 0%, ${customFacade} 50%, ${customWorktop} 50%, ${customWorktop} 100%)`,
                              }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                                {customName.trim() || "Пользовательская палитра"}
                              </span>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                Фасады {customFacade} · Столешница {customWorktop}
                              </span>
                            </div>
                          </div>

                          {/* 1. Фасады */}
                          <div className="custom-picker-row">
                            <div className="custom-picker-lbl">
                              <span>Цвет фасадов:</span>
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>{customFacade}</span>
                            </div>
                            <div className="custom-color-control">
                              <input
                                type="color"
                                className="custom-color-input"
                                value={customFacade}
                                onChange={(e) => setCustomFacade(e.target.value)}
                              />
                              <div className="custom-quick-swatches">
                                {[
                                  { c: "#F8F8F6", t: "Белый" },
                                  { c: "#EDEDE6", t: "Кремовый" },
                                  { c: "#D8CEBE", t: "Кашемир" },
                                  { c: "#738276", t: "Шалфей" },
                                  { c: "#1B4D3E", t: "Изумруд" },
                                  { c: "#3A3D40", t: "Графит" },
                                  { c: "#1C1D1F", t: "Черный" },
                                  { c: "#3E2723", t: "Шоколад" },
                                ].map((sw) => (
                                  <button
                                    key={sw.c}
                                    type="button"
                                    className={`quick-swatch-btn${customFacade.toLowerCase() === sw.c.toLowerCase() ? " active" : ""}`}
                                    style={{ background: sw.c }}
                                    onClick={() => setCustomFacade(sw.c)}
                                    title={sw.t}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 2. Столешница */}
                          <div className="custom-picker-row">
                            <div className="custom-picker-lbl">
                              <span>Цвет столешницы:</span>
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>{customWorktop}</span>
                            </div>
                            <div className="custom-color-control">
                              <input
                                type="color"
                                className="custom-color-input"
                                value={customWorktop}
                                onChange={(e) => setCustomWorktop(e.target.value)}
                              />
                              <div className="custom-quick-swatches">
                                {[
                                  { c: "#D4B896", t: "Дуб" },
                                  { c: "#5C4033", t: "Орех" },
                                  { c: "#F3F4F6", t: "Мрамор" },
                                  { c: "#EFEDEA", t: "Светлый камень" },
                                  { c: "#2B2D30", t: "Гранит" },
                                  { c: "#6E7072", t: "Бетон" },
                                  { c: "#E5DAC8", t: "Беленый дуб" },
                                  { c: "#1A1A1A", t: "Черный сланец" },
                                ].map((sw) => (
                                  <button
                                    key={sw.c}
                                    type="button"
                                    className={`quick-swatch-btn${customWorktop.toLowerCase() === sw.c.toLowerCase() ? " active" : ""}`}
                                    style={{ background: sw.c }}
                                    onClick={() => setCustomWorktop(sw.c)}
                                    title={sw.t}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 3. Название палитры */}
                          <div className="custom-picker-row" style={{ marginBottom: "8px" }}>
                            <input
                              type="text"
                              className="custom-name-input"
                              placeholder="Название (например, Мой стиль)"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              maxLength={24}
                            />
                          </div>

                          {/* Actions */}
                          <div className="custom-builder-actions">
                            <button
                              type="button"
                              className="custom-apply-btn"
                              onClick={() => {
                                const fNum = parseInt(customFacade.replace("#", ""), 16);
                                const wNum = parseInt(customWorktop.replace("#", ""), 16);
                                const cNum = syncCarcassWithFacade ? fNum : parseInt(customCarcass.replace("#", ""), 16);
                                applyFinishToAll({ facade: fNum, carcass: cNum, worktop: wNum });
                                flash("Свои цвета применены ко всей кухне!");
                              }}
                            >
                              ✓ Применить к кухне
                            </button>
                            <button
                              type="button"
                              className="custom-save-btn"
                              onClick={() => {
                                const fNum = parseInt(customFacade.replace("#", ""), 16);
                                const wNum = parseInt(customWorktop.replace("#", ""), 16);
                                const cNum = syncCarcassWithFacade ? fNum : parseInt(customCarcass.replace("#", ""), 16);
                                const name = customName.trim() || `Своя ${customPalettes.length + 1}`;
                                const newPal: FinishPaletteOption = {
                                  id: `custom-${Date.now()}`,
                                  name,
                                  color1: customFacade,
                                  color2: customWorktop,
                                  facade: fNum,
                                  carcass: cNum,
                                  worktop: wNum,
                                  isCustom: true,
                                };
                                const updated = [...customPalettes, newPal];
                                setCustomPalettes(updated);
                                saveCustomPalettes(updated);
                                setActiveFinishPaletteId(newPal.id);
                                applyFinishToAll({ facade: fNum, carcass: cNum, worktop: wNum });
                                setCustomName("");
                                setIsCustomOpen(false);
                                flash(`Палитра «${name}» сохранена и применена!`);
                              }}
                            >
                              ★ Сохранить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="fin-sep" />
                    {/* ФАРТУК */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.splash}</span>
                        <span className="fin-sub">{t.config.splashSub}</span>
                      </div>
                      <button
                        className={`switch${splash.on ? " on" : ""}`}
                        onClick={() => setSplash({ on: !splash.on })}
                        type="button"
                        aria-pressed={splash.on}
                      ><span className="knob" /></button>
                    </div>
                    {splash.on && (
                      <>
                        <div className="style-heading">{t.config.splashDecor}</div>
                        <div className="style-profiles">
                          {DECORS.map((d) => (
                            <button
                              key={d.id}
                              className={`style-profile${splash.decor === d.id ? " on" : ""}`}
                              onClick={() => setSplash({ decor: d.id })}
                              type="button"
                            >{d.label}</button>
                          ))}
                        </div>
                        <div className="style-heading">{t.config.splashMode}</div>
                        <div className="style-profiles">
                          <button className={`style-profile${splash.mode === "fill" ? " on" : ""}`} onClick={() => setSplash({ mode: "fill" })} type="button">{t.config.splashFill}</button>
                          <button className={`style-profile${splash.mode === "fixed" ? " on" : ""}`} onClick={() => setSplash({ mode: "fixed" })} type="button">{t.config.splashFixed}</button>
                        </div>
                        {splash.decor === "custom" && (
                          <div className="style-grid">
                            {splashMats.map((m) => {
                              const on = splash.color === hexToInt(m.color);
                              return (
                                <button key={m.id} className={`style-cell${on ? " on" : ""}`} onClick={() => setSplash({ color: hexToInt(m.color) })} type="button">
                                  <div className="style-swatch-wrap">
                                    <span className="style-swatch" style={{ background: m.color, display: "block", width: "100%", height: "100%" }} />
                                    {m.code && <span className="mat-code-badge">{m.code}</span>}
                                  </div>
                                  <span className="style-name">{m.name}</span>
                                  {m.desc && <span className="mat-spec-desc">{m.desc}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {splash.mode === "fixed" && (
                          <DimSlider icon={<GlyphH />} label={t.config.splashMode} value={splash.h} min={200} max={1000} step={10}
                            onLive={(v) => setSplash({ h: v })}
                            onCommit={(v) => setSplash({ h: v })} />
                        )}
                      </>
                    )}

                    <div className="fin-sep" />

                    {/* ДНО НАВЕСНЫХ — the plane under the wall units */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.underside}</span>
                        <span className="fin-sub">{t.config.undersideSub}</span>
                      </div>
                      <button
                        className={`switch${underside.on ? " on" : ""}`}
                        onClick={() => setUnderside({ on: !underside.on })}
                        type="button"
                        aria-pressed={underside.on}
                      ><span className="knob" /></button>
                    </div>

                    <div className="fin-sep" />

                    {/* ПОДСВЕТКА — LED built into the cabinetry. Four zones, because a designer
                        specs them one at a time and each is a separate run of strip on the invoice.
                        The readout says what it came to: nobody types a strip's length, it is the
                        length of the row it is screwed to (model/ledStrips.ts). */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.led}</span>
                        <span className="fin-sub">{t.config.ledSub}</span>
                      </div>
                    </div>
                    {([
                      ["under", t.config.ledUnder, t.config.ledUnderSub],
                      ["cornice", t.config.ledCornice, t.config.ledCorniceSub],
                      ["plinth", t.config.ledPlinth, t.config.ledPlinthSub],
                      ["inside", t.config.ledInside, t.config.ledInsideSub],
                    ] as const).map(([zone, name, sub]) => {
                      const key = zone === "inside" ? "interior" : zone;
                      const on = led[key as "under" | "plinth" | "cornice" | "interior"];
                      return (
                        <div className="fin-row" key={zone}>
                          <div className="fin-label">
                            <span className="fin-name">{name}</span>
                            <span className="fin-sub">{sub}</span>
                          </div>
                          <button
                            className={`switch${on ? " on" : ""}`}
                            onClick={() => setLed({ [key]: !on })}
                            type="button"
                            aria-pressed={on}
                          ><span className="knob" /></button>
                        </div>
                      );
                    })}
                    {ledLit && (
                      <>
                        <div className="style-heading">{t.config.ledTemp}</div>
                        <div className="style-profiles">
                          {LED_TEMPS.map((k) => (
                            <button
                              key={k}
                              className={`style-profile${led.temp === k ? " on" : ""}`}
                              onClick={() => setLed({ temp: k })}
                              type="button"
                            >
                              <span
                                className="led-dot"
                                style={{ background: `#${ledColor(k).toString(16).padStart(6, "0")}` }}
                              />
                              {k}K
                            </button>
                          ))}
                        </div>
                        <div className="fin-row">
                          <div className="fin-label">
                            <span className="fin-name">{t.config.ledSensor}</span>
                            <span className="fin-sub">{t.config.ledSensorSub}</span>
                          </div>
                          <button
                            className={`switch${led.sensor ? " on" : ""}`}
                            onClick={() => setLed({ sensor: !led.sensor })}
                            type="button"
                            aria-pressed={led.sensor}
                          ><span className="knob" /></button>
                        </div>
                        <div className="fin-note">
                          {ledMeasured ? t.config.ledLen(ledMeasured.metres, ledMeasured.psu) : t.config.ledNone}
                        </div>
                      </>
                    )}

                    <div className="fin-sep" />

                    {/* НАПРАВЛЕНИЕ ТЕКСТУРЫ — the fronts are mapped in slab space, so this turns
                        the whole board rather than re-tiling each door */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.grain}</span>
                        <span className="fin-sub">{t.config.grainSub}</span>
                      </div>
                    </div>
                    <div className="style-profiles">
                      <button className={`style-profile${!runStyle.grainHorizontal ? " on" : ""}`} onClick={() => setGrain(false)} type="button">{t.config.grainV}</button>
                      <button className={`style-profile${runStyle.grainHorizontal ? " on" : ""}`} onClick={() => setGrain(true)} type="button">{t.config.grainH}</button>
                    </div>

                    <div className="fin-sep" />

                    {/* УГЛОВЫЕ — a shop builds all its corners the same way, so the answer belongs
                        here; a single module can still differ (Стиль → Фасад). */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.cornerDoors}</span>
                      </div>
                    </div>
                    <div className="style-profiles">
                      {([["single", t.config.cornerSingle], ["pair", t.config.cornerPair]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          className={`style-profile${(runStyle.cornerDoors ?? "single") === v ? " on" : ""}`}
                          onClick={() => setCornerDoors(v)}
                          type="button"
                        >{label}</button>
                      ))}
                    </div>

                    <div className="fin-sep" />

                    {/* ДО ПОТОЛКА */}
                    <div className="fin-row">
                      <div className="fin-label">
                        <span className="fin-name">{t.config.closer}</span>
                        <span className="fin-sub">{t.config.closerSub}</span>
                      </div>
                      <button
                        className={`switch${closer.on ? " on" : ""}`}
                        onClick={() => setCloser({ on: !closer.on })}
                        type="button"
                        aria-pressed={closer.on}
                      ><span className="knob" /></button>
                    </div>
                    {closer.on && (
                      <>
                        {/* WHY a limit and not "always close it": past this, the honest answer is a
                            third ROW, not a sheet of MDF a metre tall. The readout below says which
                            case this kitchen is actually in, so the number is never a mystery. */}
                        <DimSlider icon={<GlyphH />} label={t.config.closerGap} value={closer.maxGap} min={0} max={1000} step={50}
                          onLive={(v) => setCloser({ maxGap: v })}
                          onCommit={(v) => setCloser({ maxGap: v })} />
                        <div className="fin-note">
                          {ceilGap == null
                            ? t.config.noGap
                            : ceilGap > closer.maxGap
                              ? t.config.gapTooBig(Math.round(ceilGap))
                              : `${Math.round(ceilGap)} ${t.config.mm}`}
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── ШКАФЫ ── Наполнение / Сохранить on top, a type filter, and the cabinet grid. Tapping
                a type swaps the whole selection to it. When nothing selected, shows the 5 PLACE_ROWS bands. */}
            {sheet === "cabinets" && (() => {
              if (selIds.length === 0) {
                const activeBand = PLACE_ROWS.find((r) => r.key === placeRow) ?? PLACE_ROWS[0];
                return (
                  <>
                    <div className="sheet-head">
                      <div className="sheet-title">Добавить модуль в проект</div>
                      <button className="sheet-x" onClick={closeSheet} type="button" aria-label={t.config.close}>✕</button>
                    </div>

                    {/* 5 Row Categories: Нижние, Навесные, 3-й ряд (Антресоль), Пеналы, Свободно */}
                    <div className="cfg-place-rows-bar">
                      {PLACE_ROWS.map((row) => {
                        const isCurrent = placeRow === row.key;
                        return (
                          <button
                            key={row.key}
                            type="button"
                            className={`cfg-place-row-chip${isCurrent ? " on" : ""}`}
                            onClick={() => pickPlaceRow(row.key)}
                          >
                            <span className="cfg-row-thumb">
                              <AddThumb id={row.png} glyph={row.items[0]?.glyph ?? "▢"} />
                            </span>
                            <span className="cfg-row-label">{row.label}</span>
                            {isCurrent && <span className="cfg-row-active-dot" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="cfg-sheet-body">
                      <div className="cfg-band-heading">
                        <span className="cfg-band-title">{activeBand.label} ({activeBand.items.length})</span>
                        <span className="cfg-band-hint">
                          {placeRow === "extra"
                            ? "Нажмите на модуль, чтобы разместить его в комнате"
                            : "Нажмите на модуль для выбора или коснитесь ячейки на стене в 3D"}
                        </span>
                      </div>
                      <div className="cab-grid">
                        {activeBand.items.map((tpl) => (
                          <button key={tpl.id} className="cab-cell" onClick={() => addItem(tpl)} type="button">
                            <AddThumb id={tpl.id} glyph={tpl.glyph} cab={tpl.cab} />
                            <span className="cab-cname">{tpl.name}</span>
                            {tpl.sub && <span className="cab-csub" style={{ fontSize: 11, color: "#888", display: "block" }}>{tpl.sub}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                );
              }

              const cat = CAB_CATS.find((c) => c.id === cabFilter) ?? CAB_CATS[0];
              const items = CABINET_GROUPS.flatMap((g) => g.items).filter((tpl) => cat.ok(tpl.cab));
              return (
                <>
                  <div className="sheet-head">
                    <div className="sheet-title">Шкафы</div>
                    <button className="sheet-x" onClick={closeSheet} type="button" aria-label={t.config.close}>✕</button>
                  </div>
                  {sel && (
                    <div className="cab-actions">
                      <button className="cab-act primary" onClick={() => setFillOpen(true)} type="button">{t.fe.fill}</button>
                      {!sel.furniture && (
                        <button className="cab-act" onClick={() => { saveCab(sel.id, labelFor(sel)); flash(t.fe.savedCab); }} type="button">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
                          {t.fe.saveDo}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="cab-filter">
                    {CAB_CATS.map((c) => (
                      <button key={c.id} className={`cab-fchip${cabFilter === c.id ? " on" : ""}`} onClick={() => setCabFilter(c.id)} type="button">{c.name}</button>
                    ))}
                  </div>
                  <div className="cfg-sheet-body">
                    <div className="cab-grid">
                      {items.map((tpl) => (
                        <button key={tpl.id} className="cab-cell" onClick={() => swapSel(tpl)} type="button">
                          <AddThumb id={tpl.id} glyph={tpl.glyph} cab={tpl.cab} />
                          <span className="cab-cname">{tpl.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

          </div>
        </>
      )}

      {/* focused full-screen fill (Наполнение) editor — covers the sheet, light bg */}
      {fillOpen && cabs[i] && (
        <FillEditor
          cab={cabs[i]}
          index={i}
          name={labelFor(cabs[i])}
          style={runStyle}
          patchCab={patchCab}
          patchCabLive={patchCabLive}
          beginEdit={beginCabEdit}
          undo={undoCab}
          redo={redoCab}
          canUndo={canUndoCab}
          canRedo={canRedoCab}
          ceiling={ceiling}
          onClose={() => setFillOpen(false)}
        />
      )}

      {/* inline dimension editor (front / plan view — tap a measurement number).
          − / + step by 5 cm and apply live; the input stays open for more taps. */}
      {feEdit && (
        <div
          className="num-stepper"
          style={{
            left: Math.max(110, Math.min(feEdit.x, window.innerWidth - 110)),
            top: Math.max(96, Math.min(feEdit.y, window.innerHeight - 60)),
          }}
        >
          <button className="num-step" type="button" aria-label="−50 мм" onPointerDown={(e) => e.preventDefault()} onClick={() => stepFe(-50)}>−</button>
          <input
            className="num-edit"
            autoFocus
            inputMode="numeric"
            value={feVal}
            onChange={(e) => setFeVal(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitFe();
              if (e.key === "Escape") setFeEdit(null);
            }}
            onBlur={commitFe}
          />
          <button className="num-step" type="button" aria-label="+50 мм" onPointerDown={(e) => e.preventDefault()} onClick={() => stepFe(50)}>+</button>
        </div>
      )}

      {/* ── ROOM EDITOR OVERLAY ── the full-featured RoomScene from Phase A, rendered on top of
          the constructor when the user clicks "1. Стены & Комната". Both editors share the same
          Zustand store, so room edits instantly flow into the cabinet layout. */}
      {roomEditorOpen && (
        <div className="room-editor-overlay">
          <RoomScene embedded onDone={() => setRoomEditorOpen(false)} />
        </div>
      )}
    </div>
  );
}
