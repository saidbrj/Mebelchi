// ONE source of truth for the architectural drawing sheets. The drawing code is written
// against a tiny `Sheet` primitive interface (rect/line/circle/text), so the SAME routine
// renders to a PDF page (PdfSheet, below) and to an on-screen SVG preview (SvgSheet, in
// components/DrawingPage.tsx). That's why the preview, the per-drawing download and the full
// document are pixel-for-pixel the same layout — they cannot drift apart.
//
// Page = A4 landscape (297×210mm). Every page: frame + title + a consistent footer, the
// drawing fit into a shared content box that RESERVES room for its dimension chains, and (for
// elevations / top plan) a module table in the right column.

import { walkInterior, innerRect, mullionsFor, FLUTE_PITCH_MM, MULLION_MM } from "@mebelchi/pricing";
import { cabinetInterior, frontOf, type Cabinet, type FrontProfile } from "./cabinet";
import { GEOM } from "./layout";
import { cabBand } from "./resolve";

/** carcass board thickness (mm) — the interior a shelf spans is `w − 2·CARCASS_T` */
const CARCASS_T = 16;
import { cabFootprints, rectCorners } from "./footprint";
import { offsetPolygon, polygonBoundsMm, type Pt, type Opening } from "./room";
import type { KitchenLayout } from "./runPlan";

// ---- the primitive surface both backends implement ----
export interface StrokeStyle {
  stroke?: string;
  lw?: number;
  dash?: [number, number] | null;
}
export interface ShapeStyle extends StrokeStyle {
  fill?: string;
}
export interface TextStyle {
  size?: number; // pt
  color?: string;
  align?: "left" | "center" | "right";
  middle?: boolean; // vertically centre on y
  angle?: number; // degrees, counter-clockwise
}
export interface Sheet {
  rect(x: number, y: number, w: number, h: number, s?: ShapeStyle): void;
  roundRect(x: number, y: number, w: number, h: number, r: number, s?: ShapeStyle): void;
  line(x1: number, y1: number, x2: number, y2: number, s?: StrokeStyle): void;
  circle(cx: number, cy: number, r: number, s?: ShapeStyle): void;
  text(str: string, x: number, y: number, s?: TextStyle): void;
}

export const PAGE_W = 297;
export const PAGE_H = 210;
const M = 8;
const INK = "#222222";
const DIM = "#5a5a5a";
const GREEN = "#00ac7a";
const TABLE_W = 62;
const CONTENT = { x: M + 6, y: 24, w: PAGE_W - 2 * (M + 6), h: PAGE_H - 24 - 30 };

// ---- data ----
export interface DrawRun {
  wall: number;
  cabs: Cabinet[];
  wallLen: number;
}
export interface ModuleRow {
  n: number;
  name: string;
  w: number;
  h: number;
  d: number;
}
export interface DrawingsData {
  runs: DrawRun[];
  ceiling: number;
  numberOf: Map<string, number>;
  points: Pt[];
  cabs: Cabinet[];
  openings: Opening[];
  waterWall: number | null;
  layout: KitchenLayout;
  /** filler «добор» gap (mm) — so the top-plan footprints inset exactly as the app does. */
  reveal?: number;
  summary: { label: string; value: string }[];
  modules: ModuleRow[];
  project: string;
  date: string;
  img3d: string | null;
}
export interface DrawingsLabels {
  title: string;
  view3d: string;
  face: string;
  topPlan: string;
  worktop: string;
  legend: string;
  wall: (n: number) => string;
  project: string;
  dateL: string;
  note: string;
  colN: string;
  colName: string;
  colDims: string;
  brand: string;
}
/** Which sheet to render. `intro`/`view3d` only appear in the full document. */
export type DrawingSel =
  | { kind: "face" | "worktop"; run: DrawRun }
  | { kind: "top" | "intro" | "view3d" };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ctx {
  X: (mx: number) => number;
  Y: (my: number) => number;
  s: number;
}

/** Fit mm content into `box` (centred), reserving `pad` mm per side for dimension chains.
 *  `flipY` puts mm-0 at the bottom (elevations); else top-left (plans). */
