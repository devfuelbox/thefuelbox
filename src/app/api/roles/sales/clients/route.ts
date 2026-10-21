import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import {
  computeEndDate,
  clientLabel,
  planMax,
  todayISO,
  type PlanType,
  type ScheduleKey,
} from '@/lib/clients';
import {
  decoratePlan,
  decorateEvent,
  ensurePlans,
  logEvent,
  normalizePayments,
  paymentId,
  planFromClient,
  summarize,
} from '@/lib/client-detail';

const ROLES = ['super_admin', 'admin', 'sales'];

type ClientRow = any;

/** Next sequential TFBC number — never reused, gaps stay gaps. */
async function nextClientNo(Client: any): Promise<number> {
  const max = await (Client as any).max('client_no');
  return (Number(max) || 0) + 1;
}

/**
 * Derive the display label and a couple of computed columns the UI always
 * needs, so the page never has to know the schedule rules itself.
 */
function decorate(row: ClientRow) {
  const plain = typeof row?.get === 'function' ? row.get({ plain: true }) : row;
  const duration = Number(plain.duration_days) || 0;
  const boxesPerDay = Number(plain.boxes_per_day) || 0;
  return {
    ...plain,
    client_label: clientLabel(plain.client_no),
    total_amount: Number(plain.total_amount) || 0,
    paid_amount: Number(plain.paid_amount) || 0,
    balance: Math.max(0, (Number(plain.total_amount) || 0) - (Number(plain.paid_amount) || 0)),
    total_boxes: Number(plain.total_boxes) || boxesPerDay * duration,
  };
}

/**
 * Seed the clients table the first time it is found empty, so the Clients page
 * reflects work already done in the older Sales flow (customers + enquiries)
 * instead of starting blank. Existing rows are never modified — this only runs
 * when there are zero clients — and the phone is the join key.
 */
async function backfillIfEmpty(Client: any, Customer: any, CustomerEnquiry: any, ClientPlan: any, ClientEvent: any) {
  const existing = await (Client as any).count();
  if (existing > 0) return;

  const customers = await (Customer as any).findAll({ order: [['created_at', 'ASC']], raw: true });
  if (!customers.length) return;

  const enquiries = await (CustomerEnquiry as any).findAll({ raw: true });
  const enquiryByPhone: Record<string, any> = {};
  for (const e of enquiries) {
    const key = String(e.phone || '').replace(/\D/g, '').slice(-10);
    if (key && !enquiryByPhone[key]) enquiryByPhone[key] = e;
  }

  let no = 0;
  for (const c of customers) {
    const phone = String(c.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone) continue;
    const enq = enquiryByPhone[phone] || null;
    no += 1;

    const planType: PlanType =
      Number(enq?.total_amount) > 0 && Number(enq?.total_amount) <= 4000 ? 'trial' : 'package';
    const duration = Math.max(1, Math.min(planMax(planType), Number(c.freq) || 3));
    const startDate = enq?.enquiry_date || (c.created_at ? String(c.created_at).slice(0, 10) : null);

    const record = await (Client as any).create({
      client_no: no,
      name: c.name || enq?.customer_name || 'Client',
      phone,
      address: enq?.address || c.address || null,
      goal: c.goal || enq?.goal || null,
      plan_type: planType,
      duration_days: duration,
      boxes_per_day: Number(c.freq) || 1,
      schedule: 'mon_fri',
      start_date: startDate,
      end_date: startDate ? computeEndDate(startDate, duration, 'mon_fri', []) : null,
      total_amount: Number(enq?.total_amount) || Number(c.meal_plan_price) || 0,
      paid_amount: Number(enq?.paid_amount) || 0,
      payment_history: enq?.payment_history || [],
      status: 'active',
    });

    // Give each backfilled client its plan + creation history so the detail
    // page is complete without a second pass.
    await ensurePlans(ClientPlan, ClientEvent, record);
  }
}

