// 3D variant preview — the room the user designed, furnished with the selected
// layout. Reuses makeRoom/makeWoodTexture from ThreeScene so the room looks
// identical to the editor, then drops in the kitchen via kitchen3d. ONE canvas,
// render-on-demand, wall culling; switching variants swaps only the kitchen group
// (the perf path the R-M7 render spike already gated at 60fps on the floor device).
//
// In the constructor it also carries a direct-manipulation gizmo: a selected
// module shows a move handle (slide it on the floor) and a rotate handle (spin it
// horizontally, with a circular progress ring) — mirrors the 2D plan. Both write
// the SAME px/pz/rot free transform the plan uses (via onMovePlan / onBeginEdit),
// so 2D ⇄ 3D stay in sync and undo/redo "just works".

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeRoom, makeWoodTexture, type WallInfo } from "./ThreeScene";
import { PBR, applyPbrFloor, onTexturesReady } from "./pbr";
import { attachPerfHud } from "./perfHud";
import { buildRig, type LightPreset, type QualityTier } from "./lighting";
import { buildMirror, type Mirror } from "./reflect";
import { autoTier, pixelRatioFor, startingTier, tierSpec, type QualityPref } from "./quality";
import { buildPost } from "./post";
import { buildKitchen, groupBackOffM } from "./kitchen3d";
import type { Grids } from "../model/sheet";
import { openCells } from "../model/sheet";
import { colEdges, rowEdges, ROW_MIN } from "../model/grid";
import { resolveLayout, type Room } from "../model/resolve";
import { cabDepth } from "../model/bands";
import { planRuns, cornerUnits, cornerSideFor, outerEndSeats, pickSeat, DEFAULT_REVEAL, type KitchenLayout, type CornerSpec, type PlannedRun } from "../model/runPlan";
import { polygonBoundsMm, offsetPolygon, type Pt, type Opening, type Fitting } from "../model/room";
import { cabFootprints, halfExtents, footsClash, objectOverlapIds, type Foot } from "../model/footprint";
import { cabBand, counterTop, UPPER_BOTTOM } from "../model/resolve";
import { maxCabH, cornerArm, isOuterCorner, FOOT_DEPTH_MM, D_MIN, D_MAX } from "../model/bands";
import type { Surface } from "../model/walls";
import type { KitchenStyle } from "../model/layout";
import type { Cabinet } from "../model/cabinet";
import { ICON_DRAG_PATH, ICON_ROTATE_PATH, ICON_VMOVE_PATH } from "../components/icons";
import { registerCapture } from "../lib/thumbnailCapture";

export interface SceneApi {
  setKitchen: (cabs: Cabinet[], style: KitchenStyle) => void;
  /** Draw each wall's SHEET onto the wall itself — its column and row lines (model/grid.ts).
   *
   *  This is the thing that makes an empty room not empty: the walls are already divided into cells
   *  before a single cabinet exists, so the scene tells you where furniture goes instead of waiting
   *  to be told. Pure decoration — no picking, no geometry of its own; it reads the exact same track
   *  the front view draws and the modules are projected from, so the three cannot disagree. */
  setLattice: (grids: Grids, cabs: Cabinet[]) => void;
  setView: (v: KitchenView) => void;
  /** which module reads as picked — a tint, NOT a rebuild */
  setSelected: (id: string | null) => void;
  setSelectedMany: (ids: string[]) => void;
  /** «День» / «Вечер» / «Витрина» — dims the existing lights, never adds one */
  setLight: (p: LightPreset) => void;
  /** realistic shadows on/off — off brings the painted contact shadows straight back */
  setAO: (v: boolean) => void;
  /** aim the sun (radians): the bearing it shines from, and how high it stands */
  setSun: (azimuth: number, elevation: number) => void;
  /** how many ceiling lamps are lit (2/4/6) */
  setLampCount: (n: number) => void;
  /** turn the reflective floor on/off (rebuilds the room's mirror) */
  setReflect: (v: boolean) => void;
  /** render style changed («Линии» ⇄ realistic): re-skin the room + flip the paper background */
  setMode: () => void;
  syncGizmo: () => void;
  /** redraw next frame; `scene = false` = the camera moved and nothing else (shadows still hold) */
  invalidate: (scene?: boolean) => void;
  /** render the current frame and return it as a small JPEG data URL (AI-render input
   *  + project thumbnails — deliberately downscaled so it's fast/cheap) */
  captureDataUrl: () => string;
  /** high-resolution PNG of the current view for the factory handoff download.
   *  Temporarily blows the drawing buffer up to `maxEdge` px on the long edge
   *  (clamped to the GPU's max texture size, so 2K/4K) with a crisper shadow map,
   *  grabs a lossless PNG, then restores the live view — all synchronous, no flash. */
  /** `keepLook` = capture the mood the user is actually looking at (a snapshot), rather than forcing
   *  the neutral export look (a drawing, a thumbnail). */
  captureHiRes: (maxEdge?: number, keepLook?: boolean) => string;
  /** screen point → horizontal plane at height yM (metres) → world x/z, or null */
  floorMetres: (clientX: number, clientY: number, yM?: number) => { x: number; z: number } | null;
  /** world point (metres) → screen px (relative to the canvas) */
  project: (x: number, y: number, z: number) => { x: number; y: number };
  /** move/rotate the live selected module group (px/pz absolute mm, rot degrees) */
  /** move a module's group live (no rebuild). `backOffM` is how far behind the footprint centre its
   *  group origin sits — depth/2 for an ordinary module (built from its back face), 0 for a corner
   *  unit (built around its centre). See Drag.originOffM. */
  applyTransform: (id: string, pxMm: number, pzMm: number, rotDeg: number, backOffM: number) => void;
  /** live-resize preview: rebuild the kitchen with one module's width/height overridden
   *  (real geometry via buildKitchen, so it matches the commit exactly — no jump) */
  previewResize: (id: string, patch: Partial<Cabinet>) => void;
  /** shift a wall-unit group up/down by dyM metres (live vertical drag) */
  setUpperY: (id: string, dyM: number) => void;
  /** tint a module's meshes: a hex colour (red warn / green selected) or null to clear */
  setTint: (id: string, color: number | null) => void;
  /** screen pixels per world metre (vertical) at a world point — for the up/down drag */
  pxPerMeterY: (x: number, y: number, z: number) => number;
  rect: () => DOMRect;
  dispose: () => void;
}

function disposeGroup(gr: THREE.Object3D) {
  gr.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/** Camera framing for the kitchen stage. */
export type KitchenView = "3d" | "plan";

export type RenderMode = "real" | "xray" | "wire";

// «ЛИНИИ» — a professional black-and-white technical drawing (Bazis-style hidden-line outline).
//
// The old `wire` was `material.wireframe = true`, which slashes every quad with its mesh diagonal and
// leaves the cabinets as a triangulated cage floating in a photoreal room — the "messy" look. A real
// CAD outline view is the opposite: solids stay OPAQUE but are painted flat, unlit paper-white, and
// only the true feature edges are drawn on top. The white fill hides the lines behind it (hidden-line
// removal), so what's left reads as a clean line drawing rather than a see-through net of triangles.
const PAPER = "#ffffff"; // the sheet the drawing sits on (canvas background in wire mode)
const EDGE_CAB = 0x1a1a1a; // cabinet outlines — near-black, the subject of the drawing
const EDGE_ROOM = 0x9a9a9a; // room outlines (floor / walls / window) — grey, a secondary reference frame
// EdgesGeometry threshold°: draw an edge only where two faces meet at a sharper angle than this. Box
// corners (90°) always qualify; the fine facets of a rounded knob/handle (a few ° apart) never do, so
// curved parts show only their silhouette instead of the fur of lines a 1° default would draw.
const EDGE_ANGLE = 32;

/** Paint one group as a flat black-and-white technical drawing: unlit paper-white fills + crisp
 *  `edgeColor` feature edges laid on top. Used for the kitchen (near-black edges) and, lighter, for
 *  the room (grey). Nothing to undo — every group is rebuilt from scratch on a mode switch. */
function technicalize(group: THREE.Object3D, edgeColor: number): void {
  const edgeMat = new THREE.LineBasicMaterial({ color: edgeColor, toneMapped: false });
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || mesh.userData.decal) return; // a contact shadow isn't a surface
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of mats) {
      const m = mm as THREE.MeshStandardMaterial;
      m.wireframe = false;
      m.map = null; // drop the wood / paint / marble texture — a line drawing has no material colour
      m.toneMapped = false; // 1.0 must land as pure paper-white, not the ~0.8 grey ACES rolls it off to
      if ("emissiveMap" in m) m.emissiveMap = null;
      if ("emissive" in m && m.emissive) {
        // flat & UNLIT: colour black kills the lit term (and any warm cast off the daylight rig),
        // emissive white is the paper. Cast shadows only darken the lit term, so they leave no smudge.
        m.color.set(0x000000);
        m.emissive.set(0xffffff);
        m.emissiveIntensity = 1;
        m.roughness = 1;
        m.metalness = 0;
        if ("envMapIntensity" in m) m.envMapIntensity = 0;
      } else {
        (m as THREE.Material & { color?: THREE.Color }).color?.set?.(0xffffff);
      }
      // opaque white so it HIDES the edges behind it; nudged a hair back in depth so the coincident
      // edge lines stay crisp instead of z-fighting into dashes.
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
      m.needsUpdate = true;
    }
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE), edgeMat);
    // The outlines are decoration, never a tap target. Left pickable they'd wreck selection: the
    // raycaster tests a Line against `params.Line.threshold` (default 1 — and this scene is in METRES),
    // so each edge becomes a ~1 m-thick ribbon and a neighbour's line can out-distance the surface you
    // actually tapped. Opt them out of raycasting entirely.
    edges.raycast = () => {};
    mesh.add(edges);
  });
}

/** Render style for the kitchen group:
 *  - real → freshly built materials, unchanged.
 *  - xray → translucent facades (see the carcass / interior through them).
 *  - wire → «Линии», a flat black-and-white technical drawing (see `technicalize`).
 *  real/xray are GPU rasterisation flags — cheap; wire adds edge geometry, rebuilt on each switch. */
function applyMode(group: THREE.Object3D, mode: RenderMode) {
  if (mode === "real") return; // materials are rebuilt each swap, so nothing to undo
  if (mode === "wire") { technicalize(group, EDGE_CAB); return; }
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.decal) return; // a contact shadow is not a surface — see three/contact.ts
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of mats) {
      const m = mm as THREE.MeshStandardMaterial;
      // xray: keep already-glassy parts as-is, frost the solids
      if (!m.transparent) {
        m.transparent = true;
        m.opacity = 0.42;
      }
      m.needsUpdate = true;
    }
  });
}

// (the selection tint lives inside the scene now — `tintCab` / `paintCab` / `setSelected`, which
//  know about the red clash warning too. This used to be a second, half-aware copy of it.)

// gizmo geometry (CSS px / metres) — handle radius, ring radius, icon scale, lift
const HANDLE_R = 17;
const RING = 66;
const ICON_S = 0.78;
const GIZMO_Y = 0.45; // base/tall handle height (m) — mid-base so it reads as "on" the module
const SNAP_MM = 130; // magnet catch distance
// a corner unit has ONE legal seat per inside corner, so its magnet is deliberately wide —
// get it anywhere near the corner and it drops exactly into it
const CORNER_SNAP_MM = 900;
const ROT_SNAP_DEG = 9; // rotation catch zone around each 45°
const DEG = 180 / Math.PI;
const RED = 0xe53935;
const SEL = 0x00ac7a; // selection tint — brand green (var(--accent))
// RESIZE HANDLES — a saturated amber-yellow. The old green (SEL) blended into the wood/white kitchen,
// so the grab lines and their round knobs were near-invisible; yellow reads on both. `_HOT` is the
// darker shade the grabbed knob switches to.
const RESIZE_YEL = 0xffc400;
const RESIZE_YEL_HOT = 0xe0a000;
// module resize (drag the face arrows) — 5 cm steps, sane cabinet bounds (mm)
const RESIZE_STEP = 50;
const W_MIN = 150;
const W_MAX = 1200;
const H_MIN = 200;
const H_MAX = 1200; // fallback only — the real cap is per-module, from the ceiling (g.selMaxH)
const snapStep = (mm: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(mm / RESIZE_STEP) * RESIZE_STEP));

// nearest room-wall edge to a point, with its inward normal + foot point (all mm).
// `pts` is the inner-wall polygon; (cx,cy) is a room-interior reference for the normal.
function nearestWall(px: number, pz: number, pts: Pt[], cx: number, cy: number) {
  let best = { d: Infinity, nx: 0, nz: 1, fx: px, fz: pz };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const l2 = dx * dx + dz * dz;
    if (l2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.y) * dz) / l2));
    const fx = a.x + dx * t;
    const fz = a.y + dz * t;
    const d = Math.hypot(px - fx, pz - fz);
    if (d < best.d) {
      let nx = dz, nz = -dx;
      const ln = Math.hypot(nx, nz) || 1;
      nx /= ln; nz /= ln;
      const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
      if ((cx - mx) * nx + (cy - mz) * nz < 0) { nx = -nx; nz = -nz; } // point into the room
      best = { d, nx, nz, fx, fz };
    }
  }
  return best;
}

/** A legal standing place for a corner unit: an inside-corner seat (inner) or a reflex-vertex seat
 *  (outer, which also carries the `face` its open sides look toward). */
type Seat = CornerSpec & { face?: Pt; vertex?: Pt };

interface Geom {
  cx: number; // room centre (absolute mm) — world origin in metres
  cy: number;
  foots: Foot[];
  selFoot?: Foot;
  inner: Pt[];
  counter: number; // worktop surface (mm) — from the REAL bases, so a raised counter reads right
  selMountY: number; // selected wall-unit bottom (mm)
  selH: number; // selected module height (mm)
  selW: number; // selected module width (mm)
  selX: number; // selected module run-local left edge (mm) — the anchor for a left-end resize
  selUpper: boolean; // selected is a wall unit
  /** selected has a c.h-driven height the 3D can resize: a wall unit OR a column. A column never
   *  had a height handle at all, so a floor-to-ceiling unit could not be built in 3D. */
  selTallH: boolean;
  /** the tallest the selected module may be (mm), from the ROOM — see model/bands.ts. Replaces a
   *  flat 1200 cap that made a wall unit un-growable and a column impossible. */
  selMaxH: number;
  /** WIDTH + DEPTH may be dragged. Not on a corner unit: those two ARE the side of the square it
   *  fills, both walls clear exactly that much, and its seat is offset from the wall vertex by
   *  side/√2 — so they follow from the depth of the runs beside it (edited in the module editor as
   *  «Глубина рядов»), and dragging them here would just be undone by the next heal. */
  selResizable: boolean;
  /** HEIGHT may be dragged — a corner unit's height is free like anyone else's, and a corner
   *  antresol you cannot make taller is useless. */
  selResizableH: boolean;
  /** DEPTH may be dragged. True for a corner too, but it means something different there: the number
   *  is the depth of the RUNS it butts into, and the square + the seat re-derive from it live. */
  selResizableD: boolean;
  /** is the selection a corner unit? (its depth drag re-seats it) */
  selCorner: boolean;
  /** …and the OUTER (reverse-L) kind, which seats and sizes by different rules */
  selOuter: boolean;
  /** where the selected module's GROUP ORIGIN sits relative to its footprint centre (m) — see
   *  kitchen3d.groupBackOffM. The live drag must use the same one the rebuild will. */
  selBackOffM: number;
  /** the arm depth at rest (mm) — what the depth arrow shows and drags on a corner */
  selArm: number;
  /** ROTATE is worth offering only when the module has no wall telling it which way to face.
   *  A cabinet tiled into a run is oriented BY the run — the handle did nothing but clutter the
   *  most common object in the scene. Free-standing furniture, an island, or anything the user has
   *  pulled off the wall genuinely needs it. A corner unit is excluded: it snaps to cornerSeats. */
  selRotatable: boolean;
  /** the seats for the SELECTED module, when it is a corner unit. An INNER corner has to sit flush
   *  against TWO walls, so it snaps to an inside corner — never to a single wall. An OUTER
   *  (reverse-L) corner has seats too, just different ones: the room's REFLEX vertices (an L-room's
   *  inner elbow), which is the shape it exists to wrap. `face` (outer only) is the world point its
   *  open faces look toward at that seat — committed with the move so the L wraps the vertex
   *  instead of being re-derived from the rotation. */
  cornerSeats: Seat[];
  /** the selection may ONLY stand in one of its `cornerSeats` — true for an INNER corner, whose
   *  square is flush against two walls by definition. An outer corner is placed by hand: away from
   *  an elbow it falls back to the ordinary wall snap. */
  seatOnly: boolean;
  selFree: boolean; // free (px/pz) placement → resize grows about the centre
  /** the selected module is a cell in the wall's sheet (model/grid.ts) */
  selGridded: boolean;
  selCenterY: number; // handle height for the selected module (m)
  upperLevels: number[]; // other wall units' snap heights (mm) for the up/down drag
}

type Drag = {
  mode: "move" | "rotate" | "vertical" | "resizeW" | "resizeH" | "resizeD";
  id: string;
  /** how far BEHIND the footprint centre this module's group origin sits (m), along its facing.
   *  kitchen3d builds an ordinary module from its BACK face (→ depth/2) but a CORNER unit from the
   *  footprint CENTRE (→ 0), and the live drag has to use the same origin the rebuild will, or the
   *  module jumps by half its depth the instant the finger lifts. */
  originOffM: number;
  px: number; // live centre (absolute mm)
  pz: number;
  rot: number; // live rotation (deg)
  /** OUTER corner seated at a reflex vertex: the world point its open faces look toward, committed
   *  with the move. Null on a free move — the store then re-derives the facing from the rotation. */
  face: Pt | null;
  moved: boolean;
  // move
  px0: number;
  pz0: number;
  downX: number;
  downZ: number;
  // rotate
  startRot: number;
  prevA: number;
  accum: number;
  a0Screen: number;
  // vertical (wall units)
  mountY: number; // live bottom (mm)
  mountY0: number;
  vy0: number; // pointer clientY at down
  pxPerM: number; // screen px per world metre (vertical)
  // resize (width along the module's local X, height along Y, depth along Z) — snapped to 5 cm
  w0: number; // width at grab (mm)
  h0: number; // height at grab (mm)
  d0: number; // depth at grab (mm)
  liveW: number; // last committed preview width (mm)
  liveH: number; // last committed preview height (mm)
  liveD: number; // last committed preview depth (mm) — the ARM depth on a corner
  /** corner only: the square + seat the live arm depth resolves to. A corner's size and its
   *  position are the same edit — the seat is offset from the wall vertex by side/√2 — so the
   *  preview (and the gizmo) have to follow it as it grows. */
  liveSide: number;
  liveSeat: { px: number; pz: number; rot: number } | null;
  corner: boolean;
  /** …and it is the OUTER (reverse-L) kind: run-depth, seated on a reflex vertex, not the inner
   *  corner's 1.5×-the-arm square seated on an inside one. */
  outer: boolean;
  axX: number; // module local +x world unit (XZ), for width drag
  axZ: number;
  /** module local +z (the DEPTH axis) in world XZ — points INTO THE ROOM, away from the wall */
  dpX: number;
  dpZ: number;
  startMmX: number; // grab point on the handle-height plane (absolute mm)
  startMmZ: number;
  free: boolean; // free (px/pz) module → its anchor is the CENTRE, not a left edge
  /** the module lives in the wall's SHEET, so its width is a COLUMN and the drag goes to the grid
   *  (neighbours slide). A floating module — island, corner, table — resizes the old free way. */
  gridded: boolean;
  /** which END of the width arrow was grabbed — that face moves, the other one holds still */
  end: "left" | "right";
  x0: number; // run-local left edge at grab (mm), for a tiled module
  /** which END of the HEIGHT arrow was grabbed: "top" grows upward (bottom pinned, the default);
   *  "bottom" raises the bottom with the TOP pinned (shorten a wall unit from below). */
  hEnd: "top" | "bottom";
  liveMountY: number; // last previewed bottom for a "bottom"-anchored height drag (mm)
};

// snap a dragged footprint centre to walls + neighbours (magnet), then ALWAYS clamp
// it back inside the room so a module can never be pushed through a wall
function snapMove(f: Foot, px: number, pz: number, g: Geom, cb: { magnet: boolean }) {
  const xs = g.inner.map((p) => p.x);
  const ys = g.inner.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  let sx = px;
  let sy = pz;
  if (cb.magnet) {
    // candidate centres: flush to a wall, or align/abut a neighbour
    const candX = [minX + f.hbx, maxX - f.hbx];
    const candY = [minY + f.hby, maxY - f.hby];
    for (const o of g.foots) {
      if (o.id === f.id) continue;
      candX.push(o.cx, o.cx - o.hbx - f.hbx, o.cx + o.hbx + f.hbx);
      candY.push(o.cy, o.cy - o.hby - f.hby, o.cy + o.hby + f.hby);
    }
    let bx = SNAP_MM;
    for (const v of candX) { const d = Math.abs(px - v); if (d < bx) { bx = d; sx = v; } }
    let by = SNAP_MM;
    for (const v of candY) { const d = Math.abs(pz - v); if (d < by) { by = d; sy = v; } }
  }
  // wall push-back — keep the whole footprint inside the room walls
  const loX = minX + f.hbx, hiX = maxX - f.hbx;
  const loY = minY + f.hby, hiY = maxY - f.hby;
  if (loX <= hiX) sx = Math.min(hiX, Math.max(loX, sx));
  if (loY <= hiY) sy = Math.min(hiY, Math.max(loY, sy));
  return { x: sx, y: sy };
}

/** a Foot for the live dragged module at (px,pz,rotDeg), reusing the selected dims */
function dragFoot(sel: Foot, px: number, pz: number, rotDeg: number): Foot {
  const r = rotDeg / DEG;
  const ux = Math.cos(r), uy = Math.sin(r), ix = -Math.sin(r), iy = Math.cos(r);
  return { ...sel, cx: px, cy: pz, ux, uy, ix, iy, rotDeg, ...halfExtents(ux, uy, ix, iy, sel.w, sel.depth) };
}