function fit(box: Box, mmW: number, mmH: number, flipY: boolean, pad: { l?: number; r?: number; t?: number; b?: number } = {}): Ctx {
  const l = pad.l ?? 0;
  const r = pad.r ?? 0;
  const t = pad.t ?? 0;
  const b = pad.b ?? 0;
  const bw = box.w - l - r;
  const bh = box.h - t - b;
  const s = Math.min(bw / Math.max(mmW, 1), bh / Math.max(mmH, 1));
  const ox = box.x + l + (bw - mmW * s) / 2;
  const oy = box.y + t + (bh - mmH * s) / 2;
  return { s, X: (mx) => ox + mx * s, Y: flipY ? (my) => oy + (mmH - my) * s : (my) => oy + my * s };
}

export function sheetTitle(d: DrawingsData, L: DrawingsLabels, sel: DrawingSel): string {
  const multi = d.runs.length > 1;
  if (sel.kind === "face") return multi ? `${L.face} · ${L.wall(sel.run.wall)}` : L.face;
  if (sel.kind === "worktop") return multi ? `${L.worktop} · ${L.wall(sel.run.wall)}` : L.worktop;
  if (sel.kind === "top") return L.topPlan;
  if (sel.kind === "view3d") return L.view3d;
  return L.title;
}

/** The page sequence of the full document. */
export function pageList(d: DrawingsData): DrawingSel[] {
  const out: DrawingSel[] = [{ kind: "intro" }];
  if (d.img3d) out.push({ kind: "view3d" });
  for (const run of d.runs) out.push({ kind: "face", run });
  out.push({ kind: "top" });
  for (const run of d.runs) out.push({ kind: "worktop", run });
  return out;
}

/** Draw ONE complete sheet (frame + title + content + footer) onto any backend. The 3D photo
 *  page has no vector content — the caller places the image itself. */
export function drawSheet(sh: Sheet, d: DrawingsData, L: DrawingsLabels, sel: DrawingSel, page: number, total: number): void {
  frame(sh, sheetTitle(d, L, sel));
  if (sel.kind === "intro") intro(sh, d, L);
  else if (sel.kind === "face") elevation(sh, sel.run, d, L);
  else if (sel.kind === "worktop") worktop(sh, sel.run);
  else if (sel.kind === "top") topPlan(sh, d, L);
  footer(sh, d, L, page, total);
}

/** The content box images (the 3D shot) should fill — used by the PDF backend. */
export const IMAGE_BOX = CONTENT;

// ---- chrome ----
function frame(sh: Sheet, view: string): void {
  sh.rect(M, M, PAGE_W - 2 * M, PAGE_H - 2 * M, { stroke: INK, lw: 0.5 });
  sh.text(view, M + 6, 18, { size: 13, color: INK });
}

function footer(sh: Sheet, d: DrawingsData, L: DrawingsLabels, page: number, total: number): void {
  const y = PAGE_H - M - 14;
  sh.line(M, y, PAGE_W - M, y, { stroke: INK, lw: 0.3 });
  sh.text(L.brand, M + 4, y + 8, { size: 13, color: INK });
  sh.text(`${L.project}: ${d.project}    ${L.dateL}: ${d.date}`, PAGE_W / 2, y + 5, { size: 8, color: DIM, align: "center" });
  sh.text(L.note, PAGE_W / 2, y + 10.5, { size: 7, color: DIM, align: "center" });
  sh.text(`${page} / ${total}`, PAGE_W - M - 4, y + 8, { size: 9, color: INK, align: "right" });
}

function badge(sh: Sheet, cx: number, cy: number, n: number): void {
  sh.circle(cx, cy, 2.6, { fill: GREEN });
  sh.text(String(n), cx, cy, { size: n >= 10 ? 7 : 8, color: "#ffffff", align: "center", middle: true });
}

function dim(sh: Sheet, x: number, y: number, s: string, angle = 0): void {
  sh.text(s, x, y, { size: 7.5, color: DIM, align: "center", middle: true, angle });
}

