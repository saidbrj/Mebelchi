// 2D floor plan for the constructor. Draws the room (floor + walls + openings)
// like the room editor's plan, then overlays the kitchen footprints. A selected
// module shows its width + depth (tap to edit), a drag handle, and a rotate handle
// (press-rotate with a circular progress ring; snaps to 45°/90° when the magnet is
// on). Free drag/rotate is stored as a plan transform (px/pz/rot) the plan honours.
import { useRef, useState } from "react";
import {
  polygonBoundsMm,
  offsetPolygon,
  centroidOf,
  wallSegments,
  openingSpan,
  type Pt,
  type Opening,
} from "../model/room";
import { cornerUnits, outerEndSeats, pickSeat, planRuns, DEFAULT_REVEAL, type KitchenLayout, type CornerSpec } from "../model/runPlan";
import type { Cabinet } from "../model/cabinet";
import { isOuterCorner, cabDepth, cabBand } from "../model/bands";
import { cabFootprints, footsClash, rectCorners, FOOT_DEPTH_MM, type Foot } from "../model/footprint";
import { outerFacingSigns, chamferRing } from "../model/outerCorner";
import { useSvgZoom } from "./useSvgZoom";
import { ICON_DRAG_PATH, ICON_ROTATE_PATH } from "./icons";

const T = 100; // wall thickness (mm)
const MARGIN = 500;
const GRID = 500; // visual + snap grid spacing (mm)
// a corner unit has ONE legal seat per inside corner, so its magnet is deliberately wide
const CORNER_SNAP_MM = 900;

/** a seat a dragged corner unit can drop into: an inside corner, or (outer) a run's exposed end,
 *  which also carries the `face` its cut corner looks toward and the `vertex` it caps. */
type PlanSeat = CornerSpec & { face?: Pt; vertex?: Pt };

const C = {
  facade: "#e7ddc9",
  facadeLine: "#c4b79c",
  carcass: "#efe8da",
  steel: "#d6dadd",
  steelLine: "#a9afb4",
  filler: "#ddd5c8",
  sel: "#00ac7a",
};

const path = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z";
const DEG = 180 / Math.PI;

