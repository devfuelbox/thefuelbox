// Unit tests for the per-food portion limits (min/max grams) and their
// enforcement end-to-end: parsing (admin writes), the window helpers, the
// saved-plan validator and the meal solver.
//
// Run with:  npm test   (node --test "tests/*.test.mjs")
//
// The solver chain is TypeScript with no runtime deps of its own
// (menuPortionLimits → healthCalculations → mealSolver), so the three modules
// are transpiled here and the solver's relative import specifiers rewritten to
// the generated files. Row names below are real `menu_items` names, so both
// numeric-id and normalised-name plan lookups find the same food.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

function transpile(srcFile, outFile, rewrites = {}) {
  let code = ts.transpileModule(fs.readFileSync(srcFile, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [from, to] of Object.entries(rewrites)) {
    code = code.split(from).join(to);
  }
  fs.writeFileSync(outFile, code);
}

const LIMITS_OUT = path.join(HERE, ".menuPortionLimits.mjs");
const HEALTH_OUT = path.join(HERE, ".healthCalculations.mjs");
const GOALS_OUT = path.join(HERE, ".goalCategories.mjs");
const SOLVER_OUT = path.join(HERE, ".mealSolver.mjs");

transpile(path.join(ROOT, "src", "lib", "goalCategories.ts"), GOALS_OUT);
transpile(path.join(ROOT, "src", "lib", "menuPortionLimits.ts"), LIMITS_OUT, {
  "'./goalCategories'": "'./.goalCategories.mjs'",
});
transpile(path.join(ROOT, "src", "lib", "healthCalculations.ts"), HEALTH_OUT);
transpile(path.join(ROOT, "src", "lib", "mealSolver.ts"), SOLVER_OUT, {
  "'./healthCalculations'": "'./.healthCalculations.mjs'",
  "'./menuPortionLimits'": "'./.menuPortionLimits.mjs'",
  "'./goalCategories'": "'./.goalCategories.mjs'",
});

const {
  PORTION_FIELDS,
  GOAL_PORTIONS_FIELD,
  MAX_PORTION_G,
  parsePortionLimits,
  parseGoalPortions,
  toGoalPortions,
  checkPortionRange,
  portionBounds,
  portionBoundsForGoal,
  clampPortion,
  violatesPortion,
  portionRuleText,
  findPlanPortionViolations,
} = await import(`file://${LIMITS_OUT}?v=${Date.now()}`);

const {
  buildPlan,
  coverage,
  kOf,
  pOf,
  costOf,
} = await import(`file://${SOLVER_OUT}?v=${Date.now()}`);

// ─── test data ──────────────────────────────────────────────────────────────

// The normaliser mirrors Onboarding's normFoodName; the row names are real
// seeded names so their keys match what the solver looks for ("chicken breast",
// "white rice", "soya", "paneer", …).
const norm = (s) =>
  String(s).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

// A small menu shaped like the seeded one. Paneer is the only food with a
// configured window (50–150 g) and the only one assigned to gains.
const MENU_ROWS = [
  { id: 1, name: "Paneer", k: 265, p: 18, c: 2.4, f: 20, fg: 0.2, price: 25, cookable: 1, diet: "veg", gc: ["gain", "muscle"], min: 50, max: 150 },
  { id: 2, name: "Soya", k: 345, p: 52, c: 33, f: 0.5, fg: 13, price: 20, cookable: 1, diet: "veg", gc: [], min: null, max: null },
  { id: 3, name: "White Rice (cooked)", k: 130, p: 2.7, c: 28, f: 0.3, fg: 0.4, price: 12, cookable: 1, diet: "veg", gc: [], min: null, max: null },
  { id: 4, name: "Egg", k: 155, p: 13, c: 1.1, f: 11, fg: 0, price: 10, cookable: 1, diet: "egg", gc: [], min: null, max: null },
  { id: 5, name: "Banana", k: 89, p: 1.1, c: 22.8, f: 0.3, fg: 2.6, price: 10, cookable: 0, diet: "veg", gc: [], min: null, max: null },
  { id: 6, name: "Sweet Potato (boiled)", k: 76, p: 1.4, c: 17.7, f: 0.1, fg: 2.5, price: 15, cookable: 1, diet: "veg", gc: [], min: null, max: null },
  { id: 7, name: "Peanut", k: 567, p: 25.8, c: 16.1, f: 49.2, fg: 8.5, price: 25, cookable: 1, diet: "veg", gc: [], min: null, max: null },
  { id: 8, name: "Cucumber (raw)", k: 16, p: 0.7, c: 3.6, f: 0.1, fg: 0.5, price: 10, cookable: 0, diet: "veg", gc: [], min: null, max: null },
  { id: 9, name: "Green Beans (cooked)", k: 35, p: 1.9, c: 7.9, f: 0.3, fg: 3.2, price: 15, cookable: 1, diet: "veg", gc: [], min: null, max: null },
  { id: 10, name: "Watermelon", k: 30, p: 0.6, c: 7.6, f: 0.2, fg: 0.4, price: 15, cookable: 0, diet: "veg", gc: [], min: null, max: null },
];

/** menu_items rows → the solver's food map (IngredientData). */
const toIng = (rows) => {
  const map = {};
  for (const r of rows) {
    const key = norm(r.name);
    if (!key || map[key]) continue;
    map[key] = {
      dbId: r.id,
      n: r.name,
      t: r.diet === "non_veg" ? "nonveg" : r.diet === "egg" ? "egg" : "veg",
      k: r.k,
      p: r.p,
      c: r.c,
      f: r.f,
      fi: r.fg,
      price: r.price,
      cookable: !!r.cookable,
      category: r.category || "",
      gc: r.gc || [],
      min: r.min ?? null,
      max: r.max ?? null,
      gp: r.gp || null,
    };
  }
  return map;
};

const ANSWERS = (goal) => ({
  goal,
  age: 28,
  gender: "Male",
  height: 175,
  weight: 72,
  food: "veg",
  activity: "gym",
  freq: 3,
  name: "Tester",
  phone: "9999999999",
});

const mealsOf = (plan) => plan.meals.flatMap((m) => m.items);

/** The window paneer would be judged against from its DB row. */
const PANEER_BOUNDS = { min: 50, max: 150 };

// ─── parsing (write path — admin routes) ────────────────────────────────────

test("a body with no portion fields updates nothing", () => {
  const r = parsePortionLimits({ name: "Paneer", price: 150, calories: 265 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.updates, {});
});

test("blank values clear a limit", () => {
  for (const blank of ["", null, undefined]) {
    const r = parsePortionLimits({ min_grams: blank, max_grams: blank });
    assert.equal(r.ok, true, `${String(blank)} should be accepted`);
    assert.deepEqual(r.updates, { min_grams: null, max_grams: null });
  }
});

test("grams are accepted as numbers or strings and stored whole", () => {
  assert.deepEqual(parsePortionLimits({ min_grams: 20 }).updates, { min_grams: 20 });
  assert.deepEqual(parsePortionLimits({ min_grams: "20" }).updates, { min_grams: 20 });
  assert.deepEqual(parsePortionLimits({ max_grams: " 300 " }).updates, { max_grams: 300 });
  assert.deepEqual(parsePortionLimits({ max_grams: 29.6 }).updates, { max_grams: 30 });
  assert.deepEqual(parsePortionLimits({ min_grams: 0 }).updates, { min_grams: 0 });
});

test("only the fields actually sent come back", () => {
  const r = parsePortionLimits({ min_grams: 20 });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.updates), ["min_grams"]);
});

