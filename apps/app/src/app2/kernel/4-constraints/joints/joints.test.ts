import { describe, it, expect } from "vitest";
import { joints, run } from "../../index";
import { build, CUBE_600 } from "../../testkit";
import type { Command } from "../../index";

const SHELVES: Command = { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }], member: "shelf" };
const byId = (list: ReturnType<typeof joints>, id: string) => list.find((j) => j.id === id)!;

describe("стыки [spec:E14]", () => {
  it("[spec:E14] у куба четыре стыка: дно и крышка к двум боковинам", () => {
    const list = joints(build(CUBE_600));
    expect(list.map((j) => j.id)).toEqual(["P1×P3", "P1×P4", "P2×P3", "P2×P4"]);
  });

  it("[spec:Z06] [rt:T4] полка через две перегородки даёт два разных стыка, каждый со своим способом", () => {
    const s = build(CUBE_600, SHELVES);
    const list = joints(s);
    const left = byId(list, "P1×P5");
    const right = byId(list, "P2×P5");
    expect(left.id).not.toBe(right.id);
    expect(left.method).toBe(right.method);
    const r = run(s, { word: "SCOPE", joint: ["P5", "P1"], key: "method", value: "шкант-8" });
    expect(r.result.accepted).toBe(true);
    const after = joints(r.session);
    expect(byId(after, "P1×P5").method).toBe("шкант-8");
    expect(byId(after, "P1×P5").overridden).toBe(true);
    expect(byId(after, "P2×P5").method).toBe(left.method);   // соседний стык не тронут
    expect(byId(after, "P2×P5").overridden).toBe(false);
  });

  it("[spec:R05] имя стыка — это место: порядок деталей не важен", () => {
    const s = build(CUBE_600, SHELVES);
    const r = run(s, { word: "SCOPE", joint: ["P1", "P5"], key: "method", value: "шкант-8" });
    const again = run(r.session, { word: "SCOPE", joint: ["P5", "P1"], key: "method", value: "конфирмат-7x50" });
    const nodes = again.session.state.graph.order.filter((id) => again.session.state.graph.nodes[id]!.kind === "joint");
    expect(nodes).toHaveLength(1);                            // одно переопределение на место
    expect(byId(joints(again.session), "P1×P5").method).toBe("конфирмат-7x50");
  });

  it("[spec:E14] насквозь идёт та деталь, к чьей грани пришла вторая", () => {
    const list = joints(build(CUBE_600, SHELVES));
    expect(byId(list, "P1×P5").through).toBe("P1");           // боковина сквозная, у полки торец
    expect(byId(list, "P1×P3").through).toBe("P1");           // дно упирается в боковину
  });

  it("[spec:R34] способ по умолчанию приходит из профиля по паре типов", () => {
    const list = joints(build(CUBE_600, SHELVES));
    expect(byId(list, "P1×P5").method).toBe("confirmat-7x50");
    // полка 16 мм упирается в боковину на всю глубину 538: 16 × 538 = 8608 мм²
    expect(byId(list, "P1×P5").areaMm2).toBe(8608);
    expect(byId(list, "P1×P3").areaMm2).toBe(8960);   // дно 16 × 560
  });

  it("[spec:R05] заменили деталь — стык с ней закрылся, соседние живут", () => {
    const s = build(CUBE_600, SHELVES);
    expect(joints(s).some((j) => j.id === "P1×P5")).toBe(true);
    const r = run(s, { word: "PATTERN", op: "remove", member: "P5" });
    expect(r.result.accepted).toBe(true);
    const after = joints(r.session);
    expect(after.some((j) => j.id === "P1×P5")).toBe(false);
    expect(after.some((j) => j.id === "P1×P6")).toBe(true);
  });
});
