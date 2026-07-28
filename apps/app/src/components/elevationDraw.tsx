// Pure per-module SVG drawing for the front elevation — the carcass, plinth, worktop,
// facade cell-tree, appliance glyphs and interior shelves of ONE cabinet, in LOCAL
// coordinates (left edge at x=0, y = mm above the floor, physical-up).
//
// Placement is NOT here: where a module sits on the wall comes from model/resolve.ts.
// Splitting the two is the whole point — the old elevation mixed them and drifted from 3D.
//
// y is physical-up; the caller draws these under a scale(1 -1) flip.

import { cabinetLayout, cellSizes, isLeaf, frontOf, type Cabinet, type Cell, type FinishKey, type HandlePos, type FrontProfile } from "../model/cabinet";
import { innerRect, mullionsFor, FLUTE_PITCH_MM, MULLION_MM } from "@mebelchi/pricing";
import { GEOM } from "../model/layout";

/** a module's per-part finish colour (set in the editor) as a CSS hex, else fallback */
const finC = (c: Cabinet, key: FinishKey, fallback: string) => {
  const n = c.finish?.[key];
  return n != null ? `#${n.toString(16).padStart(6, "0")}` : fallback;
};

export const C = {
  facade: "#e7ddc9",
  facadeLine: "#c4b79c",
  carcass: "#efe8da",
  worktop: "#6f6862",
  plinth: "#cdc6bb",
  steel: "#d6dadd",
  steelLine: "#a9afb4",
  glass: "#cdeaf5",
  glassLine: "#9fc3d4",
  filler: "#ddd5c8",
  handle: "#8a8378",
  floor: "#cfc7ba",
  dim: "#444",
  sel: "#00ac7a",
};


export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A handle bar on the chosen edge of a front box. */
function handleBar(box: Box, pos: HandlePos | undefined, fill: string, key: string): React.ReactNode {
  const { x, y, w, h } = box, m = 22;
  const p = pos ?? "right";
  if (p === "none") return null; // handleless push-to-open
  if (p === "center") return <circle key={key} cx={x + w / 2} cy={y + h / 2} r={14} fill={fill} />;
  if (p === "top") return <rect key={key} x={x + w / 2 - Math.min(70, w / 4)} y={y + m - 5} width={Math.min(140, w / 2)} height={9} rx={4} fill={fill} />;
  if (p === "bottom") return <rect key={key} x={x + w / 2 - Math.min(70, w / 4)} y={y + h - m - 4} width={Math.min(140, w / 2)} height={9} rx={4} fill={fill} />;
  if (p === "left") return <rect key={key} x={x + m - 4} y={y + h / 2 - Math.min(70, h / 4)} width={9} height={Math.min(140, h / 2)} rx={4} fill={fill} />;
  return <rect key={key} x={x + w - m - 5} y={y + h / 2 - Math.min(70, h / 4)} width={9} height={Math.min(140, h / 2)} rx={4} fill={fill} />;
}

/**
 * THE PROFILE, drawn. The elevation is in mm, so it reads the SAME helpers as pricing and the 3D —
 * a shaker frame is 60mm here because it is 60mm on the CNC.
 */
function profileFace(bx: Box, profile: FrontProfile, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (profile === "flat" || profile === "none") return out;

  if (profile === "fluted") {
    // ribs at a FIXED pitch — a 400mm door and a 900mm door show the same rib width
    const n = Math.max(3, Math.round(bx.w / FLUTE_PITCH_MM));
    for (let i = 1; i < n; i++) {
      const rx = bx.x + (bx.w * i) / n;
      out.push(<line key={`${key}fl${i}`} x1={rx} y1={bx.y + 4} x2={rx} y2={bx.y + bx.h - 4} stroke={C.facadeLine} strokeWidth={3} />);
    }
    return out;
  }

  const r = innerRect(bx.w, bx.h);
  if (r.w <= 0 || r.h <= 0) return out;
  const ib = { x: bx.x + (bx.w - r.w) / 2, y: bx.y + (bx.h - r.h) / 2, w: r.w, h: r.h };
  const glazed = profile === "glass" || profile === "grid";
  out.push(
    <rect key={`${key}in`} x={ib.x} y={ib.y} width={ib.w} height={ib.h} rx={4}
      fill={glazed ? C.glass : "none"} stroke={glazed ? C.glassLine : C.facadeLine} strokeWidth={4} />,
  );
  if (profile === "raised") {
    // the bevelled field inside the frame — one more routed contour, and that is exactly what it costs
    const b = Math.min(24, ib.w / 6, ib.h / 6);
    out.push(<rect key={`${key}rp`} x={ib.x + b} y={ib.y + b} width={ib.w - 2 * b} height={ib.h - 2 * b} rx={3} fill="none" stroke={C.facadeLine} strokeWidth={3} />);
  }
  if (profile === "grid") {
    const { cols, rows } = mullionsFor(bx.w, bx.h);
    for (let i = 1; i < cols; i++) {
      const mx = ib.x + (ib.w * i) / cols;
      out.push(<rect key={`${key}mv${i}`} x={mx - MULLION_MM / 2} y={ib.y} width={MULLION_MM} height={ib.h} fill={C.facade} stroke={C.facadeLine} strokeWidth={2} />);
    }
    for (let j = 1; j < rows; j++) {
      const my = ib.y + (ib.h * j) / rows;
      out.push(<rect key={`${key}mh${j}`} x={ib.x} y={my - MULLION_MM / 2} width={ib.w} height={MULLION_MM} fill={C.facade} stroke={C.facadeLine} strokeWidth={2} />);
    }
  }
  return out;
}