test("negative grams are rejected", () => {
  for (const field of PORTION_FIELDS) {
    const r = parsePortionLimits({ [field]: -1 });
    assert.equal(r.ok, false, `${field} = -1 should be rejected`);
    assert.match(r.message, /cannot be negative/);
  }
});

test("non-numeric grams are rejected", () => {
  const r = parsePortionLimits({ min_grams: "lots" });
  assert.equal(r.ok, false);
  assert.match(r.message, /must be a number of grams/);
  assert.equal(parsePortionLimits({ max_grams: NaN }).ok, false);
});

test(`grams above ${MAX_PORTION_G} are rejected`, () => {
  const r = parsePortionLimits({ max_grams: MAX_PORTION_G + 1 });
  assert.equal(r.ok, false);
  assert.match(r.message, new RegExp(`cannot exceed ${MAX_PORTION_G} g`));
  assert.equal(parsePortionLimits({ max_grams: MAX_PORTION_G }).ok, true);
});

test("minimum above maximum is rejected, equal is fine", () => {
  assert.match(checkPortionRange(200, 100) ?? "", /cannot be greater than/);
  assert.equal(checkPortionRange(100, 100), null);
});

test("an unset bound never clashes with the other", () => {
  assert.equal(checkPortionRange(null, 100), null);
  assert.equal(checkPortionRange(50, null), null);
  assert.equal(checkPortionRange(null, null), null);
});

