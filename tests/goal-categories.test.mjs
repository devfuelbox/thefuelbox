// Unit tests for the goal categories feature (menu_items.goal_categories).
//
// Run with:  npm test   (node --test "tests/*.test.mjs")
//
// The parsing and the matching rule live in src/lib/goalCategories.ts so the
// create and update routes cannot drift apart; that module is TypeScript with
// no imports, so it is transpiled here rather than imported directly.
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

const SRC = path.join(ROOT, "src", "lib", "goalCategories.ts");
const OUT = path.join(HERE, ".goalCategories.mjs");
fs.writeFileSync(OUT, ts.transpileModule(fs.readFileSync(SRC, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);
const {
  GOAL_CATEGORIES,
  GOAL_CATEGORY_LABELS,
  parseGoalCategories,
  toGoalCategoryList,
  belongsToGoal,
} = await import(`file://${OUT}?v=${Date.now()}`);

// ─── parsing (write path — used by the API routes) ─────────────────────────

test("no categories value clears the list", () => {
  for (const blank of [null, undefined, ""]) {
    const r = parseGoalCategories(blank);
    assert.equal(r.ok, true, `${String(blank)} should be accepted`);
    assert.deepEqual(r.categories, []);
  }
});

test("non-array values are rejected", () => {
  for (const bad of ["loss", 42, { gain: true }, { length: 1 }]) {
    const r = parseGoalCategories(bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} should be rejected`);
    assert.match(r.message, /array/);
  }
});

test("goal keys are accepted and come back canonical", () => {
  assert.deepEqual(parseGoalCategories(["loss"]).categories, ["loss"]);
  assert.deepEqual(parseGoalCategories(["gain", "muscle"]).categories, ["gain", "muscle"]);
});

test("admin labels are accepted and mapped to goal keys", () => {
  assert.deepEqual(parseGoalCategories(["Weight Loss"]).categories, ["loss"]);
  assert.deepEqual(parseGoalCategories(["Weight Gain", "Weight Maintenance"]).categories, ["gain", "maintenance"]);
  // Case, spacing and separators do not matter
  assert.deepEqual(parseGoalCategories(["weight_gain", "MUSCLE GAIN"]).categories, ["gain", "muscle"]);
});

test("duplicates are removed and the display order is canonical", () => {
  const r = parseGoalCategories(["gain", "loss", "gain", "Weight Gain"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.categories, ["loss", "gain"]);
});

test("unknown or empty entries are rejected", () => {
  const unknown = parseGoalCategories(["keto"]);
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /Unknown goal category "keto"/);
  assert.match(unknown.message, new RegExp(Object.values(GOAL_CATEGORY_LABELS).join("|")));

  const empty = parseGoalCategories([""]);
  assert.equal(empty.ok, false);
});

// ─── reading (read path — stored rows, never throws) ───────────────────────

test("reading tolerates whatever the DB returns", () => {
  assert.deepEqual(toGoalCategoryList(null), []);
  assert.deepEqual(toGoalCategoryList(undefined), []);
  assert.deepEqual(toGoalCategoryList(["loss", "gain"]), ["loss", "gain"]);
  assert.deepEqual(toGoalCategoryList('["gain","muscle"]'), ["gain", "muscle"]);
  assert.deepEqual(toGoalCategoryList("loss"), ["loss"]);
  assert.deepEqual(toGoalCategoryList("Weight Loss"), ["loss"]);
  // Unrecognised entries and JSON garbage are dropped, never thrown
  assert.deepEqual(toGoalCategoryList(["keto", "gain"]), ["gain"]);
  assert.deepEqual(toGoalCategoryList("not json at all"), []);
});

// ─── the matching rule (used by the onboarding) ─────────────────────────────

test("an uncategorized food counts for every goal", () => {
  for (const goal of GOAL_CATEGORIES) {
    assert.equal(belongsToGoal([], goal), true, `[] should match ${goal}`);
    assert.equal(belongsToGoal(null, goal), true, `null should match ${goal}`);
  }
  assert.equal(belongsToGoal(undefined, "loss"), true);
});

test("a categorized food matches only the goals it is assigned to", () => {
  assert.equal(belongsToGoal(["loss"], "loss"), true);
  assert.equal(belongsToGoal(["loss"], "gain"), false);
  assert.equal(belongsToGoal(["loss", "muscle"], "muscle"), true);
  assert.equal(belongsToGoal(["loss", "muscle"], "maintenance"), false);
});

test("matching is case/format insensitive on both sides", () => {
  assert.equal(belongsToGoal(["Weight Loss"], "loss"), true);
  assert.equal(belongsToGoal(["loss"], "Weight Gain"), false);
  assert.equal(belongsToGoal(["muscle"], "muscle_gain"), true);
  assert.equal(belongsToGoal(["gain"], undefined), true);
});

// ─── the feature is actually wired up ───────────────────────────────────────

test("both menu routes accept and validate goal_categories", () => {
  for (const route of ["route.ts", path.join("[id]", "route.ts")]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "app", "api", "menu", route), "utf8");
    assert.ok(src.includes("'goal_categories'"), `menu/${route} does not allow goal_categories`);
    assert.ok(src.includes("parseGoalCategories"), `menu/${route} does not validate goal_categories`);
  }
});

test("the admin panel exposes the picker and sends the field", () => {
  const admin = fs.readFileSync(path.join(ROOT, "src", "app", "admin", "menu", "page.tsx"), "utf8");
  assert.ok(admin.includes("GOAL_CATEGORY_OPTIONS"), "admin menu must render the category picker");
  assert.ok(admin.includes("goal_categories"), "admin menu must read/write goal_categories");
});

test("categories steer selection, never the nutrition math", () => {
  // Goal categories decide WHICH foods are offered and preferred — they never
  // change what a food's calories/protein are, nor the health targets. Anything
  // that computes nutrition must stay category-free, or an admin assigning a
  // category would silently change the numbers behind a plan.
  const health = fs.readFileSync(
    path.join(ROOT, "src", "lib", "healthCalculations.ts"), "utf8");
  assert.ok(!/goal_categories/.test(health),
    "healthCalculations.ts must not reference goal_categories");

  // The category library only maps names — no nutrition or gram numbers in it.
  const goals = fs.readFileSync(
    path.join(ROOT, "src", "lib", "goalCategories.ts"), "utf8");
  assert.ok(!/calorie|protein|min_grams|max_grams/i.test(goals),
    "goalCategories.ts must not carry nutrition or portion numbers");

  // The onboarding's food selection uses belongsToGoal (the shared rule), and
  // the category labels themselves live only in the lib — no hardcoding.
  const onboarding = fs.readFileSync(
    path.join(ROOT, "src", "views", "Onboarding", "Onboarding.tsx"), "utf8");
  for (const label of Object.values(GOAL_CATEGORY_LABELS)) {
    assert.ok(!onboarding.includes(label),
      `Onboarding.tsx must not hardcode the "${label}" category label`);
  }
});

test("the model, seed model and seed DDL define the column", () => {
  const db = fs.readFileSync(path.join(ROOT, "src", "lib", "db", "index.ts"), "utf8");
  assert.ok(/goal_categories:\s*\{[^}]*DataTypes\.JSON/.test(db),
    "db model should define goal_categories as JSON");

  const seedTs = fs.readFileSync(path.join(ROOT, "scripts", "seed_database.ts"), "utf8");
  assert.ok(seedTs.includes("goal_categories"), "seed_database.ts model is missing goal_categories");

  const seedSql = fs.readFileSync(path.join(ROOT, "scripts", "seed_data.sql"), "utf8");
  assert.ok(/`goal_categories`\s+JSON/i.test(seedSql),
    "seed_data.sql DDL is missing the goal_categories column");
});