// PDF backend for the shared drawing sheets (model/drawings.ts). Renders the SAME routine
// the on-screen preview uses (components/DrawingPage.tsx) — so preview, single-drawing
// download and the full document are byte-for-byte the same layout. Landscape A4, mm; text
// needs an embedded PT Sans (registered by the caller) for Russian/Uzbek.

import type { jsPDF } from "jspdf";
import {
  drawSheet, pageList, sheetTitle, IMAGE_BOX,
  type Sheet, type ShapeStyle, type StrokeStyle, type TextStyle,
  type DrawingsData, type DrawingsLabels, type DrawingSel,
} from "./drawings";

export type { DrawingsData, DrawingsLabels, DrawingSel, DrawRun, ModuleRow } from "./drawings";

const INK = "#222222";

class PdfSheet implements Sheet {
  constructor(private pdf: jsPDF) {}
  private prep(s?: ShapeStyle): "S" | "F" | "FD" {
    this.pdf.setDrawColor(s?.stroke ?? INK);
    this.pdf.setLineWidth(s?.lw ?? 0.2);
    this.pdf.setLineDashPattern(s?.dash ?? [], 0);
    if (s?.fill) this.pdf.setFillColor(s.fill);
    if (s?.fill && s?.stroke) return "FD";
    return s?.fill ? "F" : "S";
  }
  rect(x: number, y: number, w: number, h: number, s?: ShapeStyle): void {
    this.pdf.rect(x, y, w, h, this.prep(s));
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, s?: ShapeStyle): void {
    this.pdf.roundedRect(x, y, w, h, r, r, this.prep(s));
  }
  line(x1: number, y1: number, x2: number, y2: number, s?: StrokeStyle): void {
    this.prep(s);
    this.pdf.line(x1, y1, x2, y2);
  }
  circle(cx: number, cy: number, r: number, s?: ShapeStyle): void {
    this.pdf.circle(cx, cy, r, this.prep(s));
  }
  text(str: string, x: number, y: number, s?: TextStyle): void {
    this.pdf.setFontSize(s?.size ?? 8);
    this.pdf.setTextColor(s?.color ?? INK);
    this.pdf.text(str, x, y, {
      align: s?.align ?? "left",
      baseline: s?.middle ? "middle" : "alphabetic",
      angle: s?.angle,
    });
  }
}

/** The 3D photo page has no vector content — place the JPEG inside the shared content box. */
function place3d(pdf: jsPDF, jpeg: string): void {
  const p = pdf.getImageProperties(jpeg);
  const r = Math.min(IMAGE_BOX.w / p.width, IMAGE_BOX.h / p.height);
  const w = p.width * r;
  const h = p.height * r;
  pdf.addImage(jpeg, "JPEG", IMAGE_BOX.x + (IMAGE_BOX.w - w) / 2, IMAGE_BOX.y + (IMAGE_BOX.h - h) / 2, w, h, undefined, "FAST");
}

export function drawDrawingsPdf(pdf: jsPDF, d: DrawingsData, L: DrawingsLabels, font: string): void {
  pdf.setFont(font, "normal");
  const sh = new PdfSheet(pdf);
  const pages = pageList(d);
  pages.forEach((sel, i) => {
    if (i) pdf.addPage();
    drawSheet(sh, d, L, sel, i + 1, pages.length);
    if (sel.kind === "view3d" && d.img3d) place3d(pdf, d.img3d);
  });
}

/** One drawing on its own sheet — identical format to a page of the document. */
export function drawOneDrawing(pdf: jsPDF, d: DrawingsData, L: DrawingsLabels, font: string, sel: DrawingSel): boolean {
  if (sel.kind === "view3d" && !d.img3d) return false;
  pdf.setFont(font, "normal");
  const sh = new PdfSheet(pdf);
  drawSheet(sh, d, L, sel, 1, 1);
  if (sel.kind === "view3d" && d.img3d) place3d(pdf, d.img3d);
  return true;
}

export { sheetTitle };
