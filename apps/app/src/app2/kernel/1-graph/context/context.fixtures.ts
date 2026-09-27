// Вместо App 1, пока его нет (SPEC R62): три обычные ситуации, в которых App 2 обязан работать
// одинаково. Это данные для тестов, поэтому числа здесь законны — страж GOLDEN-RULE их не смотрит.
import { FOREIGN, type UnitContext } from "./context";

const UNIT = { size: { x: 6000, y: 7200, z: 5600 }, type: "нижний" };

export const FIXTURES: Record<string, UnitContext> = {
  /** сам по себе: стоит на полу, сзади стена */
  standalone: {
    unit: { id: "U1", ...UNIT },
    profile: "qorasu",
    external: [],
    support: "floor",
    neighbours: [{ side: "left", kind: "free" }, { side: "right", kind: "free" }],
    walls: [{ side: "back", distance: 0 }],
  },
  /** правая боковина общая с соседом: принадлежит модулю, менять нельзя */
  sharedRight: {
    unit: { id: "U2", ...UNIT },
    profile: "qorasu",
    external: [{ id: `M1${FOREIGN}P7`, side: "right", thickness: 160, type: "боковина" }],
    support: "plinth",
    neighbours: [{ side: "left", kind: "free" }, { side: "right", kind: "unit" }],
    walls: [{ side: "back", distance: 0 }],
  },
  /** между двумя соседями: обе боковины чужие */
  betweenTwo: {
    unit: { id: "U3", ...UNIT },
    profile: "qorasu",
    external: [
      { id: `M1${FOREIGN}P7`, side: "left", thickness: 160, type: "боковина" },
      { id: `M1${FOREIGN}P9`, side: "right", thickness: 160, type: "боковина" },
    ],
    support: "plinth",
    neighbours: [{ side: "left", kind: "unit" }, { side: "right", kind: "unit" }],
    walls: [{ side: "back", distance: 0 }],
  },
};
