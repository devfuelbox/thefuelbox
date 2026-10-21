/**
 * Server-side helpers for the View Client page.
 *
 * The `clients` row holds the *current* plan so the Clients list and its actions
 * stay simple. This module layers the per-plan and audit data the detail page
 * needs on top of it:
 *
 *   - one `client_plans` row per plan the client has held (appended on renew /
 *     convert, never rewritten), each with its own payment ledger
 *   - one `client_events` row per noteworthy change, for "Update history"
 *
 * Everything here is idempotent and derives from persisted data — no fabricated
 * history. When a client predates these tables we backfill a single plan plus a
 * "client created" event from the existing row so nothing is lost.
 */

import { clientLabel, type PlanType, type ScheduleKey } from '@/lib/clients';

export type PaymentEntry = {
  id?: string;
  amount: number;
  method?: string;
  reference?: string;
  date: string;
  note?: string;
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
  skipped_today: 'Skipped Today',
};

const toNum = (v: unknown) => Number(v) || 0;

/** Stable-enough id for a payment entry inside a plan's JSON ledger. */
export function paymentId(): string {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A deterministic id for entries that predate id-tracking, so the ledger stays
 * stable across reads without having to rewrite the row. Derived from the
 * entry's own fields — two payments that share amount+date+method get the same
 * fallback id, which is acceptable because they are indistinguishable anyway.
 */
function fallbackPaymentId(p: any): string {
  const seed = `${toNum(p.amount)}|${p.date || ''}|${p.method || ''}|${p.note || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `pay_legacy_${hash.toString(36)}`;
}

export function normalizePayments(raw: unknown): PaymentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object')
    .map((p: any) => ({
      id: p.id || fallbackPaymentId(p),
      amount: toNum(p.amount),
      method: p.method || 'cash',
      reference: p.reference || '',
      date: typeof p.date === 'string' ? p.date : String(p.date || '').slice(0, 10),
      note: p.note || '',
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function plain(row: any): any {
  return typeof row?.get === 'function' ? row.get({ plain: true }) : row;
}

/** Build the plan payload from a client row (used for create + backfill). */
export function planFromClient(client: any): Record<string, any> {
  const c = plain(client);
  return {
    client_id: c.id,
    plan_type: c.plan_type === 'package' ? 'package' : 'trial',
    status: c.status || 'active',
    goal: c.goal || null,
    duration_days: toNum(c.duration_days) || 1,
    boxes_per_day: toNum(c.boxes_per_day) || 1,
    meals: Array.isArray(c.meals) ? c.meals : [],
    schedule: c.schedule === 'mon_sat' ? 'mon_sat' : 'mon_fri',
    start_date: c.start_date || null,
    end_date: c.end_date || null,
    skip_dates: Array.isArray(c.skip_dates) ? c.skip_dates : [],
    total_boxes: toNum(c.total_boxes) || toNum(c.boxes_per_day) * toNum(c.duration_days),
    total_amount: toNum(c.total_amount),
    paid_amount: toNum(c.paid_amount),
    balance_due_date: c.balance_due_date || null,
    payment_history: normalizePayments(c.payment_history),
    notes: c.notes || null,
  };
}

/** Record an audit event. Never throws — history must not break a write path. */
export async function logEvent(
  ClientEvent: any,
  clientId: string,
  type: string,
  message: string,
  planId?: string | null,
) {
  try {
    await (ClientEvent as any).create({
      client_id: clientId,
      plan_id: planId || null,
      type,
      message,
    });
  } catch (err) {
    console.warn('[client-detail] logEvent failed:', (err as any)?.message || err);
  }
}

/**
 * Ensure a client has at least one plan row. Runs on detail GET so clients that
 * existed before `client_plans` did get a faithful plan + creation event.
 */
export async function ensurePlans(ClientPlan: any, ClientEvent: any, client: any) {
  const c = plain(client);
  const count = await (ClientPlan as any).count({ where: { client_id: c.id } });
  if (count > 0) return;

  const plan = await (ClientPlan as any).create(planFromClient(c));
  const label = clientLabel(c.client_no);
  const planType = c.plan_type === 'package' ? 'package' : 'trial';
  await logEvent(
    ClientEvent,
    c.id,
    'plan_created',
    `${label} · ${planType} plan · ${toNum(c.duration_days)} days from ${c.start_date || '—'} · total ₹${toNum(c.total_amount)}, paid ₹${toNum(c.paid_amount)}`,
    plan.id,
  );
  await logEvent(
    ClientEvent,
    c.id,
    'client_created',
    `${c.name} · ${planType} · ${toNum(c.duration_days)} days from ${c.start_date || '—'} · total ₹${toNum(c.total_amount)}, paid ₹${toNum(c.paid_amount)}`,
    plan.id,
  );
}

export type PlanSummary = {
  total: number;
  paid: number;
  balance: number;
};

export type ClientSummary = {
  lifetime_paid: number;
  outstanding: number;
  trial: PlanSummary;
  package: PlanSummary;
};

/** Roll every plan up into the four headline figures on the detail page. */
export function summarize(plans: any[]): ClientSummary {
  const empty = () => ({ total: 0, paid: 0, balance: 0 });
  const summary: ClientSummary = {
    lifetime_paid: 0,
    outstanding: 0,
    trial: empty(),
    package: empty(),
  };

  for (const p of plans) {
    const total = toNum(p.total_amount);
    const paid = toNum(p.paid_amount);
    const balance = Math.max(0, total - paid);
    summary.lifetime_paid += paid;
    summary.outstanding += balance;
    const bucket = p.plan_type === 'package' ? summary.package : summary.trial;
    bucket.total += total;
    bucket.paid += paid;
    bucket.balance += balance;
  }
  return summary;
}

/** Shape a plan row (and its ledger) for the API response. */
export function decoratePlan(row: any) {
  const p = plain(row);
  const total = toNum(p.total_amount);
  const paid = toNum(p.paid_amount);
  const schedule: ScheduleKey = p.schedule === 'mon_sat' ? 'mon_sat' : 'mon_fri';
  return {
    ...p,
    plan_type: (p.plan_type === 'package' ? 'package' : 'trial') as PlanType,
    meals: Array.isArray(p.meals) ? p.meals : [],
    skip_dates: Array.isArray(p.skip_dates) ? p.skip_dates : [],
    schedule,
    total_amount: total,
    paid_amount: paid,
    balance: Math.max(0, total - paid),
    payment_history: normalizePayments(p.payment_history),
    total_boxes: toNum(p.total_boxes) || toNum(p.boxes_per_day) * toNum(p.duration_days),
  };
}

/** Shape an audit event row for the API response. */
export function decorateEvent(row: any) {
  const e = plain(row);
  return {
    id: e.id,
    type: e.type,
    message: e.message || '',
    plan_id: e.plan_id || null,
    created_at: e.createdAt || e.created_at || null,
  };
}
