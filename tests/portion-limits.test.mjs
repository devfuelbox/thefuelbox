// Unit tests for the admin panel's per-item portion limits (min/max grams).
//
// Run with:  npm test   (node --test "tests/*.test.mjs")
//
// The parsing and validation live in src/lib/menuPortionLimits.ts so the
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

const SRC = path.join(ROOT, "src", "lib", "menuPortionLimits.ts");
const OUT = path.join(HERE, ".menuPortionLimits.mjs");
fs.writeFileSync(OUT, ts.transpileModule(fs.readFileSync(SRC, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);
const { PORTION_FIELDS, MAX_PORTION_G, parsePortionLimits, checkPortionRange } =
  await import(`file://${OUT}?v=${Date.now()}`);

// ─── parsing ────────────────────────────────────────────────────────────────

test("a body with no portion fields updates nothing", () => {
  // This is what every other admin edit sends today. It must not clear or
  // invent a limit — the item keeps whatever it already has.
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
  // A typed 29.6g is a serving of 30g, not a float column
  assert.deepEqual(parsePortionLimits({ max_grams: 29.6 }).updates, { max_grams: 30 });
  // Zero is a legal minimum — it just means "any amount"
  assert.deepEqual(parsePortionLimits({ min_grams: 0 }).updates, { min_grams: 0 });
});

test("only the fields actually sent come back", () => {
  // Sending min alone must not silently clear max.
  const r = parsePortionLimits({ min_grams: 20 });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.updates), ["min_grams"]);
});

// ─── rejection ──────────────────────────────────────────────────────────────

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

// ─── the pair ───────────────────────────────────────────────────────────────

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
  // PATCH semantics: the stored max stays put, so min=400 against a stored
  // max of 300 must fail even though the request never mentions max.
  const stored = { min_grams: null, max_grams: 300 };
  const { updates } = parsePortionLimits({ min_grams: 400 });
  const nextMin = "min_grams" in updates ? updates.min_grams : stored.min_grams;
  const nextMax = "max_grams" in updates ? updates.max_grams : stored.max_grams;
  assert.match(checkPortionRange(nextMin, nextMax) ?? "", /cannot be greater than/);

  // Raising max past the stored min is the other direction, and is allowed.
  const { updates: u2 } = parsePortionLimits({ max_grams: 500 });
  const next2 = { min_grams: 200, max_grams: u2.max_grams };
  assert.equal(checkPortionRange(next2.min_grams, next2.max_grams), null);
});

// ─── the feature is actually wired up ───────────────────────────────────────

test("both menu routes accept the two fields", () => {
  for (const route of ["route.ts", path.join("[id]", "route.ts")]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "app", "api", "menu", route), "utf8");
    for (const field of PORTION_FIELDS) {
      assert.ok(src.includes(`'${field}'`), `menu/${route} does not allow ${field}`);
    }
  }
});

test("the meal solver and pricing never read the portion limits", () => {
  // The limits are stored and edited only. Nothing that computes calories,
  // protein, fat, grams or price may depend on them, or an admin setting a
  // limit would silently change every existing plan.
  const onboarding = fs.readFileSync(
    path.join(ROOT, "src", "views", "Onboarding", "Onboarding.tsx"), "utf8");
  assert.ok(!/min_grams|max_grams/.test(onboarding),
    "Onboarding.tsx must not reference the portion limits");

  const health = fs.readFileSync(
    path.join(ROOT, "src", "lib", "healthCalculations.ts"), "utf8");
  assert.ok(!/min_grams|max_grams/.test(health),
    "healthCalculations.ts must not reference the portion limits");
});

test("the menu model defines the columns as nullable", () => {
  const db = fs.readFileSync(path.join(ROOT, "src", "lib", "db", "index.ts"), "utf8");
  for (const field of PORTION_FIELDS) {
    const re = new RegExp(`${field}:\\s*\\{[^}]*allowNull:\\s*true`, "m");
    assert.ok(re.test(db), `db model: ${field} should be nullable (NULL = no limit)`);
  }
  // Nullable without a default, so an existing row keeps meaning "not set"
  assert.ok(!new RegExp(`min_grams:[^}]*defaultValue:\\s*\\d`).test(db),
    "min_grams should not default to a number");
});
