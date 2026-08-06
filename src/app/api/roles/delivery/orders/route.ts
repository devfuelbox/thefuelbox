import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Op } from 'sequelize';
import { buildMealStatuses, planMealNames } from '@/lib/mealStatus';

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'delivery_partner', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { sub, role } = auth.user!;
    const { CustomerEnquiry, ChefDeliveryMapping, MealPlanSubscription, MealDelivery } = await getDbModels();
    const url = new URL(req.url);
    const isHistory = url.searchParams.get('history') === 'true';
    const where: any = {};

    if (role === 'delivery_partner') {
      const mapping = await (ChefDeliveryMapping as any).findOne({
        where: { delivery_partner_id: sub, is_active: true },
        raw: true,
      });

      if (isHistory) {
        // Completed deliveries are scoped to the partner's mapped chef (or the
        // deliveries the partner was explicitly assigned to).
        if (mapping) {
          where.assigned_chef_id = mapping.chef_id;
        } else {
          where.assigned_delivery_id = sub;
        }
        where.order_status = 'delivered';
      } else if (mapping) {
        where.assigned_chef_id = mapping.chef_id;
        where.order_status = ['ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery'];
      } else {
        where[Op.or] = [
          { assigned_delivery_id: sub, order_status: ['ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery', 'delivered'] },
          { assigned_delivery_id: null, order_status: 'ready_for_delivery' },
        ];
      }
    } else if (isHistory) {
      where.order_status = 'delivered';
    }

    const rows = await (CustomerEnquiry as any).findAll({
      where,
      order: [['updated_at', 'DESC']],
      raw: true,
    });

    if (isHistory) {
      const subs = await (MealPlanSubscription as any).findAll({ raw: true });
      const subByEnquiry: Record<string, any> = {};
      for (const s of subs) {
        if (!subByEnquiry[s.customer_enquiry_id] || new Date(s.updated_at) > new Date(subByEnquiry[s.customer_enquiry_id].updated_at)) {
          subByEnquiry[s.customer_enquiry_id] = s;
        }
      }
      const deliveries = await (MealDelivery as any).findAll({ raw: true });
      const deliveriesBySub: Record<string, any[]> = {};
      for (const d of deliveries) {
        (deliveriesBySub[d.subscription_id] ||= []).push(d);
      }

      const enriched = rows.map((r: any) => {
        const s = subByEnquiry[r.id];
        const records = (s && deliveriesBySub[s.id]
          ? deliveriesBySub[s.id].filter((d: any) => d.status === 'delivered')
          : []
        )
          .map((d: any) => ({
            id: d.id,
            day_number: d.day_number,
            meal_slot: d.meal_slot,
            scheduled_date: d.scheduled_date,
            status: d.status,
            delivered_at: d.delivered_at ? new Date(d.delivered_at).toISOString() : null,
            notes: d.notes,
          }))
          .sort((a: any, b: any) => {
            const at = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
            const bt = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
            return bt - at;
          });
        return { ...r, meal_statuses: buildMealStatuses(r), delivery_records: records };
      });
      return NextResponse.json(enriched);
    }

    const withMeals = rows.map((r: any) => ({ ...r, meal_statuses: buildMealStatuses(r) }));

    return NextResponse.json(withMeals);
  } catch (err) {
    console.error('[Delivery Orders] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'delivery_partner', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { CustomerEnquiry, MealPlanSubscription, MealDelivery } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const fields: Record<string, any> = {};

    const advanceMealStatuses = (toStatus: string) => {
      const statuses: Record<string, any> =
        existing.meal_statuses && typeof existing.meal_statuses === 'object' ? { ...existing.meal_statuses } : {};
      let changed = false;
      Object.entries(statuses).forEach(([name, ms]: [string, any]) => {
        if (toStatus === 'out_for_delivery' && ms.status === 'ready_for_delivery') {
          statuses[name] = { ...ms, status: 'out_for_delivery', assigned_delivery_id: auth.user!.sub || ms.assigned_delivery_id };
          changed = true;
        }
      });
      if (changed) fields.meal_statuses = statuses;
    };

    if (updates.action === 'accept_delivery') {
      fields.order_status = 'out_for_delivery';
      if (auth.user!.sub) fields.assigned_delivery_id = auth.user!.sub;
      advanceMealStatuses('out_for_delivery');
    } else if (updates.action === 'delivered') {
      const mealSlot = updates.meal_slot || null;
      fields.delivery_notes = updates.delivery_notes || existing.delivery_notes;

      const now = new Date();
      const istToday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      // Per-meal status update: only the selected meal is marked delivered.
      // Without a meal_slot (legacy order-level action) all plan meals are marked.
      const mealNames = mealSlot ? [mealSlot] : planMealNames(existing.meal_plan);
      if (mealNames.length > 0) {
        const statuses: Record<string, any> =
          existing.meal_statuses && typeof existing.meal_statuses === 'object' ? { ...existing.meal_statuses } : {};
        let changed = false;
        mealNames.forEach(name => {
          const cur = statuses[name] && typeof statuses[name] === 'object' ? statuses[name] : {};
          if (cur.status === 'delivered') return;
          statuses[name] = {
            ...cur,
            status: 'delivered',
            assigned_delivery_id: auth.user!.sub || cur.assigned_delivery_id || null,
          };
          changed = true;
        });
        if (changed) fields.meal_statuses = statuses;
      }

      let existingSub = await (MealPlanSubscription as any).findOne({
        where: { customer_enquiry_id: id },
      });
      if (existingSub) {
        if (existingSub.status !== 'active') {
          await (MealPlanSubscription as any).update(
            { status: 'active', start_date: existingSub.start_date || istToday },
            { where: { id: existingSub.id } }
          );
        }
      } else {
        existingSub = await (MealPlanSubscription as any).create({
          customer_enquiry_id: id,
          start_date: istToday,
          duration_days: Number(updates.duration_days) || 7,
          status: 'active',
          paused_days: 0,
          pause_history: [],
          skipped_meals: [],
          notes: 'Auto-created on delivery completion',
        });
      }

      if (existingSub) {
        let todays = await (MealDelivery as any).findAll({
          where: { subscription_id: existingSub.id, scheduled_date: istToday },
          raw: true,
        });
        if (todays.length === 0) {
          const mealsPerDay = existing.meals_per_day || 3;
          const planNames = planMealNames(existing.meal_plan);
          const slots = planNames.length > 0 ? planNames : ['Morning', 'Afternoon', 'Evening', 'Night'].slice(0, mealsPerDay);
          await (MealDelivery as any).bulkCreate(
            slots.map((slot, i) => ({
              subscription_id: existingSub.id,
              day_number: i + 1,
              meal_slot: slot,
              scheduled_date: istToday,
              status: 'scheduled',
            }))
          );
          todays = await (MealDelivery as any).findAll({
            where: { subscription_id: existingSub.id, scheduled_date: istToday },
            raw: true,
          });
        }
        const targets = mealSlot
          ? todays.filter((d: any) => d.meal_slot === mealSlot)
          : todays.filter((d: any) => d.status !== 'delivered');
        for (const t of targets) {
          await (MealDelivery as any).update(
            { status: 'delivered', delivered_at: now },
            { where: { id: t.id } }
          );
        }

        // Order is fully delivered only once every scheduled meal for today is delivered.
        const after = await (MealDelivery as any).findAll({
          where: { subscription_id: existingSub.id, scheduled_date: istToday },
          raw: true,
        });
        const remaining = after.filter((d: any) => d.status !== 'delivered');
        if (remaining.length === 0) {
          fields.order_status = 'delivered';
        }
      }
    }

    if (updates.delivery_notes !== undefined) {
      fields.delivery_notes = updates.delivery_notes;
    }

    await (CustomerEnquiry as any).update(fields, { where: { id } });
    const updated = await (CustomerEnquiry as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Delivery Orders] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
