/**
 * Portion limits — the minimum and maximum grams a menu item may be served in.
 *
 * The two limits live on `menu_items` as `min_grams` / `max_grams` and are
 * configured from the admin panel. Both are nullable: NULL means "not set",
 * which is how every item starts and how the plan behaves today, so nothing
 * that already works changes by adding them.
 *
 * This module owns the parsing and validation so the create and update routes
 * cannot drift apart, and so the rules are testable without a database.
 */

export const PORTION_FIELDS = ['min_grams', 'max_grams'] as const;
export type PortionField = (typeof PORTION_FIELDS)[number];

/** A portion above this is a typo rather than a plate. */
export const MAX_PORTION_G = 5000;

export type PortionLimits = Record<PortionField, number | null>;
export type PortionUpdates = Partial<PortionLimits>;

export type PortionParseResult =
  | { ok: true; updates: PortionUpdates }
  | { ok: false; message: string };

/**
 * Parse just the limit fields that are actually present in a request body.
 *
 * Only those keys are returned, so a caller merging `updates` onto an existing
 * item leaves the rest untouched — sending `{ min_grams: 20 }` must not silently
 * clear `max_grams`. A blank value (null, undefined or "") clears the limit.
 */
export function parsePortionLimits(input: Record<string, unknown>): PortionParseResult {
  const updates: PortionUpdates = {};

  for (const field of PORTION_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];

    if (raw === null || raw === undefined || raw === '') {
      updates[field] = null;
      continue;
    }

    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) {
      return { ok: false, message: `${field} must be a number of grams` };
    }
    if (n < 0) {
      return { ok: false, message: `${field} cannot be negative` };
    }
    if (n > MAX_PORTION_G) {
      return { ok: false, message: `${field} cannot exceed ${MAX_PORTION_G} g` };
    }

    // Grams are whole numbers; the plan works in 0.1g internally but a serving
    // limit the admin types is what gets stored.
    updates[field] = Math.round(n);
  }

  return { ok: true, updates };
}

/**
 * Check a min/max pair as they would stand after the update — existing values
 * for anything the request did not send. Returns an error message, or null.
 */
export function checkPortionRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null && min > max) {
    return `Minimum quantity (${min} g) cannot be greater than maximum quantity (${max} g)`;
  }
  return null;
}

// ─── enforcement (read path — planning and request validation) ──────────────
//
// Storing the limits is not enough: the meal planner, the manual "add food"
// control, the admin quantity editor and the API routes that persist a plan all
// have to agree on what the numbers mean. These helpers are the single place
// that decides this, so none of them can drift apart.

/** A food's effective serving window in grams. */
export interface PortionBounds {
  /** Lowest allowed grams. 0 means "no configured minimum". */
  min: number;
  /** Highest allowed grams. null means "no configured maximum". */
  max: number | null;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Collapse the stored `min_grams` / `max_grams` (either may be NULL, a number
 * or a numeric string) into a usable window.
 *
 * NULL / missing means "not set". A minimum of 0 means "any amount" and a
 * maximum of 0 or below means "no maximum" — a zero-gram maximum would mean the
 * food can never be served, which no admin could intend, so it is treated as
 * unset. A pair the other way round is clamped so `min <= max` always holds.
 */
export function portionBounds(
  raw: { min_grams?: unknown; max_grams?: unknown } | null | undefined,
): PortionBounds {
  const rawMin = toNumberOrNull(raw?.min_grams);
  const rawMax = toNumberOrNull(raw?.max_grams);
  const min = rawMin != null && rawMin > 0 ? rawMin : 0;
  let max = rawMax != null && rawMax > 0 ? rawMax : null;
  if (max != null && max < min) max = min;
  return { min, max };
}

/** Force a gram amount inside the window (negative becomes 0, then min…max). */
export function clampPortion(grams: number, bounds: PortionBounds): number {
  if (!Number.isFinite(grams)) return bounds.min > 0 ? bounds.min : 0;
  let g = grams;
  if (g < 0) g = 0;
  if (bounds.min > 0 && g < bounds.min) g = bounds.min;
  if (bounds.max != null && g > bounds.max) g = bounds.max;
  return g;
}

/** True when a gram amount sits outside the window. */
export function violatesPortion(
  grams: number,
  bounds: PortionBounds,
  tolerance = 1e-6,
): boolean {
  if (!Number.isFinite(grams) || grams < -tolerance) return true;
  if (bounds.min > 0 && grams < bounds.min - tolerance) return true;
  if (bounds.max != null && grams > bounds.max + tolerance) return true;
  return false;
}

/** Human sentence describing a food's window, for toasts and API errors. */
export function portionRuleText(name: string, bounds: PortionBounds): string {
  const who = name || 'This food';
  if (bounds.min > 0 && bounds.max != null) {
    return `${who} must be between ${bounds.min} g and ${bounds.max} g per portion`;
  }
  if (bounds.max != null) return `${who} cannot exceed ${bounds.max} g per portion`;
  if (bounds.min > 0) return `${who} must be at least ${bounds.min} g per portion`;
  return `${who} has no portion limit`;
}

/** Menu-name normalisation shared with the planner (mirrors Onboarding). */
export const normalizeFoodName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The slice of a `menu_items` row needed to validate a saved plan. */
export interface MenuLimitRow {
  id?: number | string | null;
  name?: string | null;
  min_grams?: unknown;
  max_grams?: unknown;
}

export interface PortionViolation {
  meal: string;
  id: string;
  name: string;
  grams: number;
  min: number;
  max: number | null;
  message: string;
}

/**
 * Re-derive gram amounts for a plan the same way the planner does, but against
 * the rows the caller supplies. Returns one entry per offending portion; an
 * empty array means the plan is inside every configured window.
 *
 * Items are matched by numeric id where possible, then by normalised display
 * name — the onboarding plan stores the normalised name ("paneer") as its id,
 * while admin-edited plans store the menu id, and both shapes appear in the DB.
 */
export function findPlanPortionViolations(
  plan: unknown,
  rows: MenuLimitRow[] | null | undefined,
): PortionViolation[] {
  const byId = new Map<string, MenuLimitRow>();
  const byName = new Map<string, MenuLimitRow>();
  for (const row of rows || []) {
    if (!row) continue;
    if (row.id != null) byId.set(String(row.id), row);
    if (row.name) byName.set(normalizeFoodName(String(row.name)), row);
  }

  const container = plan as any;
  const meals: any[] = Array.isArray(container?.meals)
    ? container.meals
    : Array.isArray(container)
      ? container
      : [];

  const violations: PortionViolation[] = [];
  for (const meal of meals) {
    const mealName = String(meal?.name ?? 'Meal');
    const items: any[] = Array.isArray(meal?.items) ? meal.items : [];
    for (const item of items) {
      const rawId = item?.id;
      const rawName = item?.name;
      const grams = Number(item?.grams ?? item?.g ?? 0);

      let row: MenuLimitRow | undefined;
      if (rawId != null) row = byId.get(String(rawId));
      if (!row && rawName) row = byName.get(normalizeFoodName(String(rawName)));
      if (!row && typeof rawId === 'string') row = byName.get(normalizeFoodName(rawId));
      if (!row) continue; // unknown food: not this validator's job to reject

      const bounds = portionBounds(row);
      if (violatesPortion(grams, bounds)) {
        const label = String(row.name || rawName || rawId || 'food');
        violations.push({
          meal: mealName,
          id: String(rawId ?? rawName ?? ''),
          name: label,
          grams,
          min: bounds.min,
          max: bounds.max,
          message: portionRuleText(label, bounds),
        });
      }
    }
  }

  return violations;
}
