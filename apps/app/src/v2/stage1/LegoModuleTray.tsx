import React from "react";
import { useV2Studio, CATALOG_PRESETS, type ModuleType } from "../state/useV2Studio";

export const LegoModuleTray: React.FC = () => {
  const addModule = useV2Studio((s) => s.addModule);

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>🧩</span> Лего-Каталог шкафов
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            (Нажмите на блок, чтобы добавить в кухню)
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Снеппинг · Стандартные базы
        </div>
      </div>

      {/* Horizontal Scrollable Block Tray */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
        {CATALOG_PRESETS.map((preset) => {
          const isUpper = preset.row === "upper";
          const isTall = preset.row === "tall";

          return (
            <button
              key={preset.type}
              onClick={() => addModule(preset.type)}
              className={`flex-shrink-0 flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-150 active:scale-95 shadow-md group ${
                isTall
                  ? "bg-slate-800/90 border-purple-500/40 hover:border-purple-400 hover:bg-slate-800"
                  : isUpper
                  ? "bg-slate-800/90 border-blue-500/40 hover:border-blue-400 hover:bg-slate-800"
                  : "bg-slate-800/90 border-cyan-500/40 hover:border-cyan-400 hover:bg-slate-800"
              }`}
            >
              <div className="text-2xl group-hover:scale-110 transition-transform">
                {preset.icon}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors whitespace-nowrap">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {preset.widthMm} × {preset.heightMm} мм
                </span>
              </div>
              <div className="w-5 h-5 rounded-full bg-slate-700/80 group-hover:bg-cyan-500 group-hover:text-slate-950 flex items-center justify-center text-xs font-bold text-slate-300 transition-colors ml-1">
                +
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
