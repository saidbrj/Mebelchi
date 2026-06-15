I'll research this in stages. First a quick check of your existing conventions context, then deep on Notion and Linear, then I'll be honest about what your factory friend needs to answer that I can't.Good context. Your `materials.json` and `06_CONVENTIONS.md` are already the "hidden forever" bucket. Now let me research how Notion and Linear actually do this.# Default Systems Research — Synthesis for Mebelchi

Four questions, one underlying principle: **opinionated defaults are not a UX choice, they are a positioning weapon.** Every default you lock removes a screen, removes a decision, removes a way for the user to fail. Notion and Linear both treat defaults as ideology, not convenience. Below is what they actually do, mechanically — and how it maps to your three buckets.

---

## 1. Notion: The "page is the product, settings are a sin" doctrine

Notion's core philosophy: when you first open Notion, it doesn't just shove a blank canvas in your face and expect you to figure it out. Instead, it feels a bit like walking into a well-organized, welcoming workspace. The whole product is built on the assumption that _the blank canvas is the enemy of activation_.

How they pull this off — three mechanisms that map directly to your situation:

|Mechanism|What it does|Mebelchi translation|
|---|---|---|
|**Intent capture at signup**|When users sign up for Notion, one of the first things it asks is how they plan to use it, whether it's for work, personal use, or school. It also asks about their role. They shape the entire user onboarding process.|Ask once: "Cabinets only / Kitchens / Wardrobes / Office furniture" → load that template library. Don't ask anything else.|
|**Pre-populated workspace**|Based on these answers, the workspace users land in feels different. If they're working in a team, Notion sets up project boards, meeting notes, and docs. It even pre-populates them with example content|The user lands on a real kitchen (4 base + 3 upper + sink + stove), not an empty room. They delete/resize, never start.|
|**Settings are for power users who already converted**|Notion has hundreds of settings, but they live behind /settings, accessed via gear icon. A new user can use Notion for 6 months without opening /settings once.|`conventions.md` and `materials.json` ARE your /settings. The mobile app should have NO settings screen at V1. Period.|

**The page-vs-settings test (steal this rule):** _Does this decision change what the user sees on screen, or what they hand to the customer?_ If yes → page. If no → settings (or hidden forever). Kerf width doesn't change the customer's kitchen. It goes in `conventions.md` and nobody ever sees it.

---

## 2. Linear: The "atomic opinions, configurable concepts" doctrine

This is the most useful framework I found for your situation. Linear's CEO Jori explicitly states their rule: "We design it so that there's one really good way of doing things." ... The team is generally more opinionated at the atomic level—deciding to add labels and due dates as issue properties, for example. As they move up the stack to broader concepts like projects, they take more cues from customer feedback, knowing that every company is structured differently.

Translated: **be a tyrant at the part level. Be a democrat at the kitchen level.**

|Level|Linear example|Mebelchi equivalent|Opinion strength|
|---|---|---|---|
|**Atomic** (the unit of work)|Issue: must have status, priority, assignee. Status flow is fixed: Triage → Backlog → In Progress → Done.|Part: must have w/h/thickness/material/edges. Operation types: drill / groove / pocket / cutout. Period.|**Tyrannical.** No customization.|
|**Mid-level** (the container)|Cycle: fixed length, no story points, automatic rollover|Cabinet: dimensions, # of shelves/drawers/doors, hardware style|**Strong default, override possible**|
|**Broad** (the org structure)|Project: structure varies by team, more flexibility|Kitchen layout: linear / L-shape / U-shape / island|**Customer drives, you suggest**|

And their workflow is explicit: Linear works best with a clear, well-defined workflow: Start with Linear's default workflow then customize minimally · Define clear entry and exit criteria for each status ... High-performing teams typically use 5-7 statuses that clearly reflect where work stands. The defaults are not "a starting point" — they're a recommendation backed by religious conviction.

**Why this matters for your team specifically:** Linear's culture is documented as Linear is opinionated by design. When you fight that opinion — adding eight custom statuses, creating nested label taxonomies, building complex automations before you've run a single sprint — you end up with a bloated setup that slows everyone down.. Your `06_CONVENTIONS.md` is already this. Don't soften it.

The most quotable bit of the Linear philosophy, which I'd literally print and tape to Saidislom's wall: "No one wants to waste time nitpicking the nuances of a process. We try to reduce the amount of fiddling around with processes and get you into building things."

---

## 3. The Mechanical Bucket Test (synthesizing Notion + Linear into one rule)

You proposed three buckets. Here's a one-question test to assign any decision to a bucket:

```
For decision X, ask: "If I get this wrong by 10%, what breaks?"
```

|Answer|Bucket|Why|
|---|---|---|
|The customer's kitchen is the wrong size or wrong color|**(a) User must choose**|Physical outcome differs visibly|
|The cut is slightly less optimal or the cabinet looks slightly different|**(b) Smart default + long-press override**|Physical outcome changes subtly; 80% of users won't care|
|The CNC fails, or the part doesn't match the standard the shop already uses|**(c) Hidden forever in conventions.md**|This is a fact about the shop's environment, not a choice|

Applying this to your real list:

|Decision|Bucket|Reasoning|
|---|---|---|
|Cabinet width|**(a)**|Customer sees it. Must choose.|
|Cabinet height|**(b) default 720mm**|Almost always 720mm. Override on long-press.|
|Cabinet depth|**(b) default 600mm base / 300mm upper**|Same.|
|Material color/decor|**(a)**|Customer picks.|
|Material thickness|**(b) default 16mm or 18mm — see §4**|Locked per shop.|
|Sheet size|**(c)**|Comes from the supplier, not the user.|
|Kerf|**(c)**|Per-shop constant, never changes per job.|
|Edge banding thickness|**(b) default 2mm visible / 0.4mm hidden**|Workshop standard.|
|Edge banding color|**(b) default = match facade material**|Auto-derived, rarely overridden.|
|Drill diameter (5mm Confirmat / 8mm dowel)|**(c)**|Hardware-determined.|
|Backing material|**(b) default HDF 3mm**|Universal in CIS market.|
|Plinth height|**(b) default 100mm**|Standard.|
|Hardware brand (Blum vs Hettich vs Boyard)|**(c) per shop**|Set once during shop setup, never per-kitchen.|
|Hinge type/overlay|**(b)**|95% are 35mm overlay hinges.|
|Door/drawer count per cabinet|**(a)**|Customer choice.|
|Drawer slide brand|**(c) per shop**|Same as hinge brand.|
|Grain direction requirement|**(c) auto-derived from material decor**|If decor has visible wood grain → required_axis = Y; else ANY.|

That last one is the killer insight from your existing architecture. The `grain.required_axis` field in your `Part` schema is already designed to be _derived_, not _input_. Most decisions in your pipeline should be like this.

---

## 4. Uzbek/CIS cabinet defaults — what to bake in BEFORE confirming with factory friend

You're right to say "ask the factory friend." But you should walk into that conversation with a hypothesis, not a blank questionnaire. The CIS furniture market shares conventions so strongly across borders (same suppliers, same Russian-language design tradition, same metric grid) that I can give you a 90%-confidence starting set. The factory friend confirms or amends — he doesn't generate from zero.

### Base cabinet defaults — CIS standard (very likely matches Tashkent)

|Dimension|Default|Source/confidence|
|---|---|---|
|Base cabinet height (without plinth or countertop)|**720mm**|Высота нижних шкафов (базовых тумб) составляет около 720 мм — universal CIS standard|
|Plinth height|**100mm (range 100-150)**|Вместе с цоколем (стандартно 100-150 мм) и столешницей (стандартно 28 мм или 38-40 мм), высота рабочей поверхности получается примерно 850-910 мм|
|Countertop thickness|**28mm** (default) / 38mm (premium)|Same source — both common|
|Total working surface height|**848mm** (720 + 100 plinth + 28 countertop)|Derived|
|Base cabinet depth|**550-570mm carcass, 600mm with countertop overhang**|Обычно она составляет 55­–57 сантиметров, и именно на такой показатель рассчитано большинство кухонных механизмов|
|Upper cabinet depth|**300mm**|Standard CIS|
|Upper cabinet height|**720mm** (matches base) or **920mm** for tall uppers|CIS standard|
|Gap between upper and base|**600mm (450-600 range)**|Standard ergonomic|
|Module width grid|**multiples of 50mm**, common widths: 300/400/450/500/600/800/900/1000/1200mm|Кухонные модули имеют стандартную ширину, кратную 50 мм или 100 мм|
|Most common single base|**600mm wide**|Модули для встроенной техники (духовки, микроволновые печи, посудомоечные машины) имеют ширину 600 мм или 450 мм|

**My recommended hard defaults to bake in (subject to factory friend confirmation):**

