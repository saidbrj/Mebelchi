// ПОЛИГОН · the closed role vocabulary.
//
// WHY THIS FILE EXISTS AND WHY IT IS CLOSED (redteam finding #1)
//
// The app already has a `role` on a produced panel, but it carries only three values —
// carcass | facade | glass. That is a MATERIAL CLASS, not a construction role: it cannot tell a
// side from a shelf from a top, so it cannot drive edge-banding, visibility or any cascade rule.
// The fine-grained identity currently lives in `PartLine.part` as a Russian display string
// ("Бок левый", "Полка 1"). Matching shared marketplace rules against display strings would be
// fatal — one translation and every third-party Theme silently stops matching.
//
// So roles are an enum, owned HERE, in the system layer. A Catalog may MAP to these roles; it may
// never invent one. This has a deadline: once third-party catalogs exist the vocabulary can never
// be closed again, because closing it would break them.

export const ROLES = [
  "side",     // vertical carcass board
  "top",      // horizontal, closes a block from above
  "bottom",   // horizontal, closes a block from below
  "shelf",    // horizontal, inside a block
  "back",     // the rear panel
  "front",    // door / drawer front (the app's "фасад")
  "plinth",   // цоколь
  "worktop",  // столешница
  "cornice",  // шапка / карниз
  "filler",   // добор / scribe filler
] as const;

export type Role = (typeof ROLES)[number];

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

/** Bridge to the existing production pipeline's coarse class, so nothing downstream has to change
 *  while this vocabulary grows into the engine. One-way: fine → coarse, never the reverse. */
export type CoarseRole = "carcass" | "facade" | "glass";

export const COARSE: Record<Role, CoarseRole> = {
  side: "carcass", top: "carcass", bottom: "carcass", shelf: "carcass", back: "carcass",
  filler: "carcass", plinth: "carcass", cornice: "carcass", worktop: "carcass",
  front: "facade",
};

/** Junction priority — the table itself lives in `things/tables/junction-rank/def.json`, because
 *  it decides what gets cut, and a number that decides what gets cut is a setting, not code. This
 *  is a re-export so every existing caller keeps working; there is no second copy. */
export { RANK } from "./settings";
