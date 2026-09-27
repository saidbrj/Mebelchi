// ПОЛИГОН · R69 — the App-1 ⇄ App-2 boundary: the Port–Envelope contract.
//
// THE PROBLEM, stated as the research states it. App 2 authors the inside of a cabinet: shelf
// heights, drawer rails, pull-out baskets. App 1 authors the wall. If every internal shelf became
// a global line on the wall, a nine-cabinet kitchen would carry several hundred global tracks and
// every drag would have to consider all of them. That is Hypothesis A, and R69 §1 kills it on
// cardinality alone.
//
// But the opposite — sealing the cabinet completely — walks straight into the founder's own case:
// a base cabinet SHARES its 2400mm side board with the pantry beside it. How does a sealed box
// share a board with its neighbour?
//
// THE ANSWER: the shared board never belonged to either cabinet. It belongs to the WALL.
//
// A Type instance exposes exactly two things to the host: an ENVELOPE (its outer box) and a PORT
// MAP (five faces, each declaring who owns the panel there). Nothing else crosses. The host runs
// arbitration over the ports, decides which faces produce a shared panel, and hands each cabinet
// back a single number per face: how far in its own interior must start. The pantry's shelves then
// begin at local x = 18 and the pantry still knows nothing about the base cabinet.
//
// THE ISOLATION INVARIANT (R69 §3), which is the whole contract in one line:
//
//   > A local segment with no portBinding is permanently invisible to the host layout engine.
//
// It is enforced here by `hostVisible`, and there is a test that the host's track count does not
// move when a cabinet's interior is filled with shelves.

import type { LineId } from "./sheet";
import type { Role } from "./roles";

// ─── the envelope ─────────────────────────────────────────────────────────────────────────────

/** The outer box a Type occupies in HOST coordinates. Depth is carried but never projected onto
 *  the wall track — the wall is an elevation, and depth is the dimension it cannot hold. */
export interface Envelope {
  x: number;
  /** bottom edge, floor = 0 */
  y: number;
  w: number;
  h: number;
  d: number;
}

// ─── ports ────────────────────────────────────────────────────────────────────────────────────

export type PortFace = "LEFT" | "RIGHT" | "TOP" | "BOTTOM" | "BACK";

export type PortSharing =
  /** participates in arbitration — if the neighbour also says SHARED, one board serves both */
  | "SHARED"
  /** this Type owns and generates the panel on this face */
  | "FIXED"
  /** no panel at all; an open shelf unit's side */
  | "OPEN"
  /** abuts a wall, the floor or the ceiling — the host bounds it, nothing is generated */
  | "HOST_BOUND";

export interface Port {
  face: PortFace;
  sharing: PortSharing;
  /** what this Type would contribute if it ends up owning the panel */
  nominalThickness: number;
  /** set by the host at placement, never by the Type */
  hostSegmentRef?: LineId;
}

export type PortMap = Partial<Record<PortFace, Port>>;

// ─── the sub-sheet ────────────────────────────────────────────────────────────────────────────

/** A segment inside a cabinet. Its coordinates are LOCAL — origin at the envelope's bottom-left. */
export interface LocalSegment {
  id: string;
  role: Role;
  axis: "v" | "h";
  /** position on the local track */
  at: number;
  from: number;
  to: number;
  thicknessMm: number;
  /** Set ONLY when this segment IS a port face. Everything else is invisible to the host, and
   *  that invisibility is the contract rather than an optimisation. */
  portBinding?: PortFace;
}

export interface SubSheet {
  localTracks: { h: number[]; v: number[] };
  localSegments: LocalSegment[];
  /** Written by arbitration: how far in this cabinet's interior starts on each face, because a
   *  shared panel stands in its doorway. The cabinet reads this; it never reads its neighbour. */
  inset: Partial<Record<PortFace, number>>;
}

export interface TypeInstance {
  id: string;
  typeId: string;
  envelope: Envelope;
  ports: PortMap;
  subSheet: SubSheet;
}

/** R69 §3 — the one question the host is allowed to ask about a local segment. */
export const hostVisible = (s: LocalSegment): boolean => s.portBinding !== undefined;

