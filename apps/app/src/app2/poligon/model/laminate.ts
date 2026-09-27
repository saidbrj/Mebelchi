// ПОЛИГОН · R76 — доведение склейки до пилы.
//
// A doubled end panel is ONE part in the wall and TWO blanks at the saw, and the whole of this
// file is that sentence made mechanical. Nothing here touches topology: `boards` still means what
// it always meant, and `lamination` never once changes which module a cell belongs to.
//
// The step is the part people get wrong. The outer blank is full depth because you see it. The
// backing behind it is shorter, because nobody does and the weight is free to lose. They are
// FLUSH AT THE FRONT — that is the whole point — so the step falls at the back, against the wall,
// where it is invisible and where the wall is never flat anyway.
//
// Banding follows from that geometry rather than from a rule someone has to remember: the front
// is one 32mm band across the glued seam (an 18mm shop bands 36), the exposed step at the back of
// the face blank takes the ordinary thin band, and the backing's own back edge takes it too. The
// glued faces take nothing — they are inside the sandwich.
//
// NO-THROUGH-DRILL is the safety rule and the reason this is not merely a BOM trick. A shelf pin
// drilled from inside the cabinet goes into the BACKING blank only. Let it run 2mm deeper than
// the backing is thick and it pushes through into the glue line and blisters the show face — on
// the one part in the kitchen the customer actually looks at, after it has been cut, banded,
// glued and drilled.

import type { Lamination, SheetProfile } from "./sheet";

// ─── the two blanks ───────────────────────────────────────────────────────────────────────────

export type BlankRole = "face" | "backing";

export interface Blank {
  /** `${partId}.A` for the face, `.B`, `.C` for the backings — the number written on the wood */
  id: string;
  role: BlankRole;
  lengthMm: number;
  /** depth across the run. The backings are the shorter ones. */
  widthMm: number;
  thicknessMm: number;
  /** per edge, matching Facets.edgeExposure order: low end, high end, front, back */
  banding: (string | undefined)[];
  grain: string;
}

export interface GlueOp {
  /** what the blanks are aligned on — never a coordinate, always a face */
  datum: "front-flush" | "all-flush";
  blanks: string[];
  note: string;
}

/** The assembly unit the shop receives: two cut-list rows plus the instruction binding them. */
export interface LaminatedPart {
  partId: string;
  /** what the WALL sees: one panel, this thick */
  monolithicThicknessMm: number;
  blanks: Blank[];
  glue: GlueOp;
  /** the single band across the glued front seam */
  frontBandMm: number;
}

export interface LaminateInput {
  partId: string;
  lengthMm: number;
  /** the face blank's depth — the one the customer sees */
  faceWidthMm: number;
  lamination: Lamination;
  profile: SheetProfile;
  grain: string;
  /** the thin band for edges that are exposed but not the show face */
  thinBand: string;
}

/** R76 §2 — decompose one laminated panel into the blanks that actually get cut. */
export function decomposeLaminate(input: LaminateInput): LaminatedPart {
  const { partId, lengthMm, faceWidthMm, lamination, profile, grain, thinBand } = input;
  const t = profile.boardMm;
  const backingWidth = faceWidthMm - lamination.stepDepthMm;
  const frontBandMm = lamination.layers * t;

  const blanks: Blank[] = [];

  // the face blank — full depth, and the one carrying the show edge
  blanks.push({
    id: `${partId}.A`, role: "face",
    lengthMm, widthMm: faceWidthMm, thicknessMm: t, grain,
    // low end, high end, FRONT (the 32mm show edge), back
    banding: [thinBand, thinBand, String(frontBandMm), thinBand],
  });

  // the backings — shorter, hidden, and banded only where the step leaves an edge visible
  for (let i = 1; i < lamination.layers; i++) {
    blanks.push({
      id: `${partId}.${String.fromCharCode(65 + i)}`, role: "backing",
      lengthMm, widthMm: backingWidth, thicknessMm: t, grain,
      // the front edge of a backing is INSIDE the 32mm band, so it takes nothing of its own
      banding: [thinBand, thinBand, undefined, thinBand],
    });
  }

  return {
    partId,
    monolithicThicknessMm: lamination.layers * t,
    blanks,
    frontBandMm,
    glue: {
      datum: lamination.frontFlush ? "front-flush" : "all-flush",
      blanks: blanks.map((b) => b.id),
      note:
        lamination.frontFlush
          ? `склеить заподлицо по ПЕРЕДНЕЙ кромке; ступень ${lamination.stepDepthMm}мм уходит назад, ` +
            `к стене. Кромка ${frontBandMm}мм ставится ПОСЛЕ склейки, одной полосой на общий торец.`
          : `склеить заподлицо по всем кромкам. Кромка ${frontBandMm}мм ставится ПОСЛЕ склейки.`,
    },
  };
}

// ─── no-through-drill ─────────────────────────────────────────────────────────────────────────

export interface DrillIntent {
  /** where the hole comes from — the cabinet side, i.e. the backing face */
  from: "interior" | "exterior";
  depthMm: number;
  kind: string;
  atMm: { x: number; y: number };
}

export interface FaceProblem {
  law: string;
  detail: string;
}

/**
 * R76 §4 — the show face is never drilled from inside.
 *
 * A hole coming from the cabinet's interior lives in the backing blank alone. `margin` is the glue
 * line plus the material that has to stay unblistered; 3mm of a 16mm backing is the working number,
 * which is why a standard 13mm shelf-pin hole passes and a 15mm cam seat does not.
 */
export function checkNoThroughDrill(
  part: LaminatedPart, holes: DrillIntent[], profile: SheetProfile, marginMm = 3,
): FaceProblem[] {
  const backing = part.blanks.find((b) => b.role === "backing");
  if (!backing) return [];
  const limit = profile.boardMm - marginMm;

  return holes
    .filter((h) => h.from === "interior" && h.depthMm > limit)
    .map((h) => ({
      law: "R76-NOTHROUGH",
      detail:
        `${h.kind} ${h.depthMm}мм с внутренней стороны на ${part.partId}: подложка ${profile.boardMm}мм, ` +
        `глубже ${limit}мм сверло выходит в клеевой шов и вспучивает лицевую пласть. ` +
        `Лицо (${part.blanks[0]!.id}) снаружи не сверлится вообще.`,
    }));
}

/** Every hole that a laminated panel is allowed to take from inside, as one number the UI can
 *  grey out against. */
export const maxInteriorDepthMm = (profile: SheetProfile, marginMm = 3): number =>
  profile.boardMm - marginMm;
