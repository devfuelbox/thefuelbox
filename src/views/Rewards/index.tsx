import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, Badge, Button } from '@/components/ui'
import { AdReplace } from '@/components/advertisement/AdManager'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/lib/constants'
import {
  fetchReferralRecords,
  fetchReferralTransactions,
  computeReferralStats,
  fetchUserRewards,
  fetchRewardTransactions,
  addRewardTransaction,
} from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type { ReferralTransaction, ReferralStats } from '@/types/referral'
import type { RewardTransaction as DbRewardTransaction } from '@/types/rewards'

export default function Rewards() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [rewardPoints, setRewardPoints] = useState(0)
  const [referralEarned, setReferralEarned] = useState(0)
  const [dayStreak, setDayStreak] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [transactions, setTransactions] = useState<DbRewardTransaction[]>([])

  const backfillBusy = useRef(false)

  // ── Section 2: Referral Reward Points (independent system) ──
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    total_referred: 0,
    pending_count: 0,
    successful_count: 0,
    total_points: 0,
    pending_points: 0,
    credited_points: 0,
    stage: 1,
  })
  const [referralTxns, setReferralTxns] = useState<ReferralTransaction[]>([])
  const [pendingReferrals, setPendingReferrals] = useState<{ id: string; friend_name: string; created_at: string }[]>([])
  const [referralLoading, setReferralLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    const load = async () => {
      // Fetch rewards summary from user_rewards table
      const rewards = await fetchUserRewards(user.id)
      setRewardPoints(rewards?.total_points ?? 0)
      setReferralEarned((rewards?.referral_balance ?? 0) / 10)

      // Fetch all reward transactions
      const txns = await fetchRewardTransactions(user.id)
      setTransactions(txns ?? [])

      // Count orders for total orders display
      const supabase = getSupabaseClient()
      if (supabase) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setTotalOrders(count ?? 0)

        // Compute day streak from order dates
        const { data: orders } = await supabase
          .from('orders')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (orders && orders.length > 0) {
          const dates = [...new Set((orders as any[]).map((o) => (o.created_at as string).split('T')[0]))].sort().reverse()
          let streak = 1
          for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1])
            const curr = new Date(dates[i])
            const diff = (prev.getTime() - curr.getTime()) / 86400000
            if (Math.abs(diff - 1) < 0.1) streak++
            else break
          }
          setDayStreak(streak)
        }

        // Reward any confirmed orders not yet rewarded (idempotent)
        if (backfillBusy.current) return
        backfillBusy.current = true
        const rewardedOrderIds = new Set(
          (txns ?? []).filter(t => t.reference_id).map(t => t.reference_id)
        )
        const { data: allOrders } = await supabase
          .from('orders')
          .select('id, selected_meals, created_at')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: true })

        try {
          if (allOrders && allOrders.length > 0) {
            for (const o of allOrders as any[]) {
              const orderId = String(o.id)
              if (rewardedOrderIds.has(orderId)) continue
              const meals = typeof o.selected_meals === 'string'
                ? JSON.parse(o.selected_meals)
                : (o.selected_meals ?? [])
              const mealCount = Array.isArray(meals) ? meals.length : 1
              const pts = mealCount * 50
              await addRewardTransaction(
                user.id,
                pts,
                'earned',
                `Order #${orderId} — ${mealCount} meal(s) (+${pts} pts)`,
                orderId,
              )
            }
            // Re-fetch rewards after backfill
            const updatedRewards = await fetchUserRewards(user.id)
            setRewardPoints(updatedRewards?.total_points ?? 0)
            const updatedTxns = await fetchRewardTransactions(user.id)
            setTransactions(updatedTxns ?? [])
          }
        } finally {
          backfillBusy.current = false
        }

        // ── Load referral data for display ──
        setReferralLoading(true)
        const refRecords = await fetchReferralRecords(user.id)
        setReferralStats(computeReferralStats(refRecords))
        setReferralTxns(await fetchReferralTransactions(user.id))
        setPendingReferrals(
          refRecords
            .filter(r => r.status === 'pending_subscription')
            .map(r => ({ id: r.id, friend_name: r.friend_name, created_at: r.created_at }))
        )
        // Re-fetch rewards so referral_balance reflects any new referral_bonus txns
        const refRewards = await fetchUserRewards(user.id)
        setRewardPoints(refRewards?.total_points ?? 0)
        setReferralEarned((refRewards?.referral_balance ?? 0) / 10)
        setReferralLoading(false)
      }
    }

    load()
  }, [user])

  // Conversion rate: 100 points = ₹10
  const pointsToRupees = (pts: number) => (pts / 10).toFixed(0)

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back to Profile */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(ROUTES.PROFILE)}
        className="mb-6 !text-gray-500 hover:!text-brand-600 !px-0 !py-0"
        leftIcon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        }
      >
        Back to Profile
      </Button>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 font-heading">My Rewards</h1>
          <p className="text-sm text-gray-500 font-medium">Track your points, savings, and streaks</p>
        </div>
      </div>

      <AdReplace position="Rewards Page">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Reward Points */}
          <Card padding="none" className="overflow-hidden transition-all duration-300">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reward Points</p>
              <p className="mt-1 text-4xl font-extrabold text-amber-600 font-heading">{rewardPoints.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500 font-medium">Worth ₹{pointsToRupees(rewardPoints)}</p>
            </div>
          </Card>

        {/* Money Saved */}
        <Card padding="none" className="overflow-hidden transition-all duration-300">
          <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Referral Earnings</p>
            <p className="mt-1 text-4xl font-extrabold text-green-600 font-heading">₹{referralEarned.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500 font-medium">Money received from referrals</p>
          </div>
        </Card>

        {/* Day Streak */}
        <Card padding="none" className="overflow-hidden transition-all duration-300">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-500" />
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
              <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Day Streak</p>
            <p className="mt-1 text-4xl font-extrabold text-orange-500 font-heading">{dayStreak}</p>
            <p className="mt-1 text-xs text-gray-500 font-medium">Consecutive order days</p>
          </div>
        </Card>

        {/* Total Orders */}
        <Card padding="none" className="overflow-hidden transition-all duration-300">
          <div className="h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Orders</p>
            <p className="mt-1 text-4xl font-extrabold text-blue-600 font-heading">{totalOrders}</p>
            <p className="mt-1 text-xs text-gray-500 font-medium">Meals delivered</p>
          </div>
        </Card>
      </div>
      </AdReplace>

      {/* ─── How Points Work ─── */}
      <Card className="mb-8 shadow-sm border-amber-100 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <h2 className="text-lg font-bold text-gray-900 font-heading flex items-center gap-2">
          <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How Rewards Work
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3 transition-all duration-300">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">1</div>
            <div>
              <p className="text-sm font-bold text-gray-800">Order Meals</p>
              <p className="text-xs text-gray-500">Earn <strong className="text-amber-600">50 points</strong> on every meal order</p>
            </div>
          </div>
          <div className="flex items-start gap-3 transition-all duration-300">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">2</div>
            <div>
              <p className="text-sm font-bold text-gray-800">Redeem Rewards</p>
              <p className="text-xs text-gray-500"><strong className="text-green-600">100 pts = ₹10</strong> off on your next subscription</p>
            </div>
          </div>
              {/* Refer a Friend */}
              <div className="flex items-start gap-3 transition-all duration-300">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">3</div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Refer a Friend</p>
                  <p className="text-xs text-gray-500">
                    Get upto <strong className="text-amber-600">₹450</strong> on your fuel box account when a referred friend
                    completes a successful monthly subscription.
                  </p>
                </div>
              </div>
          </div>
          <div className="sm:col-span-3 flex justify-center mt-4">
            <p> </p>
          </div>
            {/* Referral program note */}
<div className="p-4 bg-amber-50 rounded-lg">
  <p className="text-sm text-gray-500">
    Note: The credited points and amount will be added to your fuel box account and can only be used on your next meal subscription. 
          Please read the{' '}
          <Link to={ROUTES.TERMS} className="font-medium transition-colors duration-200" style={{ color: '#16a34a' }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#ea580c'}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#16a34a'}
          >terms and conditions</Link>{' '}
          fully before making a payment.
  </p>
</div>
            

      </Card>

      {/* ─── Transaction History ─── */}
      <Card className="shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 font-heading">Reward History</h2>
          {transactions.length > 0 && (
            <Badge variant="brand">{transactions.length} transactions</Badge>
          )}
        </div>

        {transactions.length > 0 ? (
          <div className="mt-4 divide-y divide-gray-50">
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-3 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    txn.type === 'earned' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {txn.type === 'earned' ? (
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{txn.description}</p>
                    <p className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(txn.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${
                  txn.type === 'earned' ? 'text-green-600' : 'text-red-500'
                }`}>
                  {txn.type === 'earned' ? '+' : '-'}{txn.points} pts
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-500">No rewards yet</p>
            <p className="mt-1 text-sm text-gray-400">Start ordering to earn points!</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-5"
              onClick={() => navigate(ROUTES.MENU)}
            >
              Order Now
            </Button>
          </div>
        )}
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 – Referral Reward Points (completely separate system)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-12 border-t-2 border-dashed border-gray-200 pt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl shadow"
            style={{ background: 'linear-gradient(135deg, #e8510a, #fb923c)' }}>
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 font-heading">Referral Reward Points</h2>
            <p className="text-sm text-gray-500">Earned only when your referred friend activates their first subscription</p>
          </div>
        </div>

        {/* Referral Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Card padding="none" className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-500" />
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Referral Points</p>
              {referralLoading ? (
                <div className="mt-1 h-10 w-20 mx-auto bg-gray-100 animate-pulse rounded" />
              ) : (
                <p className="mt-1 text-4xl font-extrabold font-heading" style={{ color: '#e8510a' }}>
                  {referralStats.total_points.toLocaleString()}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 font-medium">Across all referrals</p>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-500" />
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Referrals</p>
              {referralLoading ? (
                <div className="mt-1 h-10 w-20 mx-auto bg-gray-100 animate-pulse rounded" />
              ) : (
                <p className="mt-1 text-4xl font-extrabold text-amber-500 font-heading">
                  {referralStats.pending_count}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 font-medium">Awaiting first subscription</p>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Credited Referrals</p>
              {referralLoading ? (
                <div className="mt-1 h-10 w-20 mx-auto bg-gray-100 animate-pulse rounded" />
              ) : (
                <p className="mt-1 text-4xl font-extrabold text-green-600 font-heading">
                  {referralStats.successful_count}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 font-medium">{referralStats.credited_points} pts credited</p>
            </div>
          </Card>
        </div>

        {/* Pending info banner */}
        {!referralLoading && referralStats.pending_count > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {referralStats.pending_count} friend{referralStats.pending_count > 1 ? 's have' : ' has'} not activated a subscription yet
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Referral Reward Points are credited only after your friend purchases and activates their first subscription. 
                Once they subscribe, your points will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* Referral Transaction History */}
        <Card className="shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-lg font-bold text-gray-900 font-heading">Referral Points History</h3>
            {referralTxns.length > 0 && (
              <Badge variant="brand">{referralTxns.length} entries</Badge>
            )}
          </div>

          {referralLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : pendingReferrals.length > 0 || referralTxns.length > 0 ? (
            <div className="mt-4 divide-y divide-gray-50">
              {pendingReferrals.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
                      <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.friend_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
                </div>
              ))}
              {referralTxns.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      txn.type === 'earned' ? 'bg-green-50' : txn.type === 'pending' ? 'bg-amber-50' : 'bg-red-50'
                    }`}>
                      {txn.type === 'earned' ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      ) : txn.type === 'pending' ? (
                        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{txn.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${
                    txn.type === 'earned' ? 'text-green-600' : txn.type === 'pending' ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {txn.type === 'earned' ? '+' : txn.type === 'pending' ? '~' : '-'}{txn.points} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
                <svg className="h-8 w-8" style={{ color: '#e8510a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-500">No referral rewards yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Share your code and earn points when friends subscribe!
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-5"
                onClick={() => navigate(ROUTES.REFERRALS)}
              >
                Go to Referrals
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}
