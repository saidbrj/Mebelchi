// Phase Е — "Передача / Готово к станку": the factory handoff. Shows architectural
// drawings (FacePlan + TopPlan, IKEA-style) + the real production package (cut list +
// hardware) derived from the run, with PNG / CSV downloads. DXF / SWJ008 / native share
// are the next phases.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, HW_GRADE_LABEL } from "../store";
import { useProduction } from "../pricing/usePrice";
import { registerExport } from "../lib/handoffExport";
import { IconTelegram } from "../components/icons";
import { useT } from "../i18n/useT";
import { production, productionCSV, cabLabel } from "../model/cncExport";
import { cabDepth } from "../model/resolve";
import { nest, nestPanels, type RemainSheet } from "../model/nest";
import { nestDXF } from "../model/nestDxf";
import { machiningReport, runSWJ008 } from "../model/machining";
import { CutMap } from "../components/CutMap";
import { drawCutPdf } from "../model/cutPdf";
import { drawDrawingsPdf, drawOneDrawing, type DrawingsData, type DrawingsLabels, type DrawingSel } from "../model/drawingsPdf";
import { DrawingPage } from "../components/DrawingPage";
import { DrillSheet } from "../components/DrillSheet";
import { VariantScene, type SceneApi } from "../three/VariantScene";
import { FLOOR_COVERINGS } from "../model/floors";
import { shareOrDownload as shareFile_ } from "../lib/shareFile";
import type { Cabinet } from "../model/cabinet";

