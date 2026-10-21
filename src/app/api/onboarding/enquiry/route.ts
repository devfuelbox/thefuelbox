import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { getDbModels } from '@/lib/db';
import { validateSavedMealPlan } from '@/lib/mealPlanValidation';

/**
 * Public endpoint: the onboarding result page auto-saves a Customer Enquiry the
 * moment the plan is generated — no staff login, no "Order on WhatsApp" click.
 *
 * It writes to the SAME `customer_enquiries` table the Sales Admin reads, so the
 * records show up under Customer Enquiries with no separate data path. The
 * staff-only /api/roles/sales/enquiries route cannot be used here (it requires
 * an admin/sales JWT), so this route re-applies the same validation and the
 * same derived fields (outstanding/payment status) without the auth gate.
 *
 * Duplicate safety: every submission carries a deterministic `dedupe_key`
 * (phone + goal + plan fingerprint). A repeat — page refresh, revisiting the
 * result screen, or a retried request — finds the existing row and updates it
 * in place instead of inserting a second enquiry.
 */

const PHONE_RE = /^[6-9]\d{9}$/;
const GOALS = ['loss', 'gain', 'muscle', 'maintenance'];
const FOODS = ['veg', 'egg', 'nonveg'];

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/** '' / null / undefined → null, otherwise a finite number. */
function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Short, stable hash of the values that define one enquiry submission. */
function fingerprint(parts: Array<string | number | null | undefined>): string {
  return crypto
    .createHash('sha1')
    .update(parts.map((p) => (p === undefined || p === null ? '' : String(p))).join('|'))
    .digest('hex')
    .slice(0, 24);
}

export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));

    const name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
    if (!name) return bad('Customer name is required');

    const phone = String(body.phone ?? '').replace(/\D/g, '').slice(-10);
    if (!PHONE_RE.test(phone)) return bad('A valid 10-digit mobile number is required');

    if (body.goal && !GOALS.includes(String(body.goal))) return bad('Unknown goal value');
    if (body.food_preference && !FOODS.includes(String(body.food_preference))) {
      return bad('Unknown food preference');
    }

    for (const key of [
      'age', 'height', 'weight', 'meals_per_day',
      'bmi', 'bmr', 'tdee', 'water_liters', 'delivery_km',
      'daily_calories', 'daily_protein', 'daily_carbs', 'daily_fat', 'daily_fiber',
    ] as const) {
      const v = body[key];
      if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
        return bad(`${key} must be a number`);
      }
    }

    const { CustomerEnquiry, Customer, MenuItem } = await getDbModels();

    // Same guard the staff route applies: a hand-built plan must not store a
    // portion outside a food's configured window.
    if (body.meal_plan !== undefined && body.meal_plan !== null) {
      const check = await validateSavedMealPlan(body.meal_plan, MenuItem, body.goal);
      if (!check.ok) return bad(check.message);
    }

    const total = Number(body.total_amount) || 0;
    const paid = Number(body.paid_amount) || 0;
    const paymentStatus = total <= 0 ? 'pending' : paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';

    // One key per (phone + plan shape). Same person re-submitting the same plan
    // is the same enquiry; changing the plan produces a new key, so the fresh
    // numbers are stored rather than silently ignored. Height and weight are
    // in the fingerprint because they drive BMI and the energy targets.
    const dedupeKey = `onboarding:${phone}:${fingerprint([
      body.goal,
      body.food_preference,
      body.activity_level,
      body.meals_per_day,
      body.height,
      body.weight,
      body.daily_calories,
      body.daily_protein,
      total,
      JSON.stringify(body.selected_food_items ?? ''),
    ])}`;

    const fields: Record<string, any> = {
      customer_name: name,
      phone,
      email: body.email ? String(body.email).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      age: numOrNull(body.age),
      gender: body.gender || null,
      height: numOrNull(body.height),
      weight: numOrNull(body.weight),
      food_preference: body.food_preference || null,
      activity_level: body.activity_level || null,
      goal: body.goal || null,
      meals_per_day: numOrNull(body.meals_per_day),
      selected_food_items: body.selected_food_items ?? [],
      meal_plan: body.meal_plan ?? [],
      daily_calories: numOrNull(body.daily_calories),
      daily_protein: numOrNull(body.daily_protein),
      daily_carbs: numOrNull(body.daily_carbs),
      daily_fat: numOrNull(body.daily_fat),
      daily_fiber: numOrNull(body.daily_fiber),
      // Body metrics + energy expenditure, as calculated on the result screen.
      bmi: numOrNull(body.bmi),
      bmi_category: body.bmi_category || null,
      bmr: numOrNull(body.bmr),
      tdee: numOrNull(body.tdee),
      water_liters: numOrNull(body.water_liters),
      // Delivery feasibility the customer was shown.
      delivery_km: numOrNull(body.delivery_km),
      delivery_status: body.delivery_status || null,
      enquiry_date: body.enquiry_date || new Date().toISOString().split('T')[0],
      service: body.service || 'meal_plan',
      total_amount: total,
      paid_amount: paid,
      outstanding_amount: Math.max(0, total - paid),
      payment_status: paymentStatus,
      payment_history: body.payment_history ?? [],
      sales_notes: body.sales_notes || '',
      // Auto-saved enquiries open as a normal "Submitted" enquiry so the Sales
      // Admin actions (Edit / PDF / Close) work on them unchanged.
      sales_status: 'follow_up',
      order_status: 'new_enquiry',
      // Extras the onboarding computes: BMI + full macro targets + the human
      // readable summary. Stored on the enquiry so the admin sees the exact
      // numbers the customer saw, without recomputing anything.
      special_instructions: body.summary ? String(body.summary) : null,
      delivery_time_slot: body.delivery_time_slot || null,
      dedupe_key: dedupeKey,
      source: 'onboarding',
    };

    const existing = await (CustomerEnquiry as any).findOne({ where: { dedupe_key: dedupeKey } });

    let record: any;
    let created = false;
    if (existing) {
      // Never overwrite a status a staff member has already moved on (closed /
      // not interested) — a refresh must not reopen a handled enquiry.
      const handled = existing.sales_status && existing.sales_status !== 'follow_up';
      const patch = { ...fields };
      if (handled) {
        delete patch.sales_status;
        delete patch.order_status;
      }
      await existing.update(patch);
      record = existing;
    } else {
      record = await (CustomerEnquiry as any).create({
        ...fields,
        assigned_sales_id: null,
      });
      created = true;
    }

    // Keep the customers row's headline price in step (same as the staff route).
    if (total > 0) {
      const customer = await (Customer as any).findOne({
        where: { phone: { [Op.like]: `%${phone}%` } },
      });
      if (customer) await customer.update({ meal_plan_price: total });
    }

    return NextResponse.json(
      { success: true, id: record.id, created, dedupe_key: dedupeKey },
      { status: created ? 201 : 200 },
    );
  } catch (err: any) {
    console.error('[Onboarding Enquiry POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save enquiry' },
      { status: 500 },
    );
  }
}
