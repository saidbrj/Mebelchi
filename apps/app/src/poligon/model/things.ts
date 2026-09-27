// ПОЛИГОН · T8 — Things: the file system as the catalog.
//
// DB/52's golden rule: every setting and every physical thing is its own file, editable locally,
// and visible in the app's settings with a picture. A new hinge brand is a folder, not a release.
//
// The boundary that makes it safe (DB/52 §1) is the whole point of this file:
//
//   > Policies, tables and catalogs are DATA. Invariants are CODE.
//   > Litmus: if editing it can produce a model that is WRONG rather than merely DIFFERENT, it is code.
//
// A hinge with overlay 47 is a strange kitchen. A junction with two boards running through is not
// a kitchen at all. So a Thing may choose among behaviours the laws already permit; it can never
// widen that space. That is why `MS-DECLARATIVE` below rejects anything expression-shaped: a
// marketplace that ships formulas ships code execution, which is a security hole, a determinism
// hole, and an unfixable support burden.

// ─── kinds ────────────────────────────────────────────────────────────────────────────────────

export type ThingKind =
  | "material" | "edge" | "hinge" | "slide" | "leg" | "handle"
  | "joint" | "fit" | "role" | "param" | "profile" | "theme" | "machine" | "table"
  | "spacer" | "lift";

/** Units are MANDATORY on every numeric field, never conventional (DB/52 §4). A hinge spec from a
 *  US vendor arrives in inches eventually, and a unitless 0.63 is indistinguishable from a bug. */
export type Unit = "mm" | "deg" | "kg" | "kg/m3" | "count" | "ratio";

/** DB/51 D3 — a PLACING parameter is a number that positions geometry against a real surface, and
 *  it is meaningless without saying against WHICH surface, in which direction, and how it combines
 *  with the next one. "overlay 16" is not a fact until you know it is measured from the carcass
 *  side's outer face, inward-positive, and that two overlays ADD rather than one winning.
 *
 *  This is the difference between a number that survives being read by a second person and one
 *  that has to be reverse-engineered from whichever drawing happened to be open. */
export interface Frame {
  /** the part this is measured on, e.g. "carcass-side", "drawer-box" */
  of: string;
  /** the face it is measured FROM */
  datum: "outer" | "inner" | "front" | "back" | "top" | "bottom" | "centre";
  direction: "x" | "y" | "z";
  /** always stated, never conventional — the sign convention is where two shops disagree silently */
  sign: "inward-positive" | "outward-positive";
  /** what happens when two rules both contribute: add them, take the largest, or replace */
  compose: "add" | "max" | "replace";
}

export type Field =
  | { type: "number"; value: number; unit: Unit; domain?: { min?: number; max?: number }; frame?: Frame }
  | { type: "enum"; value: string; of: string[] }
  | { type: "text"; value: string }
  /** a uid of another Thing — never a filename (MS-UID) */
  | { type: "ref"; value: string }
  /** where computation is genuinely needed, a Thing NAMES an algorithm implemented in code.
   *  New algorithms ship with the engine, never with a download (DB/52 §7). */
  | { type: "algorithm"; value: string; of: string[] };

export interface ThingDef {
  /** namespaced: vendor.kind.slug */
  id: string;
  /** stable, opaque, never reused. Everything references THIS, so renaming a file breaks nothing. */
  uid: string;
  version: string;
  /** explicit, so a missing field added in schema 3 is migrated by a NAMED migration rather than
   *  by a silent default (DB/52 §4) */
  schema: number;
  kind: ThingKind;
  origin: {
    source: "builtin" | "marketplace" | "local";
    publisher?: string;
    signed?: boolean;
    /** set by `fork`; a publisher update never overwrites a fork (MS-FORK) */
    forkedFrom?: string;
  };
  name: Record<string, string>;
  /** retired Things vanish from pickers and still resolve for old projects (MS-RETIRE) */
  retired?: boolean;
  fields: Record<string, Field>;
}

