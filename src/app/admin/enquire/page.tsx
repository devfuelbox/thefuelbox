'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Loader2, AlertTriangle, ClipboardList, ChevronDown,
  Target, Utensils, Check, Phone,
} from 'lucide-react';
import FuelBoxLogo from '@/components/FuelBoxLogo';

/**
 * Customer Enquiries — the admin view of everything the public onboarding page
 * saves automatically the moment a customer's plan is calculated.
 *
 * The rows come straight from `customer_enquiries` (the same table the Sales
 * app writes to), so there is no second store and no placeholder rows: what a
 * customer completes on the onboarding page is here on the next load, with the
 * full inputs and the full calculation that produced their plan.
 */

type Enquiry = {
  id: string;
  customer_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  weight?: number | null;
  food_preference?: string | null;
  activity_level?: string | null;
  goal?: string | null;
  meals_per_day?: number | null;
  selected_food_items?: any;
  meal_plan?: any;
  daily_calories?: number | null;
  daily_protein?: number | null;
  daily_carbs?: number | null;
  daily_fat?: number | null;
  daily_fiber?: number | null;
  bmi?: number | null;
  bmi_category?: string | null;
  bmr?: number | null;
  tdee?: number | null;
  water_liters?: number | null;
  delivery_km?: number | null;
  delivery_status?: string | null;
  delivery_time_slot?: string | null;
  enquiry_date?: string | null;
  created_at?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  outstanding_amount?: number | null;
  payment_status?: string | null;
  sales_status?: string | null;
  sales_notes?: string | null;
  special_instructions?: string | null;
  source?: string | null;
};

const GOAL_LABELS: Record<string, string> = {
  loss: 'Weight Loss',
  gain: 'Weight Gain',
  muscle: 'Muscle Gain',
  maintenance: 'Healthy Meal',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Mostly sitting',
  active: 'On my feet',
  gym: 'Gym regular',
};

const FOOD_LABELS: Record<string, string> = {
  veg: 'Vegetarian',
  vegetarian: 'Vegetarian',
  non_veg: 'Non-veg',
  nonveg: 'Non-veg',
  egg: 'Eggetarian',
  eggtarian: 'Eggetarian',
};

// `sales_status` is what staff set on an enquiry. An enquiry nobody has acted
// on yet is still "new" — the onboarding auto-save writes it as 'follow_up'.
const STATUS_OPTIONS = [
  { value: 'follow_up', label: 'New' },
  { value: 'non_follow_up', label: 'Closed' },
  { value: 'not_interested', label: 'Not interested' },
];

const statusLabel = (e: Enquiry) => {
  if (!e.sales_status || e.sales_status === 'follow_up') return 'New';
  return e.sales_status.replace(/_/g, ' ');
};

const statusClass = (e: Enquiry) => {
  if (!e.sales_status || e.sales_status === 'follow_up') {
    return 'bg-blue-50 text-blue-700 ring-blue-600/20';
  }
  if (e.sales_status === 'not_interested') {
    return 'bg-gray-100 text-gray-600 ring-gray-500/20';
  }
  return 'bg-amber-50 text-amber-700 ring-amber-600/20';
};

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return String(d);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatINR = (n: any) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const num = (n: any, suffix = '') => {
  if (n === null || n === undefined || n === '') return '—';
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}${suffix}`;
};

const label = (map: Record<string, string>, key?: string | null) =>
  (key && (map[key] || key)) || '—';

/**
 * The stored plan has two shapes: the onboarding writes
 * `{ meals: [{ name, items: [{ id, g }] }], protein, price }`, while the admin
 * "New Client" form writes `[{ meal, items: [{ name, grams }] }]`. Both are
 * normalised here so the details panel can list the meals either way.
 */
const planRows = (plan: any): { meal: string; items: { name: string; grams: string }[] }[] => {
  const meals: any[] = Array.isArray(plan)
    ? plan
    : Array.isArray(plan?.meals)
      ? plan.meals
      : [];
  return meals.map((m: any) => ({
    meal: m?.meal || m?.name || 'Meal',
    items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({
      name: it?.name || it?.food || (it?.id != null ? `Item #${it.id}` : 'Item'),
      grams: it?.grams != null ? `${it.grams} g` : it?.g != null ? `${it.g} g` : '—',
    })),
  }));
};

