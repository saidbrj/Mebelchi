// Общий тип слова (SPEC 05_WORDS).
import type { Outcome } from "../../0-base/findings/findings";
import type { Evaluation } from "../../1-graph/evaluate/evaluate";
import { facesOf, type Axis, type Graph, type Span } from "../../1-graph/model/model";
import type { Draft } from "../../1-graph/transaction/transaction";
import type { Profile } from "../../2-settings/profile/profile";

export interface WordContext {
  profile: Profile;
  evaluation: Evaluation;
}

export type Word<C> = (g: Graph, cmd: C, ctx: WordContext) => Outcome<Draft>;

/** Пролёт узла по оси «от грани до грани» — ссылка, не число. */
export function fullSpan(node: string, axis: Axis): Span {
  const [from, to] = facesOf(axis);
  return { kind: "between", from: { node, face: from }, to: { node, face: to } };
}
