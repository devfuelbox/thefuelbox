'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, UserPlus, Loader2, Filter, X,
  AlertTriangle, SkipForward, Repeat, ArrowUpRight, CalendarOff,
  IndianRupee, Pencil, Ban, Trash2, RotateCcw, Check, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  computeClientStatus, availableActions, STATUS_META, formatDate, formatINR,
  balanceOf, type ClientAction, type ClientStatus,
} from '@/lib/clients';
import FuelBoxLogo from '@/components/FuelBoxLogo';

type ClientRow = {
  id: string;
  client_no: number | null;
  client_label: string;
  name: string;
  phone: string;
  address?: string | null;
  goal?: string | null;
  plan_type: 'trial' | 'package';
  duration_days: number;
  boxes_per_day: number;
  schedule: string;
  start_date?: string | null;
  end_date?: string | null;
  skip_dates?: string[] | null;
  total_boxes: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  balance_due_date?: string | null;
  status: string;
  notes?: string | null;
};

type Row = ClientRow & { computed_status: ClientStatus };

const STATUS_FILTERS: { key: 'all' | ClientStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'skipped_today', label: 'Skipped Today' },
  { key: 'completed', label: 'Completed' },
  { key: 'inactive', label: 'Inactive' },
];

const ACTION_META: Record<ClientAction, { label: string; short: string; icon: any; className: string }> = {
  skip_today: { label: 'Skipped Today', short: 'Skip', icon: SkipForward, className: 'text-purple-700 border-purple-200 hover:bg-purple-50' },
  renew: { label: 'Renew', short: 'Renew', icon: Repeat, className: 'text-blue-700 border-blue-200 hover:bg-blue-50' },
  convert: { label: 'Convert to Package', short: 'Convert', icon: ArrowUpRight, className: 'text-indigo-700 border-indigo-200 hover:bg-indigo-50' },
  skip_dates: { label: 'Skip Dates', short: 'Skips', icon: CalendarOff, className: 'text-gray-700 border-gray-200 hover:bg-gray-50' },
  payment: { label: 'Payment', short: 'Pay', icon: IndianRupee, className: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  edit: { label: 'Edit', short: 'Edit', icon: Pencil, className: 'text-gray-700 border-gray-200 hover:bg-gray-50' },
  inactive: { label: 'Inactive', short: 'Off', icon: Ban, className: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
  activate: { label: 'Activate', short: 'On', icon: RotateCcw, className: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  delete: { label: 'Delete', short: 'Del', icon: Trash2, className: 'text-red-600 border-red-200 hover:bg-red-50' },
};

const PAGE_SIZE = 10;
const todayISO = () => new Date().toISOString().split('T')[0];

export default function SalesClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'trial' | 'package'>('all');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<null | { type: ClientAction; client: ClientRow }>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/roles/sales/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Failed to load clients');
      const rows = await r.json();
      setClients(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load clients');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const withStatus = useMemo<Row[]>(
    () => clients.map((c) => ({ ...c, computed_status: computeClientStatus(c) as ClientStatus })),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return withStatus.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.client_label.toLowerCase().includes(q) ||
        (digits && c.phone.includes(digits));
      const matchesStatus = statusFilter === 'all' || c.computed_status === statusFilter;
      const matchesPlan = planFilter === 'all' || c.plan_type === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [withStatus, search, statusFilter, planFilter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: withStatus.length, active: 0, skipped_today: 0, completed: 0, inactive: 0 };
    withStatus.forEach((c) => { base[c.computed_status] = (base[c.computed_status] || 0) + 1; });
    return base;
  }, [withStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  // Any filter change resets to the first page so results are never hidden.
  useEffect(() => { setPage(1); }, [search, statusFilter, planFilter]);

  const hasFilters = search || statusFilter !== 'all' || planFilter !== 'all';

  const openAction = (client: ClientRow, type: ClientAction) => {
    setForm({
      amount: balanceOf(client.total_amount, client.paid_amount),
      method: 'cash',
      date: todayISO(),
      note: '',
      days: 7,
      duration_days: client.duration_days,
      skip_dates: (client.skip_dates || []).join('\n'),
      name: client.name,
      phone: client.phone,
      address: client.address || '',
      goal: client.goal || '',
      plan_type: client.plan_type,
      boxes_per_day: client.boxes_per_day,
      total_amount: client.total_amount,
      paid_amount: client.paid_amount,
      balance_due_date: client.balance_due_date || '',
      notes: client.notes || '',
      start_date: client.start_date || '',
    });
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
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || 'Action failed');
      }
      const updated = await r.json();
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setModal(null);
      showToast(`${ACTION_META[type].label} — ${client.name} updated`);
    } catch (e: any) {
      showToast(e.message || 'Action failed', true);
    }
    setSaving(false);
  };

  const confirmDelete = async (client: ClientRow) => {
    setBusyId(client.id);
    try {
      const r = await fetch(`/api/roles/sales/clients?id=${client.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Delete failed');
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      setModal(null);
      showToast(`${client.name} deleted`);
    } catch (e: any) {
      showToast(e.message || 'Delete failed', true);
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <FuelBoxLogo size={44} showWordmark={false} showRule={false} />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Clients</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage TFBC meal box clients — plans, delivery schedules and payments.
            </p>
          </div>
        </div>
        <Link
          href="/admin/roles/sales/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm shadow-sm shrink-0 min-h-[44px] w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" /> New Client
        </Link>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client ID, name or mobile number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All plans</option>
              <option value="trial">Trial</option>
              <option value="package">Package</option>
            </select>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter('all'); setPlanFilter('all'); }}
                className="inline-flex items-center gap-1 px-3 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                statusFilter === s.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {s.label}
              <span className={`ml-1.5 ${statusFilter === s.key ? 'text-blue-100' : 'text-gray-400'}`}>
                {counts[s.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Client list — one compact card per client, matching the reference layout */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm font-semibold">Loading clients…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-6 flex items-center gap-2 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400">
          <p className="text-sm font-semibold">
            {hasFilters ? 'No clients match these filters.' : 'No clients yet — create your first client.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {pageRows.map((c) => {
              const meta = STATUS_META[c.computed_status];
              const actions = availableActions(c.computed_status, c.plan_type);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center hover:bg-gray-50/60 transition"
                >
                  {/* Identity: ID badge, name, then the compact detail line.
                      The whole block links through to the View Client page. */}
                  <Link
                    href={`/admin/roles/sales/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-blue-600">
                      {c.client_label}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900 hover:text-blue-700" title={c.name}>
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-gray-500 tabular-nums">
                        {c.phone} · {c.plan_type} · {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </div>
                    </div>
                  </Link>

                  {/* Status + actions, aligned and wrapping neatly on small screens */}
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                    {actions.map((a) => {
                      const m = ACTION_META[a];
                      const Icon = m.icon;
                      return (
                        <button
                          key={a}
                          type="button"
                          title={m.label}
                          onClick={() => openAction(c, a)}
                          className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition ${m.className}`}
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400 font-medium">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} client{filtered.length !== 1 ? 's' : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                      p === safePage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-12 overflow-y-auto"
          onClick={() => !saving && setModal(null)}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{ACTION_META[modal.type].label}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{modal.client.client_label} · {modal.client.name}</p>
              </div>
              <button
                onClick={() => !saving && setModal(null)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {modal.type === 'payment' && (
                <>
                  <Field label="Amount (₹)">
                    <input type="number" min={1} value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Method">
                    <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls}>
                      {['cash', 'card', 'upi', 'bank_transfer', 'online', 'other'].map((m) => (
                        <option key={m} value={m}>{m.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input type="date" value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Note (optional)">
                    <input type="text" value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
                  </Field>
                  <p className="text-xs text-gray-500">
                    Outstanding balance: <strong>{formatINR(balanceOf(modal.client.total_amount, modal.client.paid_amount))}</strong>
                  </p>
                </>
              )}

              {modal.type === 'renew' && (
                <>
                  <Field label="Renewal days">
                    <input type="number" min={1} value={form.days}
                      onChange={(e) => setForm({ ...form, days: e.target.value })} className={inputCls} />
                  </Field>
                  <p className="text-xs text-gray-500">
                    Current end date: <strong>{formatDate(modal.client.end_date)}</strong>. The renewal starts the next delivery day and pushes the end date forward.
                  </p>
                </>
              )}

              {modal.type === 'convert' && (
                <>
                  <Field label="Package duration (days, 1–26)">
                    <input type="number" min={1} max={26} value={form.duration_days}
                      onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className={inputCls} />
                  </Field>
                  <p className="text-xs text-gray-500">This promotes {modal.client.name} from a trial to a package plan.</p>
                </>
              )}

              {modal.type === 'skip_dates' && (
                <Field label="Skip dates (one per line, YYYY-MM-DD)">
                  <textarea rows={5} value={form.skip_dates}
                    onChange={(e) => setForm({ ...form, skip_dates: e.target.value })} className={inputCls} />
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
                        <option value="loss">Weight Loss</option>
                        <option value="gain">Weight Gain</option>
                        <option value="muscle">Muscle Gain</option>
                        <option value="maintenance">Healthy Meal</option>
                      </select>
                    </Field>
                    <Field label="Plan">
                      <select value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })} className={inputCls}>
                        <option value="trial">Trial</option>
                        <option value="package">Package</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Boxes/day">
                      <input type="number" min={1} value={form.boxes_per_day}
                        onChange={(e) => setForm({ ...form, boxes_per_day: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Duration">
                      <input type="number" min={1} value={form.duration_days}
                        onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Start date">
                      <input type="date" value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Total (₹)">
                      <input type="number" min={0} value={form.total_amount}
                        onChange={(e) => setForm({ ...form, total_amount: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Paid (₹)">
                      <input type="number" min={0} value={form.paid_amount}
                        onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Skip dates (one per line)">
                    <textarea rows={3} value={form.skip_dates}
                      onChange={(e) => setForm({ ...form, skip_dates: e.target.value })} className={inputCls} />
                  </Field>
                </>
              )}

              {modal.type === 'skip_today' && (
                <p className="text-sm text-gray-600">
                  Mark today&apos;s delivery as skipped for <strong>{modal.client.name}</strong>? The end date moves forward by one delivery day.
                </p>
              )}

              {modal.type === 'inactive' && (
                <p className="text-sm text-gray-600">
                  Deactivate <strong>{modal.client.name}</strong>? Historical records and payment history are kept.
                </p>
              )}

              {modal.type === 'activate' && (
                <p className="text-sm text-gray-600">
                  Reactivate <strong>{modal.client.name}</strong>?
                </p>
              )}

              {modal.type === 'delete' && (
                <p className="text-sm text-red-600 font-semibold">
                  Delete <strong>{modal.client.name}</strong> ({modal.client.client_label})? This cannot be undone.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => !saving && setModal(null)}
                disabled={saving}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              {modal.type === 'delete' ? (
                <button
                  onClick={() => confirmDelete(modal.client)}
                  disabled={saving || busyId === modal.client.id}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 text-sm disabled:opacity-50"
                >
                  {busyId === modal.client.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              ) : (
                <button
                  onClick={submitAction}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
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

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
