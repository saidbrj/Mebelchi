// ПОЛИГОН · T11 — Release: where the model stops being a design and becomes wood.
//
// The founder asked for a step showing final sizes with deep zoom and vector kromka. All of that
// is right, and all of it is the byproduct (`53` §0):
//
//   > Release is where the model is AUDITED and BOUND TO REAL MATERIAL. The drawing is what falls
//   > out of it.
//
// Build only the zoom and the pretty edges and you have built a nicer picture of the same
// uncertainty. Three things happen here that cannot happen during design:
//
//   1. Nominal becomes actual — "a board" becomes 15.8mm of a named decor with named banding.
//   2. FINISHED becomes CUT. This is the single most common real-world error in furniture CAD:
//      a fasad banded 2mm on four edges is CUT 4mm smaller than its finished size, and the
//      convention differs between two workshops using the same file. If the app never declares
//      which, every job is wrong by twice the band thickness.
//   3. Completeness is checked — the pre-flight list, which is worth more than the visualisation.

import { LENGTH_EDGES, type Facets } from "./facets";
import { decomposeLaminate, type LaminatedPart } from "./laminate";
import type { StockSplitBoard } from "./pipeline";
import { ROLE_EDGES } from "./settings";
import type { FillPart } from "./fill";
import { resolve, type Rule } from "./cascade";
import type { Board } from "./runs";
import { resolveJunctions } from "./junctions";
import { transportCheck } from "./runs";
import { resolvePositions, type Sheet, type SheetProfile } from "./sheet";

// ─── the shop, and the plane it cuts in ───────────────────────────────────────────────────────

/** `53` §1 — the convention is a SHOP setting on the output stage, so the same file cuts correctly
 *  in two different workshops. It is never a property of the design. */
export type BandingConvention =
  /** the board is sawn undersize and the band brings it up to finished size */
  | "cut-undersize"
  /** the board is sawn at finished size and the band is trimmed flush */
  | "band-then-trim";

export interface ShopConvention {
  banding: BandingConvention;
  kerfMm: number;
  /** parts resolution — design positions are integer mm, cut arithmetic needs tenths (`53` §5) */
  stepMm: 0.1 | 1;
}

// The saw's numbers live in `things/machines/qorasu-saw/def.json`, read by `settings.ts`.
// Import SHOP_MACHINE — there is no default here to drift from the file.

/** A left side and a right side are MIRROR parts the moment one edge is banded or one face is
 *  drilled. `2× side 720×560` with no handedness means the shop bands the wrong edge on one of
 *  them (`53` §5). Required, never optional. */
export type Hand = "left" | "right" | "none";

/** Not a phase — data quality. A release against a wall nobody measured is how a job gets cut
 *  against a guess, and that is a whole sheet of material (`53` §1). */
export type WallMeasurement = "measured" | "estimated";

// ─── the three planes ─────────────────────────────────────────────────────────────────────────

/** `53` §1 — one board carries THREE sizes, and confusing any two of them is a re-cut. The founder
 *  asked for all three, with the choice left to the user:
 *
 *    NOMINAL   what you dragged. Centreline to centreline. The design's own number — the one that
 *              reads 1800 because you typed 1800.
 *    FINISHED  what the assembled piece measures, after the junctions decided who runs through and
 *              who butts. Smaller than nominal by the neighbouring board thicknesses.
 *    CUT       what the saw is set to, after the banding convention. Smaller than finished under
 *              `cut-undersize`, equal to it under `band-then-trim`.
 *
 *  They are not alternative opinions and the app never picks one silently: nominal explains the
 *  design, finished is what a tape measure will find, cut is what goes to the machine. */
export type Plane = "nominal" | "finished" | "cut";

export const PLANES: readonly Plane[] = ["nominal", "finished", "cut"] as const;

