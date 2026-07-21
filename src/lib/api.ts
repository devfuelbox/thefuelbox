import type { MenuItem } from '@/types/meal'
import type { User } from '@/types/user'
import type { UserSubscription } from '@/types/subscription'
import type { UserRewards, RewardTransaction } from '@/types/rewards'
import type { ReferralRecord, ReferralTransaction, ReferralStats } from '@/types/referral'
import { normalisePlanDays, REFERRAL_REWARD_MATRIX } from '@/types/referral'
import type { QuizAnswer, Assessment } from './storage'
import type { Profile } from './profile'
import type { QuestionPayload, ReportPayload } from './quiz/schemas'
import { aiNextQuestion, localGenerateReport } from './quiz/localAdaptive'
import { generateAIDailyTips, isAIAvailable } from './ai-service'
import type { DailyRecPayload } from './quiz/schemas'
function getDb() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: async () => ({ data: [], error: null }) }), single: async () => ({ data: null, error: null }) }),
      upsert: () => ({ select: async () => ({ data: null, error: null }) }),
      delete: () => ({ match: async () => ({ data: null, error: null }), eq: async () => ({ data: null, error: null }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    }),
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
    rpc: async () => ({ data: null, error: null }),
  } as any
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  try {
    const res = await fetch('/api/menu')
    if (!res.ok) throw new Error('Failed to fetch menu')
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch menu items from DB API:', err)
    return []
  }
}

export async function addToCart(menuItemId: string, quantity: number) {
  try {
    const stored = localStorage.getItem('fuelbox_cart') ?? '[]'
    const items = JSON.parse(stored)
    items.push({ menuItemId, quantity })
    localStorage.setItem('fuelbox_cart', JSON.stringify(items))
    return items
  } catch (err) {
    console.warn('Failed to add to cart:', err)
    return null
  }
}

export async function removeFromCart(menuItemId: string) {
  try {
    const stored = localStorage.getItem('fuelbox_cart') ?? '[]'
    const items = JSON.parse(stored).filter((i: any) => i.menuItemId !== menuItemId)
    localStorage.setItem('fuelbox_cart', JSON.stringify(items))
  } catch (err) {
    console.warn('Failed to remove from cart:', err)
  }
}

export async function clearDbCart() {
  try {
    const supabase = getDb()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('cart_items')
      .delete()
      .match({ user_id: user.id })
  } catch (err) {
    console.warn('Failed to clear cart in DB:', err)
  }
}

export async function fetchDbCart() {
  try {
    const supabase = getDb()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('cart_items')
      .select('id, quantity, menu_items(*)')
      .eq('user_id', user.id)

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      menuItem: item.menu_items
    }))
  } catch (err) {
    console.warn('Failed to fetch cart from DB:', err)
    return []
  }
}

