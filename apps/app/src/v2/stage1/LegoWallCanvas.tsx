import React from "react";
import { useV2Studio, type LegoModule } from "../state/useV2Studio";
import { SeamToggleWidget } from "../stage3/SeamToggleWidget";

export const LegoWallCanvas: React.FC = () => {
  const wallWidthMm = useV2Studio((s) => s.wallWidthMm);
  const wallHeightMm = useV2Studio((s) => s.wallHeightMm);
  const modules = useV2Studio((s) => s.modules);
  const selectedModuleId = useV2Studio((s) => s.selectedModuleId);
  const setSelectedModuleId = useV2Studio((s) => s.setSelectedModuleId);
  const removeModule = useV2Studio((s) => s.removeModule);
  const openNumpad = useV2Studio((s) => s.openNumpad);
  const activeStage = useV2Studio((s) => s.activeStage);

  // SVG viewBox settings
  const padX = 140;
  const padY = 120;
  const vbW = wallWidthMm + padX * 2;
  const vbH = wallHeightMm + padY * 2;

  // Coordinate mapping: SVG origin (0,0) is top-left
  // Floor is at y = padY + wallHeightMm
  const floorY = padY + wallHeightMm;
  const plinthH = 100;
  const baseH = 720;
  const worktopH = 38;
  const splashbackH = 600;
  const upperH = 700;

  // Base row line positions
  const basePlinthTopY = floorY - plinthH;
  const baseTopY = basePlinthTopY - baseH;
  const worktopTopY = baseTopY - worktopH;
  const upperBottomY = worktopTopY - splashbackH;
  const upperTopY = upperBottomY - upperH;

  const baseModules = modules.filter((m) => m.row === "base" || m.row === "tall");
  const upperModules = modules.filter((m) => m.row === "upper");

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col select-none">
      {/* Top Elevation Label & Overall Dimension Pill */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/70 shadow">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            2D Вид Стены
          </span>
        </div>

        {/* Global Wall Width Pill */}
        <button
          onClick={() => openNumpad("wall", "Ширина стены", wallWidthMm)}
          className="flex items-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 active:bg-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-xl border border-cyan-500/30 text-xs font-mono font-bold shadow transition"
          title="Нажмите для изменения длины стены"
        >
          <span>↔ СТЕНА:</span>
          <span>{wallWidthMm} мм</span>
        </button>
      </div>

      {/* Main SVG Elevation Canvas */}
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-full flex-1 touch-none"
        style={{ minHeight: "360px" }}
      >
        <defs>
          {/* Wall pattern */}
          <pattern id="brick-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#172033" strokeWidth="1" />
          </pattern>
          {/* Cabinet linear gradients */}
          <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#243047" />
            <stop offset="100%" stopColor="#1a2334" />
          </linearGradient>
          <linearGradient id="selectedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#164e63" />
            <stop offset="100%" stopColor="#0e3746" />
          </linearGradient>
          <linearGradient id="upperGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b3952" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Background Grid */}
        <rect x={0} y={0} width={vbW} height={vbH} fill="#0d131f" />
        <rect x={padX} y={padY} width={wallWidthMm} height={wallHeightMm} fill="url(#brick-grid)" />

        {/* Wall Outer Perimeter */}
        <rect
          x={padX}
          y={padY}
          width={wallWidthMm}
          height={wallHeightMm}
          fill="none"
          stroke="#334155"
          strokeWidth="3"
          strokeDasharray="8 4"
        />

        {/* Floor Line */}
        <line
          x1={padX - 40}
          y1={floorY}
          x2={padX + wallWidthMm + 40}
          y2={floorY}
          stroke="#64748b"
          strokeWidth="4"
        />
        <text
          x={padX - 25}
          y={floorY + 25}
          fill="#64748b"
          fontSize="13"
          fontFamily="monospace"
          fontWeight="bold"
        >
          ПОЛ (0 мм)
        </text>

        {/* Continuous Countertop (Worktop) */}
        {baseModules.length > 0 && (
          <g>
            <rect
              x={padX}
              y={worktopTopY}
              width={baseModules.reduce((acc, m) => acc + (m.row === "tall" ? 0 : m.widthMm), 0)}
              height={worktopH}
              fill="#caa777"
              stroke="#e2c599"
              strokeWidth="1.5"
              rx="2"
            />
            <text
              x={padX + 20}
              y={worktopTopY + 24}
              fill="#1e2430"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              СТОЛЕШНИЦА (СКВОЗНАЯ 38 мм)
            </text>
          </g>
        )}

        {/* Continuous Plinth */}
        {baseModules.length > 0 && (
          <rect
            x={padX}
            y={basePlinthTopY}
            width={baseModules.reduce((acc, m) => acc + (m.row === "tall" ? 0 : m.widthMm), 0)}
            height={plinthH}
            fill="#1e293b"
            stroke="#0f172a"
            strokeWidth="1"
          />
        )}

        {/* Render Base & Tall Modules */}
        {baseModules.map((mod, idx) => {
          const isSelected = mod.id === selectedModuleId;
          const modX = padX + mod.xMm;
          const isTall = mod.row === "tall";
          const modY = isTall ? floorY - mod.heightMm : baseTopY;
          const modH = mod.heightMm;

          return (
            <g
              key={mod.id}
              className="cursor-pointer transition-transform"
              onClick={() => setSelectedModuleId(mod.id)}
            >
              {/* Cabinet Body */}
              <rect
                x={modX}
                y={modY}
                width={mod.widthMm}
                height={modH}
                fill={isSelected ? "url(#selectedGrad)" : "url(#baseGrad)"}
                stroke={isSelected ? "#00e5ff" : "#475569"}
                strokeWidth={isSelected ? 3 : 1.5}
                rx="4"
              />

              {/* Module Icon & Name */}
              <text
                x={modX + mod.widthMm * 0.5}
                y={modY + modH * 0.45}
                textAnchor="middle"
                fontSize={mod.widthMm < 500 ? "24" : "32"}
              >
                {mod.icon}
              </text>
              <text
                x={modX + mod.widthMm * 0.5}
                y={modY + modH * 0.45 + 32}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="14"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {mod.name}
              </text>

              {/* Dimension Pill [ ↔ 600 ] */}
              <g
                transform={`translate(${modX + mod.widthMm * 0.5}, ${modY - 22})`}
                onClick={(e) => {
                  e.stopPropagation();
                  openNumpad(mod.id, `Ширина: ${mod.name}`, mod.widthMm);
                }}
                className="hover:scale-110 active:scale-95 transition-transform"
              >
                <rect
                  x="-36"
                  y="-12"
                  width="72"
                  height="24"
                  rx="6"
                  fill={isSelected ? "#00e5ff" : "#1e293b"}
                  stroke={isSelected ? "#ffffff" : "#64748b"}
                  strokeWidth="1.5"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  fill={isSelected ? "#0f172a" : "#38bdf8"}
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ↔ {mod.widthMm}
                </text>
              </g>

              {/* Quick Delete Button if Selected */}
              {isSelected && (
                <g
                  transform={`translate(${modX + mod.widthMm - 16}, ${modY + 16})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeModule(mod.id);
                  }}
                  className="hover:scale-125 transition-transform"
                >
                  <circle r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text textAnchor="middle" y="4" fill="#ffffff" fontSize="12" fontWeight="bold">
                    ✕
                  </text>
                </g>
              )}

              {/* Seam toggle node between this module and next */}
              {idx < baseModules.length - 1 && (
                <SeamToggleWidget
                  x={modX + mod.widthMm}
                  y={modY + modH * 0.5}
                  leftModId={mod.id}
                  rightModId={baseModules[idx + 1].id}
                />
              )}
            </g>
          );
        })}

        {/* Render Upper Modules */}
        {upperModules.map((mod) => {
          const isSelected = mod.id === selectedModuleId;
          const modX = padX + mod.xMm;
          const modY = upperTopY;
          const modH = mod.heightMm;

          return (
            <g
              key={mod.id}
              className="cursor-pointer"
              onClick={() => setSelectedModuleId(mod.id)}
            >
              <rect
                x={modX}
                y={modY}
                width={mod.widthMm}
                height={modH}
                fill={isSelected ? "url(#selectedGrad)" : "url(#upperGrad)"}
                stroke={isSelected ? "#00e5ff" : "#475569"}
                strokeWidth={isSelected ? 3 : 1.5}
                rx="4"
              />

              <text
                x={modX + mod.widthMm * 0.5}
                y={modY + modH * 0.45}
                textAnchor="middle"
                fontSize="26"
              >
                {mod.icon}
              </text>
              <text
                x={modX + mod.widthMm * 0.5}
                y={modY + modH * 0.45 + 26}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="13"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {mod.name}
              </text>

              {/* Upper Dimension Pill */}
              <g
                transform={`translate(${modX + mod.widthMm * 0.5}, ${modY - 20})`}
                onClick={(e) => {
                  e.stopPropagation();
                  openNumpad(mod.id, `Ширина: ${mod.name}`, mod.widthMm);
                }}
                className="hover:scale-110 active:scale-95 transition-transform"
              >
                <rect
                  x="-32"
                  y="-11"
                  width="64"
                  height="22"
                  rx="5"
                  fill={isSelected ? "#00e5ff" : "#1e293b"}
                  stroke={isSelected ? "#ffffff" : "#64748b"}
                  strokeWidth="1.2"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  fill={isSelected ? "#0f172a" : "#38bdf8"}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ↔ {mod.widthMm}
                </text>
              </g>

              {isSelected && (
                <g
                  transform={`translate(${modX + mod.widthMm - 14}, ${modY + 14})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeModule(mod.id);
                  }}
                >
                  <circle r="10" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text textAnchor="middle" y="4" fill="#ffffff" fontSize="11" fontWeight="bold">
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