/** The front placed on a cell — a door (with handle placement) or a drawer, in a box. */
function cellFront(box: Box, cell: Cell, cab: Cabinet, key: string): React.ReactNode[] {
  const { x, y, w, h } = box;
  const inset = Math.min(14, w / 6, h / 6);
  const facade = finC(cab, "facade", C.facade);
  const handle = finC(cab, "handle", C.handle);
  const profile = frontOf(cab);
  const bx = { x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2 };
  const parts: React.ReactNode[] = [];
  if (profile === "none") return parts; // «Без» — an open face, no leaf to draw
  parts.push(<rect key={`${key}dr`} x={bx.x} y={bx.y} width={bx.w} height={bx.h} rx={6} fill={facade} stroke={C.facadeLine} strokeWidth={4} />);
  parts.push(...profileFace(bx, profile, key));
  if (cell.front === "drawer") {
    parts.push(handleBar(bx, cell.handle ?? "top", handle, `${key}h`));
  } else {
    const opening = cell.opening ?? "left";
    parts.push(handleBar(bx, cell.handle ?? (opening === "left" ? "right" : opening === "right" ? "left" : opening === "top" ? "bottom" : "top"), handle, `${key}h`));
  }
  return parts;
}

/** A facade for the whole module — recurses the cell tree: a node with a `front` draws ONE
 *  front over its box (covering its cells); an un-fronted split recurses; open leaf = back. */
export function Facade({ box, cab }: { box: Box; cab: Cabinet }) {
  const render = (cell: Cell, b: Box, key: string): React.ReactNode[] => {
    if (cell.front) return cellFront(b, cell, cab, key);
    if (isLeaf(cell)) return [<rect key={`${key}bk`} x={b.x + 6} y={b.y + 6} width={b.w - 12} height={b.h - 12} fill="#0000000d" />];
    const sizes = cellSizes(cell);
    const out: React.ReactNode[] = [];
    let acc = 0;
    // y is physical-up here (the whole elevation is drawn under a scale(1 -1) flip), so
    // children[0] is the BOTTOM row and y grows upward.
    for (let i = 0; i < cell.children!.length; i++) {
      const f = sizes[i];
      const sub: Box = cell.split === "rows"
        ? { x: b.x, y: b.y + b.h * acc, w: b.w, h: b.h * f }
        : { x: b.x + b.w * acc, y: b.y, w: b.w * f, h: b.h };
      out.push(...render(cell.children![i], sub, `${key}-${i}`));
      acc += f;
      if (i < cell.children!.length - 1) {
        if (cell.split === "rows") { const ry = b.y + b.h * acc; out.push(<line key={`${key}r${i}`} x1={b.x} y1={ry} x2={b.x + b.w} y2={ry} stroke={C.facadeLine} strokeWidth={4} />); }
        else { const rx = b.x + b.w * acc; out.push(<line key={`${key}c${i}`} x1={rx} y1={b.y} x2={rx} y2={b.y + b.h} stroke={C.facadeLine} strokeWidth={4} />); }
      }
    }
    return out;
  };
  const cds = (cab.combinedDoors ?? []).flatMap((cd, k) =>
    cellFront({ x: box.x + box.w * cd.fx0, y: box.y + box.h * cd.fy0, w: box.w * (cd.fx1 - cd.fx0), h: box.h * (cd.fy1 - cd.fy0) }, { front: "door", opening: cd.opening, handle: cd.handle }, cab, `cd${k}`),
  );
  return <>{[...render(cabinetLayout(cab), box, "f"), ...cds]}</>;
}

