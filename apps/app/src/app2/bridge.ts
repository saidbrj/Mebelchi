// Bridge: Cabinet (App 1) ↔ kernel Session (App 2).
//
// Converts an App 1 Cabinet into a kernel session (via CUBE + PATTERN commands),
// and reads a kernel session back into Cabinet-patch fields. The UI never does
// arithmetic — this is the only place where App 1 shapes meet kernel shapes.
//
// Pattern follows the `plan()` function from from-corpus.test.ts exactly.

import type { Cabinet } from "../model/cabinet";
import { cabDepth } from "../model/bands";
import { start, run, type Session, type Command } from "./kernel";
import { parts, unitSize, openings, type PartInfo } from "./bench/model";

// ── Cabinet → Kernel ─────────────────────────────────────────────────────────

/**
 * Build a kernel session that represents `cab`'s interior.
 * The session is "live" — the editor can keep running commands on it.
 */
export function cabinetToSession(cab: Cabinet): Session {
  const cmds = planCommands(cab);
  let s = start();
  for (const cmd of cmds) {
    const r = run(s, cmd);
    if (r.result.accepted) s = r.session;
    // If a command is rejected, we continue with what we have.
    // This handles partially-expressible cabinets gracefully.
  }
  return s;
}

/**
 * Determine the number of front door leaves for a cabinet.
 * 0 = no front (open / none); 1 = single leaf; 2 = double doors.
 */
export function doorLeavesFromCab(cab: Cabinet): number {
  // Explicit no-front profile or legacy "Без" (index 3)
  if (cab.front === "none" || cab.door === 3) return 0;
  // Open cabinet without combined doors
  if (cab.fill === "open" && (!cab.combinedDoors || cab.combinedDoors.length === 0)) {
    return 0;
  }
  // Explicit combinedDoors overlays
  if (cab.combinedDoors && cab.combinedDoors.length > 0) {
    return cab.combinedDoors.length;
  }
  // Explicit pair opening
  if (cab.opening === "pair") return 2;
  // Explicit single door opening
  if (cab.opening === "left" || cab.opening === "right" || cab.opening === "top" || cab.opening === "bottom") {
    return 1;
  }
  // Standard rule by width: wide cabinets (>600mm) get 2 doors, others get 1
  return cab.w > 600 ? 2 : 1;
}

/**
 * Translate a Cabinet into kernel commands. Follows the proven recipe from
 * from-corpus.test.ts: CUBE → PATTERN (fronts) → PATTERN (shelves/dividers).
 */
export function planCommands(cab: Cabinet): Command[] {
  const cmds: Command[] = [];
  const d = cabDepth(cab);

  // 1. Create the unit box
  cmds.push({ word: "CUBE", w: cab.w, h: cab.h, d });

  // 2. Front doors (if cabinet has fronts and not open)
  const leaves = doorLeavesFromCab(cab);
  if (leaves > 0) {
    cmds.push({
      word: "PATTERN",
      op: "create",
      space: "U1",
      axis: "x",
      gaps: Array.from({ length: leaves }, () => ({ ratio: 1 })),
      member: null,
      fill: { type: "front", face: "front" },
    });
  }

  // 3. Vertical divider → vertical PATTERN on the root space
  if (cab.div === 1 || (cab.dividerXs && cab.dividerXs.length > 0)) {
    const divCount = cab.dividerXs?.length ?? 1;
    cmds.push({
      word: "PATTERN",
      op: "create",
      space: "S1",
      axis: "x",
      gaps: Array.from({ length: divCount + 1 }, () => ({ ratio: 1 })),
      member: "divider",
    });
  }

  // 4. Shelves → horizontal PATTERN (preserves shelves whether fill is "shelves" or "open")
  const shelfCount = cab.count ?? (cab.shelfYs ? cab.shelfYs.length : 0);
  if (shelfCount > 0 && cab.fill !== "drawers") {
    // Target space: S1 if no divider, or the first sub-space if divider exists
    const space = (cab.div === 1 || (cab.dividerXs && cab.dividerXs.length > 0)) ? "S2" : "S1";

    if (cab.shelfYs && cab.shelfYs.length > 0) {
      // Custom shelf positions — convert normalized fractions to ratio gaps
      const sorted = [...cab.shelfYs].sort((a, b) => a - b);
      const points = [0, ...sorted, 1];
      const gaps = [];
      for (let i = 0; i < points.length - 1; i++) {
        const weight = Math.max(0.01, points[i + 1]! - points[i]!);
        gaps.push({ ratio: Math.round(weight * 1000) });
      }
      cmds.push({
        word: "PATTERN",
        op: "create",
        space,
        axis: "y",
        gaps,
        member: "shelf",
      });
    } else {
      // Even shelves — ratio gaps
      cmds.push({
        word: "PATTERN",
        op: "create",
        space,
        axis: "y",
        gaps: Array.from({ length: shelfCount + 1 }, () => ({ ratio: 1 })),
        member: "shelf",
      });
    }
  }

  // 5. Back panel (groove vs overlay vs none)
  const backMount = cab.backMount ?? (cab.hasBack === false ? "none" : "groove");
  if (backMount === "groove") {
    const setback = cab.grooveSetback ?? 10;
    cmds.push({
      word: "PLACE",
      host: "S1",
      type: "back",
      thickness: 4,
      spans: { x: "full", y: "full" },
      relation: {
        kind: "on",
        plane: { node: "S1", face: "back" },
        side: "inside",
        offset: setback,
      },
    });
  } else if (backMount === "overlay") {
    cmds.push({
      word: "PLACE",
      host: "U1",
      type: "back",
      thickness: 4,
      spans: { x: "full", y: "full" },
      relation: {
        kind: "on",
        plane: { node: "U1", face: "back" },
        side: "outside",
        offset: 0,
      },
    });
  }

  return cmds;
}