test("an update is checked against the value it will stand next to", () => {
  const stored = { min_grams: null, max_grams: 300 };
  const { updates } = parsePortionLimits({ min_grams: 400 });
  const nextMin = "min_grams" in updates ? updates.min_grams : stored.min_grams;
  const nextMax = "max_grams" in updates ? updates.max_grams : stored.max_grams;
  assert.match(checkPortionRange(nextMin, nextMax) ?? "", /cannot be greater than/);

  const { updates: u2 } = parsePortionLimits({ max_grams: 500 });
  const next2 = { min_grams: 200, max_grams: u2.max_grams };
  assert.equal(checkPortionRange(next2.min_grams, next2.max_grams), null);
});

// ─── the window helpers (read path — planner and validator share these) ─────

test("NULL / missing bounds mean no window", () => {
  assert.deepEqual(portionBounds({ min_grams: null, max_grams: null }), { min: 0, max: null });
  assert.deepEqual(portionBounds(undefined), { min: 0, max: null });
});

test("a zero or negative maximum is treated as unset", () => {
  assert.deepEqual(portionBounds({ min_grams: null, max_grams: 0 }), { min: 0, max: null });
  assert.deepEqual(portionBounds({ min_grams: 50, max_grams: 50 }), { min: 50, max: 50 });
});

test("clamping forces grams into the window", () => {
  assert.equal(clampPortion(40, PANEER_BOUNDS), 50);
  assert.equal(clampPortion(200, PANEER_BOUNDS), 150);
  assert.equal(clampPortion(90, PANEER_BOUNDS), 90);
  assert.equal(clampPortion(-5, PANEER_BOUNDS), 50);
  assert.equal(clampPortion(0, { min: 0, max: null }), 0);
  assert.equal(clampPortion(1000, { min: 0, max: 500 }), 500);
});

test("violation detection matches the clamp", () => {
  assert.equal(violatesPortion(49, PANEER_BOUNDS), true);
  assert.equal(violatesPortion(50, PANEER_BOUNDS), false);
  assert.equal(violatesPortion(150, PANEER_BOUNDS), false);
  assert.equal(violatesPortion(151, PANEER_BOUNDS), true);
  // No window: every positive amount passes
  assert.equal(violatesPortion(260, { min: 0, max: null }), false);
  assert.equal(violatesPortion(-1, { min: 0, max: null }), true);
});

test("the rule text reads like an admin-facing sentence", () => {
  assert.match(portionRuleText("Paneer", PANEER_BOUNDS), /between 50 g and 150 g/);
  assert.match(portionRuleText("Paneer", { min: 0, max: null }), /no portion limit/);
});

// ─── per-goal windows (menu_items.goal_portions) ────────────────────────────

test("parseGoalPortions accepts canonical keys and admin labels", () => {
  assert.deepEqual(parseGoalPortions({ gain: { min: 100, max: 150 } }).value, {
    gain: { min: 100, max: 150 },
  });
  assert.deepEqual(
    parseGoalPortions({ "Weight Gain": { min: 100 }, "weight_loss": { max: 100 } }).value,
    { gain: { min: 100, max: null }, loss: { min: null, max: 100 } },
  );
  // Blank clears the whole map, like every other limit field.
  assert.deepEqual(parseGoalPortions(null).value, {});
  assert.deepEqual(parseGoalPortions("").value, {});
  assert.deepEqual(parseGoalPortions(undefined).value, {});
});

test("parseGoalPortions rounds to whole grams and validates each bound", () => {
  // Numbers and numeric strings, stored whole.
  assert.deepEqual(parseGoalPortions({ gain: { min: "100", max: 149.6 } }).value, {
    gain: { min: 100, max: 150 },
  });
  // Negative, non-numeric and over-cap grams are rejected.
  assert.equal(parseGoalPortions({ gain: { min: -1 } }).ok, false);
  assert.equal(parseGoalPortions({ gain: { min: "lots" } }).ok, false);
  assert.equal(parseGoalPortions({ gain: { max: MAX_PORTION_G + 1 } }).ok, false);
});

