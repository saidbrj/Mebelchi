# START HERE — Building Mebelchi Solo (plain-language checklist)

**For:** Oppoq, building solo with an AI coding tool (Antigravity + Claude Opus 4.8).
**How to use this:** go top to bottom. Do **one milestone at a time**. Each one has a sentence you can paste straight into your AI tool. Don't skip ahead.

---

## 3 golden rules (read once, follow always)

1. **One LEGO piece at a time.** Never ask the AI for the whole app at once. One small piece, then the next.
2. **Test before moving on.** After each piece: run it / click it. Does it work? Only then continue.
3. **Save every win.** When a piece works, save it (commit). That's your "saved game" — you can always go back.

> If the AI makes a mess, don't panic. Say: *"That broke X. Undo your last change and try a smaller version."* Or load your last saved version.

---

## Milestone 0 — Get your tools ready

You need: **Node** (the engine that runs the code), **git** (the save system), and your AI coding tool open.

**Paste to your AI tool:**
> "Check if Node and git are installed on my machine and tell me the versions. If either is missing, give me the exact steps to install it on my computer."

**Done when:** it shows you a Node version and a git version.

---

## Milestone 1 — Make the new clean box and move the Brain in

Your current folder is your messy workshop. We start a clean one for the real app, and move your engine (the Brain) into it.

**Paste to your AI tool:**
> "Create a new project folder called `mebelchi`. Set it up as a pnpm workspace (a monorepo) with two areas: `apps/app` and `packages/engine`. Then copy my existing engine code — the `engine/`, `catalog/`, `tests/`, and `packages/` folders from my old Mebelchi folder — into `packages/engine`, keeping its `package.json` and tests. Set up git in the new folder and make the first commit."

**Done when:** there's a new `mebelchi` folder with `packages/engine` inside, and git has one saved commit.

---

## Milestone 2 — Prove the Brain still works

Before building anything new, make sure the Brain survived the move.

**Paste to your AI tool:**
> "Run the engine's tests (`npm test`) inside `packages/engine` and show me the result. If anything fails, fix the setup so all tests pass — but do not change the engine logic."

**Done when:** all tests pass (green). **Save it** (commit). This is your trustworthy foundation.

---

## Milestone 3 — Write down the data shapes (the contract)

This is the "what a kitchen looks like as data" piece. It's small but everything else leans on it.

**Paste to your AI tool (attach `PRICING_AND_SCHEMA.md`):**
> "Using the schema in this document, create a `packages/schema` package with TypeScript types for `Project`, `Space`, `Module`, `RateTable`, `Bom`, and `Quote`. Just the types, no logic. Make sure it compiles."

**Done when:** it compiles with no errors. **Save it.**

---

## Milestone 4 — Make the price list table

A simple table of what things cost. For now you fill it by hand from eman.uz.

**Paste to your AI tool:**
> "Create one example `RateTable` as a JSON file in `packages/pricing/seed/`, matching the RateTable type. Fill it with placeholder prices in UZS for a few materials, edge banding, common hardware (hinge, drawer slide, dowel, cam), worktop, and delivery. I'll replace the numbers with real eman.uz prices later."

**Done when:** there's a JSON price file. (Later, you type in the real eman.uz numbers.) **Save it.**

---

## Milestone 5 — Build the price calculator

The piece that counts parts and multiplies by the price list, so the price ticks live.

**Paste to your AI tool (attach `PRICING_AND_SCHEMA.md`):**
> "In `packages/pricing`, build two pure functions: `buildBom(project)` that turns a Project into a list of parts using the engine, and `priceProject(project, rateTable)` that returns a grouped `Quote`. Then write a small test that prices one example kitchen and checks the total. Keep both functions pure (no network, no UI)."

**Done when:** the pricing test passes. **Save it.** Now you can compute a kitchen's price anywhere.

---

## Milestone 6 — Build the app screens (the part people see)

The IKEA-style flow + the 3D. You already have the look and the proof it runs.

**Paste to your AI tool (attach `v7-journey.html` and `spike-3d.html`):**
> "In `apps/app`, set up a React + Vite web app wrapped with Capacitor for iOS and Android. Recreate the 6-phase flow from `v7-journey.html` as real React screens, and use the three.js setup from `spike-3d.html` for the live 3D constructor. Connect the price ticker at the top to `priceProject` so it updates on every edit. Build the screens one phase at a time, starting with the quiz."

**Do this phase by phase**, not all six at once. After each phase works, **save it.**

**Done when:** you can walk quiz → space → variants → constructor on your phone, with the price updating live.

---

## Milestone 7 — Login and save (kitchens follow you)

So a kitchen made on your phone shows up on your computer.

**Paste to your AI tool (attach `ADR_001_PLATFORM_AND_3D.md`):**
> "Add Supabase to the app: email login, and save/load Projects as JSON rows tied to the logged-in user, following the sync model in this ADR. Show a simple list of my saved kitchens on a home screen."

**Done when:** you log in, save a kitchen, close the app, reopen it, and your kitchen is still there. **Save it.**

---

## Milestone 8 — Export the cutting files

The button that gives a workshop what it needs.

**Paste to your AI tool:**
> "Add an export step that runs the engine's file generation (DXF and SWJ008 XML) plus a simple PDF cut list, then lets me save or share the files using Capacitor's filesystem and share plugins. Only allow export after the engine's safety checks pass."

**Done when:** you tap Export and get real files you can open/share. **Save it.**

---

## Milestone 9 — (LATER) iPhone room scanner

Save this for last — it needs special native iPhone code (not web).

**When you're ready, paste (attach `ADR_002_AR_LIDAR.md`):**
> "Following this ADR, add a native Capacitor plugin that runs Apple RoomPlan on LiDAR iPhones, and returns the scanned room as our `Space` data. On phones without LiDAR, keep the manual entry flow."

---

## Your progress tracker

- [ ] 0 · Tools ready
- [ ] 1 · New project + Brain moved in
- [ ] 2 · Brain tests pass
- [ ] 3 · Data shapes (schema)
- [ ] 4 · Price list table
- [ ] 5 · Price calculator
- [ ] 6 · App screens (phase by phase)
- [ ] 7 · Login + save
- [ ] 8 · Export files
- [ ] 9 · (Later) iPhone scanner

**Right now, do Milestone 0 and 1.** That's it. One piece at a time.
