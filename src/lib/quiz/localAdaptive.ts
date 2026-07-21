import type { QuizAnswer, Assessment } from "../storage";
import type { Profile } from "../profile";
import { defaultDailyTargets } from "../profile";
import type { QuestionPayload, ReportPayload } from "./schemas";
import { generateAIQuestion, generateAIRecommendations, isAIAvailable } from "../ai-service";
import { getMenuRecommendations } from "./menuRecommendations";

const MAX_QUIZ_QUESTIONS = 10; // Generate 5-10 questions per assessment

/**
 * AI-driven quiz system - generates conversational questions and recommendations
 * Uses mock implementation for now, can be swapped for real OpenAI/Claude API
 */

// ============================================================================
// PUBLIC API: AI-Driven Functions
// ============================================================================

/**
 * Generate next quiz question using AI
 * AI adaptively asks follow-up questions based on previous answers
 * Falls back to mock questions if AI is unavailable
 */
export async function aiNextQuestion(args: {
  profile: Profile;
  currentAnswers: QuizAnswer[];
  previousAssessments: Assessment[];
  likedFoodIds?: string[];
}): Promise<QuestionPayload> {
  const { currentAnswers } = args;

  // Stop if we've asked enough questions
  if (currentAnswers.length >= MAX_QUIZ_QUESTIONS) {
    return { done: true, topic: "general" };
  }

  // Try real AI first
  if (isAIAvailable()) {
    try {
      const aiQuestion = await generateAIQuestion(args);
      if (aiQuestion) {
        console.log("✔ Using AI-generated question");
        return aiQuestion;
      }
    } catch (error) {
      console.warn("AI question generation failed, using mock:", error);
    }
  } else {
    console.log("AI not available, using mock questions");
  }

  // Fallback to mock questions
  return getMockQuestion(currentAnswers);
}

/**
 * Generate AI-powered personalized recommendations based on quiz answers
 * Uses real AI API, falls back to mock data if unavailable
 */
export async function aiGenerateRecommendations(args: {
  profile: Profile;
  quizAnswers: QuizAnswer[];
  assessments: Assessment[];
}): Promise<Partial<ReportPayload>> {
  // Try real AI first
  if (isAIAvailable()) {
    try {
      const aiRecs = await generateAIRecommendations(args);
      if (aiRecs) {
        console.log("✔ Using AI-generated recommendations");
        return aiRecs;
      }
    } catch (error) {
      console.warn("AI recommendations generation failed, using mock:", error);
    }
  } else {
    console.log("AI not available, using mock recommendations");
  }

  // Fallback to mock recommendations using actual menu items
  return getMockRecommendations(args.quizAnswers, args.profile);
}

// ============================================================================
// BACKWARD COMPATIBILITY: Wrapper functions for existing API layer
// ============================================================================

/**
 * Legacy function name - wraps aiNextQuestion for backward compatibility
 */
export async function localNextQuestion(args: {
  profile: Profile;
  currentAnswers: QuizAnswer[];
  previousAssessments: Assessment[];
  likedFoodIds?: string[];
}): Promise<QuestionPayload> {
  return aiNextQuestion(args);
}

/**
 * Legacy function name - wraps aiGenerateRecommendations for backward compatibility
 */
export async function localGenerateReport(args: {
  profile: Profile;
  answers: QuizAnswer[];
  previousAssessments: Assessment[];
}): Promise<ReportPayload> {
  const result = await aiGenerateRecommendations({
    profile: args.profile,
    quizAnswers: args.answers,
    assessments: args.previousAssessments,
  });
  
  return {
    healthStage: result.healthStage || "Doing Well",
    nutritionScore: result.nutritionScore || 60,
    confidenceScore: result.confidenceScore || 70,
    fuelBoxReadinessScore: result.fuelBoxReadinessScore || 65,
    summary: result.summary || "Personalized health assessment",
    strengths: result.strengths || [],
    improvementAreas: result.improvementAreas || [],
    priorityFocus: result.priorityFocus || [],
    quickWins: result.quickWins || [],
    recommendations: result.recommendations || [],
    dailyTargets: result.dailyTargets || defaultDailyTargets(args.profile),
    recommendedPlan: result.recommendedPlan || "Balanced Wellness Plan",
    recommendedMeals: result.recommendedMeals || {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    },
  };
}

