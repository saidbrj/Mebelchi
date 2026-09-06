// DXF export of the panel cut list — a real CAD file (R12 ASCII, LINE + TEXT entities,
// max compatibility) the workshop can open in any CAD / feed to a nester. Each panel is a
// rectangle (mm) laid out in rows, labelled with its part name + size. Pure.

import { production } from "./cncExport";
import type { Cabinet } from "./cabinet";
import type { FlatPanel, PanelCutout } from "@mebelchi/schema";

const ROW_WRAP = 2800; // wrap to a new row past this width (≈ a board width)
const GAP = 40;
const ROW_GAP = 300;

export function panelsDXF(
  cabs: Cabinet[],
  wallPanels: FlatPanel[] = [],
  backCuts: Map<string, PanelCutout[]> = new Map(),
): string | null {
  const prod = production(cabs, undefined, wallPanels, backCuts);
  if (!prod) return null;

  const out: (string | number)[] = [];
  const g = (...kv: (string | number)[]) => out.push(...kv); // (code,value) pairs
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    g(0, "LINE", 8, "PANELS", 10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0);
  const rect = (x: number, y: number, w: number, h: number) => {
    line(x, y, x + w, y);
    line(x + w, y, x + w, y + h);
    line(x + w, y + h, x, y + h);
    line(x, y + h, x, y);
  };
  const text = (x: number, y: number, h: number, s: string) =>
    g(0, "TEXT", 8, "LABELS", 10, x, 20, y, 30, 0, 40, h, 1, s, 7, "STANDARD");

  // DXF (R12) isn't UTF-8 — Cyrillic comes out as mojibake. Use short ASCII part codes.
  const shortPart = (name: string): string => {
    const m: Record<string, string> = {
      "side-left": "side-L", "side-right": "side-R", bottom: "bottom", top: "top", back: "back", door: "door",
    };
    if (m[name]) return m[name];
    const [base, n] = name.split(/-(?=\d+$)/);
    if (base === "shelf") return `shelf${n}`;
    if (base === "divider") return `div${n}`;
    if (base === "door") return `door${n}`; // custom interiors can carry several doors
    if (name.startsWith("drawer-front")) return `drwF${name.split("-").pop()}`;
    return name;
  };

  // HEADER — version (R12) + units (4 = mm); makes strict viewers accept the file
  g(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 9, "$INSUNITS", 70, 4, 0, "ENDSEC");
  // TABLES — a text STYLE + the layers the entities reference (else strict parsers fail)
  g(
    0, "SECTION", 2, "TABLES",
    0, "TABLE", 2, "STYLE", 70, 1,
    0, "STYLE", 2, "STANDARD", 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 2.5, 3, "txt", 4, "",
    0, "ENDTAB",
    0, "TABLE", 2, "LAYER", 70, 2,
    0, "LAYER", 2, "PANELS", 70, 0, 62, 7, 6, "CONTINUOUS",
    0, "LAYER", 2, "LABELS", 70, 0, 62, 3, 6, "CONTINUOUS",
    0, "ENDTAB",
    0, "ENDSEC",
  );

  g(0, "SECTION", 2, "ENTITIES");
  let cx = 0;
  let topY = 0;
  let rowH = 0;
  for (const p of prod.panels) {
    if (p.role === "glass") continue; // a bought pane — nothing for the CNC to cut
    const w = p.lengthMm;
    const h = p.widthMm;
    if (cx > 0 && cx + w > ROW_WRAP) {
      topY -= rowH + ROW_GAP;
      cx = 0;
      rowH = 0;
    }
    rect(cx, topY - h, w, h);
    // THE HOLES ARE PART OF THE PANEL. A back cut around a riser, a фартук cut around its sockets —
    // exported as real closed contours on the same layer, so a nester or a CAM package sees a panel
    // with holes rather than a rectangle plus a note nobody reads. Panel-local mm, measured from
    // the panel's bottom-left, which is (cx, topY − h) here.
    for (const c of p.cutouts ?? []) {
      const x0 = cx + c.x;
      const y0 = topY - h + c.y;
      // a hole that does not fit inside the panel is a derivation bug, not something to draw
      if (c.x < 0 || c.y < 0 || c.x + c.w > w || c.y + c.h > h) continue;
      rect(x0, y0, c.w, c.h);
    }
    // two label lines placed INSIDE the box (top-left), scaled so they fit its width &
    // height — keeps every label within its own rectangle, so they never overlap neighbours
    const lab1 = shortPart(p.partEn);
    const lab2 = `${w}x${h}`;
    const longest = Math.max(lab1.length, lab2.length, 1);
    const fh = Math.max(20, Math.min(64, (w - 60) / (longest * 0.62), (h - 90) / 2));
    text(cx + 30, topY - 30 - fh, fh, lab1);
    text(cx + 30, topY - 46 - fh * 2, fh, lab2);
    cx += w + GAP;
    rowH = Math.max(rowH, h);
  }
  g(0, "ENDSEC", 0, "EOF");

  // DXF wants each group code and value on its own line
  return out.join("\n");
}
