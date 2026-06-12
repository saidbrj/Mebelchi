// npm run bench — the performance regression gate (doc 18 §3).
// Benchmarks SWJ008 parse, canonicalization, export, and solveFull over the FULL
// golden suite. Reports median + p95 over >=20 measured runs after warmup.
// Measurement only: no engine code is touched by this file.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cpus, arch, platform } from "node:os";
import { it } from "vitest";

import {
  canonicalizeParts,
  exportSWJ008,
  parseSWJ008,
  solveFull,
  type Part,
  type Project,
} from "../engine/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "..", "tests", "golden", "xml");
// Scale reference: one full factory project (64 panels / 710 ops), read in place
// from the committed dump. Goldens prove correctness; this answers "what does a
// real project cost", so PERF_LEDGER deltas have a realistic denominator.
const SCALE_DIR = join(HERE, "..", "Example sets", "prop-0");

const WARMUP_RUNS = 30;
const MEASURED_RUNS = 100; // >= 20 required by the session spec

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

async function measure(label: string, fn: () => unknown | Promise<unknown>) {
  for (let i = 0; i < WARMUP_RUNS; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    median: quantile(samples, 0.5),
    p95: quantile(samples, 0.95),
    runs: MEASURED_RUNS,
  };
}

async function benchSuite(
  label: string,
  dir: string,
  fileFilter: RegExp | null,
  includeSolveFull: boolean,
) {
  const xmlFiles = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.toUpperCase().endsWith(".XML"))
    .filter((f) => !fileFilter || fileFilter.test(f))
    .sort();
  const xmls = xmlFiles.map((f) => readFileSync(join(dir, f), "utf8"));

  // Pre-parsed inputs for the downstream stages (so each stage is measured alone).
  const partsPerFile: Part[][] = xmls.map((x) => parseSWJ008(x));
  const projects: Project[] = partsPerFile.map((parts, i) => ({
    id: `bench_${i}`,
    name: xmlFiles[i]!,
    parts,
  }));

  const rows = [
    await measure(`parseSWJ008 (${label})`, () => {
      for (const x of xmls) parseSWJ008(x);
    }),
    await measure(`canonicalizeParts (${label})`, () => {
      for (const p of partsPerFile) canonicalizeParts(p);
    }),
    await measure(`exportSWJ008 (${label})`, () => {
      for (const p of projects) exportSWJ008(p);
    }),
  ];
  if (includeSolveFull) {
    rows.push(
      await measure(`solveFull (${label})`, async () => {
        for (const p of projects) await solveFull(p);
      }),
    );
  }

  const cpu = cpus()[0]?.model ?? "unknown";
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `\nBENCH — ${label}: ${xmlFiles.length} files, ` +
      `${partsPerFile.flat().length} panels, ` +
      `${partsPerFile.flat().reduce((n, p) => n + p.operations.length, 0)} ops` +
      `\nnode ${process.version} | ${platform()}/${arch()} | ${cpu}` +
      `\nwarmup ${WARMUP_RUNS}, measured ${MEASURED_RUNS}\n\n` +
      pad("operation", 40) + pad("median ms", 12) + "p95 ms\n" +
      rows
        .map((r) => pad(r.label, 40) + pad(r.median.toFixed(3), 12) + r.p95.toFixed(3))
        .join("\n") +
      "\n",
  );
}

// BENCH_FILTER (optional regex) restricts a suite — used for apples-to-apples
// ledger deltas when the golden suite itself grows.
const filter = process.env.BENCH_FILTER ? new RegExp(process.env.BENCH_FILTER) : null;

it("bench: golden suite", async () => {
  await benchSuite("golden suite", GOLDEN_DIR, filter, true);
}, 120_000);

// Scale reference, not a golden: a real 64-panel factory project. solveFull is
// omitted because its input (a designed Project) isn't what this measures —
// these rows answer what parse/canonical/export cost at real-project size.
it("bench: 64-panel project scale reference (prop-0)", async () => {
  await benchSuite("prop-0 64 panels", SCALE_DIR, filter, false);
}, 120_000);