export function VariantScene({
  points,
  ceiling,
  reveal = DEFAULT_REVEAL,
  openings,
  coveringColor,
  floorId,
  interiorWalls,
  fittings,
  wallSurfaces,
  waterWall,
  layout,
  style,
  cabs,
  mode = "real",
  view = "3d",
  magnet = true,
  nav = false,
  openIds,
  selectedId = null,
  selectedIds,
  grids,
  light = "day",
  ao = true,
  sun,
  shadowPx,
  lampCount = 4,
  reflect = false,
  quality = "auto",
  onSelectCab,
  onOpenFront,
  onMovePlan,
  onBeginEdit,
  onMountY,
  onResize,
  onResizeLive,
  onAddInCell,
  onAddRow,
  onPlaceTopRow,
  onColW,
  onRowH,
  onGroupW,
  onGroupDim,
  sheet = "auto",
  gridLines = true,
  placeBand,
  onApi,
  onReady,
}: {
  points: Pt[];
  ceiling: number;
  reveal?: number;
  openings: Opening[];
  coveringColor: string;
  floorId?: string;
  interiorWalls: Pt[][];
  fittings: Fitting[];
  wallSurfaces: Record<number, Surface>;
  waterWall: number | null;
  layout: KitchenLayout;
  style: KitchenStyle;
  cabs: Cabinet[];
  /** constructor render style — defaults to realistic (other screens omit it) */
  mode?: RenderMode;
  /** camera framing — 3/4 orbit or top-down plan (constructor only) */
  view?: KitchenView;
  /** snap moves/rotations to walls, neighbours and 45°/90° (constructor only) */
  magnet?: boolean;
  /** show the on-screen joystick to walk the camera around the room (constructor only) */
  nav?: boolean;
  /** ids of modules whose doors/drawers are currently open (animated) */
  openIds?: string[];
  /** highlighted module id (constructor only) */
  selectedId?: string | null;
  /** multi-selection: every id here gets a green outline; the single-select tint is suppressed. */
  selectedIds?: string[];
  /** how the room is lit — «День» / «Вечер» / «Витрина». A viewing preference, not a project one. */
  light?: LightPreset;
  /** realistic shadows (ambient occlusion). ON gives every settled frame real occlusion but costs a
   *  moment to resolve after each move; OFF is instant, and the painted contact shadows stand in. */
  ao?: boolean;
  /** WHERE THE SUN IS — the Render step's dial. Absent → the preset's own height, aimed at the room's
   *  window. This is the control that makes a wall unit throw a shadow onto the counter. */
  sun?: { azimuth: number; elevation: number };
  /** depth-map resolution. The Render step's frames are stills, so it can afford a sharper one. */
  shadowPx?: number;
  /** how many ceiling lamps are lit (2/4/6). «Вечер» is lit BY them, so it is its real control — the
   *  sun dial, correctly, barely moves anything at night. */
  lampCount?: number;
  /** a REFLECTIVE floor. Costs a second render of the scene, so it only ever appears on a settled
   *  frame — the same bargain ambient occlusion gets. See three/reflect.ts. */
  reflect?: boolean;
  /** the seller's quality preference; `auto` measures the frame time and steps down on a weak phone */
  quality?: QualityPref;
  /** each wall's sheet (model/grid.ts) — drawn on the walls as the cell lattice */
  grids?: Grids;
  /** SHOW THE SHEET. Off by default, and that is deliberate: a room full of green lines is an
   *  architectural drawing, not a kitchen, and the whole point of the 3D is that it looks like the
   *  thing you are buying. The grid is a TOOL — it appears when you reach for it.
   *
   *  `"off"`  — a realistic room. Nothing drawn, nothing draggable.
   *  `"auto"` — the sheet appears on the wall of the SELECTED module only, the moment you tap one.
   *             (A spreadsheet does exactly this: click a cell and its row/column headers light up.)
   *  `"on"`   — every wall's sheet, always. The only way to reach a BARE wall — with nothing on it
   *             there is nothing to select, so "auto" could never reveal its cells. */
  sheet?: "off" | "auto" | "on";
  /** draw the grid LINES? Default true. When false the room reads realistic (no lattice bars), but
   *  the cells stay tappable and buildable — "turn the grid off" hides the lines, it never disables
   *  the grid. Independent of `sheet`. */
  gridLines?: boolean;
  /** which tap-to-place band is armed ("r1"|"r2"|"r3"|"tall"|"extra") — only that band's row shows
   *  tappable cells, so a wall tap lands in the row you picked. Undefined → every row offers cells. */
  placeBand?: string;
  /** tap a module → its id (or null when tapping empty space) */
  onSelectCab?: (id: string | null) => void;
  /** TAP A DOOR OR DRAWER → its own key (`cabId#n`). Feed the key back through `openIds` to swing it.
   *  Takes precedence over `onSelectCab`, which is what the Рендер step wants: there is nothing to
   *  select there, only cabinets to open and look inside. */
  onOpenFront?: (key: string) => void;
  /** commit a free plan transform (move/rotate) — same path the 2D plan uses */
  onMovePlan?: (id: string, patch: { px?: number; pz?: number; rot?: number; cornerFace?: Pt }) => void;
  /** snapshot before a gesture so the whole move/rotate is one undo step */
  onBeginEdit?: () => void;
  /** commit a wall-unit's bottom height (mm) — vertical handle drag */
  onMountY?: (id: string, mountY: number) => void;
  /** commit a module resize (width / height in mm, snapped to 5 cm) — face-arrow drag */
  onResize?: (id: string, patch: Partial<Cabinet>) => void;
  /** LIVE width drag on a module that lives in the sheet — goes straight to the grid, so the
   *  neighbouring cabinets slide along the wall while you pull. No undo entry (see onResizeCommit). */
  onResizeLive?: (id: string, w: number, edge: "left" | "right") => void;
  /** tap an empty cell in the scene → a module at the CELL's size */
  onAddInCell?: (run: number, cell: { c: string; r: string; cs?: number }) => void;
  /** tap the "+ ряд" panel on a wall → turn void row `j` on run `run` into another upper band */
  onAddRow?: (run: number, j: number) => void;
  /** «3-й ряд» tap on a wall with no second upper row → make the row AND place the armed module */
  onPlaceTopRow?: (run: number) => void;
  /** drag a COLUMN border on a wall → set that column's width; the columns past it absorb it */
  onColW?: (run: number, rowId: string, i: number, mm: number, live: boolean) => void;
  /** drag a ROW border on a wall → set that row's height; the rows above absorb it */
  onRowH?: (run: number, j: number, mm: number, live: boolean) => void;
  /** drag ONE outer edge of a multi-selection → scale the whole group to a new combined width (mm),
   *  the column past that edge absorbing the change; members redistribute proportionally */
  onGroupW?: (run: number, edge: "left" | "right", mm: number, live: boolean) => void;
  /** set height / depth on EVERY selected module at once (the group's H / D arrows) */
  onGroupDim?: (patch: { h?: number; depth?: number }, live: boolean) => void;
  /** hands the imperative scene API to the parent (used by the Preview/Render step) */
  onApi?: (api: SceneApi | null) => void;
  /** fired ONCE when the scene has settled (first render + textures) — the constructor
   *  uses it to grab a single, consistent project thumbnail on entry */
  onReady?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  // the light rig is built ONCE (a changing light count would recompile every material), so the
  // preset and the tier are read at mount and then pushed in through the api
  const presetRef = useRef<LightPreset>(light);
  presetRef.current = light;
  const qualityRef = useRef<QualityPref>(quality);
  qualityRef.current = quality;
  const aoRef = useRef(ao);
  aoRef.current = ao;
  const sunRef = useRef(sun);
  sunRef.current = sun;
  const lampRef = useRef(lampCount);
  lampRef.current = lampCount;
  const reflectRef = useRef(reflect);
  reflectRef.current = reflect;
  const tierRef = useRef<QualityTier>(startingTier(quality));
  // overlay handles (positioned imperatively each frame to track the 3D module)
  const moveHRef = useRef<SVGGElement>(null);
  const rotHRef = useRef<SVGGElement>(null);
  const connRef = useRef<SVGLineElement>(null);
  const ringRef = useRef<SVGGElement>(null);
  const ringCircleRef = useRef<SVGCircleElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const rotLabelRef = useRef<SVGGElement>(null);
  const rotTextRef = useRef<SVGTextElement>(null);
  const vertHRef = useRef<SVGGElement>(null);
  // resize DIMENSION lines (like the front view's measurements, but draggable + arrowed):
  // width runs along the bottom edge, height up the right edge, DEPTH into the room
  const resizeWRef = useRef<SVGGElement>(null);
  const resizeHRef = useRef<SVGGElement>(null);
  const resizeDRef = useRef<SVGGElement>(null);
  const dimWLineRef = useRef<SVGLineElement>(null);
  const dimWHitRef = useRef<SVGLineElement>(null);
  const dimWChipRef = useRef<SVGGElement>(null);
  const dimWTextRef = useRef<SVGTextElement>(null);
  const dimHLineRef = useRef<SVGLineElement>(null);
  const dimHHitRef = useRef<SVGLineElement>(null);
  const dimHChipRef = useRef<SVGGElement>(null);
  const dimHTextRef = useRef<SVGTextElement>(null);
  const dimDLineRef = useRef<SVGLineElement>(null);
  const dimDHitRef = useRef<SVGLineElement>(null);
  const dimDChipRef = useRef<SVGGElement>(null);
  const dimDTextRef = useRef<SVGTextElement>(null);
  // GROUP (multi-selection) combined-width dimension arrow — the multi-select equivalent of the
  // single module's width arrow: one line across the group's top with the COMBINED mm. Purely
  // visual (pointerEvents none); the drag is the in-scene knobs at its two ends (lineDrag "group").
  // group WIDTH / HEIGHT / DEPTH arrows — each draggable via its own SVG (onPointerDown → onGroupW /
  // onGroupDim). Each carries a WIDE invisible hit line (`*HitRef`) so the grab target isn't a 3px hair.
  const resizeGroupWRef = useRef<SVGGElement>(null);
  const dimGroupWLineRef = useRef<SVGLineElement>(null);
  const dimGroupWHitRef = useRef<SVGLineElement>(null);
  const dimGroupWChipRef = useRef<SVGGElement>(null);
  const dimGroupWTextRef = useRef<SVGTextElement>(null);
  const resizeGroupHRef = useRef<SVGGElement>(null);
  const dimGroupHLineRef = useRef<SVGLineElement>(null);
  const dimGroupHHitRef = useRef<SVGLineElement>(null);
  const dimGroupHChipRef = useRef<SVGGElement>(null);
  const dimGroupHTextRef = useRef<SVGTextElement>(null);
  const resizeGroupDRef = useRef<SVGGElement>(null);
  const dimGroupDLineRef = useRef<SVGLineElement>(null);
  const dimGroupDHitRef = useRef<SVGLineElement>(null);
  const dimGroupDChipRef = useRef<SVGGElement>(null);
  const dimGroupDTextRef = useRef<SVGTextElement>(null);
  const groupDimDragRef = useRef<null | { mode: "w" | "h" | "d"; v0: number; grabY: number; pxPerM: number; ix: number; iz: number; ux: number; uz: number; edge: "left" | "right"; fx: number; fz: number; cYm: number; moved: boolean }>(null);
  const vertDimRef = useRef<SVGGElement>(null);
  // the live mm readout while a grid line is being dragged — you are setting a NUMBER (a column
  // width, a row height), so the number has to be on screen while you set it
  const lineChipRef = useRef<SVGGElement>(null);
  const lineChipTextRef = useRef<SVGTextElement>(null);
  /** the dimension strings — every column's width across the top, every row's height down the side */
  const dimsRef = useRef<SVGGElement>(null);
  const vertDimLineRef = useRef<SVGLineElement>(null);
  const vertDimChipRef = useRef<SVGGElement>(null);
  const vertDimTextRef = useRef<SVGTextElement>(null);
  const vertGuideRef = useRef<SVGLineElement>(null);
  const gizmoScreenRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // camera-walk joystick: the live push vector (−1..1) the render loop reads each frame
  const navRef = useRef({ x: 0, z: 0 });
  const joyRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<SVGGElement>(null);
  const joyCenter = useRef({ cx: 0, cy: 0 });
  // door/drawer open animation: target (0|1) + current amount per module
  const openTargetRef = useRef<Map<string, number>>(new Map());
  const openCurRef = useRef<Map<string, number>>(new Map());

  const cbRef = useRef({ onSelectCab, onOpenFront, onMovePlan, onBeginEdit, onMountY, onResize, onResizeLive, onAddInCell, onAddRow, onPlaceTopRow, onColW, onRowH, onGroupW, onGroupDim, magnet });
  cbRef.current = { onSelectCab, onOpenFront, onMovePlan, onBeginEdit, onMountY, onResize, onResizeLive, onAddInCell, onAddRow, onPlaceTopRow, onColW, onRowH, onGroupW, onGroupDim, magnet };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // keep latest room inputs without re-initialising the scene
  const propsRef = useRef({ points, ceiling, reveal, openings, coveringColor, floorId, interiorWalls, fittings, wallSurfaces, waterWall, layout, mode, view, selectedId, selectedIds, grids, sheet, gridLines, placeBand });
  propsRef.current = { points, ceiling, reveal, openings, coveringColor, floorId, interiorWalls, fittings, wallSurfaces, waterWall, layout, mode, view, selectedId, selectedIds, grids, sheet, gridLines, placeBand };

  // footprints + selection geometry, recomputed when the run/selection changes
  const geomRef = useRef<Geom | null>(null);
  // world-space geometry of the SELECTED GROUP's combined-width arrow (the two top-corner points +
  // the combined mm). setLattice stamps it (null when the selection isn't a resizable group);
  // updateGizmo re-projects it every frame so the SVG arrow tracks the camera.
  const groupGizmoRef = useRef<{
    leftW: THREE.Vector3; rightW: THREE.Vector3; total: number; // WIDTH arrow (top edge)
    ux: number; uz: number; leftDrag: boolean; rightDrag: boolean; lpx: number; rpx: number; // WIDTH drag: wall dir, which ends grow, live screen-x of each end
    hB: THREE.Vector3 | null; hT: THREE.Vector3 | null; hVal: number; // HEIGHT arrow (right edge) — null when all bases
    dB: THREE.Vector3; dF: THREE.Vector3; dVal: number; dOk: boolean; // DEPTH arrow (left edge, wall→face) — dOk false when it borders a corner
    ix: number; iz: number; cYm: number; ctrM: THREE.Vector3; // wall inward-normal + centre (for the H/D drag math)
  } | null>(null);
  {
    const b = polygonBoundsMm(points);
    const foots = cabFootprints(cabs, points, waterWall, layout, openings, reveal);
    const selFoot = selectedId ? foots.find((f) => f.id === selectedId) : undefined;
    const selCab = selectedId ? cabs.find((c) => c.id === selectedId) : undefined;
    // canonical bands — a hood's default bottom is NOT the wall-unit default, and the worktop
    // moves with the seller's base height; both used to be hardcoded here
    // the bottom of the selected module's CARCASS — where its height grows from, and so where the
    // height arrow anchors. For a wall unit that's its mountY; for a column it's the top of the
    // plinth (this used to fall back to the default 1520 wall-mount for anything that wasn't an
    // upper, which put a column's height arrow 1.5m off in mid-air).
    const selMountY = selCab ? cabBand(selCab).carcass0 : UPPER_BOTTOM;
    const selH = selCab?.h ?? 720;
    // candidate snap heights for the up/down drag: align the dragged unit's bottom to other wall
    // units' bottoms, its top to their tops, or SIT IT ON TOP OF ONE — the last of those is how an
    // antresol gets built, and it was the one level the magnet didn't offer, so stacking a second
    // row by hand fought you the whole way.
    const upperLevels: number[] = [];
    if (selFoot?.upper) {
      for (const c of cabs) {
        if (c.id === selectedId || c.kind !== "upper") continue;
        const b = cabBand(c).y0;
        upperLevels.push(b); // bottom ↔ bottom
        upperLevels.push(b + (c.h ?? 720) - selH); // top ↔ top (as a bottom value)
        upperLevels.push(b + (c.h ?? 720)); // rest ON its top — the stacking magnet
      }
      upperLevels.push(UPPER_BOTTOM); // the default mounting level
      upperLevels.push(Math.max(0, ceiling - selH)); // flush with the ceiling
    }
    // A corner unit is a square that must sit flush against BOTH walls of an inside corner.
    // cornerUnits() computes exactly those seats — sized to THIS module (the base corner is
    // 840, the upper 613), so the seat is the one place it can legally go.
    //
    // An OUTER unit is an END UNIT, so it is NOT tied to an inside corner — but it is not seatless
    // either: its seats are the EXPOSED ENDS of the wall runs (where the room turns a convex corner),
    // the last slot before the elbow. With no seats at all it fell through to the single-nearest-wall
    // snap, which parked it flush to whichever elbow wall happened to be closer, at an arbitrary
    // distance along it — so it never lined up with the run and looked like it slid off sideways the
    // moment the drag ended. Away from an elbow it still drags freely (wall snap), hence seatOnly.
    const outerSel = !!selCab && isOuterCorner(selCab);
    const cornerSeats: Seat[] =
      selCab?.corner && selFoot
        ? outerSel
          ? outerEndSeats(points, selCab.w, cabDepth(selCab))
          : cornerUnits(points, waterWall, layout, openings, selCab.w)
        : [];
    geomRef.current = {
      cx: b.cx,
      cy: b.cy,
      cornerSeats,
      seatOnly: !!selCab?.corner && !outerSel,
      foots,
      counter: counterTop(cabs),
      selFoot,
      inner: offsetPolygon(points, 100),
      selMountY,
      selH,
      selW: selFoot?.w ?? selCab?.w ?? 600,
      selUpper: selCab?.kind === "upper",
      selTallH: selCab?.kind === "upper" || selCab?.kind === "tall",
      selMaxH: selCab ? maxCabH(selCab, ceiling) : H_MAX,
      // an INNER corner's width is structural (both walls clear exactly that square) → no resize.
      // An END UNIT's width is a free choice like any other module's, so it keeps its arrows.
      selResizable: !!selCab && (!selCab.corner || outerSel),
      selResizableH: !!selCab,
      selResizableD: !!selCab,
      selCorner: !!selCab?.corner,
      selOuter: outerSel,
      selBackOffM: selCab ? groupBackOffM(selCab) : (selFoot?.depth ?? 0) / 2000,
      selArm: selCab ? cornerArm(selCab) : FOOT_DEPTH_MM.base,
      // free-standing → it needs a rotate handle; tiled into a wall run → the run already faces it.
      // An END UNIT is the exception among corners: an elbow has TWO seats, one per wall, and turning
      // it is how you say which wall it caps. Without a handle it was stuck on whichever one the app
      // happened to seat it against — and the seat magnet then kept it there.
      selRotatable:
        !!selCab && (!selCab.corner || outerSel) &&
        (!!selCab.furniture || !!selCab.island || selCab.px != null),
      selX: selCab?.x ?? 0,
      selFree: selCab?.px != null && selCab?.pz != null,
      selGridded: !!selCab?.cell && selCab?.px == null,
      // handle height (m): mid-height of a wall unit, else mid-base
      selCenterY: selFoot?.upper ? (selMountY + selH / 2) / 1000 : GIZMO_Y,
      upperLevels,
    };
  }

  // ---- gizmo drag (move / rotate) — handlers live in component scope and reach
  // the Three internals via apiRef; gesture state lives in dragRef ----
  const showRing = (on: boolean) => {
    if (ringRef.current) ringRef.current.style.display = on ? "" : "none";
    if (rotLabelRef.current) rotLabelRef.current.style.display = on ? "" : "none";
  };
  const drawArc = (a0: number, a1: number) => {
    const sc = gizmoScreenRef.current;
    const arc = arcRef.current;
    if (!sc || !arc) return;
    const sweep = (((a1 - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const large = sweep > Math.PI ? 1 : 0;
    const p0 = { x: sc.x + RING * Math.cos(a0), y: sc.y + RING * Math.sin(a0) };
    const p1 = { x: sc.x + RING * Math.cos(a1), y: sc.y + RING * Math.sin(a1) };
    arc.setAttribute("d", `M${p0.x} ${p0.y} A${RING} ${RING} 0 ${large} 1 ${p1.x} ${p1.y}`);
  };
  // angle readout in the ring centre — accent + bold when locked on a 45°/90° step
  const showAngle = (rot: number) => {
    const sc = gizmoScreenRef.current;
    const lbl = rotLabelRef.current;
    const txt = rotTextRef.current;
    if (!sc || !lbl || !txt) return;
    const deg = (((Math.round(rot) % 360) + 360) % 360);
    const snapped = Math.abs(deg - Math.round(deg / 45) * 45) < 0.5;
    txt.textContent = `${deg}°`;
    lbl.setAttribute("transform", `translate(${sc.x} ${sc.y})`);
    const bg = lbl.firstElementChild as SVGRectElement | null;
    if (bg) bg.setAttribute("fill", snapped ? "#00ac7a" : "#1c1b18");
  };
  // live overlap warning: tint the dragged module red when it clashes with another
  // same-layer module, else blue (selected). Wall clashes can't happen (push-back).
  const tintClash = (g: Geom, id: string, df: Foot) => {
    const clash = g.foots.some((o) => o.id !== id && footsClash(df, o));
    apiRef.current?.setTint(id, clash ? RED : SEL);
  };
  // vertical gap dimension (counter worktop → wall-unit bottom) while dragging height
  const showVertDim = (on: boolean) => {
    if (vertDimRef.current) vertDimRef.current.style.display = on ? "" : "none";
    if (!on && vertGuideRef.current) vertGuideRef.current.style.display = "none";
  };
  const updateVertDim = (g: Geom, dr: Drag) => {
    const api = apiRef.current;
    const line = vertDimLineRef.current;
    const chip = vertDimChipRef.current;
    const txt = vertDimTextRef.current;
    if (!api || !line || !chip || !txt) return;
    const xW = (dr.px - g.cx) / 1000;
    const zW = (dr.pz - g.cy) / 1000;
    const top = api.project(xW, g.counter / 1000, zW); // worktop level
    const bot = api.project(xW, dr.mountY / 1000, zW); // unit bottom
    line.setAttribute("x1", `${top.x}`); line.setAttribute("y1", `${top.y}`);
    line.setAttribute("x2", `${bot.x}`); line.setAttribute("y2", `${bot.y}`);
    chip.setAttribute("transform", `translate(${(top.x + bot.x) / 2} ${(top.y + bot.y) / 2})`);
    txt.textContent = `${Math.max(0, Math.round(dr.mountY - g.counter))} мм`;
  };

  // a move/rotate/vertical step from absolute client coords — driven by window
  // listeners (NOT the handle's own pointermove) so the gesture keeps tracking even
  // when the cursor leaves the handle. Mouse has no implicit pointer-capture, so
  // listening on the tiny handle alone stalls after a few px; window never does.
  const moveTo = (clientX: number, clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "move" || !g?.selFoot || !api) return;
    // raycast onto a plane at the HANDLE's height, not the floor — for a wall unit
    // (handle ~1.5m up) a floor raycast is grazing and a tiny drag flings it away
    const fl = api.floorMetres(clientX, clientY, g.selCenterY);
    if (!fl) return;
    let px = dr.px0 + (fl.x * 1000 + g.cx - dr.downX);
    let pz = dr.pz0 + (fl.z * 1000 + g.cy - dr.downZ);
    let rot = dr.startRot;
    dr.face = null; // an un-seated move lets the store re-derive the facing from the rotation
    if (g.cornerSeats.length && cbRef.current.magnet) {
      // A CORNER UNIT SNAPS TO ITS CORNER, NOT TO A WALL. An inner corner has to be flush against
      // TWO walls at once and an outer one has to WRAP a convex vertex, so the single-nearest-wall
      // seating below would push either out of the corner and rewrite its rotation to whichever
      // wall happened to be closer — which is why dragging one made it jump to an off-the-wall
      // position it could never be dragged back from.
      // …the seat the drag is AIMED at: measured to the room corner as well as to the seat centre,
      // and preferring one that doesn't spin the module onto the perpendicular wall (see pickSeat).
      const best = pickSeat(g.cornerSeats, px, pz, rot, CORNER_SNAP_MM);
      if (best) {
        // seated: commit the seat EXACTLY and skip every other magnet/clamp. The room clamp
        // would shave a fraction off it (an odd-sized square like the 613 upper corner can't
        // have an integer centre that is flush on both sides) and un-seat it.
        dr.px = best.px;
        dr.pz = best.pz;
        dr.rot = best.rot; // aligns the square with both walls
        dr.face = best.face ?? null; // outer: the seat says which way the open faces look
        dr.moved = true;
        api.applyTransform(dr.id, dr.px, dr.pz, dr.rot, dr.originOffM);
        tintClash(g, dr.id, dragFoot(g.selFoot, dr.px, dr.pz, dr.rot));
        api.invalidate();
        return;
      }
    }
    if (!g.seatOnly && cbRef.current.magnet) {
      // near a wall → orient the back to that wall + seat the back flush against it
      const w = nearestWall(px, pz, g.inner, g.cx, g.cy);
      if (w.d < g.selFoot.depth + 250) {
        rot = Math.atan2(-w.nx, w.nz) * DEG;
        const half = g.selFoot.depth / 2;
        px = w.fx + w.nx * half;
        pz = w.fz + w.nz * half;
      }
    }
    // snap along the wall to neighbours + clamp inside, using the (re-oriented) extents. An INNER
    // corner is already exactly seated, so it only takes the room clamp — letting the neighbour
    // magnet nudge it would slide it back out of the corner.
    const sn = snapMove(
      dragFoot(g.selFoot, px, pz, rot),
      px,
      pz,
      g,
      g.seatOnly ? { magnet: false } : cbRef.current,
    );
    dr.px = sn.x;
    dr.pz = sn.y;
    dr.rot = rot;
    dr.moved = true;
    api.applyTransform(dr.id, dr.px, dr.pz, dr.rot, dr.originOffM);
    tintClash(g, dr.id, dragFoot(g.selFoot, dr.px, dr.pz, dr.rot));
    api.invalidate();
  };
  const rotateTo = (clientX: number, clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "rotate" || !g?.selFoot || !api) return;
    const fl = api.floorMetres(clientX, clientY, g.selCenterY);
    if (!fl) return;
    const aWorld = Math.atan2(fl.z * 1000 + g.cy - dr.pz, fl.x * 1000 + g.cx - dr.px);
    let d = aWorld - dr.prevA;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    dr.accum += d;
    dr.prevA = aWorld;
    let rot = dr.startRot + dr.accum * DEG;
    if (cbRef.current.magnet) {
      const n = Math.round(rot / 45) * 45;
      if (Math.abs(rot - n) < ROT_SNAP_DEG) rot = n; // detent at every 45° / 90°
    }
    dr.rot = rot;
    dr.face = null; // spun by hand → the facing follows the rotation, not an old seat
    dr.moved = true;
    api.applyTransform(dr.id, dr.px, dr.pz, rot, dr.originOffM);
    const rect = api.rect();
    const sc = gizmoScreenRef.current;
    if (sc) drawArc(dr.a0Screen, Math.atan2(clientY - rect.top - sc.y, clientX - rect.left - sc.x));
    showAngle(rot);
    tintClash(g, dr.id, dragFoot(g.selFoot, dr.px, dr.pz, rot));
    api.invalidate();
  };
  const verticalTo = (clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "vertical" || !g || !api) return;
    const lo = 200;
    const hi = Math.max(lo, propsRef.current.ceiling - g.selH);
    let mountY = Math.min(hi, Math.max(lo, dr.mountY0 + (dr.vy0 - clientY) * (1000 / dr.pxPerM)));
    // snap the bottom to align with another wall unit's bottom/top (magnet)
    let aligned = false;
    if (cbRef.current.magnet) {
      let best = 45; // mm catch
      for (const lvl of g.upperLevels) {
        const d = Math.abs(mountY - lvl);
        if (d < best) { best = d; mountY = lvl; aligned = true; }
      }
    }
    dr.mountY = Math.round(Math.min(hi, Math.max(lo, mountY)));
    dr.moved = true;
    api.setUpperY(dr.id, (dr.mountY - dr.mountY0) / 1000); // shift the group up/down live
    updateVertDim(g, dr); // live gap readout (worktop → unit bottom)
    // alignment guide: a horizontal accent line at the snapped level
    const guide = vertGuideRef.current;
    if (guide) {
      if (aligned) {
        const sy = api.project((dr.px - g.cx) / 1000, dr.mountY / 1000, (dr.pz - g.cy) / 1000).y;
        const w = api.rect().width;
        guide.setAttribute("x1", "0");
        guide.setAttribute("x2", `${w}`);
        guide.setAttribute("y1", `${sy}`);
        guide.setAttribute("y2", `${sy}`);
        guide.style.display = "";
      } else {
        guide.style.display = "none";
      }
    }
    api.invalidate();
  };

  /** The patch a width drag produces: the grabbed face follows the finger and THE OPPOSITE FACE
   *  STAYS PUT. This used to just set `w`, which grows a run module rightwards and a free module
   *  about its centre (i.e. both ways at once) no matter which end you grabbed — so you could
   *  never pull just the right side out. Keeping the far face fixed means moving the anchor:
   *  a run module's left edge `x`, a free module's centre `px/pz`. */
  const widthPatch = (dr: Drag, w: number): Partial<Cabinet> => {
    const d = w - dr.w0;
    if (!dr.free) {
      // run module: `x` is its LEFT edge. Right grab → x unchanged. Left grab → x absorbs it,
      // never past the start of the run.
      return dr.end === "right" ? { w } : { w, x: Math.max(Math.min(0, dr.x0), dr.x0 - d) };
    }
    // free module: `px/pz` is its CENTRE, so the centre must slide half the change, towards
    // the grabbed end, for the far face to hold still
    const shift = (dr.end === "right" ? 1 : -1) * (d / 2);
    return { w, px: Math.round(dr.px0 + dr.axX * shift), pz: Math.round(dr.pz0 + dr.axZ * shift) };
  };

  // width resize: drag either END of the bottom dimension line along the module's local X,
  // snapped to 5 cm. The live preview rebuilds real geometry (previewResize) only when the
  // snapped value crosses a step, so the commit can't jump.
  const resizeWTo = (clientX: number, clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "resizeW" || !g || !api) return;
    const fl = api.floorMetres(clientX, clientY, g.selCenterY);
    if (!fl) return;
    const dxMm = fl.x * 1000 + g.cx - dr.startMmX;
    const dzMm = fl.z * 1000 + g.cy - dr.startMmZ;
    const along = dxMm * dr.axX + dzMm * dr.axZ; // displacement along the width axis (mm)
    // pulling the LEFT end leftwards (negative along) makes the module WIDER
    let w = snapStep(dr.w0 + (dr.end === "right" ? 1 : -1) * along, W_MIN, W_MAX);
    // a run module's left edge can't go past the start of the run — cap the width instead, or
    // the clamped anchor would let the far (right) face creep, which is the thing we're fixing.
    // Math.max(0, x0) matters: a module with a stale NEGATIVE x would otherwise cap w at a
    // negative number and the resize would silently do nothing at all.
    if (!dr.free && dr.end === "left") w = Math.max(W_MIN, Math.min(w, dr.w0 + Math.max(0, dr.x0)));
    if (w !== dr.liveW) {
      dr.liveW = w;
      dr.moved = true;
      // A MODULE IN THE SHEET HAS NO WIDTH OF ITS OWN — it has a column. So a face drag goes
      // straight to the grid, live, and the NEIGHBOURS SLIDE ALONG THE WALL as you pull. That is
      // the Excel push, in 3D, and it costs nothing extra: `previewResize` already rebuilt the whole
      // kitchen group on every snapped step, so driving it from the store rebuilds exactly as often.
      //
      // The grid refuses a width the wall cannot absorb, so the face simply stops — there is no
      // clamp to write here, and no way to shove a cabinet through its neighbour.
      if (dr.gridded && cbRef.current.onResizeLive) cbRef.current.onResizeLive(dr.id, w, dr.end);
      else api.previewResize(dr.id, widthPatch(dr, w));
    }
    api.invalidate(); // repositions the arrow + chip (updateGizmo)
  };
  /** Depth patch. THE BACK FACE STAYS ON THE WALL.
   *
   *  A run-tiled module carries no px/pz — footprint.ts re-derives its centre from `wall + depth/2`
   *  every time — so `{depth}` alone already grows it into the room. A FREE module anchors on its
   *  centre, so the centre has to slide half the change along the depth axis for the back to hold
   *  still (exactly what widthPatch does for width).
   *
   *  A CORNER is neither: `d` is the depth of the RUNS it butts into, its square is
   *  `cornerSideFor(d)`, and its seat sits `side/√2` from the wall vertex — so growing it MOVES it.
   *  Size and position are one edit (the same one `rowOps.seatCorner` does on the model side); the
   *  seat is recomputed here so the live preview follows instead of jumping on release. */
  const depthPatch = (dr: Drag, d: number): Partial<Cabinet> => {
    if (dr.corner) {
      // An INNER corner's square GROWS with the arm (side = 1.5× the run depth) and re-seats at a
      // wall vertex. An OUTER unit is an END UNIT: `d` IS its depth, its WIDTH is its own and must
      // not be touched, and it re-seats at the exposed end of a run. Running it through the inner
      // math blew it up into the 840 square and pinned it to an inside corner — the same wrong
      // seating the store already guards against, arriving through the other input.
      const outer = dr.outer;
      const side = outer ? dr.w0 : cornerSideFor(d); // outer → the width it already had
      const p = propsRef.current;
      const seats: Seat[] = outer
        ? outerEndSeats(p.points, side, d)
        : cornerUnits(p.points, p.waterWall, p.layout, p.openings, side);
      const patch: Partial<Cabinet> = { armDepth: d, w: side, depth: outer ? d : side };
      if (seats.length) {
        const near = (a: Seat) => Math.hypot(a.px - dr.px0, a.pz - dr.pz0);
        const best = seats.reduce((a, b) => (near(b) < near(a) ? b : a));
        patch.px = best.px;
        patch.pz = best.pz;
        patch.rot = best.rot;
        if (best.face) patch.cornerFace = best.face;
        dr.liveSeat = { px: best.px, pz: best.pz, rot: best.rot };
      }
      dr.liveSide = side;
      return patch;
    }
    if (!dr.free) return { depth: d };
    const shift = (d - dr.d0) / 2;
    return { depth: d, px: Math.round(dr.px0 + dr.dpX * shift), pz: Math.round(dr.pz0 + dr.dpZ * shift) };
  };

  // depth resize: drag the room-facing arrow along the module's depth axis (f.ix/f.iy — the wall's
  // inward normal, so +i is INTO the room). Snapped to 5 cm like the others.
  const resizeDTo = (clientX: number, clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "resizeD" || !g || !api) return;
    const fl = api.floorMetres(clientX, clientY, g.selCenterY);
    if (!fl) return;
    const dxMm = fl.x * 1000 + g.cx - dr.startMmX;
    const dzMm = fl.z * 1000 + g.cy - dr.startMmZ;
    const into = dxMm * dr.dpX + dzMm * dr.dpZ; // displacement INTO the room (mm)
    const d = snapStep(dr.d0 + into, D_MIN, D_MAX);
    if (d !== dr.liveD) {
      dr.liveD = d;
      dr.moved = true;
      api.previewResize(dr.id, depthPatch(dr, d));
    }
    api.invalidate();
  };

  // height resize, snapped to 5 cm, capped at the ROOM (g.selMaxH) not a flat 1200. The grabbed END
  // decides the anchor: the TOP handle grows upward with the bottom pinned (the default); the BOTTOM
  // handle raises the bottom with the TOP pinned — which is how you shorten a wall unit from below.
  const resizeHTo = (clientY: number) => {
    const dr = dragRef.current;
    const g = geomRef.current;
    const api = apiRef.current;
    if (!dr || dr.mode !== "resizeH" || !g?.selFoot || !api) return;
    const hi = Math.max(H_MIN, g.selMaxH);
    const rise = (dr.vy0 - clientY) * (1000 / dr.pxPerM); // mm the finger has risen since grab
    if (dr.hEnd === "bottom") {
      const top = dr.mountY0 + dr.h0; // stays put
      const h = snapStep(dr.h0 - rise, H_MIN, hi);
      const mountY = Math.max(0, top - h);
      if (h !== dr.liveH || mountY !== dr.liveMountY) {
        dr.liveH = h;
        dr.liveMountY = mountY;
        dr.moved = true;
        api.previewResize(dr.id, { h, mountY });
      }
    } else {
      const h = snapStep(dr.h0 + rise, H_MIN, hi);
      if (h !== dr.liveH) {
        dr.liveH = h;
        dr.moved = true;
        api.previewResize(dr.id, { h });
      }
    }
    api.invalidate();
  };

  const beginDrag = (e: React.PointerEvent, mode: Drag["mode"]) => {
    const g = geomRef.current;
    const api = apiRef.current;
    if (!g?.selFoot || !api) return;
    e.preventDefault();
    e.stopPropagation();
    // capture keeps the stream on the handle (and off the canvas/OrbitControls);
    // the window listeners below are the real driver, capture is just insurance
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const f = g.selFoot;
    const fl = api.floorMetres(e.clientX, e.clientY, g.selCenterY); // plane at handle height
    const grabX = fl ? fl.x * 1000 + g.cx : f.cx;
    const grabZ = fl ? fl.z * 1000 + g.cy : f.cy;
    // WHICH END of the width arrow did the finger land on? Project the grab onto the module's
    // width axis, relative to its centre — positive is the right half. That end is the one that
    // moves; the far face stays put.
    const end: "left" | "right" = (grabX - f.cx) * f.ux + (grabZ - f.cy) * f.uy >= 0 ? "right" : "left";
    // on a CORNER the depth drag edits the ARM depth (the runs it butts into), not the square
    const d0 = g.selCorner ? g.selArm : f.depth;
    // The origin the REBUILD will use (kitchen3d.groupBackOffM) — a corner unit is built around its
    // footprint centre, everything else from its back face. Getting this wrong is invisible until
    // release, when the rebuild re-places the module at the other origin and it jumps half a depth.
    const base = { id: f.id, originOffM: g.selBackOffM, face: null, px: f.cx, pz: f.cy, rot: f.rotDeg, moved: false, px0: f.cx, pz0: f.cy, downX: 0, downZ: 0, startRot: f.rotDeg, prevA: 0, accum: 0, a0Screen: 0, mountY: g.selMountY, mountY0: g.selMountY, vy0: e.clientY, pxPerM: 200, w0: g.selW, h0: g.selH, d0, liveW: g.selW, liveH: g.selH, liveD: d0, liveSide: f.depth, liveSeat: null, corner: g.selCorner, outer: g.selOuter, axX: f.ux, axZ: f.uy, dpX: f.ix, dpZ: f.iy, startMmX: grabX, startMmZ: grabZ, free: g.selFree, gridded: g.selGridded, end, x0: g.selX, hEnd: "top" as "top" | "bottom", liveMountY: g.selMountY };
    // A GRIDDED width drag applies itself to the store on every snapped step (onResizeLive), and
    // those live edits deliberately push NO history — so the one undo entry for the whole gesture
    // has to be opened here, at pointerdown. Every other drag commits once on release and gets its
    // undo step from that.
    if (mode === "resizeW" && g.selGridded) cbRef.current.onBeginEdit?.();

    if (mode === "move") {
      dragRef.current = { ...base, mode: "move", downX: fl ? fl.x * 1000 + g.cx : f.cx, downZ: fl ? fl.z * 1000 + g.cy : f.cy };
    } else if (mode === "resizeD") {
      dragRef.current = { ...base, mode: "resizeD" };
    } else if (mode === "rotate") {
      const aWorld = fl ? Math.atan2(fl.z * 1000 + g.cy - f.cy, fl.x * 1000 + g.cx - f.cx) : 0;
      const rect = api.rect();
      const sc = gizmoScreenRef.current ?? { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const aScreen = Math.atan2(e.clientY - rect.top - sc.y, e.clientX - rect.left - sc.x);
      dragRef.current = { ...base, mode: "rotate", prevA: aWorld, a0Screen: aScreen };
      showRing(true);
      drawArc(aScreen, aScreen);
      showAngle(f.rotDeg);
    } else if (mode === "resizeW") {
      dragRef.current = { ...base, mode: "resizeW" };
    } else if (mode === "resizeH") {
      // vertical pixels per world-metre at the module top, for screen→mm
      const pxPerM = api.pxPerMeterY((f.cx - g.cx) / 1000, g.selCenterY, (f.cy - g.cy) / 1000);
      // WHICH END of the height arrow? Below the module's screen centre → the BOTTOM handle (raise the
      // bottom, top pinned); above → the TOP handle (grow up, bottom pinned — the default).
      const rect = api.rect();
      const ctrY = gizmoScreenRef.current?.y ?? e.clientY - rect.top;
      const hEnd: "top" | "bottom" = e.clientY - rect.top > ctrY ? "bottom" : "top";
      dragRef.current = { ...base, mode: "resizeH", pxPerM: pxPerM || 200, hEnd };
    } else {
      // vertical (wall units): pixels per world-metre at the module, for screen→mm
      const pxPerM = api.pxPerMeterY((f.cx - g.cx) / 1000, g.selCenterY, (f.cy - g.cy) / 1000);
      const drv: Drag = { ...base, mode: "vertical", pxPerM: pxPerM || 200 };
      dragRef.current = drv;
      showVertDim(true);
      updateVertDim(g, drv);
    }
    const onWinMove = (ev: PointerEvent) => {
      const dr = dragRef.current;
      if (!dr) return;
      ev.preventDefault();
      if (dr.mode === "move") moveTo(ev.clientX, ev.clientY);
      else if (dr.mode === "rotate") rotateTo(ev.clientX, ev.clientY);
      else if (dr.mode === "resizeW") resizeWTo(ev.clientX, ev.clientY);
      else if (dr.mode === "resizeD") resizeDTo(ev.clientX, ev.clientY);
      else if (dr.mode === "resizeH") resizeHTo(ev.clientY);
      else verticalTo(ev.clientY);
    };
    // hard block of touch-scroll for the duration of the gesture (some WebViews
    // ignore touch-action on SVG, then fire pointercancel and kill the drag)
    const blockTouch = (ev: TouchEvent) => ev.preventDefault();
    const onWinUp = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
      window.removeEventListener("touchmove", blockTouch);
      const dr = dragRef.current;
      const cb2 = cbRef.current;
      if (dr && dr.moved) {
        if (dr.mode === "vertical") cb2.onMountY?.(dr.id, dr.mountY); // patchCab → own undo step
        // A GRIDDED width drag has been applying itself to the store all along (onResizeLive), so
        // the geometry is already correct and the undo step is already open. Re-sending the width
        // here would re-run the column edit against a stale starting width, and the cabinet would
        // jump on release.
        else if (dr.mode === "resizeW") {
          if (!dr.gridded) cb2.onResize?.(dr.id, widthPatch(dr, dr.liveW));
        }
        else if (dr.mode === "resizeD") cb2.onResize?.(dr.id, depthPatch(dr, dr.liveD));
        else if (dr.mode === "resizeH") cb2.onResize?.(dr.id, dr.hEnd === "bottom" ? { h: dr.liveH, mountY: dr.liveMountY } : { h: dr.liveH });
        else if (cb2.onMovePlan) {
          cb2.onBeginEdit?.(); // one undo step for the whole gesture
          // `cornerFace` rides along ONLY from a seat: an outer corner dropped on a reflex vertex
          // must open the way that vertex says, not the way its rotation would imply.
          cb2.onMovePlan(dr.id, { px: dr.px, pz: dr.pz, rot: dr.rot, ...(dr.face ? { cornerFace: dr.face } : {}) });
        }
      }
      dragRef.current = null;
      showRing(false);
      showVertDim(false);
      apiRef.current?.invalidate();
    };
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
    window.addEventListener("touchmove", blockTouch, { passive: false });
  };
  const onResizeDDown = (e: React.PointerEvent) => beginDrag(e, "resizeD");
  const onMoveDown = (e: React.PointerEvent) => beginDrag(e, "move");
  const onRotDown = (e: React.PointerEvent) => beginDrag(e, "rotate");
  const onVertDown = (e: React.PointerEvent) => beginDrag(e, "vertical");
  const onResizeWDown = (e: React.PointerEvent) => beginDrag(e, "resizeW");
  const onResizeHDown = (e: React.PointerEvent) => beginDrag(e, "resizeH");

  // GROUP width / height / depth drag — a multi-selection has no selFoot, so these run their own tiny
  // gesture instead of beginDrag. All three grab a big invisible SVG hit line (not a tiny mesh), so the
  // handle is easy to catch. WIDTH projects the pointer's floor move onto the WALL direction (→ mm along
  // the wall) and scales the group from the grabbed end (→ onGroupW); HEIGHT reads vertical screen px →
  // mm; DEPTH projects onto the wall's inward normal (like resizeDTo). All push live and take ONE undo
  // step opened here.
  const onGroupDimMove = (ev: PointerEvent) => {
    const st = groupDimDragRef.current;
    const api = apiRef.current;
    if (!st || !api) return;
    ev.preventDefault();
    if (st.mode === "w") {
      const fl = api.floorMetres(ev.clientX, ev.clientY, st.cYm);
      if (!fl) return;
      const along = (fl.x - st.fx) * 1000 * st.ux + (fl.z - st.fz) * 1000 * st.uz; // signed mm along the wall
      const grow = st.edge === "right" ? along : -along; // pull the grabbed end OUTWARD → wider
      const mm = Math.round((st.v0 + grow) / 10) * 10;
      if (Math.abs(along) > 3) st.moved = true;
      cbRef.current.onGroupW?.(0, st.edge, mm, true);
    } else if (st.mode === "h") {
      const h = Math.round((st.v0 + (st.grabY - ev.clientY) * (1000 / st.pxPerM)) / 10) * 10;
      if (Math.abs(ev.clientY - st.grabY) > 3) st.moved = true;
      cbRef.current.onGroupDim?.({ h }, true);
    } else {
      const fl = api.floorMetres(ev.clientX, ev.clientY, st.cYm);
      if (!fl) return;
      const into = (fl.x - st.fx) * 1000 * st.ix + (fl.z - st.fz) * 1000 * st.iz;
      const depth = Math.round((st.v0 + into) / 10) * 10;
      if (Math.abs(into) > 3) st.moved = true;
      cbRef.current.onGroupDim?.({ depth }, true);
    }
    api.invalidate();
  };
  const onGroupDimUp = () => {
    window.removeEventListener("pointermove", onGroupDimMove);
    window.removeEventListener("pointerup", onGroupDimUp);
    window.removeEventListener("pointercancel", onGroupDimUp);
    groupDimDragRef.current = null;
  };
  const beginGroupDrag = (e: React.PointerEvent, mode: "w" | "h" | "d") => {
    const grp = groupGizmoRef.current;
    const api = apiRef.current;
    if (!grp || !api) return;
    // WIDTH: choose the DRAGGABLE end nearest the tap (fall back to the only draggable one). If neither
    // end can grow (both pinned to a wall/corner) there's nothing to do.
    let edge: "left" | "right" = "right";
    if (mode === "w") {
      if (grp.leftDrag && grp.rightDrag) {
        const tapX = e.clientX - api.rect().left;
        edge = Math.abs(tapX - grp.lpx) <= Math.abs(tapX - grp.rpx) ? "left" : "right";
      } else if (grp.leftDrag) edge = "left";
      else if (grp.rightDrag) edge = "right";
      else return;
    }
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    cbRef.current.onBeginEdit?.(); // one undo step for the whole gesture
    const fl = mode === "h" ? null : api.floorMetres(e.clientX, e.clientY, grp.cYm);
    groupDimDragRef.current = {
      mode,
      v0: mode === "w" ? grp.total : mode === "h" ? grp.hVal : grp.dVal,
      grabY: e.clientY,
      pxPerM: mode === "h" ? api.pxPerMeterY(grp.ctrM.x, grp.ctrM.y, grp.ctrM.z) || 200 : 200,
      ix: grp.ix,
      iz: grp.iz,
      ux: grp.ux,
      uz: grp.uz,
      edge,
      fx: fl ? fl.x : 0,
      fz: fl ? fl.z : 0,
      cYm: grp.cYm,
      moved: false,
    };
    window.addEventListener("pointermove", onGroupDimMove);
    window.addEventListener("pointerup", onGroupDimUp);
    window.addEventListener("pointercancel", onGroupDimUp);
  };
  const onGroupWDown = (e: React.PointerEvent) => beginGroupDrag(e, "w");
  const onGroupHDown = (e: React.PointerEvent) => beginGroupDrag(e, "h");
  const onGroupDDown = (e: React.PointerEvent) => beginGroupDrag(e, "d");

  // ---- camera-walk joystick: drag the knob, the render loop walks the camera ----
  const JOY_R = 28; // knob travel radius (px, == svg units at 1:1)
  const setNavFrom = (clientX: number, clientY: number) => {
    let dx = clientX - joyCenter.current.cx;
    let dy = clientY - joyCenter.current.cy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
    joyKnobRef.current?.setAttribute("transform", `translate(${dx} ${dy})`);
    navRef.current = { x: dx / JOY_R, z: -dy / JOY_R }; // push up = walk forward
  };
  const onJoyDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = joyRef.current?.getBoundingClientRect();
    if (!rect) return;
    joyCenter.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    const onWinMove = (ev: PointerEvent) => { ev.preventDefault(); setNavFrom(ev.clientX, ev.clientY); };
    const blockTouch = (ev: TouchEvent) => ev.preventDefault();
    const onWinUp = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
      window.removeEventListener("touchmove", blockTouch);
      navRef.current = { x: 0, z: 0 };
      joyKnobRef.current?.setAttribute("transform", "translate(0 0)");
      apiRef.current?.invalidate();
    };
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
    window.addEventListener("touchmove", blockTouch, { passive: false });
    setNavFrom(e.clientX, e.clientY);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // THE QUALITY TIER. Pixel ratio is the biggest lever there is — fragment work (which is where
    // every light's cost lives) scales with its square — so it is the first thing a weak phone gives
    // up. `antialias` cannot be changed after construction, so it is read here and takes effect next
    // session; everything else is live.
    const tier0 = tierRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: tierSpec(tier0).antialias, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(pixelRatioFor(tier0));
    const w0 = mount.clientWidth || 320;
    const h0 = mount.clientHeight || 420;
    renderer.setSize(w0, h0);
    renderer.shadowMap.enabled = true; // soft shadows add depth/contrast
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // the depth pass is render-on-demand too — see invalidate()
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);
    // `?perf=1` → the frame-budget readout. Off (and free) otherwise.
    const hud = attachPerfHud(renderer, mount, "kitchen", () => `${tierRef.current}${wantAO ? " +AO" : ""}`);
    // measure the frames we actually draw; step the tier down (never up) if the device can't hold the
    // budget. Only the pixel ratio and the shadow map move — the light COUNT never does.
    const auto = autoTier(tier0, qualityRef.current === "auto");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 1.2;
    controls.maxDistance = 22;
    controls.target.set(0, 0.9, 0);

    // THE LIGHT — one rig, shared with every other scene in the app (three/lighting.ts). Tone mapping,
    // an environment for the indirect term, a key that comes through the room's real window, and the
    // ceiling spots. This used to be a hemisphere plus two directionals, hardcoded here.
    const rig = buildRig(scene, renderer, { preset: presetRef.current, tier: tierRef.current, shadowPx });
    if (sunRef.current) rig.setSun(sunRef.current.azimuth, sunRef.current.elevation);
    rig.setLampCount(lampRef.current);
    let mirror: Mirror | null = null;
    // AMBIENT OCCLUSION — the darkness in the crevices, which no lamp can produce (three/post.ts).
    // `draw()` is the ONLY way this scene renders from here on: straight to the canvas when AO is off,
    // through the composer when it is on.
    const post = buildPost(renderer, scene, camera, w0, h0, tierSpec(tier0).ao);
    const draw = () => post.render();
    // AO needs two yeses: the DEVICE can afford it (the quality tier's call) and the SELLER wants it
    // (the «Тени» switch). Whether any given FRAME gets it is a third question, answered by `settled`
    // in the loop below.
    let wantAO = tierSpec(tier0).ao && aoRef.current;
    // the painted-on contact shadows are a STAND-IN for AO. With the real thing running they would
    // THE PAINTED-ON CONTACT SHADOWS ARE A LAST RESORT, not a default.
    //
    // They exist to stop cabinets looking like they float, and there are now two real things that do
    // that job properly: the sun's cast shadows, and ambient occlusion. Drawing the decals on top of
    // either would just double the darkness and muddy it. So they appear only where neither is
    // available — the `low` tier, which has no depth pass and no AO — and that is the one place a phone
    // needs them.
    const syncDecals = () => {
      const needFake = !wantAO && tierRef.current === "low" && propsRef.current.mode !== "wire"; // «Линии» draws no shadows
      kitchen?.traverse((o) => {
        if (o.userData.decal) o.visible = needFake;
      });
    };

    let needs = true;
    /**
     * PROGRESSIVE REFINEMENT — the deal that makes ambient occlusion affordable on a phone.
     *
     * AO measured ~10ms a frame on a real iPhone: fine for a still picture, ruinous for a drag. But a
     * drag is the one moment nobody is studying the shadow under a cabinet — they are watching the
     * kitchen swing round. So: while anything is MOVING we render straight to the canvas with no AO at
     * full framerate, and once the movement stops we spend one more frame drawing the same view WITH
     * it. Every picture you actually sit and look at has the occlusion; nothing you drag ever waits for
     * it. CAD tools and planners have done this for decades, and our render-on-demand loop already had
     * the shape for it — `settled` is just "nobody has asked for a redraw in a moment".
     */
    const AO_SETTLE_MS = 120;
    let lastAsk = 0; // when the view last actually CHANGED
    let aoDrawn = false; // has the CURRENT view been drawn with AO yet?
    // "has the camera stopped?" — measured as MOVEMENT, not as events. OrbitControls has damping on, so
    // after you let go it keeps coasting and fires a `change` every single frame while it decays; a
    // settle timer keyed on those events waits for the whole tail (over a second) instead of for the
    // camera. Watching the actual delta lets us call it still as soon as it is crawling, which is what
    // the eye already thinks.
    const STILL = 0.002 * 0.002; // 2mm per frame, squared
    const camPrev = new THREE.Vector3();
    const tgtPrev = new THREE.Vector3();

    // TWO BUDGETS, TWO WATCHDOGS. The refinement frame is SUPPOSED to be slow — it renders the scene
    // twice (once more for normals) and then a sample loop. Measured on an iPhone: ~18ms while
    // dragging, ~52ms for the one settled frame. To the tier sampler, which knows nothing but frame
    // times, that 52ms is indistinguishable from a phone in trouble — so it would start stripping
    // quality because of a frame we deliberately asked to be expensive. So the tier only ever watches
    // the INTERACTIVE frames, and the refinement frame gets its own, much looser limit: if the picture
    // takes longer than this to settle, the wait itself is the problem and AO goes.
    // …and the FIRST refinement frame is never judged at all: it compiles the occlusion shaders, which
    // can take a second on its own and says nothing about what the frame after it will cost. Judging it
    // is what silently killed the shadows for the rest of the session.
    const AO_STALL_MS = 350;
    let aoStamp = 0;
    let aoStalls = 0;
    let aoFrames = 0;

    /**
     * Redraw next frame. `scene = false` means ONLY THE CAMERA MOVED.
     *
     * That distinction is worth a lot: the shadow map is a second, full render of every shadow-casting
     * mesh, and it used to be regenerated on every single redraw (`autoUpdate` defaults to true). But
     * orbiting cannot move a shadow — the light doesn't travel with the camera. So the depth pass is
     * render-on-demand too now: frozen, and refreshed only when the geometry, the room or the light
     * actually changes. Orbiting a finished kitchen pays nothing for it.
     */
    const invalidate = (scene = true) => {
      needs = true;
      lastAsk = performance.now();
      aoDrawn = false; // the view changed — whatever AO we drew is stale
      if (scene) renderer.shadowMap.needsUpdate = true;
    };
    // orbit = camera only → the shadows still hold, AND we do not touch the settle timer here: whether
    // the camera really moved is decided in the loop, by how far it went
    const onControls = () => {
      needs = true;
    };
    controls.addEventListener("change", onControls);

    let wood: THREE.Texture | null = null;
    let room: THREE.Group | null = null;
    let walls: WallInfo[] = [];
    let kitchen: THREE.Group | null = null;

    const buildRoom = () => {
      const s = propsRef.current;
      if (room) {
        scene.remove(room);
        disposeGroup(room);
      }
      wood?.dispose();
      wood = makeWoodTexture(s.coveringColor);
      const b = polygonBoundsMm(s.points);
      const innerMm = offsetPolygon(s.points, 100);
      const toM = (p: Pt) => ({ x: (p.x - b.cx) / 1000, z: (p.y - b.cy) / 1000 });
      const built = makeRoom(
        s.points.map(toM),
        innerMm.map(toM),
        s.ceiling / 1000,
        wood,
        s.openings,
        s.interiorWalls.map((poly) => poly.map(toM)),
        s.fittings,
        s.wallSurfaces,
        null,
        null,
        null,
        false,
      );
      room = built.group;
      walls = built.walls;
      room.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.receiveShadow = true; // floor + walls catch the kitchen's shadow
      });
      applyPbrFloor(room, s.coveringColor, s.floorId); // real floor material (shared with the room editor)

      // THE FLOOR REFLECTS. A planar mirror, built from the floor's own geometry — so it shows the real
      // cabinets from the real angle, including ones off the edge of the screen. It stays hidden until
      // the view settles, because it costs a second render of the scene. A technical drawing has no
      // reflections, so «Линии» skips it entirely.
      mirror?.dispose();
      mirror = null;
      if (reflectRef.current && propsRef.current.mode !== "wire") {
        let floorMesh: THREE.Mesh | null = null;
        room.traverse((o) => {
          if (o.userData.floor && (o as THREE.Mesh).isMesh) floorMesh = o as THREE.Mesh;
        });
        if (floorMesh) {
          mirror = buildMirror(floorMesh);
          if (mirror) room.add(mirror.mesh);
        }
      }

      // «Линии»: turn the whole room into grey line-art on a white sheet, so the black-outlined
      // cabinets read as the subject against it. Grey (not black) keeps the room a quiet backdrop; the
      // near walls self-cull toward the camera (updateCull), so their edges never clutter the front.
      if (s.mode === "wire") technicalize(room, EDGE_ROOM);
      renderer.domElement.style.background = s.mode === "wire" ? PAPER : ""; // paper for the drawing, else the CSS default

      scene.add(room);
      // the daylight comes through the window the seller actually drew, and the shadow frustum is cut
      // to this room's walls (it used to be a fixed ±4m box, so a big room lost its shadows)
      rig.aim({ points: s.points, openings: s.openings, ceiling: s.ceiling });
      invalidate();
    };

    // emissive tint of one module: red = overlap warning, green = selected, null = clear
    const REDC = new THREE.Color(RED);
    const SELC = new THREE.Color(SEL);
    const BLACKC = new THREE.Color(0, 0, 0);
    const WHITEC = new THREE.Color(0xffffff);
    const tintCab = (id: string, color: number | null) => {
      if (!kitchen) return;
      // In «Линии» the fill IS emissive white (see technicalize), so "clear" can't drop emissive to 0 —
      // that would paint the module solid black. Clearing there restores the paper-white; select/clash
      // still tint on top of it, so a module reads green/red exactly as in the realistic modes.
      const wire = propsRef.current.mode === "wire";
      for (const child of kitchen.children) {
        if (child.userData.cabId !== id) continue;
        child.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mm of mats) {
            const m = mm as THREE.MeshStandardMaterial;
            if ("emissive" in m) {
              m.emissive = color === RED ? REDC : color === SEL ? SELC : wire ? WHITEC : BLACKC;
              m.emissiveIntensity = color == null ? (wire ? 1 : 0) : 0.5;
              m.needsUpdate = true;
            }
          }
        });
      }
    };

    // WHICH MODULE IS PICKED — a tint, not a rebuild.
    //
    // Selecting a cabinet used to tear the entire kitchen down and build it again (`selectedId` was
    // in setKitchen's dependency list): every geometry, every material, for a colour change. The
    // machinery to do it in place was already right here.
    //
    // A module that clashes with a neighbour stays RED even while it's selected — the warning
    // outranks the highlight, which is the order the rebuild happened to produce.
    let selId: string | null = null;
    let clashIds = new Set<string>();
    const paintCab = (id: string) => tintCab(id, clashIds.has(id) ? RED : id === selId ? SEL : null);

    // ── THE GREEN OUTLINE, ON THE FACE ────────────────────────────────────────────────────────
    // A rectangle drawn around the selected module's FRONT FACE — the same green the sheet uses,
    // so a cabinet reads as "selected" identically in both views. A tint alone tells you which box
    // is picked; an outline on the face tells you where its EDGES are, which is what you are about
    // to grab.
    //
    // Built from the model (placement + the module's own x/w/band/depth), NOT from the mesh's
    // bounding box: a corner unit is a chamfered prism and a box would sit proud of it, and a wall
    // that isn't axis-aligned would give a box in the wrong basis entirely.
    let outline: THREE.LineSegments | null = null;
    const clearOutline = () => {
      if (!outline) return;
      scene.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
      outline = null;
    };
    // the 8 edge vertices (4 line segments) of one module's front face, in world space — empty for a
    // free/island module (no wall to draw against)
    const outlinePts = (id: string): number[] => {
      const cab = lastCabs.find((c) => c.id === id);
      if (!cab) return [];
      const s2 = propsRef.current;
      const { runs } = planRuns(s2.points, s2.waterWall, s2.layout, s2.openings, lastCabs, s2.reveal);
      const run = runs[cab.run ?? 0];
      if (!run || run.kind !== "wall" || cab.x == null || cab.px != null) return [];
      const grid = (propsRef.current.grids ?? {})[cab.run ?? 0];
      const off = grid?.off ?? 0;
      const p = run.placement;
      const b = cabBand(cab);
      const d = cabDepth(cab) / 1000;
      const OUT = 0.006; // a few mm proud of the face, so it never z-fights the door
      const x0 = (cab.x + off) / 1000;
      const x1 = (cab.x + off + cab.w) / 1000;
      const F = (xM: number, yMm: number): [number, number, number] => [
        p.ax + p.ux * xM + p.ix * (d + OUT),
        yMm / 1000,
        p.az + p.uz * xM + p.iz * (d + OUT),
      ];
      return [
        F(x0, b.y0), F(x1, b.y0),
        F(x1, b.y0), F(x1, b.y1),
        F(x1, b.y1), F(x0, b.y1),
        F(x0, b.y1), F(x0, b.y0),
      ].flat();
    };
    const drawOutlines = (ids: string[]) => {
      clearOutline();
      const pts = ids.flatMap(outlinePts);
      if (!pts.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      outline = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: SEL, depthTest: false, transparent: true }));
      outline.renderOrder = 999; // always visible, even through the door in front of it
      scene.add(outline);
    };
    const drawOutline = (id: string | null) => drawOutlines(id ? [id] : []);

    let selMany: string[] = []; // the multi-selection currently tinted green
    const setSelected = (id: string | null) => {
      // clear any multi-tint first (single and multi share the emissive channel)
      if (selMany.length) { const prev = selMany; selMany = []; for (const p of prev) tintCab(p, clashIds.has(p) ? RED : null); }
      if (selId === id) { drawOutline(id); return; }
      const prev = selId;
      selId = id;
      if (prev) paintCab(prev);
      if (id) paintCab(id);
      drawOutline(id);
      invalidate(false); // a colour changed; no geometry moved, so the shadows still hold
    };

    // MULTI-SELECT: tint EVERY selected module green AND outline it — the tint is what makes the
    // selection obvious at a glance; the outline pins its edges. A clashing module stays red.
    const setSelectedMany = (ids: string[]) => {
      if (selId) { const prev = selId; selId = null; tintCab(prev, clashIds.has(prev) ? RED : null); }
      for (const id of selMany) if (!ids.includes(id)) tintCab(id, clashIds.has(id) ? RED : null); // un-tint dropped
      selMany = ids;
      for (const id of ids) tintCab(id, clashIds.has(id) ? RED : SEL);
      drawOutlines(ids);
      invalidate(false);
    };

    // open/close a module's doors + drawers (amount 0..1): hinge doors, slide drawers
    /** swing/slide ONE openable subgroup */
    const moveFront = (o: THREE.Object3D, amount: number) => {
      const od = o.userData.openable as { kind: string; axis?: string; rad?: number; maxRad?: number; maxZ?: number };
      if (od.kind === "door") {
        const rad = od.rad ?? -(od.maxRad ?? 0); // legacy maxRad = left hinge (−y)
        if (od.axis === "x") o.rotation.x = amount * rad; // top/bottom hydraulic lift
        else o.rotation.y = amount * rad;
      } else o.position.z = amount * (od.maxZ ?? 0);
    };

    /**
     * Open something. The key is EITHER a module id (everything on it swings) OR one front's own
     * `cabId#n` — because tapping a single drawer should pull out that drawer, not the whole bank.
     * The per-front keys are handed out in setKitchen, in build order, so they survive a rebuild.
     */
    const applyOpen = (key: string, amount: number) => {
      const perFront = key.includes("#");
      const cabId = perFront ? key.slice(0, key.indexOf("#")) : key;
      const grp = kitchen?.children.find((o) => o.userData.cabId === cabId);
      if (!grp) return;
      grp.traverse((o) => {
        if (!o.userData.openable) return;
        if (perFront && o.userData.openKey !== key) return;
        moveFront(o, amount);
      });
    };

    // ── THE SHEET, ON THE WALL ────────────────────────────────────────────────────────────────
    // Every column line and row line of each wall's grid, drawn a millimetre proud of the plaster.
    // On a bare wall this is the whole feature: you can see the cells before there is any furniture.
    //
    // The wall basis comes from runPlan's `placement` — `a` is wall-space x=0, `u` runs along the
    // wall, `i` points into the room. That is the SAME basis the modules are placed on, so a lattice
    // line at wall-space x lands exactly on the module edge that sits there.
    let lattice: THREE.Group | null = null;
    /** the tappable empty-cell panels, for picking */
    let cellPanels: THREE.Object3D[] = [];
    /** the KNOBS — the round handles at the end of every draggable grid line. THESE are the drag
     *  targets; the lines themselves are not grabbable at all. */
    let lineHandles: THREE.Mesh[] = [];
    /** A knob is a flat disc that BILLBOARDS to the camera and holds a constant SCREEN size — so it
     *  stays a proper touch target however far the camera is, and never turns edge-on as you orbit.
     *  Sized every frame in `sizeKnobs`.
     *
     *  It is TWO discs. The visible dot is 10px (20px across — small and tidy, per the on-device
     *  note that the old dot read too big); the disc that actually catches the finger is an invisible
     *  18px (36px across — still the size a thumb needs). A target you can see but not reliably hit is
     *  worse than no target at all, and a dot big enough to hit reliably would litter the room. */
    const DOT_PX = 10;
    const HIT_PX = 18;
    /** THICKNESS of a grid line (m). A LINE cannot be thickened — WebGL ignores
     *  `LineBasicMaterial.linewidth` on every platform that matters — so a "line" here is a thin BOX.
     *  That is also what lets it sit on a cabinet's face instead of on the plaster behind it. */
    const LINE_T = 0.016;
    // Rebuilt with the lattice: `disposeGroup` destroys the geometry and materials of everything in
    // the group, so anything shared across rebuilds would be disposed out from under the next one.
    let knobMat = new THREE.MeshBasicMaterial({ color: RESIZE_YEL, depthTest: false, transparent: true });
    let knobHot = new THREE.MeshBasicMaterial({ color: RESIZE_YEL_HOT, depthTest: false, transparent: true });
    /** every disc that needs per-frame sizing (dots AND their invisible pick discs) */
    let knobMeshes: THREE.Mesh[] = [];
    /** each wall's basis, cached so a line drag can turn a pointer ray into wall-space mm */
    const wallBasis = new Map<number, PlannedRun["placement"]>();
    /** THE DIMENSION STRINGS — a number in every gap between two lines: column widths along the top,
     *  row heights down the side. These are the sheet's COLUMN HEADERS and ROW NUMBERS, and they are
     *  the thing that turns a lattice into a spreadsheet: you can read the whole run's setting-out at
     *  a glance instead of grabbing each border to find out what it currently is.
     *
     *  Drawn as SVG in the overlay, not as 3D text: crisp at any distance, constant size, and no
     *  font atlas to ship. They are re-projected every frame, so they track the camera. */
    let dimAnchors: { p: THREE.Vector3; t: string }[] = [];
    let dimsDirty = true;

    const setLattice = (grids: Grids, forCabs: Cabinet[]) => {
      if (lattice) {
        scene.remove(lattice);
        disposeGroup(lattice);
        lattice = null;
      }
      cellPanels = [];
      lineHandles = [];
      knobMeshes = [];
      groupGizmoRef.current = null; // re-stamped below only when a resizable group is selected
      dimAnchors = [];
      dimsDirty = true;
      wallBasis.clear();
      const s = propsRef.current;
      const room: Room = { points: s.points, waterWall: s.waterWall, layout: s.layout, openings: s.openings, reveal: s.reveal };
      const { runs } = planRuns(s.points, s.waterWall, s.layout, s.openings, forCabs, s.reveal);
      const L = resolveLayout(forCabs, room);
      const g = new THREE.Group();

      // A GRIDDED module is selected (has a cell, not free-placed) → we've just placed/picked it, so
      // instead of every empty cell on every wall we show only the spots immediately LEFT/RIGHT of it,
      // on its own wall, as ghost cubes ("the next one goes here"). Its wall-space span comes from the
      // resolved elevation so we can find its two neighbours. Nothing selected → the browse grid.
      const selCabL = s.selectedId ? forCabs.find((c) => c.id === s.selectedId) : null;
      const selRunL = selCabL && selCabL.px == null && selCabL.cell ? (selCabL.run ?? 0) : null;
      const selRowL = selCabL?.cell?.r ?? null;
      const selSlotL = selRunL != null ? L.elevation(selRunL).find((e) => e.id === s.selectedId) : null;
      // ANYTHING selected (several modules, or a single FREE one like a corner/island) — the user is
      // ADJUSTING, not adding. So show NO placement affordances at all (no browse grid, no ghost cubes,
      // no gray "+ ряд" panel); only a single GRIDDED module gets the left/right "next here" cubes.
      const anySel = !!s.selectedId || (s.selectedIds?.length ?? 0) > 0;

      // fresh per rebuild — see the note where knobMat is declared
      const knobGeo = new THREE.CircleGeometry(1, 24);
      const knobHit = new THREE.MeshBasicMaterial({ visible: false });
      // YELLOW resize handles (was brand green): the user reported the green lines/knobs read as
      // near-invisible against the wood + white kitchen. A saturated amber-yellow stands out on both.
      knobMat = new THREE.MeshBasicMaterial({ color: RESIZE_YEL, depthTest: false, transparent: true });
      knobHot = new THREE.MeshBasicMaterial({ color: RESIZE_YEL_HOT, depthTest: false, transparent: true });
      // depthTest off: a grid line you cannot see because a cabinet is in front of it is no use in a
      // perspective view — which is the whole complaint the wall-drawn lines earned.
      const lineMat = new THREE.MeshBasicMaterial({ color: 0x00ac7a, depthTest: false, transparent: true, opacity: 0.9 });
      // EMPTY CELLS are drawn as green OUTLINES now, not a filled panel — the translucent fill read as
      // a distracting green wash across the whole wall. Two looks: a THIN batched line grid for the
      // browse squares (cheap — one draw call per wall, however many cells), and a THICKER box-edge
      // material for the few "place next here" ghost cubes beside a selection (prominent, only ever 2).
      const cellLineMat = new THREE.LineBasicMaterial({ color: 0x00c489, depthTest: false, transparent: true, opacity: 0.9 });
      const cubeMat = new THREE.MeshBasicMaterial({ color: 0x00c489, depthTest: false, transparent: true, opacity: 0.95 });

      // WHICH WALLS GET A SHEET. The grid is a property of the ROOM, not of the kitchen shape: every
      // wall the layout gives us is ALWAYS gridded and ALWAYS buildable. The seller's «Сетка» toggle
      // only decides whether the LINES are drawn — even hidden, the cells stay tappable, so "turn the
      // grid off" means "hide the lines", never "stop being able to build". `linesHidden` is that
      // switch; `want === "off"` still short-circuits to a fully realistic room (used elsewhere).
      const want = s.sheet ?? "auto";
      if (want === "off") { lattice = g; scene.add(g); invalidate(); return; }
      const linesHidden = s.gridLines === false;

      for (const [key, grid] of Object.entries(grids)) {
        const r = Number(key);
        const run = runs[r];
        if (!run || run.kind !== "wall" || !grid) continue;
        const p = run.placement;
        // wall-space (x mm along the wall, y mm above the floor, `out` mm INTO the room) → world
        // metres. `placement` is already expressed about the room centre, which is the scene origin.
        const P = (xMm: number, yMm: number, outMm = 0): [number, number, number] => [
          p.ax + p.ux * (xMm / 1000) + p.ix * (outMm / 1000),
          yMm / 1000,
          p.az + p.uz * (xMm / 1000) + p.iz * (outMm / 1000),
        ];
        const basis = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(p.ux, 0, p.uz),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(p.ix, 0, p.iz),
        );

        // ── A GRID LINE LIVES ON THE CABINET FACES, NOT ON THE WALL ───────────────────────────
        //
        // Drawn on the plaster, a line is metres behind the thing it is dividing. In an orthographic
        // front view that is invisible; in PERSPECTIVE it shears away from the cabinet edge it is
        // supposed to mark, and you cannot tell which line belongs to which cabinet — which is
        // exactly what went wrong.
        //
        // So each line is drawn at the DEPTH OF THE ROW it is crossing: 560mm out over the base row,
        // 350mm over the wall units. A column line therefore STEPS as it crosses the worktop, and it
        // traces the real silhouette of the run — the edge your eye already follows.
        const rowDepth = (j: number) => grid.rows[j]?.depth ?? 560;
        // a border between two rows sits on whichever is DEEPER, so it lands on the front edge that
        // actually sticks out (the worktop's nose, the underside of the wall units)
        const borderDepth = (j: number) => Math.max(rowDepth(j), rowDepth(j + 1));

        const bar = (x0: number, y0: number, x1: number, y1: number, dMm: number) => {
          const lx = Math.abs(x1 - x0) / 1000;
          const ly = Math.abs(y1 - y0) / 1000;
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(lx, LINE_T), Math.max(ly, LINE_T), LINE_T),
            lineMat,
          );
          m.quaternion.setFromRotationMatrix(basis);
          m.position.set(...P((x0 + x1) / 2, (y0 + y1) / 2, dMm + 8)); // 8mm proud of the face
          m.renderOrder = 997;
          g.add(m);
        };

        // ── EMPTY-CELL OUTLINES ───────────────────────────────────────────────────────────────
        // BROWSE GRID (Task 2): each empty cell is a thin outline square, accumulated into ONE
        // LineSegments per wall (flushed after the cell loop) — cheap however many cells there are.
        const gridSegs: number[] = [];
        const seg = (x0: number, y0: number, d0: number, x1: number, y1: number, d1: number) => {
          gridSegs.push(...P(x0, y0, d0), ...P(x1, y1, d1));
        };
        const cellSquare = (x: number, y0: number, y1: number, w: number, dMm: number) => {
          const ins = Math.min(24, w * 0.1, (y1 - y0) * 0.1); // inset so it's its own marker, not a doubled divider
          const xL = x + ins, xR = x + w - ins, yB = y0 + ins, yT = y1 - ins;
          seg(xL, yB, dMm, xR, yB, dMm); seg(xL, yT, dMm, xR, yT, dMm);
          seg(xL, yB, dMm, xL, yT, dMm); seg(xR, yB, dMm, xR, yT, dMm);
        };
        // GHOST CUBE (Task 3): the module's whole volume from the wall (depth ~0) to its face, as a
        // wireframe of thick box edges (prominent — only ever the 2 cells beside a selected module).
        const CUBE_T = 0.014;
        const boxEdge = (x0: number, y0: number, d0: number, x1: number, y1: number, d1: number) => {
          const a = new THREE.Vector3(...P(x0, y0, d0));
          const b = new THREE.Vector3(...P(x1, y1, d1));
          const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(a.distanceTo(b), CUBE_T), CUBE_T, CUBE_T), cubeMat);
          m.position.copy(a).lerp(b, 0.5);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
          m.renderOrder = 999;
          g.add(m);
        };
        const ghostCube = (x: number, y0: number, y1: number, w: number, dMm: number) => {
          const ins = Math.min(20, w * 0.08);
          const xL = x + ins, xR = x + w - ins, yB = y0 + 12, yT = y1 - 12;
          for (const d of [24, dMm]) { // back rectangle (on the wall) + front rectangle (at the face)
            boxEdge(xL, yB, d, xR, yB, d); boxEdge(xL, yT, d, xR, yT, d);
            boxEdge(xL, yB, d, xL, yT, d); boxEdge(xR, yB, d, xR, yT, d);
          }
          for (const [ex, ey] of [[xL, yB], [xR, yB], [xL, yT], [xR, yT]] as const) boxEdge(ex, ey, 24, ex, ey, dMm); // 4 connectors
        };


        wallBasis.set(r, p);

        const ysL = rowEdges(grid);

        // ── COLUMN LINES, PER BAND ────────────────────────────────────────────────────────────
        // Columns are per-band now, so each band draws its OWN divider lines, within its own
        // y-range and at its own depth — a thin bar on the cabinet faces, not a full-height line and
        // no floating knobs (that always-on lattice read as an architectural sketch). Editing the
        // grid in 3D happens by grabbing a cabinet's FACE (gridSetCabW) or in the front view; the
        // scene's job here is just to SHOW the divisions and offer the empty cells.
        grid.rows.forEach((row, jRow) => {
          if (row.kind === "void") return;
          const d = rowDepth(jRow);
          let x = 0;
          for (let ci = 0; ci < row.cols.length; ci++) {
            x += row.cols[ci].w;
            if (x >= grid.wallLen - 1) break; // the wall's own end, not a divider
            if (!linesHidden) bar(x, ysL[jRow], x, ysL[jRow + 1], d);
            // GRAB-AND-DRAG: an invisible pick SLAB at this border (sticks into the room so you can
            // grab it anywhere along its height, not just where it hugs the wall). Skip a locked
            // column (corner zone / tall) — its width is structural. Hidden lines = nothing to grab.
            if (!linesHidden && !row.cols[ci].lock && cbRef.current.onColW) {
              const slab = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, Math.max(0.05, (ysL[jRow + 1] - ysL[jRow]) / 1000), 0.6),
                knobHit,
              );
              slab.quaternion.setFromRotationMatrix(basis);
              slab.position.set(...P(x, (ysL[jRow] + ysL[jRow + 1]) / 2, d + 100));
              slab.userData.line = { kind: "col", run: r, rowId: row.id, i: ci };
              g.add(slab);
              lineHandles.push(slab);
            }
          }
        });
        // row boundary lines, wall-long, on the deeper of the two bands they divide
        if (!linesHidden)
          for (let j = 0; j < grid.rows.length - 1; j++) {
            bar(0, ysL[j + 1], grid.wallLen, ysL[j + 1], borderDepth(j));
          }

        // ── THE EMPTY CELLS, TAPPABLE ─────────────────────────────────────────────────────────
        // The same `openCells` the front view uses, so the scene offers EXACTLY the cells the sheet
        // does — no second opinion about what is free. Tap one and you get a module at the cell's
        // size, without ever leaving the 3D. That is the whole "Excel in 3D": the wall is divided
        // before there is any furniture, and every division is a place you can put some.
        // Only the ACTIVE band offers cells — the bottom panel's tab decides which row you're building
        // (1-й/до потолка → floor, 2-й → first wall row, 3-й → second), so a tap lands in that band and
        // the scene shows just that one row of targets (far calmer than every cell on every wall).
        const band = s.placeBand;
        // A "real" upper band sits ABOVE the backsplash: its bottom clears the worktop by a good
        // margin. So 2-й/3-й only ever target genuine upper rows and never a stray wall row that lands
        // in the base↔upper gap — where the user rightly says nothing but a floor-to-ceiling unit goes.
        const counterTop = ysL[1] ?? 0; // top of the floor (base) row ≈ worktop height
        const upperRows = grid.rows
          .map((_, j) => j)
          .filter((j) => grid.rows[j].kind === "wall" && ysL[j] >= counterTop + 450);
        const rowInBand = (rowKind: string, j: number) => {
          if (!band) return true; // no active band (e.g. a module is selected) → all cells, as before
          if (band === "extra") return false; // free-standing → no wall cells
          if (band === "corner") return false; // corner chip: you TAP a cabinet to turn it into a corner (pick3d), not a cell
          if (band === "r1" || band === "tall") return rowKind === "floor";
          if (band === "r2") return j === upperRows[0];
          if (band === "r3") return j === upperRows[1];
          return true;
        };
        // WHICH cells to offer, and how they're drawn:
        //  • a GRIDDED module is selected → only the two spots immediately LEFT/RIGHT of it, in its own
        //    row on its own wall, as ghost CUBES ("place the next one here") — declutters after a place.
        //  • nothing selected → the armed band's empty cells, as flat outline SQUARES (the browse grid).
        // The green OUTLINE (Task 2/3) replaces the old filled panel; an invisible plane is the tap
        // target in both cases, so picking behaves exactly as before.
        const selWall = selRunL != null && selRunL === r;
        const selLeft = selWall ? selSlotL?.elev[0]?.x ?? null : null; // wall-space left edge of the selection
        const selRight = selLeft != null && selSlotL ? selLeft + selSlotL.w : null;
        const ADJ = 40; // mm: how close a cell edge must be to count as "flush against" the selection
        grid.rows.forEach((row, jRow) => {
          if (row.kind === "void") return;
          if (selRunL != null) { if (!selWall || row.id !== selRowL) return; } // only the selection's row+wall
          else if (anySel) return; // multi-select or a free single (corner/island) → no placement cells
          else if (!rowInBand(row.kind, jRow)) return;
          const d = rowDepth(jRow);
          for (const cell of openCells(grid, jRow, forCabs, L, r, s.ceiling, s.openings, s.fittings)) {
            const wM = cell.w / 1000;
            const hM = (ysL[jRow + 1] - ysL[jRow]) / 1000;
            if (wM < 0.05 || hM < 0.05) continue;
            if (selRunL != null) {
              // keep only the cells touching the selected module's left or right edge
              if (selLeft == null || selRight == null) continue;
              const adj = Math.abs(cell.x + cell.w - selLeft) < ADJ || Math.abs(cell.x - selRight) < ADJ;
              if (!adj) continue;
              ghostCube(cell.x, ysL[jRow], ysL[jRow + 1], cell.w, d);
            } else {
              cellSquare(cell.x, ysL[jRow], ysL[jRow + 1], cell.w, d);
            }
            // invisible pick plane (full cell) — the tap target, addressed straight into addCabInCell
            const cx = cell.x + cell.w / 2;
            const cy = (ysL[jRow] + ysL[jRow + 1]) / 2;
            const hit = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), knobHit);
            hit.quaternion.setFromRotationMatrix(basis);
            hit.position.set(...P(cx, cy, d));
            hit.userData.cell = { run: r, c: cell.c, r: row.id, cs: cell.cs };
            hit.renderOrder = 996;
            g.add(hit);
            cellPanels.push(hit);
          }
        });

        // ── GROUP RESIZE HANDLES ──────────────────────────────────────────────────────────────────
        // A SINGLE cabinet's width/height/depth are resized with the SVG arrow-gizmo (with live mm),
        // the one resize UI for both free and grid modules (see updateGizmo). The GROUP case — SEVERAL
        // modules selected — gets its OWN matching visual: a combined-width arrow (drawn in the SVG
        // overlay from `groupGizmoRef`) with a round grab knob at each end. Dragging an end scales them
        // ALL together (onGroupW), the column past that edge absorbing it — something the single-module
        // arrows can't express. Each of the three group arrows is DRAGGABLE via its own SVG hit line
        // (see beginGroupDrag / updateGizmo), so there are no in-scene grab meshes here any more.

        // GROUP RESIZE — ≥2 gridded modules selected, all on THIS wall + one row, in a contiguous run:
        // ONE yellow handle on each OUTER edge of the run. Dragging scales every member together
        // (proportional to their widths), the column just past the edge absorbing the change. This is
        // the multi-select answer to the per-cabinet width lines — "resize all of these as a block".
        // The arrow must NEVER be a partial/misleading one: it appears only when the WHOLE selection is
        // exactly what `resizeSelectedSpan` (and the front panel's `selResizable`) can act on — every
        // gridded selected module on THIS wall, in ONE row, a CONTIGUOUS column run with no locked
        // column inside it. A selection that crosses the corner onto another wall (different run) fails
        // `allHere`, so no arrow shows there and the panel's «Общая ширина» goes read-only — the two now
        // agree instead of one saying 1960 while the arrow scales only 1400.
        const selGroup = s.selectedIds ?? [];
        if (selGroup.length >= 2 && cbRef.current.onGroupW) {
          const griddedSel = selGroup
            .map((id) => forCabs.find((c) => c.id === id))
            .filter((c): c is Cabinet => !!c && c.px == null && !!c.cell);
          const mem = griddedSel.filter((c) => (c.run ?? 0) === r);
          const rowId = mem[0]?.cell?.r;
          const allHere = griddedSel.length >= 2 && mem.length === griddedSel.length; // none on another wall
          if (allHere && rowId && mem.every((c) => c.cell?.r === rowId)) {
            const jSel = grid.rows.findIndex((rr) => rr.id === rowId);
            const rowSel = grid.rows[jSel];
            if (rowSel) {
              const spans = mem
                .map((c) => {
                  const i = rowSel.cols.findIndex((col) => col.id === c.cell!.c);
                  return { i0: i, i1: i + Math.max(1, c.cell!.cs ?? 1) - 1 };
                })
                .sort((a, b) => a.i0 - b.i0);
              let contiguous = spans[0].i0 >= 0;
              let gi0 = spans[0].i0;
              let gi1 = spans[0].i1;
              for (let k = 1; k < spans.length; k++) {
                if (spans[k].i0 !== gi1 + 1) { contiguous = false; break; }
                gi1 = spans[k].i1;
              }
              // a locked column inside the run (e.g. a corner reach strip an upper sits in) makes the
              // whole span non-scalable — resizeSpan would refuse, so don't offer the arrow.
              let spanLocked = false;
              for (let k = gi0; k <= gi1; k++) if (rowSel.cols[k]?.lock) { spanLocked = true; break; }
              if (contiguous && gi0 >= 0 && !spanLocked) {
                const edges = colEdges(rowSel);
                const y0 = ysL[jSel];
                const y1 = ysL[jSel + 1];
                const d = rowDepth(jSel);
                const midY = (y0 + y1) / 2;
                const total = edges[gi1 + 1] - edges[gi0]; // the group's combined width (mm), drag base
                // WIDTH grows from whichever OUTER edge has room: the column before/after must exist and
                // be unlocked. (A wall end or a corner zone can't absorb, so that side is pinned.)
                const leftDrag = gi0 > 0 && !rowSel.cols[gi0 - 1].lock;
                const rightDrag = gi1 + 1 < rowSel.cols.length && !rowSel.cols[gi1 + 1].lock;
                // DEPTH is coupled to a corner: a base made shallower than the 840 corner square steps
                // back from it ("separates"). So the depth arrow is offered only when NEITHER neighbour
                // is a corner ZONE (dead & not a tall shadow). A middle-of-the-wall group edits freely.
                const cb = gi0 > 0 ? rowSel.cols[gi0 - 1] : null;
                const ca = gi1 + 1 < rowSel.cols.length ? rowSel.cols[gi1 + 1] : null;
                const bordersCorner = (!!cb?.dead && !cb.tall) || (!!ca?.dead && !ca.tall);
                // HEIGHT applies to uppers/tall only (a base's height IS the counter). DEPTH per above.
                // Values come off the first member — a group shares a row, so they match; dimSelected
                // then writes the dragged value to every member.
                const isUpperGroup = mem.every((c) => c.kind === "upper" || c.kind === "tall");
                const hMm = Math.round(mem[0].h ?? y1 - y0);
                const mountYMm = Math.round(mem[0].mountY ?? y0);
                const dMm = Math.round(mem[0].depth ?? d);
                // Stamp all three arrows for the SVG overlay — each is now DRAGGABLE via its own SVG hit
                // (see beginGroupDrag): WIDTH along the top (→ onGroupW), HEIGHT up the right edge and
                // DEPTH along the left edge (→ onGroupDim). `ux/uz` project the width drag onto the wall;
                // `ix/iz/cYm/ctrM` feed the height/depth maths. `lpx/rpx` are filled in updateGizmo.
                groupGizmoRef.current = {
                  leftW: new THREE.Vector3(...P(edges[gi0], y1, d)),
                  rightW: new THREE.Vector3(...P(edges[gi1 + 1], y1, d)),
                  total,
                  ux: p.ux, uz: p.uz, leftDrag, rightDrag, lpx: 0, rpx: 0,
                  hB: isUpperGroup ? new THREE.Vector3(...P(edges[gi1 + 1], mountYMm, d)) : null,
                  hT: isUpperGroup ? new THREE.Vector3(...P(edges[gi1 + 1], mountYMm + hMm, d)) : null,
                  hVal: hMm,
                  dB: new THREE.Vector3(...P(edges[gi0], y0, 0)),
                  dF: new THREE.Vector3(...P(edges[gi0], y0, d)),
                  dVal: dMm,
                  dOk: !bordersCorner,
                  ix: p.ix,
                  iz: p.iz,
                  cYm: midY / 1000,
                  ctrM: new THREE.Vector3(...P((edges[gi0] + edges[gi1 + 1]) / 2, midY, d)),
                };
              }
            }
          }
        }

        // ── "+ РЯД" / 3-й ряд target — the highest convertible dead-wall void. Its behaviour depends
        // on mode, so it never sits there as a mystery gray box you tap by accident:
        //   • grid-editing (no armed band): the classic "turn this void into a row" (onAddRow)
        //   • «3-й ряд» with only ONE upper row so far: THIS is the third-row target — one tap makes
        //     the row AND drops the armed module into it (onPlaceTopRow)
        //   • any other band (1-й/2-й/до потолка/Extra): suppressed — you're not editing rows here
        // suppressed while ANYTHING is selected (the gray "+ ряд" panel appearing when you pick a corner
        // was bug 3). Only in the build state (nothing selected) and only for «3-й ряд» with one upper
        // row so far — that is the top-row target. The band-control pill carries its own «+ ряд».
        const showAddRow = !anySel && band === "r3" && upperRows.length < 2;
        let voidJ = -1;
        if (showAddRow)
          for (let j = 0; j < grid.rows.length; j++) {
            if (grid.rows[j].kind === "void" && ysL[j + 1] - ysL[j] >= ROW_MIN + 50) voidJ = j;
          }
        if (voidJ >= 0) {
          const wM = grid.wallLen / 1000;
          const hM = (ysL[voidJ + 1] - ysL[voidJ]) / 1000;
          if (wM >= 0.05 && hM >= 0.05) {
            // draw it like every other placement target — a GREEN outline spanning the antresol void,
            // NOT the old gray panel that read as a mystery highlight. One tap makes the third row and
            // drops the armed module into it (onPlaceTopRow via the invisible pick plane).
            cellSquare(0, ysL[voidJ], ysL[voidJ + 1], grid.wallLen, rowDepth(voidJ));
            const hit = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), knobHit);
            hit.quaternion.setFromRotationMatrix(basis);
            hit.position.set(...P(grid.wallLen / 2, (ysL[voidJ] + ysL[voidJ + 1]) / 2, rowDepth(voidJ)));
            hit.userData.placeTopRow = { run: r };
            hit.renderOrder = 996;
            g.add(hit);
            cellPanels.push(hit);
          }
        }

        // flush this wall's outline squares (browse grid + the antresol target) as ONE LineSegments
        if (gridSegs.length) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(gridSegs, 3));
          const ls = new THREE.LineSegments(geo, cellLineMat);
          ls.renderOrder = 998;
          g.add(ls);
        }
      }

      lattice = g;
      scene.add(g);
      sizeKnobs(); // never let a knob reach the renderer at its default 1-metre scale
      // The line being held has MOVED (that is the whole point of the drag), so re-place its bar and
      // its number against the track the grid just committed.
      if (lineDrag) {
        showBar(lineDrag);
        lineChip(lineDrag, ptr.x, ptr.y);
        // the knobs were just rebuilt — re-mark the one still under the finger
        const k = lineHandles.find((m) => {
          const l = m.userData.line as { kind: string; run: number; rowId?: string; i: number; edge?: string };
          return (
            l.kind === lineDrag!.kind &&
            l.run === lineDrag!.run &&
            l.i === lineDrag!.i &&
            (l.kind !== "col" || l.rowId === lineDrag!.rowId) &&
            (l.kind !== "group" || l.edge === lineDrag!.edge) // two group edges share kind/i — split by edge
          );
        });
        grabKnob(k ?? null);
      }
      invalidate();
    };

    // last kitchen inputs — so a live resize preview can rebuild off the real cabs/style
    let lastCabs: Cabinet[] = cabs;
    let lastStyle: KitchenStyle = style;
    const setKitchen = (next: Cabinet[], nextStyle: KitchenStyle) => {
      lastCabs = next;
      lastStyle = nextStyle;
      if (kitchen) {
        scene.remove(kitchen);
        disposeGroup(kitchen);
      }
      const s = propsRef.current;
      const { runs } = planRuns(s.points, s.waterWall, s.layout, s.openings, next, s.reveal);
      const rb = polygonBoundsMm(s.points);
      kitchen = buildKitchen(
        next,
        runs.map((r) => ({ placement: r.placement, kind: r.kind, revealStart: r.revealStart, revealEnd: r.revealEnd })),
        nextStyle,
        { cx: rb.cx, cy: rb.cy },
        s.ceiling,
      );
      kitchen.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.userData.decal) return; // a painted-on shadow must not cast one of its own
        m.castShadow = true;
        m.receiveShadow = true;
      });
      // name every door and drawer, so one of them can be tapped on its own
      for (const grp of kitchen.children) {
        const cabId = grp.userData.cabId as string | undefined;
        if (!cabId) continue;
        let n = 0;
        grp.traverse((o) => {
          if (o.userData.openable) o.userData.openKey = `${cabId}#${n++}`;
        });
      }
      applyMode(kitchen, propsRef.current.mode); // honour the current render style
      // red overlap warning (editor only) for modules clashing with a same-layer one
      clashIds = cbRef.current.onMovePlan
        ? new Set(objectOverlapIds(cabFootprints(next, s.points, s.waterWall, s.layout, s.openings, s.reveal)))
        : new Set();
      selId = propsRef.current.selectedId ?? null;
      for (const id of clashIds) paintCab(id);
      if (selId) paintCab(selId);
      syncDecals();
      // re-apply any in-progress open state so a rebuild doesn't slam doors shut
      for (const [id, cur] of openCurRef.current) if (cur > 0.001) applyOpen(id, cur);
      scene.add(kitchen);
      drawOutline(selId); // the module just moved/resized — the outline has to move with it
      invalidate();
    };

    // camera framing — 3/4 orbit, or a top-down plan ("2D") view
    const fitD = () => {
      const b = polygonBoundsMm(propsRef.current.points);
      return Math.max(b.w, b.h) / 1000;
    };
    const setView = (v: KitchenView) => {
      const d = fitD();
      if (v === "plan") {
        camera.position.set(0, d * 2.4, 0.001);
        controls.enableRotate = false;
        controls.target.set(0, 0, 0);
      } else {
        camera.position.set(d * 0.95, d * 0.85, d * 0.95);
        controls.enableRotate = true;
        controls.target.set(0, 0.9, 0);
      }
      camera.lookAt(controls.target);
      controls.update();
      invalidate();
    };

    const updateCull = () => {
      for (const wll of walls) {
        const dot = (camera.position.x - wll.mx) * wll.nx + (camera.position.z - wll.mz) * wll.nz;
        wll.mesh.visible = dot <= 0.001;
      }
    };

    // ---- gizmo helpers (project the module centre to screen, position handles) ----
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const tmpV = new THREE.Vector3();
    const tmpFloor = new THREE.Vector3();
    const ndcAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    };
    const project = (v: THREE.Vector3) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const p = v.clone().project(camera);
      return { x: (p.x * 0.5 + 0.5) * rect.width, y: (-p.y * 0.5 + 0.5) * rect.height };
    };
    const setDisp = (el: SVGElement | null, on: boolean) => { if (el) el.style.display = on ? "" : "none"; };
    const setLine = (el: SVGLineElement | null, x1: number, y1: number, x2: number, y2: number) => {
      if (!el) return;
      el.setAttribute("x1", `${x1}`); el.setAttribute("y1", `${y1}`);
      el.setAttribute("x2", `${x2}`); el.setAttribute("y2", `${y2}`);
    };
    // the on-screen angle of a segment, folded to [-90,90] so the label reads upright not upside-down
    const segAngle = (ax: number, ay: number, bx: number, by: number) => {
      let a = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
      if (a > 90) a -= 180; else if (a < -90) a += 180;
      return a;
    };
    // place a dimension number: sit at (cx,cy), TILT with the arrow (angle) and SCALE with how big the
    // cabinet currently looks (sc) — so it hugs the line and shrinks when you zoom out.
    const chipXf = (cx: number, cy: number, angle: number, sc: number) => `translate(${cx} ${cy}) rotate(${angle.toFixed(1)}) scale(${sc.toFixed(2)})`;
    // width of a resize line + its arrowheads, scaled to the cabinet's apparent size (arrowheads use
    // markerUnits=strokeWidth, so this shrinks the triangles too — the "huge arrows when zoomed out" fix)
    const setStroke = (el: SVGLineElement | null, sc: number) => { if (el) el.setAttribute("stroke-width", (3 * sc).toFixed(2)); };
    // apparent-size → scale: 1 when the span looks ~170px, clamped so arrows never vanish or dominate
    const arrowScale = (spanPx: number) => Math.max(0.45, Math.min(1.15, spanPx / 170));
    const updateGizmo = () => {
      const cb = cbRef.current;
      const g = geomRef.current;
      const dr = dragRef.current;
      const center = dr ? { cx: dr.px, cy: dr.pz } : g?.selFoot ? { cx: g.selFoot.cx, cy: g.selFoot.cy } : null;
      const active = !!(center && g && cb.onMovePlan && propsRef.current.view !== "plan");
      const upper = !!g?.selFoot?.upper;
      setDisp(moveHRef.current, active);
      // ROTATE: only where there's no wall doing it for you. `connRef` is the line joining the move
      // handle to the rotate handle, so it has to disappear with it or a green stub is left behind.
      const rotatable = active && !!g?.selRotatable;
      setDisp(rotHRef.current, rotatable);
      setDisp(connRef.current, rotatable);
      // GROUP combined-width arrow — a multi-selection has no single selFoot, so it's independent of
      // the per-module gizmo below. Project the two top corners `setLattice` stamped and draw the
      // arrow + combined-mm chip. The DRAG is the in-scene knobs at its ends (lineDrag "group"), so
      // this SVG stays pointer-transparent (visual only). Hidden in the top-down plan view.
      const grp = groupGizmoRef.current;
      const grpShow = !!grp && propsRef.current.view !== "plan";
      setDisp(resizeGroupWRef.current, grpShow);
      const grpH = grpShow && !!grp?.hB && !!grp?.hT; // height only for an all-upper/tall group
      setDisp(resizeGroupHRef.current, grpH);
      setDisp(resizeGroupDRef.current, grpShow && !!grp?.dOk); // depth hidden when it borders a corner
      if (grp && grpShow) {
        // WIDTH — along the top; the visible + wide HIT line both run corner→corner. Stash the two ends'
        // screen-x so a width drag can tell which end you grabbed. The group's apparent WIDTH sets the
        // scale for all three arrows (they belong to one block).
        const lp = project(grp.leftW);
        const rp = project(grp.rightW);
        grp.lpx = lp.x;
        grp.rpx = rp.x;
        const gsc = arrowScale(Math.hypot(rp.x - lp.x, rp.y - lp.y));
        const gwAng = segAngle(lp.x, lp.y, rp.x, rp.y);
        setLine(dimGroupWLineRef.current, lp.x, lp.y, rp.x, rp.y);
        setLine(dimGroupWHitRef.current, lp.x, lp.y, rp.x, rp.y);
        setStroke(dimGroupWLineRef.current, gsc);
        dimGroupWChipRef.current?.setAttribute("transform", chipXf((lp.x + rp.x) / 2, (lp.y + rp.y) / 2 - 22, gwAng, gsc));
        if (dimGroupWTextRef.current) dimGroupWTextRef.current.textContent = `${Math.round(grp.total)}`;
        // HEIGHT — up the right edge, pushed right so it clears the width arrow; number tilts with it
        if (grpH && grp.hB && grp.hT) {
          const bp = project(grp.hB);
          const tp = project(grp.hT);
          setLine(dimGroupHLineRef.current, bp.x + 24, bp.y, tp.x + 24, tp.y);
          setLine(dimGroupHHitRef.current, bp.x + 24, bp.y, tp.x + 24, tp.y);
          setStroke(dimGroupHLineRef.current, gsc);
          dimGroupHChipRef.current?.setAttribute("transform", chipXf((bp.x + tp.x) / 2 + 24 + 16, (bp.y + tp.y) / 2, segAngle(bp.x, bp.y, tp.x, tp.y), gsc));
          if (dimGroupHTextRef.current) dimGroupHTextRef.current.textContent = `${Math.round(grp.hVal)}`;
        }
        // DEPTH — along the left-bottom edge (wall→face), pushed down; number tilts with it
        if (grp.dOk) {
          const dbp = project(grp.dB);
          const dfp = project(grp.dF);
          setLine(dimGroupDLineRef.current, dbp.x, dbp.y + 24, dfp.x, dfp.y + 24);
          setLine(dimGroupDHitRef.current, dbp.x, dbp.y + 24, dfp.x, dfp.y + 24);
          setStroke(dimGroupDLineRef.current, gsc);
          dimGroupDChipRef.current?.setAttribute("transform", chipXf((dbp.x + dfp.x) / 2, (dbp.y + dfp.y) / 2 + 24 + 14, segAngle(dbp.x, dbp.y, dfp.x, dfp.y), gsc));
          if (dimGroupDTextRef.current) dimGroupDTextRef.current.textContent = `${Math.round(grp.dVal)}`;
        }
      }
      // ── ONE RESIZE UI: THE ARROWS, FOR GRID MODULES TOO ───────────────────────────────────────
      // We used to hide these for a gridded module and draw on-edge handles instead — but that meant
      // two different-looking resize UIs (arrows for free pieces, edge knobs for grid ones) and the
      // knobs sat on top of the centre move handle. So the arrows are the single system now: each
      // shows its live mm and drives the SAME grid edit — WIDTH pushes the neighbour column
      // (onResizeLive → gridSetCabW), HEIGHT/DEPTH are per-module (onResize → patchCabDims). Only the
      // vertical MOUNT drag stays free-only: a gridded unit's mount belongs to its row.
      const free = !g?.selGridded;
      setDisp(vertHRef.current, active && upper && free); // up/down mount: the ROW owns this for a gridded unit
      const resizable = active && !!g?.selResizable && !!cb.onResize;
      setDisp(resizeWRef.current, resizable); // width arrow — not on a corner (its width IS the square)
      // depth arrow — ON a corner too, where it drags the depth of the RUNS it butts into and the
      // square + seat re-derive from that
      const resizableD = active && !!g?.selResizableD && !!cb.onResize;
      setDisp(resizeDRef.current, resizableD);
      // height arrow: wall units + columns (selTallH) — a base's height is the counter, so it has none
      const resizableH = active && !!g?.selResizableH && !!cb.onResize && !!g?.selTallH;
      setDisp(resizeHRef.current, resizableH);
      if (!active || !center || !g) {
        gizmoScreenRef.current = null;
        if (!dr) {
          setDisp(ringRef.current, false);
          setDisp(rotLabelRef.current, false);
        }
        return;
      }
      // handle height follows the module (and the live vertical drag for wall units)
      const yC = dr?.mode === "vertical" ? (dr.mountY + g.selH / 2) / 1000 : g.selCenterY;
      tmpV.set((center.cx - g.cx) / 1000, yC, (center.cy - g.cy) / 1000);
      const sp = project(tmpV);
      gizmoScreenRef.current = sp;
      const rx = sp.x;
      const ry = sp.y - RING;
      moveHRef.current?.setAttribute("transform", `translate(${sp.x} ${sp.y})`);
      rotHRef.current?.setAttribute("transform", `translate(${rx} ${ry})`);
      vertHRef.current?.setAttribute("transform", `translate(${sp.x - RING} ${sp.y})`);
      const ln = connRef.current;
      if (ln) {
        ln.setAttribute("x1", `${sp.x}`);
        ln.setAttribute("y1", `${sp.y}`);
        ln.setAttribute("x2", `${rx}`);
        ln.setAttribute("y2", `${ry}`);
      }
      ringCircleRef.current?.setAttribute("cx", `${sp.x}`);
      ringCircleRef.current?.setAttribute("cy", `${sp.y}`);

      // resize DIMENSION lines — like the front view's measurements but drawn in the 3D scene (arrow
      // line + number), draggable to resize.
      //
      // ONE PER EDGE, and no two on the same one: WIDTH along the TOP, DEPTH along the bottom-left,
      // HEIGHT up the right. Width and depth both used to run along the bottom and met at the
      // front-left corner — and since each carries a 26px invisible hit-line, their grab zones
      // overlapped there, so you'd reach for one and get the other.
      const DIM_OFF = 24; // screen-px offset so the line sits just outside the box
      const CHIP_OFF = 14; // …and the number sits clear of the line, not on top of its arrowheads
      // how big the module LOOKS on screen (its projected width) → scale for all its arrows, so the
      // triangles/numbers shrink when you zoom out instead of covering a now-tiny cabinet.
      let ssc = 1;
      if (g.selFoot) {
        const f = g.selFoot;
        const a = project(tmpV.set((f.cx - f.ux * (g.selW / 2) - g.cx) / 1000, g.selCenterY, (f.cy - f.uy * (g.selW / 2) - g.cy) / 1000));
        const b = project(tmpV.set((f.cx + f.ux * (g.selW / 2) - g.cx) / 1000, g.selCenterY, (f.cy + f.uy * (g.selW / 2) - g.cy) / 1000));
        ssc = arrowScale(Math.hypot(b.x - a.x, b.y - a.y));
      }
      // a corner unit has no WIDTH line (its width is the square), so its height line is drawn here
      // instead of inside the width block below
      if (resizableH && g.selFoot && !resizable) {
        const f = g.selFoot;
        const hNow = dr?.mode === "resizeH" ? dr.liveH : g.selH;
        const mnt = dr?.mode === "resizeH" ? dr.mountY : g.selMountY;
        const rxM = (f.cx + f.ux * (g.selW / 2) - g.cx) / 1000;
        const rzM = (f.cy + f.uy * (g.selW / 2) - g.cy) / 1000;
        const bp = project(tmpV.set(rxM, mnt / 1000, rzM));
        const tp = project(tmpV.set(rxM, (mnt + hNow) / 1000, rzM));
        setLine(dimHLineRef.current, bp.x + DIM_OFF, bp.y, tp.x + DIM_OFF, tp.y);
        setLine(dimHHitRef.current, bp.x + DIM_OFF, bp.y, tp.x + DIM_OFF, tp.y);
        setStroke(dimHLineRef.current, ssc);
        dimHChipRef.current?.setAttribute("transform", chipXf((bp.x + tp.x) / 2 + DIM_OFF + CHIP_OFF, (bp.y + tp.y) / 2, segAngle(bp.x, bp.y, tp.x, tp.y), ssc));
        if (dimHTextRef.current) dimHTextRef.current.textContent = `${hNow}`;
      }
      if (resizable && g.selFoot) {
        const f = g.selFoot;
        const wNow = dr?.mode === "resizeW" ? dr.liveW : g.selW;
        // WIDTH runs along the TOP of the box, offset UPWARD — the bottom belongs to depth.
        const hLive = dr?.mode === "resizeH" ? dr.liveH : g.selH;
        const mntLive = dr?.mode === "resizeH" ? dr.mountY : g.selMountY;
        const yTopW = (mntLive + hLive) / 1000;
        const lp = project(tmpV.set((f.cx - f.ux * (wNow / 2) - g.cx) / 1000, yTopW, (f.cy - f.uy * (wNow / 2) - g.cy) / 1000));
        const rp = project(tmpV.set((f.cx + f.ux * (wNow / 2) - g.cx) / 1000, yTopW, (f.cy + f.uy * (wNow / 2) - g.cy) / 1000));
        setLine(dimWLineRef.current, lp.x, lp.y - DIM_OFF, rp.x, rp.y - DIM_OFF);
        setLine(dimWHitRef.current, lp.x, lp.y - DIM_OFF, rp.x, rp.y - DIM_OFF);
        setStroke(dimWLineRef.current, ssc);
        // the number clears the arrow instead of sitting on top of its heads, and tilts with it
        dimWChipRef.current?.setAttribute("transform", chipXf((lp.x + rp.x) / 2, (lp.y + rp.y) / 2 - DIM_OFF - CHIP_OFF, segAngle(lp.x, lp.y, rp.x, rp.y), ssc));
        if (dimWTextRef.current) dimWTextRef.current.textContent = `${wNow}`;

        // the height dimension exists for wall units AND columns (both have a c.h the 3D honours)
        if (resizableH) {
          const hNow = dr?.mode === "resizeH" ? dr.liveH : g.selH;
          const mnt = dr?.mode === "resizeH" ? dr.mountY : g.selMountY;
          const rxM = (f.cx + f.ux * (g.selW / 2) - g.cx) / 1000; // right edge (width fixed during a height drag)
          const rzM = (f.cy + f.uy * (g.selW / 2) - g.cy) / 1000;
          const bp = project(tmpV.set(rxM, mnt / 1000, rzM));
          const tp = project(tmpV.set(rxM, (mnt + hNow) / 1000, rzM));
          setLine(dimHLineRef.current, bp.x + DIM_OFF, bp.y, tp.x + DIM_OFF, tp.y);
          setLine(dimHHitRef.current, bp.x + DIM_OFF, bp.y, tp.x + DIM_OFF, tp.y);
          setStroke(dimHLineRef.current, ssc);
          dimHChipRef.current?.setAttribute("transform", chipXf((bp.x + tp.x) / 2 + DIM_OFF + CHIP_OFF, (bp.y + tp.y) / 2, segAngle(bp.x, bp.y, tp.x, tp.y), ssc));
          if (dimHTextRef.current) dimHTextRef.current.textContent = `${hNow}`;
        }
      }

      // DEPTH — along the module's depth axis (f.ix/f.iy, the wall's inward normal), drawn down its
      // LEFT bottom edge so it can't collide with the width line (front bottom) or the height line
      // (right edge). Back face → front face; dragging the front pulls it into the room while the
      // back stays on the wall.
      //
      // On a CORNER the line spans the SQUARE (which is what you see) but the NUMBER — and the drag
      // — are the depth of the runs it butts into, because that is the only free number: the square
      // and the seat both follow from it. Growing a corner moves it, so the line is drawn against
      // the live seat, or it would sit still while the box slides out from under it.
      if (resizableD && g.selFoot) {
        const f = g.selFoot;
        const drag = dr?.mode === "resizeD" ? dr : null;
        const yBot = upper ? g.selMountY / 1000 : 0;
        const armNow = drag ? drag.liveD : g.selCorner ? g.selArm : f.depth;
        const spanNow = g.selCorner ? (drag ? drag.liveSide : f.depth) : armNow;
        const wNow = g.selCorner ? spanNow : dr?.mode === "resizeW" ? dr.liveW : g.selW;
        const seat = drag?.liveSeat;
        const cx = seat ? seat.px : f.cx;
        const cy = seat ? seat.pz : f.cy;
        const lxM = cx - f.ux * (wNow / 2);
        const lzM = cy - f.uy * (wNow / 2);
        const bkp = project(tmpV.set((lxM - f.ix * (spanNow / 2) - g.cx) / 1000, yBot, (lzM - f.iy * (spanNow / 2) - g.cy) / 1000));
        const frp = project(tmpV.set((lxM + f.ix * (spanNow / 2) - g.cx) / 1000, yBot, (lzM + f.iy * (spanNow / 2) - g.cy) / 1000));
        setLine(dimDLineRef.current, bkp.x, bkp.y + DIM_OFF, frp.x, frp.y + DIM_OFF);
        setLine(dimDHitRef.current, bkp.x, bkp.y + DIM_OFF, frp.x, frp.y + DIM_OFF);
        setStroke(dimDLineRef.current, ssc);
        dimDChipRef.current?.setAttribute("transform", chipXf((bkp.x + frp.x) / 2, (bkp.y + frp.y) / 2 + DIM_OFF + CHIP_OFF, segAngle(bkp.x, bkp.y, frp.x, frp.y), ssc));
        if (dimDTextRef.current) dimDTextRef.current.textContent = `${armNow}`;
      }
    };

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        post.resize(w, h);
        invalidate(false); // the canvas resized — the shadows didn't
      }
    });
    ro.observe(mount);

    // walk the camera (and its orbit target) horizontally on the floor plane — moving
    // both by the same vector keeps the orbit pivot, so rotate/zoom still work after
    const navFwd = new THREE.Vector3();
    const navRight = new THREE.Vector3();
    const NAV_UP = new THREE.Vector3(0, 1, 0);
    const applyNav = (jx: number, jz: number) => {
      camera.getWorldDirection(navFwd);
      navFwd.y = 0;
      if (navFwd.lengthSq() < 1e-6) return;
      navFwd.normalize();
      navRight.crossVectors(navFwd, NAV_UP).normalize();
      const b = polygonBoundsMm(propsRef.current.points);
      const room = Math.max(b.w, b.h) / 1000;
      const speed = Math.max(0.02, room * 0.011);
      const mx = (navRight.x * jx + navFwd.x * jz) * speed;
      const mz = (navRight.z * jx + navFwd.z * jz) * speed;
      camera.position.x += mx;
      camera.position.z += mz;
      // soft-clamp the target to the room + a generous margin so you can't get lost
      const halfW = b.w / 2000 + room;
      const halfH = b.h / 2000 + room;
      const tx = Math.min(halfW, Math.max(-halfW, controls.target.x + mx));
      const tz = Math.min(halfH, Math.max(-halfH, controls.target.z + mz));
      camera.position.x += tx - (controls.target.x + mx);
      camera.position.z += tz - (controls.target.z + mz);
      controls.target.x = tx;
      controls.target.z = tz;
    };

    // Hold every knob at a CONSTANT SCREEN SIZE and facing the camera. Without this a knob is a
    // fixed-size disc in the room: it shrinks to nothing when you zoom out — exactly when you most
    // need to grab it — and it turns edge-on as you orbit until it vanishes entirely.
    //
    // The world radius that projects to `KNOB_PX` at distance d is d·2·tan(fov/2)/viewportH·px.
    // Rebuild the number chips when the track changed, then re-project them onto the camera. Built
    // imperatively (not via React) because they change on every frame of a drag, and re-rendering the
    // whole scene component 60× a second to move some text would be absurd.
    const SVG_NS = "http://www.w3.org/2000/svg";
    const updateDims = () => {
      const host = dimsRef.current;
      if (!host) return;

      if (dimsDirty) {
        dimsDirty = false;
        while (host.firstChild) host.removeChild(host.firstChild);
        for (const a of dimAnchors) {
          const chip = document.createElementNS(SVG_NS, "g");
          const w = a.t.length * 7.5 + 12;
          const rect = document.createElementNS(SVG_NS, "rect");
          rect.setAttribute("x", `${-w / 2}`);
          rect.setAttribute("y", "-9");
          rect.setAttribute("width", `${w}`);
          rect.setAttribute("height", "18");
          rect.setAttribute("rx", "5");
          rect.setAttribute("fill", "#ffffff");
          rect.setAttribute("stroke", "#00ac7a");
          rect.setAttribute("stroke-width", "1");
          const txt = document.createElementNS(SVG_NS, "text");
          txt.setAttribute("y", "4");
          txt.setAttribute("text-anchor", "middle");
          txt.setAttribute("font-family", "Inter, sans-serif");
          txt.setAttribute("font-size", "11");
          txt.setAttribute("font-weight", "600");
          txt.setAttribute("fill", "#0b7a57");
          txt.textContent = a.t;
          chip.appendChild(rect);
          chip.appendChild(txt);
          host.appendChild(chip);
        }
      }

      const kids = host.children;
      for (let i = 0; i < dimAnchors.length && i < kids.length; i++) {
        const kid = kids[i] as SVGGElement;
        // z > 1 means the anchor is BEHIND the camera — projecting it would MIRROR the chip to the
        // far side of the screen, and you'd see numbers flying about for no reason
        if (dimAnchors[i].p.clone().project(camera).z > 1) {
          kid.style.display = "none";
          continue;
        }
        kid.style.display = "";
        const sp = project(dimAnchors[i].p); // the same projection the gizmos use — don't grow a second one
        kid.setAttribute("transform", `translate(${sp.x} ${sp.y})`);
      }
    };

    // MUST RUN BEFORE THE RENDER, and again the moment the knobs are (re)built.
    //
    // A fresh knob mesh has scale 1, and `CircleGeometry(1, …)` has radius 1 — so an unsized knob is
    // a TWO-METRE disc. Size it after the render and it is drawn huge for one frame; and because the
    // renderer is on-demand, nothing re-renders afterwards, so the giant disc just STAYS on screen.
    // Rebuilding the lattice on every drag step (which is what a live column drag does) makes it
    // happen constantly. That was the "handle becomes enormous" bug, and it was a frame-ordering
    // mistake, not a maths one.
    const sizeKnobs = () => {
      if (!knobMeshes.length) return;
      const h = renderer.domElement.clientHeight || 1;
      const k = (2 * Math.tan((camera.fov * Math.PI) / 360)) / h;
      for (const m of knobMeshes) {
        // the grabbed dot swells — and it has to happen HERE, because this runs every frame and
        // would otherwise stamp the scale straight back to normal
        const px = (m.userData.px as number) * (m.userData.grabbed ? 1.55 : 1);
        m.scale.setScalar(camera.position.distanceTo(m.position) * k * px);
        m.quaternion.copy(camera.quaternion); // billboard — always face the viewer
      }
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const nav = navRef.current;
      if (nav.x !== 0 || nav.z !== 0) {
        applyNav(nav.x, nav.z);
        needs = true;
      }
      // ease open/close any door/drawer toward its target (slow, soft-close feel). A swinging door
      // DOES move its shadow, so this is one of the few animations that must refresh the depth pass.
      for (const [id, tgt] of openTargetRef.current) {
        const cur = openCurRef.current.get(id) ?? 0;
        if (cur === tgt) continue;
        const next = Math.abs(tgt - cur) < 0.004 ? tgt : cur + (tgt - cur) * 0.09;
        openCurRef.current.set(id, next);
        applyOpen(id, next);
        invalidate();
      }
      controls.update();
      // did the view actually MOVE this tick? (damping fires events long after it stops mattering)
      if (camPrev.distanceToSquared(camera.position) > STILL || tgtPrev.distanceToSquared(controls.target) > STILL) {
        camPrev.copy(camera.position);
        tgtPrev.copy(controls.target);
        lastAsk = performance.now();
        aoDrawn = false; // the view changed — whatever occlusion we drew is stale
      }
      // how long did the refinement frame we asked for last tick actually take? (rAF fires once it has
      // been presented, so the gap since we submitted it IS its cost)
      if (aoStamp) {
        const cost = performance.now() - aoStamp;
        const warmup = aoFrames <= 1; // the shader compile lands here — it is not a measurement
        aoStamp = 0;
        aoStalls = !warmup && cost > AO_STALL_MS ? aoStalls + 1 : 0;
        if (aoStalls >= 3) {
          wantAO = false; // this device cannot settle in a reasonable time — the decals take over
          post.setEnabled(false);
          syncDecals();
          invalidate();
        }
      }
      // the view has stopped changing → spend one frame re-drawing it WITH the occlusion
      const settled = performance.now() - lastAsk > AO_SETTLE_MS;
      if (!needs && wantAO && !aoDrawn && settled) needs = true;
      // …and once it HAS been drawn, the damping tail must not drag it back through the composer.
      // OrbitControls keeps creeping (and keeps firing `change`) for over a second after you let go, at
      // a scale nobody can see. Redrawing those frames WITH occlusion cost 50ms each and stuttered;
      // redrawing them WITHOUT it flickered between the two looks. Neither is a picture worth drawing,
      // so we draw nothing at all: the view is, to any human eye, the one already on screen.
      if (needs && wantAO && settled && aoDrawn) needs = false;
      if (needs) {
        post.setEnabled(wantAO && settled);
        // the reflection arrives with the occlusion: both are what a STILL frame can afford and a drag
        // cannot, and refining them together means one pop rather than two
        mirror?.setVisible(reflectRef.current && settled);
        aoDrawn = post.on();
        updateCull();
        rig.follow(camera, controls.target); // the fill rides with the camera — see three/lighting.ts
        sizeKnobs(); // billboard + rescale the resize knobs to a constant screen size EVERY frame —
        // once per rebuild (in setLattice) isn't enough: orbit the camera and they'd drift in size.
        draw();
        if (aoDrawn) {
          aoStamp = performance.now();
          aoFrames++;
        }
        hud?.frame();
        // ONLY the interactive frames judge the tier — see the note on AO_STALL_MS above
        const stepped = aoDrawn ? null : auto.frame();
        if (stepped) {
          tierRef.current = stepped;
          const pr = pixelRatioFor(stepped);
          renderer.setPixelRatio(pr);
          post.setPixelRatio(pr); // the composer reads the ratio ONCE — it has to be told (see post.ts)
          rig.setTier(stepped);
          wantAO = tierSpec(stepped).ao && aoRef.current;
          post.setEnabled(wantAO);
          syncDecals();
          invalidate();
        }
        updateGizmo();
        updateDims();
        needs = false;
      }
    };
    raf = requestAnimationFrame(loop);

    // ── DRAGGING A GRID LINE IN THE SCENE ─────────────────────────────────────────────────────
    //
    // Grab a column border and pull: the columns past it absorb the change and the cabinets slide
    // along the wall. Grab a row border and the rows above give up what it takes. This is the front
    // view's gesture, in 3D, and it calls the identical store actions — there is no 3D layout code.
    //
    // The maths is one plane intersection. The wall is a plane through `a` with normal `i`; the
    // pointer ray meets it somewhere; project that point onto `u` and you have wall-space x in mm,
    // and its world height IS wall-space y. From there a column drag is "set column i's width" and a
    // row drag is "set row j's height" — the same two numbers the sheet sends.
    let lineDrag: { kind: "col" | "row" | "group"; run: number; rowId?: string; i: number; edge?: "left" | "right"; grab: number; size0: number; moved: boolean } | null = null;
    // A line slab protrudes INTO the room, so a tap on it that never moves is a tap on the cabinet
    // BEHIND it, not a resize — this flag lets onUp tell the two apart (true only after a real drag).
    let lineJustDragged = false;
    const ptr = { x: 0, y: 0 };
    const snapMm = (v: number) => Math.round(v / 10) * 10;

    /** the live size, pinned near the finger. Reads the CURRENT track, so it shows what the grid
     *  actually accepted — when the wall can give no more, the number visibly stops climbing, which
     *  is how you feel the limit instead of just fighting it. */
    const lineChip = (ln: { kind: "col" | "row" | "group"; run: number; rowId?: string; i: number } | null, cx: number, cy: number) => {
      const box = lineChipRef.current;
      const txt = lineChipTextRef.current;
      if (!box || !txt) return;
      const grid = ln ? (propsRef.current.grids ?? {})[ln.run] : null;
      // a GROUP drag has no single column/row to read a number off — the live scaling is the feedback
      if (!ln || !grid || ln.kind === "group") {
        box.style.display = "none";
        return;
      }
      // Columns are per-band: read the width of the column whose right border you are dragging.
      const mm =
        ln.kind === "col"
          ? grid.rows.find((rr) => rr.id === ln.rowId)?.cols[ln.i]?.w
          : grid.rows[ln.i]?.h;
      if (mm == null) {
        box.style.display = "none";
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      box.style.display = "";
      box.setAttribute("transform", `translate(${cx - rect.left} ${cy - rect.top - 34})`);
      txt.textContent = `${Math.round(mm)}`;
    };

    // ── WHAT DID I JUST GRAB? ─────────────────────────────────────────────────────────────────
    // A hairline that doesn't change when you take hold of it gives you no way to tell whether you
    // caught the border or missed it — you find out only from whether the cabinets move. So the held
    // line is redrawn as a SOLID BAR: a thin box, not a line, because line width is a no-op on most
    // GPUs (WebGL ignores `linewidth`, which is the classic trap here).
    //
    // `hot` is the same bar, dimmer, under the pointer on hover — a desktop affordance; touch has no
    // hover, which is exactly why the grab state has to be this loud.
    let held: THREE.Mesh | null = null;
    /** the knob under the finger — it swells and darkens, so you can SEE that you caught it */
    let heldKnob: THREE.Mesh | null = null;
    const barFor = (ln: { kind: "col" | "row"; run: number; i: number }, color: number, opacity: number) => {
      const p = wallBasis.get(ln.run);
      const grid = (propsRef.current.grids ?? {})[ln.run];
      if (!p || !grid || ln.kind === "col") return null; // col line-drag retired (per-band, no knobs)
      const ys = rowEdges(grid);
      const T = 0.022; // 22mm — reads as a held handle, not as a hairline
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(grid.wallLen / 1000, T, 0.012),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
      );
      m.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3(p.ux, 0, p.uz),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(p.ix, 0, p.iz),
        ),
      );
      const xMm = grid.wallLen / 2;
      const yMm = ys[ln.i + 1];
      const E = 0.02;
      m.position.set(
        p.ax + p.ux * (xMm / 1000) + p.ix * E,
        yMm / 1000,
        p.az + p.uz * (xMm / 1000) + p.iz * E,
      );
      m.renderOrder = 998; // over the cabinets — you must see the line you are holding
      return m;
    };
    const dropBar = () => {
      if (!held) return;
      scene.remove(held);
      held.geometry.dispose();
      (held.material as THREE.Material).dispose();
      held = null;
    };
    const showBar = (ln: { kind: "col" | "row" | "group"; run: number; i: number } | null) => {
      dropBar();
      // A vertical line (a COLUMN border or a GROUP outer edge) has no horizontal bar — its feedback is
      // the live resize itself, the divider following your finger as the grid re-lays out. Only a ROW
      // border draws the wall-long bar (barFor).
      if (!ln || ln.kind !== "row") return;
      const m = barFor(ln as { kind: "col" | "row"; run: number; i: number }, RESIZE_YEL, 1);
      if (!m) return;
      held = m;
      scene.add(m);
      invalidate(false);
    };
    /** the grabbed knob: darker, and half again as big. Touch has no hover, so the ONLY moment we
     *  can confirm "you caught the handle" is the instant your finger lands — it has to be loud. */
    const grabKnob = (hit: THREE.Mesh | null) => {
      if (heldKnob) {
        heldKnob.material = knobMat;
        heldKnob.userData.grabbed = false;
      }
      const dot = (hit?.userData.dot as THREE.Mesh | undefined) ?? null;
      heldKnob = dot;
      if (dot) {
        dot.material = knobHot;
        dot.userData.grabbed = true;
      }
      invalidate(false);
    };

    /** where the pointer meets this wall, in WALL-SPACE mm (x along the wall, y above the floor) */
    const wallHit = (run: number, clientX: number, clientY: number) => {
      const p = wallBasis.get(run);
      if (!p) return null;
      raycaster.setFromCamera(ndcAt(clientX, clientY), camera);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(p.ix, 0, p.iz).normalize(),
        new THREE.Vector3(p.ax, 0, p.az),
      );
      const at = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!at) return null; // ray parallel to the wall — grazing view, nothing sensible to report
      return {
        x: ((at.x - p.ax) * p.ux + (at.z - p.az) * p.uz) * 1000,
        y: at.y * 1000,
      };
    };

    const onLineMove = (e: PointerEvent) => {
      if (!lineDrag) return;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      const at = wallHit(lineDrag.run, e.clientX, e.clientY);
      if (!at) return;
      // ROW borders track the vertical axis; COLUMN borders and GROUP outer edges track along the wall.
      const now = lineDrag.kind === "row" ? at.y : at.x;
      // a grab that never really moves is a TAP, not a drag — see onUp
      if (Math.abs(now - lineDrag.grab) > 5) lineDrag.moved = true;
      // The grid REFUSES a size the wall cannot absorb, so there is no clamp to write here: the
      // line simply stops under your finger, and nothing overlaps.
      // Ask for the size; the bar and the readout are redrawn in setLattice, from the track the grid
      // ACTUALLY accepted. That matters: when the wall can give no more, the line stops and the
      // number stops climbing with it — you feel the limit instead of watching a chip promise you a
      // width you are not getting.
      if (lineDrag.kind === "col") {
        cbRef.current.onColW?.(lineDrag.run, lineDrag.rowId ?? "", lineDrag.i, snapMm(lineDrag.size0 + (now - lineDrag.grab)), true);
      } else if (lineDrag.kind === "group") {
        // grabbing the RIGHT edge, dragging right (now > grab) grows the group; the LEFT edge grows
        // when dragged left (grab > now) — either way the combined width goes UP as you pull outward.
        const grow = lineDrag.edge === "left" ? lineDrag.grab - now : now - lineDrag.grab;
        cbRef.current.onGroupW?.(lineDrag.run, lineDrag.edge ?? "right", snapMm(lineDrag.size0 + grow), true);
      } else {
        cbRef.current.onRowH?.(lineDrag.run, lineDrag.i, snapMm(lineDrag.size0 + (now - lineDrag.grab)), true);
      }
    };
    const onLineUp = () => {
      if (!lineDrag) return;
      // Tell onUp (which fires next, in the target phase) whether this gesture was a real drag: if it
      // was, onUp must NOT also treat it as a selecting tap; if it never moved, let the tap through.
      lineJustDragged = lineDrag.moved;
      lineDrag = null;
      dropBar();
      grabKnob(null);
      lineChip(null, 0, 0);
      controls.enabled = true;
      window.removeEventListener("pointermove", onLineMove);
      window.removeEventListener("pointerup", onLineUp, true);
      window.removeEventListener("pointercancel", onLineUp, true);
    };

    // CAPTURE phase, so this runs before OrbitControls' own pointerdown on the same element and can
    // switch it off before it decides to orbit.
    const onLineDown = (e: PointerEvent) => {
      if (lineDrag || dragRef.current) return;
      if (!lineHandles.length || (!cbRef.current.onColW && !cbRef.current.onRowH)) return;
      raycaster.setFromCamera(ndcAt(e.clientX, e.clientY), camera);
      const hit = raycaster.intersectObjects(lineHandles, false)[0];
      if (!hit) return;
      const ln = hit.object.userData.line as { kind: "col" | "row" | "depth" | "group"; run: number; rowId?: string; i: number; edge?: "left" | "right"; total?: number };
      // DEPTH knob → hand off to the tested resizeD gizmo (a floor-plane drag, not a wall-space one),
      // which previews live and commits onResize({depth}). beginDrag's stopPropagation keeps the
      // bubble-phase `onDown` from also treating this as a selecting tap, so there's no conflict.
      if (ln.kind === "depth") {
        grabKnob(hit.object as THREE.Mesh);
        const clr = () => {
          grabKnob(null);
          window.removeEventListener("pointerup", clr, true);
          window.removeEventListener("pointercancel", clr, true);
        };
        window.addEventListener("pointerup", clr, true);
        window.addEventListener("pointercancel", clr, true);
        beginDrag(e as unknown as React.PointerEvent, "resizeD");
        return;
      }
      const grid = (propsRef.current.grids ?? {})[ln.run];
      if (!grid) return;
      const at = wallHit(ln.run, e.clientX, e.clientY);
      if (!at) return;

      // depth handled above; the rest is a col / row / group line drag (depth already returned, so
      // narrow it away). A GROUP edge tracks the wall axis (like a column) and its drag base is the
      // group's combined width, carried on the handle as `total`.
      const cr = ln as { kind: "col" | "row" | "group"; run: number; rowId?: string; i: number; edge?: "left" | "right"; total?: number };
      const bandRow = cr.kind === "col" ? grid.rows.find((rr) => rr.id === cr.rowId) : null;
      lineDrag = {
        kind: cr.kind,
        run: cr.run,
        rowId: cr.rowId,
        i: cr.i,
        edge: cr.edge,
        grab: cr.kind === "row" ? at.y : at.x,
        size0: cr.kind === "col" ? bandRow?.cols[cr.i]?.w ?? 0 : cr.kind === "group" ? cr.total ?? 0 : grid.rows[cr.i].h,
        moved: false,
      };
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      // THE FEEDBACK, all three of it: the knob swells, the line goes solid, and the number appears.
      grabKnob(hit.object as THREE.Mesh);
      showBar(cr);
      lineChip(lineDrag, ptr.x, ptr.y);
      controls.enabled = false; // OrbitControls bails out on this, so the camera holds still
      cbRef.current.onBeginEdit?.(); // ONE undo step for the gesture; the live edits add none
      window.addEventListener("pointermove", onLineMove);
      // CAPTURE, so this runs before onUp's target-phase listener on the canvas — onUp then reads the
      // already-decided lineJustDragged flag instead of seeing a still-set lineDrag and bailing.
      window.addEventListener("pointerup", onLineUp, true);
      window.addEventListener("pointercancel", onLineUp, true);
    };
    renderer.domElement.addEventListener("pointerdown", onLineDown, { capture: true });

    // NO HOVER. This is a phone: there is nothing to hover with, so the affordance has to be the
    // knob itself — visible, round, and obviously grabbable before you touch it. (A desktop cursor
    // hint would be nice, but building the whole interaction around a state that only exists on
    // desktop is how you end up with a feature that is unusable on the device it ships to.)

    // picking: a tap (not an orbit-drag) on a module selects it; empty space clears
    const downXY = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      downXY.x = e.clientX;
      downXY.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      // A line slab protrudes into the room, so a tap can land on it AND on the cabinet behind it.
      // onLineUp (capture, already ran) set lineJustDragged: true only when the finger actually moved
      // and resized a line — that eats the tap. A no-move tap falls straight through to selection,
      // which is why tapping a cabinet near a column border still selects it.
      if (lineJustDragged) {
        lineJustDragged = false;
        return;
      }
      if (lineDrag) return;
      if (dragRef.current) return; // a gizmo move/rotate is in progress — don't re-pick
      if (!cbRef.current.onSelectCab && !cbRef.current.onOpenFront) return;
      if (Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y) > 6) return; // was an orbit
      if (!kitchen) return;
      raycaster.setFromCamera(ndcAt(e.clientX, e.clientY), camera);
      const hits = raycaster.intersectObjects(kitchen.children, true);

      // TAP A DOOR, OPEN THAT DOOR. Walk up from whatever the ray struck to the nearest openable
      // subgroup — so the drawer you touched is the drawer that slides, not its fifteen neighbours.
      if (cbRef.current.onOpenFront) {
        for (const h of hits) {
          let o: THREE.Object3D | null = h.object;
          while (o) {
            if (o.userData.openKey) {
              cbRef.current.onOpenFront(o.userData.openKey as string);
              return;
            }
            o = o.parent;
          }
        }
        if (!cbRef.current.onSelectCab) return; // a carcass, a wall, the floor — nothing to open
      }

      let id: string | null = null;
      let cabDist = Infinity;
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData.cabId) {
            id = o.userData.cabId as string;
            cabDist = h.distance;
            break;
          }
          o = o.parent;
        }
        if (id) break;
      }

      // ── TAP AN EMPTY CELL → A MODULE APPEARS, AT THE CELL'S SIZE ────────────────────────────
      // Picked against the CABINETS, not instead of them: a cell panel is a flat quad on the wall,
      // and a cabinet standing in front of it is nearer the camera. Comparing the two distances is
      // what stops a tap on a door from being read as a tap on the wall behind it.
      if (cellPanels.length) {
        const cellHits = raycaster.intersectObjects(cellPanels, false);
        const hit = cellHits[0];
        if (hit && hit.distance < cabDist) {
          const cell = hit.object.userData.cell as { run: number; c: string; r: string; cs: number } | undefined;
          if (cell && cbRef.current.onAddInCell) {
            cbRef.current.onAddInCell(cell.run, { c: cell.c, r: cell.r, cs: cell.cs });
            return;
          }
          const addRow = hit.object.userData.addRow as { run: number; j: number } | undefined;
          if (addRow && cbRef.current.onAddRow) {
            cbRef.current.onAddRow(addRow.run, addRow.j);
            return;
          }
          // «3-й ряд» on a wall that has no second upper row yet: one tap creates the row AND drops
          // the armed module into it.
          const placeTopRow = hit.object.userData.placeTopRow as { run: number } | undefined;
          if (placeTopRow && cbRef.current.onPlaceTopRow) {
            cbRef.current.onPlaceTopRow(placeTopRow.run);
            return;
          }
        }
      }

      cbRef.current.onSelectCab?.(id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    buildRoom();
    setLattice(propsRef.current.grids ?? {}, cabs);
    setKitchen(cabs, style);
    setView(propsRef.current.view);

    apiRef.current = {
      setKitchen,
      setLattice,
      setView,
      setSelected,
      setSelectedMany,
      setLight: (p) => {
        rig.setPreset(p);
        invalidate();
      },
      setSun: (azimuth, elevation) => {
        rig.setSun(azimuth, elevation);
        invalidate(); // the sun moved → the depth pass is stale
      },
      setLampCount: (v) => {
        rig.setLampCount(v);
        invalidate();
      },
      setReflect: (v) => {
        reflectRef.current = v;
        buildRoom(); // the mirror is created/destroyed IN buildRoom — a toggle has to rebuild it
        invalidate();
      },
      // «Линии» ⇄ «Реалистичный» / «Прозрачный»: the KITCHEN is rebuilt by its own effect, but the
      // ROOM's line-art, the skipped mirror and the paper background all live in buildRoom.
      setMode: () => {
        buildRoom();
        invalidate();
      },
      setAO: (v) => {
        wantAO = v && tierSpec(tierRef.current).ao;
        post.setEnabled(false); // the next settled frame turns it back on, if it is wanted
        aoDrawn = false;
        syncDecals(); // off → the decals come back instantly, so nothing has to be waited for
        invalidate(false);
      },
      syncGizmo: updateGizmo,
      invalidate,
      captureDataUrl: () => {
        const restoreLight = rig.beginCapture(); // «Витрина» — the same view the exports use
        post.setEnabled(wantAO); // an export is never "mid-drag" — it gets the full-quality frame
        draw(); // force a fresh frame into the (preserved) buffer
        // downscale straight from the WebGL canvas — a canvas source draws SYNCHRONOUSLY
        // and correctly (an <img> data-URL would load async → draw blank). JPEG has no
        // alpha, so paint the app backdrop first (the alpha:true bg would go black).
        const src = renderer.domElement;
        const W = 400, H = 300;
        const c = document.createElement("canvas");
        restoreLight();
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d");
        if (!ctx) return src.toDataURL("image/jpeg", 0.6);
        ctx.fillStyle = "#f4f2ee";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(src, 0, 0, W, H);
        return c.toDataURL("image/jpeg", 0.6);
      },
      captureHiRes: (maxEdge = 3840, keepLook = false) => {
        const dom = renderer.domElement;
        const w = mount.clientWidth || 320;
        const h = mount.clientHeight || 420;
        const aspect = w / h;
        // longest edge = maxEdge (keeping the on-screen aspect), clamped to what this
        // GPU can actually allocate so we never blow past the max renderbuffer size
        const cap = renderer.capabilities.maxTextureSize || 4096;
        const edge = Math.min(maxEdge, cap);
        const tW = aspect >= 1 ? edge : Math.round(edge * aspect);
        const tH = aspect >= 1 ? Math.round(edge / aspect) : edge;
        // remember the live state, then render one big frame in the EXPORT look (Витрина) with a
        // crisper shadow map — a factory drawing must not carry whatever mood the seller was viewing
        const prevRatio = renderer.getPixelRatio();
        const restoreLight = rig.beginCapture(2048, keepLook);
        renderer.setPixelRatio(1); // tW/tH are already device pixels
        post.setPixelRatio(1); // …and so is the composer's, or it would allocate tW×ratio
        renderer.setSize(tW, tH, false); // false: leave the on-screen CSS size untouched
        post.resize(tW, tH);
        post.setEnabled(wantAO); // the factory drawing gets the occlusion, whatever the screen was doing
        camera.aspect = tW / tH; // == aspect, so no distortion
        camera.updateProjectionMatrix();
        draw();
        // composite onto the app backdrop (alpha:true would otherwise fringe black in JPEG
        // viewers); PNG keeps the render lossless for the factory
        let url: string;
        const c = document.createElement("canvas");
        c.width = tW;
        c.height = tH;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#f4f2ee";
          ctx.fillRect(0, 0, tW, tH);
          ctx.drawImage(dom, 0, 0, tW, tH);
          url = c.toDataURL("image/png");
        } else {
          url = dom.toDataURL("image/png");
        }
        // restore the live view (synchronous — the browser never paints the big frame)
        restoreLight();
        renderer.setPixelRatio(prevRatio);
        post.setPixelRatio(prevRatio);
        renderer.setSize(w, h, false);
        post.resize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        draw();
        return url;
      },
      floorMetres: (clientX, clientY, yM = 0) => {
        raycaster.setFromCamera(ndcAt(clientX, clientY), camera);
        floorPlane.constant = -yM; // horizontal plane at y = yM
        const hit = raycaster.ray.intersectPlane(floorPlane, tmpFloor);
        return hit ? { x: tmpFloor.x, z: tmpFloor.z } : null;
      },
      project: (x, y, z) => project(tmpV.set(x, y, z)),
      applyTransform: (id, pxMm, pzMm, rotDeg, backOffM) => {
        if (!kitchen) return;
        const child = kitchen.children.find((o) => o.userData.cabId === id);
        if (!child) return;
        const b = polygonBoundsMm(propsRef.current.points);
        const rotRad = (rotDeg * Math.PI) / 180;
        child.rotation.y = -rotRad;
        const fwdX = -Math.sin(rotRad);
        const fwdZ = Math.cos(rotRad);
        const vx = (pxMm - b.cx) / 1000;
        const vz = (pzMm - b.cy) / 1000;
        child.position.set(vx - fwdX * backOffM, 0, vz - fwdZ * backOffM);
      },
      previewResize: (id, patch) => {
        // rebuild off the real cabs with just this module's patch applied — the run layout then
        // reflows exactly as it will on commit, so there's no jump on release. The patch is a
        // whole Cabinet slice (not just w/h) because a one-sided resize also moves the ANCHOR:
        // a run module's `x`, or a free module's `px/pz` centre.
        const patched = lastCabs.map((c) => (c.id === id ? { ...c, ...patch } : c));
        setKitchen(patched, lastStyle);
      },
      setUpperY: (id, dyM) => {
        if (!kitchen) return;
        const child = kitchen.children.find((o) => o.userData.cabId === id);
        if (child) child.position.y = dyM;
      },
      setTint: tintCab,
      pxPerMeterY: (x, y, z) => {
        const a = project(tmpV.set(x, y, z));
        const b = project(tmpV.set(x, y + 1, z));
        return Math.abs(a.y - b.y);
      },
      rect: () => renderer.domElement.getBoundingClientRect(),
      dispose: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onLineDown, { capture: true } as EventListenerOptions);
        onLineUp(); // drop any in-flight grid-line drag + its window listeners
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointerup", onUp);
        controls.removeEventListener("change", onControls);
        controls.dispose();
        if (kitchen) disposeGroup(kitchen);
        mirror?.dispose();
        if (room) disposeGroup(room);
        wood?.dispose();
        rig.dispose();
        post.dispose();
        hud?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      },
    };
    onApi?.(apiRef.current);
    // fire onReady ONCE the scene has settled — a fresh render + (with PBR) the textures
    // loaded — so the constructor grabs a single, consistent, good-looking thumbnail on
    // entry (capturing the very first frame risks a blank / untextured shot).
    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      onReadyRef.current?.();
    };
    // re-render once the PBR textures finish loading (render-on-demand → first frame draws
    // before they arrive, leaving the floor/worktop black until the next redraw); that's
    // also our cue that the scene is ready to capture
    const offTextures = PBR ? onTexturesReady(() => { invalidate(false); fireReady(); }) : null;
    // fallback so onReady still fires without PBR (or if textures never load)
    const readyTimer = setTimeout(fireReady, PBR ? 1200 : 500);

    // Register this scene as the thumbnail capture source for project saves
    registerCapture(() => apiRef.current?.captureDataUrl() ?? null);

    return () => {
      clearTimeout(readyTimer);
      offTextures?.();
      registerCapture(null);
      onApi?.(null);
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // built once; the kitchen swaps via the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switching variant / render style / selection → rebuild the kitchen group (the
  // fresh materials pick up the current render mode + highlight)
  useEffect(() => {
    apiRef.current?.setKitchen(cabs, style);
  }, [cabs, style, layout, mode]);

  // The render style also re-skins the ROOM (line-art vs photoreal) and flips the paper background —
  // both live in buildRoom, which the kitchen rebuild above doesn't touch.
  useEffect(() => {
    apiRef.current?.setMode();
  }, [mode]);

  // Selection is a TINT, not a rebuild — `selectedId` used to sit in the dependency list above, so
  // every tap on a cabinet tore the whole kitchen down and built it again. A non-empty `selectedIds`
  // (multi-select) outlines the whole set and takes precedence over the single tint.
  useEffect(() => {
    if (selectedIds && selectedIds.length) apiRef.current?.setSelectedMany(selectedIds);
    else apiRef.current?.setSelected(selectedId ?? null);
  }, [selectedId, selectedIds]);

  useEffect(() => {
    apiRef.current?.setLight(light);
  }, [light]);

  useEffect(() => {
    apiRef.current?.setAO(ao);
  }, [ao]);

  useEffect(() => {
    if (sun) apiRef.current?.setSun(sun.azimuth, sun.elevation);
  }, [sun]);

  useEffect(() => {
    apiRef.current?.setLampCount(lampCount);
  }, [lampCount]);

  useEffect(() => {
    apiRef.current?.setReflect(reflect);
  }, [reflect]);

  // A column drag in the FRONT VIEW redraws the lattice here, live — same track, two renderers.
  // The lattice redraws when the TRACK changes (a column drag in the front view shows up here live)
  // and when the CABS change — an empty cell that just got filled must stop offering itself.
  useEffect(() => {
    apiRef.current?.setLattice(grids ?? {}, cabs);
  }, [grids, cabs, points, ceiling, sheet, selectedId, layout, gridLines, placeBand]);

  // 3D ⇄ plan camera framing
  useEffect(() => {
    apiRef.current?.setView(view);
  }, [view]);

  // open/close: set each module's target (1 = open, 0 = closed) and kick the loop
  useEffect(() => {
    const set = new Set(openIds ?? []);
    const ids = new Set<string>([...openTargetRef.current.keys(), ...openCurRef.current.keys(), ...set]);
    for (const id of ids) openTargetRef.current.set(id, set.has(id) ? 1 : 0);
    apiRef.current?.invalidate();
  }, [openIds]);

  // keep the handles glued to the selected module after any re-render (selection /
  // commit / toggle) — runs before paint so there's no flash
  useLayoutEffect(() => {
    apiRef.current?.syncGizmo();
  });

  return (
    <div ref={mountRef} className="scene-canvas cab3d-wrap">
      <svg className="cab3d-overlay">
        <defs>
          {/* outward-pointing arrowhead for the resize dimension lines */}
          <marker id="dimArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#f2a900" />
          </marker>
        </defs>
        {/* horizontal alignment guide when a wall unit's height lines up with another */}
        <line ref={vertGuideRef} stroke="#00ac7a" strokeWidth={1.5} strokeDasharray="7 5" pointerEvents="none" style={{ display: "none" }} />
        {/* wall-unit height gap (worktop → unit bottom), shown while dragging up/down */}
        {/* the sheet's dimension strings — a width in every column gap, a height in every row gap */}
        <g ref={dimsRef} pointerEvents="none" />
        {/* the grid-line readout: the column width / row height you are setting, at the finger */}
        <g ref={lineChipRef} pointerEvents="none" style={{ display: "none" }}>
          <rect x={-30} y={-14} width={60} height={28} rx={7} fill="#00ac7a" />
          <text ref={lineChipTextRef} x={0} y={5} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={14} fontWeight={700} fill="#fff" />
        </g>
        <g ref={vertDimRef} pointerEvents="none" style={{ display: "none" }}>
          <line ref={vertDimLineRef} stroke="#00ac7a" strokeWidth={2} strokeDasharray="5 4" />
          <g ref={vertDimChipRef}>
            <rect x={-26} y={-12} width={52} height={24} rx={6} fill="#00ac7a" />
            <text ref={vertDimTextRef} x={0} y={5} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={13} fontWeight={700} fill="#fff" />
          </g>
        </g>
        <line ref={connRef} stroke="#00ac7a" strokeWidth={2.5} pointerEvents="none" style={{ display: "none" }} />
        <g ref={ringRef} pointerEvents="none" style={{ display: "none" }}>
          <circle ref={ringCircleRef} r={RING} fill="none" stroke="#fff" strokeWidth={3} />
          <path ref={arcRef} fill="none" stroke="#00ac7a" strokeWidth={4} strokeLinecap="round" />
        </g>
        {/* live rotation angle readout (accent + bold on a 45°/90° detent) */}
        <g ref={rotLabelRef} pointerEvents="none" style={{ display: "none" }}>
          <rect x={-26} y={-15} width={52} height={30} rx={8} fill="#1c1b18" />
          <text ref={rotTextRef} x={0} y={5} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={15} fontWeight={700} fill="#fff" />
        </g>
        {/* wall-unit up/down handle (left of centre) */}
        <g
          ref={vertHRef}
          className="cab3d-handle"
          style={{ display: "none" }}
          onPointerDown={onVertDown}
        >
          <circle r={HANDLE_R} fill="#fff" stroke="#cfcfcf" strokeWidth={2} />
          <g transform={`translate(${-12 * ICON_S} ${-16 * ICON_S}) scale(${ICON_S})`}>
            <path d={ICON_VMOVE_PATH} fill="#1c1b18" />
          </g>
        </g>
        <g
          ref={moveHRef}
          className="cab3d-handle"
          style={{ display: "none" }}
          onPointerDown={onMoveDown}
        >
          <circle r={HANDLE_R} fill="#fff" stroke="#cfcfcf" strokeWidth={2} />
          <g transform={`translate(${-16 * ICON_S} ${-16 * ICON_S}) scale(${ICON_S})`}>
            <path d={ICON_DRAG_PATH} fill="#1c1b18" />
          </g>
        </g>
        <g
          ref={rotHRef}
          className="cab3d-handle"
          style={{ display: "none" }}
          onPointerDown={onRotDown}
        >
          <circle r={HANDLE_R} fill="#fff" stroke="#cfcfcf" strokeWidth={2} />
          <g transform={`translate(${-16 * ICON_S} ${-16 * ICON_S}) scale(${ICON_S})`}>
            <path d={ICON_ROTATE_PATH} fill="#1c1b18" />
          </g>
        </g>
        {/* GROUP combined-width DIMENSION — draggable: grab the arrow (wide invisible hit line, so it's
            easy to catch), the end you grab scales the whole group from that side (→ onGroupW). */}
        <g ref={resizeGroupWRef} className="cab3d-handle resize-dim" style={{ display: "none" }} onPointerDown={onGroupWDown}>
          <line ref={dimGroupWHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={30} strokeLinecap="round" />
          <line ref={dimGroupWLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          <g ref={dimGroupWChipRef}>
            <rect x={-22} y={-8} width={44} height={16} rx={4} fill="rgba(255,255,255,0.82)" />
            <text ref={dimGroupWTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={700} fill="#1c1b18" />
          </g>
        </g>
        {/* GROUP HEIGHT (right edge) — draggable: drag vertically → set every selected module's height */}
        <g ref={resizeGroupHRef} className="cab3d-handle resize-dim" style={{ display: "none" }} onPointerDown={onGroupHDown}>
          <line ref={dimGroupHHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={30} strokeLinecap="round" />
          <line ref={dimGroupHLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" strokeLinecap="round" />
          <g ref={dimGroupHChipRef}>
            <rect x={-22} y={-8} width={44} height={16} rx={4} fill="rgba(255,255,255,0.82)" />
            <text ref={dimGroupHTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={700} fill="#1c1b18" />
          </g>
        </g>
        {/* GROUP DEPTH (left edge, wall→face) — draggable: drag into/out of the room → set every depth */}
        <g ref={resizeGroupDRef} className="cab3d-handle resize-dim" style={{ display: "none" }} onPointerDown={onGroupDDown}>
          <line ref={dimGroupDHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={30} strokeLinecap="round" />
          <line ref={dimGroupDLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" strokeLinecap="round" />
          <g ref={dimGroupDChipRef}>
            <rect x={-22} y={-8} width={44} height={16} rx={4} fill="rgba(255,255,255,0.82)" />
            <text ref={dimGroupDTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={700} fill="#1c1b18" />
          </g>
        </g>
        {/* width resize DIMENSION (bottom edge) — draggable arrow line + number, 5 cm steps */}
        <g
          ref={resizeWRef}
          className="cab3d-handle resize-dim"
          style={{ display: "none" }}
          onPointerDown={onResizeWDown}
        >
          <line ref={dimWHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={26} strokeLinecap="round" />
          <line ref={dimWLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          {/* the number sits BELOW the arrow, on a soft plate — the old boxed-and-outlined chip
              was parked on the line itself and hid the arrowheads behind it */}
          <g ref={dimWChipRef}>
            <rect x={-19} y={-8} width={38} height={16} rx={4} fill="rgba(255,255,255,0.7)" />
            <text ref={dimWTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={600} fill="#1c1b18" />
          </g>
        </g>
        {/* DEPTH resize DIMENSION (left edge, back→front) — draggable arrow line + number.
            Depth was the one dimension with no 3D handle at all: you could only get at it by
            tapping a number in the 2D plan. */}
        <g
          ref={resizeDRef}
          className="cab3d-handle resize-dim"
          style={{ display: "none" }}
          onPointerDown={onResizeDDown}
        >
          <line ref={dimDHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={26} strokeLinecap="round" />
          <line ref={dimDLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          <g ref={dimDChipRef}>
            <rect x={-19} y={-8} width={38} height={16} rx={4} fill="rgba(255,255,255,0.7)" />
            <text ref={dimDTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={600} fill="#1c1b18" />
          </g>
        </g>
        {/* height resize DIMENSION (right edge, wall units) — draggable arrow line + number */}
        <g
          ref={resizeHRef}
          className="cab3d-handle resize-dim"
          style={{ display: "none" }}
          onPointerDown={onResizeHDown}
        >
          <line ref={dimHHitRef} stroke="rgba(255,255,255,0.01)" strokeWidth={26} strokeLinecap="round" />
          <line ref={dimHLineRef} stroke="#f2a900" strokeWidth={3} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          {/* the number tilts with the arrow now (chipXf), so no fixed rotation here */}
          <g ref={dimHChipRef}>
            <rect x={-19} y={-8} width={38} height={16} rx={4} fill="rgba(255,255,255,0.7)" />
            <text ref={dimHTextRef} x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10.5} fontWeight={600} fill="#1c1b18" />
          </g>
        </g>
      </svg>

      {/* camera-walk joystick — drag the knob to move around the room */}
      {nav && (
        <div ref={joyRef} className="nav-joy" onPointerDown={onJoyDown}>
          <svg viewBox="0 0 104 104" width="104" height="104">
            <circle cx={52} cy={52} r={47} fill="rgba(255,255,255,0.55)" stroke="#d4d4d4" strokeWidth={1.25} />
            <polygon points="52,11 46,22 58,22" fill="#bcbcbc" />
            <polygon points="52,93 46,82 58,82" fill="#bcbcbc" />
            <polygon points="93,52 82,46 82,58" fill="#bcbcbc" />
            <polygon points="11,52 22,46 22,58" fill="#bcbcbc" />
            <g ref={joyKnobRef}>
              <circle cx={52} cy={52} r={18} fill="#fff" stroke="#d4d4d4" strokeWidth={1.25} />
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
