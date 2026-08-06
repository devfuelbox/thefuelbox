'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, User, Ruler, Weight, Flame, Apple, Utensils,
  Search, X, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertTriangle,
  Target, Activity, Coffee, Sun, Zap, Moon, Hash, ChefHat, UserCheck, MessageCircle, Plus, Save, RefreshCw, Package
} from 'lucide-react';
import { foodLabel } from '@/lib/foodDisplay';
import { normalizeMealPlan, canonicalMealPlan, planTotals } from '@/lib/mealPlan';
import { calculateItemNutrition } from '@/lib/nutrition/calculations';

interface EnquiryRecord {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  food_preference: string | null;
  activity_level: string | null;
  goal: string | null;
  meals_per_day: number | null;
  selected_food_items: any[];
  meal_plan: any[];
  daily_calories: number | null;
  daily_protein: number | null;
  total_amount: number | null;
  meal_plan_price: number | null;
  meal_plan_packages: any;
  order_status: string;
  sales_notes: string | null;
  verifier_notes: string | null;
  assigned_chef_id: string | null;
  assigned_delivery_id: string | null;
  subscription: {
    id: string;
    status: string;
    start_date: string | null;
    duration_days: number | null;
    actual_end_date: string | null;
    deliveries: Array<{
      id: string;
      day_number: number;
      meal_slot: string;
      scheduled_date: string | null;
      status: string;
      delivered_at: string | null;
      notes: string | null;
    }>;
  } | null;
  created_at: string;
}

const DELIVERY_STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-600 border-gray-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  skipped: 'bg-red-50 text-red-700 border-red-200',
};

const SUB_STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_STYLES: Record<string, string> = {
  details_updated: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned_to_chef: 'bg-purple-50 text-purple-700 border-purple-200',
  assigned_to_delivery_partner: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ready_for_delivery: 'bg-teal-50 text-teal-700 border-teal-200',
  out_for_delivery: 'bg-sky-50 text-sky-700 border-sky-200',
  delivered: 'bg-gray-100 text-gray-700 border-gray-300',
};

interface UserRecord {
  id: string;
  full_name: string;  email: string;
  role: string;
}

interface MealPlanPackage {
  name: string;
  days?: number;
  price: number;
}

