import { describe, it, expect } from "vitest";
import { joints, material, run, setSlotMaterial, slotOf, slots } from "../../index";
import { build, CUBE_600 } from "../../testkit";
import type { Command } from "../../index";

const SHELF = (offset: number): Command => ({
  word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
  relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset },
});

describe("SCOPE · слоты [spec:W10] [spec:E12]", () => {
  it("[spec:E12] у детали слот по типу, пока мастер не сказал иначе", () => {
    const s = build(CUBE_600, SHELF(300));
    expect(slotOf(s, "P1")).toBe("КОРПУС-A");
    expect(slotOf(s, "P5")).toBe("КОРПУС-A");
    expect(material(s, "КОРПУС-A")).toBe("ldsp-16-white");
  });

  it("[spec:R50] [spec:R51] «все детали типа» превращается в список uid и он записан в журнал", () => {
    const s = build(CUBE_600, SHELF(200), SHELF(400));
    const r = run(s, { word: "SCOPE", target: { kind: "type", type: "shelf" }, key: "slot", value: "ФАСАД-B" });
    expect(r.result.accepted).toBe(true);
    expect(slotOf(r.session, "P5")).toBe("ФАСАД-B");
    expect(slotOf(r.session, "P6")).toBe("ФАСАД-B");
    expect(slotOf(r.session, "P1")).toBe("КОРПУС-A");        // боковина не тронута
    expect(r.session.state.journal.at(-1)).toContain("P5, P6");
  });

  it("[spec:R52] новая деталь старого изменения не получает", () => {
    const s = run(build(CUBE_600, SHELF(200)), { word: "SCOPE", target: { kind: "type", type: "shelf" }, key: "slot", value: "ФАСАД-B" }).session;
    const later = run(s, SHELF(400)).session;
    expect(slotOf(later, "P5")).toBe("ФАСАД-B");
    expect(slotOf(later, "P6")).toBe("КОРПУС-A");
  });

  it("[spec:W10] цель «группа» и цель «весь юнит»", () => {
    const s = run(build(CUBE_600, SHELF(200), SHELF(400)), { word: "GROUP", op: "create", members: ["P5"] }).session;
    const byGroup = run(s, { word: "SCOPE", target: { kind: "group", id: "G1" }, key: "slot", value: "ФАСАД-A" });
    expect(slotOf(byGroup.session, "P5")).toBe("ФАСАД-A");
    expect(slotOf(byGroup.session, "P6")).toBe("КОРПУС-A");
    const all = run(byGroup.session, { word: "SCOPE", target: { kind: "unit" }, key: "slot", value: "КОРПУС-B" });
    for (const id of ["P1", "P2", "P3", "P4", "P5", "P6"]) expect(slotOf(all.session, id), id).toBe("КОРПУС-B");
  });

  it("[spec:E12] смена материала слота меняет всё, что на него ссылается, одним действием", () => {
    const s = run(build(CUBE_600, SHELF(300)), { word: "SCOPE", target: { kind: "part", id: "P5" }, key: "slot", value: "ФАСАД-A" }).session;
    const { session, touched } = setSlotMaterial(s, "ФАСАД-A", "дуб");
    expect(touched).toEqual(["P5"]);
    expect(material(session, "ФАСАД-A")).toBe("дуб");
    expect(material(session, "КОРПУС-A")).toBe("ldsp-16-white");
    expect(Object.keys(slots(session))).toContain("ФАСАД-B");
  });

  it("[spec:W10] цели, которой нет, — отказ; граф тот же", () => {
    const s = build(CUBE_600);
    const r = run(s, { word: "SCOPE", target: { kind: "type", type: "решётка" }, key: "slot", value: "ФАСАД-A" });
    expect(r.result.findings[0]!.code).toBe("REF-MISSING-REF");
    expect(r.session).toBe(s);
  });

  it("[spec:R34] способ стыка по-прежнему меняется той же командой", () => {
    const s = build(CUBE_600);
    const r = run(s, { word: "SCOPE", joint: ["P1", "P3"], key: "method", value: "шкант-8" });
    expect(joints(r.session).find((j) => j.id === "P1×P3")!.method).toBe("шкант-8");
  });
});
