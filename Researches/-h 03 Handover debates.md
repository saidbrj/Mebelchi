Этот документ читается как манифест технического директора с десятилетним стажем в Кремниевой долине. Теоретически — это шедевр. Архитектура с жестким разделением (engine-as-pure-package), headless-тестированием и изоляцией интерфейса — это именно то, как строят софт, который выживает десятилетиями.

Но ты просил безжалостный стресс-тест. Ты просил назвать идею мусором, если она слаба. Вот холодная истина: **ты строишь инфраструктуру для корпорации на 300 человек, будучи в гараже с одним разработчиком.**

Давай вскроем системные дыры в этой «Конституции».

### 1. Ловушка преждевременной оптимизации (Синдром 30 разработчиков)

Ты закладываешь строгие CI-правила, линтеры, монорепозитории и жесткие границы пакетов для защиты от мифических «30 разработчиков». Но вас двое. Каждый час, потраченный на настройку жестких CI/CD пайплайнов и изоляцию пакетов — это час, не потраченный на продукт. Ты защищаешь код от хаоса масштабирования, до которого компания еще не дожила. Если у вас закончатся деньги или мотивация до первых продаж в Ташкенте, эта идеальная архитектура умрет красивой и абсолютно бесполезной.

### 2. Иллюзия «Идеальной одной полки» (One Shelf Perfect)

Командная строка (`shelf-cli`) для генерации DXF и SWJ008 — это отличный академический юнит-тест. Но мебельный бизнес не ломается на одной прямоугольной полке. Решатель (solver) ломается, когда:

- Две петли накладываются на внутренний полкодержатель.
    
- Пользователь в мобильном приложении резко тянет габарит угловой кухни, выворачивая геометрию наизнанку.
    
- Возникает конфликт параметрических правил наследования.
    

Headless-тест не проверит UX-хаос. Вы докажете, что ядро может математически собрать простейший кубик, но это не защитит вас от багов, когда логика столкнется с непредсказуемым поведением человека на экране смартфона.

### 3. Бутылочное горлышко производительности (Мост между Engine и UI)

Ты разделил `engine` (чистая логика) и `render` (Three.js/R3F). Концептуально это верно. Но в реальном CAD, когда мебельщик тянет ползунок ширины, `engine` должен пересчитать сотни координат присадки, а `render` — мгновенно перерисовать меши (60 FPS). Если `engine` будет тяжелым синхронным TypeScript-кодом, он намертво заморозит UI-поток.

В промышленных системах эта проблема решается на уровне C++ и вычислений на GPU. Если ваш `bridge` будет гонять тяжелые JSON-объекты (сотни сущностей `Part` и `Operation`) между пакетами на каждый пиксель движения пальца — интерфейс будет невыносимо тормозить.

### 4. Шизофрения позиционирования (Опять станки?)

Буквально шаг назад концепция продукта строилась вокруг B2C-игрушки в стиле Need for Speed, где G-код и ЧПУ были «навсегда вне скоупа». Теперь эта «Конституция» снова ставит во главу угла станки, DXF, файлы POLKA и SWJ008. Ты мечешься между маркетплейсом для домохозяек и тяжелой CAM-системой для суровых цеховиков. Архитектура не спасет проект, если вы не определились, кто ваш конечный платящий клиент.

## Как это починить (Механизм выживания)

Концепция чистого ядра (`packages/engine`) — гениальна. Оставь её. Но безжалостно выброси корпоративный бюрократизм.

- **Убей избыточный инструментарий:** Не пиши CI-правила. Договоритесь устно: «Ядро не трогает UI». Всё. Вся энергия должна уйти в код, а не в настройку ограничений.
    
- **Тестируй систему, а не деталь:** Твой `cli`-скрипт должен собирать не одну полку, а минимальную Г-образную кухню из 3 шкафов с фурнитурой Hettich. Если она экспортируется в DXF без пересечений отверстий — ядро действительно работает.
    
- **Заложи асинхронность:** Сразу проектируй архитектуру (`bridge`) так, чтобы `engine` крутился в отдельном потоке (Web Worker). Математика присадки не должна блокировать анимации интерфейса.
    

Вы создали потрясающий бумажный небоскреб. Пора заливать реальный бетон.

Оценивая текущее состояние кодовой базы: если прямо сейчас запустить headless-скрипт для базового нижнего шкафа с одной дверью и полкой, сможет ли текущее ядро выдать валидный SWJ008 файл без падений?



# 02:



