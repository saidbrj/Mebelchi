// ПОЛИГОН · V-VOCAB, V-AI-TIER, V-AUTOAPPROVE — the three laws about who may add what.
//
// These are the laws with no geometry in them, and they are the ones a growing system breaks
// first, because breaking them never fails a test — it just makes the vocabulary bigger every
// month until nobody can hold it in their head and every rule needs a person to interpret it.
//
// V-VOCAB (`59` §3.6). Founder's ruling, and it is in a file: a new Type stays PRIVATE until three
// separate jobs have used it, and only then may it be published. Three jobs is evidence; one job
// is enthusiasm. The numbers live in `things/tables/vocabulary/def.json` — a shop with a different
// tolerance for sprawl edits the file, not this code.
//
// V-AI-TIER (`59` §3.5). A model may author Tier 1–2 — the parts of a design that are opinions.
// Tier-3 topology is PROPOSED, never committed. Four things are permanently off-limits, and the
// list is short enough to hold in your head, which is the point:
//
//   catalog IDs      inventing a uid produces a design referencing a Thing that does not exist
//   junctions        the one piece of data separating three boxes from one, and it is invisible
//   the Cut plane    the terminal plane; nothing downstream can catch an error made here
//   self-approval    a model that can approve its own work has no reviewer
//
// V-AUTOAPPROVE (`59` §3.3). A change may auto-approve only when NOTHING a law or the legality
// oracle governs was touched. Anything else routes to a human. The failure this prevents is
// specific and slow: auto-approval creeps outward one safe-looking category at a time until the
// review that was supposed to catch a wrong junction has not run in eight months.

import { VOCABULARY } from "./settings";
import type { Property } from "./cascade";

// ─── V-VOCAB · how the vocabulary is allowed to grow ──────────────────────────────────────────

export type VocabStatus = "private" | "publishable" | "published" | "retired";

export interface VocabEntry {
  /** the Type's name — a role, an enum member, a named algorithm */
  name: string;
  kind: "role" | "enum" | "algorithm";
  /** the JOBS that have used it. Jobs, not uses: one job using it forty times is still one job. */
  jobs: string[];
  status: VocabStatus;
}

export interface VocabProblem {
  law: string;
  name: string;
  detail: string;
}

/** Has this Type earned publication? The threshold is read from the vocabulary table file. */
export const mayPublish = (e: VocabEntry): boolean =>
  new Set(e.jobs).size >= VOCABULARY.promoteAfterUses;

export function vocabProblems(entries: VocabEntry[]): VocabProblem[] {
  const out: VocabProblem[] = [];

  for (const e of entries) {
    if (e.status === "published" && !mayPublish(e)) {
      out.push({
        law: "V-VOCAB", name: e.name,
        detail:
          `"${e.name}" is published but has been used in ${new Set(e.jobs).size} job(s); ` +
          `the shop's threshold is ${VOCABULARY.promoteAfterUses}. One job is enthusiasm, not evidence.`,
      });
    }
  }

  const live = entries.filter((e) => e.status !== "retired").length;
  if (live > VOCABULARY.maxTypes) {
    out.push({
      law: "V-VOCAB", name: "—",
      detail:
        `${live} live Types, over the declared cap of ${VOCABULARY.maxTypes}. ` +
        `A vocabulary past its cap is a vocabulary nobody can hold in their head.`,
    });
  }
  return out;
}

// ─── V-AI-TIER · what a model may author ──────────────────────────────────────────────────────

export type Tier = 1 | 2 | 3;

/** Permanently off-limits. Not a default, not a setting — there is no configuration that turns any
 *  of these on, which is what "permanently" means. */
export const FORBIDDEN_TO_MODEL = ["catalog-id", "junction", "cut-plane", "self-approval"] as const;
export type Forbidden = (typeof FORBIDDEN_TO_MODEL)[number];

export interface Authorship {
  /** what is being written */
  subject: Forbidden | "appearance" | "layout" | "topology";
  tier: Tier;
  by: "model" | "person";
  /** proposed, or committed outright */
  intent: "propose" | "commit";
}

export interface AuthorshipVerdict {
  allowed: boolean;
  law?: string;
  detail?: string;
}

export function mayAuthor(a: Authorship): AuthorshipVerdict {
  if (a.by === "person") return { allowed: true };

  if ((FORBIDDEN_TO_MODEL as readonly string[]).includes(a.subject)) {
    return {
      allowed: false, law: "V-AI-TIER",
      detail: `"${a.subject}" is permanently off-limits to a model — there is no setting that permits it`,
    };
  }
  if (a.tier === 3 && a.intent === "commit") {
    return {
      allowed: false, law: "V-AI-TIER",
      detail: `Tier-3 topology may be PROPOSED by a model, never committed — a person commits it`,
    };
  }
  return { allowed: true };
}

// ─── V-AUTOAPPROVE · what may pass without a human ────────────────────────────────────────────

export interface Change {
  id: string;
  /** the properties this change touches */
  properties: Property[];
  /** did it change anything a LAW governs — a junction, a minimum, a plane, an invariant? */
  touchesLaw: boolean;
  /** did it change anything the legality oracle answers about — a position, a domain, a refusal? */
  touchesOracle: boolean;
}

export interface ApprovalVerdict {
  autoApprove: boolean;
  law: string;
  detail: string;
}

export function approvalOf(c: Change): ApprovalVerdict {
  if (c.touchesLaw) {
    return {
      autoApprove: false, law: "V-AUTOAPPROVE",
      detail: `change "${c.id}" touches a law — it routes to a person, whatever bucket it landed in`,
    };
  }
  if (c.touchesOracle) {
    return {
      autoApprove: false, law: "V-AUTOAPPROVE",
      detail: `change "${c.id}" touches the legality oracle — a wrong domain is a wrong refusal, and nobody sees it`,
    };
  }
  return {
    autoApprove: true, law: "V-AUTOAPPROVE",
    detail: `change "${c.id}" touches neither a law nor the oracle — safe to auto-approve`,
  };
}