function moduleTable(sh: Sheet, rows: ModuleRow[], x: number, y: number, w: number, L: DrawingsLabels): void {
  // the size column carries "Размер Ш×В×Г, мм" + "600×2100×560" — it needs the width, so the
  // name column gives some back (module names are short: Холодильник / Напольный / …)
  const cols = [w * 0.12, w * 0.4, w * 0.48];
  const rh = 6;
  const row = (ry: number, cells: string[], head: boolean, size: number) => {
    if (head) sh.rect(x, ry, w, rh, { fill: "#eeeeee" });
    let cx = x;
    cells.forEach((cell, i) => {
      sh.rect(cx, ry, cols[i], rh, { stroke: INK, lw: 0.2 });
      const left = i > 0;
      sh.text(cell, left ? cx + 2 : cx + cols[i] / 2, ry + rh / 2, { size, color: INK, align: left ? "left" : "center", middle: true });
      cx += cols[i];
    });
  };
  let ry = y;
  row(ry, [L.colN, L.colName, L.colDims], true, 6.8);
  ry += rh;
  for (const m of rows) {
    if (ry + rh > PAGE_H - M - 20) break;
    row(ry, [String(m.n), m.name, `${m.w}×${m.h}×${m.d}`], false, 7);
    ry += rh;
  }
}

// ---- sheets ----
function intro(sh: Sheet, d: DrawingsData, L: DrawingsLabels): void {
  sh.text(d.project, CONTENT.x, 46, { size: 30, color: INK });
  sh.text(`${L.dateL}: ${d.date}`, CONTENT.x, 55, { size: 12, color: DIM });
  const w = 150;
  const rh = 9;
  let y = 66;
  for (const r of d.summary) {
    sh.rect(CONTENT.x, y, w, rh, { stroke: "#969696", lw: 0.2 });
    sh.text(r.label, CONTENT.x + 3, y + rh / 2, { size: 11, color: INK, middle: true });
    sh.text(r.value, CONTENT.x + w - 3, y + rh / 2, { size: 11, color: INK, align: "right", middle: true });
    y += rh;
  }
}

/** The routed profile of ONE front, in the elevation's mm space (physical-up: Y is flipped). */
function frontProfile(sh: Sheet, c: Ctx, p: FrontProfile, fx: number, fy: number, w: number, h: number): void {
  const { X, Y, s } = c;
  const LW = 0.12;
  if (p === "flat" || p === "none") return;

  if (p === "fluted") {
    const n = Math.max(3, Math.round(w / FLUTE_PITCH_MM)); // fixed pitch, never stretched
    for (let i = 1; i < n; i++) {
      const rx = fx + (w * i) / n;
      sh.line(X(rx), Y(fy + 6), X(rx), Y(fy + h - 6), { stroke: INK, lw: LW });
    }
    return;
  }

  const r = innerRect(w, h);
  if (r.w <= 0 || r.h <= 0) return;
  const ix = fx + (w - r.w) / 2, iy = fy + (h - r.h) / 2;
  sh.rect(X(ix), Y(iy + r.h), r.w * s, r.h * s, { stroke: INK, lw: LW });
  if (p === "raised") {
    const b = Math.min(24, r.w / 6, r.h / 6);
    sh.rect(X(ix + b), Y(iy + r.h - b), (r.w - 2 * b) * s, (r.h - 2 * b) * s, { stroke: INK, lw: LW });
  }
  if (p === "grid") {
    const { cols, rows } = mullionsFor(w, h);
    for (let i = 1; i < cols; i++) {
      const mx = ix + (r.w * i) / cols;
      sh.rect(X(mx - MULLION_MM / 2), Y(iy + r.h), MULLION_MM * s, r.h * s, { stroke: INK, lw: LW });
    }
    for (let j = 1; j < rows; j++) {
      const my = iy + (r.h * j) / rows;
      sh.rect(X(ix), Y(my + MULLION_MM / 2), r.w * s, MULLION_MM * s, { stroke: INK, lw: LW });
    }
  }
}

