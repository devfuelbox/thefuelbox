import { NextResponse } from 'next/server';
import { getDbModels } from '@/lib/db';
import { validateSavedMealPlan } from '@/lib/mealPlanValidation';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const customerId = params.id;
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'Customer ID is required' }, { status: 400 });
    }

    const { meal_plan } = await req.json();
    if (!meal_plan) {
      return NextResponse.json({ success: false, error: 'Meal plan data is required' }, { status: 400 });
    }

    const { Customer, MenuItem } = await getDbModels();
    const customer = await (Customer as any).findByPk(customerId);

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    // The admin UI clamps every gram it saves, but only the API can stop a
    // crafted request from writing a portion outside a food's window. The
    // customer's goal decides which per-goal window applies.
    const check = await validateSavedMealPlan(meal_plan, MenuItem, customer.goal);
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.message }, { status: 400 });
    }

    await customer.update({ meal_plan });

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    console.error('[Onboarding Meal Plan PUT] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update meal plan' },
      { status: 500 }
    );
  }
}
