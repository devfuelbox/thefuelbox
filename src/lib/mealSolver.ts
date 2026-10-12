/**
 * The meal solver — a pure module so the plan maths can be unit-tested without
 * React, a browser or a database.
 *
 * Every food is read from a `menu_items` row: nutrition, price, cookable and now
 * its configured serving window (`min_grams` / `max_grams`, plus optional
 * per-goal overrides in `goal_portions`) and its goal categories
 * (`goal_categories`). A food assigned to the user's goal is ranked
 * ahead of the generic staples and is given a rotating featured serving in one
 * meal per plan, so an admin's "Paneer → Muscle Gain" actually shows up in a
 * Muscle Gain, Veg plan.
 *
 * The solver chooses the foods and the grams; the onboarding just renders the
 * result.
 *
 * Portion limits are enforced here, at the source: a food is never placed in a
 * meal below its minimum or above its maximum. When a limit stops a meal from
 * reaching its calorie/protein share, the meal is flagged (`limited`) and the
 * plan carries a `limitWarning` so the UI can say so out loud instead of quietly
 * overshooting a configured limit.
 */

import {
  calculateHealthMetrics,
  type OnboardingAnswers,
} from './healthCalculations';
import {
  clampPortion,
  portionBoundsForGoal,
  type PortionBounds,
  type GoalPortions,
} from './menuPortionLimits';
import { belongsToGoal } from './goalCategories';

export interface IngredientData {
  dbId: number; // menu_items.id
  n: string; // menu_items.name
  t: 'veg' | 'egg' | 'nonveg'; // menu_items.diet, normalized
  k: number; // calories per 100 g
  p: number; // protein_g per 100 g
  c: number; // carbs_g per 100 g
  f: number; // fat_g per 100 g
  fi: number; // fiber_g per 100 g
  price: number; // ₹ per 100 g
  cookable: boolean; // menu_items.cookable — carried for display, never priced
  category: string; // menu_items.category
  gc: string[]; // menu_items.goal_categories — goal keys this food is assigned to
  min: number | null; // menu_items.min_grams — null means "no minimum"
  max: number | null; // menu_items.max_grams — null means "no maximum"
  gp?: GoalPortions; // menu_items.goal_portions — per-goal window overrides
}

export const MEAL_ORDER = ['Morning', 'Afternoon', 'Night'];

// Starting portion when the user adds a food by hand. The food's own limits
// (when set) clamp this, so a 70 g default is only a starting point.
export const DEFAULT_ADD_GRAMS = 70;

// The fixed serving (clamped to the food's own window) a food assigned to the
// user's goal is guaranteed in one meal per plan. Small enough to sit on top of
// a normal meal without pushing any staple over its limit.
export const FEATURED_SERVING = 100;

export const round1 = (x: number) => Math.round(x * 10) / 10;

export const kOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.k * g) / 100 || 0;
export const pOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.p * g) / 100 || 0;
export const cOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.c ?? 0) * g) / 100 || 0;
export const fOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.f ?? 0) * g) / 100 || 0;
export const fiOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.fi ?? 0) * g) / 100 || 0;
export const costOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.price * g) / 100 || 0;

export interface MealItem {
  id: string;
  g: number;
}

export interface PlanMeal {
  name: string;
  items: MealItem[];
  /** True when a configured portion limit stopped this meal hitting its share. */
  limited?: boolean;
}

export interface MealTarget {
  kcal: number;
  protein: number;
}

export interface BuiltPlan {
  items: MealItem[];
  meals: PlanMeal[];
  protein: number;
  kcal: number;
  protT: number;
  kcalT: number;
  mealTargets: Record<string, MealTarget>;
  /** Names of meals a configured limit kept off its calorie/protein share. */
  limitedMeals: string[];
  /** Ready-to-show sentence, or null when every meal met its share. */
  limitWarning: string | null;
}

const sharesOf = (total: number): number[] => {
  const base = Math.floor(total / 3);
  const rem = total - base * 3;
  return [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base];
};

const densityOf = (ing: Record<string, IngredientData>, id: string) => {
  const d = ing[id];
  return d && d.k > 0 ? d.p / d.k : 0;
};

/** The effective window for a food currently in the solver, under `goal`. */
const boundsOf = (
  ing: Record<string, IngredientData>,
  id: string,
  goal: string | null | undefined,
): PortionBounds =>
  portionBoundsForGoal(
    {
      min_grams: ing[id]?.min ?? null,
      max_grams: ing[id]?.max ?? null,
      goal_portions: ing[id]?.gp,
    },
    goal,
  );

