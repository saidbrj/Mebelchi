import { create } from "zustand";
import { EMAN_MATERIALS, type EmanMaterial } from "../../model/materials";

export type ModuleType =
  | "sink"
  | "oven"
  | "drawers3"
  | "drawers2"
  | "baseDoor"
  | "tallPantry"
  | "upperDoor"
  | "upperShelves";

export interface LegoModule {
  id: string;
  type: ModuleType;
  name: string;
  row: "base" | "upper" | "tall";
  widthMm: number;
  heightMm: number;
  depthMm: number;
  xMm: number; // offset from left of wall in mm
  icon: string;
}

export interface SeamRecord {
  id: string;
  atMm: number;
  leftModId: string;
  rightModId: string;
  isShared: boolean; // true: 16mm shared partition; false: 32mm double wall
}

export interface DerivedCutPart {
  no: number;
  module: string;
  role: string;
  material: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  qty: number;
  grain: boolean;
  edge: string;
  note: string;
}

interface V2StudioState {
  // Global & Stage
  activeStage: 1 | 2 | 3;
  setActiveStage: (s: 1 | 2 | 3) => void;
  projectName: string;
  setProjectName: (n: string) => void;
  wallWidthMm: number;
  setWallWidthMm: (w: number) => void;
  wallHeightMm: number;

  // Modules & Layout
  modules: LegoModule[];
  addModule: (type: ModuleType) => void;
  removeModule: (id: string) => void;
  updateModuleWidth: (id: string, widthMm: number) => void;
  reorderModules: (newModules: LegoModule[]) => void;
  selectedModuleId: string | null;
  setSelectedModuleId: (id: string | null) => void;

  // Seams
  seams: Record<string, boolean>; // key: `${leftId}-${rightId}` -> isShared
  toggleSeam: (leftId: string, rightId: string) => void;

  // Materials
  materialSlots: {
    facadeId: string;
    carcassId: string;
    countertopId: string;
    backId: string;
  };
  setMaterialSlot: (slot: "facadeId" | "carcassId" | "countertopId" | "backId", matId: string) => void;

  // Numpad Dock
  activeNumpad: {
    moduleId: string;
    label: string;
    currentValue: number;
  } | null;
  openNumpad: (moduleId: string, label: string, currentValue: number) => void;
  closeNumpad: () => void;

  // Computed parts & calculations
  getDerivedParts: () => DerivedCutPart[];
}

