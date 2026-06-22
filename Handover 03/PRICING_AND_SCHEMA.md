# Pricing Architecture & Shared Schema

**Status:** Proposed (build spec)
**Author:** Oppoq (with Claude)
**Date:** June 2026
**Extends:** `ADR_001_PLATFORM_AND_3D.md`, `ADR_002_AR_LIDAR.md`
**Target location:** move into the new product repo as `packages/schema` + `packages/pricing` and `docs/`.

---

## Principle

**Price is a pure function of the project model, computed locally, recomputed on every edit.**

```
Project (parametric model)  →  BOM (bill of materials)  →  × Rate Table  →  Quote (grouped total)
                              [engine derives this]        [data, swappable]   [shown as live ticker]
```

This is how IKEA's live price ticker works — no server round-trip per change, just arithmetic over the current item list. Because your engine already derives the parts/operations breakdown, pricing is `BOM × rates`, fast enough to update at 60fps.

Three rules:
1. **Pricing logic is pure and stateless** — same model + same rates → same quote. Easy to test.
2. **Rates are data, never hardcoded in source** — stored in a table a non-developer can edit; prices change weekly.
3. **The model is one shared schema** — engine, pricing, UI, and the RoomPlan plugin all read the same types (`packages/schema`).

---

## 1. Project schema (the model — the central contract)

Everything reads from this. Stored as small JSON (per ADR-001 sync model).

```ts
type UUID = string;
type MM = number;            // all dimensions in millimetres

interface Project {
  id: UUID;
  name: string;
  ownerId: UUID;
  units: 'mm';
  createdAt: string;         // ISO
  updatedAt: string;
  schemaVersion: 1;

  space: Space;              // from manual entry OR RoomPlan scan
  run: Module[];            // the cabinet run
  materials: MaterialSelection;
  pricing: { rateTableId: UUID; snapshotAt: string };  // which rates this quote used
  meta?: { variantArchetype?: string };
}

interface Space {
  source: 'manual' | 'roomplan';
  shape: 'i' | 'l' | 'u';
  wallLength: MM;
  ceilingHeight: MM;
  waterWall: 'left' | 'center' | 'right' | 'none';
  constraints: ('gas' | 'riser' | 'sockets' | 'window' | 'radiator')[];
  openings?: Opening[];      // windows/doors with position + size (from scan or manual)
}

interface Module {
  id: UUID;
  kind: 'base' | 'tall' | 'upper';
  w: MM; h: MM; d: MM;
  fill: 'shelves' | 'drawers' | 'open';
  count: number;             // shelves or drawers
  dividers: number;          // vertical separators (0..n)
  door: { style: 'flat' | 'milled' | 'glass' | 'none'; hingeSide?: 'L' | 'R' };
  handle: { type: 'bar' | 'profile' | 'knob' | 'none' };
  facadeMaterialId?: UUID;   // optional override → enables the "split facade/carcass" advisor
  hardening?: string[];      // applied hardening-panel preset ids
}

interface MaterialSelection {
  carcassId: UUID;           // corpus material (LDSP etc.)
  facadeId: UUID;            // default facade material
  worktopId?: UUID;
  edgeVisibleId: UUID;       // 2mm kromka
  edgeHiddenId: UUID;        // 0.4mm kromka
}
```

The `Room` (RoomPlan) output normalises **into `Space`** so a scan and manual entry produce the same shape (per ADR-002).

---

## 2. Rate table schema (the data — swappable source)

Stored in Supabase; seeded from an eman.uz snapshot now, switched to an API/partner feed later **without touching pricing code**.

```ts
interface RateTable {
  id: UUID;
  currency: 'UZS';
  effectiveDate: string;
  source: string;            // 'eman.uz snapshot 2026-06-20' | 'manual' | 'api:eman'
  materials: Record<UUID, { name: string; type: 'LDSP'|'MDF'|'HDF'|'solid'; pricePerM2: number }>;
  edge:      Record<UUID, { name: string; pricePerM: number }>;
  worktop:   Record<UUID, { name: string; pricePerM: number }>;
  hardware:  Record<UUID, { name: string; sku: string; pricePerUnit: number }>;  // hinges, slides, dowels, cams…
  operations:{ drillPerHole: number; cutPerPanel: number; edgebandPerM: number };
  labor:     { assemblyPerModule: number; hardeningPerPreset: number };
  delivery:  { base: number; perModule: number };
}
```

