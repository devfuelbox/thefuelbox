'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Loader2, AlertTriangle, X, Check, Calendar, ChevronLeft, ChevronRight,
  Users, Ban, Box, IndianRupee, Coffee, Sun, Moon, SkipForward, Repeat,
  ArrowUpRight, CalendarOff, Pencil, Trash2, RotateCcw,
} from 'lucide-react';
import {
  availableActions, STATUS_META, GOAL_LABELS, PLANS, formatDate, formatINR,
  balanceOf, todayISO, monthBounds, toISO,
  type ClientAction,
} from '@/lib/clients';
import FuelBoxLogo from '@/components/FuelBoxLogo';

/* ── Shapes returned by GET /api/roles/sales/dashboard ─────────────────── */

type Scope = 'day' | 'month' | 'range';

type BoxMeals = { total: number; breakfast: number; lunch: number; dinner: number };

type DashboardClient = {
  id: string;
  client_no: number | null;
  client_label: string;
  name: string;
  phone: string;
  plan_type: 'trial' | 'package';
  start_date?: string | null;
  end_date?: string | null;
  schedule: string;
  skip_dates: string[];
  status: string;
  computed_status: 'active' | 'skipped_today' | 'completed' | 'inactive';
  outstanding: number;
  lifetime_paid: number;
  boxes_in_window: number;
  paid_in_window: number;
  delivers_in_window: boolean;
};

type Metrics = {
  total_clients: number;
  active: number;
  inactive: number;
  skipped: number;
  boxes: number;
  collected: number;
  pending_balance: number;
  total_received: number;
  trial_received: number;
  package_received: number;
};

type DashboardData = {
  scope: Scope;
  window: { from: string; to: string; label: string };
  boxes: BoxMeals;
  metrics: Metrics;
  clients: DashboardClient[];
};

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';