test("parseGoalPortions rejects bad shapes and unknown goals", () => {
  assert.equal(parseGoalPortions(["gain"]).ok, false); // array is not a map
  assert.equal(parseGoalPortions("gain").ok, false);
  assert.equal(parseGoalPortions({ keto: { min: 50 } }).ok, false);
  assert.equal(parseGoalPortions({ gain: 50 }).ok, false);
  assert.equal(parseGoalPortions({ gain: { min: 200, max: 100 } }).ok, false);
});

test("a blank goal entry and a both-null entry are dropped (inherit default)", () => {
  assert.deepEqual(parseGoalPortions({ gain: {} }).value, {});
  assert.deepEqual(parseGoalPortions({ gain: { min: null, max: null } }).value, {});
  assert.deepEqual(parseGoalPortions({ gain: null }).value, {});
});

test("reading goal_portions tolerates whatever the DB returns", () => {
  assert.deepEqual(toGoalPortions(null), {});
  assert.deepEqual(toGoalPortions('{"gain":{"min":100,"max":150}}'), {
    gain: { min: 100, max: 150 },
  });
  assert.deepEqual(toGoalPortions({ loss: { min: 50, max: 100 }, keto: { min: 1 } }), {
    loss: { min: 50, max: 100 },
  });
  assert.deepEqual(toGoalPortions("{not json"), {});
  assert.deepEqual(toGoalPortions("gain"), {});
  assert.deepEqual(toGoalPortions([{ gain: 1 }]), {});
});

test("portionBoundsForGoal prefers the goal's window, else the default", () => {
  const row = {
    min_grams: 50,
    max_grams: 150,
    goal_portions: { gain: { min: 100, max: 150 }, loss: { min: 50, max: 100 } },
  };
  assert.deepEqual(portionBoundsForGoal(row, "gain"), { min: 100, max: 150 });
  assert.deepEqual(portionBoundsForGoal(row, "loss"), { min: 50, max: 100 });
  // Muscle/maintenance have no entry → the default window applies.
  assert.deepEqual(portionBoundsForGoal(row, "muscle"), { min: 50, max: 150 });
  assert.deepEqual(portionBoundsForGoal(row, "maintenance"), { min: 50, max: 150 });
  // Unknown or absent goal → default too.
  assert.deepEqual(portionBoundsForGoal(row, "keto"), { min: 50, max: 150 });
  assert.deepEqual(portionBoundsForGoal(row, undefined), { min: 50, max: 150 });
  // No goal_portions at all → identical to portionBounds.
  assert.deepEqual(
    portionBoundsForGoal({ min_grams: 50, max_grams: 150, goal_portions: null }, "gain"),
    portionBounds({ min_grams: 50, max_grams: 150 }),
  );
  // The window semantics (unset/zero = no limit) apply to goal entries too.
  assert.deepEqual(portionBoundsForGoal({ min_grams: null, max_grams: null, goal_portions: { gain: { min: 0, max: 0 } } }, "gain"), { min: 0, max: null });
});

// ─── the saved-plan validator (backend save routes) ─────────────────────────

test("validator accepts paneer at 50 g and 150 g", () => {
  const rows = MENU_ROWS.map((r) => ({ id: r.id, name: r.name, min_grams: r.min, max_grams: r.max }));
  for (const grams of [50, 150]) {
    const plan = { meals: [{ name: "Morning", items: [{ id: "paneer", grams }] }] };
    assert.deepEqual(findPlanPortionViolations(plan, rows), [], `paneer ${grams}g should pass`);
  }
});

test("validator rejects paneer at 49 g and 200 g", () => {
  const rows = MENU_ROWS.map((r) => ({ id: r.id, name: r.name, min_grams: r.min, max_grams: r.max }));
  for (const grams of [49, 200]) {
    const plan = { meals: [{ name: "Morning", items: [{ id: "paneer", grams }] }] };
    const v = findPlanPortionViolations(plan, rows);
    assert.equal(v.length, 1, `paneer ${grams}g should violate`);
    assert.match(v[0].message, /between 50 g and 150 g/);
  }
});

test("validator lets a food with no window pass at any grams", () => {
  const rows = MENU_ROWS.map((r) => ({ id: r.id, name: r.name, min_grams: r.min, max_grams: r.max }));
  const plan = { meals: [{ name: "Morning", items: [{ id: "soya", grams: 260 }] }] };
  assert.deepEqual(findPlanPortionViolations(plan, rows), [], "soya has no configured window");
});

