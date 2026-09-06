// Adapter: app state → @mebelchi/schema Project, so priceProject can run on the
// live model. Pure. The visual swatch (state.mat) does not change rate-table refs
// in this MVP — every project is priced against the seed LDSP/MDF/worktop/edge
// entries; that's where a real material→SKU mapping will later plug in.

import { priceProject, seedRateTable, groupCarcasses, DEFAULT_PRODUCTION } from "@mebelchi/pricing";
import type { Project, Module, MaterialSelection, ProductionOpts, Quote, QuoteGroup, RateTable, FlatPanel, ProjectLighting, WorktopCut } from "@mebelchi/schema";
import type { AppState } from "../store";
import { cabinetInterior, frontOf, type Cabinet, type Cell } from "./cabinet";
import { cabDepth } from "./resolve";
import { isFloating } from "./bands";
import { productionFrom } from "./settings";
import { hardeningPresets } from "./reinforce";
import { resolveLayout, type ResolvedLayout } from "./resolve";
import { effectiveStyle } from "./layout";
import { catalogByColorAny } from "./catalog";
import { wallPanels, panelW, panelH, type PanelBand } from "./wallPanels";
import { ledStrips, ledMetres, psuCount } from "./ledStrips";
import { worktopCuts } from "./sink";

/** Which stock a derived band is cut from. The фартук follows its decor: «как столешница» really is
 *  the counter slab, so it bills like one; a facade/carcass decor is sheet goods. A closer is always
 *  the fronts' board. */
function stockOf(b: PanelBand, decor: string): FlatPanel["stock"] {
  if (b.kind === "closer") return "facade";
  return decor === "carcass" ? "carcass" : decor === "worktop" ? "worktop" : "facade";
}

/** What deriving the wall panels actually needs. Spelled out rather than taking `AppState`, so the
 *  ticker's hook can assemble one from the slices it subscribes to (and so this stays testable).
 *  `AppState` satisfies it structurally, which is why `toProject(s)` can still just pass `s`. */
export interface PanelInput {
  cabs: Cabinet[];
  roomPoints: AppState["roomPoints"];
  waterWall: AppState["waterWall"];
  runLayout: AppState["runLayout"];
  openings: AppState["openings"];
  reveal: number;
  ceiling: number;
  fittings: AppState["fittings"];
  splash: AppState["splash"];
  closer: AppState["closer"];
  underside: AppState["underside"];
  led: AppState["led"];
  runStyle: AppState["runStyle"];
}

/** THE DERIVED BANDS, plus the layout they were measured against.
 *
 *  Separate from `panelsFor` because two very different consumers need this: the quote wants the
 *  priceable flat panels, while the PDF elevation wants the geometry — and the drawing measures
 *  from the RUN's zero, so it also needs the layout to convert. Deriving twice would be two answers
 *  to one question. */
export function bandsFor(s: PanelInput): { L: ResolvedLayout; bands: PanelBand[] } | null {
  const cabs = s.cabs.filter((c) => !c.furniture);
  if (!cabs.length) return null;
  const L = resolveLayout(cabs, {
    points: s.roomPoints,
    waterWall: s.waterWall,
    layout: s.runLayout,
    openings: s.openings,
    reveal: s.reveal,
  });
  const bands = wallPanels({
    L,
    ceiling: s.ceiling,
    specs: { splash: s.splash, closer: s.closer, underside: s.underside },
    style: effectiveStyle(cabs, s.runStyle),
    openings: s.openings,
    fittings: s.fittings,
  });
  return { L, bands };
}

/**
 * THE LIGHT BUILT INTO THE CABINETRY, measured.
 *
 * The engine prices metres and counts; it has no idea where a cabinet is, and the layout is exactly
 * what decides how much strip there is. So the measuring happens here — the same split `panelsFor`
 * makes for the flat panels.
 *
 * The PROFILE is the same length as the strip: it is the channel the strip sits in, not an extra.
 * One SENSOR per lit run, when they were asked for — that is what a sensor switches.
 */
export function lightingFor(s: PanelInput): ProjectLighting | undefined {
  const derived = bandsFor(s);
  if (!derived) return undefined;
  const strips = ledStrips(derived.L, s.led);
  if (!strips.length) return undefined;
  const metres = ledMetres(strips);
  return {
    metres: round(metres),
    profileM: round(metres),
    psu: psuCount(metres),
    sensors: s.led.sensor ? new Set(strips.map((x) => x.run)).size : 0,
  };
}

const round = (m: number) => Math.round(m * 100) / 100;

