# 3D Spike — Capacitor Wrap & On-Device Test Checklist

**Goal:** prove `UI Exploration/spike-3d.html` stays smooth inside a real Capacitor WebView on the **Redmi** (the device that froze in Expo) and an **iPhone**. Half a day. This is the go/no-go gate from `ADR_001_PLATFORM_AND_3D.md`.
**Owner:** brother (frontend)
**Date:** June 2026

---

## 0. What we're actually testing

Desktop Chrome being smooth proves nothing — laptops have big GPUs. The real question is the **low-end phone WebView**. Capacitor runs the app in the system WebView (Android System WebView / WKWebView), which can differ from full Chrome/Safari. So we test inside Capacitor, on real devices.

---

## 1. Prerequisites

- **Node 18+** installed.
- **Android:** Android Studio (for the SDK + device deploy). Redmi with **USB debugging** on (Settings → About → tap build number ×7 → Developer options → USB debugging).
- **iOS:** a **Mac with Xcode**, an Apple ID (a free account is enough to run on your own iPhone for 7 days). iPhone connected via cable, "Trust this computer."

---

## 2. Create the Capacitor shell (≈30 min)

Run in a fresh empty folder:

```bash
mkdir mebelchi-spike && cd mebelchi-spike
npm init -y
npm install @capacitor/core
npm install -D @capacitor/cli

# init — when asked: name "Mebelchi Spike", id "uz.mebelchi.spike", web dir "www"
npx cap init "Mebelchi Spike" uz.mebelchi.spike --web-dir=www
```

Put the spike file in the web dir **as index.html**:

```bash
mkdir www
cp "/path/to/Mebelchi/UI Exploration/spike-3d.html" www/index.html
```

> Note: the spike loads three.js from a CDN, so the device needs Wi-Fi for this test. That's fine for a spike. For the real app you'll bundle three.js for offline.

Add the platforms:

```bash
npm install @capacitor/android
npx cap add android

# iOS only on a Mac:
npm install @capacitor/ios
npx cap add ios

npx cap sync
```

---

## 3. Run on the Redmi (the important one)

```bash
npx cap run android
```

Pick the Redmi when prompted. (Or `npx cap open android` to launch Android Studio, then press Run with the Redmi selected.)

If it won't appear: check the cable is data-capable, USB debugging is on, and accept the "Allow debugging?" prompt on the phone.

---

## 4. Run on the iPhone (Mac only)

```bash
npx cap open ios
```

In Xcode: select your iPhone as the target → Signing & Capabilities → pick your Apple ID team → press Run. Accept the developer-trust prompt on the phone (Settings → General → VPN & Device Management).

---

## 5. On-device test — do this on EACH phone

Run through these in order and watch the HUD (top-left):

1. **Idle 3D:** rotate the cabinet with one finger. ✅ smooth, no stutter.
2. **Edit responsiveness:** tap Ширина ± and Полки ± several times fast. ✅ **"правка" stays green (<16 ms)**; the model updates without freezing.
3. **Stress:** tap **"Стресс ×8"**, then rotate + edit again.
   - ✅ **fps holds ~50–60**
   - ✅ **draw calls stay low** (tens, not hundreds) despite the part count jumping — this confirms instancing works
   - ✅ **edit time still green/amber**, never a freeze
4. **Mode switch:** cycle Реалистичный → Рентген → Линии. ✅ instant, no hitch.
5. **2D⇄3D:** tap "В план (2D)" and back, several times. ✅ smooth camera animation, no jump.

---

## 6. Record the result

Fill this in for each device:

| Device | idle fps | fps @ ×8 | edit ms @ ×8 | draw calls @ ×8 | mode switch | 2D⇄3D | verdict |
|---|---|---|---|---|---|---|---|
| Redmi (model: ____) | | | | | | | |
| iPhone (model: ____) | | | | | | | |

Take a screenshot of the HUD under "Стресс ×8" on each phone for the record.

---

## 7. Decision rule

- **Redmi passes (fps ~50–60, edits green, calls low):** ✅ green-light web-core + Capacitor. Ratify ADR-001 Option B and start the build in ADR-001 order (engine wiring → Supabase sync → 6-phase shell → RoomPlan plugin spike).
- **Redmi stutters even here:** the ceiling is the WebView itself, not your code. Don't build yet — re-test with WebGL2 only / lower DPR, and reconsider native (ADR-001 Option A) for the 3D surface. Better to learn this now than after features.
- **iPhone is a confirm, not the gate** — but note any difference; it's where LiDAR/AR will live.

---

## 8. After a pass — don't build everything at once

Build the riskiest integrations one at a time, each proven before the next:

1. Wire the existing **headless TS engine** into the Capacitor/web shell.
2. **Supabase** auth + project sync using the small-JSON model (ADR-001).
3. Layer the **6-phase flow** on top, using `v7-journey.html` as the reference.
4. Spike the **RoomPlan native plugin** separately (`ADR_002_AR_LIDAR.md`).
