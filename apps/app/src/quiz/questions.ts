// Phase A.1 quiz — STRUCTURE only (ids, option values, illustration keys). All display
// text (question/option titles + descriptions) lives in i18n/dicts.ts (`quiz.q`), keyed
// by question id + option value, so it's language-aware. `pic` keys quiz/Illustration.tsx;
// the `layout` answer's `v` also sets the room shape.

export type QuizId = "oven" | "hood" | "fridge" | "wall" | "front" | "layout";

export interface QuizOption {
  v: string;
  pic: string;
}
export interface QuizQuestion {
  id: QuizId;
  /** allow picking several options — the variants then explore each choice */
  multi?: boolean;
  opts: QuizOption[];
}

export const QUIZ: QuizQuestion[] = [
  { id: "oven", multi: true, opts: [{ v: "under", pic: "oven_under" }, { v: "tall", pic: "oven_tall" }] },
  { id: "hood", multi: true, opts: [{ v: "integ", pic: "hood_integ" }, { v: "dome", pic: "hood_dome" }] },
  { id: "fridge", multi: true, opts: [{ v: "integ", pic: "fridge_integ" }, { v: "free", pic: "fridge_free" }] },
  // how the WALL is banded — the biggest structural choice, and the one the generator could build
  // (since the antresol work) but nobody could ask for. Leave it unpicked and the four strategies
  // keep their own variety, so you get all three shapes across the four variants.
  {
    id: "wall",
    multi: true,
    opts: [
      { v: "single", pic: "wall_single" },
      { v: "tall", pic: "wall_tall" },
      { v: "antresol", pic: "wall_antresol" },
      // an antresol at BASE depth — a deep storage box overhanging the wall units, which is what
      // real kitchens do with the top row
      { v: "antresolDeep", pic: "wall_antresol_deep" },
    ],
  },
  // THE FRONT'S BODY. Same override shape as `wall`: pick one and every variant is built with it;
  // pick nothing and the four strategies keep their own (flat, fluted uppers, shaker, neoclassic).
  {
    id: "front",
    multi: true,
    opts: [
      { v: "flat", pic: "front_flat" },
      { v: "shaker", pic: "front_shaker" },
      { v: "raised", pic: "front_raised" },
      { v: "fluted", pic: "front_fluted" },
    ],
  },
  {
    id: "layout",
    multi: true,
    opts: [
      { v: "i", pic: "lay_i" },
      { v: "galley", pic: "lay_galley" },
      { v: "l", pic: "lay_l" },
      { v: "u", pic: "lay_u" },
      { v: "peninsula", pic: "lay_peninsula" },
    ],
  },
];