/** The derived wall panels, as the priceable flat panels the BOM charges for. */
export function panelsFor(s: PanelInput): FlatPanel[] {
  const derived = bandsFor(s);
  if (!derived) return [];
  return derived.bands
    // the underside plane is a DRAWING of the bottom boards the modules already bill, not another
    // panel — pricing it here would charge the row's bottom twice
    .filter((b): b is PanelBand & { kind: "splash" | "closer" } => b.kind !== "underside")
    .map((b, i) => ({
    id: `panel-${b.kind}-${i}`,
    kind: b.kind,
    w: Math.round(panelW(b)),
    h: Math.round(panelH(b)),
    t: b.t,
    stock: stockOf(b, s.splash.decor),
    decor: catalogByColorAny(b.color)?.name,
    wall: b.run + 1,
    cutouts: b.cuts.length
      ? b.cuts.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), label: c.label }))
      : undefined,
  }));
}

const HANDLE_TYPE = ["bar", "profile", "knob", "none"] as const;

const CONSTRAINT_MAP: Record<string, "gas" | "riser" | "sockets" | "window" | "radiator"> = {
  "Газовая труба": "gas",
  Сток: "riser",
  Розетки: "sockets",
  Окно: "window",
  Радиатор: "radiator",
};

/** Derive the rate-table material refs from the seed (robust to UUID changes). */
function pickMaterials(): MaterialSelection {
  const matEntries = Object.entries(seedRateTable.materials);
  const byType = (t: string) => matEntries.find(([, m]) => m.type === t)?.[0];
  const carcassId = byType("LDSP") ?? matEntries[0][0];
  const facadeId = byType("MDF") ?? carcassId;
  const glassId = byType("GLASS"); // a витрина's pane; absent → falls back to the facade material
  const worktopId = Object.keys(seedRateTable.worktop)[0];
  const edges = Object.entries(seedRateTable.edge)
    .sort((a, b) => b[1].pricePerM - a[1].pricePerM)
    .map(([id]) => id);
  return {
    carcassId,
    facadeId,
    glassId,
    worktopId,
    edgeVisibleId: edges[0],
    edgeHiddenId: edges[1] ?? edges[0],
  };
}

/**
 * Order a run the way the SHOP builds it, so a merged box's members come out adjacent and
 * left-to-right.
 *
 * The store's `cabs` is in INSERTION order — add an upper, then a base, then another upper and the
 * two uppers are not neighbours in the array even though they are neighbours on the wall. Pricing
 * groups a carcass from a contiguous span (and hands the outer sides to the first and last member),
 * so it has to be handed the members together and in wall order, or it would split the box in half
 * and put an outer side in the middle of it.
 *
 * Everything ungrouped keeps its place; each group is pulled together at its first member's
 * position, sorted by position along the wall.
 */
function inBuildOrder(cabs: Cabinet[]): Cabinet[] {
  if (!cabs.some((c) => c.carcassGroup)) return cabs; // the common case — don't touch the array
  const out: Cabinet[] = [];
  const placed = new Set<string>();
  for (const c of cabs) {
    if (placed.has(c.id)) continue;
    if (!c.carcassGroup) {
      out.push(c);
      placed.add(c.id);
      continue;
    }
    const members = cabs
      .filter((m) => m.carcassGroup === c.carcassGroup)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    for (const m of members) {
      out.push(m);
      placed.add(m.id);
    }
  }
  return out;
}

/** A two-leaf corner's interior, for pricing.
 *
 *  The 3D builds an L corner's doors itself (three/kitchen3d), so nothing about the cell tree
 *  reaches that geometry. But the QUOTE reads the tree — `cutFronts` counts leaves and
 *  `hingeCount` hinges off it — and a corner with two doors on it really is two doors and two sets
 *  of hinges. Without this the pair would be drawn and billed as one leaf.
 *
 *  Split down the middle: the two arms of an L corner are the same length by construction. */
function cornerPairLayout(c: Cabinet, kitchen: "single" | "pair" = "single"): Cell | null {
  if (!c.corner || (c.cornerDoors ?? kitchen) !== "pair" || (c.cornerShape ?? "l") !== "l") return null;
  // each arm is its own door leaf — that is the whole difference from the single L-shaped one
  return {
    split: "cols",
    children: [
      { front: "door", opening: "left" },
      { front: "door", opening: "right" },
    ],
  };
}

