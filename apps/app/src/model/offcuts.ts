// The shop's OFFCUT STOCK — the irregular leftover boards on the rack, entered once and
// reused on every job.
//
// It used to be component state in HandoffScreen: retyped for every quote and gone the moment
// you navigated away. For something the UI calls «остатки на складе» that is the wrong
// lifetime — a rack of offcuts belongs to the workshop, not to one quote. Same storage shape
// as model/catalog.ts and model/savedCabs.ts: localStorage, per-device.
//
// WHAT THIS DELIBERATELY DOES NOT DO: consume. Nesting a job onto an offcut does not remove it
// from the list, because the app has no signal that the job was ever actually cut — quotes get
// revised and lost. Decrementing on "we drew a plan" would quietly empty a real shop's rack.
// Until there is a "this job went to production" event, the list is what the seller says it is.

import type { RemainSheet } from "./nest";

const KEY = "mebelchi.offcuts.v1";

/** A stored offcut. `group` is the board it belongs to — the nest group key. */
export interface Offcut extends RemainSheet {
  id: string;
}

function read(): Offcut[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    // a stored record is only usable if it has real dimensions — a 0×0 offcut would be
    // handed to the packer, hold nothing, and be silently skipped every run
    return p.filter((o): o is Offcut =>
      !!o && typeof o === "object"
      && typeof (o as Offcut).id === "string"
      && Number((o as Offcut).w) > 0 && Number((o as Offcut).h) > 0);
  } catch {
    return [];
  }
}

function write(list: Offcut[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — the cut plan still works, it just buys new sheets */
  }
}

export function listOffcuts(): Offcut[] {
  return read();
}

export function addOffcut(w: number, h: number, group?: string): Offcut {
  const c = globalThis.crypto as Crypto | undefined;
  const id = c?.randomUUID ? c.randomUUID() : `oc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const item: Offcut = { id, w, h, ...(group ? { group } : {}) };
  write([...read(), item]);
  return item;
}

export function removeOffcut(id: string): void {
  write(read().filter((o) => o.id !== id));
}

export function clearOffcuts(): void {
  write([]);
}