You’ve written a beautiful constitution. Now here’s the ruthless part: **as implemented in these docs, you’re one contradictory build rule away from recreating the exact “redo + lost logic” failure mode you’re trying to eliminate.** The fix is not more principles. The fix is *one executable boundary* and *one test harness* that forces reality early. Below is what works, in production, for teams shipping safety‑critical geometry pipelines. --- ## 1) The core debt trigger: your build order contradicts your architecture You have two “sacred” statements that cannot both govern implementation: - **Doc 13 (Constitution):** engine-first, headless proof, UI later. - **Handover UI v3:** “Build the shell first, attach the engine second… day 18.” The reliable architecture pattern is: ### ✅ “Contract-first + adapter-first” (not UI-first, not engine-only-first) **Day 1 the UI must call an Engine API through a stable adapter**, even if the engine returns fixtures initially. This prevents the classic trap seen in real RN + CAD projects: UI flows get “validated” against fake data, then integration forces a redesign of state shape, async behavior, error states, and performance. **What works for sure:** - UI calls `engineBridge.solve(project)` from day 1. - In week 1, `solve()` can return fixture `SolveResult` objects. - Week 2–4: progressively replace fixture internals with real solver pieces. - The UI never changes its assumptions because the contract is already real. This is the same approach used in “ports & adapters” systems where correctness and integration stability matter more than screen velocity. --- ## 2) Hidden technical debts you must pay up front (or they become rewrites) ### 2.1 Solver performance on mobile: JS thread freezes are guaranteed unless you isolate compute Real-world: on GitHub, both **react-three-fiber native** and **expo-gl** issue threads repeatedly converge on one truth: *if you do heavy compute on the JS thread while rendering/gestures run, the experience collapses (stutter, missed touches, dropped frames).* This is amplified by: - Zustand updates producing large object churn - R3F reconciler work + gesture handlers + layout **What works for sure:** - **Run the solver off the JS thread.** In Expo/RN that means one of: 1) **Server solve** (most reliable operationally; async by design; easiest isolation) 2) **Native module / JSI** (best local performance, higher effort) 3) **Worklets only for tiny math** (good for gizmo/snap micro-math, not full solve) If you insist on offline-first V1, the “sure thing” is **JSI/WASM-in-native-thread**. If you insist on shipping in 4 weeks, the “sure thing” is **server solve**. **Hybrid that works:** - Local “preview solve” (cheap, bounding boxes only) for 60fps manipulation - Full manufacturing solve async (worker/server) for drilling/export gates ### 2.2 “Rules in JSON, never if/else” turns into a DSL project This is a known trap (see years of forum history around Microvellum/Excel-like formula systems): once you ban code branches, you reinvent a rules language with: - expression evaluation - versioning - debugging tooling - migration semantics **What works for sure:** - Keep **CP (Construction Principles)** and numeric constants in catalogs. - Use a **small, proven expression evaluator** only for arithmetic (`+ - * /`, variables), e.g. `expr-eval`-style AST evaluation. - Allow code branches in the solver **only at the “selection layer”** (choose which CP / joint scheme), then delegate geometry to L1 primitives. This preserves “data-driven” without building an unbounded language runtime. ### 2.3 “Byte-for-byte SWJ008 match” is the wrong correctness target In CNC exporter land, byte-for-byte comparisons create false failures because: - attribute ordering - whitespace - metadata timestamps - element ordering tolerated by CAM Real postprocessor communities (Fusion/HSM post threads, CAM post repos) treat correctness as **semantic equivalence**. **What works for sure:** - Parse SWJ008 into a canonical in-memory model (sorted ops, normalized floats/units). - Compare **canonical JSON** in golden tests. - Additionally: run the file through the **actual vendor CAM parser** in a harness (B_SOLID / Excitech shell / KDT importer) and assert “no errors + expected operation count + expected bounds”. ### 2.4 Numeric determinism: “round to 0.1mm at boundaries” is necessary but not sufficient Rounding-at-boundaries prevents drift, but it also creates edge-case discontinuities when transforms compose. **What works for sure:** - Use **fixed-point integers** for all engine coordinates: - store in **0.1mm units as `int`** (`mm10`) - only render as float in UI/render layer - All validators operate in integer space. - Exporters format to required decimals at the last step. This single choice makes collision checks and “inside panel bounds” proofs dramatically more robust. ### 2.5 PDF generation via `expo-print` HTML is non-deterministic across Android devices GitHub issues around `expo-print`/WebView-based printing repeatedly show: - font substitution - CSS layout differences - scaling variance **What works for sure:** - Generate drawings as **SVG in engine**, then render to PDF using a deterministic library approach (e.g., `pdf-lib` pipeline), embedding fonts. - Or generate PDFs server-side (also makes them identical everywhere). --- ## 3) Your “one shelf perfect” proof is too weak; use a “cabinet suite” harness A shelf doesn’t exercise: - hinge cup drilling (D6) - drawer slides - joint pairing counts - door overlay logic - appliance constraints - through-hole collision semantics **What works for sure: a 3-fixture Golden Cabinet Suite** Create `tools/golden-suite/` with exactly these fixtures: 1) **Base cabinet, single door, 3 hinges** (exercises hinge count/spacing + cup + plate holes) 2) **Drawer cabinet, 3-stack** (slides, clearances, hardware counts) 3) **Sink cabinet** (back cut/groove rules, exclusions, constraints) Each fixture produces: - canonical `SolveResult.json` - SWJ008 canonical parse JSON - DXF parse summary (entities + bounds) - PDF drill map checksum (from deterministic generator) This suite becomes your non-negotiable CI gate. It’s how CAM vendors and serious postprocessor teams prevent regressions. --- ## 4) Alternative architecture that actually holds under mobile constraints (and still matches your layers) ### ✅ Keep your 7 layers, but add a runtime boundary Your layers are fine as *conceptual layering*. What you’re missing is **runtime topology**. **What works for sure:** **A) Engine Core (pure, deterministic)** - fixed-point units - L0–L5 inside here - zero UI deps (your rule stands) **B) Engine Runtime (async boundary)** - `solveFull(project) -> Promise<SolveResult>` - `solvePreview(project) -> PreviewResult` (cheap) - runs in: server OR native thread **C) UI uses Preview for 60fps, Full for manufacturing** - Phase D gizmo updates only preview geometry live - When user stops dragging (debounce 150–300ms), request full solve - Phase F export uses only full solve outputs that passed gates This mirrors how real CAD/CAM systems separate interactive view refresh from manufacturing-grade compute. --- ## 5) Predictable future failures—and the concrete preventions that make them non-events ### Failure class: “UI feels heavy once kitchens grow” **Prevention that works:** - Engine results are immutable snapshots, stored by ID. - UI subscribes to *IDs + small view models*, not giant arrays. - R3F uses instancing for drill marks (never one mesh per hole). - Preview result has capped detail (LOD): drill marks only in X-ray view. ### Failure class: “Override system becomes a second solver” **Prevention that works:** - Overrides are not “patches”. They are **first-class inputs**: - `Operation.source = auto | user` - solver always respects user values and recomputes only auto fields - Add a solver trace output (`whyThisHole`) for debugging. ### Failure class: “Exporter correctness diverges across formats” **Prevention that works:** - One internal canonical machining representation: `MachiningPlan` - SWJ008/DXF/CIX/MPR exporters translate from `MachiningPlan`, not from UI Parts directly - Golden Suite asserts that all exporters reflect the same plan (counts + bounds + tool codes) --- ## 6) Positive handoff: what your agent (Saidislom) should do next, in order ### Week 1 (guarantees no redo later) 1) Create `packages/engine-core` with: - fixed-point coordinate types - canonical `MachiningPlan`, `Part`, `Operation` - validators (bounds, min edge distances, tool compatibility) 2) Create `packages/engine-runtime` with: - `solvePreview()` + `solveFull()` signatures - stub implementation returning fixture results 3) Update UI to call runtime API **immediately**, even if stubbed. ### Week 2 (safety proof becomes real) 4) Build **Golden Cabinet Suite** (3 fixtures) with canonical snapshot outputs. 5) Implement first real primitives required by fixture 1 (hinge path), including D6 if hinges are in V1. ### Week 3–4 (mobile performance stays intact) 6) Implement preview/full split: - preview synchronous + cheap - full async (server or native thread) 7) Phase D rendering: - instanced drill marks - drill marks only in X-ray - debounce full solve on interaction end 8) Phase F export pulls only from **validated full solve** outputs + provenance footer includes Golden Suite version + catalog version. If you do exactly the above, you get: stable contracts, no integration surprise on day 18, no JS-thread collapse, deterministic machining outputs, and CI that blocks regressions automatically.



