import { describe, it, expect } from "vitest";
import { run } from "../../index";
import { build, CUBE_600, dims } from "../../testkit";
import type { Command } from "../../index";

/** 1:1:1 — три промежутка и две полки (Q70). */
const SHELVES: Command = { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }], member: "shelf" };
const IN = (host: string, offset: number): Command => ({
  word: "PLACE", host, type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: host, face: "bottom" }, side: "inside", offset },
});

describe("PATTERN · создать", () => {
  it("[spec:E08] [spec:Q70] [rt:H2] 1:1:1 — три промежутка и две полки, остаток первому", () => {
    const { state } = build(CUBE_600, SHELVES);
    expect(dims(state.evaluation.boxes.S2)[1]).toBe(218.8);
    expect(dims(state.evaluation.boxes.S3)[1]).toBe(218.6);
    expect(dims(state.evaluation.boxes.S4)[1]).toBe(218.6);
    expect(dims(state.evaluation.boxes.P5)).toEqual([568, 16, 538]); // отступы типа «полка» (R24)
    const a = state.graph.nodes.A1;
    expect(a?.kind === "pattern" && a.gapIds).toEqual(["S2", "S3", "S4"]);
    expect(a?.kind === "pattern" && a.memberIds).toEqual(["P5", "P6"]);
  });

  it("[spec:Q25] [rt:H5] постоянный и два flex", () => {
    const { state } = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "x", gaps: [{ fixed: 200 }, "flex", "flex"], member: null });
    expect(dims(state.evaluation.boxes.S2)[0]).toBe(200);
    expect(dims(state.evaluation.boxes.S3)[0]).toBe(184);
  });

  it("[spec:Q19] [rt:E1] паттерн в занятом пространстве — отказ с именем, граф тот же", () => {
    const s = build(CUBE_600, IN("S1", 300));
    const r = run(s, SHELVES);
    expect(r.result.findings[0]!.code).toBe("REF-ORPHAN");
    expect(r.result.findings[0]!.nodes).toEqual(["P5"]);
    expect(r.session).toBe(s);
  });
});

describe("PATTERN · операции", () => {
  it("[spec:R04] доли меняются — ни один uid не меняется", () => {
    const s = build(CUBE_600, SHELVES);
    const r = run(s, { word: "PATTERN", op: "ratio", pattern: "A1", gaps: [{ ratio: 2 }, { ratio: 1 }, { ratio: 1 }] });
    expect(r.result.accepted).toBe(true);
    expect(r.session.state.graph.order).toEqual(s.state.graph.order);
    expect(dims(r.session.state.evaluation.boxes.S2)[1]).toBe(328);
    expect(r.result.changes.every((c) => c.kind === "changed")).toBe(true);
  });

  it("[spec:R04] долями количество не меняют — отказ с подсказкой", () => {
    const r = run(build(CUBE_600, SHELVES), { word: "PATTERN", op: "ratio", pattern: "A1", gaps: [{ ratio: 1 }, { ratio: 1 }] });
    expect(r.result.findings[0]!.code).toBe("REF-AMBIGUOUS");
    expect(r.result.findings[0]!.options).toContain("вставить участника");
  });

  it("[spec:R04] вставка делит промежуток: нижний сохраняет uid, верхний новый", () => {
    const s = build(CUBE_600, SHELVES);
    const r = run(s, { word: "PATTERN", op: "insert", gap: "S3" });
    expect(r.result.accepted).toBe(true);
    const a = r.session.state.graph.nodes.A1;
    expect(a?.kind === "pattern" && a.gapIds).toEqual(["S2", "S3", "S5", "S4"]);
    expect(a?.kind === "pattern" && a.memberIds).toEqual(["P5", "P7", "P6"]);
  });

  it("[spec:R04] удаление участника сливает два промежутка, uid нижнего живёт", () => {
    const s = build(CUBE_600, SHELVES);
    const r = run(s, { word: "PATTERN", op: "remove", member: "P5" });
    expect(r.result.accepted).toBe(true);
    const a = r.session.state.graph.nodes.A1;
    expect(a?.kind === "pattern" && a.gapIds).toEqual(["S2", "S4"]);
    expect(r.session.state.graph.nodes.S3).toBeUndefined();
    // 688 − 16 (одна полка) = 672 на два промежутка по доле 2 : 1
    expect(dims(r.session.state.evaluation.boxes.S2)[1]).toBe(448);
    expect(dims(r.session.state.evaluation.boxes.S4)[1]).toBe(224);
  });

  it("[spec:R04] содержимое исчезнувшего промежутка остаётся на месте", () => {
    const s = build(CUBE_600, SHELVES, IN("S3", 50));
    const placed = s.state.evaluation.boxes.P7!;
    const r = run(s, { word: "PATTERN", op: "remove", member: "P5" });
    expect(r.result.accepted).toBe(true);
    const after = r.session.state.evaluation.boxes.P7!;
    expect(after.min.y).toBe(placed.min.y);
    expect(r.session.state.graph.nodes.P7!.kind === "part" && (r.session.state.graph.nodes.P7 as { host: string }).host).toBe("S2");
  });

  it("[spec:Q26] [rt:E4] распустить занятый паттерн — отказ; свободный распускается", () => {
    const busy = build(CUBE_600, SHELVES, IN("S3", 50));
    expect(run(busy, { word: "PATTERN", op: "dissolve", pattern: "A1" }).result.findings[0]!.code).toBe("REF-ORPHAN");
    const free = build(CUBE_600, SHELVES);
    const r = run(free, { word: "PATTERN", op: "dissolve", pattern: "A1" });
    expect(r.result.accepted).toBe(true);
    expect(r.session.state.graph.order).toEqual(["U1", "P1", "P2", "P3", "P4", "S1"]);
  });

  it("[spec:W04] постоянные промежутки больше пространства — REF-NO-ROOM", () => {
    const r = run(build(CUBE_600), { word: "PATTERN", op: "create", space: "S1", axis: "x", gaps: [{ fixed: 400 }, { fixed: 400 }], member: null });
    expect(r.result.findings[0]!.code).toBe("REF-NO-ROOM");
  });
});

