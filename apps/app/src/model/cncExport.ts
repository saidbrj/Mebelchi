// Phase Е — "Передача": turn the constructed run into a factory production package.
// Reuses the pricing engine's panel decomposition (modulePanels) + the quote's hardware
// lines, so the cut list / hardware list are REAL (the same data that prices the kitchen),
// not a mockup. Pure; the screen renders it and offers a CSV download.

import { carcassPanels, groupCarcasses, carcassWidth, panelAreaM2, panelThicknessMm, seedRateTable, priceProject, DEFAULT_PRODUCTION, type PanelRole } from "@mebelchi/pricing";
import type { ProductionOpts } from "@mebelchi/schema";
import { projectFromCabs } from "./toProject";
import type { Cabinet, FrontProfile } from "./cabinet";
import { loadSettings } from "./settings";

const matName = (ref: string): string => seedRateTable.materials[ref]?.name ?? ref;
const hwName = (sku: string): string => Object.values(seedRateTable.hardware).find((h) => h.sku === sku)?.name ?? sku;

// Kromka thickness, in the shop's own notation. The 359-panel factory dump settles which
// bands are real: 426 edges at 1mm, 36 at 0.4mm, and ZERO at 2mm. A parts list that asks
// for a 2mm band names a spec no local shop stocks — the fastest way to have the whole
// export dismissed as machine-generated guesswork. Visible edges (fronts, filler panels)
// take 1mm; hidden carcass edges take 0.4mm.
const EDGE_VISIBLE = "1мм ПВХ";
const EDGE_HIDDEN = "0.4мм";
const EDGE_NONE = "—"; // glass arrives cut to size from the glazier and takes no kromka

const PART_RU: Record<string, string> = {
  "side-left": "Бок левый",
  "side-right": "Бок правый",
  bottom: "Дно",
  top: "Крышка",
  back: "Задняя стенка",
  door: "Фасад",
};
function partRu(name: string): string {
  if (PART_RU[name]) return PART_RU[name];
  const [base, n] = name.split(/-(?=\d+$)/);
  if (base === "shelf") return `Полка ${n}`;
  if (base === "divider") return `Перегородка ${n}`;
  // the vertical panel BETWEEN two bays of a merged box — it replaces the two side panels the
  // separate cabinets would each have had, and the shop must not cut it as one of those
  if (base === "stile") return `Стойка средняя ${n}`;
  // a cabinet with a custom interior can carry several doors — `door-1`, `door-2`… (a lone door
  // keeps the bare `door` name, handled by PART_RU above)
  if (base === "door") return `Фасад ${n}`;
  if (base === "glass") return `Стекло ${n}`;
  if (base === "mullion") return `Раскладка ${n}`;
  if (name.startsWith("drawer-front")) return `Фасад ящика ${name.split("-").pop()}`;
  return name;
}

const APPL: Record<string, string> = {
  sink: "Мойка",
  hob: "Плита",
  cooktop: "Варочная панель",
  oven: "Духовой шкаф",
  fridge: "Холодильник",
  dishwasher: "Посудомойка",
  washer: "Стиральная машина",
  hood: "Вытяжка",
};
/** «Навесной» / «Пенал» / «Напольный» — the module's kind, in the shop's words. */
export function kindRu(c: Cabinet): string {
  return c.kind === "upper" ? "Навесной" : c.kind === "tall" ? "Пенал" : "Напольный";
}

export function cabLabel(c: Cabinet): string {
  if (c.appliance && c.appliance !== "none" && c.appliance !== "filler") return APPL[c.appliance] ?? "Техника";
  if (c.corner) return "Угловой";
  return `${kindRu(c)} ${c.w}`;
}

/** what the CNC has to do to this panel's face — the shop cannot rout what the list doesn't say */
const PROFILE_RU: Record<FrontProfile, string> = {
  flat: "—",
  shaker: "Фрезеровка: рамка",
  raised: "Фрезеровка: рамка + филёнка",
  fluted: "Фрезеровка: рифление",
  glass: "Фрезеровка: под стекло",
  grid: "Фрезеровка: под стекло + раскладка",
  none: "—",
};

