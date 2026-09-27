// apps/app/src/app2/BottomTray.tsx
//
// 3-LEVEL BOTTOM FLOATING DOCK (Step 3: Types / Modules / Components).
//
// Features:
// 1. Floating glass dock (height 48px, backdrop-filter: blur(24px)).
// 2. 3 Gallery switches: [ ★ Типы ], [ ⊞ Модули ], [ 📦 Компоненты ].
// 3. Smooth carousel drawer above the dock with cards.
// 4. One-tap preset loading with seamless NFS camera morphing.

import React from "react";
import type { Gallery } from "../poligon/model/space";
import { CATALOG_PRESETS, type CatalogPreset } from "./catalogPresets";

export interface BottomTrayProps {
  activeCategory: Gallery;
  onSelectCategory: (cat: Gallery) => void;
  activePresetId?: string;
  onSelectPreset: (preset: CatalogPreset) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function BottomTray({
  activeCategory,
  onSelectCategory,
  activePresetId,
  onSelectPreset,
  isOpen,
  onToggleOpen,
}: BottomTrayProps) {
  const filteredPresets = CATALOG_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <>
      {/* ── 1. Carousel Card Drawer (Floats above dock) ───────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: 74,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 20,
            padding: "14px 16px",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            zIndex: 40,
            maxWidth: "calc(100vw - 32px)",
            width: "max-content",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {activeCategory === "type"
                ? "★ Готовые композиции (Типы)"
                : activeCategory === "module"
                ? "⊞ Параметрические корпуса (Модули)"
                : "📦 Сборные функциональные узлы (Компоненты)"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
              {filteredPresets.length} пресета
            </div>
          </div>

          {/* Cards Carousel */}
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "none",
              maxWidth: "860px",
            }}
          >
            {filteredPresets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  style={{
                    minWidth: 200,
                    width: 200,
                    textAlign: "left",
                    background: isSelected ? "rgba(14, 165, 233, 0.16)" : "rgba(255, 255, 255, 0.04)",
                    border: isSelected ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 14,
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    color: "#f8fafc",
                    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: isSelected
                      ? "0 0 20px rgba(56, 189, 248, 0.35), 0 8px 24px rgba(0,0,0,0.4)"
                      : "none",
                  }}
                >
                  {/* Card Top: Icon + Name */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>{preset.icon}</span>
                      <span style={{ color: isSelected ? "#38bdf8" : "#fff" }}>{preset.name}</span>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          background: "#0284c7",
                          fontSize: 9.5,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 800,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  {/* Dimensions Tag */}
                  <div
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: isSelected ? "#38bdf8" : "#94a3b8",
                      letterSpacing: "-0.2px",
                    }}
                  >
                    {preset.dims.w} × {preset.dims.h} × {preset.dims.d} мм
                  </div>

                  {/* Subtitle */}
                  <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.35 }}>
                    {preset.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Floating 48px Bottom Glass Dock ───────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          height: 48,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.16)",
          borderRadius: 24,
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          zIndex: 40,
        }}
      >
        {/* Switcher 1: ★ Типы */}
        <button
          type="button"
          onClick={() => {
            if (activeCategory === "type" && isOpen) {
              onToggleOpen();
            } else {
              onSelectCategory("type");
              if (!isOpen) onToggleOpen();
            }
          }}
          style={{
            background:
              activeCategory === "type"
                ? "linear-gradient(135deg, #0284c7, #0369a1)"
                : "transparent",
            color: activeCategory === "type" ? "#fff" : "#cbd5e1",
            border: "none",
            borderRadius: 18,
            height: 38,
            padding: "0 14px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow:
              activeCategory === "type"
                ? "0 4px 14px rgba(2, 132, 199, 0.4)"
                : "none",
          }}
          title="Готовые мебельные композиции (ТВ-зона, кухонный остров, пеналы)"
        >
          <span>★</span>
          <span>Типы</span>
        </button>

        {/* Switcher 2: ⊞ Модули */}
        <button
          type="button"
          onClick={() => {
            if (activeCategory === "module" && isOpen) {
              onToggleOpen();
            } else {
              onSelectCategory("module");
              if (!isOpen) onToggleOpen();
            }
          }}
          style={{
            background:
              activeCategory === "module"
                ? "linear-gradient(135deg, #0284c7, #0369a1)"
                : "transparent",
            color: activeCategory === "module" ? "#fff" : "#cbd5e1",
            border: "none",
            borderRadius: 18,
            height: 38,
            padding: "0 14px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow:
              activeCategory === "module"
                ? "0 4px 14px rgba(2, 132, 199, 0.4)"
                : "none",
          }}
          title="Отдельные параметрические корпуса"
        >
          <span>⊞</span>
          <span>Модули</span>
        </button>

        {/* Switcher 3: 📦 Компоненты */}
        <button
          type="button"
          onClick={() => {
            if (activeCategory === "component" && isOpen) {
              onToggleOpen();
            } else {
              onSelectCategory("component");
              if (!isOpen) onToggleOpen();
            }
          }}
          style={{
            background:
              activeCategory === "component"
                ? "linear-gradient(135deg, #0284c7, #0369a1)"
                : "transparent",
            color: activeCategory === "component" ? "#fff" : "#cbd5e1",
            border: "none",
            borderRadius: 18,
            height: 38,
            padding: "0 14px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow:
              activeCategory === "component"
                ? "0 4px 14px rgba(2, 132, 199, 0.4)"
                : "none",
          }}
          title="Сборные функциональные узлы (ящики, винные сетки, пилоны)"
        >
          <span>📦</span>
          <span>Компоненты</span>
        </button>

        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.18)", margin: "0 2px" }} />

        {/* Drawer Toggle Chevron Button */}
        <button
          type="button"
          onClick={onToggleOpen}
          style={{
            background: isOpen ? "rgba(255,255,255,0.1)" : "transparent",
            color: "#94a3b8",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
          }}
          title={isOpen ? "Свернуть каталог пресетов" : "Развернуть каталог пресетов"}
        >
          {isOpen ? "⌄" : "⌃"}
        </button>
      </div>
    </>
  );
}
