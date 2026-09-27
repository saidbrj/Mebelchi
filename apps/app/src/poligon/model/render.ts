// ПОЛИГОН · L-STROKE — the one place a drawing is allowed to lie, and the one place it is not.
//
// DB/48 §5. A 3mm back panel on a 3000mm wall is one pixel wide at any zoom a person actually
// works at. Drawn honestly it disappears, and a board you cannot see is a board you cannot tap.
// So the DESIGN view exaggerates: every board is drawn at least a minimum number of screen pixels
// thick, and its outline is a screen-pixel stroke that does not thin out as you zoom.
//
// That exaggeration is a lie, and it is a useful one exactly as long as it never reaches a view
// somebody measures. The PARTS view is true scale, no minimum, no stroke padding the edge — what
// is on screen is what comes off the saw. A dimensioned or printed drawing carrying a 3mm panel
// puffed up to 8mm is how a shop cuts to a picture instead of to a number.
//
// Hence one module rather than a rule of thumb: the two views ask the same function, and the
// function refuses to exaggerate for the one that must not.

export type View = "design" | "parts";

/** Design view only. Below this a board cannot be seen or tapped. */
export const MIN_VISIBLE_PX = 3;
/** The outline weight in design view, in screen pixels — non-scaling, so zoom does not thin it. */
export const DESIGN_STROKE_PX = 1.25;

/** Outline weight for a view. The parts view has NO outline: a stroke straddles the edge it draws,
 *  so a 1px outline on a true-scale part is half a pixel of material that does not exist. */
export const strokePx = (view: View): number => (view === "design" ? DESIGN_STROKE_PX : 0);

/** How thick to DRAW a board of `trueMm`, at a scale of `mmPerPx`.
 *
 *  Design view floors it at MIN_VISIBLE_PX so thin panels stay visible and tappable. Parts view
 *  returns the true thickness, always, at every zoom — there is no branch here that can inflate it. */
export function drawnThicknessMm(view: View, trueMm: number, mmPerPx: number): number {
  if (view === "parts") return trueMm;
  return Math.max(trueMm, MIN_VISIBLE_PX * mmPerPx);
}

/** Is this view allowed to exaggerate? Asked by anything that dimensions or prints, so the check
 *  is a call rather than a comment somebody has to remember. */
export const mayExaggerate = (view: View): boolean => view === "design";

/** By how much is this drawing lying, in millimetres? Zero in the parts view, by construction.
 *  Design view reports it rather than hiding it — a number a dimension line can refuse to accept. */
export const exaggerationMm = (view: View, trueMm: number, mmPerPx: number): number =>
  drawnThicknessMm(view, trueMm, mmPerPx) - trueMm;
