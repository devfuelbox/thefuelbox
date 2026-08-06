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
    return ['admin', 'super_admin', 'verifier'].includes(d.role || '');
  } catch { return false; }
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const { MealPlanSubscription, CustomerEnquiry } = await getDbModels();
    const rows = await (MealPlanSubscription as any).findAll({ order: [['created_at', 'DESC']], raw: true });

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

export async function PATCH(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id, action, notes } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { MealPlanSubscription, MealDelivery } = await getDbModels();
    const sub = await (MealPlanSubscription as any).findByPk(id);
    if (!sub) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    if (action === 'pause') {
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
