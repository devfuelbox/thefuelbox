import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'verifier', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { sub, role } = auth.user!;
    const { CustomerEnquiry, MealPlanSubscription, MealDelivery, Customer } = await getDbModels();
    const where: any = {};

    if (role === 'verifier') {
      where.order_status = ['details_updated', 'pending_verification', 'verified', 'assigned_to_chef', 'assigned_to_delivery_partner', 'ready_for_delivery', 'out_for_delivery', 'delivered'];
    }

    const rows = await (CustomerEnquiry as any).findAll({
      where,
      order: [['updated_at', 'DESC']],
      raw: true,
    });

    const customers = await (Customer as any).findAll({ raw: true });
    const customerByPhone: Record<string, any> = {};
    for (const c of customers) {
      if (c.phone && !customerByPhone[c.phone]) customerByPhone[c.phone] = c;
    }

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

    const enriched = rows.map((e: any) => {
      const s = subByEnquiry[e.id];
      const c = customerByPhone[e.phone];
      return {
        ...e,
        meal_plan_price: c?.meal_plan_price ?? null,
        meal_plan_packages: c?.meal_plan_packages ?? null,
        subscription: s ? {
          id: s.id,
          status: s.status,
          start_date: s.start_date,
          duration_days: s.duration_days,
          actual_end_date: s.actual_end_date,
          deliveries: (deliveriesBySub[s.id] || [])
            .map((d: any) => ({
              id: d.id,
              day_number: d.day_number,
              meal_slot: d.meal_slot,
              scheduled_date: d.scheduled_date,
              status: d.status,
              delivered_at: d.delivered_at,
              notes: d.notes,
            }))
            .sort((a: any, b: any) =>
              a.scheduled_date === b.scheduled_date
                ? (a.meal_slot || '').localeCompare(b.meal_slot || '')
                : a.scheduled_date < b.scheduled_date ? -1 : 1
            ),
        } : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[Verifier Enquiries] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'verifier', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { CustomerEnquiry } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const fields: Record<string, any> = {};

    const now = new Date();
    const istToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    if (updates.action === 'verify') {
      fields.order_status = 'verified';
      fields.assigned_by_verifier_id = auth.user!.sub;
      fields.verifier_notes = updates.verifier_notes || existing.verifier_notes;
    } else if (updates.action === 'assign_chef') {
      if (!updates.assigned_chef_id) {
        return NextResponse.json({ message: 'assigned_chef_id required' }, { status: 400 });
      }
      fields.assigned_chef_id = updates.assigned_chef_id;
      fields.order_status = 'assigned_to_chef';
      fields.assigned_by_verifier_id = auth.user!.sub;
      fields.verifier_notes = updates.verifier_notes || existing.verifier_notes;
      fields.delivery_date = existing.delivery_date || istToday;
    } else if (updates.action === 'request_changes') {
      fields.order_status = 'pending_verification';
      fields.verifier_notes = updates.verifier_notes || '';
    } else if (updates.action === 'save_plan') {
      if (updates.meal_plan !== undefined) fields.meal_plan = updates.meal_plan;
      if (updates.selected_food_items !== undefined) fields.selected_food_items = updates.selected_food_items;
      if (updates.daily_calories !== undefined) fields.daily_calories = Number(updates.daily_calories);
      if (updates.daily_protein !== undefined) fields.daily_protein = Number(updates.daily_protein);
      if (updates.total_amount !== undefined) {
        fields.total_amount = Number(updates.total_amount);
        const paid = Number(existing.paid_amount) || 0;
        fields.outstanding_amount = Math.max(0, Number(updates.total_amount) - paid);
        fields.payment_status = Number(updates.total_amount) <= 0 ? 'pending' : paid >= Number(updates.total_amount) ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
      }
      if (updates.verifier_notes !== undefined) fields.verifier_notes = updates.verifier_notes;
      fields.order_status = existing.order_status || 'pending_verification';
    }

    if (updates.assigned_delivery_id !== undefined) {
      fields.assigned_delivery_id = updates.assigned_delivery_id;
      fields.order_status = 'assigned_to_delivery_partner';
      fields.delivery_date = existing.delivery_date || istToday;
    }

    await (CustomerEnquiry as any).update(fields, { where: { id } });
    const updated = await (CustomerEnquiry as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Verifier Enquiries] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
