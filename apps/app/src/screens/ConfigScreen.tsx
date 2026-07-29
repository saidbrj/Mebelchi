// Phase C — "Конструктор". Re-skinned to mirror the room editor (Phase A): a live
// 3D stage with its own chrome (price + nav bar on top, a category toolbar on the
// bottom). Bottom-left carries two round toggles like the room editor — a 3D/2D
// view switcher and a render-style switcher (realistic / translucent / wireframe).
// Tapping a module in the scene selects + highlights it and swaps the bottom
// toolbar to per-item actions (edit / open / duplicate / delete).
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { useMoney } from "../useMoney";
import { useDesignPrice } from "../pricing/usePrice";
import { VariantScene } from "../three/VariantScene";
import { DEFAULT_SUN } from "../three/lighting";
import { ConstructorPlan, type PlanEdit } from "../components/ConstructorPlan";
import { ElevationGrid, type EditDim } from "../components/ElevationGrid";
import { locate, rowEdges, ROW_MIN, type CellRef, type RowKind } from "../model/grid";
import { FurnitureEditor, emptyCfg, type PartCfg } from "../components/FurnitureEditor";
import { V21Cabinet3DStudio } from "../components/V21Cabinet3DStudio";
import { FillEditor } from "../components/FillEditor";
import { planRuns } from "../model/runPlan";
import { fillGapSpan } from "../model/fill";
import { openCells } from "../model/sheet";
import { resolveLayout } from "../model/resolve";
import { cabDepth, cornerShapeOf, cornerArm, maxCabH, MIN_H, D_MIN, D_MAX } from "../model/bands";
import { dockAll, cabFootprints, objectOverlapIds } from "../model/footprint";
import { FRONT_PROFILES, HANDLES, frontOf, defaultHandlePos, mk, type Cabinet, type FrontProfile, type FinishKey, type DoorOpening, type HandlePos } from "../model/cabinet";
import { EMAN_MATERIALS, hexToInt } from "../model/materials";
import { PART_FINISH } from "../model/parts";
import { CABINET_GROUPS, APPLIANCE_GROUPS, FURNITURE_GROUPS, EXTRA_GROUPS, type AddTemplate } from "../model/addCatalog";
import { listSavedCabs } from "../model/savedCabs";
import { templateThumbnail } from "../lib/cabThumb";
import { FLOOR_COVERINGS } from "../model/floors";
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

type Sheet = null | "pickCab" | "pickAppl" | "editor" | "dining" | "extra" | "resize" | "style" | "cabinets";

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
const FACADE_SWATCHES = EMAN_MATERIALS.filter((m) => m.part === "facade");

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
// resize-panel dimension glyphs
const GlyphW = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M6 15L6.44494 15.4534L11.6225 20.5L12.5528 19.5932L8.48764 15.6308L21.5124 15.6308L17.4472 19.5932L18.3775 20.5L23.5551 15.4534L24 15L23.5551 14.5466L18.3775 9.5L17.4472 10.4068L21.5124 14.3692L8.48764 14.3692L12.5528 10.4068L11.6225 9.5L6.44494 14.5466L6 15Z" /></svg>);
const GlyphH = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M14.5 6L14.0466 6.44494L9 11.6225L9.90681 12.5528L13.8692 8.48764L13.8692 21.5124L9.90681 17.4472L9 18.3775L14.0466 23.5551L14.5 24L14.9534 23.5551L20 18.3775L19.0932 17.4472L15.1308 21.5124L15.1308 8.48764L19.0932 12.5528L20 11.6225L14.9534 6.44494L14.5 6Z" /></svg>);
const GlyphD = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M10.125 7.5L9.75 9H20.25L19.875 7.5H10.125ZM15 9.75L13.125 11.25H14.25V17.25H11.625L15 20.25L18.375 17.25H15.75V11.25H16.875L15 9.75ZM6.375 21L6 22.5H24L23.625 21H6.375Z" /></svg>);
const GlyphShelf = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M6.5625 8.90625V10.2604H23.4375V8.90625H6.5625ZM6.5625 11.6146V12.9687H23.4375V11.6146H6.5625ZM6.5625 14.3229V15.6771H23.4375V14.3229H6.5625ZM6.5625 17.0312V18.3854H23.4375V17.0312H6.5625ZM6.5625 19.7396V21.0937H23.4375V19.7396H6.5625Z" /></svg>);

