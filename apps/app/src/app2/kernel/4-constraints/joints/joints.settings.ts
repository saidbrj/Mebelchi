// Способ по умолчанию приходит из таблицы типов деталей (её читает слой настроек).
import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [
  { key: "joints", file: "tables/part-types", layer: "PROFILE", why: "способ соединения по умолчанию для пары типов" },
];
