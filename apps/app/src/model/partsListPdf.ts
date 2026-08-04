// The CNC parts list as a printable PDF — the human-readable twin of partsXlsx.ts. A plain
// paginated table (NOT a nested layout): one row per part size with finished dimensions and a
// Qty, so a person can read/check/print it on the shop floor while the .xlsx feeds the machine.
// Drawn as vector via jsPDF with the embedded PT Sans subset (Cyrillic/Latin-Uzbek), landscape
// A4, mm. The column header repeats on every page; a Mebely + page-number footer closes each.

import type { jsPDF } from "jspdf";
import type { PartsList } from "./partsList";
import type { PartsXlsxMeta } from "./partsXlsx";

export interface PartsPdfLabels {
  title: string;
  project: string;
  from: string;
  grade: string;
  reinforce: string;
  yes: string;
  no: string;
  totalParts: string;
  boardM2: string;
  note: string;
  brand: string;
  colNo: string;
  colModule: string;
  colPart: string;
  colMat: string;
  colThk: string;
  colLen: string;
  colWid: string;
  colQty: string;
  colGrain: string;
  colEdge: string;
  colProfile: string;
  grainYes: string;
}

interface Col {
  label: string;
  weight: number; // relative width; scaled to the printable area
  get: (r: PartsList["lines"][number], L: PartsPdfLabels) => string;
  align: "left" | "center";
}

const COLS: Col[] = [
  { label: "colNo", weight: 5, get: (r) => String(r.no), align: "center" },
  { label: "colModule", weight: 22, get: (r) => r.module, align: "left" },
  { label: "colPart", weight: 16, get: (r) => r.part, align: "left" },
  { label: "colMat", weight: 20, get: (r) => r.material, align: "left" },
  { label: "colThk", weight: 8, get: (r) => String(r.thicknessMm), align: "center" },
  { label: "colLen", weight: 9, get: (r) => String(r.lengthMm), align: "center" },
  { label: "colWid", weight: 9, get: (r) => String(r.widthMm), align: "center" },
  { label: "colQty", weight: 7, get: (r) => String(r.qty), align: "center" },
  { label: "colGrain", weight: 7, get: (r, L) => (r.grain ? L.grainYes : "—"), align: "center" },
  { label: "colEdge", weight: 10, get: (r) => r.edge, align: "center" },
  { label: "colProfile", weight: 18, get: (r) => r.profile || "—", align: "left" },
];

const MB = 18; // bottom margin reserved for the footer
const M = 10; // side margins

export function drawPartsListPdf(pdf: jsPDF, pl: PartsList, meta: PartsXlsxMeta, L: PartsPdfLabels, font: string): void {
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const usable = PW - M * 2;
  const totalWeight = COLS.reduce((s, c) => s + c.weight, 0);
  const widths = COLS.map((c) => (c.weight / totalWeight) * usable);
  const x0 = COLS.map((_, i) => M + widths.slice(0, i).reduce((s, w) => s + w, 0));

  pdf.setFont(font, "normal");

  // fit `s` inside `w` mm at `size` pt, truncating with an ellipsis
  const fit = (s: string, w: number, size: number): string => {
    pdf.setFontSize(size);
    if (pdf.getTextWidth(s) <= w - 2) return s;
    let t = s;
    while (t.length > 1 && pdf.getTextWidth(t + "…") > w - 2) t = t.slice(0, -1);
    return t + "…";
  };

  const rh = 6.4;
  let y = 0;

  const drawColHeader = () => {
    pdf.setFillColor(238, 238, 238);
    pdf.rect(M, y, usable, rh, "F");
    pdf.setDrawColor(140);
    pdf.setLineWidth(0.2);
    pdf.setFontSize(8);
    pdf.setTextColor(0);
    COLS.forEach((c, i) => {
      pdf.rect(x0[i], y, widths[i], rh);
      const label = fit((L as unknown as Record<string, string>)[c.label], widths[i], 8);
      const tx = c.align === "center" ? x0[i] + widths[i] / 2 : x0[i] + 2;
      pdf.text(label, tx, y + rh / 2, { align: c.align === "center" ? "center" : "left", baseline: "middle" });
    });
    y += rh;
  };

  // page 1 — title + a compact spec block, then the column header
  pdf.setTextColor(0);
  pdf.setFontSize(20);
  pdf.text(L.title, M, 16);
  pdf.setFontSize(10);
  let sy = 25;
  const specLine = (label: string, value: string) => {
    pdf.text(`${label}: ${value}`, M, sy);
    sy += 6;
  };
  specLine(L.project, meta.project);
  if (meta.fromLine) specLine(L.from, meta.fromLine);
  specLine(L.grade, meta.gradeLabel);
  specLine(L.reinforce, meta.reinforced ? L.yes : L.no);
  specLine(L.totalParts, String(pl.totalParts));
  specLine(L.boardM2, String(pl.boardM2));
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text(fit(L.note, usable, 8), M, sy);
  pdf.setTextColor(0);
  y = sy + 6;
  drawColHeader();

  // rows — paginate, repeating the column header on each new page
  pdf.setFontSize(8);
  for (const r of pl.lines) {
    if (y + rh > PH - MB) {
      pdf.addPage();
      y = M + 4;
      drawColHeader();
      pdf.setFontSize(8);
    }
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.15);
    pdf.setTextColor(0);
    COLS.forEach((c, i) => {
      pdf.rect(x0[i], y, widths[i], rh);
      const s = fit(c.get(r, L), widths[i], 8);
      const tx = c.align === "center" ? x0[i] + widths[i] / 2 : x0[i] + 2;
      pdf.text(s, tx, y + rh / 2, { align: c.align === "center" ? "center" : "left", baseline: "middle" });
    });
    y += rh;
  }

  // footers last, once the total page count is known
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    const fy = PH - 12;
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.3);
    pdf.line(M, fy, PW - M, fy);
    pdf.setFontSize(11);
    pdf.setTextColor(70);
    pdf.text(L.brand, M, fy + 6);
    pdf.text(`${p} / ${total}`, PW - M, fy + 6, { align: "right" });
    pdf.setTextColor(0);
  }
}
