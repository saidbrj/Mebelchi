// Попытка изменить чужую деталь — отказ; команды такой у App 2 нет, но проверка стоит на входе.
import type { FindingCode } from "../../0-base/findings/findings.findings";

export const FINDINGS: readonly FindingCode[] = ["REF-LOCKED", "REF-MISSING-REF"];
