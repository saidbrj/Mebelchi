// The REAL corner-conversion flow, driven through the store exactly as the Constructor does it:
// fill two walls, build their sheets, then turn a corner-most module into a corner (replaceCab) and
// rebuild. This is the path that produced the user's bugs — a red clash, an 840-wide upper standing
// in the end corner zone, and phantom "Верхний 227" slivers — none of which the isolated reanchor
// test could see, because they emerge from reanchor + completeCornerL + the grid rebuild together.
//
// The store pulls in Supabase / sync / canvas at import; those are browser-only and irrelevant here,
// so they're mocked to no-ops.

import { describe, it, expect, vi } from "vitest";

vi.mock("../src/lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("../src/lib/sync", () => ({
  pullProfile: async () => null, pushProfile: async () => {}, pullProjects: async () => null,
  pushProject: async () => {}, deleteProjectCloud: async () => {}, pullSavedCabs: async () => null,
  pushSavedCab: async () => {}, deleteSavedCabCloud: async () => {},
}));
vi.mock("../src/lib/cabThumb", () => ({ captureCabinetThumbnail: async () => null }));
vi.mock("../src/lib/thumbnailCapture", () => ({ captureThumbnail: async () => null }));
vi.mock("../src/lib/handoffExport", () => ({ runExport: async () => ({}) }));

import { useStore } from "../src/store";
import { mk, type Cabinet } from "../src/model/cabinet";
import { planRuns } from "../src/model/runPlan";
import { resolveLayout, wallRows, type Room } from "../src/model/resolve";

const ROOM = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];
const room: Room = { points: ROOM, waterWall: null, layout: "all", openings: [] };

/** fill a run with base+upper pairs up to `upto` mm */
function fill(cabs: Cabinet[], run: number, upto: number) {
  for (let x = 0; x + 600 <= upto; x += 600) {
    cabs.push(mk({ kind: "base", w: 600, h: 720, run, x }));
    cabs.push(mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run, x }));
  }
}

/** Build a two-wall "all" kitchen, open every sheet, convert the module `pick` returns into a corner,
 *  rebuild every sheet, and hand back the resolved layout. */
function convert(pick: (cabs: Cabinet[]) => Cabinet, tpl: Partial<Cabinet>) {
  const cabs: Cabinet[] = [];
  fill(cabs, 0, 3600);
  fill(cabs, 1, 2400);
  useStore.setState({ roomPoints: ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs, grids: {} });
  const runs = planRuns(ROOM, null, "all", [], useStore.getState().cabs).runs;
  const openAll = () => runs.forEach((r, i) => { if (r.kind === "wall") useStore.getState().openSheet(i); });
  openAll();
  const target = pick(useStore.getState().cabs);
  useStore.getState().replaceCab(target.id, tpl);
  openAll();
  const after = useStore.getState().cabs;
  return { after, target, L: resolveLayout(after, room) };
}

const nearestOf = (kind: Cabinet["kind"], run: number, end: "start" | "end") => (cabs: Cabinet[]) =>
  cabs
    .filter((c) => c.kind === kind && (c.run ?? 0) === run && !c.corner)
    .sort((a, b) => (end === "start" ? (a.x ?? 0) - (b.x ?? 0) : (b.x ?? 0) - (a.x ?? 0)))[0];

const diagUpper: Partial<Cabinet> = { kind: "upper", corner: true, cornerShape: "diagonal", fill: "shelves" };
const lBase: Partial<Cabinet> = { kind: "base", corner: true, cornerShape: "l", fill: "shelves" };

/** invariants a clean conversion must hold */
function expectClean(after: Cabinet[], L: ReturnType<typeof resolveLayout>, target: Cabinet) {
  // it ACTUALLY became a corner
  expect(after.find((c) => c.id === target.id)?.corner).toBe(true);
  // nothing red
  expect([...L.clashing]).toEqual([]);
  // no phantom sliver left behind (the "Верхний 227")
  expect(after.filter((c) => !c.corner && (c.w ?? 999) < 260)).toEqual([]);
  // no oversized upper wrongly tiled into a corner zone (the 840-wide upper)
  expect(after.filter((c) => c.kind === "upper" && !c.corner && (c.w ?? 0) > 720)).toEqual([]);
  // both wall rows stay single rows — no split into "2 and 3 rows"
  expect(wallRows(L.elevation(0)).length).toBe(1);
  expect(wallRows(L.elevation(1)).length).toBe(1);
}

describe("turning a corner-most module into a corner stays clean", () => {
  it("upper at the START of the neighbour wall (the reported case)", () => {
    const { after, target, L } = convert(nearestOf("upper", 1, "start"), diagUpper);
    expectClean(after, L, target);
  });

  it("upper at the END of its wall (the end corner zone — used to make an 840 upper)", () => {
    const { after, target, L } = convert(nearestOf("upper", 0, "end"), diagUpper);
    expectClean(after, L, target);
  });

  it("base at the corner", () => {
    const { after, target, L } = convert(nearestOf("base", 1, "start"), lBase);
    expectClean(after, L, target);
  });

  it("converting the reach-filler beside an existing corner is refused, not silently faked", () => {
    // first conversion seats the corner
    const first = convert(nearestOf("upper", 1, "start"), diagUpper);
    expect(first.after.find((c) => c.id === first.target.id)?.corner).toBe(true);
    // now try to convert the module now nearest that same vertex — the seat is taken, so replaceCab
    // must NO-OP (leave it a plain upper). ConfigScreen keys its "Заменено" toast off exactly this.
    const nextTarget = nearestOf("upper", 1, "start")(useStore.getState().cabs);
    const before = useStore.getState().cabs.length;
    useStore.getState().replaceCab(nextTarget.id, diagUpper);
    const stillPlain = useStore.getState().cabs.find((c) => c.id === nextTarget.id);
    expect(stillPlain?.corner).toBeFalsy();
    expect(useStore.getState().cabs.length).toBe(before); // nothing added/removed
  });
});
