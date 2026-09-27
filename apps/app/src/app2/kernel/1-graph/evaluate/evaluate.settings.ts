// Вычисление читает толщину и правило остатка через Env, который собирает слой 2-settings.
import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "carcassThicknessMm", file: "profiles/qorasu", layer: "PROFILE", why: "толщина досок корпуса и границ деления" },
  { key: "residualPolicy", file: "profiles/qorasu", layer: "PROFILE", why: "кому достаётся остаток деления" },
];