const ACTION_META: Record<ClientAction, { label: string; icon: any; className: string }> = {
  skip_today: { label: 'Skipped Today', icon: SkipForward, className: 'text-purple-700 border-purple-200 hover:bg-purple-50' },
  renew: { label: 'Renew', icon: Repeat, className: 'text-blue-700 border-blue-200 hover:bg-blue-50' },
  convert: { label: 'Convert to Package', icon: ArrowUpRight, className: 'text-indigo-700 border-indigo-200 hover:bg-indigo-50' },
  skip_dates: { label: 'Skip Dates', icon: CalendarOff, className: 'text-gray-700 border-gray-200 hover:bg-gray-50' },
  payment: { label: 'Payment', icon: IndianRupee, className: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  edit: { label: 'Edit', icon: Pencil, className: 'text-gray-700 border-gray-200 hover:bg-gray-50' },
  inactive: { label: 'Inactive', icon: Ban, className: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
  activate: { label: 'Activate', icon: RotateCcw, className: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  delete: { label: 'Delete', icon: Trash2, className: 'text-red-600 border-red-200 hover:bg-red-50' },
};

/** Wording that follows the selected scope, matching the reference. */
function scopeWording(scope: Scope) {
  if (scope === 'day') return { period: 'today', unit: 'today' };
  if (scope === 'range') return { period: 'in range', unit: 'in range' };
  return { period: 'this month', unit: 'this month' };
}

export default function OperationsDashboardPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [scope, setScope] = useState<Scope>('month');
  const [anchor, setAnchor] = useState(todayISO()); // selected day / month anchor
  const [rangeFrom, setRangeFrom] = useState(todayISO());
  const [rangeTo, setRangeTo] = useState(todayISO());

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [modal, setModal] = useState<null | { type: ClientAction; client: DashboardClient }>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  // Only sales / admin / super_admin use this dashboard.
  useEffect(() => {
    const role = localStorage.getItem('fuelbox_user_role') || '';
    if (role === 'verifier') router.replace('/admin/roles/verifier');
    else if (role === 'chef') router.replace('/admin/roles/chef');
    else if (role === 'delivery_partner') router.replace('/admin/roles/delivery');
    else setRedirecting(false);
  }, [router]);

  const showToast = (message: string, isError = false) => {
    setToast({ message, error: isError });
    window.setTimeout(() => setToast(null), 3000);
  };

  const query = useMemo(() => {
    const p = new URLSearchParams({ scope });
    if (scope === 'range') {
      p.set('from', rangeFrom);
      p.set('to', rangeTo);
    } else {
      p.set('date', anchor);
    }
    return p.toString();
  }, [scope, anchor, rangeFrom, rangeTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/roles/sales/dashboard?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Failed to load dashboard');
      setData(await r.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    }
    setLoading(false);
  }, [query, token]);

  useEffect(() => {
    if (!redirecting) load();
  }, [redirecting, load]);

  const clients = data?.clients || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.client_label.toLowerCase().includes(q),
    );
  }, [clients, search]);

  /* ── Actions ───────────────────────────────────────────────────────── */

  const openAction = (client: DashboardClient, type: ClientAction) => {
    setForm({
      amount: client.outstanding,
      method: 'cash',
      date: todayISO(),
      note: '',
      days: 7,
      duration_days: undefined,
      skip_dates: (client.skip_dates || []).join('\n'),
      name: client.name,
      phone: client.phone,
      address: '',
      goal: '',
      plan_type: client.plan_type,
      boxes_per_day: 1,
      start_date: client.start_date || '',
      total_amount: client.lifetime_paid + client.outstanding,
      paid_amount: client.lifetime_paid,
      balance_due_date: '',
      notes: '',
    });
    setModal({ type, client });
  };

  // The dashboard list only has summary columns, so richer fields (address,
  // goal, per-plan amounts) are filled from the client's detail record on open.
  const openActionWithDetail = async (client: DashboardClient, type: ClientAction) => {
    setBusyId(client.id);
    try {
      const r = await fetch(`/api/roles/sales/clients?id=${client.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.client || {};
        const plans = Array.isArray(d.plans) ? d.plans : [];
        const latest = plans[plans.length - 1] || {};
        setForm({
          amount: balanceOf(latest.total_amount, latest.paid_amount),
          method: 'cash',
          date: todayISO(),
          note: '',
          days: 7,
          duration_days: latest.duration_days || c.duration_days || 1,
          skip_dates: (c.skip_dates || []).join('\n'),
          name: c.name || client.name,
          phone: c.phone || client.phone,
          address: c.address || '',
          goal: c.goal || '',
          plan_type: c.plan_type || client.plan_type,
          boxes_per_day: c.boxes_per_day || 1,
          start_date: c.start_date || client.start_date || '',
          total_amount: c.total_amount ?? (client.lifetime_paid + client.outstanding),
          paid_amount: c.paid_amount ?? client.lifetime_paid,
          balance_due_date: c.balance_due_date || '',
          notes: c.notes || '',
        });
      } else {
        openAction(client, type);
      }
    } catch {
      openAction(client, type);
    }
    setBusyId(null);
    setModal({ type, client });
  };

  const submitAction = async () => {
    if (!modal) return;
    const { type, client } = modal;
    setSaving(true);
    try {
      let body: Record<string, any> = { id: client.id, action: type };

      if (type === 'payment') {
        body = { ...body, amount: Number(form.amount), method: form.method, date: form.date, note: form.note };
      } else if (type === 'renew') {
        body = { ...body, days: Number(form.days) };
      } else if (type === 'convert') {
        body = { ...body, duration_days: Number(form.duration_days) };
      } else if (type === 'skip_dates') {
        body = { ...body, skip_dates: String(form.skip_dates).split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean) };
      } else if (type === 'edit') {
        body = {
          ...body,
          name: form.name, phone: form.phone, address: form.address, goal: form.goal,
          plan_type: form.plan_type, boxes_per_day: Number(form.boxes_per_day),
          duration_days: Number(form.duration_days), start_date: form.start_date,
          total_amount: Number(form.total_amount), paid_amount: Number(form.paid_amount),
          balance_due_date: form.balance_due_date || null, notes: form.notes,
          skip_dates: String(form.skip_dates).split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean),
        };
      }

      const r = await fetch('/api/roles/sales/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Action failed');
      setModal(null);
      showToast(`${ACTION_META[type].label} — ${client.name} updated`);
      await load();
    } catch (e: any) {
      showToast(e.message || 'Action failed', true);
    }
    setSaving(false);
  };

  const confirmDelete = async (client: DashboardClient) => {
    setBusyId(client.id);
    try {
      const r = await fetch(`/api/roles/sales/clients?id=${client.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Delete failed');
      setModal(null);
      showToast(`${client.name} deleted`);
      await load();
    } catch (e: any) {
      showToast(e.message || 'Delete failed', true);
    }
    setBusyId(null);
  };

  /* ── Date navigation ───────────────────────────────────────────────── */

  const shiftAnchor = (delta: number) => {
    if (scope === 'month') {
      const d = new Date(`${anchor}T00:00:00`);
      d.setMonth(d.getMonth() + delta);
      setAnchor(toISO(d));
    } else {
      const d = new Date(`${anchor}T00:00:00`);
      d.setDate(d.getDate() + delta);
      setAnchor(toISO(d));
    }
  };

  if (redirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-gray-500 text-sm font-semibold animate-pulse">Loading operations…</p>
      </div>
    );
  }

  const wording = scopeWording(scope);
  const metrics = data?.metrics;
  const boxes = data?.boxes;
  const dateButtonLabel =
    scope === 'day' ? (anchor === todayISO() ? 'Today' : formatDate(anchor))
      : scope === 'month' ? monthBounds(anchor).label
        : `${formatDate(rangeFrom)} → ${formatDate(rangeTo)}`;
  // The hero's date label follows the selected scope: a day, a month name, or
  // the explicit range — never a bare month for a range. Prefer the window the
  // server actually computed so the two can never drift.
  const heroDateLabel = scope === 'month'
    ? monthBounds(data?.window.from || anchor).label
    : scope === 'day'
      ? dateButtonLabel
      : `${formatDate(data?.window.from || rangeFrom)} → ${formatDate(data?.window.to || rangeTo)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header + date filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <FuelBoxLogo size={44} showWordmark={false} showRule={false} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Operations</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">Operations Dashboard</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-gray-200 bg-white p-1">
            {(['day', 'month', 'range'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  scope === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {s === 'day' ? 'Day' : s === 'month' ? 'Month' : 'From – To'}
              </button>
            ))}
          </div>

          {scope === 'range' ? (
            <div className="flex items-center gap-2">
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm" />
              <span className="text-gray-400">→</span>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm" />
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white">
              <button type="button" onClick={() => shiftAnchor(-1)} aria-label="Previous" className="px-2 py-2 text-gray-400 hover:text-gray-700">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* The label doubles as a native picker: a month picker for the
                  Month scope, a day picker for Day, so any date is reachable
                  without stepping through chevrons. */}
              <label className="relative inline-flex cursor-pointer items-center gap-2 px-1 py-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" /> {dateButtonLabel}
                <input
                  type={scope === 'month' ? 'month' : 'date'}
                  value={scope === 'month' ? anchor.slice(0, 7) : anchor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setAnchor(scope === 'month' ? `${v}-01` : v);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={scope === 'month' ? 'Select month' : 'Select date'}
                />
              </label>
              <button type="button" onClick={() => shiftAnchor(1)} aria-label="Next" className="px-2 py-2 text-gray-400 hover:text-gray-700">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ── Box preparation hero ──────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm opacity-85">
              Boxes to prepare {wording.period} · {heroDateLabel}
            </p>
            <p className="text-6xl font-bold tabular-nums">{boxes?.total ?? 0}</p>
            <p className="text-xs opacity-75">After removing skipped clients</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MealChip icon={Coffee} label="Breakfast" value={boxes?.breakfast ?? 0} />
            <MealChip icon={Sun} label="Lunch" value={boxes?.lunch ?? 0} />
            <MealChip icon={Moon} label="Dinner" value={boxes?.dinner ?? 0} />
          </div>
        </div>
      </div>

      {/* ── Metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard icon={Users} label="Total clients" value={metrics?.total_clients ?? 0} />
        <MetricCard icon={Users} label={`Active ${wording.unit}`} value={metrics?.active ?? 0} accent="text-emerald-700" />
        <MetricCard icon={Users} label="Inactive / completed" value={metrics?.inactive ?? 0} />
        <MetricCard icon={Ban} label={`Skipped ${wording.unit}`} value={metrics?.skipped ?? 0} accent="text-red-600" />
        <MetricCard icon={Box} label={`Boxes ${wording.unit}`} value={metrics?.boxes ?? 0} />
        <MetricCard icon={IndianRupee} label={`Collected ${wording.unit}`} value={formatINR(metrics?.collected ?? 0)} accent="text-emerald-700" />
        <MetricCard icon={IndianRupee} label="Pending balance (all)" value={formatINR(metrics?.pending_balance ?? 0)} accent="text-red-600" />
        <MetricCard icon={IndianRupee} label="Total received (lifetime)" value={formatINR(metrics?.total_received ?? 0)} />
        <MetricCard icon={IndianRupee} label="Trial received (lifetime)" value={formatINR(metrics?.trial_received ?? 0)} />
        <MetricCard icon={IndianRupee} label="Package received (lifetime)" value={formatINR(metrics?.package_received ?? 0)} />
      </div>

      {/* ── Clients ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
          <h2 className="text-xl font-bold text-gray-900">Clients</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID, name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm font-semibold">Loading clients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm font-semibold text-gray-400">
            {search ? 'No clients match this search.' : 'No clients yet — create your first client.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const meta = STATUS_META[c.computed_status];
              const actions = availableActions(c.computed_status, c.plan_type);
              return (
                <div key={c.id} className="flex flex-col gap-3 p-4 hover:bg-gray-50/60 transition lg:flex-row lg:items-center">
                  <Link
                    href={`/admin/roles/sales/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-blue-600">
                      {c.client_label}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900 hover:text-blue-700" title={c.name}>{c.name}</div>
                      <div className="truncate text-xs text-gray-500 tabular-nums">
                        {c.phone} · {c.plan_type} · {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${meta.className}`}>
                      {meta.label}
                    </span>
                    {c.outstanding > 0 && (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                        Due {formatINR(c.outstanding)}
                      </span>
                    )}
                    {actions.map((a) => {
                      const m = ACTION_META[a];
                      const Icon = m.icon;
                      return (
                        <button
                          key={a}
                          type="button"
                          title={m.label}
                          disabled={busyId === c.id}
                          onClick={() => openActionWithDetail(c, a)}
                          className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition disabled:opacity-50 ${m.className}`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Action modal (shared with the Clients page) ───────────────── */}
      {modal && (
        <ActionModal
          modal={modal}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onSubmit={submitAction}
          onDelete={confirmDelete}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${
          toast.error ? 'bg-red-600' : 'bg-gray-900'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ── Presentational pieces ─────────────────────────────────────────────── */

function MealChip({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/15 px-4 py-3 text-center">
      <Icon className="mx-auto w-4 h-4 opacity-80" />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function ActionModal({
  modal, form, setForm, saving, onClose, onSubmit, onDelete,
}: {
  modal: { type: ClientAction; client: DashboardClient };
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDelete: (c: DashboardClient) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{ACTION_META[modal.type].label}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{modal.client.client_label} · {modal.client.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {modal.type === 'payment' && (
            <>
              <Field label="Amount (₹)">
                <input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Method">
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls}>
                  {['cash', 'card', 'upi', 'bank_transfer', 'online', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </Field>
              <Field label="Date">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Note (optional)">
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
              </Field>
              <p className="text-xs text-gray-500">Outstanding: <strong>{formatINR(modal.client.outstanding)}</strong></p>
            </>
          )}

          {modal.type === 'renew' && (
            <>
              <Field label="Renewal days">
                <input type="number" min={1} max={modal.client.plan_type === 'package' ? 26 : 6} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={inputCls} />
              </Field>
              <p className="text-xs text-gray-500">Current end date: <strong>{formatDate(modal.client.end_date)}</strong>. A new plan is appended and the end date moves forward.</p>
            </>
          )}

          {modal.type === 'convert' && (
            <>
              <Field label="Package duration (days, 1–26)">
                <input type="number" min={1} max={26} value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className={inputCls} />
              </Field>
              <p className="text-xs text-gray-500">Promotes {modal.client.name} from trial to a package plan and preserves the trial in history.</p>
            </>
          )}

          {modal.type === 'skip_dates' && (
            <Field label="Skip dates (one per line, YYYY-MM-DD)">
              <textarea rows={5} value={form.skip_dates} onChange={(e) => setForm({ ...form, skip_dates: e.target.value })} className={inputCls} />
            </Field>
          )}

          {modal.type === 'edit' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Mobile number">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Delivery address">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Goal">
                  <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Plan">
                  <select value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })} className={inputCls}>
                    {PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Boxes/day">
                  <input type="number" min={1} value={form.boxes_per_day} onChange={(e) => setForm({ ...form, boxes_per_day: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Duration">
                  <input type="number" min={1} value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Start date">
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total (₹)">
                  <input type="number" min={0} value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Paid (₹)">
                  <input type="number" min={0} value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Skip dates (one per line)">
                <textarea rows={3} value={form.skip_dates} onChange={(e) => setForm({ ...form, skip_dates: e.target.value })} className={inputCls} />
              </Field>
            </>
          )}

          {(modal.type === 'skip_today' || modal.type === 'inactive' || modal.type === 'activate') && (
            <p className="text-sm text-gray-600">
              {modal.type === 'inactive'
                ? <>Deactivate <strong>{modal.client.name}</strong>? Historical records and payment history are kept.</>
                : modal.type === 'activate'
                  ? <>Reactivate <strong>{modal.client.name}</strong>?</>
                  : <>Mark today&apos;s delivery as skipped for <strong>{modal.client.name}</strong>? The end date moves forward one delivery day.</>}
            </p>
          )}

          {modal.type === 'delete' && (
            <p className="text-sm text-red-600 font-semibold">
              Delete <strong>{modal.client.name}</strong> ({modal.client.client_label})? This cannot be undone.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm disabled:opacity-50">
            Cancel
          </button>
          {modal.type === 'delete' ? (
            <button onClick={() => onDelete(modal.client)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
            </button>
          ) : (
            <button onClick={onSubmit} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
