export interface DailyNutritionLog {
  id: string
  user_id: string
  logged_date: string // format: YYYY-MM-DD
  meal_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  created_at: string
}

export interface NutritionTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
  water: number // target water in ml
  dailyFocus?: string // dynamic message focus of the day
}