/** Russian labels, since Полигон and the app both speak Russian to the shop. */
export const PLANE_LABEL: Record<Plane, string> = {
  nominal: "Размер в макете",
  finished: "Готовый размер",
  cut: "Размер реза",
};

export function sizeOn(part: Part, plane: Plane): number {
  return plane === "nominal" ? part.nominalMm : plane === "finished" ? part.finishedMm : part.cutMm;
}

/** Which edges of this part carry a band, for the finished-plane drawing. The founder asked to
 *  "show where kromka should be" — that is this, not a number in a column. Index matches
 *  `Facets.edgeExposure`, named here so a drawing can put the band on the right side of the
 *  board rather than on whichever edge came out of the array first. */
const EDGE_NAME = ["низ/лево", "верх/право", "фасадная кромка", "к стене"] as const;

export function bandedEdges(part: Part): { edge: number; name: string; band: string }[] {
  return part.banding
    .map((band, edge) => ({ edge, name: EDGE_NAME[edge] ?? `край ${edge}`, band: band ?? "" }))
    .filter((e) => e.band !== "" && Number.parseFloat(e.band) > 0);
}

// ─── parts ────────────────────────────────────────────────────────────────────────────────────

export interface Part {
  /** assigned at release, never reused within a job. Staff write these on the wood in pencil —
   *  renumbering is not a UI annoyance, it is scrap (`53` §2). */
  no: number;
  /** structural identity, carried from the Board: role + bounding line ids */
  id: string;
  role: string;
  hand: Hand;
  grain: string;
  material?: string;
  /** PLANE 1 · NOMINAL — the number the design is expressed in: centreline to centreline of the
   *  two lines this board runs between. This is what you drag and what the UI shows.
   *
   *  It is NOT an upper bound on the finished size, and assuming it was is a mistake this file
   *  made until a real kitchen was run through it. A side that runs THROUGH the bottom board at
   *  its end finishes flush with that board's underside — 8mm PAST the centreline it nominally
   *  runs to. Nominal 2400, finished 2408, and both are right. The three planes are three
   *  different measurements of one board, not a descending chain. */
  nominalMm: number;
  /** PLANE 2 · MODEL — the finished size, after junction arithmetic decided which board runs
   *  through and which butts. The sheet's truth, and the plane Law D governs. */
  finishedMm: number;
  thicknessMm: number;
  /** The part's SECOND dimension — its width across the run. A part is a rectangle, and a cut
   *  list carrying one number per part is a list nobody can nest: you cannot lay 600mm on a sheet
   *  without knowing whether it is 560 or 300 wide.
   *
   *  It comes from the cascade's `depth`, resolved per board (L-DEPTH), less the shelf setback
   *  where a shelf sits inside a carcass rather than spanning it. */
  widthMm: number;
  /** PLANE 3 · CUT — what the saw is set to, after the banding convention. Terminal: nothing
   *  downstream feeds back into the model. */
  cutMm: number;
  /** the band on each edge, resolved through the cascade */
  banding: (string | undefined)[];
  /** R76 — set when this part is GLUED from blanks rather than cut as one. The wall sees one
   *  panel of `thicknessMm`; the saw sees `laminate.blanks`. Both are in the release, because a
   *  release that carried only one of them would send either the wrong sizes or the wrong count. */
  laminate?: LaminatedPart;
  overriddenBy?: string;
}

export interface PreflightItem {
  law: string;
  detail: string;
  partNo?: number;
}

export interface Release {
  number: number;
  /** Total material the blade removes across the job. The kerf does NOT change a part's size —
   *  a 600 part cut from a sheet is still 600, the blade eats the gap BETWEEN parts — so it is
   *  reported here, against yield, rather than subtracted from anything. Stating which reading
   *  was taken matters: the other reading (shrinking each part by the kerf) is a common and
   *  expensive mistake. */
  kerfTotalMm: number;
  /** supplied by the caller so this stays a pure function of its inputs */
  at: string;
  /** deterministic over the part list — a release is hash-verifiable without the engine that made
   *  it, which is what makes a reprint unconditional (`59` §3.4) */
  hash: string;
  convention: ShopConvention;
  parts: Part[];
  preflight: PreflightItem[];
}