export function HandoffScreen() {
  const t = useT();
  const cabs = useStore((s) => s.cabs);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
  const roomName = useStore((s) => s.roomName);
  const points = useStore((s) => s.roomPoints);
  const openings = useStore((s) => s.openings);
  const waterWall = useStore((s) => s.waterWall);
  const layout = useStore((s) => s.runLayout);
  const interiorWalls = useStore((s) => s.interiorWalls);
  const fittings = useStore((s) => s.fittings);
  const wallSurfaces = useStore((s) => s.wallSurfaces);
  const style = useStore((s) => s.runStyle);
  const floorCovering = useStore((s) => s.floorCovering);
  const hwGrade = useStore((s) => s.hwGrade);
  const hardened = useStore((s) => s.hardened);
  const settings = useStore((s) => s.settings);
  const flash = useStore((s) => s.flash);
  const gradeLabel = HW_GRADE_LABEL[hwGrade];
  const fromLine = [settings.company, settings.name, settings.phone].filter(Boolean).join(" · ");
  const project = roomName || "Кухня";
  const coveringColor = FLOOR_COVERINGS[floorCovering]?.color ?? "#ecd9b4";
  const sceneApi = useRef<SceneApi | null>(null);
  const onApi = useCallback((api: SceneApi | null) => { sceneApi.current = api; }, []);
  // expose the export/share to the journey Footer's final CTA ("Экспорт на ЧПУ →"). The ref
  // is assigned below (past the early return) with the real `shareFiles`; the Footer calls
  // it via store.next() → runExport(). (Hooks must sit above the early return.)
  const shareRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    registerExport(() => shareRef.current?.());
    return () => registerExport(null);
  }, []);

  const [allPanels, setAllPanels] = useState(false);
  const [allHw, setAllHw] = useState(false);
  const PREVIEW = 4;
  // the shop's build conventions (hangers per carcass) — the hardware list must show what
  // this workshop actually fits, and a merged row hangs on one set, not one per cabinet
  const shop = useProduction();
  const prod = useMemo(() => production(cabs, shop), [cabs, shop]);
  // sheet nesting (Раскрой) — pack the cut list onto boards; offcuts entered here fill first
  const [remains, setRemains] = useState<RemainSheet[]>([]);
  const [rw, setRw] = useState("");
  const [rh, setRh] = useState("");
  const { sheetW, sheetH, kerf, respectGrain } = settings;
  const nestResult = useMemo(
    () => nest(nestPanels(cabs, respectGrain), { sheetW, sheetH, kerf, respectGrain, remains }),
    [cabs, sheetW, sheetH, kerf, respectGrain, remains],
  );
  const addRemain = () => {
    const w = parseInt(rw, 10);
    const h = parseInt(rh, 10);
    if (w > 0 && h > 0) {
      setRemains((rs) => [...rs, { w, h }]);
      setRw("");
      setRh("");
    }
  };
  // run the drilling solver + safety gate over the whole run (the machine-ready plan)
  const machining = useMemo(() => machiningReport(cabs), [cabs]);
  // shared module numbering (same order as the cut list) so a module has ONE number
  // across the cut list, FacePlan and TopPlan
  const numberOf = useMemo(() => {
    const m = new Map<string, number>();
    cabs.filter((c) => !c.furniture).forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [cabs]);
  // ONE elevation/worktop per wall run — an L/U kitchen has 2–3 runs, each its own drawing
  // (an earlier version drew only the run with the most modules, so the other walls vanished)
  const drawRuns = useMemo(() => {
    const tiled = cabs.filter((c) => c.x != null && c.px == null && !c.furniture && c.appliance !== "filler");
    if (!tiled.length) return [];
    const byRun = new Map<number, Cabinet[]>();
    for (const c of tiled) {
      const r = c.run ?? 0;
      const arr = byRun.get(r) ?? [];
      arr.push(c);
      byRun.set(r, arr);
    }
    return [...byRun.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([run, arr], i) => ({ run, wall: i + 1, cabs: arr, wallLen: Math.max(...arr.map((c) => (c.x as number) + c.w), 1) }));
  }, [cabs]);
  const today = new Date().toLocaleDateString("ru-RU");

  // Drawing payload — feeds BOTH the on-screen previews (DrawingPage) and the PDF export, so
  // they render the identical sheet. `img3d` is added only for the PDF (needs a 3D capture).
  const dwLabels: DrawingsLabels = useMemo(() => {
    const th = t.handoff;
    return {
      title: th.drawings, view3d: th.view3d, face: th.vFace, topPlan: th.dwTopPlan, worktop: th.vWorktop,
      legend: th.dwLegend, wall: th.wall, project: th.dwProject, dateL: th.dwDate, note: th.dwNote,
      colN: th.dwColN, colName: th.dwColName, colDims: th.dwColDims, brand: "Jihozla",
    };
  }, [t]);
  const dwData: DrawingsData = useMemo(() => {
    const th = t.handoff;
    const label = (c: Cabinet): string => {
      if (c.appliance && c.appliance !== "none" && c.appliance !== "filler") return t.labels.appl[c.appliance] ?? t.labels.tech;
      if (c.corner) return t.labels.corner;
      return c.kind === "upper" ? t.labels.kindUpper : c.kind === "tall" ? t.labels.kindTall : t.labels.kindBase;
    };
    return {
      runs: drawRuns, ceiling, reveal, numberOf, points, cabs, openings, waterWall, layout,
      summary: [
        { label: th.dwModules, value: String(prod?.moduleCount ?? 0) },
        { label: th.dwWalls, value: String(drawRuns.length) },
        { label: th.dwBoard, value: `${prod?.boardM2 ?? 0} ${th.uM2}` },
        { label: th.dwParts, value: String(prod?.panels.length ?? 0) },
      ],
      modules: cabs
        .filter((c) => !c.furniture)
        .map((c) => ({ n: numberOf.get(c.id) ?? 0, name: label(c), w: c.w, h: c.h, d: cabDepth(c) }))
        .sort((a, b) => a.n - b.n),
      project, date: today, img3d: null,
    };
  }, [t, drawRuns, ceiling, numberOf, points, cabs, openings, waterWall, layout, prod, project, today]);

  if (!prod || !drawRuns.length) {
    return (
      <section className="screen">
        <div className="qnum">{t.handoff.num}</div>
        <h1 className="h1">{t.handoff.emptyTitle}</h1>
        <p className="sub" style={{ marginTop: 12 }}>{t.handoff.emptySub}</p>
      </section>
    );
  }

  // save/share one file — the native-vs-web path lives in lib/shareFile.ts now, shared with the
  // Рендер step (a plain <a download> is a no-op inside the native app)
  const shareOrDownload = (shareFile: File, ok: string, dlBlob?: Blob) =>
    shareFile_(shareFile, { ok, fail: t.handoff.tDlFail }, flash, dlBlob);

  const downloadText = (text: string, file: string, mime: string, ok: string, bom = true) => {
    // BOM helps Excel read Cyrillic CSV; but a DXF must start with "0\nSECTION", so opt-out there
    const body = (bom ? "﻿" : "") + text;
    void shareOrDownload(new File([body], file, { type: "text/plain" }), ok, new Blob([body], { type: mime }));
  };
  // CSV carries the engineering spec (grade + усиление) as a header so it travels to the factory
  const specHeader = `${fromLine ? `${t.handoff.csvFrom};${fromLine}\r\n` : ""}${t.handoff.csvSpec};${project}\r\n${t.handoff.csvGrade};${gradeLabel}\r\n${t.handoff.csvReinforce};${hardened ? t.handoff.yes : t.handoff.no}\r\n\r\n`;
  const downloadCSV = () => downloadText(specHeader + productionCSV(prod), "jihozla-spec.csv", "text/csv;charset=utf-8", t.handoff.tCsv);
  const downloadDXF = () => {
    const dxf = nestDXF(nestResult);
    if (dxf) downloadText(dxf, "jihozla-nesting.dxf", "application/dxf", t.handoff.tDxf, false);
  };
  // SWJ008 machine file — the engine only emits it if the safety gate passed
  const downloadSWJ008 = () => {
    const xml = runSWJ008(cabs);
    if (!xml) {
      flash(t.handoff.tSwjBlocked);
      return;
    }
    downloadText(xml, "jihozla-swj008.xml", "application/xml", t.handoff.tSwj, false);
  };

  // Share the factory package via the OS share sheet — the user picks Telegram. Web Share
  // (level 2, files) works in mobile browsers + the Capacitor WebView, but phones reject
  // custom MIME types (application/dxf etc.), so we tag the text files as text/plain (keeping
  // the real .xml/.dxf extension the factory needs) and filter to only the files THIS device
  // will accept; anything it won't share is downloaded so nothing is lost.
  const shareFiles = async () => {
    // the cutting PLAN (PDF) + the DXF go to every workshop; the CNC drilling file + CSV spec
    // only when "advanced" is on (the ~95% who cut manually don't need them)
    const adv = settings.advancedExport;
    const pdfBlob = await buildCutPdf();
    const dxf = nestDXF(nestResult);
    const xml = adv ? runSWJ008(cabs) : null; // SWJ008 only if the safety gate passed
    const all: File[] = [];
    if (pdfBlob) all.push(new File([pdfBlob], "jihozla-раскрой.pdf", { type: "application/pdf" }));
    if (dxf) all.push(new File([dxf], "jihozla-nesting.dxf", { type: "text/plain" }));
    if (xml) all.push(new File([xml], "jihozla-swj008.xml", { type: "text/plain" }));
    if (adv) all.push(new File(["﻿" + specHeader + productionCSV(prod)], "jihozla-spec.csv", { type: "text/csv" }));
    if (!all.length) return;

    const nav = navigator as Navigator & {
      canShare?: (d?: { files?: File[] }) => boolean;
      share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    const title = `Jihozla · ${project}`;
    const text = `${project} — ${t.handoff.hardware}: ${gradeLabel}.`;
    const dlAnchor = (f: File) => {
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const downloadAll = () => all.forEach(dlAnchor);

    if (nav.share && nav.canShare) {
      const ok = all.filter((f) => nav.canShare!({ files: [f] }));
      if (ok.length) {
        try {
          await nav.share({ files: ok, title, text });
          if (ok.length < all.length) {
            downloadAll(); // grab the ones the device wouldn't share
            flash(t.handoff.tSharePartial);
          } else {
            flash(t.handoff.tShared);
          }
          return;
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return; // user cancelled
          // any other error → fall through to a plain download
        }
      }
    }
    downloadAll();
    flash(t.handoff.tShareUnavail);
  };
  shareRef.current = shareFiles; // Footer's final CTA runs this via runExport()
  // Render an on-page drawing SVG to a white-background PNG data-URL. Shared by the single-PNG
  // export and the PDF builder.
  const svgToPngUrl = (svgId: string, targetW: number): Promise<string | null> =>
    new Promise((resolve) => {
      const el = document.getElementById(svgId) as unknown as SVGSVGElement | null;
      if (!el) return resolve(null);
      const vb = el.viewBox.baseVal;
      const clone = el.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(vb.width));
      clone.setAttribute("height", String(vb.height));
      const xml = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = Math.round((targetW * vb.height) / vb.width);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    });

  // Multi-page A4 PDF built in-app (jsPDF) and handed to the OS share sheet — works in the
  // Capacitor WebView, unlike the old window.open()+print() that iOS blocks. 3D shot first,
  // then each drawing on its own landscape page, fit-to-page keeping aspect ratio.
  // Re-encode a data-URL image to JPEG at `w` px wide — photos (the 3D shot) shrink ~10×
  // as JPEG vs PNG, the main reason the drawings PDF used to balloon to 100MB+.
  const toJpeg = (dataUrl: string, w: number, quality = 0.82): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = Math.round((w * img.height) / img.width);
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

  // The drawings PDF — the SAME sheets the previews render (model/drawings.ts), so every file
  // and every thumbnail share one layout. `img3d` is captured only when the 3D page is needed.
  const drawingsPayload = async (need3d: boolean): Promise<DrawingsData> => {
    if (!need3d) return dwData;
    const shot = sceneApi.current?.captureHiRes(1600);
    const img3d = shot ? await toJpeg(shot, 1600) : null;
    return { ...dwData, img3d };
  };
  const newPdf = async () => {
    const [{ jsPDF }, { PT_SANS_BASE64 }] = await Promise.all([import("jspdf"), import("../pdf/ptSans")]);
    const pdf = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
    pdf.addFileToVFS("PTSans.ttf", PT_SANS_BASE64);
    pdf.addFont("PTSans.ttf", "PTSans", "normal");
    return pdf;
  };
  const downloadDrawingsPDF = async () => {
    const data = await drawingsPayload(true);
    const pdf = await newPdf();
    drawDrawingsPdf(pdf, data, dwLabels, "PTSans");
    const name = `jihozla-чертежи-${(project || "проект").replace(/[/\\:*?"<>|]+/g, "-")}.pdf`;
    void shareOrDownload(new File([pdf.output("blob") as Blob], name, { type: "application/pdf" }), t.handoff.tShared);
  };
  /** One drawing on its own sheet — the SAME sheet the preview shows, so an individual file is
   *  literally a page of the document (replaces the old, differently-styled PNG export). */
  const downloadOneDrawing = async (sel: DrawingSel, file: string) => {
    const data = await drawingsPayload(sel.kind === "view3d");
    const pdf = await newPdf();
    if (!drawOneDrawing(pdf, data, dwLabels, "PTSans", sel)) {
      flash(t.handoff.tImgFail);
      return;
    }
    void shareOrDownload(new File([pdf.output("blob") as Blob], file, { type: "application/pdf" }), t.handoff.tDrawDl);
  };

  // Cutting PDF — the paper plan the workshop follows at the saw, drawn as VECTOR with an
  // embedded PT Sans subset (Russian/Uzbek labels, sharp, a few KB). Results page + one board
  // per page + a parts table + a Jihozla/page-number footer. The primary deliverable for the
  // ~95% who cut manually; the DXF is for CAD/CNC. Shared by the download + the Telegram share.
  const buildCutPdf = async (): Promise<Blob | null> => {
    if (!nestResult.sheets.length) return null;
    const [{ jsPDF }, { PT_SANS_BASE64 }] = await Promise.all([import("jspdf"), import("../pdf/ptSans")]);
    const pdf = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
    pdf.addFileToVFS("PTSans.ttf", PT_SANS_BASE64);
    pdf.addFont("PTSans.ttf", "PTSans", "normal");
    const st = nestResult.stats;
    const th = t.handoff;
    const results = [
      { label: th.sumSheetSize, value: `${sheetW} × ${sheetH} ${th.uMm}` },
      { label: th.resSheets, value: `${st.sheetCount}` },
      { label: th.resParts, value: `${st.partCount}` },
      { label: th.sumPartArea, value: `${st.partAreaM2} ${th.uM2}` },
      { label: th.resRemnant, value: `${st.remnantAreaM2} ${th.uM2}` },
      { label: th.resWaste, value: `${st.wastePct} %` },
      { label: th.sumCut, value: `${st.cutLengthM} ${th.uM}` },
    ];
    const labels = {
      title: th.sumTitle, results: th.sumResults, materials: th.sumMaterials,
      sheet: th.sheet, offcut: th.offcutWord, remnantWord: th.remnantWord, partsOnSheet: th.partsOnSheet,
      colLen: th.colLen, colWid: th.colWid, colQty: th.colQty, sheetsUnit: th.sheets, brand: "Jihozla",
    };
    drawCutPdf(pdf, nestResult, results, labels, "PTSans");
    return pdf.output("blob") as Blob;
  };
  const downloadCutPDF = async () => {
    const blob = await buildCutPdf();
    if (!blob) return;
    const name = `jihozla-раскрой-${(project || "проект").replace(/[/\\:*?"<>|]+/g, "-")}.pdf`;
    void shareOrDownload(new File([blob], name, { type: "application/pdf" }), t.handoff.tCutPdf);
  };

  const downloadPNG = async (svgId: string, file: string) => {
    const dataUrl = await svgToPngUrl(svgId, 1800);
    if (!dataUrl) {
      flash(t.handoff.tImgFail);
      return;
    }
    const blob = await (await fetch(dataUrl)).blob();
    void shareOrDownload(new File([blob], file, { type: "image/png" }), t.handoff.tDrawDl);
  };
  const download3D = async () => {
    // 4K PNG (clamped to the GPU's max texture size) — the factory-quality shot,
    // not the small JPEG used for thumbnails / AI-render input
    const url = sceneApi.current?.captureHiRes(3840);
    if (!url) {
      flash(t.handoff.t3dNotReady);
      return;
    }
    const blob = await (await fetch(url)).blob(); // data-URL → Blob for the share sheet / download
    void shareOrDownload(new File([blob], "jihozla-3d.png", { type: "image/png" }), t.handoff.t3dDl);
  };

  return (
    <section className="screen ho-screen">
      <div className="qnum">{t.handoff.num}</div>
      <h1 className="h1">{t.handoff.title}</h1>

      <div className="ho-spec">
        <span>{t.handoff.hardware}: <b>{gradeLabel}</b></span>
        <span>{t.handoff.reinforce}: <b>{hardened ? t.handoff.yes : t.handoff.no}</b></span>
      </div>

      <div className="cost-sec-title" style={{ marginTop: 16 }}>{t.handoff.view3d}</div>
      <div className="ho-3d">
        <VariantScene
          points={points}
          ceiling={ceiling}
          reveal={reveal}
          openings={openings}
          coveringColor={coveringColor}
          floorId={FLOOR_COVERINGS[floorCovering]?.id}
          interiorWalls={interiorWalls}
          fittings={fittings}
          wallSurfaces={wallSurfaces}
          waterWall={waterWall}
          layout={layout}
          style={style}
          cabs={cabs}
          mode="real"
          nav
          onApi={onApi}
        />
      </div>
      <button className="ho-download ho-download-2" onClick={download3D} type="button">{t.handoff.dl3d}</button>

      {/* drawings as compact download cards, 2 per row — tap a card to save that PNG. One
          Фасад + Столешница per wall run (multi-wall labelled «· Стена N»). */}
      <div className="cost-sec-title">{t.handoff.drawings}</div>
      <div className="ho-draw-grid">
        {drawRuns.map((dr) => {
          const wl = drawRuns.length > 1 ? ` · ${t.handoff.wall(dr.wall)}` : "";
          return (
            <button key={`face-${dr.run}`} className="ho-draw-card" onClick={() => downloadOneDrawing({ kind: "face", run: dr }, `jihozla-фасад-${dr.wall}.pdf`)} type="button">
              <span className="ho-draw-card-img">
                <DrawingPage data={dwData} labels={dwLabels} sel={{ kind: "face", run: dr }} />
              </span>
              <span className="ho-draw-card-lbl">{t.handoff.dlFace}{wl}</span>
            </button>
          );
        })}
        <button className="ho-draw-card" onClick={() => downloadOneDrawing({ kind: "top" }, "jihozla-план.pdf")} type="button">
          <span className="ho-draw-card-img">
            <DrawingPage data={dwData} labels={dwLabels} sel={{ kind: "top" }} />
          </span>
          <span className="ho-draw-card-lbl">{t.handoff.dlTop}</span>
        </button>
        {drawRuns.map((dr) => {
          const wl = drawRuns.length > 1 ? ` · ${t.handoff.wall(dr.wall)}` : "";
          return (
            <button key={`wt-${dr.run}`} className="ho-draw-card" onClick={() => downloadOneDrawing({ kind: "worktop", run: dr }, `jihozla-столешница-${dr.wall}.pdf`)} type="button">
              <span className="ho-draw-card-img">
                <DrawingPage data={dwData} labels={dwLabels} sel={{ kind: "worktop", run: dr }} />
              </span>
              <span className="ho-draw-card-lbl">{t.handoff.dlWorktop}{wl}</span>
            </button>
          );
        })}
        {machining && settings.advancedExport && (
          <button className="ho-draw-card" onClick={() => downloadPNG("draw-drill", "jihozla-drill.png")} type="button">
            <span className="ho-draw-card-img">
              <DrillSheet svgId="draw-drill" parts={machining.parts} project={project} date={today} />
            </span>
            <span className="ho-draw-card-lbl">{t.handoff.dlDrill}</span>
          </button>
        )}
      </div>

      <button className="ho-download" style={{ marginTop: 18 }} onClick={downloadDrawingsPDF} type="button">{t.handoff.dlPdf}</button>

      <div className="ho-stats">
        <div className="ho-stat"><span className="ho-stat-n">{prod.panels.length}</span><span className="ho-stat-l">{t.handoff.parts}</span></div>
        <div className="ho-stat"><span className="ho-stat-n">{prod.boardM2}</span><span className="ho-stat-l">{t.handoff.boardM2}</span></div>
        <div className="ho-stat"><span className="ho-stat-n">{prod.moduleCount}</span><span className="ho-stat-l">{t.handoff.modules}</span></div>
        {/* THE SHOP BUILDS BOXES, NOT MODULES. With rows merged the two differ, and the difference is
            the whole point — «4 модуля, 1 корпус» tells the workshop what it is actually assembling.
            Hidden when nothing is merged: the numbers are then the same and the stat is noise. */}
        {prod.boxCount < prod.moduleCount && (
          <div className="ho-stat"><span className="ho-stat-n">{prod.boxCount}</span><span className="ho-stat-l">{t.handoff.boxes}</span></div>
        )}
      </div>

      {/* Раскрой листов — the nested cut plan (saves material by packing parts economically) */}
      {nestResult.sheets.length > 0 && (
        <>
          <div className="cost-sec-title">{t.handoff.nesting}</div>
          <div className="ho-stats">
            <div className="ho-stat"><span className="ho-stat-n">{nestResult.stats.sheetCount}</span><span className="ho-stat-l">{t.handoff.sheets}</span></div>
            <div className="ho-stat"><span className="ho-stat-n">{nestResult.stats.wastePct}%</span><span className="ho-stat-l">{t.handoff.waste}</span></div>
            <div className="ho-stat"><span className="ho-stat-n">{nestResult.stats.remnantAreaM2}</span><span className="ho-stat-l">{t.handoff.remnant}</span></div>
          </div>
          {nestResult.stats.remainCount > 0 && <p className="set-hint set-block-hint">{t.handoff.remainsUsed(nestResult.stats.remainCount)}</p>}
          {!nestResult.ok && <p className="set-hint set-block-hint ho-oversize">{t.handoff.nestOversize(nestResult.stats.unplaced)}</p>}

          {/* offcuts the workshop already has — nested first, before new boards */}
          <div className="ho-remains">
            <span className="ho-remains-label">{t.handoff.remainsAdd}</span>
            <p className="set-hint ho-remains-hint">{t.handoff.remainsHint}</p>
            {remains.length > 0 && (
              <div className="ho-remains-chips">
                {remains.map((r, i) => (
                  <span className="ho-remain-chip" key={i}>
                    {r.w}×{r.h}
                    <button onClick={() => setRemains((rs) => rs.filter((_, j) => j !== i))} type="button" aria-label="×">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="ho-remains-add">
              <div className="ho-remains-fields">
                <input className="ho-remains-input" type="text" inputMode="numeric" placeholder={t.handoff.remainW} value={rw} onChange={(e) => setRw(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && addRemain()} />
                <span className="ho-remains-x">×</span>
                <input className="ho-remains-input" type="text" inputMode="numeric" placeholder={t.handoff.remainH} value={rh} onChange={(e) => setRh(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && addRemain()} />
              </div>
              <button className="ho-remains-btn" onClick={addRemain} type="button" disabled={!(parseInt(rw, 10) > 0 && parseInt(rh, 10) > 0)}>{t.handoff.remainAddBtn}</button>
            </div>
          </div>

          {/* one cut map per board — tap to save its PNG */}
          <div className="ho-cutmaps">
            {nestResult.sheets.map((s) => (
              <button className="ho-cutmap-card" key={s.n} onClick={() => downloadPNG(`cut-${s.n}`, `jihozla-cut-${s.n}.png`)} type="button">
                <CutMap svgId={`cut-${s.n}`} sheet={s} title={`${t.handoff.sheet} ${s.n}`} remainLabel={t.handoff.remain} />
              </button>
            ))}
          </div>
          <div className="ho-actions">
            <button className="ho-download" onClick={downloadCutPDF} type="button">{t.handoff.pdfCut}</button>
            <button className="ho-download ho-download-2" onClick={downloadDXF} type="button">{t.handoff.dxfNest}</button>
          </div>
        </>
      )}

      {machining && settings.advancedExport && (
        <>
          <div className="cost-sec-title">{t.handoff.control}</div>
          <div className={`ho-preflight ${machining.ok ? "ok" : "bad"}`}>
            <div className="ho-pf-head">
              <span className="ho-pf-icon">{machining.ok ? "✓" : "!"}</span>
              <span>{machining.ok ? t.handoff.checksPassed : t.handoff.checksFailed}</span>
              <span className="ho-pf-meta">{t.handoff.countMeta(machining.partCount, machining.holeCount)}</span>
            </div>
            {!machining.ok && (
              <ul className="ho-pf-list">
                {machining.findings.slice(0, 8).map((f) => (
                  <li key={f.op_id ?? f.code + f.part_id}>{f.message_ru}</li>
                ))}
              </ul>
            )}
          </div>
          {machining.skipped.length > 0 && (
            <p className="cost-note eng-skipped">
              {t.eng.skipped} {machining.skipped.map((c) => cabLabel(c)).join(", ")}
            </p>
          )}
          <button
            className="ho-download ho-cnc"
            disabled={!machining.ok || !machining.parts.length}
            onClick={downloadSWJ008}
            type="button"
          >
            {t.handoff.swj}{machining.ok ? "" : t.handoff.swjBlocked}
          </button>
        </>
      )}

      {settings.advancedExport && <button className="ho-download" onClick={downloadCSV} type="button">{t.handoff.csv}</button>}

      <button className="ho-download ho-share" onClick={shareFiles} type="button">
        <IconTelegram /> {t.handoff.share}
      </button>

      <div className="cost-sec-title">{t.handoff.cutMap}</div>
      <div className="ho-table">
        <div className="ho-row ho-head">
          <span className="ho-c-part">{t.handoff.colPart}</span>
          <span className="ho-c-mat">{t.handoff.colMat}</span>
          <span className="ho-c-dim">{t.handoff.colDim}</span>
        </div>
        {(allPanels ? prod.panels : prod.panels.slice(0, PREVIEW)).map((r, i) => (
          <div className="ho-row" key={i}>
            {/* the routed profile rides under the material — the shop has to know what to cut into
                the blank, and the quote already charged for it */}
            <span className="ho-c-part">{r.part}<span className="ho-c-mod">{r.module}</span></span>
            <span className="ho-c-mat">{r.material}{r.profile ? <span className="ho-c-mod">{r.profile}</span> : null}</span>
            <span className="ho-c-dim">{r.lengthMm}×{r.widthMm}×{r.thicknessMm}</span>
          </div>
        ))}
      </div>
      {prod.panels.length > PREVIEW && (
        <button className="ho-more" onClick={() => setAllPanels((v) => !v)} type="button">
          {allPanels ? t.handoff.collapse : t.handoff.showAll(prod.panels.length)}
        </button>
      )}

      <div className="cost-sec-title">{t.handoff.hwList}</div>
      <div className="ho-items">
        {(allHw ? prod.hardware : prod.hardware.slice(0, PREVIEW)).map((h) => (
          <div className="cost-item" key={h.name}>
            <span className="cost-item-name">{h.name}</span>
            <span className="cost-item-amt">{h.qty} {t.handoff.pcs}</span>
          </div>
        ))}
      </div>
      {prod.hardware.length > PREVIEW && (
        <button className="ho-more" onClick={() => setAllHw((v) => !v)} type="button">
          {allHw ? t.handoff.collapse : t.handoff.showAll(prod.hardware.length)}
        </button>
      )}

      <p className="cost-note">{t.handoff.note}</p>
    </section>
  );
}
