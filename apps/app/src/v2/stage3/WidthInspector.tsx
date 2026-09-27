import React from "react";
import { useV2Studio } from "../state/useV2Studio";

export const WidthInspector: React.FC = () => {
  const selectedModuleId = useV2Studio((s) => s.selectedModuleId);
  const modules = useV2Studio((s) => s.modules);
  const selectedMod = modules.find((m) => m.id === selectedModuleId) || modules[0];

  if (!selectedMod) return null;

  const w = selectedMod.widthMm;
  const openingW = w - 32;
  const drawerBoxW = openingW - 25; // 25mm Blum/Tandem slide gap
  const facadeW = w - 3; // 3mm standard door gap

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{selectedMod.icon}</span>
          <span className="text-xs font-bold text-slate-200">
            {selectedMod.name}
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
          Инженерная цепочка
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {/* 1. Module Width */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            1. Модуль
          </span>
          <span className="text-lg font-mono font-black text-white">
            {w} <span className="text-xs font-normal text-slate-500">мм</span>
          </span>
          <span className="block text-[9px] text-slate-500">Габарит каркаса</span>
        </div>

        {/* 2. Opening */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            2. Просвет
          </span>
          <span className="text-lg font-mono font-black text-cyan-300">
            {openingW} <span className="text-xs font-normal text-slate-500">мм</span>
          </span>
          <span className="block text-[9px] text-slate-500">Минус 2×16мм</span>
        </div>

        {/* 3. Drawer Box / Shelf */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            3. Ящик / Полка
          </span>
          <span className="text-lg font-mono font-black text-amber-300">
            {drawerBoxW} <span className="text-xs font-normal text-slate-500">мм</span>
          </span>
          <span className="block text-[9px] text-slate-500">Зазор Tandem 25мм</span>
        </div>

        {/* 4. Facade */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            4. Фасад CUT
          </span>
          <span className="text-lg font-mono font-black text-emerald-400">
            {facadeW} <span className="text-xs font-normal text-slate-500">мм</span>
          </span>
          <span className="block text-[9px] text-slate-500">Зазор 3мм + 2мм кромка</span>
        </div>
      </div>
    </div>
  );
};
