import React, { useState } from "react";
import { useV2Studio } from "../state/useV2Studio";

export const NumpadDock: React.FC = () => {
  const activeNumpad = useV2Studio((s) => s.activeNumpad);
  const closeNumpad = useV2Studio((s) => s.closeNumpad);
  const updateModuleWidth = useV2Studio((s) => s.updateModuleWidth);
  const setWallWidthMm = useV2Studio((s) => s.setWallWidthMm);

  if (!activeNumpad) return null;

  const [valStr, setValStr] = useState<string>(String(activeNumpad.currentValue));
  const presets = [400, 450, 600, 800, 900, 1200];

  const handleDigit = (d: string) => {
    setValStr((prev) => (prev === "0" ? d : prev + d));
  };

  const handleBackspace = () => {
    setValStr((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  };

  const handleApply = () => {
    const num = parseInt(valStr, 10);
    if (!isNaN(num) && num > 0) {
      if (activeNumpad.moduleId === "wall") {
        setWallWidthMm(num);
      } else {
        updateModuleWidth(activeNumpad.moduleId, num);
      }
    }
    closeNumpad();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-5 w-full max-w-sm text-white flex flex-col gap-4">
        {/* Header with Title & Live Input Display */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Быстрый ввод размера
            </span>
            <span className="text-sm font-semibold text-slate-200">
              {activeNumpad.label}
            </span>
          </div>
          <button
            onClick={closeNumpad}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Big Display Screen */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-3 rounded-2xl border border-slate-800 shadow-inner">
          <span className="text-xs text-slate-500 font-mono">ЗНАЧЕНИЕ:</span>
          <div className="text-3xl font-mono font-black text-cyan-400 tracking-wider">
            {valStr} <span className="text-sm text-slate-500 font-normal">мм</span>
          </div>
        </div>

        {/* Quick Size Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setValStr(String(p))}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition ${
                valStr === String(p)
                  ? "bg-cyan-500 text-slate-950 shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="h-12 bg-slate-800/90 hover:bg-slate-700 active:bg-cyan-600 rounded-2xl font-mono text-xl font-bold transition flex items-center justify-center text-slate-100 shadow"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => setValStr("0")}
            className="h-12 bg-slate-800/90 hover:bg-slate-700 rounded-2xl font-mono text-lg font-bold transition text-amber-400 flex items-center justify-center"
          >
            C
          </button>
          <button
            onClick={() => handleDigit("0")}
            className="h-12 bg-slate-800/90 hover:bg-slate-700 active:bg-cyan-600 rounded-2xl font-mono text-xl font-bold transition flex items-center justify-center text-slate-100"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-12 bg-slate-800/90 hover:bg-slate-700 rounded-2xl font-mono text-lg font-bold transition text-red-400 flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={closeNumpad}
            className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl text-xs font-bold text-slate-300 transition"
          >
            Отмена
          </button>
          <button
            onClick={handleApply}
            className="py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:from-cyan-600 active:to-blue-700 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-cyan-500/25 transition"
          >
            Применить ✓
          </button>
        </div>
      </div>
    </div>
  );
};
