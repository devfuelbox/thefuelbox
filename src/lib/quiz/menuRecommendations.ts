import { FUEL_BOX_MENU, type FuelBoxFood } from "@/data/fuelbox-menu";
import type { QuizAnswer } from "../storage";
import type { Profile } from "../profile";

interface NutritionNeeds {
  priority: "high-protein" | "high-fiber" | "low-carb" | "balanced" | "high-energy";
  wantsVariety: boolean;
  wantsPlantBased: boolean;
  needsDigestionSupport: boolean;
  needsEnergy: boolean;
  needsRecovery: boolean;
}

function analyzeNeeds(answers: QuizAnswer[], profile: Profile): NutritionNeeds {
  const allText = answers.map((a) => `${a.topic} ${a.answer}`).join(" ").toLowerCase();
  const goal = profile.goal?.toLowerCase() || "";

  const wantsPlantBased = allText.includes("plant") || allText.includes("vegan") || allText.includes("vegetarian");
  const wantsVariety = allText.includes("variety") || allText.includes("diverse") || allText.includes("new food");
  const needsDigestionSupport = allText.includes("digestion") || allText.includes("bloat") || allText.includes("digestive issue");
  const needsEnergy = allText.includes("low energy") || allText.includes("energy dips") || allText.includes("tired");
  const needsRecovery = allText.includes("recovery") || allText.includes("sore") || allText.includes("exercise") || allText.includes("activity");

  let priority: NutritionNeeds["priority"] = "balanced";
  if (goal.includes("build") || goal.includes("muscle") || goal.includes("gain")) priority = "high-protein";
  else if (goal.includes("lose") || goal.includes("weight") || goal.includes("fat")) priority = "low-carb";
  else if (goal.includes("energy") || goal.includes("active") || goal.includes("endurance")) priority = "high-energy";
  else if (allText.includes("fiber") || allText.includes("digest")) priority = "high-fiber";

  return { priority, wantsVariety, wantsPlantBased, needsDigestionSupport, needsEnergy, needsRecovery };
}

function scoreItem(item: FuelBoxFood, needs: NutritionNeeds): number {
  let score = 50;

  if (needs.priority === "high-protein") {
    if (item.tags.includes("high-protein")) score += 30;
    score += item.protein * 2;
  }
  if (needs.priority === "high-fiber") {
    if (item.tags.includes("fiber")) score += 25;
    score += item.fiber * 5;
  }
  if (needs.priority === "low-carb") {
    score -= item.carbs * 0.5;
    if (item.group === "vegetable" || item.group === "protein") score += 15;
  }
  if (needs.priority === "high-energy") {
    score += item.carbs * 0.3 + item.calories * 0.05;
  }
  if (needs.wantsPlantBased && (item.tags.includes("vegan") || item.group === "legume" || item.group === "vegetable" || item.group === "fruit" || item.group === "nuts")) {
    score += 20;
  }
  if (needs.needsDigestionSupport && item.tags.includes("fiber")) {
    score += 20;
  }
  if (needs.needsEnergy && item.tags.includes("energy")) {
    score += 20;
  }
  if (needs.needsRecovery && item.tags.includes("high-protein")) {
    score += 20;
  }

  return score;
}

function pickBest(items: FuelBoxFood[], needs: NutritionNeeds, count: number): Array<{ name: string; why: string }> {
  const scored = items
    .map((item) => ({ item, score: scoreItem(item, needs) }))
    .sort((a, b) => b.score - a.score);

  const result: Array<{ name: string; why: string }> = [];
  const usedNames = new Set<string>();

  for (const { item } of scored) {
    if (result.length >= count) break;
    if (usedNames.has(item.name)) continue;
    usedNames.add(item.name);

    let why = "";
    if (item.tags.includes("high-protein") && needs.priority === "high-protein") why = "High in protein to support your goals";
    else if (item.tags.includes("fiber")) why = "Rich in fiber for digestion and fullness";
    else if (item.tags.includes("energy")) why = "Provides steady energy throughout the day";
    else if (item.tags.includes("antioxidant")) why = "Packed with antioxidants for overall health";
    else if (item.tags.includes("low-cal")) why = "Low in calories, great for weight management";
    else if (item.tags.includes("complex-carbs")) why = "Complex carbs for sustained energy";
    else if (item.tags.includes("vitamin-c")) why = "High in vitamin C to support immunity";
    else if (item.tags.includes("lean")) why = "Lean protein source for muscle maintenance";
    else if (item.tags.includes("vegan")) why = "Plant-based option aligned with your preference";
    else if (item.tags.includes("hydrating")) why = "Helps with hydration and is light on the stomach";
    else why = "Nutrient-dense choice for balanced nutrition";

    result.push({ name: item.name, why });
  }

  return result;
}

export function getMenuRecommendations(
  answers: QuizAnswer[],
  profile: Profile,
): {
  breakfast: Array<{ name: string; why: string }>;
  lunch: Array<{ name: string; why: string }>;
  dinner: Array<{ name: string; why: string }>;
  snacks: Array<{ name: string; why: string }>;
} {
  const needs = analyzeNeeds(answers, profile);

  const breakfastItems = FUEL_BOX_MENU.filter((i) => i.category === "breakfast");
  const lunchItems = FUEL_BOX_MENU.filter((i) => i.category === "lunch");
  const dinnerItems = FUEL_BOX_MENU.filter((i) => i.category === "dinner");
  const snackItems = FUEL_BOX_MENU.filter((i) => i.category === "snack");

  const breakfast = pickBest(breakfastItems, needs, 3);
  const lunch = pickBest(lunchItems, needs, 3);
  const dinner = pickBest(dinnerItems, needs, 3);
  const snacks = pickBest(snackItems, needs, 3);

  return { breakfast, lunch, dinner, snacks };
}

export function getDefaultTargetsFromMenu(): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
} {
  const avgCal = Math.round(FUEL_BOX_MENU.reduce((s, i) => s + i.calories, 0) / FUEL_BOX_MENU.length * 4);
  const avgP = Math.round(FUEL_BOX_MENU.reduce((s, i) => s + i.protein, 0) / FUEL_BOX_MENU.length * 4);
  const avgC = Math.round(FUEL_BOX_MENU.reduce((s, i) => s + i.carbs, 0) / FUEL_BOX_MENU.length * 4);
  const avgF = Math.round(FUEL_BOX_MENU.reduce((s, i) => s + i.fat, 0) / FUEL_BOX_MENU.length * 4);

  return {
    calories: avgCal,
    protein: avgP,
    carbs: avgC,
    fat: avgF,
    water: 2500,
  };
}