// ============================================================================
// MOCK FALLBACK FUNCTIONS: Used when AI is unavailable
// ============================================================================

/**
 * Get mock question when AI is unavailable
 * Follows the same rules: unique, no repeats, 4-6 options, "Other" last, topic rotation
 */
function getMockQuestion(currentAnswers: QuizAnswer[]): QuestionPayload {
  const coveredTopics = new Set(currentAnswers.map((a) => a.topic));
  const prevQuestions = new Set(currentAnswers.map((a) => a.question));

  const allTopics = [
    "meal_timing", "meal_consistency", "breakfast_habits", "snacking_habits",
    "protein_intake", "vegetable_intake", "fruit_intake", "water_intake",
    "sleep_quality", "recovery", "energy_levels", "hunger_patterns",
    "cooking_habits", "eating_outside", "stress_eating", "weekend_habits",
    "portion_awareness", "food_variety", "activity_recovery", "nutrition_awareness",
  ];

  const uncoveredTopics = allTopics.filter((t) => !coveredTopics.has(t));

  const mockQuestions: Record<string, QuestionPayload> = {
    meal_timing: {
      question: "What times of day do you usually eat your main meals?",
      topic: "meal_timing",
      options: ["Early morning and early evening", "Mid-morning and late evening", "I eat whenever I feel hungry", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    meal_consistency: {
      question: "How consistent are your meal portions from day to day?",
      topic: "meal_consistency",
      options: ["Very consistent — I eat similar amounts daily", "Fairly consistent, with small variations", "Somewhat inconsistent — it depends on my schedule", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    breakfast_habits: {
      question: "How often do you eat breakfast, and what does it usually look like?",
      topic: "breakfast_habits",
      options: ["Every day — a full meal", "Most days — something light", "A few times a week", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    snacking_habits: {
      question: "What best describes your snacking habits?",
      topic: "snacking_habits",
      options: ["I rarely snack between meals", "I have one planned snack daily", "I snack 2-3 times a day", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    protein_intake: {
      question: "How would you describe your protein intake throughout the day?",
      topic: "protein_intake",
      options: ["I include protein in every meal", "I have protein at 1-2 meals", "I mostly get protein from one main meal", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    vegetable_intake: {
      question: "How many servings of vegetables do you typically eat in a day?",
      topic: "vegetable_intake",
      options: ["0-1 servings", "2 servings", "3-4 servings", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    fruit_intake: {
      question: "How often do you eat fruit?",
      topic: "fruit_intake",
      options: ["Multiple times a day", "Once a day", "A few times a week", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    water_intake: {
      question: "How much water do you drink on an average day?",
      topic: "water_intake",
      options: ["Less than 2 glasses", "2-4 glasses", "5-7 glasses", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    sleep_quality: {
      question: "How would you describe your sleep quality over the past week?",
      topic: "sleep_quality",
      options: ["Restful — I wake up feeling refreshed", "Mostly good — occasional restless nights", "Fair — I wake up once or twice", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    recovery: {
      question: "How well do you feel your body recovers after physical activity or a long day?",
      topic: "recovery",
      options: ["I bounce back quickly", "I feel fine the next day", "It takes me a couple of days", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    energy_levels: {
      question: "How would you describe your energy levels throughout a typical day?",
      topic: "energy_levels",
      options: ["High and steady all day", "Peak in the morning, dip after lunch", "Slow start, peak later in the day", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    hunger_patterns: {
      question: "What best describes your hunger patterns during the day?",
      topic: "hunger_patterns",
      options: ["I get hungry at predictable meal times", "I feel hungry often between meals", "I rarely feel hungry", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    cooking_habits: {
      question: "How often do you cook meals at home?",
      topic: "cooking_habits",
      options: ["Daily — I cook most meals", "4-5 times a week", "2-3 times a week", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    eating_outside: {
      question: "How often do you eat out or order takeaway in a typical week?",
      topic: "eating_outside",
      options: ["0-1 times", "2-3 times", "4-5 times", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    stress_eating: {
      question: "When you're stressed, how does it affect your eating?",
      topic: "stress_eating",
      options: ["I eat more than usual", "I eat less than usual", "I crave specific foods (sweet, salty, etc.)", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    weekend_habits: {
      question: "How do your eating habits differ on weekends compared to weekdays?",
      topic: "weekend_habits",
      options: ["Pretty much the same", "I eat out or indulge more", "I eat lighter on weekends", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    portion_awareness: {
      question: "How aware are you of your portion sizes when eating?",
      topic: "portion_awareness",
      options: ["I measure or weigh portions", "I eyeball portions", "I eat until I'm full regardless", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    food_variety: {
      question: "How varied is your diet from week to week?",
      topic: "food_variety",
      options: ["Very varied — I eat different foods daily", "Somewhat varied — I rotate a few meals", "I eat the same meals regularly", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    activity_recovery: {
      question: "How do you support your body's recovery after exercise?",
      topic: "activity_recovery",
      options: ["I focus on protein and rest", "I stretch and hydrate well", "I just rest", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
    nutrition_awareness: {
      question: "How would you rate your understanding of nutrition and healthy eating?",
      topic: "nutrition_awareness",
      options: ["Very knowledgeable", "I know the basics", "I'm still learning", "Other"],
      rationale: "mock-fallback",
      done: false,
    },
  };

  // Pick next uncovered topic, avoiding repeat of last topic
  const lastTopic = currentAnswers.length > 0 ? currentAnswers[currentAnswers.length - 1].topic : null;
  let nextTopic: string;

  if (uncoveredTopics.length > 0) {
    // Pick first uncovered topic that's different from last topic
    const differentUncovered = lastTopic ? uncoveredTopics.filter((t) => t !== lastTopic) : uncoveredTopics;
    nextTopic = differentUncovered.length > 0 ? differentUncovered[0] : uncoveredTopics[0];
  } else {
    // All topics covered, cycle with anti-repetition check
    const available = allTopics.filter((t) => t !== lastTopic);
    nextTopic = available[currentAnswers.length % available.length];
  }

  return mockQuestions[nextTopic] || mockQuestions.meal_consistency;
}

/**
 * Get mock recommendations when AI is unavailable
 */
function getMockRecommendations(quizAnswers: QuizAnswer[], profile: Profile): Partial<ReportPayload> {
  const answerTopics = quizAnswers.reduce<Record<string, string[]>>((acc, answer) => {
    const topic = answer.topic || "general";
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(answer.answer);
    return acc;
  }, {});

  // Use actual Fuel Box menu items for recommendations
  const menuRecs = getMenuRecommendations(quizAnswers, profile);

  return {
    healthStage: determineHealthStage(answerTopics),
    nutritionScore: calculateScore(Object.values(answerTopics).flat()),
    confidenceScore: 75,
    fuelBoxReadinessScore: calculateScore(Object.values(answerTopics).flat()),
    summary: generateAISummary(profile, answerTopics),
    strengths: generateStrengths(profile, answerTopics),
    improvementAreas: generateImprovements(profile, answerTopics),
    priorityFocus: getPriorityFocus(profile, answerTopics),
    quickWins: getQuickWins(profile, answerTopics),
    recommendations: getRecommendations(profile, answerTopics),
    recommendedPlan: selectRecommendedPlan(answerTopics),
    recommendedMeals: menuRecs,
  };
}

// ============================================================================
// ============================================================================

function determineHealthStage(answerTopics: Record<string, string[]>): string {
  const avgScore = calculateScore(Object.values(answerTopics).flat());
  if (avgScore >= 80) return "Thriving";
  if (avgScore >= 60) return "Doing Well";
  if (avgScore >= 40) return "Room to Grow";
  return "Needs Support";
}

function calculateScore(answers: string[]): number {
  if (answers.length === 0) return 50;
  const scores: Record<string, number> = {
    "Excellent": 90,
    "Good": 75,
    "Steady moderate": 70,
    "Generally calm": 70,
    "Mostly good": 75,
    "High consistent energy": 85,
    "Excellent digestion": 85,
    "No known allergies": 80,
    "Consistent schedule, 3 meals + snacks": 80,
    "Very calm and centered": 90,
    "Active, regular intense exercise": 85,
    "Fair, sometimes restless": 50,
    "Frequently stressed but managing": 55,
    "Light activity, occasional exercise": 50,
    "Sometimes problematic": 45,
    "Energy dips and spikes": 50,
    "Some sensitivities to certain foods": 60,
    "Somewhat regular, 2-3 meals a day": 60,
    "Generally stressed": 40,
    "Sedentary, little movement": 30,
    "Frequent issues": 35,
    "Consistently low energy": 30,
    "Yes, I have allergies": 50,
    "Very irregular, I skip meals": 20,
    "Overwhelmed most days": 20,
    "Poor, often tired": 25,
  };

  const total = answers.reduce((sum, ans) => {
    return sum + (scores[ans] || 50);
  }, 0);

  return Math.round(total / answers.length);
}

function generateAISummary(profile: Profile, answerTopics: Record<string, string[]>): string {
  const stage = determineHealthStage(answerTopics);
  let text = `Hi ${profile.name || "Friend"}, based on your answers, you are currently at the "${stage}" stage in your wellness journey. `;
  
  if (profile.goal === "lose") {
    text += `Your main target is healthy weight loss. We will structure your daily target to be in a safe, sustainable calorie deficit while keeping protein high to preserve muscle mass. `;
  } else if (profile.goal === "gain") {
    text += `Your main target is muscle gain and strength. We will focus on a moderate calorie surplus and high-quality protein to support recovery and muscle protein synthesis. `;
  } else {
    text += `Your main target is general health and maintenance. We will focus on nutrient density, portion consistency, and overall metabolic health. `;
  }

  if (profile.healthIssues) {
    text += `We have customized your meal selections and daily advice to support managing: ${profile.healthIssues}.`;
  }
  
  return text;
}

function generateStrengths(profile: Profile, answerTopics: Record<string, string[]>): string[] {
  const strengths: string[] = [];
  const positiveAnswers = Object.values(answerTopics).flat();

  if (positiveAnswers.some((a) => a.includes("Excellent") || a.includes("Good") || a.includes("High") || a.includes("Active"))) {
    strengths.push("Good baseline activity and physical movement");
  }
  if (positiveAnswers.some((a) => a.includes("Consistent") || a.includes("structured") || a.includes("every day"))) {
    strengths.push("Excellent discipline with meal schedule");
  }
  if (positiveAnswers.some((a) => a.includes("calm") || a.includes("managing"))) {
    strengths.push("Effective stress management and mindfulness");
  }
  
  if (profile.dietType === "vegetarian" || profile.dietType === "vegan") {
    strengths.push("High intake of plant-based micronutrients");
  }

  return strengths.length > 0 ? strengths : ["Committed to making healthier choices"];
}

function generateImprovements(profile: Profile, answerTopics: Record<string, string[]>): string[] {
  const improvements: string[] = [];
  const allAnswers = Object.values(answerTopics).flat().join(" ").toLowerCase();

  if (allAnswers.includes("irregular") || allAnswers.includes("skip")) {
    improvements.push("Meal timing and daily portion consistency");
  }
  if (allAnswers.includes("poor") || allAnswers.includes("restless") || allAnswers.includes("tired")) {
    improvements.push("Sleep quality and evening wind-down routine");
  }
  if (allAnswers.includes("low energy") || allAnswers.includes("spike") || allAnswers.includes("dip")) {
    improvements.push("Blood sugar stability and energy consistency");
  }
  if (profile.healthIssues) {
    improvements.push(`Managing diet around ${profile.healthIssues}`);
  }

  return improvements.length > 0 ? improvements : ["Fine-tuning nutrient distribution"];
}

function getPriorityFocus(profile: Profile, answerTopics: Record<string, string[]>): string[] {
  const allAnswers = Object.values(answerTopics).flat().join(" ").toLowerCase();
  const focus: string[] = [];

  if (profile.healthIssues) {
    focus.push(`Optimize diet to support ${profile.healthIssues}`);
  }

  if (profile.goal === "lose") {
    focus.push("Create a stable, healthy calorie deficit");
    focus.push("Prioritize high-fiber, low-calorie volume foods");
  } else if (profile.goal === "gain") {
    focus.push("Achieve a consistent caloric surplus");
    focus.push("Ensure high-quality protein in all meals");
  }

  if (allAnswers.includes("skip") || allAnswers.includes("irregular")) {
    focus.push("Establish consistent meal windows");
  }
  
  if (allAnswers.includes("water") || allAnswers.includes("less than 2")) {
    focus.push("Increase daily hydration to meet cellular needs");
  }

  if (focus.length === 0) {
    focus.push("Maintain balanced macronutrient ratios");
    focus.push("Anchor meals with whole foods");
  }

  return focus.slice(0, 4);
}

function getQuickWins(profile: Profile, answerTopics: Record<string, string[]>): string[] {
  const allAnswers = Object.values(answerTopics).flat().join(" ").toLowerCase();
  const wins: string[] = [];

  if (profile.healthIssues) {
    wins.push(`Consult a specialist regarding diet for ${profile.healthIssues}`);
  }

  if (profile.goal === "lose") {
    wins.push("Drink a full glass of water 15 minutes before every meal");
    wins.push("Swap high-calorie snacks for raw vegetables or fruit");
  } else if (profile.goal === "gain") {
    wins.push("Add a serving of nuts or peanut butter for easy calorie dense fats");
    wins.push("Have a protein snack or shake post-workout");
  }

  if (allAnswers.includes("water")) {
    wins.push("Carry a water bottle and finish it at least twice daily");
  }
  if (allAnswers.includes("sleep")) {
    wins.push("Avoid screens for 30 minutes before sleep to improve deep sleep");
  }

  if (wins.length === 0) {
    wins.push("Add one portion of vegetables to your next lunch");
    wins.push("Take a 10-minute walk after your largest meal");
  }

  return wins.slice(0, 4);
}

function getRecommendations(profile: Profile, answerTopics: Record<string, string[]>): string[] {
  const recs: string[] = [];

  if (profile.dietType === "vegetarian" || profile.dietType === "vegan") {
    recs.push("Combine grains and legumes to get a complete amino acid profile");
  } else {
    recs.push("Incorporate lean protein sources such as grilled chicken breast or egg whites");
  }

  if (profile.goal === "lose") {
    recs.push("Focus on nutrient density rather than calorie density");
  } else if (profile.goal === "gain") {
    recs.push("Prioritize complex carbohydrates like sweet potato and whole grains for sustained training energy");
  }

  if (profile.healthIssues) {
    recs.push(`Ensure your meals align with health guidelines for ${profile.healthIssues}`);
  }

  recs.push("Eat slowly and chew food thoroughly to aid digestion");
  recs.push("Stay hydrated throughout the day, aiming for steady water intake");

  return recs.slice(0, 5);
}

function selectRecommendedPlan(answerTopics: Record<string, string[]>): string {
  const score = calculateScore(Object.values(answerTopics).flat());
  if (score >= 75) return "Maintenance Plan";
  if (score >= 50) return "Balanced Nutrient Boost Plan";
  return "Reset & Restore Plan";
}
