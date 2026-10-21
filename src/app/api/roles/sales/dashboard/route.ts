import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import {
  addBoxMeals,
  boxesForPlan,
  clientLabel,
  computeClientStatus,
  monthBounds,
  todayISO,
  withinRange,
  type BoxMeals,
  type PlanLike,
  type Scope,
} from '@/lib/clients';
import { ensurePlans } from '@/lib/client-detail';

const ROLES = ['super_admin', 'admin', 'sales'];

type AnyRow = any;
const num = (v: unknown) => Number(v) || 0;
const plain = (row: AnyRow) => (typeof row?.get === 'function' ? row.get({ plain: true }) : row);
const emptyBoxes = (): BoxMeals => ({ total: 0, breakfast: 0, lunch: 0, dinner: 0 });

/** Resolve the inclusive [from, to] window the dashboard should report on. */
function resolveWindow(scope: Scope, searchParams: URLSearchParams): { from: string; to: string; label: string } {
  const today = todayISO();
  if (scope === 'day') {
    const date = searchParams.get('date') || today;
    return { from: date, to: date, label: date };
  }
  if (scope === 'range') {
    const from = searchParams.get('from') || today;
    const to = searchParams.get('to') || from;
    // Guard against a reversed range so the SQL/date maths never goes negative.
    return from <= to ? { from, to, label: `${from} → ${to}` } : { from: to, to: from, label: `${to} → ${from}` };
  }
  // Month (default): the month containing the requested date, defaulting to today.
  const month = monthBounds(searchParams.get('date') || today);
  return { from: month.from, to: month.to, label: month.label };
}

export async function GET(req: Request) {
  const auth = requireRole(req, ROLES);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { Client, ClientPlan, ClientEvent } = await getDbModels();

    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get('scope') as Scope) || 'month';
    const window_ = resolveWindow(scope, searchParams);

    const clientRows = await (Client as any).findAll({ order: [['client_no', 'ASC']], raw: true });

    // Make sure every client has plan rows (backfills legacy clients once).
    for (const row of clientRows) {
      await ensurePlans(ClientPlan, ClientEvent, row);
    }
    const planRows = await (ClientPlan as any).findAll({ order: [['created_at', 'ASC']], raw: true });

    const plansByClient: Record<string, AnyRow[]> = {};
    for (const p of planRows) {
      const plan = plain(p);
      (plansByClient[plan.client_id] ||= []).push(plan);
    }

    // ── Boxes to prepare over the window, split by meal ──
    let boxes = emptyBoxes();
    for (const plan of planRows) {
      const p = plain(plan);
      boxes = addBoxMeals(boxes, boxesForPlan(p as PlanLike, window_.from, window_.to));
    }

    // ── Per-client roll-up: boxes, status, financials ──
    const clients = clientRows.map((rawRow: AnyRow) => {
      const c = plain(rawRow);
      const plans = (plansByClient[c.id] || []) as AnyRow[];

      // Roll the client's plans up the same way the detail page does, so the
      // dashboard's per-client outstanding always matches the View Client page.
      let lifetimePaid = 0;
      let outstanding = 0;
      for (const p of plans) {
        const paid = num(p.paid_amount);
        lifetimePaid += paid;
        outstanding += Math.max(0, num(p.total_amount) - paid);
      }

      const clientBoxes = plans.reduce<BoxMeals>(
        (acc, p) => addBoxMeals(acc, boxesForPlan(p as PlanLike, window_.from, window_.to)),
        emptyBoxes(),
      );

      // Is this client active during the window at all? Any plan that delivers
      // on the window's last day, or has a delivery inside it, counts.
      const deliversInWindow = clientBoxes.total > 0;
      const status = computeClientStatus({
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
        skip_dates: c.skip_dates,
        schedule: c.schedule,
        duration_days: c.duration_days,
      });

      // Payments actually received inside the window (dedup by entry id).
      const windowPaid = plans.reduce((sum, p) => {
        const ledger = Array.isArray(p.payment_history) ? p.payment_history : [];
        const seen = new Set<string>();
        let paid = 0;
        ledger.forEach((entry: AnyRow, i: number) => {
          const id = entry?.id || `idx-${p.id}-${i}`;
          if (seen.has(id)) return;
          seen.add(id);
          if (withinRange(entry?.date, window_.from, window_.to)) paid += num(entry?.amount);
        });
        return sum + paid;
      }, 0);

      return {
        id: c.id,
        client_no: c.client_no,
        client_label: clientLabel(c.client_no),
        name: c.name,
        phone: c.phone,
        plan_type: c.plan_type === 'package' ? 'package' : 'trial',
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        schedule: c.schedule,
        skip_dates: Array.isArray(c.skip_dates) ? c.skip_dates : [],
        status: c.status,
        computed_status: status,
        outstanding,
        lifetime_paid: lifetimePaid,
        boxes_in_window: clientBoxes.total,
        paid_in_window: windowPaid,
        delivers_in_window: deliversInWindow,
      };
    });

    // ── Headline financial figures (lifetime, independent of scope) ──
    // Summing each plan's own paid/balance keeps the parts equal to the whole:
    // trial_received + package_received === total_received, and every payment
    // belongs to exactly one plan, so it can never be counted twice.
    let lifetimePaid = 0;
    let trialPaid = 0;
    let packagePaid = 0;
    let outstanding = 0;

    for (const plan of planRows) {
      const p = plain(plan);
      const paid = num(p.paid_amount);
      const balance = Math.max(0, num(p.total_amount) - paid);
      lifetimePaid += paid;
      outstanding += balance;
      if (p.plan_type === 'package') packagePaid += paid;
      else trialPaid += paid;
    }

    // ── Window totals ──
    const boxTotal = boxes.total;
    let collectedInWindow = 0;
    for (const client of clients) collectedInWindow += client.paid_in_window;

    // "Skipped" counts clients that skipped at least one delivery inside the
    // window — the same skip list the detail page shows.
    const skippedCount = clients.filter((c) =>
      c.skip_dates.some((d: string) => withinRange(d, window_.from, window_.to)),
    ).length;

    // "Active" counts clients with a delivery in the window; "Inactive /
    // completed" counts everyone else (no delivery planned in this window).
    const activeCount = clients.filter((c) => c.delivers_in_window).length;
    const inactiveCount = clients.length - activeCount;

    return NextResponse.json({
      scope,
      window: window_,
      boxes: {
        total: boxTotal,
        breakfast: boxes.breakfast,
        lunch: boxes.lunch,
        dinner: boxes.dinner,
      },
      metrics: {
        total_clients: clients.length,
        active: activeCount,
        inactive: inactiveCount,
        skipped: skippedCount,
        boxes: boxTotal,
        collected: collectedInWindow,
        pending_balance: outstanding,
        total_received: lifetimePaid,
        trial_received: trialPaid,
        package_received: packagePaid,
      },
      clients,
    });
  } catch (err) {
    console.error('[Dashboard] GET:', err);
    return NextResponse.json({ message: 'Failed to build dashboard' }, { status: 500 });
  }
}