export function cabToModule(c: Cabinet, cornerDoors: "single" | "pair" = "single"): Module {
  return {
    id: c.id,
    kind: c.kind,
    w: c.w,
    h: c.h,
    // canonical depth — this used to ignore `c.depth`, so a 400mm-deep base was PRICED and
    // CUT as 560 (the plan + 3D honoured the override, pricing didn't)
    d: cabDepth(c),
    // WHAT CARRIES IT. A base lifted off the floor hangs on навесы like a wall unit does, and the
    // quote has to buy them — see model/bands.ts `isFloating`.
    ...(isFloating(c) ? { hung: true } : {}),
    // per-role panel overrides travel to the engine, so the cut list orders the shallow shelf the
    // 3D draws (packages/pricing parts.ts `panelDepth`)
    ...(c.panels && Object.keys(c.panels).length ? { panels: c.panels } : {}),
    fill: c.fill,
    count: c.count,
    dividers: c.div,
    // THE FRONT'S BODY — flat / shaker / raised / fluted / glass / grid / none. `frontOf` falls back
    // to the legacy `door` index, so a project saved before profiles existed prices exactly as before.
    door: { style: frontOf(c) },
    handle: { type: HANDLE_TYPE[c.handle] ?? "bar" },
    // THE interior. Always resolved — the custom tree when the user has drawn one, the derived
    // tree otherwise — so pricing sees the same interior every view draws. Without this, a cabinet
    // edited in the Fill Editor was priced and cut from its STALE pre-edit `fill`/`count` (the
    // editor only ever patches `layout`).
    layout: cornerPairLayout(c, cornerDoors) ?? cabinetInterior(c),
    combinedDoors: c.combinedDoors,
    // SHARED CARCASS — modules carrying the same tag are built (and priced) as one box. Without
    // this line the merge toggle would change the 3D and nothing else: the quote, the cut list and
    // the hanger count would all still bill four separate cabinets.
    carcassGroup: c.carcassGroup,
    // the box's hanger override. Pricing only needs the COUNT (hangingCount reads it off the box's
    // first module); the POSITIONS stay app-side, for the fitter and, later, the drilling file.
    hangings: c.hangPos?.length,
  };
}

/** Shared Project skeleton — pricing reads only `run` + `materials` + `production`, so a neutral
 *  space is fine when we just need a quote (e.g. previewing a variant's cabs). */
function makeProject(
  run: Module[],
  space: Project["space"],
  prod: ProductionOpts = DEFAULT_PRODUCTION,
  panels: FlatPanel[] = [],
  lighting?: ProjectLighting,
  cuts: WorktopCut[] = [],
): Project {
  const now = new Date().toISOString();
  return {
    id: "local-project",
    name: "Mebely kitchen",
    ownerId: "local",
    units: "mm",
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    space,
    run,
    ...(panels.length ? { panels } : {}),
    ...(lighting ? { lighting } : {}),
    ...(cuts.length ? { worktopCuts: cuts } : {}),
    materials: pickMaterials(),
    // HOW THIS SHOP BUILDS A BOX (hangers per carcass, hanger span). Travels on the project, so a
    // quote reprices under the conventions it was quoted with.
    production: prod,
    pricing: { rateTableId: seedRateTable.id, snapshotAt: now },
  };
}

export function toProject(s: AppState): Project {
  // free-standing furniture (tables/chairs) isn't a cabinet — keep it out of the BOM
  const cabs = inBuildOrder(s.cabs.filter((c) => !c.furniture));
  // УСИЛЕНИЕ IS COMPUTED, NOT ASKED (model/reinforce.ts).
  //
  // It used to be a global toggle that tagged ONE arbitrary module with one preset — a stub. A shop
  // does not reinforce a kitchen, it reinforces a SHELF, and only because the shelf is too wide to
  // carry a load. That is a fact about the span, so every shelf that needs it gets it and nothing
  // else does. `s.hardened` is no longer read; old projects still carry the field harmlessly.
  const cornerDoors = s.runStyle.cornerDoors ?? "single";
  const run = cabs.map((c) => {
    const hardening = hardeningPresets(c);
    const m = cabToModule(c, cornerDoors);
    return hardening ? { ...m, hardening } : m;
  });
  return makeProject(
    run,
    {
      source: "manual",
      shape: s.shape,
      wallLength: s.wallLen,
      ceilingHeight: s.ceiling,
      waterWall: s.water,
      constraints: s.constraints
        .map((c) => CONSTRAINT_MAP[c])
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    },
    productionFrom(s.settings),
    panelsFor(s),
    lightingFor(s),
    worktopCuts(cabs),
  );
}

/** A priceable Project from a bare cabinet run (no room state) — used to quote the
 *  generated Phase-B variants before one is committed to the editable run. */