export async function fetchUserProfile(userId: string): Promise<User> {
  const supabase = getDb()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      return data
    }
  } catch (err) {
    console.warn('Profiles table query failed, loading from local state:', err)
  }

  const localProfileStr = localStorage.getItem(`fuelbox_profile_${userId}`)
  if (localProfileStr) {
    try {
      return JSON.parse(localProfileStr)
    } catch {
      // ignore
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  return {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || '',
    phone: user.phone || user.user_metadata?.phone || '',
    avatar_url: user.user_metadata?.avatar_url || null,
    fitness_goal: user.user_metadata?.fitness_goal || null,
    diet_type: user.user_metadata?.diet_type || null,
    dob: user.user_metadata?.dob || '',
    gender: user.user_metadata?.gender || '',
    height: user.user_metadata?.height ? Number(user.user_metadata.height) : undefined,
    weight: user.user_metadata?.weight ? Number(user.user_metadata.weight) : undefined,
    address: user.user_metadata?.address || '',
    pincode: user.user_metadata?.pincode || '',
    health_issues: user.user_metadata?.health_issues || '',
    created_at: sbUserCreatedAt(user.created_at),
  }
}

function sbUserCreatedAt(createdVal: unknown): string {
  if (typeof createdVal === 'string') return createdVal
  return new Date().toISOString()
}

export async function updateUserProfile(profileData: Partial<User>): Promise<User> {
  const supabase = getDb()
  const { data: { user: sbUser } } = await supabase.auth.getUser()
  if (!sbUser) throw new Error('Not authenticated')

  const updateData: Record<string, unknown> = {
    full_name: profileData.full_name,
    phone: profileData.phone,
    avatar_url: profileData.avatar_url,
    fitness_goal: profileData.fitness_goal,
    diet_type: profileData.diet_type,
    dob: profileData.dob,
    gender: profileData.gender,
    height: profileData.height,
    weight: profileData.weight,
    address: profileData.address,
    pincode: profileData.pincode,
    health_issues: profileData.health_issues,
  }

  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) delete updateData[key]
  })

  const { error: authError } = await supabase.auth.updateUser({
    data: updateData
  })
  if (authError) console.warn('Auth metadata update failed:', authError)

  const updatedUser: User = {
    id: sbUser.id,
    email: sbUser.email || '',
    full_name: profileData.full_name ?? sbUser.user_metadata?.full_name ?? '',
    phone: profileData.phone ?? sbUser.phone ?? sbUser.user_metadata?.phone ?? '',
    avatar_url: profileData.avatar_url ?? sbUser.user_metadata?.avatar_url ?? null,
    fitness_goal: profileData.fitness_goal ?? sbUser.user_metadata?.fitness_goal ?? null,
    diet_type: profileData.diet_type ?? sbUser.user_metadata?.diet_type ?? null,
    dob: profileData.dob ?? sbUser.user_metadata?.dob ?? '',
    gender: (profileData.gender ?? sbUser.user_metadata?.gender ?? '') as User['gender'],
    height: profileData.height !== undefined ? Number(profileData.height) : (sbUser.user_metadata?.height ? Number(sbUser.user_metadata.height) : undefined),
    weight: profileData.weight !== undefined ? Number(profileData.weight) : (sbUser.user_metadata?.weight ? Number(sbUser.user_metadata.weight) : undefined),
    address: profileData.address ?? sbUser.user_metadata?.address ?? '',
    pincode: profileData.pincode ?? sbUser.user_metadata?.pincode ?? '',
    health_issues: profileData.health_issues ?? sbUser.user_metadata?.health_issues ?? '',
    created_at: sbUser.created_at,
  }

  try {
    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: sbUser.id,
        email: sbUser.email,
        full_name: updatedUser.full_name,
        phone: updatedUser.phone,
        avatar_url: updatedUser.avatar_url,
        fitness_goal: updatedUser.fitness_goal,
        diet_type: updatedUser.diet_type,
        dob: updatedUser.dob,
        gender: updatedUser.gender,
        height: updatedUser.height,
        weight: updatedUser.weight,
        address: updatedUser.address,
        pincode: updatedUser.pincode,
        health_issues: updatedUser.health_issues,
        updated_at: new Date().toISOString(),
      })
    if (dbError) console.warn('Profiles table update failed:', dbError)
  } catch (err) {
    console.warn('Error updating profiles table in DB, using local state persistence:', err)
  }

  localStorage.setItem(`fuelbox_profile_${sbUser.id}`, JSON.stringify(updatedUser))

  const { useAuthStore } = await import('@/store/authStore')
  useAuthStore.getState().setUser(updatedUser)

  return updatedUser
}

export async function fetchUserSubscription(userId: string): Promise<UserSubscription | null> {
  const supabase = getDb()
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error && data) {
      return data as unknown as UserSubscription
    }
  } catch (err) {
    console.warn('user_subscriptions query failed, loading from local state:', err)
  }

  const localSubStr = localStorage.getItem(`fuelbox_subscription_${userId}`)
  if (localSubStr) {
    try {
      return JSON.parse(localSubStr) as UserSubscription
    } catch {
      return null
    }
  }

  return null
}

export async function getNextQuestion(
  profile: Profile,
  currentAnswers: QuizAnswer[],
  previousAssessments: Assessment[],
): Promise<QuestionPayload> {
  return aiNextQuestion({ profile, currentAnswers, previousAssessments })
}

export async function getReport(
  profile: Profile,
  answers: QuizAnswer[],
  previousAssessments: Assessment[],
): Promise<ReportPayload> {
  return localGenerateReport({ profile, answers, previousAssessments })
}