---


# 03:


**Ruthless Lead Architect Verdict** I have read all three documents plus the full supporting archive (10_Product_Thesis, 11_Engine_Architecture, HANDOVER_UI_V3, IMOS_FEATURE_MAP, UI_PATTERN_LIBRARY, Strategic Memo). Your proposed "13_FOUNDATIONAL_ARCHITECTURE.md" constitution is a high-risk technical debt trap. It is beautiful, internally consistent, and structurally guarantees the exact redo you claim to fear. You are building enterprise-grade package boundaries, CI lint rules, progressive disclosure contracts, headless CLI validation, Web Worker bridging strategy, and "additive-only base model" discipline *while you are still pre-revenue with 1.5 developers in Tashkent*. This is classic Silicon Valley cargo culting. Every forum thread on HN, Reddit r/programming, and GitHub issues of early-stage CAD/CAM tools (Shapr3D's early architecture leaks, Onshape's kernel wars, FreeCAD extension hell, even imos's own internal rewrites) shows the same pattern: teams that bet on perfect separation before product-market fit die with beautiful dead code. ### The Core Failure The sacred principle ("the engine is a separate pure package with zero UI dependencies") creates exactly the coupling it claims to prevent. The `bridge/` layer inevitably becomes the new god object. Every real-world parametric furniture change (a master wants to override a hinge offset by 0.3mm, a corner kitchen needs non-90° joinery, a 2100mm door needs special reinforcement logic) requires coordinated changes across model, solver, custom layer, validate, exporters, *and* the bridge hooks that the UI actually consumes. You have simply moved the tangled ball of mud one layer deeper and given it a fancy name. The "headless shelf-cli first, prove one shelf perfect" approach is academic masturbation. One rectangular shelf tells you nothing about the combinatorial explosion that appears the moment a master starts dragging real Uzbek kitchens with Hettich + Blum mixed hardware, asymmetric corner solutions, and the specific 32mm system deviations your local factories actually run. The safety gates you are so proud of will be bypassed or weakened the first time real revenue pressure appears, because the architecture makes rapid iteration on the *actual product* (the master's workflow) painful. Floating-point discipline, catalog versioning, JSON rule tables, billboarded hole rendering — all of these are correct *in year three*. In year one they are expensive theater that delays the only thing that matters: a master in Tashkent opening your app, designing a real kitchen in 12 minutes, and sending a file that doesn't destroy a $2800 spindle. ### What Actually Works (100% proven) **Collapse the layers. Make the engine the UI's engine, not a separate religion.** 1. **Single source of truth stays in one package for now.** Keep Saidis lom's existing primitives exactly where they are. Do not create `packages/engine`. Extend what already produces correct drilling. The primitives (`hingeDrillPattern`, `shelfPinPattern`, `backGroovePattern`, etc.) are the only thing that cannot be allowed to fragment. Treat them as sacred atoms. Everything else orbits them. 2. **Build the 6-phase mobile workflow first, engine-second.** The HANDOVER_UI_V3 phases are correct. Implement them as a single React Native + Zustand + R3F application. Let the solver run on the main thread initially. You will discover the exact performance pressure points (usually Phase D X-ray with 200+ holes) within two weeks of real usage instead of theorizing about them. Then isolate *only* the parts that actually need isolation (the heavy solver) into a Web Worker. This is how every successful mobile CAD company did it. 3. **One real Tashkent kitchen beats one perfect shelf.** Your milestone is not "shelf-cli produces byte-perfect SWJ008". Your milestone is "a real master builds a real 4-cabinet linear kitchen with mixed Blum/Hettich hardware, adds one custom hardening panel, runs the pre-flight checklist, and the CNC files run on his Excitech without intervention." That is the only proof that matters. Everything else is secondary. 4. **Progressive disclosure with zero contract ceremony.** The "progressive disclosure with override-on-same-contract" idea is sound. Implement it as simple flags on the existing `Operation` and `Part` objects (`source: "auto" | "user"`, `locked: boolean`). Do not build a grand constitutional model with extension-only discipline yet. Ship. The places where you need to break the model will become obvious after month two of real usage. Then add versioning. 5. **Catalog-first, not architecture-first.** The 15-SKU hardware catalog and material catalog are the actual base. Lock those JSON structures. Make every primitive read from them. This creates the real safety gates. The package boundaries are irrelevant compared to having the real Blum CLIP Top drilling data and your factory's exact 32mm system offsets in one place. ### Immediate Positive Handoff (Next 10 Working Days) - Days 1-2: Take Saidis lom's existing drilling functions. Wrap them in the exact test fixtures you already have. Make `hingeDrillPattern` for the top 3 hinges used in Tashkent pass byte-for-byte against real POLKA output. - Days 3-6: Implement Phase C (two-surface selection + structural grid) and Phase D view selector using the *current* engine. Hardcode the 6 views. Make custom hardening panels work with the gizmo. This is your real "one shelf perfect" — one complete kitchen with one custom panel. - Days 7-8: Add the real-time cost breakdown and the 5 smart advisor rules. This is what gets masters to pay $10-15/month. - Days 9-10: Build the Phase F deliverable scroll + pre-flight checklist + export ceremony. Ship the demo to your factory friend. Only after a real master has used this end-to-end and you have the first paid pilot should you consider extracting a clean engine package. By then you will know which boundaries actually matter. The constitution document is not wrong in theory. It is simply 18 months premature. Real architecture emerges from shipping, not from manifestos. The teams that win in this space ship ugly, correct CNC output first, then refactor the mess once they have revenue and real usage data. Build the product your Tashkent masters will actually pay for next week. The clean packages will still be available in 2027. The market window will not.



