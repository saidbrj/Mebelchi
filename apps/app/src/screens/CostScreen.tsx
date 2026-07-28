// Phase Д — "Смета": the client-facing quote. Two independent pricing MODES (set in
// Настройки): the DETAILED per-part cost (real pricing engine over the run) and a simple
// per-m² "overall work" price (facade area × the seller's rate). When both are on, the
// screen presents the per-m² price as the CLIENT price and compares it to the itemised
// cost (→ the seller's margin). All engine amounts are USD (the base), rendered in the
// seller's display currency by useMoney.

import { useMemo } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { costBreakdown, facadeAreaM2, sqmPrice } from "../model/toProject";
import { useMoney } from "../useMoney";
import { useRateTable, useProduction } from "../pricing/usePrice";
import type { Cabinet } from "../model/cabinet";
import type { QuoteGroup } from "@mebelchi/schema";

// order the groups so the biggest, most tangible costs read first
const GROUP_ORDER: QuoteGroup[] = ["carcassFacade", "worktopEdge", "hardware", "cnc", "delivery"];

export function CostScreen() {
  const t = useT();
  const money = useMoney();
  const cabs = useStore((s) => s.cabs);
  const settings = useStore((s) => s.settings);
  const rates = useRateTable();
  // both modes off shouldn't happen (the step is skipped), but fall back to the itemised calc
  const showItems = settings.pricingItems || !settings.pricingSqm;
  const showSqm = settings.pricingSqm;
  const both = showItems && showSqm;

  const prod = useProduction();
  const data = useMemo(() => (showItems ? costBreakdown(cabs, rates, prod) : null), [cabs, rates, prod, showItems]);
  const real = useMemo(() => cabs.filter((c) => !c.furniture), [cabs]);
  const facadeM2 = useMemo(() => facadeAreaM2(cabs), [cabs]);
  const sqmTotal = sqmPrice(cabs, settings.sqmRate);

  const cabLabel = (c: Cabinet): string => {
    if (c.appliance && c.appliance !== "none" && c.appliance !== "filler") return t.labels.appl[c.appliance] ?? t.labels.tech;
    if (c.corner) return t.labels.corner;
    const k = c.kind === "upper" ? t.labels.kindUpper : c.kind === "tall" ? t.labels.kindTall : t.labels.kindBase;
    return `${k} ${c.w}`;
  };

  if (!real.length) {
    return (
      <section className="screen">
        <div className="qnum">{t.cost.num}</div>
        <h1 className="h1">{t.cost.title}</h1>
        <p className="sub" style={{ marginTop: 12 }}>{t.cost.emptySub}</p>
      </section>
    );
  }

  const quote = data?.quote;
  const itemTotal = quote?.total ?? 0;
  const headline = showSqm ? sqmTotal : itemTotal; // client-facing number
  const maxGroup = quote ? Math.max(...GROUP_ORDER.map((g) => quote.groups[g]), 1) : 1;
  // ONE LINE PER BOX. A merged row is a single carcass — one thing the shop builds, one price. There
  // is no honest per-cabinet number inside it: its side panels ARE its neighbour's side panels.
  const items = (data?.perBox ?? []).filter((b) => b.cabs.length > 0).sort((a, b) => b.cost - a.cost);

  /** what a box is called on the смета: a lone cabinet by its own name, a merged row by the row it is */
  const boxLabel = (b: (typeof items)[number]): string =>
    b.merged
      ? `${b.cabs[0].kind === "upper" ? t.labels.kindUpper : b.cabs[0].kind === "tall" ? t.labels.kindTall : t.labels.kindBase} ${t.cost.mergedRow}`
      : cabLabel(b.cabs[0]);

  /** its dimensions: the whole box's width, and how many sections are inside it */
  const boxDim = (b: (typeof items)[number]): string => {
    const w = b.cabs.reduce((n, c) => n + c.w, 0);
    const size = `${Math.round(w / 10)}×${Math.round(b.cabs[0].h / 10)} ${t.labels.cm}`;
    return b.merged ? `${size} · ${b.cabs.length} ${t.cost.sections}` : size;
  };

  const margin = sqmTotal - itemTotal;
  const marginPct = sqmTotal > 0 ? Math.round((margin / sqmTotal) * 100) : 0;

  return (
    <section className="screen cost-screen">
      <div className="qnum">{t.cost.num}</div>
      <h1 className="h1">{t.cost.title}</h1>

      {(settings.company || settings.name || settings.phone) && (
        <div className="cost-from">
          {settings.company && <span className="cost-from-co">{settings.company}</span>}
          {[settings.name, settings.phone].filter(Boolean).length > 0 && (
            <span className="cost-from-meta">{[settings.name, settings.phone].filter(Boolean).join(" · ")}</span>
          )}
        </div>
      )}

      <div className="cost-total">{money(headline)}</div>
      <div className="cost-total-sub">
        {showSqm ? `${facadeM2.toFixed(1)} ${t.cost.m2} · ${t.cost.byArea}` : t.cost.totalSub(quote?.itemCount ?? real.length)}
      </div>

      {/* per-m² breakdown; when both modes are on, the seller's cost + margin summarise here */}
      {showSqm && (
        <div className="cost-sqm">
          <div className="cost-sqm-row">
            <span>{t.cost.area}</span>
            <span>{facadeM2.toFixed(1)} {t.cost.m2}</span>
          </div>
          <div className="cost-sqm-row">
            <span>{t.cost.perM2}</span>
            <span>{money(settings.sqmRate)}</span>
          </div>
          {both && (
            <>
              <div className="cost-sqm-row cost-sqm-cost">
                <span>{t.cost.selfCost}</span>
                <span className="cost-sqm-cost-val">{money(itemTotal)}</span>
              </div>
              <div className="cost-sqm-row cost-sqm-margin">
                <span>{t.cost.margin}{marginPct !== 0 ? ` · ${marginPct}%` : ""}</span>
                <span>{money(margin)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* itemised: group bars + per-module list + the delivery line so it sums to the total */}
      {showItems && quote && (
        <>
          <div className="cost-groups">
            {GROUP_ORDER.filter((g) => quote.groups[g] > 0).map((g) => (
              <div className="cost-group" key={g}>
                <div className="cost-group-head">
                  <span className="cost-group-name">{t.labels.groups[g]}</span>
                  <span className="cost-group-amt">{money(quote.groups[g])}</span>
                </div>
                <div className="cost-bar">
                  <span style={{ width: `${(quote.groups[g] / maxGroup) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="cost-sec-title">{t.cost.byModule}</div>
          <div className="cost-items">
            {items.map((b) => (
              <div className="cost-item" key={b.id}>
                <span className="cost-item-name">
                  {boxLabel(b)}
                  {b.merged && <span className="cost-item-tag">{t.cost.oneCarcass}</span>}
                  <span className="cost-item-dim"> · {boxDim(b)}</span>
                </span>
                <span className="cost-item-amt">{money(b.cost)}</span>
              </div>
            ))}
            {/* delivery/assembly isn't tied to one module → shown here so list + this = total */}
            {quote.groups.delivery > 0 && (
              <div className="cost-item cost-item-delivery" key="delivery">
                <span className="cost-item-name">{t.labels.groups.delivery}</span>
                <span className="cost-item-amt">{money(quote.groups.delivery)}</span>
              </div>
            )}
          </div>
        </>
      )}

      <p className="cost-note">{t.cost.note}</p>
    </section>
  );
}
