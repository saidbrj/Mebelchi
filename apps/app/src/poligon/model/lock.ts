// ПОЛИГОН · MS-LOCK and MS-REVERSE — what a saved project remembers about the catalog it was cut
// from, and what happens when somebody edits a Thing that forty projects are already using.
//
// MS-LOCK (`52` §5). A project references Things by uid. Six months later the hinge folder has
// been edited — a better overlay figure, or a correction — and the project now silently means
// something different from the one that was cut. There is no way to notice, because a uid
// reference resolves perfectly to a Thing that has changed underneath it.
//
// So every saved project embeds a LOCK: for each Thing it uses, (uid, version, content-hash). On
// open, the lock is verified against the catalog. A mismatch does not warn and continue — it
// REFUSES TO PRODUCE A CUT LIST. That is deliberately harsh, and it is harsh in exactly the place
// where being wrong costs a sheet of material.
//
// MS-REVERSE (`52` §9) is the same problem from the publisher's side. Editing a shared Thing is
// not a local act: it reaches every project that references it. So the edit shows its BLAST RADIUS
// first — which projects, which parts, which numbers change — and cannot be committed blind.

import { hardwareConsequences, type ThingDef, type ThingFolder, type ThingIndex } from "./things";

// ─── the lock ─────────────────────────────────────────────────────────────────────────────────

export interface LockEntry {
  uid: string;
  version: string;
  /** over the def's FIELDS — the part whose change alters geometry. A translated name or a new
   *  diagram is not a reason to refuse a cut list, and treating it as one trains people to
   *  override the check, which is worse than not having it. */
  hash: string;
}

export type Lock = LockEntry[];

/** FNV-1a over the canonicalised field set. Deterministic across machines and across years, which
 *  is the only property that matters here. */
export function hashFields(def: ThingDef): string {
  const text = Object.keys(def.fields).sort()
    .map((k) => `${k}=${JSON.stringify(def.fields[k])}`)
    .join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const lockOf = (folders: ThingFolder[]): Lock =>
  folders.map((f) => ({ uid: f.def.uid, version: f.def.version, hash: hashFields(f.def) }));

export type LockFinding =
  | { kind: "missing"; uid: string; detail: string }
  | { kind: "changed"; uid: string; was: LockEntry; now: LockEntry; detail: string };

export function verifyLock(lock: Lock, index: ThingIndex): LockFinding[] {
  const out: LockFinding[] = [];
  for (const entry of lock) {
    const found = index.byUid.get(entry.uid);
    if (!found) {
      out.push({
        kind: "missing", uid: entry.uid,
        detail: `this project was cut against Thing ${entry.uid}@${entry.version}, which is no longer in the catalog`,
      });
      continue;
    }
    const now: LockEntry = { uid: entry.uid, version: found.def.version, hash: hashFields(found.def) };
    if (now.hash !== entry.hash) {
      out.push({
        kind: "changed", uid: entry.uid, was: entry, now,
        detail:
          `${found.def.id} has changed since this project was saved ` +
          `(${entry.version}/${entry.hash} → ${now.version}/${now.hash}). ` +
          `The numbers this project was cut against are not the numbers in the catalog now.`,
      });
    }
  }
  return out;
}

/** The gate itself. Not a warning: a mismatch means the design on screen and the parts it would
 *  emit disagree about the world, and a cut list produced from that is scrap with a barcode. */
export const mayProduceCutList = (lock: Lock, index: ThingIndex): boolean =>
  verifyLock(lock, index).length === 0;

// ─── MS-REVERSE · the blast radius of editing a shared Thing ──────────────────────────────────

/** The minimum a project must expose for its exposure to be computable. Deliberately not the whole
 *  project: reverse-lookup must work over a list of saved files without opening any of them. */
export interface ProjectRef {
  id: string;
  name: string;
  lock: Lock;
}

export interface AffectedProject {
  project: string;
  name: string;
  /** the fields whose values would actually change, old → new */
  changes: { field: string; from: unknown; to: unknown }[];
  /** true when a changed field is a declared geometric consequence — the parts move */
  geometric: boolean;
}

export interface BlastRadius {
  uid: string;
  thing: string;
  projects: AffectedProject[];
  /** the summary a person reads before deciding: "12 projects, 9 of them dimensionally" */
  total: number;
  geometricTotal: number;
}

/** DB/52 §9 — computed BEFORE the edit is committed. An edit that cannot be shown cannot be made:
 *  `commitThingEdit` refuses without a radius that was actually looked at. */
export function blastRadiusOfEdit(
  before: ThingDef, after: ThingDef, projects: ProjectRef[],
): BlastRadius {
  const changes = [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])]
    .filter((k) => JSON.stringify(before.fields[k]) !== JSON.stringify(after.fields[k]))
    .map((field) => ({
      field,
      from: (before.fields[field] as { value?: unknown } | undefined)?.value,
      to: (after.fields[field] as { value?: unknown } | undefined)?.value,
    }));

  const consequences = new Set(Object.keys(hardwareConsequences(after)));
  const geometric = changes.some((c) => consequences.has(c.field));

  const users = projects.filter((p) => p.lock.some((e) => e.uid === before.uid));
  return {
    uid: before.uid,
    thing: before.id,
    projects: users.map((p) => ({ project: p.id, name: p.name, changes, geometric })),
    total: users.length,
    geometricTotal: geometric ? users.length : 0,
  };
}

/** Commit is gated on having SEEN the radius. `acknowledged` carries the exact project count the
 *  person was shown — if the world moved between the preview and the commit, the counts disagree
 *  and it refuses rather than committing against a picture nobody looked at. */
export function commitThingEdit(
  before: ThingDef, after: ThingDef, projects: ProjectRef[], acknowledged: number,
): { ok: true; def: ThingDef; radius: BlastRadius } | { ok: false; radius: BlastRadius; detail: string } {
  const radius = blastRadiusOfEdit(before, after, projects);
  if (acknowledged !== radius.total) {
    return {
      ok: false, radius,
      detail:
        `this edit reaches ${radius.total} project(s); ${acknowledged} were acknowledged. ` +
        `A shared Thing cannot be edited blind (MS-REVERSE).`,
    };
  }
  return { ok: true, def: after, radius };
}
