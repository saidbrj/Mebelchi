// "Настройки" — the B2B designer's profile, company (shown on the client quote +
// factory handoff), and app preferences (language, currency, pricing). Fields auto-save
// to localStorage on change (model/settings.ts) + push to Supabase when signed in.
//
// Pricing is OFF by default (sellers asked to keep the seller↔homeowner situation clean).
// USD is the BASE currency: the price list is typed in USD and сум/тенге are derived from
// the seller's exchange rate. Two pricing MODES can be on at once — a detailed per-part
// cost and a simple per-m² client price — and the Смета compares them.

import { useState } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { Logo } from "../components/logo";
import type { Settings, Currency, RateOverrides } from "../model/settings";

/** The free-text (string) settings fields the form edits. */
type TextKey = "name" | "phone" | "email" | "company" | "companyPhone" | "companyAddress";

const CURRENCIES: Currency[] = ["UZS", "KZT", "USD"];

/** The USD price list, grouped for the form (section key → the rate fields it holds). */
const RATE_SECTIONS: { sec: "materials" | "edges" | "hardware" | "labor" | "delivery"; keys: (keyof RateOverrides)[] }[] = [
  { sec: "materials", keys: ["sheetPerM2", "facadePerM2", "backPerM2", "glassPerM2"] },
  { sec: "edges", keys: ["edgeVisiblePerM", "edgeHiddenPerM", "worktopPerM"] },
  // навес: считается НА КОРПУС (см. Настройки → Корпус) — объединённый ряд берёт один комплект
  { sec: "hardware", keys: ["hingePerUnit", "slidePerUnit", "hangingPerUnit"] },
  // фрезеровка/рифление — 0 по умолчанию: фасад теперь заготовка, а профиль стоит машинного времени
  { sec: "labor", keys: ["cutPerPanel", "drillPerHole", "millPerM", "flutePerM2", "assemblyPerModule"] },
  { sec: "delivery", keys: ["deliveryBase", "deliveryPerModule"] },
];

