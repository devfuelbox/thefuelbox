/**
 * AI Service - Calls OpenRouter API for dynamic quiz questions and recommendations
 * Fallback to mock data if API fails or is not available
 */

import type { QuestionPayload, ReportPayload } from "./quiz/schemas";
import type { QuizAnswer, Assessment } from "./storage";
import type { Profile } from "./profile";
import { FUEL_BOX_MENU } from "@/data/fuelbox-menu";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Call OpenRouter API — uses only free-tier models so zero credits are needed.
 * Retries on 429 (rate-limit) up to 3 times with exponential back-off.
 */
async function callAI(prompt: string, systemPrompt: string, maxTokens = 400): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[FuelBox AI] VITE_OPENROUTER_API_KEY is not set in .env — AI features disabled.");
    return "";
  }

  // Free-tier models — confirmed working, zero credits needed.
  // Ordered by reliability based on live probing.
  const modelsToTry = [
    "openai/gpt-oss-20b:free",                    // ✅ fastest, confirmed working
    "google/gemma-4-26b-a4b-it:free",             // ✅ Google free model
    "nousresearch/hermes-3-llama-3.1-405b:free",  // ✅ powerful free fallback
    "meta-llama/llama-3.2-3b-instruct:free",      // ✅ small but reliable
    "meta-llama/llama-3.3-70b-instruct:free",     // often rate-limited, last resort
  ];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const model of modelsToTry) {
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[FuelBox AI] ${model} — attempt ${attempt}`);
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://fuelbox.in",
            "X-Title": "FuelBox",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: maxTokens,
          }),
        });

        lastStatus = response.status;

        if (response.ok) {
          const data = await response.json();
          const content: string = data.choices?.[0]?.message?.content ?? "";
          if (content) {
            console.log(`✅ [FuelBox AI] Success — model: ${model}, attempt: ${attempt}`);
            return content;
          }
        } else if (response.status === 429) {
          const waitMs = attempt * 1500; // 1.5s, 3s, 4.5s
          console.warn(`[FuelBox AI] 429 rate-limit on ${model}. Waiting ${waitMs}ms before retry...`);
          await sleep(waitMs);
        } else {
          const errBody = await response.text().catch(() => "(no body)");
          console.warn(`[FuelBox AI] ${model} failed ${response.status}:`, errBody.slice(0, 150));
          break; // Non-429 error → skip to next model immediately
        }
      } catch (error) {
        console.warn(`[FuelBox AI] Network error for ${model}:`, error);
        break;
      }
    }
    if (lastStatus !== 429) continue; // Already moved on above
  }

  console.error("[FuelBox AI] All free models exhausted. Returning empty — mock fallback will be used.");
  return "";
}

/**
 * Safely parse JSON from the AI response, stripping potential markdown blocks
 */
function safeParseJSON(str: string): any {
  if (!str) return null;
  let cleaned = str.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("[FuelBox AI] JSON parse failed on string:", str, error);
    return null;
  }
}


/**
 * Generate quiz question using AI
 * Uses the AI Assessment Engine prompt for structured, adaptive question generation
 */
export async function generateAIQuestion(args: {
  profile: Profile;
  currentAnswers: QuizAnswer[];
  previousAssessments: Assessment[];
}): Promise<QuestionPayload | null> {
  const { profile, currentAnswers, previousAssessments } = args;

  const answersContext = currentAnswers
    .map((a) => `Topic: ${a.topic}, Question: ${a.question}, Answer: ${a.answer}`)
    .join("\n\n");

  const previousAssessmentContext = previousAssessments
    .slice(0, 3)
    .map((a) => `Date: ${new Date(a.date).toLocaleDateString()}, Stage: ${a.healthStage}, Strengths: ${a.strengths?.join(", ") || "N/A"}, Focus: ${a.priorityFocus?.join(", ") || "N/A"}`)
    .join("\n");

  // Collect ALL questions ever asked — current + previous assessments — to avoid repetition
  const allPreviousQuestions = previousAssessments
    .flatMap((a) => a.answers?.map((q) => q.question) || []);
  const previouslyAskedQuestions = [
    ...currentAnswers.map((a) => a.question),
    ...allPreviousQuestions,
  ].filter(Boolean).join("\n");

  const coveredTopics = [
    ...new Set([
      ...currentAnswers.map((a) => a.topic),
      ...previousAssessments.flatMap((a) => a.answers?.map((q) => q.topic) || []),
    ]),
  ].filter(Boolean).join(", ");

  const prompt = `
# Fuel Box AI Quiz Instructions

You are an AI Health Assessment Assistant for Fuel Box. Optimised for Tamil nadu users.
Your job is NOT to test the user's nutrition knowledge.

Do NOT ask quiz questions like:
- Which food contains Vitamin C?
- Which vitamin is good for bones?
- Which food has the most protein?
- Which nutrient gives energy?

These are knowledge questions and they do not help analyze the user's health.

Instead, ask questions about the user's daily habits and lifestyle so you can understand their current health and nutrition status.

The goal is to analyze the user, not test the user.
Act as a professional fitness coach, sports nutritionist, and Indian diet planner specialized in Tamil Nadu/South Indian body types, food habits, and climate.

Your task is to calculate accurate daily nutrition targets for Indian users.

Input:

* Age
* Gender
* Weight (kg)
* Height (cm)
* Activity level:

  * Sedentary
  * Lightly active
  * Moderately active
  * Very active
* Goal:

  * Muscle gain
  * Weight gain
  * Fat loss
  * Maintenance

Calculation Rules:

1. Calculate BMR using Mifflin-St Jeor equation.
2. Calculate TDEE using activity multiplier.
3. Adjust calories based on goal:

   * Muscle gain: +250 to +400 kcal
   * Weight gain: +300 to +500 kcal
   * Fat loss: -300 to -500 kcal
   * Maintenance: TDEE

Macro Calculation:
4. Protein:

* Muscle gain: 1.6–2.2 g/kg
* Weight gain: 1.4–1.8 g/kg
* Fat loss: 1.8–2.4 g/kg
* Maintenance: 1.2–1.6 g/kg

5. Fat:

   * Minimum 0.8–1.0 g/kg

6. Carbs:

   * Fill remaining calories after protein and fat.

7. Validate final calories using:

   * Protein = 4 kcal/g
   * Carbs = 4 kcal/g
   * Fat = 9 kcal/g

Important Rules:

* Final macro calories must exactly match total daily calories (difference less than 50 kcal).
* Do not give generic values.
* Adjust carbs slightly higher for Indian/Tamil Nadu users due to rice-based diets and higher carb tolerance.
* Consider hot Tamil Nadu climate when calculating hydration.

Recommended Daily Intake:

   * Calories
   * Protein (g)
   * Carbs (g)
   * Fat (g)
   * Water (ml)


## Context

User Profile:
- Age: ${profile.age}
- Gender: ${profile.gender || "Not specified"}
- Goal: ${profile.goal}
- Activity Level: ${profile.activityLevel}
- Height: ${profile.heightCm}cm
- Weight: ${profile.weightKg}kg

Current Assessment Answers:
${answersContext || "No answers yet (this is the first question)"}

Previous Assessment History:
${previousAssessmentContext || "No previous assessments available"}

Previously Asked Questions:
${previouslyAskedQuestions || "None yet"}

Topics Already Covered:
${coveredTopics || "None yet"}

## Question Guidelines

Generate simple questions about:
- Daily eating habits
- Meal timing
- Breakfast habits
- Water intake
- Fruit and vegetable intake
- Protein intake
- Sleep quality
- Energy level
- Hunger during the day
- Physical activity
- Eating outside
- Snacking habits
- Meal consistency
- Stress eating
- Recovery after activity
- Daily routine

Every question should help you understand the user's lifestyle.

## Language Rules
- Use very simple English
- Use words that almost everyone can understand
- Avoid medical terms
- Avoid difficult vocabulary
- Keep each question short
- One sentence only

Example:
Good: "How many meals do you usually eat in a day?"
Bad: "How frequently do you consume nutritionally balanced meals?"

Good: "How much water do you drink in a day?"
Bad: "Estimate your average daily hydration volume."

## Option Generation Rules

Do not use the same generic options for every question.

Avoid repeating options like:
- Never
- Sometimes
- Regularly
- Weekly Once
- Daily

Instead, generate options that are specific to the question and feel natural.

Every question should have its own unique answer choices.

The options should help understand the user's real habits, not just frequency.

For example:

Question:
"How do you usually start your morning?"

Good options:
- I eat a full breakfast.
- I have something light like fruit or milk.
- I only drink tea or coffee.
- I usually skip breakfast.
- Other

Question:
"When do you usually drink the most water?"

Good options:
- Mostly in the morning.
- During work or college.
- After exercise or outdoor activities.
- I don't really pay attention.
- Other

Question:
"What best describes your lunch on most days?"

Good options:
- Home-cooked and balanced.
- Mostly packed food.
- I eat outside most days.
- I often skip lunch.
- Other

Question:
"How do you usually feel before dinner?"

Good options:
- Hungry and ready to eat.
- A little hungry.
- Still full from earlier.
- It changes every day.
- Other

Rules:
- Every question must have different options.
- Options must match the question.
- Options should feel like real-life situations.
- Keep the language simple and friendly.
- Avoid repeating the same option pattern across different questions.
- Always include "Other" as the last option.

## Important Rules
- Do not ask random questions
- Do not ask general knowledge questions
- Do not ask medical diagnosis questions
- Do not ask personal or sensitive questions
- CRITICAL: Never repeat any question from this assessment OR from past assessments
- CRITICAL: Never rephrase a previous question — even if the wording is different, if it asks about the same thing, it counts as a repeat
- Use previous answers to generate the next question
- Every next question must cover a NEW topic not yet explored
- If all common topics are covered, ask a follow-up to dig deeper on something already answered

## Goal
After 5 to 10 questions, you should have enough information to estimate:
- Eating habits
- Nutrition quality
- Lifestyle quality
- Daily calorie needs
- Protein needs
- Carbohydrate needs
- Fat needs
- Water needs
- Health strengths
- Areas to improve
- Personalized recommendations
- Fuel Box meal recommendations

Remember: You are analyzing the user's health habits. You are NOT testing the user's knowledge.

Format your response as valid JSON:
{
  "question": "Your simple question here?",
  "topic": "topic_name",
  "options": ["Option 1", "Option 2", "Option 3", "Other"]
}
`;

  const systemPrompt = `You are an AI Health Assessment Assistant for Fuel Box. You analyze users by asking about their daily habits, not by testing their nutrition knowledge. Always respond with valid JSON. Use very simple English. Always include exactly 4 options with "Other" as the last option. NEVER repeat a question or rephrase one — check the full history of questions asked across all assessments. Each new question must be genuinely different from everything previously asked.`;

  const response = await callAI(prompt, systemPrompt, 800);

  if (!response) return null;

  try {
    const parsed = safeParseJSON(response);
    if (!parsed) return null;
    let options = parsed.options || [];
    // Ensure "Other" is always the last option
    const otherIndex = options.findIndex((o: string) => o.toLowerCase() === "other");
    if (otherIndex >= 0) {
      const [other] = options.splice(otherIndex, 1);
      options = options.slice(0, 3);
      options.push(other);
    } else {
      options = options.slice(0, 3);
      options.push("Other");
    }
    return {
      question: parsed.question,
      topic: parsed.topic || "general",
      options,
      done: false,
      rationale: "ai-generated",
    };
  } catch (error) {
    console.error("Failed to parse AI question response:", error);
    return null;
  }
}

/**
 * Generate personalized recommendations using AI
 * Purely AI-generated based on user profile and specific answers
 */
export async function generateAIRecommendations(args: {
  profile: Profile;
  quizAnswers: QuizAnswer[];
  assessments: Assessment[];
}): Promise<Partial<ReportPayload> | null> {
  const { profile, quizAnswers } = args;

  const answersContext = quizAnswers
    .map((a) => `${a.topic}: ${a.answer}`)
    .join("\n");

  const menuContext = FUEL_BOX_MENU.map(
    (item: any) => `- ${item.name} (${item.category}): ${item.calories}cal, ${item.protein}g protein, ${item.carbs}g carbs, ${item.fat}g fat — tags: ${item.tags.join(", ")}`
  ).join("\n");

  const prompt = `
User Profile: 
- Age: ${profile.age} years
- Gender: ${profile.gender}
- Goal: ${profile.goal}
- Activity Level: ${profile.activityLevel}
- Height: ${profile.heightCm}cm
- Weight: ${profile.weightKg}kg
- Diet Type: ${profile.dietType || "Not specified"}

Quiz Answers:
${answersContext}

## Available Fuel Box Menu Items
You MUST ONLY recommend from the following Fuel Box menu items. Pick the best match for this user's needs, goals, and answers.

${menuContext}

Generate a COMPLETELY PERSONALIZED health and nutrition report for this specific person. 

Requirements:
1. ALL recommendations must be specific to THEIR answers and profile stats, not generic.
2. ALL tips must reference their actual situation (e.g., if they answered "low energy", recommend energy-boosting tips).
3. Meal recommendations MUST use ONLY the Fuel Box menu items listed above. Pick real items from the menu, not generic foods.
4. If their Diet Type is "vegetarian" or "vegan", you MUST ONLY recommend vegetarian/vegan items (no chicken, eggs, etc.).
5. Quick wins must be achievable based on their current state.
6. For breakfast, pick from items tagged "breakfast" category.
7. For lunch, pick from items tagged "lunch" category.
8. For dinner, pick from items tagged "dinner" category.
9. For snacks, pick from items tagged "snack" category.
10. Calculate daily targets (calories, protein, carbs, fat, water) strictly based on the user's personal profile (age, gender, height, weight, fitness goal, activity level) and their quiz answers. Ensure these targets reflect their actual physical stats (e.g., heavier/active users require higher targets, while weight loss goals require a calorie deficit).

Return valid JSON:
{
  "healthStage": "One of: Thriving, Doing Well, Room to Grow, Needs Support",
  "nutritionScore": 0-100,
  "confidenceScore": 0-100,
  "fuelBoxReadinessScore": 0-100,
  "summary": "2-3 sentences personalized to THIS person's specific situation",
  "strengths": ["their actual strength 1", "their actual strength 2"],
  "improvementAreas": ["their specific area 1", "their specific area 2"],
  "priorityFocus": ["their actual priority 1", "their actual priority 2"],
  "quickWins": ["specific actionable tip for them"],
  "recommendations": ["personalized rec 1 based on their answers", "personalized rec 2"],
  "recommendedPlan": "A plan name specific to their goals and current state",
  "dailyTargets": {
    "calories": 2100,
    "protein": 105,
    "carbs": 250,
    "fat": 65,
    "water": 2500
  },
  "recommendedMeals": {
    "breakfast": [{"name": "item from Fuel Box menu", "why": "why it helps their situation"}],
    "lunch": [{"name": "item from Fuel Box menu", "why": "why it helps"}],
    "dinner": [{"name": "item from Fuel Box menu", "why": "why it helps"}],
    "snacks": [{"name": "item from Fuel Box menu", "why": "why it helps"}]
  }
}

DO NOT use generic phrases. EVERY recommendation must be tied to their specific answers and profile.
DO NOT invent meal names — only use the Fuel Box menu items listed above.
Make it feel like a personal health coach wrote this for them specifically.
Base the daily targets on their personal profile — taller, heavier, more active people need more calories and protein.
`;

  const systemPrompt = `You are an expert nutritionist and health coach AI creating a personalized health assessment. 
Each recommendation MUST be specific to the user's actual answers and profile (specifically considering age, gender, height, weight, goal, and diet type) - NOT generic templates.
If the user's diet type is vegetarian or vegan, you MUST ONLY recommend meals that match this diet type.
Calculate the daily targets in 'dailyTargets' specifically using the user's physical parameters (age, height, weight, gender, goal) so that they are fully customized for them.
You MUST ONLY recommend dishes from the Fuel Box menu provided — never invent meal names.
Generate recommendations that feel personal and tailored to their unique situation.
Always use the user's specific context in your recommendations.`;

  const response = await callAI(prompt, systemPrompt, 2500);

  if (!response) return null;

  try {
    const parsed = safeParseJSON(response);
    if (!parsed) return null;
    return {
      healthStage: parsed.healthStage || "Doing Well",
      nutritionScore: parsed.nutritionScore || 60,
      confidenceScore: parsed.confidenceScore || 70,
      fuelBoxReadinessScore: parsed.fuelBoxReadinessScore || 65,
      summary: parsed.summary || "Based on your responses, here's your personalized nutrition assessment.",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvementAreas: Array.isArray(parsed.improvementAreas) ? parsed.improvementAreas : [],
      priorityFocus: Array.isArray(parsed.priorityFocus) ? parsed.priorityFocus : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      recommendedPlan: parsed.recommendedPlan || "Personalized Wellness Plan",
      dailyTargets: parsed.dailyTargets || undefined,
      recommendedMeals: parsed.recommendedMeals || {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
      },
    };
  } catch (error) {
    console.error("Failed to parse AI recommendations response:", error);
    return null;
  }
}

