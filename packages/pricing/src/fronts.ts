// THE FRONT'S BODY — and what it costs to make.
//
// Every front but glass is ONE piece of MDF: the CNC routes the profile into a single blank, which is
// then painted. So a profiled front is a panel PLUS a machining operation, never an assembled frame.
// A glass front is the same blank with its middle routed out, plus a bought pane.
//
// This file is the one place that knows which is which. The 3D, the elevation, the PDF, the cut list
// and the quote all read it, so a shaker door cannot be drawn one way and billed another.
//
// Pure. No I/O.

import type { FrontProfile } from "../../schema/src/index.js";

/** The legacy `door` index the app used before the profile existed (DOORS in model/cabinet.ts).
 *  Index 1 was «Фрезер» — a style nothing ever rendered or priced. It maps to `shaker` now. */
const LEGACY_DOOR: FrontProfile[] = ["flat", "shaker", "glass", "none"];

/** THE front body of a module. `front` wins; otherwise the legacy index, so a project saved before
 *  profiles existed still renders exactly as it did. */
export function frontOf(c: { front?: FrontProfile; door?: number }): FrontProfile {
  return c.front ?? LEGACY_DOOR[c.door ?? 0] ?? "flat";
}

/** Does this profile carry a glass pane? */
export const isGlass = (p: FrontProfile): boolean => p === "glass" || p === "grid";

/** Is the face routed (a frame, a raised panel, or a pane cut-out)? */
export const isMilled = (p: FrontProfile): boolean =>
  p === "shaker" || p === "raised" || p === "glass" || p === "grid";

/** The frame width a routed/glass front gets (mm) — the border left around the recessed panel. */
export const FRAME_MM = 60;
/** A mullion bar's width (mm) — the раскладка strips across a glass grid. */
export const MULLION_MM = 22;
/** Rib pitch of a fluted face (mm). A FIXED pitch: a 400mm door and a 900mm door must show ribs of
 *  the same width, not stretched ones. */
export const FLUTE_PITCH_MM = 32;

/**
 * The mullion grid of a glass front, DERIVED from its size rather than stored.
 *
 * A tall narrow витрина wants 1×3; a wide one 2×2. Deriving it means the grid stays sane when the
 * door is resized, which a stored count would not.
 */
export function mullionsFor(wMm: number, hMm: number): { cols: number; rows: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    cols: clamp(Math.round(wMm / 300), 1, 4),
    rows: clamp(Math.round(hMm / 300), 1, 5),
  };
}

/** The inner (recessed / glazed) rectangle of a framed front, in mm. Empty when the frame would eat
 *  the whole door. */
export function innerRect(wMm: number, hMm: number): { w: number; h: number } {
  const fr = Math.min(FRAME_MM, wMm / 3, hMm / 3);
  return { w: Math.max(0, wMm - 2 * fr), h: Math.max(0, hMm - 2 * fr) };
}

/**
 * The length of routed CONTOUR a front needs (mm) — what `millPerM` is billed against.
 *
 * shaker / glass / grid — one pass around the inner rectangle (the frame groove, or the pane
 *   cut-out).
 * raised — that, plus a second pass around the raised panel's profiled edge.
 */
export function millContourMm(p: FrontProfile, wMm: number, hMm: number): number {
  if (!isMilled(p)) return 0;
  const r = innerRect(wMm, hMm);
  if (r.w <= 0 || r.h <= 0) return 0;
  const perim = 2 * (r.w + r.h);
  return p === "raised" ? perim * 2 : perim;
}

/** The face area a fluted front is routed over (mm²) — what `flutePerM2` is billed against. */
export function fluteAreaMm2(p: FrontProfile, wMm: number, hMm: number): number {
  return p === "fluted" ? wMm * hMm : 0;
}

/** The glass pane of a front (mm) — zero for anything not glazed. */
export function glassRect(p: FrontProfile, wMm: number, hMm: number): { w: number; h: number } {
  if (!isGlass(p)) return { w: 0, h: 0 };
  return innerRect(wMm, hMm);
}

/**
 * The mullion bars of a glass GRID front, as one equivalent panel (mm).
 *
 * They are thin MDF strips, so they are cut from the facade sheet like anything else — billing their
 * total length × their width as a single panel is the same m² the shop actually consumes.
 */
export function mullionBar(p: FrontProfile, wMm: number, hMm: number): { w: number; h: number } {
  if (p !== "grid") return { w: 0, h: 0 };
  const r = innerRect(wMm, hMm);
  if (r.w <= 0 || r.h <= 0) return { w: 0, h: 0 };
  const { cols, rows } = mullionsFor(wMm, hMm);
  const totalMm = (cols - 1) * r.h + (rows - 1) * r.w; // vertical bars + horizontal bars
  return totalMm > 0 ? { w: MULLION_MM, h: totalMm } : { w: 0, h: 0 };
}
