import React from "react";
import { useV2Studio } from "../state/useV2Studio";
import { EMAN_MATERIALS } from "../../model/materials";

interface Props {
  onClose: () => void;
}

export const MaterialDrawer: React.FC<Props> = ({ onClose }) => {
  const materialSlots = useV2Studio((s) => s.materialSlots);
  const setMaterialSlot = useV2Studio((s) => s.setMaterialSlot);

  const facades = EMAN_MATERIALS.filter((m) => m.part === "facade");
  const carcasses = EMAN_MATERIALS.filter((m) => m.part === "carcass");
  const worktops = EMAN_MATERIALS.filter((m) => m.part === "worktop");
  const backs = EMAN_MATERIALS.filter((m) => m.part === "back");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-5 overflow-y-auto flex flex-col gap-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Каталог материалов Ташкента
            </span>
            <span className="text-sm font-bold text-slate-100">
              Eman & Chin Wood Склады
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* 1. Facades Slot */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
              1. Фасады (Слот A)
            </span>
            <span className="text-[10px] text-slate-400">18–19 мм МДФ / ЛДСП</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {facades.map((mat) => {
              const active = materialSlots.facadeId === mat.id;
              return (
                <button
                  key={mat.id}
                  onClick={() => setMaterialSlot("facadeId", mat.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                    active
                      ? "bg-amber-500/15 border-amber-500 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: mat.color }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {mat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{mat.desc}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    ${mat.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Carcass Slot */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-cyan-400 tracking-wider">
              2. Каркас (Слот B)
            </span>
            <span className="text-[10px] text-slate-400">16 мм ЛДСП Egger/Kastamonu</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {carcasses.map((mat) => {
              const active = materialSlots.carcassId === mat.id;
              return (
                <button
                  key={mat.id}
                  onClick={() => setMaterialSlot("carcassId", mat.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                    active
                      ? "bg-cyan-500/15 border-cyan-500 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: mat.color }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {mat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{mat.desc}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    ${mat.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Countertop Slot */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
              3. Столешница (Слот W)
            </span>
            <span className="text-[10px] text-slate-400">28–38 мм Постформинг / Камень</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {worktops.map((mat) => {
              const active = materialSlots.countertopId === mat.id;
              return (
                <button
                  key={mat.id}
                  onClick={() => setMaterialSlot("countertopId", mat.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                    active
                      ? "bg-emerald-500/15 border-emerald-500 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: mat.color }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {mat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{mat.desc}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ${mat.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Backing Slot */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-300 tracking-wider">
              4. Задняя стенка (Слот C)
            </span>
            <span className="text-[10px] text-slate-400">3 мм ХДФ</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {backs.map((mat) => {
              const active = materialSlots.backId === mat.id;
              return (
                <button
                  key={mat.id}
                  onClick={() => setMaterialSlot("backId", mat.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                    active
                      ? "bg-slate-600/30 border-slate-400 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: mat.color }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {mat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{mat.desc}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    ${mat.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