/**
 * Analyze if a specific menu item is good for the user
 * Real-time AI analysis based on their profile
 */
export async function analyzeMenuItemAI(args: {
  profile: Profile;
  foodItem: {
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    tags: string[];
  };
  latestAssessment?: any;
  todayConsumption?: { calories: number; protein: number; carbs: number; fat: number };
}): Promise<{
  isRecommended: "yes" | "maybe" | "no";
  score: number;
  reason: string;
  tips: string[];
} | null> {
  const { profile, foodItem, latestAssessment, todayConsumption } = args;

  const prompt = `
Person:
- Age: ${profile.age}, ${profile.gender}
- Want to: ${profile.goal}
- Active: ${profile.activityLevel}

Health:
- How they feel: ${latestAssessment?.healthStage || "Good"}
- Strong in: ${latestAssessment?.strengths?.join(", ") || "Overall health"}
- Need help with: ${latestAssessment?.improvementAreas?.join(", ") || "Balanced eating"}

Today they ate:
- Calories: ${todayConsumption?.calories || 0}
- Protein: ${todayConsumption?.protein || 0}g
- Carbs: ${todayConsumption?.carbs || 0}g
- Fat: ${todayConsumption?.fat || 0}g

Food to check:
- ${foodItem.name}
- Calories: ${foodItem.calories}
- Protein: ${foodItem.protein}g
- Carbs: ${foodItem.carbs}g
- Fat: ${foodItem.fat}g
- Fiber: ${foodItem.fiber}g

Is this food good for them today? Answer YES, MAYBE, or NO.

Return simple JSON:
{
  "isRecommended": "yes|maybe|no",
  "score": number 0-100,
  "reason": "One simple sentence why yes or no",
  "tips": ["One simple tip"]
}

Keep it simple and honest.
`;

  const systemPrompt = `You are a simple nutrition helper. Check if this food is good for this person today.
Be very simple and easy to understand. Use plain words.
Give honest yes, maybe, or no answers.`;

  const response = await callAI(prompt, systemPrompt, 800);

  if (!response) return null;

  try {
    const parsed = safeParseJSON(response);
    if (!parsed) return null;
    return {
      isRecommended: parsed.isRecommended || "maybe",
      score: parsed.score || 50,
      reason: parsed.reason || "Based on your profile and today's intake",
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    };
  } catch (error) {
    console.error("Failed to parse menu analysis response:", error);
    return null;
  }
}