export async function GET(req: Request) {
  const auth = requireRole(req, ROLES);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { Client, Customer, CustomerEnquiry, ClientPlan, ClientEvent } = await getDbModels();
    await backfillIfEmpty(Client, Customer, CustomerEnquiry, ClientPlan, ClientEvent);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // ── Detail view: one client with its plans and update history ──
    if (id) {
      const record: any = await (Client as any).findByPk(id);
      if (!record) return NextResponse.json({ message: 'Client not found' }, { status: 404 });

      await ensurePlans(ClientPlan, ClientEvent, record);

      const planRows = await (ClientPlan as any).findAll({
        where: { client_id: id },
        order: [['created_at', 'ASC']],
        raw: true,
      });
      const eventRows = await (ClientEvent as any).findAll({
        where: { client_id: id },
        order: [['created_at', 'DESC']],
        raw: true,
      });

      const plans = planRows.map(decoratePlan);
      return NextResponse.json({
        client: decorate(record),
        plans,
        events: eventRows.map(decorateEvent),
        summary: summarize(plans),
      });
    }

    // ── List view ──
    const rows = await (Client as any).findAll({
      order: [['client_no', 'ASC']],
      raw: true,
    });

    return NextResponse.json(rows.map(decorate));
  } catch (err) {
    console.error('[Clients] GET:', err);
    return NextResponse.json({ message: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, ROLES);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { Client, ClientPlan, ClientEvent } = await getDbModels();

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
    const planType: PlanType = body.plan_type === 'package' ? 'package' : 'trial';
    const schedule: ScheduleKey = body.schedule === 'mon_sat' ? 'mon_sat' : 'mon_fri';
    const duration = Number(body.duration_days) || 0;
    const boxesPerDay = Number(body.boxes_per_day) || 0;
    const skips: string[] = Array.isArray(body.skip_dates) ? body.skip_dates : [];
    const startDate: string = body.start_date || '';

    if (!name) return NextResponse.json({ message: 'Client name is required' }, { status: 400 });
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ message: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }
    if (!startDate) return NextResponse.json({ message: 'Start date is required' }, { status: 400 });
    if (!Number.isInteger(duration) || duration < 1 || duration > planMax(planType)) {
      return NextResponse.json(
        { message: `Duration must be between 1 and ${planMax(planType)} days` },
        { status: 400 },
      );
    }
    if (boxesPerDay < 1) {
      return NextResponse.json({ message: 'Select at least one meal' }, { status: 400 });
    }

    const existing = await (Client as any).findOne({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { message: 'A client with this mobile number already exists' },
        { status: 409 },
      );
    }

    const endDate = computeEndDate(startDate, duration, schedule, skips);
    if (!endDate) {
      return NextResponse.json(
        { message: 'Plan does not fit the schedule — check start date, duration and skips' },
        { status: 400 },
      );
    }

    const total = Number(body.total_amount) || 0;
    const paid = Number(body.paid_amount) || 0;
    if (total <= 0) return NextResponse.json({ message: 'Total amount must be greater than ₹0' }, { status: 400 });
    if (paid < 0) return NextResponse.json({ message: 'Paid amount cannot be negative' }, { status: 400 });
    if (paid > total) return NextResponse.json({ message: 'Paid amount cannot exceed the total amount' }, { status: 400 });

    const clientNo = await nextClientNo(Client);
    const initialPayments = paid > 0
      ? [{ id: paymentId(), amount: paid, method: 'cash', reference: '', date: new Date().toISOString().split('T')[0], note: 'Initial payment' }]
      : [];
    const record = await (Client as any).create({
      client_no: clientNo,
      name,
      phone,
      address: body.address || null,
      goal: body.goal || null,
      plan_type: planType,
      duration_days: duration,
      boxes_per_day: boxesPerDay,
      meals: Array.isArray(body.meals) ? body.meals : [],
      schedule,
      start_date: startDate,
      end_date: endDate,
      skip_dates: skips,
      total_boxes: boxesPerDay * duration,
      total_amount: total,
      paid_amount: paid,
      balance_due_date: body.balance_due_date || null,
      payment_history: initialPayments,
      status: 'active',
      notes: body.notes || null,
      assigned_sales_id: auth.user!.sub,
    });

    // Mirror the plan + record the creation history the detail page renders.
    const plan = await (ClientPlan as any).create({
      ...planFromClient(record),
      payment_history: initialPayments,
    });
    const label = clientLabel(clientNo);
    await logEvent(
      ClientEvent,
      record.id,
      'plan_created',
      `${label} · ${planType} plan · ${duration} days from ${startDate} · total ₹${total}, paid ₹${paid}`,
      plan.id,
    );
    await logEvent(
      ClientEvent,
      record.id,
      'client_created',
      `${name} · ${planType} · ${duration} days from ${startDate} · total ₹${total}, paid ₹${paid}`,
      plan.id,
    );

    return NextResponse.json(decorate(record), { status: 201 });
  } catch (err) {
    console.error('[Clients] POST:', err);
    return NextResponse.json({ message: 'Failed to create client' }, { status: 500 });
  }
}

