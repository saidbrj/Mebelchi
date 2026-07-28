// OUTER corner = the ANGLED END UNIT: the last module of a run, its exposed front corner cut at 45°,
// open shelves. The yellow-shelf unit in every kitchen catalogue.
//
// It is NOT a body that wraps the wall corner. Real cabinetry never does that: a convex (outer) room
// corner is built from two ordinary runs meeting there, and the only special module is the END of the
// exposed run — cut back at 45° so nobody walks into a square corner, and left open as display
// shelving. A single L-shaped carcass wrapping the wall (what this used to build) is not a product:
// it has no rectangular door, no sane cut list, and no way to be delivered as one box.
//
// An INNER corner is the opposite module: it FILLS a concave corner, reserves an 840mm zone on both
// runs, and opens across its notch. This one CAPS a run, is the run's own depth, and reserves nothing.
//
// The 2D plan (ConstructorPlan.cornerGeom) and the 3D scene (kitchen3d) are separate renderers of the
// same polygon; the inner corner's twin implementations have drifted before, so both call THIS pure
// module for the outer shape. No React, no store.

import type { Pt } from "./room";

/** A footprint point in the unit's own basis: `along` = the run-width axis, `into` = the depth axis
 *  (+into = the room-facing front, −into = the back against the wall). */
export interface LocalPt {
  along: number;
  into: number;
}

/** WHICH END of the unit's width carries the cut — the sign of the facing direction in the unit's own
 *  basis. `face` is a world point the cut corner looks toward (stored on the cabinet as `cornerFace`);
 *  the basis is `u = (cos rot, sin rot)` (width) and `i = (−sin rot, cos rot)` (depth), exactly as
 *  `cabFootprints` builds it. `si` is legacy — the cut is always on the FRONT, since that is the only
 *  corner of an end unit exposed to the room. Falling back to the room centre reproduces the
 *  inner-corner rule, so a unit with no face still points somewhere sane. */
export function outerFacingSigns(face: Pt, cx: number, cy: number, rotDeg: number): { su: 1 | -1; si: 1 | -1 } {
  const r = (rotDeg * Math.PI) / 180;
  const ux = Math.cos(r), uy = Math.sin(r), ix = -Math.sin(r), iy = Math.cos(r);
  const along = (face.x - cx) * ux + (face.y - cy) * uy;
  const into = (face.x - cx) * ix + (face.y - cy) * iy;
  return { su: along >= 0 ? 1 : -1, si: into >= 0 ? 1 : -1 };
}

/** How far back the 45° cut reaches (mm). The default — a leg equal to the shorter side — takes the
 *  whole front face away and leaves one long diagonal: the "diamond" end unit. It can never exceed
 *  either side, or the cut would eat the module. */
export function outerCutFor(w: number, depth: number, cut?: number): number {
  const max = Math.min(w, depth);
  return Math.max(0, Math.min(cut ?? max, max));
}

/** THE ANGLED END UNIT footprint — a rectangle with ONE front corner cut off at 45°.
 *
 *  `su` says which end of the width is the exposed one (the run's open end): the cut sits on the
 *  `(+su, front)` corner, and the `−su` side is where the neighbouring module butts. `cut` is the 45°
 *  leg; at the maximum (the shorter side) the front face vanishes entirely and the ring loses a point
 *  — a trapezoid, or a triangle when the unit is square.
 *
 *  `openEdges` index the DISPLAY faces (`i` = the edge ring[i] → ring[i+1]): the chamfer and whatever
 *  is left of the front. Everything else is carcass — the back against the wall, the outer side, and
 *  the side the neighbour butts. */
export function chamferRing(w: number, depth: number, cut: number, su: 1 | -1): { ring: LocalPt[]; openEdges: number[] } {
  const hw = w / 2, hd = depth / 2;
  const k = outerCutFor(w, depth, cut);
  const ring: LocalPt[] = [];
  const openEdges: number[] = [];
  const add = (along: number, into: number, open: boolean) => {
    if (open) openEdges.push(ring.length); // the edge STARTING at this point
    ring.push({ along, into });
  };
  add(-su * hw, -hd, false);               // back-inner ─ the back, against the wall
  if (k < depth) add(su * hw, -hd, false); // back-outer ─ the outer side (gone at a full cut)
  add(su * hw, hd - k, true);              // the cut starts here ─ THE CHAMFER
  if (k < w) add(su * (hw - k), hd, true); // …and meets the front ─ what's left of the FRONT
  add(-su * hw, hd, false);                // front-inner ─ the side the neighbour butts
  return { ring, openEdges };
}
