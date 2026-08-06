'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, X, Save, ChevronLeft, ChevronRight, Play, Pause, SkipForward,
  Phone, Mail, CalendarDays, User, Clock, CheckCircle2, AlertTriangle,
  XCircle, RotateCcw, Ban, Eye, List, Trash2, Loader2
} from 'lucide-react';

interface CustomerEnquiry {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  meals_per_day: number | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: string;
  goal: string | null;
  daily_calories: number | null;
}

interface Subscription {
  id: string;
  customer_enquiry_id: string;
  start_date: string;
  duration_days: number;
  status: string;
  paused_days: number;
  pause_history: any[];
  skipped_meals: any[];
  actual_end_date: string | null;
  notes: string | null;
  created_at: string;
  customer: CustomerEnquiry | null;
}

interface Delivery {
  id: string;
  subscription_id: string;
  day_number: number;
  meal_slot: string;
  scheduled_date: string;
  status: string;
  original_day_number: number | null;
  notes: string | null;
}

const DELIVERY_STATUSES = [
  'scheduled', 'preparing', 'out_for_delivery', 'delivered',
  'not_delivered', 'skipped', 'rescheduled',
] as const;

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const DELIVERY_STYLES: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700 border-gray-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  out_for_delivery: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_delivered: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-purple-50 text-purple-700 border-purple-200',
  rescheduled: 'bg-orange-50 text-orange-700 border-orange-200',
};

const DELIVERY_ICONS: Record<string, any> = {
  scheduled: Clock, preparing: Loader2, out_for_delivery: RotateCcw,
  delivered: CheckCircle2, not_delivered: XCircle, skipped: Ban, rescheduled: RotateCcw,
};

const MEAL_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const PAGE_SIZE = 10;

