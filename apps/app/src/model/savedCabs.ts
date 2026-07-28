// "My cabinets" — a GLOBAL (not per-project) library of user-customised cabinets saved for
// reuse across projects. A saved cabinet is just a config snapshot (a Partial<Cabinet> with
// its position/id stripped) + a name + a thumbnail — the same shape the Add catalog consumes
// (store.addCab), so dropping one into a project is `addCab({ cab })`. localStorage for now
// (like model/settings.ts); a Supabase table can back it later.

import type { Cabinet } from "./cabinet";

const KEY = "mebelchi.savedcabs.v1";

export interface SavedCab {
  id: string;
  name: string;
  /** transparent 200×200 PNG data-URL (may be absent if capture failed) */
  thumbnail?: string;
  /** the reusable config — no position/run/id */
  cab: Partial<Cabinet>;
  createdAt: number;
}

/** The reusable config of a cabinet: everything that defines its LOOK + interior, with the
 *  per-instance placement (px/pz/rot/run/x/mountY) and id dropped. */
export function stripCab(c: Cabinet): Partial<Cabinet> {
  return {
    kind: c.kind,
    w: c.w,
    h: c.h,
    depth: c.depth,
    fill: c.fill,
    count: c.count,
    div: c.div,
    door: c.door,
    handle: c.handle,
    opening: c.opening,
    handlePos: c.handlePos,
    shelfYs: c.shelfYs,
    dividerXs: c.dividerXs,
    layout: c.layout,
    combinedDoors: c.combinedDoors,
    finish: c.finish,
    appliance: c.appliance,
    builtin: c.builtin,
    corner: c.corner,
  };
}

function readAll(): SavedCab[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedCab[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedCab[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — ignore (thumbnails are the heavy part) */
  }
}

/** Newest first. */
export function listSavedCabs(): SavedCab[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function addSavedCab(cab: Partial<Cabinet>, name: string, thumbnail?: string | null): SavedCab {
  const c = globalThis.crypto as Crypto | undefined;
  const id = c?.randomUUID ? c.randomUUID() : `sc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const item: SavedCab = { id, name: name.trim() || defaultSavedName(), cab, createdAt: Date.now(), ...(thumbnail ? { thumbnail } : {}) };
  writeAll([item, ...readAll()]);
  return item;
}

export function removeSavedCab(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function renameSavedCab(id: string, name: string): void {
  const list = readAll();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], name: name.trim() || list[i].name };
  writeAll(list);
}

export function defaultSavedName(): string {
  return `Мой шкаф ${readAll().length + 1}`;
}

/** All saved cabs (for the cloud migration of local-only ones). */
export function allSavedCabs(): SavedCab[] {
  return readAll();
}

/** Replace the whole local library (cloud sync makes cloud the source of truth on login). */
export function replaceAllSavedCabs(list: SavedCab[]): void {
  writeAll(list);
}
