// A reactive money formatter — takes a USD base amount and renders it in the seller's
// display currency (converting сум/тенге via their exchange rate). Use in components instead
// of `fmtSum` so prices re-format the instant the seller switches currency or edits the rate.
import { useStore } from "./store";
import { formatMoney } from "./model/format";

export function useMoney(): (usd: number) => string {
  const currency = useStore((s) => s.settings.currency);
  const fxRates = useStore((s) => s.settings.fxRates);
  return (usd: number) => formatMoney(usd, currency, fxRates);
}
