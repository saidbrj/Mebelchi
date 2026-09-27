// THE LIGHT BUILT INTO THE FURNITURE — LED strip, derived from the layout.
//
// Every modern kitchen is lit twice: once from the ceiling, and once from the cabinetry itself. The
// second one is what makes a worktop usable after dark, and it is a real line on a real invoice —
// strip, aluminium profile, a power supply sized to the load, a switch or a door sensor. Until now
// this app could draw a kitchen it could not light and could not quote.
//
// NOTHING HERE IS STORED. A strip's length is not a number anybody types: it is the length of the
// run it is screwed to, so it is DERIVED from the resolved layout every time — the same doctrine as
// the flat panels next door (model/wallPanels.ts) and the pipe notches (model/cutouts.ts). Move a
// cabinet and the strip, the power supply and the price all follow with no repair pass.
//
// THE UNDER-CABINET STRIP FOLLOWS THE SAME STRETCHES AS THE PLANE IT IS FIXED TO. Both call
// `hungSpans`, which is why that helper was pulled out of `undersideBands` rather than copied: a
// light that hangs off the end of its own panel is the kind of drawing that gets built wrong.
//
// Pure. No React, no store, no THREE.

import { cabBand, cabDepth, cornerShapeOf, cornerArm } from "./bands";
import { frontOf } from "./cabinet";
import { GEOM } from "./layout";
import { hungSpans, isHung, isStraight } from "./wallPanels";
import { isFloating } from "./bands";
import type { ResolvedLayout, ResolvedCab } from "./resolve";

/**
 * WHERE THE LIGHT IS.
 *
 * - `under` — beneath the wall units, throwing down onto the worktop. The task light, and the one
 *   every kitchen with any lighting at all has.
 * - `plinth` — in the toe-kick, washing the floor. Reads as the cabinetry floating; it is decor,
 *   not task light.
 * - `cornice` — on top of the wall units, throwing up at the ceiling. Fills the room softly and is
 *   the one that makes a floor-to-ceiling kitchen not look like a wall.
 * - `interior` — inside a cabinet, lighting what is in it. Only worth fitting behind glass or in an
 *   open unit, so that is where it is derived.
 */
export type LedZone = "under" | "plinth" | "cornice" | "interior";
export const LED_ZONES: LedZone[] = ["under", "plinth", "cornice", "interior"];

/**
 * WHAT COLOUR THE LIGHT IS (K).
 *
 * A kitchen is normally lit warm, and the strip should agree with the ceiling. 4000K is the one
 * that photographs like a showroom; 2700K is what most flats actually fit.
 */
export const LED_TEMPS = [2700, 3000, 4000, 5000] as const;
export type LedTemp = (typeof LED_TEMPS)[number];

/** How the kitchen is lit from within. A project property — it is bought and installed. */
export interface LedSpec {
  under: boolean;
  plinth: boolean;
  cornice: boolean;
  interior: boolean;
  temp: LedTemp;
  ceilingKind?: "spot" | "linear" | "track";
  ceilingCount?: number;
  ceilingPerimeter?: boolean;
  ceilingOffsetMm?: number;
  ceilingSpread?: number;
  preset?: "day" | "evening" | "studio";
  sunAzimuth?: number;
  sunElevation?: number;
  lightingMode?: "sun" | "fixtures";
  customPositions?: { x: number; z: number }[];
  /**
   * A door sensor / IR switch per lit run, rather than one switch on the wall. A convenience the
   * client either pays for or does not, so it is a toggle, not an assumption.
   */
  sensor: boolean;
}

/**
 * DEFAULT: the task light only.
 *
 * `under` is on because a kitchen without it is not a kitchen anybody specs today, and it is the
 * single zone a client assumes is included. The other three are design choices with a real cost, so
 * they are asked for rather than billed by surprise.
 */
export const DEFAULT_LED: LedSpec = {
  under: true,
  plinth: false,
  cornice: false,
  interior: false,
  temp: 4000,
  sensor: false,
  ceilingKind: "spot",
  ceilingCount: 4,
  ceilingPerimeter: false,
  ceilingOffsetMm: 800,
  preset: "evening",
  lightingMode: "sun",
};