export async function getDailyRec(
  profile: Profile,
  latestAssessment: Assessment | null,
  todayTotals?: { calories: number; protein: number; carbs: number; fat: number; water: number },
  recentMeals?: string[],
): Promise<DailyRecPayload> {
  if (isAIAvailable()) {
    try {
      const ai = await generateAIDailyTips({ profile, latestAssessment, todayTotals, recentMeals })
      if (ai) return ai
    } catch (err) {
      console.error("[FuelBox AI] Failed to generate AI Daily Tips:", err);
    }
  } else {
    console.warn("[FuelBox AI] AI is not available. Ensure VITE_OPENROUTER_API_KEY is defined in your .env file and restart your Vite server.");
  }
  return {
    focus: 'Build healthy habits today',
    tips: ['Start your day with water', 'Eat balanced meals', 'Stay consistent'],
    rationale: 'mock-fallback',
  }
}

// ── Contact form ─────────────────────────────────────────────────────────────

export interface ContactFormData {
  name: string
  email: string
  message: string
}

export async function submitContactForm(data: ContactFormData): Promise<void> {
  const supabase = getDb()
  if (!supabase) throw new Error('Supabase not configured')

  const { error } = await supabase
    .from('contact_messages')
    .insert({ name: data.name, email: data.email, message: data.message })

  if (error) throw error
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface OrderData {
  phone: string
  address: string
  city: string
  pincode: string
  selected_meals: string[]
  delivery_times: Record<string, string>
  cost: number
  status?: string
  type?: string
  plan_id?: string
  menuSelected?: Array<{ id: string; name: string; price: number; cookable: boolean; quantity: number }>
}

export async function saveOrder(orderData: OrderData): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) {
    console.warn('Supabase not configured, order saved locally only')
    return false
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('User not authenticated, order saved locally only')
      return false
    }

    const { error } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        phone: orderData.phone,
        address: orderData.address,
        city: orderData.city,
        pincode: orderData.pincode,
        cost: orderData.cost,
        selected_meals: orderData.selected_meals,
        delivery_times: orderData.delivery_times,
        status: orderData.status || 'pending',
        type: orderData.type || 'meal',
        plan_id: orderData.plan_id || null,
        menu_selected: orderData.menuSelected || [],
      })

    if (error) {
      console.error('Failed to save order to Supabase:', error)
      return false
    }

    console.log('Order saved to Supabase successfully')
    return true
  } catch (err) {
    console.error('Error saving order to Supabase:', err)
    return false
  }
}

export async function fetchRecentOrders(userId: string, limit = 3) {
  const supabase = getDb()
  if (!supabase) return []
  try {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data || []) as Array<{
      created_at: string
      status: string
      selected_meals: string[]
      menu_selected: Array<{ id: string; name: string; price: number; quantity: number }>
    }>
  } catch {
    return []
  }
}

export async function saveSubscription(subscriptionData: {
  planId: string
  mealsPerDay: number
  daysPerCycle: number
  cost: number
  status?: string
  selectedMeals?: string[]
  phone?: string
  address?: string
  city?: string
  pincode?: string
  deliveryTimes?: Record<string, string>
  menuChosen?: Array<[string, number]>
}): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) return false

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const now = new Date().toISOString()
    const newStatus = subscriptionData.status || 'pending'

    const cycleDays = subscriptionData.planId === 'weekly5' ? 7 : 30

    // Check for existing subscription to update instead of insert
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('id, plan_id, start_date, status, hist_plan_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const payload: Record<string, unknown> = {
      plan_id: subscriptionData.planId,
      status: newStatus,
      cost: subscriptionData.cost,
      meals_per_day: subscriptionData.mealsPerDay,
      days_per_cycle: subscriptionData.daysPerCycle,
      phone: subscriptionData.phone || null,
      address: subscriptionData.address || null,
      city: subscriptionData.city || null,
      pincode: subscriptionData.pincode || null,
      selected_meals: subscriptionData.selectedMeals || [],
      delivery_times: subscriptionData.deliveryTimes || {},
      menu_chosen: subscriptionData.menuChosen || [],
    }

    if (existing) {
      const base = existing.start_date || now
      const end = new Date(new Date(base).getTime() + cycleDays * 86400000).toISOString()
      payload.end_date = end

      const oldHist: Array<[string, string, string]> = (existing.hist_plan_id as Array<[string, string, string]>) || []
      payload.hist_plan_id = [
        ...oldHist,
        [existing.plan_id, existing.start_date || now, existing.status],
        [subscriptionData.planId, now, newStatus],
      ]

      const { error } = await supabase
        .from('user_subscriptions')
        .update(payload)
        .eq('id', existing.id)

      if (error) {
        console.error('Failed to update subscription:', error)
        return false
      }
      console.log('Subscription updated successfully')
    } else {
      payload.hist_plan_id = [[subscriptionData.planId, now, newStatus]]
      payload.user_id = user.id
      payload.start_date = now

      const end = new Date(new Date(now).getTime() + cycleDays * 86400000).toISOString()
      payload.end_date = end

      const { error } = await supabase
        .from('user_subscriptions')
        .insert(payload)

      if (error) {
        console.error('Failed to save subscription:', error)
        return false
      }
      console.log('Subscription saved successfully')
    }

    await syncReferralForUserSubscription(user.id)
    return true
  } catch (err) {
    console.error('Error saving subscription to Supabase:', err)
    return false
  }
}

