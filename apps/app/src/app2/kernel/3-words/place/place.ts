// PLACE (SPEC W06): одна доска на плоскости или на грани другой доски.
import { allocate } from "../../0-base/ids/ids";
import { finding, ok, refuse } from "../../0-base/findings/findings";
import { toMm, type Mm10 } from "../../0-base/units/units";
import { AXES, FACE, withNodes, type Axis, type PartNode, type PlaneRef, type Span, type Thickness } from "../../1-graph/model/model";
import type { Word } from "../word/word";

export type PlaceRelation =
  | { kind: "on"; plane: PlaneRef; side?: "inside" | "outside"; offset: Mm10 }
  | { kind: "against"; plane: PlaneRef };

export interface PlaceCommand {
  /** пространство-хозяин */
  host: string;
  type: string;
  relation: PlaceRelation;
  spans: Partial<Record<Axis, Span>>;
  /** объявленная толщина (главнее профиля); без неё — толщина корпуса из профиля */
  thickness?: Mm10;
}

export const place: Word<PlaceCommand> = (g, cmd) => {
  const host = g.nodes[cmd.host];
  if (!host || (host.kind !== "space" && host.kind !== "unit")) {
    return refuse(finding("REF-MISSING-REF", [cmd.host], `узла ${cmd.host} нет`));
  }
  const target = g.nodes[cmd.relation.plane.node];
  if (!target) return refuse(finding("REF-MISSING-REF", [cmd.relation.plane.node], `узла ${cmd.relation.plane.node} нет`));

  const face = FACE[cmd.relation.plane.face];
  let dir: -1 | 1;
  let offset: Mm10 = 0;
  if (cmd.relation.kind === "on") {
    if (target.kind === "part") {
      return refuse(finding("REF-AMBIGUOUS", [target.id], `${target.id} — доска; к доске кладут связью against`));
    }
    if (!cmd.relation.side) {
      return refuse(finding("REF-AMBIGUOUS", [target.id], "не сказано, внутрь или наружу растёт доска", ["inside", "outside"]));
    }
    dir = (cmd.relation.side === "inside" ? -face.side : face.side) as -1 | 1;
    offset = cmd.relation.offset;
  } else {
    if (target.kind !== "part") {
      return refuse(finding("REF-AMBIGUOUS", [target.id], `${target.id} — не доска; на плоскость кладут связью on`));
    }
    dir = face.side;
  }

  const normal = face.axis;
  const missing = AXES.filter((a) => a !== normal && !cmd.spans[a]);
  if (missing.length) {
    return refuse(finding("REF-AMBIGUOUS", [cmd.host], `не объявлен пролёт по ${missing.join(", ")}`));
  }
  if (cmd.thickness !== undefined && !(cmd.thickness > 0)) {
    return refuse(finding("REF-TOO-SMALL", [], "толщина должна быть больше нуля"));
  }

  const [id, counters] = allocate(g.counters, "P");
  const thickness: Thickness =
    cmd.thickness !== undefined ? { from: "declared", mm10: cmd.thickness } : { from: "profile", key: "carcassThicknessMm" };
  const spans = Object.fromEntries(AXES.filter((a) => a !== normal).map((a) => [a, cmd.spans[a]!]));
  const part: PartNode = {
    kind: "part", id, type: cmd.type, host: cmd.host, origin: "place", thickness, normal,
    position: { kind: "plane", relation: cmd.relation.kind, plane: cmd.relation.plane, dir, offset }, spans,
  };
  const where = cmd.relation.kind === "on"
    ? `on ${cmd.relation.plane.node}.${cmd.relation.plane.face} ${cmd.relation.side} +${toMm(offset)}`
    : `against ${cmd.relation.plane.node}.${cmd.relation.plane.face}`;
  return ok({ graph: withNodes(g, [part], [], counters), declares: { parts: 1 }, summary: `PLACE ${cmd.type} ${where}` });
};