export const CATALOG_PRESETS: {
  type: ModuleType;
  name: string;
  row: "base" | "upper" | "tall";
  widthMm: number;
  heightMm: number;
  depthMm: number;
  icon: string;
}[] = [
  { type: "sink", name: "Мойка 800", row: "base", widthMm: 800, heightMm: 720, depthMm: 560, icon: "🚰" },
  { type: "drawers3", name: "3 Ящика 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, icon: "🗄️" },
  { type: "oven", name: "Духовка 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, icon: "🍳" },
  { type: "baseDoor", name: "Тумба 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, icon: "🚪" },
  { type: "tallPantry", name: "Пенал 600", row: "tall", widthMm: 600, heightMm: 2100, depthMm: 560, icon: "🧊" },
  { type: "upperDoor", name: "Верх 800", row: "upper", widthMm: 800, heightMm: 700, depthMm: 320, icon: "📦" },
  { type: "upperShelves", name: "Верх 600", row: "upper", widthMm: 600, heightMm: 700, depthMm: 320, icon: "🗃️" },
];

const INITIAL_MODULES: LegoModule[] = [
  { id: "mod-1", type: "sink", name: "Мойка 800", row: "base", widthMm: 800, heightMm: 720, depthMm: 560, xMm: 0, icon: "🚰" },
  { id: "mod-2", type: "drawers3", name: "3 Ящика 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, xMm: 800, icon: "🗄️" },
  { id: "mod-3", type: "oven", name: "Духовка 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, xMm: 1400, icon: "🍳" },
  { id: "mod-4", type: "baseDoor", name: "Тумба 600", row: "base", widthMm: 600, heightMm: 720, depthMm: 560, xMm: 2000, icon: "🚪" },
  { id: "mod-5", type: "tallPantry", name: "Пенал 600", row: "tall", widthMm: 600, heightMm: 2100, depthMm: 560, xMm: 2600, icon: "🧊" },
  // Upper row
  { id: "mod-u1", type: "upperDoor", name: "Верх 800", row: "upper", widthMm: 800, heightMm: 700, depthMm: 320, xMm: 0, icon: "📦" },
  { id: "mod-u2", type: "upperShelves", name: "Верх 600", row: "upper", widthMm: 600, heightMm: 700, depthMm: 320, xMm: 800, icon: "🗃️" },
  { id: "mod-u3", type: "upperDoor", name: "Верх 600", row: "upper", widthMm: 600, heightMm: 700, depthMm: 320, xMm: 1400, icon: "📦" },
];

function recalculateOffsets(mods: LegoModule[]): LegoModule[] {
  let baseX = 0;
  let upperX = 0;
  return mods.map((m) => {
    if (m.row === "base" || m.row === "tall") {
      const cur = baseX;
      baseX += m.widthMm;
      return { ...m, xMm: cur };
    } else {
      const cur = upperX;
      upperX += m.widthMm;
      return { ...m, xMm: cur };
    }
  });
}

export const useV2Studio = create<V2StudioState>((set, get) => ({
  activeStage: 1,
  setActiveStage: (s) => set({ activeStage: s }),
  projectName: "Кухня Юнусабад · Expo-2026",
  setProjectName: (n) => set({ projectName: n }),
  wallWidthMm: 3200,
  setWallWidthMm: (w) => set({ wallWidthMm: w }),
  wallHeightMm: 2400,

  modules: INITIAL_MODULES,

  addModule: (type) => {
    const template = CATALOG_PRESETS.find((p) => p.type === type);
    if (!template) return;
    const newId = `mod-${Date.now()}`;
    const newMod: LegoModule = {
      id: newId,
      type: template.type,
      name: template.name,
      row: template.row,
      widthMm: template.widthMm,
      heightMm: template.heightMm,
      depthMm: template.depthMm,
      xMm: 0,
      icon: template.icon,
    };
    const updated = recalculateOffsets([...get().modules, newMod]);
    const totalBaseW = updated.filter((m) => m.row === "base" || m.row === "tall").reduce((acc, m) => acc + m.widthMm, 0);
    set((s) => ({
      modules: updated,
      wallWidthMm: Math.max(s.wallWidthMm, totalBaseW),
      selectedModuleId: newId,
    }));
  },

  removeModule: (id) => {
    const remaining = get().modules.filter((m) => m.id !== id);
    set({
      modules: recalculateOffsets(remaining),
      selectedModuleId: null,
    });
  },

  updateModuleWidth: (id, widthMm) => {
    const clamped = Math.max(200, Math.min(1200, widthMm));
    const updated = get().modules.map((m) => (m.id === id ? { ...m, widthMm: clamped } : m));
    const normalized = recalculateOffsets(updated);
    const totalBaseW = normalized.filter((m) => m.row === "base" || m.row === "tall").reduce((acc, m) => acc + m.widthMm, 0);
    set((s) => ({
      modules: normalized,
      wallWidthMm: Math.max(s.wallWidthMm, totalBaseW),
    }));
  },

  reorderModules: (newModules) => {
    set({ modules: recalculateOffsets(newModules) });
  },

  selectedModuleId: "mod-1",
  setSelectedModuleId: (id) => set({ selectedModuleId: id }),

  // Seam Overrides: default is shared 16mm (true)
  seams: {},
  toggleSeam: (leftId, rightId) => {
    const key = `${leftId}-${rightId}`;
    set((s) => ({
      seams: {
        ...s.seams,
        [key]: s.seams[key] === undefined ? false : !s.seams[key],
      },
    }));
  },

  materialSlots: {
    facadeId: "torhamn", // Дуб Сонома
    carcassId: "ldsp-egger-white", // Egger W1000 белый
    countertopId: "wt-stone-matte", // Камень матовый
    backId: "hdf-white", // ХДФ белый
  },
  setMaterialSlot: (slot, matId) => {
    set((s) => ({
      materialSlots: { ...s.materialSlots, [slot]: matId },
    }));
  },

  activeNumpad: null,
  openNumpad: (moduleId, label, currentValue) => {
    set({ activeNumpad: { moduleId, label, currentValue } });
  },
  closeNumpad: () => set({ activeNumpad: null }),

  getDerivedParts: () => {
    const { modules, seams, materialSlots } = get();
    const facadeMat = EMAN_MATERIALS.find((m) => m.id === materialSlots.facadeId)?.name || "ЛДСП 18мм Дуб Сонома";
    const carcassMat = EMAN_MATERIALS.find((m) => m.id === materialSlots.carcassId)?.name || "ЛДСП 16мм Egger W1000";
    const worktopMat = EMAN_MATERIALS.find((m) => m.id === materialSlots.countertopId)?.name || "Столешница 38мм Камень";
    const backMat = EMAN_MATERIALS.find((m) => m.id === materialSlots.backId)?.name || "ХДФ 3мм Белый";

    const parts: DerivedCutPart[] = [];
    let pNo = 1;

    // 1. Process base & tall modules
    const baseMods = modules.filter((m) => m.row === "base" || m.row === "tall");
    let totalWorktopLen = 0;

    baseMods.forEach((mod, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === baseMods.length - 1;
      const prevMod = idx > 0 ? baseMods[idx - 1] : null;

      // Check left seam with previous module
      const leftSeamKey = prevMod ? `${prevMod.id}-${mod.id}` : null;
      // Default seam is shared (true), unless overridden to false (double wall 32mm)
      const isSharedLeft = leftSeamKey ? seams[leftSeamKey] ?? true : false;

      // Left partition board
      if (isFirst || !isSharedLeft) {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Боковина левая",
          material: carcassMat,
          thicknessMm: 16,
          lengthMm: mod.heightMm,
          widthMm: mod.depthMm,
          qty: 1,
          grain: true,
          edge: "2мм ПВХ (Лицевая) / 0.4мм (Тыл)",
          note: isSharedLeft ? "Общая стойка 16мм" : "Двойная стенка",
        });
      }

      // Right partition board (last module always gets its own right side)
      if (isLast) {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Боковина правая",
          material: carcassMat,
          thicknessMm: 16,
          lengthMm: mod.heightMm,
          widthMm: mod.depthMm,
          qty: 1,
          grain: true,
          edge: "2мм ПВХ (Лицевая) / 0.4мм (Тыл)",
          note: "Крайний бок",
        });
      }

      // Bottom panel (Дно)
      const innerW = mod.widthMm - 32;
      parts.push({
        no: pNo++,
        module: mod.name,
        role: "Дно",
        material: carcassMat,
        thicknessMm: 16,
        lengthMm: innerW,
        widthMm: mod.depthMm,
        qty: 1,
        grain: false,
        edge: "0.4мм ПВХ (Периметр)",
        note: "Стяжка конфирмат",
      });

      // Internal structure depending on module type
      if (mod.type === "drawers3") {
        const drawerH = Math.floor((mod.heightMm - 12) / 3);
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Фасад ящика",
          material: facadeMat,
          thicknessMm: 18,
          lengthMm: mod.widthMm - 3,
          widthMm: drawerH - 3,
          qty: 3,
          grain: true,
          edge: "2мм ПВХ (4 стороны)",
          note: "Зазор 3мм",
        });
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Бок ящика (Tandem)",
          material: carcassMat,
          thicknessMm: 16,
          lengthMm: 500,
          widthMm: 140,
          qty: 6,
          grain: true,
          edge: "0.4мм ПВХ",
          note: "Направляющие Blum 500мм",
        });
      } else if (mod.type === "oven") {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Полка под духовку",
          material: carcassMat,
          thicknessMm: 16,
          lengthMm: innerW,
          widthMm: mod.depthMm - 10,
          qty: 1,
          grain: false,
          edge: "1мм ПВХ",
          note: "Усиленная полка",
        });
      } else if (mod.type === "sink") {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Фальш-панель мойки",
          material: facadeMat,
          thicknessMm: 18,
          lengthMm: mod.widthMm - 3,
          widthMm: 140,
          qty: 1,
          grain: true,
          edge: "2мм ПВХ (4 стороны)",
          note: "Фальш-планка",
        });
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Дверь распашная",
          material: facadeMat,
          thicknessMm: 18,
          lengthMm: Math.floor((mod.widthMm - 6) / 2),
          widthMm: mod.heightMm - 146,
          qty: 2,
          grain: true,
          edge: "2мм ПВХ (4 стороны)",
          note: "Петли Blum с доводчиком",
        });
      } else {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Фасад распашной",
          material: facadeMat,
          thicknessMm: 18,
          lengthMm: mod.widthMm - 3,
          widthMm: mod.heightMm - 3,
          qty: 1,
          grain: true,
          edge: "2мм ПВХ (4 стороны)",
          note: "Зазор 3мм",
        });
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Полка вкладная",
          material: carcassMat,
          thicknessMm: 16,
          lengthMm: innerW - 2,
          widthMm: mod.depthMm - 20,
          qty: 1,
          grain: false,
          edge: "1мм ПВХ (Лицевая)",
          note: "Полкодержатели 5мм",
        });
      }

      // Back panel HDF
      if (mod.type !== "oven") {
        parts.push({
          no: pNo++,
          module: mod.name,
          role: "Задняя стенка",
          material: backMat,
          thicknessMm: 3,
          lengthMm: mod.widthMm - 4,
          widthMm: mod.heightMm - 4,
          qty: 1,
          grain: false,
          edge: "Без кромки",
          note: "В паз 4мм",
        });
      }

      if (mod.row === "base") {
        totalWorktopLen += mod.widthMm;
      }
    });

    // Continuous Countertop
    if (totalWorktopLen > 0) {
      const slabCount = Math.ceil(totalWorktopLen / 3000);
      const slabLen = Math.round(totalWorktopLen / slabCount);
      for (let s = 1; s <= slabCount; s++) {
        parts.push({
          no: pNo++,
          module: "Столешница",
          role: `Слэб столешницы ${s}/${slabCount}`,
          material: worktopMat,
          thicknessMm: 38,
          lengthMm: slabLen,
          widthMm: 600,
          qty: 1,
          grain: true,
          edge: "Постформинг / Еврозапил",
          note: slabCount > 1 ? "Стяжка столешниц" : "Сплошная",
        });
      }
    }

    // Continuous Plinth
    if (totalWorktopLen > 0) {
      parts.push({
        no: pNo++,
        module: "Цоколь",
        role: "Цокольная планка",
        material: carcassMat,
        thicknessMm: 16,
        lengthMm: totalWorktopLen,
        widthMm: 100,
        qty: 1,
        grain: false,
        edge: "Уплотнитель силикон",
        note: "Клипсы к ножкам",
      });
    }

    // 2. Process upper modules
    const upperMods = modules.filter((m) => m.row === "upper");
    upperMods.forEach((mod) => {
      parts.push({
        no: pNo++,
        module: mod.name,
        role: "Боковина верхняя",
        material: carcassMat,
        thicknessMm: 16,
        lengthMm: mod.heightMm,
        widthMm: mod.depthMm,
        qty: 2,
        grain: true,
        edge: "1мм ПВХ (Лицевая)",
        note: "Навес регулируемый",
      });
      parts.push({
        no: pNo++,
        module: mod.name,
        role: "Дно / Крышка верхняя",
        material: carcassMat,
        thicknessMm: 16,
        lengthMm: mod.widthMm - 32,
        widthMm: mod.depthMm,
        qty: 2,
        grain: false,
        edge: "0.4мм ПВХ",
        note: "Стяжка",
      });
      parts.push({
        no: pNo++,
        module: mod.name,
        role: "Фасад верхний",
        material: facadeMat,
        thicknessMm: 18,
        lengthMm: mod.widthMm - 3,
        widthMm: mod.heightMm - 3,
        qty: 1,
        grain: true,
        edge: "2мм ПВХ (4 стороны)",
        note: "Свес фасада 20мм",
      });
      parts.push({
        no: pNo++,
        module: mod.name,
        role: "Задняя стенка верх",
        material: backMat,
        thicknessMm: 3,
        lengthMm: mod.widthMm - 4,
        widthMm: mod.heightMm - 4,
        qty: 1,
        grain: false,
        edge: "Без кромки",
        note: "В паз 4мм",
      });
    });

    return parts;
  },
}));
