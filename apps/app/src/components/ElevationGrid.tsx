// The front view as a SPREADSHEET — now with A COLUMN TRACK PER BAND.
//
// The wall owns a GRID (model/grid.ts). Each band — the floor row (bases) and each wall row
// (uppers) — has its OWN columns, so the uppers are no longer forced onto the bases' boundaries: a
// 600 upper can sit over an 800 sink base, and a band can hold a different NUMBER of cabinets from
// the band below it. Alignment between bands is a snap you reach for, not a law.
//
//   • an EMPTY ROOM already has cells, drawn and draggable, ready to fill
//   • tap a cell            → a module appears AT THE CELL'S SIZE. You never type a dimension.
//   • drag a column border  → the columns past it IN THAT BAND absorb it; the band's length holds
//   • tap "+" on a band     → another cabinet, its width stolen from the widest cell in that band
//   • drag a row border     → the rows above give up what it takes; the ceiling never moves
//
// A module has NO POSITION — it has a cell address, and its x/y/w/h are projected out of its band's
// track by prefix sum. Two modules cannot overlap within a band; the store refuses any edit that
// would put two in one cell, so the border stops dead under your finger.
//
// Geometry is in mm. Screen y grows DOWN (so text is upright); Y(mm) converts.

import { useMemo, useRef, useState } from "react";
import type { Cabinet } from "../model/cabinet";
import { resolveLayout, wallFeatures, type Room, type ResolvedCab } from "../model/resolve";
import { colEdges, rowEdges, ROW_MIN, type WallGrid, type CellRef, type RowKind } from "../model/grid";
import { openCells, inSheet } from "../model/sheet";
import type { Fitting } from "../model/room";
import { C, moduleLocal, interiorLocal } from "./elevationDraw";
import { useSvgZoom } from "./useSvgZoom";

const GX = 340;
const GT = 260;
const GR = 220;
const GB = 240;

const GRID = "#c9ced6";
const HEAD = "#8b929c";
const EMPTY = "#aab2bd";
const BAND_A = "#f4f6f8";
const BAND_B = "#eceff3";
const VOID_T = "#f7f8fa";
const WALL = "#e9ebee";
const GLASS = "#dcecf5";
const GLASS_L = "#7ba7bd";
const DOORL = "#9a9184";
const FITL = "#9aa3ad";
const RED = "#e53935";

export interface EditDim {
  clientX: number;
  clientY: number;
  value: number;
  kind: "col" | "row" | "depth";
  /** which track line the number belongs to */
  index: number;
  /** the band a COLUMN edit belongs to (columns are per-band now) */
  rowId?: string;
  cabId?: string;
}

/** a border being dragged. A column drag names its BAND (`rowId`/`j`) and the column `i` within it. */
type Drag =
  | { kind: "col"; j: number; rowId: string; i: number; startMm: number; startW: number }
  | { kind: "row"; j: number; startMm: number; startH: number }
  | null;

const snap = (mm: number, step = 10) => Math.round(mm / step) * step;

function rowLabel(g: WallGrid, j: number): string {
  const r = g.rows[j];
  if (r.kind === "floor") return "Низ";
  if (r.kind === "void") return "";
  const walls = g.rows.map((x, k) => ({ x, k })).filter((e) => e.x.kind === "wall");
  const n = walls.findIndex((e) => e.k === j);
  if (walls.length === 1) return "Верх";
  return n === 0 ? "Верх" : n === walls.length - 1 ? "Антресоль" : `Верх ${n + 1}`;
}

