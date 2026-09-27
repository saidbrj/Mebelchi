// uid узлов графа (SPEC G10). Чистая функция: счётчики входят и выходят, ничего глобального.

/** U юнит · S пространство · A паттерн · P деталь · J стык (только изменённый) · G группа */
export type Kind = "U" | "S" | "A" | "P" | "J" | "G";

export type Counters = Readonly<Record<Kind, number>>;

export const EMPTY_COUNTERS: Counters = { U: 0, S: 0, A: 0, P: 0, J: 0, G: 0 };

/** Выдаёт следующий uid вида `kind` и новые счётчики. */
export function allocate(counters: Counters, kind: Kind): [string, Counters] {
  const n = counters[kind] + 1;
  return [`${kind}${n}`, { ...counters, [kind]: n }];
}

/** Выдаёт `count` uid подряд. */
export function allocateMany(counters: Counters, kind: Kind, count: number): [string[], Counters] {
  const ids: string[] = [];
  let c = counters;
  for (let i = 0; i < count; i++) {
    const [id, next] = allocate(c, kind);
    ids.push(id);
    c = next;
  }
  return [ids, c];
}

export const kindOf = (id: string): Kind => id.charAt(0) as Kind;

/** Наибольшее из двух состояний счётчика — по каждому виду. Нужен, чтобы выданный uid никогда
 *  не выдавался второй раз, в том числе после отмены (SPEC R02). */
export const mergeMax = (a: Counters, b: Counters): Counters =>
  Object.fromEntries((Object.keys(a) as Kind[]).map((k) => [k, Math.max(a[k], b[k])])) as unknown as Counters;