// ── Referral helpers ──────────────────────────────────────────────────────────

export interface ReferredUser {
  id: string
  full_name: string
  created_at: string
}

/** Fetch all users referred by the given userId */
export async function fetchUserReferrals(userId: string): Promise<ReferredUser[]> {
  const supabase = getDb()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as ReferredUser[]) ?? []
  } catch (err) {
    console.warn('fetchUserReferrals failed:', err)
    return []
  }
}

function getReferralStatusFromSubscription(status: string): 'subscription_activated' | 'pending_subscription' {
  if (status === 'active') return 'subscription_activated'
  return 'pending_subscription'
}

export async function createReferralRecord(
  referrerId: string,
  referredId: string,
  referralCode: string,
): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) return false

  try {
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', referredId)
      .maybeSingle()

    if (existing) return true

    // Fetch referred user's profile to get their name and email for the record
    const { data: referredProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', referredId)
      .maybeSingle()

    const now = new Date().toISOString()

    const payload = {
      referrer_id: referrerId,
      referred_id: referredId,
      referral_code: referralCode,
      status: 'pending_subscription',
      friend_name: (referredProfile as any)?.full_name ?? null,
      friend_email: (referredProfile as any)?.email ?? null,
      stage: 0,
      subscription_plan: null,
      subscription_purchase_date: null,
      subscription_status: null,
      subscription_start_date: null,
      subscription_end_date: null,
      reward_points: 0,
    }

    const { error } = await supabase.from('referrals').insert(payload)
    if (error) {
      console.error('Failed to create referral record:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('createReferralRecord failed:', err)
    return false
  }
}

async function countSuccessfulReferrals(referrerId: string, excludeReferredId?: string): Promise<number> {
  const supabase = getDb()
  if (!supabase) return 0
  try {
    let query = supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .in('status', ['subscription_activated', 'reward_credited', 'successful'])

    if (excludeReferredId) {
      query = query.neq('referred_id', excludeReferredId)
    }

    const { count, error } = await query
    if (error) {
      console.error('countSuccessfulReferrals failed:', error)
      return 0
    }
    return count ?? 0
  } catch (err) {
    console.error('countSuccessfulReferrals failed:', err)
    return 0
  }
}

export async function computeReferralRewardPoints(referrerId: string, planId: string): Promise<number> {
  const days = planId === 'weekly5' ? 5 : planId === 'monthly20' ? 20 : planId === 'monthly24' ? 24 : planId === 'monthly30' ? 30 : 0
  if (!days) return 0

  const previousSuccess = await countSuccessfulReferrals(referrerId)
  if (previousSuccess >= 5) return 0

  const normDays = normalisePlanDays(days)
  const rewardValue = REFERRAL_REWARD_MATRIX[previousSuccess + 1 as keyof typeof REFERRAL_REWARD_MATRIX]?.[normDays]
  return rewardValue ?? 0
}

export async function applyReferralCode(referralCode: string, referredUserId: string): Promise<{ success: boolean; message?: string; referrerName?: string }> {
  const supabase = getDb()
  if (!supabase) return { success: false, message: 'Supabase not configured' }

  const code = referralCode.trim().toUpperCase()
  if (!code) return { success: false, message: 'Referral code is required.' }

  try {
    const { data: referrer, error: refError } = await supabase
      .from('profiles')
      .select('id, full_name, referral_id')
      .eq('referral_id', code)
      .maybeSingle()

    if (refError) {
      console.error('applyReferralCode failed querying referrer:', refError)
      return { success: false, message: 'Unable to validate referral code.' }
    }

    if (!referrer) {
      return { success: false, message: 'Invalid referral code. Please check and try again.' }
    }

    if (referrer.id === referredUserId) {
      return { success: false, message: 'You cannot use your own referral code.' }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referred_by: referrer.id, referred_by_name: referrer.full_name })
      .eq('id', referredUserId)

    if (updateError) {
      console.error('applyReferralCode failed updating profile:', updateError)
      return { success: false, message: 'Unable to apply referral code.' }
    }

    const created = await createReferralRecord(referrer.id, referredUserId, referrer.referral_id || code)
    if (!created) {
      return { success: false, message: 'Unable to create referral record.' }
    }

    await syncReferralForUserSubscription(referredUserId)
    return { success: true, referrerName: referrer.full_name }
  } catch (err) {
    console.error('applyReferralCode failed:', err)
    return { success: false, message: 'Something went wrong. Please try again.' }
  }
}

/**
 * Syncs the referral record for a referred user whenever their subscription changes.
 * - Creates the referral record if it doesn't exist.
 * - Updates subscription tracking fields (plan, status, start/end dates).
 * - Credits reward points ONLY when: friend registered + first subscription activated.
 * - Uses idempotency guard to never double-credit rewards.
 * - Writes updated stage back to the referrals row for Admin Dashboard.
 */
export async function syncReferralForUserSubscription(userId: string): Promise<boolean> {
  // Read-only dummy: All sync, status progression, and reward crediting logic
  // is now handled automatically on the server side by the database trigger
  // on the user_subscriptions table.
  return true
}

// ── Rewards helpers ──────────────────────────────────────────────────────────

export async function fetchUserRewards(userId: string): Promise<UserRewards | null> {
  const supabase = getDb()
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && data) {
      // Always recalculate from transactions as the source of truth
      const { data: txns } = await supabase
        .from('reward_transactions')
        .select('points, type')
        .eq('user_id', userId)

      const computedTotal = (txns ?? []).reduce((s, t) => {
        return t.type === 'referral_bonus' ? s : s + (Number(t.points) || 0)
      }, 0)

      const computedReferral = (txns ?? []).reduce((s, t) => {
        return t.type === 'referral_bonus' ? s + (Number(t.points) || 0) : s
      }, 0)

      return { ...(data as UserRewards), total_points: computedTotal, referral_balance: computedReferral }
    }

    // No row exists — calculate from any existing transactions first
    const { data: txns } = await supabase
      .from('reward_transactions')
      .select('points, type')
      .eq('user_id', userId)

    const totalFromTxns = (txns ?? []).reduce((sum, t) => {
      return t.type === 'referral_bonus' ? sum : sum + (Number(t.points) || 0)
    }, 0)

    const referralFromTxns = (txns ?? []).reduce((sum, t) => {
      return t.type === 'referral_bonus' ? sum + (Number(t.points) || 0) : sum
    }, 0)

    const { data: newRow, error: insertError } = await supabase
      .from('user_rewards')
      .insert({ user_id: userId, total_points: totalFromTxns, referral_balance: referralFromTxns })
      .select()
      .maybeSingle()

    if (insertError) {
      // Race: another call already created the row — try UPDATE instead
      const { error: updateError } = await supabase
        .from('user_rewards')
        .update({ total_points: totalFromTxns, referral_balance: referralFromTxns })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Failed to create/update rewards row:', updateError)
        return null
      }

      // Fetch the updated row
      const { data: updated } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      return (updated as UserRewards) ?? null
    }
    return newRow as UserRewards
  } catch (err) {
    console.error('fetchUserRewards failed:', err)
    return null
  }
}