// `rectCorners` + the SAT overlap test live in model/footprint.ts — this file used to carry a
// verbatim copy of both. SIGNS stays (the corner-notch geometry below needs the quadrant order).
const SIGNS: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function outwardNormal(a: Pt, b: Pt, c: Pt) {
  let nx = b.y - a.y;
  let ny = -(b.x - a.x);
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  if ((mx - c.x) * nx + (my - c.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

function OpeningGlyph({ o, a, b, nx, ny, coveringColor }: { o: Opening; a: Pt; b: Pt; nx: number; ny: number; coveringColor: string }) {
  const sp = openingSpan(a, b, o.t, o.width);
  const { p1, p2 } = sp;
  if (o.kind === "window") {
    return (
      <g pointerEvents="none">
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth={T + 8} />
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8fc7e8" strokeWidth={26} />
      </g>
    );
  }
  if (o.kind === "opening") {
    return (
      <g pointerEvents="none">
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={coveringColor} strokeWidth={T + 8} />
      </g>
    );
  }
  const ax = -nx;
  const ay = -ny;
  const h = o.flip ? p2 : p1;
  const sweep = o.flip ? 0 : 1;
  const op = o.flip ? p1 : p2;
  return (
    <g pointerEvents="none">
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth={T + 8} />
      <line x1={h.x} y1={h.y} x2={h.x + ax * o.width} y2={h.y + ay * o.width} stroke="#8a8a8a" strokeWidth={10} />
      <path d={`M${h.x + ax * o.width} ${h.y + ay * o.width} A${o.width} ${o.width} 0 0 ${sweep} ${op.x} ${op.y}`} fill="none" stroke="#8a8a8a" strokeWidth={8} />
    </g>
  );
}

type DragRef =
  | { id: string; mode: "move"; startCx: number; startCy: number; rot: number; downX: number; downY: number }
  | { id: string; mode: "rotate"; cx: number; cy: number; startRot: number; startAngle: number; r: number; prevA: number; accum: number }
  /** dragging a DIMENSION arrow. `axX/axY` is the axis it measures along (width → the module's
   *  u axis, depth → its i axis); `sign` is which end was grabbed, so pulling either arrowhead
   *  outward grows the module. */
  | { id: string; mode: "dim"; kind: "w" | "depth"; v0: number; axX: number; axY: number; sign: 1 | -1; downX: number; downY: number }
  | null;

/** dimension drags snap to 5 cm, like the 3D arrows */
const DIM_STEP = 50;

export interface PlanEdit {
  clientX: number;
  clientY: number;
  value: number;
  cabId: string;
  kind: "w" | "depth";
}

export function ConstructorPlan({
  points,
  openings,
  interiorWalls,
  coveringColor,
  layout,
  waterWall,
  reveal = DEFAULT_REVEAL,
  cabs,
  mode = "real",
  grid = false,
  magnet = true,
  selectedId,
  selectedIds,
  onSelectCab,
  onMovePlan,
  onBeginEdit,
  onEditDim,
  onDragDim,
  interactiveTemplate,
}: {
  points: Pt[];
  openings: Opening[];
  interiorWalls: Pt[][];
  coveringColor: string;
  layout: KitchenLayout;
  waterWall: number | null;
  reveal?: number;
  cabs: Cabinet[];
  /** furniture render style — real (filled) / xray (faded) / wire (outlines) */
  mode?: "real" | "xray" | "wire";
  grid?: boolean;
  magnet?: boolean;
  selectedId: string | null;
  /** the whole selection set — every member is highlighted, so a multi-select reads on the plan
   *  exactly as it does in the 3D / front view. Falls back to `selectedId` when absent. The single
   *  drag / rotate / dimension affordances stay keyed on `selectedId` (null in a multi-select). */
  selectedIds?: string[];
  onSelectCab: (id: string | null) => void;
  onMovePlan?: (id: string, patch: { px?: number; pz?: number; rot?: number; cornerFace?: Pt }) => void;
  /** snapshot for undo before a drag/rotate gesture starts */
  onBeginEdit?: () => void;
  onEditDim?: (e: PlanEdit) => void;
  /** DRAG a dimension arrow (width re-tiles the row; depth honours the row-scope mode).
   *  Tapping the number still opens the type-in editor — this is the pull. */
  onDragDim?: (id: string, kind: "w" | "depth", value: number) => void;
  interactiveTemplate?: {
    active: boolean;
    onSnapWall: (wallIndex: number) => void;
  };
}) {
  const [rotUI, setRotUI] = useState<{ cx: number; cy: number; r: number; a0: number; a1: number } | null>(null);
  const [moveGuide, setMoveGuide] = useState<{ vx?: number; vy?: number } | null>(null);
  const dragRef = useRef<DragRef>(null);
  const begun = useRef(false); // snapshot taken for the current gesture?

  const b = polygonBoundsMm(points);
  const boxW = b.w + 2 * MARGIN;
  const boxH = b.h + 2 * MARGIN;
  const box = { x: b.minX - MARGIN, y: b.minY - MARGIN, w: boxW, h: boxH };
  const zoom = useSvgZoom(box, `${b.minX},${b.minY},${b.w},${b.h}`);
  const U = boxW * zoom.scale; // constant-on-screen unit

  const inner = offsetPolygon(points, T);
  const c = centroidOf(points);
  const d = path(points);
  const dInner = path(inner);
  const segs = wallSegments(points, interiorWalls);

  // footprints — base/tall + appliances + uppers (wall units drawn dashed on top);
  // shared with the 3D editor so free transforms (px/pz/rot) read identically
  const foot = cabFootprints(cabs, points, waterWall, layout, openings, reveal);
  const selFoot = selectedId ? foot.find((f) => f.id === selectedId) : undefined;

  // FILLER PANELS («доборы») — a thin rectangle in the reserved gap at each wall-butting run end, so
  // the plan shows the same scribe strip the 3D and front view do. Base-depth, run-aligned; measured
  // from the run placement (same room-mm space as the footprints).
  const fillerQuads = (() => {
    const runs = planRuns(points, waterWall, layout, openings, cabs, reveal).runs;
    const quads: { pts: { x: number; y: number }[]; upper?: boolean; cab?: Cabinet }[] = [];
    runs.forEach((r, rIdx) => {
      if (r.kind !== "wall") return;
      const revS = r.revealStart ?? 0;
      const revE = r.revealEnd ?? 0;
      if (!revS && !revE) return;

      const onRun = cabs.filter(
        (c) => (c.run ?? 0) === rIdx && c.px == null && c.appliance !== "filler" && !c.furniture && !c.corner,
      );
      if (!onRun.length) return;

      const p = r.placement;
      const uppers = onRun.filter((c) => c.kind === "upper" && c.appliance !== "hood");
      const bases = onRun.filter((c) => c.kind === "base");
      const talls = onRun.filter((c) => c.kind === "tall");

      const edge = (pool: Cabinet[], atStart: boolean): Cabinet | null => {
        if (!pool.length) return null;
        const key = (c: Cabinet) => (atStart ? (c.x ?? 0) : -((c.x ?? 0) + c.w));
        return pool.reduce((b, c) => (key(c) < key(b) ? c : b));
      };

      const addQuads = (sC: number, w: number, atStart: boolean) => {
        const levels = new Map<number, Cabinet[]>();
        for (const c of onRun) {
          const band = cabBand(c);
          const list = levels.get(band.carcass0) ?? [];
          list.push(c);
          levels.set(band.carcass0, list);
        }
        for (const pool of levels.values()) {
          const outer = edge(pool, atStart);
          if (outer) {
            const dep = cabDepth(outer);
            const cx = (p.ax + p.ux * sC + p.ix * (dep / 2000)) * 1000 + b.cx;
            const cy = (p.az + p.uz * sC + p.iz * (dep / 2000)) * 1000 + b.cy;
            const upper = outer.kind === "upper";
            quads.push({ pts: rectCorners(cx, cy, p.ux, p.uz, p.ix, p.iz, w, dep), upper, cab: outer });
          }
        }
      };

      if (revS) addQuads(revS / 2000, revS, true);
      if (revE) addQuads(p.lenM - revE / 2000, revE, false);
    });
    return quads;
  })();

  // overlap warning: footprints clashing (in plan AND in height — footsClash), or a module pushed
  // into a wall
  const overlap = new Set<string>();
  for (let i = 0; i < foot.length; i++) {
    for (let j = i + 1; j < foot.length; j++) {
      if (footsClash(foot[i], foot[j])) {
        overlap.add(foot[i].id);
        overlap.add(foot[j].id);
      }
    }
  }
  for (const f of foot) {
    if (f.furniture) continue; // furniture isn't pinned to the walls
    // An OUTER corner WRAPS a wall corner: the quadrant its ring leaves out is the wall itself, so a
    // quarter of its bounding rectangle is SUPPOSED to be outside the room. Testing that rectangle
    // paints the one module that is seated correctly red.
    if (f.cornerShape === "outer") continue;
    const corners = rectCorners(f.cx, f.cy, f.ux, f.uy, f.ix, f.iy, f.w * 0.9, f.depth * 0.9);
    if (corners.some((p) => !pointInPoly(p.x, p.y, inner))) overlap.add(f.id);
  }

  // snap a dragged footprint centre to walls + other footprints (magnet) and/or the
  // grid; returns the snapped centre + any guide lines to show
  const wallMinX = Math.min(...inner.map((p) => p.x));
  const wallMaxX = Math.max(...inner.map((p) => p.x));
  const wallMinY = Math.min(...inner.map((p) => p.y));
  const wallMaxY = Math.max(...inner.map((p) => p.y));
  /** the seat a dragged CORNER unit should drop into, if it's near one. An INNER corner is sized to
   *  the module itself (base corner 840, upper 613) so the square lands flush on both walls; an
   *  OUTER unit is an END UNIT, so its seats are the exposed ends of the wall runs, and its seat
   *  carries the `face` its cut corner looks toward. Away from a seat either one drags on freely
   *  (wall snap, via snapMove). */
  const cornerSeat = (id: string, px: number, py: number, rotDeg: number): PlanSeat | null => {
    const cab = cabs.find((c) => c.id === id);
    if (!cab?.corner || !magnet) return null;
    const seats: PlanSeat[] = isOuterCorner(cab)
      ? outerEndSeats(points, cab.w, cabDepth(cab))
      : cornerUnits(points, waterWall, layout, openings, cab.w);
    // the seat the drag is AIMED at — measured to the room corner as well as to the seat centre,
    // and preferring one that doesn't spin the module onto the perpendicular wall (see pickSeat)
    return pickSeat(seats, px, py, rotDeg, CORNER_SNAP_MM);
  };

  const snapMove = (f: Foot, cx: number, cy: number) => {
    const TH = 0.03 * U; // ≈ constant on screen
    let sx = cx;
    let sy = cy;
    let gvx: number | undefined;
    let gvy: number | undefined;
    if (magnet) {
      const others = foot.filter((o) => o.id !== f.id);
      // candidate centre-x positions: stick to a wall, align/abut another footprint
      const candX = [wallMinX + f.hbx, wallMaxX - f.hbx];
      const candY = [wallMinY + f.hby, wallMaxY - f.hby];
      for (const o of others) {
        candX.push(o.cx, o.cx - o.hbx - f.hbx, o.cx + o.hbx + f.hbx);
        candY.push(o.cy, o.cy - o.hby - f.hby, o.cy + o.hby + f.hby);
      }
      let bx = TH;
      for (const v of candX) { const dd = Math.abs(cx - v); if (dd < bx) { bx = dd; sx = v; gvx = v; } }
      let by = TH;
      for (const v of candY) { const dd = Math.abs(cy - v); if (dd < by) { by = dd; sy = v; gvy = v; } }
    }
    if (grid) {
      if (gvx === undefined) { const g = Math.round(sx / GRID) * GRID; if (Math.abs(sx - g) < TH) { sx = g; gvx = g; } }
      if (gvy === undefined) { const g = Math.round(sy / GRID) * GRID; if (Math.abs(sy - g) < TH) { sy = g; gvy = g; } }
    }
    return { x: sx, y: sy, gvx, gvy };
  };

  // four oriented corners of a footprint rectangle
  const footCorners = (f: Foot) => {
    const hw = f.w / 2, hd = f.depth / 2;
    return SIGNS.map(([su, si]) => ({ x: f.cx + f.ux * su * hw + f.ix * si * hd, y: f.cy + f.uy * su * hw + f.iy * si * hd }));
  };
  // Corner-unit outline: a square with its ROOM-FACING corner removed — either via an inner notch
  // (L-shape, L-door) or via a single 45° chamfer (pentagon, diagonal door). `cut` is how far the
  // run-butt edge sits past centre (armDepth − halfSide).
  //
  // This is the TWIN of kitchen3d's `footPts`. The two are separate implementations of the same
  // polygon, so both must read the module's `cornerShape` / `armDepth` — if only one does, the plan
  // and the 3D quietly draw different cabinets.
  const cornerGeom = (f: Foot) => {
    const P = (uu: number, ii: number) => ({ x: f.cx + f.ux * uu + f.ix * ii, y: f.cy + f.uy * uu + f.iy * ii });
    // OUTER = the ANGLED END UNIT: a rectangle with its exposed front corner cut at 45°, open across
    // the cut. The shared model/outerCorner ring is the SAME one the 3D reads.
    if (f.cornerShape === "outer") {
      const face = f.cornerFace ?? c;
      const { su } = outerFacingSigns(face, f.cx, f.cy, f.rotDeg);
      const { ring: local, openEdges } = chamferRing(f.w, f.depth, f.chamfer ?? Infinity, su);
      const ring = local.map((p) => P(p.along, p.into));
      const doorSegs = openEdges.map((e) => [ring[e], ring[(e + 1) % ring.length]]);
      return { ring, doorSegs };
    }
    const cs = footCorners(f);
    let ri = 0, rd = Infinity;
    cs.forEach((p, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < rd) { rd = d; ri = i; } });
    const [su, si] = SIGNS[ri];
    const diagonal = f.cornerShape === "diagonal";
    const hw = f.w / 2, cut = f.armDepth - hw;
    const buttA = P(su * hw, si * cut), buttB = P(su * cut, si * hw), notch = P(su * cut, si * cut);
    const ring = [P(-su * hw, -si * hw), P(su * hw, -si * hw), buttA, ...(diagonal ? [] : [notch]), buttB, P(-su * hw, si * hw)];
    const doorSegs = diagonal ? [[buttA, buttB]] : [[buttA, notch], [notch, buttB]];
    return { ring, doorSegs };
  };
  const quadPts = (f: Foot) => {
    if (!f.corner) return footCorners(f).map((p) => `${p.x},${p.y}`).join(" ");
    return cornerGeom(f).ring.map((p) => `${p.x},${p.y}`).join(" ");
  };

  // ---- pointer + drag/rotate ----
  const clientToMm = (e: React.PointerEvent) => {
    const svg = zoom.svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  };

  const snapToClosestWall = (mm: { x: number; y: number }) => {
    if (!interactiveTemplate?.onSnapWall || points.length < 3) return;
    let minD = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      let t = ((mm.x - a.x) * dx + (mm.y - a.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const d = Math.hypot(mm.x - px, mm.y - py);
      if (d < minD) {
        minD = d;
        bestIdx = i;
      }
    }
    interactiveTemplate.onSnapWall(bestIdx);
  };
  const onMoveDown = (f: Foot) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    begun.current = false; // snapshot lazily on the first move (taps make no undo step)
    const mm = clientToMm(e);
    dragRef.current = { id: f.id, mode: "move", startCx: f.cx, startCy: f.cy, rot: f.rotDeg, downX: mm.x, downY: mm.y };
  };
  const onRotateDown = (f: Foot, r: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    begun.current = false;
    const mm = clientToMm(e);
    const a = Math.atan2(mm.y - f.cy, mm.x - f.cx);
    dragRef.current = { id: f.id, mode: "rotate", cx: f.cx, cy: f.cy, startRot: f.rotDeg, startAngle: a, r, prevA: a, accum: 0 };
    setRotUI({ cx: f.cx, cy: f.cy, r, a0: a, a1: a });
  };
  /** grab a dimension arrow. `sign` says which arrowhead the finger landed on, so pulling either
   *  end outward grows the module — the same rule the 3D arrows use. */
  const onDimDown = (f: Foot, kind: "w" | "depth") => (e: React.PointerEvent) => {
    if (!onDragDim) return;
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    begun.current = false; // lazy snapshot — a tap (to type a number) makes no undo step
    const mm = clientToMm(e);
    const axX = kind === "w" ? f.ux : f.ix;
    const axY = kind === "w" ? f.uy : f.iy;
    const sign: 1 | -1 = (mm.x - f.cx) * axX + (mm.y - f.cy) * axY >= 0 ? 1 : -1;
    dragRef.current = { id: f.id, mode: "dim", kind, v0: kind === "w" ? f.w : f.depth, axX, axY, sign, downX: mm.x, downY: mm.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr) return;
    if (dr.mode === "dim") {
      if (!onDragDim) return;
      e.stopPropagation();
      if (!begun.current) { onBeginEdit?.(); begun.current = true; }
      const mm = clientToMm(e);
      const along = (mm.x - dr.downX) * dr.axX + (mm.y - dr.downY) * dr.axY;
      const raw = dr.v0 + dr.sign * along;
      onDragDim(dr.id, dr.kind, Math.round(raw / DIM_STEP) * DIM_STEP);
      return;
    }
    if (!onMovePlan) return;
    e.stopPropagation();
    if (!begun.current) { onBeginEdit?.(); begun.current = true; } // first move → one undo step
    const mm = clientToMm(e);
    if (dr.mode === "move") {
      const nx = dr.startCx + (mm.x - dr.downX);
      const ny = dr.startCy + (mm.y - dr.downY);
      // A CORNER UNIT has exactly one legal seat per corner — flush against BOTH walls (inner), or
      // wrapping the vertex (outer) — so it snaps to a corner, never to a single wall like an
      // ordinary module. Same rule the 3D uses, so dragging it in either view lands it identically.
      const seat = cornerSeat(dr.id, nx, ny, dr.rot);
      if (seat) {
        onMovePlan(dr.id, { px: seat.px, pz: seat.pz, rot: seat.rot, ...(seat.face ? { cornerFace: seat.face } : {}) });
        setMoveGuide(null);
        return;
      }
      const f = foot.find((x) => x.id === dr.id);
      const sn = f ? snapMove(f, nx, ny) : { x: nx, y: ny, gvx: undefined, gvy: undefined };
      onMovePlan(dr.id, { px: sn.x, pz: sn.y, rot: dr.rot });
      setMoveGuide({ vx: sn.gvx, vy: sn.gvy });
    } else {
      const a1 = Math.atan2(mm.y - dr.cy, mm.x - dr.cx);
      let d = a1 - dr.prevA; // unwrap across the ±180° branch cut
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      dr.accum += d;
      dr.prevA = a1;
      let rot = dr.startRot + dr.accum * DEG;
      if (magnet) {
        const n = Math.round(rot / 45) * 45;
        if (Math.abs(rot - n) < 7) rot = n; // snappy at 45° / 90°
      }
      onMovePlan(dr.id, { px: dr.cx, pz: dr.cy, rot });
      setRotUI({ cx: dr.cx, cy: dr.cy, r: dr.r, a0: dr.startAngle, a1 });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
    setRotUI(null);
    setMoveGuide(null);
  };

  // handle geometry for the selected footprint
  const R = 0.05 * U;
  const isc = (0.9 * R) / 16;
  // rotate is worth offering only when no wall is orienting the module — see the handle below.
  // An END UNIT is the exception among corners: an elbow has TWO of them, one per wall, and turning
  // it is how you say which wall it caps. Without a handle it was stuck on whichever one the app
  // happened to seat it against.
  const selCabP = selectedId ? cabs.find((c) => c.id === selectedId) : undefined;
  const selRotatable =
    !!selCabP && (!selCabP.corner || isOuterCorner(selCabP)) &&
    (!!selCabP.furniture || !!selCabP.island || selCabP.px != null);
  const rotDist = selFoot ? Math.max(selFoot.w, selFoot.depth) / 2 + R * 2.2 : 0;
  const rotHx = selFoot ? selFoot.cx + selFoot.ix * rotDist : 0;
  const rotHy = selFoot ? selFoot.cy + selFoot.iy * rotDist : 0;

  // selected dims — a real dimension line (extension lines + end ticks + a chip) along
  // an edge, offset by `perp`
  const editClick = (value: number, cabId: string, kind: "w" | "depth") =>
    onEditDim ? (e: React.MouseEvent) => onEditDim({ clientX: e.clientX, clientY: e.clientY, value, cabId, kind }) : undefined;
  const sc = zoom.scale;
  const oDim = (
    a: Pt,
    b: Pt,
    perp: Pt,
    label: string,
    key: string,
    onClick?: (e: React.MouseEvent) => void,
    onDown?: (e: React.PointerEvent) => void,
  ) => {
    const OFF = 230 * sc;
    const STK = 4 * sc;
    const e1 = { x: a.x + perp.x * OFF, y: a.y + perp.y * OFF };
    const e2 = { x: b.x + perp.x * OFF, y: b.y + perp.y * OFF };
    const mx = (e1.x + e2.x) / 2;
    const my = (e1.y + e2.y) / 2;
    return (
      <g key={key}>
        <line x1={a.x} y1={a.y} x2={e1.x} y2={e1.y} stroke="#9aa0a6" strokeWidth={STK * 0.7} />
        <line x1={b.x} y1={b.y} x2={e2.x} y2={e2.y} stroke="#9aa0a6" strokeWidth={STK * 0.7} />
        {/* ARROWHEADS, not the old end ticks — and the line is draggable, so the arrow means what
            it looks like. A fat invisible line under it is the real grab target (a 4-unit stroke in
            a 4-metre viewBox is unhittable with a finger). */}
        <line
          x1={e1.x}
          y1={e1.y}
          x2={e2.x}
          y2={e2.y}
          stroke="transparent"
          strokeWidth={90 * sc}
          strokeLinecap="round"
          onPointerDown={onDown}
          style={onDown ? { cursor: "ew-resize", touchAction: "none" } : undefined}
        />
        <line
          x1={e1.x}
          y1={e1.y}
          x2={e2.x}
          y2={e2.y}
          stroke={C.sel}
          strokeWidth={STK}
          markerStart="url(#planArrow)"
          markerEnd="url(#planArrow)"
          pointerEvents="none"
        />
        <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
          {onClick && <rect x={mx - 200 * sc} y={my - 100 * sc} width={400 * sc} height={200 * sc} fill="transparent" />}
          <rect x={mx - 150 * sc} y={my - 78 * sc} width={300 * sc} height={156 * sc} rx={36 * sc} fill="#fff" stroke={C.sel} strokeWidth={5 * sc} />
          <text x={mx} y={my + 34 * sc} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={92 * sc} fontWeight={600} fill={C.sel}>{label}</text>
        </g>
      </g>
    );
  };

  return (
    <svg ref={zoom.svgRef} className="scene-canvas" style={{ touchAction: "none" }} viewBox={zoom.vbStr} preserveAspectRatio="xMidYMid meet" {...zoom.bind} onPointerMove={(e) => { zoom.bind.onPointerMove(e); onPointerMove(e); }} onPointerUp={(e) => { zoom.bind.onPointerUp(e); onPointerUp(e); }} onPointerCancel={(e) => { zoom.bind.onPointerCancel(e); onPointerUp(e); }}>
      <defs>
        <pattern id="cplanks" width="640" height="170" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="640" y2="0" stroke="rgba(150,120,80,0.20)" strokeWidth="3" />
          <line x1="0" y1="85" x2="640" y2="85" stroke="rgba(150,120,80,0.20)" strokeWidth="3" />
          <line x1="320" y1="0" x2="320" y2="85" stroke="rgba(150,120,80,0.14)" strokeWidth="2" />
          <line x1="160" y1="85" x2="160" y2="170" stroke="rgba(150,120,80,0.14)" strokeWidth="2" />
          <line x1="480" y1="85" x2="480" y2="170" stroke="rgba(150,120,80,0.14)" strokeWidth="2" />
        </pattern>
        {/* dimension arrowhead. `markerUnits="strokeWidth"` (the default) makes it scale with the
            line's stroke — which is already `4 * sc` — so it stays a constant size on screen at any
            zoom. Sized 30× the stroke: an unscaled 6.5 (what the 3D uses, in SCREEN px) would be a
            6.5mm speck here, because this SVG's user units are room millimetres. */}
        <marker id="planArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={30} markerHeight={30} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={C.sel} />
        </marker>
      </defs>

      {/* tap empty space to deselect */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" onClick={() => onSelectCab(null)} />

      {/* optional snapping grid */}
      {grid && (
        <g pointerEvents="none">
          {Array.from({ length: Math.floor(box.w / GRID) + 2 }, (_, i) => {
            const gx = Math.ceil(box.x / GRID) * GRID + i * GRID;
            return <line key={`gx${i}`} x1={gx} y1={box.y} x2={gx} y2={box.y + box.h} stroke="rgba(42,109,240,0.12)" strokeWidth={3} />;
          })}
          {Array.from({ length: Math.floor(box.h / GRID) + 2 }, (_, i) => {
            const gy = Math.ceil(box.y / GRID) * GRID + i * GRID;
            return <line key={`gy${i}`} x1={box.x} y1={gy} x2={box.x + box.w} y2={gy} stroke="rgba(42,109,240,0.12)" strokeWidth={3} />;
          })}
        </g>
      )}

      {/* room shell */}
      <g pointerEvents="none">
        <path d={`${d} ${dInner}`} fillRule="evenodd" fill="#d6d6d6" />
        <path d={dInner} fill={coveringColor} />
        <path d={dInner} fill="url(#cplanks)" />
        <path d={d} fill="none" stroke="#b4b4b4" strokeWidth={6} />
        <path d={dInner} fill="none" stroke="#c7c7c7" strokeWidth={4} />
        {interiorWalls.map((poly, wi) => (
          <polyline key={`iw${wi}`} points={poly.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#b4b4b4" strokeWidth={T} strokeLinecap="square" strokeLinejoin="miter" />
        ))}
        {openings.map((o) => {
          const seg = segs[o.wall];
          if (!seg) return null;
          const nn = outwardNormal(seg.a, seg.b, c);
          return <OpeningGlyph key={o.id} o={o} a={seg.a} b={seg.b} nx={nn.nx} ny={nn.ny} coveringColor={coveringColor} />;
        })}
      </g>

      {/* interactive template drag & wall snapping overlay */}
      {interactiveTemplate?.active && (
        <g
          style={{ cursor: "grab", touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
            const mm = clientToMm(e);
            snapToClosestWall(mm);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0) {
              const mm = clientToMm(e);
              snapToClosestWall(mm);
            }
          }}
        >
          <path d={dInner} fill="rgba(16, 185, 129, 0.06)" stroke="#10b981" strokeWidth={10} strokeDasharray="60 30" />
          {segs.map((s, idx) => (
            <line
              key={`tmpl-wall-hit-${idx}`}
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              stroke="transparent"
              strokeWidth={350}
              onPointerDown={(e) => {
                e.stopPropagation();
                interactiveTemplate.onSnapWall(idx);
              }}
            />
          ))}
        </g>
      )}

      {/* filler «доборы» — the scribe strip in the reserved gap at each wall-butting run end */}
      {fillerQuads.map((q, i) => {
        const typeFill = q.cab?.finish?.facade != null
          ? `#${q.cab.finish.facade.toString(16).padStart(6, "0")}`
          : C.facade;
        return (
          <polygon
            key={`fill${i}`}
            points={q.pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={q.upper ? "none" : typeFill}
            stroke={q.upper ? "#9aa0a6" : C.facadeLine}
            strokeWidth={q.upper ? 7 : 8}
            strokeDasharray={q.upper ? `${70} ${45}` : undefined}
          />
        );
      })}

      {/* footprint bodies — render style (Lines/Transparent) applied here only */}
      <g className={mode === "wire" ? "svg-wire plan-wire" : mode === "xray" ? "svg-xray" : undefined}>
        {foot.map((f) => {
          const appl = f.appliance === "fridge" || f.appliance === "oven" || f.appliance === "dishwasher" || f.appliance === "washer" ? C.steel : f.appliance === "sink" || f.appliance === "hob" ? C.carcass : null;
          // a picked facade finish recolours the footprint (appliances keep their look)
          const typeFill = appl ?? (f.finish?.facade != null ? `#${f.finish.facade.toString(16).padStart(6, "0")}` : C.facade);
          const along = (mm: number) => ({ x: f.ux * mm, y: f.uy * mm });
          const into = (mm: number) => ({ x: f.ix * mm, y: f.iy * mm });
          return (
            <g key={f.id} pointerEvents="none">
              <polygon points={quadPts(f)} fill={f.upper ? "none" : typeFill} stroke={f.upper ? "#9aa0a6" : C.facadeLine} strokeWidth={f.upper ? 7 : 8} strokeDasharray={f.upper ? `${70} ${45}` : undefined} />
              {f.corner && cornerGeom(f).doorSegs.map((s, si) => <line key={`dr${si}`} x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke={f.upper ? "#9aa0a6" : C.facadeLine} strokeWidth={f.upper ? 7 : 9} />)}
              {!f.upper && f.appliance === "sink" && [-0.12, 0.12].map((k, ki) => { const o = along(k * f.w); return <circle key={ki} cx={f.cx + o.x} cy={f.cy + o.y} r={Math.min(f.w * 0.16, 160)} fill="none" stroke={C.steelLine} strokeWidth={10} />; })}
              {!f.upper && f.appliance === "hob" && [-0.18, 0.18].flatMap((au) => [-0.16, 0.16].map((ai) => { const o1 = along(au * f.w); const o2 = into(ai * f.depth); return <circle key={`${au}-${ai}`} cx={f.cx + o1.x + o2.x} cy={f.cy + o1.y + o2.y} r={70} fill="#2c3035" />; }))}
              {!f.upper && f.appliance === "fridge" && (() => { const o = into(f.depth * 0.32); return <circle cx={f.cx + o.x} cy={f.cy + o.y} r={70} fill="#111417" />; })()}
            </g>
          );
        })}
      </g>

      {/* selection + overlap highlight — drawn over the body, NOT affected by render mode. Every member
          of the selection set is tinted + bold-outlined, so a multi-select reads like the 3D. */}
      {foot.map((f) => {
        const selected = selectedIds && selectedIds.length ? selectedIds.includes(f.id) : f.id === selectedId;
        const over = overlap.has(f.id);
        if (!selected && !over) return null;
        return <polygon key={`hl${f.id}`} points={quadPts(f)} pointerEvents="none" fill={over ? "rgba(229,57,53,0.26)" : C.sel} fillOpacity={over ? 1 : 0.22} stroke={over ? "#e53935" : C.sel} strokeWidth={over ? 16 : 22} strokeDasharray={f.upper && !over ? `${70} ${45}` : undefined} />;
      })}

      {/* selection targets — above the visuals so any footprint can be (re)selected;
          wall units last so the back strip selects the upper, the front strip the base */}
      {[...foot].sort((a, b) => Number(a.upper) - Number(b.upper)).map((f) => (
        <polygon key={`t${f.id}`} points={quadPts(f)} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelectCab(f.id)} />
      ))}

      {/* magnet / grid alignment guides while moving */}
      {moveGuide?.vx != null && <line x1={moveGuide.vx} y1={box.y} x2={moveGuide.vx} y2={box.y + box.h} stroke={C.sel} strokeWidth={0.006 * U} strokeDasharray={`${0.03 * U} ${0.02 * U}`} pointerEvents="none" />}
      {moveGuide?.vy != null && <line x1={box.x} y1={moveGuide.vy} x2={box.x + box.w} y2={moveGuide.vy} stroke={C.sel} strokeWidth={0.006 * U} strokeDasharray={`${0.03 * U} ${0.02 * U}`} pointerEvents="none" />}

      {/* rotation progress ring */}
      {rotUI && (() => {
        const sweep = ((rotUI.a1 - rotUI.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const large = sweep > Math.PI ? 1 : 0;
        const p0 = { x: rotUI.cx + rotUI.r * Math.cos(rotUI.a0), y: rotUI.cy + rotUI.r * Math.sin(rotUI.a0) };
        const p1 = { x: rotUI.cx + rotUI.r * Math.cos(rotUI.a1), y: rotUI.cy + rotUI.r * Math.sin(rotUI.a1) };
        return (
          <g pointerEvents="none">
            <circle cx={rotUI.cx} cy={rotUI.cy} r={rotUI.r} fill="none" stroke="#fff" strokeWidth={0.01 * U} />
            <path d={`M${p0.x} ${p0.y} A${rotUI.r} ${rotUI.r} 0 ${large} 1 ${p1.x} ${p1.y}`} fill="none" stroke={C.sel} strokeWidth={0.012 * U} strokeLinecap="round" />
          </g>
        );
      })()}

      {/* selected dims: depth on the right edge, width on the bottom edge */}
      {selFoot && onEditDim && (() => {
        const f = selFoot;
        const hw = f.w / 2;
        const hd = f.depth / 2;
        // width on the lower screen side (bottom); depth on the right screen side
        const wperp = f.iy >= 0 ? { x: f.ix, y: f.iy } : { x: -f.ix, y: -f.iy };
        const dperp = f.ux >= 0 ? { x: f.ux, y: f.uy } : { x: -f.ux, y: -f.uy };
        const wA = { x: f.cx - f.ux * hw + wperp.x * hd, y: f.cy - f.uy * hw + wperp.y * hd };
        const wB = { x: f.cx + f.ux * hw + wperp.x * hd, y: f.cy + f.uy * hw + wperp.y * hd };
        const dA = { x: f.cx + dperp.x * hw - f.ix * hd, y: f.cy + dperp.y * hw - f.iy * hd };
        const dB = { x: f.cx + dperp.x * hw + f.ix * hd, y: f.cy + dperp.y * hw + f.iy * hd };
        return (
          <>
            {oDim(wA, wB, wperp, `${f.w}`, "dimw", editClick(f.w, f.id, "w"), onDimDown(f, "w"))}
            {oDim(dA, dB, dperp, `${f.depth}`, "dimd", editClick(f.depth, f.id, "depth"), onDimDown(f, "depth"))}
          </>
        );
      })()}
      {selFoot && onMovePlan && (
        <>
          {/* drag handle (centre) */}
          <g transform={`translate(${selFoot.cx} ${selFoot.cy})`} onPointerDown={onMoveDown(selFoot)} style={{ cursor: "grab", touchAction: "none" }}>
            <circle r={R} fill="#fff" stroke="#cfcfcf" strokeWidth={0.004 * U} />
            <g transform={`translate(${-16 * isc} ${-16 * isc}) scale(${isc})`}><path d={ICON_DRAG_PATH} fill="#1c1b18" /></g>
          </g>
          {/* ROTATE — only for a module with no wall to face it: furniture, an island, or something
              pulled free of a run. A cabinet tiled into a wall is oriented BY the wall, so the
              handle did nothing there but clutter the most common object on the plan. Same rule as
              the 3D (VariantScene's selRotatable), so the two views agree. */}
          {selRotatable && (
            <>
              <line x1={selFoot.cx} y1={selFoot.cy} x2={rotHx} y2={rotHy} stroke={C.sel} strokeWidth={0.004 * U} pointerEvents="none" />
              <g transform={`translate(${rotHx} ${rotHy})`} onPointerDown={onRotateDown(selFoot, rotDist)} style={{ cursor: "grab", touchAction: "none" }}>
                <circle r={R} fill="#fff" stroke="#cfcfcf" strokeWidth={0.004 * U} />
                <g transform={`translate(${-16 * isc} ${-16 * isc}) scale(${isc})`}><path d={ICON_ROTATE_PATH} fill="#1c1b18" /></g>
              </g>
            </>
          )}
        </>
      )}
    </svg>
  );
}
