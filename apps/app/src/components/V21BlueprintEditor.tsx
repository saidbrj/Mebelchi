import React, { useState } from "react";
import type { Cabinet, BackPanelMethod } from "../model/cabinet";
import type { Settings } from "../model/settings";

export interface V21State {
  // Tab 1: Constr
  backMode: BackPanelMethod; // "groove" | "overlay" | "none"
  grooveW: number; // 4mm
  grooveD: number; // 8mm
  grooveOff: number; // 12mm
  grooveT: number; // 3mm HDF
  bottomMode: "nakladnoe" | "vkladnoe";
  bottomT: number; // 16mm or 18mm
  topMode: "full" | "stretchers" | "none";
  topCw: number; // 80mm stretcher width
  plinthMode: "box" | "sides" | "legs";
  plinthH: number; // 120mm
  plinthOff: number; // 0mm
  shelfSb: number; // shelf setback offset
  worktopProfile: number; // 600mm
  worktopCorpus: number; // 520mm
  worktopSide: number; // 40mm
  mergeMode: "units" | "shared" | "auto";
  mergeMaxL: number; // 2750mm
  mergeDvr: number; // 2000mm
  mergeWt: number; // 45kg

  // Tab 2: Uzly
  jshelfHw: "confirmat" | "minifix" | "dowel";
  jbottomHw: "confirmat" | "minifix" | "dowel";
  partHw: "confirmat" | "minifix" | "dowel";
  partSame: boolean;
  confLen: number; // 50mm
  confDia: number; // 7mm
  eccStem: number; // 34mm
  eccDepth: number; // 12.5mm
  eccOff: number; // 65mm
  hingeInset: number; // 21.5mm
  hingeDepth: number; // 13mm
  hingeMarks: number; // 26mm
  slidesStep: number; // 32mm
  slidesFront: number; // 37mm
  slidesRow: number; // 91.5mm
  rodFront: number; // 250mm
  rodTop: number; // 100mm
}

export interface KSlot {
  id: string;
  th: number; // 1.0, 0.4, 2.0
  color: string;
  use: string;
}

const KPALETTE = ["#2f6fe4", "#12a5a0", "#8b5cf6", "#c8781f", "#c0392b"];

export function defaultV21State(cab?: Cabinet, settings?: Settings): V21State {
  return {
    backMode: cab?.backMount ?? (cab?.hasBack === false ? "none" : "groove"),
    grooveW: 4,
    grooveD: 8,
    grooveOff: cab?.grooveSetback ?? 12,
    grooveT: 3,
    bottomMode: cab?.bottomMode ?? "nakladnoe",
    bottomT: cab?.boardThickness ?? 16,
    topMode: cab?.topMode ?? "full",
    topCw: 80,
    plinthMode: cab?.plinthMode ?? "box",
    plinthH: 120,
    plinthOff: 0,
    shelfSb: 0,
    worktopProfile: 600,
    worktopCorpus: cab?.depth ? Math.max(300, cab.depth - 80) : 520,
    worktopSide: 40,
    mergeMode: "auto",
    mergeMaxL: settings?.sheetW ?? 2750,
    mergeDvr: 2000,
    mergeWt: 45,
    jshelfHw: settings?.jointFamily ?? "confirmat",
    jbottomHw: settings?.jointFamily ?? "confirmat",
    partHw: settings?.jointFamily ?? "confirmat",
    partSame: false,
    confLen: 50,
    confDia: 7,
    eccStem: 34,
    eccDepth: 12.5,
    eccOff: settings?.jointSetbackMm ?? 65,
    hingeInset: 21.5,
    hingeDepth: 13,
    hingeMarks: 26,
    slidesStep: 32,
    slidesFront: 37,
    slidesRow: 91.5,
    rodFront: 250,
    rodTop: 100,
  };
}

