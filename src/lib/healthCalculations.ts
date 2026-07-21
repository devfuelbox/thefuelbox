/**
 * Health calculations based on Mifflin-St Jeor and standard nutritional science.
 */

export interface OnboardingAnswers {
  goal: 'loss' | 'gain' | 'muscle' | 'maintenance' | null
  age: number
  gender: 'Male' | 'Female' | null
  height: number // cm
  weight: number // kg
  food: 'veg' | 'egg' | 'nonveg' | null
  activity: 'sedentary' | 'active' | 'gym' | null
  freq: number | null
  name: string
  email: string
  phone: string
}

export interface HealthMetrics {
  bmi: number
  bmiCategory: 'Underweight' | 'Normal' | 'Overweight' | 'Obese'
  bmr: number
  tdee: number
  goalCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  waterL: number
  proteinPct: number
  carbsPct: number
  fatPct: number
}

export function calculateHealthMetrics(a: OnboardingAnswers): HealthMetrics {
  const height = a.height || 170
  const weight = a.weight || 70
  const age = a.age || 25
  const gender = a.gender || 'Male'
  const goal = a.goal || 'loss'
  const activity = a.activity || 'sedentary'

  // 1. BMI Calculation
  const bmi = weight / Math.pow(height / 100, 2)
  let bmiCategory: HealthMetrics['bmiCategory'] = 'Normal'
  if (bmi < 18.5) bmiCategory = 'Underweight'
  else if (bmi >= 18.5 && bmi < 25) bmiCategory = 'Normal'
  else if (bmi >= 25 && bmi < 30) bmiCategory = 'Overweight'
  else bmiCategory = 'Obese'

  // 2. BMR Calculation (Mifflin-St Jeor)
  // Men: BMR = 10W + 6.25H - 5A + 5
  // Women: BMR = 10W + 6.25H - 5A - 161
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'Male' ? 5 : -161)

  // 3. TDEE Calculation
  // Standard activity factors:
  // - Sedentary: 1.2
  // - Active: 1.375
  // - Gym (Moderately active): 1.55
  const activityFactors = {
    sedentary: 1.2,
    active: 1.375,
    gym: 1.55,
  }
  const factor = activityFactors[activity] || 1.2
  const tdee = bmr * factor

  // 4. Goal Calories
  // Deficit/surplus rules:
  // - loss (Weight Loss): deficit of 400-500 kcal (capped at min 1200 for Female, 1500 for Male)
  // - gain (Weight Gain): surplus of 400-500 kcal
  // - muscle (Muscle Gain): lean surplus of 250-300 kcal
  // - maintenance: same as TDEE
  let deficitOrSurplus = 0
  if (goal === 'loss') deficitOrSurplus = -400
  else if (goal === 'gain') deficitOrSurplus = 400
  else if (goal === 'muscle') deficitOrSurplus = 250

  const minCal = gender === 'Male' ? 1500 : 1200
  const goalCalories = Math.max(minCal, Math.round(tdee + deficitOrSurplus))

  // 5. Protein target (grams)
  // - Weight loss: 2.0g per kg (to preserve muscle mass in deficit)
  // - Muscle gain / Weight gain: 2.2g per kg (supports muscle hypertrophy)
  // - Maintenance / general health: 1.6g per kg
  let proteinPerKg = 1.6
  if (goal === 'loss') proteinPerKg = 2.0
  else if (goal === 'muscle' || goal === 'gain') proteinPerKg = 2.2

  const proteinG = Math.round(weight * proteinPerKg)
  const proteinKcal = proteinG * 4

  // 6. Fat target (grams)
  // Standard healthy diet: ~25% of total calories from healthy fats
  const fatKcal = goalCalories * 0.25
  const fatG = Math.round(fatKcal / 9)

  // 7. Carbohydrates target (grams)
  // Remaining calories go to carbs
  const carbsKcal = Math.max(0, goalCalories - proteinKcal - fatKcal)
  const carbsG = Math.round(carbsKcal / 4)

  // Percentages for Macro Distribution
  const totalKcal = proteinKcal + fatKcal + carbsKcal
  const proteinPct = totalKcal > 0 ? Math.round((proteinKcal / totalKcal) * 100) : 0
  const fatPct = totalKcal > 0 ? Math.round((fatKcal / totalKcal) * 100) : 0
  const carbsPct = totalKcal > 0 ? Math.round((carbsKcal / totalKcal) * 100) : 0

  // 8. Water Intake (liters)
  // Baseline: 33ml per kg of body weight
  // Plus additional water for active individuals: Active + 0.5L, Gym + 1.0L
  let extraWater = 0
  if (activity === 'active') extraWater = 0.5
  else if (activity === 'gym') extraWater = 1.0

  const waterL = Math.round((weight * 0.033 + extraWater) * 10) / 10

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalCalories,
    proteinG,
    carbsG,
    fatG,
    waterL,
    proteinPct,
    carbsPct,
    fatPct,
  }
}