// ─── arbitration ──────────────────────────────────────────────────────────────────────────────

export interface SharedPanel {
  id: string;
  /** always HOST. The board is the wall's, which is the insight the whole contract turns on. */
  owner: "HOST";
  x: number;
  yBottom: number;
  yTop: number;
  thicknessMm: number;
  leftType: string;
  rightType: string;
}

export interface PortProblem {
  law: string;
  detail: string;
  between: [string, string];
}

export interface Arbitration {
  panels: SharedPanel[];
  /** per instance id, per face — how far in that cabinet's interior must start */
  insets: Map<string, Partial<Record<PortFace, number>>>;
  problems: PortProblem[];
}

const TOL = 0.5;

/** R69 §4.1 — run once after placement. Pure: it reports insets rather than writing into the
 *  instances, so the same placement always arbitrates the same way and nothing is order-dependent. */
export function arbitratePorts(instances: TypeInstance[]): Arbitration {
  const panels: SharedPanel[] = [];
  const problems: PortProblem[] = [];
  const insets = new Map<string, Partial<Record<PortFace, number>>>(
    instances.map((i) => [i.id, {}]),
  );

  const put = (id: string, face: PortFace, mm: number) => {
    const cur = insets.get(id) ?? {};
    cur[face] = mm;
    insets.set(id, cur);
  };

  const sorted = [...instances].sort((a, b) => a.envelope.x - b.envelope.x);

  for (let i = 0; i < sorted.length - 1; i++) {
    const L = sorted[i]!, R = sorted[i + 1]!;
    if (Math.abs(L.envelope.x + L.envelope.w - R.envelope.x) > TOL) continue;

    const lp = L.ports.RIGHT, rp = R.ports.LEFT;
    if (!lp || !rp) continue;

    // vertical overlap — a base beside a pantry shares only over the base's height
    const yBottom = Math.max(L.envelope.y, R.envelope.y);
    const yTop = Math.min(L.envelope.y + L.envelope.h, R.envelope.y + R.envelope.h);
    if (yTop - yBottom < TOL) continue;

    if (lp.sharing === "SHARED" && rp.sharing === "SHARED") {
      // ONE board, and it is the wall's. Both cabinets step their interiors back by its thickness.
      const thicknessMm = Math.max(lp.nominalThickness, rp.nominalThickness);
      panels.push({
        id: `shared:${L.id}|${R.id}`, owner: "HOST",
        x: L.envelope.x + L.envelope.w, yBottom, yTop, thicknessMm,
        leftType: L.id, rightType: R.id,
      });
      put(L.id, "RIGHT", thicknessMm);
      put(R.id, "LEFT", thicknessMm);
      continue;
    }

    if (lp.sharing === "FIXED" && rp.sharing !== "FIXED") {
      // L generates the board itself; R simply starts that much further in
      put(R.id, "LEFT", lp.nominalThickness);
      continue;
    }
    if (rp.sharing === "FIXED" && lp.sharing !== "FIXED") {
      put(L.id, "RIGHT", rp.nominalThickness);
      continue;
    }
    if (lp.sharing === "FIXED" && rp.sharing === "FIXED") {
      // two boards back to back. Legal, and worth a word: it is 32mm of material where 16 would
      // hold, and it is almost always someone forgetting to declare SHARED.
      problems.push({
        law: "R69-BACKTOBACK",
        detail:
          `${L.id} and ${R.id} both declare FIXED where they meet — two boards back to back, ` +
          `${lp.nominalThickness + rp.nominalThickness}mm of material. Deliberate for a module ` +
          `boundary, waste if not.`,
        between: [L.id, R.id],
      });
      continue;
    }
    // OPEN or HOST_BOUND on either side: no panel is generated here, and nothing to say
  }

  return { panels, insets, problems };
}

/** R69 §6 — what the host's track count actually is. The point of the whole contract: it counts
 *  envelope edges and shared panels, and never once looks inside a sub-sheet. */