function carcass(b: Box, key: string, fill = C.carcass) {
  return <rect key={key} x={b.x} y={b.y} width={b.w} height={b.h} fill={fill} stroke={C.facadeLine} strokeWidth={4} />;
}

/** Draw one module's shapes in LOCAL coords (left edge at x=0). */
export function moduleLocal(c: Cabinet, mountY: number, extLeft = 0, extRight = 0): React.ReactNode[] {
  const n: React.ReactNode[] = [];
  // free-standing furniture (table / chair / trolley / …) — NOT a cabinet, so draw a distinct
  // dashed silhouette on legs instead of a carcass+facade box (it read as a fake cabinet).
  if (c.furniture) {
    const w = c.w, ht = c.h;
    const legH = Math.round(Math.min(ht * 0.45, 260));
    const legW = 13;
    n.push(<rect key="fu" x={7} y={legH} width={w - 14} height={ht - legH} rx={12} fill="#efece7" stroke="#a29c92" strokeWidth={5} strokeDasharray="16 11" />);
    n.push(<rect key="fl1" x={14} y={0} width={legW} height={legH + 4} fill="#c4bdb2" />);
    n.push(<rect key="fl2" x={w - 14 - legW} y={0} width={legW} height={legH + 4} fill="#c4bdb2" />);
    return n;
  }
  if (c.kind === "tall") {
    const b: Box = { x: 0, y: GEOM.plinth, w: c.w, h: c.h };
    n.push(<rect key="pl" x={0} y={0} width={c.w} height={GEOM.plinth} fill={C.plinth} />);
    if (c.appliance === "fridge") {
      n.push(carcass(b, "ca", C.steel));
      const split = b.y + b.h * 0.62;
      n.push(<line key="fz" x1={0} y1={split} x2={c.w} y2={split} stroke={C.steelLine} strokeWidth={4} />);
      n.push(<rect key="fh1" x={c.w - 34} y={split + 40} width={10} height={b.y + b.h - split - 90} rx={5} fill={C.handle} />);
      n.push(<rect key="fh2" x={c.w - 34} y={b.y + 60} width={10} height={split - b.y - 110} rx={5} fill={C.handle} />);
    } else {
      n.push(carcass(b, "ca", finC(c, "carcass", C.carcass)));
      n.push(<Facade key="fc" box={b} cab={c} />);
    }
    return n;
  }
  if (c.kind === "upper") {
    if (c.appliance === "hood") {
      const topY = mountY + 360;
      n.push(<polygon key="hd" points={`${c.w * 0.2},${mountY} ${c.w * 0.8},${mountY} ${c.w * 0.62},${topY} ${c.w * 0.38},${topY}`} fill={C.steel} stroke={C.steelLine} strokeWidth={4} />);
      return n;
    }
    const b: Box = { x: 0, y: mountY, w: c.w, h: c.h };
    n.push(carcass(b, "ca", finC(c, "carcass", C.carcass)));
    n.push(<Facade key="fc" box={b} cab={c} />);
    return n;
  }
  // base
  const h = c.h;
  const worktopY = GEOM.plinth + h;
  const topY = worktopY + GEOM.worktop;
  const b: Box = { x: 0, y: GEOM.plinth, w: c.w, h };
  n.push(<rect key="pl" x={0} y={0} width={c.w} height={GEOM.plinth} fill={C.plinth} />);
  n.push(carcass(b, "ca"));
  n.push(<rect key="wt" x={-extLeft} y={worktopY} width={c.w + extLeft + extRight} height={GEOM.worktop} fill={finC(c, "worktop", C.worktop)} />);
  if (c.appliance === "sink") {
    n.push(<Facade key="fc" box={b} cab={{ ...c, fill: "shelves" }} />);
    n.push(<rect key="sb" x={40} y={worktopY + 6} width={c.w - 80} height={GEOM.worktop - 12} rx={6} fill={C.steel} stroke={C.steelLine} strokeWidth={3} />);
    n.push(<path key="fa" d={`M${c.w - 70} ${topY} q0 -150 60 -150`} fill="none" stroke={C.steelLine} strokeWidth={10} strokeLinecap="round" />);
  } else if (c.appliance === "hob" || c.appliance === "cooktop") {
    if (c.appliance === "hob") {
      const oy = GEOM.plinth + 40;
      n.push(<rect key="ov" x={16} y={oy} width={c.w - 32} height={h - 90} rx={8} fill={C.steel} stroke={C.steelLine} strokeWidth={4} />);
      n.push(<rect key="ovw" x={36} y={oy + 60} width={c.w - 72} height={h - 240} rx={6} fill="#3a3f44" opacity={0.85} />);
      n.push(<rect key="ovh" x={36} y={oy + 18} width={c.w - 72} height={12} rx={6} fill={C.handle} />);
    } else {
      n.push(<Facade key="fc" box={b} cab={c} />);
    }
    const cy = worktopY + GEOM.worktop / 2;
    [0.3, 0.7].forEach((cxF, a) => [0.32, 0.68].forEach((cyF, b2) => n.push(<circle key={`hb${a}-${b2}`} cx={c.w * cxF} cy={cy + (cyF - 0.5) * (GEOM.worktop - 14)} r={9} fill="#2c3035" />)));
  } else if (c.appliance === "dishwasher") {
    n.push(<rect key="dw" x={14} y={GEOM.plinth + 14} width={c.w - 28} height={h - 28} rx={6} fill={C.facade} stroke={C.facadeLine} strokeWidth={4} />);
    n.push(<rect key="dwc" x={14} y={GEOM.plinth + h - 60} width={c.w - 28} height={18} rx={4} fill={C.steel} stroke={C.steelLine} strokeWidth={3} />);
  } else if (c.appliance === "washer") {
    const cx = c.w / 2, cyp = GEOM.plinth + h / 2 - 20, rp = Math.min(c.w, h) * 0.3;
    n.push(<rect key="wm" x={14} y={GEOM.plinth + 14} width={c.w - 28} height={h - 28} rx={6} fill={c.builtin ? C.facade : "#f2f2f0"} stroke={C.facadeLine} strokeWidth={4} />);
    n.push(<rect key="wmc" x={14} y={GEOM.plinth + h - 66} width={c.w - 28} height={22} rx={4} fill={C.steel} stroke={C.steelLine} strokeWidth={3} />);
    n.push(<circle key="wmd" cx={cx} cy={cyp} r={rp} fill="none" stroke={C.steelLine} strokeWidth={5} />);
    n.push(<circle key="wmg" cx={cx} cy={cyp} r={rp * 0.68} fill="#2c3035" opacity={0.85} />);
  } else {
    n.push(<Facade key="fc" box={b} cab={c} />);
  }
  return n;
}

