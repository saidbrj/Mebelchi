// apps/app/src/app2/materialPalettes.ts
//
// CANONICAL MATERIAL PALETTES (Eman / Egger DB/58 §4).
// Provides 1-click theme switching for PBR shaders and CAD/CAM construction slots:
// 1. Дуб Галифакс (Halifax Oak): Egger H1180 ST37 + W980 carcass.
// 2. Графит матовый (Graphite Matt): Egger PerfectSense Matt U961 PM + U963 Anthracite carcass.
// 3. Белый платиновый (Platinum White): Egger W1000 Premium White + W980 Platinum White carcass.
//
// Updating the theme synchronously re-evaluates the kernel (updating Gidlab columns 5, 8–11)
// and hot-swaps Three.js PBR shader uniforms at 60fps.

import type { Construction } from "../poligon/model/space";

export interface MaterialTheme {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  swatchHex: string;
  secondaryHex: string;
  colors: {
    carcass: number;
    facade: number;
    shelf: number;
    worktop: number;
    accent: number;
  };
  slots: Record<string, { thicknessMm: number; material: string }>;
  edgeband: {
    k1Carcass: string; // 0.4mm ABS
    k2Facade: string;  // 1.0mm ABS
  };
}

export const MATERIAL_THEMES: MaterialTheme[] = [
  {
    id: "halifax_oak",
    name: "Дуб Галифакс",
    subtitle: "Egger H1180 ST37 / W980",
    description: "Натуральный дуб с глубокой текстурой ST37 синхропоры и белоснежным матовым корпусом",
    swatchHex: "#c8a878",
    secondaryHex: "#f5f3ef",
    colors: {
      carcass: 0xf5f3ef,
      facade: 0xc8a878,
      shelf: 0xeeece6,
      worktop: 0xd4d4d8,
      accent: 0x2f6fed,
    },
    slots: {
      carcass: { thicknessMm: 16, material: "Egger W980 SM Белый платиновый 16мм" },
      facade: { thicknessMm: 18, material: "Egger H1180 ST37 Дуб Галифакс 18мм" },
      worktop: { thicknessMm: 38, material: "Egger H1180 ST37 Столешница 38мм" },
    },
    edgeband: {
      k1Carcass: "ABS 0.4x19 Белый W980",
      k2Facade: "ABS 1.0x23 Дуб Галифакс H1180",
    },
  },
  {
    id: "graphite_matt",
    name: "Графит матовый",
    subtitle: "Egger U961 PM / U963",
    description: "Бархатистый матовый PerfectSense Matt с защитой от отпечатков пальцев и антрацитовым корпусом",
    swatchHex: "#26282e",
    secondaryHex: "#383b42",
    colors: {
      carcass: 0x383b42,
      facade: 0x26282e,
      shelf: 0x32353c,
      worktop: 0x1f2126,
      accent: 0x6366f1,
    },
    slots: {
      carcass: { thicknessMm: 16, material: "Egger U963 ST9 Антрацит 16мм" },
      facade: { thicknessMm: 18, material: "Egger U961 PM Графит матовый 18мм" },
      worktop: { thicknessMm: 38, material: "Egger F206 PM Пьетра Гриджиа 38мм" },
    },
    edgeband: {
      k1Carcass: "ABS 0.4x19 Антрацит U963",
      k2Facade: "ABS 1.0x23 SuperMatt Графит U961",
    },
  },
  {
    id: "platinum_white",
    name: "Белый платиновый",
    subtitle: "Egger W1000 ST9 / W980",
    description: "Классический скандинавский минимализм: премиальный чистый белый фасад и шелковистый корпус",
    swatchHex: "#ffffff",
    secondaryHex: "#fcfbf9",
    colors: {
      carcass: 0xfcfbf9,
      facade: 0xffffff,
      shelf: 0xf8f7f4,
      worktop: 0xe2e2e5,
      accent: 0x3b82f6,
    },
    slots: {
      carcass: { thicknessMm: 16, material: "Egger W980 SM Белый платиновый 16мм" },
      facade: { thicknessMm: 18, material: "Egger W1000 ST9 Белый премиум 18мм" },
      worktop: { thicknessMm: 38, material: "Egger F638 ST16 Хромикс 38мм" },
    },
    edgeband: {
      k1Carcass: "ABS 0.4x19 Белый W980",
      k2Facade: "ABS 1.0x23 Белый W1000",
    },
  },
];

/**
 * Merges a chosen material theme's slots into a base construction configuration.
 */
export function applyMaterialTheme(construction: Construction, theme: MaterialTheme): Construction {
  return {
    ...construction,
    slots: {
      ...construction.slots,
      ...theme.slots,
    },
  };
}