/** A Thing is a FOLDER, not a file (DB/52 §2). The diagram is not attached to it — it is part of
 *  it, which is what makes Law E's diagram gate mechanical instead of aspirational. */
export interface ThingFolder {
  def: ThingDef;
  /** paths relative to the Thing's own folder, e.g. "diagram.svg", "examples/600-carcass.json" */
  files: string[];
  examples?: { name: string; fields: Record<string, number | string> }[];
}

export interface ThingProblem {
  law: string;
  uid?: string;
  id?: string;
  detail: string;
}

// ─── ownership: one fact, one file, one owner (DB/52 §6) ──────────────────────────────────────

/** The danger of many files is the same number living in two of them and drifting apart. A hinge
 *  declares a 3mm gap; a profile declares a 3mm gap; six months later one changes.
 *
 *  So each field name has exactly one owning kind. Every other Thing may REFERENCE it, never
 *  restate it — checked at publish, which is boring, mechanical, and the difference between a
 *  catalog and a swamp. */
export const OWNERSHIP: Record<string, ThingKind> = {
  thickness: "material",
  thicknessClass: "material",
  decor: "material",
  grain: "material",
  sheetLength: "material",
  sheetWidth: "material",
  density: "material",
  radius: "edge",
  overlay: "hinge",
  gap: "hinge",
  reveal: "hinge",
  cupDiameter: "hinge",
  openingAngle: "hinge", protrusionMm: "hinge",
  ceilingSweepMm: "lift", maxFrontWeightKg: "lift", minFrontHeightMm: "lift",
  cupDepth: "hinge",
  minCarcassHeight: "hinge",
  hingeClass: "hinge",
  clearancePerSide: "slide",
  allowedLengths: "slide",
  residual: "table",
  rank: "table", confirmatStaggerMm: "table",
  worktopFreeSpanMm: "table", shelfFreeSpanMm: "table", cutoutClearanceMm: "table",
  jointSearchRadiusMm: "table", cornerMitreClearMm: "table",
  clusterMaxMm: "table", seamStaggerMm: "table",
  frontGapMm: "table", roleEdges: "table", drawerGrooveMm: "table", drawerSideHeightMm: "table", slideBackGapMm: "table",
  hingeSteps: "table", crankSharedMm: "table",
  handleProtrusionMm: "table", cornerClearanceMm: "table", golaFillerMm: "table",
  minPassageMm: "table", comfortPassageMm: "table",
  overhangLimits: "table", overhangEndPostMm: "table", bracketPitchMm: "table",
  tipSafetyFactor: "table", childLoadKg: "table", claddingMinMm: "table",
  shadowGapMm: "table", chaseMinMm: "table", spineThicknessMm: "table",
  diningDepthMm: "table", jumboLengthMm: "table", jumboWidthMm: "table",
  chimneyAreaCm2: "table", chimneySetbackMm: "table", legsBaseCount: "table",
  legsHeavyCount: "table", heavyLoadKg: "table", legUnderSideMm: "table",
  applianceScribeMm: "table",
  miterBevelMm: "table", drawBoltCount: "table", alignDowelCount: "table",
  frontThicknessMm: "table",
  roleGrain: "table", roleNames: "table", handSuffix: "table", lockedYieldPct: "table", freeYieldPct: "table",
  clusterYieldPct: "table",
  spacerWidthMm: "spacer", side: "spacer",
  // the shop's own standards
  carcassThicknessMm: "profile", backThicknessMm: "profile", minCarcassMm: "profile",
  minFillerMm: "profile", minReservedMm: "profile", epsilonMm: "profile",
  residualPolicy: "profile", transportMaxMm: "profile", thicknessClasses: "profile",
  worktopDepthMm: "profile", shelfSetbackMm: "profile", heightBands: "profile", bandDepths: "profile",
  tieShelfAboveMm: "profile", tieShelfAtMm: "profile",
  stockLengths: "material", heightMm: "slide",
  defaultKromka: "profile", carcassMaterial: "profile",
  defaultHinge: "profile", innerDrawerInsetMm: "profile",
  // the machine that cuts them
  kerfMm: "machine", bandingConvention: "machine", partStepMm: "machine",
  // how the vocabulary is allowed to grow (V-VOCAB)
  promoteAfterUses: "table", vocabularyPolicy: "table", maxTypes: "table",
};

