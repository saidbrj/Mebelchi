// User/app settings for the B2B designer — profile, company (shown on the client
// quote + factory handoff), and preferences. Stored globally in localStorage (NOT
// per-project). This is the layer Supabase will later back: loadSettings/saveSettings
// become the local cache and the same Settings shape maps to a `profiles` row.

import type { ProductionOpts } from "@mebelchi/schema";
import type { QualityPref } from "../three/quality";

const KEY = "mebelchi.settings.v1";

/** The DISPLAY currency for prices. USD is the canonical BASE — the price list is stored in
 *  USD and сум/тенге are derived by the seller's exchange rate (see `fxRates`). This keeps
 *  prices stable against local inflation and means switching currency converts instead of
 *  forcing a re-type. */
export type Currency = "UZS" | "KZT" | "USD";

/** How many local units equal 1 USD, per currency (USD is 1 by definition). The seller sets
 *  these in Настройки ("1 USD = N сум/тенге"); every displayed price = its USD amount × rate. */
export interface FxRates {
  UZS: number;
  KZT: number;
}

export const DEFAULT_FX_RATES: FxRates = { UZS: 12600, KZT: 480 };

/** The seller's own price list — a flat set of the rates the pricing engine needs, all in
 *  USD (the base currency). Merged over the seed rate table at pricing time (model/rates.ts →
 *  ratesToTable), which produces a USD quote that the UI converts for display. Prices differ
 *  by region, so every seller sets these themselves; the defaults are only a starting point.
 *  Local-only for now (no rate columns in the Supabase `profiles` table yet). */
export interface RateOverrides {
  // Материалы (за м²)
  sheetPerM2: number; // ЛДСП корпус
  facadePerM2: number; // МДФ фасад (заготовка — без фрезеровки)
  backPerM2: number; // ХДФ задняя стенка
  glassPerM2: number; // стекло для витрин
  // Кромка и столешница
  edgeVisiblePerM: number; // видимая кромка
  edgeHiddenPerM: number; // скрытая кромка
  worktopPerM: number; // столешница
  // Фурнитура (за шт.)
  hingePerUnit: number; // петля
  slidePerUnit: number; // направляющая (комплект)
  /** Навес для навесного шкафа (комплект с планкой). Считается НА КОРПУС, не на модуль — ряд,
   *  объединённый в один корпус, вешается на один комплект вместо четырёх. */
  hangingPerUnit: number;
  // Работа (за операцию / модуль)
  cutPerPanel: number; // распил детали
  drillPerHole: number; // присадка (отверстие)
  /** Фрезеровка фасада — за метр контура (рамка, филёнка, вырез под стекло). 0 = не считается,
   *  пока продавец не включит: так ни одна существующая смета не меняется. */
  millPerM: number;
  /** Фрезеровка рифления (фрезерованные вертикальные рёбра) — за м² фасада. Тоже 0 по умолчанию. */
  flutePerM2: number;
  assemblyPerModule: number; // сборка модуля
  // Доставка
  deliveryBase: number; // базовая доставка
  deliveryPerModule: number; // за модуль
}

/** Starting-point price list in USD — the Chin Wood seed (UZS) ÷ ~12600. Each seller
 *  overrides these in Настройки; kept as sensible defaults so the engine never prices at 0. */
export const DEFAULT_RATE_OVERRIDES: RateOverrides = {
  sheetPerM2: 7.5,
  facadePerM2: 19,
  backPerM2: 3.3,
  glassPerM2: 9.5,
  edgeVisiblePerM: 0.44,
  edgeHiddenPerM: 0.28,
  worktopPerM: 14.7,
  hingePerUnit: 0.95,
  slidePerUnit: 3,
  hangingPerUnit: 0.55, // 7000 сум ÷ ~12600
  cutPerPanel: 0.17,
  drillPerHole: 0.06,
  millPerM: 0,
  flutePerM2: 0,
  assemblyPerModule: 6.3,
  deliveryBase: 12,
  deliveryPerModule: 1.6,
};

/** Default per-m² "overall work" price (USD per m² of facade) — a placeholder the seller
 *  replaces with their own client-facing rate. */
export const DEFAULT_SQM_RATE = 200;

/** Workshop fastener / joint family:
 *  `confirmat` = Евровинт Ø7×50mm screw (manual drill assembly default)
 *  `minifix` = Минификс Ø15×12.5mm cam + dowel Ø8×34mm (CNC factory standard)
 *  `dowel` = Шкант деревянный Ø8×30mm (glued non-demountable joint) */
export type JointFamily = "confirmat" | "minifix" | "dowel";