/** One continuous length of strip — what gets cut off the reel and screwed down. */
export interface LedStrip {
  zone: LedZone;
  run: number;
  /** the module it lights, for an `interior` strip — the others belong to the run */
  cabId?: string;
  /** wall-space span (mm) */
  x0: number;
  x1: number;
  /** the strip's own line, above the floor (mm) */
  y: number;
  /** how far the strip's centre stands out from the wall (mm) */
  z: number;
  /** which way it throws — what the 3D washes and what the profile has to face */
  dir: "down" | "up";
  /** the light's own colour (int), resolved from the spec's temperature — same as `PanelBand.color` */
  color: number;
  /**
   * THIS STRIP FOLLOWS A CORNER UNIT'S OWN FRONT, not a wall.
   *
   * A corner's face is a 45° chamfer (`diagonal`) or an L that turns a right angle (`l`) — never a
   * straight length parallel to a wall. So the 3D draws it in that cabinet's own frame, off the
   * same footprint the body is built from, and ignores `x0`/`x1`/`z` here. Those carry its LENGTH
   * and roughly where it sits in the elevation, which is what the quote and the 2D need.
   */
  corner?: "diagonal" | "l";
}

export const stripLen = (s: LedStrip): number => Math.max(0, s.x1 - s.x0);

/** Total metres of strip. What the reel is cut to and what the per-metre rate multiplies. */
export function ledMetres(strips: LedStrip[]): number {
  return strips.reduce((m, s) => m + stripLen(s), 0) / 1000;
}

/**
 * HOW FAR BACK FROM THE FRONT EDGE the strip sits (mm).
 *
 * Not at the edge: mounted flush with the front, the diode itself is in your eye-line from across
 * the room and the counter gets a hard bright line at its back instead of an even wash. Fitters set
 * it back behind the door's thickness and a little more.
 */
const SETBACK = 40;

/** A strip shorter than this is not worth its own profile and power supply. */
const MIN_STRIP = 150;

/**
 * THE POWER SUPPLY IS SIZED, NOT COUNTED.
 *
 * Strip draws roughly 10-14 W/m; a driver is rated in watts and you fit as many as the load needs.
 * One PSU per 40W of load with a margin is the ordinary shop rule, and it is why a 6-metre kitchen
 * quotes two and a 2-metre kitchen quotes one.
 */
export const LED_WATTS_PER_M = 12;
export const PSU_WATTS = 40;

export function psuCount(metres: number): number {
  if (metres <= 0) return 0;
  return Math.max(1, Math.ceil((metres * LED_WATTS_PER_M) / PSU_WATTS));
}

/**
 * A UNIT LIT FROM INSIDE: you have to be able to see in, or the light is buying nothing.
 *
 * Behind glass, or genuinely open. `frontOf` rather than `c.front`, because a project saved before
 * the profile existed carries the old `door` index and would otherwise never read as glazed. An
 * open-fronted APPLIANCE (the sink base is modelled `fill: "open"`) is not an open shelf, and
 * lighting the inside of a dishwasher is not a thing.
 */
const isGlazed = (rc: ResolvedCab): boolean => {
  const f = frontOf(rc.cab);
  if (f === "glass" || f === "grid") return true;
  return rc.cab.fill === "open" && !rc.cab.appliance;
};

/**
 * EVERY STRIP IN THE KITCHEN — the one call the 3D and the quote both make.
 *
 * Wall runs only. An island's light is a pendant over it, not a strip under it, and a free-standing
 * base has no wall unit above it to hide a profile in.
 */
