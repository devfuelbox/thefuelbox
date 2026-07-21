export type FitnessGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'general_health'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type DietPreference = 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan'

export interface QuizAnswers {
  fitness_goal: FitnessGoal | null
  activity_level: ActivityLevel | null
  diet_preference: DietPreference | null
  meals_per_day: number | null
  allergies: string[]
  budget_per_meal: number | null
}

export interface QuizResult {
  id: string
  user_id: string
  answers: QuizAnswers
  recommended_calories: number
  recommended_protein: number
  created_at: string
}
