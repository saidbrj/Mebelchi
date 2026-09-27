// Cinematic NFS Camera Choreographer for Three.js OrbitControls
// Manages smooth camera transitions with a fixed 34° field-of-view,
// dynamic target centering, and camera presets (iso, front, top).

import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
}

export class NfsCameraChoreographer {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private isAnimating = false;
  private startTime = 0;
  private duration = 480;

  private startPosition = new THREE.Vector3();
  private startTarget = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private targetTarget = new THREE.Vector3();
  private onCompleteCallback?: () => void;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
  }

  /**
   * Computes ideal camera pose for given bounding box and preset view
   * using a tailored 34° FOV framing so objects fit comfortably in viewport.
   */
  public computeFocusPose(
    boundsMin: THREE.Vector3,
    boundsMax: THREE.Vector3,
    preset: "iso" | "front" | "top" = "iso",
  ): CameraPose {
    const center = new THREE.Vector3()
      .addVectors(boundsMin, boundsMax)
      .multiplyScalar(0.5);

    const size = new THREE.Vector3().subVectors(boundsMax, boundsMin);
    const maxDim = Math.max(size.x, size.y, size.z, 0.6);

    // Compute distance for ~34° FOV (0.593 rad)
    const fovRad = (34 * Math.PI) / 180;
    const distance = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.35;

    const position = new THREE.Vector3();

    switch (preset) {
      case "front":
        position.set(center.x, center.y, center.z + distance);
        break;
      case "top":
        position.set(center.x, center.y + distance, center.z + 0.001);
        break;
      case "iso":
      default:
        position.set(
          center.x + distance * 0.72,
          center.y + distance * 0.55,
          center.z + distance * 0.85,
        );
        break;
    }

    return {
      position,
      target: center,
      fov: 34,
    };
  }

  /**
   * Initiates a smooth cubic ease-in-out transition to the target pose.
   */
  public transitionTo(
    pose: CameraPose,
    durationMs = 480,
    onComplete?: () => void,
  ): void {
    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);

    this.targetPosition.copy(pose.position);
    this.targetTarget.copy(pose.target);

    this.startTime = performance.now();
    this.duration = Math.max(durationMs, 100);
    this.onCompleteCallback = onComplete;
    this.isAnimating = true;

    if (pose.fov && Math.abs(this.camera.fov - pose.fov) > 0.01) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Step interpolation frame. Returns true if camera is currently animating.
   */
  public update(): boolean {
    if (!this.isAnimating) return false;

    const now = performance.now();
    const elapsed = now - this.startTime;
    const t = Math.min(elapsed / this.duration, 1);

    // Cubic ease-in-out (smoothstep-like curve)
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    this.camera.position.lerpVectors(this.startPosition, this.targetPosition, ease);
    this.controls.target.lerpVectors(this.startTarget, this.targetTarget, ease);
    this.controls.update();

    if (t >= 1) {
      this.isAnimating = false;
      if (this.onCompleteCallback) {
        const cb = this.onCompleteCallback;
        this.onCompleteCallback = undefined;
        cb();
      }
    }

    return true;
  }
}
