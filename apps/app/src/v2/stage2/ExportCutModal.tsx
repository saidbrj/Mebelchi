import React, { useState } from "react";
import { useV2Studio } from "../state/useV2Studio";
import type { PartsList } from "../../model/partsList";
import { partsXlsx, type PartsXlsxMeta, type PartsXlsxLabels } from "../../model/partsXlsx";
import { drawCutPdf, type CutPdfLabels, type ResultRow } from "../../model/cutPdf";
import { nest, type NestPanel, type NestResult } from "../../model/nest";
import { shareOrDownload } from "../../lib/shareFile";

interface Props {
  onClose: () => void;
}

export const ExportCutModal: React.FC<Props> = ({ onClose }) => {
  const projectName = useV2Studio((s) => s.projectName);
  const getDerivedParts = useV2Studio((s) => s.getDerivedParts);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const parts = getDerivedParts();

  // Statistics calculation
  const totalParts = parts.reduce((acc, p) => acc + p.qty, 0);
  const totalM2 = parts
    .reduce((acc, p) => acc + (p.lengthMm * p.widthMm * p.qty) / 1_000_000, 0)
    .toFixed(2);
  const totalEdgeM = parts
    .reduce((acc, p) => acc + ((p.lengthMm + p.widthMm) * 2 * p.qty) / 1000, 0)
    .toFixed(1);
  const estSheets = Math.ceil(parseFloat(totalM2) / 4.8); // 2750x1830 is ~5.03 m2, ~4.8m2 usable

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Generate & Download Eman XLSX
  const handleDownloadXlsx = async () => {
    try {
      setExporting("xlsx");

      const totalM2Num = parseFloat(totalM2);
      const pl: PartsList = {
        totalParts,
        distinct: parts.length,
        boardM2: totalM2Num,
        lines: parts.map((p) => ({
          no: p.no,
          module: p.module,
          part: p.role,
          material: p.material,
          thicknessMm: p.thicknessMm,
          lengthMm: p.lengthMm,
          widthMm: p.widthMm,
          qty: p.qty,
          grain: p.grain,
          edge: p.edge,
          profile: p.note,
        })),
        hardware: [],
      };

      const meta: PartsXlsxMeta = {
        project: projectName,
        fromLine: "Mebely Studio v2.0 · Tashkent Expo Edition",
        gradeLabel: "Премиум (Blum)",
        reinforced: true,
      };

      const labels: PartsXlsxLabels = {
        sheetParts: "Детали",
        sheetHw: "Фурнитура",
        title: "Спецификация для распила (Eman Materials)",
        from: "Источник:",
        project: "Проект:",
        grade: "Класс:",
        reinforce: "Стяжка:",
        yes: "Да",
        no: "Нет",
        totalParts: "Всего деталей:",
        boardM2: "Площадь плит (м²):",
        note: "Размеры чистовые для пильного станка (CUT).",
        colNo: "№",
        colModule: "Модуль",
        colPart: "Деталь",
        colMat: "Материал",
        colThk: "Толщ.",
        colLen: "Длина",
        colWid: "Ширина",
        colQty: "Кол-во",
        colGrain: "Текстура",
        colEdge: "Кромка",
        colProfile: "Примечание",
        colHwName: "Наименование",
        colHwQty: "Кол-во",
        grainYes: "Да",
      };

      const bytes = partsXlsx(pl, meta, labels);
      const safeProject = projectName.replace(/[/\\:*?"<>|]+/g, "-");
      const fileName = `${safeProject}_Eman_Распил.xlsx`;
      const file = new File([bytes.buffer as ArrayBuffer], fileName, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await shareOrDownload(
        file,
        { ok: "Eman XLSX сохранен!", fail: "Не удалось сохранить файл" },
        showToast,
        new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
    } catch (err) {
      console.error(err);
      showToast("Ошибка при создании XLSX");
    } finally {
      setExporting(null);
    }
  };

  // 2. Generate & Download Vector Nesting PDF
  const handleDownloadPdf = async () => {
    try {
      setExporting("pdf");

      const [{ jsPDF }, { PT_SANS_BASE64 }] = await Promise.all([
        import("jspdf"),
        import("../../pdf/ptSans"),
      ]);

      const sheetW = 2750;
      const sheetH = 1830;

      // Map derived parts into NestPanels
      const nestPanelsList: NestPanel[] = [];
      parts.forEach((p) => {
        for (let q = 0; q < p.qty; q++) {
          nestPanelsList.push({
            id: `p-${p.no}-${q}`,
            w: Math.max(10, p.lengthMm),
            h: Math.max(10, p.widthMm),
            part: p.role,
            partRu: p.role,
            module: p.module,
            group: `${p.material} · ${p.thicknessMm}`,
            material: p.material,
            thickness: p.thicknessMm,
            grain: p.grain,
          });
        }
      });

      // Run Guillotine nesting
      const nestRes: NestResult = nest(nestPanelsList, {
        sheetW,
        sheetH,
        kerf: 4,
        respectGrain: true,
        remains: [],
      });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.addFileToVFS("PTSans.ttf", PT_SANS_BASE64);
      doc.addFont("PTSans.ttf", "PTSans", "normal");

      const results: ResultRow[] = [
        { label: "Формат плиты", value: `${sheetW} × ${sheetH} мм` },
        { label: "Количество листов", value: `${nestRes.sheets.length}` },
        { label: "Всего деталей", value: `${totalParts}` },
        { label: "Площадь деталей", value: `${totalM2} м²` },
        { label: "Деловой остаток", value: `${nestRes.stats.remnantAreaM2} м²` },
        { label: "Отход / Опил", value: `${nestRes.stats.wastePct} %` },
        { label: "Длина пила", value: `${nestRes.stats.cutLengthM} м` },
      ];

      const labels: CutPdfLabels = {
        title: "Карта раскроя плит · Векторный план",
        results: "Сводные показатели раскроя",
        materials: "Материалы проекта",
        sheet: "Лист",
        offcut: "Обрез",
        remnantWord: "Деловой остаток",
        partsOnSheet: "Деталей на листе",
        colLen: "Длина",
        colWid: "Ширина",
        colQty: "Кол-во",
        sheetsUnit: "листов",
        brand: "Mebely · Гарантия идеального распила",
      };

      drawCutPdf(doc, nestRes, results, labels, "PTSans");

      const blob = doc.output("blob") as Blob;
      const safeProject = projectName.replace(/[/\\:*?"<>|]+/g, "-");
      const fileName = `${safeProject}_Карта_Раскроя.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      await shareOrDownload(
        file,
        { ok: "PDF карта раскроя сохранена!", fail: "Не удалось сохранить PDF" },
        showToast
      );
    } catch (err) {
      console.error(err);
      showToast("Ошибка при создании PDF");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-xl font-black shadow-lg shadow-amber-500/20">
              ⚡
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white">
                  Заказ на распил
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Eman / Chin Wood
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {projectName}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Guarantee Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-cyan-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div className="flex flex-col">
                <span className="text-sm font-black text-amber-300 uppercase tracking-wide">
                  Гарантия идеального распила (Cut Perfect Guarantee)
                </span>
                <span className="text-xs text-slate-300">
                  Все зазоры (3мм), припуски под кромку (2мм) и общие перегородки (16мм) рассчитаны математически.
                </span>
              </div>
            </div>
            <div className="px-3 py-1 bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase whitespace-nowrap shadow">
              Точность 100%
            </div>
          </div>

          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Всего деталей
              </span>
              <span className="text-2xl font-mono font-black text-white mt-1">
                {totalParts} <span className="text-xs text-slate-500 font-normal">шт</span>
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Площадь плит
              </span>
              <span className="text-2xl font-mono font-black text-cyan-400 mt-1">
                {totalM2} <span className="text-xs text-slate-500 font-normal">м²</span>
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Кромка ПВХ
              </span>
              <span className="text-2xl font-mono font-black text-amber-400 mt-1">
                {totalEdgeM} <span className="text-xs text-slate-500 font-normal">м</span>
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Листов ЛДСП (~2.75×1.83)
              </span>
              <span className="text-2xl font-mono font-black text-emerald-400 mt-1">
                ~{estSheets} <span className="text-xs text-slate-500 font-normal">листов</span>
              </span>
            </div>
          </div>

          {/* Golden Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadXlsx}
              disabled={exporting !== null}
              className="py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 transition disabled:opacity-50"
            >
              <span className="text-xl">📊</span>
              <div className="flex flex-col text-left">
                <span>{exporting === "xlsx" ? "Генерация..." : "Скачать Eman XLSX"}</span>
                <span className="text-[10px] font-normal text-emerald-200">
                  Прямая подача на форматно-раскроечный станок
                </span>
              </div>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={exporting !== null}
              className="py-4 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-blue-600/25 transition disabled:opacity-50"
            >
              <span className="text-xl">📐</span>
              <div className="flex flex-col text-left">
                <span>{exporting === "pdf" ? "Генерация..." : "Карта раскроя (Векторный PDF)"}</span>
                <span className="text-[10px] font-normal text-blue-200">
                  Схема раскроя с деловым остатком для цеха
                </span>
              </div>
            </button>
          </div>

          {/* Parts List Preview Table */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Деталировочная таблица (CUT-размеры):
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Показано {parts.length} строк
              </span>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="p-2.5">№</th>
                      <th className="p-2.5">Модуль</th>
                      <th className="p-2.5">Деталь</th>
                      <th className="p-2.5">Материал</th>
                      <th className="p-2.5">Длина</th>
                      <th className="p-2.5">Ширина</th>
                      <th className="p-2.5">Кол-во</th>
                      <th className="p-2.5">Кромка</th>
                      <th className="p-2.5">Примечание</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {parts.map((p) => (
                      <tr key={p.no} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-2.5 text-slate-500">{p.no}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-200">{p.module}</td>
                        <td className="p-2.5 font-sans text-cyan-300">{p.role}</td>
                        <td className="p-2.5 text-slate-400 truncate max-w-[120px]">{p.material}</td>
                        <td className="p-2.5 text-amber-300">{p.lengthMm}</td>
                        <td className="p-2.5 text-amber-300">{p.widthMm}</td>
                        <td className="p-2.5 text-white font-bold">{p.qty}</td>
                        <td className="p-2.5 text-emerald-400 font-sans text-[10px]">{p.edge}</td>
                        <td className="p-2.5 text-slate-500 font-sans text-[10px]">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Готово для отправки на ЧПУ Eman / Chin Wood
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            Закрыть
          </button>
        </div>

        {/* Floating Toast */}
        {toastMsg && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-2xl animate-bounce">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
};
