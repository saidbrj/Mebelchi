import React, { useState } from "react";
import type { Cabinet, BackPanelMethod } from "../model/cabinet";
import { constructionOf, shopConstruction } from "../model/construction";
import type { Settings } from "../model/settings";
import { GolaSidePanel } from "./GolaSidePanel";

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
  plinthMode: "box" | "sides" | "legs" | "none";
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
  // the shop's standing build (Настройки → Стандарт цеха) with this module's overrides on top,
  // so opening the studio on an untouched cabinet shows what the shop actually builds
  const con = cab ? constructionOf(cab) : shopConstruction();
  return {
    backMode: con.backMount,
    grooveW: 4,
    grooveD: 8,
    grooveOff: con.grooveSetback,
    grooveT: 3,
    bottomMode: con.bottomMode,
    bottomT: con.boardThickness,
    topMode: con.topMode,
    topCw: 80,
    plinthMode: con.plinthMode,
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
      // the UI only ever offers 16 or 18 — narrow to the model's literal type
      cabPatch.boardThickness = patch.bottomT === 18 ? 18 : 16;
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

  // SVG Hardware Technical Illustration Helpers
  const renderFastenerSVG = (type: "confirmat" | "minifix" | "dowel") => (
    <svg viewBox="0 0 340 160" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      {/* Side board (Vertical) */}
      <rect x="30" y="20" width="50" height="120" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
      <text x="55" y="45" fontSize="11" fontWeight="600" fill="#64748b" textAnchor="middle">Бок 16мм</text>

      {/* Shelf board (Horizontal) */}
      <rect x="80" y="55" width="220" height="50" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.5" />
      <text x="190" y="85" fontSize="11" fontWeight="600" fill="#64748b" textAnchor="middle">Полка / Дно 16мм</text>

      {/* FASTENER 1: CONFIRMAT (Euro-screw Ø7x50) */}
      {type === "confirmat" && (
        <>
          {/* Screw hole in side board Ø7 */}
          <rect x="30" y="75" width="50" height="10" fill="#ffffff" stroke="#c2410c" strokeWidth="1" strokeDasharray="3 2" />
          {/* Hole in shelf board Ø4.5 x 50mm */}
          <rect x="80" y="76.5" width="110" height="7" fill="#ffffff" stroke="#c2410c" strokeWidth="1" strokeDasharray="3 2" />

          {/* Confirmat Screw Body */}
          <path d="M22,73 h8 v14 h-8 z" fill="#ea580c" stroke="#1e293b" strokeWidth="1.2" /> {/* Head */}
          <line x1="26" y1="75" x2="26" y2="85" stroke="#ffffff" strokeWidth="1.5" /> {/* Hex socket */}
          <rect x="30" y="76" width="50" height="8" fill="#f97316" stroke="#1e293b" strokeWidth="1" /> {/* Smooth shank Ø7 */}
          <rect x="80" y="77" width="100" height="6" fill="#fb923c" stroke="#1e293b" strokeWidth="1" /> {/* Threaded body Ø5 */}

          {/* Thread ridges */}
          {[90, 105, 120, 135, 150, 165].map((x) => (
            <line key={x} x1={x} y1="75" x2={x + 4} y2="85" stroke="#c2410c" strokeWidth="1.2" />
          ))}

          {/* Technical Callouts & Labels */}
          <text x="55" y="105" fontSize="10" fontWeight="700" fill="#c2410c" textAnchor="middle">Ø7 мм</text>
          <text x="130" y="105" fontSize="10" fontWeight="700" fill="#c2410c" textAnchor="middle">Ø4.5×50 мм</text>
          <text x="210" y="38" fontSize="11" fontWeight="700" fill="#0f172a">Евровинт (Конфирмат 7×50)</text>
          <text x="210" y="52" fontSize="10" fill="#64748b">Сквозная сверловка, силовой крепёж</text>
        </>
      )}

      {/* FASTENER 2: MINIFIX (Eccentric Cam Ø15 + Dowel Ø8) */}
      {type === "minifix" && (
        <>
          {/* Minifix Cam Cylinder Ø15 x 12.5mm */}
          <circle cx="170" cy="80" r="16" fill="#7c3aed" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="170" cy="80" r="12" fill="#a78bfa" stroke="#1e293b" strokeWidth="1" />
          <path d="M164,80 h12 M170,74 v12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" /> {/* Cross drive */}

          {/* Connecting Rod Stem */}
          <rect x="65" y="76" width="90" height="8" fill="#6d28d9" stroke="#1e293b" strokeWidth="1" />
          {/* Side sleeve */}
          <rect x="55" y="74" width="10" height="12" fill="#4c1d95" stroke="#1e293b" strokeWidth="1" />

          {/* Wooden Dowel Ø8x30 alongside */}
          <rect x="65" y="115" width="55" height="10" fill="#d97706" rx="2" stroke="#1e293b" strokeWidth="1" />
          <line x1="80" y1="115" x2="80" y2="125" stroke="#78350f" strokeWidth="1" strokeDasharray="2 2" />

          {/* Callouts */}
          <text x="170" y="115" fontSize="10" fontWeight="700" fill="#6d28d9" textAnchor="middle">Ø15×12.5 мм (отступ 34)</text>
          <text x="92" y="140" fontSize="10" fontWeight="700" fill="#b45309" textAnchor="middle">Шкант Ø8×30 мм</text>
          <text x="210" y="38" fontSize="11" fontWeight="700" fill="#0f172a">Минификс Ø15 + Шкант</text>
          <text x="210" y="52" fontSize="10" fill="#64748b">Скрытый разборный крепёж (ЧПУ)</text>
        </>
      )}

      {/* FASTENER 3: DOWEL (Wooden Fluted Dowel Ø8x30) */}
      {type === "dowel" && (
        <>
          {/* Dowel pin embedded across joint */}
          <rect x="55" y="72" width="60" height="16" fill="#b45309" rx="3" stroke="#1e293b" strokeWidth="1.5" />

          {/* Fluting lines */}
          <line x1="60" y1="76" x2="110" y2="76" stroke="#fbbf24" strokeWidth="1" />
          <line x1="60" y1="80" x2="110" y2="80" stroke="#fbbf24" strokeWidth="1" />
          <line x1="60" y1="84" x2="110" y2="84" stroke="#fbbf24" strokeWidth="1" />

          {/* Joint line */}
          <line x1="80" y1="65" x2="80" y2="95" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />

          {/* Callouts */}
          <text x="80" y="110" fontSize="10" fontWeight="700" fill="#b45309" textAnchor="middle">Ø8×30 мм (15мм в бок / 15мм в полку)</text>
          <text x="200" y="38" fontSize="11" fontWeight="700" fill="#0f172a">Шкант берёзовый Ø8×30</text>
          <text x="200" y="52" fontSize="10" fill="#64748b">Клеевое неразборное соединение</text>
        </>
      )}
    </svg>
  );

  const renderHingeSVG = () => (
    <svg viewBox="0 0 340 150" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      {/* Door Front Board (Vertical) */}
      <rect x="25" y="15" width="40" height="120" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
      <text x="45" y="35" fontSize="10" fontWeight="600" fill="#64748b" textAnchor="middle">Фасад</text>

      {/* Hinge Cup Bore Ø35 x 13mm */}
      <rect x="25" y="55" width="26" height="40" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
      <circle cx="38" cy="75" r="14" fill="#0284c7" stroke="#1e293b" strokeWidth="1" />
      <text x="38" y="79" fontSize="10" fontWeight="700" fill="#ffffff" textAnchor="middle">Ø35</text>

      {/* Cabinet Side Panel */}
      <rect x="110" y="15" width="180" height="40" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.5" />
      <text x="200" y="32" fontSize="10" fontWeight="600" fill="#64748b" textAnchor="middle">Бок корпуса (планка 37мм)</text>

      {/* Hinge Arm & Mounting Plate */}
      <path d="M51,65 Q90,65 120,40" fill="none" stroke="#0284c7" strokeWidth="3" />
      <rect x="125" y="25" width="30" height="12" fill="#0284c7" rx="2" stroke="#1e293b" strokeWidth="1" />

      {/* Dimensions */}
      <text x="45" y="112" fontSize="10" fontWeight="700" fill="#0284c7" textAnchor="middle">21.5 мм (центр)</text>
      <text x="140" y="55" fontSize="10" fontWeight="700" fill="#0284c7" textAnchor="middle">37 мм от края</text>
      <text x="210" y="90" fontSize="11" fontWeight="700" fill="#0f172a">Чашка Ø35×13 мм</text>
      <text x="210" y="106" fontSize="10" fill="#64748b">Саморезы 45/48 мм, отступ 21.5 мм</text>
    </svg>
  );

  const renderSlidesSVG = () => (
    <svg viewBox="0 0 340 150" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      {/* Cabinet Side Wall */}
      <rect x="20" y="15" width="300" height="120" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.5" />

      {/* System-32 Grid Line */}
      <line x1="20" y1="75" x2="320" y2="75" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />

      {/* System-32 Holes */}
      {[60, 100, 140, 180, 220, 260].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="75" r="3.5" fill={i === 0 ? "#00ac7a" : "#cbd5e1"} stroke="#1e293b" strokeWidth="1" />
          <text x={x} y="63" fontSize="9" fontWeight="600" fill="#64748b" textAnchor="middle">{i === 0 ? "37 мм" : `+${i * 32}`}</text>
        </g>
      ))}
      {/* Slide Rail Representation */}
      <rect x="55" y="71" width="220" height="8" fill="#00ac7a" opacity="0.8" rx="2" stroke="#1e293b" strokeWidth="1" />

      {/* Dimension Callouts */}
      <text x="40" y="110" fontSize="10" fontWeight="700" fill="#00ac7a">1-е отв: 37 мм</text>
      <text x="160" y="110" fontSize="10" fontWeight="700" fill="#00ac7a">Шаг: 32 мм (System-32)</text>
      <text x="160" y="128" fontSize="10" fill="#64748b">Первый ряд от дна: 91.5 мм</text>
    </svg>
  );

  // Technical SVG Illustrations for Construction & Purpose
  const renderBottomSVG = (mode: "nakladnoe" | "vkladnoe", t: number) => (
    <svg viewBox="0 0 340 130" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      {mode === "nakladnoe" ? (
        <>
          <rect x="40" y="30" width="40" height="50" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="260" y="30" width="40" height="50" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="40" y="80" width="260" height={t === 18 ? 20 : 16} fill="#00ac7a" stroke="#1e293b" strokeWidth="1.5" />
          <text x="170" y="94" fontSize="11" fontWeight="700" fill="#ffffff" textAnchor="middle">Накладное дно ({t} мм ЛДСП)</text>
          <text x="170" y="45" fontSize="11" fontWeight="600" fill="#64748b" textAnchor="middle">Бока опираются на дно</text>
        </>
      ) : (
        <>
          <rect x="40" y="20" width="40" height="80" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="260" y="20" width="40" height="80" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="80" y={80 - 16} width="180" height={t === 18 ? 20 : 16} fill="#2f6fe4" stroke="#1e293b" strokeWidth="1.5" />
          <text x="170" y="78" fontSize="11" fontWeight="700" fill="#ffffff" textAnchor="middle">Вкладное дно ({t} мм)</text>
          <text x="170" y="45" fontSize="11" fontWeight="600" fill="#64748b" textAnchor="middle">Дно между боками</text>
        </>
      )}
    </svg>
  );

  const renderTopSVG = (mode: "full" | "stretchers" | "none") => (
    <svg viewBox="0 0 340 130" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      <rect x="40" y="45" width="40" height="65" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
      <rect x="260" y="45" width="40" height="65" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />

      {mode === "full" && (
        <>
          <rect x="80" y="45" width="180" height="16" fill="#00ac7a" stroke="#1e293b" strokeWidth="1.5" />
          <text x="170" y="57" fontSize="11" fontWeight="700" fill="#ffffff" textAnchor="middle">Сплошная крышка</text>
          <text x="170" y="90" fontSize="11" fill="#64748b" textAnchor="middle">Закрытый верх корпуса</text>
        </>
      )}

      {mode === "stretchers" && (
        <>
          <rect x="80" y="45" width="45" height="16" fill="#2f6fe4" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="215" y="45" width="45" height="16" fill="#2f6fe4" stroke="#1e293b" strokeWidth="1.5" />
          <text x="102" y="57" fontSize="9" fontWeight="700" fill="#ffffff" textAnchor="middle">Царга</text>
          <text x="237" y="57" fontSize="9" fontWeight="700" fill="#ffffff" textAnchor="middle">Царга</text>
          <text x="170" y="90" fontSize="11" fill="#64748b" textAnchor="middle">2 царги по 80мм (экономия ЛДСП)</text>
        </>
      )}

      {mode === "none" && (
        <>
          <line x1="80" y1="45" x2="260" y2="45" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
          <text x="170" y="75" fontSize="11" fontWeight="600" fill="#ef4444" textAnchor="middle">Без крышки (открытый верх)</text>
          <text x="170" y="95" fontSize="10" fill="#64748b" textAnchor="middle">Для накладной столешницы или антресоли</text>
        </>
      )}
    </svg>
  );

  const renderPlinthSVG = (mode: "box" | "sides" | "legs") => (
    <svg viewBox="0 0 340 140" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      <rect x="40" y="30" width="260" height="16" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />

      {mode === "box" && (
        <>
          <rect x="60" y="46" width="220" height="55" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
          <text x="170" y="78" fontSize="11" fontWeight="700" fill="#ffffff" textAnchor="middle">Цокольная коробка (120 мм)</text>
          <text x="170" y="120" fontSize="10" fill="#64748b" textAnchor="middle">Замкнутый деревянный цоколь</text>
        </>
      )}

      {mode === "sides" && (
        <>
          <rect x="40" y="46" width="16" height="65" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="284" y="46" width="16" height="65" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
          <text x="170" y="78" fontSize="11" fontWeight="700" fill="#0f172a" textAnchor="middle">Бока корпуса до пола</text>
          <text x="170" y="120" fontSize="10" fill="#64748b" textAnchor="middle">Боковые стенки стоят непосредственно на полу</text>
        </>
      )}

      {mode === "legs" && (
        <>
          <rect x="70" y="46" width="18" height="55" fill="#1e293b" rx="2" />
          <rect x="252" y="46" width="18" height="55" fill="#1e293b" rx="2" />
          <circle cx="79" cy="101" r="12" fill="#475569" stroke="#1e293b" strokeWidth="1" />
          <circle cx="261" cy="101" r="12" fill="#475569" stroke="#1e293b" strokeWidth="1" />
          <text x="170" y="75" fontSize="11" fontWeight="700" fill="#00ac7a" textAnchor="middle">Регулируемые ножки 100/120 мм</text>
          <text x="170" y="125" fontSize="10" fill="#64748b" textAnchor="middle">Пластиковые опоры + съёмный цоколь</text>
        </>
      )}
    </svg>
  );

  const renderShelfDepthSVG = (backMode: string) => (
    <svg viewBox="0 0 340 140" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      <rect x="30" y="25" width="280" height="90" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4 2" />

      {backMode === "groove" && (
        <rect x="50" y="25" width="6" height="90" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1" />
      )}
      {backMode === "overlay" && (
        <rect x="30" y="25" width="16" height="90" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1" />
      )}

      <rect x={backMode === "groove" ? 62 : backMode === "overlay" ? 48 : 34} y="65" width={backMode === "groove" ? 230 : backMode === "overlay" ? 245 : 260} height="14" fill="#00ac7a" stroke="#1e293b" strokeWidth="1.2" />

      <text x="170" y="76" fontSize="10" fontWeight="700" fill="#ffffff" textAnchor="middle">
        {backMode === "groove" ? "Глубина полки (-17 мм)" : backMode === "overlay" ? "Глубина полки (-2 мм)" : "Полная глубина полки"}
      </text>
      <text x="170" y="105" fontSize="10" fill="#475569" textAnchor="middle">
        {backMode === "groove" && "Отступ 12мм + паз 4мм + зазор 1мм = -17мм от глубины корпуса"}
        {backMode === "overlay" && "Зазор 2мм от переднего края фасада"}
        {backMode === "none" && "Без задника — полка во всю глубину"}
      </text>
    </svg>
  );

  const renderWorktopSVG = (worktopCorpus: number, worktopProfile: number) => (
    <svg viewBox="0 0 340 140" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      <rect x="40" y="55" width="220" height="60" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
      <text x="150" y="90" fontSize="11" fontWeight="600" fill="#64748b" textAnchor="middle">Корпус {worktopCorpus} мм</text>

      <path d="M30,35 H290 Q296,35 296,41 V49 H30 Z" fill="#00ac7a" stroke="#1e293b" strokeWidth="1.5" />
      <text x="160" y="46" fontSize="11" fontWeight="700" fill="#ffffff" textAnchor="middle">Столешница {worktopProfile} мм (Профиль 600)</text>

      <line x1="260" y1="55" x2="296" y2="55" stroke="#ef4444" strokeWidth="2" />
      <text x="278" y="75" fontSize="10" fontWeight="700" fill="#ef4444" textAnchor="middle">Свес {worktopProfile - worktopCorpus} мм</text>
    </svg>
  );

  const renderPurposeSVG = (type: "wardrobe" | "books" | "shoes" | "boiler") => (
    <svg viewBox="0 0 340 140" style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 10 }}>
      <rect x="30" y="15" width="280" height="110" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" />

      {type === "wardrobe" && (
        <>
          <line x1="50" y1="35" x2="290" y2="35" stroke="#475569" strokeWidth="3" />
          <circle cx="170" cy="35" r="5" fill="#00ac7a" />
          <path d="M170,40 L140,65 H200 Z" fill="none" stroke="#00ac7a" strokeWidth="2" />
          <text x="170" y="85" fontSize="11" fontWeight="700" fill="#0f172a" textAnchor="middle">Штанга Ø25 мм (отступ 250 мм)</text>
          <text x="170" y="105" fontSize="10" fill="#64748b" textAnchor="middle">Секция: ≥ 1000 мм (короткая) / ≥ 1400 мм (длинная)</text>
        </>
      )}

      {type === "books" && (
        <>
          <line x1="30" y1="55" x2="310" y2="55" stroke="#2f6fe4" strokeWidth="3" />
          <line x1="30" y1="95" x2="310" y2="95" stroke="#2f6fe4" strokeWidth="3" />
          {[60, 75, 90, 105, 200, 215, 230].map((x) => (
            <rect key={x} x={x} y="25" width="12" height="30" fill="#3b82f6" stroke="#1e293b" strokeWidth="1" />
          ))}
          <text x="170" y="80" fontSize="11" fontWeight="700" fill="#2f6fe4" textAnchor="middle">Шаг полок: 280–320 мм</text>
          <text x="170" y="115" fontSize="10" fill="#64748b" textAnchor="middle">Пролёт полки ≤ 800 мм (без прогиба 16мм)</text>
        </>
      )}

      {type === "shoes" && (
        <>
          <line x1="50" y1="45" x2="270" y2="65" stroke="#d97706" strokeWidth="3" />
          <line x1="50" y1="85" x2="270" y2="105" stroke="#d97706" strokeWidth="3" />
          <text x="170" y="35" fontSize="11" fontWeight="700" fill="#b45309" textAnchor="middle">Полки для обуви (Наклонные / Прямые)</text>
          <text x="170" y="80" fontSize="10" fontWeight="600" fill="#475569" textAnchor="middle">Шаг полок: 130–180 мм</text>
        </>
      )}

      {type === "boiler" && (
        <>
          <rect x="100" y="30" width="140" height="80" fill="#f1f5f9" stroke="#059669" strokeWidth="1.5" strokeDasharray="3 2" />
          <rect x="120" y="40" width="100" height="60" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1" />
          <text x="170" y="75" fontSize="11" fontWeight="700" fill="#059669" textAnchor="middle">Зазор вентиляции: +50 мм</text>
          <text x="170" y="100" fontSize="10" fill="#64748b" textAnchor="middle">Оснащение для котла / бойлера / техники</text>
        </>
      )}
    </svg>
  );

  return (
    <div className="v21-blueprint-sheet" style={{ background: "#ffffffff", borderRadius: hideHeader ? 0 : "24px 24px 0 0", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", color: "#0f172a", fontFamily: "var(--sans, system-ui, sans-serif)" }}>
      {/* Top Header */}
      {!hideHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
          <button onClick={onClose} type="button" style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>📐 Чертёж модуля: {cab.w}×{cab.h}×{cab.depth ?? 560} мм</h2>
          <button onClick={onClose} type="button" style={{ border: "none", background: "#00ac7a", color: "#fff", padding: "8px 18px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,172,122,0.25)" }}>Сохранить</button>
        </div>
      )}

      {/* Tabs Switcher — like the main «Стиль» tabs: active tab = icon + label, the rest icon-only */}
      {(() => {
        const TABS: { id: typeof tab; name: string; icon: React.ReactNode }[] = [
          { id: "constr", name: "Конструкция", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="4" y="3" width="16" height="18" rx="1.5" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /></svg>) },
          { id: "uzly", name: "Узлы", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="12" cy="12" r="7" /><line x1="8.5" y1="12" x2="15.5" y2="12" /></svg>) },
          { id: "krom", name: "Кромка", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="4" y="4" width="16" height="16" rx="1.5" /><line x1="19.2" y1="4" x2="19.2" y2="20" strokeWidth="3.4" /></svg>) },
          { id: "purp", name: "Назначение", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="5" y="4" width="14" height="16" rx="1.5" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>) },
        ];
        return (
          <div className="style-tabs" style={{ marginTop: 12 }}>
            {TABS.map((tb) => (
              <button key={tb.id} className={`style-tab${tab === tb.id ? " on" : ""}`} onClick={() => setTab(tb.id)} type="button" aria-label={tb.name} aria-pressed={tab === tb.id}>
                {tb.icon}
                {tab === tb.id && <span className="style-tab-lbl">{tb.name}</span>}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Sheet Content Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 40px" }}>
        {/* TAB 1: КОНСТРУКЦИЯ */}
        {tab === "constr" && (
          <>
            {/* Card 0: Безручковый (GOLA) — a handleless profile system. Presence of cab.gola enables
                it; model/gola.ts derives the profiles, the side notches + the front grip gaps. */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Безручковый (GOLA)</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>СИСТЕМА</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: cab.gola ? 14 : 0 }}>
                <button className={`segbtn ${!cab.gola ? "on" : ""}`} onClick={() => patchCab({ gola: undefined })} type="button" style={{ flex: 1, border: "none", background: !cab.gola ? "#ffffff" : "transparent", color: !cab.gola ? "#0f172a" : "#64748b", boxShadow: !cab.gola ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>С ручками</button>
                <button className={`segbtn ${cab.gola ? "on" : ""}`} onClick={() => patchCab({ gola: {} })} type="button" style={{ flex: 1, border: "none", background: cab.gola ? "#ffffff" : "transparent", color: cab.gola ? "#0f172a" : "#64748b", boxShadow: cab.gola ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>GOLA (профиль)</button>
              </div>
              {cab.gola && (
                <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 6px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginBottom: 4 }}>Боковина — вырезы под профиль</div>
                  <GolaSidePanel cab={cab} />
                </div>
              )}
            </div>

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
              {renderBottomSVG(s.bottomMode, s.bottomT)}
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
              {renderTopSVG(s.topMode)}
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
              {/* a hung box has no plinth to draw — see model/construction.ts */}
              {s.plinthMode !== "none" && renderPlinthSVG(s.plinthMode)}
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
              {renderShelfDepthSVG(s.backMode)}
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
              {renderWorktopSVG(s.worktopCorpus, s.worktopProfile)}
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
              {renderFastenerSVG(s.jshelfHw)}
            </div>

            {/* Card 9: Дно ⊥ Бок */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Узел: Дно ⊥ Бок</h3>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 6 }}>КРЕПЁЖ</span>
              </div>
              <div style={{ display: "flex", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 }}>
                <button className={`segbtn ${s.jbottomHw === "confirmat" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "confirmat" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "confirmat" ? "#ffffff" : "transparent", color: s.jbottomHw === "confirmat" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "confirmat" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Конфирмат</button>
                <button className={`segbtn ${s.jbottomHw === "minifix" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "minifix" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "minifix" ? "#ffffff" : "transparent", color: s.jbottomHw === "minifix" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "minifix" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Минификс</button>
                <button className={`segbtn ${s.jbottomHw === "dowel" ? "on" : ""}`} onClick={() => updateS({ jbottomHw: "dowel" })} style={{ flex: 1, border: "none", background: s.jbottomHw === "dowel" ? "#ffffff" : "transparent", color: s.jbottomHw === "dowel" ? "#0f172a" : "#64748b", boxShadow: s.jbottomHw === "dowel" ? "0 1px 2px rgba(0,0,0,0.06)" : "none", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Шкант</button>
              </div>
              {renderFastenerSVG(s.jbottomHw)}
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
              {renderHingeSVG()}
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
              {renderSlidesSVG()}
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
              {renderPurposeSVG("wardrobe")}
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Книги (Полки)</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Шаг полок: <code>280–320 мм</code><br />
                • Пролёт полки: <code>≤ 800 мм</code> во избежание прогиба ЛДСП 16мм
              </div>
              {renderPurposeSVG("books")}
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Обувь (Полки)</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Шаг полок: <code>130–180 мм</code> (наклонные/прямые)
              </div>
              {renderPurposeSVG("shoes")}
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Бойлер / Техника</h3>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                • Зазоры вентиляции: <code>+50 мм</code> по ширине и высоте от габаритов прибора
              </div>
              {renderPurposeSVG("boiler")}
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
