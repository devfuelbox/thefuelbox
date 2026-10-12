/**
 * Goal categories — the fitness goals a menu item is assigned to.
 *
 * An admin assigns one or more of these to each food from the Menu Items
 * section of the admin panel, and the onboarding then offers the foods whose
 * categories match the goal the user picked. They live on
 * `menu_items.goal_categories` as a JSON array of the goal keys below — the
 * same keys the onboarding already uses for `a.goal`, so no translation
 * table sits between the two.
 *
 * An item with no categories (NULL or []) is uncategorized and counts for
 * every goal. That is how every item starts, so nothing that works today
 * changes until an admin assigns a category.
 *
 * This module owns the parsing and the matching rule so the create and
 * update routes cannot drift apart, and so the rules are testable without a
 * database.
 */

export const GOAL_CATEGORIES = ['loss', 'gain', 'muscle', 'maintenance'] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  loss: 'Weight Loss',
  gain: 'Weight Gain',
  muscle: 'Muscle Gain',
  maintenance: 'Weight Maintenance',
};

/** The admin panel's picker list, in display order. */
export const GOAL_CATEGORY_OPTIONS: ReadonlyArray<{
  value: GoalCategory;
  label: string;
}> = GOAL_CATEGORIES.map((value) => ({ value, label: GOAL_CATEGORY_LABELS[value] }));

/** Collapses any spelling of a category ("Weight Loss", "weight_loss", "loss")
 *  to one comparable key, so both the slug and the admin label are accepted. */
const slugOf = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const CANONICAL = GOAL_CATEGORIES.reduce<Record<string, GoalCategory>>((acc, slug) => {
  acc[slugOf(slug)] = slug;
  acc[slugOf(GOAL_CATEGORY_LABELS[slug])] = slug;
  return acc;
}, {});

/**
 * Collapse any spelling of a goal (key or admin label, any case) to its
 * canonical key, or null when it is not a known goal. Shared with
 * menuPortionLimits so the per-goal portion keys accept exactly the same
 * spellings the picker and the request validator accept.
 */
export function toGoalCategory(value: unknown): GoalCategory | null {
  if (typeof value !== 'string') return null;
  return CANONICAL[slugOf(value)] ?? null;
}

export type GoalCategoryParseResult =
  | { ok: true; categories: GoalCategory[] }
  | { ok: false; message: string };

/**
 * Validate a request value for `goal_categories`.
 *
 * Accepts an array of goal keys or admin labels (in any order, any case,
 * with duplicates) and returns the canonical goal keys in display order.
 * `null`/`undefined`/`''` clears the list; anything that is not an array is
 * rejected rather than guessed at.
 */
export function parseGoalCategories(raw: unknown): GoalCategoryParseResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, categories: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      message: `goal_categories must be an array. Allowed: ${Object.values(GOAL_CATEGORY_LABELS).join(', ')}`,
    };
  }

  const picked: GoalCategory[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return {
        ok: false,
        message: 'goal_categories must be a list of category names',
      };
    }
    const slug = CANONICAL[slugOf(entry)];
    if (!slug) {
      return {
        ok: false,
        message: `Unknown goal category "${entry.trim()}". Allowed: ${Object.values(GOAL_CATEGORY_LABELS).join(', ')}`,
      };
    }
    if (!picked.includes(slug)) picked.push(slug);
  }

  // Canonical display order regardless of the order they were sent in.
  return { ok: true, categories: GOAL_CATEGORIES.filter((c) => picked.includes(c)) };
}

/**
 * Read a stored `menu_items.goal_categories` value for display. Tolerant by
 * design: NULL, a bare string or a JSON string all reduce to a plain list,
 * and anything unrecognised is dropped instead of throwing.
 */
export function toGoalCategoryList(raw: unknown): GoalCategory[] {
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = [];
      }
    } else {
      value = trimmed ? [trimmed] : [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: GoalCategory[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const slug = CANONICAL[slugOf(entry)];
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return GOAL_CATEGORIES.filter((c) => out.includes(c));
}

/**
 * The one rule the onboarding filters on: is this food offered for the goal
 * the user picked?
 *
 * An uncategorized food (no categories at all) counts for every goal — it is
 * a generic menu item, and it is how every item starts. A categorized food
 * counts only for the goals it was assigned to.
 */
export function belongsToGoal(
  categories: readonly string[] | null | undefined,
  goal: string | null | undefined,
): boolean {
  if (!Array.isArray(categories) || categories.length === 0) return true;
  if (!goal) return true;
  const target = CANONICAL[slugOf(goal)];
  if (!target) return false;
  return categories.some((c) => CANONICAL[slugOf(String(c))] === target);
}