export function V21BlueprintEditor({
  cab,
  patchCab,
  onClose,
  settings,
  hideHeader = false,
}: {
  cab: Cabinet;
  patchCab: (patch: Partial<Cabinet>) => void;
  onClose: () => void;
  settings?: Settings;
  hideHeader?: boolean;
}) {
  const [tab, setTab] = useState<"constr" | "uzly" | "krom" | "purp">("constr");
  const [s, setS] = useState<V21State>(() => defaultV21State(cab, settings));

  // Kromka slots state
  const [kSlots, setKSlots] = useState<KSlot[]>([
    { id: "K1", th: 1.0, color: KPALETTE[0], use: "видимые торцы" },
    { id: "K2", th: 0.4, color: KPALETTE[1], use: "малозаметные" },
    { id: "K3", th: 2.0, color: KPALETTE[2], use: "фасады / закругления" },
  ]);

  // Active Role for Edge Map
  const [role, setRole] = useState<string>("shelf");
  const [roleMap, setRoleMap] = useState<Record<string, { f: string | number; b: string | number; l: string | number; r: string | number }>>({
    shelf: { f: "K1", b: 0, l: 0, r: 0 },
    door: { f: "K1", b: "K1", l: "K1", r: "K1" },
    side: { f: "K1", b: 0, l: "K2", r: "K2" },
    plinth: { f: "K2", b: 0, l: 0, r: 0 },
    bottom: { f: "K2", b: 0, l: "K1", r: "K1" },
    top: { f: "K1", b: 0, l: "K2", r: "K2" },
    divider: { f: "K1", b: 0, l: 0, r: 0 },
    drawer: { f: "K2", b: "K2", l: 0, r: 0 },
    back: { f: 0, b: 0, l: 0, r: 0 },
  });

  // Numpad state for editing dimension callouts
  const [pad, setPad] = useState<{ path: string; name: string; val: number; min: number; max: number; unit: string } | null>(null);
  const [padBuf, setPadBuf] = useState<string>("");

  const updateS = (patch: Partial<V21State>) => {
    const next = { ...s, ...patch };
    setS(next);

    // Live sync to cabinet model & 3D renderer!
    const cabPatch: Partial<Cabinet> = {};
    if (patch.backMode !== undefined) {
      cabPatch.backMount = patch.backMode;
      cabPatch.hasBack = patch.backMode !== "none";
    }
    if (patch.grooveOff !== undefined) {
      cabPatch.grooveSetback = patch.grooveOff;
    }
    if (patch.bottomT !== undefined) {
      cabPatch.boardThickness = patch.bottomT;
    }
    if (patch.bottomMode !== undefined) {
      cabPatch.bottomMode = patch.bottomMode;
    }
    if (patch.topMode !== undefined) {
      cabPatch.topMode = patch.topMode;
    }
    if (patch.plinthMode !== undefined) {
      cabPatch.plinthMode = patch.plinthMode;
    }
    if (Object.keys(cabPatch).length > 0) {
      patchCab(cabPatch);
    }
  };

  const openPad = (path: string, name: string, val: number, min: number, max: number, unit = "мм") => {
    setPad({ path, name, val, min, max, unit });
    setPadBuf(String(val));
  };

  const commitPad = () => {
    if (!pad) return;
    const v = parseFloat(padBuf);
    if (!isNaN(v)) {
      const clamped = Math.min(pad.max, Math.max(pad.min, v));
      updateS({ [pad.path]: clamped } as any);
    }
    setPad(null);
  };

  // SVG Drawing Helpers
  const INK = "#1e293b";
  const FILL = "#e2e8f0";
  const FILL2 = "#f1f5f9";
  const BLUE = "#2f6fe4";
  const GREY = "#64748b";

  const renderDimLabel = (path: string, name: string, val: number, min: number, max: number, x: number, y: number, align: "start" | "middle" | "end" = "middle") => {
    const text = `${val} (${name})`;
    const width = text.length * 7.5 + 10;
    const rx = align === "start" ? x - 5 : align === "end" ? x - width + 5 : x - width / 2;
    return (
      <g className="dimlab" style={{ cursor: "pointer" }} onClick={() => openPad(path, name, val, min, max)}>
        <rect x={rx} y={y - 15} width={width} height={22} fill="transparent" />
        <text x={x} y={y} textAnchor={align} fontSize={13} fontWeight={650} fill={BLUE} fontFamily="var(--sans, system-ui, sans-serif)">
          {text}
        </text>
      </g>
    );
  };

  const cycleEdge = (roleName: string, edgeKey: "f" | "b" | "l" | "r") => {
    const options = [0, ...kSlots.map((k) => k.id)];
    const current = roleMap[roleName]?.[edgeKey] ?? 0;
    const idx = options.indexOf(current as any);
    const nextVal = options[(idx + 1) % options.length];

    setRoleMap((prev) => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [edgeKey]: nextVal,
      },
    }));
  };

  return (
    <div className="v21-blueprint-sheet" style={{ background: "#f8fafc", borderRadius: hideHeader ? 0 : "24px 24px 0 0", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", color: "#0f172a", fontFamily: "var(--sans, system-ui, sans-serif)" }}>
      {/* Top Header */}
      {!hideHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
          <button onClick={onClose} type="button" style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>📐 Чертёж модуля: {cab.w}×{cab.h}×{cab.depth ?? 560} мм</h2>
          <button onClick={onClose} type="button" style={{ border: "none", background: "#00ac7a", color: "#fff", padding: "8px 18px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,172,122,0.25)" }}>Сохранить</button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 14, padding: 3, margin: "12px 16px 6px" }}>
        <button className={`v21-tab-btn ${tab === "constr" ? "on" : ""}`} onClick={() => setTab("constr")} type="button" style={{ flex: 1, border: "none", background: tab === "constr" ? "#ffffff" : "transparent", padding: "8px 0", borderRadius: 11, fontWeight: 650, fontSize: 13, color: tab === "constr" ? "#0f172a" : "#64748b", cursor: "pointer", boxShadow: tab === "constr" ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>Конструкция</button>
        <button className={`v21-tab-btn ${tab === "uzly" ? "on" : ""}`} onClick={() => setTab("uzly")} type="button" style={{ flex: 1, border: "none", background: tab === "uzly" ? "#ffffff" : "transparent", padding: "8px 0", borderRadius: 11, fontWeight: 650, fontSize: 13, color: tab === "uzly" ? "#0f172a" : "#64748b", cursor: "pointer", boxShadow: tab === "uzly" ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>Узлы</button>
        <button className={`v21-tab-btn ${tab === "krom" ? "on" : ""}`} onClick={() => setTab("krom")} type="button" style={{ flex: 1, border: "none", background: tab === "krom" ? "#ffffff" : "transparent", padding: "8px 0", borderRadius: 11, fontWeight: 650, fontSize: 13, color: tab === "krom" ? "#0f172a" : "#64748b", cursor: "pointer", boxShadow: tab === "krom" ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>Кромка</button>
        <button className={`v21-tab-btn ${tab === "purp" ? "on" : ""}`} onClick={() => setTab("purp")} type="button" style={{ flex: 1, border: "none", background: tab === "purp" ? "#ffffff" : "transparent", padding: "8px 0", borderRadius: 11, fontWeight: 650, fontSize: 13, color: tab === "purp" ? "#0f172a" : "#64748b", cursor: "pointer", boxShadow: tab === "purp" ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>Назначение</button>
      </div>

      {/* Sheet Content Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 40px" }}>
        {/* TAB 1: КОНСТРУКЦИЯ */}
        {tab === "constr" && (
          <>
            {/* Card 1: Задняя стенка */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Задняя стенка</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ДЕТАЛЬ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
                <button className={`segbtn ${s.backMode === "groove" ? "on" : ""}`} onClick={() => updateS({ backMode: "groove" })} style={{ flex: 1, border: "none", background: s.backMode === "groove" ? "#ffffff" : "transparent", color: s.backMode === "groove" ? "#0f172a" : "#64748b", boxShadow: s.backMode === "groove" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>В паз (4×8 мм)</button>
                <button className={`segbtn ${s.backMode === "overlay" ? "on" : ""}`} onClick={() => updateS({ backMode: "overlay" })} style={{ flex: 1, border: "none", background: s.backMode === "overlay" ? "#ffffff" : "transparent", color: s.backMode === "overlay" ? "#0f172a" : "#64748b", boxShadow: s.backMode === "overlay" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Внахлёст (16 мм)</button>
                <button className={`segbtn ${s.backMode === "none" ? "on" : ""}`} onClick={() => updateS({ backMode: "none" })} style={{ flex: 1, border: "none", background: s.backMode === "none" ? "#ffffff" : "transparent", color: s.backMode === "none" ? "#0f172a" : "#64748b", boxShadow: s.backMode === "none" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Без задника</button>
              </div>
              <svg viewBox="0 0 360 260" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {s.backMode === "groove" && (
                  <>
                    <path d={`M20,40 H250 V110 H${250 - s.grooveOff * 4} V${110 - s.grooveD * 4} H${250 - s.grooveOff * 4 - s.grooveW * 4} V110 H20 Z`} fill={FILL} stroke={INK} strokeWidth="1.5" />
                    <rect x={250 - s.grooveOff * 4 - s.grooveW * 2 - 6} y={110 - s.grooveD * 4 + 2} width={12} height={130} fill="#cbd5e1" stroke={INK} strokeWidth="1.2" />
                    <text x="70" y="80" fontSize="13" fontWeight="600" fill={INK}>Бок</text>
                    <text x={250 - s.grooveOff * 4 - 20} y="220" fontSize="12" fontWeight="600" fill={INK} textAnchor="end">Задник (ХДФ 3мм)</text>
                    {renderDimLabel("grooveOff", "Отступ", s.grooveOff, 6, 40, 220, 28, "middle")}
                    {renderDimLabel("grooveW", "Паз", s.grooveW, 4, 10, 160, 150, "end")}
                    {renderDimLabel("grooveD", "Глубина", s.grooveD, 4, 12, 280, 100, "start")}
                  </>
                )}
                {s.backMode === "overlay" && (
                  <>
                    <rect x="20" y="40" width="220" height="60" fill={FILL} stroke={INK} strokeWidth="1.5" />
                    <rect x="242" y="30" width="24" height="210" fill="#cbd5e1" stroke={INK} strokeWidth="1.5" />
                    <text x="70" y="78" fontSize="13" fontWeight="600" fill={INK}>Бок</text>
                    <text x="230" y="210" fontSize="12" fontWeight="600" fill={INK} textAnchor="end">Задник (16 мм ЛДСП)</text>
                  </>
                )}
                {s.backMode === "none" && (
                  <>
                    <rect x="20" y="40" width="220" height="60" fill={FILL} stroke={INK} strokeWidth="1.5" />
                    <text x="70" y="78" fontSize="13" fontWeight="600" fill={INK}>Бок</text>
                    <text x="180" y="200" fontSize="11" fill={GREY} textAnchor="middle">без задника — все элементы полной глубины</text>
                  </>
                )}
              </svg>
            </div>

            {/* Card 2: Дно */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Дно корпуса</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ДЕТАЛЬ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 }}>
                <button className={`segbtn ${s.bottomMode === "nakladnoe" ? "on" : ""}`} onClick={() => updateS({ bottomMode: "nakladnoe" })} style={{ flex: 1, border: "none", background: s.bottomMode === "nakladnoe" ? "#ffffff" : "transparent", color: s.bottomMode === "nakladnoe" ? "#0f172a" : "#64748b", boxShadow: s.bottomMode === "nakladnoe" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Накладное (Стандарт)</button>
                <button className={`segbtn ${s.bottomMode === "vkladnoe" ? "on" : ""}`} onClick={() => updateS({ bottomMode: "vkladnoe" })} style={{ flex: 1, border: "none", background: s.bottomMode === "vkladnoe" ? "#ffffff" : "transparent", color: s.bottomMode === "vkladnoe" ? "#0f172a" : "#64748b", boxShadow: s.bottomMode === "vkladnoe" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Вкладное</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 4px", fontSize: 12, color: "#475569" }}>
                <span style={{ fontWeight: 500 }}>Толщина плиты (ЛДСП):</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={`chip ${s.bottomT === 16 ? "sel" : ""}`} onClick={() => updateS({ bottomT: 16 })} style={{ padding: "5px 12px", borderRadius: 8, border: s.bottomT === 16 ? "1px solid #00ac7a" : "1px solid #cbd5e1", background: s.bottomT === 16 ? "#00ac7a" : "#ffffff", color: s.bottomT === 16 ? "#fff" : "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>16 мм</button>
                  <button className={`chip ${s.bottomT === 18 ? "sel" : ""}`} onClick={() => updateS({ bottomT: 18 })} style={{ padding: "5px 12px", borderRadius: 8, border: s.bottomT === 18 ? "1px solid #00ac7a" : "1px solid #cbd5e1", background: s.bottomT === 18 ? "#00ac7a" : "#ffffff", color: s.bottomT === 18 ? "#fff" : "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>18 мм</button>
                </div>
              </div>
            </div>

            {/* Card 3: Верх */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Верх корпуса</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ДЕТАЛЬ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
                <button className={`segbtn ${s.topMode === "full" ? "on" : ""}`} onClick={() => updateS({ topMode: "full" })} style={{ flex: 1, border: "none", background: s.topMode === "full" ? "#ffffff" : "transparent", color: s.topMode === "full" ? "#0f172a" : "#64748b", boxShadow: s.topMode === "full" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Крышка</button>
                <button className={`segbtn ${s.topMode === "stretchers" ? "on" : ""}`} onClick={() => updateS({ topMode: "stretchers" })} style={{ flex: 1, border: "none", background: s.topMode === "stretchers" ? "#ffffff" : "transparent", color: s.topMode === "stretchers" ? "#0f172a" : "#64748b", boxShadow: s.topMode === "stretchers" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>2 царги (80мм)</button>
                <button className={`segbtn ${s.topMode === "none" ? "on" : ""}`} onClick={() => updateS({ topMode: "none" })} style={{ flex: 1, border: "none", background: s.topMode === "none" ? "#ffffff" : "transparent", color: s.topMode === "none" ? "#0f172a" : "#64748b", boxShadow: s.topMode === "none" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Нет</button>
              </div>
            </div>

            {/* Card 4: Цоколь */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Цоколь и Опора</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ОПОРА</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
                <button className={`segbtn ${s.plinthMode === "box" ? "on" : ""}`} onClick={() => updateS({ plinthMode: "box" })} style={{ flex: 1, border: "none", background: s.plinthMode === "box" ? "#ffffff" : "transparent", color: s.plinthMode === "box" ? "#0f172a" : "#64748b", boxShadow: s.plinthMode === "box" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Коробка (120 мм)</button>
                <button className={`segbtn ${s.plinthMode === "sides" ? "on" : ""}`} onClick={() => updateS({ plinthMode: "sides" })} style={{ flex: 1, border: "none", background: s.plinthMode === "sides" ? "#ffffff" : "transparent", color: s.plinthMode === "sides" ? "#0f172a" : "#64748b", boxShadow: s.plinthMode === "sides" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Боки до пола</button>
                <button className={`segbtn ${s.plinthMode === "legs" ? "on" : ""}`} onClick={() => updateS({ plinthMode: "legs" })} style={{ flex: 1, border: "none", background: s.plinthMode === "legs" ? "#ffffff" : "transparent", color: s.plinthMode === "legs" ? "#0f172a" : "#64748b", boxShadow: s.plinthMode === "legs" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ножки</button>
              </div>
            </div>

            {/* Card 5: Полка */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Полка (Расчёт глубины)</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ВЫЧИСЛЕНИЕ</span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Глубина полки автоматически выводится из способа задней стенки:<br />
                • <b>В паз</b> → <code>-17 мм</code> (отступ 12 + паз 4 + зазор 1)<br />
                • <b>Внахлёст</b> → <code>-2 мм</code> (зазор от фасада)<br />
                • <b>Без задника</b> → полная глубина корпуса
              </div>
            </div>

            {/* Card 6: Столешница */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Столешница (Профиль 600мм)</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ПОКУПНОЙ</span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Профиль покупной (600 мм). Глубина корпуса: <code>{s.worktopCorpus} мм</code>.<br />
                Передний свес выводится: <code>{s.worktopProfile - s.worktopCorpus} мм</code> (Карасу 80 мм).
              </div>
            </div>
          </>
        )}

        {/* TAB 2: УЗЛЫ И КРЕПЁЖ */}
        {tab === "uzly" && (
          <>
            {/* Card 8: Полка ⊥ Бок */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Узел: Полка ⊥ Бок</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>КРЕПЁЖ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 }}>
                <button className={`segbtn ${s.jshelfHw === "confirmat" ? "on" : ""}`} onClick={() => updateS({ jshelfHw: "confirmat" })} style={{ flex: 1, border: "none", background: s.jshelfHw === "confirmat" ? "#ffffff" : "transparent", color: s.jshelfHw === "confirmat" ? "#0f172a" : "#64748b", boxShadow: s.jshelfHw === "confirmat" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Конфирмат 7×50</button>
                <button className={`segbtn ${s.jshelfHw === "minifix" ? "on" : ""}`} onClick={() => updateS({ jshelfHw: "minifix" })} style={{ flex: 1, border: "none", background: s.jshelfHw === "minifix" ? "#ffffff" : "transparent", color: s.jshelfHw === "minifix" ? "#0f172a" : "#64748b", boxShadow: s.jshelfHw === "minifix" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Минификс Ø15</button>
                <button className={`segbtn ${s.jshelfHw === "dowel" ? "on" : ""}`} onClick={() => updateS({ jshelfHw: "dowel" })} style={{ flex: 1, border: "none", background: s.jshelfHw === "dowel" ? "#ffffff" : "transparent", color: s.jshelfHw === "dowel" ? "#0f172a" : "#64748b", boxShadow: s.jshelfHw === "dowel" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Шкант Ø8</button>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                {s.jshelfHw === "confirmat" && "Конфирмат 7×50 мм: сквозное отверстие Ø7 мм в боку, Ø4.5 мм в торце полки."}
                {s.jshelfHw === "minifix" && "Минификс Ø15×12.5 мм + Шкант Ø8×30 мм: скрытый крепёж для ЧПУ станка."}
                {s.jshelfHw === "dowel" && "Шкант Ø8×30 мм: клеевое скрытое соединение."}
              </div>
            </div>

            {/* Card 9: Дно ⊥ Бок */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Узел: Дно ⊥ Бок</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>КРЕПЁЖ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
                <button className={`segbtn ${s.jbottomHw === "confirmat" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "confirmat" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "confirmat" ? "#ffffff" : "transparent", color: s.jbottomHw === "confirmat" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "confirmat" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Конфирмат</button>
                <button className={`segbtn ${s.jbottomHw === "minifix" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "minifix" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "minifix" ? "#ffffff" : "transparent", color: s.jbottomHw === "minifix" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "minifix" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Минификс</button>
                <button className={`segbtn ${s.jbottomHw === "dowel" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "dowel" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "dowel" ? "#ffffff" : "transparent", color: s.jbottomHw === "dowel" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "dowel" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Шкант</button>
              </div>
            </div>

            {/* Card 10: Петля Ø35 */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Присадка Петли Ø35</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ПРИСАДКА</span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Чашка: <code>Ø35×13 мм</code> на отступе <code>21.5 мм</code> от края фасада.<br />
                Межцентровое саморезов: <code>45/48 мм</code>, накёрнивание <code>±26 мм</code>.
              </div>
            </div>

            {/* Card 11: Направляющие System-32 */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Присадка Направляющих (System-32)</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ПРИСАДКА</span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Первое отверстие: <code>37 мм</code> от переднего края бока.<br />
                Шаг отверстий: <code>32 мм</code>. Первый ряд от дна: <code>91.5 мм</code>.
              </div>
            </div>

            {/* Card 14: Перегородка */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Столкновения на Перегородке</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>ПРОВЕРКА</span>
              </div>
              <div style={{ fontSize: 12, color: s.jshelfHw === "confirmat" ? "#d97706" : "#059669", fontWeight: 600, lineHeight: 1.5 }}>
                {s.jshelfHw === "confirmat" ? "⚠ При конфирмате с двух сторон в одну перегородку 16мм конфирматы столкнутся! Нужен смещённый шаг 32мм или Минификс." : "✓ Минификс не соприкасается внутри перегородки 16мм."}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: КРОМКА И СЛОТЫ */}
        {tab === "krom" && (
          <>
            {/* Card 16: Слоты */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Кромка · Управление слотами</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>СЛОТЫ</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                {kSlots.map((sl) => (
                  <div key={sl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ background: sl.color, color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{sl.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 650, color: "#0f172a" }}>{sl.th} мм</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>({sl.use})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 17: Кромка по ролям */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Карта кромок по ролям деталей</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>РОЛИ</span>
              </div>

              {/* Role Picker Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  { id: "shelf", label: "Полка" },
                  { id: "door", label: "Фасад" },
                  { id: "side", label: "Бок" },
                  { id: "plinth", label: "Цоколь" },
                  { id: "bottom", label: "Дно" },
                  { id: "top", label: "Крышка" },
                  { id: "divider", label: "Перегородка" },
                  { id: "drawer", label: "Ящик" },
                  { id: "back", label: "Задник" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    style={{
                      border: role === r.id ? "1px solid #00ac7a" : "1px solid #cbd5e1",
                      background: role === r.id ? "#00ac7a" : "#ffffff",
                      color: role === r.id ? "#fff" : "#334155",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Interactive Panel Diagram */}
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14, border: "1px solid #e2e8f0", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                  Тапните любой торец детали на схеме, чтобы сменить кромку:
                </div>
                <svg viewBox="0 0 320 200" style={{ width: "100%", height: "auto", display: "block" }}>
                  {/* Panel Body */}
                  <rect x="70" y="40" width="180" height="120" fill={FILL} stroke="#94a3b8" strokeWidth="1" />
                  <text x="160" y="105" fontSize="16" fontWeight="700" textAnchor="middle" fill="#0f172a">{role.toUpperCase()}</text>

                  {/* Front Edge (Bottom line) */}
                  <g style={{ cursor: "pointer" }} onClick={() => cycleEdge(role, "f")}>
                    <line x1="70" y1="160" x2="250" y2="160" stroke={roleMap[role]?.f ? KPALETTE[0] : "#cbd5e1"} strokeWidth={roleMap[role]?.f ? "6" : "2"} strokeDasharray={roleMap[role]?.f ? undefined : "5 4"} />
                    <text x="160" y="180" fontSize="12" fontWeight="700" fill={BLUE} textAnchor="middle">
                      Передний: {roleMap[role]?.f || "Без кромки"}
                    </text>
                  </g>

                  {/* Back Edge (Top line) */}
                  <g style={{ cursor: "pointer" }} onClick={() => cycleEdge(role, "b")}>
                    <line x1="70" y1="40" x2="250" y2="40" stroke={roleMap[role]?.b ? KPALETTE[1] : "#cbd5e1"} strokeWidth={roleMap[role]?.b ? "6" : "2"} strokeDasharray={roleMap[role]?.b ? undefined : "5 4"} />
                    <text x="160" y="28" fontSize="12" fontWeight="700" fill={BLUE} textAnchor="middle">
                      Задний: {roleMap[role]?.b || "Без кромки"}
                    </text>
                  </g>

                  {/* Left Edge */}
                  <g style={{ cursor: "pointer" }} onClick={() => cycleEdge(role, "l")}>
                    <line x1="70" y1="40" x2="70" y2="160" stroke={roleMap[role]?.l ? KPALETTE[2] : "#cbd5e1"} strokeWidth={roleMap[role]?.l ? "6" : "2"} strokeDasharray={roleMap[role]?.l ? undefined : "5 4"} />
                    <text x="20" y="105" fontSize="11" fontWeight="700" fill={BLUE} textAnchor="middle">
                      Лев: {roleMap[role]?.l || "0"}
                    </text>
                  </g>

                  {/* Right Edge */}
                  <g style={{ cursor: "pointer" }} onClick={() => cycleEdge(role, "r")}>
                    <line x1="250" y1="40" x2="250" y2="160" stroke={roleMap[role]?.r ? KPALETTE[2] : "#cbd5e1"} strokeWidth={roleMap[role]?.r ? "6" : "2"} strokeDasharray={roleMap[role]?.r ? undefined : "5 4"} />
                    <text x="300" y="105" fontSize="11" fontWeight="700" fill={BLUE} textAnchor="middle">
                      Прав: {roleMap[role]?.r || "0"}
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: НАЗНАЧЕНИЕ */}
        {tab === "purp" && (
          <>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Одежда (Штанга)</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Высота секции: <code>≥ 1000 мм</code> (короткая) / <code>≥ 1400 мм</code> (длинная)<br />
                • Глубина корпуса: <code>≥ 500 мм</code> (плечики 450мм + запас)<br />
                • Диаметр штанги: <code>Ø25 мм</code>, отступ от переднего края <code>250 мм</code>
              </div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Книги (Полки)</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Шаг полок: <code>280–320 мм</code><br />
                • Пролёт полки: <code>≤ 800 мм</code> во избежание прогиба ЛДСП 16мм
              </div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Обувь (Полки)</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Шаг полок: <code>130–180 мм</code> (наклонные/прямые)
              </div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Бойлер / Техника</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Зазоры вентиляции: <code>+50 мм</code> по ширине и высоте от габаритов прибора
              </div>
            </div>
          </>
        )}
      </div>

      {/* NUMPAD MODAL */}
      {pad && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)", zIndex: 150, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#ffffff", width: "100%", maxWidth: 420, borderRadius: "24px 24px 0 0", padding: "20px 20px 28px", boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{pad.name}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: BLUE }}>{padBuf} <small style={{ fontSize: 14, color: GREY }}>{pad.unit}</small></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    if (k === "⌫") setPadBuf((b) => b.slice(0, -1) || "0");
                    else if (k === ".") setPadBuf((b) => (b.includes(".") ? b : b + "."));
                    else setPadBuf((b) => (b === "0" ? k : b + k));
                  }}
                  style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 14, fontSize: 20, fontWeight: 650, color: "#0f172a", padding: "14px 0", cursor: "pointer", transition: "all 0.1s ease" }}
                >
                  {k}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setPad(null)} style={{ flex: 1, border: "1px solid #e2e8f0", background: "#f1f5f9", color: "#475569", padding: 14, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Отмена</button>
              <button onClick={commitPad} style={{ flex: 2, border: "none", background: "#00ac7a", color: "#fff", padding: 14, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,172,122,0.3)" }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