export function hostTracks(instances: TypeInstance[], panels: SharedPanel[]): number[] {
  const xs = new Set<number>();
  for (const i of instances) { xs.add(i.envelope.x); xs.add(i.envelope.x + i.envelope.w); }
  for (const p of panels) xs.add(p.x);
  return [...xs].sort((a, b) => a - b);
}

// ─── correction 3 · the front layer's own overhang ────────────────────────────────────────────
//
// The founder's handleless upper door: its bottom edge hangs 35mm BELOW the carcass so a hand can
// get under it. The obvious attempt — a global line at y = −35 — was refused by the engine, and
// the refusal was right: lines are GLOBAL (L5), so that line adds a row to the whole wall and the
// strip from −35 to 0 belongs to no block. L3 called it what it is: a hole, not a Void.
//
// An overhang is not a wall coordinate. It is the front's own geometry, and it lives here, local
// to the front layer, where it cannot touch the host track at all.

export interface Overlay {
  /** mm the front extends PAST the carcass on each side. Positive = further out. */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface FrontBoard {
  /** the carcass opening this front covers */
  cell: { x: number; y: number; w: number; h: number };
  overlay: Overlay;
  /** the finished front, after the overhang — what gets cut */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A front's finished size = its cell plus whatever it overhangs on each side. Pure arithmetic on
 *  the front layer, producing NO line and touching NO track. */
export function frontBoard(cell: FrontBoard["cell"], overlay: Overlay): FrontBoard {
  const t = overlay.top ?? 0, b = overlay.bottom ?? 0;
  const l = overlay.left ?? 0, r = overlay.right ?? 0;
  return {
    cell, overlay,
    x: cell.x - l,
    y: cell.y - b,
    w: cell.w + l + r,
    h: cell.h + t + b,
  };
}

export interface ClearanceProblem {
  law: string;
  detail: string;
}

/** R69 correction 3, second half. A door hanging 35mm below an upper cabinet is hanging INTO the
 *  splash zone, and if the worktop is close enough it will foul it. The check belongs here, beside
 *  the overhang that causes it. */
export function overhangClearance(
  front: FrontBoard, obstacleTopMm: number, minClearanceMm: number,
): ClearanceProblem[] {
  const gap = front.y - obstacleTopMm;
  if (gap >= minClearanceMm) return [];
  return [{
    law: "R69-CLEARANCE",
    detail:
      `the front hangs to ${front.y}mm and the obstacle below reaches ${obstacleTopMm}mm — ` +
      `${Math.round(gap)}mm of gap where ${minClearanceMm}mm is the minimum. ` +
      `Reduce the overhang or raise the cabinet.`,
  }];
}

// ─── correction 1 · the corner reservation is PER BAND ────────────────────────────────────────
//
// R72 reserves a column on wall A for the depth of wall B, so a line on A cannot run into the
// corner that B occupies. The red-team found the flaw, and it is fatal for L-shaped kitchens:
// a base run is 560–600 deep, a wall run is 300–350. Reserve one 600mm column for the full height
// and the upper tier gets a 280mm hole between the corner and the first wall cabinet — there is
// nowhere to put a cabinet and nowhere for the hole to go.
//
// So the reservation has the shape of a STAIRCASE, not a rectangle: it is computed per height
// band, from the depth that band actually uses. The depths come from the profile, as everything
// does; nothing here names a band or picks a number.

export interface ReservedSlice {
  band: string;
  /** mm from floor */
  fromMm: number;
  /** mm from floor; undefined = to the ceiling */
  toMm?: number;
  /** how far into this wall the neighbour reaches at this height */
  depthMm: number;
}

export interface CornerReservation {
  /** the wall being reserved INTO */
  wall: string;
  /** the neighbour whose depth is being reserved */
  neighbour: string;
  /** which end of this wall the corner is at */
  at: "start" | "end";
  slices: ReservedSlice[];
  /** widest slice — the only number a naive implementation would have kept, and the bug */
  maxDepthMm: number;
}

/** Build the staircase. `bandDepths` and `bands` both come from the profile; `handleGapMm` is the
 *  clearance a door needs to open past the corner without catching the neighbour's front. */
export function reserveCorner(
  wall: string, neighbour: string, at: "start" | "end",
  bands: { id: string; hi?: number }[],
  bandDepths: { band: string; mm: number }[],
  handleGapMm: number,
): CornerReservation {
  const slices: ReservedSlice[] = [];
  let from = 0;

  for (const b of bands) {
    const depth = bandDepths.find((d) => d.band === b.id)?.mm;
    // a band nothing is mounted in (the plinth, the splash zone) reserves nothing — and saying
    // so beats reserving the band above's depth through a void
    if (depth !== undefined) {
      slices.push({ band: b.id, fromMm: from, ...(b.hi !== undefined ? { toMm: b.hi } : {}), depthMm: depth + handleGapMm });
    }
    if (b.hi === undefined) break;
    from = b.hi;
  }

  return {
    wall, neighbour, at, slices,
    maxDepthMm: slices.reduce((m, s) => Math.max(m, s.depthMm), 0),
  };
}

/** How far into this wall the corner reaches AT A GIVEN HEIGHT. This is the function a drag guard
 *  asks, and asking it per height is the whole correction: at 1600mm the answer is 350, not 650. */
export function reservedAt(r: CornerReservation, mmFromFloor: number): number {
  for (const s of r.slices) {
    if (mmFromFloor >= s.fromMm && mmFromFloor <= (s.toMm ?? Infinity)) return s.depthMm;
  }
  return 0;
}

// ─── жизненный цикл порта: способность → решение ──────────────────────────────────────────────
//
// ПАРАДОКС, который нашёл основатель. В App 2 рисуют тумбу и объявляют ей `LEFT: SHARED`. Потом в
// App 1 ставят её ПЕРВОЙ у входа в кухню — соседа слева нет, панель делить не с кем, и никто её
// не делает. Тумба уезжает с дырой в боку, а ящики торчат в коридор.
//
// Проверено на трёх шкафах в ряд: крайние получили НОЛЬ на внешних гранях, и ни одна панель там
// не родилась. Это был настоящий дефект, а не гипотеза.
//
// ПРИЧИНА. `sharing` смешивал две разные вещи: что шкаф УМЕЕТ и что на стене РЕШЕНО. Первое знает
// App 2, второе — только App 1, потому что только стена видит соседей.
//
// РАЗДЕЛЕНИЕ:
//   App 2 объявляет СПОСОБНОСТЬ:  «мой левый бок каркасный, я МОГУ делиться, если прижмут»
//   App 1 принимает РЕШЕНИЕ:      сосед умеет делиться → SHARED
//                                 соседа нет → FIXED, шкаф делает бок сам
//                                 мастер тапнул по шву → как сказал мастер
//
// Шкаф из App 2 после этого безопасен в любом месте ряда: с краю он всегда получает свой бок.

/** Что Тип объявляет о грани в App 2. Это СПОСОБНОСТЬ, а не решение. */
export interface PortCapability {
  face: PortFace;
  /** может ли грань стать общей, если рядом окажется сосед */
  canShare: boolean;
  /** что грань даст, если делить не с кем */
  nominalThickness: number;
  /** грань без панели вообще — открытая ниша */
  open?: boolean;
}

/** Решение мастера по конкретному шву. Тап по стыку на экране. */
export interface SeamOverride {
  /** между какими двумя экземплярами */
  between: [string, string];
  /** общая доска · два корпуса спиной к спине · открытый проём */
  to: "shared" | "split" | "open";
}

export interface ResolvedPorts {
  instances: TypeInstance[];
  /** что и почему решено на каждой грани — для инспектора и для отказов */
  decisions: {
    instance: string; face: PortFace; sharing: PortSharing;
    by: "neighbour" | "edge" | "override" | "declared-open";
  }[];
}

/**
 * App 1 превращает способности в решения. Единственное место, где это происходит, и единственное,
 * которое видит соседей.
 */
export function resolvePorts(
  instances: (Omit<TypeInstance, "ports"> & { caps: Partial<Record<PortFace, PortCapability>> })[],
  overrides: SeamOverride[] = [],
): ResolvedPorts {
  const sorted = [...instances].sort((a, b) => a.envelope.x - b.envelope.x);
  const decisions: ResolvedPorts["decisions"] = [];

  /** кто стоит вплотную к этой грани */
  const neighbourOf = (i: number, face: "LEFT" | "RIGHT") => {
    const me = sorted[i]!;
    const j = face === "LEFT" ? i - 1 : i + 1;
    const other = sorted[j];
    if (!other) return undefined;
    const touching = face === "LEFT"
      ? Math.abs(other.envelope.x + other.envelope.w - me.envelope.x) <= TOL
      : Math.abs(me.envelope.x + me.envelope.w - other.envelope.x) <= TOL;
    return touching ? other : undefined;
  };

  const out: TypeInstance[] = sorted.map((inst, i) => {
    const ports: PortMap = {};

    for (const face of ["LEFT", "RIGHT", "TOP", "BOTTOM", "BACK"] as PortFace[]) {
      const cap = inst.caps[face];
      if (!cap) continue;

      if (cap.open) {
        ports[face] = { face, sharing: "OPEN", nominalThickness: 0 };
        decisions.push({ instance: inst.id, face, sharing: "OPEN", by: "declared-open" });
        continue;
      }

      if (face !== "LEFT" && face !== "RIGHT") {
        ports[face] = { face, sharing: "FIXED", nominalThickness: cap.nominalThickness };
        decisions.push({ instance: inst.id, face, sharing: "FIXED", by: "edge" });
        continue;
      }

      const other = neighbourOf(i, face);

      // тап мастера по шву — старше всего остального
      const ov = other && overrides.find((o) =>
        (o.between[0] === inst.id && o.between[1] === other.id) ||
        (o.between[1] === inst.id && o.between[0] === other.id));
      if (ov) {
        const sharing: PortSharing =
          ov.to === "shared" ? "SHARED" : ov.to === "open" ? "OPEN" : "FIXED";
        ports[face] = { face, sharing, nominalThickness: cap.nominalThickness };
        decisions.push({ instance: inst.id, face, sharing, by: "override" });
        continue;
      }

      // соседа нет — КРАЙ. Шкаф делает бок сам, и это не обсуждается: иначе он уедет с дырой.
      if (!other) {
        ports[face] = { face, sharing: "FIXED", nominalThickness: cap.nominalThickness };
        decisions.push({ instance: inst.id, face, sharing: "FIXED", by: "edge" });
        continue;
      }

      const theirs = other.caps[face === "LEFT" ? "RIGHT" : "LEFT"];
      const both = cap.canShare && theirs?.canShare === true;
      const sharing: PortSharing = both ? "SHARED" : "FIXED";
      ports[face] = { face, sharing, nominalThickness: cap.nominalThickness };
      decisions.push({ instance: inst.id, face, sharing, by: both ? "neighbour" : "edge" });
    }

    return { id: inst.id, typeId: inst.typeId, envelope: inst.envelope, ports, subSheet: inst.subSheet };
  });

  return { instances: out, decisions };
}

/** Каждая грань, которая осталась без панели вообще. Пусто — значит ни один шкаф не уедет с дырой. */
export function unpanelledFaces(r: ResolvedPorts): { instance: string; face: PortFace }[] {
  const out: { instance: string; face: PortFace }[] = [];
  for (const inst of r.instances) {
    for (const face of ["LEFT", "RIGHT"] as PortFace[]) {
      const p = inst.ports[face];
      if (!p) continue;
      if (p.sharing === "OPEN" || p.sharing === "HOST_BOUND") continue;
      if (p.sharing === "FIXED") continue;                 // шкаф делает сам
      // SHARED без арбитража — вот это и есть дыра
      const paired = r.instances.some((o) => o.id !== inst.id &&
        (Math.abs(o.envelope.x + o.envelope.w - inst.envelope.x) <= TOL ||
         Math.abs(inst.envelope.x + inst.envelope.w - o.envelope.x) <= TOL));
      if (!paired) out.push({ instance: inst.id, face });
    }
  }
  return out;
}
