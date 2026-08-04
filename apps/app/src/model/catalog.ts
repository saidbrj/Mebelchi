// The EDITABLE material catalog. `model/materials.ts` holds the seed — the demo decors the
// app ships with — and this module turns that frozen array into a list the shop actually owns:
// add your own ЛДСП, correct a price, delete a decor your supplier stopped carrying.
//
// WHAT A MATERIAL RECORD MAY HOLD (DB/37 «Materials Catalog», field by field):
//   • catalog facts — decor name, code, brand, colour, texture, sheet size, thickness, stock.
//     Two workshops holding "Графит эмаль 2800×2070" hold the SAME thing, so it lives here.
//   • the price is the shop's own purchase price, kept here because this catalog IS one
//     shop's catalog (it is per-device, never shared) — not a fact about the decor globally.
// What must NEVER be written onto a material: anything belonging to one project (which
// cabinet uses it, how many sheets this kitchen needs). A project references a material by
// id; it does not own it. Keeping that line is what lets a decor be re-priced once and have
// every future quote follow, instead of editing thirty cabinets.
//
// Persistence mirrors model/savedCabs.ts: localStorage, per-device, no cloud (yet).

import { EMAN_MATERIALS, hexToInt, type EmanMaterial } from "./materials";

const KEY = "mebelchi.catalog.v1";

/** What we persist. `items` holds seeds the user EDITED plus everything they added;
 *  `removed` holds seed ids they deleted, so a deleted decor does not come back on the
 *  next load — and so a future app version can still add genuinely new seeds. */
interface Stored {
  items: EmanMaterial[];
  removed: string[];
}

const SEED_IDS = new Set(EMAN_MATERIALS.map((m) => m.id));

/** True when this id came from the shipped seed rather than from the user. */
export const isSeedMaterial = (id: string): boolean => SEED_IDS.has(id);

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [], removed: [] };
    const p = JSON.parse(raw) as Partial<Stored>;
    return { items: Array.isArray(p.items) ? p.items : [], removed: Array.isArray(p.removed) ? p.removed : [] };
  } catch {
    return { items: [], removed: [] };
  }
}

function write(s: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / unavailable — the seed list still works, so this is not fatal */
  }
}

/**
 * The live catalog: every seed the user hasn't deleted (in shipped order, carrying any edit
 * they made), then everything they added, newest last.
 *
 * Seed order is preserved deliberately — the seeds are grouped A1…A5 / B1…B4 / C1…C2 / W1…W3
 * / H1…H2, and that grouping is what makes the picker readable. Rebuilding the list from
 * `items` alone would scramble it the first time someone edits one price.
 */
export function listMaterials(): EmanMaterial[] {
  const { items, removed } = read();
  const edited = new Map(items.map((m) => [m.id, m]));
  const gone = new Set(removed);

  const out: EmanMaterial[] = [];
  for (const seed of EMAN_MATERIALS) {
    if (gone.has(seed.id)) continue;
    out.push(edited.get(seed.id) ?? seed);
  }
  // user-created materials — anything stored that isn't a seed
  for (const m of items) if (!SEED_IDS.has(m.id)) out.push(m);
  return out;
}

/** Everything for one role — the picker's list. */
export function materialsFor(part: EmanMaterial["part"]): EmanMaterial[] {
  return listMaterials().filter((m) => m.part === part);
}

export function findMaterial(id: string | undefined): EmanMaterial | undefined {
  if (!id) return undefined;
  return listMaterials().find((m) => m.id === id);
}

/** Add a new material, or overwrite an existing one (seed or custom) by id. */
export function upsertMaterial(m: EmanMaterial): void {
  const s = read();
  const i = s.items.findIndex((x) => x.id === m.id);
  if (i >= 0) s.items[i] = m;
  else s.items.push(m);
  // editing a material you previously deleted brings it back — otherwise the save would
  // appear to succeed and the row would stay missing
  s.removed = s.removed.filter((id) => id !== m.id);
  write(s);
}

/** Delete a material. A seed is remembered as deleted; a custom one is simply dropped. */
export function removeMaterial(id: string): void {
  const s = read();
  s.items = s.items.filter((m) => m.id !== id);
  if (SEED_IDS.has(id) && !s.removed.includes(id)) s.removed.push(id);
  write(s);
}

/** Throw away every edit and deletion — back to the shipped catalog. */
export function resetCatalog(): void {
  write({ items: [], removed: [] });
}

export function newMaterialId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? `mat-${c.randomUUID()}` : `mat-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** «ЛДСП · 2750×1830 · 16мм» — the sub-line under a material's name, built from its own
 *  fields so an edited sheet size or thickness shows up without a second thing to update.
 *  Falls back to the seed's hand-written `desc` when there is nothing structured to show. */
export function describeMaterial(m: EmanMaterial): string {
  const size = m.sheetW && m.sheetH ? `${m.sheetW}×${m.sheetH}` : "";
  const th = m.thicknessMm ? `${m.thicknessMm}мм` : m.thickness;
  const built = [m.kind, size, th].filter(Boolean).join(" · ");
  return built || m.desc;
}

/** The catalog material a finish colour came from (exact colour+part match), or undefined.
 *  Lets the 3D recover the picked material's PBR texture from the stored finish int.
 *
 *  Lives HERE rather than in materials.ts so it searches the LIVE catalog: a user's own decor
 *  must light and texture like a shipped one. (materials.ts cannot call this file — it is the
 *  seed this file reads, and importing back would be a cycle.) */
export function catalogByColor(colorInt: number | undefined, part: EmanMaterial["part"]): EmanMaterial | undefined {
  if (colorInt == null) return undefined;
  return listMaterials().find((m) => m.part === part && hexToInt(m.color) === colorInt);
}