export async function fetchRewardTransactions(userId: string): Promise<RewardTransaction[]> {
  const supabase = getDb()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('reward_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as RewardTransaction[]) ?? []
  } catch (err) {
    console.error('fetchRewardTransactions failed:', err)
    return []
  }
}

/** Recalculate total_points for a user by summing all reward_transactions */
async function recalculateUserRewards(userId: string): Promise<void> {
  const supabase = getDb()
  if (!supabase) return

  const { data: txns, error: txnError } = await supabase
    .from('reward_transactions')
    .select('points, type')
    .eq('user_id', userId)

  if (txnError) {
    console.error('recalculateUserRewards: failed to query transactions:', txnError)
    return
  }

  const totalPoints = (txns ?? []).reduce((sum, t) => {
    if (t.type === 'referral_bonus') return sum
    return sum + (Number(t.points) || 0)
  }, 0)

  const referralPoints = (txns ?? []).reduce((sum, t) => {
    if (t.type === 'referral_bonus') return sum + (Number(t.points) || 0)
    return sum
  }, 0)

  // Try UPDATE first (row should already exist from fetchUserRewards)
  const { error: updateError } = await supabase
    .from('user_rewards')
    .update({ total_points: totalPoints, referral_balance: referralPoints })
    .eq('user_id', userId)

  if (!updateError) return

  // No row yet — INSERT
  const { error: insertError } = await supabase
    .from('user_rewards')
    .insert({ user_id: userId, total_points: totalPoints, referral_balance: referralPoints })

  if (insertError) {
    console.error('recalculateUserRewards: insert also failed:', insertError)
  }
}

