// CUBE (SPEC W03): модуль, 4 доски корпуса по рангам стыков, пространство внутри.
import { allocate, allocateMany } from "../../0-base/ids/ids";
import { finding, ok, refuse } from "../../0-base/findings/findings";
import { toMm, type Mm10 } from "../../0-base/units/units";
import { unitOf, withNodes, type Axis, type UnitNode, type PartNode, type PlaneRef, type SpaceNode } from "../../1-graph/model/model";
import { lengthOf, runsThrough } from "../../2-settings/profile/profile";
import { fullSpan, type Word } from "../word/word";

export interface CubeCommand {
  size: Record<Axis, Mm10>;
  /** контекст из App 1 (R60): что стоит рядом с каждой стороной */
  neighbours?: UnitNode["neighbours"];
}

const CARCASS = { from: "profile", key: "carcassThicknessMm" } as const;

/** Доски корпуса по определению слова CUBE (W03): левая, правая, дно, крышка. */
const BOARDS = ["left", "right", "bottom", "top"] as const;

export const cube: Word<CubeCommand> = (g, cmd, { profile }) => {
  const existing = unitOf(g);
  if (existing) {
    return refuse(finding("REF-OUT-OF-SCOPE-APP1", [existing.id], "App 2 строит один модуль; несколько модулей собирает App 1"));
  }
  const min = lengthOf(profile, "minCarcassMm");
  const small = (["x", "y", "z"] as const).filter((a) => cmd.size[a] < min);
  if (small.length) {
    return refuse(finding("REF-TOO-SMALL", [], `${small.join(", ")} меньше ${toMm(min)} мм (minCarcassMm)`));
  }

  const [u, c1] = allocate(g.counters, "U");
  const [[left, right, bottom, top], c2] = allocateMany(c1, "P", BOARDS.length);
  const [s, counters] = allocate(c2, "S");
  const at = (node: string, face: PlaneRef["face"]): PlaneRef => ({ node, face });

  const sidesThrough = runsThrough(profile, "side", "bottom");
  const topsThrough = runsThrough(profile, "side", "top");
  const sideY = {
    kind: "between" as const,
    from: sidesThrough ? at(u, "bottom") : at(bottom!, "top"),
    to: topsThrough ? at(u, "top") : at(top!, "bottom"),
  };
  const boardX = (through: boolean) =>
    through ? { kind: "between" as const, from: at(left!, "right"), to: at(right!, "left") } : fullSpan(u, "x");

  const unit: UnitNode = { kind: "unit", id: u, size: { ...cmd.size }, profile: profile.name, ...(cmd.neighbours ? { neighbours: cmd.neighbours } : {}) };
  const board = (id: string, type: string, face: PlaneRef["face"], dir: -1 | 1, spans: PartNode["spans"], normal: Axis): PartNode => ({
    kind: "part", id, type, host: u, origin: "cube", thickness: CARCASS, normal,
    position: { kind: "plane", relation: "frame", plane: at(u, face), dir, offset: 0 }, spans,
  });
  const parts: PartNode[] = [
    board(left!, "side", "left", 1, { y: sideY, z: fullSpan(u, "z") }, "x"),
    board(right!, "side", "right", -1, { y: sideY, z: fullSpan(u, "z") }, "x"),
    board(bottom!, "bottom", "bottom", 1, { x: boardX(sidesThrough), z: fullSpan(u, "z") }, "y"),
    board(top!, "top", "top", -1, { x: boardX(topsThrough), z: fullSpan(u, "z") }, "y"),
  ];
  const space: SpaceNode = {
    kind: "space", id: s, host: u,
    shape: {
      kind: "bounds",
      bounds: {
        left: at(left!, "right"), right: at(right!, "left"), bottom: at(bottom!, "top"),
        top: at(top!, "bottom"), front: at(u, "front"), back: at(u, "back"),
      },
    },
  };
  return ok({
    graph: withNodes(g, [unit, ...parts, space], [], counters),
    declares: { parts: parts.length },
    summary: `CUBE ${toMm(cmd.size.x)}×${toMm(cmd.size.y)}×${toMm(cmd.size.z)}`,
  });
};
