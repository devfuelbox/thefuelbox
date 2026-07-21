import { useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Badge, Button } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import {
  fetchReferralRecords,
  fetchReferralTransactions,
  computeReferralStats,
} from '@/lib/api'
import { ROUTES } from '@/lib/constants'
import type { ReferralRecord, ReferralTransaction, ReferralStats } from '@/types/referral'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatPlanName(planId: string | null) {
  if (!planId) return null
  const map: Record<string, string> = {
    weekly5: 'Weekly (5 days)',
    monthly20: 'Monthly Basic (20 days)',
    monthly24: 'Monthly Plus (24 days)',
    monthly30: 'Monthly Premium (30 days)',
  }
  return map[planId] ?? planId
}

type StatusConfig = {
  label: string
  emoji: string
  bg: string
  color: string
  border: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  pending_subscription: {
    label: 'Pending Subscription',
    emoji: '🟡',
    bg: '#fefce8',
    color: '#92400e',
    border: '#fde68a',
  },
  subscription_activated: {
    label: 'Subscription Active',
    emoji: '🔵',
    bg: '#eff6ff',
    color: '#1e40af',
    border: '#bfdbfe',
  },
  reward_credited: {
    label: 'Reward Credited',
    emoji: '🟢',
    bg: '#f0fdf4',
    color: '#166534',
    border: '#bbf7d0',
  },
  successful: {
    label: 'Reward Credited',
    emoji: '🟢',
    bg: '#f0fdf4',
    color: '#166534',
    border: '#bbf7d0',
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    emoji: '•',
    bg: '#f3f4f6',
    color: '#374151',
    border: '#e5e7eb',
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.65rem',
        borderRadius: '100px',
        fontSize: '0.78rem',
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>—</span>
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Active', color: '#166534', bg: '#dcfce7' },
    pending: { label: 'Pending', color: '#92400e', bg: '#fef9c3' },
    paused: { label: 'Paused', color: '#1e40af', bg: '#dbeafe' },
    expired: { label: 'Expired', color: '#6b7280', bg: '#f3f4f6' },
    cancelled: { label: 'Cancelled', color: '#991b1b', bg: '#fee2e2' },
  }
  const cfg = map[status.toLowerCase()] ?? { label: status, color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.1rem 0.5rem', borderRadius: '100px',
      fontSize: '0.72rem', fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function Skeleton({ w = '100%', h = '1rem', r = '0.4rem' }: { w?: string; h?: string; r?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '80px'})`,
        opacity: visible ? 1 : 0,
        transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        background: '#16a34a',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        borderRadius: '100px',
        fontWeight: 600,
        fontSize: '0.9rem',
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(22,163,74,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      ✓ {msg}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string
  value: string | number
  icon: string
  color: string
  loading: boolean
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div style={{ height: '4px', background: color }} />
      <div style={{ padding: '1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{icon}</div>
        {loading ? (
          <Skeleton w="60px" h="1.75rem" r="0.4rem" />
        ) : (
          <p style={{ fontSize: '1.875rem', fontWeight: 900, color, lineHeight: 1, margin: 0 }}>
            {value}
          </p>
        )}
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0', fontWeight: 500 }}>
          {label}
        </p>
      </div>
    </Card>
  )
}

function RewardMatrixInfo() {
  const plans = [
    { days: 7, label: 'Weekly (7 Days)' },
    { days: 20, label: 'Monthly (20 Days)' },
    { days: 24, label: 'Monthly Plus (24 Days)' },
    { days: 30, label: 'Premium (30 Days)' },
  ]
  const matrix: Record<number, number[]> = {
    7: [100, 150, 200, 250, 300],
    20: [150, 200, 250, 300, 350],
    24: [200, 250, 300, 350, 400],
    30: [250, 300, 350, 400, 450],
  }

  return (
    <Card className="overflow-x-auto">
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.75rem' }}>
        🎁 Reward Matrix
      </h3>
      <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
        Rewards (in ₹) based on referral number and plan purchased (first 5 referrals only)
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>
              Plan
            </th>
            {[1, 2, 3, 4, 5].map((n) => (
              <th key={n} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>
                {n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.map(({ days, label }) => (
            <tr key={days} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#374151' }}>{label}</td>
              {matrix[days].map((pts, i) => (
                <td key={i} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                  ₹{pts}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/** Show subscription detail grid for a referral record */
function SubscriptionDetails({ r, stageContribution }: { r: ReferralRecord; stageContribution: number }) {
  const planName = formatPlanName(r.subscription_plan)

  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '0.75rem',
      borderRadius: '0.625rem',
      background: '#f8faff',
      border: '1px solid #e0e7ff',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '0.6rem 1rem',
    }}>
      <div>
        <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Subscription</p>
        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: r.subscription_purchased ? '#111827' : '#9ca3af', margin: '0.15rem 0 0' }}>
          {r.subscription_purchased ? 'Purchased ✓' : 'Not purchased'}
        </p>
      </div>
      {planName && (
        <div>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Plan</p>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', margin: '0.15rem 0 0' }}>{planName}</p>
        </div>
      )}
      {r.subscription_status && (
        <div>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Status</p>
          <div style={{ marginTop: '0.2rem' }}>
            <SubStatusBadge status={r.subscription_status} />
          </div>
        </div>
      )}
      {r.subscription_start_date && (
        <div>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Start Date</p>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', margin: '0.15rem 0 0' }}>{formatDate(r.subscription_start_date)}</p>
        </div>
      )}
      {r.subscription_end_date && (
        <div>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>End Date</p>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', margin: '0.15rem 0 0' }}>{formatDate(r.subscription_end_date)}</p>
        </div>
      )}
      <div>
        <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Stage Contribution</p>
        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: stageContribution > 0 ? '#7c3aed' : '#9ca3af', margin: '0.15rem 0 0' }}>
          {stageContribution > 0 ? `Stage ${stageContribution}` : 'Stage 0 (Pending)'}
        </p>
      </div>
    </div>
  )
}

export default function ReferralManagement() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── TanStack Query: Referral Records ──────────────────────────────
  const {
    data: records = [],
    isLoading: recordsLoading,
    error: recordsError,
  } = useQuery<ReferralRecord[]>({
    queryKey: ['referral-records', user?.id],
    queryFn: () => fetchReferralRecords(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    retry: 2,
  })

  // ── TanStack Query: Referral Transactions ─────────────────────────
  const {
    data: transactions = [],
    isLoading: txnsLoading,
  } = useQuery<ReferralTransaction[]>({
    queryKey: ['referral-transactions', user?.id],
    queryFn: () => fetchReferralTransactions(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    retry: 2,
  })

  const isLoading = recordsLoading || txnsLoading

  // Compute stats from records
  const stats: ReferralStats = useMemo(() => {
    if (records.length === 0) {
      return {
        total_referred: 0, pending_count: 0, successful_count: 0,
        total_points: 0, pending_points: 0, credited_points: 0,
        stage: 0,
      }
    }
    return computeReferralStats(records)
  }, [records])

  // Stage contribution per friend: sorted chronologically among successful ones
  const stageContributionMap = useMemo(() => {
    const map = new Map<string, number>()
    const successful = [...records]
      .filter((r) =>
        r.status === 'subscription_activated' ||
        r.status === 'reward_credited' ||
        r.status === 'successful'
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    successful.forEach((r, idx) => {
      map.set(r.id, idx + 1) // Stage 1 = first successful referral
    })

    return map
  }, [records])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }, [])

  const referralCode = user?.referral_id ?? 'Loading…'
  const referralLink = `https://fuelbox.in/register?ref=${referralCode}`

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(referralCode).then(() => showToast('Referral code copied!'))
  }, [referralCode, showToast])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => showToast('Link copied to clipboard!'))
  }, [referralLink, showToast])

  const handleWhatsApp = useCallback(() => {
    const msg = encodeURIComponent(
      `🔥 Join me on Fuel Box – India's best fitness meal service!\n\nUse my referral code *${referralCode}* and get exclusive rewards on your first order.\n\n👉 Sign up here: ${referralLink}\n\nEat smart. Train hard. 💪`,
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }, [referralCode, referralLink])

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Fuel Box!',
          text: `Use my referral code ${referralCode} to get rewards on Fuel Box!`,
          url: referralLink,
        })
      } catch {}
    } else {
      handleCopyLink()
    }
  }, [referralCode, referralLink, handleCopyLink])

  const handleTelegram = useCallback(() => {
    const msg = encodeURIComponent(`🔥 Join Fuel Box with my referral code *${referralCode}*: ${referralLink}`)
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${msg}`, '_blank')
  }, [referralCode, referralLink])

  const handleTwitter = useCallback(() => {
    const msg = encodeURIComponent(
      `Loving @FuelBoxIndia! Use my code ${referralCode} to get rewards on your first order 🥗💪 ${referralLink}`,
    )
    window.open(`https://twitter.com/intent/tweet?text=${msg}`, '_blank')
  }, [referralCode, referralLink])

  const filteredRecords = useMemo(() => {
    let list = [...records]

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (r) =>
          r.friend_name.toLowerCase().includes(q) ||
          r.friend_email.toLowerCase().includes(q) ||
          r.referral_code.toLowerCase().includes(q),
      )
    }

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter)
    }

    if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return list
  }, [records, search, statusFilter, sortOrder])

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes expandDown {
          from { opacity: 0; transform: scaleY(0); transform-origin: top; }
          to   { opacity: 1; transform: scaleY(1); transform-origin: top; }
        }
        .ref-btn {
          border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem;
          border-radius: 0.6rem; padding: 0.55rem 1rem;
          display: inline-flex; align-items: center; gap: 0.5rem;
          transition: transform 0.18s, filter 0.18s;
        }
        .ref-btn:hover  { transform: scale(1.04); filter: brightness(1.07); }
        .ref-btn:active { transform: scale(0.97); }
        .ref-filter-btn {
          border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
          padding: 0.35rem 0.875rem; border-radius: 100px; font-size: 0.8rem;
          font-weight: 600; color: #6b7280; transition: all 0.18s;
        }
        .ref-filter-btn.active {
          background: #e8510a; color: #fff; border-color: #e8510a;
        }
        .ref-filter-btn:hover:not(.active) { border-color: #e8510a; color: #e8510a; }
        .ref-card-row {
          cursor: pointer;
          transition: background 0.15s;
          border-radius: 0.5rem;
          padding: 0.875rem 0.625rem;
        }
        .ref-card-row:hover { background: #fafafa; }
      `}</style>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8" style={{ animation: 'fadeInUp 0.4s ease' }}>

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
          <div className="flex items-center justify-center h-12 w-12 rounded-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #e8510a, #fb923c)' }}>
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 font-heading">Referral Program</h1>
            <p className="text-sm text-gray-500 font-medium">Share your code → Friend subscribes → You earn rewards</p>
          </div>
        </div>

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Referred" value={stats.total_referred} icon="👥" color="#e8510a" loading={isLoading} />
          <StatCard label="Pending" value={stats.pending_count} icon="🟡" color="#d97706" loading={isLoading} />
          <StatCard label="Successful" value={stats.successful_count} icon="🟢" color="#16a34a" loading={isLoading} />
          <StatCard label="Referral ₹" value={stats.total_points} icon="⭐" color="#7c3aed" loading={isLoading} />
          <StatCard label={`Stage ${stats.stage} of 5`} value={`${stats.stage}/5`} icon="🚀" color="#10b981" loading={isLoading} />
        </div>

        {/* Stage Progress Bar */}
        {!isLoading && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280' }}>Referral Stage Progress</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e8510a' }}>{stats.stage} / 5 successful referrals</span>
            </div>
            <div style={{ height: '8px', borderRadius: '100px', background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(stats.stage / 5) * 100}%`,
                borderRadius: '100px',
                background: 'linear-gradient(90deg, #e8510a, #fb923c)',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <span key={s} style={{ fontSize: '0.68rem', color: s <= stats.stage ? '#e8510a' : '#d1d5db', fontWeight: 700 }}>
                  {s === 0 ? 'Start' : `S${s}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Referral Code Share Panel ── */}
        <Card className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 font-heading mb-4">Your Referral Code</h2>

          {/* Code Display */}
          <div
            style={{
              background: '#fff7ed', border: '2px dashed #fb923c',
              borderRadius: '0.875rem', padding: '1rem 1.25rem',
              marginBottom: '1rem',
            }}
            className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left"
          >
            <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.1em', color: '#e8510a' }} className="flex-1 w-full sm:w-auto">
              {referralCode}
            </span>
            <button id="copy-code-btn" className="ref-btn w-full sm:w-auto justify-center" onClick={handleCopyCode}
              style={{ background: '#e8510a', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy Code
            </button>
          </div>

          {/* Link */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4 items-stretch sm:items-center">
            <span style={{ fontSize: '0.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }} className="flex-1 w-full text-center sm:text-left">
              {referralLink}
            </span>
            <button id="copy-link-btn" className="ref-btn w-full sm:w-auto justify-center" onClick={handleCopyLink}
              style={{ background: '#f3f4f6', color: '#374151', flexShrink: 0 }}>
              Copy Link
            </button>
          </div>

          {/* Share Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button id="share-whatsapp-btn" className="ref-btn" onClick={handleWhatsApp}
              style={{ background: '#25D366', color: '#fff', flex: '1 1 130px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </button>
            <button id="share-telegram-btn" className="ref-btn" onClick={handleTelegram}
              style={{ background: '#0088cc', color: '#fff', flex: '1 1 120px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Telegram
            </button>
            <button id="share-twitter-btn" className="ref-btn" onClick={handleTwitter}
              style={{ background: '#000', color: '#fff', flex: '1 1 100px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
              </svg>
              Share on X
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button id="native-share-btn" className="ref-btn" onClick={handleNativeShare}
                style={{ background: '#e8510a', color: '#fff', flex: '1 1 90px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                More
              </button>
            )}
          </div>
        </Card>

        {/* ── How It Works ── */}
        <Card className="mb-8 bg-gradient-to-br from-orange-50/60 to-amber-50/40 border-orange-100">
          <h2 className="text-base font-bold text-gray-900 font-heading mb-4">📖 How Referral Rewards Work</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { num: '1', icon: '📤', title: 'Share Your Code', desc: 'Send your unique referral code to friends via WhatsApp, Telegram, or any platform.' },
              { num: '2', icon: '🙋', title: 'Friend Signs Up', desc: 'Your friend registers on Fuel Box using your referral code.' },
              { num: '3', icon: '🎉', title: 'Friend Subscribes', desc: 'Once they activate their first subscription, you earn rewards (₹) based on the plan they chose.' },
            ].map((step) => (
              <div key={step.num} className="flex gap-3 items-start bg-white rounded-xl p-4 border border-orange-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #e8510a, #fb923c)' }}>
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{step.icon} {step.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-4">
            ⚠️ Referral rewards are only credited after the referred friend <strong>activates their first subscription</strong>. Rewards for the first 5 successful referrals only.
          </p>
        </Card>

        {/* ── Reward Matrix ── */}
        <div className="mb-8">
          <RewardMatrixInfo />
        </div>

        {/* ── Referral History ── */}
        <Card>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900 font-heading flex-1">
              👥 Your Referrals
              {!isLoading && records.length > 0 && (
                <Badge variant="brand" className="ml-2 text-xs">{records.length} friends</Badge>
              )}
            </h2>
          </div>

          {/* Error state */}
          {recordsError && (
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ⚠️ Unable to load referral data. Please refresh the page.
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="referral-search-input"
              type="text"
              placeholder="Search by name, email or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '2.25rem', paddingRight: '1rem',
                paddingTop: '0.5rem', paddingBottom: '0.5rem',
                border: '1px solid #e5e7eb', borderRadius: '0.625rem',
                fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#e8510a' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
            />
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mr-1">Filter:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'pending_subscription', label: '🟡 Pending' },
              { key: 'subscription_activated', label: '🔵 Active' },
              { key: 'reward_credited', label: '🟢 Rewarded' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`ref-filter-btn ${statusFilter === key ? 'active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400 font-semibold uppercase tracking-wider">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              style={{
                border: '1px solid #e5e7eb', borderRadius: '100px',
                padding: '0.3rem 0.75rem', fontSize: '0.8rem', background: '#fff',
                color: '#374151', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          {/* Records */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Skeleton w="2.5rem" h="2.5rem" r="50%" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Skeleton w="50%" h="0.85rem" />
                    <Skeleton w="35%" h="0.7rem" />
                  </div>
                  <Skeleton w="120px" h="1.5rem" r="100px" />
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
                {records.length === 0 ? '🙈' : '🔍'}
              </div>
              <p style={{ fontWeight: 600, color: '#6b7280', margin: '0 0 0.25rem' }}>
                {records.length === 0 ? 'No referrals yet' : 'No results match your search'}
              </p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                {records.length === 0 ? 'Share your code above and start earning rewards!' : 'Try a different search or filter.'}
              </p>
            </div>
          ) : (
            <div>
              {filteredRecords.map((r, idx) => {
                const isExpanded = expandedId === r.id
                const stageContrib = stageContributionMap.get(r.id) ?? 0

                return (
                  <div
                    key={r.id}
                    style={{
                      borderBottom: idx < filteredRecords.length - 1 ? '1px solid #f3f4f6' : 'none',
                    }}
                  >
                    {/* Row */}
                    <div
                      className="ref-card-row"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                          background: `hsl(${(idx * 47) % 360}, 60%, 55%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0,
                        }}
                      >
                        {getInitials(r.friend_name)}
                      </div>

                      {/* Main Info */}
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                          {r.friend_name}
                        </p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                          {r.friend_email || '—'} · Joined {formatDate(r.created_at)}
                        </p>
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                          Code: <code style={{ background: '#f3f4f6', padding: '0 0.3rem', borderRadius: '0.25rem' }}>{r.referral_code}</code>
                          <span style={{ marginLeft: '0.5rem', color: '#d1d5db' }}>· Click to {isExpanded ? 'collapse' : 'view details'} ↕</span>
                        </p>
                      </div>

                      {/* Status + Points */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                        <StatusBadge status={r.status} />
                        {r.reward_points > 0 ? (
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                            +₹{r.reward_points}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>₹0 pending</span>
                        )}
                        {stageContrib > 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '0.1rem 0.4rem', borderRadius: '100px' }}>
                            Stage {stageContrib}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable subscription details */}
                    {isExpanded && (
                      <div style={{ paddingBottom: '0.875rem', paddingLeft: '3.25rem', animation: 'expandDown 0.2s ease' }}>
                        <SubscriptionDetails r={r} stageContribution={stageContrib} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Referral Transaction History ── */}
        {transactions.length > 0 && (
          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900 font-heading">⭐ Referral History</h2>
              <Badge variant="brand">{transactions.length} entries</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {transactions.map((txn, idx) => (
                <div
                  key={txn.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.75rem 0',
                    borderBottom: idx < transactions.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '2.25rem', height: '2.25rem', borderRadius: '50%',
                      background: txn.type === 'earned' ? '#f0fdf4' : '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.description}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                      {formatDate(txn.created_at)}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: txn.type === 'earned' ? '#16a34a' : '#ef4444', flexShrink: 0 }}>
                    {txn.type === 'earned' ? '+' : '-'}₹{txn.points}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Back to profile */}
        <div className="mt-8 text-center">
          <Link to={ROUTES.PROFILE} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to Profile
          </Link>
        </div>
      </section>

      <Toast msg={toast} visible={toastVisible} />
    </>
  )
}