export function projectFromCabs(
  cabs: Cabinet[],
  prod: ProductionOpts = DEFAULT_PRODUCTION,
  panels: FlatPanel[] = [],
  lighting?: ProjectLighting,
): Project {
  const real = inBuildOrder(cabs.filter((c) => !c.furniture));
  return makeProject(
    real.map((c) => cabToModule(c)),
    { source: "manual", shape: "i", wallLength: 0, ceilingHeight: 2700, waterWall: "none", constraints: [] },
    prod,
    panels,
    lighting,
    // DERIVED FROM THE CABS, not passed in: a sink's opening is a fact about the sink, so every
    // caller that prices a run gets it without having to remember to ask for it.
    worktopCuts(real),
  );
}

/** Total price of a cabinet run against the seller's rate table (falls back to the seed
 *  when none is passed — e.g. non-reactive callers). Returns USD (the base currency). */
export function priceCabs(
  cabs: Cabinet[],
  rates: RateTable = seedRateTable,
  prod: ProductionOpts = DEFAULT_PRODUCTION,
  panels: FlatPanel[] = [],
  lighting?: ProjectLighting,
): number {
  return cabs.length ? priceProject(projectFromCabs(cabs, prod, panels, lighting), rates).total : 0;
}

/** Total facade (front) area of the cabinetry in m² — width×height of every module,
 *  excluding free-standing furniture. Drives the per-m² "overall work" price. */
export function facadeAreaM2(cabs: Cabinet[]): number {
  return cabs.filter((c) => !c.furniture).reduce((sum, c) => sum + (c.w / 1000) * (c.h / 1000), 0);
}

/** The per-m² "overall work" price (USD base): total facade area × the seller's rate. */
export function sqmPrice(cabs: Cabinet[], sqmRate: number): number {
  return facadeAreaM2(cabs) * sqmRate;
}

/** Russian labels for the quote groups (the Смета breakdown). */
export const GROUP_LABEL: Record<QuoteGroup, string> = {
  carcassFacade: "Корпус и фасады",
  worktopEdge: "Столешница и кромка",
  hardware: "Фурнитура",
  cnc: "ЧПУ и обработка",
  delivery: "Доставка и сборка",
};

/** One priced BOX — a standalone cabinet, or a whole merged row built as one carcass. */
export interface BoxCost {
  /** the carcass id: the group tag when merged, else the lone cabinet's id */
  id: string;
  /** the cabinets in this box, in build order (one, unless merged) */
  cabs: Cabinet[];
  /** price WITHOUT the fixed project delivery, so the list + delivery ≈ the total */
  cost: number;
  merged: boolean;
}

/**
 * The full quote for the cost screen + a cost per BOX.
 *
 * THE UNIT OF COST IS THE BOX, NOT THE CABINET. A merged row is one line — «Навесной ряд 2400 мм,
 * 4 секции» — because that is what the workshop builds, what the material is bought for, and what
 * the saving is attached to. Inside a shared carcass there is no honest per-cabinet price: its side
 * panels are its neighbour's side panels, and you cannot buy one bay of it.
 *
 * Nothing merged → one box per cabinet, and the list is exactly what it always was.
 */
export function costBreakdown(
  cabs: Cabinet[],
  rates: RateTable = seedRateTable,
  prod: ProductionOpts = DEFAULT_PRODUCTION,
  panels: FlatPanel[] = [],
  lighting?: ProjectLighting,
): { quote: Quote; perBox: BoxCost[] } | null {
  const real = cabs.filter((c) => !c.furniture);
  if (!real.length) return null;
  // the panels and the lighting ride on the WHOLE-project quote only. `perBox` below prices each
  // carcass on its own, and a фартук — or a strip running the length of a row — belongs to no one
  // carcass; charging it to one would be an invented line on that box.
  const project = projectFromCabs(real, prod, panels, lighting);
  const quote = priceProject(project, rates);

  const byId = new Map(real.map((c) => [c.id, c]));
  const perBox = groupCarcasses(project.run).map((box) => {
    const members = box.modules.map((m) => byId.get(m.id)).filter((c): c is Cabinet => Boolean(c));
    // quote the box ON ITS OWN — its members keep their group tag, so a merged row prices as the
    // one carcass it is rather than as the cabinets it is made of
    const q = priceProject(projectFromCabs(members, prod), rates);
    return { id: box.id, cabs: members, merged: members.length > 1, cost: q.total - q.groups.delivery };
  });
  return { quote, perBox };
}
