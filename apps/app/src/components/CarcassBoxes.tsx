// MERGING A ROW INTO ONE CARCASS — moved out of the module editor, where it could never work.
//
// A merged box is the workshop's economy build: a row of wall units made as ONE carcass (two outer
// sides, a shared stile at each internal boundary, one long top/bottom/back) instead of one box per
// cabinet. The FRONTS DO NOT MOVE — the client sees exactly the same kitchen — so this is not a
// design decision at all. It is a manufacturing one: it changes what gets sawn, what gets drilled,
// and what it costs, and nothing else.
//
// WHY IT COULDN'T LIVE IN THE MODULE EDITOR. A merged box is a property of a SET, and a per-cabinet
// toggle cannot show a set. You flipped a switch on one cabinet and three of its neighbours silently
// joined it; nothing anywhere told you which cabinets were now one box, or what you had bought by
// doing it. The question "which cabinets are combined?" simply had no answer on screen.
//
// So it belongs here, in Инженерия, next to the other production decisions — drawn as an elevation,
// where a box is a box you can see, and where the saving can be stated in the units a workshop
// actually counts: panels, holes, board.

import { useMemo } from "react";
import type { Cabinet } from "../model/cabinet";
import { resolveLayout, type Room } from "../model/resolve";
import { mergeCandidates, isMerged, seams, hangerSlots, hangersOn } from "../model/carcassGroups";
import { C } from "./elevationDraw";

const WALL = "#eef0f3";
const BODY = "#dfe3e8";
const BODY_M = "#cfe9dd"; // a member of a merged box
const EDGE = "#aab2bd";
const TXT = "#5c6470";
const CORNER = "#e8eaee"; // a corner unit: drawn, but never mergeable

// The card the SVG lives in, in CSS px. Handles are sized in SCREEN px and converted into the mm
// viewBox — otherwise a 40mm circle on a 4-metre wall renders as 3 pixels, and the bigger the
// kitchen the smaller the button, which is exactly backwards.
const CARD_PX_W = 340;
const CARD_PX_H = 260;

export interface CarcassBoxesProps {
  cabs: Cabinet[];
  room: Room;
  ceiling: number;
  /** tap a cabinet → merge its whole touching row, or break the box it is in (the one-tap case) */
  onToggle: (id: string) => void;
  /** tap a SEAM → join or split just that boundary. This is what lets you merge SOME of a row and
   *  leave the rest: a box is a maximal run of joined seams. */
  onSeam: (leftId: string, rightId: string) => void;
  /** put a hanger on this side panel, or take it off (pos = mm from the box's left edge) */
  onHangerAt: (id: string, pos: number) => void;
  /** put this box back on the workshop's standing rule */
  onHangersReset: (id: string) => void;
  /** the shop's standing rule, so the default can be computed and an override shown against it */
  hangRule: { per: number; spanMm: number };
}

/** One wall's elevation, drawn flat and read-only — this is not the constructor, and nothing here
 *  moves. The only thing you can do is decide which cabinets are built as one box. */
