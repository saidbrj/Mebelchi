// Форма находки и результата команды (SPEC 07_FINDINGS, G11).
import { CATALOG, type FindingCode, type Severity } from "./findings.findings";

export interface Finding {
  code: FindingCode;
  severity: Severity;
  /** uid узлов, к которым относится находка */
  nodes: string[];
  /** полный русский текст: общий смысл кода + подробность */
  text: string;
  /** команды, которые пользователь МОЖЕТ выбрать (ядро их не выполняет) */
  options: string[];
}

/** Результат, который либо удался, либо отказан со списком причин. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; findings: Finding[] };

export function finding(code: FindingCode, nodes: string[], detail: string, options: string[] = []): Finding {
  const c = CATALOG[code];
  return { code, severity: c.severity, nodes, text: detail ? `${c.ru}: ${detail}` : c.ru, options };
}

export const refuse = <T>(...findings: Finding[]): Outcome<T> => ({ ok: false, findings });
export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });

/** Объявление ключа настройки, который читает функция (SPEC A04). Значения здесь нет. */
export interface SettingDecl {
  /** имя поля в def.json */
  key: string;
  /** путь Thing внутри src/poligon/things, например "profiles/qorasu" */
  file: string;
  layer: "PROFILE" | "DATA";
  why: string;
}
