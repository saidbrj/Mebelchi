import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "carcassThicknessMm", file: "profiles/qorasu", layer: "PROFILE", why: "толщина досок-границ" },
  { key: "residualPolicy", file: "profiles/qorasu", layer: "PROFILE", why: "кому достаётся остаток деления" },
];
