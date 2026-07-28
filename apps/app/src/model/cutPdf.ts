// The cutting PDF, drawn as TRUE VECTOR (jsPDF primitives) — sharp at any zoom and a few KB
// (rasterising the SVG cut maps produced a ~100MB file). Text is rendered with an embedded
// PT Sans subset (see pdf/ptSans.ts) so Russian/Uzbek labels + real material names work as
// vector. Every page has a footer: a rule, the Jihozla wordmark bottom-left, page N/total
// bottom-right. Landscape A4, mm.
//
// Layout per board page: the board scaled on the left + a "Детали на листе" table on the
// right. Parts are white with dims; reusable remnants are dashed + labelled; true waste is
// light grey. Page 1 is the results summary.

import type { jsPDF } from "jspdf";
import type { NestResult, NestedSheet } from "./nest";

export interface CutPdfLabels {
  title: string;
  results: string;
  materials: string;
  sheet: string; // "Лист"
  offcut: string; // "обрезок" — a whole board that is itself an offcut
  remnantWord: string; // "остаток" — a leftover region kept as stock
  partsOnSheet: string;
  colLen: string;
  colWid: string;
  colQty: string;
  sheetsUnit: string; // "листов"
  brand: string; // "Jihozla"
}

export interface ResultRow {
  label: string;
  value: string;
}

const MB = 18; // bottom margin reserved for the footer

/** 45° diagonal hatch inside a rect (the CAD convention for waste) — lines clamped to the
 *  rectangle by hand, so no jsPDF clipping is needed. */
function hatch(pdf: jsPDF, x: number, y: number, w: number, h: number, gap = 2.5): void {
  pdf.setDrawColor(190);
  pdf.setLineWidth(0.15);
  pdf.setLineDashPattern([], 0);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // "/" lines: px + py = b, constant along each stripe
  for (let b = x + y; b <= x + w + y + h; b += gap) {
    const pts: [number, number][] = [];
    let py = b - x;
    if (py >= y && py <= y + h) pts.push([x, py]); // left edge
    py = b - (x + w);
    if (py >= y && py <= y + h) pts.push([x + w, py]); // right edge
    let px = b - y;
    if (px >= x && px <= x + w) pts.push([px, y]); // top edge
    px = b - (y + h);
    if (px >= x && px <= x + w) pts.push([px, y + h]); // bottom edge
    if (pts.length < 2) continue;
    // draw the two furthest-apart intersections (handles lines that clip a corner)
    let a = pts[0];
    let c = pts[1];
    let best = -1;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d > best) {
          best = d;
          a = pts[i];
          c = pts[j];
        }
      }
    if (best > 0.5) pdf.line(clamp(a[0], x, x + w), clamp(a[1], y, y + h), clamp(c[0], x, x + w), clamp(c[1], y, y + h));
  }
}

export function drawCutPdf(pdf: jsPDF, r: NestResult, results: ResultRow[], labels: CutPdfLabels, font: string): void {
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const total = 1 + r.sheets.length;
  pdf.setFont(font, "normal");

  drawResults(pdf, r, results, labels, PW);
  footer(pdf, PW, PH, labels.brand, 1, total);
  r.sheets.forEach((s, i) => {
    pdf.addPage();
    drawSheetPage(pdf, s, PW, PH, labels);
    footer(pdf, PW, PH, labels.brand, i + 2, total);
  });
}

function footer(pdf: jsPDF, PW: number, PH: number, brand: string, page: number, total: number): void {
  const M = 10;
  const y = PH - 12;
  pdf.setDrawColor(150);
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([], 0);
  pdf.line(M, y, PW - M, y);
  pdf.setFontSize(11);
  pdf.setTextColor(70);
  pdf.text(brand, M, y + 6);
  pdf.text(`${page} / ${total}`, PW - M, y + 6, { align: "right" });
  pdf.setTextColor(0);
}

function drawResults(pdf: jsPDF, r: NestResult, results: ResultRow[], labels: CutPdfLabels, PW: number): void {
  pdf.setTextColor(0);
  pdf.setFontSize(22);
  pdf.text(labels.title, 12, 18);
  pdf.setFontSize(13);
  pdf.text(labels.results, 12, 30);

  const x = 12;
  const w = Math.min(180, PW - 24);
  const rh = 9;
  let y = 34;
  pdf.setFontSize(11);
  pdf.setDrawColor(150);
  pdf.setLineWidth(0.2);
  for (const row of results) {
    pdf.rect(x, y, w, rh);
    pdf.text(row.label, x + 3, y + rh / 2, { baseline: "middle" });
    pdf.text(row.value, x + w - 3, y + rh / 2, { align: "right", baseline: "middle" });
    y += rh;
  }

  // per-material sheet counts (real material names)
  const groups = new Map<string, number>();
  for (const s of r.sheets) groups.set(s.material, (groups.get(s.material) ?? 0) + 1);
  y += 8;
  pdf.setFontSize(13);
  pdf.text(labels.materials, x, y);
  y += 4;
  pdf.setFontSize(11);
  for (const [name, n] of groups) {
    pdf.rect(x, y, w, rh);
    pdf.text(name, x + 3, y + rh / 2, { baseline: "middle" });
    pdf.text(`${n} ${labels.sheetsUnit}`, x + w - 3, y + rh / 2, { align: "right", baseline: "middle" });
    y += rh;
  }
}

