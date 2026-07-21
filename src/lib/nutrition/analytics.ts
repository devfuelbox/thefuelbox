import type { MealLog, WaterLog } from "../storage";

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  water: number;
}

export function totalsByDay(meals: MealLog[], waters: WaterLog[]): Record<string, DayTotals> {
  const map: Record<string, DayTotals> = {};
  const ensure = (d: string) =>
    (map[d] ??= { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, water: 0 });
  for (const m of meals) {
    const t = ensure(m.date);
    t.calories += m.calories;
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
    t.fiber += m.fiber;
    t.sugar += m.sugar;
    t.sodium += m.sodium;
  }
  for (const w of waters) ensure(w.date).water += w.ml;
  return map;
}

export function rangeDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function fillRange(totals: Record<string, DayTotals>, days: string[]): DayTotals[] {
  return days.map(
    (d) =>
      totals[d] ?? { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, water: 0 },
  );
}

export function macroBalanceScore(t: DayTotals): number {
  const total = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  if (!total) return 0;
  const p = (t.protein * 4) / total;
  const c = (t.carbs * 4) / total;
  const f = (t.fat * 9) / total;
  // ideal 30/40/30 — score by closeness
  const diff = Math.abs(p - 0.3) + Math.abs(c - 0.4) + Math.abs(f - 0.3);
  return Math.max(0, Math.round(100 - diff * 120));
}
