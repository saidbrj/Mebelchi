// ПОЛИГОН · the wall, drawn from the engine.
//
// Every rectangle here is a BOARD the engine derived — `deriveBoards` output, at its true extent
// and true thickness. The drawing is not a picture of the wall, it is a picture of the cut list.
// If a board is the wrong length on screen, the cut list is wrong too, and that is the point.
//
// Two interactions, both of them laws:
//
//   L11 · dragging a line asks `legalDomain` ONCE at pointer-down and shades the legal range. The
//         line stops dead at the edge — a visible hard stop, which is neither silent clamping nor
//         refusal-after-the-fact.
//   L13 · nothing is attempted before it is known to be legal, so a drag can never produce a
//         refusal. Any refusal that does appear is therefore a UI bug, and the panel counts them.

import { useMemo, useRef, useState } from "react";
import {
  facesOf, linesOn, resolvePositions, thicknessMm,
  type LineId, type Sheet, type SheetProfile,
} from "./model/sheet";
import { resolveJunctions, type Junction } from "./model/junctions";
import { deriveBoards, type Board } from "./model/runs";
import { legalDomain, type Op } from "./model/ops";
import { drawnThicknessMm, strokePx, type View } from "./model/render";

const PAD = 190; // mm of margin around the opening, in model units

export type Selection =
  | { kind: "board"; id: string }
  | { kind: "junction"; v: LineId; h: LineId }
  | null;

const ROLE_FILL: Record<string, string> = {
  side: "#cfc6b4",
  top: "#d8d0bf",
  bottom: "#d8d0bf",
  shelf: "#ddd6c6",
  worktop: "#8b8378",
  front: "#e7ddc9",
  plinth: "#cdc6bb",
};

