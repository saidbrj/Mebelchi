import { describe, it, expect } from "vitest";
import { QORASU, envOf, lengthOf, runsThrough, setValue } from "./profile";

describe("profile", () => {
  it("[spec:S01] [spec:O03] толщина корпуса — из файла профиля, с происхождением", () => {
    const t = envOf(QORASU).thickness({ from: "profile", key: "carcassThicknessMm" });
    expect(t.mm10).toBe(lengthOf(QORASU, "carcassThicknessMm"));
    expect(t.from).toContain("profile:qorasu carcassThicknessMm");
  });

  it("[spec:S05] [rt:G2] значение вне диапазона отказано при вводе", () => {
    const r = setValue(QORASU, "carcassThicknessMm", 40);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]!.code).toBe("REF-OUT-OF-RANGE");
  });

  it("[spec:M03] правка даёт новый профиль, старый не меняется", () => {
    const before = QORASU.fields.carcassThicknessMm!.value;
    const r = setValue(QORASU, "carcassThicknessMm", 18);
    expect(r.ok && r.value.fields.carcassThicknessMm!.value).toBe(18);
    expect(QORASU.fields.carcassThicknessMm!.value).toBe(before);
  });

  it("[spec:S11] стратегия стыка — таблица рангов: боковина проходит мимо дна и крышки", () => {
    expect(runsThrough(QORASU, "side", "bottom")).toBe(true);
    expect(runsThrough(QORASU, "side", "top")).toBe(true);
    expect(runsThrough(QORASU, "bottom", "side")).toBe(false);
  });
});
