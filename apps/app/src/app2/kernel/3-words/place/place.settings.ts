import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "carcassThicknessMm", file: "profiles/qorasu", layer: "PROFILE", why: "толщина доски, если она не объявлена" },
];
