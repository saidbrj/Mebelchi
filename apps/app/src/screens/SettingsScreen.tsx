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
import type { Currency, RateOverrides } from "../model/settings";
import { SHOP_CONSTRUCTION_DEFAULTS, type ShopConstruction } from "../model/construction";
import { catalogSourcesFor } from "../model/catalogRates";
import { useMoney } from "../useMoney";

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
  const money = useMoney();
  // the open design, for the "this rate comes from Каталог" note below
  const cabs = useStore((s) => s.cabs);
  const runStyle = useStore((s) => s.runStyle);
  useStore((s) => s.catalogRev); // subscribe: re-render when a catalog price changes
  // one field-in-progress so decimal typing (e.g. "7.") isn't clobbered by parse-on-change
  const [editing, setEditing] = useState<{ key: string; val: string } | null>(null);

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

  // Which of these fields the OPEN DESIGN is currently overriding from Каталог. Without this
  // note a seller types 7.5 here, watches the смета bill something else, and concludes the
  // price list is broken — the override is right, but invisible is indistinguishable from bad.
  const catalogSources = catalogSourcesFor(cabs, runStyle);
  const overriddenBy = (key: keyof RateOverrides) => catalogSources.find((s) => s.key === key);

  // «Стандарт цеха» — the shop's construction standard. Stored whole (never partially), so a
  // set writes the merged object; model/settings.saveSettings republishes it to the resolver
  // that the 3D and the drawings read.
  const con = settings.construction ?? SHOP_CONSTRUCTION_DEFAULTS;
  const setCon = (patch: Partial<ShopConstruction>) => update({ construction: { ...con, ...patch } });

  /** A labelled row of mutually exclusive pills — the shape every construction choice takes. */
  const segRow = (label: string, opts: { k: string | number; label: string; on: boolean; set: () => void }[]) => (
    <div className="set-pref set-pref-col" key={label}>
      <span className="set-label">{label}</span>
      <div className="set-lang">
        {opts.map((o) => (
          <button key={o.k} className={`set-lang-btn ${o.on ? "on" : ""}`} onClick={o.set} type="button">
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const rateField = (key: keyof RateOverrides) => {
    const src = overriddenBy(key);
    return (
      <label className="set-field" key={key}>
        <span className="set-label">{t.settings.priceFields[key]}</span>
        {numInput(`rate:${key}`, settings.rates[key], (n) => update({ rates: { ...settings.rates, [key]: n } }), true)}
        {src && (
          <span className="set-catalog-note">
            {t.settings.fromCatalog(src.material.name, money(src.rate))}
          </span>
        )}
      </label>
    );
  };

  return (
    <section className="screen set-screen">
      <div className="qnum"><Logo height={14} /></div>
      <h1 className="h1">{t.settings.title}</h1>
      <p className="sub">{t.settings.sub}</p>

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

      {/* УЗЛЫ И СОЕДИНЕНИЯ (Prototype 4 — Joint Settings) */}
      <div className="menu-sec-title">Узлы и Крепёж (Полка ⊥ Бок)</div>
      <div className="set-group">
        <div className="set-pref">
          <span className="set-label">Тип крепежа</span>
          <div className="set-lang">
            <button
              className={`set-lang-btn ${(settings.jointFamily ?? "confirmat") === "confirmat" ? "on" : ""}`}
              onClick={() => update({ jointFamily: "confirmat" })}
              type="button"
            >
              Конфирмат
            </button>
            <button
              className={`set-lang-btn ${settings.jointFamily === "minifix" ? "on" : ""}`}
              onClick={() => update({ jointFamily: "minifix" })}
              type="button"
            >
              Минификс
            </button>
            <button
              className={`set-lang-btn ${settings.jointFamily === "dowel" ? "on" : ""}`}
              onClick={() => update({ jointFamily: "dowel" })}
              type="button"
            >
              Шкант
            </button>
          </div>
        </div>

        <div className="set-joint-info">
          <div className="set-joint-title">
            {(settings.jointFamily ?? "confirmat") === "confirmat" && "Евровинт (Конфирмат Ø7×50 мм)"}
            {settings.jointFamily === "minifix" && "Минификс Ø15×12.5 мм + Шкант Ø8×34 мм"}
            {settings.jointFamily === "dowel" && "Шкант деревянный Ø8×30 мм (клей)"}
          </div>
          <div className="set-joint-desc">
            {(settings.jointFamily ?? "confirmat") === "confirmat" && "Диаметр: Ø7/Ø5 мм · Длина: 50 мм · Сборка ручной дрелью"}
            {settings.jointFamily === "minifix" && "Диаметр: Ø15/Ø8 мм · Глубина чашки: 12.5 мм · Скрытый разборный узел (CNC)"}
            {settings.jointFamily === "dowel" && "Диаметр: Ø8 мм · Глубина: 15 мм · Неразборное клеевое соединение"}
          </div>
        </div>

        <label className="set-field">
          <span className="set-label">Отступ от переднего края (мм)</span>
          {numInput("jointSetbackMm", settings.jointSetbackMm ?? 65, (n) => update({ jointSetbackMm: n }), false)}
        </label>
        <span className="set-hint set-block-hint">
          Профиль конфирмата используется для евро-сборки ручной дрелью. Минификс Ø15×12.5 выводится в SWJ008 для ЧПУ присадочного станка.
        </span>
      </div>

      {/* ── СТАНДАРТ ЦЕХА ──────────────────────────────────────────────────────────────────────
          These used to be asked PER CABINET, in the middle of designing — eight controls in the
          module sheet plus seven more sections in the V21 studio, on every module, forever. They
          are not design decisions: a shop picks its board thickness and its back-panel method once
          and builds that way for years. Answered here, inherited by every module (model/construction.ts);
          a module stores only what it does differently, so changing a value here moves every cabinet
          that never overrode it. Замена статичного текста, который эти же значения только ОПИСЫВАЛ. */}
      <div className="menu-sec-title">{t.shop.title}</div>
      <div className="set-group">
        <p className="set-hint">{t.shop.sub}</p>

        {segRow(t.shop.boardThickness, ([16, 18] as const).map((v) => ({
          k: v, label: `${v} мм`, on: con.boardThickness === v, set: () => setCon({ boardThickness: v }),
        })))}

        {segRow(t.shop.backPanel, (["groove", "overlay", "none"] as const).map((v) => ({
          k: v, label: t.shop.back[v], on: con.backMount === v, set: () => setCon({ backMount: v }),
        })))}

        {con.backMount === "groove" && (
          <label className="set-field">
            <span className="set-label">{t.shop.grooveSetback}</span>
            {numInput("grooveSetback", con.grooveSetback, (n) => setCon({ grooveSetback: n }), false)}
          </label>
        )}

        {segRow(t.shop.bottom, (["nakladnoe", "vkladnoe"] as const).map((v) => ({
          k: v, label: t.shop.bottomModes[v], on: con.bottomMode === v, set: () => setCon({ bottomMode: v }),
        })))}

        {segRow(t.shop.top, (["full", "stretchers", "none"] as const).map((v) => ({
          k: v, label: t.shop.topModes[v], on: con.topMode === v, set: () => setCon({ topMode: v }),
        })))}

        {segRow(t.shop.plinth, (["box", "sides", "legs"] as const).map((v) => ({
          k: v, label: t.shop.plinthModes[v], on: con.plinthMode === v, set: () => setCon({ plinthMode: v }),
        })))}

        {segRow(t.shop.handles, [
          { k: "h", label: t.shop.withHandles, on: !con.gola, set: () => setCon({ gola: false }) },
          { k: "g", label: t.shop.gola, on: con.gola, set: () => setCon({ gola: true }) },
        ])}
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