function drawSheetPage(pdf: jsPDF, s: NestedSheet, PW: number, PH: number, labels: CutPdfLabels): void {
  const M = 10;
  pdf.setTextColor(0);
  pdf.setFontSize(14);
  pdf.text(`${labels.sheet} ${s.n}   ${s.material}   ${s.W} × ${s.H}${s.isRemain ? `   (${labels.offcut})` : ""}`, M, M + 4);

  const tableW = 62;
  const areaX = M;
  const areaY = M + 10;
  const areaW = PW - M * 2 - tableW - 6;
  const areaH = PH - areaY - MB;
  const scale = Math.min(areaW / s.W, areaH / s.H);
  const bx = areaX;
  const by = areaY;
  const sx = (v: number) => bx + v * scale;
  const sy = (v: number) => by + v * scale;

  // leftovers first (under the part outlines)
  for (const lf of s.leftovers) {
    const x = sx(lf.x);
    const y = sy(lf.y);
    const w = lf.w * scale;
    const h = lf.h * scale;
    if (lf.usable) {
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1.2, 1], 0);
      pdf.rect(x, y, w, h);
      pdf.setLineDashPattern([], 0);
      if (Math.min(w, h) > 12) {
        pdf.setFontSize(7);
        pdf.setTextColor(120);
        pdf.text(`${labels.remnantWord} ${Math.round(lf.w)}×${Math.round(lf.h)}`, x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
        pdf.setTextColor(0);
      }
    } else {
      hatch(pdf, x, y, w, h); // 45° diagonal stripes = true waste (CAD convention)
    }
  }

  // board outline
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  pdf.rect(bx, by, s.W * scale, s.H * scale);

  // parts — thin hairline so the saw-kerf gap between parts stays visible at this scale
  pdf.setLineWidth(0.12);
  for (const p of s.placed) {
    const x = sx(p.x);
    const y = sy(p.y);
    const w = p.w * scale;
    const h = p.h * scale;
    pdf.rect(x, y, w, h);
    const lab = `${Math.round(p.panel.w)}×${Math.round(p.panel.h)}`;
    const fs = Math.min(9, (w / (lab.length * 0.6)) * 2.83, (h / 3) * 2.83); // mm→pt
    if (fs >= 4) {
      pdf.setFontSize(fs);
      pdf.text(lab, x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    }
  }

  drawPartsTable(pdf, s, PW - M - tableW, areaY, tableW, PH - MB, labels);
}

function drawPartsTable(pdf: jsPDF, s: NestedSheet, x: number, y: number, w: number, maxY: number, labels: CutPdfLabels): void {
  const map = new Map<string, { l: number; w: number; n: number }>();
  for (const p of s.placed) {
    const l = Math.round(p.panel.w);
    const wd = Math.round(p.panel.h);
    const key = `${l}x${wd}`;
    const g = map.get(key) ?? { l, w: wd, n: 0 };
    g.n += 1;
    map.set(key, g);
  }
  const rows = [...map.values()].sort((a, b) => b.l * b.w - a.l * a.w);

  pdf.setTextColor(0);
  pdf.setFontSize(12);
  pdf.text(labels.partsOnSheet, x, y - 1);
  const rh = 6.5;
  const cols = [w * 0.12, w * 0.32, w * 0.32, w * 0.24]; // #, L, W, Qty
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.2);
  pdf.setFontSize(8);

  const row = (ry: number, cells: string[], head: boolean) => {
    if (head) {
      pdf.setFillColor(238, 238, 238);
      pdf.rect(x, ry, w, rh, "F");
    }
    let cx = x;
    cells.forEach((c, i) => {
      pdf.rect(cx, ry, cols[i], rh);
      pdf.text(c, cx + cols[i] / 2, ry + rh / 2, { align: "center", baseline: "middle" });
      cx += cols[i];
    });
  };

  let ry = y + 2;
  row(ry, ["#", labels.colLen, labels.colWid, labels.colQty], true);
  ry += rh;
  rows.forEach((g, i) => {
    if (ry + rh > maxY) return; // clip overflow rather than spill onto the footer
    row(ry, [String(i + 1), String(g.l), String(g.w), String(g.n)], false);
    ry += rh;
  });
}
