import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { getDbModels } from '@/lib/db';
import { validateSavedMealPlan } from '@/lib/mealPlanValidation';

// Generate a sequential, human-friendly order id (FB-01, FB-02, …)
async function nextOrderId(Customer: any) {
  const count = await Customer.count({
    where: { id: { [Op.like]: 'FB-%' } },
  });
  return `FB-${String(count + 1).padStart(2, '0')}`;
}

async function createCustomerWithOrderId(Customer: any, fields: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await nextOrderId(Customer);
    try {
      return await Customer.create({ ...fields, id });
    } catch (err: any) {
      const isDuplicate =
        err?.name === 'SequelizeUniqueConstraintError' ||
        /duplicate|unique/i.test(err?.message || '');
      if (!isDuplicate || attempt === 4) throw err;
    }
  }
  throw new Error('Failed to assign a unique order id');
}

// ── Validation ────────────────────────────────────────────────────────────────
// The onboarding wizard validates every field inline; these are the server-side
// mirrors so a malformed or hand-built request can never reach the table.
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOALS = ['loss', 'gain', 'muscle', 'maintenance'];
const FOODS = ['veg', 'egg', 'nonveg'];
const ACTIVITIES = ['sedentary', 'active', 'gym'];
const GENDERS = ['Male', 'Female'];

function bad(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

/** '' / null / undefined → null, otherwise a finite number (guarded earlier). */
function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  return Number(v);
}

export async function POST(req: Request) {
  try {
    const data: any = await req.json().catch(() => ({}));

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return bad('Name is required');

    // One canonical phone shape (10-digit national number, digits only) so the
    // same person always matches and updates one row — never a new duplicate.
    const phone = String(data.phone ?? '').replace(/\D/g, '').slice(-10);
    if (!PHONE_RE.test(phone)) {
      return bad('A valid 10-digit mobile number is required');
    }

    const email = data.email == null ? '' : String(data.email).trim();
    if (email && !EMAIL_RE.test(email)) return bad('A valid email address is required');

    if (data.goal && !GOALS.includes(String(data.goal))) return bad('Unknown goal value');
    if (data.food && !FOODS.includes(String(data.food))) return bad('Unknown food preference');
    if (data.activity && !ACTIVITIES.includes(String(data.activity))) {
      return bad('Unknown activity level');
    }
    if (data.gender && !GENDERS.includes(String(data.gender))) return bad('Unknown gender value');

    for (const key of ['age', 'height', 'weight', 'freq'] as const) {
      const v = data[key];
      if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
        return bad(`${key} must be a number`);
      }
    }

    const { Customer, MenuItem } = await getDbModels();

    // The onboarding clamps every gram it generates, but a hand-built request
    // must not be able to write a plan outside a food's configured window —
    // judged against the goal's own portion limits when one is present.
    if (data.meal_plan) {
      const check = await validateSavedMealPlan(data.meal_plan, MenuItem, data.goal);
      if (!check.ok) {
        return bad(check.message);
      }
    }

    // ── Upsert by phone (no duplicate rows) ──────────────────────────────────
    // Only the fields actually present in the request are written. The step-2
    // save (profile only) therefore runs before the order save (profile + plan)
    // without erasing anything the other one stored.
    let customer = await (Customer as any).findOne({ where: { phone } });

    const fields: any = { name, phone };
    if (data.email !== undefined) fields.email = email || null;
    if (data.goal !== undefined) fields.goal = data.goal || null;
    if (data.gender !== undefined) fields.gender = data.gender || null;
    if (data.food !== undefined) fields.food = data.food || null;
    if (data.activity !== undefined) fields.activity = data.activity || null;
    if (data.loc_status !== undefined) fields.loc_status = data.loc_status || null;
    if (data.age !== undefined) fields.age = numOrNull(data.age);
    if (data.height !== undefined) fields.height = numOrNull(data.height);
    if (data.weight !== undefined) fields.weight = numOrNull(data.weight);
    if (data.freq !== undefined) fields.freq = numOrNull(data.freq);
    if (data.loc_km !== undefined) fields.loc_km = numOrNull(data.loc_km);
    if (data.loc_fee !== undefined) fields.loc_fee = numOrNull(data.loc_fee);
    if (data.loc_lat !== undefined) fields.loc_lat = numOrNull(data.loc_lat);
    if (data.loc_lng !== undefined) fields.loc_lng = numOrNull(data.loc_lng);
    if (data.meal_plan !== undefined) fields.meal_plan = data.meal_plan || null;
    if (data.meal_plan_price !== undefined) fields.meal_plan_price = Number(data.meal_plan_price) || 0;
    if (data.meal_plan_packages !== undefined) fields.meal_plan_packages = data.meal_plan_packages || null;

    if (customer) {
      await customer.update(fields);
    } else {
      customer = await createCustomerWithOrderId(Customer, fields);
    }

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    console.error('[Onboarding Customer POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save customer details' },
      { status: 500 }
    );
  }
}
