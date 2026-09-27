// Три.js-сцена стенда: доски как доски (светлые грани, чёрные рёбра), одна выбранная — оранжевая.
// Камера спереди с лёгким наклоном; один палец её никогда не двигает — только два.
import * as THREE from "three";
import type { Box } from "../kernel";
import type { PartInfo } from "./model";
import type { Pt } from "./hit";
import type { DrillMark } from "./drillMarks";

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

const DEFAULT = { yaw: 0.2, pitch: 0.14, zoom: 1 };
const COLOR: Record<string, number> = {
  shelf: 0xf4f1ea,
  divider: 0xf4f1ea,
  front: 0xfbf9f5,
  side: 0xe6e3dc,
  top: 0xe6e3dc,
  bottom: 0xe6e3dc,
  back: 0xded9d0,
};

export type CameraPreset = "iso" | "front" | "top" | "side" | "xray";

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(22, 1, 10, 20000);
  private group = new THREE.Group();
  private center = new THREE.Vector3(300, 360, -280);
  private size = 900;
  private doorHinges: { group: THREE.Group; side: "left" | "right" }[] = [];
  private doorAngle = 0; // current swing angle in radians (0 = closed, ~1.65 = open)
  private jointGroup = new THREE.Group();
  private drillGroup = new THREE.Group();
  private animId: number | null = null;
  isXray = false;
  view = { ...DEFAULT };
  w = 1; h = 1;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xeceeea);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(-400, 1400, 1600);
    this.scene.add(sun);
    this.scene.add(this.group);
    this.scene.add(this.jointGroup);
    this.scene.add(this.drillGroup);
    this.resize();
  }

  isDefaultView() { return this.view.yaw === DEFAULT.yaw && this.view.pitch === DEFAULT.pitch && this.view.zoom === DEFAULT.zoom; }
  resetView() { this.view = { ...DEFAULT }; this.place(); }

  resize() {
    this.w = this.host.clientWidth || 1;
    this.h = this.host.clientHeight || 1;
    this.renderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.place();
  }

  /** Юнит заполняет ~80 % высоты рабочего поля. */
  fit(unit: { w: number; h: number; d: number } | null) {
    if (!unit) return;
    // перед юнита ближе к камере, чем центр: запас на перспективу, и чуть выше — под «Отменить»
    this.size = Math.max(unit.h + unit.d * 0.35, (unit.w + unit.d * 0.45) / this.camera.aspect) / 0.78;
    this.center.set(unit.w / 2, unit.h / 2 - this.size * 0.06, -unit.d / 2);
    this.place();
  }

  place() {
    this.camera.updateProjectionMatrix();
    const dist = this.size / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / this.view.zoom;
    const { yaw, pitch } = this.view;
    this.camera.position.set(
      this.center.x + dist * Math.sin(yaw) * Math.cos(pitch),
      this.center.y + dist * Math.sin(pitch),
      this.center.z + dist * Math.cos(yaw) * Math.cos(pitch),
    );
    this.camera.lookAt(this.center);
    this.camera.updateMatrixWorld();
    this.render();
  }

  orbit(dyaw: number, dpitch: number) {
    this.view.yaw += dyaw;
    this.view.pitch = Math.max(-0.85, Math.min(1.45, this.view.pitch + dpitch));
    this.place();
  }

  zoomBy(factor: number) {
    this.view.zoom = Math.max(0.3, Math.min(4.0, this.view.zoom * factor));
    this.place();
  }

  build(
    ps: PartInfo[],
    selected: string | null,
    doorAngle = this.doorAngle,
    activeJointPair?: [string, string] | null,
    isXray = this.isXray,
  ) {
    this.doorAngle = doorAngle;
    this.isXray = isXray;
    this.doorHinges = [];

    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose());
          } else {
            (o.material as THREE.Material).dispose();
          }
        }
      });
    }

    const regularParts = ps.filter((p) => p.type !== "front");
    const fronts = ps.filter((p) => p.type === "front").sort((a, b) => a.box.min.x - b.box.min.x);

    // 1. Carcass & interior parts
    for (const p of regularParts) {
      const b = p.box;
      const sx = (b.max.x - b.min.x) / 10, sy = (b.max.y - b.min.y) / 10, sz = (b.max.z - b.min.z) / 10;
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const sel = p.id === selected;
      const isJointPart = activeJointPair ? p.id === activeJointPair[0] || p.id === activeJointPair[1] : false;
      const color = sel
        ? 0xe8590c
        : isJointPart
        ? 0xfef3e2
        : COLOR[p.type] ?? 0xe3e1da;
      const edgeColor = sel
        ? 0x7a2a00
        : isJointPart
        ? 0xe8590c
        : isXray
        ? 0x475569
        : 0x1c1f22;

      const mat = new THREE.MeshLambertMaterial({
        color,
        transparent: isXray && !sel,
        opacity: isXray && !sel ? (p.type === "back" ? 0.35 : 0.42) : 1.0,
        depthWrite: !(isXray && !sel),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((b.min.x + b.max.x) / 20, (b.min.y + b.max.y) / 20, -(b.min.z + b.max.z) / 20);
      mesh.userData.partId = p.id;
      mesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: edgeColor,
            transparent: isXray && !sel,
            opacity: isXray && !sel ? 0.75 : 1.0,
          }),
        ),
      );
      this.group.add(mesh);
    }

    // 2. Front doors with realistic swing hinges and handles
    for (let i = 0; i < fronts.length; i++) {
      const p = fronts[i]!;
      const b = p.box;
      const sx = (b.max.x - b.min.x) / 10, sy = (b.max.y - b.min.y) / 10, sz = (b.max.z - b.min.z) / 10;
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const sel = p.id === selected;
      const mat = new THREE.MeshLambertMaterial({
        color: sel ? 0xe8590c : COLOR.front ?? 0xfbf9f5,
        transparent: isXray && !sel,
        opacity: isXray && !sel ? 0.18 : 1.0,
        depthWrite: !(isXray && !sel),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.partId = p.id;
      mesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: sel ? 0x7a2a00 : isXray ? 0x0284c7 : 0x222428,
            transparent: isXray && !sel,
            opacity: isXray && !sel ? 0.85 : 1.0,
          }),
        ),
      );

      const side: "left" | "right" = fronts.length === 1 ? "left" : i === 0 ? "left" : "right";
      const hingeGroup = new THREE.Group();

      // Hinge line is at the carcass front surface (b.max.z / 10 in mm)
      const hingeX = side === "left" ? b.min.x / 10 : b.max.x / 10;
      const hingeY = (b.min.y + b.max.y) / 20;
      const hingeZ = -b.max.z / 10;

      hingeGroup.position.set(hingeX, hingeY, hingeZ);

      // Relative door placement from hinge line
      const relX = side === "left" ? sx / 2 : -sx / 2;
      const relY = 0;
      const relZ = sz / 2;
      mesh.position.set(relX, relY, relZ);
      hingeGroup.add(mesh);

      // Modern handle
      const handleW = 6, handleH = Math.min(130, sy * 0.35), handleD = 18;
      const handleGeo = new THREE.BoxGeometry(handleW, handleH, handleD);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x24272c });
      const handleMesh = new THREE.Mesh(handleGeo, handleMat);
      const handleMargin = Math.min(32, sx * 0.16);
      const handleRelX = side === "left" ? sx / 2 - handleMargin : -sx / 2 + handleMargin;
      handleMesh.position.set(handleRelX, 0, sz / 2 + handleD / 2);
      mesh.add(handleMesh);

      // Apply initial swing angle
      hingeGroup.rotation.y = side === "left" ? -this.doorAngle : this.doorAngle;

      this.group.add(hingeGroup);
      this.doorHinges.push({ group: hingeGroup, side });
    }

    this.render();
  }

  setDoorAngle(angle: number) {
    this.doorAngle = angle;
    for (const { group, side } of this.doorHinges) {
      group.rotation.y = side === "left" ? -angle : angle;
    }
    this.render();
  }

  getDoorAngle(): number {
    return this.doorAngle;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /** Raycast from screen pixel (x, y) into the scene. Returns the partId of the first hit mesh, or null. */
  pick(x: number, y: number): string | null {
    _pointer.set((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
    _raycaster.setFromCamera(_pointer, this.camera);
    const hits = _raycaster.intersectObjects(this.group.children, true);
    for (const h of hits) {
      // Walk up from the intersected object to find one with partId
      let obj: THREE.Object3D | null = h.object;
      while (obj) {
        if (obj.userData.partId) return obj.userData.partId as string;
        obj = obj.parent;
      }
    }
    return null;
  }

  /** Точка ядра (мм10) → пиксели поля. */
  project(x: number, y: number, z: number): [number, number] {
    const v = new THREE.Vector3(x / 10, y / 10, -z / 10).project(this.camera);
    return [((v.x + 1) / 2) * this.w, ((1 - v.y) / 2) * this.h];
  }

  /**
   * Bounding rectangle of the box projected onto screen — covers all visible faces.
   * Much better for hit-testing thin shelves seen at an angle than projecting only the front face.
   */
  front(b: Box): Pt[] {
    const corners: Pt[] = [];
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z])
          corners.push(this.project(x, y, z));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [cx, cy] of corners) {
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
    return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
  }

  /** Сколько пикселей на мм вдоль оси и в какую сторону экрана (для перетаскивания). */
  axisOnScreen(axis: "x" | "y", at: { x: number; y: number; z: number }) {
    const a = this.project(at.x, at.y, at.z);
    const b = this.project(at.x + (axis === "x" ? 1000 : 0), at.y + (axis === "y" ? 1000 : 0), at.z);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return { ux: dx / len, uy: dy / len, pxPerMm: len / 100 };
  }

  /** Smooth camera transition to target center, zoom, yaw, and pitch */
  flyTo(
    target: {
      center?: { x: number; y: number; z: number };
      zoom?: number;
      yaw?: number;
      pitch?: number;
      durationMs?: number;
    },
    durationMs?: number,
  ) {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    const animDuration = target.durationMs ?? durationMs ?? 380;
    const startCenter = this.center.clone();
    const endCenter = target.center
      ? new THREE.Vector3(target.center.x, target.center.y, target.center.z)
      : startCenter;
    const startZoom = this.view.zoom;
    const endZoom = target.zoom ?? startZoom;
    const startYaw = this.view.yaw;
    const endYaw = target.yaw ?? startYaw;
    const startPitch = this.view.pitch;
    const endPitch = target.pitch ?? startPitch;

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / animDuration);
      // easeOutCubic
      const t = 1 - Math.pow(1 - progress, 3);

      this.center.lerpVectors(startCenter, endCenter, t);
      this.view.zoom = startZoom + (endZoom - startZoom) * t;
      this.view.yaw = startYaw + (endYaw - startYaw) * t;
      this.view.pitch = startPitch + (endPitch - startPitch) * t;
      this.place();

      if (progress < 1) {
        this.animId = requestAnimationFrame(animate);
      } else {
        this.animId = null;
      }
    };
    this.animId = requestAnimationFrame(animate);
  }

  /** Display the joint contact volume in 3D and smoothly fly camera to it */
  focusJoint(boxA: Box, boxB: Box, unit?: { w: number; h: number; d: number } | null) {
    this.clearJointHighlight();

    // 1. Calculate intersection contact volume (in mm10)
    const min = { x: 0, y: 0, z: 0 };
    const max = { x: 0, y: 0, z: 0 };
    for (const ax of ["x", "y", "z"] as const) {
      min[ax] = Math.max(boxA.min[ax], boxB.min[ax]);
      max[ax] = Math.min(boxA.max[ax], boxB.max[ax]);
      if (max[ax] - min[ax] <= 0) {
        // Flat contact plane: expand slightly along contact normal to make it visible
        min[ax] -= 50; // 5mm each side
        max[ax] += 50;
      }
    }

    const sx = Math.max(4, (max.x - min.x) / 10);
    const sy = Math.max(4, (max.y - min.y) / 10);
    const sz = Math.max(4, (max.z - min.z) / 10);
    const cx = (min.x + max.x) / 20;
    const cy = (min.y + max.y) / 20;
    const cz = -(min.z + max.z) / 20;

    // Contact volume highlight
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff922b,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffe066, linewidth: 2 })
    );
    mesh.add(edges);
    this.jointGroup.add(mesh);

    // 2. Camera fly-to
    const unitMidX = unit ? unit.w / 2 : 300;
    const yaw = cx < unitMidX ? 0.38 : -0.38;
    this.flyTo({
      center: { x: cx, y: cy, z: cz },
      zoom: 2.3,
      yaw,
      pitch: 0.22,
      durationMs: 400,
    });
  }

  private clearJointHighlight() {
    for (const c of [...this.jointGroup.children]) {
      this.jointGroup.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose());
          } else {
            (o.material as THREE.Material).dispose();
          }
        }
      });
    }
  }

  clearJoint(unit?: { w: number; h: number; d: number } | null) {
    this.clearJointHighlight();
    if (unit) {
      this.flyTo({
        center: { x: unit.w / 2, y: unit.h / 2 - this.size * 0.06, z: -unit.d / 2 },
        zoom: 1.0,
        yaw: DEFAULT.yaw,
        pitch: DEFAULT.pitch,
        durationMs: 350,
      });
    } else {
      this.render();
    }
  }

  /** Fly camera to standard architectural projection or X-ray view */
  setViewPreset(
    preset: CameraPreset,
    unit: { w: number; h: number; d: number } | null,
    durationMs = 420,
  ) {
    if (!unit) return;
    const center = {
      x: unit.w / 2,
      y: unit.h / 2 - this.size * 0.06,
      z: -unit.d / 2,
    };

    switch (preset) {
      case "iso":
        this.flyTo({ center, zoom: 1.0, yaw: DEFAULT.yaw, pitch: DEFAULT.pitch, durationMs });
        break;
      case "front":
        this.flyTo({ center, zoom: 1.05, yaw: 0, pitch: 0, durationMs });
        break;
      case "top":
        this.flyTo({ center, zoom: 1.05, yaw: 0, pitch: 1.38, durationMs });
        break;
      case "side":
        this.flyTo({ center, zoom: 1.05, yaw: 1.5708, pitch: 0, durationMs });
        break;
      case "xray":
        this.flyTo({ center, zoom: 1.0, yaw: DEFAULT.yaw, pitch: DEFAULT.pitch, durationMs });
        break;
    }
  }

  clearDrillMarks() {
    for (const c of [...this.drillGroup.children]) {
      this.drillGroup.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose());
          } else {
            (o.material as THREE.Material).dispose();
          }
        }
      });
    }
  }

  /** Render 3D hardware fastener drilling points (Confirmat, Minifix, Dowels, Hinge cups) */
  renderDrillMarks(
    drills: DrillMark[],
    isVisible: boolean,
    activeJointId?: string | null,
  ) {
    this.clearDrillMarks();
    if (!isVisible || drills.length === 0) {
      this.render();
      return;
    }

    for (const d of drills) {
      const isJointActive = activeJointId && d.jointId === activeJointId;
      const radius = d.diameter / 2;
      const height =
        d.type === "confirmat"
          ? 50
          : d.type === "dowel"
          ? 30
          : d.type === "minifix"
          ? 12.5
          : d.type === "hingeCup"
          ? 12
          : 8;

      const geo = new THREE.CylinderGeometry(radius, radius, height, 16);
      const color = isJointActive
        ? 0xff922b
        : d.type === "confirmat"
        ? 0xf59e0b
        : d.type === "minifix"
        ? 0x64748b
        : d.type === "dowel"
        ? 0xd97706
        : d.type === "hingeCup"
        ? 0x94a3b8
        : 0x475569;

      const mat = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: isJointActive ? 1.0 : 0.9,
        depthTest: true,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;

      // Edge outline for crisp contrast
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: isJointActive ? 0xffe066 : 0x1e293b,
          linewidth: 1.5,
        }),
      );
      mesh.add(edges);

      // Orient mesh along drill hole direction
      const dir = new THREE.Vector3(
        d.axis === "x" ? 1 : 0,
        d.axis === "y" ? 1 : 0,
        d.axis === "z" ? 1 : 0,
      );
      if (d.dir) {
        dir.set(d.dir.x, d.dir.y, d.dir.z).normalize();
      }
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      mesh.position.set(d.x, d.y, d.z);
      this.drillGroup.add(mesh);
    }

    this.render();
  }

  dispose() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.clearJointHighlight();
    this.clearDrillMarks();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
