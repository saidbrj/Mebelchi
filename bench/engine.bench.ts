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

it("bench: golden suite", async () => {
  // BENCH_FILTER (optional regex) restricts the suite — used for apples-to-apples
  // ledger deltas when the golden suite itself grows.
  const filter = process.env.BENCH_FILTER ? new RegExp(process.env.BENCH_FILTER) : null;
  const xmlFiles = readdirSync(GOLDEN_DIR)
    .filter((f) => f.toUpperCase().endsWith(".XML"))
    .filter((f) => !filter || filter.test(f))
    .sort();
  const xmls = xmlFiles.map((f) => readFileSync(join(GOLDEN_DIR, f), "utf8"));

  // Pre-parsed inputs for the downstream stages (so each stage is measured alone).
  const partsPerFile: Part[][] = xmls.map((x) => parseSWJ008(x));
  const projects: Project[] = partsPerFile.map((parts, i) => ({
    id: `bench_${i}`,
    name: xmlFiles[i]!,
    parts,
  }));

  const rows = [
    await measure("parseSWJ008 (suite)", () => {
      for (const x of xmls) parseSWJ008(x);
    }),
    await measure("canonicalizeParts (suite)", () => {
      for (const p of partsPerFile) canonicalizeParts(p);
    }),
    await measure("exportSWJ008 (suite)", () => {
      for (const p of projects) exportSWJ008(p);
    }),
    await measure("solveFull (suite)", async () => {
      for (const p of projects) await solveFull(p);
    }),
  ];

  const cpu = cpus()[0]?.model ?? "unknown";
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `\nBENCH — golden suite: ${xmlFiles.length} files, ` +
      `${partsPerFile.flat().length} panels, ` +
      `${partsPerFile.flat().reduce((n, p) => n + p.operations.length, 0)} ops` +
      `\nnode ${process.version} | ${platform()}/${arch()} | ${cpu}` +
      `\nwarmup ${WARMUP_RUNS}, measured ${MEASURED_RUNS}\n\n` +
      pad("operation", 30) + pad("median ms", 12) + "p95 ms\n" +
      rows
        .map((r) => pad(r.label, 30) + pad(r.median.toFixed(3), 12) + r.p95.toFixed(3))
        .join("\n") +
      "\n",
  );
}, 120_000);