const hasConfiguredLimit = (bounds: PortionBounds): boolean =>
  bounds.min > 0 || bounds.max != null;

const addItem = (items: MealItem[], id: string, g: number) => {
  const gr = round1(g);
  if (gr <= 0) return;
  const existing = items.find((x) => x.id === id);
  if (existing) existing.g = round1(existing.g + gr);
  else items.push({ id, g: gr });
};

/**
 * The best a single anchor can do for a meal: the dense anchor plus the most
 * suitable lighter filler, snapped to the 0.1 g grid and clamped to each food's
 * window. `exact` says whether the chosen grams round to the meal's calorie AND
 * protein share. Returns null when this anchor cannot serve the meal at all
 * (off the menu, not dense enough for the remaining ratio, no usable filler).
 */
function solveAnchor(
  ing: Record<string, IngredientData>,
  fixed: MealItem[],
  fixedK: number,
  fixedP: number,
  dK: number,
  dP: number,
  ratio: number,
  anchor: string,
  fillers: Array<[string, number]>,
  excluded: Set<string> | undefined,
  shareK: number,
  shareP: number,
  goal: string | null | undefined,
): { items: MealItem[]; limited: boolean; exact: boolean; err: number } | null {
  const ad = ing[anchor];
  if (!ad || ad.k <= 0 || !(ad.p / ad.k > ratio)) return null;

  const ka = ad.k / 100;
  const pa = ad.p / 100;
  const aBounds = boundsOf(ing, anchor, goal);
  const sols: Array<{ id: string; ga: number; gf: number; cap: number }> = [];
  for (const [fid, cap] of fillers) {
    if (excluded?.has(fid)) continue;
    const fd = ing[fid] ? densityOf(ing, fid) : 0;
    if (!fd || fid === anchor || !(fd < ratio)) continue;
    const kf = ing[fid].k / 100;
    const pf = ing[fid].p / 100;
    const det = ka * pf - kf * pa;
    let ga = 0;
    let gf = 0;
    if (Math.abs(det) > 1e-9) {
      ga = (dK * pf - kf * dP) / det;
      gf = (ka * dP - pa * dK) / det;
    } else if (pa > 0) {
      ga = dP / pa;
    }
    if (!isFinite(ga) || !isFinite(gf) || ga < 0 || gf < 0) continue;
    sols.push({ id: fid, ga, gf, cap });
  }

  // Work on a clone so a rejected attempt never taints the shared fixed items.
  const items: MealItem[] = fixed.map((f) => ({ id: f.id, g: f.g }));

  if (!sols.length) {
    // Degraded menu (no lighter filler): cover the protein gap with the anchor,
    // still respecting its own minimum/maximum.
    if (pa > 0) {
      const want = round1(dP / pa);
      const g = clampPortion(want, aBounds);
      addItem(items, anchor, g);
      return {
        items,
        limited: hasConfiguredLimit(aBounds) && g !== want,
        exact: g === want,
        err: (dK - ka * g) ** 2 + 16 * (dP - pa * g) ** 2,
      };
    }
    return null;
  }

  // First filler whose grams stay inside the realistic cap; otherwise the
  // least over-cap one so a single filler never dominates the plate.
  const pick =
    sols.find((s) => s.gf <= s.cap) ??
    sols.reduce((b, s) => (s.gf / s.cap < b.gf / b.cap ? s : b));
  const kf = ing[pick.id].k / 100;
  const pf = ing[pick.id].p / 100;
  const fBounds = boundsOf(ing, pick.id, goal);

  // Snap to the 0.1g grid, then nudge until the meal rounds to its share
  // exactly; among passing grids keep the smallest calorie/protein error. Every
  // candidate is clamped into the food's window, so an out-of-window amount can
  // never win the search.
  const a0 = round1(pick.ga);
  const f0 = round1(pick.gf);
  let bestA = clampPortion(a0, aBounds);
  let bestF = clampPortion(f0, fBounds);
  let bestScore = Infinity;
  for (let da = -4; da <= 4; da++) {
    for (let df = -4; df <= 4; df++) {
      const ga = clampPortion(Math.max(0, a0 + da / 10), aBounds);
      const gf = clampPortion(Math.max(0, f0 + df / 10), fBounds);
      const K = fixedK + ka * ga + kf * gf;
      const P = fixedP + pa * ga + pf * gf;
      const pass = Math.round(K) === shareK && Math.round(P) === shareP;
      const eK = K - shareK;
      const eP = P - shareP;
      const score = (pass ? 0 : 1e6) + eK * eK + 16 * eP * eP;
      if (score < bestScore) {
        bestScore = score;
        bestA = ga;
        bestF = gf;
      }
    }
  }
  addItem(items, anchor, bestA);
  addItem(items, pick.id, bestF);

  const finalK = fixedK + ka * bestA + kf * bestF;
  const finalP = fixedP + pa * bestA + pf * bestF;
  const hitTarget =
    Math.round(finalK) === shareK && Math.round(finalP) === shareP;
  return {
    items,
    limited:
      !hitTarget && (hasConfiguredLimit(aBounds) || hasConfiguredLimit(fBounds)),
    exact: hitTarget,
    err: (finalK - shareK) ** 2 + 16 * (finalP - shareP) ** 2,
  };
}