export interface PanelRow {
  module: string;
  part: string;
  /** carcass / facade / glass. A GLASS pane is bought cut to size — it is not sawn from a board and
   *  never goes on a saw plan or a CNC contour, which is why it carries its role this far. */
  role: PanelRole;
  /** raw ASCII panel name (side-left / bottom / door…) — for the DXF, which isn't UTF-8 */
  partEn: string;
  material: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  edge: string;
  /** the routed profile of this front (blank on a carcass panel) */
  profile: string;
}
export interface HwRow {
  name: string;
  qty: number;
}
export interface Production {
  panels: PanelRow[];
  hardware: HwRow[];
  boardM2: number;
  moduleCount: number;
  /** CARCASSES the shop actually builds — fewer than `moduleCount` when rows are merged. */
  boxCount: number;
}

/** The full production package for the run (cut list + hardware + board area).
 *
 *  ITERATES BOXES, NOT CABINETS. A merged row is one carcass: its outer sides, stiles and the one
 *  long top/bottom/back belong to the BOX and are listed against it, while each bay's shelves and
 *  fronts stay listed against the cabinet they go in. Send the shop a per-cabinet list for a merged
 *  row and it cuts eight side panels for a box that has two. */
export function production(cabs: Cabinet[], prod: ProductionOpts = DEFAULT_PRODUCTION): Production | null {
  const real = cabs.filter((c) => !c.furniture);
  if (!real.length) return null;
  const project = projectFromCabs(real, prod);
  const mats = project.materials;

  const panels: PanelRow[] = [];
  let boardArea = 0;
  const cabById = new Map(real.map((c) => [c.id, c]));
  const labelById = new Map(real.map((c, i) => [c.id, `${i + 1}. ${cabLabel(c)}`]));
  const boxes = groupCarcasses(project.run);

  for (const box of boxes) {
    // what the SHELL of this box is called on the cut list. A merged box is a thing in its own
    // right and needs its own name, or the shop cannot tell which row the 2400 top belongs to.
    const members = box.modules.map((m) => cabById.get(m.id)).filter((c): c is Cabinet => Boolean(c));
    const first = members[0];
    const shellLabel =
      members.length > 1
        ? `${labelById.get(first.id)?.split(".")[0] ?? "?"}. ${kindRu(first)} ряд ${carcassWidth(box)} — общий корпус (${members.length} секц.)`
        : (labelById.get(first.id) ?? cabLabel(first));

    for (const p of carcassPanels(box, mats)) {
      const facade = p.role === "facade";
      const owner = p.moduleId ? labelById.get(p.moduleId) : undefined;
      const ownerCab = p.moduleId ? cabById.get(p.moduleId) : first;

      // Back panel filter (if owner cabinet has no back panel or backMount === "none")
      if (p.name === "back") {
        if (ownerCab?.hasBack === false || ownerCab?.backMount === "none") {
          continue; // skip back panel
        }
      }

      panels.push({
        module: owner ?? shellLabel,
        part: partRu(p.name),
        role: p.role,
        partEn: p.name,
        material: matName(p.materialRef),
        lengthMm: Math.round(p.lengthMm),
        widthMm: Math.round(p.widthMm),
        // by ROLE — a bought-to-size glass pane is 4mm and takes no kromka
        thicknessMm: panelThicknessMm(p.role),
        edge: p.role === "glass" ? EDGE_NONE : facade ? EDGE_VISIBLE : EDGE_HIDDEN,
        profile: p.profile && !p.name.startsWith("mullion") ? PROFILE_RU[p.profile] : "",
      });
      boardArea += panelAreaM2(p);
    }
  }

  // Emitting scribe filler panels (доборные фальш-панели)
  for (const c of real) {
    const lbl = labelById.get(c.id) ?? cabLabel(c);
    const boardMat = mats.facadeId ? matName(mats.facadeId) : "ЛДСП 16 мм";
    if (c.fillerLeft && c.fillerLeft > 0) {
      panels.push({
        module: lbl,
        part: "Фальш-панель слева",
        role: "facade",
        partEn: "filler-left",
        material: boardMat,
        lengthMm: Math.round(c.h),
        widthMm: Math.round(c.fillerLeft),
        thicknessMm: 16,
        edge: EDGE_VISIBLE,
        profile: "—",
      });
      boardArea += (c.h * c.fillerLeft) / 1e6;
    }
    if (c.fillerRight && c.fillerRight > 0) {
      panels.push({
        module: lbl,
        part: "Фальш-панель справа",
        role: "facade",
        partEn: "filler-right",
        material: boardMat,
        lengthMm: Math.round(c.h),
        widthMm: Math.round(c.fillerRight),
        thicknessMm: 16,
        edge: EDGE_VISIBLE,
        profile: "—",
      });
      boardArea += (c.h * c.fillerRight) / 1e6;
    }
    if (c.fillerTop && c.fillerTop > 0) {
      panels.push({
        module: lbl,
        part: "Фальш-панель сверху",
        role: "facade",
        partEn: "filler-top",
        material: boardMat,
        lengthMm: Math.round(c.w),
        widthMm: Math.round(c.fillerTop),
        thicknessMm: 16,
        edge: EDGE_VISIBLE,
        profile: "—",
      });
      boardArea += (c.w * c.fillerTop) / 1e6;
    }
  }

  // hardware totals straight from the priced BOM (which counts hangers per BOX, not per cabinet)
  const hw = new Map<string, number>();
  for (const line of priceProject(project, seedRateTable).lines) {
    if (line.kind !== "hardware") continue;
    const name = hwName(line.ref);
    hw.set(name, (hw.get(name) ?? 0) + line.qty);
  }

  // Joint family fasteners count (4 fasteners per horizontal panel: shelves + bottom)
  try {
    const settings = loadSettings();
    const family = settings.jointFamily ?? "confirmat";
    let jointCount = 0;
    for (const c of real) {
      const horizontalPanels = (c.count ?? 0) + 1; // shelves + bottom
      jointCount += horizontalPanels * 4;
    }

    if (family === "confirmat") {
      hw.set("Конфирмат (евровинт) 7×50 мм", (hw.get("Конфирмат (евровинт) 7×50 мм") ?? 0) + jointCount);
    } else if (family === "minifix") {
      hw.set("Минификс (эксцентрик) Ø15×12.5 мм", (hw.get("Минификс (эксцентрик) Ø15×12.5 мм") ?? 0) + jointCount);
      hw.set("Шкант деревянный 8×30 мм", (hw.get("Шкант деревянный 8×30 мм") ?? 0) + jointCount);
    } else if (family === "dowel") {
      hw.set("Шкант деревянный 8×30 мм", (hw.get("Шкант деревянный 8×30 мм") ?? 0) + jointCount);
    }
  } catch (e) {
    // fallback if localStorage not available
  }

  return {
    panels,
    hardware: [...hw.entries()].map(([name, qty]) => ({ name, qty })),
    boardM2: Math.round(boardArea * 100) / 100,
    moduleCount: real.length,
    boxCount: boxes.length,
  };
}

/** A ;-separated CSV (Excel-friendly, Cyrillic) of the cut list + hardware. */
export function productionCSV(p: Production): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: string[] = ["Тип;Модуль;Наименование;Материал;Длина, мм;Ширина, мм;Толщина, мм;Кол-во;Кромка;Обработка"];
  for (const r of p.panels) {
    rows.push([ "Панель", r.module, r.part, r.material, r.lengthMm, r.widthMm, r.thicknessMm, 1, r.edge, r.profile ].map(esc).join(";"));
  }
  for (const h of p.hardware) {
    rows.push([ "Фурнитура", "", h.name, "", "", "", "", h.qty, "", "" ].map(esc).join(";"));
  }
  return rows.join("\r\n");
}
