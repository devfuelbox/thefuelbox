import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { getDbModels } from '@/lib/db';

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

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      name,
      phone,
      email,
      goal,
      age,
      gender,
      height,
      weight,
      food,
      activity,
      freq,
      loc_status,
      loc_km,
      loc_fee,
      loc_lat,
      loc_lng,
      meal_plan,
      meal_plan_price,
      meal_plan_packages,
    } = data;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }

    const { Customer } = await getDbModels();

    // Check if customer with this phone already exists to update them, otherwise create
    let customer = await (Customer as any).findOne({ where: { phone } });

    const fields = {
      name,
      phone,
      email: email || null,
      goal: goal || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      food: food || null,
      activity: activity || null,
      freq: freq ? Number(freq) : null,
      loc_status: loc_status || null,
      loc_km: loc_km != null ? Number(loc_km) : null,
      loc_fee: loc_fee != null ? Number(loc_fee) : null,
      loc_lat: loc_lat != null ? Number(loc_lat) : null,
      loc_lng: loc_lng != null ? Number(loc_lng) : null,
      meal_plan: meal_plan || null,
      meal_plan_price: meal_plan_price != null ? Number(meal_plan_price) : 0,
      meal_plan_packages: meal_plan_packages || null,
    };

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
