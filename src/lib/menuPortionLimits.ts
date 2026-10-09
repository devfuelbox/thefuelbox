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
