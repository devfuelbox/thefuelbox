/**
 * Live-DB verification for the portion-limit and goal-category features.
 *
 * Checks the two features end-to-end against the real `fuelbox_db`:
 *  - Paneer has a configured 50–150 g window and gain/muscle categories;
 *    Soya has no limits and no categories.
 *  - A plan built from the live rows (muscle goal) never violates a window.
 *  - A crafted plan that puts Paneer at 200 g is rejected; 50 g Paneer and
 *    260 g Soya pass.
 *  - Only in-stock foods are offered to the planner.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' \
 *     scripts/verify_meal_plan_limits.ts
 */
import 'dotenv/config';
import path from 'path';
import { getDbModels } from '../src/lib/db';
import {
  findPlanPortionViolations,
  portionBoundsForGoal,
  toGoalPortions,
  violatesPortion,
  type MenuLimitRow,
} from '../src/lib/menuPortionLimits';
import { toGoalCategoryList } from '../src/lib/goalCategories';
import { buildPlan, type IngredientData } from '../src/lib/mealSolver';

let failures = 0;
function checkBase(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  ✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const normFoodName = (s: string) =>
  s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

const dietTag = (diet: unknown): IngredientData['t'] => {
  const d = String(diet ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  if (d === 'egg') return 'egg';
  if (d === 'nonveg' || d === 'nonvegetarian') return 'nonveg';
  return 'veg';
};

// Mirror of Onboarding.foodsFromRows — the plan is fed exactly what the page
// would see from the same /api/menu source.
function foodsFromRows(rows: any[]): Record<string, IngredientData> {
  const ing: Record<string, IngredientData> = {};
  for (const row of rows) {
    const name = String(row?.name ?? '').trim();
    if (!name) continue;
    const key = normFoodName(name);
    if (!key || ing[key]) continue;
    ing[key] = {
      dbId: Number(row.id ?? 0),
      n: name,
      t: dietTag(row.diet),
      k: Number(row.calories ?? 0),
      p: Number(row.protein_g ?? 0),
      c: Number(row.carbs_g ?? 0),
      f: Number(row.fat_g ?? 0),
      fi: Number(row.fiber_g ?? 0),
      price: Number(row.price ?? 0),
      cookable: row.cookable === true || row.cookable === 1 || row.cookable === '1',
      category: String(row.category ?? ''),
      gc: toGoalCategoryList(row.goal_categories),
      min: row.min_grams == null ? null : Number(row.min_grams),
      max: row.max_grams == null ? null : Number(row.max_grams),
      gp: toGoalPortions(row.goal_portions),
    };
  }
  return ing;
}

async function main() {
  const { MenuItem } = await getDbModels();
  const allRows = await (MenuItem as any).findAll({ raw: true });
  const inStock = allRows.filter((r: any) => r.is_available === true || r.is_available === 1 || r.is_available === '1');
  const rowByName = (n: string) => allRows.find((r: any) => String(r.name).trim().toLowerCase() === n.toLowerCase());

  console.log(`Loaded ${allRows.length} menu rows (${inStock.length} in stock) from fuelbox_db\n`);

  // ── 1. Paneer: configured window + goal categories ──────────────────────
  console.log('Paneer (configured)');
  const paneer = rowByName('Paneer');
  checkBase('Paneer exists in menu_items', !!paneer);
  if (paneer) {
    checkBase('min_grams = 50', Number(paneer.min_grams) === 50, String(paneer.min_grams));
    checkBase('max_grams = 150', Number(paneer.max_grams) === 150, String(paneer.max_grams));
    const gc = toGoalCategoryList(paneer.goal_categories);
    checkBase('goal_categories include muscle (the goal under test)', gc.includes('muscle'), gc.join(', '));
    checkBase('Paneer is in stock', inStock.includes(paneer));
    // No per-goal limits configured on this database yet — the muscle window
    // must fall back to the item's default rather than turning unlimited.
    const muscleBounds = portionBoundsForGoal(
      { min_grams: paneer.min_grams, max_grams: paneer.max_grams, goal_portions: paneer.goal_portions },
      'muscle',
    );
    checkBase(
      "Paneer's muscle window falls back to its default 50–150 g",
      muscleBounds.min === 50 && muscleBounds.max === 150,
      JSON.stringify(muscleBounds),
    );
  }

  // ── 2. Soya: no window, no categories (do not assume Paneer's limits) ───
  console.log('\nSoya (unlimited)');
  const soya = rowByName('Soya');
  checkBase('Soya exists in menu_items', !!soya);
  if (soya) {
    checkBase('min_grams is NULL', soya.min_grams == null, String(soya.min_grams));
    checkBase('max_grams is NULL', soya.max_grams == null, String(soya.max_grams));
    const gcs = toGoalCategoryList(soya.goal_categories);
    checkBase('goal_categories empty (every goal)', gcs.length === 0, gcs.join(', '));
  }

  // ── 3. Live plan: every gram inside its configured window ───────────────
  console.log('\nLive muscle plan (all four variants)');
  const ing = foodsFromRows(inStock);
  const answers = {
    goal: 'muscle' as const,
    age: 28,
    gender: 'Male' as const,
    height: 176,
    weight: 70,
    food: 'veg' as const,
    activity: 'gym' as const,
    freq: 3,
    name: 'Verifier',
    email: '',
    phone: '9999999999',
  };
  let planOk = true;
  let soyaOver150 = false;
  let paneerEveryVariant = true;
  let paneerWindow = true;
  let totalsOk = true;
  for (let v = 0; v < 4; v++) {
    const plan = buildPlan(answers, v, ing);
    let variantPaneer = 0;
    for (const meal of plan.meals) {
      for (const it of meal.items) {
        const d = ing[it.id];
        const bounds = portionBoundsForGoal(
          { min_grams: d.min, max_grams: d.max, goal_portions: d.gp },
          answers.goal,
        );
        if (violatesPortion(it.g, bounds)) {
          planOk = false;
          console.error(`    ✖ variant ${v} ${meal.name}: ${it.id} at ${it.g} g outside ${JSON.stringify(bounds)}`);
        }
        if (it.id === 'paneer') {
          variantPaneer++;
          if (it.g < 50 || it.g > 150) paneerWindow = false;
        }
        if (it.id === 'soya' && it.g > 150) soyaOver150 = true;
      }
    }
    if (variantPaneer < 1) paneerEveryVariant = false;
    if (plan.kcal !== plan.kcalT || plan.protein !== plan.protT) totalsOk = false;
    console.log(
      `  variant ${v}: ~${plan.kcal} kcal / ${plan.protein} g — ${plan.meals
        .map((m) => `${m.name}: ${m.items.map((i) => `${ing[i.id].n} ${i.g}g`).join(', ')}`)
        .join(' | ')}${plan.limitWarning ? ' [limited]' : ''}`,
    );
  }
  checkBase('every item stays inside its configured window', planOk);
  checkBase('Paneer (a muscle-assigned food) appears in every muscle plan', paneerEveryVariant);
  checkBase('Paneer stays inside its 50–150 g window', paneerWindow);
  checkBase('every muscle plan hits its calorie + protein target exactly', totalsOk);
  checkBase('Soya is free to exceed 150 g (no configured max)', soyaOver150);
  checkBase('Soya is not silently clamped like Paneer', soyaOver150 === true);

  // ── 4. Saved-plan validator against crafted requests ────────────────────
  console.log('\nSaved-plan validator');
  const rows: MenuLimitRow[] = allRows.map((r: any) => ({
    id: r.id,
    name: r.name,
    min_grams: r.min_grams,
    max_grams: r.max_grams,
    goal_portions: r.goal_portions,
  }));

  checkBase(
    'Paneer @ 200 g is rejected',
    findPlanPortionViolations({ meals: [{ name: 'Morning', items: [{ id: 'paneer', grams: 200 }] }] }, rows).length === 1,
  );
  checkBase(
    'Paneer @ 50 g is accepted',
    findPlanPortionViolations({ meals: [{ name: 'Morning', items: [{ id: 'paneer', grams: 50 }] }] }, rows).length === 0,
  );
  checkBase(
    'Paneer @ 150 g is accepted',
    findPlanPortionViolations({ meals: [{ name: 'Morning', items: [{ id: 'paneer', grams: 150 }] }] }, rows).length === 0,
  );
  checkBase(
    'Soya @ 260 g is accepted (no window configured)',
    findPlanPortionViolations({ meals: [{ name: 'Morning', items: [{ id: 'soya', grams: 260 }] }] }, rows).length === 0,
  );

  // Soya's real primary key — plans edited in the admin UI store numeric ids,
  // so the lookup must resolve through menu_items.id, not a hardcoded guess.
  const soyaId = soya ? Number(soya.id) : -1;
  const numericPlan = [{ name: 'Morning', items: [{ id: soyaId, g: 260 }] }];
  checkBase('numeric-id Soya @ 260 g also passes', findPlanPortionViolations(numericPlan, rows).length === 0);

  // ── 5. Stock: the planner only ever sees in-stock rows ──────────────────
  console.log('\nStock source');
  const banned = allRows.filter((r: any) => !inStock.includes(r));
  const bannedNames = banned.map((r: any) => String(r.name));
  const offeredKeys = Object.keys(ing);
  const offeredNames = offeredKeys.map((k) => ing[k].n);
  const offeredOnlyInStock = offeredNames.every((o) =>
    inStock.some((r) => normFoodName(String(r.name)) === normFoodName(o)),
  );
  checkBase('the planner source contains only in-stock foods', offeredOnlyInStock);
  if (banned.length > 0) {
    checkBase(
      'out-of-stock foods are excluded from the planner source',
      bannedNames.every((n) => !offeredNames.some((o) => normFoodName(n) === normFoodName(o))),
    );
  } else {
    console.log(
      '  ℹ every row is in stock on this database — the exclusion check is vacuous; the source is /api/menu which filters is_available = true',
    );
  }

  console.log(failures === 0 ? '\n✅ All live checks passed' : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});