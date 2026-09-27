// Каталог кодов находок (SPEC 07_FINDINGS). Одно место для текста каждого кода.

export type Severity = "refusal" | "blocking" | "advice";

export const CATALOG = {
  "REF-MISSING-REF": { severity: "refusal", ru: "ссылка на узел, которого нет", source: "G10" },
  "REF-AMBIGUOUS": { severity: "refusal", ru: "пришлось бы угадывать", source: "P03" },
  "REF-PRECISION": { severity: "refusal", ru: "размер точнее 0.1 мм", source: "U06" },
  "REF-OUT-OF-SCOPE-APP1": { severity: "refusal", ru: "это работа App 1 (кухня, несколько модулей, цоколь)", source: "P08" },
  "REF-OVERLAP": { severity: "refusal", ru: "детали занимают один объём", source: "L1a" },
  "REF-ORPHAN": { severity: "refusal", ru: "содержимое осталось бы без ячейки", source: "Q19" },
  "REF-NO-ROOM": { severity: "refusal", ru: "не помещается", source: "W04" },
  "REF-TOO-SMALL": { severity: "refusal", ru: "меньше минимального размера", source: "L5" },
  "REF-LOCKED": { severity: "refusal", ru: "этот размер задан связью, его меняет другое действие", source: "W13" },
  "REF-CYCLE": { severity: "refusal", ru: "ссылки замкнулись в круг", source: "G16" },
  "REF-HAS-DEPENDENTS": { severity: "refusal", ru: "на этот узел ссылаются", source: "G16" },
  "REF-OUT-OF-RANGE": { severity: "refusal", ru: "значение вне допустимого диапазона", source: "S05" },
  "WARN-EXTERNAL-CONFLICT": { severity: "blocking", ru: "правка настроек создала проблему в модуле", source: "G19" },
} as const satisfies Record<string, { severity: Severity; ru: string; source: string }>;

export type FindingCode = keyof typeof CATALOG;
