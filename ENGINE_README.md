# Mebelchi Engine Core (headless slice)

Engine-first build per `14_RUNTIME_AND_BUILD.md` Steps 1–2. **No UI** — no React,
React Native, Three.js, Zustand or Expo is imported anywhere. The engine runs
identically in Node, a browser, or a phone, reached through one public entry point.

## Public surface — `engine/index.ts`

```ts
solvePreview(project: Project): PreviewResult            // sync, cheap, bounded (LOD zones/counts, no coords)
solveFull(project: Project): Promise<FullResult>         // async; MachiningPlan + safety-gate report
solveAndExportSWJ008(project): Promise<string>           // full solve → gate → SWJ008 (blocks if dirty)
exportSWJ008 / parseSWJ008 / canonicalizeParts           // post-processor + golden helpers
```

All engine-internal coordinates are **`mm10` integers** (tenths of a mm; 16 mm = 160).
Floats appear only at the export edge (`engine/core/units.ts`). The Face A/B ⇄ SWJ008
mapping is a single locked constant (`engine/core/face.ts`). The safety gate
(bounds/collision check, `engine/core/validate.ts`) runs inside `solveFull`; nothing
exports unless it is clean.

Layout follows the seven-layer folder plan (`11_ENGINE_ARCHITECTURE.md`):
`contracts/` (Layer 4), `core/` (units, face, canonical, validate — Layers 1–2),
`postprocessors/` (Layer 5, SWJ008 export + parse).

## The Golden Cabinet Suite — `npm test`

Semantic comparison (`14` Part 3): export → re-parse → canonical form →
deep-equal the canonical of the real factory file. Byte-for-byte is used **once**,
as the Fixture 0 format spike against POLKA.

| Fixture | Panel (real SWJ008) | Exercises |
|---|---|---|
| **0** | `POLKA-1_7_1` | Face-A (Type 2) drilling only; **byte-exact** format anchor |
| **1** | `YON BAK-1_4_1` | Edge (Type 1) + Face-A drills: dowels (8mm), shelf pins (5mm), cams (15mm) |
| **2** | `POL_3_1` | Multi-edge through-drills (34mm) on faces 1/3/4 + Face-A drills |
| **3** | `ORTA BAK_6_1` | **Double-sided** Face-A and Face-B machining |

### Note on fixture mapping

`14` describes Fixtures 1–3 conceptually as *base+door+hinges / drawer / corner-sink*
cabinets. The provided XML is a single cabinet's **panel set** (one cabinet's worth of
parts), not three separate cabinets — so there is no door/drawer/corner export to diff
against yet. The four fixtures here are instead chosen for **maximal machining-feature
coverage** of the real files we actually have (face-only, edge+face, multi-edge
through-drill, double-sided). When real door/drawer/corner exports arrive, add them as
fixtures 4+ — never delete a golden.

Fixtures (`tests/fixtures/*.ts`) are committed, reviewable `Part` literals in `mm10`,
transcribed from the factory XML. Goldens are the real factory files themselves,
in `tests/golden/xml/`.

## Layer-1 primitives (CORE 2 — Step 2)

`engine/primitives/` holds the tiny pure drilling functions. **No drilling number is
ever a literal** — every diameter/depth/offset is read from the typed `HardwareSpec`
loaded once from `engine/catalogs/hardware_specs.dummy.json` (Layer 0). Tomorrow's
verified values slot in by editing the JSON only; the functions never change.

| Primitive | Produces | Proven against |
|---|---|---|
| `shelfPinPattern` | front+back Ø5 rows per shelf position | ORTA_BAK Ø5 face holes |
| `rastex15Pattern` | Ø15 cam seat (face) + Ø8 dowel (edge) | ORTA_BAK edge-3 joint |
| `hingeCupPattern` | Ø35×13 cup + Ø3×1 wing-screw marks | door golden `SHKOF_ORTA_CHAP_ESHIK_7_1` — **verified** |

Each primitive has a proof test that feeds a real factory panel's dimensions +
positions and diffs the **generated** ops against the **parsed real** ops (semantic,
mm10). Proofs are gated on the spec's `verified` flag:

- `verified:false` (today) → `it.fails`: the proof is *expected* to mismatch on dummy
  numbers. The suite stays green, the test name carries `[UNVERIFIED SPEC]`, and it
  flips **red** the instant the geometry becomes correct — the cue to set `verified:true`.
- `verified:true` (after factory) → a hard assertion: green only when generated == real.

Fields that already match the factory (Ø5/Ø15/Ø8 depths, dowel Z) are proven green
today. The outstanding values are listed in **`FACTORY_CHECKLIST.md`** and printed live
by the `[checklist]` diagnostic tests. The engine entry point and exporters were not
touched.

## Run

```
npm install
npm test        # 19 passed + 1 todo: CORE 1 goldens (8) + CORE 2 primitive proofs (11) + hinge todo
npm run typecheck
```
