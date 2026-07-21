import { z } from "zod";

export const QuestionSchema = z.object({
  done: z.boolean(),
  question: z.string().optional(),
  topic: z.string(),
  options: z.array(z.string()).optional(),
  rationale: z.string().optional(),
});

export const MealRecSchema = z.object({ name: z.string(), why: z.string() });

export const ReportSchema = z.object({
  healthStage: z.string(),
  nutritionScore: z.number(),
  confidenceScore: z.number(),
  fuelBoxReadinessScore: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvementAreas: z.array(z.string()),
  priorityFocus: z.array(z.string()),
  quickWins: z.array(z.string()),
  recommendations: z.array(z.string()),
  dailyTargets: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    water: z.number(),
  }),
  recommendedPlan: z.string(),
  recommendedMeals: z.object({
    breakfast: z.array(MealRecSchema),
    lunch: z.array(MealRecSchema),
    dinner: z.array(MealRecSchema),
    snacks: z.array(MealRecSchema),
  }),
});

export const DailyRecSchema = z.object({
  focus: z.string(),
  tips: z.array(z.string()).max(4),
  pickBreakfast: z.string().optional(),
  pickLunch: z.string().optional(),
  pickDinner: z.string().optional(),
  pickSnack: z.string().optional(),
  rationale: z.string().optional(),
});

export interface FollowUpQuestion {
  topic: string;
  q: string;
  options: string[];
}

export interface AIQuizContext {
  conversationHistory: Array<{
    question: string;
    answer: string;
    topic: string;
  }>;
  userProfile: {
    name?: string;
    age?: number;
    goals?: string[];
    dietary_restrictions?: string[];
    health_conditions?: string[];
  };
  assessmentAreas: string[];
}

export type QuestionPayload = z.infer<typeof QuestionSchema>;
export type ReportPayload = z.infer<typeof ReportSchema>;
export type DailyRecPayload = z.infer<typeof DailyRecSchema>;