export function ledStrips(L: ResolvedLayout, spec: LedSpec): LedStrip[] {
  const out: LedStrip[] = [];
  const color = ledColor(spec.temp);
  // A CORNER UNIT IS ON TWO WALLS — it belongs to the corner zone both adjacent runs exclude, so it
  // shows in both elevations. One cabinet gets ONE strip: lighting it from both walls would draw
  // two crossing strips under one box and bill its length twice.
  const litCorners = new Set<string>();
  const litInteriors = new Set<string>();
  L.runs.forEach((pr, run) => {
    if (!pr || pr.kind !== "wall") return;

    // ── under, and up the cornice ────────────────────────────────────────────────────────────────
    // Both ride the rows of wall units, so both read the same stretches. The cornice takes only the
    // TOP row: a strip on top of a lower row is aimed at the underside of the row above it.
    const rows = hungSpans(L, run);
    const corners = L.elevation(run).filter(
      (rc) => isHung(rc) && rc.cab.appliance !== "hood" && !isStraight(rc),
    );
    const topY = Math.max(
      ...rows.map((r) => r.y0),
      ...corners.map((rc) => cabBand(rc.cab).y0),
      0,
    );
    for (const r of rows) {
      const depth = Math.max(...r.members.map((rc) => cabDepth(rc.cab)));
      const height = Math.max(...r.members.map((rc) => cabBand(rc.cab).y1 - cabBand(rc.cab).y0));
      if (spec.under) {
        push(out, {
          zone: "under",
          run,
          color,
          x0: r.x0,
          x1: r.x1,
          // under the box, at its bottom board — the plane the underside panel occupies
          y: r.y0,
          z: Math.max(SETBACK, depth - SETBACK),
          dir: "down",
        });
      }
      if (spec.cornice && r.y0 === topY) {
        push(out, {
          zone: "cornice",
          run,
          color,
          x0: r.x0,
          x1: r.x1,
          y: r.y0 + height,
          // set back from the front on TOP as well, so the profile is not visible over the edge
          z: Math.max(SETBACK, depth - SETBACK),
          dir: "up",
        });
      }
    }

    // ── the corner unit ──────────────────────────────────────────────────────────────────────────
    //
    // A CORNER IS LIT LIKE ANYTHING ELSE. It is excluded from the flat PANELS because its body is a
    // chamfered prism, so a rectangle drawn across it is the wrong shape and stands out into the
    // room — a fact about panels, not about light. It has an underside and a top like every other
    // box, and a dark corner under lit neighbours is the one thing you would notice. Reusing that
    // filter here is exactly how the corner came out unlit.
    //
    // It takes its OWN length of profile rather than joining the row's: its front meets the
    // straight units' fronts at an angle, and a strip does not turn a corner.
    //
    // A corner unit is FREE-PLACED (px/pz) and belongs to the corner zone BOTH adjacent runs
    // exclude, so it appears in two elevations and can start before its wall's own zero. Clamp it:
    // there is no wall left to screw profile to past the corner.
    for (const rc of corners) {
      if (litCorners.has(rc.id)) continue;
      litCorners.add(rc.id);
      const b = cabBand(rc.cab);
      const shape = cornerShapeOf(rc.cab) === "l" ? "l" : "diagonal";
      const len = cornerFrontLen(rc.cab, shape);
      if (len < MIN_STRIP) continue;
      // centred under the unit for the ELEVATION's sake — the 3D places it off the footprint
      const x0 = rc.x + (rc.w - len) / 2;
      const seat = { run, color, x0, x1: x0 + len, z: cabDepth(rc.cab) / 2, cabId: rc.id, corner: shape } as const;
      if (spec.under) push(out, { ...seat, zone: "under", y: b.y0, dir: "down" });
      if (spec.cornice && Math.abs(b.y0 - topY) < 30) {
        push(out, { ...seat, zone: "cornice", y: b.y1, dir: "up" });
      }
    }

    // ── the plinth ───────────────────────────────────────────────────────────────────────────────
    // Along the toe-kick of everything standing on the floor. It is one line under the whole run,
    // so it merges across base and tall alike — the recess is continuous and so is the strip.
    if (spec.plinth) {
      // A PLINTH STRIP LIVES IN THE TOE-KICK RECESS, and a box lifted off the floor has no
      // toe-kick to live in — the strip would hang in open air under it, lighting the floor from
      // nowhere, and be billed for. Everything derived from «what is standing there» has to ask
      // whether it still IS (model/bands.ts `isFloating`).
      const floor = L.elevation(run).filter(
        (rc) =>
          rc.cab.kind !== "upper" &&
          !rc.cab.furniture &&
          rc.cab.appliance !== "filler" &&
          !isFloating(rc.cab),
      );
      for (const sp of mergeSpans(floor)) {
        push(out, {
          zone: "plinth",
          run,
          color,
          x0: sp.x0,
          x1: sp.x1,
          // at the top of the toe-kick recess, throwing down the plinth face onto the floor
          y: GEOM.plinth,
          // tucked behind the toe-kick's face, which is set back about this far from the front
          z: Math.max(SETBACK, sp.depth - 60),
          dir: "down",
        });
      }
    }

    // ── inside the glass ─────────────────────────────────────────────────────────────────────────
    // Per module, not per run: this one lights the INSIDE of a box, so it stops at that box's sides.
    if (spec.interior) {
      for (const rc of L.elevation(run)) {
        if (!isGlazed(rc)) continue;
        // same story as above: a glazed corner shows on two walls and is one cabinet
        if (rc.cab.corner) {
          if (litInteriors.has(rc.id)) continue;
          litInteriors.add(rc.id);
        }
        const b = cabBand(rc.cab);
        push(out, {
          zone: "interior",
          run,
          color,
          cabId: rc.id,
          // inside the sides, not across them
          x0: rc.x + 20,
          x1: rc.x + rc.w - 20,
          // under the top board, throwing down through the shelves
          y: b.carcass1 - 20,
          z: Math.max(SETBACK, cabDepth(rc.cab) - SETBACK),
          dir: "down",
        });
      }
    }
  });
  return out;
}

