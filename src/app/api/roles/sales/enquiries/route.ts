import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = requireRole(req, ['super_admin', 'sales', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { CustomerEnquiry, Customer } = await getDbModels();

    const record = await (CustomerEnquiry as any).create({
      customer_name: body.customer_name,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      age: body.age || null,
      gender: body.gender || null,
      height: body.height || null,
      weight: body.weight || null,
      food_preference: body.food_preference || null,
      activity_level: body.activity_level || null,
      goal: body.goal || null,
      meals_per_day: body.meals_per_day || null,
      selected_food_items: body.selected_food_items || [],
      meal_plan: body.meal_plan || [],
      daily_calories: body.daily_calories || null,
      daily_protein: body.daily_protein || null,
      enquiry_date: body.enquiry_date || null,
      service: body.service || 'meal_plan',
      total_amount: Number(body.total_amount) || 0,
      paid_amount: Number(body.paid_amount) || 0,
      outstanding_amount: Math.max(0, (Number(body.total_amount) || 0) - (Number(body.paid_amount) || 0)),
      payment_status: (() => {
        const total = Number(body.total_amount) || 0;
        const paid = Number(body.paid_amount) || 0;
        if (total <= 0) return 'pending';
        if (paid >= total) return 'paid';
        if (paid > 0) return 'partially_paid';
        return 'pending';
      })(),
      payment_history: Number(body.paid_amount) > 0 ? [{
        amount: Number(body.paid_amount),
        method: body.payment_method || 'cash',
        date: body.payment_date || new Date().toISOString().split('T')[0],
        note: 'Initial payment',
      }] : [],
      sales_notes: body.sales_notes || '',
      sales_status: body.sales_status || 'follow_up',
      order_status: body.sales_status === 'non_follow_up' ? 'non_follow_up' : body.sales_status === 'not_interested' ? 'not_interested' : 'details_updated',
      assigned_sales_id: auth.user!.sub,
      next_payment_date: body.next_payment_date || null,
      follow_up_note: body.follow_up_note || '',
      follow_up_status: body.follow_up_status || 'pending',
    });

    if (body.phone && (Number(body.total_amount) || 0) > 0) {
      const customer = await (Customer as any).findOne({ where: { phone: body.phone } });
      if (customer) await customer.update({ meal_plan_price: Number(body.total_amount) || 0 });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error('[Sales Enquiries] POST:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = requireRole(req, ['super_admin', 'sales', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { sub, role } = auth.user!;
    const { CustomerEnquiry } = await getDbModels();
    const where: any = {};

    if (role === 'sales') {
      where.assigned_sales_id = sub;
    }

    const rows = await (CustomerEnquiry as any).findAll({
      where,
      order: [['created_at', 'DESC']],
      raw: true,
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[Sales Enquiries] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = requireRole(req, ['super_admin', 'sales', 'admin']);
  if (!auth.authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { CustomerEnquiry, Customer } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    if (auth.user!.role === 'sales' && existing.assigned_sales_id !== auth.user!.sub) {
      return NextResponse.json({ message: 'Not your enquiry' }, { status: 403 });
    }

    const fields: Record<string, any> = {};

    if (updates.sales_status) {
      fields.sales_status = updates.sales_status;
      if (updates.sales_status === 'follow_up') {
        fields.order_status = 'follow_up';
      } else if (updates.sales_status === 'non_follow_up') {
        fields.order_status = 'non_follow_up';
      } else if (updates.sales_status === 'not_interested') {
        fields.order_status = 'not_interested';
      }
    }

    if (updates.customer_name !== undefined) fields.customer_name = updates.customer_name;
    if (updates.phone !== undefined) fields.phone = updates.phone;
    if (updates.email !== undefined) fields.email = updates.email;
    if (updates.address !== undefined) fields.address = updates.address;
    if (updates.age !== undefined) fields.age = Number(updates.age);
    if (updates.gender !== undefined) fields.gender = updates.gender;
    if (updates.height !== undefined) fields.height = Number(updates.height);
    if (updates.weight !== undefined) fields.weight = Number(updates.weight);
    if (updates.food_preference !== undefined) fields.food_preference = updates.food_preference;
    if (updates.activity_level !== undefined) fields.activity_level = updates.activity_level;
    if (updates.goal !== undefined) fields.goal = updates.goal;
    if (updates.meals_per_day !== undefined) fields.meals_per_day = Number(updates.meals_per_day);
    if (updates.selected_food_items !== undefined) fields.selected_food_items = updates.selected_food_items;
    if (updates.meal_plan !== undefined) fields.meal_plan = updates.meal_plan;
    if (updates.daily_calories !== undefined) fields.daily_calories = Number(updates.daily_calories);
    if (updates.daily_protein !== undefined) fields.daily_protein = Number(updates.daily_protein);
    if (updates.sales_notes !== undefined) fields.sales_notes = updates.sales_notes;
    if (updates.enquiry_date !== undefined) fields.enquiry_date = updates.enquiry_date;
    if (updates.service !== undefined) fields.service = updates.service;
    if (updates.total_amount !== undefined) fields.total_amount = Number(updates.total_amount);
    if (updates.paid_amount !== undefined) fields.paid_amount = Number(updates.paid_amount);
    if (updates.payment_method !== undefined) fields.payment_method = updates.payment_method;
    if (updates.payment_date !== undefined) fields.payment_date = updates.payment_date;
    if (updates.next_payment_date !== undefined) fields.next_payment_date = updates.next_payment_date || null;
    if (updates.follow_up_note !== undefined) fields.follow_up_note = updates.follow_up_note;
    if (updates.follow_up_status !== undefined) fields.follow_up_status = updates.follow_up_status;

    if (updates.total_amount !== undefined || updates.paid_amount !== undefined || updates.additional_payment !== undefined) {
      const total = Number(updates.total_amount ?? existing.total_amount) || 0;
      const paid = updates.paid_amount !== undefined
        ? Number(updates.paid_amount) || 0
        : updates.additional_payment !== undefined
          ? (Number(existing.paid_amount) || 0) + (Number(updates.additional_payment) || 0)
          : Number(existing.paid_amount) || 0;
      fields.paid_amount = paid;
      fields.outstanding_amount = Math.max(0, total - paid);
      fields.payment_status = total <= 0 ? 'pending' : paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
    }

    if (updates.additional_payment !== undefined && Number(updates.additional_payment) > 0) {
      let history = existing.payment_history || [];
      if (typeof history === 'string') { try { history = JSON.parse(history); } catch { history = []; } }
      history = [...(Array.isArray(history) ? history : []), {
        amount: Number(updates.additional_payment),
        method: updates.payment_method || existing.payment_method || 'cash',
        date: updates.payment_date || new Date().toISOString().split('T')[0],
        note: updates.payment_note || 'Additional payment',
      }];
      fields.payment_history = history;
    }

    if (updates.sales_status === 'follow_up' && updates.customer_name !== undefined) {
      fields.order_status = 'details_updated';
    }

    await (CustomerEnquiry as any).update(fields, { where: { id } });

    if (updates.total_amount !== undefined) {
      const phone = updates.phone ?? existing.phone;
      if (phone) {
        const customer = await (Customer as any).findOne({ where: { phone } });
        if (customer) await customer.update({ meal_plan_price: Number(updates.total_amount) || 0 });
      }
    }

    const updated = await (CustomerEnquiry as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Sales Enquiries] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