/** `edge.thickness` is the band's own thickness, not the board's — the same word, a different
 *  fact, and both are legitimate. Ownership is per (kind, field), so these are declared exempt
 *  rather than silently colliding. */
const OWNERSHIP_EXEMPT = new Set(["edge:thickness", "edge:material", "edge:radius"]);

// ─── validation ───────────────────────────────────────────────────────────────────────────────

const SEMVER = /^\d+\.\d+\.\d+$/;
const NAMESPACED = /^[a-z0-9]+(\.[a-z0-9-]+){2,}$/;

/** Anything expression-shaped. A downloaded Theme must not be able to invent behaviour — only
 *  choose among behaviours we have already proven (MS-DECLARATIVE, DB/52 §7).
 *
 *  The hyphen is deliberately NOT treated as an infix operator unless it is spaced. The first
 *  version included `-` in the operator class and rejected `full-overlay`, `leftmost-absorbs`,
 *  `into-corner`, `V-through` — i.e. most of the project's own vocabulary, since kebab-case is
 *  how every enum member here is written. A rule that rejects the catalog is worse than no rule:
 *  it teaches people to route around the check. */
const EXPRESSION_SHAPED = new RegExp(
  [
    "[{}$]",                                        // interpolation / template syntax
    "=>",                                            // a lambda
    "\\bfunction\\b|\\breturn\\b",                  // a function body
    "[a-zA-Z_)\\]]\\s*[+*/]\\s*[a-zA-Z0-9_(]",      // infix × ÷ + — never appear in kebab-case
    "[a-zA-Z0-9_)\\]]\\s+-\\s+[a-zA-Z0-9_(]",       // spaced subtraction: `width - 16`
  ].join("|"),
);

const LENGTH_UNITS = new Set<Unit>(["mm", "deg"]);

/** Fields that PLACE geometry, and therefore must declare a frame (D3). A limit or a tolerance —
 *  transportMaxMm, epsilonMm, kerfMm — is not placed against a datum and is deliberately not here:
 *  demanding a frame for a saw's blade width would be ceremony, and ceremony is what gets skipped. */
export const PLACING_PARAMS = new Set([
  "overlay", "gap", "reveal", "setback", "clearancePerSide", "cupDepth", "cupDiameter", "inset",
]);

/** DB/51 D6 — the geometric consequences a piece of hardware must DECLARE. A hinge that does not
 *  say what it does to the fasad is a hinge whose effect lives in engine code as a constant, and a
 *  new brand then means a release instead of a folder. */
export const HARDWARE_CONSEQUENCES: Partial<Record<ThingKind, string[]>> = {
  hinge: ["overlay", "gap", "reveal"],
  slide: ["clearancePerSide"],
};

/** What this hardware does to the geometry around it, read off the Thing. Nothing else in the
 *  engine may hold these numbers. */
export const hardwareConsequences = (def: ThingDef): Record<string, number> => {
  const want = HARDWARE_CONSEQUENCES[def.kind] ?? [];
  const out: Record<string, number> = {};
  for (const name of want) {
    const f = def.fields[name];
    if (f?.type === "number") out[name] = f.value;
  }
  return out;
};

/** Does this Thing carry any DIMENSIONAL field? If so it must ship a diagram (Law E). */
export const isDimensional = (def: ThingDef): boolean =>
  Object.values(def.fields).some((f) => f.type === "number" && LENGTH_UNITS.has(f.unit));

