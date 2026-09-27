import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "defaults", file: "tables/slots", layer: "PROFILE", why: "слоты проекта и их материалы по умолчанию" },
  { key: "byType", file: "tables/slots", layer: "PROFILE", why: "какой слот получает деталь этого типа" },
];
