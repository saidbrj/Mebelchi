// ПОЛИГОН · FDL — Furniture Description Language. The founder's own idea, in his words:
//
//   > HTML of furniture: every piece of furniture is written in code like a language, 30–60 lines.
//   > Our app is the renderer.
//
// This is the text surface over the Sheet. It exists so a design is a thing you can read, diff,
// mail, review in a pull request and keep in a folder — not a blob only one program understands.
//
// Two laws govern it, and both are about what a SECOND authoring surface does to a system that
// already has one (`59` §2).
//
// V-ROUNDTRIP. A model with two authoritative surfaces is a model with two chances to disagree
// with itself. Both stay authoritative only while all three of these hold:
//
//   ONE SHARED LEGAL-DOMAIN FUNCTION   text edits go through `apply`, exactly like a drag. This
//                                      module has no mutator at all — it prints and it parses.
//   ZERO ESCAPE HATCHES                no raw block, no passthrough, no "unknown directives are
//                                      preserved". An unrecognised line is an ERROR, because the
//                                      alternative is a file the app cannot fully understand and
//                                      therefore cannot fully check.
//   TRULY CANONICAL PRINTING           one sheet, one text, byte for byte. Otherwise the diff is
//                                      noise, and a diff that is noise stops being read.
//
// V-GRAMMAR-PIN. The grammar version is pinned in the file's first line and in the project lock.
// Non-conforming syntax is refused MECHANICALLY, with no override flag — an override would be used
// on the day something urgent had to ship, which is the day it must not be. A new construct is a
// BREAKING CHANGE: the version goes up, and old files are migrated by a named migration rather
// than by a parser quietly tolerating both.

import {
  type Block, type BlockKind, type EndCondition, type Layer, type Line, type LineId,
  type Opening, type Segment, type Sheet,
} from "./sheet";
import type { Role } from "./roles";
import type { JunctionState } from "./junctions";

/** V-GRAMMAR-PIN — bumped only by a breaking grammar change, never by a tolerated addition. */
export const GRAMMAR_VERSION = 1;

const KINDS: BlockKind[] = ["block", "void", "reserved"];
const LAYERS: Layer[] = ["behind", "carcass", "front", "above"];
const ENDS: EndCondition[] = ["free", "into-corner", "against-wall"];
const STATES: JunctionState[] = ["V-through", "H-through", "neither", "both"];

// ─── printing ─────────────────────────────────────────────────────────────────────────────────

const posText = (l: Line): string =>
  l.pos.kind === "authored" ? `@${l.pos.mm}` : `${l.pos.from}+${l.pos.offset}`;

const segText = (s: Segment): string => {
  const head = `seg ${s.line} ${s.from}..${s.to} boards=${s.boards}`;
  if (s.boards === 0) return head;
  const mats = s.materials?.length ? ` mat=${s.materials.join(",")}` : "";
  return `${head} role=${s.role}${mats}`;
};

/** CANONICAL. One sheet, one text: fixed section order, fixed sort within each section, one space
 *  between tokens, one trailing newline. Two sheets that differ produce texts that differ, and two
 *  that agree produce the same bytes — which is what makes a diff worth reading. */
