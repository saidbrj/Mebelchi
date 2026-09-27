// ПОЛИГОН · V-CORPUS — the gate that is not made of code.
//
// `59` §3.3: a corpus of ~50 REAL cut walls, admitted by a person, is the independent validation
// gate. Generated cases never substitute for it, and admissions are capped at ~10 per quarter.
//
// The cap looks like bureaucracy and is not. A corpus that grows by fifty cases in a week is a
// corpus somebody batch-imported, which means nobody read them, which means it is a regression
// suite wearing a validation gate's clothes. Ten a quarter is the rate at which a person can
// actually look at a wall, compare it to what the shop cut, and say "yes, this is what happened".
//
// So this module holds the MECHANISM. The corpus itself is `src/poligon/corpus/`, one FDL document
// per real job with a record of what the shop actually cut. It starts at job one, not version one:
// the law stays deferred in the registry until real walls are in that folder, because a harness
// with an empty corpus proves nothing and claiming otherwise is the half-proof the registry
// exists to catch.

import { parse } from "./fdl";
import type { Sheet } from "./sheet";

export interface CorpusJob {
  /** the real job — a customer, a date, an invoice. Never "case_017". */
  id: string;
  admittedAt: string;
  /** who looked at this wall and confirmed it matches what the shop cut */
  admittedBy: string;
  /** REAL means a wall that was actually cut. Anything else cannot be admitted. */
  origin: "cut-job" | "generated";
  /** the design, as FDL */
  fdl: string;
  /** what came off the saw: part number → cut length in mm */
  cut: Record<string, number>;
}

/** Одна работа на диске: папка с job.json и wall.mebl рядом. */
export interface CorpusFolder {
  dir: string;
  job: Omit<CorpusJob, "fdl" | "cut">;
  fdl: string;
  cut: Record<string, number>;
}

export interface CorpusProblem {
  law: string;
  job?: string;
  detail: string;
}

export const QUARTERLY_ADMISSION_CAP = 10;
export const TARGET_SIZE = 50;

const quarterOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
};

export function corpusProblems(jobs: CorpusJob[]): CorpusProblem[] {
  const out: CorpusProblem[] = [];

  for (const j of jobs) {
    if (j.origin !== "cut-job") {
      out.push({
        law: "V-CORPUS", job: j.id,
        detail:
          `"${j.id}" is ${j.origin} — a generated case never substitutes for a real cut wall. ` +
          `Generated cases belong in the test suite, which is a different gate.`,
      });
    }
    if (!j.admittedBy) {
      out.push({ law: "V-CORPUS", job: j.id, detail: `"${j.id}" has no admitting person — the gate is human by definition` });
    }
    try { parse(j.fdl); }
    catch (e) { out.push({ law: "V-CORPUS", job: j.id, detail: `"${j.id}" does not parse: ${(e as Error).message}` }); }
  }

  const perQuarter = new Map<string, number>();
  for (const j of jobs) {
    const q = quarterOf(j.admittedAt);
    perQuarter.set(q, (perQuarter.get(q) ?? 0) + 1);
  }
  for (const [q, n] of perQuarter) {
    if (n > QUARTERLY_ADMISSION_CAP) {
      out.push({
        law: "V-CORPUS",
        detail:
          `${n} jobs admitted in ${q}, over the cap of ${QUARTERLY_ADMISSION_CAP}. ` +
          `A corpus that grows faster than a person can read it is a regression suite wearing a ` +
          `validation gate's clothes.`,
      });
    }
  }
  return out;
}

export interface CorpusStatus {
  admitted: number;
  target: number;
  /** how far off the gate is — reported as a fraction, never rounded up to "ready" */
  ready: boolean;
}

export const corpusStatus = (jobs: CorpusJob[]): CorpusStatus =>
  ({ admitted: jobs.length, target: TARGET_SIZE, ready: jobs.length >= TARGET_SIZE });

/** Replay one job: does the engine, today, produce the lengths the shop actually cut? This is the
 *  only question the corpus asks, and it is the one no unit test can ask. */
export function replay(
  job: CorpusJob, cutList: (sheet: Sheet) => Record<string, number>,
): { job: string; ok: boolean; mismatches: { part: string; shop: number; engine: number }[] } {
  const engine = cutList(parse(job.fdl));
  const mismatches = Object.entries(job.cut)
    .filter(([part, mm]) => engine[part] !== mm)
    .map(([part, mm]) => ({ part, shop: mm, engine: engine[part] ?? Number.NaN }));
  return { job: job.id, ok: mismatches.length === 0, mismatches };
}