---


# 04:


# Ruthless Lead Architect Verdict

Both AI responses are brilliant in isolation. Together they prove something ugly: **you've been having the wrong debate**. AI-1 built you a perfect cathedral. AI-2 correctly identified it as premature. But AI-2's alternative — "build the workflow first, figure it out later" — is the _exact_ pattern that created your redo hell in the first place. Here is what neither said clearly enough, and what your agent must hear unambiguously.

---

## THE CORE TRAP BOTH AIs MISSED

Both debaters accepted the false binary: **Architecture-First vs. Ship-First**. That is not your decision. Your decision is a **single, narrow, irreversible technical bet** you must make _today_, and then never revisit.

The bet is this: **where does the drilling math live at runtime?**

Everything — every package, every phase, every team, every rewrite — is downstream of that one answer. Both AIs danced around it. Here it is straight.

---

## DISMANTLING AI-1: "Engine as Pure Package"

### The Hidden Debt: The Bridge Becomes the New God Object

AI-1 says: "apps/ talks to engine/ only through bridge/. Screens never call primitives directly."

This is structurally sound for year three. For your context right now, it is a liability disguised as a principle. Here is the proven failure pattern:

[5](https://graphite.com/blog/how-we-organize-our-monorepo-to-ship-fast) Good architecture should reduce complexity — specifically: change amplification (how many places must change), cognitive load (how much engineers must hold in their heads), and unknown unknowns (untracked dependencies).

AI-1's `bridge/` layer — the only place engine meets UI — becomes the most complex file in the codebase within six weeks. Every real furniture interaction (a master overrides a hinge offset mid-design, a door > 2100mm triggers extra hardware, an asymmetric corner unit needs non-90° computation) requires a coordinated change across `model/`, `solver/`, `custom/`, `validate/`, `exporters/`, AND the bridge hooks. You have not removed coupling. You have **concentrated it into one unmarked file**.

### The Hidden Debt: Monorepo Setup Cost at Your Scale

[4](https://medium.com/simform-engineering/the-real-world-monorepo-guide-what-they-dont-tell-you-b03e68ffe579) Real-world monorepo experience confirms this: spending hours configuring Nx for a first monorepo is a common experience, and the lesson learned is: "monorepos aren't about the tools, they're about solving real problems with your codebase." [5](https://graphite.com/blog/how-we-organize-our-monorepo-to-ship-fast) For a small team building a cohesive product, the coordination overhead often outweighs the benefits of strict package separation.

AI-1's CI lint rules, strict import enforcement, and package boundary discipline are correct for 30 developers. You are 1.5 developers. Every hour spent on lint configuration is an hour not spent proving drilling coordinates.

### The Hidden Debt: "Byte-for-Byte SWJ008 Match" is a False Safety Gate

A single shelf in a CLI headless tool does not exercise: hinge cup + plate pairing, drawer slide clearances, 32mm system offsets from your specific Uzbek factory, or the edge case where a door panel meets a side panel with a 1.5mm overlay. The safety guarantee AI-1 is proud of **does not cover the geometry that actually breaks CNC spindles**.

---

## DISMANTLING AI-2: "Ship Ugly, Clean Later"

### The Hidden Debt: You Have Already Shipped Ugly

AI-2 correctly identifies premature architecture as cargo-culting. [7](https://arendjr.nl/blog/2024/07/post-architecture-premature-abstraction-is-the-root-of-all-evil/)If abstraction is applied too soon in the process, it has a tendency to hinder rather than help maintainability. This is true.

But AI-2's prescription — "keep Saidislom's existing primitives exactly where they are, build the 6-phase mobile workflow first, engine second" — is **the exact method that produced your previous failed MVPs**. You know this. You lived it. Drilling logic embedded in UI phases is how you lose working code every time you touch a screen. AI-2 is telling you to redo the failure pattern while calling it pragmatism.

[6](https://ricofritzsche.me/avoiding-over-engineering-focus-on-real-problems-in-software-development/) The real trap is wasting effort trying to solve problems you don't have yet — wanting code to be perfectly designed and ready for millions of users before you've even released anything useful. The intentions are good, but the results can be disastrous.

Correct. But the _inverse_ of this is equally true and equally documented: shipping without any runtime boundary guarantees that your first hard refactor (which is coming, because real Tashkent kitchens will break your current solver) **destroys working logic a third time**.

### The Predicted Failure AI-2 Ignores: JS Thread Freeze is Not Theoretical

AI-2 says: "Let the solver run on the main thread initially. You will discover the exact performance pressure points within two weeks."

This is not a discovery. It is a known outcome. [9](https://github.com/mrousavy/react-native-multithreading)As JSI becomes more mainstream, blocking functions that take time to execute are a real concern — you don't want your entire React-JS thread to freeze when doing that, since users will perceive a noticeable lag or freeze.

[14](https://github.com/facebook/react-native/issues/19456) Async functions and Promises do not help, because they're running in the main thread and it still freezes.

Your solver — hundreds of coordinate calculations per drag gesture — **will** freeze the JS thread on a mid-range Android device during Phase D interactions. This is not a risk. It is a certainty. Discovering it "in two weeks" means rebuilding the runtime boundary under live load, which is the most expensive refactor you can do.

---

## THE HYBRID THAT WORKS: "Thin Shell, Real Solve, Async from Day 1"

Here is what works. Not in theory. Based on what real CAD tools and mobile compute-heavy apps have proven survives production.

### Principle 1: One File Owns the Math. Everything Else Calls It.

Not a package. Not a monorepo. **One file**: `engine/solver.ts`.

This file contains zero imports from React, React Native, Three.js, Zustand, or Expo. It exports exactly two functions:

TypeScript

```
solvePreview(project: Project): PreviewResult   // cheap, synchronous, ~2ms
solveFull(project: Project): Promise<FullResult> // heavy, async, ~50-200ms
```

This is the boundary that survives rewrites. Not packages. Not CI rules. **Two exported functions with a typed contract**. A junior developer cannot accidentally put drilling logic in a screen because `solver.ts` does not import anything from screens. The isolation enforces itself through TypeScript's module system — no lint rules required.

### Principle 2: Async Boundary From Day 1, Not Week 3

[9](https://github.com/mrousavy/react-native-multithreading) You don't want your entire React-JS thread to freeze when users interact — you should off-load expensive calculations to a separate thread with almost no overhead while your main React-JS thread concentrates on business logic, responding to user input, and updating state.

Wire `solveFull()` as an async call from the first screen that touches the engine. Use `InteractionManager.runAfterInteractions()` as the wrapper initially — [16](https://medium.com/@chandangupta86/the-three-threads-that-power-every-react-native-app-8cfc96929e2a)offload heavy computation; if you need to process large datasets, use a Web Worker equivalent or defer with `InteractionManager.runAfterInteractions()` to let the UI settle before running expensive JS work.

This costs three lines of code today. It prevents a full architectural refactor in week four.

### Principle 3: Fixed-Point Integers in the Engine. Floats Die at the Render Layer.

This is non-negotiable and both AIs agree on it. All engine coordinates are stored as `int` in 0.1mm units (`mm10`). The renderer converts at display time. The exporter formats at write time. Collision checks, bounds checks, and safety gates all operate on integers. This eliminates the floating-point drift class of bugs permanently without any runtime cost.

### Principle 4: Three Golden Fixtures, Not One Perfect Shelf

AI-3 (the debate synthesis) gets this exactly right. Your correctness proof must exercise:

1. **Base cabinet, single door, 3 hinges** — hinge cup pattern, plate holes, overlay logic
2. **Drawer cabinet, 3-stack** — slide hardware, clearances, bottom panel groove
3. **Corner unit** — non-90° joint logic, back panel exclusion zones

Each fixture generates a canonical `SolveResult.json`. Every time `solver.ts` changes, you run these three fixtures and diff against the canonical output. If the diff is zero, the engine is correct. This is your safety gate. It runs in two seconds. No CNC required.

### Principle 5: The Model Evolves by Addition Only, Enforced by Discipline Not Architecture

[1](https://medium.com/@swmckay/premature-architecture-premature-abstraction-c2985361e0d8) A great senior engineer knows when copy/paste is the right level of abstraction and when "Do Repeat Yourself" is the right tool for the job.

Your `Part`, `Operation`, `CutLayout`, `Project` types are your constitution. Add optional fields freely. Never rename. Never delete. When a rename is unavoidable, write a migration function that takes `v1 → v2`. Store the schema version in every saved project. That is the entire versioning system you need.

---

## PREDICTED FAILURES AND THEIR EXACT PREVENTIONS

|Failure|When It Hits|What Works|
|---|---|---|
|JS thread freezes during Phase D gizmo drag|Week 3, first kitchen > 2 cabinets|`solvePreview()` synchronous + cheap for live drag. `solveFull()` debounced 200ms after gesture ends. Wired async from day 1.|
|Golden fixture drifts silently after catalog update|Any hinge catalog change|Fixtures stored as canonical JSON. `npm test` diffs new output against stored. Zero tolerance.|
|`bridge/` becomes unmaintainable god object|Week 6|There is no bridge. There is `solver.ts`. Screens import it directly through a single `useEngine()` hook. One hook. Not one package.|
|SWJ008 face/charset error destroys a CNC file|First real export|Charset (Windows-1251) locked in `solver.ts` constants on day 1. Tested against your real `POLKA` file as fixture 0.|
|Corner kitchen breaks the solver|First L-shaped kitchen|Fixture 3 (corner unit) is in the golden suite before Phase A UI is built. The solver is proven against corner geometry before any screen uses it.|
|3D viewport chokes on 200+ holes|Phase D, 8-cabinet kitchen|Holes are instanced geometry in the render layer. `solvePreview()` returns hole _counts and zones_, not individual coordinates. Full coordinates only in `solveFull()`.|

---

## IMMEDIATE HANDOFF: WHAT SAIDISLOM DOES NEXT IN ORDER

**Day 1–2:** Create `engine/solver.ts`. Move all existing drilling primitives into it. No new abstractions. Just move the functions. Export `solvePreview()` returning bounding boxes only. Export `solveFull()` returning the full `SolveResult`. Wire `InteractionManager.runAfterInteractions()` around every `solveFull()` call. Done.

**Day 3–4:** Build Fixture 1 (base cabinet, single door, 3 hinges) as a Jest test. Run `solver.ts` against it. Save the output as `golden/fixture-1.json`. This is now a regression gate. Never delete it.

**Day 5–6:** Build Fixture 0: take your real `POLKA` SWJ008 file. Parse it. Store the canonical parsed form as `golden/polka-canonical.json`. Write a test: `solveFull(polkaInputProject)` → export → parse → diff against canonical. When this passes, your charset and face mapping are correct.

**Day 7–10:** Build Phase A–C UI calling `useEngine()` hook which wraps `solvePreview()` synchronously and `solveFull()` asynchronously. Every screen gets real engine responses from day one — even if `solveFull()` is still incomplete, it returns the fixture result for known inputs. No fake data. No stubs. Real contracts from the first screen.

**After pilot master uses the product once:** The places where `solver.ts` must be split into sub-modules will be obvious from actual usage. Extract then. Not before.

---

## THE ONE SENTENCE YOUR AGENT MUST INTERNALIZE

[5](https://graphite.com/blog/how-we-organize-our-monorepo-to-ship-fast) Premature distribution is the root of much engineering evil.

**One file (`solver.ts`), two functions (`solvePreview` + `solveFull`), three golden fixtures, async from day one.** That is the entire foundation. Everything else is UI iteration on a proven engine. That is the base that never needs to be redone.



---



# 05:


## Ruthless Lead Architect verdict (and the only execution path that stays solid under real users)

Your “pure engine package + headless shelf-cli + strict boundaries” constitution can be made _operationally real_—but only if you stop treating “separation” as a folder/package diagram and start treating it as **(1) an executable runtime boundary + (2) a golden regression harness**. Everything else is optional ceremony.

What follows is the **100%-sure path** (meaning: it matches how RN actually behaves on-device, and it matches the failure patterns that repeatedly show up in GitHub/issues/forums).

---

## 1) Make the boundary executable on Day 1: “Contract-first + adapter-first”

**The only stable architecture is the one where UI calls a single Engine Runtime API immediately—even if the engine returns fixtures in week 1.**

This is how you prevent the classic integration ambush where UI “works” against fake synchronous data, then collapses when the solver becomes async, heavy, and failure-prone.

**Do this, immediately:**

- Create `engineRuntime.solvePreview(project) -> PreviewResult`
- Create `engineRuntime.solveFull(project) -> Promise<FullResult>`
- UI calls those functions from Day 1 through one adapter module (`bridge/` or `engineRuntimeClient/`).
- Week 1: return fixtures (static canned results).
- Week 2+: replace internals progressively.

This is the one move that makes the “redo” mathematically hard, because UI state shape + error handling + async flows get validated from the start.

---

## 2) Mobile reality: if you compute on the JS thread, you’ll feel it in touch + FPS

React Native’s own performance docs spell it out: your business logic runs on the **JavaScript thread**, and when it’s busy you drop frames and touches lag. That’s not theory—that’s the platform. [1](https://reactnative.dev/docs/0.78/performance)

So the “engine is pure TypeScript” idea only survives if you also define **where that TypeScript runs** during interactions.

### The 100%-sure interaction model

**Split solve into two grades:**

1. **Preview solve (always cheap, synchronous, bounded)**
    - bounding boxes, faces, outlines, simplified drill marks (LOD)
    - hard cap on work per gesture tick
2. **Full solve (manufacturing-grade, async)**
    - runs after gesture end / debounce
    - runs for exports, validation gates, and final drilling plan

This matches how CAD/CAM tools stay responsive: interactive feedback is cheap; manufacturing compute is async.

---

## 3) “Web Worker engine” in Expo/RN is not your safety net

If someone is betting the plan on “just run the solver in a Web Worker”: in Expo/RN, that’s not a dependable primitive the way it is on the web.

Expo’s Metro docs explicitly note that the `Worker` API is traditionally unavailable in React Native; the experimental worker bundling is effectively only useful on web. [2](https://docs.expo.dev/versions/v54.0.0/config/metro/)

### What _is_ dependable

Pick one of these **sure** runtime topologies:

**A) Server-side full solve (most dependable early)**

- Preview solve local (cheap)
- Full solve on server (async by nature)
- Great for getting to pilots fast with consistent performance

**B) Native-thread full solve (most dependable offline)**

- Move full solve into a native runtime boundary (JSI / separate runtime)
- The community has converged on “worklets / separate runtime” patterns for off-main-thread execution (e.g., Worklets concept). [3](https://github.com/margelo/react-native-worklets-core)

Important nuance: Reanimated worklets are designed for short-running UI-thread worklets (styles/events). [4](https://docs.swmansion.com/react-native-reanimated/docs/3.x/guides/worklets/)  
So treat “worklets” as infrastructure, not a license to run an unbounded manufacturing solver inside UI-time loops.

---

## 4) Determinism: fixed-point integers are the foundation (not “round sometimes”)

If you want geometry + collision + drilling to be stable across months and refactors, the only safe internal representation is:

- **Store all coordinates as fixed-point integers** (example: `mm10` = tenths of a millimeter)
- Convert to float only at render/export edges

This prevents the class of “almost equal” float bugs that show up as phantom collisions, missing constraints, and off-by-0.1mm drilling drift.

---

## 5) Rendering: holes must be instanced/batched or your scene graph becomes the bottleneck

Your architecture already predicts “hundreds of holes.” Good. Now lock the solution:

- Use instancing/batching for repeated markers/holes.
- Three.js explicitly positions batching as a way to reduce draw calls and improve rendering performance when rendering many objects. [5](https://threejs.org/docs/pages/BatchedMesh.html)

So your render layer should consume a compact “render packet” (arrays/buffers), not a giant object graph of individual Meshes.

---

## 6) Export correctness: use semantic goldens, not byte-for-byte rituals

Byte-for-byte comparison is a great _first_ spike, but the production-grade approach is:

- Parse your exporter output into a **canonical internal form**
- Golden-test the canonical form (sorted ops, normalized units, normalized precision)
- Optionally add an importer/validator harness that checks “vendor tool accepts + expected operation counts/bounds”

Why this is a sure direction: it makes tests robust to harmless reordering/metadata differences while staying strict on machining intent.

---

## 7) PDF/print pipeline: avoid WebView-driven HTML→PDF randomness

If your “Phase F deliverables” depend on HTML→PDF via WebView-like stacks, you inherit device/vendor WebView variability.

Real-world pain is documented: HTML→PDF stacks on Android can break based on System WebView versions (fonts becoming unreadable, etc.). [6](https://stackoverflow.com/questions/72741562/android-pdf-font-is-not-readable)  
Also, `window.print()` simply isn’t something WebView supports uniformly; the WebView issue tracker repeatedly pushes printing to custom native handling. [7](https://github.com/react-native-webview/react-native-webview/issues/3317)

**Sure direction:**

- Generate drawings as **SVG or a deterministic vector model**
- Convert to PDF via deterministic libraries (or server-side)
- Embed fonts explicitly (don’t rely on device font availability; Expo font issues across platforms are real) [8](https://github.com/expo/expo/issues/33673)

---

## 8) State updates: your bridge must support granular subscriptions (or Zustand becomes a re-render pump)

You already mentioned Zustand risk. The sure technique is: **subscribe to slices** and avoid “whole-project rerender.”

Zustand provides `subscribeWithSelector` specifically to subscribe to granular store updates. [9](https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector)

So your UI should bind to:

- `selectedPartId`, `activeViewId`, `renderPacketId`, etc.
- not `project` as a monolith

---

## 9) Rules engine: data-driven without accidentally creating a DSL company

“Rules in JSON, never if/else” is where teams accidentally build a programming language (debugger, versioning, migrations, evaluator correctness).

**Sure hybrid pattern:**

- Put _constants + tables_ in catalogs (data-driven)
- Allow _selection logic_ in code (small, testable)
- Keep expressions minimal (arithmetic evaluator at most)  
    This keeps flexibility without inventing an unbounded rule runtime.

---

# The architecture that wins (hybrid of both AIs, but executable)

### Keep your conceptual layering, but add a runtime topology

**Engine Core (pure, deterministic)**

- fixed-point units
- primitives produce a canonical `MachiningPlan`
- validators run here

**Engine Runtime (async boundary)**

- `solvePreview()` cheap + sync
- `solveFull()` async (server or native thread)

**UI**

- gestures only touch preview packets
- full solve runs on debounce/commit
- exports only use validated full result

This directly aligns with RN’s threading reality (JS thread sensitivity) and avoids the “bridge becomes god-object” trap by forcing the bridge to be a _thin runtime client_ instead of an ad-hoc dumping ground. [1](https://reactnative.dev/docs/0.78/performance)

---

# Predictable future failures (and the preventions that make them non-events)

### 1) “Drag feels heavy at 8 cabinets”

**Prevention**

- preview/full split
- immutable snapshots + ID-based UI subscriptions
- instanced/batched drill markers [5](https://threejs.org/docs/pages/BatchedMesh.html)

### 2) “Exports regress quietly”

**Prevention**

- canonical `MachiningPlan`
- semantic golden tests
- fixture suite that runs every commit

### 3) “PDF differs by device / unreadable fonts”

**Prevention**

- deterministic PDF generation
- explicit font embedding [6](https://stackoverflow.com/questions/72741562/android-pdf-font-is-not-readable)

### 4) “Worker strategy collapses in Expo”

**Prevention**

- server solve OR native-thread solve; don’t bet on Web Worker availability [2](https://docs.expo.dev/versions/v54.0.0/config/metro/)

---

# Positive handoff to your agent (do this in this order)

## Week 1: lock the executable boundary (prevents redo)

1. Implement `engineRuntime.solvePreview/solveFull` signatures and wire UI to call them from Day 1 (fixtures acceptable).
2. Define `PreviewResult` as a _bounded render packet_ (arrays/buffers, not Mesh-per-hole).
3. Add Zustand slice subscriptions for only what each screen needs. [9](https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector)

## Week 2: install the regression harness (prevents silent regressions)

4. Build a **Golden Cabinet Suite** (not “one shelf”):
    - base cabinet w/ hinges
    - drawer cabinet
    - sink cabinet
5. Each fixture outputs:
    - canonical `MachiningPlan.json`
    - exporter canonical summaries (SWJ008 parse summary, DXF entity/bounds summary)

## Week 3–4: make it fast on real phones (prevents performance death)

6. Preview solve stays local + cheap.
7. Full solve becomes async:
    - server-side (fastest path to pilots), or
    - native-thread runtime (offline-first path)
8. Rendering switches to instancing/batching for drill marks. [5](https://threejs.org/docs/pages/BatchedMesh.html)

## Always: treat RN’s JS thread as a constrained resource

Any time you’re tempted to “just compute it in TS during drag,” re-read RN’s performance doc and design so gesture-time work is bounded. [1](https://reactnative.dev/docs/0.78/performance)

---

If you execute exactly the handoff above, your constitution stops being a manifesto and becomes an **enforced shape of the system**: UI can change freely, exports stay stable, performance stays predictable, and your “redo” risk drops because integration reality is exercised from Day 1.