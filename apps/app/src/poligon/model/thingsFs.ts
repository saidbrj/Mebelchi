// ПОЛИГОН · T8 — the thin I/O shim.
//
// Everything real about Things is pure and lives in `things.ts`. This file only turns a directory
// into `ThingFolder[]`, which is why it is small and deliberately dull: the laws are tested against
// the data structure, not against the file system.
//
// Node-only. The app never calls this at runtime — the built index ships as data (DB/52 §10:
// "never a filesystem walk at runtime"). It is used by the loader, by tests, and by the publish
// gate in tooling.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ThingDef, ThingFolder } from "./things";

const filesUnder = (dir: string, base = dir): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full, base) : [relative(base, full)];
  });

/** Read one Thing folder: its def, the files beside it, and any examples. */
export function readThingFolder(dir: string): ThingFolder {
  const def = JSON.parse(readFileSync(join(dir, "def.json"), "utf8")) as ThingDef;
  const files = filesUnder(dir);

  const exDir = join(dir, "examples");
  const examples = existsSync(exDir)
    ? readdirSync(exDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const body = JSON.parse(readFileSync(join(exDir, f), "utf8")) as {
            fields?: Record<string, number | string>;
          };
          return { name: f.replace(/\.json$/, ""), fields: body.fields ?? {} };
        })
    : undefined;

  return { def, files, examples };
}

/** Walk a catalog root — `things/<kind-plural>/<slug>/def.json`. */
export function readCatalog(root: string): ThingFolder[] {
  if (!existsSync(root)) return [];
  const out: ThingFolder[] = [];
  for (const kindDir of readdirSync(root)) {
    const kindPath = join(root, kindDir);
    if (!statSync(kindPath).isDirectory()) continue;
    for (const slug of readdirSync(kindPath)) {
      const thingPath = join(kindPath, slug);
      if (statSync(thingPath).isDirectory() && existsSync(join(thingPath, "def.json"))) {
        out.push(readThingFolder(thingPath));
      }
    }
  }
  return out;
}
