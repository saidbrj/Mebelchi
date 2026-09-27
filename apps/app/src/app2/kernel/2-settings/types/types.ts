// Правила профиля по типу детали (SPEC E07, R24). Таблица типов — файл, а не код.
import typesDef from "../../../poligon/things/tables/part-types/def.json";
import type { Face } from "../../1-graph/model/model";
import type { Mm10 } from "../../0-base/units/units";
import { lengthOf, type Field, type Profile } from "../profile/profile";

type Table = Record<string, Partial<Record<Face, string>>>;

function parse(text: string): Table {
  const out: Table = {};
  for (const row of text.split(",")) {
    const [type, rules] = row.split(":");
    if (!type || !rules) continue;
    const faces: Partial<Record<Face, string>> = {};
    for (const rule of rules.split("|")) {
      const [face, key] = rule.split("=");
      if (face && key) faces[face.trim() as Face] = key.trim();
    }
    out[type.trim()] = faces;
  }
  return out;
}

const fields = typesDef.fields as Record<string, Field>;
export const INSETS: Table = parse(String(fields.insets!.value));
export const NAMES: Record<string, string> = Object.fromEntries(
  String(fields.names!.value).split(",").map((p) => p.split(":").map((x) => x.trim()) as [string, string]),
);

/** Отступ детали этого типа от этой грани, в mm10. Нет правила — ноль. */
export function insetOf(profile: Profile, type: string, face: Face): Mm10 {
  const key = INSETS[type]?.[face];
  return key ? lengthOf(profile, key) : 0;
}

const JOINTS: Record<string, string> = Object.fromEntries(
  String(fields.joints!.value).split(",").map((p) => p.split("=").map((x) => x.trim()) as [string, string]),
);

/** Способы соединения, которые знает профиль цеха: из файла, а не из кода. */
export const METHODS: string[] = [...new Set(Object.values(JOINTS))];

/** Способ соединения по умолчанию для пары типов деталей (SPEC R34). */
export function methodFor(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return JOINTS[`${x}×${y}`] ?? JOINTS[`${y}×${x}`] ?? JOINTS["*"]!;
}

/** Человеческое имя типа — из того же файла, чтобы имя было одно везде. */
export const nameOf = (type: string): string => NAMES[type] ?? type;
