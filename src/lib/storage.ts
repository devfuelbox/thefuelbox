export interface QuizAnswer {
  question: string;
  answer: string;
  topic?: string;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number; // ml
  fiber?: number;
}

export interface MealRec {
  name: string;
  why: string;
}

export interface Assessment {
  id: string;
  date: string; // ISO
  answers: QuizAnswer[];
  healthStage: string;
  nutritionScore: number; // 0-100
  confidenceScore: number; // 0-100
  fuelBoxReadinessScore: number; // 0-100
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  priorityFocus: string[];
  quickWins: string[];
  recommendations: string[];
  dailyTargets: DailyTargets;
  recommendedPlan: string;
  recommendedMeals: {
    breakfast: MealRec[];
    lunch: MealRec[];
    dinner: MealRec[];
    snacks: MealRec[];
  };
  progressDelta?: {
    scoreChange: number;
    note: string;
  };
}

export interface MealLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // ISO
  foodId: string;
  foodName: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  type: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface WaterLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  ml: number;
}

const KEYS = {
  assessments: "fb.assessments.v1",
  mealLogs: "fb.mealLogs.v1",
  waterLogs: "fb.waterLogs.v1",
  dailyRecs: "fb.dailyRecs.v1",
  likes: "fb.likes.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const storage = {
  getAssessments: () => read<Assessment[]>(KEYS.assessments, []),
  saveAssessment: (a: Assessment) => {
    const list = storage.getAssessments();
    list.unshift(a);
    write(KEYS.assessments, list.slice(0, 50));
  },
  latestAssessment: (): Assessment | null => storage.getAssessments()[0] ?? null,

  getMealLogs: () => read<MealLog[]>(KEYS.mealLogs, []),
  addMealLog: (m: MealLog) => {
    const list = storage.getMealLogs();
    list.push(m);
    write(KEYS.mealLogs, list);
  },
  removeMealLog: (id: string) => {
    write(KEYS.mealLogs, storage.getMealLogs().filter((m) => m.id !== id));
  },

  getWaterLogs: () => read<WaterLog[]>(KEYS.waterLogs, []),
  addWater: (ml: number) => {
    const list = storage.getWaterLogs();
    list.push({
      id: crypto.randomUUID(),
      date: today(),
      time: new Date().toISOString(),
      ml,
    });
    write(KEYS.waterLogs, list);
  },

  getDailyRec: (date: string) => read<Record<string, unknown>>(KEYS.dailyRecs, {})[date] ?? null,
  setDailyRec: (date: string, value: unknown) => {
    const all = read<Record<string, unknown>>(KEYS.dailyRecs, {});
    all[date] = value;
    write(KEYS.dailyRecs, all);
  },

  getLikes: () => read<string[]>(KEYS.likes, []),
  toggleLike: (foodId: string) => {
    const list = storage.getLikes();
    const next = list.includes(foodId) ? list.filter((x) => x !== foodId) : [...list, foodId];
    write(KEYS.likes, next);
    return next;
  },
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}