function getPackages(e: any): MealPlanPackage[] {
  const p = e?.meal_plan_packages;
  if (Array.isArray(p)) return p;
  if (typeof p === 'string') {
    try {
      const parsed = JSON.parse(p);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

// The package the customer selected in onboarding: the one matching the
// stored price, falling back to the most expensive package in the list.
function selectedPackage(e: EnquiryRecord): MealPlanPackage | null {
  const packs = getPackages(e);
  if (packs.length === 0) return null;
  const price = Number(e.meal_plan_price) || 0;
  if (price > 0) {
    const byPrice = packs.find(p => Math.abs(Number(p.price) - price) < 0.01);
    if (byPrice) return byPrice;
  }
  return packs.reduce((a, b) => (Number(b.price) || 0) > (Number(a.price) || 0) ? b : a);
}

export default function VerifierDashboardPage() {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [chefs, setChefs] = useState<UserRecord[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<UserRecord[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [viewing, setViewing] = useState<EnquiryRecord | null>(null);
  const [extraItems, setExtraItems] = useState<any[]>([]);
  const [extraFoodId, setExtraFoodId] = useState('');
  const [extraGrams, setExtraGrams] = useState(100);
  const [savingPlan, setSavingPlan] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoaded = useRef(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const fetchData = async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const [eRes, cRes, dRes] = await Promise.all([
        fetch('/api/roles/verifier/enquiries', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/admin/users?role=chef', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/admin/users?role=delivery_partner', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (eRes.ok) setEnquiries(await eRes.json());
      if (cRes.ok) setChefs(await cRes.json());
      if (dRes.ok) setDeliveryPartners(await dRes.json());
    } catch {}
    hasLoaded.current = true;
    setLoading(false);
    setLastUpdated(new Date());
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 15000);
    const onFocus = () => { fetchData(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  useEffect(() => {
    fetch('/api/menu').then(r => r.json()).then(setMenuItems).catch(() => {});
  }, []);

  const openReview = (e: EnquiryRecord) => {
    setViewing(e);
    setExtraItems([]);
    setExtraFoodId('');
    setExtraGrams(100);
  };

  const addExtra = () => {
    const mi = menuItems.find(m => String(m.id) === extraFoodId);
    if (!mi || extraGrams <= 0) return;
    const nut = calculateItemNutrition(mi, extraGrams);
    setExtraItems(prev => [...prev, {
      id: mi.id,
      name: mi.name,
      grams: extraGrams,
      calories: nut.calories,
      protein: nut.protein,
      price: Math.round((Number(mi.price) || 0) * extraGrams / 100 * 100) / 100,
    }]);
    setExtraGrams(100);
  };

  const handleSavePlan = async () => {
    if (!viewing) return;
    setSavingPlan(true);
    try {
      const basePlan = canonicalMealPlan(viewing.meal_plan, menuItems);
      const extraMeal = extraItems.length > 0 ? {
        name: 'Additional',
        items: extraItems.map(x => ({ id: x.id, name: x.name, grams: x.grams, calories: x.calories, protein: x.protein })),
        total_calories: extraItems.reduce((s, x) => s + x.calories, 0),
        total_protein: Math.round(extraItems.reduce((s, x) => s + x.protein, 0) * 10) / 10,
      } : null;
      const newPlan = extraMeal ? [...basePlan, extraMeal] : basePlan;

      const planKcal = basePlan.reduce((s, m) => s + m.total_calories, 0);
      const planProtein = basePlan.reduce((s, m) => s + m.total_protein, 0);
      const extraKcal = extraItems.reduce((s, x) => s + x.calories, 0);
      const extraProtein = extraItems.reduce((s, x) => s + x.protein, 0);

      const computedPrice = planTotals(viewing.meal_plan, menuItems).price;
      const basePrice = Number(viewing.total_amount) > 0 ? Number(viewing.total_amount) : computedPrice;
      const extraPrice = extraItems.reduce((s, x) => s + (x.price || 0), 0);
      const newTotal = Math.round((basePrice + extraPrice) * 100) / 100;

      const existingSelected = Array.isArray(viewing.selected_food_items) ? viewing.selected_food_items : [];
      const baseSelected = existingSelected.length > 0
        ? existingSelected
        : basePlan.flatMap(m => m.items);

      const r = await fetch('/api/roles/verifier/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: viewing.id,
          action: 'save_plan',
          meal_plan: newPlan,
          selected_food_items: [...baseSelected, ...extraItems.map(x => ({ ...x, carbs: 0, fat: 0 }))],
          daily_calories: planKcal + extraKcal,
          daily_protein: Math.round((planProtein + extraProtein) * 10) / 10,
          total_amount: newTotal,
        }),
      });
      if (r.ok) {
        const updated = await r.json();
        setEnquiries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setViewing(updated);
        setExtraItems([]);
      }
    } catch {}
    setSavingPlan(false);
  };

  const handleAction = async (id: string, action: string, extra?: Record<string, any>) => {
    try {
      const r = await fetch('/api/roles/verifier/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, ...extra }),
      });
      if (r.ok) {
        await fetchData();
        setViewing(null);
      }
    } catch {}
  };

  const filtered = enquiries.filter(e =>
    e.customer_name.toLowerCase().includes(search.toLowerCase()) || e.phone.includes(search)
  );

  const totPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search]);

  const totals = useMemo(() => ({
    total: enquiries.length,
    pending: enquiries.filter(e => e.order_status === 'details_updated' || e.order_status === 'pending_verification').length,
    verified: enquiries.filter(e => e.order_status === 'verified').length,
    assigned: enquiries.filter(e => ['assigned_to_chef', 'assigned_to_delivery_partner', 'ready_for_delivery', 'out_for_delivery', 'delivered'].includes(e.order_status)).length,
  }), [enquiries]);

  const deliverySchedule = useMemo(() => {
    const list: Array<{
      enquiryId: string;
      customer: string;
      subId: string;
      subStatus: string;
      delivery: NonNullable<EnquiryRecord['subscription']>['deliveries'][number];
      items: Array<{ id: number | string; name: string; grams: number; calories: number; protein: number }>;
      mealKcal: number;
      mealProtein: number;
    }> = [];
    enquiries.forEach(e => {
      if (!e.subscription?.deliveries?.length) return;
      const planMeals = canonicalMealPlan(e.meal_plan, menuItems);
      const byDate: Record<string, NonNullable<EnquiryRecord['subscription']>['deliveries']> = {};
      e.subscription.deliveries.forEach(d => {
        (byDate[d.scheduled_date || ''] ||= []).push(d);
      });
      Object.values(byDate).forEach(day => {
        day.sort((a, b) => (a.meal_slot || '').localeCompare(b.meal_slot || ''));
        day.forEach((d, idx) => {
          const slot = (d.meal_slot || '').trim().toLowerCase();
          let meal = planMeals.find(m => m.name.trim().toLowerCase() === slot);
          if (!meal && planMeals[idx]) meal = planMeals[idx];
          list.push({
            enquiryId: e.id,
            customer: e.customer_name,
            subId: e.subscription!.id,
            subStatus: e.subscription!.status,
            delivery: d,
            items: meal?.items || [],
            mealKcal: Math.round(meal?.total_calories || 0),
            mealProtein: Math.round(meal?.total_protein || 0),
          });
        });
      });
    });
    list.sort((a, b) =>
      (b.delivery.scheduled_date || '').localeCompare(a.delivery.scheduled_date || '') ||
      (b.delivery.meal_slot || '').localeCompare(a.delivery.meal_slot || '')
    );
    return list;
  }, [enquiries, menuItems]);

  const deliveredCount = deliverySchedule.filter(d => d.delivery.status === 'delivered').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Verifier Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Review customer details, verify, and assign to chefs.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Auto-refresh every 15s
          </span>
          {lastUpdated && (
            <span className="text-gray-400">· Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button onClick={() => fetchData()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg font-bold hover:bg-purple-100 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase">Total</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totals.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-[11px] font-bold text-amber-600 uppercase">Pending Review</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totals.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Verified</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totals.verified}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-4">
          <p className="text-[11px] font-bold text-purple-600 uppercase">Assigned to Chef</p>
          <p className="text-2xl font-black text-purple-600 mt-1">{totals.assigned}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
          <input type="text" placeholder="Search name or phone..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Health Profile</th>
                <th className="px-5 py-3">Meal Plan</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No enquiries for verification.</td></tr>
              ) : paginated.map(e => (
                <tr key={e.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900">{e.customer_name}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {e.phone}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-600 font-semibold">
                    {e.age}y / {e.height}cm / {e.weight}kg
                    <br /><span className="text-gray-400 capitalize">{e.goal?.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-5 py-4">
                    {(() => { const p = normalizeMealPlan(e.meal_plan); if (!p) return <span className="text-xs text-gray-400">-</span>; return (
                      <div className="text-xs text-gray-600">
                        <span className="font-bold text-gray-800">{p.kcal} kcal</span>
                        <span className="text-gray-400 ml-2">| {p.protein}g protein</span>
                        <div className="mt-1 space-y-0.5">
                          {p.meals.map((m: any, i: number) => (
                            <span key={i} className="block text-gray-500">{m.name}: {m.items?.length || 0} items</span>
                          ))}
                        </div>
                        {getPackages(e).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {getPackages(e).map((pack, i) => {
                              const sel = selectedPackage(e);
                              const isSel = sel && Math.abs(Number(pack.price) - Number(sel.price)) < 0.01;
                              return (
                                <span key={i}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-lg text-[10px] font-bold ${isSel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                  {pack.name}
                                  {pack.days ? <span className={isSel ? 'opacity-80' : 'text-indigo-400 font-semibold'}>{pack.days}d</span> : null}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {e.sales_notes && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-700">
                            <MessageCircle className="w-3 h-3" /> Instructions from Sales
                          </div>
                        )}
                      </div>
                    ); })()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[e.order_status] || 'bg-gray-100'}`}>
                      {e.order_status?.replace(/_/g, ' ')}
                    </span>
                    {e.subscription && (
                      <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg ${SUB_STATUS_STYLES[e.subscription.status] || 'bg-gray-100'}`}>
                        Subscription: {e.subscription.status}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {e.order_status === 'details_updated' || e.order_status === 'pending_verification' ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openReview(e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition">
                          <UserCheck className="w-3 h-3" /> Review & Verify
                        </button>
                      </div>
                    ) : e.order_status === 'verified' ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openReview(e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition">
                          <ChefHat className="w-3 h-3" /> Assign Chef
                        </button>
                      </div>
                    ) : e.order_status === 'assigned_to_chef' || e.order_status === 'assigned_to_delivery_partner' ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openReview(e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition">
                          <ChefHat className="w-3 h-3" /> Edit Assignment
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openReview(e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition">
                          <Clock className="w-3 h-3" /> View
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </p>
            {totPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                {Array.from({ length: totPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${page === p ? 'bg-purple-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totPages, p + 1))} disabled={page === totPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      {/* <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
        <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-200 flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-extrabold text-indigo-800">
            Subscriptions
            <span className="font-normal text-indigo-600 ml-2">— {deliverySchedule.length} scheduled meals · {deliveredCount} delivered</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          {deliverySchedule.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No subscription deliveries yet. Scheduled meals appear here with their food items and delivery status once an order is marked Delivered.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Meal</th>
                  <th className="px-5 py-3">Meal Items</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3 text-center">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deliverySchedule.slice(0, 60).map((d, i) => (
                  <tr key={`${d.subId}-${d.delivery.id}-${i}`} className="hover:bg-gray-50/50 transition align-top">
                    <td className="px-5 py-3">
                      <div className="font-bold text-gray-900">{d.customer}</div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg mt-1 ${SUB_STATUS_STYLES[d.subStatus] || 'bg-gray-100'}`}>
                        {d.subStatus}
                      </span>
                      <div className="text-[10px] text-gray-400 mt-1">Day {d.delivery.day_number}</div>
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {d.delivery.scheduled_date || '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs font-bold text-gray-800">{d.delivery.meal_slot || '-'}</div>
                      <div className="text-[10px] text-gray-400">{d.mealKcal} kcal · {d.mealProtein}g protein</div>
                    </td>
                    <td className="px-5 py-3">
                      {d.items.length > 0 ? (
                        <div className="space-y-1">
                          {d.items.map((it, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-xs">
                              <span className="font-semibold text-gray-700">{it.name}</span>
                              <span className="text-gray-400">×{it.grams}g</span>
                              <span className="text-gray-400 font-semibold">{Math.round(it.calories)} kcal</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {d.delivery.delivered_at ? new Date(d.delivery.delivered_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg ${DELIVERY_STATUS_STYLES[d.delivery.status] || 'bg-gray-100'}`}>
                        {d.delivery.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div> */}

      {/* Review Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setViewing(null)}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Customer Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">{viewing.customer_name}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Instructions from Sales Admin */}
              {viewing.sales_notes && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                  <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" /> Instructions from Sales Admin
                  </h4>
                  <p className="text-sm font-semibold text-amber-900 whitespace-pre-line">{viewing.sales_notes}</p>
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Name</p>
                  <p className="font-bold text-gray-900 mt-1">{viewing.customer_name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <p className="font-bold text-gray-900 mt-1">{viewing.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Email</p>
                  <p className="font-bold text-gray-900 mt-1 text-sm">{viewing.email || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Address</p>
                  <p className="font-bold text-gray-900 mt-1 text-sm">{viewing.address || '-'}</p>
                </div>
              </div>

              {/* Order & Subscription Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Order Status</p>
                  <p className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[11px] font-bold rounded-lg ${STATUS_STYLES[viewing.order_status] || 'bg-gray-100'}`}>
                      {viewing.order_status?.replace(/_/g, ' ')}
                    </span>
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Subscription Status</p>
                  {viewing.subscription ? (
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[11px] font-bold rounded-lg ${SUB_STATUS_STYLES[viewing.subscription.status] || 'bg-gray-100'}`}>
                        {viewing.subscription.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Started {viewing.subscription.start_date || '-'} · {viewing.subscription.duration_days || '-'} days
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-gray-900 mt-1">Not started</p>
                  )}
                </div>
              </div>

              {/* Meal Plan Duration */}
              {(() => {
                const packs = getPackages(viewing);
                if (packs.length === 0) return null;
                const sel = selectedPackage(viewing);
                const price = Number(viewing.meal_plan_price) || 0;
                return (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-indigo-800 mb-3 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Meal Plan Duration
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {packs.map((pack, i) => {
                        const isSel = sel && Math.abs(Number(pack.price) - Number(sel.price)) < 0.01;
                        return (
                          <div key={i} className={`px-3 py-2 rounded-xl border text-xs ${isSel ? 'bg-white border-indigo-400 shadow-sm' : 'bg-white/60 border-indigo-200'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${isSel ? 'text-indigo-700' : 'text-gray-900'}`}>{pack.name}</span>
                              {isSel && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {pack.days ? `${pack.days} days` : 'Flexible'} · ₹{Number(pack.price).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                      {price > 0 && (
                        <span>Final price: <span className="font-black text-gray-700">₹{price.toLocaleString()}</span></span>
                      )}
                      {viewing.subscription && (
                        <span>
                          Subscription: <span className="font-black text-gray-700">{viewing.subscription.duration_days || '-'} days</span> ({viewing.subscription.status})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Health Profile */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-purple-800 mb-3">Health Profile</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Age</p><p className="text-sm font-bold text-gray-900">{viewing.age || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Gender</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.gender || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Height</p><p className="text-sm font-bold text-gray-900">{viewing.height || '-'}cm</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Weight</p><p className="text-sm font-bold text-gray-900">{viewing.weight || '-'}kg</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Diet</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.food_preference?.replace(/_/g, ' ') || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Meals</p><p className="text-sm font-bold text-gray-900">{viewing.meals_per_day || '-'}/day</p></div>
                </div>
              </div>

              {/* Meal Plan Summary */}
              {(() => { const p = normalizeMealPlan(viewing.meal_plan); if (!p || !p.meals.length) return null; return (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-2">Meal Plan</h4>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-gray-700 bg-purple-50 px-3 py-1 rounded-lg">{p.kcal} kcal</span>
                    <span className="text-xs font-bold text-gray-700 bg-purple-50 px-3 py-1 rounded-lg">{p.protein}g protein</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {p.meals.map((meal: any, i: number) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-900 mb-1">{meal.name}</p>
                        {meal.items?.map((it: any, j: number) => (
                          <p key={j} className="text-[10px] text-gray-500 flex justify-between">
                            <span>{foodLabel(it)}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ); })()}

              {/* Additional Items */}
              <div className="border border-dashed border-purple-300 bg-purple-50/50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-purple-800 mb-3 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Additional Item
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select value={extraFoodId} onChange={e => setExtraFoodId(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500">
                    <option value="">Select a food item...</option>
                    {menuItems.filter(m => m.is_available).map(m => (
                      <option key={m.id} value={String(m.id)}>{m.name} — ₹{Number(m.price).toLocaleString()}/100g · {m.calories} kcal</option>
                    ))}
                  </select>
                  <input type="number" min={0} step={10} value={extraGrams}
                    onChange={e => setExtraGrams(Number(e.target.value))}
                    className="w-full sm:w-28 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                    placeholder="grams" />
                  <button onClick={addExtra} disabled={!extraFoodId || extraGrams <= 0}
                    className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-40 text-sm">
                    Add
                  </button>
                </div>

                {extraItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {extraItems.map((x, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs gap-3">
                        <span className="font-semibold text-gray-700 flex-1 truncate">{x.name}</span>
                        <span className="text-gray-500 shrink-0">{x.grams}g · {x.calories} kcal · {x.protein}g P</span>
                        <span className="font-bold text-gray-700 shrink-0">₹{x.price.toLocaleString()}</span>
                        <button onClick={() => setExtraItems(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}

                {(() => {
                  const base = planTotals(viewing.meal_plan, menuItems);
                  const basePrice = Number(viewing.total_amount) > 0 ? Number(viewing.total_amount) : base.price;
                  const extraKcal = extraItems.reduce((s, x) => s + x.calories, 0);
                  const extraProtein = extraItems.reduce((s, x) => s + x.protein, 0);
                  const extraPrice = extraItems.reduce((s, x) => s + (x.price || 0), 0);
                  return (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-white rounded-xl p-3 border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Calories</p>
                        <p className="text-lg font-black text-gray-900">{base.kcal + extraKcal} kcal</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Protein</p>
                        <p className="text-lg font-black text-gray-900">{Math.round((base.protein + extraProtein) * 10) / 10}g</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-200 col-span-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Updated Price</p>
                        <p className="text-lg font-black text-emerald-600">₹{Math.round((basePrice + extraPrice) * 100) / 100}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Plan ₹{basePrice} + Extras ₹{Math.round(extraPrice * 100) / 100}</p>
                      </div>
                    </div>
                  );
                })()}

                {extraItems.length > 0 && (
                  <div className="mt-3 flex justify-end">
                    <button onClick={handleSavePlan} disabled={savingPlan}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                      <Save className="w-4 h-4" /> {savingPlan ? 'Saving...' : 'Save Plan Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              {viewing.order_status === 'details_updated' || viewing.order_status === 'pending_verification' ? (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button onClick={() => handleAction(viewing.id, 'request_changes', { verifier_notes: 'Please update customer details' })}
                    className="px-5 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Request Changes
                  </button>
                  <button onClick={() => handleAction(viewing.id, 'verify')}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Verify & Confirm
                  </button>
                </div>
              ) : viewing.order_status === 'verified' || viewing.order_status === 'assigned_to_chef' || viewing.order_status === 'assigned_to_delivery_partner' ? (
                <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
                  {viewing.order_status === 'assigned_to_chef' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 font-semibold mb-2">
                      Currently assigned — you can reassign below.
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">{viewing.assigned_chef_id ? 'Reassign Chef' : 'Assign to Chef'}</label>
                    <select
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                      defaultValue={viewing.assigned_chef_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAction(viewing.id, 'assign_chef', { assigned_chef_id: e.target.value });
                        }
                      }}
                    >
                      <option value="" disabled>Select a chef...</option>
                      {chefs.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">{viewing.assigned_delivery_id ? 'Reassign Delivery Partner' : 'Assign Delivery Partner (optional)'}</label>
                    <select
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                      defaultValue={viewing.assigned_delivery_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAction(viewing.id, 'assign_chef', { assigned_delivery_id: e.target.value, assigned_chef_id: viewing.assigned_chef_id || '' });
                        }
                      }}
                    >
                      <option value="" disabled>Select a delivery partner...</option>
                      {deliveryPartners.map(d => (
                        <option key={d.id} value={d.id}>{d.full_name || d.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
