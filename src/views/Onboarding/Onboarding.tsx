import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Utensils, Receipt } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { onboardingSupabase } from "@/lib/onboardingSupabaseClient";
import { updateUserProfile } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import {
  calculateHealthMetrics,
  type OnboardingAnswers,
} from "@/lib/healthCalculations";

// ─── FUELBOX BRAND TOKENS (matches website theme) ───────
const C = {
  ink: "#111827", // gray-900 – main dark text
  card: "#FFFFFF", // white card bg
  line: "#E5E7EB", // gray-200 – subtle borders
  yolk: "#16A34A", // brand-600 – primary green
  bone: "#111827", // gray-900 – headings
  muted: "#6B7280", // gray-500 – secondary text
  veg: "#16A34A", // brand green
  egg: "#D97706", // amber-600
  nonveg: "#DC2626", // red-600
  energy: "#EA580C", // energy-600 – orange accent
};
const FONT_DISPLAY = "'Poppins', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

// ─── BUSINESS CONFIG ─────────────────────────────────────
const WA_NUMBER = "919384302527"; // Ajith
const KITCHEN = { lat: 11.0197, lng: 76.992 }; // Nava India junction, Coimbatore
const FREE_KM = 5;
const MAX_KM = 30; // beyond this: waitlist
const FEE_PER_KM = 10; // ₹ per km after 5km
const MARGIN = 1.4; // cost + 40%
const PREP_COST = 15; // ₹ per delivered meal: packaging + gas + labor

// ─── INGREDIENTS — nutrients + wholesale ₹/kg ──
// BASE_ING is the static fallback. Live prices/macros fetched from the DB are
// layered on top as overrides in component state (see `ing` below) rather
// than mutated in place, so this object stays a stable, shared reference.
interface IngredientData {
  n: string;
  t: "veg" | "egg" | "nonveg";
  k: number;
  p: number;
  c?: number;
  f?: number;
  fi?: number;
  price: number;
  unit?: number;
  uname?: string;
}

const BASE_ING: Record<string, IngredientData> = {
  chicken: {
    n: "Chicken Breast (cooked)",
    t: "nonveg",
    k: 165,
    p: 31,
    c: 0, f: 3.6, fi: 0,
    price: 28,
  },
  egg: { n: "Egg", t: "egg", k: 155, p: 13, price: 10, unit: 50, uname: "egg" },
  paneer: { n: "Paneer", t: "veg", k: 275, p: 19,
    c: 2.4, f: 15, fi: 0, price: 25 },
  soya: { n: "Soya", t: "veg", k: 345, p: 52, price: 20 },
  chickpeas: { n: "Chickpeas (cooked)", t: "veg", k: 164, p: 8.9,
    c: 27.4, f: 2.6, fi: 7.6, price: 18 },
  sweetpotato: {
    n: "Sweet Potato (boiled)",
    t: "veg",
    k: 76,
    p: 1.4,
    c: 17.7, f: 0.1, fi: 2.5,
    price: 15,
  },
  banana: {
    n: "Banana",
    t: "veg",
    k: 89,
    p: 1.1,
    c: 22.8, f: 0.3, fi: 2.6,
    price: 10,
    unit: 120,
    uname: "pc",
  },
  rice: { n: "White Rice (cooked)", t: "veg", k: 130, p: 2.7,
    c: 28, f: 0.3, fi: 0.4, price: 12 },
  chapati: {
    n: "Chapati (whole wheat)",
    t: "veg",
    k: 299,
    p: 7.9,
    c: 46, f: 9.2, fi: 9.7,
    price: 8,
    unit: 50,
    uname: "pc",
  },
  carrot: { n: "Carrot (raw)", t: "veg", k: 41, p: 0.9,
    c: 9.6, f: 0.2, fi: 2.8, price: 12 },
  cucumber: { n: "Cucumber (raw)", t: "veg", k: 16, p: 0.7,
    c: 3.6, f: 0.1, fi: 0.5, price: 10 },
  greenbeans: { n: "Green Beans (cooked)", t: "veg", k: 35, p: 1.9,
    c: 7.9, f: 0.3, fi: 3.2, price: 15 },
  cabbage: { n: "Cabbage (raw)", t: "veg", k: 25, p: 1.3,
    c: 5.8, f: 0.1, fi: 2.5, price: 10 },
  cabbageP: { n: "Purple Cabbage (raw)", t: "veg", k: 31, p: 1.4,
    c: 7.4, f: 0.2, fi: 2.1, price: 14 },
  lettuce: { n: "Lettuce (raw)", t: "veg", k: 15, p: 1.4,
    c: 2.9, f: 0.2, fi: 1.3, price: 12 },
  paneerDressing: {
    n: "Paneer Cheese Dressing",
    t: "veg",
    k: 240,
    p: 12,
    c: 5, f: 19.5, fi: 0.2,
    price: 20,
  },
  broccoli: { n: "Broccoli (cooked)", t: "veg", k: 35, p: 2.4,
    c: 7.2, f: 0.4, fi: 3.3, price: 22 },
  channaW: { n: "White Channa (cooked)", t: "veg", k: 164, p: 8.9, price: 18 },
  channaOnions: {
    n: "Channa with Onions (cooked)",
    t: "veg",
    k: 140,
    p: 7.5,
    c: 22, f: 2.2, fi: 6.4,
    price: 20,
  },
  dragonfruit: { n: "Dragon Fruit", t: "veg", k: 60, p: 1.2,
    c: 13, f: 0, fi: 2.9, price: 35 },
  orange: { n: "Orange", t: "veg", k: 47, p: 0.9,
    c: 11.8, f: 0.1, fi: 2.4, price: 15 },
  mango: { n: "Mango", t: "veg", k: 60, p: 0.8,
    c: 15, f: 0.4, fi: 1.6, price: 25 },
  apple: { n: "Apple (with skin)", t: "veg", k: 52, p: 0.3,
    c: 13.8, f: 0.2, fi: 2.4, price: 20 },
  pomegranate: { n: "Pomegranate", t: "veg", k: 75, p: 1.1,
    c: 18.7, f: 0.7, fi: 4, price: 30 },
  guava: { n: "Guava", t: "veg", k: 68, p: 2.6,
    c: 14.3, f: 1, fi: 5.4, price: 18 },
  papaya: { n: "Papaya", t: "veg", k: 43, p: 0.5,
    c: 10.8, f: 0.3, fi: 1.7, price: 16 },
  watermelon: { n: "Watermelon", t: "veg", k: 30, p: 0.6,
    c: 7.6, f: 0.2, fi: 0.4, price: 15 },
  grapes: { n: "Grapes", t: "veg", k: 69, p: 0.7,
    c: 18.1, f: 0.2, fi: 0.9, price: 22 },
  strawberry: { n: "Strawberry", t: "veg", k: 32, p: 0.7,
    c: 7.7, f: 0.3, fi: 2, price: 40 },
  cherry: { n: "Cherry", t: "veg", k: 50, p: 1.0,
    c: 12.2, f: 0.3, fi: 1.6, price: 45 },
  bananaReg: {
    n: "Regular Banana",
    t: "veg",
    k: 89,
    p: 1.1,
    c: 22.8, f: 0.3, fi: 2.6,
    price: 10,
    unit: 120,
    uname: "pc",
  },
  bananaNendran: {
    n: "Nendran Banana",
    t: "veg",
    k: 95,
    p: 1.2,
    c: 24, f: 0.3, fi: 2.6,
    price: 15,
    unit: 120,
    uname: "pc",
  },
  bananaRed: {
    n: "Red Banana",
    t: "veg",
    k: 92,
    p: 1.3,
    c: 21, f: 0.3, fi: 3,
    price: 18,
    unit: 120,
    uname: "pc",
  },
  bananaRasthali: {
    n: "Rasthali Banana",
    t: "veg",
    k: 90,
    p: 1.1,
    c: 23.2, f: 0.3, fi: 2.6,
    price: 12,
    unit: 120,
    uname: "pc",
  },
  bananaPoovan: {
    n: "Poovan Banana",
    t: "veg",
    k: 104,
    p: 1.2,
    c: 26, f: 0.3, fi: 2.6,
    price: 12,
    unit: 120,
    uname: "pc",
  },
  blackchanna: {
    n: "Black Channa (cooked)",
    t: "veg",
    k: 130,
    p: 6.0,
    c: 21, f: 2, fi: 5.5,
    price: 16,
  },
  onion: { n: "Onion (raw)", t: "veg", k: 40, p: 1.1,
    c: 9.3, f: 0.1, fi: 1.7, price: 8 },
  peanut: { n: "Peanut", t: "veg", k: 567, p: 25.8, price: 25 },
  beetroot: { n: "Beetroot", t: "veg", k: 43, p: 1.6,
    c: 9.6, f: 0.2, fi: 2.8, price: 14 },

  // Combos
  weightLossCombo1: {
    n: "Weight Loss - Combo 1",
    t: "veg",
    k: 269,
    p: 10.7,
    price: 24,
  },
  weightLossCombo2: {
    n: "Weight Loss - Combo 2",
    t: "veg",
    k: 212,
    p: 6.9,
    price: 41,
  },
  weightLossCombo3: {
    n: "Weight Loss - Combo 3",
    t: "veg",
    k: 481,
    p: 54.1,
    price: 25,
  },
  weightGainCombo1: {
    n: "Weight Gain - Combo 1",
    t: "veg",
    k: 450,
    p: 53.8,
    price: 23,
  },
  weightGainCombo2: {
    n: "Weight Gain - Combo 2",
    t: "veg",
    k: 203,
    p: 5.1,
    price: 32,
  },
  weightGainCombo3: {
    n: "Weight Gain - Combo 3",
    t: "veg",
    k: 266,
    p: 8.1,
    price: 23,
  },
  muscleGainCombo1: {
    n: "Muscle Gain - Combo 1",
    t: "veg",
    k: 248,
    p: 12.2,
    price: 23,
  },
  muscleGainCombo2: {
    n: "Muscle Gain - Combo 2",
    t: "veg",
    k: 223,
    p: 7.2,
    price: 45,
  },
  muscleGainCombo3: {
    n: "Muscle Gain - Combo 3",
    t: "veg",
    k: 413,
    p: 53.8,
    price: 17,
  },
};

const kOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.k * g) / 100 || 0;
const pOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.p * g) / 100 || 0;
const cOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.c ?? 0) * g) / 100 || 0;
const fOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.f ?? 0) * g) / 100 || 0;
const fiOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  ((ing[id]?.fi ?? 0) * g) / 100 || 0;
const costOf = (ing: Record<string, IngredientData>, id: string, g: number) =>
  (ing[id]?.price * g) / 100 || 0;

const MEAL_OF: Record<string, string> = {
  egg: "Morning",
  papaya: "Morning",
  soya: "Morning",
  banana: "Morning",
  guava: "Morning",
  apple: "Morning",
  orange: "Morning",
  watermelon: "Morning",
  dragonfruit: "Morning",
  mango: "Morning",
  grapes: "Morning",
  strawberry: "Morning",
  cherry: "Morning",
  bananaReg: "Morning",
  bananaNendran: "Morning",
  bananaRed: "Morning",
  bananaRasthali: "Morning",
  bananaPoovan: "Morning",
  rice: "Afternoon",
  chicken: "Afternoon",
  channaW: "Afternoon",
  broccoli: "Afternoon",
  cucumber: "Afternoon",
  sweetpotato: "Afternoon",
  blackchanna: "Afternoon",
  chickpeas: "Afternoon",
  cabbage: "Afternoon",
  lettuce: "Afternoon",
  channaOnions: "Afternoon",
  onion: "Afternoon",
  weightLossCombo1: "Afternoon",
  weightLossCombo2: "Afternoon",
  weightLossCombo3: "Afternoon",
  weightGainCombo1: "Afternoon",
  weightGainCombo2: "Afternoon",
  weightGainCombo3: "Afternoon",
  muscleGainCombo1: "Afternoon",
  muscleGainCombo2: "Afternoon",
  muscleGainCombo3: "Afternoon",
  chapati: "Night",
  paneer: "Night",
  carrot: "Night",
  beetroot: "Night",
  peanut: "Night",
  cabbageP: "Night",
  greenbeans: "Night",
  paneerDressing: "Night",
};
const MEAL_ORDER = ["Morning", "Afternoon", "Night"];

// ─── PLAN LOGIC ──────────────────────────────────────────
const GOALS = {
  loss: { label: "Weight loss", sub: "Drop fat, stay full", plan: "LEAN PLAN" },
  gain: {
    label: "Weight gain",
    sub: "Skinny → solid. Make the scale move",
    plan: "FUEL PLAN",
  },
  muscle: {
    label: "Muscle gain",
    sub: "You train. Build shape, not belly",
    plan: "BULK PLAN",
  },
  maintenance: {
    label: "Maintenance",
    sub: "Maintain shape, stay fueled",
    plan: "FIT PLAN",
  },
};
const ACTIVITY = {
  sedentary: { label: "Mostly sitting", sub: "Desk job, little movement" },
  active: { label: "On my feet", sub: "Walking, light activity daily" },
  gym: { label: "Gym regular", sub: "Training 3+ days a week" },
};
const FREQS = {
  1: {
    label: "1 meal a day",
    sub: "Starter · slow & steady",
    speed: 0.4,
    tag: "Slow",
  },
  2: {
    label: "2 meals a day",
    sub: "Serious · solid pace",
    speed: 0.7,
    tag: "Solid",
  },
  3: {
    label: "3 meals a day",
    sub: "Full Fuel · fastest",
    speed: 1.0,
    tag: "Fastest",
  },
};

function buildPlan(
  a: OnboardingAnswers,
  variant: number,
  ing: Record<string, IngredientData>,
) {
  const goal = a.goal || "loss";
  const metrics = calculateHealthMetrics(a);
  const kcalT = metrics.goalCalories;
  const protT = metrics.proteinG;

  // Dynamic protein pools for variant scrambling
  const nonvegPools: [string, number][][] = [
    [
      ["chicken", 250],
      ["egg", 150],
      ["paneer", 100],
      ["soya", 40],
    ],
    [
      ["egg", 200],
      ["chicken", 200],
      ["soya", 60],
      ["paneer", 80],
    ],
    [
      ["paneer", 200],
      ["chicken", 220],
      ["egg", 100],
      ["blackchanna", 120],
    ],
    [
      ["chicken", 280],
      ["soya", 80],
      ["egg", 150],
      ["peanut", 35],
    ],
  ];
  const eggPools: [string, number][][] = [
    [
      ["egg", 150],
      ["paneer", 150],
      ["soya", 60],
      ["channaW", 150],
    ],
    [
      ["soya", 80],
      ["egg", 200],
      ["paneer", 100],
      ["blackchanna", 140],
    ],
    [
      ["paneer", 220],
      ["egg", 150],
      ["channaW", 120],
      ["peanut", 40],
    ],
  ];
  const vegPools: [string, number][][] = [
    [
      ["paneer", 200],
      ["soya", 100],
      ["channaW", 150],
      ["peanut", 30],
    ],
    [
      ["soya", 120],
      ["paneer", 180],
      ["blackchanna", 160],
      ["peanut", 35],
    ],
    [
      ["channaW", 200],
      ["paneer", 160],
      ["soya", 80],
      ["peanut", 40],
    ],
    [
      ["paneer", 220],
      ["blackchanna", 180],
      ["soya", 60],
      ["peanut", 30],
    ],
  ];

  const userFood = a.food || "veg";
  const poolList =
    userFood === "nonveg"
      ? nonvegPools
      : userFood === "egg"
        ? eggPools
        : vegPools;
  const srcs = poolList[variant % poolList.length];

  const items: Array<{ id: string; g: number }> = [];
  const add = (id: string, g: number) => {
    if (g <= 0) return;
    const e = items.find((i) => i.id === id);
    if (e) e.g += g;
    else items.push({ id, g });
  };

  // Rotate Veggies based on variant
  const vegRotations: [string, number][][] = [
    [
      ["broccoli", 100],
      ["carrot", 50],
      ["beetroot", 50],
    ],
    [
      ["cucumber", 120],
      ["cabbageP", 80],
      ["broccoli", 80],
    ],
    [
      ["carrot", 80],
      ["cucumber", 100],
      ["beetroot", 60],
    ],
    [
      ["broccoli", 120],
      ["cabbageP", 60],
      ["carrot", 60],
    ],
  ];
  const vegSet = vegRotations[variant % vegRotations.length];
  vegSet.forEach(([vId, vG]) => add(vId as string, vG as number));

  // Rotate Fruits based on variant
  const fruitRotations: [string, number][] = [
    goal === "loss" ? ["papaya", 150] : ["banana", 120],
    goal === "loss" ? ["apple", 140] : ["orange", 150],
    goal === "loss" ? ["watermelon", 180] : ["banana", 150],
    goal === "loss" ? ["guava", 130] : ["apple", 140],
  ];
  const [fId, fG] = fruitRotations[variant % fruitRotations.length];
  add(fId as string, fG as number);

  // Rotate Carbs based on variant
  const carbRotations = [
    {
      rice: goal === "loss" ? 100 : goal === "gain" ? 250 : 200,
      chap: goal === "loss" ? 50 : 100,
      sweet: 0,
    },
    {
      rice: goal === "loss" ? 50 : goal === "gain" ? 180 : 120,
      chap: goal === "loss" ? 100 : 150,
      sweet: 0,
    },
    {
      rice: 0,
      chap: goal === "loss" ? 100 : 200,
      sweet: goal === "loss" ? 120 : 200,
    },
    {
      rice: goal === "loss" ? 120 : 220,
      chap: 0,
      sweet: goal === "loss" ? 100 : 150,
    },
  ];
  const carbChoice = carbRotations[variant % carbRotations.length];
  let riceG = carbChoice.rice;
  let chapG = carbChoice.chap;
  let sweetG = carbChoice.sweet;
  if (sweetG > 0) add("sweetpotato", sweetG);

  let need =
    protT -
    items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0) -
    pOf(ing, "rice", riceG) -
    pOf(ing, "chapati", chapG);

  for (const [id, cap] of srcs) {
    if (need <= 1) break;
    const step = ing[id].unit || 10;
    let g = Math.min(cap as number, Math.ceil((need / ing[id].p) * 100));
    g = Math.round(g / step) * step;
    if (g <= 0) continue;
    add(id, g);
    need -= pOf(ing, id, g);
  }

  const caps =
    goal === "loss"
      ? { rice: 250, chap: 100, ban: 240, pea: 30 }
      : { rice: 350, chap: 200, ban: 360, pea: 60 };
  let banX = 0,
    peaX = 0;
  const total = () =>
    items.reduce((s, it) => s + kOf(ing, it.id, it.g), 0) +
    kOf(ing, "rice", riceG) +
    kOf(ing, "chapati", chapG) +
    kOf(ing, "banana", banX) +
    kOf(ing, "peanut", peaX);

  // Two independent guards: tightening down and topping up are separate
  // passes, so each gets its own iteration budget instead of sharing one.
  let guard1 = 0;
  while (total() > kcalT + 80 && guard1++ < 20) {
    if (riceG > 50) riceG -= 25;
    else if (chapG > 0) chapG -= 50;
    else break;
  }
  let guard2 = 0;
  while (total() < kcalT - 120 && guard2++ < 60) {
    if (riceG < caps.rice) riceG += 25;
    else if (banX < caps.ban) banX += 60;
    else if (peaX < caps.pea) peaX += 10;
    else if (chapG < caps.chap) chapG += 50;
    else break;
  }
  if (riceG > 0) add("rice", riceG);
  if (chapG > 0) add("chapati", chapG);
  if (banX > 0) add("banana", banX);
  if (peaX > 0) add("peanut", peaX);

  const protein = Math.round(
    items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0),
  );
  const kcal = Math.round(
    items.reduce((s, it) => s + kOf(ing, it.id, it.g), 0),
  );
  const meals = MEAL_ORDER.map((m) => ({
    name: m,
    items: items.filter((it) => (MEAL_OF[it.id] || "Afternoon") === m),
  })).filter((m: any) => m.items.length);

  return { items, meals, protein, kcal, protT, kcalT };
}