/** An override lives OUTSIDE the model, keyed to part identity, and is re-validated on every
 *  derive. Numeric overrides default to DELTAS: "50 less than its group" survives a later global
 *  change, where "510" orphans the moment the group moves (`53` §4). */
export interface Override {
  partId: string;
  deltaMm: number;
  note?: string;
}

// ─── derivation ───────────────────────────────────────────────────────────────────────────────

/** Which hand is this board? Derived from which of its faces ended up exposed — that is exactly
 *  what decides where the band and the drilling go, so it is the honest source. A board exposed
 *  on both sides or neither is not half of a mirror pair. */
function handOf(f: Facets): Hand {
  if (f.axis !== "v") return "none";
  const [low, high] = f.edgeExposure;
  if (low === "exposed" && high !== "exposed") return "right"; // room is on the low side
  if (high === "exposed" && low !== "exposed") return "left";
  return "none";
}

/** finished → cut, for ONE dimension. `bands` must be only the bands on the two edges that bound
 *  that dimension — for a length, the two ends of the run (`LENGTH_EDGES`). Passing all four edges
 *  subtracts the front band from the length, which is 2mm of missing board in a direction nobody
 *  banded. The band is subtracted only under the convention that saws undersize. */
export function cutSize(finishedMm: number, bands: (string | undefined)[], shop: ShopConvention): number {
  if (shop.banding === "band-then-trim") return round(finishedMm, shop.stepMm);
  const total = bands.reduce<number>((sum, b) => sum + (b ? Number.parseFloat(b) || 0 : 0), 0);
  return round(finishedMm - total, shop.stepMm);
}

const round = (v: number, step: number) => Math.round(v / step) * step;

/** Numbers are STABLE across releases: a part with the same structural identity keeps its number,
 *  a new part takes the next free one, and a vanished part's number is never handed to anything
 *  else (`53` §2). */
export function assignNumbers(ids: string[], previous?: Release): Map<string, number> {
  const out = new Map<string, number>();
  const taken = new Set<number>();

  for (const p of previous?.parts ?? []) {
    if (ids.includes(p.id)) { out.set(p.id, p.no); taken.add(p.no); }
    else taken.add(p.no); // retired, and its number is retired with it
  }
  let next = 1;
  for (const id of ids) {
    if (out.has(id)) continue;
    while (taken.has(next)) next++;
    out.set(id, next);
    taken.add(next);
  }
  return out;
}

/** FNV-1a over the part list. Deterministic, so the same design and the same lock produce the same
 *  hash on another machine a year later — the property that makes a release a document rather than
 *  a query whose answer drifts. */
