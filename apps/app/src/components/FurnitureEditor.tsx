// The furniture editor — a multi-panel bottom sheet for one module:
//   main   → width/height, Наполнение/Заменять, the editable-parts list, add-ons
//   fill   → Наполнение: shelves/drawers/open + counts
//   edit   → a part's dimension settings (e.g. overhang left/right)
//   style  → the Eman.uz material picker (with pricing) for a part
// Real fields (width/height/fill/count) drive the model + price; per-part material
// picks, add-ons and toggles are kept in `cfg` (scaffold until Eman is wired in).
import { useState, useMemo, type ReactNode } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { useMoney } from "../useMoney";
import { HANDLES, FRONT_PROFILES, defaultHandlePos, frontOf, type Cabinet, type FinishKey, type DoorOpening, type HandlePos, type FrontProfile } from "../model/cabinet";
import { maxCabH, cabDepth, cornerShapeOf, cornerArm, MIN_H, D_MIN, D_MAX } from "../model/bands";
import { cabinetParts, PART_FINISH, type Part } from "../model/parts";
import { isMerged, boxMates, mergeCandidates } from "../model/carcassGroups";
import { matPriceLabel, hexToInt } from "../model/materials";
import { listMaterials, catalogByColor } from "../model/catalog";
import { matSwatchStyle } from "../three/pbr";
import type { KitchenStyle } from "../model/layout";
import { IconSearch, IconFilter } from "./icons";

export interface PartCfg {
  materials: Record<string, string>; // partId → material id
  removed: string[]; // removed part ids
  addons: string[]; // active add-on ids
  toggles: string[]; // active switch ids
  partition: number; // Перегородка count (visual)
}
export const emptyCfg = (): PartCfg => ({ materials: {}, removed: [], addons: [], toggles: [], partition: 0 });

type Panel = { k: "main" } | { k: "edit"; part: Part } | { k: "style"; part: Part };

const cm = (mm: number) => Math.round(mm / 10);

// simple line illustration per part TYPE, drawn over the material swatch so each row
// shows BOTH what the part is (door / handle / worktop / carcass) and its material
const PART_ICON: Record<string, ReactNode> = {
  front: (
    <>
      <rect x="8" y="5" width="24" height="30" rx="2.5" />
      <line x1="26" y1="14" x2="26" y2="26" />
    </>
  ),
  handle: (
    <>
      <line x1="9" y1="17" x2="31" y2="17" />
      <line x1="12" y1="17" x2="12" y2="23" />
      <line x1="28" y1="17" x2="28" y2="23" />
    </>
  ),
  worktop: (
    <>
      <rect x="6" y="15" width="28" height="7" rx="1.5" />
      <line x1="6" y1="18.5" x2="34" y2="18.5" />
    </>
  ),
  carcass: (
    <>
      <rect x="9" y="8" width="22" height="27" rx="1.5" />
      <line x1="9" y1="19" x2="31" y2="19" />
      <line x1="9" y1="27" x2="31" y2="27" />
    </>
  ),
};

function PartThumb({ partId, style }: { partId: string; style?: Record<string, string> }) {
  return (
    <span className="part-thumb" style={style}>
      {PART_ICON[partId] && (
        <svg className="part-ico" viewBox="0 0 40 40" aria-hidden="true">
          {PART_ICON[partId]}
        </svg>
      )}
    </span>
  );
}