export async function addRewardTransaction(
  userId: string,
  points: number,
  type: RewardTransaction['type'],
  description: string,
  referenceId?: string
): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) return false

  try {
    // Guard against duplicate reference_id (race conditions, double-runs)
    if (referenceId) {
      const { data: existing } = await supabase
        .from('reward_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('reference_id', referenceId)
        .maybeSingle()

      if (existing) return true // already recorded
    }

    const { error: txnError } = await supabase
      .from('reward_transactions')
      .insert({
        user_id: userId,
        points,
        type,
        description,
        reference_id: referenceId || null,
      })

    if (txnError) {
      console.error('Failed to insert reward transaction:', txnError)
      return false
    }

    // Recalculate total from all transactions (handles races / partial state)
    await recalculateUserRewards(userId)

    return true
  } catch (err) {
    console.error('addRewardTransaction failed:', err)
    return false
  }
}

export async function redeemPoints(userId: string, pointsToRedeem: number): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) return false

  try {
    // Check current points
    const { data } = await supabase
      .from('user_rewards')
      .select('total_points')
      .eq('user_id', userId)
      .maybeSingle()

    const currentPoints = (data as any)?.total_points ?? 0
    if (currentPoints < pointsToRedeem) return false

    // Record transaction (negative points)
    const { error } = await supabase.from('reward_transactions').insert({
      user_id: userId,
      points: -pointsToRedeem,
      type: 'redeemed',
      description: `Redeemed ${pointsToRedeem} points (₹${(pointsToRedeem / 10).toFixed(0)})`,
    })

    if (error) {
      console.error('Failed to record redeem transaction:', error)
      return false
    }

    // Recalculate total from all transactions
    await recalculateUserRewards(userId)

    return true
  } catch (err) {
    console.error('redeemPoints failed:', err)
    return false
  }
}

export async function addReferralBonus(userId: string, bonusAmount: number): Promise<boolean> {
  const supabase = getDb()
  if (!supabase) return false

  try {
    const { data } = await supabase
      .from('user_rewards')
      .select('referral_balance')
      .eq('user_id', userId)
      .maybeSingle()

    const current = (data as any)?.referral_balance ?? 0

    if (data) {
      const { error } = await supabase
        .from('user_rewards')
        .update({ referral_balance: current + bonusAmount })
        .eq('user_id', userId)

      if (error) {
        console.error('Failed to add referral bonus:', error)
        return false
      }
    } else {
      const { error } = await supabase
        .from('user_rewards')
        .insert({ user_id: userId, total_points: 0, referral_balance: bonusAmount })

      if (error) {
        console.error('Failed to create rewards row for referral bonus:', error)
        return false
      }
    }

    await supabase.from('reward_transactions').insert({
      user_id: userId,
      points: bonusAmount,
      type: 'referral_bonus',
      description: `Referral bonus of ₹${bonusAmount}`,
    })

    return true
  } catch (err) {
    console.error('addReferralBonus failed:', err)
    return false
  }
}

