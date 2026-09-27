// ПОЛИГОН · P1 — the wall, alone, running on the real engine.
//
// INTERNAL TOOL. Never ships. The customer app is `index.html`, and nothing there imports this.
//
// What changed when T1–T8 landed: this used to mount the app's own ElevationGrid, which draws from
// `model/grid.ts` — the per-band column tracks that DB/48 replaces. It now draws from the new
// engine instead, which is the strangler plan working as designed (`54` §1): the new core grows
// here against real geometry, the app keeps running on the old one, and neither waits for the
// other. Полигон is where the switch gets proven before any customer screen depends on it.
//
// Every state change goes through `apply` — one atomic named transaction, refused whole or
// committed whole. There is no path in this file that edits a Sheet directly.

import { useMemo, useState } from "react";
import type { Sheet } from "./model/sheet";
import { SHOP_PROFILE } from "./model/settings";
import { apply, type Op, type RefusalRecord } from "./model/ops";
import { resolveJunctions } from "./model/junctions";
import { deriveBoards } from "./model/runs";
import { LAWS } from "./laws/registry";
import { seedWall, OPENING } from "./seed";
import { SheetView, type Selection } from "./SheetView";
import { Inspector } from "./Inspector";
import "./poligon.css";

const P = SHOP_PROFILE;

export function PoligonShell() {
  const [sheet, setSheet] = useState<Sheet>(() => seedWall(P));
  const [past, setPast] = useState<Sheet[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [refusals, setRefusals] = useState<RefusalRecord[]>([]);
  const [mode, setMode] = useState<"real" | "wire" | "parts">("real");

  const boards = useMemo(() => {
    const { junctions } = resolveJunctions(sheet, sheet.junctionOverrides ?? []);
    return deriveBoards(sheet, P, junctions);
  }, [sheet]);

  const coverage = useMemo(() => {
    const proven = LAWS.filter((l) => l.status !== "deferred").length;
    return { proven, total: LAWS.length };
  }, []);

  /** the only way this app changes a sheet */
  const run = (op: Op) => {
    const r = apply(sheet, op, P);
    if (r.ok) {
      setPast((p) => [...p, sheet]);
      setSheet(r.sheet);
    } else {
      // L13's corollary: the UI should have asked first, so anything landing here is a UI bug
      setRefusals((log) => [...log, ...r.refusals]);
    }
  };

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setSheet(prev);
    setSelection(null);
  };

  return (
    <div className="pg">
      <header className="pg-bar">
        <div className="pg-brand">
          <span className="pg-dot" aria-hidden />
          ПОЛИГОН
          <span className="pg-sub">внутренний · не для клиента</span>
        </div>

        <div className="pg-readout">
          {OPENING.width} × {OPENING.height} мм
          <span className="pg-sep">·</span>{sheet.lines.length} линий
          <span className="pg-sep">·</span>{boards.length} досок
          <span className="pg-sep">·</span>законов {coverage.proven}/{coverage.total}
        </div>

        <div className="pg-modes" role="group" aria-label="Режим отрисовки">
          {([["real", "Реал"], ["wire", "Линии"], ["parts", "Детали 1:1"]] as const).map(([m, label]) => (
            <button key={m} className={m === mode ? "on" : ""} onClick={() => setMode(m)}>{label}</button>
          ))}
        </div>

        <button className="pg-update" onClick={undo} disabled={past.length === 0}>
          ↶ Отменить{past.length ? ` (${past.length})` : ""}
        </button>
      </header>

      <main className="pg-body">
        <section className="pg-stage">
          <SheetView
            sheet={sheet}
            profile={P}
            selection={selection}
            onSelect={setSelection}
            onOp={run}
            mode={mode}
          />
        </section>

        <Inspector
          sheet={sheet}
          profile={P}
          selection={selection}
          refusals={refusals}
          onOp={run}
        />
      </main>
    </div>
  );
}