/** Interior structure (the hybrid cell tree: split dividers + leaf shelves) in LOCAL
 *  coords — a reveal layer over a transparent/wireframe cabinet so you can see inside.
 *  y is physical-up (the elevation is drawn under a scale(1 -1) flip). */
export function interiorLocal(c: Cabinet, mountY: number): React.ReactNode[] {
  const ap = c.appliance && c.appliance !== "none" && c.appliance !== "filler";
  if (ap || c.furniture) return []; // appliances / furniture have no cabinet shelf interior
  const y0 = c.kind === "upper" ? mountY : GEOM.plinth;
  const h = c.h, w = c.w;
  const out: React.ReactNode[] = [];
  // draw every split boundary (the separators/interior structure) in fraction space
  const walk = (cell: Cell, fx0: number, fy0: number, fx1: number, fy1: number, key: string) => {
    if (isLeaf(cell)) return;
    const sizes = cellSizes(cell);
    let acc = 0;
    for (let i = 0; i < cell.children!.length; i++) {
      const f = sizes[i];
      if (cell.split === "rows") walk(cell.children![i], fx0, fy0 + (fy1 - fy0) * acc, fx1, fy0 + (fy1 - fy0) * (acc + f), `${key}${i}`);
      else walk(cell.children![i], fx0 + (fx1 - fx0) * acc, fy0, fx0 + (fx1 - fx0) * (acc + f), fy1, `${key}${i}`);
      acc += f;
      if (i < cell.children!.length - 1) {
        if (cell.split === "rows") { const fy = fy0 + (fy1 - fy0) * acc; out.push(<line key={`${key}r${i}`} x1={w * fx0} y1={y0 + h * fy} x2={w * fx1} y2={y0 + h * fy} stroke={C.facadeLine} strokeWidth={8} />); }
        else { const fx = fx0 + (fx1 - fx0) * acc; out.push(<line key={`${key}c${i}`} x1={w * fx} y1={y0 + h * fy0} x2={w * fx} y2={y0 + h * fy1} stroke={C.facadeLine} strokeWidth={8} />); }
      }
    }
  };
  walk(cabinetLayout(c), 0, 0, 1, 1, "i");
  return out;
}
