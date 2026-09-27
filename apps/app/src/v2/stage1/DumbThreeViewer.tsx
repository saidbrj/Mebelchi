import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useV2Studio, type LegoModule } from "../state/useV2Studio";
import { EMAN_MATERIALS } from "../../model/materials";

export const DumbThreeViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modules = useV2Studio((s) => s.modules);
  const selectedModuleId = useV2Studio((s) => s.selectedModuleId);
  const setSelectedModuleId = useV2Studio((s) => s.setSelectedModuleId);
  const materialSlots = useV2Studio((s) => s.materialSlots);
  const wallWidthMm = useV2Studio((s) => s.wallWidthMm);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let w = container.clientWidth || 400;
    let h = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d131f"); // High-end dark slate/navy
    scene.fog = new THREE.FogExp2("#0d131f", 0.00015);

    const camera = new THREE.PerspectiveCamera(35, w / h, 10, 20000);
    camera.position.set(wallWidthMm * 0.5, 1400, 3200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(wallWidthMm * 0.5, 800, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below floor
    controls.minDistance = 600;
    controls.maxDistance = 8000;
    controlsRef.current = controls;

    // 2. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.2);
    keyLight.position.set(wallWidthMm * 0.8, 3000, 2500);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.5);
    fillLight.position.set(-800, 1800, 1500);
    scene.add(fillLight);

    // Floor & Grid
    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#080c14",
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(8000, 40, "#1e293b", "#141c2c");
    gridHelper.position.y = 1;
    scene.add(gridHelper);

    // Back Wall
    const wallGeo = new THREE.PlaneGeometry(wallWidthMm + 1600, 3000);
    const wallMat = new THREE.MeshStandardMaterial({
      color: "#161f30",
      roughness: 0.9,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(wallWidthMm * 0.5, 1500, -280);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Dynamic Kitchen Models Group
    const kitchenGroup = new THREE.Group();
    scene.add(kitchenGroup);

    // Resolve Material Colors
    const facadeMatDef = EMAN_MATERIALS.find((m) => m.id === materialSlots.facadeId);
    const carcassMatDef = EMAN_MATERIALS.find((m) => m.id === materialSlots.carcassId);
    const wtMatDef = EMAN_MATERIALS.find((m) => m.id === materialSlots.countertopId);

    const facadeColor = facadeMatDef?.color || "#c8a878";
    const carcassColor = carcassMatDef?.color || "#f0efe9";
    const wtColor = wtMatDef?.color || "#dcdbd7";

    const carcassThreeMat = new THREE.MeshStandardMaterial({ color: carcassColor, roughness: 0.6 });
    const facadeThreeMat = new THREE.MeshStandardMaterial({ color: facadeColor, roughness: 0.45 });
    const wtThreeMat = new THREE.MeshStandardMaterial({ color: wtColor, roughness: 0.3, metalness: 0.1 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: "#1e2430", roughness: 0.8 });
    const handleMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.2, metalness: 0.9 });
    const darkInteriorMat = new THREE.MeshStandardMaterial({ color: "#1a1f2c", roughness: 0.9 });

    const baseModules = modules.filter((m) => m.row === "base");
    const tallModules = modules.filter((m) => m.row === "tall");
    const upperModules = modules.filter((m) => m.row === "upper");

    // Continuous Plinth (100mm height)
    let totalBaseWidth = baseModules.reduce((acc, m) => acc + m.widthMm, 0);
    if (totalBaseWidth > 0) {
      const plinthGeo = new THREE.BoxGeometry(totalBaseWidth, 100, 20);
      const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
      plinthMesh.position.set(totalBaseWidth * 0.5, 50, 40);
      kitchenGroup.add(plinthMesh);
    }

    // Continuous Countertop (38mm thick, 600mm deep)
    if (totalBaseWidth > 0) {
      const wtGeo = new THREE.BoxGeometry(totalBaseWidth + 20, 38, 600);
      const wtMesh = new THREE.Mesh(wtGeo, wtThreeMat);
      wtMesh.castShadow = true;
      wtMesh.receiveShadow = true;
      wtMesh.position.set(totalBaseWidth * 0.5, 100 + 720 + 19, 0);
      kitchenGroup.add(wtMesh);
    }

    // Render each module
    modules.forEach((mod) => {
      const isSelected = mod.id === selectedModuleId;
      const modGroup = new THREE.Group();
      modGroup.name = mod.id;

      if (mod.row === "base") {
        const yBase = 100; // on top of plinth
        const depth = 560;
        const height = 720;
        const centerX = mod.xMm + mod.widthMm * 0.5;
        const centerY = yBase + height * 0.5;

        // Carcass Box
        const boxGeo = new THREE.BoxGeometry(mod.widthMm - 2, height, depth);
        const boxMesh = new THREE.Mesh(boxGeo, carcassThreeMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        boxMesh.position.set(centerX, centerY, -20);
        modGroup.add(boxMesh);

        // Front Facade
        if (mod.type === "drawers3") {
          // 3 drawer faces
          const dH = (height - 12) / 3;
          for (let i = 0; i < 3; i++) {
            const fGeo = new THREE.BoxGeometry(mod.widthMm - 4, dH - 3, 18);
            const fMesh = new THREE.Mesh(fGeo, facadeThreeMat);
            fMesh.position.set(centerX, yBase + dH * 0.5 + i * dH, depth * 0.5 - 10);
            fMesh.castShadow = true;
            modGroup.add(fMesh);

            // Sleek Gola / handle strip
            const hGeo = new THREE.BoxGeometry(mod.widthMm * 0.6, 12, 16);
            const hMesh = new THREE.Mesh(hGeo, handleMat);
            hMesh.position.set(centerX, yBase + (i + 1) * dH - 18, depth * 0.5);
            modGroup.add(hMesh);
          }
        } else if (mod.type === "oven") {
          // Oven cavity & appliance face
          const ovenGeo = new THREE.BoxGeometry(mod.widthMm - 6, height - 6, 18);
          const ovenMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.3, metalness: 0.8 });
          const ovenMesh = new THREE.Mesh(ovenGeo, ovenMat);
          ovenMesh.position.set(centerX, centerY, depth * 0.5 - 10);
          modGroup.add(ovenMesh);

          // Oven glass window
          const glassGeo = new THREE.BoxGeometry(mod.widthMm * 0.75, height * 0.45, 20);
          const glassMat = new THREE.MeshStandardMaterial({ color: "#090d16", roughness: 0.1, metalness: 0.9 });
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);
          glassMesh.position.set(centerX, centerY - 20, depth * 0.5);
          modGroup.add(glassMesh);
        } else if (mod.type === "sink") {
          // False front + 2 doors
          const falseFrontGeo = new THREE.BoxGeometry(mod.widthMm - 4, 140, 18);
          const falseFrontMesh = new THREE.Mesh(falseFrontGeo, facadeThreeMat);
          falseFrontMesh.position.set(centerX, yBase + height - 70, depth * 0.5 - 10);
          modGroup.add(falseFrontMesh);

          const doorW = (mod.widthMm - 6) * 0.5;
          const doorH = height - 146;
          [-1, 1].forEach((dir) => {
            const dGeo = new THREE.BoxGeometry(doorW - 2, doorH, 18);
            const dMesh = new THREE.Mesh(dGeo, facadeThreeMat);
            dMesh.position.set(centerX + dir * (doorW * 0.5 + 1), yBase + doorH * 0.5, depth * 0.5 - 10);
            dMesh.castShadow = true;
            modGroup.add(dMesh);

            const hGeo = new THREE.BoxGeometry(10, 100, 16);
            const hMesh = new THREE.Mesh(hGeo, handleMat);
            hMesh.position.set(centerX + dir * 18, yBase + doorH - 60, depth * 0.5);
            modGroup.add(hMesh);
          });

          // Stainless sink basin cutout visually on countertop
          const sinkGeo = new THREE.BoxGeometry(mod.widthMm * 0.65, 8, 420);
          const sinkMat = new THREE.MeshStandardMaterial({ color: "#8b949e", metalness: 0.95, roughness: 0.2 });
          const sinkMesh = new THREE.Mesh(sinkGeo, sinkMat);
          sinkMesh.position.set(centerX, 100 + 720 + 38, 0);
          modGroup.add(sinkMesh);
        } else {
          // Standard base door
          const doorGeo = new THREE.BoxGeometry(mod.widthMm - 4, height - 4, 18);
          const doorMesh = new THREE.Mesh(doorGeo, facadeThreeMat);
          doorMesh.position.set(centerX, centerY, depth * 0.5 - 10);
          doorMesh.castShadow = true;
          modGroup.add(doorMesh);

          // Handle
          const hGeo = new THREE.BoxGeometry(12, 120, 16);
          const hMesh = new THREE.Mesh(hGeo, handleMat);
          hMesh.position.set(centerX + mod.widthMm * 0.35, yBase + height - 80, depth * 0.5);
          modGroup.add(hMesh);
        }
      } else if (mod.row === "tall") {
        // Tall pantry 2100mm
        const yBase = 0;
        const depth = 560;
        const height = 2100;
        const centerX = mod.xMm + mod.widthMm * 0.5;
        const centerY = yBase + height * 0.5;

        const boxGeo = new THREE.BoxGeometry(mod.widthMm - 2, height, depth);
        const boxMesh = new THREE.Mesh(boxGeo, carcassThreeMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        boxMesh.position.set(centerX, centerY, -20);
        modGroup.add(boxMesh);

        // Lower door (720) and upper tall door
        const lowDoorGeo = new THREE.BoxGeometry(mod.widthMm - 4, 716, 18);
        const lowDoorMesh = new THREE.Mesh(lowDoorGeo, facadeThreeMat);
        lowDoorMesh.position.set(centerX, 100 + 358, depth * 0.5 - 10);
        lowDoorMesh.castShadow = true;
        modGroup.add(lowDoorMesh);

        const upDoorGeo = new THREE.BoxGeometry(mod.widthMm - 4, height - 820 - 4, 18);
        const upDoorMesh = new THREE.Mesh(upDoorGeo, facadeThreeMat);
        upDoorMesh.position.set(centerX, 820 + (height - 820) * 0.5, depth * 0.5 - 10);
        upDoorMesh.castShadow = true;
        modGroup.add(upDoorMesh);
      } else if (mod.row === "upper") {
        // Upper wall cabinet
        const yBase = 1450; // standard 600mm splashback
        const depth = 320;
        const height = mod.heightMm;
        const centerX = mod.xMm + mod.widthMm * 0.5;
        const centerY = yBase + height * 0.5;

        const boxGeo = new THREE.BoxGeometry(mod.widthMm - 2, height, depth);
        const boxMesh = new THREE.Mesh(boxGeo, carcassThreeMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        boxMesh.position.set(centerX, centerY, -140);
        modGroup.add(boxMesh);

        if (mod.type === "upperShelves") {
          // Open shelves
          const shelfGeo = new THREE.BoxGeometry(mod.widthMm - 32, 16, depth - 20);
          const shelfMesh = new THREE.Mesh(shelfGeo, carcassThreeMat);
          shelfMesh.position.set(centerX, centerY, -140);
          modGroup.add(shelfMesh);
        } else {
          // Upper door
          const doorGeo = new THREE.BoxGeometry(mod.widthMm - 4, height - 4, 18);
          const doorMesh = new THREE.Mesh(doorGeo, facadeThreeMat);
          doorMesh.position.set(centerX, centerY, -140 + depth * 0.5 + 9);
          doorMesh.castShadow = true;
          modGroup.add(doorMesh);
        }
      }

      // Selection glow box
      if (isSelected) {
        const selGeo = new THREE.BoxGeometry(mod.widthMm + 8, mod.heightMm + 8, (mod.depthMm || 560) + 16);
        const edges = new THREE.EdgesGeometry(selGeo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: "#00e5ff", linewidth: 2 })
        );
        const yC = mod.row === "upper" ? 1450 + mod.heightMm * 0.5 : (mod.row === "tall" ? mod.heightMm * 0.5 : 100 + mod.heightMm * 0.5);
        const zC = mod.row === "upper" ? -140 : -20;
        line.position.set(mod.xMm + mod.widthMm * 0.5, yC, zC);
        modGroup.add(line);
      }

      kitchenGroup.add(modGroup);
    });

    // 4. Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 5. Handle Container Resize
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (nw === 0 || nh === 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      container.replaceChildren();
    };
  }, [modules, selectedModuleId, materialSlots, wallWidthMm]);

  // Preset view buttons
  const setView = (type: "front" | "iso" | "top") => {
    if (!controlsRef.current || !cameraRef.current) return;
    const cx = wallWidthMm * 0.5;
    if (type === "front") {
      cameraRef.current.position.set(cx, 1100, 3200);
      controlsRef.current.target.set(cx, 1100, 0);
    } else if (type === "iso") {
      cameraRef.current.position.set(cx + 1800, 1800, 2600);
      controlsRef.current.target.set(cx, 800, 0);
    } else if (type === "top") {
      cameraRef.current.position.set(cx, 3800, 100);
      controlsRef.current.target.set(cx, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="w-full h-full flex-1" />

      {/* Floating 3D Controls overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/60 shadow-lg text-[11px] font-semibold text-slate-300">
        <button
          onClick={() => setView("iso")}
          className="px-2 py-1 rounded-lg hover:bg-slate-800 active:bg-cyan-500/20 active:text-cyan-400 transition"
        >
          3D
        </button>
        <button
          onClick={() => setView("front")}
          className="px-2 py-1 rounded-lg hover:bg-slate-800 active:bg-cyan-500/20 active:text-cyan-400 transition"
        >
          Фасад
        </button>
        <button
          onClick={() => setView("top")}
          className="px-2 py-1 rounded-lg hover:bg-slate-800 active:bg-cyan-500/20 active:text-cyan-400 transition"
        >
          План
        </button>
      </div>

      {/* Subtle bottom info chip */}
      <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-400/80 bg-slate-900/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 pointer-events-none">
        Движок Three.js · Без коллизий · Сквозной щит
      </div>
    </div>
  );
};
