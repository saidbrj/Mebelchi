import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "carcassThicknessMm", file: "profiles/qorasu", layer: "PROFILE", why: "толщина досок по умолчанию" },
  { key: "residualPolicy", file: "profiles/qorasu", layer: "PROFILE", why: "остаток деления (U03)" },
  { key: "rank", file: "tables/junction-rank", layer: "PROFILE", why: "какая доска проходит насквозь на стыке" },
];
