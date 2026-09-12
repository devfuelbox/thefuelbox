import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { calculateNutrition } from '@/lib/nutrition/calculations';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fuelbox_dev_secret_change_in_production';

function verifyAdmin(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const d = jwt.verify(auth.slice(7), JWT_SECRET) as { role?: string };
    return ['admin', 'super_admin', 'sales'].includes(d.role || '');
  } catch { return false; }
}

function payStatus(total: number, paid: number): string {
  if (total <= 0) return 'pending';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'pending';
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const { CustomerEnquiry } = await getDbModels();
    const rows = await (CustomerEnquiry as any).findAll({ order: [['created_at', 'DESC']], raw: true });
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[Enquiries] GET:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { CustomerEnquiry, MenuItem } = await getDbModels();

    const total = Number(body.total_amount) || 0;
    const paid = Number(body.paid_amount) || 0;
    const outstanding = Math.max(0, total - paid);

    const nut = calculateNutrition({
      weight: Number(body.weight) || 70,
      height: Number(body.height) || 170,
      age: Number(body.age) || 25,
      gender: body.gender || 'male',
      goal: body.goal || 'maintenance',
      activity: body.activity_level || 'sedentary',
      food_preference: body.food_preference || 'veg',
      meals_per_day: Number(body.meals_per_day) || 3,
    });

    const selectedFoodItems = Array.isArray(body.selected_food_items) ? body.selected_food_items : [];
    const mealPlan = Array.isArray(body.meal_plan) ? body.meal_plan : [];

    const rec = await (CustomerEnquiry as any).create({
      customer_name: body.customer_name,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      age: Number(body.age) || null,
      gender: body.gender || null,
      height: Number(body.height) || null,
      weight: Number(body.weight) || null,
      food_preference: body.food_preference || null,
      activity_level: body.activity_level || null,
      goal: body.goal || null,
      meals_per_day: Number(body.meals_per_day) || null,
      selected_food_items: selectedFoodItems,
      meal_plan: mealPlan,
      daily_calories: nut.goal_calories,
      daily_protein: nut.protein_g,
      enquiry_date: body.enquiry_date || null,
      service: body.service || 'meal_plan',
      total_amount: total,
      paid_amount: paid,
      outstanding_amount: outstanding,
      payment_method: body.payment_method || null,
      payment_date: body.payment_date || null,
      payment_status: payStatus(total, paid),
      notes: body.notes || null,
      payment_history: paid > 0 ? [{
        amount: paid, method: body.payment_method || 'cash',
        date: body.payment_date || new Date().toISOString().split('T')[0],
        note: 'Initial payment',
      }] : [],
      sales_notes: body.sales_notes || '',
      sales_status: body.sales_status || 'follow_up',
      order_status: body.sales_status === 'non_follow_up' ? 'non_follow_up'
        : body.sales_status === 'not_interested' ? 'not_interested' : 'details_updated',
    });

    return NextResponse.json(rec, { status: 201 });
  } catch (err) {
    console.error('[Enquiries] POST:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const { CustomerEnquiry } = await getDbModels();
    const existing = await (CustomerEnquiry as any).findByPk(id);
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const total = Number(updates.total_amount ?? existing.total_amount) || 0;
    const paidBase = Number(existing.paid_amount) || 0;
    const extraPayment = Number(updates.additional_payment) || 0;
    const newPaid = extraPayment > 0 ? paidBase + extraPayment : (Number(updates.paid_amount) ?? paidBase);
    const outstanding = Math.max(0, total - newPaid);

    let history = existing.payment_history || [];
    if (typeof history === 'string') { try { history = JSON.parse(history); } catch { history = []; } }
    if (extraPayment > 0) {
      history = [...history, {
        amount: extraPayment,
        method: updates.payment_method || 'cash',
        date: updates.payment_date || new Date().toISOString().split('T')[0],
        note: updates.payment_note || 'Additional payment',
      }];
    }

    const nut = (updates.weight || updates.height || updates.age || updates.gender || updates.goal || updates.activity_level || updates.meals_per_day)
      ? calculateNutrition({
          weight: Number(updates.weight ?? existing.weight) || 70,
          height: Number(updates.height ?? existing.height) || 170,
          age: Number(updates.age ?? existing.age) || 25,
          gender: (updates.gender ?? existing.gender) || 'male',
          goal: (updates.goal ?? existing.goal) || 'maintenance',
          activity: (updates.activity_level ?? existing.activity_level) || 'sedentary',
          food_preference: (updates.food_preference ?? existing.food_preference) || 'veg',
          meals_per_day: Number(updates.meals_per_day ?? existing.meals_per_day) || 3,
        })
      : null;

    const fields: Record<string, any> = {
      customer_name: updates.customer_name ?? existing.customer_name,
      phone: updates.phone ?? existing.phone,
      email: updates.email ?? existing.email,
      address: updates.address ?? existing.address,
      age: Number(updates.age ?? existing.age) || null,
      gender: updates.gender ?? existing.gender,
      height: Number(updates.height ?? existing.height) || null,
      weight: Number(updates.weight ?? existing.weight) || null,
      food_preference: updates.food_preference ?? existing.food_preference,
      activity_level: updates.activity_level ?? existing.activity_level,
      goal: updates.goal ?? existing.goal,
      meals_per_day: Number(updates.meals_per_day ?? existing.meals_per_day) || null,
      selected_food_items: updates.selected_food_items ?? existing.selected_food_items,
      meal_plan: updates.meal_plan ?? existing.meal_plan,
      daily_calories: nut?.goal_calories ?? existing.daily_calories,
      daily_protein: nut?.protein_g ?? existing.daily_protein,
      enquiry_date: updates.enquiry_date ?? existing.enquiry_date,
      service: updates.service ?? existing.service,
      total_amount: total,
      paid_amount: newPaid,
      outstanding_amount: outstanding,
      payment_method: updates.payment_method ?? existing.payment_method,
      payment_date: updates.payment_date ?? existing.payment_date,
      payment_status: payStatus(total, newPaid),
      notes: updates.notes ?? existing.notes,
      payment_history: history,
      sales_notes: updates.sales_notes ?? existing.sales_notes,
      sales_status: updates.sales_status ?? existing.sales_status,
    };

    if (updates.sales_status) {
      if (updates.sales_status === 'follow_up') {
        fields.order_status = 'follow_up';
      } else if (updates.sales_status === 'non_follow_up') {
        fields.order_status = 'non_follow_up';
      } else if (updates.sales_status === 'not_interested') {
        fields.order_status = 'not_interested';
      }
    }
    if (updates.sales_status === 'follow_up' && updates.customer_name !== undefined) {
      fields.order_status = 'details_updated';
    }

    await (CustomerEnquiry as any).update(fields, { where: { id } });
    const updated = await (CustomerEnquiry as any).findByPk(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Enquiries] PATCH:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdmin(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    const { CustomerEnquiry } = await getDbModels();
    await (CustomerEnquiry as any).destroy({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Enquiries] DELETE:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
