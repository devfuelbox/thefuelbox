'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, Utensils, Search, X, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, ChefHat, MapPin, ShoppingCart, ListChecks,
  RefreshCw, MessageCircle, AlertTriangle
} from 'lucide-react';
import { normalizeMealPlan } from '@/lib/mealPlan';
import { foodDisplayName } from '@/lib/foodDisplay';

interface DeliveryPartner {
  name: string;
  phone: string;
}

interface MealStatus {
  status: string;
  assigned_delivery_id: string | null;
  ready_at: string | null;
  delivery_partner: DeliveryPartner | null;
}

interface OrderRecord {
  id: string;
  customer_name: string;
  phone: string;
  address: string | null;
  meal_plan: any;
  selected_food_items: any[];
  daily_calories: number | null;
  daily_protein: number | null;
  order_status: string;
  chef_notes: string | null;
  special_instructions: string | null;
  sales_notes: string | null;
  verifier_notes: string | null;
  enquiry_date: string | null;
  delivery_date: string | null;
  delivery_time_slot: string | null;
  meals_per_day: number | null;
  goal: string | null;
  created_at: string;
  delivery_partner: DeliveryPartner | null;
  meal_statuses: Record<string, MealStatus> | null;
}

const STATUS_STYLES: Record<string, string> = {
  assigned_to_chef: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  ready_for_delivery: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned_to_delivery_partner: 'bg-sky-50 text-sky-700 border-sky-200',
  out_for_delivery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-gray-100 text-gray-600 border-gray-200',
};

function statusLabel(status: string): string {
  return status === 'assigned_to_chef' ? 'New' : status.replace(/_/g, ' ');
}

const READY_STATUSES = ['ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery', 'delivered'];

const STATUS_ACTIONS: Record<string, { label: string; action: string; color: string }[]> = {
  assigned_to_chef: [
    { label: 'Start Preparing', action: 'start_preparing', color: 'amber' },
    { label: 'Ready for Delivery', action: 'ready_for_delivery', color: 'emerald' },
  ],
  preparing: [
    { label: 'Ready for Delivery', action: 'ready_for_delivery', color: 'emerald' },
  ],
  ready_for_delivery: [],
};

function extractMeals(mp: any): { meals: any[]; kcal: number; protein: number } {
  if (!mp) return { meals: [], kcal: 0, protein: 0 };
  let parsed = mp;
  if (typeof mp === 'string') {
    try {
      parsed = JSON.parse(mp);
    } catch {
      return { meals: [], kcal: 0, protein: 0 };
    }
  }
  const norm = normalizeMealPlan(parsed);
  return norm || { meals: [], kcal: 0, protein: 0 };
}