export function SheetView({
  sheet, profile, selection, onSelect, onOp, mode,
}: {
  sheet: Sheet;
  profile: SheetProfile;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onOp: (op: Op) => void;
  mode: "real" | "wire" | "parts";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ line: LineId; min: number; max: number; at: number } | null>(null);

  const { mm } = useMemo(() => resolvePositions(sheet), [sheet]);
  const { junctions } = useMemo(() => resolveJunctions(sheet, sheet.junctionOverrides ?? []), [sheet]);
  const boards = useMemo(() => deriveBoards(sheet, profile, junctions), [sheet, profile, junctions]);

  const W = sheet.opening.width, H = sheet.opening.height;
  /** model mm → svg: x unchanged, y flipped so the floor is at the bottom */
  const Y = (mmY: number) => H - mmY;

  const vLines = linesOn(sheet, "v", mm);
  const wire = mode === "wire";
  // L-STROKE — the design view may floor a thin panel to keep it visible; the parts view is true
  // scale and says so. Both ask the same function, and it refuses to inflate for the second.
  const view: View = mode === "parts" ? "parts" : "design";
  const mmPerPx = (W + PAD * 2) / 900; // the pane is ~900 CSS px wide at the bench's default size

  // ── dragging a vertical line ────────────────────────────────────────────────────────────────

  /** Screen point → model millimetres, via the SVG's own transform.
   *
   *  The first version divided the viewBox width by the element width, which is wrong whenever the
   *  two aspect ratios differ: `preserveAspectRatio` fits the viewBox and letterboxes the rest, so
   *  the real scale came from the HEIGHT and there was an unaccounted x-offset. The drag stopped
   *  9mm short of the legal minimum — the engine said 158, the UI stopped at 167. `getScreenCTM`
   *  knows about fitting, centring and padding, so it cannot drift out of step with the layout. */
  const toModelX = (clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return 0;
    return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse()).x;
  };

  const startDrag = (e: React.PointerEvent, line: LineId) => {
    e.stopPropagation();
    const d = legalDomain(sheet, { kind: "move-line", line, toMm: 0 }, profile);
    if (d.kind !== "range") return; // not movable here — the UI simply offers no handle
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    setDrag({ line, min: d.min, max: d.max, at: mm.get(line)! });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const raw = toModelX(e.clientX, e.clientY);
    // the hard stop: the line will not go past the edge, and the edge is drawn
    setDrag({ ...drag, at: Math.max(drag.min, Math.min(drag.max, Math.round(raw))) });
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.at !== mm.get(drag.line)) onOp({ kind: "move-line", line: drag.line, toMm: drag.at });
    setDrag(null);
  };

  const posOf = (id: LineId) => (drag && drag.line === id ? drag.at : mm.get(id)!);

  return (
    <svg
      ref={svgRef}
      className="pg-canvas"
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClick={() => onSelect(null)}
    >
      {/* the opening — the wall is an opening, and the outer faces bound it (L15) */}
      <rect x={0} y={0} width={W} height={H} fill={wire ? "#fff" : "#f2efe9"} stroke="#b9b2a5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={-40} y1={Y(0)} x2={W + 40} y2={Y(0)} stroke="#1a1a1a" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />

      {/* blocks, faintly — Void reads as hatch so "empty" never looks like "missing" */}
      {sheet.blocks.filter((b) => b.layer === "carcass").map((b) => {
        const x0 = posOf(b.bounds.v0), x1 = posOf(b.bounds.v1);
        const y0 = mm.get(b.bounds.h0)!, y1 = mm.get(b.bounds.h1)!;
        return (
          <g key={b.id}>
            <rect
              x={x0} y={Y(y1)} width={x1 - x0} height={y1 - y0}
              fill={b.kind === "void" ? "url(#pgVoid)" : b.kind === "reserved" ? "#e6dfd0" : "transparent"}
              stroke="none"
            />
            <text x={(x0 + x1) / 2} y={Y(y0) - 26} textAnchor="middle" className="pg-svg-block">{b.id}</text>
          </g>
        );
      })}

      {/* the boards — this is the cut list, drawn */}
      {boards.map((bd) => {
        const t = drawnThicknessMm(view, bd.thicknessMm, mmPerPx);
        const centre = posOf(bd.line);
        const sel = selection?.kind === "board" && selection.id === bd.id;
        // a two-board pair sits either side of the centreline; a single board straddles it
        const off = bd.panel === 0 ? -t : 0;
        const f = facesOf(centre, t);

        const geom = bd.axis === "v"
          ? { x: (bd.covers[0]!.boards === 2 ? centre + off : f.low), y: Y(bd.to), width: t, height: bd.lengthMm }
          : { x: bd.from, y: Y(mm.get(bd.line)!) - t / 2, width: bd.lengthMm, height: t };

        return (
          <rect
            key={bd.id}
            {...geom}
            className={sel ? "pg-board-sel" : "pg-board-hit"}
            fill={wire ? "#fff" : (ROLE_FILL[bd.role] ?? "#d5cec0")}
            stroke={sel ? "#00ac7a" : "#1a1a1a"}
            strokeWidth={sel ? 3 : strokePx(view)}
            vectorEffect="non-scaling-stroke"
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: "board", id: bd.id }); }}
          />
        );
      })}

      {/* junctions — coloured by WHICH TIER decided them, so the rule is visible before you tap */}
      {junctions.map((j) => {
        const sel = selection?.kind === "junction" && selection.v === j.v && selection.h === j.h;
        const fill = j.by === "override" ? "#d8a12a" : j.by === "spanning" ? "#8e5cd9" : j.by === "tie" ? "#e53935" : "#00ac7a";
        return (
          <circle
            key={`${j.v}|${j.h}`}
            cx={posOf(j.v)} cy={Y(mm.get(j.h)!)} r={sel ? 78 : 55}
            fill={fill} fillOpacity={sel ? 1 : 0.85} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke"
            className="pg-junction"
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: "junction", v: j.v, h: j.h }); }}
          />
        );
      })}

      {/* L11 — the legal range, shaded, with its two hard stops drawn */}
      {drag && (
        <g pointerEvents="none">
          <rect x={drag.min} y={-PAD} width={drag.max - drag.min} height={H + PAD * 2} fill="#00ac7a" fillOpacity={0.07} />
          {[drag.min, drag.max].map((x) => (
            <line key={x} x1={x} y1={-PAD} x2={x} y2={H + PAD} stroke="#00ac7a" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="10 7" />
          ))}
          <text x={drag.at} y={-105} textAnchor="middle" className="pg-svg-dim">{drag.at} мм</text>
          <text x={drag.min} y={H + 135} textAnchor="middle" className="pg-svg-stop">{drag.min}</text>
          <text x={drag.max} y={H + 135} textAnchor="middle" className="pg-svg-stop">{drag.max}</text>
        </g>
      )}

      {/* Drag handles live in a RULER STRIP above the wall, not over it.
          The first version ran a full-height invisible rect down each line, which sat on top of
          every junction dot on that line and swallowed the tap — you could not select a junction
          that lay on a vertical, which is most of them. A dedicated gutter separates "grab a line"
          from "inspect a thing", and being visible makes it discoverable rather than a secret. */}
      <g className="pg-ruler">
        <line
          x1={-40} y1={-95} x2={W + 40} y2={-95}
          stroke="#c9c2b4" strokeWidth={1} vectorEffect="non-scaling-stroke"
        />
        {vLines.map((l) => (
          <g key={`h-${l.id}`} onPointerDown={(e) => startDrag(e, l.id)} className="pg-handle">
            <rect x={posOf(l.id) - 70} y={-175} width={140} height={150} fill="transparent" />
            <rect
              x={posOf(l.id) - 26} y={-140} width={52} height={78} rx={22}
              fill={drag?.line === l.id ? "#00ac7a" : "#b9b2a5"}
            />
          </g>
        ))}
      </g>

      <defs>
        <pattern id="pgVoid" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="34" stroke="#c9c2b4" strokeWidth="4" />
        </pattern>
      </defs>
    </svg>
  );
}

export type { Board, Junction };
