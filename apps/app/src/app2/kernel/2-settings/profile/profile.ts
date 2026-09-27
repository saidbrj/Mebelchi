// Профиль цеха как данные (SPEC S01, S05). Читает файлы Полигона, ничего не хранит второй раз.
import profileDef from "../../../poligon/things/profiles/qorasu/def.json";
import rankDef from "../../../poligon/things/tables/junction-rank/def.json";
import fillDef from "../../../poligon/things/tables/fill/def.json";
import { fromMm, type ResidualPolicy } from "../../0-base/units/units";
import { finding, ok, refuse, type Outcome } from "../../0-base/findings/findings";
import type { Env } from "../../1-graph/evaluate/evaluate";
import type { Face, Thickness } from "../../1-graph/model/model";
import { insetOf } from "../types/types";

export interface Field {
  type: string;
  value: unknown;
  unit?: string;
  domain?: { min: number; max: number };
  of?: string[];
}

export interface Profile {
  name: string;
  fields: Readonly<Record<string, Field>>;
  /** ранг роли на стыке: у кого больше, та доска проходит насквозь */
  rank: Readonly<Record<string, number>>;
}

function parseRank(text: string): Record<string, number> {
  return Object.fromEntries(
    text.split(",").map((pair) => {
      const [role, r] = pair.split(":");
      return [role!.trim(), Number(r)];
    }),
  );
}

export const QORASU: Profile = {
  name: "qorasu",
  fields: profileDef.fields as Record<string, Field>,
  rank: parseRank(String((rankDef.fields as Record<string, Field>).rank!.value)),
};

/** Таблицы, из которых ядро берёт величины помимо профиля цеха: ключ пишется как «fill:frontGapMm». */
const TABLES: Record<string, Record<string, Field>> = { fill: fillDef.fields as Record<string, Field> };

export function numberOf(p: Profile, key: string): number {
  if (key.includes(":")) {
    const [table, field] = key.split(":") as [string, string];
    const f = TABLES[table]?.[field];
    if (!f || typeof f.value !== "number") throw new Error(`нет числового поля ${key}`);
    return f.value;
  }
  const f = p.fields[key];
  if (!f || typeof f.value !== "number") throw new Error(`в профиле ${p.name} нет числового поля ${key}`);
  return f.value;
}

/** Длина из профиля в mm10. Профиль хранит мм с точностью 0.1, поэтому перевод точен. */
export function lengthOf(p: Profile, key: string): number {
  const v = fromMm(numberOf(p, key));
  if (v === null) throw new Error(`${p.name}.${key}: значение точнее 0.1 мм`);
  return v;
}

/** Проходит ли доска роли `a` насквозь на стыке с ролью `b`. */
export const runsThrough = (p: Profile, a: string, b: string): boolean => (p.rank[a] ?? 0) > (p.rank[b] ?? 0);

export function envOf(p: Profile): Env {
  return {
    profileName: p.name,
    residualPolicy: String(p.fields.residualPolicy?.value) as ResidualPolicy,
    thickness(t: Thickness) {
      if (t.from === "declared") return { mm10: t.mm10, from: "объявлено" };
      return { mm10: lengthOf(p, t.key), from: `profile:${p.name} ${t.key} = ${numberOf(p, t.key)} мм` };
    },
    inset(type: string, face: Face) {
      const mm10 = insetOf(p, type, face);
      return { mm10, from: mm10 ? `тип «${type}», грань ${face} → profile:${p.name}` : "нет правила" };
    },
  };
}

/** Новое значение поля (M03). Исходный профиль не меняется. */
export function setValue(p: Profile, key: string, value: number | string): Outcome<Profile> {
  const f = p.fields[key];
  if (!f) return refuse(finding("REF-MISSING-REF", [], `в профиле нет поля ${key}`));
  if (typeof value === "number") {
    if (f.domain && (value < f.domain.min || value > f.domain.max)) {
      return refuse(finding("REF-OUT-OF-RANGE", [], `${key} = ${value}, допустимо ${f.domain.min}–${f.domain.max} ${f.unit ?? ""}`.trim()));
    }
    if (f.unit === "mm" && fromMm(value) === null) return refuse(finding("REF-PRECISION", [], `${key} = ${value}`));
  } else if (f.of && !f.of.includes(value)) {
    return refuse(finding("REF-OUT-OF-RANGE", [], `${key} = ${value}, допустимо: ${f.of.join(", ")}`));
  }
  return ok({ ...p, fields: { ...p.fields, [key]: { ...f, value } } });
}
