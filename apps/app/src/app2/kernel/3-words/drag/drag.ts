// DRAG (SPEC W05): габарит модуля, сдвиг доски, длина пролёта.
import { finding, ok, refuse, type Outcome } from "../../0-base/findings/findings";
import type { Draft } from "../../1-graph/transaction/transaction";
import { toMm, type Mm10 } from "../../0-base/units/units";
import { unitOf, withNodes, type Axis, type PartNode } from "../../1-graph/model/model";
import { pattern } from "../pattern/pattern";
import { lengthOf } from "../../2-settings/profile/profile";
import type { Word } from "../word/word";

export type DragCommand =
  | { kind: "unit"; axis: Axis; size: Mm10 }
  | { kind: "part"; part: string; delta: Mm10 }
  | { kind: "size"; part: string; axis: Axis; size: Mm10 };

export const drag: Word<DragCommand> = (g, cmd, { profile, evaluation }) => {
  if (cmd.kind === "unit") {
    const m = unitOf(g);
    if (!m) return refuse(finding("REF-MISSING-REF", [], "модуля ещё нет — сначала CUBE"));
    const min = lengthOf(profile, "minCarcassMm");
    if (cmd.size < min) return refuse(finding("REF-TOO-SMALL", [m.id], `${cmd.axis} = ${toMm(cmd.size)} мм, минимум ${toMm(min)}`));
    return ok({
      graph: withNodes(g, [{ ...m, size: { ...m.size, [cmd.axis]: cmd.size } }]),
      declares: { parts: 0 },
      summary: `DRAG ${m.id} ${cmd.axis} → ${toMm(cmd.size)}`,
    });
  }

  const p = g.nodes[cmd.part];
  if (!p || p.kind !== "part") return refuse(finding("REF-MISSING-REF", [cmd.part], `доски ${cmd.part} нет`));

  if (cmd.kind === "size") {
    const s = p.spans[cmd.axis];
    if (!s || s.kind !== "sized") {
      return refuse(finding("REF-LOCKED", [p.id], `длину ${p.id} по ${cmd.axis} задают грани ${s ? `${s.from.node}` : ""}; двигайте их`));
    }
    if (!(cmd.size > 0)) return refuse(finding("REF-TOO-SMALL", [p.id], "длина должна быть больше нуля"));
    return ok({
      graph: withNodes(g, [{ ...p, spans: { ...p.spans, [cmd.axis]: { ...s, size: cmd.size } } }]),
      declares: { parts: 0 },
      summary: `DRAG ${p.id} длина ${cmd.axis} → ${toMm(cmd.size)}`,
    });
  }

  if (p.position.kind === "member") return moveMember(p, cmd.delta);
  if (p.position.kind === "fill") {
    return refuse(finding("REF-LOCKED", [p.id], "фасад держит ячейка паттерна — меняйте доли или поля профиля"));
  }
  if (p.position.relation !== "on") {
    const why = p.position.relation === "frame" ? "это доска корпуса — меняйте габарит юнита" : `прижата к ${p.position.plane.node} — двигайте её`;
    return refuse(finding("REF-LOCKED", [p.id], why));
  }
  const moved: PartNode = { ...p, position: { ...p.position, offset: p.position.offset + p.position.dir * cmd.delta } };
  return ok({
    graph: withNodes(g, [moved]),
    declares: { parts: 0 },
    summary: `DRAG ${p.id} на ${toMm(cmd.delta)}`,
  });

  /** Участник паттерна: сдвиг отвязывает его (Q68); всю семантику держит слово PATTERN. */
  function moveMember(part: PartNode, delta: Mm10): Outcome<Draft> {
    return pattern(g, { op: "move", member: part.id, delta }, { profile, evaluation });
  }
};
