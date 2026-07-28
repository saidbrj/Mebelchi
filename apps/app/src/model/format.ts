// Money formatting for the ticker. Intl ru-RU groups thousands with a
// non-breaking space (U+00A0) or narrow NBSP (U+202F); normalise both to a
// plain space so the ticker renders consistently across platforms.
import type { Currency, FxRates } from "./settings";

const grouped = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/[\u00A0\u202F]/g, " ");

export const fmtSum = (n: number): string => grouped(n) + " сум";

/** Format a USD base amount in the seller's DISPLAY currency. USD is the anchor: сум/тенге
 *  convert via the seller's exchange rate (units per 1 USD); USD itself shows up to 2 decimals
 *  for small unit prices. Prefer the reactive `useMoney()` hook in components. */
export function formatMoney(usd: number, currency: Currency, fx: FxRates): string {
  if (currency === "USD") {
    const v = Math.abs(usd) < 1000 ? Math.round(usd * 100) / 100 : Math.round(usd);
    return "$" + v.toLocaleString("en-US");
  }
  const local = usd * (currency === "KZT" ? fx.KZT : fx.UZS);
  return grouped(local) + (currency === "KZT" ? " ₸" : " сум");
}