/**
 * Generate daily personalized AI tips
 * Called daily to give fresh, personalized recommendations
 */
export async function generateAIDailyTips(args: {
  profile: Profile;
  latestAssessment: any;
  todayTotals?: { calories: number; protein: number; carbs: number; fat: number; water: number };
  recentMeals?: string[];
}): Promise<{
  focus: string;
  tips: string[];
  pickBreakfast?: string;
  pickLunch?: string;
  pickDinner?: string;
  pickSnack?: string;
  rationale?: string;
} | null> {
  const { profile, latestAssessment, todayTotals, recentMeals } = args;

  const MENU_BREAKFAST = ["Egg", "Papaya", "Banana", "Regular Banana", "Nendran Banana", "Red Banana", "Rasthali Banana", "Poovan Banana"];
  const MENU_LUNCH = ["Chicken Breast (cooked)", "White Rice (cooked)", "Chickpeas (cooked)", "Sweet Potato (boiled)", "Chapati (whole wheat)", "Channa with Onions (cooked)", "Black Channa (cooked)", "White Channa (cooked)", "Cabbage (raw)", "Purple Cabbage (raw)", "Lettuce (raw)", "Carrot (raw)", "Onion (raw)", "Beetroot", "Broccoli (cooked)", "Green Beans (cooked)"];
  const MENU_DINNER = ["Paneer", "Chapati (whole wheat)", "Soya", "Broccoli (cooked)", "Green Beans (cooked)"];
  const MENU_SNACK = ["Banana", "Carrot (raw)", "Cucumber (raw)", "Apple (with skin)", "Orange", "Mango", "Pomegranate", "Guava", "Papaya", "Watermelon", "Grapes", "Strawberry", "Cherry", "Dragon Fruit", "Peanut", "Paneer Cheese Dressing"];

  const prompt = `
You are a personal nutrition coach for The Fuel Box — a healthy meal delivery service in Tamil Nadu, India.

User Profile:
- Age: ${profile.age} years, ${profile.gender}, Goal: ${profile.goal}
- Activity Level: ${profile.activityLevel}

Latest Health Assessment:
- Health Stage: ${latestAssessment?.healthStage || "Unknown"}
- Priority Focus: ${latestAssessment?.priorityFocus?.join(", ") || "Balanced wellness"}
- Strengths: ${latestAssessment?.strengths?.join(", ") || "Good health habits"}

Today's Nutrition So Far:
- Calories: ${todayTotals?.calories || 0} kcal
- Protein: ${todayTotals?.protein || 0}g
- Carbs: ${todayTotals?.carbs || 0}g
- Fat: ${todayTotals?.fat || 0}g
- Water: ${todayTotals?.water || 0}ml

${recentMeals && recentMeals.length > 0 ? `Recent Meals:\n${recentMeals.map(m => `- ${m}`).join('\n')}` : ""}

=== THE FUEL BOX MENU ===
BREAKFAST items available: ${MENU_BREAKFAST.join(", ")}
LUNCH items available: ${MENU_LUNCH.join(", ")}
DINNER items available: ${MENU_DINNER.join(", ")}
SNACK items available: ${MENU_SNACK.join(", ")}

RULES FOR SMART PICKS:
1. You MUST only choose from the menu items listed above.
2. Use the EXACT item name as it appears in the menu — do not shorten, modify, or invent names.
3. Choose the best item for this person's goal and what they've already eaten today.
4. Do NOT suggest generic foods like "grilled chicken" or "salad" — only exact menu names.

Generate ONE specific focus and 3 actionable tips for TODAY for this person.

Return JSON:
{
  "focus": "One specific focus area for today based on their profile",
  "tips": ["tip 1 specific for them", "tip 2 specific for them", "tip 3 specific for them"],
  "pickBreakfast": "exact name from BREAKFAST menu",
  "pickLunch": "exact name from LUNCH menu",
  "pickDinner": "exact name from DINNER menu",
  "pickSnack": "exact name from SNACK menu"
}
`;

  const systemPrompt = `You are a personal nutrition coach for The Fuel Box, a healthy meal service in Tamil Nadu. 
You must ONLY recommend items from the exact menu list provided — use the exact item name, no modifications.
Return valid JSON only, no extra text.`;

  const response = await callAI(prompt, systemPrompt, 500);

  if (!response) return null;

  try {
    const parsed = safeParseJSON(response);
    if (!parsed) return null;
    return {
      focus: parsed.focus || "Build healthy habits today",
      tips: Array.isArray(parsed.tips)
        ? parsed.tips.slice(0, 4)
        : ["Start your day with water", "Eat balanced meals", "Stay consistent"],
      pickBreakfast: parsed.pickBreakfast,
      pickLunch: parsed.pickLunch,
      pickDinner: parsed.pickDinner,
      pickSnack: parsed.pickSnack,
      rationale: "ai-generated",
    };
  } catch (error) {
    console.error("Failed to parse AI daily tips response:", error);
    return null;
  }
}

