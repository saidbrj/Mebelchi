// @mebelchi/pricing — pure pricing over the shared schema.
//   modulesToParts(project) → engine Part[]        (the "list of parts" the engine consumes)
//   buildBom(project)       → RawBomLine[]          (normalised BOM, no rates)
//   priceProject(project, rates) → Quote            (grouped, rounded, live-ticker ready)
// All pure: no network, no UI, deterministic.

export { buildBom } from "./buildBom.js";
export { priceProject } from "./priceProject.js";
export { modulesToParts, modulePanels, carcassPanels, panelAreaM2, panelThicknessMm, moduleInterior, cutFronts, shelfCount, drawerCount, hasFacade } from "./parts.js";
export type { DerivedPanel, PanelRole } from "./parts.js";
export {
  groupCarcasses,
  canShareCarcass,
  carcassWidth,
  carcassKind,
  hangingCount,
  resolveProduction,
  DEFAULT_PRODUCTION,
} from "./carcass.js";
export type { Carcass } from "./carcass.js";
export { deriveLayout, walkInterior, cellSizes, isLeaf, evenFractions, defaultHandlePos } from "./cells.js";
export type { InteriorSpec, FrontSpec, LegacyInterior } from "./cells.js";
export {
  frontOf,
  isGlass,
  isMilled,
  mullionsFor,
  innerRect,
  millContourMm,
  fluteAreaMm2,
  glassRect,
  mullionBar,
  FRAME_MM,
  MULLION_MM,
  FLUTE_PITCH_MM,
} from "./fronts.js";
export { seedRateTable } from "./seedRateTable.js";
export {
  DEFAULT_HARDWARE_SKUS,
  KIND_TO_GROUP,
  hingesForDoorHeight,
  carcassJoints,
  CARCASS_THICKNESS_MM,
} from "./constants.js";
