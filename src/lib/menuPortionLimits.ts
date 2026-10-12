/**
 * Portion limits — the minimum and maximum grams a menu item may be served in.
 *
 * The two limits live on `menu_items` as `min_grams` / `max_grams` and are
 * configured from the admin panel. Both are nullable: NULL means "not set",
 * which is how every item starts and how the plan behaves today, so nothing
 * that already works changes by adding them.
 *
 * On top of the single `min_grams` / `max_grams` pair, an item can carry a
 * per-goal window in `goal_portions`, a JSON object keyed by goal category:
 *
 *     { "gain": { "min": 100, "max": 150 }, "loss": { "min": 50, "max": 100 } }
 *
 * A goal with its own entry uses those numbers; every other goal (and an
 * item with no `goal_portions` at all) falls back to `min_grams` / `max_grams`,
 * so existing items keep behaving exactly as before.
 *
 * This module owns the parsing and validation so the create and update routes
 * cannot drift apart, and so the rules are testable without a database.
 */

import {
  GOAL_CATEGORIES,
  GOAL_CATEGORY_LABELS,
  toGoalCategory,
  type GoalCategory,
} from './goalCategories';

export const PORTION_FIELDS = ['min_grams', 'max_grams'] as const;
export type PortionField = (typeof PORTION_FIELDS)[number];

/** The JSON column holding the per-goal windows. */
export const GOAL_PORTIONS_FIELD = 'goal_portions';

/** A portion above this is a typo rather than a plate. */
export const MAX_PORTION_G = 5000;

export type PortionLimits = Record<PortionField, number | null>;
export type PortionUpdates = Partial<PortionLimits>;

export type PortionParseResult =
  | { ok: true; updates: PortionUpdates }
  | { ok: false; message: string };

/**
 * Parse one optional gram limit. Blank (null / undefined / "") clears it; a
 * number or numeric string becomes a whole number of grams. `label` is used in
 * the error message so a caller can point at a goal entry ("gain.min").
 */
function parseGramValue(
  raw: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }

  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return { ok: false, message: `${label} must be a number of grams` };
  }
  if (n < 0) {
    return { ok: false, message: `${label} cannot be negative` };
  }
  if (n > MAX_PORTION_G) {
    return { ok: false, message: `${label} cannot exceed ${MAX_PORTION_G} g` };
  }

  // Grams are whole numbers; the plan works in 0.1g internally but a serving
  // limit the admin types is what gets stored.
  return { ok: true, value: Math.round(n) };
}

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
    const parsed = parseGramValue(input[field], field);
    if (!parsed.ok) return parsed;
    updates[field] = parsed.value;
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

// ─── per-goal windows ───────────────────────────────────────────────────────
//
// `goal_portions` is a JSON map of goal category → { min, max }. It lets an
// admin set a different window per goal (Paneer 100–150 under Weight Gain but
// 50–100 under Weight Loss). A goal without an entry inherits the item's
// default `min_grams` / `max_grams`, so nothing changes until it is filled in.

export interface GoalPortion {
  min: number | null;
  max: number | null;
}
export type GoalPortions = Partial<Record<GoalCategory, GoalPortion>>;

export type GoalPortionsParseResult =
  | { ok: true; value: GoalPortions }
  | { ok: false; message: string };

const GOAL_NAMES = GOAL_CATEGORIES.map((c) => GOAL_CATEGORY_LABELS[c]).join(', ');

/**
 * Validate a request value for `goal_portions`.
 *
 * Accepts an object keyed by goal key or admin label; each value is
 * `{ min?, max? }` with nullable numbers. Unknown goals, non-object entries and
 * bad numbers are rejected so a typo cannot silently change every plan. A goal
 * whose entry is blank (both fields empty) is dropped — it falls back to the
 * default window instead of pinning an empty one.
 */