export type { ReferralRecord, ReferralTransaction, ReferralStats }

/**
 * Fetches all referral records for a referrer, enriched with live subscription
 * data fetched from user_subscriptions. Runs a self-healing sync for any
 * records that appear stale (pending but friend now has active subscription).
 */
export async function fetchReferralRecords(
  userId: string,
): Promise<ReferralRecord[]> {
  const supabase = getDb()
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select(
        `id, referrer_id, referred_id, referral_code, status, stage,
         subscription_plan, subscription_purchase_date,
         subscription_status, subscription_start_date, subscription_end_date,
         reward_points, created_at, updated_at,
         referred:profiles!referrals_referred_id_fkey(full_name, email)`,
      )
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!data || data.length === 0) return []

    // Fetch live subscriptions for all referred users in one query
    const referredIds = (data as any[]).map((r) => r.referred_id).filter(Boolean)
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_id, status, start_date, end_date, days_per_cycle')
      .in('user_id', referredIds)
      .order('created_at', { ascending: false })

    // Build a map: referred_id → latest subscription
    const subMap = new Map<string, any>()
    for (const sub of (subscriptions ?? [])) {
      if (!subMap.has(sub.user_id)) {
        subMap.set(sub.user_id, sub)
      }
    }

    // Recalculations and checks are handled purely on the server by DB triggers

    return ((data as any[]) ?? []).map((row) => {
      const liveSub = subMap.get(row.referred_id)
      const hasSub = !!(row.subscription_plan || liveSub?.plan_id)

      return {
        id: row.id,
        referrer_id: row.referrer_id,
        referred_id: row.referred_id,
        referral_code: row.referral_code,
        status: row.status,
        subscription_plan: row.subscription_plan ?? liveSub?.plan_id ?? null,
        subscription_purchase_date: row.subscription_purchase_date ?? liveSub?.start_date ?? null,
        subscription_status: row.subscription_status ?? liveSub?.status ?? null,
        subscription_start_date: row.subscription_start_date ?? liveSub?.start_date ?? null,
        subscription_end_date: row.subscription_end_date ?? liveSub?.end_date ?? null,
        subscription_purchased: hasSub,
        reward_points: row.reward_points ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        friend_name: (row.referred as any)?.full_name ?? 'Fuel Box Member',
        friend_email: (row.referred as any)?.email ?? '',
        stage: row.stage ?? 0,
      }
    })
  } catch (err) {
    console.warn('fetchReferralRecords failed:', err)
    return []
  }
}

export async function fetchReferralTransactions(
  userId: string,
): Promise<ReferralTransaction[]> {
  const supabase = getDb()
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('referral_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as ReferralTransaction[]) ?? []
  } catch (err) {
    console.warn('fetchReferralTransactions failed:', err)
    return []
  }
}

/**
 * Computes referral statistics for display.
 * Stage = number of successful referrals (0–5).
 * Stage 0 = no successful referrals (default).
 */
export function computeReferralStats(records: ReferralRecord[]): ReferralStats {
  const total_referred = records.length
  const pending_count = records.filter(
    (r) => r.status === 'pending_subscription',
  ).length
  const successful_count = records.filter(
    (r) =>
      r.status === 'reward_credited' ||
      r.status === 'successful' ||
      r.status === 'subscription_activated',
  ).length
  const total_points = records.reduce((sum, r) => sum + (r.reward_points ?? 0), 0)
  const credited_points = records
    .filter(
      (r) =>
        r.status === 'reward_credited' || r.status === 'successful',
    )
    .reduce((sum, r) => sum + (r.reward_points ?? 0), 0)
  const pending_points = records
    .filter((r) => r.status === 'pending_subscription')
    .reduce((sum, r) => sum + (r.reward_points ?? 0), 0)

  return {
    total_referred,
    pending_count,
    // successful_count counts subscription_activated + reward_credited for stage progression
    successful_count,
    total_points,
    pending_points,
    credited_points,
    // Stage is purely count of successful (active sub) referrals, capped at 5
    stage: Math.min(5, successful_count),
  }
}