test("validator judges portions against the goal's own window when given one", () => {
  const rows = MENU_ROWS.map((r) => ({
    id: r.id,
    name: r.name,
    min_grams: r.min,
    max_grams: r.max,
    goal_portions:
      r.name === "Paneer"
        ? { gain: { min: 100, max: 150 }, loss: { min: 50, max: 100 } }
        : null,
  }));
  const at = (grams) => ({ meals: [{ name: "Morning", items: [{ id: "paneer", grams }] }] });
  // 75 g sits inside loss (50–100) but outside gain (100–150).
  assert.deepEqual(findPlanPortionViolations(at(75), rows, "loss"), []);
  assert.equal(findPlanPortionViolations(at(75), rows, "gain").length, 1);
  // No goal → the default window (50–150) decides.
  assert.deepEqual(findPlanPortionViolations(at(75), rows, undefined), []);
  assert.equal(findPlanPortionViolations(at(200), rows, undefined).length, 1);
  // Unknown goal falls back to the default window too.
  assert.deepEqual(findPlanPortionViolations(at(75), rows, "keto"), []);
});

test("validator accepts both plan shapes (name ids and numeric ids)", () => {
  const rows = MENU_ROWS.map((r) => ({ id: r.id, name: r.name, min_grams: r.min, max_grams: r.max }));
  // { meals } shape with normalised-name ids — what the onboarding saves
  const named = { meals: [{ name: "Morning", items: [{ name: "Paneer", grams: 200 }] }] };
  // bare-array shape with numeric menu ids — what admin edits store
  const numeric = [{ name: "Morning", items: [{ id: 1, g: 49 }] }];
  assert.equal(findPlanPortionViolations(named, rows).length, 1);
  assert.equal(findPlanPortionViolations(numeric, rows).length, 1);
  // and the matching food without a window passes in both shapes
  const soyaNamed = { meals: [{ name: "Morning", items: [{ id: "soya", grams: 260 }] }] };
  const soyaNumeric = [{ name: "Morning", items: [{ id: 2, g: 260 }] }];
  assert.deepEqual(findPlanPortionViolations(soyaNamed, rows), []);
  assert.deepEqual(findPlanPortionViolations(soyaNumeric, rows), []);
});

// ─── the solver enforces the windows it is given ────────────────────────────

test("no plan item ever violates its configured window", () => {
  const ing = toIng(MENU_ROWS);
  for (let v = 0; v < 4; v++) {
    const plan = buildPlan(ANSWERS("gain"), v, ing);
    for (const it of mealsOf(plan)) {
      const d = ing[it.id];
      assert.equal(
        violatesPortion(it.g, portionBounds({ min_grams: d.min, max_grams: d.max })),
        false,
        `${it.id} at ${it.g} g should stay inside its window (variant ${v})`,
      );
    }
  }
});

test("the same food is clamped only when a window is configured", () => {
  const P = { id: 1, name: "Paneer", k: 265, p: 18, c: 2.4, f: 20, fg: 0.2, price: 25, cookable: 1, diet: "veg", gc: ["gain", "muscle"], min: null, max: null };
  const R = MENU_ROWS[2]; // white rice
  const B = MENU_ROWS[4]; // banana
  // With only paneer as the dense anchor it must carry the meals' protein, so
  // the solver would serve ~250 g per meal with no window…
  const free = buildPlan(ANSWERS("gain"), 0, toIng([P, R, B]));
  const freePaneer = mealsOf(free).filter((i) => i.id === "paneer").map((i) => i.g);
  assert.ok(freePaneer.some((g) => g > 150), `unlimited paneer should exceed 150 g (got ${freePaneer})`);

  // …and once the admin sets 50–150 g, the same meal is clamped into it.
  const bound = buildPlan(ANSWERS("gain"), 0, toIng([{ ...P, min: 50, max: 150 }, R, B]));
  const boundPaneer = mealsOf(bound).filter((i) => i.id === "paneer").map((i) => i.g);
  assert.ok(boundPaneer.length > 0, "paneer should still be the anchor");
  assert.ok(boundPaneer.every((g) => g >= 50 && g <= 150), `capped paneer inside window (got ${boundPaneer})`);
  assert.ok(bound.limitWarning, "clamping a window should set the limit warning");
});

test("an unlimited plan does not claim a limit warning", () => {
  const ing = toIng(MENU_ROWS);
  for (let v = 0; v < 4; v++) {
    const plan = buildPlan(ANSWERS("gain"), v, ing);
    assert.equal(plan.limitWarning, null, `unlimited menu should not warn (variant ${v})`);
    assert.deepEqual(plan.limitedMeals, []);
  }
});

