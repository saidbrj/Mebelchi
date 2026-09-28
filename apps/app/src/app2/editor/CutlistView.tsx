import React, { useState, useMemo } from "react";
import type { FillPart } from "../kernel";
import { nameOf } from "../kernel";
import { nest, type NestPanel, type NestedSheet, type Placed, type Leftover } from "../../model/nest";

export interface CutlistViewProps {
  parts: FillPart[];
  unit: { w: number; h: number; d: number } | null;
  slots: Readonly<Record<string, string>>;
  onClose?: () => void;
  isMobile: boolean;
}

const SHEET_SIZES = [
  { label: "2800 × 2070 мм (Евро-формат)", w: 2800, h: 2070 },
  { label: "2750 × 1830 мм (Стандарт)", w: 2750, h: 1830 },
  { label: "2440 × 1830 мм (Компакт)", w: 2440, h: 1830 },
];

export function CutlistView({
  parts,
  unit,
  slots,
  onClose,
  isMobile,
}: CutlistViewProps) {
  const [activeTab, setActiveTab] = useState<"nesting" | "bom">("nesting");
  const [sheetSizeIdx, setSheetSizeIdx] = useState(0);
  const [kerfMm] = useState(4); // standard panel saw blade thickness
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentSheetSize = SHEET_SIZES[sheetSizeIdx] ?? SHEET_SIZES[0];

  // Convert kernel FillParts into NestPanels
  const nestPanels = useMemo<NestPanel[]>(() => {
    return parts.map((p, idx) => {
      const isFront = p.role === "front";
      const isBack = p.role === "back" || p.thicknessMm <= 4;
      const matName = isBack
        ? slots["задник"] ?? "ХДФ 4мм, белый"
        : isFront
        ? slots["фасад"] ?? "МДФ 18мм, фасад"
        : slots["корпус"] ?? "ЛДСП 16мм, корпус";

      const partRu = nameOf(p.role) || p.role;
      return {
        id: `p-${idx}-${p.role}-${p.lengthMm}x${p.widthMm}`,
        w: p.lengthMm,
        h: p.widthMm,
        part: p.role,
        partRu,
        module: p.cabinet || "Шкаф",
        group: `${matName} · ${p.thicknessMm}мм`,
        material: matName,
        thickness: p.thicknessMm,
        grain: isFront,
      };
    });
  }, [parts, slots]);

  // Run the guillotine nesting algorithm
  const nestResult = useMemo(() => {
    return nest(nestPanels, {
      sheetW: currentSheetSize.w,
      sheetH: currentSheetSize.h,
      kerf: kerfMm,
      respectGrain: true,
      remains: [],
    });
  }, [nestPanels, currentSheetSize, kerfMm]);

  const sheets = nestResult.sheets;
  const safeSheetIdx = Math.min(activeSheetIdx, Math.max(0, sheets.length - 1));
  const activeSheet: NestedSheet | undefined = sheets[safeSheetIdx];

  // Selected panel info
  const selectedPlaced = useMemo(() => {
    if (!activeSheet || !selectedPanelId) return null;
    return activeSheet.placed.find((p) => p.panel.id === selectedPanelId) ?? null;
  }, [activeSheet, selectedPanelId]);

  // Copy BOM as TSV (Tab-separated) for Excel / Google Sheets
  const handleCopyTSV = () => {
    const header = [
      "№",
      "Наименование",
      "Длина (мм)",
      "Ширина (мм)",
      "Толщина (мм)",
      "Площадь (м²)",
      "Материал",
      "Примечание",
    ].join("\t");

    const rows = parts.map((p, i) => {
      const area = ((p.lengthMm * p.widthMm) / 1_000_000).toFixed(3);
      const isFront = p.role === "front";
      const isBack = p.role === "back" || p.thicknessMm <= 4;
      const mat = isBack
        ? slots["задник"] ?? "ХДФ 4мм"
        : isFront
        ? slots["фасад"] ?? "МДФ 18мм"
        : slots["корпус"] ?? "ЛДСП 16мм";
      return [
        i + 1,
        nameOf(p.role) || p.role,
        p.lengthMm,
        p.widthMm,
        p.thicknessMm,
        area,
        mat,
        p.note || "—",
      ].join("\t");
    });

    const text = [header, ...rows].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Download CSV file
  const handleDownloadCSV = () => {
    const header = [
      "№",
      "Наименование",
      "Длина_мм",
      "Ширина_мм",
      "Толщина_мм",
      "Кол_во",
      "Материал",
      "Примечание",
    ].join(";");

    const rows = parts.map((p, i) => {
      const isFront = p.role === "front";
      const isBack = p.role === "back" || p.thicknessMm <= 4;
      const mat = isBack
        ? slots["задник"] ?? "ХДФ 4мм"
        : isFront
        ? slots["фасад"] ?? "МДФ 18мм"
        : slots["корпус"] ?? "ЛДСП 16мм";
      return [
        i + 1,
        `"${nameOf(p.role) || p.role}"`,
        p.lengthMm,
        p.widthMm,
        p.thicknessMm,
        1,
        `"${mat}"`,
        `"${p.note || ""}"`,
      ].join(";");
    });

    // Prepend UTF-8 BOM so Excel opens it with Cyrillic cleanly
    const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const unitDims = unit ? `${unit.w}x${unit.h}x${unit.d}` : "cabinet";
    link.setAttribute("href", url);
    link.setAttribute("download", `raskroy_${unitDims}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger print dialog
  const handlePrint = () => {
    window.print();
  };

  // Color helper by part role
  const getPartColor = (role: string) => {
    switch (role) {
      case "side":
        return { fill: "#e0f2fe", stroke: "#38bdf8", text: "#0369a1", darkText: "#0c4a6e" };
      case "top":
      case "bottom":
        return { fill: "#f0fdf4", stroke: "#4ade80", text: "#15803d", darkText: "#14532d" };
      case "shelf":
      case "divider":
        return { fill: "#fef3c7", stroke: "#facc15", text: "#b45309", darkText: "#78350f" };
      case "front":
        return { fill: "#ffedd5", stroke: "#fb923c", text: "#c2410c", darkText: "#7c2d12" };
      case "back":
        return { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569", darkText: "#1e293b" };
      default:
        return { fill: "#f3f4f6", stroke: "#d1d5db", text: "#4b5563", darkText: "#111827" };
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#f8f7f4",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 30,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Top Subheader / Controls ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e3de",
          padding: isMobile ? "54px 12px 10px 12px" : "10px 20px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Left: View Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              background: "#edeae3",
              borderRadius: 20,
              padding: 3,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("nesting")}
              style={{
                background: activeTab === "nesting" ? "#fff" : "transparent",
                color: activeTab === "nesting" ? "#1c1f22" : "#666",
                border: "none",
                borderRadius: 18,
                padding: isMobile ? "7px 12px" : "6px 14px",
                fontSize: 12,
                fontWeight: activeTab === "nesting" ? 700 : 500,
                cursor: "pointer",
                boxShadow: activeTab === "nesting" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                minHeight: 34,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span>⊞</span>
              <span>Карта раскроя</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bom")}
              style={{
                background: activeTab === "bom" ? "#fff" : "transparent",
                color: activeTab === "bom" ? "#1c1f22" : "#666",
                border: "none",
                borderRadius: 18,
                padding: isMobile ? "7px 12px" : "6px 14px",
                fontSize: 12,
                fontWeight: activeTab === "bom" ? 700 : 500,
                cursor: "pointer",
                boxShadow: activeTab === "bom" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                minHeight: 34,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span>📋</span>
              <span>Спецификация ({parts.length})</span>
            </button>
          </div>

          {/* Sheet Format Selector (Desktop & Mobile) */}
          {activeTab === "nesting" && (
            <select
              value={sheetSizeIdx}
              onChange={(e) => {
                setSheetSizeIdx(Number(e.target.value));
                setActiveSheetIdx(0);
              }}
              style={{
                background: "#f8f7f4",
                border: "1px solid #d9d5cc",
                borderRadius: 14,
                padding: "6px 10px",
                fontSize: 11,
                color: "#444",
                cursor: "pointer",
                minHeight: 34,
                maxWidth: isMobile ? 180 : "none",
              }}
            >
              {SHEET_SIZES.map((s, i) => (
                <option key={s.label} value={i}>
                  {isMobile ? `${s.w}×${s.h} мм` : s.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Export Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleCopyTSV}
            style={{
              background: copied ? "#16a34a" : "#fff",
              color: copied ? "#fff" : "#1c1f22",
              border: `1px solid ${copied ? "#16a34a" : "#d9d5cc"}`,
              borderRadius: 14,
              padding: "7px 12px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              minHeight: 34,
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              WebkitTapHighlightColor: "transparent",
            }}
            title="Скопировать таблицу для Excel / Google Sheets"
          >
            <span>{copied ? "✓" : "📋"}</span>
            <span>{copied ? "Скопировано!" : "Копировать"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            style={{
              background: "#fff",
              color: "#1c1f22",
              border: "1px solid #d9d5cc",
              borderRadius: 14,
              padding: "7px 12px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              minHeight: 34,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              WebkitTapHighlightColor: "transparent",
            }}
            title="Скачать CSV для Базис-Раскрой / Астра / Excel"
          >
            <span>💾</span>
            <span>CSV</span>
          </button>

          {!isMobile && (
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: "#fff",
                color: "#1c1f22",
                border: "1px solid #d9d5cc",
                borderRadius: 14,
                padding: "7px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                minHeight: 34,
              }}
              title="Печать карты раскроя"
            >
              <span>🖨️</span>
              <span>Печать</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Stats Summary Strip ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e3de",
          padding: isMobile ? "8px 12px" : "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 12 : 24,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          fontSize: 12,
          flexShrink: 0,
          whiteSpace: "nowrap",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#888" }}>Деталей:</span>
          <span style={{ fontWeight: 700, color: "#1c1f22" }}>{nestResult.stats.partCount} шт.</span>
        </div>

        <div style={{ width: 1, height: 14, background: "#e5e3de" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#888" }}>Листов:</span>
          <span style={{ fontWeight: 700, color: "#1c1f22" }}>
            {nestResult.stats.sheetCount} шт. ({currentSheetSize.w}×{currentSheetSize.h})
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: "#e5e3de" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#888" }}>Площадь деталей:</span>
          <span style={{ fontWeight: 700, color: "#1c1f22" }}>
            {nestResult.stats.partAreaM2.toFixed(2)} м²
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: "#e5e3de" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#888" }}>КУЛ (использование):</span>
          <span
            style={{
              fontWeight: 700,
              color: nestResult.stats.wastePct < 25 ? "#16a34a" : "#ca8a04",
            }}
          >
            {(100 - nestResult.stats.wastePct).toFixed(1)}%
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: "#e5e3de" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#888" }}>Длина реза:</span>
          <span style={{ fontWeight: 700, color: "#1c1f22" }}>
            {nestResult.stats.cutLengthM.toFixed(1)} м
          </span>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, overflow: "auto", position: "relative", display: "flex", flexDirection: "column" }}>
        {activeTab === "nesting" ? (
          /* ── 2D Nesting Sheet View ── */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              overflow: isMobile ? "auto" : "hidden",
            }}
          >
            {/* Sheet Canvas Area */}
            <div
              style={{
                flex: isMobile ? "0 0 auto" : 1,
                display: "flex",
                flexDirection: "column",
                overflow: isMobile ? "visible" : "auto",
                padding: isMobile ? "12px 10px" : 20,
                alignItems: "center",
                justifyContent: "flex-start",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {/* Sheet Stepper Header */}
              {sheets.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    background: "#fff",
                    padding: "6px 14px",
                    borderRadius: 12,
                    border: "1px solid #e5e3de",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSheetIdx((i) => Math.max(0, i - 1))}
                    disabled={safeSheetIdx === 0}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 16,
                      color: safeSheetIdx === 0 ? "#ccc" : "#1c1f22",
                      cursor: safeSheetIdx === 0 ? "default" : "pointer",
                      padding: "2px 6px",
                    }}
                  >
                    ‹
                  </button>

                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1f22" }}>
                    Лист {safeSheetIdx + 1} из {sheets.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveSheetIdx((i) => Math.min(sheets.length - 1, i + 1))}
                    disabled={safeSheetIdx >= sheets.length - 1}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 16,
                      color: safeSheetIdx >= sheets.length - 1 ? "#ccc" : "#1c1f22",
                      cursor: safeSheetIdx >= sheets.length - 1 ? "default" : "pointer",
                      padding: "2px 6px",
                    }}
                  >
                    ›
                  </button>

                  {activeSheet && (
                    <span
                      style={{
                        fontSize: 11,
                        background: "#f0fdf4",
                        color: "#166534",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {activeSheet.material} · {activeSheet.placed.length} дет.
                    </span>
                  )}
                </div>
              )}

              {/* Responsive SVG Sheet Drawing */}
              {activeSheet ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: 1100,
                    aspectRatio: `${activeSheet.W} / ${activeSheet.H}`,
                    background: "#fff",
                    borderRadius: 8,
                    border: "2px solid #cbd5e1",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <svg
                    viewBox={`0 0 ${activeSheet.W} ${activeSheet.H}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                    }}
                  >
                    <defs>
                      <pattern id="sawCut" width="8" height="8" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="8" x2="8" y2="0" stroke="#cbd5e1" strokeWidth="1" />
                      </pattern>
                    </defs>

                    {/* Sheet Background (Unused / Kerf) */}
                    <rect
                      x="0"
                      y="0"
                      width={activeSheet.W}
                      height={activeSheet.H}
                      fill="#f8fafc"
                    />

                    {/* Usable Leftovers (Remnants) */}
                    {activeSheet.leftovers
                      .filter((l) => l.usable)
                      .map((l, i) => (
                        <g key={`leftover-${i}`}>
                          <rect
                            x={l.x}
                            y={l.y}
                            width={l.w}
                            height={l.h}
                            fill="#fefce8"
                            stroke="#eab308"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                          />
                          {l.w > 200 && l.h > 120 && (
                            <text
                              x={l.x + l.w / 2}
                              y={l.y + l.h / 2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#a16207"
                              fontSize={Math.max(18, Math.min(l.w, l.h) * 0.08)}
                              fontWeight="600"
                            >
                              Остаток {l.w} × {l.h}
                            </text>
                          )}
                        </g>
                      ))}

                    {/* Placed Panels */}
                    {activeSheet.placed.map((item) => {
                      const isSel = selectedPanelId === item.panel.id;
                      const c = getPartColor(item.panel.part);

                      // Font size scaling relative to part dimensions
                      const minDim = Math.min(item.w, item.h);
                      const titleFontSize = Math.max(16, Math.min(36, minDim * 0.12));
                      const subFontSize = Math.max(13, Math.min(26, minDim * 0.09));

                      return (
                        <g
                          key={item.panel.id}
                          onClick={() => setSelectedPanelId(isSel ? null : item.panel.id)}
                          style={{ cursor: "pointer" }}
                        >
                          {/* Panel Body */}
                          <rect
                            x={item.x}
                            y={item.y}
                            width={item.w}
                            height={item.h}
                            fill={isSel ? "#fde047" : c.fill}
                            stroke={isSel ? "#ca8a04" : c.stroke}
                            strokeWidth={isSel ? 4 : 2}
                            rx="4"
                            ry="4"
                          />

                          {/* Inner labels if panel is large enough */}
                          {item.w > 100 && item.h > 70 && (
                            <>
                              <text
                                x={item.x + item.w / 2}
                                y={item.y + item.h / 2 - (subFontSize * 0.7)}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={isSel ? "#713f12" : c.darkText}
                                fontSize={titleFontSize}
                                fontWeight="700"
                              >
                                {item.panel.partRu}
                              </text>

                              <text
                                x={item.x + item.w / 2}
                                y={item.y + item.h / 2 + (subFontSize * 0.7)}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={isSel ? "#854d0e" : c.text}
                                fontSize={subFontSize}
                                fontWeight="600"
                                fontFamily="ui-monospace, monospace"
                              >
                                {item.w} × {item.h} мм{item.rot ? " ⟳" : ""}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div style={{ color: "#888", padding: 40 }}>Нет деталей для раскроя</div>
              )}
            </div>

            {/* Right / Bottom Sheet Inspector for Selected Part */}
            <div
              style={{
                width: isMobile ? "100%" : 280,
                background: "#fff",
                borderLeft: isMobile ? "none" : "1px solid #e5e3de",
                borderTop: isMobile ? "1px solid #e5e3de" : "none",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1f22" }}>
                {selectedPlaced ? "Выбранная деталь" : "Детали на этом листе"}
              </span>

              {selectedPlaced ? (
                <div
                  style={{
                    background: "#fdf8ee",
                    border: "1px solid #fde68a",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
                    {selectedPlaced.panel.partRu}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                    <span>Размеры:</span>
                    <strong style={{ color: "#1c1f22", fontFamily: "ui-monospace, monospace" }}>
                      {selectedPlaced.w} × {selectedPlaced.h} × {selectedPlaced.panel.thickness} мм
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                    <span>Ориентация:</span>
                    <span style={{ color: "#1c1f22" }}>
                      {selectedPlaced.rot ? "Повёрнута на 90°" : "Прямая"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                    <span>Материал:</span>
                    <span style={{ color: "#1c1f22" }}>{selectedPlaced.panel.material}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                    <span>Площадь:</span>
                    <span style={{ color: "#1c1f22" }}>
                      {((selectedPlaced.w * selectedPlaced.h) / 1_000_000).toFixed(3)} м²
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPanelId(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#b45309",
                      fontSize: 11,
                      cursor: "pointer",
                      textAlign: "left",
                      marginTop: 4,
                      padding: 0,
                    }}
                  >
                    ✕ Снять выделение
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>
                  Нажмите на деталь на карте раскроя, чтобы просмотреть её размеры и свойства.
                </div>
              )}

              {/* List of items on current sheet */}
              {activeSheet && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase" }}>
                    Список деталей листа ({activeSheet.placed.length})
                  </div>
                  {activeSheet.placed.map((item, i) => {
                    const isSel = selectedPanelId === item.panel.id;
                    const c = getPartColor(item.panel.part);
                    return (
                      <div
                        key={item.panel.id}
                        onClick={() => setSelectedPanelId(isSel ? null : item.panel.id)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: isSel ? "#fef3c7" : "#f8f7f4",
                          border: `1px solid ${isSel ? "#f59e0b" : "#e5e3de"}`,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: c.stroke,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: "#1c1f22" }}>
                            {item.panel.partRu}
                          </span>
                        </div>
                        <span style={{ color: "#666", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                          {item.w}×{item.h}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Tabular Specification (BOM) View ── */
          <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "10px 8px" : 24, paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
            <div
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e5e3de",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              {isMobile && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fafaf8",
                    borderBottom: "1px solid #e5e3de",
                    fontSize: 11,
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>↔</span>
                  <span>Прокрутите таблицу вправо для просмотра всех колонок</span>
                </div>
              )}
              <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 640,
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8f7f4", borderBottom: "1px solid #e5e3de" }}>
                    <th style={{ padding: "10px 12px", width: 40, color: "#666" }}>№</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Наименование</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Длина (мм)</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Ширина (мм)</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Толщ.</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Площадь</th>
                    <th style={{ padding: "10px 12px", color: "#1c1f22", fontWeight: 700 }}>Материал</th>
                    <th style={{ padding: "10px 12px", color: "#666" }}>Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => {
                    const isFront = p.role === "front";
                    const isBack = p.role === "back" || p.thicknessMm <= 4;
                    const mat = isBack
                      ? slots["задник"] ?? "ХДФ 4мм, белый"
                      : isFront
                      ? slots["фасад"] ?? "МДФ 18мм, фасад"
                      : slots["корпус"] ?? "ЛДСП 16мм, корпус";
                    const area = ((p.lengthMm * p.widthMm) / 1_000_000).toFixed(3);
                    const c = getPartColor(p.role);

                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #f0ede6",
                          background: i % 2 === 0 ? "#fff" : "#faf9f6",
                        }}
                      >
                        <td style={{ padding: "9px 12px", color: "#888", fontFamily: "ui-monospace, monospace" }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1c1f22" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: c.stroke,
                              marginRight: 8,
                            }}
                          />
                          {nameOf(p.role) || p.role}
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "ui-monospace, monospace", color: "#1c1f22" }}>
                          {p.lengthMm}
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "ui-monospace, monospace", color: "#1c1f22" }}>
                          {p.widthMm}
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "ui-monospace, monospace", color: "#666" }}>
                          {p.thicknessMm}
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "ui-monospace, monospace", color: "#666" }}>
                          {area} м²
                        </td>
                        <td style={{ padding: "9px 12px", color: "#444" }}>
                          {mat}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#888", fontSize: 12 }}>
                          {p.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