/**
 * Solve one meal to its calorie and protein share.
 *
 * The caller passes the anchor list in preference order (goal-assigned foods
 * first — see `buildPlan`), so this walks the anchors and takes the first that
 * rounds to the share EXACTLY. When no anchor can hit the share — e.g. a
 * goal-assigned food whose configured maximum is too small to carry the meal —
 * it keeps the closest completion instead of dropping the meal, so the food is
 * never silently squeezed out by a generic staple. Grams are always clamped to
 * each food's window before they are scored, so the returned items are legal
 * portions.
 */
function fillMeal(
  ing: Record<string, IngredientData>,
  fixed: Array<{ id: string; g: number }>,
  anchors: string[],
  fillers: Array<[string, number]>,
  shareK: number,
  shareP: number,
  goal: string | null | undefined,
  excluded?: Set<string>,
): { items: MealItem[]; limited: boolean } {
  // Fixed foods (egg, watermelon, a side, a featured goal food) are clamped to
  // their own window too.
  const items: MealItem[] = fixed.map((f) => ({
    id: f.id,
    g: round1(clampPortion(f.g, boundsOf(ing, f.id, goal))),
  }));

  const fixedK = items.reduce((s, f) => s + kOf(ing, f.id, f.g), 0);
  const fixedP = items.reduce((s, f) => s + pOf(ing, f.id, f.g), 0);
  const dK = shareK - fixedK;
  const dP = shareP - fixedP;
  if (dK <= 0 || dP <= 0) return { items, limited: false };

  const ratio = dP / dK;
  let best: { items: MealItem[]; limited: boolean; err: number } | null = null;
  for (const anchor of anchors) {
    if (excluded?.has(anchor)) continue;
    const sol = solveAnchor(
      ing,
      items,
      fixedK,
      fixedP,
      dK,
      dP,
      ratio,
      anchor,
      fillers,
      excluded,
      shareK,
      shareP,
      goal,
    );
    if (!sol) continue;
    if (sol.exact) return { items: sol.items, limited: sol.limited };
    if (!best || sol.err < best.err) best = sol;
  }
  if (best) return { items: best.items, limited: best.limited };
  return { items, limited: false };
}