export default function EnquiriesPage() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/roles/sales/enquiries', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        throw new Error((await r.json().catch(() => ({}))).message || 'Failed to load enquiries');
      }
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load enquiries');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    if (!q) return rows;
    return rows.filter((e) =>
      (e.customer_name || '').toLowerCase().includes(q) ||
      (digits && String(e.phone || '').includes(digits)) ||
      (e.goal ? label(GOAL_LABELS, e.goal).toLowerCase().includes(q) : false),
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: rows.length, follow_up: 0, non_follow_up: 0, not_interested: 0 };
    rows.forEach((e) => {
      const key = !e.sales_status || e.sales_status === 'follow_up' ? 'follow_up' : e.sales_status;
      if (base[key] !== undefined) base[key] += 1;
    });
    return base;
  }, [rows]);

  const [statusFilter, setStatusFilter] = useState('all');

  const visible = useMemo(() => {
    if (statusFilter === 'all') return filtered;
    return filtered.filter((e) => {
      const key = !e.sales_status || e.sales_status === 'follow_up' ? 'follow_up' : e.sales_status;
      return key === statusFilter;
    });
  }, [filtered, statusFilter]);

  const toggle = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    setSaveError('');
    setSavedFlash(null);
  };

  const saveStatus = async (e: Enquiry) => {
    const next = statusDraft[e.id] ?? statusLabel(e);
    const value = STATUS_OPTIONS.find((o) => o.label === next)?.value || next;
    setSavingId(e.id);
    setSaveError('');
    setSavedFlash(null);
    try {
      const r = await fetch('/api/roles/sales/enquiries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: e.id, sales_status: value }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Failed to update status');
      const updated = await r.json();
      setRows((cur) => cur.map((r2) => (r2.id === e.id ? { ...r2, ...updated } : r2)));
      setSavedFlash(e.id);
      window.setTimeout(() => setSavedFlash((cur) => (cur === e.id ? null : cur)), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update status');
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <FuelBoxLogo size={44} showWordmark={false} showRule={false} />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Customer Enquiries
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Every onboarding enquiry — saved the moment a customer's plan is calculated.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition text-sm shadow-sm shrink-0 min-h-[44px] w-full sm:w-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search & status filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, mobile number or goal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'follow_up', label: 'New' },
            { key: 'non_follow_up', label: 'Closed' },
            { key: 'not_interested', label: 'Not interested' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                statusFilter === f.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 ${statusFilter === f.key ? 'text-blue-100' : 'text-gray-400'}`}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-600 flex-1">{error}</p>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600 hover:bg-red-100 transition"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6">Contact number</th>
                <th className="py-4 px-6">Goal</th>
                <th className="py-4 px-6">BMI</th>
                <th className="py-4 px-6">Daily calories</th>
                <th className="py-4 px-6">Protein</th>
                <th className="py-4 px-6">Enquiry date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
                    <p className="mt-3 text-gray-400 font-medium">Loading enquiries...</p>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400 font-medium">
                      {rows.length === 0
                        ? 'No customer enquiries yet.'
                        : 'No enquiries match this filter.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {rows.length === 0
                        ? 'They appear here automatically when a customer finishes the onboarding quiz.'
                        : 'Try a different name, number, goal or status.'}
                    </p>
                  </td>
                </tr>
              ) : (
                visible.map((e) => {
                  const isOpen = openId === e.id;
                  const meals = planRows(e.meal_plan);
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => toggle(e.id)}
                        className="cursor-pointer hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900">{e.customer_name}</span>
                            {e.source === 'onboarding' && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                Auto-saved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-700 tabular-nums">
                          {e.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {e.phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-4 px-6 text-gray-700">{label(GOAL_LABELS, e.goal)}</td>
                        <td className="py-4 px-6 text-gray-700 tabular-nums">
                          {e.bmi != null ? (
                            <>
                              {num(e.bmi)}
                              {e.bmi_category ? (
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                  {e.bmi_category}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-gray-900 tabular-nums">
                          {e.daily_calories != null ? `${Math.round(Number(e.daily_calories))} kcal` : '—'}
                        </td>
                        <td className="py-4 px-6 text-gray-700 tabular-nums">
                          {e.daily_protein != null ? `${Math.round(Number(e.daily_protein))} g` : '—'}
                        </td>
                        <td className="py-4 px-6 text-gray-500 whitespace-nowrap">
                          {formatDate(e.enquiry_date || e.created_at)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${statusClass(e)}`}
                          >
                            {statusLabel(e)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            {isOpen ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="px-6 pb-6 -mt-2">
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-5">
                              {/* Customer details + submitted inputs */}
                              <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                  Customer details
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {[
                                    { k: 'Name', v: e.customer_name },
                                    { k: 'Phone', v: e.phone || '—' },
                                    { k: 'Email', v: e.email || '—' },
                                    { k: 'Age', v: e.age != null ? String(e.age) : '—' },
                                    { k: 'Gender', v: e.gender || '—' },
                                    { k: 'Height', v: e.height != null ? `${num(e.height)} cm` : '—' },
                                    { k: 'Weight', v: e.weight != null ? `${num(e.weight)} kg` : '—' },
                                    { k: 'Diet', v: label(FOOD_LABELS, e.food_preference) },
                                    { k: 'Activity', v: label(ACTIVITY_LABELS, e.activity_level) },
                                    { k: 'Goal', v: label(GOAL_LABELS, e.goal) },
                                    { k: 'Meals per day', v: e.meals_per_day != null ? String(e.meals_per_day) : '—' },
                                    { k: 'Meal slots', v: e.delivery_time_slot || '—' },
                                    { k: 'Delivery distance', v: e.delivery_km != null ? `${num(e.delivery_km)} km` : '—' },
                                    { k: 'Delivery zone', v: e.delivery_status || '—' },
                                    { k: 'Address', v: e.address || '—' },
                                  ].map((f) => (
                                    <div key={f.k}>
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                        {f.k}
                                      </div>
                                      <div className="text-sm font-semibold text-gray-900 capitalize break-words">
                                        {String(f.v)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Calculated nutrition plan */}
                              <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                  Calculated nutrition plan
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {[
                                    { k: 'BMI', v: num(e.bmi) },
                                    { k: 'BMI category', v: e.bmi_category || '—' },
                                    { k: 'BMR', v: num(e.bmr, ' kcal') },
                                    { k: 'TDEE', v: num(e.tdee, ' kcal') },
                                    { k: 'Daily calories', v: num(e.daily_calories, ' kcal') },
                                    { k: 'Protein', v: num(e.daily_protein, ' g') },
                                    { k: 'Carbs', v: num(e.daily_carbs, ' g') },
                                    { k: 'Fat', v: num(e.daily_fat, ' g') },
                                    { k: 'Fiber', v: num(e.daily_fiber, ' g') },
                                    { k: 'Water', v: num(e.water_liters, ' L') },
                                    { k: 'Plan price', v: formatINR(e.total_amount) },
                                    { k: 'Payment status', v: e.payment_status || '—' },
                                  ].map((f) => (
                                    <div key={f.k}>
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                        {f.k}
                                      </div>
                                      <div className="text-sm font-semibold text-gray-900 break-words">
                                        {String(f.v)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* The meals the plan is built from */}
                              {meals.length > 0 && (
                                <div>
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                    Meals in this plan
                                  </h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {meals.map((m, i) => (
                                      <div key={`${m.meal}-${i}`} className="rounded-xl bg-white border border-gray-100 p-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                                          <Utensils className="w-3.5 h-3.5" /> {m.meal}
                                        </div>
                                        <ul className="space-y-1">
                                          {m.items.map((it, j) => (
                                            <li key={`${it.name}-${j}`} className="flex items-center justify-between text-sm text-gray-700">
                                              <span className="capitalize">{it.name}</span>
                                              <span className="tabular-nums text-gray-500">{it.grams}</span>
                                            </li>
                                          ))}
                                          {m.items.length === 0 && (
                                            <li className="text-sm text-gray-400">No items recorded</li>
                                          )}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Full calculation summary as it was saved */}
                              {e.special_instructions && (
                                <div>
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                    Full calculation summary
                                  </h3>
                                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-gray-700 bg-white border border-gray-100 rounded-xl p-4">
                                    {e.special_instructions}
                                  </pre>
                                </div>
                              )}

                              {/* Enquiry status */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 border-t border-gray-200">
                                <div className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Status
                                  </span>
                                </div>
                                <select
                                  value={statusDraft[e.id] ?? statusLabel(e)}
                                  onChange={(ev) => setStatusDraft((cur) => ({ ...cur, [e.id]: ev.target.value }))}
                                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                  {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.label}>{o.label}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => saveStatus(e)}
                                  disabled={savingId === e.id}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  {savingId === e.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                  Update status
                                </button>
                                {savedFlash === e.id && (
                                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                                    <Check className="w-4 h-4" /> Status updated
                                  </span>
                                )}
                                {saveError && (
                                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600">
                                    <AlertTriangle className="w-4 h-4" /> {saveError}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <p className="text-xs text-gray-400 font-medium">
          Showing {visible.length} of {rows.length} enquir{rows.length !== 1 ? 'ies' : 'y'}
        </p>
      )}
    </div>
  );
}
