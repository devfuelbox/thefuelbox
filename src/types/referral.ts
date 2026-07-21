export type ReferralStatus =
  | 'pending_subscription'
  | 'subscription_activated'
  | 'reward_credited'
  | 'successful'

export interface ReferralRecord {
  id: string
  referrer_id: string
  referred_id: string
  referral_code: string
  status: ReferralStatus
  subscription_plan: string | null
  subscription_purchase_date: string | null
  /** Subscription status of the referred friend (from user_subscriptions) */
  subscription_status: string | null
  /** Subscription start date of the referred friend */
  subscription_start_date: string | null
  /** Subscription end date of the referred friend */
  subscription_end_date: string | null
  /** Whether the friend has purchased any subscription */
  subscription_purchased: boolean
  reward_points: number
  created_at: string
  updated_at: string
  friend_name: string
  friend_email: string
  stage?: number
}

export interface ReferralTransaction {
  id: string
  referral_id: string
  user_id: string
  points: number
  type: 'earned' | 'redeemed' | 'pending'
  description: string
  created_at: string
}

export interface ReferralStats {
  total_referred: number
  pending_count: number
  successful_count: number
  total_points: number
  pending_points: number
  credited_points: number
  /** Current stage: 0 = no successful referrals, up to 5 */
  stage: number
}

export const REFERRAL_REWARD_MATRIX: Record<number, Record<number, number>> = {
  1: { 7: 100, 20: 150, 24: 200, 30: 250 },
  2: { 7: 150, 20: 200, 24: 250, 30: 300 },
  3: { 7: 200, 20: 250, 24: 300, 30: 350 },
  4: { 7: 250, 20: 300, 24: 350, 30: 400 },
  5: { 7: 300, 20: 350, 24: 400, 30: 450 },
}

export type SupportedPlanDays = 7 | 20 | 24 | 30

export function normalisePlanDays(days: number): SupportedPlanDays {
  if (days <= 7) return 7
  if (days === 20) return 20
  if (days === 24) return 24
  return 30
}
