import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import { ROUTES } from '@/lib/constants';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { analyzeCartSuitabilityAI, type CartSuitabilityResult } from '@/lib/ai-service';
import { getProfile, defaultDailyTargets } from '@/lib/profile';
import { storage } from '@/lib/storage';
import type { Goal, Gender } from '@/lib/profile';

/* ─── Score Ring (SVG circular gauge) ─── */
function ScoreRing({ score, grade, size = 180 }: { score: number; grade: string; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const glow =
    score >= 80 ? '0 0 24px rgba(34,197,94,0.5)' : score >= 60 ? '0 0 24px rgba(245,158,11,0.4)' : '0 0 24px rgba(239,68,68,0.4)';

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="drop-shadow-lg" style={{ filter: `drop-shadow(${glow})` }}>
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        {/* Score ring */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Score text */}
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className="fill-gray-900 text-4xl font-extrabold" style={{ fontSize: '2.4rem', fontWeight: 800 }}>
          {score}
        </text>
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="central" className="fill-gray-500 text-xs font-semibold" style={{ fontSize: '0.75rem' }}>
          out of 100
        </text>
      </svg>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-3 rounded-full px-4 py-1 text-sm font-bold"
        style={{
          backgroundColor: score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : score >= 40 ? '#ffedd5' : '#fee2e2',
          color: score >= 80 ? '#166534' : score >= 60 ? '#92400e' : score >= 40 ? '#9a3412' : '#991b1b',
        }}
      >
        {grade}
      </motion.span>
    </div>
  );
}

