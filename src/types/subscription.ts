export type SubscriptionTier = 'essential' | 'elite'
export type MealsPerDay = 1 | 2 | 3

export interface SubscriptionPlan {
  id: string
  name: string
  tier: SubscriptionTier
  meals_per_day: MealsPerDay
  days_per_cycle: number
  monthly_price: number
  margin_percent: number
  description: string
}

export type HistPlanEntry = [string, string, string]
export type MenuChosenEntry = [string, number]

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  plan: SubscriptionPlan
  start_date: string
  end_date: string
  status: 'active' | 'paused' | 'pending' | 'cancelled' | 'expired'
  auto_renew: boolean
  hist_plan_id?: HistPlanEntry[]
  menu_chosen?: MenuChosenEntry[]
}
