/**
 * Mebelchi UI v1 — type definitions
 *
 * Drop this into /src/types/ui.ts or merge into /src/types.ts
 * These are the canonical UI types. The rest of the app (export engine, drilling, etc.)
 * has its own types — keep them separate.
 *
 * Version: 1.0
 * Owner: Oppoq
 * Companion to: 10_UI_PRINCIPLES.md, HANDOVER_UI_V1.md
 */

// ============================================================
// MATERIALS
// ============================================================

export type MaterialId =
  | 'white_classic'
  | 'cashmere'
  | 'oak_light'
  | 'graphite'
  | 'walnut'
  | 'anthracite';

export interface Material {
  id: MaterialId;
  name: string;          // Russian display name, e.g. "Белая классика"
  facade: number;        // hex color, e.g. 0xf6f3ea
  top: number;           // hex color for default worktop pairing
  isDark: boolean;       // affects price multiplier and label contrast
}

// ============================================================
// CABINETS
// ============================================================

export type CabinetType =
  | 'base'         // plain base cabinet, 1 or 2 doors based on width
  | 'drawer3'      // 3-drawer stack
  | 'drawer4'      // 4-drawer stack
  | 'sink'         // sink cabinet (basin + faucet on top)
  | 'stove'        // stove cabinet (cooktop on top)
  | 'sink_stove'   // combo: half sink, half stove on one wide cabinet
  | 'tall'         // floor-to-upper-ceiling pantry column
  | 'fridge';      // tall column with fridge door split

export type DoorStyle = 'flat' | 'shaker' | 'grooved';
export type HandleType = 'bar' | 'knob' | 'inset';
export type SinkType = 'single' | 'double' | 'none';
export type StoveType = 'induction' | 'gas' | 'none';

export interface Cabinet {
  id: string;            // e.g. "c0_2" — variant index + position
  type: CabinetType;
  width: number;         // in METERS, not mm. Keep three.js units consistent.
}

// ============================================================
// VARIANTS
// ============================================================

export interface Variant {
  name: string;          // Russian name, e.g. "С пеналом"
  cabinets: Cabinet[];
  hasUppers: boolean;    // whether upper cabinets render above base row
  hasSideShelves: boolean; // perpendicular wall with floating shelves
}

// ============================================================
// VIEW MODE
// ============================================================

export type ViewMode = '3d' | '2d';

// ============================================================
// UI STORE (Zustand)
// ============================================================

export interface UIStore {
  // ---- Wall + variant state ----
  wallLengthMm: number;
  variantIdx: number;
  variants: Variant[];

  // ---- Global selections (apply to whole kitchen unless overridden) ----
  globalMaterial: MaterialId;
  globalDoorStyle: DoorStyle;
  sinkType: SinkType;
  stoveType: StoveType;
  worktopOverride: number | null;   // hex color override; null = use material default

  // ---- Per-cabinet overrides (keyed by cabinet id) ----
  cabinetMaterial: Record<string, MaterialId>;
  cabinetDoorStyle: Record<string, DoorStyle>;
  cabinetHandle: Record<string, HandleType>;

  // ---- Selection + view ----
  selectedCabinetId: string | null;
  viewMode: ViewMode;

  // ---- Setup flag ----
  hasCompletedSetup: boolean;
  shopName: string;
  defaultSupplier: 'imkon' | 'egger_uz' | 'kronospan_uz';
  defaultThickness: 10 | 16 | 18;
  defaultHardware: 'blum' | 'hettich' | 'boyard';
  language: 'ru' | 'uz';

  // ---- Mock project state (for home screen + lock screen) ----
  currentProjectId: string | null;
  recentProjects: ProjectSummary[];

  // ---- Actions ----
  setWallLength: (mm: number) => void;
  cycleWallLength: () => void;
  setVariant: (idx: number) => void;
  cycleVariant: (direction: 1 | -1) => void;
  regenerateVariants: () => void;

  setGlobalMaterial: (m: MaterialId) => void;
  setCabinetMaterial: (cabId: string, m: MaterialId) => void;

  cycleDoorStyle: (cabId: string) => void;
  cycleHandle: (cabId: string) => void;
  cycleSink: () => void;
  cycleStove: () => void;
  cycleWorktop: () => void;

  selectCabinet: (id: string | null) => void;
  resizeCabinet: (cabId: string, deltaMm: number) => void;
  setViewMode: (m: ViewMode) => void;

  completeSetup: (config: SetupConfig) => void;
  createNewProject: () => string;   // returns new project id
  setLanguage: (lang: 'ru' | 'uz') => void;
}

export interface SetupConfig {
  shopName: string;
  defaultSupplier: 'imkon' | 'egger_uz' | 'kronospan_uz';
  defaultThickness: 10 | 16 | 18;
  defaultHardware: 'blum' | 'hettich' | 'boyard';
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;     // ms epoch
  wallLengthMm: number;
  priceSum: number;      // in soum
  thumbnailColor: MaterialId; // for the mock thumbnail tint
}

// ============================================================
// THREE.JS USERDATA (tagged on every interactive mesh)
// ============================================================

export type MeshKind =
  | 'cabinet_body'
  | 'cabinet_door'
  | 'cabinet_handle'
  | 'plinth'
  | 'worktop'
  | 'sink'
  | 'stove'
  | 'shelf'
  | 'highlight'
  | 'floor'
  | 'wall';

export interface MeshUserData {
  type: MeshKind;
  cabId?: string;        // only set for cabinet-related meshes
  upper?: boolean;       // true if this is an upper cabinet mesh
  isDrawer?: boolean;    // for cabinet_door, true if this is a drawer face
  doorIdx?: number;      // for multi-door cabinets, which door (0 or 1)
  shelfIdx?: number;     // for shelf meshes
}

