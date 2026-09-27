// Какие ключи читает эта функция (SPEC A04). Значений здесь нет: они в профиле цеха.
import type { SettingDecl } from "../findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "residualPolicy", file: "profiles/qorasu", layer: "PROFILE", why: "кому достаётся остаток деления (U03)" },
];
