'use client';

import { useEffect, useState } from 'react';
import {
  Phone, MapPin, CalendarDays, Clock, Search, X, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, Navigation, MessageCircle, UtensilsCrossed
} from 'lucide-react';
import { normalizeMealPlan, canonicalMealPlan } from '@/lib/mealPlan';

interface DeliveryRecord {
  id: string;
  customer_name: string;
  phone: string;
  address: string | null;
  meal_plan: any;
  selected_food_items: any;
  daily_calories: number | null;
  daily_protein: number | null;
  meals_per_day: number | null;
  goal: string | null;
  order_status: string;
  delivery_notes: string | null;
  special_instructions: string | null;
  sales_notes: string | null;
  verifier_notes: string | null;
  chef_notes: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  delivery_date: string | null;
  delivery_time_slot: string | null;
  enquiry_date: string | null;
  created_at: string;
  meal_statuses: Record<string, { status: string; assigned_delivery_id: string | null; ready_at: string | null }> | null;
  delivery_records?: DeliveryRecordItem[];
}

interface DeliveryRecordItem {
  id: string;
  day_number: number | null;
  meal_slot: string;
  scheduled_date: string;
  status: string;
  delivered_at: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  ready_for_delivery: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned_to_delivery_partner: 'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-amber-50 text-amber-700 border-amber-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned_to_chef: 'bg-gray-100 text-gray-500 border-gray-200',
  preparing: 'bg-gray-100 text-gray-500 border-gray-200',
};

const DELIVERABLE_STATUSES = ['ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery'];

function statusLabel(status: string): string {
  return status === 'assigned_to_chef' ? 'Not ready' : status.replace(/_/g, ' ');
}