// ── Kernel → Cabinet (patch) ─────────────────────────────────────────────────

/**
 * Read the kernel session and produce a minimal Cabinet patch.
 * Only the fields that the kernel can authoritatively change are included.
 */
export function sessionToCabinetPatch(
  session: Session,
  original: Cabinet,
): Partial<Cabinet> {
  const u = unitSize(session);
  const ps = parts(session);

  const shelves = ps.filter((p) => p.type === "shelf");
  const dividers = ps.filter((p) => p.type === "divider");
  const fronts = ps.filter((p) => p.type === "front");

  const patch: Partial<Cabinet> = {};

  // Dimensions (if the user resized the unit in App 2)
  if (u) {
    if (u.w !== original.w) patch.w = u.w;
    if (u.h !== original.h) patch.h = u.h;
  }

  // Shelf count
  patch.count = shelves.length;

  // Divider
  if (dividers.length > 0) {
    patch.div = 1;
    if (u) {
      const unitBox = session.state.evaluation.boxes[
        session.state.graph.order.find(
          (id) => session.state.graph.nodes[id]?.kind === "unit",
        )!
      ]!;
      patch.dividerXs = dividers
        .map((d) => {
          const midX = (d.box.min.x + d.box.max.x) / 2;
          return (midX - unitBox.min.x) / (unitBox.max.x - unitBox.min.x);
        })
        .sort((a, b) => a - b);
    }
  } else if (original.div === 1 || (original.dividerXs && original.dividerXs.length > 0)) {
    patch.div = 0;
    patch.dividerXs = [];
  }

  // Shelf positions (as fractions of the unit height)
  if (shelves.length > 0 && u) {
    const shelfYs = shelves
      .map((s) => {
        const midY = (s.box.min.y + s.box.max.y) / 2;
        const unitMinY = session.state.evaluation.boxes[
          session.state.graph.order.find(
            (id) => session.state.graph.nodes[id]?.kind === "unit",
          )!
        ]!.min.y;
        const unitMaxY = session.state.evaluation.boxes[
          session.state.graph.order.find(
            (id) => session.state.graph.nodes[id]?.kind === "unit",
          )!
        ]!.max.y;
        return (midY - unitMinY) / (unitMaxY - unitMinY);
      })
      .sort((a, b) => a - b);
    patch.shelfYs = shelfYs;
  } else {
    patch.shelfYs = [];
  }

  // Fronts / Doors
  if (fronts.length === 0) {
    patch.front = "none";
    patch.door = 3; // "Без"
    patch.combinedDoors = [];
    patch.layout = undefined;
    if (original.fill === "open") {
      patch.fill = "open";
    }
  } else if (fronts.length === 1) {
    patch.front = original.front === "none" ? "flat" : (original.front ?? "flat");
    patch.door = original.door === 3 ? 0 : (original.door ?? 0);
    patch.combinedDoors = [];
    patch.layout = undefined;
    if (original.fill === "open") patch.fill = "shelves";
    patch.opening = original.opening && original.opening !== "pair" ? original.opening : "left";
  } else if (fronts.length === 2) {
    patch.front = original.front === "none" ? "flat" : (original.front ?? "flat");
    patch.door = original.door === 3 ? 0 : (original.door ?? 0);
    if (original.fill === "open") patch.fill = "shelves";
    patch.combinedDoors = [
      { fx0: 0, fy0: 0, fx1: 0.5, fy1: 1, opening: "left", handle: "right" },
      { fx0: 0.5, fy0: 0, fx1: 1, fy1: 1, opening: "right", handle: "left" },
    ];
    // Custom layout: provide the interior (shelves / dividers) with NO fronts on the cells
    // so buildCells will not draw a solid single door over the module, while buildFront
    // iterates c.combinedDoors to render both opening leaves.
    patch.layout = (dividers.length > 0)
      ? {
          split: "cols",
          children: Array.from({ length: dividers.length + 1 }, () =>
            shelves.length > 0
              ? { split: "rows", children: Array.from({ length: shelves.length + 1 }, () => ({})) }
              : {},
          ),
        }
      : shelves.length > 0
      ? { split: "rows", children: Array.from({ length: shelves.length + 1 }, () => ({})) }
      : {};
  }

  // Back panel
  const back = ps.find((p) => p.type === "back");
  if (!back) {
    patch.backMount = "none";
    patch.hasBack = false;
  } else {
    patch.hasBack = true;
    const backNode = session.state.graph.nodes[back.id];
    if (backNode && backNode.kind === "part" && backNode.position.kind === "plane") {
      if (backNode.position.offset === 0) {
        patch.backMount = "overlay";
      } else {
        patch.backMount = "groove";
        patch.grooveSetback = Math.round(backNode.position.offset / 10);
      }
    } else {
      patch.backMount = original.backMount ?? "groove";
    }
  }

  return patch;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Check what features this cabinet uses that the kernel can't express yet. */
export function unsupportedFeatures(cab: Cabinet): string[] {
  const issues: string[] = [];
  if (cab.fill === "drawers") issues.push("drawers");
  if (cab.appliance && cab.appliance !== "none") issues.push(`appliance:${cab.appliance}`);
  if (cab.corner) issues.push("corner unit");
  return issues;
}

/** Whether the kernel can fully represent this cabinet. */
export function isKernelCompatible(cab: Cabinet): boolean {
  return unsupportedFeatures(cab).length === 0;
}
