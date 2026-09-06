// WHERE A CABINET IS CUT — the notch a pipe forces into a carcass.
//
// A flat's risers and supply pipes very often run up the FACE of the wall rather than inside it.
// The kitchen still has to go there, so the shop cuts the back of the box to fit around them. Until
// now this app could not express that at all: a pipe was either a radiator (which blocks the wall
// outright) or nothing, and a designer had to remember the notch and tell the factory by phone.
//
// PLACE THE PIPE ONCE AND THE CABINETS NOTCH THEMSELVES. The notch is DERIVED from the clash
// between a `plumbing` fitting and a module, exactly the way the фартук's socket holes are derived
// (model/wallPanels.ts) — nothing is stored on the cabinet, so moving the pipe or the cabinet
// re-cuts it with no repair pass and nothing can go stale.
//
// The cut-outs it returns are in PANEL-LOCAL mm — the back panel's own bottom-left corner — because
// that is the only frame the 3D, the cut list and the machine file can all agree in.
//
// Pure. No React, no store, no THREE.

import type { PanelCutout } from "@mebelchi/schema";
import { cabBand } from "./bands";
import { wallFeatures, type ResolvedLayout } from "./resolve";
import type { Opening, Fitting } from "./room";

/** The holes in ONE module's back, keyed by the module. */
export interface BackCutouts {
  cabId: string;
  /** the back panel's own size (mm) — the frame `cuts` are measured in */
  panelW: number;
  panelH: number;
  cuts: PanelCutout[];
}

/**
 * CLEARANCE around a pipe (mm, each side).
 *
 * A notch cut to the pipe's exact diameter does not go on: the pipe is never quite where the
 * drawing says, it is rarely plumb, and a riser has collars and joints wider than its barrel. Every
 * shop cuts slack. 10mm a side is the common allowance and it is what makes the difference between
 * a panel that slides on and one that comes back to be re-cut.
 */
export const PIPE_CLEARANCE = 10;

/** A pipe worth cutting for. Anything narrower than this is a cable, not a riser. */
const MIN_PIPE = 8;

/**
 * The back-panel notches every module on the wall needs.
 *
 * Only `plumbing` fittings cut: a socket sits ON the wall behind a cabinet and needs no notch (it
 * needs the фартук cut instead, which wallPanels already does), and a radiator blocks the space
 * rather than being built around.
 */
export function backCutouts(
  L: ResolvedLayout,
  fittings: Fitting[],
  openings: Opening[] = [],
): BackCutouts[] {
  const pipes = fittings.filter((f) => f.category === "plumbing");
  if (!pipes.length) return [];

  const out: BackCutouts[] = [];
  L.runs.forEach((pr, run) => {
    if (pr.kind !== "wall") return;
    const feats = wallFeatures(pr, L.wallLen(run), openings, pipes).filter((f) => f.kind === "plumbing");
    if (!feats.length) return;

    for (const rc of L.elevation(run)) {
      const c = rc.cab;
      if (c.furniture || c.appliance === "filler") continue;
      const band = cabBand(c);
      // the notch is in the CARCASS, so it is measured against the box — not the module's full
      // band, which for a base includes the worktop above it
      const y0 = band.carcass0;
      const y1 = band.carcass1;
      const cuts: PanelCutout[] = [];
      for (const f of feats) {
        if (f.x1 - f.x0 < MIN_PIPE) continue;
        // grow the pipe by its clearance, then intersect with this box
        const a = Math.max(f.x0 - PIPE_CLEARANCE, rc.x);
        const b = Math.min(f.x1 + PIPE_CLEARANCE, rc.x + rc.w);
        const c0 = Math.max(f.y0 - PIPE_CLEARANCE, y0);
        const c1 = Math.min(f.y1 + PIPE_CLEARANCE, y1);
        if (b - a < 1 || c1 - c0 < 1) continue;
        cuts.push({
          x: Math.round(a - rc.x),
          y: Math.round(c0 - y0),
          w: Math.round(b - a),
          h: Math.round(c1 - c0),
          label: f.label,
        });
      }
      if (cuts.length) out.push({ cabId: rc.id, panelW: rc.w, panelH: y1 - y0, cuts });
    }
  });
  return out;
}

/** Index the notches by module id — what a renderer or an exporter actually wants to ask. */
export function cutoutsByCab(list: BackCutouts[]): Map<string, BackCutouts> {
  return new Map(list.map((b) => [b.cabId, b]));
}

/** Total routed contour across a set of cut-outs (mm) — what the quote bills as machine time. */
export function contourMm(cuts: PanelCutout[]): number {
  return cuts.reduce((mm, c) => mm + 2 * (c.w + c.h), 0);
}