```
DEFAULT_BASE_HEIGHT_MM = 720
DEFAULT_BASE_DEPTH_MM = 550   # carcass; countertop overhangs to 600
DEFAULT_UPPER_DEPTH_MM = 300
DEFAULT_UPPER_HEIGHT_MM = 720
DEFAULT_PLINTH_HEIGHT_MM = 100
DEFAULT_COUNTERTOP_THICKNESS_MM = 28
DEFAULT_GAP_UPPER_TO_BASE_MM = 600
DEFAULT_NEW_CABINET_WIDTH_MM = 600  # when user taps "+" to add a cabinet, this is what appears
WIDTH_SNAP_GRID_MM = 50           # all resize gestures snap to this
```

### Three questions for the factory friend to close this section

Don't ask "what are the standard sizes." Ask these three:

1. "When customers come in and don't specify, what's the default base height your shop builds?" (Confirms 720mm.)
2. "What's your most common single-module width?" (Probably 600mm, but worth confirming Tashkent doesn't favor 500mm.)
3. "Show me a job you finished last week — what depths did you cut?" (Catches the 550 vs 600 carcass nuance.)

---

## 5. ЛДСП material defaults — Tashkent likely

Your current schema already uses `ldsp_18_white_2750x1830` as an example. Let's check whether that's actually the right default.

|Variable|CIS dominant|What your schema says|Notes|
|---|---|---|---|
|Default thickness|**16mm in budget market, 18mm in mid/premium**|18mm|в большинстве случаев мебель производят из 16-миллиметрового ЛДСП — 16mm dominates CIS budget. В странах Европейского Союза при производстве корпусной мебели за стандарт толщины стенок корпуса принято 18 мм. Factory friend determines which your target segment uses.|
|Backing material|**HDF 3mm**|hdf_3_white|Universal default ✓|
|Sheet format|**2750×1830mm** (Russian/Belarusian) or 2800×2070mm (Egger/Kronospan EU)|2750×1830|2750х1830мм — ЛДСП такого формата производит Kronostar, Увадрев Холдинг, Шекснинский комбинат древесных плит и Череповецкий фанерно-мебельный комбинат — depends on supplier mix in Tashkent|
|Most common color|**White (Белый/Egger W980)**|"white"|Universal. Confirmed by the embarrassment of being unable to find a kitchen workshop in CIS that doesn't have white ЛДСП in stock.|
|Edge band visible|**2mm PVC**|2mm|Standard ✓|
|Edge band hidden|**0.4mm PVC**|0.4mm|Standard ✓|

### The one decision I'd push back on

Your example uses 18mm as the default carcass material. If your target is **small shops of 4–15 people serving the mid-market**, 18mm is probably right. If you're targeting the budget segment (which Bazis ignores even harder), 16mm is the real default and 18mm is the override. **Ask the factory friend: what thickness do most workshops in his orbit use for carcass sides on a 600mm base?** The answer determines this default.

### Two more questions for the factory friend

4. "When a customer just says 'белую кухню' (a white kitchen), what decor code do you pull from stock?" (This is your literal `default_decor_id`.)
5. "Which supplier do you order from most often, and what sheet size do they ship?" (Determines whether default sheet is 2750×1830 or 2800×2070.)

---

## 6. Recommendation — what to actually do this week

Three concrete moves, in priority order:

**Move 1: Lock the schoolboy-test default kitchen.** Build one and only one starter template for V1 launch: a 2.4m linear kitchen with sink + stove + 4 base + 3 upper, using the defaults above. Notion's Getting Started page is a great example of learn-by-doing onboarding — the user opens the app, sees this kitchen, taps a cabinet, resizes it. Within 60 seconds they understand the entire product. No tutorial. No settings. No options.

**Move 2: Add a "shop setup" wizard, one time only, hidden after.** This is your equivalent of /settings — a one-time onboarding flow that captures the (c) bucket items: shop hardware brand, default ЛДСП supplier, default thickness, kerf value. After this, the user never sees these screens again unless they tap "Shop settings" deep in a menu. This is the Notion pattern — opinionated defaults, but with one explicit moment to override.

**Move 3: Run the factory friend call with the five specific questions above, not a generic interview.** You don't want him to tell you everything. You want him to **confirm or reject** the seven-line `defaults` block I gave you above. A 20-minute call closes this. A 2-hour open-ended interview teaches you nothing actionable.

---

The deeper point that connects all four research questions: the team's silent-failure problem isn't really about code quality — it's about scope discipline. Every default you lock is a class of bug that can't happen anymore. Linear's opinionated defaults mean teams start productive immediately without configuration paralysis applies in reverse, too: opinionated defaults mean _developers_ don't accidentally build configuration code that nobody asked for. Your `conventions.md` already shows you understand this. The four research questions above are about extending that discipline from the backend (where it's locked) to the UI (where it's still leaking).




---

# The "Wow" Mechanic — Research Synthesis

Before answering the four questions, one observation on what they're all really asking: every one of these prompts is a different angle on the same question — **how do you compress "I understand this tool" into the smallest possible time window**. Stripe, Linear, Arc, configurators, activation curves — they all converge on a single rule: _the first thing the user does must change something they can see, and the change must beat their expectations._ I'll answer each prompt, then tie it back to your three principles and the schoolboy test.

## 1. Micro-interactions that create the most delight for first-time users

Delight is a measurement error. Specifically, it's the gap between what a user expects to happen and what actually happens, _when reality is better than expectation_. Every memorable micro-interaction listed in your prompt exploits this gap in a slightly different way:

**Stripe Checkout** doesn't have one delightful animation — it has a system of them. The card field auto-detects the brand and morphs the icon as you type the first 4 digits. The expiry/CVC fields appear with a slide-in transition only _after_ the card number is valid, so the form physically grows with your progress. Errors don't pop — the field shakes laterally about 8px and the border colors transition over ~200ms. The team's stated principle is: "If you disable animations, the flow should feel broken; if it is not, this might mean your animations are superfluous." That's the test. Animation is not decoration; it's structural feedback. Stripe's micro-interactions aren't individually game-changing — it's the accumulation of dozens of small, thoughtful touches.

**Linear's command bar (Cmd+K)** does something subtler. It's not delightful because it animates — it's delightful because it collapses 5+ menu paths into one input. The wow moment is realizing _"I don't need to learn the UI."_ The animation supporting it (the bar slides down ~120ms, results render progressively, selection has a soft highlight glide) is fine, but the magic is the cognitive offload. You type "assign" and it knows what you mean.

**Arc Browser's tab stacking** is interesting because the delight isn't in the _act_ of stacking — it's in the realization, around tab #12, that you haven't lost any tabs and your sidebar is still legible. The whole experience starts to feel like using Raycast or Alfred — your hands never leave the keyboard. The Cmd+T command bar replaces the URL bar entirely. Arc's command bar was not just an address bar — it was a universal entry point that made the browser chrome feel optional. The delight is _removal_, not addition.

**Apple Vision Pro's gaze targeting** is the most extreme version of the same principle: the input cost is zero. You don't click — you look. The micro-interaction is the _subtle highlight that confirms your gaze is being read_. This is the purest form of "the system anticipated me."

**The pattern beneath all four:**

- Stripe → _the form responds physically to my correctness_
- Linear → _the tool understood my intent without me clicking through menus_
- Arc → _the tool removed clutter I didn't know I had_
- Vision Pro → _the tool read my mind before I moved_

Translated to your kitchen tool: the first cabinet the user touches should respond physically (resize handles spring to life), the system should pre-fill the next intent (after sizing a base, suggest a wall cabinet above it), and the UI should remove clutter the user didn't know to remove (don't show kerf, don't show "edge banding allowance" — those are conventions).

## 2. When live preview becomes the wow moment

Live preview crosses the wow threshold at one specific point: **when the round-trip from input to visible result is faster than the user's expectation of a save/render cycle.** Figma owns this category because clicking a color and seeing the fill change feels instantaneous — not "fast loading," but _direct_. The intuition is: the model isn't somewhere else being rendered. The model is _here_.

The threshold has a number: roughly **100ms**. Below that, the user perceives causation — "I did that." Above 200ms, they perceive a request-response — "I asked, it answered." Below 50ms, they don't notice the system at all. The wow is in the 50–100ms band where you're aware of the act but not of the lag.

For your kromka use case, the rule is:

- **Sub-100ms repaint of the changed edge** = direct manipulation → wow
- **100–300ms with a clear loading state on the edge** = confidence → acceptable
- **>300ms or whole-scene re-render** = the user thinks it's a save operation → broken

This is hard in 3D because re-rendering 50 cabinets takes time. The trick Figma uses, and what you should steal: **don't re-render the world, mutate the material**. The kromka color is a property on a single material slot. Bind every kromka edge to that material, and changing the color is a single uniform update — no geometry traversal. ~16ms on a phone.

Two design moves that turn correct live preview into a _wow_:

1. **Show the change in the gesture, not after the gesture.** As the user drags the color picker hue slider, the edges should change _during_ the drag, not on release. The hand-eye loop is what creates the play feeling.
2. **Preserve the camera.** Never re-center, never re-frame, never zoom. The user's mental model is that they are looking at a kitchen and they changed one thing. Re-framing breaks the spell.

The wow moment is **the second change**, not the first. The first time the edge changes color, the user thinks "okay, that worked." The second time — different color, different cabinet, no save button pressed — that's when they understand the tool is direct, and that's when they start playing.

## 3. The 60-second aha — 10 SaaS tools and what triggers it

Products that get users to create something real within 60 seconds see dramatically higher 7-day retention than products that front-load education. Explaining comes later. Experiencing comes first. The pattern across the strongest examples:

|Tool|Aha trigger|Time to trigger|
|---|---|---|
|Figma|Drop a shape on the canvas, change its fill, see it update live|~15s|
|Notion|Type `/` on an empty page, see the block menu, insert a heading|~20s|
|Slack|Send the first message and watch it appear in real-time for the team|~45s|
|Dropbox|Drag a file into the folder, see the sync icon, watch it appear on the second device|~60s|
|Loom|Hit record, talk for 5 seconds, see the share link appear _while still recording_|~30s|
|Canva|Pick a template, change one piece of text, see the layout hold its proportions|~25s|
|Linear|Press C, type an issue title, hit enter — it's already assigned and in the right project|~10s|
|Excalidraw|Draw a rough rectangle, watch it auto-clean into a perfect shape|~5s|
|Cursor|Highlight code, hit Cmd+K, type "make this async", watch the diff appear|~30s|
|Spline|Drop a 3D primitive, drag a rotate gizmo, see it spin in real-time|~15s|

The fastest activations (Linear ~10s, Excalidraw ~5s) share one trait: **the user doesn't have to learn anything new before producing output**. They use a gesture they already know (typing, rough sketching), and the tool elevates it.

For your kitchen tool, here's the schedule that respects the 30/60/120 second checkpoints:

- **0–30s — first aha: the kitchen appears.** Don't show a blank canvas. Don't show a "pick a template" screen. The app opens, asks "длина стены?" (one number), and a fully-formed 80%-correct kitchen renders. This is the Excalidraw move: the user's first input produces a finished-looking artifact.
- **30–60s — second aha: I can change things and it just works.** Tap a cabinet, drag its edge, watch every adjacent cabinet reflow. No "save," no "regenerate." The user discovers the tool is live by trying.
- **60–120s — third aha: this is real.** Hit "save and order" and see a price in soums and a delivery estimate. The user now understands this isn't a sketch tool — it's a manufacturing front-end. This is the activation moment, not the first one.

The reason most CAD-like tools fail the schoolboy test isn't that they're complex — it's that **the first 30 seconds produce no visible artifact**. The user pays an attention cost and gets nothing back. Your subtractive-design principle (start with an 80% kitchen) is exactly right; what matters is enforcing it ruthlessly. No splash screen. No "let's get started" wizard. No empty state. Length of wall → kitchen.

## 4. How configurators make spec choices feel like play

The good configurators (Nike By You, Tesla, mechanical keyboard builders like KBDFans/Drop, Fender Mod Shop) share four mechanics that turn specification into play:

**Mechanic 1: Every choice changes the product visibly.** This sounds obvious, but most B2B configurators violate it constantly — they ask you to pick a SKU, a hardware revision, a "compliance package," and none of it changes what you see. In Nike By You, every single tap repaints a part of the shoe. In Tesla, changing wheels doesn't just update a spec sheet — the 3D model swaps wheels. **If a choice doesn't change the picture, it doesn't belong in the configurator.** This is your bucket-(a)-only rule operationalized.

**Mechanic 2: Choices are sequenced spatially, not categorically.** A bad configurator has tabs: _Materials | Hardware | Finish | Accessories_. A great one walks you around the object. Nike By You highlights the part of the shoe you're customizing — toe box, then heel, then laces, then sole. The camera rotates to show you what you're working on. The user thinks "I'm decorating this shoe," not "I'm filling out a form." For your kitchen tool: don't have a "select cabinet finish" tab. Tap the cabinet, _then_ the finish options appear, _spatially anchored_ to that cabinet.

**Mechanic 3: Constraints are invisible until violated.** Mechanical keyboard builders let you mix and match parts, and only block invalid combos at the last second with a quiet warning. They never gray things out preemptively. The result: the user explores freely and only learns the rules when they bump into one. For your kitchen: don't disable a cabinet width that won't fit the wall. Let them drag it. When it collides, snap to the max valid width with a soft haptic. The constraint is taught by experience, not by documentation.

**Mechanic 4: A "summary" view that feels like a trophy.** Every great configurator ends in a moment where the user sees their thing rendered beautifully — turntable view, light studio, the works. Nike presents the finished sneaker on a pedestal. Tesla shows the car against a hero background. This isn't vanity — it helps customers make confident purchasing decisions, which is crucial given the financial commitment involved. The hero shot is where the customer commits emotionally to ordering. For your kitchen: when the user is "done," the camera should pull back, lighting should warm up, and they should see their kitchen as a finished thing — not as an editable diagram. _Then_ the order button.

The deeper truth: configurators feel like play because **the cost of trying a change is near zero, and the visual reward is large.** Spec sheets feel like work because the cost is high (you have to understand each field) and the visual reward is nothing.

## Synthesis: applied to the schoolboy test

Bringing this back to your three operating principles:

**Principle 1 — the user only touches what changes the physical outcome.** Stripe, Linear, Arc, and Nike By You all enforce this. Stripe removes every field that doesn't matter for payment. Linear hides every menu behind one keyboard shortcut. Nike never shows you the lacing pattern's manufacturing tolerance. Your enemy is the technically-minded contributor who wants to expose kerf width "for advanced users." There are no advanced users in the schoolboy test. Kerf goes in `conventions.md`. Forever.

**Principle 2 — 2D and 3D are the same model, two cameras.** Figma is the proof. The wireframe, prototype, and dev mode are all the same file. The mode switch is a button at the top, not a save-and-export. Your 2D/3D switch should be a pinch-to-rotate gesture in 2D — past 45° of tilt, the 3D camera takes over. There is no mode. There is only a camera angle.

**Principle 3 — templates are the starting line.** This is the most important and the most underestimated. The configurator examples all start with a default product, not an empty product. The aha doesn't come from filling a blank — it comes from _modifying something that's already alive_. The blank canvas is not a feature. It's the absence of a feature.

**The single highest-leverage interaction in your tool:** the first kromka color change. Make that moment — tap edge, drag color hue, watch every edge in the kitchen repaint at 60fps with the camera held still — the centerpiece of your demo, your onboarding, and your marketing. It is the Figma fill-color moment for kitchens. Everything else can be average if that one moment is great.

---

One thing I held back from doing — I can prototype that kromka color-change moment as an interactive demo right here in the chat (3D scene, edge material binding, sub-100ms repaint with the camera locked), so you can feel the timing curve before deciding what to ship. Say the word.



claude 4.6:

# Mobile-First 3D/2D Editing — Hard Constraints to Solve

Research organized by what each answer actually determines about your architecture.

---

## 1) 3D Engine Selection: What Runs on a $150 Android

This is an infrastructure decision that cannot be undone. Make it correctly once.

### The Core Tradeoff: Library vs. Engine

[3](https://blog.logrocket.com/three-js-vs-babylon-js/) Three.js focused on being a lightweight WebGL wrapper; Babylon.js went straight for the full-game engine route. That single sentence defines everything else.

|Property|Three.js|Babylon.js|
|---|---|---|
|**Philosophy**|[4](https://javascript.plainenglish.io/babylon-js-vs-three-js-which-should-you-choose-14faef9f7d78?gi=cf52ca1db04d)Low-level library — its core package is minimal, handling only the rendering itself.|[3](https://blog.logrocket.com/three-js-vs-babylon-js/)A complete 3D engine — comes with built-in systems for physics, animations, GUI, and most functionality right out of the box.|
|**Bundle size**|Smaller — bring only what you need|Larger — full engine ships together|
|**Mobile FPS**|[1](https://forum.babylonjs.com/t/how-to-imporve-performance-on-mobile-more-effectively/49593)Same GLTF run on Babylon.js and Three.js on Android/iOS — Three.js is smoother and gets higher FPS.|Slower on first frame — [2](https://forum.babylonjs.com/t/babylonjs-takes-longer-to-render-the-first-frame-on-mobile-compared-to-threejs/41213)rendering a .glb file with ~60 materials shows bad first-frame performance in mobile mode compared with Three.js or PlayCanvas.|
|**Production scene management**|Manual — [4](https://javascript.plainenglish.io/babylon-js-vs-three-js-which-should-you-choose-14faef9f7d78?gi=cf52ca1db04d)gives you full flexibility but also full responsibility; you must decide how to handle state, loaders, updates, and events.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Makes significant use of the CPU for scene management, frustum culling, and sophisticated internal state tracking — adds overhead but results in better predictable frame times when dealing with thousands of objects.|
|**glTF / mesh loading**|Slower, more manual — [7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)requires more manual intervention and configuration for complex glTF extensions and optimization features.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Offers exceptionally robust glTF parsing, including highly-optimized mesh merging and material handling.|
|**Debugging tools**|Limited|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Babylon.js's Inspector offers a live view of the scene graph, material properties, and performance metrics without stopping the render loop — this feature alone drastically cuts down debugging time.|
|**WebGPU readiness**|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Relies on its community to adapt its minimalist approach to WebGPU, often requiring foundational changes.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Was one of the first engines to provide a working, feature-complete WebGPU backend, designed to mirror its existing WebGL API structure — a major advantage for future-proofing.|

### The Verdict for Your Specific Case

Your kitchen has a **bounded, low-complexity scene**: 20–60 box meshes (cabinet panels), a few materials (wood grain, white lacquer, chrome), and no physics. This is exactly where Three.js wins:

- **Lower baseline memory** → survives on 2GB RAM devices (Redmi 9, Samsung A05)
- **Higher FPS on simple scenes** → raw render performance beats Babylon.js at low poly counts
- **Smaller initial bundle** → critical for Uzbekistan mobile data costs
- [8](https://rahijamil.medium.com/comparing-three-js-and-babylon-js-which-javascript-3d-library-is-right-for-you-7196ef21949e) Three.js is probably the best choice for simpler applications — and a grid of box meshes is a simple application

**Where you'd switch to Babylon.js**: if you add real-time AR (fitting the kitchen into a phone camera view), or if you need the built-in scene management for >1000 objects. Neither applies to you now.

### Flutter 3D / Unity WebGL — Why to Avoid Both

|Engine|Problem for You|
|---|---|
|**Flutter 3D**|No mature 3D scene graph. Flutter's rendering is 2D-first; 3D is bolted on via platform channels. No production kitchen app uses it.|
|**Unity WebGL**|Bundle size is prohibitive for mobile web — typically 20–50MB before your assets. Load time alone fails the schoolboy test on a 10Mbps connection.|

**Recommendation: Three.js with drei (React Three Fiber)** if your app is web/PWA, or **Three.js direct** if native Android. Keep the scene to box geometries + a single PBR material per surface type.

---

## 2) Camera Rotate vs. Object Rotate — The Hardest Confusion in Mobile 3D

This is arguably the most common source of user disorientation in 3D apps. Here's how the best tools solve it.

### The Core Problem: Two Things Can Spin

The user's mental model is: _I am moving around the kitchen_. But in code, you can either:

- **Move the camera** (world stays still, camera orbits) — correct mental model
- **Rotate the object** (camera stays still, kitchen spins) — feels wrong, disorienting

The best apps always pick **one** and never expose the ambiguity.

### How Nomad Sculpt Solves It (The Clearest Pattern)

Nomad's solution is elegant: **what your finger touches determines what moves.**

- [10](https://nomadsculpt.com/manual/camera) You rotate the camera by dragging one finger on the background. If you drag the finger on your model, it will instead start the sculpting operation.
- [10](https://nomadsculpt.com/manual/camera) You can put two fingers on the screen — as if you wanted to start a pan/zoom gesture — and then release one finger to rotate the camera even when the model fills the whole screen.
- [10](https://nomadsculpt.com/manual/camera) By moving two fingers, you can pan the camera. By using the pinch gesture you can zoom in/out. You can roll the view by rotating two fingers.

**The pivot point system** is the other half of Nomad's solution:

- [10](https://nomadsculpt.com/manual/camera) When you rotate the camera you can see a small pink dot — this is your camera pivot point. It's very important to understand where your pivot is so that you don't get lost or frustrated by the camera.
- [10](https://nomadsculpt.com/manual/camera) Double tap on the model to focus the picked point. If you double tap in the background, the camera will focus on the selected mesh instead.

### How Shapr3D Solves It (CAD-Style)

Shapr3D uses the **orientation cube** pattern instead of free gesture:

- [18](https://support.shapr3d.com/hc/en-us/articles/13079128172956-Control-the-view-of-your-modeling-environment) One of the most powerful parts of the interface is the orientation cube in the upper right-hand corner. You can click on individual faces to get orthographic views, and use the arrows to rotate the view.
- [18](https://support.shapr3d.com/hc/en-us/articles/13079128172956-Control-the-view-of-your-modeling-environment) On a touch screen, you can use one finger to rotate.
- [15](https://support.shapr3d.com/hc/en-us/articles/7873944390812-Views-and-Appearance) The "Rotate View" control rotates the camera view in fixed angle increments — preventing the disorientation of free rotation.

**Shapr3D's key insight**: for engineering/CAD users, _snapping to preset views_ (front, top, isometric) is safer than free-rotate. Users jump between canonical views rather than spinning freely.

### The Turntable vs. Trackball Problem

This is a real fork in your design:

|Mode|How it works|Good for|Bad for|
|---|---|---|---|
|**Turntable** (Nomad default)|[10](https://nomadsculpt.com/manual/camera)Camera uses only two degrees of freedom — more intuitive but less flexible.|Your kitchen — you never need to look at it upside down|Inspecting underside of objects|
|**Trackball**|[10](https://nomadsculpt.com/manual/camera)Lets you roll the view by rotating two fingers on the viewport.|Sculptors, freeform 3D|Confusing for non-3D users — kitchen can end up tilted 45° with no way back|
|**Constrained orbit** (Fusion/Onshape preferred)|Rotation locked to vertical axis — [29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate)rotation around an object doesn't cause it to tilt side to side — fixed to a vertical axis.|✅ Kitchen design — room is always upright||

### The "Object Flies Off Screen" Problem

[29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate) In Onshape, the focus fulcrum is at the center of a previous selection or mouse-over — not at the object — so the object is always flying off the screen. This is the most common complaint in 3D camera controls and must be avoided.

**Fix**: Always orbit around the **bounding box center of the selected cabinet**, not the world origin. When nothing is selected, orbit around the kitchen's center.

### Recommended Gesture Map for Your App

|Gesture|Action|Mental model|
|---|---|---|
|**1-finger drag on background**|Orbit camera (turntable)|"I'm walking around the kitchen"|
|**1-finger drag on cabinet**|Select / activate that cabinet|"I'm touching that unit"|
|**2-finger pinch**|Zoom in/out|Standard|
|**2-finger drag**|Pan camera|"I'm sliding sideways"|
|**Double tap on cabinet**|Focus orbit pivot on that cabinet|"Look at this one"|
|**Double tap on background**|Reset to full kitchen view|"Show me everything"|
|**Tap orientation cube face**|Snap to canonical view (front/top/iso)|"Look straight at it"|

**Never expose a "rotate object" control.** The camera always moves. The kitchen always stays still.

---

## 3) Minimum Viable 3D: The Trust Threshold

Your real question here is: **at which rendering quality does a customer in Tashkent say "yes, that's going to be my kitchen" and approve the quote?**

### The Four Levels — And Where Trust Kicks In

|Level|What it looks like|Customer reaction|GPU cost|
|---|---|---|---|
|**Wireframe**|Lines only, no surfaces|"Is this a blueprint?" — no spatial understanding|Near zero|
|**Flat-shaded**|Solid colors, no lighting|Understands shapes and layout — but "looks like a toy"|Very low|
|**Flat + ambient occlusion**|Soft shadows in corners|"OK I can see the depth" — functional trust begins here|Low-medium|
|**Textured (diffuse only)**|Wood grain, white lacquer, visible door handles|✅ **Trust threshold** — [21](https://arktek3d.com/blog/3d-visualization-for-restaurant-interiors-everything-a-designer-needs-to-know/)"using real textures in your renders creates trust — clients can clearly visualize upholstery, countertops, wood grains, and wall finishes."|Medium|
|**PBR / ray-traced**|Reflective surfaces, caustics, photorealistic|"Wow" — but overkill for quote approval|High → impossible on $150 Android|

### Why Textures Are the Threshold, Not Photoreal

[22](https://www.cadcrowd.com/blog/why-3d-rendering-is-essential-to-modern-kitchen-design-services-with-3d-visualization-firms/) A standard 2D floor plan does not adequately reflect the depth, texture, and illumination of a room. With 3D rendering, designers can show clients precisely how their kitchen will look on every side, down to the hue and feel of the countertops.

The key word is **hue and feel** — not photorealism. Customers need to answer two questions:

1. _Does this fit in my space?_ → Answered by **correct proportions + flat-shaded 3D**
2. _Do I like how it will look?_ → Answered by **diffuse textures (wood color, door style)**

[25](https://www.2020kitchendesign.com/how-3d-rendering-helps-kitchen-design/) Interactive 3D models allow clients to test different materials and layouts while evaluating multiple styles in real time. That "test different materials" moment — swapping oak grain for white lacquer — is worth more than photorealism.

### The "Recognizable Enough" Spec for Your App

For your schoolboy test — a customer in Uzbekistan approving a kitchen quote on a $150 phone — you need:

|Feature|Yes/No|Reason|
|---|---|---|
|**Correct box proportions**|✅ Required|Without this, spatial trust fails|
|**Diffuse wood/lacquer texture per panel**|✅ Required|This is the trust threshold|
|**Door style silhouette** (flat panel vs. shaker vs. glass)|✅ Required|Second-biggest visual differentiator|
|**Ambient occlusion (baked, not real-time)**|✅ Nice|Cheap depth cue — pre-bake it|
|**Real-time shadows**|❌ Skip|GPU cost too high on low-end Android|
|**Reflections**|❌ Skip|Unnecessary for quote approval|
|**Ray-tracing / PBR**|❌ Skip|Impossible on $150 devices at 60fps|
|**Handles / hardware detail**|⚠️ Optional|Swap between "no handle", "bar handle", "knob" silhouette sprites — no 3D mesh needed|

**The target visual**: Flat-shaded boxes with a 512×512 tiled diffuse texture (oak, white, grey, walnut) + baked AO + correct proportions. This is achievable at 60fps on a Snapdragon 460. Anything above this is polish for a future version.

**Texture atlas strategy**: 4 materials × 1 texture = one draw call for the whole kitchen. Critical for low-end Android.

---

## 4) 2D/3D Mode Switching: What the Best Tools Do and Where They Fail

### Fusion 360's Insight: There Is No Switch

This is the most important finding for your architecture:

[27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582) There is no difference between a 2D and 3D sketch in Fusion — all sketches are inherently 3D, but by default, all geometry will be created on the sketch plane.

Fusion's model: [27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582)take a 2D sketch, extrude it — which then automatically shifts the view from the 2D sketch view into the 3D view. The "switch" is not a mode change — it's a **camera position change triggered by the operation**.

[32](https://productdesignonline.com/fusion-360-tutorials/introduction-to-3d-sketching-in-fusion-360/) In a 2D sketch, geometry is constrained to the plane used to create the sketch. A 2D sketch plane can originate anywhere in 3D space — however, the selected plane restricts sketch geometry to that plane.

**The architectural implication**: Your app should store one model. The 2D view is just the camera looking straight down (orthographic, top view). The 3D view is the same camera pulled back and tilted to isometric. Same data. Same panels. Two camera presets.

### What Breaks During the Switch (The Hard Problems)

#### Problem 1: Gesture Remapping Confusion

Every 3D app has this problem — gestures mean different things in 2D vs. 3D:

|Gesture|In 2D (floor plan)|In 3D|
|---|---|---|
|1-finger drag|Pan the floor plan|Orbit the camera — **if same gesture, very jarring**|
|Pinch|Zoom|Zoom (same — OK)|
|2-finger drag|Pan|Pan (same — OK)|
|1-finger tap|Select panel|Select panel (same — OK)|

**Fix**: In 2D mode, disable orbit entirely. 1-finger drag = pan. The camera cannot leave the top-down plane. This removes all gesture ambiguity.

#### Problem 2: The "Object Flies Off Screen" on Switch

The camera transition from 2D to 3D must:

1. Animate from `(x, y, z_far, looking_down)` to `(x_iso, y_iso, z_iso, looking_at_center)`
2. Keep the **same focal point** — the center of the kitchen bounding box
3. Maintain the **same selection state** — if panel 3 was selected in 2D, it's still selected in 3D

This is what Onshape fails at: [29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate)the focus fulcrum rotates about some random point or origin, so the object is always flying off the screen.

**Implementation**: Store `kitchen.boundingBoxCenter` as the persistent orbit target. All camera transitions animate toward this point. Never reset to world origin.

#### Problem 3: What Onshape Gets Right — Constrained Rotation Preference

[29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate) You can go to preferences, scroll down to mouse controls, and check the "Set default rotation behaviour to constrained rotate" box — this is a *user-settable* preference in Onshape. The lesson: **some users want free trackball, some want constrained turntable**. For your schoolboy, constrained is always correct. Make it the only option.

### Recommended 2D/3D Switch for Your App

|Property|Implementation|
|---|---|
|**Trigger**|Single button tap (or two-finger double-tap) — not a hidden mode|
|**Transition**|400ms animated camera move — spring curve, same focal point|
|**2D camera**|Orthographic, top-down, locked to XZ plane, no orbit|
|**3D camera**|Perspective, isometric starting angle, turntable orbit|
|**Gesture set**|Remaps silently on transition — user never sees a settings change|
|**Selection**|Preserved through switch — selected panel stays highlighted|
|**Dimensions**|Live mm overlay present in both modes|
|**What changes**|Camera position + FOV + gesture bindings only. Model data: unchanged.|

**Visual cue on the button**: Show a small floor plan icon (2D) or a cube icon (3D). Don't label it "mode" — label it with what you'll see, not what you're doing.

---

## Synthesis: The Schoolboy Test Scorecard

|Hard constraint|Decision|Rationale|
|---|---|---|
|**Engine**|Three.js|[1](https://forum.babylonjs.com/t/how-to-imporve-performance-on-mobile-more-effectively/49593)Three.js is smoother and gets higher FPS on low-end Android; simpler scenes don't need Babylon's overhead|
|**Camera paradigm**|Always move camera, never rotate object|Matches "I'm walking around my kitchen" mental model|
|**Rotation mode**|Constrained turntable (vertical axis locked)|Onshape's free trackball is confusing; Nomad's turntable default is right|
|**Pivot point**|Bounding box center of selected cabinet|Prevents "object flies off screen"|
|**Render quality**|Flat-shaded + diffuse texture (512px) + baked AO|[21](https://arktek3d.com/blog/3d-visualization-for-restaurant-interiors-everything-a-designer-needs-to-know/)Using real textures creates trust — textures are the threshold, not photoreal|
|**2D/3D**|One model, two camera presets|[27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582)All geometry is inherently 3D — the "switch" is just a camera move|
|**2D gesture**|1-finger = pan only (no orbit)|Removes gesture ambiguity entirely|
|**Switch transition**|400ms spring animation, same focal point|Prevents disorientation|

The single biggest mistake you can make in this section: **treating 2D and 3D as different data models**. Fusion's insight — everything is 3D, the plane is just a constraint — is the correct architecture. Build it once.



---


gpt 5.2:



## TL;DR (what this unlocks)

For a **mobile-first kitchen designer**, the “hard constraints” aren’t about fancy rendering—they’re about **load time, memory, and interaction clarity**:

- On low-end Android phones, you win by shipping **small assets** (glTF + compressed textures) and keeping **draw calls low** (mobile WebGL is draw-call-sensitive). [1](https://www.khronos.org/gltf)
- **Unity WebGL is structurally a bad fit for cheap phones** (Unity explicitly says WebGL doesn’t support mobile and warns about memory/power limits). [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
- “Rotate camera vs rotate object” becomes unconfusing when the app makes it **impossible to do both with the same gesture**: background drag = camera, gizmo/tool = object. Nomad + Shapr3D are basically case studies in this separation. [3](https://nomadsculpt.com/manual/camera)
- Minimum viable 3D for a quote is usually **“shape + scale + materials, no surprises”**. Texture realism helps, but _lighting cues_ (contact shadows + coherent lighting) do more for spatial trust than ray tracing. [4](https://www.mdpi.com/2313-433X/12/3/113)
- Best 2D/3D switching is not “two apps”—it’s **one selection + one tool state**, with the camera doing a smart transition (SketchUp camera projection; Onshape/Fusion sketch modes that “look at” the plane). [5](https://help.sketchup.com/article/3000106)

---

# F1) 3D engines on low-end Android (~$150 phones): performance ceiling + bundle size

## The key constraint: your “engine” choice is really (A) delivery model + (B) memory model

On cheap phones in Uzbekistan, you’re usually fighting:

- **network + cache** (first load must be small and resilient),
- **RAM / GPU memory** (textures dominate),
- and **driver overhead** (draw calls kill you faster than triangles on mobile WebGL). [6](https://wonderlandengine.com/about/webgl-performance/)

That means “engine performance” is often less about raw shader speed and more about:

- **how well you can constrain assets** (glTF + KTX2),
- **how modular the engine is** (tree-shaking),
- and whether you’re running **native** vs **browser**. [1](https://www.khronos.org/gltf)

---

## Comparison table (practical, not ideological)

|Option|Where it runs|Bundle / download reality|Performance ceiling on low-end Android|When it’s the right choice|
|---|---|---|---|---|
|**Three.js**|Mobile browser (WebGL)|`three.module.min.js` is ~**340KB** (raw) on unpkg/jsDelivr; Bundlephobia-style “min+gzip” is often quoted ~**168KB** for v0.175.0 (varies by build). [7](https://app.unpkg.com/three%400.180.0/files/build)|High enough for “cabinet-grade 3D” if you keep **draw calls low** and assets optimized. Your ceiling is mostly **assets + batching**, not the engine. [6](https://wonderlandengine.com/about/webgl-performance/)|Best fit for **PWA / web-first** kitchen design with tight initial load.|
|**Babylon.js (UMD “babylonjs” package)**|Mobile browser (WebGL)|The UMD file `babylon.js` is **very large** (e.g., **8.28MB** listed on unpkg for 9.7.0). This is before gzip/brotli and before you add assets. [8](https://app.unpkg.com/babylonjs%409.7.0)|Can run well, but you pay in **download + parse + memory** unless you go modular.|If you want an “engine-y” web stack (more built-in systems) and can accept more weight.|
|**Babylon.js (modular `@babylonjs/core`)**|Mobile browser (WebGL)|Can be much smaller with selective imports. A thesis experiment reports reducing Babylon from multi‑MB to **~962KB** by using core + selected modules. [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)|Similar rendering ceiling to Three.js for simple scenes; memory can differ. That same thesis measured **no FPS difference** in a minimal scene but **~46% higher memory use** for Babylon vs Three. (Small test; still a useful warning.) [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)|If you _need_ Babylon features but will be disciplined about modular imports + assets.|
|**Unity WebGL**|Mobile browser (WebAssembly + WebGL)|Build outputs are typically **WASM + data**; even “small” projects become multi‑MB, and Unity’s own docs frame mobile browser as problematic. Unity explicitly says WebGL **doesn’t support mobile devices** and shows a **warning** on mobile browsers. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)|On low-end phones, the ceiling is often “it loads at all.” Unity explains browser heap allocation/memory variability; mobile browsers are the worst case. [10](https://docs.unity3d.com/es/2018.3/Manual/webgl-memory.html)|Usually the wrong pick for a phone-first CAD-like editor. If you want Unity, ship **native**, not WebGL. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)|
|**Flutter “3D” (realistically: Flutter UI + embedded 3D)**|Native app|Flutter’s own FAQ: it **doesn’t support 3D using OpenGL ES or similar** directly. But plugins exist that embed native engines (e.g. Filament on Android, SceneKit on iOS) for glTF. [11](https://docs.flutter.dev/resources/faq?li_fat_id=7c88346a-6420-4c1c-8a85-bc6ecf31e693)|Native rendering (Filament/SceneKit) usually beats mobile WebGL for stability and power efficiency. Tradeoff is app install/update friction.|Best if you want **offline**, better perf, and “feels like a real app” on cheap Android.|

### Two non-obvious takeaways

1. **Unity WebGL is “anti-schoolboy” on cheap phones** because the kid’s first experience is often _waiting_ or _crashing_—and Unity itself basically warns you this will happen on mobile browsers. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
2. **Three.js is “small by default.” Babylon is “big unless disciplined.”** Even a lightweight academic comparison found Babylon needed care to get down near 1MB, while Three was tiny in their setup. [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)

---

## The real performance ceiling lever: asset pipeline (glTF + compressed textures)

If you want low-end phones to feel “instant,” treat geometry + textures like product, not output.

- Khronos positions **glTF** as designed for **efficient transmission/loading** and minimizing runtime processing (often described as “JPEG of 3D”). [1](https://www.khronos.org/gltf)
- Texture payload dominates. Khronos’ KTX guidance and the `KHR_texture_basisu` ecosystem are explicitly about reducing **download size** and **GPU memory**, across diverse devices. [12](https://www.khronos.org/ktx)
- Three.js’ `KTX2Loader` explicitly supports **Basis Universal** textures that can be transcoded to GPU-native formats. [13](https://threejs.org/docs/pages/KTX2Loader.html)

**Translation for your kitchen editor:** you can keep the engine choice flexible if your assets are already “phone-grade.”

---

# F2) “Rotate camera” vs “rotate object” (never confuse the user)

## The core rule: don’t let the same gesture do both

Confusion happens when:

- a drag sometimes orbits the camera,
- sometimes rotates a cabinet,
- and the user can’t tell which mode they’re in.

The best mobile 3D apps solve this by enforcing **gesture zoning + mode separation**:

### Nomad Sculpt: “background drag = camera; tools = object transform”

Nomad’s manual explicitly says you **rotate the camera** by dragging **one finger on the background**. [3](https://nomadsculpt.com/manual/camera)  
Nomad also has a “gesture menu” concept where you can assign finger vs stylus behavior (e.g., finger drag only moves the camera while stylus drag sculpts), and it warns that if the same gesture is chosen for two options, one will be disabled—this is basically “confusion prevention by design.” [14](https://nomadsculpt.com/manual/interface)  
When you want object-level changes, Nomad pushes you into **transform tools / gizmo** world (its tools documentation frames objects as node+vertices with a transform matrix, and provides dedicated gizmo/rotate/scale tools). [15](https://nomadsculpt.com/manual/tools)

**Pattern to steal:** camera navigation is “ambient,” object rotation is “explicit tool.”

---

### Shapr3D: navigation gestures for the view; explicit Transform tools for geometry

Shapr3D’s gesture/shortcut guide separates **Orbit (Rotate camera)** as navigation. [16](https://support.shapr3d.com/hc/en-us/articles/7873906073884-Keyboard-shortcuts-gestures-and-hotkeys)  
For rotating objects, Shapr3D provides a dedicated **Move/Rotate (3D)** tool under the Transform menu. [17](https://support.shapr3d.com/hc/en-us/sections/7768328803228-Transform-menu)

**Pattern to steal:** there is no ambiguity—rotation of parts happens because you invoked a Transform tool.

---

### Polycam: “orbit view” vs “first-person mode” (camera modes, not object modes)

Polycam’s Gamepad Mode article explicitly frames standard viewing as **orbital camera angles** and shows switching between an orbit icon and “gamepad” first-person navigation. [18](https://learn.poly.cam/hc/en-us/articles/29686097072532-How-to-Use-Gamepad-Mode)

Even though Polycam is a viewer more than an editor, it’s a great reference for _teaching the user what kind of camera they’re controlling_ by making the mode visible.

---

## Recommended “schoolboy-proof” scheme for your kitchen editor (mobile)

This is the simplest mapping that tends to stay unconfusing:

1. **One-finger drag on empty space = orbit camera** (3D mode only).
    
    - Copy Nomad’s “background drag rotates camera” clarity. [3](https://nomadsculpt.com/manual/camera)
2. **One-finger drag on selected object = move only** (not rotate).
    
    - Object rotation is _harder to predict_ than translation; don’t make it accidental.
3. **Rotate object only via a visible gizmo / handle**
    
    - Shapr3D/Nomad both push object rotation into explicit tools/gizmos. [17](https://support.shapr3d.com/hc/en-us/sections/7768328803228-Transform-menu)
4. Add an “Oh no I’m lost” camera affordance:
    
    - “Reset view” / “Zoom to fit” / “Look at selection” (common CAD survival moves).

---

# F3) Minimum viable 3D realism for a kitchen quote (recognizable + trustworthy)

## A useful “fidelity ladder” grounded in real tools

Polycam’s Render Mode is a great reference because it’s literally structured as three “truth levels”:

- **Scan (textured)**: described as a “realistic representation… ideal for presentations, client reviews, and final model assessments.” [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)
- **Mesh (wireframe)**: positioned for technical inspection (topology, polygon distribution). [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)
- **Clay (flat shaded)**: removes textures to focus on “shape, proportions… without visual distractions.” [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)

**Key insight:** even a pro capture tool distinguishes “client review mode” (textured) from “shape trust mode” (clay). That suggests your kitchen designer likely needs **both**—but not ray tracing.

---

## What actually makes people believe scale/space (often cheaper than photoreal)

A 2026 review of photorealism cues in architectural scenes notes that adding **plausible cast shadows** and **coherent lighting** can significantly improve viewers’ accuracy in estimating distances and understanding spatial arrangement. [4](https://www.mdpi.com/2313-433X/12/3/113)

So if you have a performance budget, spend it on:

- stable lighting,
- contact shadows / AO-ish grounding,
- and consistent material response  
    before you spend it on high-res textures everywhere.

---

## Trust comes from control + clarity, not just pixels

A study on 3D product presentations and e-shopping trust found effects from **graphical characteristics** (visual quality) and **visual control** (ability to manipulate the view), including interaction effects. [20](https://www.ccsenet.org/journal/index.php/ibr/article/view/35256)

Separately, research on **360° rotatable product images** shows interactivity can raise purchase intention versus static images (with caveats like cognitive load). [21](https://www.sciencedirect.com/science/article/pii/S0969698919310902)

**Translation for kitchens:** letting the customer orbit and inspect the design (and see key dimensions) can do more for “I trust this quote” than photoreal ray tracing.

---

## Photoreal can backfire (especially early)

Architectural Digest reports designers warning that photorealistic renderings too early can create “implied permanence” and make clients push back; sketches can keep collaboration open. [22](https://www.architecturaldigest.com/story/are-photorealistic-renderings-worth-it)

This is relevant to your “schoolboy test”: you want **fast edits** and low fear. Overly finished visuals can psychologically “lock” the design.

---

## A concrete “minimum viable 3D” spec (what I’d ship first)

If your goal is “recognizable enough to trust the quote,” the smallest effective stack tends to be:

**Level 0 (don’t ship as customer view):** wireframe/mesh

- Useful for debug and manufacturing inspection, but feels “technical,” not “my kitchen.” (Matches Polycam’s positioning.) [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)

**Level 1 (minimum):** flat shaded “clay” + crisp edges + grounding shadow

- Customer can read volumes, door gaps, toe-kick, appliance voids.
- Shadow/light cues support depth understanding. [4](https://www.mdpi.com/2313-433X/12/3/113)

**Level 2 (recommended):** simple PBR-ish materials (not photo textures) + a few hero textures

- Color/material mapping for “white melamine vs oak vs matte black,” but keep textures sparse.

**Level 3 (often unnecessary on $150 phones):** full photoreal, heavy textures, ray tracing

- Expensive + raises expectation risk; not required for trust if dimensions and materials are clear. [22](https://www.architecturaldigest.com/story/are-photorealistic-renderings-worth-it)

---

# F4) 2D/3D mode switching: SketchUp vs Onshape vs Fusion 360 (and what to copy)

## The shared idea: switching is mostly camera + constraints, not data

All three treat 2D/3D as:

- the **same model**
- viewed through a different “camera/interaction contract.”

That’s exactly your principle (“two cameras, one model”).

---

## SketchUp: “2D mode” is basically camera projection + standard views

SketchUp’s Camera menu provides default views (top/bottom/left/right/front/back/iso). It also discusses **Parallel Projection** (orthographic) and recommends a standard view with parallel projection for export. [5](https://help.sketchup.com/article/3000106)

**What stays stable:** you’re still selecting geometry in the same model; you’ve just changed how the camera projects it (perspective vs orthographic).  
**What to copy:** the “2D plan view” can simply be **Top + orthographic** with different gesture expectations.

---

## Onshape: “2D” happens inside Sketch mode (plus guardrails to prevent accidental rotation)

Onshape’s View cube provides quick orientation changes (top/front/isometric, etc.). [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)  
The big mobile-first gem: **“If a sketch is open and an entity is selected, the 3D Rotate Lock turns on by default.”** [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)

That’s _exactly_ how you stop the classic phone-CAD failure mode: the kid tries to drag a line endpoint and the whole world rotates.

**What to copy:** auto-lock view rotation while editing 2D constraints, and make unlocking explicit.

---

## Fusion 360: “Edit sketch” is a contextual mode + camera looks at the plane (optionally automatic)

Fusion documentation calls out a “Look At” behavior: it **rotates the camera to look directly at the active sketch plane**. [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)  
Autodesk support content also references a preference: **“Auto look at sketch.”** [25](https://help.autodesk.com/view/fusion360/ENU/?caas=caas%2Fsfdcarticles%2Fsfdcarticles%2FCannot-snap-to-objects-when-sketching-in-Fusion-360.html)

**What to copy:** when entering 2D edit, animate the camera to normal-to-plane (and ideally remember it).

---

## A very usable 2D/3D switch recipe for your app

1. **Selection persists across modes** (same object ID, same highlights).
    
    - (This is a design recommendation; the docs above mainly justify the camera/mode mechanics.)
2. **Switching 3D → 2D**:
    
    - Camera animates to **orthographic normal-to-selected face/plane** (“Look At” behavior). [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)
    - Turn on **rotate lock** automatically while a 2D entity handle is active (Onshape-style). [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)
3. **Switching 2D → 3D**:
    
    - Return to last 3D orbit camera pose (so the user doesn’t feel “teleported”).
    - Keep the same selection and show the 3D affordances.
4. **Gesture remapping should be explicit, not subtle**
    
    - In 2D: prioritize pan/zoom and direct handle drags; de-emphasize orbit.
    - In 3D: orbit/pan/zoom are ambient; transforms are explicit tools.

---

# “Conventions.md” bullets (drop-in constraints)

- Prefer **Three.js** for web-first low-end phones; prefer **Flutter UI + embedded native 3D** if you need offline and smoother perf; avoid **Unity WebGL** for phone-first because Unity explicitly doesn’t support mobile WebGL. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
- Asset pipeline: **glTF + KTX2/Basis** for textures; keep GPU memory low. [1](https://www.khronos.org/gltf)
- Interaction: background drag rotates camera; object rotation only via **gizmo/tool**. [3](https://nomadsculpt.com/manual/camera)
- Mode switch: 2D is a camera + gesture contract; entering 2D auto “look at sketch plane” and lock orbit while editing (Fusion/Onshape pattern). [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)

If you treat these as hard constraints (not “nice to haves”), you end up with an editor that loads fast on cheap Android and never makes the user wonder “what am I rotating right now?”—which is basically the heart of the schoolboy test.




---


claude 4.6:

# G) ONBOARDING & THE FIRST 5 MINUTES

## 1. Your Peer Group Is Not Notion — It's Gig-Economy B2B Apps

The standard "B2B onboarding" literature (Guidde, Rocketlane, Userpilot) is written for SaaS with CSMs, email sequences, and 14-day trials. That's not your world. Your actual peers are apps where trust is near-zero, literacy is mixed, and the user needs to earn money _today_.

The core shared problem: [14](https://omisoft.net/gb/blog/telegram-mini-apps-for-business/)B2B SaaS has a well-documented problem — the onboarding funnel leaks badly. Email sequences go unread. Product tours are skipped. The 'aha moment' — if it exists — is buried behind a registration wall that's abandoned on mobile.

The pattern in gig/driver apps (Glovo, InDrive, Yango Pro) that maps directly to mebelchi:

- **Registration wall is the enemy.** These apps push account creation as late as possible. You prove value first.
- **The first screen is a job, not a form.** InDrive shows the driver a live fare map before signup. Glovo shows earnings potential. The user self-selects by seeing money, not by reading features.
- **Templates/defaults dominate session 1.** The app makes 95% of decisions for the new user in session one. The mebelchi equivalent: open with a pre-built kitchen, not a blank canvas.

**Tactical pattern from gig apps to borrow:** The "complete a full job first, sign up to save it" model is proven. [2](https://www.guidde.com/knowledge-hub/b2b-onboarding-best-practices-2026-guide)90% of customers churn if they don't understand your product's value within one week. The inverse is the unlock: if the user builds a real kitchen _before_ you ask for their phone number, the sign-up rate is radically higher because they have something to lose by not saving it.

---

## 2. Telegram Mini App Onboarding vs. Native: Trust Patterns

This is the single most important structural advantage you have over a native app competitor.

**The core trust mechanism:**

[15](https://xbsoftware.com/blog/telegram-mini-app-development/) One of the strongest advantages of Telegram Mini Apps is frictionless authentication. Using Telegram login authentication, the platform automatically provides verified user data (ID, username, language) without asking for password creation, email confirmation, or filling out long forms. This reduces onboarding friction and improves conversion rates.

For mebelchi, this means: a mebelchi in Tashkent who already uses Telegram does not perceive your app as "another app asking for my number." They perceive it as "a tool inside the thing I already trust." That is a fundamentally different psychological starting point.

**How trust works inside a TMA vs. native:**

[11](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience) Users subconsciously expect specific behavioral patterns within Telegram. If an app looks like a random website, it triggers a "phishing effect." This is particularly critical for projects where connecting a wallet or entering sensitive data is required. Trust is the baseline for conversion, and a non-native look shatters it instantly.

The practical implication: **don't build a generic web app that happens to open in Telegram.** Build something that feels native to Telegram's UI language. This means:

- [11](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience) Using the native `MainButton` instead of custom floating web buttons increases trust and conversion. It feels more secure, especially for transactions.
- [11](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience) Always use Telegram's native `showPopup` or `showAlert` for security-related messaging. These components carry the aesthetic authority of the platform, signaling to the user that the request is being handled through official channels rather than a malicious script.
- [11](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience) Avoiding external redirects for payments or authentication keeps the user within the "walled garden" of Telegram, which is inherently perceived as more secure than the open web.

**The "white screen" perception problem** — specific to TMAs and critical for mebelchi:

[11](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience) In a web environment, users are accustomed to loading bars. In a messenger, any delay is perceived as a technical failure. Technical hygiene — such as the immediate execution of the `ready()` method to prevent UI flickering — is mandatory.

**TMA vs. native in your specific market:**

[17](https://magnetto.com/blog/classic-app-vs-telegram-mini-app) Mini apps perform especially well in regions where Telegram is popular, such as the CIS, Asia, Latin America, and parts of Europe. In these markets, discovery and user onboarding happen organically through bots, channels, and group sharing.

The zero-installation advantage is measurable: [17](https://magnetto.com/blog/classic-app-vs-telegram-mini-app)app fatigue has become a growing challenge. With more than 4 million apps available, users are tired of downloading yet another application for every small task. Global app downloads dropped by 2.3%. Storage limits, sign-ups, and constant updates make people think twice before hitting "install."

---

## 3. "Demo Mode" — The Most Important Onboarding Decision You'll Make

No dedicated research landed on "B2B demo mode + save to convert," but the TMA research directly describes the working pattern:

[14](https://omisoft.net/gb/blog/telegram-mini-apps-for-business/) A TMA deployment for a project management SaaS product flips the broken B2B onboarding entirely. The prospective user taps a link shared by a colleague in a work Telegram group and is immediately inside a live demo environment — pre-populated with realistic sample data, no signup required, authenticated via their existing Telegram account. The time from 'first contact' to 'experiencing core value' collapses from days to seconds.

This is the exact mebelchi pattern: **link shared in a carpenter Telegram group → tap → 80% pre-built kitchen on screen → resize two cabinets → see a 3D render → "sign up to save and generate cut list."**

The "complete job before signup" model has a precedent in software: [21](https://www.kvraudio.com/forum/viewtopic.php?t=533394)any version — demo, partial, or full — can do everything. The difference is the ability to save. You could do a whole project and at the end record the result, then trash the project. After doing that a few times, the user buys a license. (From Bitwig Studio, a DAW — the same psychology applies.)

**Structural design of your demo mode:**

- Session opens with a pre-built 3-room kitchen template (subtractive design — user removes, not builds from scratch).
- All design interactions work fully — resize, swap finishes, generate preview.
- Cut list is generated but blurred/watermarked.
- At the moment the user tries to export or share the cut list, a single-tap Telegram auth fires. They already have a kitchen. They sign up to save it. Conversion happens because the cost of _not_ signing up is the loss of something they built.

**What this solves specifically for mebelchi:** The stated concern is that the mebelchi "won't trust account creation cold." Demo mode eliminates that entirely — account creation is never cold. It happens after the user has already experienced value and has skin in the game.

---

## 4. Onboarding Framework Specifically for Low-Trust, Low-Literacy B2B Users

The standard onboarding phases ([4](https://www.guidde.com/knowledge-hub/b2b-customer-onboarding-best-practices-guide)Welcome and Setup → Initial Configuration → First Value Achievement → Advanced Features → Ongoing Success) need to be radically compressed for your user. In your case:

|Standard Phase|mebelchi equivalent|Target time|
|---|---|---|
|Welcome & Setup|Template on screen|0 seconds|
|Initial Config|Resize 1 cabinet|< 60 seconds|
|First Value Achievement|3D preview of their kitchen|< 3 minutes|
|Sign-up trigger|Export/share cut list|Minute 3-5|

The key data point: [2](https://www.guidde.com/knowledge-hub/b2b-onboarding-best-practices-2026-guide)B2B customers expect ROI within the first 14 days. Best practices ensure customers reach their first win quickly, building confidence and momentum. Companies with dedicated onboarding strategies see 70% faster time-to-value.

For blue-collar B2B, compress "14 days" to "5 minutes." If they haven't seen value in 5 minutes, they're gone.

---

# H) TESTING METHODOLOGY

## 1. Usability Testing with Low-Literacy, Non-English Users

This is an underserved research area but the core principles are well-established.

**Who to recruit and how to structure sessions:**

[26](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6740160/) Conduct in-depth semi-structured interviews with primary care patients — or in your case, active mebelchi. Use open-ended discussions and card sorting tasks to seek input about mobile phones and task completion. The "card sorting" equivalent for mebelchi is: show them physical cabinet door samples and ask them to match to on-screen options. This bridges literacy gaps.

**Design principles that measurably improve performance for low-literacy users:**

[30](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4436041/) Reviews recommend certain design features to increase effort, efficiency, and satisfaction among low-literacy users, including: graphical cues and bigger widgets; language support in text and audio; "back" and "home" buttons; linear navigation with minimal hierarchical structures; and avoidance of non-numeric text input and scrolling menus.

Apply this directly: every input in mebelchi that asks for a number (cabinet width: 600mm) is fine. Every input that asks for text (project name, client name) is a friction point that should be optional or auto-generated.

**Language and modality:**

[27](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8173396/) All messages should be written at a sixth-grade or lower reading level and culturally adapted. For mebelchi in Uzbekistan: all UI copy in Uzbek (Cyrillic and Latin both used), zero English labels on primary actions, icon-first with text as caption not instruction.

**What to measure in sessions:**

- Task completion rate (can they build a standard kitchen without help?)
- Time to first meaningful action (first cabinet resized)
- Error rate (how many times do they tap the wrong thing?)
- Recovery rate (when they make an error, can they recover without help or do they abandon?)
- Verbal confusion indicators (record audio — count "эм...", "нима бу?", "тушунмадим" per session)

---

## 2. The Schoolboy Test — How to Actually Run It

**The north-star question** (from your brief): Can a 14-year-old who's never used CAD build a real, manufacturable kitchen in under 5 minutes on a phone — and then a real CNC cuts the parts without an engineer touching the file?

**How to run it:**

1. Recruit 5 teenagers (14–16), specifically ones who are _not_ children of furniture people — you want zero domain knowledge.
2. Hand them a phone with the app open to a pre-loaded template. Say only: "Make a kitchen for a 3x2.5m room. Here's the room dimensions written on a card."
3. Give no further instructions. Observe and time.
4. Export the file. Send it to a CNC operator. Count how many edits the operator makes before cutting.

**What to measure (the actual metrics):**

- **Time to first cabinet resize** (is the primary action discoverable without instruction?)
- **Time to complete a "shippable" kitchen** (all cabinets placed, dimensions set)
- **CNC edit count** (how many corrections before the file is cut-ready — target: zero)
- **Number of "dead ends"** (screens the user lands on with no clear next action)
- **Abandonment points** (where in the flow do they stop and look up at you?)

**Why 5 teenagers, not 20 mebelchi:** The schoolboy test is not a representative sample — it's a _ceiling test_. If a 14-year-old with no training can complete the job, then a professional mebelchi with domain knowledge definitely can. The reverse is not true. This is a bar, not a study.

---

## 3. Measuring "Fun" in B2B Software

This is the least-researched area in the traditional B2B toolkit. Here's the honest breakdown:

**NPS (Net Promoter Score):**

[39](https://amplitude.com/blog/customer-engagement-metrics-product-teams) NPS shows how loyal your customers are and how satisfied they are with your product and brand. It gives your product team insights into what's working and what needs improvement. To calculate NPS, ask customers: "On a scale of 0 to 10, how likely are you to recommend our product to a friend or colleague?"

**NPS limitations for mebelchi:** NPS is a _lagging_ indicator. It measures satisfaction _after_ repeated use. It tells you nothing about whether the first session was fun. Ask it at day 7 and day 30, not day 1.

**Session Length:**

[36](https://www.oktopost.com/blog/user-engagement-metrics/) Session length is the amount of time that a user spends on your app in a single visit. It's important to track because it can give you insights into how engaged users are with your content. If the average session length is short, it could mean that users are not finding what they're looking for. [39](https://amplitude.com/blog/customer-engagement-metrics-product-teams) The median value for average session duration for B2B companies is 1.3 minutes. If your sessions are meaningfully above that without a support-call explanation, you have engagement. But session length is **ambiguous** for mebelchi — a long session could mean the user is confused, not delighted.

**Better "fun" proxies for your specific product:**

|Metric|What it detects|How to measure|
|---|---|---|
|**Voluntary return rate** (D1, D3, D7)|Intrinsic motivation — did they come back without a push notification?|Cohort retention in analytics|
|**Share rate**|Delight spillover — did they screenshot and send to someone?|Track Telegram share events|
|**Demo-to-project conversion**|Did the demo mode user invest enough to sign up?|Funnel analytics|
|**"First CNC job without calling support"**|True end-to-end success|Support ticket absence|
|**Unsolicited feature requests**|Engagement beyond the task|Telegram bot message analysis|

**The HEART framework** (Google's internal framework for UX quality) maps well here:

[40](https://www.wudpecker.io/blog/user-engagement-scoring-frameworks-for-b2b-saas) Scoring models to use: HEART — Happiness, Engagement, Adoption, Retention, Task Success.

For mebelchi specifically:

- **Happiness** = NPS at day 30 + direct voice recordings during sessions ("did you enjoy using it?")
- **Engagement** = sessions per week + share rate
- **Adoption** = % of features used / total features available (low adoption = too many features shown)
- **Retention** = D7 and D30 return rate
- **Task Success** = CNC job completed without engineer intervention

**The "Time-to-Smile" concept:** This isn't a standard industry metric but it's operationally definable: record screen + face during the first session (with permission). Timestamp every visible smile or laugh. The goal is that the first smile happens before minute 2 — specifically when they see the 3D render of their kitchen for the first time. That moment is your product's emotional core. If it takes until minute 4, you have a pacing problem.

---

## Master Synthesis: What This Means for Mebelchi

| Question                              | Answer                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| What's your onboarding peer group?    | InDrive, Glovo, Yango Pro — not Notion. Value before form.                                                       |
| What does Telegram give you for free? | Frictionless auth, platform trust, zero-install, viral sharing. Don't waste it with a bad first screen.          |
| What does demo mode look like?        | Full kitchen, fully functional, sign-up wall only at export. User signs up to save something they already built. |
| How do you test with mebelchi?        | In-person, Uzbek language, observe don't instruct, measure task completion and error recovery.                   |
| What is the schoolboy test?           | 5 teenagers, no instructions, one rule: build a kitchen. Count minutes and CNC corrections.                      |
| How do you measure fun?               | D7 voluntary return + share rate + Time-to-Smile in session 1. NPS at day 30 as a check.                         |