export function buildPlan(
  a: OnboardingAnswers,
  variant: number,
  ing: Record<string, IngredientData>,
  allowed?: Set<string> | null,
): BuiltPlan {
  // `ing` holds only foods that came back from `menu_items`, so membership is
  // enough: a food that is not on the menu simply is not there to be picked.
  const ok = (id: string) => !!ing[id] && (!allowed || allowed.has(id));
  const canChicken = (a.food || 'veg') === 'nonveg';
  const canEgg = canChicken || (a.food || 'veg') === 'egg';
  const metrics = calculateHealthMetrics(a);
  const kcalT = metrics.goalCalories;
  const protT = metrics.proteinG;

  // Daily target → integer per-meal shares (remainder on the first meals).
  const shareK = sharesOf(kcalT);
  const shareP = sharesOf(protT);
  const caps =
    (a.goal || 'loss') === 'loss'
      ? { ban: 240, rice: 250, sweet: 180, peanut: 45, paneer: 150 }
      : { ban: 360, rice: 350, sweet: 260, peanut: 60, paneer: 150 };

  // Goal preference. A food explicitly assigned to the goal the user picked
  // (see goalCategories.belongsToGoal — an uncategorized food qualifies for
  // every goal but is not a "goal food") is ranked ahead of the generic staples
  // and gets a rotating featured serving below, so a Muscle Gain food is
  // actually preferred for a Muscle Gain user rather than only being eligible.
  const goal = a.goal || 'loss';
  const goalAssigned = (id: string): boolean => {
    const gc = ing[id]?.gc;
    return Array.isArray(gc) && gc.length > 0 && belongsToGoal(gc, goal);
  };
  const canEat = (id: string): boolean => {
    const t = ing[id]?.t;
    if (!t || t === 'veg') return true;
    if (t === 'egg') return canEgg;
    return canChicken;
  };
  // Stable sorts: the rotated order inside each group is preserved.
  const preferAnchors = (ids: string[]) =>
    ids.slice().sort((x, y) => Number(goalAssigned(y)) - Number(goalAssigned(x)));
  const preferPairs = (list: Array<[string, number]>) =>
    list.slice().sort((x, y) => Number(goalAssigned(y[0])) - Number(goalAssigned(x[0])));

  // Dense anchors per meal (rotation gives each variant a different mix);
  // the fallbacks only matter when the primary foods are off the menu.
  // The keys below are `menu_items` names run through `normFoodName`, so they are
  // derived from the DB rather than declared here. This is only the set of foods
  // the solver prefers — no nutrition or price is written in this file.
  const fallbackAnchors = [
    'soya',
    canChicken ? 'chicken breast' : null,
    'paneer',
    'chickpeas',
    canEgg ? 'egg' : null,
  ].filter((x): x is string => !!x);
  const anchorsFor = (primary: string[]) =>
    preferAnchors(Array.from(new Set([...primary, ...fallbackAnchors])).filter(ok));
  const morningAnchors = anchorsFor(
    canChicken ? rotate(['soya', 'chicken breast'], variant) : ['soya'],
  );
  const afternoonAnchors = anchorsFor(
    canChicken ? rotate(['chicken breast', 'soya'], variant) : ['soya'],
  );
  const nightAnchors = anchorsFor(['soya']);

  const bananaFillers: Array<[string, number]> = [
    ['banana', caps.ban],
    ['regular banana', caps.ban],
    ['nendran banana', caps.ban],
    ['red banana', caps.ban],
  ];
  const morningFillers = preferPairs(
    rotate(
      [
        ...bananaFillers,
        ['white rice', caps.rice],
        ['sweet potato', caps.sweet],
      ] as Array<[string, number]>,
      variant,
    ).filter(([id]) => ok(id)),
  );
  const carbFillers = preferPairs(
    rotate(
      [
        ['white rice', caps.rice],
        ['sweet potato', caps.sweet],
      ] as Array<[string, number]>,
      variant,
    ).filter(([id]) => ok(id)),
  );
  const nightFillers = preferPairs(
    rotate(
      [
        ['peanut', caps.peanut],
        ['white rice', caps.rice],
        ['sweet potato', caps.sweet],
        ['paneer', caps.paneer],
      ] as Array<[string, number]>,
      variant,
    ).filter(([id]) => ok(id)),
  );
  const sides = preferPairs([
    ['cucumber', 120],
    ['green beans', 120],
    ['chickpeas', 100],
  ] as Array<[string, number]>);
  const pickSide = (i: number) => rotate(sides, i).find(([id]) => ok(id));

  // Each goal-assigned food earns a rotating featured serving (inside its own
  // window) in exactly one meal per plan. Keying the meal on the variant means
  // "Mix the foods differently" relocates the food instead of dropping it, and
  // the food is excluded from that meal's anchor/filler pools so its fixed
  // grams can never stack with a solver pick beyond the window.
  const goalFoodIds = Object.keys(ing).filter(
    (id) => ok(id) && goalAssigned(id) && canEat(id),
  );
  const featuredFor = (mealIdx: number) =>
    goalFoodIds
      .map((id, idx) => ({ id, idx }))
      .filter(({ idx }) => (variant + idx) % 3 === mealIdx)
      .map(({ id }) => ({ id, g: clampPortion(FEATURED_SERVING, boundsOf(ing, id, goal)) }));

  const featuredMorning = featuredFor(0);
  const fixedMorning: Array<{ id: string; g: number }> = [];
  if (canEgg && ok('egg')) fixedMorning.push({ id: 'egg', g: 50 });
  if (ok('watermelon')) fixedMorning.push({ id: 'watermelon', g: 150 });
  for (const f of featuredMorning) {
    if (!fixedMorning.some((x) => x.id === f.id)) fixedMorning.push(f);
  }
  const morning = fillMeal(
    ing,
    fixedMorning,
    morningAnchors,
    morningFillers,
    shareK[0],
    shareP[0],
    goal,
    new Set(featuredMorning.map((f) => f.id)),
  );

  const sideA = pickSide(variant);
  const featuredAfternoon = featuredFor(1);
  const fixedAfternoon: Array<{ id: string; g: number }> = sideA
    ? [{ id: sideA[0], g: sideA[1] }]
    : [];
  for (const f of featuredAfternoon) {
    if (!fixedAfternoon.some((x) => x.id === f.id)) fixedAfternoon.push(f);
  }
  const afternoon = fillMeal(
    ing,
    fixedAfternoon,
    afternoonAnchors,
    carbFillers,
    shareK[1],
    shareP[1],
    goal,
    new Set(featuredAfternoon.map((f) => f.id)),
  );

  const sideN = pickSide(variant + 1);
  const featuredNight = featuredFor(2);
  const fixedNight: Array<{ id: string; g: number }> = sideN
    ? [{ id: sideN[0], g: sideN[1] }]
    : [];
  for (const f of featuredNight) {
    if (!fixedNight.some((x) => x.id === f.id)) fixedNight.push(f);
  }
  const night = fillMeal(
    ing,
    fixedNight,
    nightAnchors,
    nightFillers,
    shareK[2],
    shareP[2],
    goal,
    new Set(featuredNight.map((f) => f.id)),
  );

  const results = [morning, afternoon, night];
  const mealItems = results.map((r) => r.items);
  const meals: PlanMeal[] = MEAL_ORDER.map((name, i) => ({
    name,
    items: mealItems[i],
    limited: results[i].limited,
  })).filter((m) => m.items.length > 0);

  const items: MealItem[] = [];
  mealItems.forEach((mi) =>
    mi.forEach((it) => {
      const e = items.find((x) => x.id === it.id);
      if (e) e.g = round1(e.g + it.g);
      else items.push({ ...it });
    }),
  );

  const protein = Math.round(
    items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0),
  );
  const kcal = Math.round(
    items.reduce((s, it) => s + kOf(ing, it.id, it.g), 0),
  );
  const mealTargets: Record<string, MealTarget> = {};
  MEAL_ORDER.forEach((name, i) => {
    mealTargets[name] = { kcal: shareK[i], protein: shareP[i] };
  });

  const limitedMeals = meals.filter((m) => m.limited).map((m) => m.name);

  return {
    items,
    meals,
    protein,
    kcal,
    protT,
    kcalT,
    mealTargets,
    limitedMeals,
    limitWarning:
      limitedMeals.length > 0
        ? `Some meals can't reach their full target without breaking a food's portion limit (${limitedMeals.join(', ')}). The plan stays inside every configured limit.`
        : null,
  };
}

