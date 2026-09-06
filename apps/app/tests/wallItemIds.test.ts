// TWO WALL ITEMS MUST NEVER SHARE AN ID.
//
// The bug this pins, reported from the field: copy a socket, drag it, and the PIPE moves with it.
//
// The cause was a bare module-level counter. It restarts at 0 on every page load, while the project
// you just reopened still holds `f1`, `f2`, `f3` — so the next item added or duplicated was handed
// `f1` again. From then on two records answered to one id, and every action maps `e.id === id`, so
// one drag moved both. Cabinets hit this exact bug years earlier and were fixed with a per-session
// tag plus a heal on load; wall items never were.

import { describe, it, expect } from "vitest";
import { wallItemId, dedupeWallItems, type Fitting } from "../src/model/room";

const fit = (id: string, t = 0.5): Fitting => ({ id, category: "electric", wall: 0, t, width: 90, kind: "socket" });

describe("minting an id", () => {
  it("never repeats", () => {
    const ids = new Set(Array.from({ length: 500 }, () => wallItemId("f")));
    expect(ids.size).toBe(500);
  });

  it("carries the prefix it was asked for", () => {
    expect(wallItemId("f").startsWith("f")).toBe(true);
    expect(wallItemId("o").startsWith("o")).toBe(true);
  });

  it("is not a bare counter — THAT is what collided with a reopened project", () => {
    // a plain `f${n}` would be reproducible across a page load; this must not be
    expect(wallItemId("f")).not.toMatch(/^f\d+$/);
  });
});

describe("healing a project already saved with a collision", () => {
  it("regenerates the duplicate and leaves the first alone", () => {
    const before = [fit("f1", 0.1), fit("f2", 0.5), fit("f1", 0.9)];
    const after = dedupeWallItems(before, "f");
    expect(new Set(after.map((f) => f.id)).size).toBe(3);
    expect(after[0].id).toBe("f1");
    expect(after[1].id).toBe("f2");
    expect(after[2].id).not.toBe("f1");
  });

  it("keeps everything else about the item untouched", () => {
    const after = dedupeWallItems([fit("f1", 0.1), fit("f1", 0.9)], "f");
    expect(after[1]).toMatchObject({ category: "electric", wall: 0, t: 0.9, width: 90, kind: "socket" });
  });

  it("returns the SAME array when there is nothing to repair", () => {
    const clean = [fit("f1"), fit("f2")];
    expect(dedupeWallItems(clean, "f")).toBe(clean);
  });

  it("repairs a missing id too", () => {
    const after = dedupeWallItems([{ ...fit("f1"), id: "" }, fit("f1")], "f");
    expect(after[0].id).toBeTruthy();
    expect(after[0].id).not.toBe(after[1].id);
  });
});