function formatDate(d: string) {
  if (!d) return '-';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('fuelbox_token') || '';
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showStartModal, setShowStartModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_enquiry_id: '', start_date: '', duration_days: 7, notes: '' });

  const [viewingSub, setViewingSub] = useState<Subscription | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const token = getToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchData() {
    setLoading(true);
    try {
      const [subRes, enqRes] = await Promise.all([
        fetch('/api/admin/subscriptions', { headers }),
        fetch('/api/admin/enquiries', { headers }),
      ]);
      if (subRes.ok) setSubscriptions(await subRes.json());
      if (enqRes.ok) setEnquiries(await enqRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeliveries(subscriptionId: string) {
    try {
      const res = await fetch(`/api/admin/deliveries?subscription_id=${subscriptionId}`, { headers });
      if (res.ok) setDeliveries(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active').length;
    const paused = subscriptions.filter(s => s.status === 'paused').length;
    const completed = subscriptions.filter(s => s.status === 'completed').length;
    const totalDeliveriesToday = deliveries.filter(d => {
      const today = new Date().toISOString().split('T')[0];
      return d.scheduled_date === today && (d.status === 'scheduled' || d.status === 'preparing' || d.status === 'out_for_delivery');
    }).length;
    return { active, paused, completed, total: subscriptions.length, totalDeliveriesToday };
  }, [subscriptions, deliveries]);

  const filtered = useMemo(() => {
    let list = subscriptions;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => {
        const c = s.customer;
        return c?.customer_name?.toLowerCase().includes(q) || c?.phone?.includes(q) || s.id?.toLowerCase().includes(q);
      });
    }
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [subscriptions, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const availableEnquiries = enquiries.filter(e =>
    !subscriptions.some(s => s.customer_enquiry_id === e.id)
  );

  async function startPlan() {
    if (!form.customer_enquiry_id || !form.start_date) {
      alert('Select a customer and start date');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) { alert('Failed to start plan'); return; }
      const created = await res.json();
      setSubscriptions(prev => [created, ...prev]);
      setShowStartModal(false);
      setForm({ customer_enquiry_id: '', start_date: '', duration_days: 7, notes: '' });
    } catch (e) {
      console.error(e);
      alert('Error starting plan');
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(subId: string, action: string, notes?: string) {
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: subId, action, notes }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.message || 'Action failed'); return; }
      const updated = await res.json();
      setSubscriptions(prev => prev.map(s => s.id === subId ? updated : s));
      if (viewingSub?.id === subId) setViewingSub(updated);
      setActionMsg(action === 'pause' ? 'Plan paused' : action === 'resume' ? 'Plan resumed' : 'Done');
      setTimeout(() => setActionMsg(''), 2000);
    } catch (e) {
      console.error(e);
      alert('Error');
    }
  }

  async function updateDeliveryStatus(deliveryId: string, status: string, notes?: string) {
    try {
      const res = await fetch('/api/admin/deliveries', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'update_status', delivery_id: deliveryId, status, notes }),
      });
      if (!res.ok) { alert('Failed to update'); return; }
      const updated = await res.json();
      setDeliveries(prev => prev.map(d => d.id === deliveryId ? updated : d));
      setShowStatusModal(false);
      setSelectedDelivery(null);
    } catch (e) {
      console.error(e);
      alert('Error');
    }
  }

  async function deleteSubscription(subId: string) {
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id: subId }),
      });
      if (!res.ok) { alert('Failed to delete'); return; }
      setSubscriptions(prev => prev.filter(s => s.id !== subId));
      setShowDeleteModal(false);
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    }
  }

  function openDetail(sub: Subscription) {
    setViewingSub(sub);
    setShowViewModal(true);
    fetchDeliveries(sub.id);
  }

  function computePlanStats(sub: Subscription) {
    const subDeliveries = sub.id === viewingSub?.id ? deliveries : [];
    const totalMeals = sub.duration_days * (sub.customer?.meals_per_day || 3);
    const delivered = subDeliveries.filter(d => d.status === 'delivered').length;
    const skipped = subDeliveries.filter(d => d.status === 'skipped').length;
    const notDelivered = subDeliveries.filter(d => d.status === 'not_delivered').length;
    const rescheduled = subDeliveries.filter(d => d.status === 'rescheduled').length;
    const scheduled = subDeliveries.filter(d => d.status === 'scheduled').length;

    const startDate = new Date(sub.start_date + 'T00:00:00');
    const pausedDays = sub.paused_days || 0;
    const today = new Date();
    const rawDay = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const currentDay = Math.max(1, Math.min(rawDay - pausedDays, sub.duration_days));
    const completedDays = Math.max(0, currentDay - 1);
    const remainingDays = Math.max(0, sub.duration_days - completedDays);

    return {
      totalMeals, delivered, skipped, notDelivered, rescheduled, scheduled,
      currentDay, completedDays, remainingDays,
    };
  }

  const groupedDeliveries = useMemo(() => {
    const grouped: Record<number, Delivery[]> = {};
    for (const d of deliveries) {
      if (!grouped[d.day_number]) grouped[d.day_number] = [];
      grouped[d.day_number].push(d);
    }
    return grouped;
  }, [deliveries]);

  const ongoingStatuses = ['scheduled', 'preparing', 'out_for_delivery'];
  const dayStatus = useMemo(() => {
    const map: Record<number, string> = {};
    for (const [day, dels] of Object.entries(groupedDeliveries)) {
      const statuses = dels.map(d => d.status);
      if (statuses.every(s => s === 'delivered')) map[Number(day)] = 'delivered';
      else if (statuses.every(s => s === 'skipped')) map[Number(day)] = 'skipped';
      else if (statuses.some(s => ongoingStatuses.includes(s))) map[Number(day)] = 'ongoing';
      else map[Number(day)] = 'partial';
    }
    return map;
  }, [groupedDeliveries]);

  const DAY_STYLES: Record<string, string> = {
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    skipped: 'bg-purple-100 text-purple-800 border-purple-300',
    ongoing: 'bg-blue-100 text-blue-800 border-blue-300',
    partial: 'bg-amber-100 text-amber-800 border-amber-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Meal Plan Subscriptions</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Track meal deliveries day by day</p>
        </div>
        <button onClick={() => setShowStartModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition text-sm shadow-sm">
          <Plus className="w-4 h-4" /> Start New Plan
        </button>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-sm font-semibold">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Active Plans</span>
            <div className="p-2 rounded-lg bg-emerald-50"><Play className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Paused</span>
            <div className="p-2 rounded-lg bg-amber-50"><Pause className="w-4 h-4 text-amber-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.paused}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Completed</span>
            <div className="p-2 rounded-lg bg-blue-50"><CheckCircle2 className="w-4 h-4 text-blue-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Today's Deliveries</span>
            <div className="p-2 rounded-lg bg-purple-50"><RotateCcw className="w-4 h-4 text-purple-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.totalDeliveriesToday}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search by name or phone..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Start Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400 font-medium">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400 font-medium">No subscriptions found.</td></tr>
              ) : paginated.map(sub => {
                const c = sub.customer;
                console.log(sub.customer,"sub.customer");
                const planStats = computePlanStats(sub);
                const progress = sub.duration_days > 0 ? Math.round((planStats.completedDays / sub.duration_days) * 100) : 0;
                return (
                  <tr key={sub.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => openDetail(sub)}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900">{c?.customer_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{c?.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{sub.duration_days} days</p>
                      <p className="text-xs text-gray-400">{c?.meals_per_day || 3} meals/day</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{formatDate(sub.start_date)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-500">{planStats.completedDays}/{sub.duration_days}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold rounded-lg ${
                        c?.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        c?.payment_status === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {c?.payment_status?.replace(/_/g, ' ') || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); openDetail(sub); }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-bold">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold">{Math.min(page * PAGE_SIZE, filtered.length)}</span> of{' '}
              <span className="font-bold">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return p;
                }).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${page === p ? 'bg-emerald-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Start Plan Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setShowStartModal(false)}>
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Start Meal Plan</h2>
                <p className="text-sm text-gray-400 mt-0.5">Create a new subscription for a customer</p>
              </div>
              <button onClick={() => !saving && setShowStartModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Customer Enquiry</label>
                <select value={form.customer_enquiry_id} onChange={e => setForm(f => ({ ...f, customer_enquiry_id: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select a customer...</option>
                  {availableEnquiries.map(e => (
                    <option key={e.id} value={e.id}>{e.customer_name} ({e.phone})</option>
                  ))}
                </select>
                {availableEnquiries.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">All enquiries already have active subscriptions.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Date</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Duration (days)</label>
                  <select value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {[3, 5, 7, 10, 14, 21, 30].map(d => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any notes about this plan..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowStartModal(false)} disabled={saving}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={startPlan} disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {showViewModal && viewingSub && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowViewModal(false); setViewingSub(null); setDeliveries([]); }}>
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{viewingSub.customer?.customer_name || 'Customer'} - Plan Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {viewingSub.duration_days}-day plan &middot; Started {formatDate(viewingSub.start_date)}
                  {viewingSub.actual_end_date && ` · Ends ${formatDate(viewingSub.actual_end_date)}`}
                </p>
              </div>
              <button onClick={() => { setShowViewModal(false); setViewingSub(null); setDeliveries([]); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Info + Actions */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer</p>
                    <p className="text-sm font-bold text-gray-900">{viewingSub.customer?.customer_name || '-'}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {viewingSub.customer?.phone || '-'}
                    </div>
                    {viewingSub.customer?.email && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                        <Mail className="w-3 h-3" /> {viewingSub.customer.email}
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Plan</p>
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                      {computePlanStats(viewingSub).completedDays}/{viewingSub.duration_days} days completed
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {viewingSub.status === 'paused' ? `${viewingSub.paused_days} days paused` : `${viewingSub.customer?.meals_per_day || 3} meals/day`}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Payment</p>
                    <p className="text-sm font-bold text-gray-900">
                      ₹{Number(viewingSub.customer?.total_amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Paid: ₹{Number(viewingSub.customer?.paid_amount || 0).toLocaleString()} |
                      Due: <span className="text-red-500 font-bold">₹{Number(viewingSub.customer?.outstanding_amount || 0).toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {viewingSub.status === 'active' && (
                  <button onClick={() => handleAction(viewingSub.id, 'pause')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold hover:bg-amber-100 transition text-xs">
                    <Pause className="w-3.5 h-3.5" /> Pause Plan
                  </button>
                )}
                {viewingSub.status === 'paused' && (
                  <button onClick={() => handleAction(viewingSub.id, 'resume')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition text-xs">
                    <Play className="w-3.5 h-3.5" /> Resume Plan
                  </button>
                )}
                {(viewingSub.status === 'active' || viewingSub.status === 'paused') && (
                  <button onClick={() => handleAction(viewingSub.id, 'cancel', prompt('Reason for cancellation?') || undefined)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition text-xs">
                    <XCircle className="w-3.5 h-3.5" /> Cancel Plan
                  </button>
                )}
                {viewingSub.status === 'active' && computePlanStats(viewingSub).remainingDays <= 0 && (
                  <button onClick={() => handleAction(viewingSub.id, 'complete')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold rounded-lg ${STATUS_STYLES[viewingSub.status] || 'bg-gray-100 text-gray-600'}`}>
                    {viewingSub.status}
                  </span>
                  <button onClick={() => { setDeleteId(viewingSub.id); setShowDeleteModal(true); }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Plan Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: 'Delivered', value: computePlanStats(viewingSub).delivered, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Scheduled', value: computePlanStats(viewingSub).scheduled, color: 'text-gray-600', bg: 'bg-gray-50' },
                  { label: 'Skipped', value: computePlanStats(viewingSub).skipped, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Not Delivered', value: computePlanStats(viewingSub).notDelivered, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Rescheduled', value: computePlanStats(viewingSub).rescheduled, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Paused Days', value: viewingSub.paused_days, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Total Meals', value: computePlanStats(viewingSub).totalMeals, color: 'text-gray-900', bg: 'bg-gray-100' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Calendar/Delivery Grid */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Delivery Schedule
                </h3>
                {deliveries.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No delivery records found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="px-3 py-2 w-16">Day</th>
                          <th className="px-3 py-2">Date</th>
                          {Array.from({ length: viewingSub.customer?.meals_per_day || 3 }, (_, i) => (
                            <th key={i} className="px-3 py-2 text-center">{MEAL_SLOTS[i]}</th>
                          ))}
                          <th className="px-3 py-2 text-center w-20">Day Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Array.from({ length: viewingSub.duration_days + (viewingSub.skipped_meals?.length || 0) }, (_, i) => {
                          const dayNum = i + 1;
                          const dayDels = (groupedDeliveries[dayNum] || []).sort(
                            (a, b) => MEAL_SLOTS.indexOf(a.meal_slot) - MEAL_SLOTS.indexOf(b.meal_slot)
                          );
                          const dStatus = dayStatus[dayNum];
                          const isRescheduled = dayDels.some(d => d.original_day_number);
                          return (
                            <tr key={dayNum} className={`${dStatus === 'delivered' ? 'bg-emerald-50/30' : ''} ${isRescheduled ? 'bg-orange-50/30' : ''} hover:bg-gray-50/50 transition`}>
                              <td className="px-3 py-2.5 font-bold text-gray-700">#{dayNum}</td>
                              <td className="px-3 py-2.5 text-gray-500">
                                {dayDels[0] ? formatDate(dayDels[0].scheduled_date) : '-'}
                                {isRescheduled && (
                                  <span className="ml-1 text-[9px] text-orange-500 font-bold">(rescheduled)</span>
                                )}
                              </td>
                              {Array.from({ length: viewingSub.customer?.meals_per_day || 3 }, (_, mi) => {
                                const meal = dayDels.find(d => d.meal_slot === MEAL_SLOTS[mi]);
                                const mealName = MEAL_SLOTS[mi];
                                const mealDel = dayDels.find(d => d.meal_slot === mealName);
                                const DelIcon = mealDel ? (DELIVERY_ICONS[mealDel.status] || Clock) : Clock;
                                return (
                                  <td key={mi} className="px-3 py-2.5 text-center">
                                    {mealDel ? (
                                      <button onClick={() => { setSelectedDelivery(mealDel); setShowStatusModal(true); }}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold transition hover:opacity-80 ${DELIVERY_STYLES[mealDel.status] || 'bg-gray-100 text-gray-600'}`}>
                                        <DelIcon className="w-2.5 h-2.5" />
                                        {mealDel.status.replace(/_/g, ' ')}
                                      </button>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                    {mealDel?.original_day_number && (
                                      <p className="text-[8px] text-orange-500 mt-0.5">from day #{mealDel.original_day_number}</p>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2.5 text-center">
                                {dStatus && (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${DAY_STYLES[dStatus] || 'bg-gray-100 text-gray-600'}`}>
                                    {dStatus}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Skipped Meals */}
              {viewingSub.skipped_meals && viewingSub.skipped_meals.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <SkipForward className="w-4 h-4" /> Skipped & Rescheduled Meals
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                    {(viewingSub.skipped_meals as any[]).map((sm, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">
                          Day #{sm.day_number} ({sm.meal_slot}) was skipped
                        </span>
                        <span className="text-purple-600 font-semibold">
                          → Rescheduled to Day #{sm.rescheduled_day} ({sm.rescheduled_date ? formatDate(sm.rescheduled_date) : 'TBD'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingSub.notes && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{viewingSub.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Delivery Status Modal */}
      {showStatusModal && selectedDelivery && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowStatusModal(false); setSelectedDelivery(null); }}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Update Delivery</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Day #{selectedDelivery.day_number} · {selectedDelivery.meal_slot} · {formatDate(selectedDelivery.scheduled_date)}
                </p>
              </div>
              <button onClick={() => { setShowStatusModal(false); setSelectedDelivery(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Change Status</p>
              {DELIVERY_STATUSES.map(status => {
                const Icon = DELIVERY_ICONS[status] || Clock;
                const isActive = selectedDelivery.status === status;
                return (
                  <button key={status} onClick={() => updateDeliveryStatus(selectedDelivery.id, status)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border transition ${
                      isActive
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}>
                    <Icon className={`w-4 h-4 ${DELIVERY_STYLES[status]?.includes('text-') ? DELIVERY_STYLES[status].match(/text-\w+-\d+/)?.[0] : 'text-gray-500'}`} />
                    {status.replace(/_/g, ' ')}
                    {isActive && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-500" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => { setShowStatusModal(false); setSelectedDelivery(null); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowDeleteModal(false); setDeleteId(null); }}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Subscription?</h3>
            <p className="text-sm text-gray-500 mb-6">All delivery records will be permanently removed.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteId(null); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={() => deleteId && deleteSubscription(deleteId)}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
