// Транзакция не читает настроек: профиль приходит внутри Env состояния.
import type { SettingDecl } from "../../0-base/findings/findings";

export const SETTINGS: readonly SettingDecl[] = [];