test("totals are recomputed from the actual chosen grams", () => {
  const ing = toIng(MENU_ROWS);
  for (let v = 0; v < 4; v++) {
    const plan = buildPlan(ANSWERS("gain"), v, ing);
    const kcal = Math.round(mealsOf(plan).reduce((s, it) => s + kOf(ing, it.id, it.g), 0));
    const prot = Math.round(mealsOf(plan).reduce((s, it) => s + pOf(ing, it.id, it.g), 0));
    assert.equal(plan.kcal, kcal, `calories match actual grams (variant ${v})`);
    assert.equal(plan.protein, prot, `protein matches actual grams (variant ${v})`);
  }
});

// ─── goal categories filter the foods the solver may use ────────────────────

test("the solver never picks a food the goal filter excluded", () => {
  const ing = toIng(MENU_ROWS);
  // Everything except paneer — the way a "loss" whitelist looks, since paneer
  // is only assigned to gain/muscle.
  const allowed = new Set(Object.keys(ing).filter((id) => id !== "paneer"));
  const plan = buildPlan(ANSWERS("loss"), 0, ing, allowed);
  for (const it of mealsOf(plan)) {
    assert.ok(allowed.has(it.id), `plan used a food excluded by the goal filter: ${it.id}`);
  }
  assert.ok(!plan.items.some((it) => it.id === "paneer"), "loss plan must not contain paneer");
});

test("the goal whitelist keeps paneer for gain and drops it for loss", () => {
  // Mirrors the onboarding: belongsToGoal(gc, goal) decides the whitelist, and
  // buildPlan is given that whitelist. Paneer is gain+muscle, so it is in the
  // gain whitelist and out of the loss one.
  const ing = toIng(MENU_ROWS);
  const eligible = (goal) =>
    Object.keys(ing).filter((id) => {
      const gc = ing[id].gc;
      if (!Array.isArray(gc) || gc.length === 0) return true; // uncategorized = every goal
      return gc.includes(goal);
    });
  assert.ok(eligible("gain").includes("paneer"));
  assert.ok(!eligible("loss").includes("paneer"));
  assert.ok(eligible("loss").includes("soya"), "uncategorized foods stay available under every goal");

  const lossPlan = buildPlan(ANSWERS("loss"), 0, ing, new Set(eligible("loss")));
  assert.ok(!mealsOf(lossPlan).some((it) => it.id === "paneer"), "loss plan must exclude paneer");
});

test("a food assigned to the goal is featured in every variant of that goal's plan", () => {
  // Paneer is gain+muscle in this menu, so a gain or muscle user should see it
  // in every plan, inside its configured 50–150 g window, exactly once — the
  // featured serving. Loss/maintenance are not assigned it, so it never appears.
  const ing = toIng(MENU_ROWS);
  for (const goal of ["gain", "muscle"]) {
    for (let v = 0; v < 4; v++) {
      const plan = buildPlan(ANSWERS(goal), v, ing);
      const paneer = mealsOf(plan).filter((it) => it.id === "paneer");
      assert.equal(paneer.length, 1, `${goal} v${v}: paneer should be featured exactly once`);
      assert.ok(
        paneer[0].g >= 50 && paneer[0].g <= 150,
        `${goal} v${v}: paneer ${paneer[0].g} g must stay inside 50–150`,
      );
      assert.equal(
        plan.limitWarning,
        null,
        `${goal} v${v}: featuring paneer must not push a meal off its target`,
      );
    }
  }
  for (const goal of ["loss", "maintenance"]) {
    for (let v = 0; v < 4; v++) {
      const plan = buildPlan(ANSWERS(goal), v, ing);
      assert.ok(
        !mealsOf(plan).some((it) => it.id === "paneer"),
        `${goal} v${v}: paneer is not assigned to this goal`,
      );
    }
  }
});

test("featuring a goal food works for every goal category", () => {
  // The same food assigned to any single goal must appear under that goal, so
  // Weight Loss / Weight Gain / Weight Maintenance behave like Muscle Gain. It
  // may also anchor a meal where it fits (maintenance's lighter protein target),
  // but every serving must stay inside its window.
  for (const goal of ["loss", "gain", "muscle", "maintenance"]) {
    const ing = toIng([{ ...MENU_ROWS[0], gc: [goal] }, ...MENU_ROWS.slice(1)]);
    for (let v = 0; v < 3; v++) {
      const plan = buildPlan(ANSWERS(goal), v, ing);
      const paneer = mealsOf(plan).filter((it) => it.id === "paneer");
      assert.ok(paneer.length >= 1, `${goal} v${v}: assigned food should appear`);
      for (const it of paneer) {
        assert.ok(
          it.g >= 50 && it.g <= 150,
          `${goal} v${v}: paneer ${it.g} g must stay inside 50–150`,
        );
      }
    }
  }
});