function elevation(sh: Sheet, run: DrawRun, d: DrawingsData, L: DrawingsLabels): void {
  const drawBox = { x: CONTENT.x, y: CONTENT.y, w: CONTENT.w - TABLE_W - 6, h: CONTENT.h };
  const mods = run.cabs
    .filter((c) => c.x != null && c.px == null && c.appliance !== "filler" && !c.furniture)
    .sort((a, b) => (a.x as number) - (b.x as number));
  const c = fit(drawBox, run.wallLen, d.ceiling, true, { b: 14, t: 8 });
  const { X, Y } = c;

  for (const m of mods) {
    const x = m.x as number;
    const upper = m.kind === "upper";
    // canonical band — this used to pin every base to a fixed 860 counter (ignoring c.h) and
    // draw talls floor→c.h with no plinth, i.e. a THIRD vertical model
    const band = cabBand(m);
    const y0 = band.y0;
    const y1 = band.y1;
    sh.rect(X(x), Y(y1), m.w * c.s, (y1 - y0) * c.s, { stroke: INK, lw: 0.35, fill: "#ffffff" });
    if (band.hasWorktop) {
      sh.line(X(x), Y(GEOM.plinth), X(x + m.w), Y(GEOM.plinth), { stroke: INK, lw: 0.15 }); // plinth
      sh.line(X(x), Y(band.carcass1), X(x + m.w), Y(band.carcass1), { stroke: INK, lw: 0.15 }); // under the worktop
    }
    // the facade spans the CARCASS box — one rule for every kind (was: base pinned to 820,
    // tall measured from the floor with no plinth)
    const fTop = band.carcass1;
    const fBot = band.carcass0;
    const appl = m.appliance && m.appliance !== "none" && !["sink", "hob", "cooktop"].includes(m.appliance);
    if (appl) {
      sh.line(X(x), Y(fBot), X(x + m.w), Y(fTop), { stroke: INK, lw: 0.15 });
      sh.line(X(x), Y(fTop), X(x + m.w), Y(fBot), { stroke: INK, lw: 0.15 });
    } else {
      // FRONTS FROM THE CELL TREE — the same interior pricing cuts and the 3D draws. This used to
      // read `fill`/`count`, which the Fill Editor never updates: a cabinet the user had rebuilt
      // as 3 drawers + a door still came out of the PDF as its pre-edit box, disagreeing with the
      // on-screen elevation. The facade box IS the carcass band (fTop − fBot === m.h for every
      // kind — see cabBand), so a front's mm offsets drop straight in.
      const fronts = walkInterior(
        cabinetInterior(m),
        { w: m.w, h: m.h, innerW: m.w - 2 * CARCASS_T },
        m.combinedDoors ?? [],
      ).fronts;
      const profile = frontOf(m);
      for (const f of fronts) {
        const fx = x + f.xMm;
        const fy = fBot + f.yMm;
        sh.rect(X(fx), Y(fy + f.hMm), f.wMm * c.s, f.hMm * c.s, { stroke: INK, lw: 0.15 });
        // THE PROFILE the shop has to rout. Drawn from the same helpers pricing bills and the 3D
        // builds — the workshop's drawing cannot show a flat door the quote charged a frame for.
        frontProfile(sh, c, profile, fx, fy, f.wMm, f.hMm);
        if (f.kind === "drawer") {
          const bw = Math.min(180, f.wMm * 0.5);
          sh.rect(X(fx + f.wMm / 2 - bw / 2), Y(fy + f.hMm / 2) - 0.4, bw * c.s, 0.8, { fill: INK });
        } else {
          // handle opposite the hinge, unless the cell pins a placement
          const bh = Math.min(260, f.hMm * 0.5);
          const left = f.handle ? f.handle === "left" : f.opening === "right";
          const hx = left ? fx + 60 : fx + f.wMm - 60;
          sh.rect(X(hx) - 0.4, Y(fy + f.hMm / 2 + bh / 2), 0.8, bh * c.s, { fill: INK });
        }
      }
    }
    badge(sh, X(x + m.w / 2), Y(y1) - 5, d.numberOf.get(m.id) ?? 0); // y1 = band top, all kinds
  }

  // bottom dimension chain + overall, inside the reserved band
  const floor = mods.filter((m) => m.kind !== "upper");
  const chY = Y(0) + 5;
  const tick = (mx: number, yy: number) => sh.line(X(mx), yy - 1.1, X(mx), yy + 1.1, { stroke: DIM, lw: 0.15 });
  sh.line(X(0), chY, X(run.wallLen), chY, { stroke: DIM, lw: 0.15 });
  tick(0, chY);
  for (const m of floor) {
    const x = m.x as number;
    tick(x + m.w, chY);
    dim(sh, X(x + m.w / 2), chY - 2.2, String(m.w));
  }
  const ovY = chY + 6;
  sh.line(X(0), ovY, X(run.wallLen), ovY, { stroke: DIM, lw: 0.15 });
  tick(0, ovY);
  tick(run.wallLen, ovY);
  dim(sh, X(run.wallLen / 2), ovY - 2.2, String(Math.round(run.wallLen)));

  const nums = new Set(mods.map((m) => d.numberOf.get(m.id)));
  moduleTable(sh, d.modules.filter((m) => nums.has(m.n)), CONTENT.x + CONTENT.w - TABLE_W, CONTENT.y, TABLE_W, L);
}

