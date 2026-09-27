import { createRoot } from "react-dom/client";
import { PoligonShell } from "./PoligonShell";
import "../styles.css";

// ── ПОЛИГОН (poligon.html) ────────────────────────────────────────────────────
// A third standalone page beside index.html (the app) and studio.html (App-2 alone),
// following the same additive rule those follow: everything is IMPORTED from shared
// code, and no existing file is modified. Internal only — never linked from the app.

createRoot(document.getElementById("root")!).render(<PoligonShell />);