test("Mix (the variant) relocates a goal food without ever dropping it", () => {
  // The featured serving is keyed on the variant, so "Mix the foods
  // differently" moves which meal carries the food — it must never remove it.
  const ing = toIng(MENU_ROWS);
  const seat = (v) => {
    const plan = buildPlan(ANSWERS("muscle"), v, ing);
    return plan.meals.find((m) => m.items.some((i) => i.id === "paneer"))?.name;
  };
  assert.equal(seat(0), "Morning");
  assert.equal(seat(1), "Afternoon");
  assert.equal(seat(2), "Night");
  assert.equal(seat(3), "Morning", "the rotation wraps around");
  for (let v = 0; v < 6; v++) {
    assert.ok(seat(v), `variant ${v} must still feature paneer`);
  }
});

test("a goal-assigned anchor is preferred over an uncategorized staple", () => {
  // Give Paneer (assigned to muscle) no portion window, so it is dense and
  // unconstrained enough to anchor a meal on its own — just like the
  // uncategorized soya. Both could carry a meal exactly; goal-priority must
  // reach for paneer first, so the meals it anchors never fall back to soya.
  const freePaneer = { ...MENU_ROWS[0], min: null, max: null };
  const ing = toIng([freePaneer, ...MENU_ROWS.slice(1)]);
  const plan = buildPlan(ANSWERS("muscle"), 0, ing);
  const anchored = plan.meals.filter((m) => {
    const p = m.items.find((i) => i.id === "paneer");
    return p && p.g > 100; // more than the 100 g featured serving
  });
  assert.ok(anchored.length > 0, "paneer should anchor at least one meal");
  for (const m of anchored) {
    assert.ok(
      !m.items.some((i) => i.id === "soya"),
      `${m.name}: the goal food should win the anchor over the staple`,
    );
  }
  assert.equal(plan.limitWarning, null);
});

test("the solver applies the goal's own window, never just the default", () => {
  // Paneer belongs to gain AND loss with a different window per goal:
  // gain 110–200, loss 50–80. The rotating featured serving (100 g) must clamp
  // into whichever window the active goal has — 110 under gain, 80 under loss —
  // and every other serving must stay inside that goal's window too.
  const paneer = {
    ...MENU_ROWS[0],
    gc: ["gain", "loss"],
    gp: { gain: { min: 110, max: 200 }, loss: { min: 50, max: 80 } },
  };
  const ing = toIng([paneer, ...MENU_ROWS.slice(1)]);
  for (let v = 0; v < 4; v++) {
    const gain = buildPlan(ANSWERS("gain"), v, ing);
    const gainPaneer = mealsOf(gain).filter((it) => it.id === "paneer");
    assert.ok(gainPaneer.length >= 1, `gain v${v}: paneer should appear`);
    for (const it of gainPaneer) {
      assert.ok(
        it.g >= 110 && it.g <= 200,
        `gain v${v}: paneer ${it.g} g must stay inside 110–200`,
      );
    }

    const loss = buildPlan(ANSWERS("loss"), v, ing);
    const lossPaneer = mealsOf(loss).filter((it) => it.id === "paneer");
    assert.ok(lossPaneer.length >= 1, `loss v${v}: paneer should appear`);
    for (const it of lossPaneer) {
      assert.ok(
        it.g >= 50 && it.g <= 80,
        `loss v${v}: paneer ${it.g} g must stay inside 50–80`,
      );
    }
  }
});

test("an uncategorized food with per-goal windows still applies them by goal", () => {
  // Soya has no goal categories (it is offered under every goal) but can still
  // carry a per-goal window. The solver must respect it for the active goal.
  const soya = { ...MENU_ROWS[1], gp: { gain: { min: 200, max: 250 } } };
  const ing = toIng([soya, ...MENU_ROWS.slice(0, 1), ...MENU_ROWS.slice(2)]);
  const plan = buildPlan(ANSWERS("gain"), 0, ing);
  for (const it of mealsOf(plan).filter((x) => x.id === "soya")) {
    assert.ok(it.g >= 200 && it.g <= 250, `gain: soya ${it.g} g must stay inside 200–250`);
  }
});

