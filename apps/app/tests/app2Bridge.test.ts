import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabinetToSession, sessionToCabinetPatch, planCommands, unsupportedFeatures } from "../src/app2/bridge";
import { start, run, cutList } from "../src/app2/kernel";
import { parts } from "../src/app2/bench/model";

describe("App2 Bridge (Smart Object Integration)", () => {
  it("converts a standard cabinet to a kernel session with matching dimensions and shelves", () => {
    const cab = mk({
      kind: "base",
      w: 600,
      h: 720,
      depth: 560,
      fill: "shelves",
      count: 2,
      door: 1,
      handle: 0,
      run: 0,
    });

    const session = cabinetToSession(cab);
    expect(session).toBeDefined();

    const ps = parts(session);
    const shelves = ps.filter((p) => p.type === "shelf");
    expect(shelves.length).toBe(2);
    const fronts = ps.filter((p) => p.type === "front");
    expect(fronts.length).toBe(1); // w=600 default 1 door
  });

  it("handles double doors for wide cabinets (w > 600) and open cabinets", () => {
    const wideCab = mk({
      kind: "base",
      w: 800,
      h: 720,
      depth: 560,
      fill: "shelves",
      count: 2,
      door: 1,
      handle: 0,
      run: 0,
    });
    const wideSession = cabinetToSession(wideCab);
    const wideFronts = parts(wideSession).filter((p) => p.type === "front");
    expect(wideFronts.length).toBe(2);

    const openCab = mk({
      kind: "base",
      w: 600,
      h: 720,
      depth: 560,
      fill: "open",
      count: 2,
      door: 0,
      handle: 0,
      run: 0,
    });
    const openSession = cabinetToSession(openCab);
    const openFronts = parts(openSession).filter((p) => p.type === "front");
    expect(openFronts.length).toBe(0);
  });

  it("applies kernel session modifications back to cabinet patch", () => {
    const original = mk({
      kind: "base",
      w: 600,
      h: 720,
      depth: 560,
      fill: "shelves",
      count: 1,
      door: 1,
      handle: 0,
      run: 0,
    });

    let session = cabinetToSession(original);

    // Add another shelf via PATTERN command in kernel
    const r = run(session, {
      word: "PATTERN",
      op: "create",
      space: "S2",
      axis: "y",
      gaps: [{ ratio: 1 }, { ratio: 1 }],
      member: "shelf",
    });

    if (r.result.accepted) {
      session = r.session;
    }

    const patch = sessionToCabinetPatch(session, original);
    expect(patch.count).toBe(2);
  });

  it("correctly identifies unsupported complex features", () => {
    const regularCab = mk({
      kind: "base",
      w: 600,
      h: 720,
      fill: "shelves",
      count: 1,
      door: 1,
      handle: 0,
      run: 0,
    });
    expect(unsupportedFeatures(regularCab)).toEqual([]);

    const drawerCab = mk({
      kind: "base",
      w: 600,
      h: 720,
      fill: "drawers",
      count: 3,
      door: 1,
      handle: 0,
      run: 0,
    });
    expect(unsupportedFeatures(drawerCab)).toContain("drawers");

    const cornerCab = mk({
      kind: "base",
      corner: true,
      w: 900,
      h: 720,
      fill: "shelves",
      count: 1,
      door: 1,
      handle: 0,
      run: 0,
    });
    expect(unsupportedFeatures(cornerCab)).toContain("corner unit");
  });

  it("handles 'Без фасада' (0 doors) in App 2 without wiping shelves or dividers on re-entry", () => {
    // Cabinet with 2 shelves and 1 divider
    const cabWithDividerAndShelves = mk({
      kind: "base",
      w: 800,
      h: 720,
      fill: "shelves",
      count: 2,
      div: 1,
      dividerXs: [0.5],
      door: 1,
    });

    let session = cabinetToSession(cabWithDividerAndShelves);
    expect(parts(session).filter((p) => p.type === "front").length).toBe(2);
    expect(parts(session).filter((p) => p.type === "shelf").length).toBe(2);
    expect(parts(session).filter((p) => p.type === "divider").length).toBe(1);

    // User chooses "Без фасада" in App 2 (dissolves front pattern)
    const frontPat = Object.keys(session.state.graph.nodes).find((id) => {
      const n = session.state.graph.nodes[id];
      return n?.kind === "pattern" && (n as any).fill?.type === "front";
    });
    expect(frontPat).toBeDefined();

    const dissolveRes = run(session, { word: "PATTERN", op: "dissolve", pattern: frontPat! });
    expect(dissolveRes.result.accepted).toBe(true);
    session = dissolveRes.session;
    expect(parts(session).filter((p) => p.type === "front").length).toBe(0);

    // Apply patch back to App 1
    const patch = sessionToCabinetPatch(session, cabWithDividerAndShelves);
    expect(patch.front).toBe("none");
    expect(patch.door).toBe(3);
    expect(patch.count).toBe(2);
    expect(patch.div).toBe(1);
    expect(patch.fill).not.toBe("open"); // Must NOT be changed to "open" so shelves/dividers stay intact

    const updatedCab = { ...cabWithDividerAndShelves, ...patch };

    // Re-enter App 2 from App 1
    const reenteredSession = cabinetToSession(updatedCab);
    const ps = parts(reenteredSession);

    // Verify: 0 doors, shelves preserved, divider preserved!
    expect(ps.filter((p) => p.type === "front").length).toBe(0);
    expect(ps.filter((p) => p.type === "shelf").length).toBe(2);
    expect(ps.filter((p) => p.type === "divider").length).toBe(1);
  });

  it("handles 2 doors in App 2 translating into combinedDoors and rendering 2 leaves in App 1 and on re-entry", () => {
    // 600mm cabinet (normally defaults to 1 door)
    const cab600 = mk({
      kind: "base",
      w: 600,
      h: 720,
      fill: "shelves",
      count: 1,
      door: 1,
    });

    let session = cabinetToSession(cab600);
    expect(parts(session).filter((p) => p.type === "front").length).toBe(1);

    // In App 2, user switches to 2 doors
    const frontPat = Object.keys(session.state.graph.nodes).find((id) => {
      const n = session.state.graph.nodes[id];
      return n?.kind === "pattern" && (n as any).fill?.type === "front";
    });
    session = run(session, { word: "PATTERN", op: "dissolve", pattern: frontPat! }).session;
    session = run(session, {
      word: "PATTERN",
      op: "create",
      space: "U1",
      axis: "x",
      gaps: [{ ratio: 1 }, { ratio: 1 }],
      member: null,
      fill: { type: "front", face: "front" },
    }).session;

    expect(parts(session).filter((p) => p.type === "front").length).toBe(2);

    // Apply patch back to App 1
    const patch = sessionToCabinetPatch(session, cab600);
    expect(patch.combinedDoors).toHaveLength(2);
    expect(patch.combinedDoors![0]).toMatchObject({ fx0: 0, fx1: 0.5, opening: "left" });
    expect(patch.combinedDoors![1]).toMatchObject({ fx0: 0.5, fx1: 1, opening: "right" });
    // Layout should have NO front on its root/children so buildCells won't draw a single solid door
    expect((patch.layout as any)?.front).toBeUndefined();

    const updatedCab = { ...cab600, ...patch };

    // Re-enter App 2 from App 1
    const reenteredSession = cabinetToSession(updatedCab);
    const reenteredFronts = parts(reenteredSession).filter((p) => p.type === "front");
    expect(reenteredFronts.length).toBe(2);
    const reenteredShelves = parts(reenteredSession).filter((p) => p.type === "shelf");
    expect(reenteredShelves.length).toBe(1);
  });

  it("handles back panel configuration round-trip (groove, overlay, none)", () => {
    // 1. Groove back (default)
    const grooveCab = mk({ kind: "base", w: 600, h: 720, depth: 560, backMount: "groove" });
    const s1 = cabinetToSession(grooveCab);
    const back1 = parts(s1).find((p) => p.type === "back");
    expect(back1).toBeDefined();
    expect(back1?.box.max.z).toBeLessThan(5600); // set back by 10mm (5500 mm10)
    const patch1 = sessionToCabinetPatch(s1, grooveCab);
    expect(patch1.backMount).toBe("groove");
    expect(patch1.hasBack).toBe(true);

    // 2. Overlay back
    const overlayCab = mk({ kind: "base", w: 600, h: 720, depth: 560, backMount: "overlay" });
    const s2 = cabinetToSession(overlayCab);
    const back2 = parts(s2).find((p) => p.type === "back");
    expect(back2).toBeDefined();
    expect(back2?.box.min.z).toBe(5600); // flush with rear edge outside (5600 to 5640 mm10)
    const patch2 = sessionToCabinetPatch(s2, overlayCab);
    expect(patch2.backMount).toBe("overlay");
    expect(patch2.hasBack).toBe(true);

    // 3. No back panel
    const noBackCab = mk({ kind: "base", w: 600, h: 720, depth: 560, backMount: "none" });
    const s3 = cabinetToSession(noBackCab);
    const back3 = parts(s3).find((p) => p.type === "back");
    expect(back3).toBeUndefined();
    const patch3 = sessionToCabinetPatch(s3, noBackCab);
    expect(patch3.backMount).toBe("none");
    expect(patch3.hasBack).toBe(false);

    // 4. Remove back panel in App 2 via REPLACE with: "nothing"
    const s4 = run(s1, { word: "REPLACE", part: back1!.id, with: "nothing" }).session;
    expect(parts(s4).find((p) => p.type === "back")).toBeUndefined();
    const patch4 = sessionToCabinetPatch(s4, grooveCab);
    expect(patch4.backMount).toBe("none");
    expect(patch4.hasBack).toBe(false);

    // 5. Verify Cutlist sheet inclusion and exclusion
    const cl1 = cutList(s1);
    expect(cl1.some((p) => p.role === "back" && p.thicknessMm === 4)).toBe(true);

    const cl2 = cutList(s2);
    expect(cl2.some((p) => p.role === "back" && p.thicknessMm === 4)).toBe(true);

    const cl3 = cutList(s3);
    expect(cl3.some((p) => p.role === "back")).toBe(false);

    const cl4 = cutList(s4);
    expect(cl4.some((p) => p.role === "back")).toBe(false);
  });
});


