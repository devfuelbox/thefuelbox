export interface User {
  id: string
  email: string
  full_name: string
  phone: string
  avatar_url: string | null
  fitness_goal: FitnessGoal | null
  diet_type: DietType | null
  dob?: string
  gender?: 'male' | 'female' | 'other' | ''
  height?: number
  weight?: number
  address?: string
  city?: string
  pincode?: string
  health_issues?: string
  referral_id?: string
  referred_by?: string
  referred_by_name?: string
  created_at: string
}

export type FitnessGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'general_health'
export type DietType = 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan'

export interface AuthState {
  user: User | null
  session: unknown | null
  isLoading: boolean
}