export function ElevationGrid({
  cabs,
  room,
  grid,
  fittings,
  run,
  ceiling,
  selectedId,
  mode = "real",
  onSelect,
  onAddInCell,
  onAddCol,
  onDropCol,
  onFillReach,
  onAddCorner,
  onBeginEdit,
  onColW,
  onRowH,
  onRowKind,
  onEditDim,
  className,
}: {
  cabs: Cabinet[];
  room: Room;
  grid: WallGrid | undefined;
  fittings: Fitting[];
  run: number;
  ceiling: number;
  selectedId: string | null;
  mode?: "real" | "xray" | "wire";
  onSelect: (id: string | null) => void;
  onAddInCell: (cell: CellRef) => void;
  /** "+ another cabinet" on a band — appends a slot on the end and equalises the band */
  onAddCol: (rowId: string) => void;
  /** "− one cabinet" on a band — drops the rightmost and equalises the rest */
  onDropCol: (rowId: string) => void;
  /** toggle a cabinet reaching into the corner reach strip at column `reachIdx` of band `rowId` */
  onFillReach: (rowId: string, reachIdx: number) => void;
  /** add an L-shaped corner cabinet to band `rowId` (a deep row has no reach strip → this is its
   *  only way to use the corner) */
  onAddCorner: (rowId: string) => void;
  onBeginEdit: () => void;
  /** set column `i`'s width IN BAND `rowId`; the columns past it in that band absorb it */
  onColW: (rowId: string, i: number, mm: number, live: boolean) => void;
  onRowH: (j: number, mm: number, live: boolean) => void;
  onRowKind: (j: number, kind: RowKind) => void;
  onEditDim: (e: EditDim) => void;
  className?: string;
}) {
  const [drag, setDrag] = useState<Drag>(null);
  const dragRef = useRef<Drag>(null);

  // ── THE MODEL ─────────────────────────────────────────────────────────────────────
  const L = useMemo(() => resolveLayout(cabs, room), [cabs, room]);
  const cells = useMemo(() => L.elevation(run), [L, run]);
  const wallLen = grid?.wallLen ?? L.wallLen(run);

  // each band's own column edges, and the row edges
  const rowXs = useMemo(() => (grid ? grid.rows.map((r) => colEdges(r)) : []), [grid]);
  const ys = useMemo(() => (grid ? rowEdges(grid) : [0]), [grid]);

  const pr = L.runs[run];
  const feats = useMemo(
    () => (pr ? wallFeatures(pr, wallLen, room.openings, fittings) : []),
    [pr, wallLen, room.openings, fittings],
  );

  const open = useMemo(() => {
    if (!grid) return [];
    return grid.rows.map((_, j) => openCells(grid, j, cabs, L, run, ceiling, room.openings, fittings));
  }, [grid, cabs, L, run, ceiling, room.openings, fittings]);

  // which band (row index) each module sits in — by best row overlap. Used to spot the cabinet next
  // to a corner reach strip, so tapping the strip can extend THAT cabinet into the corner.
  const cellBandIdx = useMemo(() => {
    const m = new Map<string, number>();
    if (!grid) return m;
    for (const rc of cells) {
      let bj = -1;
      let best = 0;
      for (let k = 0; k < grid.rows.length; k++) {
        if (grid.rows[k].kind === "void") continue;
        const ov = Math.min(ys[k + 1], rc.band.y1) - Math.max(ys[k], rc.band.y0);
        if (ov > best) { best = ov; bj = k; }
      }
      m.set(rc.id, bj);
    }
    return m;
  }, [grid, cells, ys]);

  // A corner reach strip (the 227mm fillable column beside a cleared corner) can be filled two ways:
  // add a standalone unit (the "+"), OR — the more common corner treatment — let the neighbouring
  // cabinet REACH into it. This reports, for a reach column, whether a neighbour exists to extend
  // ("extend"), or a cabinet already reaches in and can be pulled back out ("retract").
  const reachAt = (j: number, ci: number): "extend" | "retract" | null => {
    if (!grid) return null;
    const r = grid.rows[j];
    const col = r.cols[ci];
    if (!col || !col.lock || col.dead || col.tall) return null;
    const endCorner = !!r.cols[ci + 1]?.dead;
    const startCorner = !!r.cols[ci - 1]?.dead;
    if (!endCorner && !startCorner) return null;
    const nbIdx = endCorner ? ci - 1 : ci + 1;
    if (nbIdx < 0 || nbIdx >= r.cols.length) return null;
    const mid = (a: number) => (rowXs[j][a] + rowXs[j][a + 1]) / 2;
    const reachMid = mid(ci);
    const nbMid = mid(nbIdx);
    const covers = (x: number) => (rc: ResolvedCab) => cellBandIdx.get(rc.id) === j && rc.x <= x && rc.x + rc.w >= x;
    const filled = cells.some((rc) => covers(reachMid)(rc) && covers(nbMid)(rc)); // one cabinet over both
    if (filled) return "retract";
    return cells.some(covers(nbMid)) ? "extend" : null; // a neighbour to reach in
  };

  // ── VIEW ──────────────────────────────────────────────────────────────────────────
  const contentTop = cells.reduce((m, rc) => Math.max(m, rc.band.y1), ceiling);
  const viewH = Math.max(ceiling, contentTop + 200);
  const Y = (mm: number) => viewH - mm;
  const box = { x: -GX, y: -GT, w: wallLen + GX + GR, h: viewH + GT + GB };
  const zoom = useSvgZoom(box, `${run}:${Math.round(wallLen)}:${Math.round(ceiling)}`);
  const s = zoom.scale;

  // FILLER PANELS («доборы») — the reserved scribe gap at each wall-butting run end, drawn as a panel
  // beside the modules (wall-space mm). One band per module tier so the gap between base and uppers
  // stays open, matching the 3D. Their width IS the reserved dead zone, so they never overlap a module.
  const fillers = useMemo(() => {
    type F = { x: number; w: number; y0: number; y1: number; horizontal?: boolean; cab?: Cabinet };
    const revS = pr?.revealStart ?? 0;
    const revE = pr?.revealEnd ?? 0;
    const tiled = cells.filter((rc) => !rc.cab.corner && rc.cab.px == null && rc.cab.appliance !== "hood");
    const talls = tiled.filter((rc) => rc.cab.kind === "tall");
    const bases = tiled.filter((rc) => rc.cab.kind === "base");
    const uppers = tiled.filter((rc) => rc.cab.kind === "upper");
    const out: F[] = [];
    // the module NEAREST an end (start = smallest x, end = largest x+w) — so the filler MATCHES what
    // stands beside it (a пенал → one full-height strip; a base+upper end → a base strip and an upper
    // strip, backsplash gap left open) instead of the run's tallest module.
    const edge = (pool: ResolvedCab[], atStart: boolean): ResolvedCab | null => {
      if (!pool.length) return null;
      const key = (rc: ResolvedCab) => (atStart ? rc.x : -(rc.x + rc.w));
      return pool.reduce((b, rc) => (key(rc) < key(b) ? rc : b));
    };
    const bandsAt = (atStart: boolean): { y0: number; y1: number; cab?: Cabinet }[] => {
      const levels = new Map<number, ResolvedCab[]>();
      for (const rc of tiled) {
        const y0 = rc.band.carcass0;
        const list = levels.get(y0) ?? [];
        list.push(rc);
        levels.set(y0, list);
      }
      const res: { y0: number; y1: number; cab?: Cabinet }[] = [];
      for (const pool of levels.values()) {
        const e = edge(pool, atStart);
        if (e) {
          res.push({ y0: e.band.carcass0, y1: e.band.carcass1, cab: e.cab });
        }
      }
      return res;
    };
    if (pr && revS) for (const b of bandsAt(true)) out.push({ x: 0, w: revS, ...b });
    if (pr && revE) for (const b of bandsAt(false)) out.push({ x: wallLen - revE, w: revE, ...b });
    // horizontal TOP filler — a floor-to-ceiling run stops a reveal short of the ceiling; the strip
    // closes the gap across the run's usable width. Spans wall-to-wall.
    const cols = [...talls, ...uppers];
    if (cols.length) {
      const colTop = Math.max(...cols.map((rc) => rc.band.y1));
      const gap = ceiling - colTop;
      if (gap > 2 && gap <= 120) {
        const topCabs = cols.filter((rc) => Math.abs(rc.band.y1 - colTop) < 10);
        const topCab = edge(topCabs.length ? topCabs : cols, true)?.cab;
        out.push({ x: 0, w: wallLen, y0: colTop, y1: ceiling, horizontal: true, cab: topCab });
      }
    }
    return out;
  }, [pr, cells, wallLen, ceiling]);

  const clientToMm = (e: React.PointerEvent) => {
    const svg = zoom.svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: viewH - r.y };
  };

  // ── DRAG ──────────────────────────────────────────────────────────────────────────
  const startDrag = (make: (p: { x: number; y: number }) => NonNullable<Drag>) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onBeginEdit();
    const d = make(clientToMm(e));
    dragRef.current = d;
    setDrag(d);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const p = clientToMm(e);
    if (d.kind === "col") onColW(d.rowId, d.i, snap(d.startW + (p.x - d.startMm)), true);
    else onRowH(d.j, snap(d.startH + (p.y - d.startMm)), true);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
    setDrag(null);
  };

  // ── PIECES ────────────────────────────────────────────────────────────────────────
  const dimText = (v: number) => `${Math.round(v)}`;

  const chip = (cx: number, cy: number, label: string, onTap?: (e: React.MouseEvent) => void, strong = false) => {
    const w = (label.length * 40 + 60) * s;
    const h = 100 * s;
    return (
      <g onClick={onTap} style={onTap ? { cursor: "pointer" } : undefined}>
        <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={12 * s} fill="#fff" stroke={onTap ? C.sel : GRID} strokeWidth={2 * s} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={68 * s} fontWeight={strong ? 700 : 500} fill={onTap ? C.sel : HEAD}>
          {label}
        </text>
      </g>
    );
  };

  const tapCol = (rowId: string, index: number, value: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditDim({ clientX: e.clientX, clientY: e.clientY, value, kind: "col", index, rowId });
  };
  const tapRow = (index: number, value: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditDim({ clientX: e.clientX, clientY: e.clientY, value, kind: "row", index });
  };

  const alpha = mode === "xray" ? 0.45 : 1;
  const wire = mode === "wire";

  if (!grid) return <svg className={className} />;

  return (
    <svg
      ref={zoom.svgRef}
      className={className}
      style={{ touchAction: "none" }}
      viewBox={zoom.vbStr}
      preserveAspectRatio="xMidYMid meet"
      {...zoom.bind}
      onPointerMove={(e) => {
        if (dragRef.current) return onDragMove(e);
        zoom.bind.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        endDrag(e);
        zoom.bind.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        endDrag(e);
        zoom.bind.onPointerCancel(e);
      }}
    >
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#fff" onClick={() => onSelect(null)} />

      {/* ── THE WALL ── */}
      <rect x={0} y={Y(viewH)} width={wallLen} height={viewH} fill={WALL} onClick={() => onSelect(null)} />
      <g opacity={0.75} pointerEvents="none">
        {feats.map((f) => {
          const w = f.x1 - f.x0;
          const h = f.y1 - f.y0;
          const yTop = Y(f.y1);
          const cx = (f.x0 + f.x1) / 2;
          const cy = Y((f.y0 + f.y1) / 2);
          if (f.kind === "window") {
            const mull = Math.max(1, Math.round(w / 700));
            return (
              <g key={f.id}>
                <rect x={f.x0} y={yTop} width={w} height={h} fill={GLASS} stroke={GLASS_L} strokeWidth={8 * s} />
                {Array.from({ length: mull - 1 }, (_, k) => (
                  <line key={k} x1={f.x0 + (w * (k + 1)) / mull} y1={yTop} x2={f.x0 + (w * (k + 1)) / mull} y2={yTop + h} stroke={GLASS_L} strokeWidth={6 * s} />
                ))}
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={56 * s} fill={GLASS_L}>
                  {f.label}
                </text>
              </g>
            );
          }
          if (f.kind === "door" || f.kind === "opening") {
            return (
              <g key={f.id}>
                <rect x={f.x0} y={yTop} width={w} height={h} fill="#ffffff" stroke={DOORL} strokeWidth={8 * s} />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={56 * s} fill={DOORL}>
                  {f.label}
                </text>
              </g>
            );
          }
          if (f.kind === "heating") {
            const fins = Math.max(3, Math.round(w / 90));
            return (
              <g key={f.id}>
                <rect x={f.x0} y={yTop} width={w} height={h} rx={10} fill="#f2efe8" stroke={FITL} strokeWidth={6 * s} />
                {Array.from({ length: fins - 1 }, (_, k) => (
                  <line key={k} x1={f.x0 + (w * (k + 1)) / fins} y1={yTop + 20} x2={f.x0 + (w * (k + 1)) / fins} y2={yTop + h - 20} stroke={FITL} strokeWidth={5 * s} />
                ))}
              </g>
            );
          }
          return (
            <g key={f.id}>
              <rect x={f.x0} y={yTop} width={w} height={h} rx={8} fill="#ffffff" stroke={FITL} strokeWidth={6 * s} />
              {f.kind === "socket" ? (
                <>
                  <circle cx={cx - w * 0.16} cy={cy} r={Math.min(w, h) * 0.11} fill={FITL} />
                  <circle cx={cx + w * 0.16} cy={cy} r={Math.min(w, h) * 0.11} fill={FITL} />
                </>
              ) : (
                <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.28} fill="none" stroke={FITL} strokeWidth={5 * s} />
              )}
            </g>
          );
        })}
      </g>

      {/* ── ROW BANDS + ROW HEADERS ── */}
      {grid.rows.map((r, j) => {
        const y0 = ys[j];
        const y1 = ys[j + 1];
        const my = Y((y0 + y1) / 2);
        const isVoid = r.kind === "void";
        const label = rowLabel(grid, j);
        return (
          <g key={r.id}>
            <rect
              x={0}
              y={Y(y1)}
              width={wallLen}
              height={y1 - y0}
              fill={isVoid ? VOID_T : r.kind === "floor" ? BAND_A : BAND_B}
              fillOpacity={isVoid ? 0.3 : 0.45}
              onClick={() => onSelect(null)}
            />
            {label && (
              <text x={-GX + 40 * s} y={my - 60 * s} dominantBaseline="central" fontSize={70 * s} fontWeight={700} fill={HEAD}>
                {label}
              </text>
            )}
            {y1 - y0 > 80 && chip(-GX / 2 + 40 * s, my + (label ? 60 : 0) * s, dimText(y1 - y0), tapRow(j, y1 - y0))}
            {isVoid && y1 - y0 >= ROW_MIN + 50 && (
              <g
                onClick={(e) => {
                  e.stopPropagation();
                  onRowKind(j, "wall");
                }}
                style={{ cursor: "pointer" }}
              >
                <rect x={12} y={Y(y1) + 12} width={wallLen - 24} height={y1 - y0 - 24} rx={16} fill="none" stroke={EMPTY} strokeWidth={3 * s} strokeDasharray={`${18 * s} ${14 * s}`} />
                <text x={wallLen / 2} y={my} textAnchor="middle" dominantBaseline="central" fontSize={62 * s} fill={EMPTY}>
                  + ряд
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* ── THE LATTICE ── each band's own column lines, drawn WITHIN that band (not floor-to-ceiling
          any more — the bands are independent), plus the row boundaries. */}
      <g pointerEvents="none">
        {grid.rows.map((r, j) =>
          r.kind === "void"
            ? null
            : rowXs[j].map((x, i) => (
                <line key={`v${j}-${i}`} x1={x} y1={Y(ys[j + 1])} x2={x} y2={Y(ys[j])} stroke={GRID} strokeWidth={2 * s} />
              )),
        )}
        {ys.map((y, j) => (
          <line key={`h${j}`} x1={0} y1={Y(y)} x2={wallLen} y2={Y(y)} stroke={GRID} strokeWidth={2 * s} />
        ))}
      </g>

      {/* ── THE MODULES ── */}
      <g opacity={alpha}>
        {cells.map((rc) => {
          const runBases = cells.filter((cell) => cell.cab.kind === "base" && !cell.cab.corner);
          const isLeftmost = runBases.length > 0 && rc.id === runBases.reduce((leftmost, cell) => (cell.x < leftmost.x ? cell : leftmost)).id;
          const isRightmost = runBases.length > 0 && rc.id === runBases.reduce((rightmost, cell) => (cell.x > rightmost.x ? cell : rightmost)).id;
          const extLeft = (isLeftmost && rc.cab.kind === "base" && !rc.cab.corner) ? (pr?.revealStart ?? 0) : 0;
          const extRight = (isRightmost && rc.cab.kind === "base" && !rc.cab.corner) ? (pr?.revealEnd ?? 0) : 0;
          return (
            <g
              key={rc.id}
              transform={`translate(${rc.x} ${viewH}) scale(1 -1)`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(rc.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <g opacity={wire ? 0.25 : 1}>{moduleLocal(rc.cab, rc.band.y0, extLeft, extRight)}</g>
              {(wire || mode === "xray") && interiorLocal(rc.cab, rc.band.y0)}
            </g>
          );
        })}
      </g>

      {/* ── FILLER PANELS («доборы») ── a scribe strip in the reserved gap at each wall-butting end,
          labelled so the seller can point at it when explaining the price to the owner. */}
      <g opacity={alpha}>
        {fillers.map((f, i) => {
          const cx = f.x + f.w / 2;
          const cy = Y((f.y0 + f.y1) / 2);
          const label = f.horizontal ? f.w > 700 : f.y1 - f.y0 > 450;
          const rot = f.horizontal ? 0 : -90;
          const facadeColor = f.cab?.finish?.facade != null
            ? `#${f.cab.finish.facade.toString(16).padStart(6, "0")}`
            : C.facade;
          return (
            <g key={`fill${i}`}>
              <rect x={f.x} y={Y(f.y1)} width={f.w} height={f.y1 - f.y0} fill={facadeColor} stroke={C.facadeLine} strokeWidth={2 * s} />
              {label && (
                <text x={cx} y={cy} fontSize={42 * s} fill={C.dim} textAnchor="middle" dominantBaseline="central" transform={`rotate(${rot} ${cx} ${cy})`}>
                  Добор {f.horizontal ? ceiling - f.y0 : f.w}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* ── EMPTY CELLS ── tap → a module at the cell's size. On a corner reach strip that has a
          neighbour, the tap EXTENDS that neighbour into the corner instead (a chevron, not a "+"). */}
      {grid.rows.map((r, j) =>
        open[j]?.map((cell) => {
          const y0 = ys[j];
          const y1 = ys[j + 1];
          const cx = cell.x + cell.w / 2;
          const cy = Y((y0 + y1) / 2);
          const R = Math.min(90, cell.w / 3, (y1 - y0) / 3);
          const ci = r.cols.findIndex((c) => c.id === cell.c);
          const extend = reachAt(j, ci) === "extend";
          const endCorner = !!r.cols[ci + 1]?.dead; // chevron points toward the corner
          const dir = endCorner ? 1 : -1;
          return (
            <g
              key={`${r.id}-${cell.c}`}
              onClick={(e) => {
                e.stopPropagation();
                if (extend) onFillReach(r.id, ci);
                else onAddInCell({ c: cell.c, r: r.id, cs: cell.cs });
              }}
              style={{ cursor: "pointer" }}
            >
              <rect x={cell.x + 12} y={Y(y1) + 12} width={cell.w - 24} height={y1 - y0 - 24} rx={16} fill="#ffffff" fillOpacity={0.45} stroke={extend ? C.sel : EMPTY} strokeWidth={5 * s} strokeDasharray={`${26 * s} ${18 * s}`} />
              <circle cx={cx} cy={cy} r={R} fill="#fff" stroke={extend ? C.sel : EMPTY} strokeWidth={5 * s} />
              {extend ? (
                // a chevron pointing into the corner: "grow the neighbour this way"
                <polyline
                  points={`${cx - dir * R * 0.2},${cy - R * 0.42} ${cx + dir * R * 0.32},${cy} ${cx - dir * R * 0.2},${cy + R * 0.42}`}
                  fill="none" stroke={C.sel} strokeWidth={8 * s} strokeLinecap="round" strokeLinejoin="round"
                />
              ) : (
                <>
                  <line x1={cx - R * 0.45} y1={cy} x2={cx + R * 0.45} y2={cy} stroke={EMPTY} strokeWidth={7 * s} strokeLinecap="round" />
                  <line x1={cx} y1={cy - R * 0.45} x2={cx} y2={cy + R * 0.45} stroke={EMPTY} strokeWidth={7 * s} strokeLinecap="round" />
                </>
              )}
              <text x={cx} y={cy + R + 70 * s} textAnchor="middle" fontSize={58 * s} fill={extend ? C.sel : EMPTY}>
                {dimText(cell.w)}
              </text>
            </g>
          );
        }),
      )}

      {/* ── RETRACT a corner reach ── a cabinet already reaching into the corner gets a chevron
          pointing back out; tap to pull it out of the strip again. */}
      {grid.rows.map((r, j) =>
        r.kind === "void"
          ? null
          : r.cols.map((col, ci) => {
              if (reachAt(j, ci) !== "retract") return null;
              const endCorner = !!r.cols[ci + 1]?.dead;
              const dir = endCorner ? 1 : -1; // the cabinet is on the OTHER side, so point away from corner
              const cx = (rowXs[j][ci] + rowXs[j][ci + 1]) / 2;
              const cy = Y((ys[j] + ys[j + 1]) / 2);
              const R = Math.min(70 * s, (rowXs[j][ci + 1] - rowXs[j][ci]) / 2.4);
              return (
                <g
                  key={`rr${r.id}-${col.id}`}
                  onClick={(e) => { e.stopPropagation(); onFillReach(r.id, ci); }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={cx} cy={cy} r={R} fill="#fff" stroke={C.sel} strokeWidth={5 * s} opacity={0.95} />
                  <polyline
                    points={`${cx + dir * R * 0.2},${cy - R * 0.42} ${cx - dir * R * 0.32},${cy} ${cx + dir * R * 0.2},${cy + R * 0.42}`}
                    fill="none" stroke={C.sel} strokeWidth={7 * s} strokeLinecap="round" strokeLinejoin="round"
                  />
                </g>
              );
            }),
      )}

      {/* ── ADD A CORNER CABINET ── a wall band with a cleared inside corner but no corner unit yet
          (a deep row, or a row built from scratch) gets an L-icon in the corner square; tap to seat
          the L-shaped corner unit at this band's height. */}
      {grid.rows.map((r, j) => {
        if (r.kind !== "wall") return null;
        const xs = rowXs[j];
        const n = r.cols.length;
        const endDead = !!r.cols[n - 1]?.dead && !r.cols[n - 1]?.tall;
        const startDead = !!r.cols[0]?.dead && !r.cols[0]?.tall;
        if (!endDead && !startDead) return null; // no cleared corner on this wall → straight run
        // already turned this corner? (a corner unit overlaps this band by more than half)
        const bandH = ys[j + 1] - ys[j];
        const hasCorner = cells.some(
          (rc) => rc.cab.corner && Math.min(ys[j + 1], rc.band.y1) - Math.max(ys[j], rc.band.y0) > bandH * 0.5,
        );
        if (hasCorner) return null;
        const ci = endDead ? n - 1 : 0; // the dead corner square
        const cx = (xs[ci] + xs[ci + 1]) / 2;
        const cy = Y((ys[j] + ys[j + 1]) / 2);
        const R = Math.min(64 * s, (xs[ci + 1] - xs[ci]) / 2.6, bandH / 3.4);
        return (
          <g key={`ac${r.id}`} onClick={(e) => { e.stopPropagation(); onAddCorner(r.id); }} style={{ cursor: "pointer" }}>
            <rect x={xs[ci] + 10} y={Y(ys[j + 1]) + 10} width={xs[ci + 1] - xs[ci] - 20} height={bandH - 20} rx={14} fill="#fff" fillOpacity={0.4} stroke={C.sel} strokeWidth={5 * s} strokeDasharray={`${22 * s} ${15 * s}`} />
            {/* L-shape: the corner unit turning the corner */}
            <path d={`M ${cx - R * 0.55} ${cy - R * 0.55} L ${cx - R * 0.55} ${cy + R * 0.55} L ${cx + R * 0.55} ${cy + R * 0.55}`} fill="none" stroke={C.sel} strokeWidth={9 * s} strokeLinecap="round" strokeLinejoin="round" />
            <text x={cx} y={cy + R + 66 * s} textAnchor="middle" fontSize={52 * s} fill={C.sel}>
              угол
            </text>
          </g>
        );
      })}

      {/* ── CLASHES ── */}
      {cells
        .filter((rc) => L.clashing.has(rc.id))
        .map((rc) => (
          <rect key={`x${rc.id}`} x={rc.x} y={Y(rc.band.y1)} width={rc.w} height={rc.band.y1 - rc.band.y0} fill={RED} fillOpacity={0.18} stroke={RED} strokeWidth={9 * s} rx={8} pointerEvents="none" />
        ))}

      {/* selection */}
      {cells
        .filter((rc) => rc.id === selectedId)
        .map((rc) => (
          <rect key="sel" x={rc.x} y={Y(rc.band.y1)} width={rc.w} height={rc.band.y1 - rc.band.y0} fill="none" stroke={L.clashing.has(rc.id) ? RED : C.sel} strokeWidth={9 * s} rx={8} pointerEvents="none" />
        ))}

      {/* ── ROW BORDERS ── */}
      {grid.rows.slice(0, -1).map((r, j) => {
        const y = ys[j + 1];
        const active = drag?.kind === "row" && drag.j === j;
        const isCounter = r.kind === "floor";
        return (
          <g
            key={`rb${r.id}`}
            onPointerDown={startDrag((p) => ({ kind: "row", j, startMm: p.y, startH: ys[j + 1] - ys[j] }))}
            style={{ cursor: "ns-resize", touchAction: "none" }}
          >
            <rect x={0} y={Y(y) - 40 * s} width={wallLen} height={80 * s} fill="transparent" />
            <line x1={0} y1={Y(y)} x2={wallLen} y2={Y(y)} stroke={C.sel} strokeWidth={active ? 10 * s : isCounter ? 5 * s : 4 * s} strokeOpacity={active ? 1 : isCounter ? 1 : 0.5} strokeDasharray={isCounter ? undefined : `${20 * s} ${16 * s}`} />
            <circle cx={wallLen + 90 * s} cy={Y(y)} r={40 * s} fill={C.sel} opacity={active ? 1 : 0.8} />
          </g>
        );
      })}

      {/* ── COLUMN BORDERS ── per band. Drag the border and the columns past it IN THAT BAND absorb
          it. A locked column (the cleared corner zone) gets no handle — it is structural. */}
      {grid.rows.map((r, j) =>
        r.kind === "void"
          ? null
          : rowXs[j].slice(1, -1).map((x, k) => {
              const i = k;
              if (r.cols[i]?.lock) return null;
              const active = drag?.kind === "col" && drag.rowId === r.id && drag.i === i;
              return (
                <g
                  key={`cb${r.cols[i].id}`}
                  onPointerDown={startDrag((p) => ({ kind: "col", j, rowId: r.id, i, startMm: p.x, startW: r.cols[i].w }))}
                  style={{ cursor: "ew-resize", touchAction: "none" }}
                >
                  <rect x={x - 40 * s} y={Y(ys[j + 1])} width={80 * s} height={ys[j + 1] - ys[j]} fill="transparent" />
                  <line x1={x} y1={Y(ys[j + 1])} x2={x} y2={Y(ys[j])} stroke={C.sel} strokeWidth={active ? 10 * s : 5 * s} opacity={active ? 1 : 0.5} />
                  <rect x={x - 14 * s} y={Y(ys[j + 1]) + 14 * s} width={28 * s} height={90 * s} rx={14 * s} fill={C.sel} opacity={active ? 1 : 0.8} />
                </g>
              );
            }),
      )}

      {/* ── PER-BAND COLUMN WIDTHS + the "+" to add another cabinet to the band. The width chips sit
          just inside the top of each band; tapping one types an exact width. The "+" past the wall
          end adds a column, its width stolen from the widest cell in that band. */}
      {grid.rows.map((r, j) => {
        if (r.kind === "void") return null;
        const yTop = Y(ys[j + 1]) + 66 * s;
        return (
          <g key={`hd${r.id}`}>
            {r.cols.map((c, i) =>
              c.dead ? null : (
                <g key={`cw${c.id}`}>
                  {chip(
                    (rowXs[j][i] + rowXs[j][i + 1]) / 2,
                    yTop,
                    dimText(c.w),
                    c.lock ? undefined : tapCol(r.id, i, c.w),
                    cells.some((rc) => rc.id === selectedId && rc.x <= rowXs[j][i] + 1 && rc.x + rc.w >= rowXs[j][i + 1] - 1),
                  )}
                </g>
              ),
            )}
            {/* the column-count stepper for this band: + adds a cabinet on the end (all equalise),
                − drops the rightmost (the rest equalise). The − only shows when there is more than
                one cabinet-column to remove. */}
            {(() => {
              const cx = wallLen + 172 * s;
              const my = Y((ys[j] + ys[j + 1]) / 2);
              const R = 68 * s; // bigger tap targets — a thumb needs ~44px, and these sit at screen edge
              const gap = R + 46 * s; // clear air between + and − so neither is fat-fingered
              const fillable = r.cols.filter((c) => !c.lock).length;
              const twoBtn = fillable >= 2;
              const plusY = twoBtn ? my - gap : my;
              const arm = 32 * s;
              return (
                <>
                  <g onClick={(e) => { e.stopPropagation(); onAddCol(r.id); }} style={{ cursor: "pointer" }}>
                    <circle cx={cx} cy={plusY} r={R} fill="#fff" stroke={C.sel} strokeWidth={6 * s} />
                    <line x1={cx - arm} y1={plusY} x2={cx + arm} y2={plusY} stroke={C.sel} strokeWidth={9 * s} strokeLinecap="round" />
                    <line x1={cx} y1={plusY - arm} x2={cx} y2={plusY + arm} stroke={C.sel} strokeWidth={9 * s} strokeLinecap="round" />
                  </g>
                  {twoBtn && (
                    <g onClick={(e) => { e.stopPropagation(); onDropCol(r.id); }} style={{ cursor: "pointer" }}>
                      <circle cx={cx} cy={my + gap} r={R} fill="#fff" stroke={RED} strokeWidth={6 * s} />
                      <line x1={cx - arm} y1={my + gap} x2={cx + arm} y2={my + gap} stroke={RED} strokeWidth={9 * s} strokeLinecap="round" />
                    </g>
                  )}
                </>
              );
            })()}
          </g>
        );
      })}

      {/* floor line */}
      <line x1={-GX} y1={Y(0)} x2={wallLen + GR} y2={Y(0)} stroke="#5c6470" strokeWidth={6 * s} />
    </svg>
  );
}