describe("PATTERN · отвязать один и отпустить", () => {
  const THREE: Command = { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }, { ratio: 1 }], member: "shelf" };

  it("[spec:Q68] [spec:Z04] [rt:M4] [rt:T3] отвязка делит паттерн на два; соседи не двигаются, uid полок те же", () => {
    const s = build(CUBE_600, THREE);
    const before = s.state.evaluation.boxes;
    const r = run(s, { word: "PATTERN", op: "detach", member: "P6" });
    expect(r.result.accepted).toBe(true);
    const g = r.session.state.graph;
    expect(g.nodes.A1).toBeUndefined();                       // прежний паттерн закрыт
    const patterns = g.order.filter((id) => g.nodes[id]!.kind === "pattern");
    expect(patterns).toEqual(["A2", "A3"]);                   // два новых, прежний uid не переиспользован
    expect(g.nodes.P5).toBeDefined();
    expect(g.nodes.P6).toBeDefined();
    expect(g.nodes.P7).toBeDefined();
    const after = r.session.state.evaluation.boxes;
    for (const id of ["P5", "P6", "P7"]) expect(after[id]!.min.y, id).toBe(before[id]!.min.y);
  });

  it("[spec:R31] [rt:M5] после отвязки каждый паттерн делит свою область", () => {
    const s = run(build(CUBE_600, THREE), { word: "PATTERN", op: "detach", member: "P6" }).session;
    const mid = s.state.evaluation.boxes.P6!.min.y;
    const r = run(s, { word: "DRAG", target: "unit", axis: "y", size: 900 });
    expect(r.result.accepted).toBe(true);
    const after = r.session.state.evaluation.boxes;
    expect(after.P6!.min.y).toBe(mid);                        // отвязанная стоит на своём отступе
    // нижняя область ограничена отвязанной полкой и не изменилась — её полка тоже стоит
    expect(after.P5!.min.y).toBe(s.state.evaluation.boxes.P5!.min.y);
    // верхняя область выросла с юнитом — её полка поделила заново
    expect(after.P7!.min.y).not.toBe(s.state.evaluation.boxes.P7!.min.y);
  });

  it("[spec:Q91] [spec:Z05] [rt:T6] [rt:M6] RELEASE: паттерна нет, uid прежние, высота их не двигает", () => {
    const s = build(CUBE_600, THREE);
    const positions = ["P5", "P6", "P7"].map((id) => s.state.evaluation.boxes[id]!.min.y);
    const r = run(s, { word: "PATTERN", op: "release", pattern: "A1" });
    expect(r.result.accepted).toBe(true);
    const g = r.session.state.graph;
    expect(g.order.filter((id) => g.nodes[id]!.kind === "pattern")).toEqual([]);
    expect(["P5", "P6", "P7"].map((id) => r.session.state.evaluation.boxes[id]!.min.y)).toEqual(positions);
    const taller = run(r.session, { word: "DRAG", target: "unit", axis: "y", size: 900 }).session;
    expect(["P5", "P6", "P7"].map((id) => taller.state.evaluation.boxes[id]!.min.y)).toEqual(positions);
  });

  it("[spec:Q69] [rt:M12] после RELEASE ссылки живут: ширина тянет полки, высота — нет", () => {
    const s = run(build(CUBE_600, THREE), { word: "PATTERN", op: "release", pattern: "A1" }).session;
    const wider = run(s, { word: "DRAG", target: "unit", axis: "x", size: 800 }).session;
    expect(dims(wider.state.evaluation.boxes.P5)[0]).toBe(768);
  });

  it("[spec:Q54] сдвиг полки закрепляет только её паттерн: перегородка под ней и полка за перегородкой живут своими долями", () => {
    const s = build(CUBE_600,
      { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ fixed: 300 }, "flex"], member: "shelf" },
      { word: "PATTERN", op: "create", space: "S2", axis: "x", gaps: [{ fixed: 276 }, "flex"], member: "divider" },
      { word: "PATTERN", op: "create", space: "S5", axis: "y", gaps: [{ fixed: 142 }, "flex"], member: "shelf" });
    const r = run(s, { word: "DRAG", target: "part", part: "P5", delta: -120 });
    expect(r.result.accepted).toBe(true);
    const b = r.session.state.evaluation.boxes;
    expect(dims(b.P6)[1]).toBe(180);                 // перегородка по месту: до полки
    expect(b.P7!.min.y).toBe(s.state.evaluation.boxes.P7!.min.y); // вторая полка не сдвинулась
    const d = run(s, { word: "DRAG", target: "part", part: "P6", delta: 100 });
    expect(d.result.accepted).toBe(true);
    expect(dims(d.session.state.evaluation.boxes.S4)[0]).toBe(376);
  });

  it("[spec:R31] промежутки после RELEASE живут со своими uid и держатся за соседние полки", () => {
    const s = build(CUBE_600, THREE, IN("S3", 40));
    const placed = s.state.evaluation.boxes.P8!.min.y;
    const r = run(s, { word: "PATTERN", op: "release", pattern: "A1" });
    expect(r.result.accepted).toBe(true);
    expect(r.session.state.graph.nodes.S3).toBeDefined();
    expect(r.session.state.evaluation.boxes.P8!.min.y).toBe(placed);
  });
});
