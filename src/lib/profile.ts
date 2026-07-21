export type Goal = "lose" | "maintain" | "gain" | "performance" | "wellness";
export type Gender = "male" | "female" | "other";

export interface Profile {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  name?: string;
  dietType?: "vegetarian" | "non_vegetarian" | "eggetarian" | "vegan";
  healthIssues?: string;
}

const mockProfile: Profile = {
  age: 30,
  gender: "male",
  heightCm: 178,
  weightKg: 75,
  goal: "maintain",
  activityLevel: "moderate",
  name: "Friend",
};

// Real profile adapter — wire this up when real auth/profile is available.
// Returning null keeps the mock active with no UI changes required.
let realProfileAdapter: (() => Profile | null) | null = null;

export function setProfileAdapter(fn: (() => Profile | null) | null) {
  realProfileAdapter = fn;
}

export function getProfile(): Profile {
  return realProfileAdapter?.() ?? mockProfile;
}

export function profileCompleteness(p: Profile): number {
  let filled = 0;
  let total = 6;
  if (p.age) filled++;
  if (p.gender) filled++;
  if (p.heightCm) filled++;
  if (p.weightKg) filled++;
  if (p.goal) filled++;
  if (p.activityLevel) filled++;
  return filled / total;
}

// MifflinΓÇôSt Jeor
export function bmr(p: Profile): number {
  const s = p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78;
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s);
}

export function tdee(p: Profile): number {
  const m: Record<Profile["activityLevel"], number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr(p) * m[p.activityLevel]);
}

import { rdaFor, ageBand } from "@/data/rda";

export function defaultDailyTargets(p: Profile) {
  // Anchor on RDA table by age + gender, then nudge by goal.
  const rda = rdaFor(p.age, p.gender);
  const goalCalAdj = p.goal === "lose" ? -300 : p.goal === "gain" ? 300 : 0;
  const calories = Math.max(1200, rda.calories + goalCalAdj);
  const protein = Math.round(Math.max(rda.protein, p.weightKg * (p.goal === "performance" ? 1.8 : 1.4)));
  const fat = rda.fat;
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const water = Math.round(p.weightKg * 35); // ml
  return { calories, protein, carbs, fat, water, fiber: rda.fiber, band: ageBand(p.age) };
}
