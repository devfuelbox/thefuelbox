// Helpers for reading/editing meal plans across formats.
//
// Two plan shapes exist in the DB:
//   1. Onboarding object: { meals: [{name, items:[{id, g}]}], items, protein, kcal }
//   2. Enquiry array:     [{name, items:[{id, name, grams, calories, protein}], total_calories, total_protein}]

import { foodDisplayName } from './foodDisplay';
import { calculateItemNutrition } from './nutrition/calculations';

export interface MenuItemLike {
  id: number | string;
  name: string;
  price: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// Normalizes a meal plan into { meals, kcal, protein } regardless of shape.
export function normalizeMealPlan(mp: any): { meals: any[]; kcal: number; protein: number } | null {
  if (!mp) return null;
  if (!Array.isArray(mp) && mp.meals && Array.isArray(mp.meals)) {
    return {
      meals: mp.meals,
      kcal: Number(mp.kcal || mp.kcalT || 0),
      protein: Number(mp.protein || mp.protT || 0),
    };
  }
  if (Array.isArray(mp) && mp.length > 0) {
    const meals = mp.map((m: any) => ({ name: m.name || 'Meal', items: m.items || [] }));
    const kcal = mp.reduce((s: number, m: any) => s + Number(m.total_calories || 0), 0);
    const protein = mp.reduce((s: number, m: any) => s + Number(m.total_protein || 0), 0);
    return { meals, kcal, protein };
  }
  return null;
}

// Resolves a plan item to a menu item by numeric id, or by display name.
export function resolveMenuItem(item: any, menuItems: MenuItemLike[]): MenuItemLike | null {
  if (!menuItems?.length) return null;
  if (item.id !== undefined && item.id !== null) {
    const byId = menuItems.find(m => String(m.id) === String(item.id));
    if (byId) return byId;
  }
  const dName = foodDisplayName(item);
  return menuItems.find(m => m.name.toLowerCase() === dName.toLowerCase()) || null;
}

export function itemGrams(item: any): number {
  return Number(item?.grams ?? item?.g ?? 0) || 0;
}

// Converts either plan shape into the enquiry array format, resolving item names
// and nutrition from the menu when available.
export function canonicalMealPlan(plan: any, menuItems: MenuItemLike[]): Array<{
  name: string;
  items: Array<{ id: number | string; name: string; grams: number; calories: number; protein: number }>;
  total_calories: number;
  total_protein: number;
}> {
  const norm = normalizeMealPlan(plan);
  if (!norm) return [];
  return norm.meals.map(m => {
    const items = (m.items || []).map((it: any) => {
      const mi = resolveMenuItem(it, menuItems);
      const grams = itemGrams(it);
      const nut = mi
        ? calculateItemNutrition(mi, grams)
        : {
            calories: Number(it.calories ?? it.kcal ?? 0),
            protein: Number(it.protein ?? it.prot ?? 0),
            carbs: Number(it.carbs ?? 0),
            fat: Number(it.fat ?? 0),
          };
      return {
        id: mi?.id ?? it.id,
        name: mi?.name || it.name || foodDisplayName(it),
        grams,
        calories: nut.calories,
        protein: nut.protein,
      };
    });
    return {
      name: m.name || 'Meal',
      items,
      total_calories: items.reduce((s, x) => s + x.calories, 0),
      total_protein: Math.round(items.reduce((s, x) => s + x.protein, 0) * 10) / 10,
    };
  });
}

// Price of an item using the menu's per-100g price.
export function itemPrice(item: any, menuItems: MenuItemLike[]): number {
  const mi = resolveMenuItem(item, menuItems);
  if (!mi) return 0;
  return Math.round((Number(mi.price) || 0) * itemGrams(item) / 100 * 100) / 100;
}

// Totals (kcal, protein, price) for a whole plan.
export function planTotals(
  plan: any,
  menuItems: MenuItemLike[]
): { kcal: number; protein: number; price: number } {
  const canonical = canonicalMealPlan(plan, menuItems);
  let kcal = 0;
  let protein = 0;
  let price = 0;
  canonical.forEach(m =>
    m.items.forEach(it => {
      kcal += it.calories;
      protein += it.protein;
      price += itemPrice(it, menuItems);
    })
  );
  return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10, price: Math.round(price * 100) / 100 };
}

// Builds a selected_food_items array (enquiry format) from a plan.
export function selectedFoodItemsFromPlan(
  plan: any,
  menuItems: MenuItemLike[]
): Array<{ id: number | string; name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }> {
  const canonical = canonicalMealPlan(plan, menuItems);
  return canonical.flatMap(m =>
    m.items.map(it => {
      const mi = resolveMenuItem(it, menuItems);
      const nut = mi
        ? calculateItemNutrition(mi, it.grams)
        : { calories: it.calories, protein: it.protein, carbs: 0, fat: 0 };
      return { ...it, calories: nut.calories, protein: nut.protein, carbs: nut.carbs, fat: nut.fat };
    })
  );
}
