import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { planMealNames, buildMealStatuses } from '@/lib/mealStatus';

const MEAL_ORDER_STATUSES = ['assigned_to_chef', 'preparing', 'ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery'];

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'chef', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { sub, role } = auth.user!;
    const { CustomerEnquiry } = await getDbModels();
    const where: any = {};

    if (role === 'chef') {
      where.assigned_chef_id = sub;
      where.order_status = MEAL_ORDER_STATUSES;
    } else {
      where.order_status = MEAL_ORDER_STATUSES;
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get('today') === 'true') {
      const localDate = searchParams.get('localDate');
      let today = localDate;
      if (!today) {
        today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      }
      where.delivery_date = today;
    }

    const rows = await (CustomerEnquiry as any).findAll({
      where,
      order: [['updated_at', 'DESC']],
      raw: true,
    });

    const withMeals = rows.map((r: any) => ({ ...r, meal_statuses: buildMealStatuses(r) }));

    const deliveryIds = [
      ...new Set(
        withMeals.flatMap((r: any) => [
          r.assigned_delivery_id,
          ...Object.values(r.meal_statuses || {}).map((m: any) => m.assigned_delivery_id),
        ]).filter(Boolean)
      ),
    ];
    const { User } = await getDbModels();
    const users = deliveryIds.length
      ? await (User as any).findAll({
          where: { id: deliveryIds },
          attributes: ['id', 'full_name', 'phone', 'email'],
          raw: true,
        })
      : [];
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    const masked = withMeals.map((r: any) => {
      const statuses: Record<string, any> = {};
      Object.entries(r.meal_statuses || {}).forEach(([name, ms]: [string, any]) => {
        const partner = ms.assigned_delivery_id && userMap[ms.assigned_delivery_id]
          ? { name: userMap[ms.assigned_delivery_id].full_name, phone: userMap[ms.assigned_delivery_id].phone }
          : null;
        statuses[name] = { ...ms, delivery_partner: partner };
      });
      return {
        ...r,
        meal_statuses: statuses,
        phone: r.phone ? '******' + r.phone.slice(-4) : r.phone,
        delivery_partner: r.assigned_delivery_id && userMap[r.assigned_delivery_id]
          ? { name: userMap[r.assigned_delivery_id].full_name, phone: userMap[r.assigned_delivery_id].phone }
          : null,
      };
    });

    return NextResponse.json(masked);
  } catch (err) {
    console.error('[Chef Orders] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'chef', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { CustomerEnquiry, ChefDeliveryMapping } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    if (auth.user!.role === 'chef' && existing.assigned_chef_id !== auth.user!.sub) {
      return NextResponse.json({ message: 'Not your order' }, { status: 403 });
    }

    const fields: Record<string, any> = {};
    const mealStatuses: Record<string, any> =
      existing.meal_statuses && typeof existing.meal_statuses === 'object' ? { ...existing.meal_statuses } : {};

    const ensureMeal = (slot: string) => {
      if (!mealStatuses[slot]) mealStatuses[slot] = {};
    };

    if (updates.action === 'start_preparing') {
      fields.order_status = 'preparing';
      planMealNames(existing.meal_plan).forEach(name => {
        ensureMeal(name);
        mealStatuses[name].status = 'preparing';
      });
      fields.meal_statuses = mealStatuses;
    } else if (updates.action === 'ready_for_delivery') {
      fields.order_status = 'ready_for_delivery';
      const names = planMealNames(existing.meal_plan);
      names.forEach(name => {
        ensureMeal(name);
        mealStatuses[name].status = 'ready_for_delivery';
        mealStatuses[name].ready_at = new Date().toISOString();
      });
      await assignMealsToDeliveryPartner(existing, mealStatuses, fields, names);
      fields.meal_statuses = mealStatuses;
    } else if (updates.action === 'meal_start_preparing') {
      const slot = updates.meal_slot;
      if (!slot) return NextResponse.json({ message: 'meal_slot required' }, { status: 400 });
      ensureMeal(slot);
      mealStatuses[slot].status = 'preparing';
      if (existing.order_status === 'assigned_to_chef') fields.order_status = 'preparing';
      fields.meal_statuses = mealStatuses;
    } else if (updates.action === 'meal_ready_for_delivery') {
      const slot = updates.meal_slot;
      if (!slot) return NextResponse.json({ message: 'meal_slot required' }, { status: 400 });
      ensureMeal(slot);
      mealStatuses[slot].status = 'ready_for_delivery';
      mealStatuses[slot].ready_at = new Date().toISOString();
      await assignMealsToDeliveryPartner(existing, mealStatuses, fields, [slot]);
      if (['assigned_to_chef', 'preparing'].includes(existing.order_status)) fields.order_status = 'ready_for_delivery';
      fields.meal_statuses = mealStatuses;
    } else if (updates.action === 'update_notes') {
      fields.chef_notes = updates.chef_notes || '';
    }

    if (updates.chef_notes !== undefined) {
      fields.chef_notes = updates.chef_notes;
    }

    await (CustomerEnquiry as any).update(fields, { where: { id } });
    const updated = await (CustomerEnquiry as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Chef Orders] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

// Assigns the active delivery partner mapped to this order's chef to each meal
// being readied. Falls back to the order-level assignment if one already exists.
async function assignMealsToDeliveryPartner(existing: any, mealStatuses: Record<string, any>, fields: Record<string, any>, slots: string[]) {
  const { ChefDeliveryMapping } = await getDbModels();
  const mapping = await (ChefDeliveryMapping as any).findOne({
    where: { chef_id: existing.assigned_chef_id, is_active: true },
    raw: true,
  });
  const partnerId = mapping?.delivery_partner_id || existing.assigned_delivery_id || null;

  slots.forEach(slot => {
    if (partnerId) mealStatuses[slot].assigned_delivery_id = partnerId;
  });

  if (partnerId && !existing.assigned_delivery_id) {
    fields.assigned_delivery_id = partnerId;
  }
}
