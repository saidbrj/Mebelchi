// Floor-covering catalog (Покрытия). `color` tints the 2D plan floor + the non-PBR
// fallback; `tex` selects the real PBR texture in the 3D, so the options are genuinely
// different MATERIALS (oak/walnut/marble…), not just tints. `repeat` = tiling density.
export interface FloorCovering {
  id: string;
  name: string;
  desc: string;
  color: string;
  /** PBR texture key (three/pbr TEX); default "hardwood". */
  tex?: string;
  /** floor tiling density (smaller = larger planks/slabs). */
  repeat?: number;
}

export const FLOOR_COVERINGS: FloorCovering[] = [
  { id: "oak", name: "Дуб", desc: "Паркетная доска", color: "#d8b888", tex: "wood_oak", repeat: 0.5 },
  { id: "ash", name: "Ясень", desc: "Светлая древесина", color: "#dccaa6", tex: "wood_ash", repeat: 0.5 },
  { id: "walnut", name: "Орех", desc: "Тёмная древесина", color: "#7c5536", tex: "wood_walnut", repeat: 0.5 },
  { id: "wenge", name: "Венге", desc: "Почти чёрное дерево", color: "#3f2e23", tex: "wood_wenge", repeat: 0.5 },
  { id: "marble", name: "Мрамор", desc: "Натуральный камень", color: "#ece9e3", tex: "marble", repeat: 0.32 },
  { id: "grey", name: "Серый ламинат", desc: "Ламинат", color: "#b5b1a8", tex: "hardwood", repeat: 0.45 },
  { id: "light-laminate", name: "Светлый ламинат", desc: "Ламинат", color: "#d8cdb4", tex: "hardwood", repeat: 0.45 },
  { id: "dark-laminate", name: "Тёмный ламинат", desc: "Ламинат", color: "#6e5744", tex: "hardwood", repeat: 0.45 },
  { id: "tile-white", name: "Белая плитка", desc: "Керамогранит", color: "#e8e6e0", tex: "marble", repeat: 0.5 },
  { id: "tile-beige", name: "Бежевая плитка", desc: "Керамогранит", color: "#d3c6ac", tex: "marble", repeat: 0.5 },
  { id: "tile-grey", name: "Серая плитка", desc: "Керамогранит", color: "#a9a8a3", tex: "marble", repeat: 0.5 },
];

export const ROOM_TYPES = ["Кухня", "Гостиная", "Спальня", "Ванная", "Прихожая", "Кабинет"];