// Normalizes an item name so the same ingredient aggregates across plan formats:
// "Chicken Breast (cooked)" (onboarding) and "Chicken Breast" (verifier/menu) -> "Chicken Breast".
function prettifyName(name: string): string {
  return name
    .replace(/\s*\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function getItemName(it: any): string {
  if (it?.name) return prettifyName(it.name);
  return prettifyName(foodDisplayName(it));
}

function getItemUnit(normalizedName: string): number | null {
  const n = normalizedName.toLowerCase();
  if (n.includes('chapati')) return 50;
  if (n.includes('egg')) return 50;
  if (n.includes('banana')) return 120;
  return null;
}

function countItems(orders: OrderRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  orders.forEach(o => {
    const { meals } = extractMeals(o.meal_plan);
    meals.forEach((m: any) => {
      (m.items || []).forEach((it: any) => {
        const name = getItemName(it);
        const grams = it.g || it.grams || 0;
        const unit = getItemUnit(name);
        if (unit) {
          const qty = Math.round(grams / unit) || 1;
          counts[name] = (counts[name] || 0) + qty;
        } else {
          counts[name] = (counts[name] || 0) + 1;
        }
      });
    });
  });
  return counts;
}

function aggregateGrams(orders: OrderRecord[]): Record<string, number> {
  const agg: Record<string, number> = {};
  orders.forEach(o => {
    const { meals } = extractMeals(o.meal_plan);
    meals.forEach((m: any) => {
      (m.items || []).forEach((it: any) => {
        const name = getItemName(it);
        agg[name] = (agg[name] || 0) + (it.g || it.grams || 0);
      });
    });
  });
  return agg;
}

export default function ChefDashboardPage() {
  const [todaysOrders, setTodaysOrders] = useState<OrderRecord[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [viewing, setViewing] = useState<OrderRecord | null>(null);
  const [viewTab, setViewTab] = useState<'today' | 'all'>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoaded = useRef(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const istToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const fetchOrders = async (): Promise<{ today: OrderRecord[]; all: OrderRecord[] } | null> => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        fetch(`/api/roles/chef/orders?today=true&localDate=${istToday()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/chef/orders', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const today = todayRes.ok ? await todayRes.json() : [];
      const all = allRes.ok ? await allRes.json() : [];
      setTodaysOrders(today);
      setAllOrders(all);
      return { today, all };
    } catch { return null; }
    finally {
      hasLoaded.current = true;
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    const interval = setInterval(() => { fetchOrders(); }, 15000);
    const onFocus = () => { fetchOrders(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  const updateOrder = async (id: string, action: string) => {
    try {
      const r = await fetch('/api/roles/chef/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) {
        await fetchOrders();
        setViewing(null);
      }
    } catch {}
  };

  const updateMeal = async (id: string, mealSlot: string, action: string) => {
    try {
      const r = await fetch('/api/roles/chef/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, meal_slot: mealSlot }),
      });
      if (r.ok) {
        const data = await fetchOrders();
        if (data) {
          setViewing(prev => {
            if (!prev || prev.id !== id) return prev;
            return data.all.find(x => x.id === id) || data.today.find(x => x.id === id) || prev;
          });
        }
      }
    } catch {}
  };

  const ordersToShow = viewTab === 'today' ? todaysOrders : allOrders;

  const filtered = ordersToShow.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase())
  );
  const totPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, viewTab]);

  const countMealsInStatus = (orders: OrderRecord[], status: string) =>
    orders.reduce((acc, o) => acc + Object.values(o.meal_statuses || {}).filter(m => m.status === status).length, 0);

  const stats = {
    new: countMealsInStatus(ordersToShow, 'assigned_to_chef'),
    preparing: countMealsInStatus(ordersToShow, 'preparing'),
    ready: countMealsInStatus(ordersToShow, 'ready_for_delivery'),
  };

  const activeToday = useMemo(() =>
    todaysOrders.filter(o =>
      ['assigned_to_chef', 'preparing', 'ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery'].includes(o.order_status)
    ),
  [todaysOrders]);

  const todayCounts = useMemo(() => countItems(activeToday), [activeToday]);
  const todayGrams = useMemo(() => aggregateGrams(activeToday), [activeToday]);

  const viewingMeals = useMemo(() => (viewing ? extractMeals(viewing.meal_plan) : { meals: [], kcal: 0, protein: 0 }), [viewing]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Chef Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">View assigned orders, cooking calculations, and update preparation status.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Auto-refresh every 15s
          </span>
          {lastUpdated && (
            <span className="text-gray-400">· Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button onClick={() => fetchOrders()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg font-bold hover:bg-orange-100 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-[11px] font-bold text-blue-600 uppercase">New Meals</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{stats.new}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-[11px] font-bold text-amber-600 uppercase">Preparing</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.preparing}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Ready Meals</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.ready}</p>
        </div>
      </div>

      {/* Today's Cooking Summary */}
      {/* <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
        <div className="bg-orange-50 px-5 py-3 border-b border-orange-200 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-extrabold text-orange-800">
            Today's Cooking Summary
            <span className="font-normal text-orange-600 ml-2">— {activeToday.length} order{activeToday.length !== 1 ? 's' : ''} to prepare</span>
          </h3>
        </div>
        <div className="p-5">
          {activeToday.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No orders scheduled for today.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(todayCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => {
                    const grams = todayGrams[name] || 0;
                    const unit = getItemUnit(name);
                    const qtyDisplay = unit ? `${count} pcs` : `${count} portion${count !== 1 ? 's' : ''}`;
                    return (
                      <div key={name} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 capitalize">{name}</p>
                          <p className="text-lg font-black text-orange-700 mt-0.5">
                            Quantity to Cook: <span className="text-orange-600">{qtyDisplay}</span>
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium">{Math.round(grams)}g</span>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-gray-700">Today's total:</span>
                <span>{activeToday.length} order{activeToday.length !== 1 ? 's' : ''}</span>
                <span>{Object.values(todayCounts).reduce((a, b) => a + b, 0)} total items</span>
                <span>{Math.round(Object.values(todayGrams).reduce((a, b) => a + b, 0) / 1000)} kg total weight</span>
              </div>
            </>
          )}
        </div>
      </div> */}
<div className="bg-white border border-orange-200 rounded-xl p-3">
  <p className="text-sm font-bold text-orange-700 mb-2">
    Today's Cooking List
  </p>

  {Object.entries(todayCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      const unit = getItemUnit(name);

      return (
        <p key={name} className="text-[13px] text-gray-700 py-1">
          • <span className="capitalize">{name}</span> -{" "}
          <span className="font-semibold text-orange-600">
            {unit ? `${count} pcs` : `${count} Qty`}
          </span>
        </p>
      );
    })}
</div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button onClick={() => setViewTab('today')}
            className={`px-5 py-3 text-xs font-bold transition border-b-2 ${
              viewTab === 'today'
                ? 'border-orange-600 text-orange-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-55'
            }`}>
            Today's Orders ({todaysOrders.length})
          </button>
          <button onClick={() => setViewTab('all')}
            className={`px-5 py-3 text-xs font-bold transition border-b-2 ${
              viewTab === 'all'
                ? 'border-orange-600 text-orange-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-55'
            }`}>
            All Assigned Orders ({allOrders.length})
          </button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="text" placeholder="Search by customer name..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Items to Cook</th>
                <th className="px-5 py-3">Delivery</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No orders assigned.</td></tr>
              ) : paginated.map(o => {
                const { meals } = extractMeals(o.meal_plan);
                const allItems: { name: string; g: number }[] = [];
                meals.forEach(m => (m.items || []).forEach((it: any) => {
                  allItems.push({ name: getItemName(it), g: it.g || it.grams || 0 });
                }));
                const grouped = allItems.reduce((acc: Record<string, { count: number; grams: number }>, it) => {
                  if (!acc[it.name]) acc[it.name] = { count: 0, grams: 0 };
                  const unit = getItemUnit(it.name);
                  if (unit) {
                    acc[it.name].count += Math.round(it.g / unit) || 1;
                  } else {
                    acc[it.name].count += 1;
                  }
                  acc[it.name].grams += it.g;
                  return acc;
                }, {});

                return (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{o.customer_name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        <Phone className="w-3 h-3 inline mr-0.5" /> {o.phone}
                      </div>
                      {o.delivery_date && (
                        <div className="text-[10px] text-orange-500 font-semibold mt-1">
                          {o.delivery_date === istToday() ? 'Today' : new Date(o.delivery_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {Object.entries(grouped).map(([name, { count, grams }]) => {
                          const unit = getItemUnit(name);
                          return (
                            <span key={name} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-100 rounded-lg text-[11px] font-semibold text-orange-800 capitalize">
                              {name}
                              <span className="text-orange-500">×{count}</span>
                              <span className="text-gray-400 font-normal">({Math.round(grams)}g)</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {o.address && <div className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {o.address}</div>}
                      {o.delivery_time_slot && <div className="mt-1 text-gray-500">{o.delivery_time_slot}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center gap-1.5">
                        {Object.entries(o.meal_statuses || {}).map(([name, ms]) => (
                          <span key={name}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[ms.status] || 'bg-gray-100 text-gray-500'}`}>
                            {name}
                            <span className="opacity-60">·</span>
                            {statusLabel(ms.status)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewing(o)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition">
                          View
                        </button>
                        {meals.length <= 1 && STATUS_ACTIONS[o.order_status]?.map(action => (
                          <button key={action.action}
                            onClick={() => updateOrder(o.id, action.action)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              action.action === 'start_preparing'
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}>
                            {action.action === 'ready_for_delivery' ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${page === p ? 'bg-orange-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{p}</button>
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

      {/* Details Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">{viewing.customer_name}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Customer</p>
                  <p className="font-bold text-gray-900 mt-1">{viewing.customer_name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <p className="font-bold text-gray-900 mt-1">{viewing.phone}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Delivery Info
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Address</span><span className="font-bold text-gray-900">{viewing.address || '-'}</span></div>
                  {viewing.delivery_date && <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Date</span><span className="font-bold text-gray-900">{new Date(viewing.delivery_date).toLocaleDateString()}</span></div>}
                  {viewing.delivery_time_slot && <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Time</span><span className="font-bold text-gray-900">{viewing.delivery_time_slot}</span></div>}
                  {viewing.delivery_partner && (
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Delivery Partner</span>
                      <span className="font-bold text-gray-900">{viewing.delivery_partner.name}</span>
                      <span className="text-gray-500 ml-2">{viewing.delivery_partner.phone || ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                const { meals, kcal, protein } = extractMeals(viewing.meal_plan);
                return meals.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-orange-600" /> Items to Cook
                      <span className="text-[10px] font-normal text-gray-400 normal-case">— {kcal || '-'} kcal | {protein || '-'}g protein</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {meals.map((meal: any, i: number) => {
                        const ms = viewing.meal_statuses?.[meal.name];
                        const mStatus = ms?.status || (viewing.order_status === 'preparing' ? 'preparing' : READY_STATUSES.includes(viewing.order_status) ? 'ready_for_delivery' : 'assigned_to_chef');
                        const isReady = READY_STATUSES.includes(mStatus);
                        const partner = ms?.delivery_partner;
                        return (
                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-orange-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">{meal.name}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[mStatus] || 'bg-gray-100 text-gray-500'}`}>
                              {statusLabel(mStatus)}
                            </span>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {meal.items?.length > 0 ? (() => {
                              const grouped: Record<string, { count: number; g: number }> = {};
                              meal.items.forEach((it: any) => {
                                const n = getItemName(it);
                                if (!grouped[n]) grouped[n] = { count: 0, g: 0 };
                                const unit = getItemUnit(n);
                                if (unit) {
                                  grouped[n].count += Math.round((it.g || it.grams || 0) / unit) || 1;
                                } else {
                                  grouped[n].count += 1;
                                }
                                grouped[n].g += it.g || it.grams || 0;
                              });
                              return Object.entries(grouped).map(([name, { count, g }]) => (
                                <div key={name} className="flex justify-between items-center text-xs">
                                  <span className="text-gray-700 capitalize font-medium">{name}</span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-bold text-orange-600">×{count}</span>
                                    <span className="text-gray-400">({Math.round(g)}g)</span>
                                  </span>
                                </div>
                              ));
                            })() : (
                              <p className="text-xs text-gray-400">No items</p>
                            )}
                          </div>
                          <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                            {mStatus === 'assigned_to_chef' && (
                              <button onClick={() => updateMeal(viewing.id, meal.name, 'meal_start_preparing')}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition">
                                Start Preparing
                              </button>
                            )}
                            {(mStatus === 'assigned_to_chef' || mStatus === 'preparing') && (
                              <button onClick={() => updateMeal(viewing.id, meal.name, 'meal_ready_for_delivery')}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </button>
                            )}
                            {isReady && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Ready for Pickup
                              </span>
                            )}
                            {partner && (
                              <span className="text-[10px] text-gray-500 font-semibold">→ {partner.name}</span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {viewing.goal && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Goal</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 capitalize">{viewing.goal.replace(/_/g, ' ')}</p>
                </div>
              )}

              {/* Instructions & Notes */}
              <div className="space-y-3">
                {viewing.sales_notes && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                    <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" /> Instructions from Sales Admin
                    </h4>
                    <p className="text-sm font-semibold text-amber-900 whitespace-pre-line">{viewing.sales_notes}</p>
                  </div>
                )}
                {viewing.special_instructions && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-amber-700 uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Special Instructions
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{viewing.special_instructions}</p>
                  </div>
                )}
                {viewing.verifier_notes && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-purple-700 uppercase mb-1">Verifier Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{viewing.verifier_notes}</p>
                  </div>
                )}
                {viewing.chef_notes && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-orange-700 uppercase mb-1">Chef Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{viewing.chef_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setViewing(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Close</button>
                {viewing.order_status === 'assigned_to_chef' && viewingMeals.meals.length <= 1 && (
                  <>
                    <button onClick={() => updateOrder(viewing.id, 'start_preparing')}
                      className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition text-sm">
                      Start Preparing
                    </button>
                    <button onClick={() => updateOrder(viewing.id, 'ready_for_delivery')}
                      className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Mark as Ready
                    </button>
                  </>
                )}
                {viewing.order_status === 'preparing' && viewingMeals.meals.length <= 1 && (
                  <button onClick={() => updateOrder(viewing.id, 'ready_for_delivery')}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Mark as Ready
                  </button>
                )}
                {viewing.order_status === 'ready_for_delivery' && viewingMeals.meals.length <= 1 && (
                  <span className="px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Ready for Pickup
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
