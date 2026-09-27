import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "insets", file: "tables/part-types", layer: "PROFILE", why: "какие ключи профиля дают отступы типу детали" },
  { key: "names", file: "tables/part-types", layer: "PROFILE", why: "человеческое имя типа детали — одно на весь проект" },
  { key: "joints", file: "tables/part-types", layer: "PROFILE", why: "способ соединения по умолчанию для пары типов" },
  { key: "shelfSetbackMm", file: "profiles/qorasu", layer: "PROFILE", why: "отступ полки спереди" },
  { key: "backOverlayShelfGapMm", file: "profiles/qorasu", layer: "PROFILE", why: "зазор полки до накладного задника" },
];