// ─── pricing still covers the food it prices ────────────────────────────────

test("pricing covers the food cost of the delivered meals", () => {
  const ing = toIng(MENU_ROWS);
  const plan = buildPlan(ANSWERS("gain"), 0, ing);
  const cov = coverage(plan, 3, ing);
  const foodCost = cov.delMeals.reduce(
    (s, m) => s + m.items.reduce((x, it) => x + costOf(ing, it.id, it.g), 0),
    0,
  );
  assert.ok(cov.price >= foodCost - 1e-6, `price ${cov.price} below food cost ${foodCost}`);
  // ₹70 per selected meal is charged on top of the ingredient cost; both sums
  // are float additions of the same per-item figures, so compare exactly.
  const expected = foodCost + 70 * cov.delMeals.length;
  assert.ok(Math.abs(cov.price - expected) < 1e-6,
    `price ${cov.price} should be food cost + per-meal charge (${expected})`);
});

// ─── the feature is actually wired up ───────────────────────────────────────

test("an out-of-stock food never reaches the planner", () => {
  // /api/menu is the only food source; it filters to in-stock items.
  const menu = fs.readFileSync(path.join(ROOT, "src", "app", "api", "menu", "route.ts"), "utf8");
  assert.ok(/where:\s*\{\s*is_available:\s*true/.test(menu),
    "menu GET must only return in-stock items");
});

test("both menu routes accept the two fields", () => {
  for (const route of ["route.ts", path.join("[id]", "route.ts")]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "app", "api", "menu", route), "utf8");
    for (const field of PORTION_FIELDS) {
      assert.ok(src.includes(`'${field}'`), `menu/${route} does not allow ${field}`);
    }
  }
});

test("both menu routes accept and validate goal_portions", () => {
  for (const route of ["route.ts", path.join("[id]", "route.ts")]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "app", "api", "menu", route), "utf8");
    assert.ok(src.includes(`'${GOAL_PORTIONS_FIELD}'`), `menu/${route} does not allow ${GOAL_PORTIONS_FIELD}`);
    assert.ok(src.includes("parseGoalPortions"), `menu/${route} does not validate ${GOAL_PORTIONS_FIELD}`);
  }
});

test("the model and seed files define the goal_portions column", () => {
  const db = fs.readFileSync(path.join(ROOT, "src", "lib", "db", "index.ts"), "utf8");
  assert.ok(/goal_portions:\s*\{[^}]*DataTypes\.JSON/.test(db),
    "db model should define goal_portions as JSON");
  const seedTs = fs.readFileSync(path.join(ROOT, "scripts", "seed_database.ts"), "utf8");
  assert.ok(seedTs.includes("goal_portions"), "seed_database.ts model is missing goal_portions");
  const seedSql = fs.readFileSync(path.join(ROOT, "scripts", "seed_data.sql"), "utf8");
  assert.ok(/`goal_portions`\s+JSON/i.test(seedSql),
    "seed_data.sql DDL is missing goal_portions");
});

test("every meal-plan save route validates before it persists", () => {
  const routes = [
    "onboarding/customer/route.ts",
    path.join("onboarding", "customer", "[id]", "meal-plan", "route.ts"),
    "customers/route.ts",
    path.join("roles", "sales", "enquiries", "route.ts"),
    path.join("roles", "verifier", "enquiries", "route.ts"),
  ];
  for (const route of routes) {
    const src = fs.readFileSync(path.join(ROOT, "src", "app", "api", route), "utf8");
    assert.ok(src.includes("validateSavedMealPlan"), `${route} should import validateSavedMealPlan`);
    assert.ok(src.includes("validateSavedMealPlan("), `${route} should call validateSavedMealPlan`);
  }
});

test("the menu model defines the columns as nullable", () => {
  const db = fs.readFileSync(path.join(ROOT, "src", "lib", "db", "index.ts"), "utf8");
  for (const field of PORTION_FIELDS) {
    const re = new RegExp(`${field}:\\s*\\{[^}]*allowNull:\\s*true`, "m");
    assert.ok(re.test(db), `db model: ${field} should be nullable (NULL = no limit)`);
  }
  assert.ok(!new RegExp(`min_grams:[^}]*defaultValue:\\s*\\d`).test(db),
    "min_grams should not default to a number");
});