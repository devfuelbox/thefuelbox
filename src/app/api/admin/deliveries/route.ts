import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import jwt from 'jsonwebtoken';

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
    const { MealDelivery } = await getDbModels();
    const { searchParams } = new URL(req.url);
    const subscription_id = searchParams.get('subscription_id');

    const where: any = {};
    if (subscription_id) where.subscription_id = subscription_id;

    const rows = await (MealDelivery as any).findAll({
      where,
      order: [['day_number', 'ASC'], ['meal_slot', 'ASC']],
      raw: true,
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[Deliveries] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_status') {
      const { delivery_id, status, notes } = body;
      if (!delivery_id || !status) return NextResponse.json({ message: 'delivery_id and status required' }, { status: 400 });

      const { MealDelivery, MealPlanSubscription } = await getDbModels();
      const delivery = await (MealDelivery as any).findByPk(delivery_id);
      if (!delivery) return NextResponse.json({ message: 'Delivery not found' }, { status: 404 });

      if (status === 'skipped' && delivery.status !== 'skipped') {
        const sub = await (MealPlanSubscription as any).findByPk(delivery.subscription_id);
        if (!sub) return NextResponse.json({ message: 'Subscription not found' }, { status: 404 });

        const skippedMeals = Array.isArray(sub.skipped_meals) ? sub.skipped_meals : [];

        const lastDelivery = await (MealDelivery as any).findOne({
          where: { subscription_id: delivery.subscription_id },
          order: [['day_number', 'DESC']],
          raw: true,
        });

        const newDayNumber = (lastDelivery?.day_number || sub.duration_days) + 1;
        const lastDate = lastDelivery?.scheduled_date || sub.start_date;
        const newDate = new Date(lastDate);
        newDate.setDate(newDate.getDate() + 1);

        await (MealDelivery as any).create({
          subscription_id: delivery.subscription_id,
          day_number: newDayNumber,
          meal_slot: delivery.meal_slot,
          scheduled_date: newDate.toISOString().split('T')[0],
          status: 'scheduled',
          original_day_number: delivery.day_number,
          notes: `Rescheduled from day ${delivery.day_number}`,
        });

        skippedMeals.push({
          day_number: delivery.day_number,
          meal_slot: delivery.meal_slot,
          rescheduled_day: newDayNumber,
          rescheduled_date: newDate.toISOString().split('T')[0],
        });

        const startDate = new Date(sub.start_date);
        const totalPaused = sub.paused_days || 0;
        const effectiveEnd = new Date(startDate);
        effectiveEnd.setDate(effectiveEnd.getDate() + (sub.duration_days - 1) + totalPaused + skippedMeals.length);
        const actualEndDate = effectiveEnd.toISOString().split('T')[0];

        await (MealPlanSubscription as any).update(
          { skipped_meals: skippedMeals, actual_end_date: actualEndDate },
          { where: { id: delivery.subscription_id } }
        );
      }

      const updateFields: any = { status };
      if (status === 'delivered') updateFields.delivered_at = new Date();
      if (notes !== undefined) updateFields.notes = notes;
      await (MealDelivery as any).update(updateFields, { where: { id: delivery_id } });

      const updated = await (MealDelivery as any).findByPk(delivery_id);
      return NextResponse.json(updated);
    }

    if (action === 'reschedule') {
      const { delivery_id, new_date } = body;
      if (!delivery_id || !new_date) return NextResponse.json({ message: 'delivery_id and new_date required' }, { status: 400 });

      const { MealDelivery } = await getDbModels();
      await (MealDelivery as any).update(
        { scheduled_date: new_date, status: 'rescheduled' },
        { where: { id: delivery_id } }
      );
      const updated = await (MealDelivery as any).findByPk(delivery_id);
      return NextResponse.json(updated);
    }

    if (action === 'bulk_update') {
      const { delivery_ids, status } = body;
      if (!Array.isArray(delivery_ids) || delivery_ids.length === 0 || !status) {
        return NextResponse.json({ message: 'delivery_ids array and status required' }, { status: 400 });
      }
      const { MealDelivery } = await getDbModels();
      await (MealDelivery as any).update({ status }, { where: { id: delivery_ids } });
      return NextResponse.json({ message: `${delivery_ids.length} deliveries updated` });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Deliveries] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
