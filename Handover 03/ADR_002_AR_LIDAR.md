# ADR-002 — AR, VR & LiDAR Room Scanning (architecture)

**Status:** Proposed
**Author:** Oppoq (with Claude)
**Date:** June 2026
**Extends:** `ADR_001_PLATFORM_AND_3D.md`
**Companion spike:** `UI Exploration/spike-3d.html`

---

## Why this exists

A previous coding agent claimed VR + a LiDAR home scanner were "achievable in ~600 lines of web code that only runs when the user taps a VR button." **That is wrong, and acting on it would burn a sprint.** This ADR records the real architecture so the myth doesn't resurface.

The core fact: **LiDAR room scanning and immersive VR are native-platform capabilities. No JavaScript/web API exposes them on iPhone.** This is true regardless of Expo vs Capacitor — it is an Apple-platform reality, not a framework choice. The web-core + Capacitor decision (ADR-001) does **not** block these features; it just means they are built as **native plugins launched from the web shell**, which is exactly what Capacitor (and Expo) are for.

---

## LiDAR home scanner — native, iOS-Pro-only

- The capability is **Apple RoomPlan** (a Swift API on top of ARKit) using the LiDAR scanner. There is **no web/JS bridge** to it.
- **Build:** a native **Capacitor plugin (Swift wrapping RoomPlan)**. A "Сканировать комнату" button opens a native scanner screen; the scan returns **parametric room data** (walls, windows, doors, dimensions; USD output) to the JS app.
- **Great fit:** RoomPlan's output *is* parametric — it drops almost directly into Phase A ("Define your space"), replacing manual measurement on supported devices.
- **Device limits:** iPhone/iPad **Pro with LiDAR (12 Pro / iOS 16+)** only. **No Android equivalent** (ARCore depth is weaker; no RoomPlan). So scanning is an **iOS-Pro premium feature**; everyone else uses the manual stepper flow (see `v7-journey.html` Phase A). Plan the UX for both.
- **Effort:** bounded and well-documented (first-class Apple API with many samples) — *not* research, but *not* "free web code" either.

## VR / AR — what actually works in 2026

- **Immersive VR (headset):** Safari supports WebXR `immersive-vr` **on Apple Vision Pro** — so a web-core app can serve it there. **iPhone Safari/WKWebView does not support immersive WebXR** — no framework grants headset VR on a phone (Apple limitation).
- **Inline AR on iPhone ("see the kitchen in your room"):** achievable. Either (a) **WebXR inline AR**, which Safari 18+ backs with ARKit (camera passthrough + hit-testing), or (b) a **native ARKit plugin** / **AR Quick Look (USDZ)** for native-quality placement. Option (b) is more robust today.
- **Android AR:** ARCore via a native plugin or WebXR where supported; treat as separate from the iOS RoomPlan path.

## Architecture summary

```
            ┌─────────────── Web core (TypeScript + three.js) ───────────────┐
            │  6-phase flow · parametric constructor · engine · UI            │
            └───────────────▲───────────────────────────▲────────────────────┘
                            │ returns parametric room    │ returns AR session / USDZ
        ┌───────────────────┴──────────┐      ┌──────────┴───────────────────┐
        │ Native plugin: RoomPlan       │      │ Native plugin: ARKit / Quick │
        │ (Swift, iOS-Pro/LiDAR only)   │      │ Look (USDZ) · WebXR on VisionPro│
        └───────────────────────────────┘      └──────────────────────────────┘
```

The web core stays one codebase across platforms; the AR/LiDAR pieces are thin, isolated native plugins invoked on demand and returning data to the web layer.

## Decisions

1. Build LiDAR scanning as a **native RoomPlan Capacitor plugin**; gate it to LiDAR-capable iOS devices; fall back to manual entry elsewhere.
2. Ship "see in room" as **inline AR / AR Quick Look (USDZ)** first; revisit immersive WebXR only for Vision Pro.
3. Treat any "do it all in web JS" estimate for these features as a **red flag** — they require native code.

## Consequences

- Two small Swift surfaces to own (RoomPlan + AR), versus the false expectation of zero.
- Strong payoff: RoomPlan → instant parametric Phase A on Pro iPhones — a real differentiator over manual measurement.
- Feature parity differs by platform; the product must degrade gracefully (manual flow is the universal baseline).

## Next steps

1. After the ADR-001 3D spike passes, prototype the **RoomPlan plugin** in isolation: scan → return JSON room → render in the web constructor.
2. Define the **room JSON schema** (shared with the project schema in ADR-001 next-steps) so a scan and a manual entry produce the same shape.
3. Decide inline-WebXR vs AR Quick Look for "see in room" after a one-day spike of each on a real device.
