import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// NEVER let the whole UI pinch-zoom. There are two separate mechanisms to block, and the scene's own
// zoom survives both (OrbitControls / useSvgZoom run their own wheel/touch/pointer handlers regardless):
//
//  1. DESKTOP (Chrome/Edge/Firefox on a Mac trackpad, or Ctrl+scroll): a pinch arrives as a `wheel`
//     event with `ctrlKey` set, and its default action is PAGE zoom. Over the 3D canvas OrbitControls
//     already cancels it, but over the SVG measurement overlay nothing does — so the page zooms. Cancel
//     the default for every ctrl+wheel; plain scroll (no ctrlKey) is untouched, so lists/sheets still scroll.
window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
//  2. iOS Safari ignores the viewport's `user-scalable=no` and drives page pinch-zoom through these
//     `gesture*` events instead. They fire for nothing else, so cancelling them is safe.
const stopGesture = (e: Event) => e.preventDefault();
document.addEventListener("gesturestart", stopGesture, { passive: false });
document.addEventListener("gesturechange", stopGesture, { passive: false });
document.addEventListener("gestureend", stopGesture, { passive: false });

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