export function print(sheet: Sheet): string {
  const out: string[] = [];
  out.push(`fdl ${GRAMMAR_VERSION}`);
  out.push(
    `wall ${sheet.opening.width}x${sheet.opening.height} ` +
    `left=${sheet.opening.ends.left} right=${sheet.opening.ends.right}`,
  );
  out.push(`next ${sheet.nextId}`);

  // lines: verticals then horizontals, each by id — never by position, which moves
  const byAxis = (a: "v" | "h") =>
    sheet.lines.filter((l) => l.axis === a).sort((p, q) => p.id.localeCompare(q.id));
  for (const l of [...byAxis("v"), ...byAxis("h")]) out.push(`line ${l.id} ${l.axis} ${posText(l)}`);

  for (const s of [...sheet.segments].sort((a, b) =>
    a.line.localeCompare(b.line) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
    out.push(segText(s));
  }

  for (const b of [...sheet.blocks].sort((p, q) => p.id.localeCompare(q.id))) {
    const tags = b.tags?.length ? ` tags=${[...b.tags].sort().join(",")}` : "";
    const nom = b.nominal ? ` nominal=${b.nominal.w}x${b.nominal.h}` : "";
    out.push(
      `block ${b.id} ${b.kind} ${b.layer} ` +
      `${b.bounds.v0} ${b.bounds.v1} ${b.bounds.h0} ${b.bounds.h1}${nom}${tags}`,
    );
  }

  for (const j of [...(sheet.junctionOverrides ?? [])].sort((a, b) =>
    a.v.localeCompare(b.v) || a.h.localeCompare(b.h))) {
    out.push(`junction ${j.v}x${j.h} ${j.state}`);
  }

  return out.join("\n") + "\n";
}

// ─── parsing ──────────────────────────────────────────────────────────────────────────────────

export class GrammarError extends Error {
  constructor(readonly line: number, readonly text: string, detail: string) {
    super(`FDL line ${line}: ${detail}\n  ${text}`);
    this.name = "GrammarError";
  }
}

const oneOf = <T extends string>(allowed: readonly T[], v: string, what: string, n: number, raw: string): T => {
  if (!(allowed as readonly string[]).includes(v)) {
    throw new GrammarError(n, raw, `"${v}" is not a ${what} (expected one of: ${allowed.join(", ")})`);
  }
  return v as T;
};

const int = (v: string, what: string, n: number, raw: string): number => {
  if (!/^-?\d+$/.test(v)) throw new GrammarError(n, raw, `${what} must be a whole number, got "${v}"`);
  return Number.parseInt(v, 10);
};

/** Key=value tail parsing. Unknown keys are an ERROR — the whole point of having no escape hatch. */
function tail(parts: string[], allowed: string[], n: number, raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) throw new GrammarError(n, raw, `expected key=value, got "${p}"`);
    const key = p.slice(0, eq);
    if (!allowed.includes(key)) {
      throw new GrammarError(n, raw, `unknown key "${key}" (this grammar has no passthrough — allowed: ${allowed.join(", ")})`);
    }
    out[key] = p.slice(eq + 1);
  }
  return out;
}

