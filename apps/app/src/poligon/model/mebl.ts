// ПОЛИГОН · the .mebl file — the FDL document as a thing on disk.
//
// `fdl.ts` could print a wall and parse it back, and that was the whole of it: the text existed
// for exactly as long as the expression that made it. Meanwhile the demo kitchen was built in
// TypeScript, which means the source of truth for a design was CODE. That is backwards, and it is
// backwards against the founder's own framing of the idea:
//
//   > HTML of furniture: every piece of furniture is written in code like a language.
//   > Our app is the renderer.
//
// A renderer reads a file. So: `.mebl`, one wall per file, UTF-8, the FDL grammar exactly as
// `fdl.ts` defines it. No new syntax, no metadata header, no wrapper — a .mebl file IS an FDL
// document, so everything V-ROUNDTRIP and V-GRAMMAR-PIN already guarantee applies unchanged.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse, print } from "./fdl";
import type { Sheet } from "./sheet";

export const EXTENSION = ".mebl";

/** Write a wall to disk. Canonical text, so two saves of the same design are the same bytes and
 *  `git diff` shows what actually changed rather than how the file was rebuilt. */
export function save(path: string, sheet: Sheet): void {
  if (!path.endsWith(EXTENSION)) throw new Error(`a wall is saved as ${EXTENSION}, got "${path}"`);
  writeFileSync(path, print(sheet), "utf8");
}

/** Read a wall from disk. A malformed file refuses with the line and the text, exactly as a
 *  pasted document would — there is no laxer path for files than for strings. */
export function load(path: string): Sheet {
  if (!existsSync(path)) throw new Error(`no such wall: ${path}`);
  return parse(readFileSync(path, "utf8"));
}