// ============================================================
// CAMERA RIG
// ============================================================

export interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  duration: number;      // ms
}

export const OVERVIEW_TARGET: CameraTarget = {
  position: [2.1, 1.55, 3.05],
  lookAt: [0, 0.65, -0.2],
  fov: 34,
  duration: 480,
};

export const PLAN_TARGET: CameraTarget = {
  position: [0.01, 4.2, 0.6],
  lookAt: [0, 0, 0.6],
  fov: 32,
  duration: 540,
};

/**
 * Compute camera target for a selected cabinet.
 * Implements the NFS framing rule from 10_UI_PRINCIPLES.md §5.
 */
export function computeCabinetCameraTarget(
  cabinetWorldPos: [number, number, number],
  cabinetWidth: number,
): CameraTarget {
  const [cx, cy, cz] = cabinetWorldPos;
  const sideOffset = cx >= 0 ? 0.45 : -0.45;
  return {
    position: [
      cx * 0.5 + sideOffset,
      cy + 0.4,
      cz + 1.35 + cabinetWidth * 0.4,
    ],
    lookAt: [cx, cy + 0.04, cz],
    fov: 34,
    duration: 480,
  };
}

// ============================================================
// CONSTANTS — geometry
// ============================================================

export const GEOMETRY = {
  CABINET_HEIGHT: 0.82,
  CABINET_DEPTH: 0.56,
  PLINTH_HEIGHT: 0.10,
  UPPER_HEIGHT: 0.70,
  UPPER_DEPTH: 0.32,
  UPPER_Y_OFFSET: 1.45,
  WORKTOP_THICKNESS: 0.038,
  TALL_HEIGHT: 2.0,
} as const;

// ============================================================
// CONSTANTS — wall sizes
// ============================================================

export const WALL_SIZES_MM = [1200, 1500, 1800, 2100, 2400, 2700, 3000] as const;
export type WallSize = typeof WALL_SIZES_MM[number];

// ============================================================
// CONSTANTS — interaction
// ============================================================

export const INTERACTION = {
  SWIPE_THRESHOLD_PX: 50,
  SWIPE_AXIS_RATIO: 1.4,        // dx must exceed dy by this factor
  TAP_MAX_DURATION_MS: 500,     // beyond this is a hold / drag
  RESIZE_STEP_MM: 50,
  RESIZE_MIN_MM: 300,
  RESIZE_MAX_MM: 1200,
  HAPTIC_TAP: 'selectionAsync',     // expo-haptics
  HAPTIC_SWATCH: 'impactLight',     // expo-haptics
  HAPTIC_LOCK: 'notificationSuccess', // expo-haptics
} as const;

// ============================================================
// CONSTANTS — animation durations
// ============================================================

export const ANIM = {
  CAMERA_TWEEN_SELECT: 480,
  CAMERA_TWEEN_DESELECT: 480,
  CAMERA_TWEEN_VIEW_CHANGE: 540,
  SELECTION_PILL_RISE: 280,
  DRAWER_SLIDE: 320,
  TOAST_VISIBLE: 1400,
  MATERIAL_REPAINT_BUDGET: 100,
  WIDTH_REBUILD_BUDGET: 300,
  VARIANT_REBUILD_BUDGET: 400,
  WALL_REGEN_BUDGET: 500,
} as const;

// ============================================================
// CONSTANTS — design tokens
// ============================================================

export const COLORS = {
  bg: '#e8e3d7',
  bgSoft: '#f0ebde',
  bgCard: '#ffffff',
  bgCardTint: 'rgba(255, 255, 255, 0.88)',
  ink: '#1c1c1a',
  inkSoft: '#4a4a48',
  inkMuted: '#7a7972',
  inkFaint: '#aaa8a0',
  line: 'rgba(28, 28, 26, 0.08)',
  lineSoft: 'rgba(28, 28, 26, 0.05)',
  warn: '#b85b1d',
  warnBg: 'rgba(184, 91, 29, 0.08)',
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const SHADOWS = {
  // RN shadow API uses elevation on Android + shadowColor/Offset/Opacity/Radius on iOS
  sm: { elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  md: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  lg: { elevation: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 8 } },
} as const;

// ============================================================
// HELPER: mesh tagging
// ============================================================

/** Use this when creating any interactive three.js mesh. */
export function tagMesh(userData: MeshUserData): MeshUserData {
  return userData;
}

// ============================================================
// HELPER: cabinet label
// ============================================================

export function cabinetLabel(type: CabinetType, lang: 'ru' | 'uz' = 'ru'): string {
  const labels: Record<CabinetType, { ru: string; uz: string }> = {
    base:       { ru: 'ШКАФ',              uz: 'SHKAF' },
    drawer3:    { ru: 'ЯЩИКИ × 3',         uz: 'YASHIKLAR × 3' },
    drawer4:    { ru: 'ЯЩИКИ × 4',         uz: 'YASHIKLAR × 4' },
    sink:       { ru: 'МОЙКА',             uz: 'MOYKA' },
    stove:      { ru: 'ВАРОЧНАЯ',          uz: 'PLITA' },
    sink_stove: { ru: 'МОЙКА + ВАРОЧНАЯ',  uz: 'MOYKA + PLITA' },
    tall:       { ru: 'ПЕНАЛ',             uz: 'PENAL' },
    fridge:     { ru: 'ХОЛОДИЛЬНИК',       uz: 'MUZLATGICH' },
  };
  return labels[type][lang];
}