export function parse(text: string): Sheet {
  const lines = text.split("\n").map((l, i) => ({ n: i + 1, raw: l, t: l.trim() }))
    .filter((l) => l.t.length > 0 && !l.t.startsWith("#"));

  if (lines.length === 0) throw new GrammarError(1, "", "empty document");

  // V-GRAMMAR-PIN — the version is the first thing read and there is no flag that skips it
  const header = lines[0]!;
  const hm = /^fdl (\d+)$/.exec(header.t);
  if (!hm) throw new GrammarError(header.n, header.raw, `a document must begin with "fdl <version>"`);
  const version = Number.parseInt(hm[1]!, 10);
  if (version !== GRAMMAR_VERSION) {
    throw new GrammarError(
      header.n, header.raw,
      `grammar version ${version}, but this engine speaks ${GRAMMAR_VERSION}. ` +
      `A version change is a breaking change and needs a named migration, not a tolerant parser.`,
    );
  }

  let opening: Opening | undefined;
  let nextId: number | undefined;
  const outLines: Line[] = [];
  const segments: Segment[] = [];
  const blocks: Block[] = [];
  const junctionOverrides: NonNullable<Sheet["junctionOverrides"]> = [];

  for (const { n, raw, t } of lines.slice(1)) {
    const [kw, ...rest] = t.split(/\s+/);

    switch (kw) {
      case "wall": {
        const dim = /^(\d+)x(\d+)$/.exec(rest[0] ?? "");
        if (!dim) throw new GrammarError(n, raw, `wall needs <width>x<height>`);
        const kv = tail(rest.slice(1), ["left", "right"], n, raw);
        opening = {
          width: Number.parseInt(dim[1]!, 10),
          height: Number.parseInt(dim[2]!, 10),
          ends: {
            left: oneOf(ENDS, kv.left ?? "free", "end condition", n, raw),
            right: oneOf(ENDS, kv.right ?? "free", "end condition", n, raw),
          },
        };
        break;
      }
      case "next":
        nextId = int(rest[0] ?? "", "next", n, raw);
        break;
      case "line": {
        const [id, axis, pos] = rest;
        if (!id || !axis || !pos) throw new GrammarError(n, raw, `line needs <id> <v|h> <@mm | <ref>+<offset>>`);
        const at = /^@(-?\d+)$/.exec(pos);
        const rel = /^(.+)\+(-?\d+)$/.exec(pos);
        if (!at && !rel) throw new GrammarError(n, raw, `position must be "@<mm>" or "<lineId>+<offset>"`);
        outLines.push({
          id, axis: oneOf(["v", "h"] as const, axis, "axis", n, raw),
          pos: at
            ? { kind: "authored", mm: Number.parseInt(at[1]!, 10) }
            : { kind: "derived", from: rel![1]!, offset: Number.parseInt(rel![2]!, 10) },
        });
        break;
      }
      case "seg": {
        const [line, span, ...kvs] = rest;
        const sm = /^(.+)\.\.(.+)$/.exec(span ?? "");
        if (!line || !sm) throw new GrammarError(n, raw, `seg needs <line> <from>..<to> boards=<0|1|2>`);
        const kv = tail(kvs, ["boards", "role", "mat"], n, raw);
        const boards = int(kv.boards ?? "", "boards", n, raw);
        if (boards === 0) { segments.push({ line, from: sm[1]!, to: sm[2]!, boards: 0 }); break; }
        if (boards !== 1 && boards !== 2) throw new GrammarError(n, raw, `boards must be 0, 1 or 2`);
        if (!kv.role) throw new GrammarError(n, raw, `a segment carrying a board must declare its role`);
        const mats = kv.mat?.split(",");
        segments.push({
          line, from: sm[1]!, to: sm[2]!, boards, role: kv.role as Role,
          ...(mats ? { materials: mats as [string] | [string, string] } : {}),
        });
        break;
      }
      case "block": {
        const [id, kind, layer, v0, v1, h0, h1, ...kvs] = rest;
        if (!id || !kind || !layer || !v0 || !v1 || !h0 || !h1) {
          throw new GrammarError(n, raw, `block needs <id> <kind> <layer> <v0> <v1> <h0> <h1>`);
        }
        const kv = tail(kvs, ["tags", "nominal"], n, raw);
        const nom = kv.nominal ? /^(\d+)x(\d+)$/.exec(kv.nominal) : null;
        if (kv.nominal && !nom) throw new GrammarError(n, raw, `nominal needs <w>x<h>`);
        blocks.push({
          id,
          kind: oneOf(KINDS, kind, "block kind", n, raw),
          layer: oneOf(LAYERS, layer, "layer", n, raw),
          bounds: { v0, v1, h0, h1 },
          ...(nom ? { nominal: { w: Number.parseInt(nom[1]!, 10), h: Number.parseInt(nom[2]!, 10) } } : {}),
          ...(kv.tags ? { tags: kv.tags.split(",") } : {}),
        });
        break;
      }
      case "junction": {
        const jm = /^(.+)x(.+)$/.exec(rest[0] ?? "");
        if (!jm || !rest[1]) throw new GrammarError(n, raw, `junction needs <v>x<h> <state>`);
        const state = oneOf(STATES, rest[1], "junction state", n, raw);
        if (state === "both") throw new GrammarError(n, raw, `"both" is physically impossible (L-JUNCT-BOTH)`);
        junctionOverrides.push({ v: jm[1]!, h: jm[2]!, state });
        break;
      }
      default:
        // ZERO ESCAPE HATCHES. Not preserved, not ignored, not passed through — an unrecognised
        // directive means the app does not fully understand this file and cannot vouch for it.
        throw new GrammarError(n, raw, `unknown directive "${kw}" — this grammar has no passthrough`);
    }
  }

  if (!opening) throw new GrammarError(1, "", `no "wall" declared`);
  if (nextId === undefined) throw new GrammarError(1, "", `no "next" declared — id minting must be reproducible`);

  return {
    opening, lines: outLines, segments, blocks, nextId,
    ...(junctionOverrides.length ? { junctionOverrides } : {}),
  };
}

// ─── the round-trip guarantee ─────────────────────────────────────────────────────────────────

export interface RoundTrip {
  ok: boolean;
  /** the printed form of the original */
  text: string;
  /** the printed form after a parse — identical, or the guarantee is broken */
  reprinted: string;
}

/** print → parse → print. Equality here is what lets both surfaces be authoritative: a design
 *  written as text and a design drawn with a mouse are the same object, not two representations
 *  somebody has to keep in sync. */
export function roundTrip(sheet: Sheet): RoundTrip {
  const text = print(sheet);
  const reprinted = print(parse(text));
  return { ok: text === reprinted, text, reprinted };
}
