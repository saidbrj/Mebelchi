// HOW HARD WE MAKE THE GPU WORK — measured, not guessed.
//
// This is a phone app, and almost everything we spend is fragment work: every light, and every AO
// sample, is per-pixel on every pixel of every surface. So the levers are pulled by what they cost:
//
//   1. PIXEL RATIO. By far the biggest — fragment work scales with the SQUARE of it. 2 → 1.5 is a 44%
//      cut, and on a phone screen it is very nearly invisible.
//   2. AMBIENT OCCLUSION (three/post.ts). A second render of the scene for normals, a sample loop and
//      a denoise. It is what makes the render look real, so it is given up late — and when it goes,
//      the contact-shadow decals come back in its place.
//   3. SHADOW MAP. A second full render of the scene. 1024 → 512 → off.
//   4. THE CEILING SPOTS. Dimmed to zero (never removed — see the note in lighting.ts).
//
// `antialias` cannot be changed after the renderer exists, so it is read from the stored tier at
// construction and only takes effect next session. Everything else is live.

import type { QualityTier } from "./lighting";

export type { QualityTier };

/** What the seller picked in Настройки. `auto` = measure and decide. */
export type QualityPref = "auto" | "high" | "low";

export interface TierSpec {
  pixelRatio: number;
  antialias: boolean;
  /** screen-space ambient occlusion (three/post.ts) — the single most expensive thing we draw */
  ao: boolean;
}

/**
 * The ladder, in the order a struggling device gives things up.
 *
 * PIXEL RATIO GOES FIRST, and it is deliberately the step that keeps AO: AO is fragment work, so
 * halving the pixels nearly halves what it costs — dropping from 2× to 1.5× buys back ~44% of the
 * frame while keeping the thing that makes the render look real. Only when that isn't enough does AO
 * go, and then the contact-shadow decals (three/contact.ts) come back to stand in for it.
 */
const TIERS: Record<QualityTier, TierSpec> = {
  high: { pixelRatio: 2, antialias: true, ao: true },
  med: { pixelRatio: 1.5, antialias: true, ao: true },
  low: { pixelRatio: 1, antialias: false, ao: false },
};

export const tierSpec = (t: QualityTier): TierSpec => TIERS[t];

/** The device's own ceiling — never ask for more DPR than the screen has. */
export const pixelRatioFor = (t: QualityTier): number =>
  Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, TIERS[t].pixelRatio);

/** The tier a stored preference resolves to before any measurement has happened. */
export function startingTier(pref: QualityPref): QualityTier {
  return pref === "high" ? "high" : pref === "low" ? "low" : "high"; // `auto` starts optimistic, then steps down
}

const STEP_DOWN: Record<QualityTier, QualityTier | null> = { high: "med", med: "low", low: null };

/** Over this and the frame is missing 60fps badly enough to feel like drag. */
const BUDGET_MS = 22;
/** Don't judge on the first frames — shader compilation and texture upload land there. */
const WARMUP = 20;
/** Consecutive over-budget frames before stepping down. Hysteresis: a tier is never stepped back UP,
 *  so the loop cannot oscillate between two tiers for the life of the scene. */
const STRIKES = 45;

export interface AutoTier {
  /** call after each DRAWN frame; returns a new tier when it decides to step down, else null */
  frame: () => QualityTier | null;
  tier: () => QualityTier;
}

/**
 * Watch the drawn frames and step the tier down when the device can't keep up.
 *
 * Only ever steps DOWN. A tier that stepped up on a lucky idle stretch and back down on a busy one
 * would flicker the whole scene's resolution while the user is dragging a cabinet, which is worse
 * than being one tier too conservative.
 */
export function autoTier(start: QualityTier, enabled: boolean): AutoTier {
  let tier = start;
  let last = 0;
  let seen = 0;
  let strikes = 0;

  return {
    tier: () => tier,
    frame: () => {
      if (!enabled || !STEP_DOWN[tier]) return null;
      const now = performance.now();
      const dt = last ? now - last : 0;
      last = now;
      seen++;
      if (seen < WARMUP || dt <= 0 || dt > 500) return null; // idle gap ≠ a slow frame
      strikes = dt > BUDGET_MS ? strikes + 1 : Math.max(0, strikes - 1);
      if (strikes < STRIKES) return null;
      strikes = 0;
      seen = 0;
      tier = STEP_DOWN[tier]!;
      return tier;
    },
  };
}
