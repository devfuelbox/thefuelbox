export interface EnquiryInput {
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  goal: 'loss' | 'gain' | 'maintenance';
  activity: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  food_preference: 'veg' | 'non_veg' | 'egg';
  meals_per_day: number;
}

export interface NutritionResult {
  bmr: number;
  tdee: number;
  goal_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protein_per_kg: number;
}

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

export function calculateNutrition(input: EnquiryInput): NutritionResult {
  const w = input.weight || 70;
  const h = input.height || 170;
  const a = input.age || 25;
  const isMale = input.gender === 'male';

  const bmr = 10 * w + 6.25 * h - 5 * a + (isMale ? 5 : -161);

  const factor = ACTIVITY_FACTORS[input.activity] || 1.2;
  const tdee = Math.round(bmr * factor);

  let goalCalories = tdee;
  if (input.goal === 'loss') goalCalories = Math.max(isMale ? 1500 : 1200, tdee - 400);
  else if (input.goal === 'gain') goalCalories = tdee + 400;

  let proteinPerKg = 1.6;
  if (input.goal === 'loss') proteinPerKg = 2.0;
  else if (input.goal === 'gain') proteinPerKg = 1.8;

  const proteinG = Math.round(w * proteinPerKg);
  const proteinKcal = proteinG * 4;

  const fatKcal = goalCalories * 0.25;
  const fatG = Math.round(fatKcal / 9);

  const carbsKcal = Math.max(0, goalCalories - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  return {
    bmr: Math.round(bmr),
    tdee,
    goal_calories: goalCalories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    protein_per_kg: proteinPerKg,
  };
}

export function calculateItemNutrition(
  item: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number },
  grams: number
): { calories: number; protein: number; carbs: number; fat: number } {
  const ratio = grams / 100;
  return {
    calories: Math.round((item.calories || 0) * ratio),
    protein: Math.round(((item.protein_g || 0) * ratio) * 10) / 10,
    carbs: Math.round(((item.carbs_g || 0) * ratio) * 10) / 10,
    fat: Math.round(((item.fat_g || 0) * ratio) * 10) / 10,
  };
}

export function distributeMeals(
  items: Array<{ id: number | string; name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }>,
  mealsPerDay: number
): Array<{
  name: string;
  items: Array<{ id: number | string; name: string; grams: number; calories: number; protein: number }>;
  total_calories: number;
  total_protein: number;
}> {
  const mealNames = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const activeMealNames = mealNames.slice(0, mealsPerDay);
  const totalCals = items.reduce((s, i) => s + i.calories, 0);
  const totalProtein = items.reduce((s, i) => s + i.protein, 0);

  const meals = activeMealNames.map((name, idx) => {
    const idealShare = 1 / mealsPerDay;
    const targetCals = totalCals * idealShare;
    const targetProtein = totalProtein * idealShare;

    const mealItems = items.filter((_, i) => i % mealsPerDay === idx);
    const mealTotalCals = mealItems.reduce((s, i) => s + i.calories, 0);
    const mealTotalProtein = mealItems.reduce((s, i) => s + i.protein, 0);

    return {
      name,
      items: mealItems.map(i => ({
        id: i.id,
        name: i.name,
        grams: i.grams,
        calories: i.calories,
        protein: i.protein,
      })),
      total_calories: mealTotalCals || Math.round(targetCals),
      total_protein: Math.round((mealTotalProtein || targetProtein) * 10) / 10,
    };
  });

  return meals;
}