export function validateThing(folder: ThingFolder): ThingProblem[] {
  const { def, files } = folder;
  const out: ThingProblem[] = [];
  const at = (law: string, detail: string) => out.push({ law, uid: def.uid, id: def.id, detail });

  // header
  if (!NAMESPACED.test(def.id)) at("MS-UID", `id "${def.id}" is not namespaced as vendor.kind.slug`);
  if (!def.uid || def.uid.length < 8) at("MS-UID", `uid is missing or too short to be stable`);
  if (!SEMVER.test(def.version)) at("MS-FOLDER", `version "${def.version}" is not semver`);
  if (!Number.isInteger(def.schema)) at("MS-FOLDER", `schema must be an explicit integer, never implied`);
  if (Object.keys(def.name).length === 0) at("MS-FOLDER", `name has no translations`);

  // Law E — a dimensional Thing without its diagram cannot publish. A publication gate, not a
  // documentation aspiration: the picture is a required part of the Thing.
  if (isDimensional(def) && !files.includes("diagram.svg")) {
    at("E-DIAGRAM", `carries dimensional fields but ships no diagram.svg — cannot publish`);
  }

  // D6 — hardware declares its geometric consequences, or it cannot publish. This is the gate
  // that keeps a new hinge brand a folder rather than a release.
  for (const name of HARDWARE_CONSEQUENCES[def.kind] ?? []) {
    const f = def.fields[name];
    if (!f || f.type !== "number") {
      at("D6", `a ${def.kind} must declare "${name}" as a number — its geometric consequence cannot live in engine code`);
    }
  }

  for (const [name, f] of Object.entries(def.fields)) {
    // units mandatory (DB/52 §4)
    if (f.type === "number") {
      if (!f.unit) at("MS-FOLDER", `field "${name}" has a number with no unit`);
      // D3 — a placing parameter without its frame is a number nobody can act on
      if (PLACING_PARAMS.has(name) && !f.frame) {
        at("D3", `field "${name}" places geometry but declares no frame — datum face, direction, sign and composition mode are all required`);
      }
      if (f.domain?.min !== undefined && f.value < f.domain.min)
        at("D9", `field "${name}" is ${f.value}, below its declared minimum ${f.domain.min}`);
      if (f.domain?.max !== undefined && f.value > f.domain.max)
        at("D9", `field "${name}" is ${f.value}, above its declared maximum ${f.domain.max}`);
    }
    if (f.type === "enum" && !f.of.includes(f.value))
      at("D7", `field "${name}" is "${f.value}", which is not one of its declared members`);
    if (f.type === "algorithm" && !f.of.includes(f.value))
      at("MS-DECLARATIVE", `field "${name}" names algorithm "${f.value}", which is not a permitted member`);

    // declarative only
    if ((f.type === "text" || f.type === "enum" || f.type === "algorithm" || f.type === "ref") &&
        EXPRESSION_SHAPED.test(String(f.value))) {
      at("MS-DECLARATIVE", `field "${name}" looks like an expression; Things hold values, enums and references only`);
    }

    // one fact, one owner
    const owner = OWNERSHIP[name];
    if (owner && owner !== def.kind && !OWNERSHIP_EXEMPT.has(`${def.kind}:${name}`)) {
      at("MS-OWNER", `field "${name}" is owned by kind "${owner}"; a ${def.kind} may reference it, never restate it`);
    }
  }

  // examples/ must pass to publish — the regression corpus builds itself, one Thing at a time
  for (const ex of folder.examples ?? []) {
    for (const [name, value] of Object.entries(ex.fields)) {
      const f = def.fields[name];
      if (!f) { at("MS-FOLDER", `example "${ex.name}" sets unknown field "${name}"`); continue; }
      if (f.type === "number" && typeof value === "number") {
        if (f.domain?.min !== undefined && value < f.domain.min)
          at("MS-FOLDER", `example "${ex.name}" sets ${name}=${value}, below the declared minimum`);
        if (f.domain?.max !== undefined && value > f.domain.max)
          at("MS-FOLDER", `example "${ex.name}" sets ${name}=${value}, above the declared maximum`);
      }
    }
  }

  return out;
}

