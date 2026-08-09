// ХОВ ЭТОТ ЦЕХ СТРОИТ КОРПУС — the shop's construction standard, set ONCE in Настройки and
// inherited by every cabinet of every project.
//
// WHY THIS EXISTS. Board thickness, back-panel method, bottom fit, carcass top, plinth and
// handleless-vs-handles are not design decisions — a shop that builds with 16мм ЛДСП, задняя
// в паз, накладное дно and a 120мм цокольная коробка builds that way on every cabinet for
// years. They were being asked PER CABINET, mid-design, which is most of the reason the module
// editor had ~60 controls in it. Here they are answered once.
//
// HOW IT WORKS — the same shape as the seller's price list (settings.rates over the seed
// table): the cabinet stores only what DIFFERS. `cab.boardThickness === undefined` means "use
// the shop standard", so changing the standard retroactively updates every cabinet that never
// overrode it. `constructionOf(cab)` resolves the two into the effective values that the 3D,
// the drawings and the cut list all read.
//
// This replaces a scatter of `cab.x ?? <literal>` fallbacks across six files — which had
// already drifted: the "чистый габарит" readout computed the HDF groove at 10мм while the 3D
// drew it at 12мм, so the internal depth shown to the seller was 2мм off what got built.

import type { BackPanelMethod, Cabinet } from "./cabinet";

/** Every construction property a cabinet inherits from the shop rather than being asked about. */
export interface ShopConstruction {
  /** Carcass board thickness (мм). 16 is the market standard; 18 is the "усиленный" build. */
  boardThickness: 16 | 18;
  /** Facade blank thickness (мм). */
  facadeThickness: 18 | 19 | 22;
  /** How the back panel is fitted: in a groove, overlaid on the rear edges, or absent. */
  backMount: BackPanelMethod;
  /** Distance from the rear edge to the HDF groove (мм). Only meaningful when backMount === "groove". */
  grooveSetback: number;
  /** Bottom board fit: `nakladnoe` (full width, sides sit on it) or `vkladnoe` (inset between sides). */
  bottomMode: "nakladnoe" | "vkladnoe";
  /** Carcass top: a `full` lid, two `stretchers` (царги), or `none`. */
  topMode: "full" | "stretchers" | "none";
  /** Base support: `box` plinth (цокольная коробка), `sides` to the floor, or `legs`. */
  plinthMode: "box" | "sides" | "legs";
  /** Handleless (GOLA aluminium profile) instead of handles, shop-wide. */
  gola: boolean;
}

/** The market-standard build, and what every existing project silently used before this module:
 *  16мм ЛДСП · задняя в паз 12мм · накладное дно · сплошная крышка · цоколь-коробка · с ручками.
 *  Changing any of these changes what an UNCONFIGURED shop builds, so they are the old hardcoded
 *  fallbacks exactly — no project's geometry moves on upgrade. */
export const SHOP_CONSTRUCTION_DEFAULTS: ShopConstruction = {
  boardThickness: 16,
  facadeThickness: 18,
  backMount: "groove",
  grooveSetback: 12,
  bottomMode: "nakladnoe",
  topMode: "full",
  plinthMode: "box",
  gola: false,
};

// The live standard. Held in a module variable rather than passed as an argument because the
// consumers are deep in the 3D builder (three/kitchen3d.ts walks every cabinet, every frame it
// rebuilds) and threading settings through them would touch every signature for a value that is
// global and changes about once a year. model/settings.ts pushes it here on load and on save —
// the same one-way arrangement model/catalog.ts uses for the material list.
let current: ShopConstruction = { ...SHOP_CONSTRUCTION_DEFAULTS };

/** Replace the live shop standard. Called by model/settings.ts; nothing else should. */
export function setShopConstruction(c: Partial<ShopConstruction> | undefined): void {
  current = { ...SHOP_CONSTRUCTION_DEFAULTS, ...(c ?? {}) };
}

/** The shop's standing construction rule. */
export function shopConstruction(): ShopConstruction {
  return current;
}

/** `hasBack` was a separate boolean before `backMount` gained its "none" case, and old saved
 *  projects still carry it. It wins only when it says false and backMount is silent. */
function backMountOf(cab: Cabinet, shop: ShopConstruction): BackPanelMethod {
  if (cab.backMount) return cab.backMount;
  if (cab.hasBack === false) return "none";
  return shop.backMount;
}

/** The EFFECTIVE construction for one cabinet: its own overrides laid over the shop standard.
 *  This is what the 3D, the drawings, the cut list and the clearance readout must all read —
 *  reading `cab.boardThickness` directly gets you `undefined` for the 95% of cabinets that
 *  simply follow the shop. */
export function constructionOf(cab: Cabinet, shop: ShopConstruction = current): ShopConstruction {
  return {
    boardThickness: cab.boardThickness ?? shop.boardThickness,
    facadeThickness: cab.facadeThickness ?? shop.facadeThickness,
    backMount: backMountOf(cab, shop),
    grooveSetback: cab.grooveSetback ?? shop.grooveSetback,
    bottomMode: cab.bottomMode ?? shop.bottomMode,
    topMode: cab.topMode ?? shop.topMode,
    plinthMode: cab.plinthMode ?? shop.plinthMode,
    gola: cab.gola != null ? true : shop.gola,
  };
}

/** Does this cabinet have a back panel at all? Derived — never store the two independently. */
export const hasBackOf = (cab: Cabinet, shop: ShopConstruction = current): boolean =>
  backMountOf(cab, shop) !== "none";

/** How far the inside of the box is set back from the rear edge (мм): the groove offset plus the
 *  4мм groove itself. 0 when the back is overlaid or absent. Drives the «чистый габарит» readout. */
export function backSetbackOf(cab: Cabinet, shop: ShopConstruction = current): number {
  const c = constructionOf(cab, shop);
  return c.backMount === "groove" ? c.grooveSetback + 4 : 0;
}

/** Which properties this cabinet answers differently from the shop standard. Empty = it simply
 *  follows the shop, which is what the editor shows as «стандарт цеха» instead of eight controls. */
export function overridesOf(cab: Cabinet, shop: ShopConstruction = current): (keyof ShopConstruction)[] {
  const eff = constructionOf(cab, shop);
  return (Object.keys(SHOP_CONSTRUCTION_DEFAULTS) as (keyof ShopConstruction)[]).filter(
    (k) => eff[k] !== shop[k],
  );
}

/** The patch that puts a cabinet back on the shop standard: clear every override. Undefined is
 *  the "inherit" value, so this is a delete, not a copy of today's standard — the cabinet must
 *  keep following the shop if the shop later changes its mind. */
export function resetToShop(): Partial<Cabinet> {
  return {
    boardThickness: undefined,
    facadeThickness: undefined,
    backMount: undefined,
    hasBack: undefined,
    grooveSetback: undefined,
    bottomMode: undefined,
    topMode: undefined,
    plinthMode: undefined,
    gola: undefined,
  };
}

/** Write a back-panel choice onto a cabinet. Sets BOTH fields: `hasBack` is legacy but still read
 *  by saved projects and by older code paths, and letting the two disagree is how a cabinet ends
 *  up drawn with a back and billed without one. Passing the shop's own value clears the override. */
export function backMountPatch(m: BackPanelMethod, shop: ShopConstruction = current): Partial<Cabinet> {
  if (m === shop.backMount) return { backMount: undefined, hasBack: undefined };
  return { backMount: m, hasBack: m !== "none" };
}
