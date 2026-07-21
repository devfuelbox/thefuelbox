export interface UserRewards {
  id: string
  user_id: string
  total_points: number
  referral_balance: number
  created_at: string
  updated_at: string
}

export interface RewardTransaction {
  id: string
  user_id: string
  points: number
  type: 'earned' | 'redeemed' | 'penalty' | 'referral_bonus'
  description: string
  reference_id: string | null
  created_at: string
}

export const POINTS_PER_MEAL = 50
export const PENALTY_PER_SKIP = 50
export const POINTS_TO_RUPEE = 10 // 10 points = ₹1