function topPlan(sh: Sheet, d: DrawingsData, L: DrawingsLabels): void {
  const drawBox = { x: CONTENT.x, y: CONTENT.y, w: CONTENT.w - TABLE_W - 6, h: CONTENT.h };
  const b = polygonBoundsMm(d.points);
  const inner = offsetPolygon(d.points, 100);
  const foots = cabFootprints(d.cabs, d.points, d.waterWall, d.layout, d.openings, d.reveal).filter((f) => f.appliance !== "filler");
  const c = fit(drawBox, b.w, b.h, false, { l: 10, b: 10 });
  const X = (mx: number) => c.X(mx - b.minX);
  const Y = (my: number) => c.Y(my - b.minY);
  const poly = (pts: { x: number; y: number }[], s: StrokeStyle) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const q = pts[(i + 1) % pts.length];
      sh.line(X(a.x), Y(a.y), X(q.x), Y(q.y), s);
    }
  };
  poly(d.points, { stroke: INK, lw: 0.4 });
  poly(inner, { stroke: INK, lw: 0.2 });
  [...foots].sort((p, q) => Number(p.upper) - Number(q.upper)).forEach((f) => {
    const cr = rectCorners(f.cx, f.cy, f.ux, f.uy, f.ix, f.iy, f.w, f.depth);
    poly(cr, { stroke: INK, lw: 0.25, dash: f.upper ? [1.2, 0.9] : null });
    const num = d.numberOf.get(f.id);
    if (num != null && !f.upper) badge(sh, X(f.cx), Y(f.cy), num);
  });
  const dy = Y(b.maxY) + 5;
  sh.line(X(b.minX), dy, X(b.maxX), dy, { stroke: DIM, lw: 0.15 });
  dim(sh, X((b.minX + b.maxX) / 2), dy - 2.2, String(Math.round(b.w)));
  const dx = X(b.minX) - 5;
  sh.line(dx, Y(b.minY), dx, Y(b.maxY), { stroke: DIM, lw: 0.15 });
  dim(sh, dx - 2.2, Y((b.minY + b.maxY) / 2), String(Math.round(b.h)), 90);

  moduleTable(sh, d.modules, CONTENT.x + CONTENT.w - TABLE_W, CONTENT.y, TABLE_W, L);
}

function worktop(sh: Sheet, run: DrawRun): void {
  const WD = 600;
  const c = fit(CONTENT, run.wallLen, WD, false, { b: 12, r: 12 });
  const { X, Y } = c;
  sh.rect(X(0), Y(0), run.wallLen * c.s, WD * c.s, { stroke: INK, lw: 0.4, fill: "#ffffff" });
  for (const m of run.cabs) {
    if (m.appliance !== "sink" && m.appliance !== "hob" && m.appliance !== "cooktop") continue;
    const sink = m.appliance === "sink";
    const cw = Math.min(m.w - 80, sink ? 500 : 540);
    const ch = WD - 170;
    const cx = (m.x as number) + m.w / 2;
    sh.roundRect(X(cx - cw / 2), Y(WD / 2 - ch / 2), cw * c.s, ch * c.s, (sink ? 50 : 30) * c.s, { stroke: INK, lw: 0.3, fill: "#f3f1ec" });
    dim(sh, X(cx), Y(WD / 2), `${Math.round(cw)}×${Math.round(ch)}`);
    if (sink) sh.circle(X(cx), Y(70), 1.6, { stroke: INK, lw: 0.3 });
  }
  const ly = Y(WD) + 5;
  sh.line(X(0), ly, X(run.wallLen), ly, { stroke: DIM, lw: 0.15 });
  dim(sh, X(run.wallLen / 2), ly - 2.2, String(Math.round(run.wallLen)));
  const lx = X(run.wallLen) + 5;
  sh.line(lx, Y(0), lx, Y(WD), { stroke: DIM, lw: 0.15 });
  dim(sh, lx + 2.2, Y(WD / 2), String(WD), 90);
}
