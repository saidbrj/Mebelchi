// drillMarks.ts — Computes 3D hardware drill positions (System 32)
// for cabinet joints, shelves, and door hinges based on kernel joints and parts.

import type { Joint } from "../kernel";
import type { PartInfo } from "./model";

export interface DrillMark {
  id: string;
  type: "confirmat" | "minifix" | "dowel" | "hingeCup" | "hingePlate" | "shelfPin";
  label: string;
  diameter: number; // in mm
  depth: number; // in mm
  x: number; // Three.js coordinate (mm)
  y: number;
  z: number;
  axis: "x" | "y" | "z";
  jointId?: string;
  dir?: { x: number; y: number; z: number };
}

/**
 * Compute fastener drill marks for all carcass joints and door hinges.
 *
 * Coordinate convention:
 * - Kernel boxes are in mm×10 units (e.g., 7200 = 720mm)
 * - Three.js scene uses mm units with Z negated: sceneX = kernelX/10, sceneY = kernelY/10, sceneZ = -kernelZ/10
 * - The joint.axis tells us the contact normal (the axis where gap = 0 for "touch" joints)
 */
export function computeDrillMarks(
  allParts: PartInfo[],
  joints: Joint[],
  doorAngle = 0,
): DrillMark[] {
  const drills: DrillMark[] = [];
  const partMap = new Map(allParts.map((p) => [p.id, p]));

  // 1. Joint fasteners (Confirmat, Minifix, Dowels)
  for (const j of joints) {
    const partA = partMap.get(j.a);
    const partB = partMap.get(j.b);
    if (!partA || !partB) continue;
    // Fronts/doors and back panels are not joined with carcass fasteners
    if (partA.type === "front" || partB.type === "front" || partA.type === "back" || partB.type === "back") continue;

    const bA = partA.box;
    const bB = partB.box;

    const drillAxis = j.axis; // "x", "y", or "z"

    // Find the contact plane position along the drill axis (in mm×10)
    const contactPos10 =
      Math.abs(bA.max[drillAxis] - bB.min[drillAxis]) <
      Math.abs(bB.max[drillAxis] - bA.min[drillAxis])
        ? (bA.max[drillAxis] + bB.min[drillAxis]) / 2
        : (bB.max[drillAxis] + bA.min[drillAxis]) / 2;
    const contactMm = contactPos10 / 10;

    // Determine which panel meets with its FACE (normal === drillAxis)
    // and which panel meets with its EDGE (normal !== drillAxis)
    const facePart = partA.axis === drillAxis ? partA : partB.axis === drillAxis ? partB : partA;
    const edgePart = facePart === partA ? partB : partA;

    // Direction from contact plane into the edgePart (+1 or -1)
    const edgeCenter = (edgePart.box.min[drillAxis] + edgePart.box.max[drillAxis]) / 20;
    const edgeDir = edgeCenter > contactMm ? 1 : -1;

    // Fastener length along drill axis
    const isDowel = j.method.includes("шкант") || j.method.includes("dowel");
    const isMinifix = j.method.includes("eccentric") || j.method.includes("minifix");
    const fastenerLength = isDowel ? 30 : isMinifix ? 34 : 50; // Confirmat 50mm

    // Find center along drillAxis for Confirmat:
    // Starts flush from outer face of the through-panel and extends inwards
    let centerAlongAxis = contactMm;
    const throughPart = j.through === partA.id ? partA : j.through === partB.id ? partB : facePart;

    if (!isDowel && !isMinifix) {
      // Confirmat screw: always driven through the 16mm face panel into the edge panel
      const faceCenter = (facePart.box.min[drillAxis] + facePart.box.max[drillAxis]) / 20;
      const isMinFace = faceCenter < contactMm;
      if (isMinFace) {
        const outerFace = facePart.box.min[drillAxis] / 10;
        centerAlongAxis = outerFace + fastenerLength / 2;
      } else {
        const outerFace = facePart.box.max[drillAxis] / 10;
        centerAlongAxis = outerFace - fastenerLength / 2;
      }
    }

    // The other two axes span the contact area
    const spanAxes = (["x", "y", "z"] as const).filter((a) => a !== drillAxis);
    const ax1 = spanAxes[0]!;
    const ax2 = spanAxes[1]!;

    // Contact area bounds in mm
    const min1 = Math.max(bA.min[ax1], bB.min[ax1]) / 10;
    const max1 = Math.min(bA.max[ax1], bB.max[ax1]) / 10;
    const min2 = Math.max(bA.min[ax2], bB.min[ax2]) / 10;
    const max2 = Math.min(bA.max[ax2], bB.max[ax2]) / 10;

    const span1 = max1 - min1;
    const span2 = max2 - min2;
    if (span1 <= 0 || span2 <= 0) continue;

    // Determine which spanning axis is "long" (to distribute fasteners along)
    const longAxis = span1 >= span2 ? ax1 : ax2;
    const shortAxis = span1 >= span2 ? ax2 : ax1;
    const longMin = span1 >= span2 ? min1 : min2;
    const longMax = span1 >= span2 ? max1 : max2;
    const shortCenter = span1 >= span2 ? (min2 + max2) / 2 : (min1 + max1) / 2;
    const longSpan = longMax - longMin;

    if (longSpan < 60) continue; // too short for fasteners

    // System 32 fastener distribution along the long axis
    // 37mm from front end, 50mm from back end
    const frontOffset = longMin + 37;
    const backOffset = longMax - 50;
    const positions: number[] = [frontOffset, backOffset];
    if (longSpan > 580) {
      positions.push((frontOffset + backOffset) / 2);
    }

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]!;

      const coords: Record<"x" | "y" | "z", number> = { x: 0, y: 0, z: 0 };
      coords[drillAxis] = centerAlongAxis;
      coords[longAxis] = pos;
      coords[shortAxis] = shortCenter;

      // Convert to Three.js: negate Z
      const tx = coords.x;
      const ty = coords.y;
      const tz = -coords.z;

      if (isMinifix) {
        // 1. Minifix connecting pin (Ø8 × 34mm): anchors 10mm in facePart, 24mm in edgePart
        const pinCoords: Record<"x" | "y" | "z", number> = { ...coords };
        pinCoords[drillAxis] = contactMm + edgeDir * 7;

        drills.push({
          id: `drill-${j.id}-pin-${i}`,
          type: "dowel",
          label: "Шток эксцентрика Ø8",
          diameter: 8,
          depth: 34,
          x: pinCoords.x,
          y: pinCoords.y,
          z: -pinCoords.z,
          axis: drillAxis,
          jointId: j.id,
        });

        // 2. Minifix cam (Ø15mm × 12.5mm): inset 34mm from the edge into edgePart
        const camCoords: Record<"x" | "y" | "z", number> = { ...coords };
        camCoords[drillAxis] = contactMm + edgeDir * 34;

        drills.push({
          id: `drill-${j.id}-cam-${i}`,
          type: "minifix",
          label: "Эксцентрик Rastex Ø15",
          diameter: 15,
          depth: 12.5,
          x: camCoords.x,
          y: camCoords.y,
          z: -camCoords.z,
          axis: edgePart.axis,
          jointId: j.id,
        });
      } else if (isDowel) {
        // Wooden dowel: Ø8mm × 30mm centered on contact plane
        drills.push({
          id: `drill-${j.id}-dowel-${i}`,
          type: "dowel",
          label: "Шкант 8×30",
          diameter: 8,
          depth: 30,
          x: tx,
          y: ty,
          z: tz,
          axis: drillAxis,
          jointId: j.id,
        });
      } else {
        // Standard Confirmat 7×50 (Евровинт)
        drills.push({
          id: `drill-${j.id}-confirmat-${i}`,
          type: "confirmat",
          label: "Евровинт 7×50",
          diameter: 7,
          depth: 50,
          x: tx,
          y: ty,
          z: tz,
          axis: drillAxis,
          jointId: j.id,
        });
      }
    }
  }

  // 2. Front door hinges & mounting plates
  const fronts = allParts.filter((p) => p.type === "front").sort((a, b) => a.box.min.x - b.box.min.x);
  for (let i = 0; i < fronts.length; i++) {
    const f = fronts[i]!;
    const b = f.box;
    const minX = b.min.x / 10;
    const maxX = b.max.x / 10;
    const minY = b.min.y / 10;
    const maxY = b.max.y / 10;
    const height = maxY - minY;

    const side: "left" | "right" = fronts.length === 1 ? "left" : i === 0 ? "left" : "right";
    const closedHingeCupX = side === "left" ? minX + 21.5 : maxX - 21.5;

    // Standard hinge heights: 100mm from top and bottom
    const hingeYs = [minY + 100, maxY - 100];
    if (height > 900) {
      hingeYs.push((minY + maxY) / 2);
    }

    // Carcass side panel inner face
    const sidePart = side === "left"
      ? allParts.find((p) => p.type === "side" && p.box.min.x < 100)
      : allParts.find((p) => p.type === "side" && p.box.max.x > 300);
    const innerFaceX = sidePart
      ? (side === "left" ? sidePart.box.max.x / 10 : sidePart.box.min.x / 10)
      : (side === "left" ? 16 : maxX - 16);

    // Three.js door hinge pivot (at carcass front surface z = 0)
    const pivotX = side === "left" ? minX : maxX;
    const pivotZ = 0;
    const effectiveAngle = side === "left" ? -doorAngle : doorAngle;

    for (let hIdx = 0; hIdx < hingeYs.length; hIdx++) {
      const hy = hingeYs[hIdx]!;

      // 2a. Mounting plate on carcass side (System 32: 37mm from front edge, along X axis)
      drills.push({
        id: `door-hinge-plate-${f.id}-${hIdx}`,
        type: "hingePlate",
        label: "Планка петли (отступ 37 мм)",
        diameter: 5,
        depth: 12,
        x: innerFaceX,
        y: hy,
        z: -37,
        axis: "x",
      });

      // 2b. Hinge cup Ø35mm on door:
      // Inner face of door is at z = 0 when closed, cup recessed 6mm into door
      const closedCupZ = 6;
      const dx = closedHingeCupX - pivotX;
      const dz = closedCupZ - pivotZ;

      // Rotate by effectiveAngle around Y axis in Three.js space
      const cos = Math.cos(effectiveAngle);
      const sin = Math.sin(effectiveAngle);
      const rotX = dx * cos + dz * sin;
      const rotZ = -dx * sin + dz * cos;

      const cupX = pivotX + rotX;
      const cupZ = pivotZ + rotZ;

      // Normal to door face after rotation (initially (0, 0, 1))
      const normalX = sin;
      const normalZ = cos;

      drills.push({
        id: `door-hinge-cup-${f.id}-${hIdx}`,
        type: "hingeCup",
        label: "Чашка петли Ø35 (отступ 21.5 мм)",
        diameter: 35,
        depth: 12,
        x: cupX,
        y: hy,
        z: cupZ,
        axis: "z",
        dir: { x: normalX, y: 0, z: normalZ },
      });
    }
  }

  return drills;
}