function formatDateTime(dt?: string | null): string {
  if (!dt) return '-';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function DeliveryDashboardPage() {
  const [orders, setOrders] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [viewing, setViewing] = useState<DeliveryRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [history, setHistory] = useState<DeliveryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [viewingHistory, setViewingHistory] = useState<DeliveryRecord | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/roles/delivery/orders', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setOrders(await r.json());
    } catch {}
    setLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch('/api/roles/delivery/orders?history=true', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setHistory(await r.json());
    } catch {}
    setHistoryLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    if (view === 'history') fetchHistory();
  }, [view]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/menu');
        if (r.ok) setMenuItems(await r.json());
      } catch {}
    })();
  }, []);

  const updateOrder = async (id: string, action: string) => {
    setActionLoading(true);
    try {
      const r = await fetch('/api/roles/delivery/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) {
        await fetchOrders();
        setViewing(null);
      }
    } catch {}
    setActionLoading(false);
  };

  const updateMeal = async (id: string, mealSlot: string, action: string) => {
    setActionLoading(true);
    try {
      const r = await fetch('/api/roles/delivery/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, meal_slot: mealSlot }),
      });
      if (r.ok) {
        await fetchOrders();
        setViewing(null);
      }
    } catch {}
    setActionLoading(false);
  };

  const filtered = orders.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase()) || (o.phone && o.phone.includes(search))
  );
  const totPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { setHistoryPage(1); }, [search]);

  const historyRows = history.flatMap(o =>
    (o.delivery_records || []).map(r => ({
      order: o,
      meal_slot: r.meal_slot,
      scheduled_date: r.scheduled_date,
      delivered_at: r.delivered_at,
      notes: r.notes,
    }))
  );
  const historyFiltered = historyRows.filter(r =>
    r.order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.order.phone && r.order.phone.includes(search))
  );
  const historyTotPages = Math.ceil(historyFiltered.length / pageSize);
  const historyPaginated = historyFiltered.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  const totals = {
    ready: orders.filter(o => o.order_status === 'ready_for_delivery').length,
    outForDelivery: orders.filter(o => o.order_status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.order_status === 'delivered').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Delivery Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">View assigned deliveries and update delivery status.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setView('active')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${view === 'active' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          Active Deliveries
        </button>
        <button onClick={() => setView('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${view === 'history' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          Previous Deliveries
          {historyRows.length > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${view === 'history' ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
              {historyRows.length}
            </span>
          )}
        </button>
      </div>

      {view === 'active' ? (<>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-[11px] font-bold text-blue-600 uppercase">Ready for Delivery</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{totals.ready}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-[11px] font-bold text-amber-600 uppercase">Out for Delivery</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totals.outForDelivery}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Delivered</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totals.delivered}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="text" placeholder="Search by customer name or phone..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No deliveries assigned.</td></tr>
              ) : paginated.map(o => (
                 
                <tr key={o.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900">{o.customer_name}</div>
                  </td>
                  <td className="px-5 py-4">
                    {/* <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {o.phone}
                    </div> */}
                    <div
  onClick={() => window.location.href = `tel:${o.phone}`}
  className="text-xs font-semibold text-gray-600 flex items-center gap-1 cursor-pointer hover:text-orange-600"
>
  <Phone className="w-3 h-3" />
  {o.phone}
</div>
                    {o.address && (
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {o.address}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {(() => { const p = normalizeMealPlan(o.meal_plan); return (
                      <div className="text-xs text-gray-600">
                        <span className="font-bold text-gray-800">{o.daily_calories ?? p?.kcal ?? '-'} kcal</span>
                        <span className="text-gray-400 ml-1.5">| {o.daily_protein ?? p?.protein ?? '-'}g protein</span>
                        {p?.meals?.length ? <div className="text-[10px] text-gray-400 mt-0.5">{p.meals.length} meals/day</div> : null}
                      </div>
                    ); })()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col items-center gap-1.5">
                      {Object.entries(o.meal_statuses || {}).map(([name, ms]) => (
                        <span key={name}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[ms.status] || 'bg-gray-100'}`}>
                          {name}
                          <span className="opacity-60">·</span>
                          {statusLabel(ms.status)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewing(o)}
                          className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-bold hover:bg-cyan-100 transition">
                          View
                        </button>
                        {o.order_status === 'ready_for_delivery' || o.order_status === 'assigned_to_delivery_partner' ? (
                          <button onClick={() => updateOrder(o.id, 'accept_delivery')}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition">
                            <Navigation className="w-3 h-3 inline" /> Accept
                          </button>
                        ) : null}
                      </div>
                      {Object.entries(o.meal_statuses || {}).some(([, ms]) => DELIVERABLE_STATUSES.includes(ms.status)) && (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {Object.entries(o.meal_statuses || {}).map(([name, ms]) =>
                            DELIVERABLE_STATUSES.includes(ms.status) ? (
                              <button key={name} onClick={() => updateMeal(o.id, name, 'delivered')} disabled={actionLoading}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition disabled:opacity-50 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Delivered: {name}
                              </button>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
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
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${page === p ? 'bg-cyan-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{p}</button>
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
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delivery Details</h2>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Customer</p>
                  <p className="font-bold text-gray-900 mt-1">{viewing.customer_name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <p className="font-bold text-gray-900">{viewing.phone}</p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-cyan-700 uppercase mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Delivery Address
                </p>
                <p className="text-sm font-semibold text-gray-900">{viewing.address || 'No address provided'}</p>
                {(viewing.delivery_date || viewing.delivery_time_slot) && (
                  <p className="text-xs text-cyan-700 mt-2 flex items-center gap-3">
                    {viewing.delivery_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {viewing.delivery_date}</span>}
                    {viewing.delivery_time_slot && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {viewing.delivery_time_slot}</span>}
                  </p>
                )}
              </div>

              {/* Order Summary */}
              {(viewing.total_amount != null || viewing.payment_status) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Amount</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">₹{Number(viewing.total_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Paid</p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5">₹{Number(viewing.paid_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Payment</p>
                    <p className="text-sm font-bold text-gray-900 capitalize mt-0.5">{viewing.payment_status?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                </div>
              )}

              {/* Complete Meal Plan */}
              {(() => {
                const plan = canonicalMealPlan(viewing.meal_plan, menuItems);
                if (!plan.length) return null;
                const kcal = viewing.daily_calories ?? plan.reduce((s, m) => s + m.total_calories, 0);
                const protein = viewing.daily_protein ?? plan.reduce((s, m) => s + m.total_protein, 0);
                return (
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-cyan-600" /> Complete Meal Plan
                    </h4>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-lg">{Math.round(kcal)} kcal</span>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">{protein} g protein</span>
                      {viewing.meals_per_day && <span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">{viewing.meals_per_day} meals/day</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {plan.map((meal: any, i: number) => {
                        const ms = viewing.meal_statuses?.[meal.name];
                        const mStatus = ms?.status || viewing.order_status || 'ready_for_delivery';
                        const deliverable = DELIVERABLE_STATUSES.includes(mStatus);
                        return (
                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-cyan-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-gray-900">{meal.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[mStatus] || 'bg-gray-100'}`}>
                                {statusLabel(mStatus)}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-500">{Math.round(meal.total_calories)} kcal</span>
                            </div>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {meal.items?.map((it: any, j: number) => (
                              <div key={j} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-gray-700 font-medium truncate">{it.name}</span>
                                <span className="text-gray-400 whitespace-nowrap font-semibold">{it.grams}g · {Math.round(it.calories || 0)} kcal</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-2 text-xs pt-1.5 mt-1.5 border-t border-gray-100">
                              <span className="text-gray-400">Meal total</span>
                              <span className="font-bold text-gray-700">{Math.round(meal.total_calories)} kcal · {meal.total_protein}g protein</span>
                            </div>
                          </div>
                          {deliverable && (
                            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-gray-400">{mStatus === 'out_for_delivery' ? 'Out for delivery' : 'Ready for pickup'}</span>
                              <button onClick={() => updateMeal(viewing.id, meal.name, 'delivered')} disabled={actionLoading}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition disabled:opacity-50 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Mark Delivered
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Notes & Instructions */}
              <div className="space-y-3">
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
                {viewing.delivery_notes && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-cyan-700 uppercase mb-1">Delivery Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{viewing.delivery_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setViewing(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Close</button>
                {viewing.order_status === 'ready_for_delivery' || viewing.order_status === 'assigned_to_delivery_partner' ? (
                  <button onClick={() => updateOrder(viewing.id, 'accept_delivery')} disabled={actionLoading}
                    className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition text-sm disabled:opacity-50">
                    Accept Delivery
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      </>) : (
      <>
      {/* Previous Deliveries */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Completed Deliveries</h2>
            <p className="text-[11px] text-gray-400">{historyFiltered.length} delivered meal record{historyFiltered.length === 1 ? '' : 's'}</p>
          </div>
          {historyRows.length > 0 && (
            <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {historyRows.filter(r => r.order.order_status === 'delivered').length} orders fully delivered
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Meal</th>
                <th className="px-5 py-3">Delivery Date</th>
                <th className="px-5 py-3">Delivered At</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historyLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : historyPaginated.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No completed deliveries yet.</td></tr>
              ) : historyPaginated.map(r => (
                <tr key={r.order.id + r.meal_slot + (r.delivered_at || '')} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900">{r.order.customer_name}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-2.5 h-2.5" /> {r.order.phone}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-700 rounded-lg">
                      <UtensilsCrossed className="w-3 h-3 text-cyan-600" /> {r.meal_slot}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                      <CalendarDays className="w-3 h-3 text-gray-400" /> {r.scheduled_date || '-'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                      <Clock className="w-3 h-3 text-gray-400" /> {formatDateTime(r.delivered_at)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Delivered
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => setViewingHistory(r.order)}
                      className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-bold hover:bg-cyan-100 transition">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!historyLoading && historyFiltered.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(historyPage - 1) * pageSize + 1} to {Math.min(historyPage * pageSize, historyFiltered.length)} of {historyFiltered.length}
            </p>
            {historyTotPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                {Array.from({ length: historyTotPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setHistoryPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${historyPage === p ? 'bg-cyan-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                ))}
                <button onClick={() => setHistoryPage(p => Math.min(historyTotPages, p + 1))} disabled={historyPage === historyTotPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Details Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingHistory(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Previous Delivery Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">{viewingHistory.customer_name}</p>
              </div>
              <button onClick={() => setViewingHistory(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Customer</p>
                  <p className="font-bold text-gray-900 mt-1">{viewingHistory.customer_name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <p className="font-bold text-gray-900">{viewingHistory.phone}</p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-cyan-700 uppercase mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Delivery Address
                </p>
                <p className="text-sm font-semibold text-gray-900">{viewingHistory.address || 'No address provided'}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Delivered Meals
                </h4>
                {(viewingHistory.delivery_records || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No per-meal records found.</p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {(viewingHistory.delivery_records || []).map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="w-4 h-4 text-cyan-600" />
                          <span className="font-bold text-gray-900">{r.meal_slot}</span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">Delivered</span>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-semibold text-gray-700">{r.scheduled_date || '-'}</div>
                          <div className="text-gray-400 flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" /> {formatDateTime(r.delivered_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(viewingHistory.total_amount != null || viewingHistory.payment_status) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Amount</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">₹{Number(viewingHistory.total_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Paid</p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5">₹{Number(viewingHistory.paid_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Payment</p>
                    <p className="text-sm font-bold text-gray-900 capitalize mt-0.5">{viewingHistory.payment_status?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                </div>
              )}

              {(viewingHistory.special_instructions || viewingHistory.delivery_notes || viewingHistory.chef_notes || viewingHistory.verifier_notes) && (
                <div className="space-y-3">
                  {viewingHistory.special_instructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-amber-700 uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Special Instructions
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{viewingHistory.special_instructions}</p>
                    </div>
                  )}
                  {viewingHistory.chef_notes && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-orange-700 uppercase mb-1">Chef Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{viewingHistory.chef_notes}</p>
                    </div>
                  )}
                  {viewingHistory.verifier_notes && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-purple-700 uppercase mb-1">Verifier Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{viewingHistory.verifier_notes}</p>
                    </div>
                  )}
                  {viewingHistory.delivery_notes && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-cyan-700 uppercase mb-1">Delivery Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{viewingHistory.delivery_notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button onClick={() => setViewingHistory(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
