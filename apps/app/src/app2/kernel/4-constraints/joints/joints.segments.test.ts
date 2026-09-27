import { describe, it, expect } from "vitest";
import { joints, run, segments } from "../../index";
import { build, CUBE_600 } from "../../testkit";
import type { Command, Session } from "../../index";

/** Полка на всю ширину и перегородка на всю высоту: настоящее перекрестье. */
const SHELF: Command = {
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 300 },
};
const DIVIDER: Command = {
  word: "PLACE", host: "S1", type: "divider", spans: { y: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "left" }, side: "inside", offset: 200 },
};
const cross = (s: Session) => joints(s).find((j) => j.kind === "cross")!;
const cuts = (s: Session, part: string) => segments(s).filter((x) => x.part === part);

describe("перекрестье и сквозность [spec:R37]", () => {
  it("[spec:R37] две доски под прямым углом могут пересекаться: стык говорит, кто сквозной", () => {
    const s = build(CUBE_600, SHELF, DIVIDER);
    const j = cross(s);
    expect(j.id).toBe("P5×P6");
    expect(j.throughFrom).toBe("профиль");
    expect(j.through).toBe("P6");                 // перегородка 40 > полка 30 по рангам профиля
  });

  it("[spec:R37] решение не зависит от порядка команд", () => {
    const first = cross(build(CUBE_600, SHELF, DIVIDER));
    const second = cross(build(CUBE_600, DIVIDER, SHELF));
    expect(second.through && second.through !== first.through).toBe(true); // это другая пара uid
    expect(second.throughFrom).toBe("профиль");
    // сквозной в обоих случаях перегородка, как бы её ни звали
    const typeOf = (s: Session, id: string) => (s.state.graph.nodes[id] as { type: string }).type;
    const a = build(CUBE_600, SHELF, DIVIDER);
    const b = build(CUBE_600, DIVIDER, SHELF);
    expect(typeOf(a, cross(a).through!)).toBe("divider");
    expect(typeOf(b, cross(b).through!)).toBe("divider");
  });

  it("[spec:R37] [rt:T11] режут того, кто не сквозной; в модели деталь остаётся одной", () => {
    const s = build(CUBE_600, SHELF, DIVIDER);
    expect(cuts(s, "P6")).toHaveLength(1);                 // перегородка целая
    const pieces = cuts(s, "P5");
    expect(pieces).toHaveLength(2);                        // полка режется на два отрезка
    expect(pieces.map((p) => p.id)).toEqual(["P5.1", "P5.2"]);
    expect(pieces[0]!.lengthMm + pieces[1]!.lengthMm).toBe(568 - 16);
    expect(pieces[0]!.between).toEqual([null, "P6"]);
    expect(s.state.graph.nodes.P5).toBeDefined();          // uid модели не тронут
  });

  it("[spec:R37] [spec:Z07] мастер переключает сквозность: режут уже другого, uid прежние", () => {
    const s = build(CUBE_600, SHELF, DIVIDER);
    const r = run(s, { word: "SCOPE", joint: ["P5", "P6"], key: "through", value: "P5" });
    expect(r.result.accepted).toBe(true);
    const after = r.session;
    expect(cross(after).through).toBe("P5");
    expect(cross(after).throughFrom).toBe("мастер");
    expect(cuts(after, "P5")).toHaveLength(1);             // теперь целая полка
    expect(cuts(after, "P6")).toHaveLength(2);             // а перегородка — два отрезка
    expect(after.state.graph.nodes.P5).toBeDefined();
    expect(after.state.graph.nodes.P6).toBeDefined();
  });

  it("[spec:R70] переключение отменяется целиком", () => {
    const s = build(CUBE_600, SHELF, DIVIDER);
    const r = run(s, { word: "SCOPE", joint: ["P5", "P6"], key: "through", value: "P5" });
    expect(cuts(r.session, "P6")).toHaveLength(2);
    const back = r.session.previous!;
    expect(cuts(back, "P6")).toHaveLength(1);
    expect(cuts(back, "P5")).toHaveLength(2);
  });

  it("[spec:W10] сквозным можно назначить только участника стыка", () => {
    const s = build(CUBE_600, SHELF, DIVIDER);
    const r = run(s, { word: "SCOPE", joint: ["P5", "P6"], key: "through", value: "P1" });
    expect(r.result.findings[0]!.code).toBe("REF-AMBIGUOUS");
    expect(r.session).toBe(s);
  });

  it("[spec:L1a] две доски в одной плоскости пересекаться не могут даже со стыком", () => {
    const s = build(CUBE_600, SHELF);
    const r = run(s, SHELF);
    expect(r.result.findings[0]!.code).toBe("REF-OVERLAP");
    expect(r.session).toBe(s);
  });
});
