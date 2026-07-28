// A frame-budget readout for the 3D — the number every rendering change gets judged against.
//
// Off unless the URL carries `?perf=1`, so it ships with zero cost and zero UI. It reads what the
// renderer itself counted (draw calls, triangles, programs) plus the wall-clock gap between the
// frames we actually DRAW — which is the honest figure for a render-on-demand scene, where a rAF
// tick that renders nothing is free and must not be averaged in.

import type * as THREE from "three";

/** `?perf=1` in the URL. */
export const PERF_HUD =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("perf");

export interface PerfHud {
  /** call immediately AFTER renderer.render() */
  frame(): void;
  dispose(): void;
}

export function attachPerfHud(renderer: THREE.WebGLRenderer, mount: HTMLElement, label = "", note?: () => string): PerfHud | null {
  if (!PERF_HUD) return null;

  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;top:6px;left:6px;z-index:50;padding:5px 8px;border-radius:6px;" +
    "font:11px/1.35 ui-monospace,Menlo,monospace;color:#e8ffe8;background:#0009;pointer-events:none;white-space:pre";
  if (getComputedStyle(mount).position === "static") mount.style.position = "relative";
  mount.appendChild(el);

  // A composer renders several passes per frame, and `renderer.info` resets itself on each one — so
  // the readout showed the last fullscreen quad ("calls 1") instead of the frame. Take the reset over.
  renderer.info.autoReset = false;

  let last = 0;
  let ema = 0; // exponential moving average of the DRAWN-frame interval (ms)
  let worst = 0;
  let painted = 0;
  let shown = 0;
  let calls = 0; // accumulated across the frame's passes, then read below
  let tris = 0;

  const frame = () => {
    const now = performance.now();
    if (last) {
      const dt = now - last;
      // a gap longer than ~half a second means the scene was idle, not slow — don't poison the average
      if (dt < 500) {
        ema = ema ? ema * 0.9 + dt * 0.1 : dt;
        if (painted > 10) worst = Math.max(worst, dt); // skip the first frames (shader compile)
      }
    }
    last = now;
    painted++;
    const r0 = renderer.info.render;
    calls = r0.calls;
    tris = r0.triangles;
    renderer.info.reset(); // we own it now — start the next frame's tally clean

    if (now - shown < 250) return; // repaint the readout 4×/sec, not 60
    shown = now;
    const m = renderer.info.memory;
    el.textContent =
      `${label}${note ? " · " + note() : ""}\n` +
      `${ema ? (1000 / ema).toFixed(0) : "—"} fps   ${ema.toFixed(1)} ms (max ${worst.toFixed(0)})\n` +
      `calls ${calls}   tris ${(tris / 1000).toFixed(1)}k\n` +
      `geom ${m.geometries}   tex ${m.textures}   prog ${renderer.info.programs?.length ?? 0}`;
  };

  return {
    frame,
    dispose: () => {
      renderer.info.autoReset = true;
      el.remove();
    },
  };
}