function coverage(
  plan: any,
  freq: number,
  ing: Record<string, IngredientData>,
  preferredSlots?: string[],
) {
  const protOf = (m: any) =>
    m.items.reduce((s: number, it: any) => s + pOf(ing, it.id, it.g), 0);
  const ranked = [...plan.meals].sort(
    (x: any, y: any) => protOf(y) - protOf(x),
  );
  const delNames =
    preferredSlots && preferredSlots.length === freq
      ? preferredSlots
      : freq >= 3
        ? plan.meals.map((m: any) => m.name)
        : ranked.slice(0, freq).map((m: any) => m.name);
  const delMeals = plan.meals.filter((m: any) => delNames.includes(m.name));
  const selfMeals = plan.meals.filter((m: any) => !delNames.includes(m.name));
  const delProt = Math.round(
    delMeals.reduce((s: number, m: any) => s + protOf(m), 0),
  );
  const activeDelMeals = delMeals.filter((m: any) => m.items.length > 0);
  const ingredientsCost = delMeals.reduce(
    (s: number, m: any) =>
      s +
      m.items.reduce((x: number, it: any) => x + costOf(ing, it.id, it.g), 0),
    0,
  );
  const cost =
    activeDelMeals.length > 0
      ? ingredientsCost + PREP_COST * activeDelMeals.length
      : 0;
  const price = cost > 0 ? Math.ceil((cost * MARGIN) / 5) * 5 : 0; // sell = (ingredients + prep) + 40%, rounded up to ₹5, or 0 if empty
  return { delNames, delMeals, selfMeals, delProt, price };
}

function timeline(goal: string | null, freq: number) {
  const f = FREQS[freq as keyof typeof FREQS].speed;
  if (goal === "loss") {
    const m = Math.ceil((5 / (1.5 * f)) * 2) / 2;
    return { big: `~${m} months`, sub: "to your first −5 kg" };
  }
  if (goal === "gain") {
    const m = Math.ceil((4 / (1.2 * f)) * 2) / 2;
    return { big: `~${m} months`, sub: "to a solid +4 kg" };
  }
  const w = Math.ceil(12 / f);
  return { big: `~${w} weeks`, sub: "to visible muscle" };
}

const fmtQty = (ing: Record<string, IngredientData>, it: any) => {
  const d = ing[it.id];
  if (d.unit) {
    const c = Math.round(it.g / d.unit);
    return `${c} ${d.uname}${c > 1 ? "s" : ""} (${it.g}g)`;
  }
  return `${it.g}g`;
};

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371,
    toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat),
    dLng = toR(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function zoneFor(km: number) {
  if (km <= FREE_KM) return { zone: "free", fee: 0 };
  if (km <= MAX_KM)
    return { zone: "paid", fee: Math.ceil(km - FREE_KM) * FEE_PER_KM };
  return { zone: "out", fee: null };
}

interface LocState {
  status: string;
  km: number | null;
  fee: number | null;
  lat: number | null;
  lng: number | null;
}

function FoodMark({ type, size = 14 }: { type: string; size?: number }) {
  const color = type === "veg" ? C.veg : type === "egg" ? C.egg : C.nonveg;
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
        flexShrink: 0,
      }}
      aria-label={type}
    >
      {type === "nonveg" ? (
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${size * 0.28}px solid transparent`,
            borderRight: `${size * 0.28}px solid transparent`,
            borderBottom: `${size * 0.48}px solid ${color}`,
          }}
        />
      ) : (
        <span
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: "50%",
            background: color,
          }}
        />
      )}
    </span>
  );
}

function useCountUp(target: number, duration = 1300) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return val;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 11,
        letterSpacing: "0.22em",
        color: C.yolk,
        textTransform: "uppercase",
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: "clamp(30px, 8vw, 40px)",
        color: C.bone,
        lineHeight: 1.05,
        textTransform: "uppercase",
        letterSpacing: "0.01em",
        margin: "0 0 24px",
      }}
    >
      {children}
    </h2>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  sub,
  mark,
  right,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  mark?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left"
      style={{
        background: selected ? "rgba(22,163,74,0.08)" : C.card,
        border: `1.5px solid ${selected ? C.yolk : C.line}`,
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 10,
        cursor: "pointer",
        transition: "border-color 160ms, background 160ms",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {mark}
      <span style={{ flex: 1 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 16,
            color: C.bone,
          }}
        >
          {title}
        </span>
        {sub && (
          <span
            style={{
              display: "block",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.muted,
              marginTop: 3,
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {right || (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2px solid ${selected ? C.yolk : C.line}`,
            background: selected ? C.yolk : "transparent",
            transition: "all 160ms",
          }}
        />
      )}
    </button>
  );
}

function Slider({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        className="flex items-end justify-between"
        style={{ marginBottom: 8 }}
      >
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 34,
            color: C.yolk,
            lineHeight: 1,
          }}
        >
          {value}
          <span
            style={{
              fontSize: 15,
              color: C.muted,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: C.yolk, height: 26 }}
      />
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full"
      style={{
        background: disabled ? C.line : C.yolk,
        color: disabled ? C.muted : C.ink,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 16,
        border: "none",
        borderRadius: 12,
        padding: "16px",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.02em",
        transition: "opacity 160ms",
      }}
    >
      {children}
    </button>
  );
}

