// DXF of the NESTED cut plan — a real CAD file (R12 ASCII) the workshop opens or feeds to a
// saw/CNC. Each board is drawn as an outline with its parts placed at their nested positions
// (unlike the flat cut-LIST dxfExport). Sheets are laid side by side. Pure.

import type { NestResult, NestedSheet } from "./nest";

const GAP = 300; // space between boards (mm)

export function nestDXF(result: NestResult): string | null {
  if (!result.sheets.length) return null;

  const out: (string | number)[] = [];
  const g = (...kv: (string | number)[]) => out.push(...kv);
  const line = (layer: string, x1: number, y1: number, x2: number, y2: number) =>
    g(0, "LINE", 8, layer, 10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0);
  const rect = (layer: string, x: number, y: number, w: number, h: number) => {
    line(layer, x, y, x + w, y);
    line(layer, x + w, y, x + w, y + h);
    line(layer, x + w, y + h, x, y + h);
    line(layer, x, y + h, x, y);
  };
  const text = (x: number, y: number, h: number, s: string) =>
    g(0, "TEXT", 8, "LABELS", 10, x, 20, y, 30, 0, 40, h, 1, s, 7, "STANDARD");

  // HEADER (R12 + mm) + TABLES (STYLE + the layers the entities use) — strict viewers need these
  g(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 9, "$INSUNITS", 70, 4, 0, "ENDSEC");
  g(
    0, "SECTION", 2, "TABLES",
    0, "TABLE", 2, "STYLE", 70, 1,
    0, "STYLE", 2, "STANDARD", 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 2.5, 3, "txt", 4, "",
    0, "ENDTAB",
    0, "TABLE", 2, "LAYER", 70, 3,
    0, "LAYER", 2, "SHEETS", 70, 0, 62, 5, 6, "CONTINUOUS",
    0, "LAYER", 2, "PARTS", 70, 0, 62, 7, 6, "CONTINUOUS",
    0, "LAYER", 2, "LABELS", 70, 0, 62, 3, 6, "CONTINUOUS",
    0, "ENDTAB",
    0, "ENDSEC",
  );

  g(0, "SECTION", 2, "ENTITIES");
  let offX = 0;
  for (const sheet of result.sheets) {
    drawSheet(sheet, offX, rect, text);
    offX += sheet.W + GAP;
  }
  g(0, "ENDSEC", 0, "EOF");
  return out.join("\n");
}

function drawSheet(
  sheet: NestedSheet,
  offX: number,
  rect: (layer: string, x: number, y: number, w: number, h: number) => void,
  text: (x: number, y: number, h: number, s: string) => void,
) {
  // DXF y is up; place the board's top edge at y=0 and grow DOWNWARD (negative y)
  rect("SHEETS", offX, -sheet.H, sheet.W, sheet.H);
  text(offX, 60, 90, `SHEET ${sheet.n}  ${sheet.W}x${sheet.H}${sheet.isRemain ? "  (offcut)" : ""}`);
  for (const p of sheet.placed) {
    const x = offX + p.x;
    const yTop = -p.y; // top edge of the part
    rect("PARTS", x, yTop - p.h, p.w, p.h);
    const lab = `${p.panel.part}${p.rot ? "*" : ""}`;
    const size = `${Math.round(p.panel.w)}x${Math.round(p.panel.h)}`;
    const fh = Math.max(20, Math.min(60, (p.w - 40) / (Math.max(lab.length, size.length) * 0.62), (p.h - 60) / 2));
    text(x + 24, yTop - 28 - fh, fh, lab);
    text(x + 24, yTop - 40 - fh * 2, fh, size);
  }
}