**Sourcing strategy (your eman.uz question):**
- **Do not scrape live per user.** Ingest eman.uz once into *your own* RateTable snapshot; the app reads your table, never their site. This avoids scraper fragility and the ToS/legal risk of querying a third party inside a product you sell.
- **Update on a schedule** (a periodic ingest job), bumping `effectiveDate`. Old quotes keep their `rateTableId` so a saved project's price is reproducible.
- **End state = a supplier price feed.** An official feed from eman.uz / Imkon / Egger is *both* the pricing solution *and* your first distribution conversation (the supplier-as-distributor play in the strategic memo). Scraping is just the bootstrap.

---

## 3. BOM derivation (the engine's job)

The engine already produces panels + operations + hardware. The pricing layer consumes a normalised BOM:

```ts
interface BomLine {
  kind: 'panel' | 'edge' | 'hardware' | 'operation' | 'worktop' | 'labor' | 'delivery';
  ref: string;               // material/sku/operation id
  qty: number;
  unit: 'm2' | 'm' | 'unit' | 'hole' | 'panel' | 'module';
  rate: number;              // from RateTable
  amount: number;            // qty * rate
  group: QuoteGroup;
}
function buildBom(p: Project): Omit<BomLine,'rate'|'amount'|'group'>[]; // engine/pricing
```

Examples: a 600×720 side panel → `panel` line in m²; its visible edges → `edge` line in metres; each hinge → `hardware` unit line; each drilled hole → `operation` line; assembly → `labor` per module.

---

## 4. Pricing function (pure, client-side)

```ts
type QuoteGroup = 'carcassFacade' | 'hardware' | 'worktopEdge' | 'cnc' | 'delivery';

interface Quote {
  currency: 'UZS';
  total: number;
  groups: Record<QuoteGroup, number>;
  lines: BomLine[];
  itemCount: number;
}

function priceProject(p: Project, rates: RateTable): Quote;  // packages/pricing — pure, tested
```

Group labels for the UI (match v7 / IKEA): Корпус и фасады · Фурнитура · Столешница и кромка · Сверловка/ЧПУ · Доставка.

- **Live ticker** = call `priceProject` on every model change (cheap; runs in the app).
- **Authoritative quote** = same function run server-side (Supabase Edge Function) when locking a project, so the saved price can't be tampered with client-side.
- **Rounding:** round to whole сум at the line level; show grouped + total. Decide VAT handling explicitly (inclusive vs added) and store the choice on the quote.
- **The material advisor** (Phase Д): compute `priceProject` twice — once with `facadeId === carcassId`, once split — and surface the delta as the saving.

---

## 5. Testability

Because pricing is pure: snapshot-test `priceProject(fixtureProject, fixtureRates)` against hand-checked totals, exactly like the engine's golden-cabinet suite. A wrong price should fail CI, not reach a customer.

---

## 6. Build order (this slice)

1. Define `packages/schema` (Project, Space, RateTable, Bom, Quote) — the shared contract.
2. Implement `buildBom` against the engine's existing panel/operation output.
3. Implement `priceProject` (pure) + snapshot tests.
4. Seed one **RateTable** from an eman.uz snapshot into Supabase.
5. Wire the live ticker in the app; wire the authoritative server quote on lock.
6. Later: replace the snapshot source with a supplier API/feed — pricing code untouched.

---

## 7. CNC / handoff files (your second question — confirmed)

File generation is **pure computation, not a native capability** — TypeScript generates DXF / SWJ008 XML / MPR / CIX / PDF in the same JS context, using the engine that already does this. The web-core structure does not limit you.

- **Generate** in-app (engine + `exportSWJ008`, DXF writer, PDF) or server-side for heavy jobs.
- **Save/share** via Capacitor: `@capacitor/filesystem` (write to device), `@capacitor/share` (Telegram/email), or upload to Supabase Storage + share link.
- **Two tiers:** machine-ready (DXF/SWJ008/MPR/CIX, gated by the 3 safety checks) and manual-shop (dimensioned cut list PDF/Excel, panel cut map, edge-banding spec, hardware list).
- **Correctness comes from the engine + golden tests, not the platform** — identical on web and native. The "one bad file ends the company" doctrine lives in the engine layer.
