/**
 * Meal-plan validation for API routes that persist a plan.
 *
 * The onboarding and the admin UI already clamp every gram they produce, but a
 * hand-built request must not be able to write a portion outside a food's
 * configured window. This module re-checks a plan against the current
 * `menu_items` rows before it is stored, using the same window logic the
 * planner uses (see menuPortionLimits.findPlanPortionViolations).
 *
 * Plans are matched by numeric menu id when present, then by normalised food
 * name — the two plan shapes in the database (onboarding stores names like
 * "paneer", admin-edited plans store numeric ids) are both checked.
 *
 * The caller passes the plan's goal when it knows it, so each food is judged
 * against its per-goal window (menu_items.goal_portions) for that goal; without
 * a goal the item's default min_grams/max_grams apply.
 *
 * The check is deliberately fail-open: if the rows cannot be read, or the
 * `min_grams` / `max_grams` columns are missing (an unmigrated database), the
 * plan is accepted with a console warning rather than by throwing the request
 * away. Once the schema is migrated, crafted plans are rejected with 400.
 */

import { findPlanPortionViolations } from './menuPortionLimits';

export type MealPlanCheck =
  | { ok: true }
  | { ok: false; message: string };

export async function validateSavedMealPlan(
  meal_plan: unknown,
  MenuItem: any,
  goal?: string | null,
): Promise<MealPlanCheck> {
  if (meal_plan === undefined || meal_plan === null) return { ok: true };

  // Un-migrated database: no window columns to check against — fail open and
  // say so once, so the missing migration is visible in the logs.
  let attributes: any;
  try {
    attributes = MenuItem?.getAttributes?.();
    if (attributes && (!attributes.min_grams || !attributes.max_grams)) {
      console.warn(
        '[validateSavedMealPlan] min_grams/max_grams columns not found — skipping the plan check (schema not migrated)',
      );
      return { ok: true };
    }
  } catch {
    return { ok: true };
  }

  // goal_portions is optional: a database that predates it still validates
  // against the default window rather than skipping the check.
  const fields = ['id', 'name', 'min_grams', 'max_grams'];
  if (attributes?.goal_portions) fields.push('goal_portions');

  let rows: any[] = [];
  try {
    rows = await MenuItem.findAll({ raw: true, attributes: fields });
  } catch (err) {
    console.warn(
      '[validateSavedMealPlan] could not read menu_items — skipping the plan check:',
      err,
    );
    return { ok: true };
  }

  const violations = findPlanPortionViolations(meal_plan, rows, goal);
  if (violations.length === 0) return { ok: true };

  const first = violations[0];
  return {
    ok: false,
    message: `${first.meal}: ${first.name} at ${first.grams} g — ${first.message}`,
  };
}