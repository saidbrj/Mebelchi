import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "minCarcassMm", file: "profiles/qorasu", layer: "PROFILE", why: "наименьший габарит модуля" },
];