/**
 * HOW LONG A CORNER UNIT'S FRONT IS (mm).
 *
 * The body fills the corner square; the two adjacent runs butt into it at their own depth, and what
 * is left facing the room is the front. Its reach is therefore the square's side minus the run
 * depth that butts it — `w - arm` — taken twice for an L, or across the hypotenuse for a chamfer.
 *
 * Mirrors the footprint `three/kitchen3d.ts` extrudes the body from (`footPts`): `half = w/2`,
 * `cut = arm - half`, and the room-facing points at `(half, cut)` / `(cut, cut)` / `(cut, half)`.
 */
function cornerFrontLen(c: Parameters<typeof cabDepth>[0], shape: "diagonal" | "l"): number {
  const reach = c.w - cornerArm(c);
  if (reach <= 0) return 0;
  return shape === "l" ? 2 * reach : reach * Math.SQRT2;
}

/** Keep a strip only if it is long enough to be one. */
function push(out: LedStrip[], s: LedStrip): void {
  if (stripLen(s) >= MIN_STRIP) out.push(s);
}

/** Continuous stretches of floor-standing modules, with the depth each stretch runs at. */
function mergeSpans(cabs: ResolvedCab[]): { x0: number; x1: number; depth: number }[] {
  const sorted = [...cabs].sort((a, b) => a.x - b.x);
  const out: { x0: number; x1: number; depth: number }[] = [];
  for (const rc of sorted) {
    const d = cabDepth(rc.cab);
    const last = out[out.length - 1];
    // a gap of a filler's width is still one plinth; anything wider is a break in the run
    if (last && rc.x - last.x1 <= 120) {
      last.x1 = Math.max(last.x1, rc.x + rc.w);
      last.depth = Math.min(last.depth, d); // the strip hides behind the SHALLOWEST plinth it passes
    } else {
      out.push({ x0: rc.x, x1: rc.x + rc.w, depth: d });
    }
  }
  return out;
}

/**
 * THE COLOUR A TEMPERATURE LOOKS LIKE, as an sRGB int for the 3D.
 *
 * A rough blackbody walk, not a colorimetric one — it only has to make 2700K read as warm and
 * 5000K as clinical next to each other on screen.
 */
export function ledColor(temp: number): number {
  // anchor points sampled off a blackbody table, lerped between
  const stops: [number, [number, number, number]][] = [
    [2700, [255, 180, 107]],
    [3000, [255, 195, 130]],
    [4000, [255, 225, 190]],
    [5000, [255, 243, 233]],
    [6500, [255, 255, 255]],
  ];
  // clamp to the TABLE's range, not to a pair of guessed numbers — outside it the lerp below
  // extrapolates, and an extrapolated blackbody runs off into colours that are not light
  const t = Math.max(stops[0][0], Math.min(stops[stops.length - 1][0], temp));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
  const ch = (i: number) => Math.round(lo[1][i] + (hi[1][i] - lo[1][i]) * f);
  return (ch(0) << 16) | (ch(1) << 8) | ch(2);
}
