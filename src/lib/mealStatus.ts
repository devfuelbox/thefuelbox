// Shared helpers for per-meal status tracking across role dashboards.
//
// Per-meal status lives in `customer_enquiries.meal_statuses` as a JSON map:
//   { [mealSlot]: { status, assigned_delivery_id, ready_at } }
// Statuses follow the order chain: assigned_to_chef -> preparing ->
// ready_for_delivery -> assigned_to_delivery_partner -> out_for_delivery -> delivered.

import { normalizeMealPlan } from './mealPlan';

const KNOWN_STATUSES = ['assigned_to_chef', 'preparing', 'ready_for_delivery', 'assigned_to_delivery_partner', 'out_for_delivery', 'delivered'];

export function planMealNames(mealPlan: any): string[] {
  const norm = normalizeMealPlan(mealPlan);
  return norm ? norm.meals.map((m: any) => m.name || 'Meal') : [];
}

export function defaultMealStatus(orderStatus: string): string {
  return KNOWN_STATUSES.includes(orderStatus) ? orderStatus : 'assigned_to_chef';
}

// Normalizes the stored per-meal status map for an enquiry row, ensuring every
// meal in the plan has an entry. Once any meal is tracked per-meal, meals
// missing from the stored map default to 'assigned_to_chef'; otherwise they
// inherit the order-level status (for older orders created before per-meal
// tracking existed).
export function buildMealStatuses(r: any): Record<string, any> {
  const statuses: Record<string, any> = {};
  const raw = r.meal_statuses && typeof r.meal_statuses === 'object' ? r.meal_statuses : {};
  const hasAnyManaged = Object.keys(raw).length > 0;
  planMealNames(r.meal_plan).forEach(name => {
    const existing = raw[name] && typeof raw[name] === 'object' ? raw[name] : {};
    statuses[name] = {
      status: existing.status || (hasAnyManaged ? 'assigned_to_chef' : defaultMealStatus(r.order_status)),
      assigned_delivery_id: existing.assigned_delivery_id || null,
      ready_at: existing.ready_at || null,
    };
  });
  return statuses;
}