/**
 * All per-client actions go through one PATCH handler keyed by `action`, so the
 * schedule/payment invariants (end date, balance, status) are recomputed in one
 * place no matter which button the sales team pressed.
 *
 *   skip_today    — add today to the skip list, push the end date forward
 *   skip_dates    — replace the skip list, push the end date forward
 *   payment       — add a payment entry and recompute paid/balance
 *   edit_payment  — edit or remove an existing payment entry on a plan
 *   renew         — append a new plan that extends the current one
 *   convert       — close the trial and append a package plan
 *   edit          — update the plan/details, recompute end date + totals
 *   activate      — bring an inactive client back to active
 *   inactive      — deactivate without touching history
 *
 * Every action also mirrors the change onto the client's current `client_plans`
 * row and appends a `client_events` audit entry, so the View Client page stays in
 * sync. Renew/convert append a *new* plan row instead of rewriting the old one,
 * which is what keeps per-plan payment history intact.
 */
export async function PATCH(req: Request) {
  const auth = requireRole(req, ROLES);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { Client, ClientPlan, ClientEvent } = await getDbModels();

    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id) return NextResponse.json({ message: 'Client id is required' }, { status: 400 });

    const record: any = await (Client as any).findByPk(id);
    if (!record) return NextResponse.json({ message: 'Client not found' }, { status: 404 });

    const current = record.get({ plain: true });
    const schedule: ScheduleKey = current.schedule === 'mon_sat' ? 'mon_sat' : 'mon_fri';
    let patch: Record<string, any> = {};

    // Make sure there is a plan row to mirror onto before any action runs.
    await ensurePlans(ClientPlan, ClientEvent, record);
    const planRows = await (ClientPlan as any).findAll({
      where: { client_id: id },
      order: [['created_at', 'ASC']],
    });
    const currentPlan: any = planRows[planRows.length - 1];

    // Mirror the client's snapshot columns onto the current plan row.
    const planPatchFrom = (fields: Record<string, any>) => {
      const keep: Record<string, any> = {};
      for (const k of [
        'plan_type', 'status', 'goal', 'duration_days', 'boxes_per_day', 'meals',
        'schedule', 'start_date', 'end_date', 'skip_dates', 'total_boxes',
        'total_amount', 'paid_amount', 'balance_due_date', 'payment_history', 'notes',
      ]) {
        if (fields[k] !== undefined) keep[k] = fields[k];
      }
      return keep;
    };

    // Recompute the end date from the (possibly new) duration + skip list.
    const endFor = (duration: number, skips: string[], plan: PlanType) =>
      computeEndDate(current.start_date, duration, schedule, skips) ||
      computeEndDate(todayISO(), duration, schedule, skips);

    switch (action) {
      case 'skip_today': {
        const today = todayISO();
        if (current.skip_dates?.includes(today)) {
          return NextResponse.json({ message: "Today's delivery is already skipped" }, { status: 400 });
        }
        const skips = [...(current.skip_dates || []), today];
        patch.skip_dates = skips;
        patch.end_date = endFor(Number(current.duration_days) || 1, skips, current.plan_type);
        await logEvent(ClientEvent, id, 'skipped', `Delivery skipped on ${today} · end date moved to ${patch.end_date}`, currentPlan?.id);
        break;
      }

      case 'skip_dates': {
        const skips: string[] = Array.isArray(body.skip_dates) ? body.skip_dates : [];

        // Skip dates may target a specific plan (the detail page passes plan_id).
        let skipPlan: any = currentPlan;
        if (body.plan_id) {
          skipPlan = planRows.find((p: any) => p.id === body.plan_id) || currentPlan;
        }
        const isCurrentSkip = !skipPlan || skipPlan.id === currentPlan?.id;
        const skipSchedule: ScheduleKey = skipPlan?.schedule === 'mon_sat' ? 'mon_sat' : schedule;
        const skipDuration = Number(skipPlan?.duration_days ?? current.duration_days) || 1;
        const skipStart = skipPlan?.start_date || current.start_date;
        const newEnd =
          computeEndDate(skipStart, skipDuration, skipSchedule, skips) ||
          computeEndDate(todayISO(), skipDuration, skipSchedule, skips);

        if (isCurrentSkip) {
          // Mirror through the shared write below so the client row matches.
          patch.skip_dates = skips;
          patch.end_date = newEnd;
        } else if (skipPlan) {
          // An older plan: update it directly; the client row is unaffected.
          await skipPlan.update({ skip_dates: skips, end_date: newEnd });
        }

        await logEvent(
          ClientEvent,
          id,
          'skipped',
          skips.length
            ? `Skip dates updated: ${skips.join(', ')} · end date moved to ${newEnd}`
            : 'Skip dates cleared',
          skipPlan?.id,
        );
        break;
      }

      case 'payment': {
        const amount = Number(body.amount) || 0;
        if (amount <= 0) return NextResponse.json({ message: 'Payment amount must be greater than ₹0' }, { status: 400 });

        // A payment may target a specific plan (e.g. an older completed trial).
        // Fall back to the client's current plan when no plan_id is supplied.
        let payPlan: any = currentPlan;
        if (body.plan_id) {
          payPlan = planRows.find((p: any) => p.id === body.plan_id) || currentPlan;
        }
        const targetPlanType = payPlan?.plan_type || (current.plan_type as PlanType);

        const isCurrent = !payPlan || payPlan.id === currentPlan?.id;
        const total = isCurrent ? (Number(current.total_amount) || 0) : (Number(payPlan.total_amount) || 0);
        const alreadyPaid = isCurrent ? (Number(current.paid_amount) || 0) : (Number(payPlan.paid_amount) || 0);
        if (alreadyPaid + amount > total) {
          return NextResponse.json({ message: 'Payment exceeds the outstanding balance' }, { status: 400 });
        }
        const entry = {
          id: paymentId(),
          amount,
          method: body.method || 'cash',
          reference: body.reference || '',
          date: body.date || todayISO(),
          note: body.note || '',
        };
        // Build on the plan ledger (source of truth) so legacy entries keep their
        // stable ids, then mirror the result back to the client row.
        const planLedger: any[] = normalizePayments(
          Array.isArray(payPlan?.payment_history)
            ? payPlan.payment_history
            : (Array.isArray(current.payment_history) ? current.payment_history : []),
        );
        const nextLedger = [...planLedger, entry];
        const nextPaid = alreadyPaid + amount;

        if (isCurrent) {
          // Let the shared mirror step write this through to the client row.
          patch.paid_amount = nextPaid;
          patch.payment_history = nextLedger;
        } else if (payPlan) {
          // An older plan: update it directly; the client row is unaffected.
          await payPlan.update({ paid_amount: nextPaid, payment_history: nextLedger });
        }
        await logEvent(
          ClientEvent,
          id,
          'payment',
          `Payment ₹${amount} recorded (${entry.method}) on ${entry.date} · ${targetPlanType} plan`,
          currentPlan?.id,
        );
        break;
      }

      case 'edit_payment': {
        // Edit or remove one entry in a plan's ledger, then rebuild that plan's
        // paid total from the remaining entries so nothing drifts. The ledger
        // lives on the plan row (the source of truth), so target it there.
        const entryId = String(body.payment_id || '');
        if (!entryId) return NextResponse.json({ message: 'Payment id is required' }, { status: 400 });

        // Allow editing a specific (older) plan via plan_id; default to current.
        let targetPlan: any = currentPlan;
        if (body.plan_id) {
          targetPlan = planRows.find((p: any) => p.id === body.plan_id) || currentPlan;
        }
        const planLedger: any[] = normalizePayments(
          Array.isArray(targetPlan?.payment_history) ? targetPlan.payment_history : [],
        );
        const idx = planLedger.findIndex((p) => String(p?.id) === entryId);
        if (idx === -1) return NextResponse.json({ message: 'Payment not found' }, { status: 404 });

        if (body.remove === true) {
          planLedger.splice(idx, 1);
        } else {
          const amount = Number(body.amount);
          if (!(amount > 0)) return NextResponse.json({ message: 'Payment amount must be greater than ₹0' }, { status: 400 });
          planLedger[idx] = {
            ...planLedger[idx],
            amount,
            method: body.method || planLedger[idx].method || 'cash',
            reference: body.reference !== undefined ? body.reference : (planLedger[idx].reference || ''),
            date: body.date || planLedger[idx].date,
            note: body.note !== undefined ? body.note : (planLedger[idx].note || ''),
          };
        }

        const planPaid = planLedger.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
        const planTotal = Number(targetPlan?.total_amount) || 0;
        if (planPaid > planTotal) {
          return NextResponse.json({ message: 'Total payments cannot exceed the plan total' }, { status: 400 });
        }

        if (targetPlan && targetPlan.id === currentPlan?.id) {
          // Current plan: let the shared mirror step write it through.
          patch.paid_amount = planPaid;
          patch.payment_history = planLedger;
        } else if (targetPlan) {
          // An older plan: update it directly; the client row is unaffected.
          await targetPlan.update({ paid_amount: planPaid, payment_history: planLedger });
        }

        await logEvent(
          ClientEvent,
          id,
          'payment_edited',
          body.remove === true
            ? 'Payment entry removed'
            : `Payment entry edited to ₹${Number(body.amount) || 0}${body.method ? ` (${body.method})` : ''}`,
          targetPlan?.id,
        );
        break;
      }

      case 'renew': {
        const days = Number(body.days) || 0;
        const plan: PlanType = body.plan_type === 'package' ? 'package' : (current.plan_type as PlanType);
        if (!Number.isInteger(days) || days < 1 || days > planMax(plan)) {
          return NextResponse.json(
            { message: `Renewal must be between 1 and ${planMax(plan)} days` },
            { status: 400 },
          );
        }
        // Renew starts the day after the current end date and adds `days` more
        // delivery days, so the schedule is never double-counted.
        const base = current.end_date || todayISO();
        const nextDay = new Date(`${base}T00:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        const newStart = toISODate(nextDay);
        const duration = (Number(current.duration_days) || 0) + days;
        const skips: string[] = Array.isArray(current.skip_dates) ? current.skip_dates : [];
        const newEnd = computeEndDate(newStart, days, schedule, skips);
        patch.plan_type = plan;
        patch.duration_days = duration;
        patch.start_date = current.start_date || newStart;
        patch.end_date = newEnd || base;
        patch.total_boxes = (Number(current.boxes_per_day) || 1) * duration;
        patch.status = 'active';

        // Close the current plan and append the renewal as a *new* plan so the
        // detail page keeps both — and each keeps its own payment ledger.
        if (currentPlan) {
          await currentPlan.update({ status: 'completed' });
        }
        const renewal = await (ClientPlan as any).create({
          ...planFromClient(record.get({ plain: true })),
          plan_type: plan,
          status: 'active',
          duration_days: duration,
          start_date: patch.start_date,
          end_date: patch.end_date,
          total_boxes: patch.total_boxes,
          total_amount: Number(current.total_amount) || 0,
          paid_amount: 0,
          payment_history: [],
          skip_dates: skips,
        });
        await logEvent(
          ClientEvent,
          id,
          'renewed',
          `${plan} plan renewed · +${days} days · now ${patch.start_date} → ${patch.end_date}`,
          renewal.id,
        );
        break;
      }

      case 'convert': {
        if (current.plan_type === 'package') {
          return NextResponse.json({ message: 'Client is already on a package plan' }, { status: 400 });
        }
        patch.plan_type = 'package';
        let convDuration = Number(current.duration_days) || 1;
        if (body.duration_days !== undefined) {
          convDuration = Number(body.duration_days);
          if (!Number.isInteger(convDuration) || convDuration < 1 || convDuration > planMax('package')) {
            return NextResponse.json({ message: 'Duration must be between 1 and 26 days' }, { status: 400 });
          }
        }
        const convSkips: string[] = Array.isArray(current.skip_dates) ? current.skip_dates : [];
        patch.duration_days = convDuration;
        patch.total_boxes = (Number(current.boxes_per_day) || 1) * convDuration;
        // A longer package keeps the same start day, so the end date must move
        // forward to cover the extra delivery days.
        patch.end_date = endFor(convDuration, convSkips, 'package');
        patch.status = 'active';

        // Preserve the trial as its own completed plan and start the package as
        // a fresh plan, so the detail page shows the trial *and* the package.
        if (currentPlan) {
          await currentPlan.update({ status: 'completed' });
        }
        const converted = await (ClientPlan as any).create({
          ...planFromClient(record.get({ plain: true })),
          plan_type: 'package',
          status: 'active',
          duration_days: convDuration,
          end_date: patch.end_date,
          total_boxes: patch.total_boxes,
          total_amount: Number(current.total_amount) || 0,
          paid_amount: 0,
          payment_history: [],
          skip_dates: convSkips,
        });
        await logEvent(
          ClientEvent,
          id,
          'converted',
          `Trial converted to a package plan · ${convDuration} days · ends ${patch.end_date}`,
          converted.id,
        );
        break;
      }

      case 'edit': {
        if (body.name !== undefined) {
          const name = String(body.name || '').trim();
          if (!name) return NextResponse.json({ message: 'Client name is required' }, { status: 400 });
          patch.name = name;
        }
        if (body.phone !== undefined) {
          const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
          if (!/^[6-9]\d{9}$/.test(phone)) {
            return NextResponse.json({ message: 'Enter a valid 10-digit mobile number' }, { status: 400 });
          }
          const clash = await (Client as any).findOne({ where: { phone } });
          if (clash && clash.id !== id) {
            return NextResponse.json({ message: 'Another client already uses this mobile number' }, { status: 409 });
          }
          patch.phone = phone;
        }
        if (body.address !== undefined) patch.address = body.address || null;
        if (body.goal !== undefined) patch.goal = body.goal || null;
        if (body.notes !== undefined) patch.notes = body.notes || null;

        const plan: PlanType = body.plan_type === 'package' ? 'package'
          : body.plan_type === 'trial' ? 'trial' : (current.plan_type as PlanType);
        let duration = Number(current.duration_days) || 1;
        if (body.duration_days !== undefined) {
          duration = Number(body.duration_days);
          if (!Number.isInteger(duration) || duration < 1 || duration > planMax(plan)) {
            return NextResponse.json(
              { message: `Duration must be between 1 and ${planMax(plan)} days` },
              { status: 400 },
            );
          }
        }
        const boxes = body.boxes_per_day !== undefined
          ? Number(body.boxes_per_day)
          : (Number(current.boxes_per_day) || 1);
        const skips: string[] = body.skip_dates !== undefined
          ? (Array.isArray(body.skip_dates) ? body.skip_dates : [])
          : (current.skip_dates || []);
        const startDate: string = body.start_date || current.start_date;

        patch.plan_type = plan;
        patch.duration_days = duration;
        patch.boxes_per_day = boxes;
        patch.skip_dates = skips;
        patch.start_date = startDate;
        patch.end_date = endFor(duration, skips, plan);
        patch.total_boxes = boxes * duration;

        if (body.total_amount !== undefined) {
          const total = Number(body.total_amount) || 0;
          const paid = body.paid_amount !== undefined ? Number(body.paid_amount) || 0 : Number(current.paid_amount) || 0;
          if (total <= 0) return NextResponse.json({ message: 'Total amount must be greater than ₹0' }, { status: 400 });
          if (paid < 0) return NextResponse.json({ message: 'Paid amount cannot be negative' }, { status: 400 });
          if (paid > total) return NextResponse.json({ message: 'Paid amount cannot exceed the total amount' }, { status: 400 });
          patch.total_amount = total;
          patch.paid_amount = paid;
        }
        if (body.balance_due_date !== undefined) patch.balance_due_date = body.balance_due_date || null;
        await logEvent(
          ClientEvent,
          id,
          'details_updated',
          `Client details updated · ${plan} plan · ${duration} days · ${patch.start_date} → ${patch.end_date}`,
          currentPlan?.id,
        );
        break;
      }

      case 'activate':
        patch.status = 'active';
        await logEvent(ClientEvent, id, 'activated', 'Client marked active', currentPlan?.id);
        break;

      case 'inactive':
        patch.status = 'inactive';
        await logEvent(ClientEvent, id, 'deactivated', 'Client marked inactive', currentPlan?.id);
        break;

      default:
        return NextResponse.json({ message: `Unknown action: ${action || '(none)'}` }, { status: 400 });
    }

    await record.update(patch);

    // Mirror the change onto the client's current plan so the detail page's plan
    // cards, per-plan totals and ledger stay consistent with the client row.
    // renew/convert already appended their own plan rows above, so they must not
    // be overwritten here.
    if (currentPlan && action !== 'renew' && action !== 'convert') {
      const mirrorable = planPatchFrom(patch);
      if (Object.keys(mirrorable).length) await currentPlan.update(mirrorable);
    }

    return NextResponse.json(decorate(record));
  } catch (err) {
    console.error('[Clients] PATCH:', err);
    return NextResponse.json({ message: 'Failed to update client' }, { status: 500 });
  }
}

/** Safe delete: remove the client record only, leaving other tables untouched. */
export async function DELETE(req: Request) {
  const auth = requireRole(req, ROLES);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || '';
    if (!id) return NextResponse.json({ message: 'Client id is required' }, { status: 400 });

    const { Client } = await getDbModels();
    const record: any = await (Client as any).findByPk(id);
    if (!record) return NextResponse.json({ message: 'Client not found' }, { status: 404 });

    await record.destroy();
    return NextResponse.json({ message: 'Client deleted', id });
  } catch (err) {
    console.error('[Clients] DELETE:', err);
    return NextResponse.json({ message: 'Failed to delete client' }, { status: 500 });
  }
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