export function FurnitureEditor({
  cab,
  index,
  name,
  sub,
  patchCab,
  onResizeWidth,
  applyFinishToAll,
  applyToAll,
  style,
  cfg,
  onCfg,
  onClose,
  onOpenFill,
  onReplace,
  onSaveCab,
  onDims,
  ceiling,
  flash,
}: {
  cab: Cabinet;
  index: number;
  name: string;
  sub: string;
  /** the kitchen-wide finish (default colour per part when the module has no override) */
  style: KitchenStyle;
  patchCab: (i: number, patch: Partial<Cabinet>) => void;
  /** width change pushes the neighbouring module (keeps the row tiled) */
  onResizeWidth: (cabId: string, newW: number) => void;
  /** push a finish (part → colour) onto every module ("apply to all") */
  applyFinishToAll: (finish: Partial<Record<FinishKey, number>>) => void;
  /** push a patch (e.g. handle type) onto every module ("apply to all") */
  applyToAll: (patch: Partial<Cabinet>) => void;
  cfg: PartCfg;
  onCfg: (updater: (c: PartCfg) => PartCfg) => void;
  onClose: () => void;
  /** open the focused full-screen fill (Наполнение) editor for this module */
  onOpenFill: () => void;
  /** open the catalog to swap this module for another type (keeps its place) */
  onReplace: () => void;
  /** save this customised cabinet to the reusable "My cabinets" library (undefined = hidden) */
  onSaveCab?: (name: string) => void;
  /** height / depth — the ONE path (store.patchCabDims). It owns the clamps, the «ко всему ряду»
   *  mode, and the rule that a base's height is the counter height for every base. */
  onDims: (id: string, patch: { h?: number; depth?: number }) => void;
  /** «Применить ко всему ряду» — a persistent mode, shared with the 3D + plan dimension drags */
  /** room height (mm) — the ceiling is what caps a column/wall unit, not a magic constant */
  ceiling: number;
  flash: (msg: string) => void;
}) {
  const t = useT();
  const money = useMoney();
  const showPricing = useStore((s) => s.settings.showPricing);
  const [panel, setPanel] = useState<Panel>({ k: "main" });
  const [saveName, setSaveName] = useState<string | null>(null); // non-null = name prompt open
  const [unit, setUnit] = useState<"mm" | "cm">("mm");
  const curDepth = cab.corner ? cornerArm(cab) : cabDepth(cab);
  const [wStr, setWStr] = useState(String(unit === "mm" ? cab.w : cm(cab.w)));
  const [hStr, setHStr] = useState(String(unit === "mm" ? cab.h : cm(cab.h)));
  const [dStr, setDStr] = useState(String(unit === "mm" ? curDepth : cm(curDepth)));
  const [matSearch, setMatSearch] = useState("");
  // Each material / handle change applies to THIS module immediately (live preview), and is
  // ACCUMULATED into a pending patch. We DON'T interrupt with the "apply to all?" popup on
  // every tap (annoying) — instead it's raised ONCE when the user leaves the panel (Назад)
  // or closes the sheet (✕), so they can try options freely and decide scope at the end.
  const [pendPatch, setPendPatch] = useState<Partial<Cabinet>>({});
  const [pendFinish, setPendFinish] = useState<Partial<Record<FinishKey, number>>>({});
  const [scopeNext, setScopeNext] = useState<{ run: () => void } | null>(null);
  const hasPending = Object.keys(pendPatch).length > 0 || Object.keys(pendFinish).length > 0;
  const queueCab = (patch: Partial<Cabinet>) => setPendPatch((p) => ({ ...p, ...patch }));
  const queueFinish = (finish: Partial<Record<FinishKey, number>>) => setPendFinish((f) => ({ ...f, ...finish }));
  // leaving a panel / closing the sheet: raise the scope popup first if anything changed
  const leave = (run: () => void) => (hasPending ? setScopeNext({ run }) : run());
  const resolveScope = (all: boolean) => {
    if (all) {
      if (Object.keys(pendPatch).length) applyToAll(pendPatch);
      if (Object.keys(pendFinish).length) applyFinishToAll(pendFinish);
    }
    setPendPatch({});
    setPendFinish({});
    const next = scopeNext;
    setScopeNext(null);
    next?.run();
  };
  const setHandleType = (idx: number) => { patchCab(index, { handle: idx }); queueCab({ handle: idx }); };
  // THE FRONT'S BODY — flat / shaker / raised (неоклассика) / fluted / glass / glass-grid. One
  // property, read by the 3D, both elevations, the cut list and the quote: a shaker door cannot be
  // drawn one way and billed another. Set on the front part's style panel.
  const setFront = (p: FrontProfile) => { patchCab(index, { front: p }); queueCab({ front: p }); };
  const curFront = frontOf(cab);
  // whole-cabinet door opening + handle placement (mirror the Fill Editor's door settings).
  // While the user hasn't pinned a placement, it auto-follows the hinge (opposite edge);
  // once they tap a placement it stays put.
  const curOpening: DoorOpening = cab.opening ?? "left";
  const curHandlePos: HandlePos = cab.handlePos ?? defaultHandlePos(curOpening);
  const setOpening = (o: DoorOpening) => { patchCab(index, { opening: o }); queueCab({ opening: o }); };
  const setHandlePos = (p: HandlePos) => { patchCab(index, { handlePos: p }); queueCab({ handlePos: p }); };
  // corner units have no fill editor — a simple shelf-count stepper instead (0–8)
  const setShelves = (n: number) => patchCab(index, { count: Math.max(0, Math.min(8, n)) });

  const isApplianceFill = !!cab.appliance && cab.appliance !== "none" && cab.appliance !== "filler";
  // corner units have a bespoke L / diagonal interior (fixed shelves) that the rectangular
  // cell-tree fill editor can't represent — hide Наполнение for them (like appliances)
  const noFill = isApplianceFill || !!cab.corner;
  // quick shelf-count stepper (like the corner one) for a plain SHELF cabinet — the common
  // "just change the number of shelves" case, without opening the full fill editor. Not shown
  // once the cabinet has a custom cell-tree `layout` (the fill editor drives it then).
  const showShelves = !isApplianceFill && !cab.furniture && !cab.layout && (!!cab.corner || cab.fill === "shelves");
  const parts = cabinetParts(cab).filter((p) => !cfg.removed.includes(p.id));

  // THE tallest this module may be, from the ROOM (see model/bands.ts). It used to be a flat
  // 2400mm, so with the 100mm plinth a column topped out at 2500 and could never reach a 2700
  // ceiling — and floor-to-ceiling is the single most common thing a custom kitchen does.
  const maxH = maxCabH(cab, ceiling);

  // ── ONE CORPUS, OR SEVERAL ───────────────────────────────────────────────────────────────────
  // Whether this module's row is built as ONE carcass (shared stiles) or as a box per cabinet.
  // `mergeCandidates` is the row this cabinet could share a box with — same wall, same band, same
  // kind, same height and depth — so the toggle only ever appears when there is something real to
  // merge, and can only ever tag a set the workshop can actually build.
  const cabs = useStore((s) => s.cabs);
  // the shop's live catalog — re-read whenever Каталог changes it, so a decor added or
  // re-priced there is pickable here without a reload
  const catalogRev = useStore((s) => s.catalogRev);
  const MATS = useMemo(() => listMaterials(), [catalogRev]);
  const toggleCarcassMerge = useStore((s) => s.toggleCarcassMerge);
  const merged = isMerged(cab);
  const box = merged ? boxMates(cabs, cab) : [];
  const row = merged ? [] : mergeCandidates(cabs, cab);
  const canMerge = row.length > 1;
  const rowCount = row.length;
  const boxCount = box.length;
  const boxWidth = box.reduce((n, c) => n + c.w, 0);

  // HEIGHT + DEPTH go through onDims → store.patchCabDims, which owns the clamps AND the row-scope
  // mode, so the field, the 3D arrow and the plan's dimension all behave identically.
  const applyHeight = (mm: number) => onDims(cab.id, { h: mm });
  const applyDepth = (mm: number) => onDims(cab.id, { depth: mm });
  /** fill the remaining height to the ceiling — one tap, instead of holding + for twenty steps */
  const toCeiling = () => {
    setHStr(String(unit === "mm" ? maxH : cm(maxH)));
    applyHeight(maxH);
  };
  const commitDim = (which: "w" | "h" | "d", str: string) => {
    const v = parseInt(str, 10);
    if (!v) return;
    const mmVal = unit === "mm" ? v : v * 10;
    if (which === "w") onResizeWidth(cab.id, mmVal);
    else if (which === "d") applyDepth(mmVal);
    else applyHeight(mmVal);
  };
  const toggleUnit = (nextUnit: "mm" | "cm") => {
    if (nextUnit === unit) return;
    setUnit(nextUnit);
    if (nextUnit === "mm") {
      setWStr(String(cab.w));
      setHStr(String(cab.h));
      setDStr(String(curDepth));
    } else {
      setWStr(String(cm(cab.w)));
      setHStr(String(cm(cab.h)));
      setDStr(String(cm(curDepth)));
    }
  };
  // ± buttons: step by delta (in current unit)
  const stepW = (delta: number) => {
    if (unit === "mm") {
      const next = Math.max(150, Math.min(1200, (parseInt(wStr, 10) || cab.w) + delta));
      setWStr(String(next));
      onResizeWidth(cab.id, next);
    } else {
      const next = Math.max(15, Math.min(120, (parseInt(wStr, 10) || cm(cab.w)) + delta));
      setWStr(String(next));
      onResizeWidth(cab.id, next * 10);
    }
  };
  const baseH = cab.kind === "base";
  const stepH = (delta: number) => {
    if (unit === "mm") {
      const minHVal = baseH ? 550 : MIN_H;
      const maxHVal = baseH ? 1000 : maxH;
      const next = Math.max(minHVal, Math.min(maxHVal, (parseInt(hStr, 10) || cab.h) + delta));
      setHStr(String(next));
      applyHeight(next);
    } else {
      const next = Math.max(baseH ? 55 : cm(MIN_H), Math.min(baseH ? 100 : cm(maxH), (parseInt(hStr, 10) || cm(cab.h)) + delta));
      setHStr(String(next));
      applyHeight(next * 10);
    }
  };
  const stepD = (delta: number) => {
    if (unit === "mm") {
      const next = Math.max(D_MIN, Math.min(D_MAX, (parseInt(dStr, 10) || curDepth) + delta));
      setDStr(String(next));
      applyDepth(next);
    } else {
      const next = Math.max(cm(D_MIN), Math.min(cm(D_MAX), (parseInt(dStr, 10) || cm(curDepth)) + delta));
      setDStr(String(next));
      applyDepth(next * 10);
    }
  };
  // pick a material for a part → record it (for the BOM/price) AND recolour this
  // module's matching render part live (facade/worktop/handle/carcass). Stays open so
  // you can browse finishes and see each one applied immediately.
  const chooseMaterial = (partId: string, mid: string) => {
    onCfg((c) => ({ ...c, materials: { ...c.materials, [partId]: mid } }));
    const m = MATS.find((x) => x.id === mid);
    const key = PART_FINISH[partId];
    if (m && key) {
      const col = hexToInt(m.color);
      patchCab(index, { finish: { ...cab.finish, [key]: col } }); // this module (live preview)
      queueFinish({ [key]: col }); // … remembered for the scope prompt on leaving
    }
  };
  const removePart = (partId: string) => onCfg((c) => ({ ...c, removed: [...c.removed, partId] }));

  const matName = (partId: string) => {
    const m = MATS.find((x) => x.id === cfg.materials[partId]);
    return m ? `${m.name} · ${m.desc}` : t.fe.emanMaterials;
  };
  // a REAL, dynamic thumbnail for a part = its current material: the picked Eman material
  // first (texture/colour), else the module's per-part finish colour (mapped back to a
  // catalog material for its texture), else the kitchen-wide default. Updates the instant
  // the user changes the facade wood / worktop / handle.
  const partThumb = (partId: string): Record<string, string> | undefined => {
    const picked = MATS.find((x) => x.id === cfg.materials[partId]);
    if (picked) return matSwatchStyle(picked.color, picked.tex);
    const key = PART_FINISH[partId];
    if (!key) return undefined; // non-material part → keep the default placeholder
    const colInt = cab.finish?.[key] ?? style[key];
    if (colInt == null) return undefined;
    const hex = `#${(colInt >>> 0).toString(16).padStart(6, "0")}`;
    return matSwatchStyle(hex, catalogByColor(colInt, key)?.tex);
  };
  const matsForPart = (part: Part) => {
    const key = PART_FINISH[part.id];
    return MATS.filter(
      (m) => (!key || m.part === key) && (m.name + " " + m.desc).toLowerCase().includes(matSearch.toLowerCase()),
    );
  };

  return (
    <>
      <div className="sheet-head">
        <div>
          <div className="sheet-title">{name} <span className="item-card-i">ⓘ</span></div>
          {panel.k === "main" && (
            <>
              <div className="fe-sub">{sub}</div>
              <div className="fe-dim">{cm(cab.w)}×{cm(cab.h)}cm</div>
            </>
          )}
        </div>
        <button className="sheet-x" onClick={() => leave(onClose)} type="button" aria-label={t.fe.close}>✕</button>
      </div>

      {panel.k !== "main" && (
        <div className="fe-subhead">
          <button className="fe-back" onClick={() => leave(() => setPanel({ k: "main" }))} type="button">{t.fe.back}</button>
          <span className="fe-subtitle">
            {panel.k === "style" ? t.fe.style : panel.part.editLabel ? t.fe.editLabel(panel.part.editLabel) : t.fe.edit}
          </span>
        </div>
      )}

      {/* ---- MAIN ---- */}
      {panel.k === "main" && (
        <div className="cfg-sheet-body">
          {/* UNIT SELECTION TOGGLE */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span className="cfg-field-lbl" style={{ margin: 0, fontWeight: 600 }}>Точность измерений:</span>
            <div className="pillrow" style={{ marginTop: 0 }}>
              <button className={`chip${unit === "mm" ? " sel" : ""}`} onClick={() => toggleUnit("mm")} type="button">мм (mm)</button>
              <button className={`chip${unit === "cm" ? " sel" : ""}`} onClick={() => toggleUnit("cm")} type="button">см (cm)</button>
            </div>
          </div>

          {/* INTERNAL CLEARANCE READOUT */}
          {(() => {
            const boardT = cab.boardThickness ?? 16;
            const intW = Math.max(0, cab.w - 2 * boardT);
            const intH = Math.max(0, cab.h - 2 * boardT);
            const isGroove = (cab.hasBack ?? true) && (cab.backMount ?? "groove") === "groove";
            const setback = isGroove ? (cab.grooveSetback ?? 10) + 4 : 0;
            const intD = Math.max(0, curDepth - setback);
            return (
              <div style={{ background: "rgba(0,169,97,0.08)", border: "1px solid rgba(0,169,97,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#1b4d3e" }}>
                <strong>Внутренний чистый габарит:</strong> {intW} × {intH} × {intD} мм <span style={{ opacity: 0.75 }}>(ЛДСП {boardT} мм)</span>
              </div>
            );
          })()}

          {/* WIDTH */}
          {(!cab.corner || cornerShapeOf(cab) === "outer") && (
            <div className="fe-field">
              <span className="fe-field-lbl2">{t.fe.width}</span>
              <div className="fe-counter">
                {unit === "mm" && <button className="num-step" type="button" aria-label="-10 мм" onClick={() => stepW(-10)}>-10</button>}
                <button className="num-step" type="button" aria-label={unit === "mm" ? "-1 мм" : "-1 см"} onClick={() => stepW(-1)}>−</button>
                <div className="fe-input">
                  <input inputMode="numeric" value={wStr} onChange={(e) => setWStr(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => commitDim("w", wStr)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                  <span>{unit}</span>
                </div>
                <button className="num-step" type="button" aria-label={unit === "mm" ? "+1 мм" : "+1 см"} onClick={() => stepW(1)}>+</button>
                {unit === "mm" && <button className="num-step" type="button" aria-label="+10 мм" onClick={() => stepW(10)}>+10</button>}
              </div>
            </div>
          )}
          {/* HEIGHT */}
          <div className="fe-field">
            <span className="fe-field-lbl2">{t.fe.height}</span>
            <div className="fe-counter">
              {unit === "mm" && <button className="num-step" type="button" aria-label="-10 мм" onClick={() => stepH(-10)}>-10</button>}
              <button className="num-step" type="button" aria-label={unit === "mm" ? "-1 мм" : "-1 см"} onClick={() => stepH(-1)}>−</button>
              <div className="fe-input">
                <input inputMode="numeric" value={hStr} onChange={(e) => setHStr(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => commitDim("h", hStr)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                <span>{unit}</span>
              </div>
              <button className="num-step" type="button" aria-label={unit === "mm" ? "+1 мм" : "+1 см"} onClick={() => stepH(1)}>+</button>
              {unit === "mm" && <button className="num-step" type="button" aria-label="+10 мм" onClick={() => stepH(10)}>+10</button>}
            </div>
          </div>
          {/* DEPTH */}
          <div className="fe-field">
            <span className="fe-field-lbl2">{cab.corner ? t.fe.cornerArm : t.fe.depth}</span>
            <div className="fe-counter">
              {unit === "mm" && <button className="num-step" type="button" aria-label="-10 мм" onClick={() => stepD(-10)}>-10</button>}
              <button className="num-step" type="button" aria-label={unit === "mm" ? "-1 мм" : "-1 см"} onClick={() => stepD(-1)}>−</button>
              <div className="fe-input">
                <input inputMode="numeric" value={dStr} onChange={(e) => setDStr(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => commitDim("d", dStr)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                <span>{unit}</span>
              </div>
              <button className="num-step" type="button" aria-label={unit === "mm" ? "+1 мм" : "+1 см"} onClick={() => stepD(1)}>+</button>
              {unit === "mm" && <button className="num-step" type="button" aria-label="+10 мм" onClick={() => stepD(10)}>+10</button>}
            </div>
          </div>
          {cab.corner && cornerShapeOf(cab) !== "outer" && <div className="fe-hint">{t.fe.cornerArmHint(cab.w)}</div>}

          {/* CONSTRUCTION & FILLER PANELS SECTION */}
          <div style={{ borderTop: "1px solid #eee", marginTop: 12, paddingTop: 10, marginBottom: 12 }}>
            <div className="cfg-field-lbl" style={{ fontWeight: 600, color: "#333" }}>Конструкция и фальш-панели:</div>
            
            {/* Board Thickness */}
            <div style={{ marginTop: 8 }}>
              <span className="fe-field-lbl2" style={{ fontSize: 12 }}>Толщина корпуса (ЛДСП):</span>
              <div className="pillrow" style={{ marginTop: 4 }}>
                <button className={`chip${(cab.boardThickness ?? 16) === 16 ? " sel" : ""}`} onClick={() => patchCab(index, { boardThickness: 16 })} type="button">16 мм (Стандарт)</button>
                <button className={`chip${(cab.boardThickness ?? 16) === 18 ? " sel" : ""}`} onClick={() => patchCab(index, { boardThickness: 18 })} type="button">18 мм (Усиленный)</button>
              </div>
            </div>

            {/* Back Panel Mounting */}
            <div style={{ marginTop: 10 }}>
              <span className="fe-field-lbl2" style={{ fontSize: 12 }}>Задняя стенка (ХДФ):</span>
              <div className="pillrow" style={{ marginTop: 4 }}>
                <button className={`chip${(cab.hasBack ?? true) && (cab.backMount ?? "groove") === "groove" ? " sel" : ""}`} onClick={() => patchCab(index, { hasBack: true, backMount: "groove" })} type="button">В паз (4×8 мм)</button>
                <button className={`chip${(cab.hasBack ?? true) && cab.backMount === "overlay" ? " sel" : ""}`} onClick={() => patchCab(index, { hasBack: true, backMount: "overlay" })} type="button">Внахлёст (16 мм)</button>
                <button className={`chip${cab.hasBack === false || cab.backMount === "none" ? " sel" : ""}`} onClick={() => patchCab(index, { hasBack: false, backMount: "none" })} type="button">Без задника</button>
              </div>
            </div>

            {/* Scribe / Filler Panels */}
            <div style={{ marginTop: 10 }}>
              <span className="fe-field-lbl2" style={{ fontSize: 12 }}>Доборные фальш-панели (мм):</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
                <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                  Слева:
                  <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={cab.fillerLeft ?? 0} onChange={(e) => patchCab(index, { fillerLeft: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </label>
                <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                  Справа:
                  <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={cab.fillerRight ?? 0} onChange={(e) => patchCab(index, { fillerRight: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </label>
                <label style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column" }}>
                  Сверху:
                  <input type="number" className="set-input" style={{ padding: "4px 6px", marginTop: 2, fontSize: 12 }} value={cab.fillerTop ?? 0} onChange={(e) => patchCab(index, { fillerTop: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </label>
              </div>
            </div>
          </div>

          {/* «Объединить в один корпус» has MOVED to Фаза Г · Инженерия.
              It never belonged here: a merged box is a property of a SET, and a per-cabinet toggle
              cannot show a set — you flipped a switch and three neighbours silently joined, with no
              way to see which cabinets were now one carcass or what you had bought by it. And it is
              not a design decision at all: the fronts do not move, so the client sees the same
              kitchen. Only the sawing, the drilling and the price change. It is drawn as an
              elevation there, where a box is a box you can see. */}
          {/* FLOOR-TO-CEILING in one tap. Every reference kitchen runs the cabinetry right up to the
              ceiling; getting there with a 5cm stepper is twenty taps, so it gets its own button.
              Hidden for a base (its height IS the counter height) and when it's already there. */}
          {!baseH && !cab.furniture && cab.h < maxH - 5 && (
            <button className="fe-ceiling" type="button" onClick={toCeiling}>
              {t.fe.toCeiling} · {Math.round(maxH / 10)} cm
            </button>
          )}
          {baseH && <div className="fe-hint">{t.fe.baseHeightHint}</div>}

          {/* quick shelf-count stepper for shelf cabinets (+ corners) — the common case */}
          {showShelves && (
            <div className="fe-field">
              <span className="fe-field-lbl2">{t.fe.shelves}</span>
              <div className="fe-counter">
                <button className="num-step" type="button" aria-label="−" onClick={() => setShelves((cab.count ?? 0) - 1)}>−</button>
                <span className="fe-counter-val">{cab.count ?? 0}</span>
                <button className="num-step" type="button" aria-label="+" onClick={() => setShelves((cab.count ?? 0) + 1)}>+</button>
              </div>
            </div>
          )}

          {/* THE CORNER BODY. A 45° chamfer with one diagonal door, or the room corner notched out
              into an L-shaped box with an L-shaped door. This used to be decided by the kind — a
              wall unit was always diagonal, a base one always L — which is simply untrue of real
              kitchens. Both the 3D and the 2D plan redraw from this. */}
          {/* …INNER corners only. An end unit has one body — a rectangle with a 45° cut — and these
              two chips would silently turn it into an inside-corner square in the wrong place. */}
          {cab.corner && cornerShapeOf(cab) !== "outer" && (
            <>
              <div className="cfg-field-lbl">{t.fe.cornerShape}</div>
              <div className="pillrow">
                <button
                  className={`chip${cornerShapeOf(cab) === "diagonal" ? " sel" : ""}`}
                  onClick={() => patchCab(index, { cornerShape: "diagonal" })}
                  type="button"
                >
                  {t.fe.cornerDiag}
                </button>
                <button
                  className={`chip${cornerShapeOf(cab) === "l" ? " sel" : ""}`}
                  onClick={() => patchCab(index, { cornerShape: "l" })}
                  type="button"
                >
                  {t.fe.cornerL}
                </button>
              </div>
            </>
          )}

          <div className="fe-actions">
            {!noFill && (
              <button className="fe-action" onClick={onOpenFill} type="button">
                <span className="fe-action-ic">⊞</span> {t.fe.fill}
              </button>
            )}
            <button className="fe-action fe-action-2" onClick={onReplace} type="button">
              <span className="fe-action-ic">⟳</span> {t.fe.replace}
            </button>
          </div>

          {/* save this customised cabinet to the reusable "My cabinets" library */}
          {onSaveCab && (
            <button className="fe-save-cab" onClick={() => setSaveName(name)} type="button">
              ★ {t.fe.saveCab}
            </button>
          )}

          <div className="fe-list-title">{t.fe.changeSome}</div>
          {parts.map((p) => (
            <div className="part-card" key={p.id}>
              <PartThumb partId={p.id} style={partThumb(p.id)} />
              <div className="part-body">
                <div className="part-name">{p.name} <span className="item-card-i">ⓘ</span></div>
                <div className="part-sub">{matName(p.id)}</div>
                <div className="part-actions">
                  {p.actions.includes("edit") && (
                    <button className="part-btn" onClick={() => setPanel({ k: "edit", part: p })} type="button">{t.fe.edit}</button>
                  )}
                  {p.actions.includes("style") && (
                    <button className="part-btn" onClick={() => { setMatSearch(""); setPanel({ k: "style", part: p }); }} type="button">{t.fe.style}</button>
                  )}
                  {p.actions.includes("delete") && (
                    <button className="part-btn" onClick={() => removePart(p.id)} type="button">{t.fe.delete}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- EDIT a part ---- */}
      {/* handle → door opening side + handle placement (same options as the Fill Editor) */}
      {panel.k === "edit" && panel.part.id === "handle" && (
        <div className="cfg-sheet-body">
          <div className="cfg-field-lbl">{t.fe.opening}</div>
          <div className="pillrow fe-fill">
            {(["left", "right", "top", "bottom"] as DoorOpening[]).map((o) => (
              <button key={o} className={`chip${curOpening === o ? " sel" : ""}`} onClick={() => setOpening(o)} type="button">{t.fe.opt[o]}</button>
            ))}
          </div>
          <div className="cfg-field-lbl">{t.fe.handlePos}</div>
          <div className="pillrow fe-fill">
            {(["left", "right", "top", "bottom", "center", "none"] as HandlePos[]).map((p) => (
              <button key={p} className={`chip${curHandlePos === p ? " sel" : ""}`} onClick={() => setHandlePos(p)} type="button">{t.fe.opt[p]}</button>
            ))}
          </div>
        </div>
      )}

      {/* ---- STYLE (Eman material picker) ---- */}
      {panel.k === "style" && (() => {
        const mats = matsForPart(panel.part);
        const chosen = cfg.materials[panel.part.id];
        const isHandle = panel.part.id === "handle";
        return (
          <div className="cfg-sheet-body">
            {/* handle style = its TYPE (bar/profile/knob/none) + the metal colour below */}
            {isHandle && (
              <>
                <div className="cfg-field-lbl">{t.fe.handleType}</div>
                <div className="pillrow fe-fill">
                  {HANDLES.map((_, i) => (
                    <button key={i} className={`chip${cab.handle === i ? " sel" : ""}`} onClick={() => setHandleType(i)} type="button">{t.labels.handles[i]}</button>
                  ))}
                </div>
                <div className="cfg-field-lbl">{t.fe.metalColor}</div>
              </>
            )}
            {/* THE FRONT'S BODY. Was a two-chip Глухой/Витрина binary; a fluted drawer bank and a
                neoclassic raised panel are fronts too — and drawers get the profile as well, which
                is exactly how the ribbed kitchens in the reference photos are built. */}
            {panel.part.id === "front" && !isHandle && (
              <>
                <div className="cfg-field-lbl">{t.fe.frontStyle}</div>
                <div className="pillrow fe-fill">
                  {FRONT_PROFILES.map((p) => (
                    <button key={p} className={`chip${curFront === p ? " sel" : ""}`} onClick={() => setFront(p)} type="button">{t.labels.fronts[p]}</button>
                  ))}
                </div>
              </>
            )}
            <div className="search-box">
              <input className="search-input" placeholder={t.fe.search} value={matSearch} onChange={(e) => setMatSearch(e.target.value)} />
              <span className="search-ic"><IconSearch /></span>
            </div>
            <div className="color-bar">
              <span className="color-count">{t.fe.products(mats.length)}</span>
              <button className="filter-btn" onClick={() => flash(t.fe.filtersSoon)} type="button">{t.fe.allFilters} <IconFilter /></button>
            </div>
            <div className="cover-list">
              {mats.map((m) => (
                <button key={m.id} className={`mat-card${chosen === m.id ? " sel" : ""}`} onClick={() => chooseMaterial(panel.part.id, m.id)} type="button">
                  <span className="mat-top">
                    <span className="mat-thumb" style={matSwatchStyle(m.color, m.tex)} />
                    <span className="cover-meta">
                      <span className="cover-name">{m.name} <span className="item-card-i">ⓘ</span></span>
                      <span className="cover-desc">{m.desc}</span>
                      <span className="cover-desc">{m.thickness}</span>
                    </span>
                  </span>
                  {showPricing && <span className="mat-foot">{matPriceLabel(m, money)}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* name prompt for saving to the "My cabinets" library */}
      {saveName != null && (
        <div className="scope-modal" onClick={() => setSaveName(null)}>
          <div className="scope-card" onClick={(e) => e.stopPropagation()}>
            <div className="scope-title">{t.fe.saveCabTitle}</div>
            <input
              className="set-input"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) { onSaveCab?.(saveName.trim()); setSaveName(null); } }}
            />
            <div className="scope-actions">
              <button className="scope-this" onClick={() => setSaveName(null)} type="button">{t.fe.cancelSave}</button>
              <button className="scope-all" disabled={!saveName.trim()} onClick={() => { onSaveCab?.(saveName.trim()); setSaveName(null); }} type="button">{t.fe.saveDo}</button>
            </div>
          </div>
        </div>
      )}

      {/* raised on leaving a panel / closing after changes: apply to this module or all? */}
      {scopeNext && (
        <div className="scope-modal" onClick={() => resolveScope(false)}>
          <div className="scope-card" onClick={(e) => e.stopPropagation()}>
            <div className="scope-title">{t.fe.scopeTitle}</div>
            <div className="scope-sub">{t.fe.scopeSub}</div>
            <div className="scope-actions">
              <button className="scope-this" onClick={() => resolveScope(false)} type="button">{t.fe.scopeThis}</button>
              <button className="scope-all" onClick={() => resolveScope(true)} type="button">{t.fe.scopeAll}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