// style-panel part-tab glyphs (Фасад / Ручка / Столешница / Корпус)
const StyleFront = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="5" y="3" width="14" height="18" rx="1.5" /><circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" /></svg>);
const StyleHandle = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><rect x="6" y="10.5" width="12" height="3" rx="1.5" /><path d="M8 10.5v-1M16 10.5v-1" /></svg>);
const StyleWorktop = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="3" y="6" width="18" height="4" rx="1" /><path d="M6 10v8M18 10v8" /></svg>);
const StyleCarcass = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M9 9v11" /></svg>);

// A snapping slider + an exact editable number. Drag snaps to `step`; release commits (one undo
// step, opened at pointer-down). The number is uncontrolled (`key` resets it when the value moves
// under it) and commits on blur/Enter — so you can type an exact size the slider can't land on.
function DimSlider(props: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number;
  unit?: string; onBegin?: () => void; onLive: (v: number) => void; onCommit: (v: number) => void;
}) {
  const { icon, label, value, min, max, step, unit = "мм", onBegin, onLive, onCommit } = props;
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="dim-row">
      <span className="dim-ico" aria-hidden>{icon}</span>
      <span className="dim-lbl">{label}</span>
      <input
        className="dim-slider" type="range" min={min} max={max} step={step} value={value}
        onPointerDown={onBegin}
        onChange={(e) => onLive(clamp(Number(e.target.value)))}
        onPointerUp={(e) => onCommit(clamp(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => onCommit(clamp(Number((e.target as HTMLInputElement).value)))}
        onContextMenu={(e) => e.preventDefault()}
      />
      <input
        className="dim-num" type="number" inputMode="numeric" min={min} max={max} step={step}
        key={value} defaultValue={value}
        onFocus={onBegin}
        onBlur={(e) => { const v = clamp(Number(e.target.value)); if (v !== value) onCommit(v); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {unit && <span className="dim-unit">{unit}</span>}
    </div>
  );
}

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

export function ConfigScreen() {
  const t = useT();
  const money = useMoney();
  const settings = useStore((s) => s.settings);
  const showPricing = settings.showPricing;
  const openMenu = useStore((s) => s.openMenu);
  const quality = settings.quality;
  const cabs = useStore((s) => s.cabs);
  const price = useDesignPrice(cabs); // USD, per the active pricing mode
  const selIdx = useStore((s) => s.selIdx);
  const mode = useStore((s) => s.mode);
  const runLayout = useStore((s) => s.runLayout);
  const runStyle = useStore((s) => s.runStyle);
  const points = useStore((s) => s.roomPoints);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
  const openings = useStore((s) => s.openings);
  const interiorWalls = useStore((s) => s.interiorWalls);
  const fittings = useStore((s) => s.fittings);
  const wallSurfaces = useStore((s) => s.wallSurfaces);
  const waterWall = useStore((s) => s.waterWall);
  const floorCovering = useStore((s) => s.floorCovering);
  const selectCab = useStore((s) => s.selectCab);
  const patchCab = useStore((s) => s.patchCab);
  const patchCabLive = useStore((s) => s.patchCabLive);
  const applyFinishToAll = useStore((s) => s.applyFinishToAll);
  const patchAllCabs = useStore((s) => s.patchAllCabs);
  const fillCabGap = useStore((s) => s.fillCabGap);
  const fillWallRow = useStore((s) => s.fillWallRow);
  const addCab = useStore((s) => s.addCab);
  const replaceCab = useStore((s) => s.replaceCab);
  const removeCab = useStore((s) => s.removeCab);
  const duplicateCab = useStore((s) => s.duplicateCab);
  const saveCab = useStore((s) => s.saveCab);
  const removeSavedCab = useStore((s) => s.removeSavedCab);
  useStore((s) => s.savedCabsRev); // re-render the "My cabinets" list on save/delete
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
  const back = useStore((s) => s.back);
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
  const [collapsed, setCollapsed] = useState(false);
  // per-module editor selections (materials / add-ons / toggles), kept for the
  // session so they survive closing + reopening the editor
  const [partCfg, setPartCfg] = useState<Record<string, PartCfg>>({});
  // inline dimension editor for the front view (tap a measurement number)
  const [feEdit, setFeEdit] = useState<{ x: number; y: number; apply: (v: number) => void } | null>(null);
  const [feVal, setFeVal] = useState("");

  // the toolbar hint auto-hides after 3s (room-editor behaviour)
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);
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

  const closeSheet = () => {
    setReplaceId(null); // leaving the catalog cancels any pending replace
    setFillOpen(false);
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

  // grip: tap toggles; drag down collapses, drag up expands (mirrors the room editor)
  const gripStart = useRef<number | null>(null);
  const onGripDown = (e: React.PointerEvent) => {
    gripStart.current = e.clientY;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (gripStart.current == null) return;
    const dy = e.clientY - gripStart.current;
    if (dy > 28) {
      setCollapsed(true);
      gripStart.current = null;
    } else if (dy < -28) {
      setCollapsed(false);
      gripStart.current = null;
    }
  };
  const onGripUp = () => {
    if (gripStart.current != null) setCollapsed((c) => !c);
    gripStart.current = null;
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
  // tapping a left-stack button opens its panel, or closes it if already open (a toggle)
  const openPanel = (k: Sheet) => setSheet((cur) => (cur === k ? null : k));
  // a convertible VOID band on the selected module's wall (dead wall tall enough to become another
  // upper row) → the 3D band control offers "+ ряд" (the same edit as the front view's "+ ряд").
  const addRowJ = (() => {
    if (view !== "3d" || !sel || !sel.cell || sel.px != null) return -1;
    const g = grids[sel.run ?? 0];
    if (!g) return -1;
    const ys = rowEdges(g);
    // the HIGHEST convertible void (dead wall near the ceiling) → an antresol / "3rd row", not the
    // low backsplash gap
    let best = -1;
    for (let j = 0; j < g.rows.length; j++) {
      if (g.rows[j].kind === "void" && ys[j + 1] - ys[j] >= ROW_MIN + 50) best = j;
    }
    return best;
  })();

  // select EXACTLY ONE module (from a chip, or after adding)
  const pick = (id: string | null) => {
    setPicked(id);
    if (id) selectOnly(id);
    else clearSel();
  };
  // a tap in the 3D toggles the module in/out of the selection (no mode — you just keep tapping)
  const pick3d = (id: string | null) => {
    if (!id) { clearSel(); setPicked(null); return; }
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
  const swapItems: AddTemplate[] = cornerLead
    ? [cornerLead, ...swapItemsRaw.filter((t) => t.id !== cornerLeadId)]
    : swapItemsRaw;
  // WHICH CHIP IS THIS MODULE ALREADY? Match on the template's defining traits, not width — the
  // user resizes modules, and a resized "Распашной" is still a "Распашной".
  //
  // `corner` / `cornerShape` / `island` are part of that identity. Leaving them out meant a selected
  // corner wall unit matched the plain "Навесной" AND every corner template at once: they all lit
  // up, and `swapTo` (which bails on `isCurrent`) refused to swap between them — so a corner cabinet
  // could not be changed into a different corner cabinet at all.
  const isCurrent = (tpl: AddTemplate) =>
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

  // the editor config for the active module + an updater
  const curId = cabs[i]?.id ?? "";
  const curCfg = partCfg[curId] ?? emptyCfg();
  const updateCfg = (updater: (c: PartCfg) => PartCfg) => setPartCfg((m) => ({ ...m, [curId]: updater(m[curId] ?? emptyCfg()) }));

  const openSheet = (kind: Sheet) => setSheet(kind);
  // the user's reusable "My cabinets" library (shown atop the cabinet picker)
  const savedCabs = sheet === "pickCab" ? listSavedCabs() : [];

  // selected-module toolbar actions
  const editSel = () => {
    if (!sel) return;
    selectCab(selIndex);
    setSheet("editor");
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
    // dock ALL modules so the gap test sees free-placed neighbours too (matches the store's
    // fillCabGap) — the chip must reflect the same result the button will produce.
    const docked = dockAll(cabs, points, waterWall, runLayout, openings, reveal);
    const cab = docked.find((c) => c.id === sel.id);
    if (!cab || cab.x == null || cab.px != null) return null; // not on a wall run
    return fillGapSpan(docked, cab, allRuns[cab.run ?? 0]?.len ?? Infinity);
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
      {/* top bar: ☰ menu · ← back (left) · step name / price (absolutely centred) · Next → (right) */}
      <div className="stepbar cfg-bar">
        <div className="cfg-bar-l">
          <button className="cfg-burger" onClick={openMenu} type="button" aria-label="Меню">
            <span /><span />
          </button>
          <button className="cfg-back" onClick={back} type="button" aria-label={t.config.back}>←</button>
        </div>
        <div className="cfg-title">
          {showPricing ? (
            <span className="cfg-price">{money(price)}<span className="cfg-price-i" aria-hidden>ⓘ</span></span>
          ) : (
            t.menu.phases.configure
          )}
        </div>
        <button className="step-next" onClick={next} type="button">{t.config.next}</button>
      </div>

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
            magnet={g3dMagnet}
            light="day"
            ao={false}
            sun={DEFAULT_SUN}
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
            onMovePlan={moveCabPlan}
            onBeginEdit={beginCabEdit}
            onMountY={(id, mountY) => {
              const idx = cabs.findIndex((c) => c.id === id);
              if (idx >= 0) patchCab(idx, { mountY });
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
            selectedId={sceneSelId}
            onSelectCab={pick}
            onMovePlan={moveCabPlan}
            onBeginEdit={beginCabEdit}
            onEditDim={onEditDim}
            onDragDim={onDragDim}
          />
        ) : (
          <ElevationGrid
            cabs={cabs}
            room={room}
            grid={grids[wall]}
            fittings={fittings}
            run={wall}
            ceiling={ceiling}
            mode={mode}
            selectedId={sceneSelId}
            onSelect={pick}
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

        {!sel && showHint && (
          <div className="plan-hint">{t.config.hint}</div>
        )}

        {/* bottom-left toggles: 3D/2D view + render style + multi-select */}
        <div className="scene-ctl cfg-toolset">
          <button className="round-ctl" onClick={() => toggleMenu("view")} type="button" aria-label={t.config.view}>
            <ViewIcon />
          </button>
          <button className="round-ctl" onClick={() => toggleMenu("mode")} type="button" aria-label={t.config.display}>
            <ModeIcon />
          </button>
        </div>

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
            {/* add a ROW — turn the dead wall above into another upper band (the "3rd row") */}
            {addRowJ >= 0 && (
              <>
                <span className="band-sep" aria-hidden />
                <button className="band-btn row" onClick={() => gridSetRowKind(sel.run ?? 0, addRowJ, "wall")} type="button" aria-label="Добавить ряд">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 8h14M5 16h14" /><path d="M12 3.5v3M10.5 5h3" /></svg>
                </button>
              </>
            )}
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
            <div className={`view-menu pop-anim${menuClosing ? " closing" : ""}`}>
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

      {/* bottom toolbar — furniture categories, or per-module actions when selected */}
      <div className={`toolbar${collapsed ? " collapsed" : ""}`}>
        <button
          className="toolbar-grip"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          aria-label={t.config.collapse}
          type="button"
        />
        {/* THE PLACE PANEL — five band chips (Нижние / Навесные / Антресоль / Пеналы / Свободно), shown
            only when NOTHING is selected (add mode). Tapping a chip arms that band and lights its wall
            cells; «Свободно» opens the free-standing picker. When a module IS selected the panel makes
            way for the swap strip below, which is already filtered to that module's row. */}
        {selIds.length === 0 && !sheet && (
          <div className="place-panel">
            <div className="place-chips">
              {PLACE_ROWS.map((row) => (
                <button
                  key={row.key}
                  className={`place-chip${row.key !== "extra" && placeRow === row.key ? " on" : ""}`}
                  onClick={() => (row.key === "extra" ? openSheet("extra") : pickPlaceRow(row.key))}
                  type="button"
                >
                  <AddThumb id={row.png} glyph={row.items[0]?.glyph ?? "▢"} />
                  <span className="place-chip-name">{row.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* QUICK SWAP — change the SELECTED module(s), filtered to ITS ROW: a base shows base cabinets +
            base appliances, a wall unit shows wall cabinets + hood, etc. Also how you turn the end
            cabinet into a CORNER (its band's «Угловой» leads the strip). */}
        {selIds.length >= 1 && swapItems.length > 0 && (
          <div className="swap-strip" aria-label={t.fe.replace}>
            {swapItems.map((tpl) => {
              const on = isCurrent(tpl);
              return (
                <button
                  key={tpl.id}
                  className={`swap-chip${on ? " on" : ""}`}
                  onClick={() => (multi ? swapSel(tpl) : swapTo(tpl))}
                  type="button"
                  aria-pressed={on}
                >
                  <AddThumb id={tpl.id} glyph={tpl.glyph} cab={tpl.cab} />
                  <span className="swap-name">{tpl.name}</span>
                </button>
              );
            })}
            <button
              key="__more__"
              className="swap-chip swap-more"
              onClick={() => openSheet("cabinets")}
              type="button"
            >
              <span className="swap-more-icon">⋯</span>
              <span className="swap-name">Ещё</span>
            </button>
          </div>
        )}
        {/* The hint text is gone (asked for), but its BOX stays. It fills the space the swap strip
            takes when a module IS selected, so the toolbar keeps one height across select/deselect —
            without it the 3D canvas resizes under your finger every time you pick something up. */}
        {selIds.length === 0 && !sheet && (
          <div className="place-hint ghost" aria-hidden>
            <span className="place-hint-txt">&nbsp;</span>
          </div>
        )}
      </div>

      {sheet && !(panelOpen && selIds.length === 0) && (
        <>
          {/* NON-modal edit panels (resize/style/cabinets) get NO backdrop — the 3D above stays live
              and the left buttons stay tappable. The catalog / full editor keep their dimming backdrop. */}
          {!panelOpen && <div className={`sheet-backdrop dim${sheetClosing ? " closing" : ""}`} onClick={closeSheet} />}
          <div className={`bottom-sheet${panelOpen ? " panel" : ""}${sheet === "pickCab" || sheet === "pickAppl" || sheet === "dining" || sheet === "extra" || sheet === "editor" || sheet === "style" || sheet === "cabinets" || sheet === "resize" ? " tall" : ""}${sheetClosing ? " closing" : ""}`}>
            {/* the edit panels are attached (non-modal) — no drag-grip; the catalog/editor keep theirs */}
            {!panelOpen && <div className="sheet-grip" />}

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
                <div className="cfg-sheet-body dim-panel">
                  {sel ? (
                    <>
                      {/* INTERNAL CLEARANCE READOUT */}
                      {(() => {
                        const boardT = sel.boardThickness ?? 16;
                        const intW = Math.max(0, sel.w - 2 * boardT);
                        const intH = Math.max(0, sel.h - 2 * boardT);
                        const curD = cabDepth(sel);
                        const isGroove = (sel.hasBack ?? true) && (sel.backMount ?? "groove") === "groove";
                        const setback = isGroove ? (sel.grooveSetback ?? 10) + 4 : 0;
                        const intD = Math.max(0, curD - setback);
                        return (
                          <div style={{ background: "rgba(0,169,97,0.08)", border: "1px solid rgba(0,169,97,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#1b4d3e" }}>
                            <strong>Чистый габарит:</strong> {intW} × {intH} × {intD} мм <span style={{ opacity: 0.75 }}>(ЛДСП {boardT} мм)</span>
                          </div>
                        );
                      })()}
                      <DimSlider icon={<GlyphW />} label="Ширина" value={sel.w} min={150} max={1200} step={50}
                        onBegin={beginCabEdit}
                        onLive={(v) => (sel.cell && sel.px == null ? gridSetCabW(sel.id, v, "right", true) : resizeCabLive(sel.id, v))}
                        onCommit={(v) => (sel.cell && sel.px == null ? gridSetCabW(sel.id, v, "right", false) : resizeCab(sel.id, v))} />
                      <DimSlider icon={<GlyphH />} label="Высота" value={sel.h} min={MIN_H} max={maxCabH(sel, ceiling)} step={10}
                        onBegin={beginCabEdit}
                        onLive={(v) => patchCabDims(sel.id, { h: v }, true)}
                        onCommit={(v) => patchCabDims(sel.id, { h: v })} />
                      <DimSlider icon={<GlyphD />} label="Глубина" value={cabDepth(sel)} min={D_MIN} max={D_MAX} step={10}
                        onBegin={beginCabEdit}
                        onLive={(v) => patchCabDims(sel.id, { depth: v }, true)}
                        onCommit={(v) => patchCabDims(sel.id, { depth: v })} />
                      <DimSlider icon={<GlyphShelf />} label="Полок" value={sel.count ?? 0} min={0} max={8} step={1} unit=""
                        onBegin={beginCabEdit}
                        onLive={(v) => patchCabLive(selIndex, { count: v })}
                        onCommit={(v) => patchCab(selIndex, { count: v })} />
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

                      {/* FULL INLINE CONSTRUCTION SETTINGS */}
                      <div style={{ borderTop: "1px solid #eee", marginTop: 14, paddingTop: 12, marginBottom: 8 }}>
                        <div className="cfg-field-lbl" style={{ fontWeight: 600, color: "#333", fontSize: 13 }}>Конструкция и фальш-панели:</div>
                        
                        {/* Board Thickness */}
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: "#666" }}>Толщина корпуса (ЛДСП):</span>
                          <div className="pillrow" style={{ marginTop: 4 }}>
                            <button className={`chip${(sel.boardThickness ?? 16) === 16 ? " sel" : ""}`} onClick={() => patchCab(selIndex, { boardThickness: 16 })} type="button">16 мм (Стандарт)</button>
                            <button className={`chip${(sel.boardThickness ?? 16) === 18 ? " sel" : ""}`} onClick={() => patchCab(selIndex, { boardThickness: 18 })} type="button">18 мм (Усиленный)</button>
                          </div>
                        </div>

                        {/* Back Panel Mounting */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: "#666" }}>Задняя стенка (ХДФ):</span>
                          <div className="pillrow" style={{ marginTop: 4 }}>
                            <button className={`chip${(sel.hasBack ?? true) && (sel.backMount ?? "groove") === "groove" ? " sel" : ""}`} onClick={() => patchCab(selIndex, { hasBack: true, backMount: "groove" })} type="button">В паз (4×8 мм)</button>
                            <button className={`chip${(sel.hasBack ?? true) && sel.backMount === "overlay" ? " sel" : ""}`} onClick={() => patchCab(selIndex, { hasBack: true, backMount: "overlay" })} type="button">Внахлёст (16 мм)</button>
                            <button className={`chip${sel.hasBack === false || sel.backMount === "none" ? " sel" : ""}`} onClick={() => patchCab(selIndex, { hasBack: false, backMount: "none" })} type="button">Без задника</button>
                          </div>
                        </div>

                        {/* Scribe / Filler Panels */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: "#666" }}>Доборные фальш-панели (мм):</span>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
                            <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                              Слева:
                              <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={sel.fillerLeft ?? 0} onChange={(e) => patchCab(selIndex, { fillerLeft: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                            </label>
                            <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                              Справа:
                              <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={sel.fillerRight ?? 0} onChange={(e) => patchCab(selIndex, { fillerRight: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                            </label>
                            <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                              Сверху:
                              <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={sel.fillerTop ?? 0} onChange={(e) => patchCab(selIndex, { fillerTop: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                            </label>
                          </div>
                        </div>
                      </div>
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
                { id: "carcass", name: "Корпус", icon: <StyleCarcass /> },
              ];
              const activeId = TABS.some((tb) => tb.id === stylePart) ? stylePart : "front";
              const key = PART_FINISH[activeId] as FinishKey;
              const mats = EMAN_MATERIALS.filter((m) => m.part === key);
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
                  </div>
                </>
              );
            })()}

            {/* ── ШКАФЫ ── Наполнение / Сохранить on top, a type filter, and the cabinet grid. Tapping
                a type swaps the whole selection to it. */}
            {sheet === "cabinets" && selIds.length >= 1 && (() => {
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
    </div>
  );
}
