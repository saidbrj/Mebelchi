import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "carcassThicknessMm", file: "profiles/qorasu", layer: "PROFILE", why: "толщина 4 досок корпуса" },
  { key: "minCarcassMm", file: "profiles/qorasu", layer: "PROFILE", why: "наименьший габарит модуля" },
  { key: "rank", file: "tables/junction-rank", layer: "PROFILE", why: "какая доска проходит насквозь" },
];
