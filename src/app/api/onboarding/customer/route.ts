import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';

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
    };

    if (customer) {
      await customer.update(fields);
    } else {
      customer = await (Customer as any).create(fields);
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
