// GOLA / handleless system — DERIVED, not stored. Like frontOf() and the corner geometry, the
// profiles + side-panel notches are computed from the cabinet's layout, so the 3D, the 2D panel
// drawing and (later) the cut list all read ONE source of truth and cannot drift.
//
// A GOLA kitchen has no handles: an aluminium C/L profile runs horizontally at the top of the
// cabinet and at every seam between two stacked fronts, and the finger grip is the gap left above
// each (slightly shortened) front. Where a profile runs, the side panels are notched at the front
// edge so the rail sits flush — that is the stepped cut in the shop drawing.
//
// Auto-GOLA covers the systemic case. Per-panel manual cuts (a divider shallower than the carcass,
// an arbitrary notch) are a later, separate feature on a first-class panel model.

import type { Cabinet, Cell } from "./cabinet";
import { cabinetLayout, cellSizes, isLeaf } from "./cabinet";

/** Tunable GOLA profile geometry (mm). Absent fields fall back to these defaults, taken from a
 *  typical C-profile + the sample shop drawing (26 mm notch depth). */
export interface GolaConfig {
  /** how deep the notch bites into the side from the FRONT edge (mm) */
  depthMm?: number;
  /** the profile channel height / notch height (mm) */
  heightMm?: number;
  /** grip gap the front is shortened by at each profile (mm) */
  gapMm?: number;
}

export const GOLA_DEFAULTS = { depthMm: 26, heightMm: 30, gapMm: 12 } as const;

export interface GolaSpec {
  /** horizontal profile heights as fractions 0..1 of the front face (bottom→top): the top of the
   *  cabinet plus every seam where one front stacks on another. */
  profileFractions: number[];
  depthMm: number;
  heightMm: number;
  gapMm: number;
}

/** Is this a handleless / GOLA cabinet? */
export const golaEnabled = (cab: Cabinet): boolean => !!cab.gola;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The derived GOLA spec for a cabinet, or null if it isn't handleless. */
export function golaSpec(cab: Cabinet): GolaSpec | null {
  if (!cab.gola) return null;
  const cfg: GolaConfig = typeof cab.gola === "object" ? cab.gola : {};
  const depthMm = cfg.depthMm ?? GOLA_DEFAULTS.depthMm;
  const heightMm = cfg.heightMm ?? GOLA_DEFAULTS.heightMm;
  const gapMm = cfg.gapMm ?? GOLA_DEFAULTS.gapMm;

  // A profile sits at the TOP edge (fy1) of every front. In a vertical stack that yields one at
  // each internal seam plus one at the cabinet top; a single door yields just the top profile.
  // A cols split (two fronts side by side) makes NO horizontal seam, so it recurses without adding
  // its own boundary — only the fronts' own top edges count.
  const tops = new Set<number>();
  const walk = (cell: Cell, fy0: number, fy1: number) => {
    if (cell.front) {
      tops.add(r3(fy1));
      return;
    }
    if (isLeaf(cell) || !cell.children) return;
    const sizes = cellSizes(cell);
    let acc = 0;
    for (let i = 0; i < cell.children.length; i++) {
      const f = sizes[i];
      if (cell.split === "rows") walk(cell.children[i], fy0 + (fy1 - fy0) * acc, fy0 + (fy1 - fy0) * (acc + f));
      else walk(cell.children[i], fy0, fy1); // columns share the same vertical span
      acc += f;
    }
  };
  walk(cabinetLayout(cab), 0, 1);
  tops.add(1); // the top C-profile, even on an open/handleless carcass

  const profileFractions = [...tops].filter((f) => f > 0.02).sort((a, b) => a - b);
  return { profileFractions, depthMm, heightMm, gapMm };
}