function hashOf(parts: Part[]): string {
  const text = parts.map((p) => `${p.no}|${p.id}|${p.cutMm}×${p.widthMm}|${p.thicknessMm}|${p.banding.join(",")}`).join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export interface ReleaseInput {
  sheet: Sheet;
  profile: SheetProfile;
  boards: Board[];
  /** R84 — доски, ПРОШЕДШИЕ предел листа. Спецификация строится из них, а не из сырых прогонов:
   *  метку ставит ровно одна функция, поэтому неразрезанный прогон сюда не передать. Раньше
   *  release читал `boards` напрямую, и доска 4481 мм спокойно доезжала до пилы. */
  split: StockSplitBoard[];
  /** R86 — детали наполнения: фасады, ящики, полки, задние стенки. */
  fillParts?: FillPart[];
  facets: Map<string, Facets>;
  rules: Rule[];
  shop: ShopConvention;
  wall: WallMeasurement;
  overrides?: Override[];
  /** how much shallower a shelf is than its carcass — from the profile file */
  shelfSetbackMm?: number;
  /** PHYS-RACK — structural tie shelves the engine derived. They are PARTS: they get a number, a
   *  band and a place on the sheet, because a warning gets dismissed and a missing part does not. */
  tieShelves?: { carcass: string; atMm: number; widthMm: number; reason: string }[];
  previous?: Release;
  number: number;
  at: string;
  /** Required, not defaulted. A transport limit is a shop fact; guessing 2000 in a `??` would
   *  have been a construction setting hiding in punctuation. */
  maxModuleWidthMm: number;
}

export function release(input: ReleaseInput): Release {
  const { sheet, facets, rules, shop, overrides = [], previous, shelfSetbackMm = 0 } = input;

  // CANONICAL ORDER, before anything is numbered or hashed. `deriveBoards` walks `sheet.lines`,
  // so its output order follows the order the lines happen to be listed in — which is an accident
  // of how the sheet was built, not a fact about the design. Left alone, the same wall written two
  // ways produced two different hashes and, worse, renumbered every part: staff write those
  // numbers on the wood in pencil, so a reordering that changes nothing physical would send
  // someone looking for part 3 and finding the worktop.
  //
  // The structural id is the right key: it is role plus bounding lines, so it is stable across
  // every edit that does not change what the board IS. (Found by the FDL round-trip test, which
  // is exactly the kind of thing a second authoring surface is worth having for.)
  const boards = [...input.boards].sort((a, b) => a.id.localeCompare(b.id));
  const bySource = new Map(boards.map((b) => [b.id, b]));

  // Куски идут в том же каноническом порядке, что и их прогоны, а внутри прогона — по месту
  // вдоль него. Порядок не должен зависеть от того, как строился лист (см. ниже).
  const pieces = [...input.split].sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || a.fromMm - b.fromMm,
  );
  const numbers = assignNumbers(pieces.map((p) => p.id), previous);
  const preflight: PreflightItem[] = [];

  const { mm } = resolvePositions(sheet);

  const parts: Part[] = pieces.map((piece) => {
    const b = bySource.get(piece.sourceId)!;
    const f = facets.get(piece.sourceId)!;
    // PLANE 1 — centreline to centreline: the number a person dragged to, before any junction
    // arithmetic. Showing it beside the finished size is what makes "why is my 1800 worktop
    // 1784?" answerable without opening the engine.
    const whole = piece.id === b.id;
    const nominal = whole
      ? Math.abs((mm.get(b.ends.to) ?? 0) - (mm.get(b.ends.from) ?? 0))
      : piece.cutLengthMm;
    const banding = f.edgeExposure.map((state) => {
      try {
        return String(resolve(b.id, { ...f, edgeExposure: [state] }, "kromka", rules).value);
      } catch {
        preflight.push({
          law: "REL-PREFLIGHT",
          detail: `board ${b.id} has an edge with no kromka assigned`,
          partNo: numbers.get(b.id),
        });
        return undefined;
      }
    });

    const ov = overrides.find((o) => o.partId === piece.id || o.partId === b.id);
    const finished = round(piece.cutLengthMm + (ov?.deltaMm ?? 0), shop.stepMm);

    let grain = "none";
    try { grain = String(resolve(b.id, f, "texture", rules).value); } catch { /* falls to preflight */ }

    // The MATERIAL, like every other value, comes from the cascade — the segment may name one, and
    // otherwise the shop's profile does (`sys-material`, read from the profile file). It used to
    // be taken from the segment alone, so a board nobody had explicitly assigned came out with no
    // material at all: unbuyable, un-nestable, and silently skipped by the sheet check. Law E says
    // every value reaching an output is declared somewhere; the profile IS that somewhere.
    let material = b.material;
    if (!material) {
      try { material = String(resolve(b.id, f, "material", rules).value); } catch { /* preflight */ }
    }

    let width = 0;
    try {
      const depth = Number(resolve(b.id, f, "depth", rules).value) || 0;
      // a shelf sits inside the carcass: back panel behind it, fingers in front of it
      width = b.role === "shelf" ? depth - shelfSetbackMm : depth;
    } catch {
      preflight.push({
        law: "REL-PREFLIGHT",
        detail: `board ${b.id} has no depth — it cannot be nested on a sheet`,
        partNo: numbers.get(b.id),
      });
    }

    return {
      no: numbers.get(piece.id)!,
      id: piece.id,
      role: b.role,
      hand: handOf(f),
      grain,
      material,
      ...(b.lamination
        ? {
            laminate: decomposeLaminate({
              partId: String(numbers.get(piece.id)!),
              lengthMm: round(finished, shop.stepMm),
              faceWidthMm: round(width, shop.stepMm),
              lamination: b.lamination,
              profile: input.profile,
              grain,
              thinBand: String(banding[LENGTH_EDGES[0]] ?? ""),
            }),
          }
        : {}),
      nominalMm: round(nominal, shop.stepMm),
      finishedMm: finished,
      widthMm: round(width, shop.stepMm),
      thicknessMm: b.thicknessMm,
      cutMm: cutSize(finished, LENGTH_EDGES.map((e) => banding[e]), shop),
      banding,
      overriddenBy: ov ? `${ov.deltaMm > 0 ? "+" : ""}${ov.deltaMm}mm${ov.note ? ` · ${ov.note}` : ""}` : undefined,
    };
  });

  // R86 — наполнение: фасады, ящики, полки, задние стенки. Это НЕ каркас, поэтому номера идут
  // после каркасных: мастер читает пачку сверху вниз и собирает в том же порядке.
  // кромки берутся из тех же правил, что решают кромку каркаса
  const bandFor = (state: "exposed" | "hidden"): string | undefined => {
    const sample = [...facets.values()][0];
    if (!sample) return undefined;
    try {
      return String(resolve("fill", { ...sample, edgeExposure: [state] }, "kromka", rules).value);
    } catch { return undefined; }
  };
  const exposedBand = bandFor("exposed");
  const hiddenBand = bandFor("hidden");

  let fillNo = parts.reduce((m, p) => Math.max(m, p.no), 0);
  for (const fp of input.fillParts ?? []) {
    parts.push({
      no: ++fillNo,
      id: `${fp.cabinet}:${fp.role}:${fillNo}`,
      role: fp.role,
      hand: "none",
      grain: "none",
      material: parts[0]?.material,
      nominalMm: round(fp.lengthMm, shop.stepMm),
      finishedMm: round(fp.lengthMm, shop.stepMm),
      widthMm: round(fp.widthMm, shop.stepMm),
      thicknessMm: fp.thicknessMm,
      cutMm: round(fp.lengthMm, shop.stepMm),
      // R86 — кромка наполнения. Видимость торца объявлена по роли в файле; ТОЛЩИНУ решает то
      // же правило каскада, что и для каркаса, поэтому второго источника правды нет. Раньше
      // здесь стояли четыре undefined, и в деталировке у всех фасадов был прочерк.
      banding: (ROLE_EDGES[fp.role] ?? ["hidden", "hidden", "hidden", "hidden"]).map((e) =>
        e === "exposed" ? exposedBand : e === "hidden" ? hiddenBand : undefined),
      overriddenBy: fp.note,
    });
  }

  // PHYS-RACK — the derived tie shelves join the part list. Numbered after the derived boards so
  // an authored design keeps its numbering stable when one is added.
  let tieNo = parts.reduce((m, p) => Math.max(m, p.no), 0);
  for (const t of input.tieShelves ?? []) {
    parts.push({
      no: ++tieNo,
      id: `tie:${t.carcass}@${t.atMm}`,
      role: "shelf",
      hand: "none",
      grain: "none",
      material: parts[0]?.material,
      nominalMm: round(t.widthMm, shop.stepMm),
      finishedMm: round(t.widthMm, shop.stepMm),
      widthMm: round((parts[0]?.widthMm ?? 0) - (shelfSetbackMm ?? 0), shop.stepMm),
      thicknessMm: input.profile.boardMm,
      cutMm: round(t.widthMm, shop.stepMm),
      banding: [undefined, undefined, undefined, undefined],
      overriddenBy: t.reason,
    });
    preflight.push({
      law: "PHYS-RACK", partNo: tieNo,
      detail: `деталь ${tieNo} — стяжная полка для «${t.carcass}» на ${t.atMm}мм. ${t.reason}`,
    });
  }

  // ── pre-flight: everything that produces no parts but might need to ─────────────────────────

  if (input.wall === "estimated") {
    preflight.push({
      law: "REL-PREFLIGHT",
      detail:
        "this wall is still marked ESTIMATED, not measured. Releasing against a guessed wall is " +
        "how a job gets cut to the wrong length — measure it, or accept the risk explicitly.",
    });
  }

  for (const r of sheet.blocks.filter((b) => b.kind === "reserved")) {
    preflight.push({
      law: "REL-PREFLIGHT",
      detail: `reserved space "${r.id}" produces no parts — is a filler or scriber decided for it?`,
    });
  }

  for (const v of resolveJunctions(sheet, sheet.junctionOverrides ?? []).violations) {
    preflight.push({ law: v.law, detail: v.detail });
  }

  const transport = transportCheck(boards, input.maxModuleWidthMm);
  for (const b of transport.over) {
    preflight.push({
      law: "REL-PREFLIGHT",
      detail: `board ${b.id} is ${b.lengthMm}mm — over the transport limit. Unshare a seam to split the module.`,
      partNo: numbers.get(b.id),
    });
  }

  // an override whose part no longer exists must SURFACE, never silently apply or disappear
  for (const o of overrides) {
    if (!boards.some((b) => b.id === o.partId)) {
      preflight.push({
        law: "REL-OVERRIDE",
        detail: `an override of ${o.deltaMm}mm targets ${o.partId}, which no longer exists — orphaned, not dropped`,
      });
    }
  }

  for (const p of parts) {
    if (p.grain === "none" && p.material) {
      preflight.push({ law: "REL-HANDED", detail: `part ${p.no} has no grain direction declared`, partNo: p.no });
    }
  }

  // one kerf per cut; a part needs a cut at each end of its length
  const kerfTotalMm = round(parts.length * 2 * shop.kerfMm, 0.1);

  return {
    number: input.number, at: input.at, hash: hashOf(parts),
    kerfTotalMm, convention: shop, parts, preflight,
  };
}

// ─── the diff — the most valuable artefact in the product (`53` §2) ───────────────────────────

export interface PartDiff {
  appeared: Part[];
  vanished: Part[];
  grew: { no: number; id: string; fromMm: number; toMm: number }[];
  unchanged: number;
}

/** The expensive question in a working shop is never "what are the sizes". It is *"we already cut
 *  forty of these — what actually changed?"* Boards that grew, boards that appeared, boards that
 *  vanished. Nothing else here saves as much material. */
export function diffReleases(a: Release, b: Release): PartDiff {
  const byId = (r: Release) => new Map(r.parts.map((p) => [p.id, p]));
  const before = byId(a), after = byId(b);

  const appeared = b.parts.filter((p) => !before.has(p.id));
  const vanished = a.parts.filter((p) => !after.has(p.id));
  const grew: PartDiff["grew"] = [];
  let unchanged = 0;

  for (const p of b.parts) {
    const was = before.get(p.id);
    if (!was) continue;
    if (was.cutMm !== p.cutMm) grew.push({ no: p.no, id: p.id, fromMm: was.cutMm, toMm: p.cutMm });
    else unchanged++;
  }
  return { appeared, vanished, grew, unchanged };
}