// ─── RESULT SCREEN (top-level, not nested in Onboarding) ─
// Hoisting this out means its `vary`/`freq` state survives any re-render of
// the parent Onboarding component — a nested definition would get a new
// function identity on every parent render and React would remount it,
// silently resetting the user's picks.
function Result({
  a,
  loc,
  ing,
  saveStep,
  setLoc,
}: {
  a: OnboardingAnswers;
  loc: LocState;
  ing: Record<string, IngredientData>;
  saveStep: (next: number, updatedAnswers?: OnboardingAnswers) => void;
  setLoc: (loc: LocState) => void;
}) {
  const navigate = useNavigate();
  const [vary, setVary] = useState(0);
  const [freq, setFreq] = useState(a.freq || 1);
  const plan = buildPlan(a, vary, ing);

  const [customPlan, setCustomPlan] = useState<any>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    setCustomPlan(plan);
  }, [vary]);

  const planToUse = customPlan || plan;
  const cov = coverage(planToUse, freq, ing, a.preferredSlots);
  const tl = timeline(a.goal, freq);
  const metrics = calculateHealthMetrics(a);
  const n = useCountUp(metrics.proteinG);
  const waitlist = loc.status === "out";
  const delivFee =
    loc.status === "free" ? 0 : loc.status === "paid" ? loc.fee : null;

  const kcalOfMeal = (m: any) =>
    Math.round(
      m.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0),
    );
  const delKcal = cov.delMeals.reduce(
    (s: number, m: any) => s + kcalOfMeal(m),
    0,
  );

  // ─── FIXED TARGET vs SELECTED NUTRITION ───
  const [foodSearch, setFoodSearch] = useState("");
  const fixedTarget = useMemo(() => ({
    calories: metrics.goalCalories,
    protein: metrics.proteinG,
    carbs: metrics.carbsG,
    fat: metrics.fatG,
    fiber: 25,
  }), [metrics.goalCalories, metrics.proteinG, metrics.carbsG, metrics.fatG]);
  const selectedNutrition = useMemo(() => {
    const items = cov.delMeals.flatMap((m: any) => m.items);
    const calories = Math.round(items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0));
    const protein = Math.round(items.reduce((s: number, it: any) => s + pOf(ing, it.id, it.g), 0));
    const carbs = Math.round(items.reduce((s: number, it: any) => s + cOf(ing, it.id, it.g), 0));
    const fat = Math.round(items.reduce((s: number, it: any) => s + fOf(ing, it.id, it.g), 0));
    const fiber = Math.round(items.reduce((s: number, it: any) => s + fiOf(ing, it.id, it.g), 0) * 10) / 10;
    return { calories, protein, carbs, fat, fiber };
  }, [cov.delMeals, ing]);
  const remaining = useMemo(() => ({
    calories: fixedTarget.calories - selectedNutrition.calories,
    protein: fixedTarget.protein - selectedNutrition.protein,
    carbs: fixedTarget.carbs - selectedNutrition.carbs,
    fat: fixedTarget.fat - selectedNutrition.fat,
    fiber: Math.round((fixedTarget.fiber - selectedNutrition.fiber) * 10) / 10,
  }), [fixedTarget, selectedNutrition]);

  // ─── PER-MEAL CALORIE LIMIT (fixed, reusable) ───
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const mealLimits = useMemo(() => {
    const map = new Map<string, number>();
    plan.meals.forEach((m: any) => {
      const kcal = Math.round(m.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0));
      const fallback = Math.round(fixedTarget.calories / (cov.delNames.length || 1));
      map.set(m.name, kcal > 0 ? kcal : fallback);
    });
    return map;
  }, [plan, ing, fixedTarget.calories, cov.delNames]);
  const getMealLimit = useCallback((mealName: string) => mealLimits.get(mealName) ?? Math.round(fixedTarget.calories / (cov.delNames.length || 1)), [mealLimits, fixedTarget.calories, cov.delNames]);
  const canAddToMeal = useCallback((mealName: string, itemId: string) => {
    const limit = getMealLimit(mealName);
    const meal = planToUse.meals.find((m: any) => m.name === mealName);
    const current = meal ? Math.round(meal.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0)) : 0;
    const foodKcal = Math.round(kOf(ing, itemId, (ing[itemId] as any)?.unit || 50));
    return current + foodKcal <= limit;
  }, [planToUse.meals, ing, getMealLimit]);

  const bmiLine = () => {
    const b = metrics.bmi.toFixed(1);
    if (a.goal === "loss" && metrics.bmi >= 25)
      return `BMI ${b} — meals stay filling but calorie-smart. You'll never feel like you're dieting.`;
    if (a.goal === "gain" && metrics.bmi < 18.5)
      return `BMI ${b} — clean surplus. Real food calories, zero junk.`;
    if (a.goal === "muscle")
      return `BMI ${b} — protein does the building. We do the cooking.`;
    return `BMI ${b} — dialed to your body, not a template.`;
  };

  const waLink = () => {
    const mealsTxt = planToUse.meals
      .map(
        (m: any) =>
          `${cov.delNames.includes(m.name) ? "🟨" : "▫️"} ${m.name}: ${m.items.map((it: any) => `${ing[it.id].n} ${fmtQty(ing, it)}`).join(", ")}`,
      )
      .join("\n");
    const locTxt =
      loc.km != null
        ? `Location: ${loc.km} km from Nava India (maps.google.com/?q=${loc.lat},${loc.lng}) — ${loc.status === "free" ? "FREE delivery" : loc.status === "paid" ? `delivery ₹${loc.fee}/day` : "outside zone (waitlist)"}`
        : "Location: will confirm on WhatsApp";
    const msg =
      `Hi Ajith! ${waitlist ? "WAITLIST — outside 30km.\n" : ""}FuelBox plan for ${a.name}:\n` +
      `Goal: ${a.goal ? GOALS[a.goal].label : ""} (${a.goal ? GOALS[a.goal].plan : ""}) · ${a.food} · ${FREQS[freq as keyof typeof FREQS].label}\n` +
      `Target: ${planToUse.protT}g protein · ~${planToUse.kcalT} kcal/day\n` +
      `FuelBox covers: ${cov.delProt}g/day (🟨 = FuelBox delivers)\n\n${mealsTxt}\n\n` +
      `Food ₹${cov.price}/day${delivFee != null ? ` + delivery ₹${delivFee}/day` : " + delivery TBD"}\n` +
      `21-day pack ≈ ₹${(cov.price + (delivFee || 0)) * 21}\n` +
      `Timeline: ${tl.big} ${tl.sub}\n${locTxt}\nPhone: ${a.phone}`;
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const recalculatePlan = (updatedMeals: any[]) => {
    const flatItems: Array<{ id: string; g: number }> = [];
    updatedMeals.forEach((m) => {
      m.items.forEach((it: any) => {
        const existing = flatItems.find((x) => x.id === it.id);
        if (existing) {
          existing.g += it.g;
        } else {
          flatItems.push({ id: it.id, g: it.g });
        }
      });
    });

    const protein = Math.round(
      flatItems.reduce((s, it) => s + pOf(ing, it.id, it.g), 0),
    );
    const kcal = Math.round(
      flatItems.reduce((s, it) => s + kOf(ing, it.id, it.g), 0),
    );

    return {
      ...planToUse,
      meals: updatedMeals,
      items: flatItems,
      protein,
      kcal,
    };
  };

  const handleRemoveItem = (mealName: string, itemId: string) => {
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== mealName) return m;
      return { ...m, items: m.items.filter((it: any) => it.id !== itemId) };
    });
    setCustomPlan(recalculatePlan(updatedMeals));
  };

  const handleAddItem = (mealName: string, itemId: string) => {
    const d = ing[itemId] as any;
    if (!d) return;
    const defaultQty = d.unit || 50;
    const targetMeal = mealName || cov.delNames[0] || planToUse.meals[0]?.name;
    if (!targetMeal) return;
    const targetMealObj = planToUse.meals.find((m: any) => m.name === targetMeal);
    if (targetMealObj?.items.some((it: any) => it.id === itemId)) {
      showToast("Food already added");
      return;
    }
    const limit = getMealLimit(targetMeal);
    const current = targetMealObj ? Math.round(targetMealObj.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0)) : 0;
    const foodKcal = Math.round(kOf(ing, itemId, defaultQty));
    if (current + foodKcal > limit) {
      showToast(`Calorie limit reached — You can only add food up to ${limit} kcal for this meal.`);
      return;
    }
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== targetMeal) return m;
      return {
        ...m,
        items: [...m.items, { id: itemId, g: defaultQty }],
      };
    });
    setCustomPlan(recalculatePlan(updatedMeals));
  };

  const handleOrderOnWhatsApp = async () => {
    // Validation BEFORE DB save/API request: block empty meal plan
    const totalDeliveredItems = cov.delMeals.reduce((s: number, m: any) => s + m.items.length, 0);
    const totalDeliveredCalories = cov.delMeals.reduce(
      (s: number, m: any) => s + m.items.reduce((x: number, it: any) => x + kOf(ing, it.id, it.g), 0),
      0,
    );
    const totalFoodItems = planToUse.meals.reduce((s: number, m: any) => s + m.items.length, 0);
    if (totalDeliveredItems === 0 || totalDeliveredCalories === 0 || totalFoodItems === 0) {
      showToast("Please select at least one food item before placing the order.");
      return;
    }

    setIsOrdering(true);
    setOrderError("");

    // Save only the FuelBox-delivered meals (based on the user's chosen meal
    // count/slots), so admin views show exactly what was ordered — not the
    // full 3-meal day.
    const deliveredPlan = {
      ...planToUse,
      meals: cov.delMeals,
      items: cov.delMeals.flatMap((m: any) => m.items),
      protein: cov.delProt,
      kcal: Math.round(
        cov.delMeals.reduce(
          (s: number, m: any) =>
            s +
            m.items.reduce(
              (x: number, it: any) => x + kOf(ing, it.id, it.g),
              0,
            ),
          0,
        ),
      ),
    };

    try {
      // Save customer + final (possibly customized) plan to DB
      const delivPerDay = delivFee || 0;
      const packages = [
        { name: "7-day trial", days: 7, price: Math.round((cov.price + delivPerDay) * 7) },
        { name: "21-day pack", days: 21, price: Math.round((cov.price + delivPerDay) * 21) },
      ];
      const res = await fetch("/api/onboarding/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: a.name,
          phone: a.phone,
          email: a.email,
          goal: a.goal,
          age: a.age,
          gender: a.gender,
          height: a.height,
          weight: a.weight,
          food: a.food,
          activity: a.activity,
          freq,
          loc_status: loc.status,
          loc_km: loc.km,
          loc_fee: loc.fee,
          loc_lat: loc.lat,
          loc_lng: loc.lng,
          meal_plan: deliveredPlan,
          meal_plan_price: packages[1].price,
          meal_plan_packages: packages,
        }),
      });
      if (res.ok) {
        // Order successfully saved — clear the persisted onboarding session so
        // the next visit starts with a fresh, empty form for a new customer.
        try {
          localStorage.removeItem("fuelbox_onboarding_session_id");
          localStorage.removeItem("fuelbox_onboarding_step");
          localStorage.removeItem("fuelbox_onboarding_answers");
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("[Order] Failed to save customer to DB:", err);
      // Non-blocking — still open WhatsApp even if DB write fails
    }

    // Open WhatsApp
    window.open(waLink(), "_blank");
    setIsOrdering(false);
  };

  return (
    <div key="s9" className="anim" style={{ paddingTop: 12 }}>
    
      <Eyebrow>Your number</Eyebrow>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "clamp(96px, 30vw, 150px)",
          lineHeight: 0.9,
          color: C.yolk,
        }}
      >
        {n}
        <span style={{ fontSize: "0.32em", color: C.bone }}>g</span>
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 15,
          color: C.bone,
          fontWeight: 600,
          margin: "10px 0 4px",
        }}
      >
        of protein. Every single day, {a.name.split(" ")[0]}.
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: C.muted,
          lineHeight: 1.5,
          marginBottom: 22,
        }}
      >
        {bmiLine()}
      </div>

      {a.goal === "loss" && metrics.bmi < 18.5 && (
        <div
          style={{
            background: "rgba(232,185,49,0.08)",
            border: `1.5px solid ${C.egg}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.bone,
              lineHeight: 1.55,
            }}
          >
            Brother, honestly — at BMI {metrics.bmi.toFixed(1)} you don't need
            weight loss. Your real glow-up is{" "}
            <b style={{ color: C.yolk }}>muscle gain</b>. Retake the quiz and
            pick it — same price range, way better mirror results.
          </div>
        </div>
      )}

      {/* TIMELINE + SPEED */}
      <div
        style={{
          background: C.card,
          border: `1.5px solid ${C.yolk}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          At {FREQS[freq as keyof typeof FREQS].label} ·{" "}
          {FREQS[freq as keyof typeof FREQS].tag} pace
        </div>
        <div
          key={freq}
          className="anim"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 44,
            color: C.yolk,
            lineHeight: 1.05,
            margin: "6px 0 2px",
          }}
        >
          {tl.big}
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.bone,
            fontWeight: 600,
          }}
        >
          {tl.sub}
        </div>

        {/* coverage bar */}
        <div
          style={{
            margin: "16px 0 6px",
            height: 8,
            background: C.line,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.round((cov.delProt / planToUse.protT) * 100))}%`,
              background: C.yolk,
              borderRadius: 6,
              transition: "width 400ms ease",
            }}
          />
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted }}>
          FuelBox delivers <b style={{ color: C.yolk }}>{cov.delProt}g</b>{" "}
          protein · <b style={{ color: C.yolk }}>~{delKcal} kcal</b> of your{" "}
          {planToUse.protT}g / ~{planToUse.kcalT} kcal day
          {cov.selfMeals.length > 0 &&
            ` · ${cov.selfMeals.map((m: any) => m.name).join(" + ")} from your side (list on WhatsApp)`}
        </div>

        {freq < 3 && (
          <button
            onClick={() => setFreq(freq + 1)}
            className="w-full"
            style={{
              marginTop: 14,
              background: C.yolk,
              color: C.ink,
              border: "none",
              borderRadius: 10,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 14,
              padding: "12px",
              cursor: "pointer",
            }}
          >
            ⚡ Cut my timeline — add a meal
          </button>
        )}
      </div>

      {/* PLAN CARD */}
      <div
        style={{
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 14,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 26,
                color: C.bone,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              {a.goal ? GOALS[a.goal].plan : ""}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: C.muted,
                marginTop: 5,
              }}
            >
              ~{delKcal} kcal FuelBox meals · ~{planToUse.kcal} kcal full day
              · 🟨 = FuelBox delivers
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 24,
                color: C.yolk,
                lineHeight: 1,
              }}
            >
              ₹{cov.price}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11,
                color: C.muted,
                marginTop: 3,
              }}
            >
              food / day
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: C.line, margin: "16px 0" }} />
                {/* FIXED TARGET vs SELECTED - clear separation */}
        <div style={{ background: "#F9FAFB", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>Daily Nutrition Target — Fixed</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Calories</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.bone, fontWeight: 800 }}>{fixedTarget.calories.toLocaleString()} <span style={{ fontSize: 11, color: C.muted }}>kcal</span></div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Protein</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.bone, fontWeight: 800 }}>{fixedTarget.protein}g</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Carbs / Fat</div>
              <div style={{ fontSize: 13, color: C.bone, fontWeight: 700 }}>{fixedTarget.carbs}g / {fixedTarget.fat}g</div>
              <div style={{ fontSize: 10, color: C.muted }}>{fixedTarget.fiber}g Fiber</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>These values stay fixed. Adding or removing foods does not change your target.</div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.yolk}20`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.yolk, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>Your Selected Foods — {selectedNutrition.calories} kcal · {selectedNutrition.protein}g Protein</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Calories</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.calories}</div>
              <div style={{ fontSize: 10, color: C.muted }}>of {fixedTarget.calories}</div>
            </div>
            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Protein</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.protein}g</div>
              <div style={{ fontSize: 10, color: C.muted }}>of {fixedTarget.protein}g</div>
            </div>
            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Carbs</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.carbs}g</div>
            </div>
            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Fat</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.fat}g</div>
            </div>
            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Fiber</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.fiber}g</div>
            </div>
          </div>
          {/* Progress bars */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: C.bone, marginBottom: 4 }}>
              <span>Calories</span><span>{selectedNutrition.calories} / {fixedTarget.calories} kcal</span>
            </div>
            <div style={{ height: 8, background: C.line, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.round((selectedNutrition.calories / fixedTarget.calories) * 100))}%`, background: selectedNutrition.calories > fixedTarget.calories ? C.nonveg : C.yolk, borderRadius: 6, transition: "width 300ms" }} />
            </div>
          </div>
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: C.bone, marginBottom: 4 }}>
              <span>Protein</span><span>{selectedNutrition.protein} / {fixedTarget.protein}g</span>
            </div>
            <div style={{ height: 8, background: C.line, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.round((selectedNutrition.protein / fixedTarget.protein) * 100))}%`, background: selectedNutrition.protein > fixedTarget.protein ? C.nonveg : C.yolk, borderRadius: 6, transition: "width 300ms" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, padding: 10, background: "rgba(22,163,74,0.06)", borderRadius: 10, border: `1px dashed ${C.yolk}30` }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Selected Plan</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bone }}>{selectedNutrition.calories} kcal · {selectedNutrition.protein}g P</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Remaining</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: remaining.calories >= 0 && remaining.protein >= 0 ? C.yolk : C.nonveg }}>{Math.abs(remaining.calories)} kcal · {Math.abs(remaining.protein)}g {remaining.calories >= 0 ? "left" : "over"}</div>
            </div>
          </div>
        </div>

        {planToUse.meals.map((m: any) => {
          const mine = cov.delNames.includes(m.name);
          return (
            <div
              key={m.name}
              style={{
                marginBottom: 14,
                opacity: mine ? 1 : 0.35,
                background: "rgba(0,0,0,0.02)",
                borderRadius: 12,
                padding: "10px 12px",
                pointerEvents: mine ? "auto" : "none",
                userSelect: mine ? "auto" : "none",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: mine ? C.yolk : C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
                  {mine ? "🟨 " : ""}{m.name}{mine ? " — FuelBox" : " — your side"}
                </span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: mine ? C.yolk : C.muted }}>
                  {(() => { const cur = kcalOfMeal(m); const lim = getMealLimit(m.name); return `${cur} / ${lim} kcal`; })()}
                </span>
              </div>
              {mine && (() => {
                const cur = kcalOfMeal(m);
                const lim = getMealLimit(m.name);
                const pct = lim > 0 ? Math.min(100, Math.round((cur / lim) * 100)) : 0;
                const isFull = cur >= lim;
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ height: 6, background: C.line, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: isFull && cur === lim ? C.yolk : isFull ? C.nonveg : C.yolk, borderRadius: 6, transition: "width 300ms" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 4, fontWeight: 600, gap: 8 }}>
                      <span>{pct}%</span>
                      <span style={{ color: isFull && cur === lim ? C.yolk : isFull ? C.nonveg : C.muted, fontWeight: 700 }}>{isFull && cur === lim ? `${m.name} calorie limit reached` : isFull ? "Limit exceeded" : `${lim - cur} kcal left`}</span>
                    </div>
                  </div>
                );
              })()}
              {m.items.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, padding: "8px 0", fontStyle: "italic" }}>No foods selected for {m.name}. Add foods below.</div>
              ) : (
                m.items.map((it: any) => {
                  const cal = Math.round(kOf(ing, it.id, it.g));
                  const pro = Math.round(pOf(ing, it.id, it.g));
                  const carbs = Math.round(cOf(ing, it.id, it.g));
                  const fat = Math.round(fOf(ing, it.id, it.g));
                  const fib = Math.round(fiOf(ing, it.id, it.g) * 10) / 10;
                  return (
                    <div key={it.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ padding: "10px 0", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                      <span className="flex items-start" style={{ gap: 9, flex: 1, minWidth: 0 }}>
                        <FoodMark type={ing[it.id].t} size={13} />
                        <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.bone, display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, wordBreak: "break-word" }}>{ing[it.id].n}</span>
                          <span style={{ color: C.muted, fontSize: 11, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, lineHeight: 1.4, alignItems: "center" }}>
                            <span>{fmtQty(ing, it)}</span>
                            <span>•</span><span>{cal} kcal</span>
                            <span>•</span><span>{pro}g P</span>
                            <span>•</span><span>{carbs}g C</span>
                            <span>•</span><span>{fat}g F</span>
                            <span>•</span><span>{fib}g Fiber</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4, padding: "2px 6px", borderRadius: 6, background: ing[it.id].t==='veg' ? '#DCFCE7' : ing[it.id].t==='egg' ? '#FEF3C7' : '#FEE2E2', color: ing[it.id].t==='veg' ? C.veg : ing[it.id].t==='egg' ? C.egg : C.nonveg, fontWeight: 700, textTransform: "capitalize", fontSize: 10 }}>{ing[it.id].t}</span>
                          </span>
                        </span>
                      </span>
                      {mine && (
                        <button onClick={() => handleRemoveItem(m.name, it.id)} style={{ background: "#FEE2E2", color: C.nonveg, border: `1px solid #FCA5A5`, borderRadius: 8, padding: "8px 14px", fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, minHeight: 36, minWidth: 72 }} className="hover:bg-red-100 active:scale-95 transition">Remove</button>
                      )}
                    </div>
                  );
                })
              )}
              {mine && (
                <div style={{ marginTop: 10 }}>
                  <select
                    value=""
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (newId) {
                        handleAddItem(m.name, newId);
                        e.target.value = "";
                      }
                    }}
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 12,
                      color: C.yolk,
                      background: "rgba(22,163,74,0.06)",
                      border: `1px dashed ${C.yolk}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                      cursor: "pointer",
                      outline: "none",
                      width: "100%",
                      minHeight: 44,
                    }}
                  >
                    <option value="" disabled>
                      + Add food to {m.name} — {kcalOfMeal(m)}/{getMealLimit(m.name)} kcal
                    </option>
                    {Object.entries(ing)
                      .filter(([id]) => !m.items.some((it: any) => it.id === id))
                      .filter(([id, d]) => {
                        if (a.food === "veg" && (d as any).t !== "veg") return false;
                        if (a.food === "egg" && (d as any).t === "nonveg") return false;
                        return true;
                      })
                      .map(([id, d]) => {
                        const canAdd = canAddToMeal(m.name, id);
                        const kcal = Math.round(kOf(ing, id, (d as any).unit || 50));
                        return (
                          <option key={id} value={id} disabled={!canAdd} style={{ color: canAdd ? C.bone : C.muted }}>
                            {(d as any).n} — {kcal} kcal {canAdd ? "" : "(would exceed)"}
                          </option>
                        );
                      })}
                  </select>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>
                    {(() => {
                      const cur = kcalOfMeal(m);
                      const lim = getMealLimit(m.name);
                      const rem = lim - cur;
                      return rem <= 0 ? `${m.name} limit reached (${lim} kcal)` : `${rem} kcal remaining in ${m.name}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ height: 1, background: C.line, margin: "4px 0 12px" }} />
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 4 }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            Delivery{loc.km != null ? ` · ${loc.km} km` : ""}
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: delivFee === 0 ? C.veg : C.yolk,
            }}
          >
            {waitlist
              ? "—"
              : delivFee === 0
                ? "FREE ✓"
                : delivFee != null
                  ? `₹${delivFee}/day`
                  : "on WhatsApp"}
          </span>
        </div>
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 4 }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            7-day trial
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            ≈ ₹{((cov.price + (delivFee || 0)) * 7).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            21-day pack
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: 700,
              color: C.yolk,
            }}
          >
            ≈ ₹{((cov.price + (delivFee || 0)) * 21).toLocaleString("en-IN")}
          </span>
        </div>
        {planToUse.protein < planToUse.protT - 8 && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: C.muted,
              lineHeight: 1.5,
              marginTop: 10,
            }}
          >
            Honest note: pure-veg foods max out at ~{planToUse.protein}g/day —
            we've packed the maximum. Quality protein, no fake numbers.
          </div>
        )}
      </div>

      <button
        onClick={() => setVary((v) => v + 1)}
        className="w-full"
        style={{
          background: "transparent",
          border: `1.5px solid ${C.line}`,
          borderRadius: 12,
          color: C.bone,
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 700,
          padding: "13px",
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        ↻ Mix the foods differently
      </button>

      {orderError && (
        <div
          style={{
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.nonveg,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {orderError}
        </div>
      )}

      <PrimaryBtn onClick={handleOrderOnWhatsApp} disabled={isOrdering}>
        {isOrdering ? "Opening WhatsApp..." : "Order this plan on WhatsApp"}
      </PrimaryBtn>

      {/* Go To Home — navigate to /home; Home page shows OTP + account setup for new users */}
      {/* <button onClick={() => navigate(ROUTES.HOME, { state: { triggerOtp: true, phone: a.phone, pendingReg: true, pendingName: a.name } })} className="w-full" style={{
        marginTop: 10, background: "transparent", border: `1.5px solid ${C.yolk}`, borderRadius: 12,
        color: C.yolk, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700,
        padding: "13px", cursor: "pointer",
      }}>
        🏠 Go To Home
      </button> */}

      <div
        style={{
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          margin: "18px 0 0",
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.bone,
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: C.yolk }}>Balanced by design.</b> Your box isn't
          protein alone — rice, chapati, veg and fruit come with it, so you get
          fiber and energy too. Targets stay inside safe limits.
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.6,
            marginTop: 6,
          }}
        >
          Have kidney issues, diabetes, or are pregnant? Please check with your
          doctor before starting.
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: C.bone,
          fontWeight: 700,
          textAlign: "center",
          margin: "18px 0 4px",
        }}
      >
        We know brother — you can do this. Namma achieve pannuvom. 💪
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          color: C.muted,
          textAlign: "center",
          lineHeight: 1.5,
          margin: "10px 0 4px",
        }}
      >
        Timelines are estimates from standard nutrition math, assuming strict
        diet + regular home workout. Not medical advice.
      </div>
      {/* Toast for meal calorie limit */}
      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: C.bone, color: "#fff", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, padding: "12px 16px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 9999, maxWidth: "90vw", textAlign: "center", lineHeight: 1.4 }}>
          {toast.includes(" — ") ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: 2 }}>{toast.split(" — ")[0]}</div>
              <div style={{ fontWeight: 500, fontSize: 12, opacity: 0.9 }}>{toast.split(" — ")[1]}</div>
            </>
          ) : (
            <div>{toast}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const loggedInUser = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [a, setA] = useState<OnboardingAnswers>({
    goal: null,
    age: 25,
    gender: null,
    height: 170,
    weight: 70,
    food: null,
    activity: null,
    freq: null,
    name: "",
    email: "",
    phone: "",
    preferredSlots: [],
  });

  const [loc, setLoc] = useState<LocState>({
    status: "idle",
    km: null,
    fee: null,
    lat: null,
    lng: null,
  });
  const [sessionId, setSessionId] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizationError, setFinalizationError] = useState("");

  const set = (k: keyof OnboardingAnswers, v: any) =>
    setA((p) => ({ ...p, [k]: v }));
  const TOTAL = 8;

  // Check for goal query param or path on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const goalParam = urlParams.get("goal");
      if (
        goalParam === "loss" ||
        goalParam === "gain" ||
        goalParam === "muscle" ||
        goalParam === "maintenance"
      ) {
        setA((prev) => {
          const updated = { ...prev, goal: goalParam as any };
          localStorage.setItem(
            "fuelbox_onboarding_answers",
            JSON.stringify(updated),
          );
          return updated;
        });
        setStep(1);
        localStorage.setItem("fuelbox_onboarding_step", "1");
        // Clear query parameters from URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, []);

  // Live ingredient data: BASE_ING merged with any DB-fetched overrides.
  // Overrides live in state, not on a mutated shared object, so this is
  // reactive and safe across multiple mounts.
  const [ingOverrides, setIngOverrides] = useState<
    Record<string, Partial<IngredientData>>
  >({});
  const [dbLoaded, setDbLoaded] = useState(false);
  const ing = useMemo(() => {
    const merged: Record<string, IngredientData> = {};
    for (const key of Object.keys(BASE_ING)) {
      merged[key] = { ...BASE_ING[key], ...(ingOverrides[key] || {}) };
    }
    return merged;
  }, [ingOverrides]);

  // Fetch live menu prices/macros from the database on mount
  useEffect(() => {
    const loadDbFoods = async () => {
      try {
        const res = await fetch("/api/menu");
        if (!res.ok) throw new Error("Failed to fetch menu from local API");
        const data = await res.json();
        if (!data || data.length === 0) return;

        const overrides: Record<string, Partial<IngredientData>> = {};
        data.forEach((row: any) => {
          const targetKey = Object.keys(BASE_ING).find(
            (key) => BASE_ING[key].n.toLowerCase() === row.name.toLowerCase(),
          );
          if (targetKey) {
            overrides[targetKey] = {
              k: Number(row.calories ?? BASE_ING[targetKey].k),
              p: Number(row.protein_g ?? row.protein ?? BASE_ING[targetKey].p),
              c: Number(row.carbs_g ?? (BASE_ING[targetKey] as any).c ?? 0),
              f: Number(row.fat_g ?? (BASE_ING[targetKey] as any).f ?? 0),
              fi: Number(row.fiber_g ?? (BASE_ING[targetKey] as any).fi ?? 0),
              price: Number(row.price ?? BASE_ING[targetKey].price),
            };
          }
        });

        if (Object.keys(overrides).length > 0) {
          setIngOverrides(overrides);
          setDbLoaded(true);
        }
      } catch (err) {
        console.warn("Failed to load menu items from API:", err);
      }
    };
    loadDbFoods();
  }, []);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(
        "fuelbox_onboarding_session_id",
      );
      const savedStep = localStorage.getItem("fuelbox_onboarding_step");
      const savedAnswers = localStorage.getItem("fuelbox_onboarding_answers");

      if (savedSession) {
        setSessionId(savedSession);
      }
      if (savedStep) {
        setStep(Number(savedStep));
      }
      if (savedAnswers) {
        const parsed = JSON.parse(savedAnswers);
        if (parsed && typeof parsed === "object") {
          setA((prev) => ({
            ...prev,
            ...parsed,
            preferredSlots: parsed.preferredSlots || prev.preferredSlots || [],
          }));
        }
      }
    } catch (_) {}
  }, []);

  // Save progress step-by-step to the NEW database
  const saveStep = async (nextStep: number, updatedAnswers = a) => {
    let curSessionId = sessionId;

    // Step 0 -> 1 transition triggers initial insert
    if (!curSessionId) {
      curSessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
      setSessionId(curSessionId);
      try {
        localStorage.setItem("fuelbox_onboarding_session_id", curSessionId);
      } catch (_) {}

      // Fire-and-forget insert if configured
      if (onboardingSupabase?.from) {
        onboardingSupabase
          .from("onboarding_progress")
          .insert({
            id: curSessionId,
            status: "in_progress",
            current_step: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .then(({ error }: any) => {
            if (error)
              console.warn(
                "Failed to create onboarding session in new DB:",
                error,
              );
          })
          .catch(() => {});
      }
    }

    setStep(nextStep);
    try {
      localStorage.setItem("fuelbox_onboarding_step", String(nextStep));
      localStorage.setItem(
        "fuelbox_onboarding_answers",
        JSON.stringify(updatedAnswers),
      );
    } catch (_) {}

    // Update in new DB if configured — log result for verification
    if (onboardingSupabase?.from) {
      onboardingSupabase
        .from("onboarding_progress")
        .update({
          current_step: nextStep,
          goal: updatedAnswers.goal,
          age: updatedAnswers.age,
          gender: updatedAnswers.gender,
          height: updatedAnswers.height,
          weight: updatedAnswers.weight,
          food: updatedAnswers.food,
          activity: updatedAnswers.activity,
          freq: updatedAnswers.freq,
          loc_status: loc.status,
          loc_km: loc.km,
          loc_fee: loc.fee,
          loc_lat: loc.lat,
          loc_lng: loc.lng,
          name: updatedAnswers.name,
          phone: updatedAnswers.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", curSessionId)
        .select()
        .then(({ data, error }: any) => {
          if (error) console.error("[DB] ❌ Step update failed:", error);
          else console.log(`[DB] ✅ Step ${nextStep} saved:`, data);
        })
        .catch(() => {});
    }
  };

  const pick = (k: keyof OnboardingAnswers, v: any, next: number) => {
    const updated = { ...a, [k]: v };
    setA(updated);
    setTimeout(() => saveStep(next, updated), 260);
  };

  const askLocation = () => {
    setLoc((p) => ({ ...p, status: "loading" }));
    if (!navigator.geolocation) {
      setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const km = haversineKm(here, KITCHEN);
        const z = zoneFor(km);
        setLoc({
          status: z.zone,
          km: Math.round(km * 10) / 10,
          fee: z.fee,
          lat: here.lat,
          lng: here.lng,
        });
      },
      () => {
        setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const phoneOk = /^[6-9]\d{9}$/.test(a.phone);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim());

  // Handle "Get My Plan" — only generates and displays the plan (no DB write, no WhatsApp)
  const handleFinalize = async () => {
    if (!phoneOk || !a.name.trim() || !emailOk) return;
    setIsFinalizing(true);
    setFinalizationError("");

    try {
      // Save step 8 details to onboarding session
      await saveStep(8);

      // ─── Supabase profile sync if already logged in ───
      const oldSupabase = getSupabaseClient();
      if (loggedInUser && oldSupabase) {
        const mappedGoal =
          a.goal === "loss"
            ? "weight_loss"
            : a.goal === "gain"
              ? "weight_gain"
              : a.goal === "muscle"
                ? "muscle_gain"
                : "maintenance";
        const mappedDiet =
          a.food === "veg"
            ? "vegetarian"
            : a.food === "egg"
              ? "eggetarian"
              : "non_vegetarian";

        await updateUserProfile({
          full_name: a.name,
          phone: a.phone,
          gender: a.gender?.toLowerCase() as any,
          height: a.height,
          weight: a.weight,
          fitness_goal: mappedGoal as any,
          diet_type: mappedDiet as any,
        });
      }

      try {
        const cleanPhone = a.phone.replace(/\D/g, "");
        localStorage.setItem(
          "fuelbox_pending_reg",
          JSON.stringify({ name: a.name, phone: cleanPhone || a.phone }),
        );
        localStorage.setItem(
          "fuelbox_onboarding_answers_final",
          JSON.stringify(a),
        );
      } catch (_) {}

      // Preserve progress keys but set step to 9 so reload restores results screen
      try {
        localStorage.setItem("fuelbox_onboarding_step", "9");
        localStorage.setItem("fuelbox_onboarding_answers", JSON.stringify(a));
      } catch (_) {}

      // Show the results / meal plan screen
      setStep(9);
    } catch (err: any) {
      console.error("Finalization failed:", err);
      setFinalizationError(
        err.message ||
          "Failed to finalize. Please check details and try again.",
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const screen = () => {
    switch (step) {
      case 0:
        return (
          <div key="s0" className="anim" style={{ paddingTop: 48 }}>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: C.muted,
                marginBottom: 6,
              }}
            >
              we don't count{" "}
              <span
                style={{
                  textDecoration: "line-through",
                  textDecorationColor: C.yolk,
                  textDecorationThickness: 2,
                }}
              >
                meals
              </span>
              .
            </div>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                textTransform: "uppercase",
                fontSize: "clamp(52px, 15vw, 84px)",
                lineHeight: 0.95,
                color: C.bone,
                margin: "0 0 18px",
              }}
            >
              We count
              <br />
              <span style={{ color: C.yolk }}>protein.</span>
            </h1>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 32,
              }}
            >
              60 seconds. One plan built on your exact daily protein number —
              cooked and delivered in Coimbatore. Fuel your decision.
            </p>
            <PrimaryBtn onClick={() => saveStep(1)}>
              Find my number →
            </PrimaryBtn>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: C.muted,
                textAlign: "center",
                marginTop: 14,
              }}
            >
              Free plan · No signup · Order on WhatsApp
            </div>
          </div>
        );

      case 1:
        return (
          <div key="s1" className="anim">
            <Eyebrow>Step 1 / {TOTAL}</Eyebrow>
            <Question>What's the goal?</Question>
            {Object.entries(GOALS).map(([k, g]) => (
              <OptionCard
                key={k}
                selected={a.goal === k}
                onClick={() => pick("goal", k, 2)}
                title={g.label}
                sub={g.sub}
              />
            ))}
          </div>
        );

      case 2:
        return (
          <div key="s2" className="anim">
            <Eyebrow>Step 2 / {TOTAL}</Eyebrow>
            <Question>About you.</Question>
            <Slider
              label="Age"
              unit="yrs"
              value={a.age}
              min={16}
              max={65}
              onChange={(v) => set("age", v)}
            />
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Gender
            </div>
            <div className="flex" style={{ gap: 10, marginBottom: 28 }}>
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => set("gender", g)}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 15,
                    background:
                      a.gender === g ? "rgba(22,163,74,0.08)" : C.card,
                    border: `1.5px solid ${a.gender === g ? C.yolk : C.line}`,
                    color: a.gender === g ? C.yolk : C.bone,
                    transition: "all 160ms",
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <PrimaryBtn disabled={!a.gender} onClick={() => saveStep(3)}>
              Next →
            </PrimaryBtn>
          </div>
        );

      case 3:
        return (
          <div key="s3" className="anim">
            <Eyebrow>Step 3 / {TOTAL}</Eyebrow>
            <Question>Your build.</Question>
            <Slider
              label="Height"
              unit="cm"
              value={a.height}
              min={140}
              max={200}
              onChange={(v) => set("height", v)}
            />
            <Slider
              label="Weight"
              unit="kg"
              value={a.weight}
              min={40}
              max={130}
              onChange={(v) => set("weight", v)}
            />
            <PrimaryBtn onClick={() => saveStep(4)}>Next →</PrimaryBtn>
          </div>
        );

      case 4:
        return (
          <div key="s4" className="anim">
            <Eyebrow>Step 4 / {TOTAL}</Eyebrow>
            <Question>How do you eat?</Question>
            <OptionCard
              selected={a.food === "veg"}
              onClick={() => pick("food", "veg", 5)}
              title="Pure veg"
              sub="Paneer, soya, channa, millets"
              mark={<FoodMark type="veg" />}
            />
            <OptionCard
              selected={a.food === "egg"}
              onClick={() => pick("food", "egg", 5)}
              title="Veg + egg"
              sub="Everything veg, plus eggs"
              mark={<FoodMark type="egg" />}
            />
            <OptionCard
              selected={a.food === "nonveg"}
              onClick={() => pick("food", "nonveg", 5)}
              title="Non-veg"
              sub="Chicken, eggs, the works"
              mark={<FoodMark type="nonveg" />}
            />
          </div>
        );

      case 5:
        return (
          <div key="s5" className="anim">
            <Eyebrow>Step 5 / {TOTAL}</Eyebrow>
            <Question>Your day looks like…</Question>
            {Object.entries(ACTIVITY).map(([k, v]) => (
              <OptionCard
                key={k}
                selected={a.activity === k}
                onClick={() => pick("activity", k, 6)}
                title={v.label}
                sub={v.sub}
              />
            ))}
          </div>
        );

      case 6:
        return (
          <div key="s6" className="anim">
            <Eyebrow>Step 6 / {TOTAL}</Eyebrow>
            <Question>
              How many times
              <br />
              should we fuel you?
            </Question>
            {Object.entries(FREQS).map(([k, f]) => (
              <OptionCard
                key={k}
                selected={a.freq === Number(k)}
                onClick={() => {
                  const num = Number(k);
                  const defaultSlots =
                    num === 3 ? ["Morning", "Afternoon", "Night"] : [];
                  setA((prev) => ({
                    ...prev,
                    freq: num,
                    preferredSlots: defaultSlots,
                  }));
                }}
                title={f.label}
                sub={f.sub}
                right={
                  <span
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: Number(k) === 3 ? "#FFFFFF" : C.yolk,
                      background:
                        Number(k) === 3 ? C.yolk : "rgba(22,163,74,0.10)",
                      padding: "5px 10px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                    }}
                  >
                    {f.tag}
                  </span>
                }
              />
            ))}
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              More FuelBox meals = more of your day on target = faster result.
              You'll see the difference on the next screen.
            </div>

            {a.freq !== null && (
              <div className="mt-6 border-t border-gray-700/50 pt-6 anim">
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    color: C.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Which meals should we deliver? (Choose {a.freq})
                </div>
                <div className="flex flex-col gap-2">
                  {["Morning", "Afternoon", "Night"].map((slot) => {
                    const selected = (a.preferredSlots || []).includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          let slots = [...(a.preferredSlots || [])];
                          if (slots.includes(slot)) {
                            slots = slots.filter((s) => s !== slot);
                          } else {
                            if (a.freq === 1) {
                              slots = [slot];
                            } else if (slots.length < a.freq!) {
                              slots.push(slot);
                            } else {
                              slots.shift();
                              slots.push(slot);
                            }
                          }
                          setA((prev) => ({ ...prev, preferredSlots: slots }));
                        }}
                        className="w-full text-left"
                        style={{
                          background: selected
                            ? "rgba(22,163,74,0.08)"
                            : C.card,
                          border: `1.5px solid ${selected ? C.yolk : C.line}`,
                          borderRadius: 14,
                          padding: "16px 18px",
                          cursor: "pointer",
                          transition: "all 160ms",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          <span
                            style={{
                              display: "block",
                              fontFamily: FONT_BODY,
                              fontWeight: 700,
                              fontSize: 16,
                              color: C.bone,
                            }}
                          >
                            {slot}
                          </span>
                        </span>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            flexShrink: 0,
                            border: `2px solid ${selected ? C.yolk : C.line}`,
                            background: selected ? C.yolk : "transparent",
                            transition: "all 160ms",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <PrimaryBtn
                    onClick={() => saveStep(7)}
                    disabled={(a.preferredSlots || []).length !== a.freq}
                  >
                    Continue →
                  </PrimaryBtn>
                </div>
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div key="s7" className="anim">
            <Eyebrow>Step 7 / {TOTAL}</Eyebrow>
            <Question>
              Where do we
              <br />
              deliver?
            </Question>
            {loc.status === "idle" || loc.status === "loading" ? (
              <>
                <PrimaryBtn
                  onClick={askLocation}
                  disabled={loc.status === "loading"}
                >
                  {loc.status === "loading"
                    ? "Locating…"
                    : "📍 Use my location"}
                </PrimaryBtn>
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    color: C.muted,
                    lineHeight: 1.6,
                    margin: "14px 0",
                  }}
                >
                  Free delivery within {FREE_KM} km of Nava India. Up to{" "}
                  {MAX_KM} km: ₹{FEE_PER_KM}/km after the free zone — calculated
                  live.
                </div>
                <button
                  onClick={() => {
                    setLoc({
                      status: "skip",
                      km: null,
                      fee: null,
                      lat: null,
                      lng: null,
                    });
                    saveStep(8);
                  }}
                  className="w-full"
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 12,
                    color: C.muted,
                    fontFamily: FONT_BODY,
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "13px",
                    cursor: "pointer",
                  }}
                >
                  Skip — I'll confirm location on WhatsApp
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    background: C.card,
                    borderRadius: 14,
                    padding: "18px",
                    border: `1.5px solid ${loc.status === "out" ? C.nonveg : loc.status === "free" ? C.veg : C.line}`,
                    marginBottom: 14,
                  }}
                >
                  {loc.status === "free" && (
                    <>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontWeight: 700,
                          fontSize: 16,
                          color: C.bone,
                        }}
                      >
                        You're {loc.km} km from our kitchen ✓
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 13,
                          color: C.veg,
                          marginTop: 4,
                          fontWeight: 700,
                        }}
                      >
                        FREE delivery for you
                      </div>
                    </>
                  )}
                  {loc.status === "paid" && (
                    <>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontWeight: 700,
                          fontSize: 16,
                          color: C.bone,
                        }}
                      >
                        You're {loc.km} km away
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 13,
                          color: C.yolk,
                          marginTop: 4,
                          fontWeight: 700,
                        }}
                      >
                        Delivery ₹{loc.fee}/day (₹{FEE_PER_KM}/km after{" "}
                        {FREE_KM} km)
                      </div>
                    </>
                  )}
                  {loc.status === "out" && (
                    <>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontWeight: 700,
                          fontSize: 16,
                          color: C.bone,
                        }}
                      >
                        You're {loc.km} km out — just past our {MAX_KM} km ring
                        💔
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 13,
                          color: C.muted,
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        We're Coimbatore-only for now. Drop your number — you're
                        first in line when we expand.
                      </div>
                    </>
                  )}
                  {loc.status === "denied" && (
                    <div
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        color: C.muted,
                        lineHeight: 1.5,
                      }}
                    >
                      Couldn't get your location. No problem — we'll confirm
                      delivery on WhatsApp.
                    </div>
                  )}
                </div>
                <PrimaryBtn onClick={() => saveStep(8)}>Next →</PrimaryBtn>
              </>
            )}
          </div>
        );

      case 8:
        return (
          <div key="s8" className="anim">
            <Eyebrow>Step 8 / {TOTAL}</Eyebrow>
            <Question>
              Where do we send
              <br />
              your plan?
            </Question>
            {finalizationError && (
              <div
                style={{
                  color: C.nonveg,
                  fontSize: 13,
                  background: "rgba(168,50,50,0.1)",
                  border: `1px solid ${C.nonveg}`,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 12,
                  fontFamily: FONT_BODY,
                }}
              >
                {finalizationError}
              </div>
            )}
            <div
              style={{
                background: C.card,
                border: `1.5px solid ${C.line}`,
                borderRadius: 12,
                padding: "4px 16px",
                marginBottom: 10,
              }}
            >
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={a.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Your name"
                className="w-full"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: FONT_BODY,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.bone,
                  padding: "14px 0",
                }}
              />
            </div>
            <div
              style={{
                background: C.card,
                border: `1.5px solid ${C.line}`,
                borderRadius: 12,
                padding: "4px 16px",
                marginBottom: 10,
              }}
            >
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={a.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Your email"
                className="w-full"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: FONT_BODY,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.bone,
                  padding: "14px 0",
                }}
              />
            </div>
            <div
              className="flex items-center"
              style={{
                background: C.card,
                border: `1.5px solid ${C.line}`,
                borderRadius: 12,
                padding: "4px 16px",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  color: C.muted,
                  fontSize: 16,
                  marginRight: 10,
                }}
              >
                +91
              </span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel-national"
                inputMode="numeric"
                maxLength={10}
                value={a.phone}
                onChange={(e) =>
                  set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="WhatsApp number"
                className="w-full"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: FONT_BODY,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.bone,
                  padding: "14px 0",
                  letterSpacing: "0.06em",
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: C.muted,
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Your plan + price lands on WhatsApp from Ajith. No spam, no calls.
            </div>
            <PrimaryBtn
              disabled={!phoneOk || !emailOk || !a.name.trim() || isFinalizing}
              onClick={handleFinalize}
            >
              {isFinalizing ? "Generating Plan..." : "Get my plan →"}
            </PrimaryBtn>
          </div>
        );

      case 9:
        return (
          <Result
            a={a}
            loc={loc}
            ing={ing}
            saveStep={saveStep}
            setLoc={setLoc}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e2f0e2 0%, #fde8d8 100%)",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        .anim { animation: fadeUp 320ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        input[type="range"]::-webkit-slider-thumb { cursor: pointer; }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid ${C.yolk}; outline-offset: 3px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .anim { animation: none; } * { transition: none !important; } }
        /* Keep the last step clear of the fixed bottom nav on mobile/tablet */
        @media (max-width: 1023px) {
          .fuelbox-onboarding-main { padding-bottom: 128px !important; }
        }
      `,
        }}
      />

      <div
        className="mx-auto fuelbox-onboarding-main"
        style={{ maxWidth: 440, padding: "0 22px 48px" }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "20px 0 14px" }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/logo.png"
              alt="FuelBox"
              style={{ height: 32, width: "auto", objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const textEl = e.currentTarget.nextSibling as HTMLDivElement;
                if (textEl) textEl.style.display = "block";
              }}
            />
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 20,
                letterSpacing: "0.02em",
                fontWeight: 800,
                display: "none",
              }}
            >
              <span style={{ color: "#16a34a" }}>Fuel</span>
              <span style={{ color: "#111827" }}>Box</span>
            </div>
          </div>
          {step >= 1 && step <= TOTAL + 1 && (
            <button
              onClick={() => saveStep(step - 1)}
              style={{
                background: "transparent",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                color: C.muted,
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}
        </div>
        {step >= 1 && step <= TOTAL + 1 && (
          <div
            style={{
              height: 3,
              background: C.line,
              borderRadius: 2,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (step / TOTAL) * 100)}%`,
                background: C.yolk,
                borderRadius: 2,
                transition: "width 300ms ease",
              }}
            />
          </div>
        )}
        {screen()}
      </div>

      {/* Bottom navigation — mobile & tablet only (hidden on desktop) */}
      <OnboardingBottomNav />
    </div>
  );
}

// Fixed bottom navigation for the Customer Onboarding page — visible on mobile
// and tablet viewports only (hidden at `lg`/desktop breakpoint and above).
function OnboardingBottomNav() {
  const pathname = usePathname() || "/";

  const items = [
    {
      label: "Home",
      icon: Home,
      href: "/",
      isActive: (p: string) => p === "/",
    },
    {
      label: "Menu",
      icon: Utensils,
      href: "/menu",
      isActive: (p: string) => p.startsWith("/menu"),
    },
    {
      label: "Plans",
      icon: Receipt,
      href: "/plans",
      isActive: (p: string) => p.startsWith("/plans"),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
        paddingTop: 8,
        paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className="flex flex-col items-center gap-1 text-center transition-all duration-200 active:scale-95"
              style={{ minWidth: 64 }}
            >
              <div
                className={`flex items-center justify-center rounded-xl p-1 transition-colors duration-200 ${
                  active
                    ? "bg-[#16a34a]/10 text-[#16a34a]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[10px] tracking-wide transition-colors duration-200 ${
                  active ? "font-bold text-[#16a34a]" : "font-semibold text-gray-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
