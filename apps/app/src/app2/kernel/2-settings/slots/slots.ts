// Слоты материалов проекта (SPEC E12). Имена слотов и умолчания — в файле настроек, не в коде.
import slotsDef from "../../../poligon/things/tables/slots/def.json";
import type { Field } from "../profile/profile";

const parse = (text: string): Record<string, string> =>
  Object.fromEntries(text.split(",").map((p) => p.split("=").map((x) => x.trim()) as [string, string]));

const fields = slotsDef.fields as Record<string, Field>;

/** Слоты проекта и их материалы: с чего начинается новый проект. */
export const DEFAULT_SLOTS: Readonly<Record<string, string>> = parse(String(fields.defaults!.value));

const BY_TYPE: Record<string, string> = parse(String(fields.byType!.value));

/** Слот, который получает деталь этого типа, пока мастер не сказал иначе. */
export const slotForType = (type: string): string => BY_TYPE[type] ?? Object.keys(DEFAULT_SLOTS)[0]!;

/** Материал слота проекта. */
export const materialOf = (slots: Readonly<Record<string, string>>, slot: string): string => slots[slot] ?? "—";