/** Cycles a list so index `start` comes first — used to rotate food picks. */
export const rotate = <T,>(arr: T[], start: number): T[] =>
  arr.map((_, i) => arr[(start + i) % arr.length]);

export interface Coverage {
  delNames: string[];
  delMeals: PlanMeal[];
  selfMeals: PlanMeal[];
  delProt: number;
  price: number;
}

export function coverage(
  plan: BuiltPlan,
  freq: number,
  ing: Record<string, IngredientData>,
  preferredSlots?: string[],
): Coverage {
  const protOf = (m: PlanMeal) =>
    m.items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0);
  const ranked = [...plan.meals].sort((x, y) => protOf(y) - protOf(x));
  const delNames =
    preferredSlots && preferredSlots.length === freq
      ? preferredSlots
      : freq >= 3
        ? plan.meals.map((m) => m.name)
        : ranked.slice(0, freq).map((m) => m.name);
  const delMeals = plan.meals.filter((m) => delNames.includes(m.name));
  const selfMeals = plan.meals.filter((m) => !delNames.includes(m.name));
  const delProt = Math.round(
    delMeals.reduce((s, m) => s + protOf(m), 0),
  );
  const activeDelMeals = delMeals.filter((m) => m.items.length > 0);
  const ingredientsCost = delMeals.reduce(
    (s, m) => s + m.items.reduce((x, it) => x + costOf(ing, it.id, it.g), 0),
    0,
  );
  // Daily price = menu cost of the food (grams/100 x DB menu price) + ₹50 per
  // selected meal. No margin and no cookable surcharge. 0 if nothing is filled.
  const price =
    activeDelMeals.length > 0
      ? ingredientsCost + MEAL_CHARGE * delMeals.length
      : 0;
  return { delNames, delMeals, selfMeals, delProt, price };
}

// Per selected meal per day charged by the business (kept in sync with the
// constant that used to live in Onboarding.tsx).
const MEAL_CHARGE = 70;