export function CarcassBoxes({ cabs, room, ceiling, onToggle, onSeam, onHangerAt, onHangersReset, hangRule }: CarcassBoxesProps) {
  const L = useMemo(() => resolveLayout(cabs, room), [cabs, room]);
  const allSeams = useMemo(() => seams(cabs), [cabs]);
  const walls = L.runs.map((r, i) => ({ r, i })).filter((e) => e.r.kind === "wall");

  return (
    <div className="cbx">
      {walls.map(({ i }) => {
        // EVERYTHING on the wall, corner units included. They used to be filtered out — and since a
        // corner unit is a real 840/613 body standing at the end of the run, the drawing came out with
        // a hole in it exactly where the biggest carcass in the kitchen was. A corner CANNOT be merged
        // (it is free-placed, its own diagonal body, and no side panel serves it and its neighbour),
        // so it is drawn as a box you cannot tap — which is itself the answer to "why can't I merge
        // this one".
        const cells = L.elevation(i).filter((rc) => !rc.cab.furniture);
        if (!cells.length) return null;
        const wallLen = L.wallLen(i);
        const H = Math.max(ceiling, ...cells.map((rc) => rc.band.y1));
        const Y = (mm: number) => H - mm;

        // ── SCREEN-SIZED HANDLES IN AN mm VIEWBOX ────────────────────────────────────────────
        // Everything in here is millimetres, and the SVG scales to fit the card — so a 40mm circle
        // on a 4-metre wall renders about THREE PIXELS. Handles have to be sized in screen px and
        // converted back, or they shrink as the kitchen gets bigger, which is precisely backwards.
        const VB_W = wallLen + 80;
        const VB_H = H + 180;
        const mmPerPx = Math.max(VB_W / CARD_PX_W, VB_H / CARD_PX_H); // whichever axis the fit binds on
        const px = (n: number) => n * mmPerPx; // screen px → viewBox mm

        // the merged boxes on this wall, so each can be drawn as ONE outlined body with a bracket
        const boxes = new Map<string, typeof cells>();
        for (const rc of cells) {
          const g = rc.cab.carcassGroup;
          if (!g) continue;
          boxes.set(g, [...(boxes.get(g) ?? []), rc]);
        }

        return (
          <div className="cbx-wall" key={i}>
            <div className="cbx-wall-lbl">{`Стена ${walls.findIndex((w) => w.i === i) + 1}`}</div>
            <svg viewBox={`-40 -90 ${wallLen + 80} ${H + 180}`} className="cbx-svg">
              <rect x={0} y={Y(H)} width={wallLen} height={H} fill={WALL} />

              {/* the modules. A member of a box is tinted, so "which cabinets are combined" is
                  answered by looking, not by tapping each one to find out. */}
              {cells.map((rc) => {
                const corner = !!rc.cab.corner;
                const merged = isMerged(rc.cab);
                const can = !corner && !merged && mergeCandidates(cabs, rc.cab).length > 1;
                const tappable = !corner && (merged || can);
                return (
                  <g key={rc.id} onClick={() => tappable && onToggle(rc.id)} style={{ cursor: tappable ? "pointer" : "default" }}>
                    <rect
                      x={rc.x}
                      y={Y(rc.band.y1)}
                      width={rc.w}
                      height={rc.band.y1 - rc.band.y0}
                      fill={merged ? BODY_M : corner ? CORNER : BODY}
                      stroke={EDGE}
                      strokeWidth={px(0.7)}
                      strokeDasharray={corner ? `${px(4)} ${px(3)}` : undefined}
                    />
                    <text x={rc.x + rc.w / 2} y={Y((rc.band.y0 + rc.band.y1) / 2)} textAnchor="middle" dominantBaseline="central" fontSize={px(7)} fill={TXT}>
                      {Math.round(rc.cab.w)}
                    </text>
                    {/* a corner says WHY it can't join a box, instead of just being un-tappable */}
                    {corner && rc.w > 400 && (
                      <text x={rc.x + rc.w / 2} y={Y((rc.band.y0 + rc.band.y1) / 2) + px(11)} textAnchor="middle" fontSize={px(6)} fill={EDGE}>
                        угловой
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── THE SEAMS ── the real unit of control.
                  The boundary between two neighbours is either a SHARED STILE (one box runs through
                  it) or TWO SIDE PANELS (two boxes butt). That is a per-boundary fact, so it gets a
                  per-boundary switch — and "merge these two but not that one" falls out for free.
                  A solid tie = joined. A dashed one = two boxes; tap to join them. */}
              {allSeams
                .filter((sm) => cells.some((rc) => rc.id === sm.left.id) && cells.some((rc) => rc.id === sm.right.id))
                .map((sm) => {
                  const l = cells.find((rc) => rc.id === sm.left.id)!;
                  const x = l.x + l.w;
                  const yc = Y((l.band.y0 + l.band.y1) / 2);
                  return (
                    <g key={`${sm.left.id}|${sm.right.id}`} onClick={() => onSeam(sm.left.id, sm.right.id)} style={{ cursor: "pointer" }}>
                      <rect x={x - px(22)} y={Y(l.band.y1)} width={px(44)} height={l.band.y1 - l.band.y0} fill="transparent" />
                      <circle cx={x} cy={yc} r={px(13)} fill="#fff" stroke={sm.joined ? C.sel : EDGE} strokeWidth={px(1.6)} />
                      {sm.joined ? (
                        <line x1={x - px(6)} y1={yc} x2={x + px(6)} y2={yc} stroke={C.sel} strokeWidth={px(2)} strokeLinecap="round" />
                      ) : (
                        <>
                          <line x1={x - px(6)} y1={yc} x2={x + px(6)} y2={yc} stroke={EDGE} strokeWidth={px(1.7)} strokeLinecap="round" />
                          <line x1={x} y1={yc - px(6)} x2={x} y2={yc + px(6)} stroke={EDGE} strokeWidth={px(1.7)} strokeLinecap="round" />
                        </>
                      )}
                    </g>
                  );
                })}

              {/* THE BOX ITSELF — one heavy outline around the whole group, plus a bracket under it
                  carrying its total width. This is the drawing the workshop would make, and it is
                  the answer to "which cabinets are one carcass". */}
              {[...boxes.values()].map((box) => {
                const x0 = Math.min(...box.map((rc) => rc.x));
                const x1 = Math.max(...box.map((rc) => rc.x + rc.w));
                const y0 = Math.min(...box.map((rc) => rc.band.y0));
                const y1 = Math.max(...box.map((rc) => rc.band.y1));
                const by = Y(y0) + px(9);
                return (
                  <g key={box[0].cab.carcassGroup} pointerEvents="none">
                    <rect x={x0 - px(2)} y={Y(y1) - px(2)} width={x1 - x0 + px(4)} height={y1 - y0 + px(4)} fill="none" stroke={C.sel} strokeWidth={px(2.4)} rx={px(3)} />
                    <line x1={x0} y1={by} x2={x1} y2={by} stroke={C.sel} strokeWidth={px(1.4)} />
                    {[x0, x1].map((x) => (
                      <line key={x} x1={x} y1={by - px(4)} x2={x} y2={by + px(4)} stroke={C.sel} strokeWidth={px(1.4)} />
                    ))}
                    <g>
                      <rect x={(x0 + x1) / 2 - px(30)} y={by + px(6)} width={px(60)} height={px(19)} rx={px(5)} fill={C.sel} />
                      <text x={(x0 + x1) / 2} y={by + px(19)} textAnchor="middle" fontSize={px(11)} fontWeight={700} fill="#fff">
                        {`${box.length} × → ${Math.round(x1 - x0)}`}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* ── НАВЕСЫ ── WHICH SIDE PANELS carry one.
                  A навес is a bracket screwed to the top rear corner of a side panel, so a box of N
                  cabinets has exactly N+1 places one can go: the two outer sides and the internal
                  stiles. "That 4-bay row hangs on two" is therefore a statement about POSITIONS, not
                  a number — and it is the positions the fitter needs. Tap a panel to hang there.
                  The shop's rule (Настройки) is the default; a box the seller has decided for says
                  so, and offers the way back. Wall units only — a base stands on the floor. */}
              {[...boxGroups(cells)].map(([key, box]) => {
                if (box[0].cab.kind !== "upper") return null;
                const members = box.map((rc) => rc.cab);
                const x0 = Math.min(...box.map((rc) => rc.x));
                const y1 = Math.max(...box.map((rc) => rc.band.y1));
                const slots = hangerSlots(members);
                const on = hangersOn(members, hangRule.per, hangRule.spanMm);
                const custom = members[0].hangPos != null;
                const ty = Y(y1) - px(9); // just above the box's top edge — where a навес actually sits
                return (
                  <g key={`h${key}`}>
                    {slots.map((sx) => {
                      const hung = on.includes(sx);
                      const cx = x0 + sx;
                      return (
                        <g key={sx} onClick={() => onHangerAt(members[0].id, sx)} style={{ cursor: "pointer" }}>
                          {/* a 44px finger target, whatever the wall's length does to the scale */}
                          <rect x={cx - px(22)} y={ty - px(22)} width={px(44)} height={px(44)} fill="transparent" />
                          <circle cx={cx} cy={ty} r={px(14)} fill={hung ? C.sel : "#fff"} stroke={hung ? C.sel : EDGE} strokeWidth={px(1.7)} />
                          {hung && <path d={`M ${cx - px(6)} ${ty + px(2)} L ${cx} ${ty - px(5)} L ${cx + px(6)} ${ty + px(2)} Z`} fill="#fff" />}
                        </g>
                      );
                    })}
                    {custom && (
                      <g onClick={() => onHangersReset(members[0].id)} style={{ cursor: "pointer" }}>
                        <rect x={x0 - px(52)} y={ty - px(10)} width={px(40)} height={px(20)} rx={px(5)} fill="#fff" stroke={C.sel} strokeWidth={px(1.4)} />
                        <text x={x0 - px(32)} y={ty + px(6)} textAnchor="middle" fontSize={px(11)} fontWeight={700} fill={C.sel}>
                          {`⌂ ${on.length}`}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** Every BOX on this wall: a merged group, or a lone cabinet (which is a box of one). Hangers are
 *  fitted per box, so this is the unit the hanger control has to work on. */
function boxGroups<T extends { id: string; cab: Cabinet }>(cells: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const rc of cells) {
    const key = rc.cab.carcassGroup ?? rc.id;
    out.set(key, [...(out.get(key) ?? []), rc]);
  }
  return out;
}

/** The cabinets that WOULD form a box if you tapped this one — used for the "nothing merged yet"
 *  hint, so an untouched kitchen still tells you there is something here worth doing. */
export function mergeableRows(cabs: Cabinet[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const c of cabs) {
    if (seen.has(c.id) || isMerged(c)) continue;
    const row = mergeCandidates(cabs, c);
    if (row.length < 2) continue;
    row.forEach((m) => seen.add(m.id));
    n++;
  }
  return n;
}

/** How many boxes are merged right now, and how many cabinets they swallow. */
export function mergedSummary(cabs: Cabinet[]): { boxes: number; cabs: number } {
  const groups = new Set<string>();
  let n = 0;
  for (const c of cabs) {
    if (!c.carcassGroup) continue;
    groups.add(c.carcassGroup);
    n++;
  }
  return { boxes: groups.size, cabs: n };
}
