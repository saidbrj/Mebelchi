// ПОЛИГОН · чтение корпуса с диска.
//
// Одна работа — одна папка: job.json, wall.mebl и cutlist.json рядом. Никакого реестра, который
// надо помнить обновить: положили папку — работа в корпусе, убрали — нет.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CorpusJob } from "./corpus";

export function readCorpus(root: string): CorpusJob[] {
  if (!existsSync(root)) return [];
  const out: CorpusJob[] = [];
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const jobPath = join(dir, "job.json");
    const wallPath = join(dir, "wall.mebl");
    if (!existsSync(jobPath) || !existsSync(wallPath)) continue;

    const job = JSON.parse(readFileSync(jobPath, "utf8")) as Omit<CorpusJob, "fdl" | "cut">;
    const cutPath = join(dir, "cutlist.json");
    const rows: { no: number; cut: number }[] = existsSync(cutPath)
      ? JSON.parse(readFileSync(cutPath, "utf8"))
      : [];

    out.push({
      ...job,
      fdl: readFileSync(wallPath, "utf8"),
      cut: Object.fromEntries(rows.map((r) => [String(r.no), r.cut])),
    });
  }
  return out;
}