/**
 * Cart Suitability Analysis — scores cart items against user profile + targets
 * Uses AI when available, falls back to local math engine
 */
export interface CartSuitabilityResult {
  score: number; // 0-100
  grade: "Excellent" | "Good" | "Fair" | "Poor";
  strengths: string[];
  warnings: string[];
  recommendations: string[];
  macroBreakdown: {
    calories: { total: number; target: number; pct: number };
    protein: { total: number; target: number; pct: number };
    carbs: { total: number; target: number; pct: number };
    fat: { total: number; target: number; pct: number };
    fiber: { total: number; target: number; pct: number };
  };
  itemTags: Record<string, string[]>; // menuItemId → tags like "Protein Rich"
}

interface CartItemInput {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: string;
  diet: string;
}

/**
 * Local math-based fallback scoring engine
 */
function localCartAnalysis(
  items: CartItemInput[],
  userProfile: { age: number; gender: string; goal: string; heightCm: number; weightKg: number; dietType?: string; healthIssues?: string },
  targets: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }
): CartSuitabilityResult {
  // Sum cart totals
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories * item.quantity,
      protein: acc.protein + item.protein * item.quantity,
      carbs: acc.carbs + item.carbs * item.quantity,
      fat: acc.fat + item.fat * item.quantity,
      fiber: acc.fiber + item.fiber * item.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const fiberTarget = targets.fiber || 25;

  const macroBreakdown = {
    calories: { total: totals.calories, target: targets.calories, pct: Math.round((totals.calories / targets.calories) * 100) },
    protein: { total: totals.protein, target: targets.protein, pct: Math.round((totals.protein / targets.protein) * 100) },
    carbs: { total: totals.carbs, target: targets.carbs, pct: Math.round((totals.carbs / targets.carbs) * 100) },
    fat: { total: totals.fat, target: targets.fat, pct: Math.round((totals.fat / targets.fat) * 100) },
    fiber: { total: totals.fiber, target: fiberTarget, pct: Math.round((totals.fiber / fiberTarget) * 100) },
  };

  // Pre-meal target = Daily Target / 3
  const mealTargets = {
    calories: targets.calories / 3,
    protein: targets.protein / 3,
    carbs: targets.carbs / 3,
    fat: targets.fat / 3,
    fiber: fiberTarget / 3,
  };

  // Compute individual nutrient scores relative to per-meal targets
  // Calories score: penalize deviation
  const calDiff = Math.abs(totals.calories - mealTargets.calories);
  const calScore = Math.max(0, 100 - (calDiff / mealTargets.calories) * 100);

  // Protein score: progress toward target (capped at 100)
  const proScore = Math.min(100, (totals.protein / mealTargets.protein) * 100);

  // Carb score: penalize deviation
  const carbDiff = Math.abs(totals.carbs - mealTargets.carbs);
  const carbScore = Math.max(0, 100 - (carbDiff / mealTargets.carbs) * 100);

  // Fat score: penalize deviation
  const fatDiff = Math.abs(totals.fat - mealTargets.fat);
  const fatScore = Math.max(0, 100 - (fatDiff / mealTargets.fat) * 100);

  // Fiber score: progress toward target
  const fibScore = Math.min(100, (totals.fiber / mealTargets.fiber) * 100);

  // Combine scores using weights:
  // Protein: 35%, Calories: 25%, Fiber: 15%, Carbs: 12.5%, Fat: 12.5%
  let score = (
    proScore * 0.35 +
    calScore * 0.25 +
    fibScore * 0.15 +
    carbScore * 0.125 +
    fatScore * 0.125
  );

  // Diet compatibility penalty
  let dietPenalty = 0;
  const userDiet = userProfile.dietType?.toLowerCase() || "";
  const hasNonVeg = items.some(i => i.diet === "non_veg");
  if ((userDiet === "vegetarian" || userDiet === "vegan") && hasNonVeg) {
    dietPenalty += 30;
  }
  if (userDiet === "vegan" && items.some(i => i.name.toLowerCase().includes("paneer") || i.name.toLowerCase().includes("egg"))) {
    dietPenalty += 20;
  }

  score = Math.max(0, score - dietPenalty);
  score = Math.round(score);

  const strengths: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Generate math-based strengths, warnings, and recommendations
  if (proScore >= 90) {
    strengths.push(`Excellent protein: Met ${(totals.protein).toFixed(0)}g (Target: ${mealTargets.protein.toFixed(0)}g).`);
  } else if (proScore < 60) {
    warnings.push(`Low protein: ordered ${(totals.protein).toFixed(0)}g is below target (${mealTargets.protein.toFixed(0)}g).`);
    recommendations.push("Add high-protein items like chicken or paneer to hit your meal goal.");
  }

  if (calScore >= 80) {
    strengths.push(`Perfect energy balance: ${totals.calories.toFixed(0)} kcal matches your per-meal goal.`);
  } else {
    if (totals.calories < mealTargets.calories) {
      recommendations.push("This meal is light. Add healthy snacks if you feel hungry.");
    } else {
      warnings.push(`High calories: ${totals.calories.toFixed(0)} kcal exceeds per-meal target (${mealTargets.calories.toFixed(0)} kcal).`);
    }
  }

  if (fibScore >= 80) {
    strengths.push(`Healthy fiber level: ${totals.fiber.toFixed(0)}g supports digestion.`);
  } else if (fibScore < 50) {
    recommendations.push("Include high-fiber sides or salads to improve digestion.");
  }

  if (dietPenalty > 0) {
    warnings.push("⚠️ Diet mismatch: Order contains items conflicting with your diet preference.");
  }

  // Item-level tags
  const itemTags: Record<string, string[]> = {};
  for (const item of items) {
    const tags: string[] = [];
    if (item.protein >= 15) tags.push("Protein Rich");
    if (item.calories <= 100) tags.push("Low Calorie");
    if (item.fat <= 3) tags.push("Low Fat");
    if (item.fiber >= 5) tags.push("High Fiber");
    if (item.carbs <= 10) tags.push("Low Carb");
    if (item.protein >= 20 && item.fat <= 5) tags.push("Lean Protein");
    if (item.calories >= 250) tags.push("Energy Dense");
    itemTags[item.id] = tags;
  }

  const grade: CartSuitabilityResult["grade"] =
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";

  if (recommendations.length === 0 && score >= 70) {
    recommendations.push("Your meal selection looks balanced against your meal target.");
  }

  return { score, grade, strengths, warnings, recommendations, macroBreakdown, itemTags };
}

