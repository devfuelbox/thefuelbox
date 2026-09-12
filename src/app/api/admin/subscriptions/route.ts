import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { planMealNames } from '@/lib/mealStatus';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';

function verifyAdmin(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const d = jwt.verify(auth.slice(7), JWT_SECRET) as { role?: string };
    return ['admin', 'super_admin', 'sales'].includes(d.role || '');
  } catch { return false; }
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const { MealPlanSubscription, CustomerEnquiry, MealDelivery } = await getDbModels();
    let rows = await (MealPlanSubscription as any).findAll({ order: [['created_at', 'DESC']], raw: true });

    // Auto-renew check: if auto_renew enabled and period ended, auto-extend
    const todayStr = new Date().toISOString().split('T')[0];
    for (const sub of rows) {
      if (sub.auto_renew && sub.auto_renew_days) {
        const endStr = sub.actual_end_date || computeEndDate(sub);
        if (endStr < todayStr && sub.status === 'active') {
          try {
            const fresh = await (MealPlanSubscription as any).findByPk(sub.id);
            // double-check still due (prevent race)
            const freshEnd = fresh.actual_end_date || computeEndDate(fresh);
            if (fresh.auto_renew && freshEnd < todayStr) {
              await performRenew(fresh, Number(fresh.auto_renew_days), true, MealPlanSubscription, MealDelivery, CustomerEnquiry);
            }
          } catch (e) {
            console.error('[AutoRenew] failed for', sub.id, e);
          }
        }
      }
    }
    // Re-fetch after possible auto-renews
    rows = await (MealPlanSubscription as any).findAll({ order: [['created_at', 'DESC']], raw: true });

    const enquiries = await (CustomerEnquiry as any).findAll({ raw: true });
    const enquiryMap = Object.fromEntries(enquiries.map((e: any) => [e.id, e]));

    const enriched = rows.map((sub: any) => ({
      ...sub,
      customer: enquiryMap[sub.customer_enquiry_id] || null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[Subscriptions] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { MealPlanSubscription, MealDelivery, CustomerEnquiry } = await getDbModels();

    const enquiry = await (CustomerEnquiry as any).findByPk(body.customer_enquiry_id);
    if (!enquiry) return NextResponse.json({ message: 'Customer enquiry not found' }, { status: 404 });

    const startDate = body.start_date || new Date().toISOString().split('T')[0];
    const durationDays = Number(body.duration_days) || 7;
    const mealsPerDay = enquiry.meals_per_day || 3;
    const planNames = planMealNames(enquiry.meal_plan);
    const mealSlots = planNames.length > 0 ? planNames : ['Morning', 'Afternoon', 'Evening', 'Night'].slice(0, mealsPerDay);

    const sub = await (MealPlanSubscription as any).create({
      customer_enquiry_id: body.customer_enquiry_id,
      start_date: startDate,
      duration_days: durationDays,
      status: 'active',
      paused_days: 0,
      pause_history: [],
      skipped_meals: [],
      notes: body.notes || null,
    });

    const deliveries: any[] = [];
    for (let d = 0; d < durationDays; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      for (const slot of mealSlots) {
        deliveries.push({
          subscription_id: sub.id,
          day_number: d + 1,
          meal_slot: slot,
          scheduled_date: dateStr,
          status: 'scheduled',
        });
      }
    }
    await (MealDelivery as any).bulkCreate(deliveries);

    const created = await (MealPlanSubscription as any).findByPk(sub.id);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[Subscriptions] POST:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

function computeEndDate(sub: any): string {
  if (sub.actual_end_date) return sub.actual_end_date;
  const start = new Date(sub.start_date + 'T00:00:00');
  const totalSkipped = Array.isArray(sub.skipped_meals) ? sub.skipped_meals.length : 0;
  const end = new Date(start);
  end.setDate(end.getDate() + (sub.duration_days - 1) + (sub.paused_days || 0) + totalSkipped);
  return end.toISOString().split('T')[0];
}

async function performRenew(sub: any, renewalDays: number, autoRenew: boolean | undefined, MealPlanSubscription: any, MealDelivery: any, CustomerEnquiry: any) {
  const days = Math.max(1, Math.min(90, Math.round(Number(renewalDays) || 0)));
  if (days < 1) throw new Error('Invalid renewal days');
  const oldEndStr = computeEndDate(sub);
  const oldEnd = new Date(oldEndStr + 'T00:00:00');
  const newStart = new Date(oldEnd);
  newStart.setDate(newStart.getDate() + 1);
  const newStartStr = newStart.toISOString().split('T')[0];
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + days - 1);
  const newEndStr = newEnd.toISOString().split('T')[0];

  const oldDuration = Number(sub.duration_days) || 0;
  const newDuration = oldDuration + days;

  const enquiry = await (CustomerEnquiry as any).findByPk(sub.customer_enquiry_id);
  const mealsPerDay = enquiry?.meals_per_day || 3;
  const planNames = enquiry ? planMealNames(enquiry.meal_plan) : [];
  const mealSlots = planNames.length > 0 ? planNames : ['Morning', 'Afternoon', 'Evening', 'Night'].slice(0, mealsPerDay);

  const deliveries: any[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(newStart);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    for (const slot of mealSlots) {
      deliveries.push({
        subscription_id: sub.id,
        day_number: oldDuration + d + 1,
        meal_slot: slot,
        scheduled_date: dateStr,
        status: 'scheduled',
      });
    }
  }
  if (deliveries.length > 0) await (MealDelivery as any).bulkCreate(deliveries);

  const renewalHistory = Array.isArray(sub.renewal_history) ? sub.renewal_history : [];
  renewalHistory.push({
    renewed_at: new Date().toISOString(),
    previous_end_date: oldEndStr,
    new_start_date: newStartStr,
    new_end_date: newEndStr,
    renewal_days: days,
    auto_renew: autoRenew ?? sub.auto_renew ?? false,
    previous_duration: oldDuration,
    new_duration: newDuration,
  });

  const updateFields: any = {
    duration_days: newDuration,
    actual_end_date: newEndStr,
    status: 'active',
    renewal_history: renewalHistory,
    last_renewed_at: new Date(),
  };
  if (autoRenew !== undefined) {
    updateFields.auto_renew = !!autoRenew;
    updateFields.auto_renew_days = autoRenew ? days : sub.auto_renew_days ?? null;
  } else if (sub.auto_renew && !sub.auto_renew_days) {
    updateFields.auto_renew_days = days;
  }

  await (MealPlanSubscription as any).update(updateFields, { where: { id: sub.id } });
  return { newStartStr, newEndStr, newDuration, oldEndStr };
}

export async function PATCH(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id, action, notes } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { MealPlanSubscription, MealDelivery, CustomerEnquiry } = await getDbModels();
    const sub = await (MealPlanSubscription as any).findByPk(id);
    if (!sub) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    if (action === 'renew') {
      const renewalDays = Number(body.renewal_days ?? body.duration_days ?? body.days) || 0;
      const autoRenew = body.auto_renew !== undefined ? !!body.auto_renew : undefined;
      if (!renewalDays || renewalDays < 1 || renewalDays > 90) return NextResponse.json({ message: 'renewal_days must be 1-90' }, { status: 400 });
      // Allow renew from active/paused/completed; cancelled needs explicit
      if (sub.status === 'cancelled' && !body.force) {
        // still allow but require force flag? For now allow
      }
      const result = await performRenew(sub, renewalDays, autoRenew, MealPlanSubscription, MealDelivery, CustomerEnquiry);
      const updated = await (MealPlanSubscription as any).findByPk(id);
      return NextResponse.json({ ...updated.toJSON(), _renew: result });
    } else if (action === 'set_auto_renew') {
      const autoRenew = !!body.auto_renew;
      const days = body.auto_renew_days ? Math.max(1, Math.min(90, Number(body.auto_renew_days))) : sub.auto_renew_days;
      await (MealPlanSubscription as any).update(
        { auto_renew: autoRenew, auto_renew_days: autoRenew ? (days || sub.duration_days) : null },
        { where: { id } }
      );
      const updated = await (MealPlanSubscription as any).findByPk(id);
      return NextResponse.json(updated);
    } else if (action === 'pause') {
      if (sub.status !== 'active') return NextResponse.json({ message: 'Plan is not active' }, { status: 400 });
      const pauseHistory = Array.isArray(sub.pause_history) ? sub.pause_history : [];
      pauseHistory.push({ pause_start: new Date().toISOString().split('T')[0], pause_end: null });
      await (MealPlanSubscription as any).update(
        { status: 'paused', pause_history: pauseHistory },
        { where: { id } }
      );
    } else if (action === 'resume') {
      if (sub.status !== 'paused') return NextResponse.json({ message: 'Plan is not paused' }, { status: 400 });
      const pauseHistory = Array.isArray(sub.pause_history) ? sub.pause_history : [];
      const lastPause = pauseHistory[pauseHistory.length - 1];
      if (!lastPause || lastPause.pause_end) return NextResponse.json({ message: 'No active pause found' }, { status: 400 });

      const pauseStart = new Date(lastPause.pause_start);
      const resumeDate = new Date();
      const pausedDays = Math.max(1, Math.round((resumeDate.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24)));
      lastPause.pause_end = resumeDate.toISOString().split('T')[0];
      const totalPausedDays = (sub.paused_days || 0) + pausedDays;

      const futureDeliveries = await (MealDelivery as any).findAll({
        where: { subscription_id: id, status: 'scheduled' },
        raw: true,
      });

      for (const delivery of futureDeliveries) {
        const oldDate = new Date(delivery.scheduled_date);
        oldDate.setDate(oldDate.getDate() + pausedDays);
        await (MealDelivery as any).update(
          { scheduled_date: oldDate.toISOString().split('T')[0] },
          { where: { id: delivery.id } }
        );
      }

      const startDate = new Date(sub.start_date);
      const baseEndDate = new Date(startDate);
      baseEndDate.setDate(baseEndDate.getDate() + (sub.duration_days - 1) + totalPausedDays);
      const actualEndDate = baseEndDate.toISOString().split('T')[0];

      await (MealPlanSubscription as any).update(
        { status: 'active', paused_days: totalPausedDays, pause_history: pauseHistory, actual_end_date: actualEndDate },
        { where: { id } }
      );
    } else if (action === 'cancel') {
      await (MealPlanSubscription as any).update({ status: 'cancelled', notes: notes || sub.notes }, { where: { id } });
    } else if (action === 'complete') {
      await (MealPlanSubscription as any).update({ status: 'completed', actual_end_date: new Date().toISOString().split('T')[0] }, { where: { id } });
    } else if (action === 'update_notes') {
      await (MealPlanSubscription as any).update({ notes }, { where: { id } });
    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    const updated = await (MealPlanSubscription as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Subscriptions] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    const { MealPlanSubscription, MealDelivery } = await getDbModels();
    await (MealDelivery as any).destroy({ where: { subscription_id: id } });
    await (MealPlanSubscription as any).destroy({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Subscriptions] DELETE:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
