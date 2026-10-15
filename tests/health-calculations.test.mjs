// Unit tests for the daily-nutrition calculator.
//
// Run with:  npm test   (node --test "tests/*.test.mjs")
//
// The calculator lives in src/lib/healthCalculations.ts (TypeScript, no runtime
// imports), so it is transpiled here rather than imported directly. The eight
// cases below are the authoritative spec: kcal / protein / carbs / fat / fiber
// must match exactly, with halves rounding up (JavaScript Math.round).

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

const SRC = path.join(ROOT, "src", "lib", "healthCalculations.ts");
const OUT = path.join(HERE, ".healthCalculations.mjs");
fs.writeFileSync(
  OUT,
  ts.transpileModule(fs.readFileSync(SRC, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText,
);

const { calculateHealthMetrics } = await import(`file://${OUT}`);

const BASE = {
  goal: "loss",
  age: 26,
  gender: "Male",
  height: 172,
  weight: 70,
  food: "veg",
  activity: "sedentary",
  freq: 3,
  name: "",
  email: "",
  phone: "",
};

// Activity multipliers (day base only; workouts removed).
const M = {
  sit: 1.2,
  feet: 1.35,
  phys: 1.5,
};

const CASES = [
  {
    name: "1. M 26 / 172 / 70, sitting, loss",
    a: { gender: "Male", age: 26, height: 172, weight: 70, goal: "loss", activityMultiplier: M.sit },
    want: { goalCalories: 1580, proteinG: 140, carbsG: 156, fatG: 44, fiberG: 22 },
  },
  {
    name: "2. F 24 / 160 / 58, on feet, loss",
    a: { gender: "Female", age: 24, height: 160, weight: 58, goal: "loss", activityMultiplier: M.feet },
    want: { goalCalories: 1400, proteinG: 116, carbsG: 146, fatG: 39, fiberG: 20 },
  },
  {
    name: "3. M 22 / 178 / 65, sitting, muscle",
    a: { gender: "Male", age: 22, height: 178, weight: 65, goal: "muscle", activityMultiplier: M.sit },
    want: { goalCalories: 2190, proteinG: 130, carbsG: 280, fatG: 61, fiberG: 31 },
  },
  {
    name: "4. F 35 / 155 / 52, sitting, maintenance",
    a: { gender: "Female", age: 35, height: 155, weight: 52, goal: "maintenance", activityMultiplier: M.sit },
    want: { goalCalories: 1380, proteinG: 83, carbsG: 177, fatG: 38, fiberG: 19 },
  },
  {
    name: "5. M 30 / 170 / 110, sitting, loss",
    a: { gender: "Male", age: 30, height: 170, weight: 110, goal: "loss", activityMultiplier: M.sit },
    want: { goalCalories: 1940, proteinG: 145, carbsG: 219, fatG: 54, fiberG: 27 },
  },
  {
    name: "6. F 70 / 150 / 40, sitting, loss (hits the 1200 floor)",
    a: { gender: "Female", age: 70, height: 150, weight: 40, goal: "loss", activityMultiplier: M.sit },
    want: { goalCalories: 1200, proteinG: 80, carbsG: 146, fatG: 33, fiberG: 17 },
  },
  {
    name: "7. M 80 / 150 / 45, sitting, loss (hits the 1500 floor)",
    a: { gender: "Male", age: 80, height: 150, weight: 45, goal: "loss", activityMultiplier: M.sit },
    want: { goalCalories: 1500, proteinG: 90, carbsG: 191, fatG: 42, fiberG: 21 },
  },
  {
    name: "8. M 28 / 175.5 / 60.5, physical, gain",
    a: { gender: "Male", age: 28, height: 175.5, weight: 60.5, goal: "gain", activityMultiplier: M.phys },
    want: { goalCalories: 2700, proteinG: 109, carbsG: 397, fatG: 75, fiberG: 38 },
  },
];

for (const c of CASES) {
  test(c.name, () => {
    const m = calculateHealthMetrics({ ...BASE, ...c.a });
    assert.equal(m.goalCalories, c.want.goalCalories, "kcal");
    assert.equal(m.proteinG, c.want.proteinG, "protein");
    assert.equal(m.carbsG, c.want.carbsG, "carbs");
    assert.equal(m.fatG, c.want.fatG, "fat");
    assert.equal(m.fiberG, c.want.fiberG, "fiber");
  });
}

test("the protein reference weight is capped at 25 × (H/100)²", () => {
  // 170 kg at 1.70 m: the cap is 25 × 2.89 = 72.25 kg, so protein is built from
  // 72.25 kg, not the raw 170 kg.
  const m = calculateHealthMetrics({
    ...BASE,
    weight: 170,
    height: 170,
    goal: "loss",
    activityMultiplier: 1.2,
  });
  assert.equal(m.proteinG, Math.round(72.25 * 2.0));
});

test("halves round up (Math.round), never to even", () => {
  // Female 35 / 155 / 52, maintenance → 1380 kcal; fat 1380×0.25/9 = 38.33 → 38.
  // (Documented so a regression to banker's rounding would be caught.)
  const m = calculateHealthMetrics({
    ...BASE,
    gender: "Female",
    age: 35,
    height: 155,
    weight: 52,
    goal: "maintenance",
    activityMultiplier: 1.2,
  });
  assert.equal(m.fatG, 38);
});
