// Phase Е — "Передача": turn the constructed run into a factory production package.
// Reuses the pricing engine's panel decomposition (modulePanels) + the quote's hardware
// lines, so the cut list / hardware list are REAL (the same data that prices the kitchen),
// not a mockup. Pure; the screen renders it and offers a CSV download.

import { carcassPanels, groupCarcasses, carcassWidth, panelAreaM2, panelThicknessMm, seedRateTable, priceProject, DEFAULT_PRODUCTION, type PanelRole } from "@mebelchi/pricing";
import type { ProductionOpts, FlatPanel, PanelCutout } from "@mebelchi/schema";
import { projectFromCabs } from "./toProject";
import type { Cabinet, FrontProfile } from "./cabinet";
import { loadSettings } from "./settings";

const matName = (ref: string): string => seedRateTable.materials[ref]?.name ?? ref;
/** A WORKTOP ref lives in its own rate map, not in `materials` — `matName` would hand the shop a
 *  raw UUID where the slab's name belongs. */
const worktopName = (ref: string): string => seedRateTable.worktop[ref]?.name ?? ref;
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

/** The cut-outs, in words. The geometry rides along in `PanelRow.cutouts`; this is the line the
 *  human on the saw reads, and it has to carry POSITIONS — "2 cut-outs" is not enough to cut one. */
export function cutNote(cuts: PanelCutout[]): string {
  if (!cuts.length) return "—";
  return `Вырезы: ${cuts.length} × ${cuts.map((c) => `${c.w}×${c.h}@${c.x},${c.y}`).join(" ")}`;
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
  /** HOLES IN THIS PANEL, panel-local mm — a фартук's sockets, a back cut around a riser. Carried
   *  as geometry so the machine file can draw them; `profile` says the same thing in words for the
   *  human reading the list. */
  cutouts?: PanelCutout[];
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
export function production(
  cabs: Cabinet[],
  prod: ProductionOpts = DEFAULT_PRODUCTION,
  /** THE FLAT WALL PANELS — фартук, the strip to the ceiling. They are real boards the shop cuts,
   *  so they belong on the cut list, in the nest and in the machine file. Derived app-side
   *  (model/toProject `panelsFor`) because they depend on the room, which this function has no
   *  view of. Absent → none, exactly as before. */
  wallPanels: FlatPanel[] = [],
  /** BACK-PANEL NOTCHES by module id (model/cutouts.ts) — a riser the box is built around. The
   *  cut list has to carry them or the shop cuts a solid back and finds out on site. */
  backCuts: Map<string, PanelCutout[]> = new Map(),
): Production | null {
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

    // THE NOTCHES IN THIS BOX'S BACK.
    //
    // A back panel belongs to the BOX, not to a module — that is why it has no `moduleId` — but a
    // riser is found by clashing with a MODULE. On a plain box the two frames are the same; on a
    // merged row the one long back spans several modules, so each member's notch has to be shifted
    // by how far that member sits along the box. Get this wrong on a merged row and the hole is cut
    // in the wrong bay.
    const boxBackCuts: PanelCutout[] = [];
    {
      const ordered = [...members].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const originX = ordered.length ? ordered[0].x ?? 0 : 0;
      for (const mem of ordered) {
        const cs = backCuts.get(mem.id);
        if (!cs?.length) continue;
        const dx = (mem.x ?? 0) - originX;
        for (const c of cs) boxBackCuts.push(dx ? { ...c, x: c.x + dx } : c);
      }
    }

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

      const cuts = p.name === "back" ? boxBackCuts : [];
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
        profile: cuts.length
          ? cutNote(cuts)
          : p.profile && !p.name.startsWith("mullion")
            ? PROFILE_RU[p.profile]
            : "",
        cutouts: cuts.length ? cuts : undefined,
      });
      boardArea += panelAreaM2(p);
    }
  }

  // ── THE FLAT WALL PANELS ──────────────────────────────────────────────────────────────────────
  // A фартук and a ceiling closer are boards: they are sawn, they are edged, and the фартук has
  // holes cut in it for the sockets. Until now they were priced and drawn and then never reached
  // the shop — you sold a kitchen whose quote included the panel and whose cut list did not
  // mention it.
  for (const fp of wallPanels) {
    // THE DECOR IT IS ACTUALLY MADE OF, when the design named one. The rate table only knows
    // generic stock and its names carry the SLAB's thickness, so a 6mm фартук came out labelled
    // «Столешница постформинг 38мм» — a contradiction against its own thickness column, and not
    // what anyone orders. The stock name stays as the fallback.
    // …and when there is no named decor, the stock's name still must not carry the SLAB's
    // thickness: «Столешница постформинг 38мм» beside a 6мм thickness column is a contradiction the
    // shop has to guess its way out of. The material column names the material; the thickness
    // column states the thickness.
    // NOTE the absence of \b around «мм»: JS word boundaries are ASCII-only, so a boundary after a
    // Cyrillic letter never matches and the pattern would silently strip nothing.
    const withoutThickness = (name: string) => name.replace(/[,\s·]*\d+([.,]\d+)?\s*мм/gi, "").trim();
    const stockMat =
      fp.decor ??
      withoutThickness(fp.stock === "worktop"
        ? (mats.worktopId ? worktopName(mats.worktopId) : "Столешница")
        : fp.stock === "carcass"
          ? (mats.carcassId ? matName(mats.carcassId) : "ЛДСП")
          : (mats.facadeId ? matName(mats.facadeId) : "МДФ"));
    const cuts = fp.cutouts ?? [];
    const what = fp.kind === "splash" ? "Фартук" : "Панель до потолка";
    panels.push({
      // MODULE = where it goes, PART = what it is — the same split every cabinet row uses, so the
      // cut map can label it and the fitter knows which wall the board belongs to
      module: fp.wall ? `Стена ${fp.wall}` : what,
      part: what,
      role: "facade",
      partEn: fp.kind === "splash" ? "backsplash" : "ceiling-filler",
      material: stockMat,
      lengthMm: Math.round(fp.w),
      widthMm: Math.round(fp.h),
      thicknessMm: fp.t,
      // the two horizontal edges are what shows — the same rule the quote bands (buildBom)
      edge: EDGE_VISIBLE,
      // the shop cannot rout what the list does not say. Sizes and positions ride along, because
      // "2 cut-outs" is not enough to cut one.
      profile: cutNote(cuts),
      cutouts: cuts.length ? cuts : undefined,
    });
    boardArea += (fp.w * fp.h) / 1e6;
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