export function SettingsScreen() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const authUser = useStore((s) => s.authUser);
  // one field-in-progress so decimal typing (e.g. "7.") isn't clobbered by parse-on-change
  const [editing, setEditing] = useState<{ key: string; val: string } | null>(null);

  const field = (key: TextKey, label: string, type = "text", placeholder = "") => (
    <label className="set-field">
      <span className="set-label">{label}</span>
      <input
        className="set-input"
        value={settings[key]}
        type={type}
        placeholder={placeholder}
        onChange={(e) => update({ [key]: e.target.value } as Partial<Settings>)}
      />
    </label>
  );

  const symbolOf = (c: Currency) => (c === "USD" ? "$" : c === "KZT" ? "₸" : "сум");
  const currencyLabel = (c: Currency) => (c === "UZS" ? t.settings.uzs : c === "KZT" ? t.settings.kzt : t.settings.usd);

  /** A numeric input that survives decimal typing: shows the in-progress string while the
   *  field is focused, otherwise the stored number. */
  const numInput = (key: string, stored: number, onNum: (n: number) => void, decimal: boolean, className = "set-input") => {
    const raw = editing?.key === key ? editing.val : stored ? String(stored) : "";
    return (
      <input
        className={className}
        inputMode="decimal"
        value={raw}
        onChange={(e) => {
          const clean = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
          setEditing({ key, val: clean });
          const n = decimal ? parseFloat(clean) : parseInt(clean, 10);
          onNum(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => setEditing(null)}
      />
    );
  };

  const rateField = (key: keyof RateOverrides) => (
    <label className="set-field" key={key}>
      <span className="set-label">{t.settings.priceFields[key]}</span>
      {numInput(`rate:${key}`, settings.rates[key], (n) => update({ rates: { ...settings.rates, [key]: n } }), true)}
    </label>
  );

  return (
    <section className="screen set-screen">
      <div className="qnum"><Logo height={22} /></div>
      <h1 className="h1">{t.settings.title}</h1>
      <p className="sub">{t.settings.sub}</p>

      <div className="menu-sec-title">{t.settings.profile}</div>
      <div className="set-group">
        {field("name", t.settings.name, "text", t.settings.phName)}
        {field("phone", t.settings.phone, "tel", t.settings.phPhone)}
        {field("email", t.settings.email, "email", t.settings.phEmail)}
      </div>

      <div className="menu-sec-title">{t.settings.company}</div>
      <div className="set-group">
        {field("company", t.settings.companyName, "text", t.settings.phCompany)}
        {field("companyPhone", t.settings.companyPhone, "tel", t.settings.phCompanyPhone)}
        {field("companyAddress", t.settings.companyAddress, "text", t.settings.phAddress)}
      </div>

      <div className="menu-sec-title">{t.settings.prefs}</div>
      <div className="set-group">
        <div className="set-pref">
          <span className="set-label">{t.settings.language}</span>
          <div className="set-lang">
            <button className={`set-lang-btn ${settings.language === "ru" ? "on" : ""}`} onClick={() => update({ language: "ru" })} type="button">
              {t.settings.ru}
            </button>
            <button className={`set-lang-btn ${settings.language === "uz" ? "on" : ""}`} onClick={() => update({ language: "uz" })} type="button">
              {t.settings.uz}
            </button>
          </div>
        </div>
        <div className="set-pref">
          <span className="set-label">{t.settings.currency}</span>
          <div className="set-lang">
            {CURRENCIES.map((c) => (
              <button key={c} className={`set-lang-btn ${settings.currency === c ? "on" : ""}`} onClick={() => update({ currency: c })} type="button">
                {currencyLabel(c)}
              </button>
            ))}
          </div>
        </div>
        {settings.currency !== "USD" && (
          <label className="set-field">
            <span className="set-label">{t.settings.fxRate} · 1 USD = ? {symbolOf(settings.currency)}</span>
            {numInput(
              `fx:${settings.currency}`,
              settings.fxRates[settings.currency],
              (n) => update({ fxRates: { ...settings.fxRates, [settings.currency]: n } }),
              false,
            )}
            <span className="set-hint">{t.settings.fxHint}</span>
          </label>
        )}
      </div>

      <div className="menu-sec-title">{t.settings.pricing}</div>
      <div className="set-group">
        <div className="set-pref">
          <span className="set-label">{t.settings.showPricing}</span>
          <div className="set-lang">
            <button className={`set-lang-btn ${!settings.showPricing ? "on" : ""}`} onClick={() => update({ showPricing: false })} type="button">
              {t.settings.off}
            </button>
            <button className={`set-lang-btn ${settings.showPricing ? "on" : ""}`} onClick={() => update({ showPricing: true })} type="button">
              {t.settings.on}
            </button>
          </div>
        </div>
        <span className="set-hint set-block-hint">{t.settings.showPricingHint}</span>
        {settings.showPricing && (
          <>
            <div className="set-pref">
              <span className="set-label">{t.settings.modeItems}</span>
              <div className="set-lang">
                <button className={`set-lang-btn ${!settings.pricingItems ? "on" : ""}`} onClick={() => update({ pricingItems: false })} type="button">
                  {t.settings.off}
                </button>
                <button className={`set-lang-btn ${settings.pricingItems ? "on" : ""}`} onClick={() => update({ pricingItems: true })} type="button">
                  {t.settings.on}
                </button>
              </div>
            </div>
            <div className="set-pref">
              <span className="set-label">{t.settings.modeSqm}</span>
              <div className="set-lang">
                <button className={`set-lang-btn ${!settings.pricingSqm ? "on" : ""}`} onClick={() => update({ pricingSqm: false })} type="button">
                  {t.settings.off}
                </button>
                <button className={`set-lang-btn ${settings.pricingSqm ? "on" : ""}`} onClick={() => update({ pricingSqm: true })} type="button">
                  {t.settings.on}
                </button>
              </div>
            </div>
            {settings.pricingSqm && (
              <label className="set-field">
                <span className="set-label">{t.settings.sqmRate} · $ / {t.settings.m2}</span>
                {numInput("sqm", settings.sqmRate, (n) => update({ sqmRate: n }), true)}
                <span className="set-hint">{t.settings.sqmHint}</span>
              </label>
            )}
          </>
        )}
      </div>

      {settings.showPricing && settings.pricingItems && (
        <>
          <div className="menu-sec-title">{t.settings.priceList} · USD</div>
          <p className="set-hint set-pricelist-hint">{t.settings.priceListHint}</p>
          {RATE_SECTIONS.map(({ sec, keys }) => (
            <div className="set-group" key={sec}>
              <div className="set-subhead">{t.settings.priceSecs[sec]}</div>
              {keys.map(rateField)}
            </div>
          ))}
        </>
      )}

      {/* КОРПУС — how this workshop builds a box, as opposed to what it charges (the price list
          above) or what it builds out of (materials). The hanger count is the one that matters:
          it is counted PER CARCASS, so a row merged into one box hangs on one set instead of four.
          That is what makes «Объединить в один корпус» in the module editor pay. */}
      <div className="menu-sec-title">{t.settings.carcass}</div>
      <div className="set-group">
        <p className="set-hint">{t.settings.carcassHint}</p>
        <label className="set-field">
          <span className="set-label">{t.settings.hangingsPerCarcass}</span>
          {numInput("hangingsPerCarcass", settings.hangingsPerCarcass, (n) => update({ hangingsPerCarcass: n }), false)}
        </label>
        <label className="set-field">
          <span className="set-label">{t.settings.hangingSpanMm}</span>
          {numInput("hangingSpanMm", settings.hangingSpanMm, (n) => update({ hangingSpanMm: n }), false)}
        </label>
        <p className="set-hint">{t.settings.hangingSpanHint}</p>
      </div>

      <div className="menu-sec-title">{t.settings.cutting}</div>
      <div className="set-group">
        <label className="set-field">
          <span className="set-label">{t.settings.sheetW}</span>
          {numInput("sheetW", settings.sheetW, (n) => update({ sheetW: n }), false)}
        </label>
        <label className="set-field">
          <span className="set-label">{t.settings.sheetH}</span>
          {numInput("sheetH", settings.sheetH, (n) => update({ sheetH: n }), false)}
        </label>
        <label className="set-field">
          <span className="set-label">{t.settings.kerf}</span>
          {numInput("kerf", settings.kerf, (n) => update({ kerf: n }), false)}
        </label>
        <div className="set-pref">
          <span className="set-label">{t.settings.grain}</span>
          <div className="set-lang">
            <button className={`set-lang-btn ${!settings.respectGrain ? "on" : ""}`} onClick={() => update({ respectGrain: false })} type="button">
              {t.settings.off}
            </button>
            <button className={`set-lang-btn ${settings.respectGrain ? "on" : ""}`} onClick={() => update({ respectGrain: true })} type="button">
              {t.settings.on}
            </button>
          </div>
        </div>
        <div className="set-pref">
          <span className="set-label">{t.settings.advanced}</span>
          <div className="set-lang">
            <button className={`set-lang-btn ${!settings.advancedExport ? "on" : ""}`} onClick={() => update({ advancedExport: false })} type="button">
              {t.settings.off}
            </button>
            <button className={`set-lang-btn ${settings.advancedExport ? "on" : ""}`} onClick={() => update({ advancedExport: true })} type="button">
              {t.settings.on}
            </button>
          </div>
        </div>
        <span className="set-hint set-block-hint">{t.settings.advancedHint}</span>
      </div>

      {/* 3D QUALITY. «Авто» measures the frame time on this phone and steps the pixel ratio / shadow
          map down if it can't keep up — the seller shouldn't have to know to ask. The two pinned
          options are for when they do know their device. */}
      <div className="menu-sec-title">{t.settings.quality}</div>
      <div className="set-group">
        <div className="set-pref">
          <span className="set-label">{t.settings.quality3d}</span>
          <div className="set-lang">
            {(["auto", "high", "low"] as const).map((q) => (
              <button key={q} className={`set-lang-btn ${settings.quality === q ? "on" : ""}`} onClick={() => update({ quality: q })} type="button">
                {t.settings.qualities[q]}
              </button>
            ))}
          </div>
        </div>
        <span className="set-hint set-block-hint">{t.settings.qualityHint}</span>
      </div>

      {/* account (sign in / out, delete) lives on the User tab now */}

      <a className="set-legal" href="/terms.html" target="_blank" rel="noopener noreferrer">
        {t.settings.terms}
      </a>
      <a className="set-legal" href="/privacy.html" target="_blank" rel="noopener noreferrer">
        {t.settings.privacy}
      </a>

      <p className="cost-note">{authUser ? t.settings.noteCloud : t.settings.noteLocal}</p>
    </section>
  );
}