/* ─── Macro Bar ─── */
function MacroBar({ label, total, target, pct, icon, color }: { label: string; total: number; target: number; pct: number; icon: string; color: string }) {
  const clampedPct = Math.min(pct, 120);
  const barColor = pct > 80 ? (pct > 100 ? 'bg-red-500' : 'bg-amber-500') : color;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-gray-700">
          <span>{icon}</span> {label}
        </span>
        <span className="text-gray-500 font-medium">
          {total.toFixed(0)}<span className="text-gray-400">/{target}</span>
          <span className="ml-1 text-xs text-gray-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(clampedPct, 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

/* ─── Feedback Section ─── */
function FeedbackSection({ items, type }: { items: string[]; type: 'strength' | 'warning' | 'recommendation' }) {
  if (!items || items.length === 0) return null;
  const config = {
    strength: { icon: '💪', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', title: 'Strengths' },
    warning: { icon: '⚠️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', title: 'Warnings' },
    recommendation: { icon: '💡', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', title: 'Recommendations' },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className={`rounded-xl border ${config.border} ${config.bg} p-4`}
    >
      <h3 className={`font-bold ${config.text} mb-2`}>{config.icon} {config.title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className={`text-sm ${config.text} flex items-start gap-2`}>
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ─── Tag Badge ─── */
function TagBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    'Protein Rich': 'bg-purple-100 text-purple-700',
    'Low Calorie': 'bg-green-100 text-green-700',
    'Low Fat': 'bg-teal-100 text-teal-700',
    'High Fiber': 'bg-amber-100 text-amber-700',
    'Low Carb': 'bg-sky-100 text-sky-700',
    'Lean Protein': 'bg-indigo-100 text-indigo-700',
    'Energy Dense': 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[tag] || 'bg-gray-100 text-gray-600'}`}>
      {tag}
    </span>
  );
}

/* ─── Main Summary Page ─── */
export default function Summary() {
  const { items, totalPrice } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [result, setResult] = useState<CartSuitabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);

  // Build user profile from auth store or fallback
  const userProfile = useMemo(() => {
    if (user) {
      const dobDate = user.dob ? new Date(user.dob) : null;
      let age = 25;
      if (dobDate && !isNaN(dobDate.getTime())) {
        const ageDifMs = Date.now() - dobDate.getTime();
        const ageDate = new Date(ageDifMs);
        age = Math.abs(ageDate.getUTCFullYear() - 1970);
      }
      let goal: string = user.fitness_goal || 'maintenance';
      return {
        age,
        gender: (user.gender || 'male') as string,
        goal,
        heightCm: Number(user.height) || 170,
        weightKg: Number(user.weight) || 70,
        dietType: user.diet_type || undefined,
        healthIssues: user.health_issues || undefined,
      };
    }
    const p = getProfile();
    return {
      age: p.age,
      gender: p.gender,
      goal: p.goal,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      dietType: p.dietType,
    };
  }, [user]);

  // Get daily targets from latest assessment or calculate defaults
  const targets = useMemo(() => {
    const latest = storage.latestAssessment();
    if (latest?.dailyTargets) return latest.dailyTargets;
    // Build a Profile object for defaultDailyTargets
    const p = getProfile();
    const profileObj = {
      age: userProfile.age,
      gender: (userProfile.gender as Gender) || p.gender,
      heightCm: userProfile.heightCm,
      weightKg: userProfile.weightKg,
      goal: (userProfile.goal as Goal) || p.goal,
      activityLevel: p.activityLevel,
    };
    return defaultDailyTargets(profileObj);
  }, [userProfile]);

  // Run analysis
  useEffect(() => {
    if (items.length === 0) {
      setLoading(false);
      return;
    }

    const cartItems = items.map(ci => ({
      id: ci.menuItem.id,
      name: ci.menuItem.name,
      quantity: ci.quantity,
      calories: ci.menuItem.calories,
      protein: ci.menuItem.protein,
      carbs: ci.menuItem.carbs,
      fat: ci.menuItem.fat,
      fiber: ci.menuItem.fiber,
      category: ci.menuItem.category,
      diet: ci.menuItem.diet,
    }));

    // Caching based on cart items & user profile so it does not reload/change on refresh
    const cartKey = items.map(ci => `${ci.menuItem.id}:${ci.quantity}`).sort().join(',');
    const profileKey = `${userProfile.goal}:${userProfile.age}:${userProfile.weightKg}:${userProfile.heightCm}:${userProfile.dietType || ''}`;
    const targetKey = `${targets.calories}:${targets.protein}:${targets.carbs}:${targets.fat}:${targets.fiber || ''}`;
    const cacheKey = `summary_cache_${user?.id || 'guest'}_${cartKey}_${profileKey}_${targetKey}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setResult(JSON.parse(cached));
        setLoading(false);
        setTimeout(() => setAnimateIn(true), 100);
        return;
      } catch (e) {
        // Fallback to fetch if parse fails
      }
    }

    setLoading(true);
    analyzeCartSuitabilityAI({ items: cartItems, userProfile, targets })
      .then(res => {
        localStorage.setItem(cacheKey, JSON.stringify(res));
        setResult(res);
        setLoading(false);
        setTimeout(() => setAnimateIn(true), 100);
      })
      .catch(() => setLoading(false));
  }, [items, userProfile, targets, user]);

  // Empty cart
  if (!loading && items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-gray-900 font-heading">Nutrition Summary</h1>
        <p className="mt-4 text-gray-600">Your cart is empty. Add some meals first!</p>
        <Link to={ROUTES.MENU}>
          <Button className="mt-6">Browse Menu</Button>
        </Link>
      </section>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-gray-600 font-medium animate-pulse">Analyzing your nutrition...</p>
      </div>
    );
  }

  if (!result) return null;

  const { score, grade, strengths, warnings, recommendations, macroBreakdown } = result;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-50/30 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => navigate(ROUTES.CART)} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-brand-200">Back to Cart</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight font-heading">Nutrition Summary</h1>
            <p className="mt-1 text-brand-100 text-sm">AI-powered analysis of your meal selection</p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animateIn ? 1 : 0, y: animateIn ? 0 : 20 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-8 shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={score} grade={grade} />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-extrabold text-gray-900">Meal Suitability Score</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Based on your profile ({userProfile.gender}, {userProfile.age}yrs, {userProfile.weightKg}kg) and your {userProfile.goal.replace(/_/g, ' ')} goal.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    🍽️ {items.length} items
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    🔥 {macroBreakdown.calories.total} cal
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    💪 {macroBreakdown.protein.total}g protein
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Low Suitability Score Action Banner (Score < 50%) */}
        {score < 50 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animateIn ? 1 : 0, y: animateIn ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6"
          >
            <Card className="p-6 border border-red-200 bg-red-50/70 shadow-md text-center flex flex-col items-center gap-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h4 className="text-lg font-bold text-red-950">Nutritional Suitability is Low</h4>
                <p className="text-sm text-red-700 mt-1 max-w-lg">
                  Your current meal cart suitability is at {score}%. To better align with your {userProfile.goal.replace(/_/g, ' ')} goals, we recommend adjusting your meal selections.
                </p>
              </div>
              <Link to={ROUTES.MENU}>
                <Button size="lg" className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all transform hover:-translate-y-0.5">
                  ✏️ Edit Cart / Go to Menu
                </Button>
              </Link>
            </Card>
          </motion.div>
        )}

        {/* Macro Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animateIn ? 1 : 0, y: animateIn ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="p-6 shadow-lg border-0">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Nutrition vs. Your Per-Meal Targets</h3>
            <div className="space-y-4">
              <MacroBar label="Calories" total={macroBreakdown.calories.total} target={macroBreakdown.calories.target} pct={macroBreakdown.calories.pct} icon="🔥" color="bg-brand-500" />
              <MacroBar label="Protein" total={macroBreakdown.protein.total} target={macroBreakdown.protein.target} pct={macroBreakdown.protein.pct} icon="💪" color="bg-purple-500" />
              <MacroBar label="Carbs" total={macroBreakdown.carbs.total} target={macroBreakdown.carbs.target} pct={macroBreakdown.carbs.pct} icon="🌾" color="bg-amber-500" />
              <MacroBar label="Fat" total={macroBreakdown.fat.total} target={macroBreakdown.fat.target} pct={macroBreakdown.fat.pct} icon="🥑" color="bg-teal-500" />
              <MacroBar label="Fiber" total={macroBreakdown.fiber.total} target={macroBreakdown.fiber.target} pct={macroBreakdown.fiber.pct} icon="🥬" color="bg-green-500" />
            </div>
          </Card>
        </motion.div>

        {/* AI Feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animateIn ? 1 : 0, y: animateIn ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 space-y-4"
        >
          <FeedbackSection items={strengths} type="strength" />
          <FeedbackSection items={warnings} type="warning" />
          <FeedbackSection items={recommendations} type="recommendation" />
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animateIn ? 1 : 0, y: animateIn ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 flex flex-col sm:flex-row gap-3"
        >
          <Link to={ROUTES.CART} className="flex-1">
            <Button variant="outline" size="lg" className="w-full py-4 text-base rounded-xl">
              ← Back to Cart
            </Button>
          </Link>
          <Link to={ROUTES.CHECKOUT} className="flex-1">
            <Button size="lg" className="w-full py-4 text-base rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 bg-gradient-to-r from-brand-600 to-brand-500">
              Proceed to Checkout →
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