export async function analyzeCartSuitabilityAI(args: {
  items: CartItemInput[];
  userProfile: { age: number; gender: string; goal: string; heightCm: number; weightKg: number; dietType?: string; healthIssues?: string };
  targets: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
}): Promise<CartSuitabilityResult> {
  const { items, userProfile, targets } = args;

  // Calculate the score entirely using predefined business logic
  const local = localCartAnalysis(items, userProfile, targets);

  if (!OPENROUTER_API_KEY) return local;

  const cartSummary = items.map(i => `- ${i.name} x${i.quantity}: ${i.calories * i.quantity}cal, ${i.protein * i.quantity}g protein, ${i.carbs * i.quantity}g carbs, ${i.fat * i.quantity}g fat, ${i.fiber * i.quantity}g fiber (${i.diet})`).join("\n");

  const prompt = `
You are the AI nutrition analyst for FuelBox.
A user has placed a meal order. We have mathematically calculated a suitability score for this order using predefined business logic.

Calculated Suitability Score: ${local.score}% (Grade: ${local.grade})

Rules for your response:
1. Do not calculate or influence any numeric score. Respect the pre-calculated score of ${local.score}% completely.
2. Your responsibility is to explain these calculated results, highlight strengths and weaknesses of the meals, provide personalized nutrition recommendations, and suggest improvements.
3. Never assume the user has skipped other meals or that this FuelBox order represents their entire daily diet. This is a single/partial meal order.
4. Base your analysis on the quality of food choices, nutrient balance, meal diversity, and consistency within the available data.

User Profile:
- Age: ${userProfile.age}, Gender: ${userProfile.gender}
- Goal: ${userProfile.goal}
- Height: ${userProfile.heightCm}cm, Weight: ${userProfile.weightKg}kg
- Diet: ${userProfile.dietType || "Not specified"}
- Health Issues: ${userProfile.healthIssues || "None"}

Daily Targets:
- Calories: ${targets.calories}, Protein: ${targets.protein}g, Carbs: ${targets.carbs}g, Fat: ${targets.fat}g

Cart Items:
${cartSummary}

Totals: ${local.macroBreakdown.calories.total}cal, ${local.macroBreakdown.protein.total}g protein, ${local.macroBreakdown.carbs.total}g carbs, ${local.macroBreakdown.fat.total}g fat

Explain this score and provide user feedback.

Return JSON:
{
  "strengths": ["specific strength 1", "specific strength 2"],
  "warnings": ["specific warning if any"],
  "recommendations": ["actionable tip 1", "actionable tip 2"]
}

Be specific, concise, and reference actual numbers. Max 3 items per array.
`;

  const systemPrompt = "You are the AI nutrition analyst for FuelBox. Be honest, specific, and concise. Always return valid JSON.";

  try {
    const response = await callAI(prompt, systemPrompt, 800);
    const parsed = safeParseJSON(response);
    if (!parsed) return local;
    return {
      score: local.score,
      grade: local.grade,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : local.strengths,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : local.warnings,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : local.recommendations,
      macroBreakdown: local.macroBreakdown,
      itemTags: local.itemTags,
    };
  } catch {
    return local;
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return !!OPENROUTER_API_KEY;
}
