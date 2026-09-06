// WHAT ELSE IS DERIVED FROM «STANDING ON THE FLOOR».
//
// Lifting a floor module (model/bands.ts `isFloating`) shipped with two holes I named and did not
// close: what the wall SHEET does when a module tiled into it is lifted, and what the derivations
// that read «what is standing there» do when the answer changes underneath them.
//
// That second one is the dangerous shape. The фартук, the LED strips and the panels are all derived
// from the floor run every render — none of them was written with a floating base in mind, and none
// of them fails loudly when it meets one. Building the next feature on top of that is how the corner
// LED took four rounds.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabBand } from "../src/model/bands";
import { GEOM } from "../src/model/layout";
import { buildSheet, ensureSheet } from "../src/model/sheet";
import { resolveLayout, type Room } from "../src/model/resolve";
import { splashBands, DEFAULT_SPLASH } from "../src/model/wallPanels";
import { ledStrips, DEFAULT_LED, type LedSpec } from "../src/model/ledStrips";
import type { Pt } from "../src/model/room";

const CEILING = 2700;
const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room: Room = { points: ROOM, waterWall: null, layout: "i", openings: [] };
const STYLE = { carcass: 0x111111, facade: 0x222222, worktop: 0x333333, handle: 0x444444, glassUppers: false };

const base = (x: number, over: Partial<Cabinet> = {}) =>
  mk({ kind: "base", w: 600, h: 720, run: 0, x, ...over });
const upper = (x: number, over: Partial<Cabinet> = {}) =>
  mk({ kind: "upper", w: 600, h: 720, mountY: GEOM.upperBottom, run: 0, x, ...over });

const L = (cabs: Cabinet[]) => resolveLayout(cabs, room);
const ALL_LED: LedSpec = { ...DEFAULT_LED, under: true, plinth: true, cornice: true };

describe("a module tiled into the sheet, lifted", () => {
  // RISK 1. The ⇕ handle was opened to gridded floor modules on the reasoning that the sheet owns a
  // module's COLUMN and not its elevation. That was reasoning, not a test.
  const tiled = () => {
    const built = buildSheet([base(0), base(600), base(1200), upper(0), upper(600)], room, CEILING, 0);
    return { grid: built.grid, cabs: built.cabs };
  };

  it("keeps the module in the sheet — a lifted box is still tiled", () => {
    const { grid, cabs } = tiled();
    const i = cabs.findIndex((c) => c.kind === "base" && c.cell != null);
    expect(i).toBeGreaterThanOrEqual(0);
    const lifted = cabs.map((c, k) => (k === i ? { ...c, mountY: 500 } : c));
    // null = the sheet sees nothing to reconcile, which is itself the right answer: a lift changes
    // an ELEVATION, and the sheet owns columns
    const after = ensureSheet({ 0: grid }, lifted, room, CEILING, 0);
    const same = (after?.cabs ?? lifted).find((c) => c.id === lifted[i].id)!;
    expect(same).toBeTruthy();
    expect(same.cell).toBe(lifted[i].cell); // its COLUMN is untouched — only its elevation moved
  });

  it("does not drop or duplicate anything else in the run", () => {
    const { grid, cabs } = tiled();
    const i = cabs.findIndex((c) => c.kind === "base" && c.cell != null);
    const lifted = cabs.map((c, k) => (k === i ? { ...c, mountY: 500 } : c));
    const out = ensureSheet({ 0: grid }, lifted, room, CEILING, 0)?.cabs ?? lifted;
    expect(out.length).toBe(cabs.length);
    expect(new Set(out.map((c) => c.id)).size).toBe(cabs.length);
  });

  it("keeps the lift itself — the sheet must not reset it on the next reconcile", () => {
    const { grid, cabs } = tiled();
    const i = cabs.findIndex((c) => c.kind === "base" && c.cell != null);
    const lifted = cabs.map((c, k) => (k === i ? { ...c, mountY: 500 } : c));
    const out = ensureSheet({ 0: grid }, lifted, room, CEILING, 0)?.cabs ?? lifted;
    expect(out.find((c) => c.id === cabs[i].id)!.mountY).toBe(500);
  });

  it("still places it on the wall, at the height it was lifted to", () => {
    const cabs = [base(0), base(600, { mountY: 500 }), base(1200)];
    const rc = L(cabs).elevation(0).find((r) => r.cab.mountY === 500);
    expect(rc).toBeTruthy();
    expect(cabBand(rc!.cab).y0).toBe(500);
  });
});

describe("the фартук, when the counter under it is not where it was", () => {
  // RISK 2. The splash is derived from the counter run every render. A lifted base takes its
  // worktop up with it, so the line the panel starts from moves — under THAT stretch only.
  const splash = (cabs: Cabinet[]) => splashBands(L(cabs), 0, DEFAULT_SPLASH, STYLE, CEILING);

  it("starts the panel at the lifted counter, not at the one it left behind", () => {
    const cabs = [base(0), base(600, { mountY: 400 }), base(1200), upper(0), upper(600), upper(1200)];
    // panels come back in WALL space, and a wall-to-wall run reserves the scribe reveal at its
    // start — so the stretch above the lifted box is found by its HEIGHT, not by guessed x
    const raised = splash(cabs).filter((b) => b.y0 > 900);
    expect(raised.length).toBeGreaterThan(0);
    expect(raised[0].y0).toBe(cabBand(cabs[1]).y1); // 400 + 720 + 40
  });

  it("leaves the neighbours' panel exactly where it was", () => {
    const flat = [base(0), base(600), base(1200), upper(0), upper(600), upper(1200)];
    const standing = splash(flat)[0].y0;
    const mixed = [base(0), base(600, { mountY: 400 }), base(1200), upper(0), upper(600), upper(1200)];
    const first = splash(mixed).sort((a, b) => a.x0 - b.x0)[0];
    expect(first.y0).toBe(standing);
  });

  it("draws NO panel where the lifted counter is above the wall units", () => {
    // a box lifted that far has no splash zone left — the band would be inside-out, and a panel of
    // negative height is worse than none
    const cabs = [base(0), base(600, { mountY: 900 }), base(1200), upper(0), upper(600), upper(1200)];
    for (const b of splash(cabs)) expect(b.y1).toBeGreaterThan(b.y0);
  });
});

describe("the LED, when there is no plinth to hide a strip in", () => {
  // A plinth strip lives in the TOE-KICK RECESS. A lifted box has no toe-kick — the strip would
  // hang in the open air under it, lighting the floor from nowhere.
  const strips = (cabs: Cabinet[], zone: string) =>
    ledStrips(L(cabs), ALL_LED).filter((s) => s.zone === zone);

  it("runs no plinth strip under a box that has no plinth", () => {
    const lifted = strips([base(0, { mountY: 500 })], "plinth");
    expect(lifted).toHaveLength(0);
  });

  it("still runs one under the boxes that ARE standing", () => {
    const cabs = [base(0), base(600, { mountY: 500 }), base(1200)];
    // it BREAKS at the lifted box rather than running straight through the gap under it
    const s = strips(cabs, "plinth").sort((a, b) => a.x0 - b.x0);
    expect(s).toHaveLength(2);
    const gapMid = s[0].x1 + (s[1].x0 - s[0].x1) / 2;
    for (const st of s) expect(st.x0 <= gapMid && gapMid <= st.x1).toBe(false);
  });

  it("does not disturb the under-cabinet strip, which hangs off the WALL units", () => {
    const cabs = [base(0, { mountY: 500 }), upper(0)];
    expect(strips(cabs, "under").length).toBe(1);
  });
});