// ─── the index ────────────────────────────────────────────────────────────────────────────────

export interface ThingIndex {
  byUid: Map<string, ThingFolder>;
  byId: Map<string, ThingFolder>;
  problems: ThingProblem[];
}

/** Built once, queried by uid. A serious catalog is thousands of Things: directory scans and
 *  eyeballing stop working early, so folders are storage and the index is the interface
 *  (DB/52 §10). */
export function buildIndex(folders: ThingFolder[]): ThingIndex {
  const byUid = new Map<string, ThingFolder>();
  const byId = new Map<string, ThingFolder>();
  const problems: ThingProblem[] = [];

  for (const f of folders) {
    problems.push(...validateThing(f));
    if (byUid.has(f.def.uid))
      problems.push({ law: "MS-UID", uid: f.def.uid, detail: `uid ${f.def.uid} is used by two Things` });
    byUid.set(f.def.uid, f);
    byId.set(f.def.id, f);
  }

  problems.push(...cycleProblems(byUid));
  return { byUid, byId, problems };
}

/** The reference graph must be acyclic, CHECKED AT PUBLISH — Type A → Type B → Type A is rejected
 *  when it is published, not discovered when a customer opens a file (DB/52 §10). */
export function cycleProblems(byUid: Map<string, ThingFolder>): ThingProblem[] {
  const out: ThingProblem[] = [];
  const state = new Map<string, "open" | "done">();

  const walk = (uid: string, trail: string[]): void => {
    if (state.get(uid) === "done") return;
    if (state.get(uid) === "open") {
      out.push({ law: "MS-ACYCLIC", uid, detail: `reference cycle: ${[...trail, uid].join(" → ")}` });
      return;
    }
    state.set(uid, "open");
    const thing = byUid.get(uid);
    for (const f of Object.values(thing?.def.fields ?? {})) {
      if (f.type === "ref") walk(f.value, [...trail, uid]);
    }
    state.set(uid, "done");
  };

  for (const uid of byUid.keys()) walk(uid, []);
  return out;
}

/** Only publishable Things may be published. The gate is mechanical: no diagram, no publish. */
export const canPublish = (folder: ThingFolder): boolean => validateThing(folder).length === 0;

/** Retired Things vanish from pickers and still resolve by uid, because deleting a material that
 *  400 projects reference is not a feature (MS-RETIRE). */
export const pickable = (index: ThingIndex, kind?: ThingKind): ThingFolder[] =>
  [...index.byUid.values()].filter((f) => !f.def.retired && (!kind || f.def.kind === kind));

export const resolve = (index: ThingIndex, uid: string): ThingFolder | undefined => index.byUid.get(uid);

export function retire(index: ThingIndex, uid: string): ThingIndex {
  const hit = index.byUid.get(uid);
  if (!hit) return index;
  const next = new Map(index.byUid);
  next.set(uid, { ...hit, def: { ...hit.def, retired: true } });
  return { ...index, byUid: next, byId: new Map([...index.byId].map(([k, v]) => [k, v.def.uid === uid ? next.get(uid)! : v])) };
}

/** Editing a downloaded Thing does not modify it in place — it FORKS. A publisher update then
 *  offers a three-way diff instead of silently overwriting local work (MS-FORK). This is what
 *  makes "can be changed locally" safe rather than a trap. */
export function fork(folder: ThingFolder, newUid: string, edits: Partial<Record<string, Field>> = {}): ThingFolder {
  return {
    ...folder,
    def: {
      ...folder.def,
      uid: newUid,
      version: "1.0.0",
      origin: { source: "local", forkedFrom: `${folder.def.id}@${folder.def.version}` },
      fields: { ...folder.def.fields, ...edits } as Record<string, Field>,
    },
  };
}
