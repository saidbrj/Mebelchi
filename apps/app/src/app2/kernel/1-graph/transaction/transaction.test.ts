import { describe, it, expect } from "vitest";
import { run, setProfile, previewProfile, undo, start } from "../../index";
import { build, CUBE_600, dims } from "../../testkit";

const SHELVES = { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }], member: "shelf" } as const;

describe("transaction", () => {
  it("[spec:G11] [spec:P02] отказ возвращает тот же объект сессии и состояния", () => {
    const s = build(CUBE_600);
    const r = run(s, { word: "PATTERN", op: "create", space: "S404", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }], member: null });
    expect(r.result.accepted).toBe(false);
    expect(r.session).toBe(s);
    expect(r.result.state).toBe(s.state);
  });

  it("[spec:G15] отчёт изменений: добавленные узлы в порядке создания", () => {
    const r = run(build(CUBE_600), SHELVES);
    expect(r.result.changes.filter((c) => c.kind === "added").map((c) => c.id)).toEqual(["A1", "S2", "S3", "P5"]);
  });

  it("[spec:G18] [spec:M01] undo возвращает прежнее состояние — тот же объект графа", () => {
    const before = build(CUBE_600);
    const after = run(before, SHELVES).session;
    expect(undo(after).state).toBe(before.state);
    expect(undo(after).state.graph.counters).toEqual({ U: 1, S: 1, A: 0, P: 4, J: 0, G: 0 });
  });

  it("[spec:R02] [rt:T12] выданный uid не выдаётся второй раз, даже после отмены", () => {
    const base = build(CUBE_600);
    const withShelves = run(base, SHELVES).session;
    const shelf = withShelves.state.graph.order.filter((id) => !base.state.graph.order.includes(id));
    const back = undo(withShelves);
    expect(back.state).toBe(base.state);

    // то же место, другая команда: новые узлы обязаны получить НОВЫЕ uid
    const again = run(back, { ...SHELVES, gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }] });
    const reborn = again.session.state.graph.order.filter((id) => !base.state.graph.order.includes(id));
    expect(reborn.some((id) => shelf.includes(id))).toBe(false);
  });

  it("[spec:G17] [rt:J1] один журнал — один граф (побитово)", () => {
    const cmds = [CUBE_600, SHELVES, { word: "DRAG", target: "unit", axis: "y", size: 900 }] as const;
    const a = build(...cmds).state;
    const b = build(...cmds).state;
    expect(JSON.stringify([a.graph, a.evaluation])).toBe(JSON.stringify([b.graph, b.evaluation]));
  });

  it("[spec:G11] [rt:J2] команда, одна доска которой сталкивается, не создаёт ни одной", () => {
    // доска-«козырёк» лежит на верхней грани нижней ячейки НАРУЖУ и заходит в верхнюю (S3, 344 мм).
    // Новое деление S3 на 4 кладёт первую доску на 74–90 мм от низа S3; козырёк на 80–96 — пересечение.
    const s = build(
      CUBE_600,
      { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }], member: null },
      { word: "PLACE", host: "S2", type: "shelf", spans: { x: "full", z: "full" },
        relation: { kind: "on", plane: { node: "S2", face: "top" }, side: "outside", offset: 80 } },
    );
    const parts = s.state.graph.order.filter((id) => id.startsWith("P")).length;
    const r = run(s, { word: "PATTERN", op: "create", space: "S3", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }, { ratio: 1 }], member: "shelf" });
    expect(r.result.accepted).toBe(false);
    expect(r.result.findings[0]!.code).toBe("REF-OVERLAP");
    expect(r.session.state.graph.order.filter((id) => id.startsWith("P")).length).toBe(parts);
  });

  it("[spec:M03] [spec:G19] профиль 16 → 18: сначала отчёт о влиянии, потом всё пересчитано", () => {
    const s = build(CUBE_600, SHELVES);
    const preview = previewProfile(s, "carcassThicknessMm", 18);
    expect(preview.ok && preview.changes.length).toBeGreaterThan(0);
    const r = setProfile(s, "carcassThicknessMm", 18);
    expect(r.result.accepted).toBe(true);
    expect(dims(r.session.state.evaluation.boxes.P1)).toEqual([18, 720, 560]);
    expect(dims(r.session.state.evaluation.boxes.S1)).toEqual([564, 684, 560]);
    expect(undo(r.session).state).toBe(s.state);
  });

  it("[spec:G19] [spec:WARN-EXTERNAL-CONFLICT] правка профиля, которая ломает модуль, — не отказ, а блокирующее предупреждение", () => {
    const s = build(CUBE_600, { word: "PATTERN", op: "create", space: "S1", axis: "x", gaps: [{ fixed: 284 }, { fixed: 284 }], member: null });
    const r = setProfile(s, "carcassThicknessMm", 18);
    expect(r.result.accepted).toBe(true);
    expect(r.result.findings.map((f) => f.code)).toContain("WARN-EXTERNAL-CONFLICT");
    expect(r.result.findings.every((f) => f.severity === "blocking")).toBe(true);
  });

  it("[spec:S05] [rt:G2] значение профиля вне диапазона — отказ, сессия та же", () => {
    const s = start();
    const r = setProfile(s, "carcassThicknessMm", 60);
    expect(r.result.findings[0]!.code).toBe("REF-OUT-OF-RANGE");
    expect(r.session).toBe(s);
  });
});

describe("transaction · ничего автоматически", () => {
  it("[spec:G14] [spec:P01] если слово добавило больше деталей, чем объявило, — это ошибка ядра, а не результат", async () => {
    const { commit } = await import("./transaction");
    const { ok } = await import("../../0-base/findings/findings");
    const { withNodes } = await import("../model/model");
    const s = build(CUBE_600).state;
    const extra = { ...(s.graph.nodes.P1 as object), id: "P99" } as never;
    const sneaky = ok({ graph: withNodes(s.graph, [extra]), declares: { parts: 0 }, summary: "тайная деталь" });
    expect(() => commit(s, sneaky, [])).toThrow(/G14/);
  });
});
