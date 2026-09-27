import { describe, it, expect } from "vitest";
import { QORASU, lengthOf } from "../profile/profile";
import { INSETS, insetOf, nameOf } from "./types";

describe("правила по типу детали [spec:E07]", () => {
  it("[spec:R24] отступы полки приходят из профиля через таблицу типов, а не из кода", () => {
    expect(insetOf(QORASU, "shelf", "front")).toBe(lengthOf(QORASU, "shelfSetbackMm"));
    expect(insetOf(QORASU, "shelf", "back")).toBe(lengthOf(QORASU, "backOverlayShelfGapMm"));
  });

  it("[spec:E07] тип без правила не получает отступов", () => {
    expect(insetOf(QORASU, "side", "front")).toBe(0);
    expect(insetOf(QORASU, "спонтанный", "back")).toBe(0);
  });

  it("[spec:E07] имя типа одно везде и берётся из файла", () => {
    expect(nameOf("shelf")).toBe("полка");
    expect(nameOf("неизвестный")).toBe("неизвестный");
    expect(Object.keys(INSETS)).toContain("shelf");
  });
});
