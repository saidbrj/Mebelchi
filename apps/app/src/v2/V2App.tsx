import React, { useState } from "react";
import { useV2Studio } from "./state/useV2Studio";
import { LegoWallCanvas } from "./stage1/LegoWallCanvas";
import { DumbThreeViewer } from "./stage1/DumbThreeViewer";
import { LegoModuleTray } from "./stage1/LegoModuleTray";
import { ExportCutModal } from "./stage2/ExportCutModal";
import { NumpadDock } from "./stage3/NumpadDock";
import { MaterialDrawer } from "./stage3/MaterialDrawer";
import { WidthInspector } from "./stage3/WidthInspector";
import "./styles/v2.css";

interface Props {
  onSwitchToClassic?: () => void;
}

export const V2App: React.FC<Props> = ({ onSwitchToClassic }) => {
  const activeStage = useV2Studio((s) => s.activeStage);
  const setActiveStage = useV2Studio((s) => s.setActiveStage);
  const projectName = useV2Studio((s) => s.projectName);
  const setProjectName = useV2Studio((s) => s.setProjectName);

  const [mobileView, setMobileView] = useState<"2d" | "3d">("2d");
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showMaterialDrawer, setShowMaterialDrawer] = useState<boolean>(false);

  return (
    <div className="fixed inset-0 flex flex-col w-full h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between flex-shrink-0 z-20">
        {/* Left: Brand & Project Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-cyan-500/20">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-wider text-white">
                MEBELY <span className="text-cyan-400">STUDIO v2</span>
              </span>
              <span className="text-[9px] font-mono text-emerald-400 font-bold">
                TASHKENT EXPO EDITION
              </span>
            </div>
          </div>

          <div className="hidden md:block h-5 w-[1px] bg-slate-800" />

          {/* Project Title Input */}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="hidden sm:block bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 text-xs text-slate-200 font-semibold px-3 py-1.5 rounded-xl outline-none transition w-48 lg:w-64 truncate"
            title="Название проекта"
          />
        </div>

        {/* Center: 3-Stage Pills */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveStage(1)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeStage === 1
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🧩</span>
            <span className="hidden sm:inline">1. Лего-Сборка</span>
          </button>

          <button
            onClick={() => {
              setActiveStage(2);
              setShowExportModal(true);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeStage === 2
                ? "bg-amber-400 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚡</span>
            <span className="hidden sm:inline">2. Заказ на распил</span>
          </button>

          <button
            onClick={() => setActiveStage(3)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeStage === 3
                ? "bg-purple-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🛠️</span>
            <span className="hidden sm:inline">3. Инженер</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Material Swatch Trigger */}
          <button
            onClick={() => setShowMaterialDrawer(true)}
            className="hidden lg:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition shadow"
            title="Выбор материалов Eman"
          >
            <span>🎨</span>
            <span>Материалы</span>
          </button>

          {/* Golden Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-95 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-lg shadow-amber-500/20 transition"
          >
            <span>⚡</span>
            <span>Распил</span>
          </button>

          {/* Switch to Classic (Fallback) */}
          {onSwitchToClassic && (
            <button
              onClick={onSwitchToClassic}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 transition hidden sm:inline"
              title="Переключиться на старый интерфейс"
            >
              v1 Классика
            </button>
          )}
        </div>
      </header>

      {/* Mobile View Switcher (Only visible on narrow screens like iPhone) */}
      <div className="flex lg:hidden items-center justify-center bg-slate-900 border-b border-slate-800 py-1.5 px-4 gap-2">
        <button
          onClick={() => setMobileView("2d")}
          className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
            mobileView === "2d"
              ? "bg-cyan-500 text-slate-950"
              : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          📐 2D Чертеж
        </button>
        <button
          onClick={() => setMobileView("3d")}
          className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
            mobileView === "3d"
              ? "bg-cyan-500 text-slate-950"
              : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          🧊 3D Модель
        </button>
      </div>

      {/* Main Viewport Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row gap-2 p-2 sm:p-3 overflow-hidden min-h-0">
        {/* Left Column: 2D Lego Canvas */}
        <div
          className={`flex-1 flex flex-col min-h-0 ${
            mobileView === "3d" ? "hidden lg:flex" : "flex"
          }`}
        >
          <LegoWallCanvas />
        </div>

        {/* Right Column: 3D Real-time Viewer & Optional Engineer Inspector */}
        <div
          className={`flex-1 flex flex-col gap-2 min-h-0 ${
            mobileView === "2d" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Real-time 3D Box Viewer */}
          <div className="flex-1 min-h-0">
            <DumbThreeViewer />
          </div>

          {/* Stage 3 Engineer Mode Width Readout (when Stage 3 is active) */}
          {activeStage === 3 && (
            <div className="flex-shrink-0 animate-in slide-in-from-bottom duration-200">
              <WidthInspector />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Stage 1 Lego Cabinet Tray */}
      <footer className="flex-shrink-0 z-10">
        <LegoModuleTray />
      </footer>

      {/* Modals & Drawers */}
      {showExportModal && <ExportCutModal onClose={() => setShowExportModal(false)} />}
      {showMaterialDrawer && <MaterialDrawer onClose={() => setShowMaterialDrawer(false)} />}
      <NumpadDock />
    </div>
  );
};
export default V2App;