export interface Settings {
  // ... existing fields ...
  // Профиль (the designer's own contact — used on quotes/orders)
  name: string;
  phone: string;
  email: string;
  // Компания / мастерская (appears on the Смета + Передача documents)
  company: string;
  companyPhone: string;
  companyAddress: string;
  // Предпочтения
  currency: Currency; // DISPLAY currency (USD is the base)
  fxRates: FxRates; // local units per 1 USD
  language: "ru" | "uz";
  /** Show prices anywhere in the app? OFF by default — sellers asked to keep the
   *  seller↔homeowner situation clean. Gates every price display and skips the Смета step. */
  showPricing: boolean;
  /** Pricing MODE toggles (both can be on → the Смета compares them). `pricingItems` = the
   *  detailed per-part cost; `pricingSqm` = a simple client price of facade m² × `sqmRate`. */
  pricingItems: boolean;
  pricingSqm: boolean;
  /** Per-m² "overall work" price in USD (multiplies the facade area). */
  sqmRate: number;
  /** The seller's own itemised price list, in USD (see RateOverrides). Local-only for now. */
  rates: RateOverrides;
  // Раскрой (cutting/nesting) — the workshop's board + saw config, set once. Local-only.
  sheetW: number; // standard sheet length (mm)
  sheetH: number; // standard sheet width (mm)
  kerf: number; // saw blade width between parts (mm)
  respectGrain: boolean; // don't rotate grained facades when nesting
  // Корпус (carcass conventions) — HOW this workshop builds a box, as opposed to what it charges
  // (rates) or what it builds out of (materials). Set once; travels onto every project quoted.
  /** Навесов на КОРПУС (не на модуль). A merged row hangs on one set — that is the point of
   *  merging. 2 is the normal pair. */
  hangingsPerCarcass: number;
  /** Ещё один комплект навесов на каждые N мм ширины корпуса. 0 = один комплект на корпус любой
   *  ширины (шкаф на монтажной планке) — так объединённый ряд 2400 берёт 2 навеса вместо 8.
   *  Мастерская, которая вешает пару на каждые 900 мм, ставит 900. */
  hangingSpanMm: number;
  /** Fastener / Joint family used by this workshop: "confirmat" | "minifix" | "dowel" */
  jointFamily: JointFamily;
  /** Distance from front edge to first joint fastener bore (mm, default 65mm). */
  jointSetbackMm: number;
  /** Show the professional/advanced exports (CNC drilling SWJ008 + the CSV spec). OFF by
   *  default — ~95% of workshops cut manually and only need the cutting plan (PDF/DXF). */
  advancedExport: boolean;
  /** 3D QUALITY. `auto` measures the frame time on this device and steps down (pixel ratio, then the
   *  shadow map, then the ceiling lights) if it can't hold the budget — which is what a weak phone
   *  needs and what nobody should have to know to ask for. `high`/`low` pin it. See three/quality.ts. */
  quality: QualityPref;
}

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  phone: "",
  email: "",
  company: "",
  companyPhone: "",
  companyAddress: "",
  currency: "UZS",
  fxRates: { ...DEFAULT_FX_RATES },
  language: "uz", // Uzbekistan market default; user can switch to Русский in Настройки
  showPricing: false,
  pricingItems: true, // the itemised calc is the default mode when pricing is shown
  pricingSqm: false,
  sqmRate: DEFAULT_SQM_RATE,
  rates: { ...DEFAULT_RATE_OVERRIDES },
  sheetW: 2750, // standard ЛДСП sheet
  sheetH: 1830,
  kerf: 4,
  respectGrain: true,
  hangingsPerCarcass: 2,
  hangingSpanMm: 0, // one set per box however wide — the mounting-rail build
  jointFamily: "confirmat",
  jointSetbackMm: 65,
  advancedExport: false,
  quality: "auto",
};

/** The shop's build conventions, in the shape the pricing engine takes. Rides on every Project. */
export function productionFrom(s: Settings): ProductionOpts {
  return { hangingsPerCarcass: s.hangingsPerCarcass, hangingSpanMm: s.hangingSpanMm };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, fxRates: { ...DEFAULT_FX_RATES }, rates: { ...DEFAULT_RATE_OVERRIDES } };
    const saved = JSON.parse(raw) as Partial<Settings>;
    // A save from BEFORE the USD-base model has no `fxRates`; its `rates` were in local
    // currency, so they'd be nonsense as USD — reset them to the USD defaults on migration.
    const preUsd = saved.fxRates == null;
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      fxRates: { ...DEFAULT_FX_RATES, ...(saved.fxRates ?? {}) },
      rates: preUsd ? { ...DEFAULT_RATE_OVERRIDES } : { ...DEFAULT_RATE_OVERRIDES, ...(saved.rates ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, fxRates: { ...DEFAULT_FX_RATES }, rates: { ...DEFAULT_RATE_OVERRIDES } };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

/** True once the designer has filled the essentials (name/phone) — drives the
 *  "complete your profile" nudge on the home screen. */
export function profileComplete(s: Settings): boolean {
  return s.name.trim().length > 0 && s.phone.trim().length > 0;
}
