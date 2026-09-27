// ПОЛИГОН · THEME-ATOMIC and THEME-CONTRACT — installing somebody else's taste.
//
// A Theme is a rule pack: a coherent set of decisions ("Скандинавский", "Классика") that a person
// installs in one go. Two things go wrong with rule packs, and both go wrong quietly.
//
// THEME-ATOMIC (`50` §4). Half a theme is worse than none. A pack whose colour rules land and
// whose kromka rules are rejected leaves a design nobody chose and nobody can name — and the
// person who installed it believes they are looking at "Скандинавский". So a Theme installs
// ENTIRELY or NOT AT ALL, with a full diff shown first.
//
// THEME-CONTRACT (`50` §4). A theme written for kitchens with tall units, installed on a wall with
// none, matches nothing. Every rule is legal, the install succeeds, and the design does not change.
// Silence is the worst possible answer: the person concludes the theme is broken, or worse,
// concludes the app is. So a Theme DECLARES the facets it needs, and installing it against a
// project that lacks them FAILS VISIBLY, naming what is missing.

import {
  checkRuleProperties, checkStratification, matches, resolve, type Property, type Rule,
} from "./cascade";
import type { Facets } from "./facets";

export interface Theme {
  id: string;
  name: Record<string, string>;
  version: string;
  /** THEME-CONTRACT — the facets this theme's rules are written against. Declared, not inferred
   *  from the rules: a theme may legitimately carry a rule for a case this project happens not to
   *  have, and the contract is the author saying which ones actually matter. */
  contract: {
    roles?: Facets["role"][];
    zones?: Facets["zone"][];
    tags?: string[];
  };
  rules: Rule[];
}

export interface ContractGap {
  facet: "role" | "zone" | "tag";
  wanted: string;
  detail: string;
}

/** Does this project have what the theme was written for? Checked BEFORE any rule is applied. */
export function contractGaps(theme: Theme, facets: Map<string, Facets>): ContractGap[] {
  const all = [...facets.values()];
  const has = {
    role: new Set(all.map((f) => f.role as string)),
    zone: new Set(all.map((f) => f.zone as string)),
    tag: new Set(all.flatMap((f) => f.tags)),
  };
  const out: ContractGap[] = [];
  const want = (facet: "role" | "zone" | "tag", values: string[] | undefined) => {
    for (const v of values ?? []) {
      if (has[facet].has(v)) continue;
      out.push({
        facet, wanted: v,
        detail:
          `theme "${theme.id}" is written for ${facet} "${v}", which this project has none of. ` +
          `Installing it would change nothing and look like a broken theme.`,
      });
    }
  };
  want("role", theme.contract.roles as string[] | undefined);
  want("zone", theme.contract.zones as string[] | undefined);
  want("tag", theme.contract.tags);
  return out;
}

// ─── the diff, computed before anything is installed ──────────────────────────────────────────

export interface ThemeChange {
  boardId: string;
  property: Property;
  from: unknown;
  to: unknown;
  by: string;
}

export interface ThemeDiff {
  changes: ThemeChange[];
  /** boards the theme matches and does not change — it agrees with what is already there */
  unchanged: number;
}

export function previewTheme(theme: Theme, facets: Map<string, Facets>, base: Rule[]): ThemeDiff {
  const after = [...base, ...theme.rules];
  const properties = [...new Set(theme.rules.map((r) => r.property))];
  const changes: ThemeChange[] = [];
  let unchanged = 0;

  for (const [id, f] of facets) {
    for (const property of properties) {
      if (!theme.rules.some((r) => r.property === property && matches(f, r.where))) continue;
      let from: unknown;
      try { from = resolve(id, f, property, base).value; } catch { from = undefined; }
      const to = resolve(id, f, property, after);
      if (from === to.value) { unchanged++; continue; }
      changes.push({ boardId: id, property, from, to: to.value, by: to.ruleId });
    }
  }
  return { changes, unchanged };
}

// ─── install ──────────────────────────────────────────────────────────────────────────────────

export type InstallResult =
  | { ok: true; rules: Rule[]; diff: ThemeDiff }
  | { ok: false; problems: { law: string; detail: string }[] };

/** ENTIRELY, or NOT AT ALL. Every gate runs before a single rule is added, and a failure returns
 *  the untouched base — there is no path here that returns a partially themed rule set. */
export function installTheme(
  theme: Theme, facets: Map<string, Facets>, base: Rule[],
): InstallResult {
  const problems: { law: string; detail: string }[] = [];

  // the theme's rules must be legal on their own terms first
  for (const p of checkRuleProperties(theme.rules)) problems.push({ law: "D2", detail: p.detail });
  for (const p of checkStratification(theme.rules)) problems.push({ law: "D8", detail: p.detail });

  // THEME-CONTRACT — fail visibly rather than matching nothing
  for (const g of contractGaps(theme, facets)) problems.push({ law: "THEME-CONTRACT", detail: g.detail });

  // and every board the theme touches must still resolve without a conflict, or the install would
  // leave the project unable to answer a question it could answer a moment ago
  const merged = [...base, ...theme.rules];
  for (const [id, f] of facets) {
    for (const property of new Set(theme.rules.map((r) => r.property))) {
      try { resolve(id, f, property, merged); }
      catch (e) { problems.push({ law: "THEME-ATOMIC", detail: (e as Error).message }); }
    }
  }

  if (problems.length) return { ok: false, problems };
  return { ok: true, rules: merged, diff: previewTheme(theme, facets, base) };
}
