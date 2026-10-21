/**
 * Health calculations based on Mifflin-St Jeor and standard nutritional science.
 *
 * The onboarding wizard computes the exact day + workout activity multiplier and
 * passes it as `activityMultiplier`; when it is absent (older saved answers, the
 * unit tests) the plain three-level `activity` factor is used instead. Every
 * consumer — the metrics on the result screen and the meal-solver targets —
 * reads the same numbers from here.
 */

export interface OnboardingAnswers {
  goal: 'loss' | 'gain' | 'muscle' | 'maintenance' | null
  age: number
  gender: 'Male' | 'Female' | null
  height: number // cm
  weight: number // kg
  food: 'veg' | 'egg' | 'nonveg' | null
  activity: 'sedentary' | 'active' | 'gym' | null
  /** Exact activity multiplier (day base + workout add, 1.20–1.875). Takes
   *  precedence over the three-level `activity` key when present. */
  activityMultiplier?: number | null
  freq: number | null
  name: string
  phone: string
  preferredSlots?: string[]
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
  fiberG: number
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

  // 1. BMI
  const bmi = weight / Math.pow(height / 100, 2)
  let bmiCategory: HealthMetrics['bmiCategory'] = 'Normal'
  if (bmi < 18.5) bmiCategory = 'Underweight'
  else if (bmi < 25) bmiCategory = 'Normal'
  else if (bmi < 30) bmiCategory = 'Overweight'
  else bmiCategory = 'Obese'

  // 2. BMR (Mifflin-St Jeor)
  //   Men:   10W + 6.25H − 5A + 5
  //   Women: 10W + 6.25H − 5A − 161
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'Male' ? 5 : -161)

  // 3. TDEE = BMR × multiplier (day base only; workouts removed).
  //    The wizard's exact multiplier wins; the three-level factor is fallback.
  const activityFactors = { sedentary: 1.2, active: 1.375, gym: 1.55 }
  const factor = a.activityMultiplier ?? activityFactors[activity] ?? 1.2
  const tdee = bmr * factor

  // 4. Goal calories: × the goal factor, floored at the safe minimum, then
  //    rounded to the nearest 10 kcal (halves up, via Math.round).
  const goalFactor =
    goal === 'loss' ? 0.8 : goal === 'muscle' ? 1.1 : goal === 'gain' ? 1.15 : 1.0
  const minCal = gender === 'Male' ? 1500 : 1200
  const goalCalories = Math.round(Math.max(tdee * goalFactor, minCal) / 10) * 10

  // 5. Protein: cap the reference weight at 25 × (H/100)² (so very heavy users
  //    are not over-prescribed), then × the goal factor.
  const proteinFactor =
    goal === 'loss' || goal === 'muscle' ? 2.0 : goal === 'gain' ? 1.8 : 1.6
  const proteinWeight =
    Math.round(Math.min(weight, 25 * Math.pow(height / 100, 2)) * 100) / 100
  const proteinG = Math.round(proteinWeight * proteinFactor)
  const proteinKcal = proteinG * 4

  // 6. Fat: 25% of the day's calories.
  const fatKcal = goalCalories * 0.25
  const fatG = Math.round(fatKcal / 9)

  // 7. Carbs: whatever is left, using the ROUNDED protein and fat grams.
  const carbsG = Math.round((goalCalories - proteinG * 4 - fatG * 9) / 4)
  const carbsKcal = carbsG * 4

  // 8. Fiber: 14 g per 1000 kcal.
  const fiberG = Math.round((goalCalories / 1000) * 14)

  // Macro split for the UI (percentage of the macro calories).
  const totalKcal = proteinKcal + fatKcal + carbsKcal
  const proteinPct = totalKcal > 0 ? Math.round((proteinKcal / totalKcal) * 100) : 0
  const fatPct = totalKcal > 0 ? Math.round((fatKcal / totalKcal) * 100) : 0
  const carbsPct = totalKcal > 0 ? Math.round((carbsKcal / totalKcal) * 100) : 0

  // 9. Water intake (liters): 33 ml per kg, plus a little for an active day.
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
    fiberG,
    waterL,
    proteinPct,
    carbsPct,
    fatPct,
  }
}