export function parseGoalPortions(raw: unknown): GoalPortionsParseResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: {} };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      message: `goal_portions must be an object keyed by goal category. Allowed: ${GOAL_NAMES}`,
    };
  }

  const value: GoalPortions = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    const goal = toGoalCategory(key);
    if (!goal) {
      return {
        ok: false,
        message: `Unknown goal category "${key}" in goal_portions. Allowed: ${GOAL_NAMES}`,
      };
    }
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== 'object' || Array.isArray(entry)) {
      return {
        ok: false,
        message: `goal_portions.${key} must be an object with min and/or max`,
      };
    }

    const obj = entry as Record<string, unknown>;
    const parsedMin = parseGramValue(obj.min, `${key}.min`);
    if (!parsedMin.ok) return parsedMin;
    const parsedMax = parseGramValue(obj.max, `${key}.max`);
    if (!parsedMax.ok) return parsedMax;

    const min = parsedMin.value;
    const max = parsedMax.value;
    if (min != null && max != null && min > max) {
      return {
        ok: false,
        message: `Minimum quantity (${min} g) cannot be greater than maximum quantity (${max} g) for ${GOAL_CATEGORY_LABELS[goal]}`,
      };
    }
    if (min == null && max == null) continue; // blank = inherit the default
    value[goal] = { min, max };
  }

  return { ok: true, value };
}

/**
 * Read a stored `menu_items.goal_portions` value for planning. Tolerant by
 * design, like `toGoalCategoryList`: NULL, a JSON string or a parsed object all
 * reduce to a `GoalPortions` map, and anything unrecognised is dropped rather
 * than throwing.
 */
export function toGoalPortions(raw: unknown): GoalPortions {
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = null;
      }
    } else {
      value = null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const out: GoalPortions = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const goal = toGoalCategory(key);
    if (!goal || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const min = toNumberOrNull((entry as Record<string, unknown>).min);
    const max = toNumberOrNull((entry as Record<string, unknown>).max);
    if (min == null && max == null) continue;
    out[goal] = { min, max };
  }
  return out;
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
 * Turn a raw (min, max) pair into a usable window: unset/zero minimum means
 * "any amount", an unset/zero-or-below maximum means "no maximum", and a pair
 * the wrong way round is clamped so `min <= max` always holds.
 */
const boundsFrom = (rawMin: number | null, rawMax: number | null): PortionBounds => {
  const min = rawMin != null && rawMin > 0 ? rawMin : 0;
  let max = rawMax != null && rawMax > 0 ? rawMax : null;
  if (max != null && max < min) max = min;
  return { min, max };
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
  return boundsFrom(toNumberOrNull(raw?.min_grams), toNumberOrNull(raw?.max_grams));
}

/**
 * The window that applies to a food under a specific goal.
 *
 * When the food has a `goal_portions` entry for that goal, its numbers are the
 * only ones that apply; otherwise the default `min_grams` / `max_grams` are
 * used. The goal is matched by the same canonical rule as the picker, so an
 * unknown or missing goal simply falls back to the default window.
 */
export function portionBoundsForGoal(
  raw:
    | { min_grams?: unknown; max_grams?: unknown; goal_portions?: unknown }
    | null
    | undefined,
  goal: string | null | undefined,
): PortionBounds {
  const key = toGoalCategory(goal);
  if (key) {
    const entry = toGoalPortions(raw?.goal_portions)[key];
    if (entry && (entry.min != null || entry.max != null)) {
      return boundsFrom(entry.min, entry.max);
    }
  }
  return portionBounds(raw);
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
  goal_portions?: unknown;
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
 * When `goal` is given, each food is judged against its window for that goal
 * (its `goal_portions` entry, else its default limits); without a goal the
 * default window is used.
 *
 * Items are matched by numeric id where possible, then by normalised display
 * name — the onboarding plan stores the normalised name ("paneer") as its id,
 * while admin-edited plans store the menu id, and both shapes appear in the DB.
 */
export function findPlanPortionViolations(
  plan: unknown,
  rows: MenuLimitRow[] | null | undefined,
  goal?: string | null,
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

      const bounds = portionBoundsForGoal(row, goal);
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
