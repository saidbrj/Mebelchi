// Floating On-Object Dimension Chips Projection for Three.js CAD Canvas
// Projects 3D world dimension anchors onto 2D screen coordinates.

import * as THREE from "three";
import type { Evaluated, Design } from "../poligon/model/space";

export interface DimensionChipDef {
  id: string;
  axis: "x" | "y" | "z";
  label: string;
  valueMm: number;
  worldPos: THREE.Vector3;
  screenPos?: { x: number; y: number; visible: boolean };
}

/**
 * Computes on-cabinet 3D anchor points for Width (↔), Height (↕), and Depth (↗).
 */
export function computeDimensionChips(
  evaluated: Evaluated,
  design: Design,
): DimensionChipDef[] {
  const chips: DimensionChipDef[] = [];

  // Cabinet slot and body bounds in mm
  const slot = evaluated.slotBox;
  const cxMm = (slot.x[0] + slot.x[1]) / 2;
  const czMm = (slot.z[0] + slot.z[1]) / 2;

  // Real world coordinates in meters (centered horizontally, base at Y=0)
  const minX = (evaluated.bodyBox.x[0] - cxMm) / 1000;
  const maxX = (evaluated.bodyBox.x[1] - cxMm) / 1000;
  const minY = evaluated.bodyBox.y[0] / 1000;
  const maxY = evaluated.bodyBox.y[1] / 1000;
  const minZ = -(evaluated.bodyBox.z[1] - czMm) / 1000;
  const maxZ = -(evaluated.bodyBox.z[0] - czMm) / 1000;

  const frontZ = Math.max(minZ, maxZ);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // 1. Width Chip (↔ Ш) - Positioned at front top edge
  chips.push({
    id: "chip-width",
    axis: "x",
    label: "↔ Ш",
    valueMm: design.envelope.w,
    worldPos: new THREE.Vector3(midX, maxY + 0.04, frontZ + 0.02),
  });

  // 2. Height Chip (↕ В) - Positioned at right side edge
  chips.push({
    id: "chip-height",
    axis: "y",
    label: "↕ В",
    valueMm: design.envelope.h,
    worldPos: new THREE.Vector3(maxX + 0.04, midY, frontZ + 0.02),
  });

  // 3. Depth Chip (↗ Г) - Positioned along top right side
  chips.push({
    id: "chip-depth",
    axis: "z",
    label: "↗ Г",
    valueMm: design.envelope.d,
    worldPos: new THREE.Vector3(maxX + 0.03, maxY + 0.03, (minZ + maxZ) / 2),
  });

  return chips;
}

/**
 * Projects 3D world anchors to screen pixel coordinates for HTML overlay badges.
 */
export function projectChipsToScreen(
  chips: DimensionChipDef[],
  camera: THREE.Camera,
  screenWidth: number,
  screenHeight: number,
): DimensionChipDef[] {
  return chips.map((chip) => {
    const v = chip.worldPos.clone();
    v.project(camera);

    // Check if point is in front of camera frustum
    const visible =
      v.z < 1 &&
      v.x >= -1.15 &&
      v.x <= 1.15 &&
      v.y >= -1.15 &&
      v.y <= 1.15;

    const screenX = ((v.x + 1) / 2) * screenWidth;
    const screenY = ((-v.y + 1) / 2) * screenHeight;

    return {
      ...chip,
      screenPos: {
        x: Math.round(screenX),
        y: Math.round(screenY),
        visible,
      },
    };
  });
}
