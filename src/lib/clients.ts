/**
 * Shared TFBC client helpers used by both the Clients API and the Clients UI.
 *
 * The delivery schedule is the single source of truth for a client's dates and
 * status: the end date is the Nth *delivery* day counted from the start date,
 * where a delivery day is a day the chosen schedule permits and that is not in
 * the skip list. Skipping a delivery day therefore pushes the end date forward
 * without ever counting the skipped day as an active delivery day.
 */

export type PlanType = 'trial' | 'package';
export type ScheduleKey = 'mon_fri' | 'mon_sat';
export type MealKey = 'breakfast' | 'lunch' | 'dinner';
export type ClientStatus = 'active' | 'skipped_today' | 'completed' | 'inactive';

export const SCHEDULE_OFF_DAYS: Record<ScheduleKey, number[]> = {
  mon_fri: [0, 6], // Sat & Sun off
  mon_sat: [0], // Sunday off
};

export const PLANS: { key: PlanType; label: string; hint: string; max: number }[] = [
  { key: 'trial', label: 'Trial Plan', hint: '1–6 days', max: 6 },
  { key: 'package', label: 'Package Plan', hint: '1–26 days', max: 26 },
];

export const GOAL_LABELS: Record<string, string> = {
  loss: 'Weight Loss',
  gain: 'Weight Gain',
  muscle: 'Muscle Gain',
  maintenance: 'Healthy Meal',
};

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayISO(): string {
  return toISO(new Date());
}
export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function planMax(plan: PlanType): number {
  return plan === 'package' ? 26 : 6;
}

/** TFBC label for a client's sequential number (1 → TFBC001). */
export function clientLabel(clientNo: number | null | undefined): string {
  const n = Number(clientNo);
  if (!Number.isFinite(n) || n <= 0) return 'TFBC—';
  return `TFBC${String(n).padStart(3, '0')}`;
}

export function isDeliveryDay(dateISO: string, schedule: ScheduleKey, skipped: Set<string>): boolean {
  const off = SCHEDULE_OFF_DAYS[schedule] ?? SCHEDULE_OFF_DAYS.mon_fri;
  const d = parseISO(dateISO);
  if (Number.isNaN(d.getTime())) return false;
  return !off.includes(d.getDay()) && !skipped.has(dateISO);
}

/** The `duration`-th delivery day on/after `startISO`, honouring schedule + skips. */
export function computeEndDate(
  startISO: string,
  duration: number,
  schedule: ScheduleKey,
  skips: string[] = [],
): string {
  if (!startISO || !duration || duration < 1) return '';
  const skipped = new Set(skips);
  const cursor = parseISO(startISO);
  if (Number.isNaN(cursor.getTime())) return '';
  let counted = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (isDeliveryDay(toISO(cursor), schedule, skipped)) {
      counted += 1;
      if (counted === duration) return toISO(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return '';
}

/**
 * Status derived purely from the schedule:
 *  - inactive                                    → 'inactive'
 *  - today is a skip date for a live client      → 'skipped_today'
 *  - every delivery day in the window is in the past → 'completed'
 *  - otherwise                                   → 'active'
 * A client is never 'completed' while a delivery day is still today or later.
 */
export function computeClientStatus(client: {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  skip_dates?: string[] | null;
  schedule?: string | null;
  duration_days?: number | null;
}): ClientStatus {
  if ((client.status || 'active') === 'inactive') return 'inactive';

  const start = client.start_date || '';
  const end = client.end_date || '';
  const schedule = (client.schedule as ScheduleKey) || 'mon_fri';
  const skips = Array.isArray(client.skip_dates) ? client.skip_dates : [];
  const today = todayISO();

  if (!start || !end) return 'active';
  if (skips.includes(today)) return 'skipped_today';
  if (today > end) return 'completed';
  return 'active';
}

export const STATUS_META: Record<ClientStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  skipped_today: { label: 'Skipped Today', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  inactive: { label: 'Inactive', className: 'bg-red-50 text-red-600 border-red-200' },
};

export function balanceOf(total: unknown, paid: unknown): number {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0));
}

/**
 * Which actions a client of a given status/plan may show, mirroring the
 * reference page: Skipped Today only for a live (not completed) client, and
 * Convert to Package in place of Renew for a completed trial.
 */
export type ClientAction =
  | 'skip_today' | 'renew' | 'convert' | 'skip_dates'
  | 'payment' | 'edit' | 'inactive' | 'activate' | 'delete';

export function availableActions(status: ClientStatus, plan: PlanType): ClientAction[] {
  const base: ClientAction[] = ['skip_dates', 'payment', 'edit'];

  if (status === 'inactive') return [...base, 'activate', 'delete'];

  if (status === 'completed') {
    if (plan === 'trial') return ['convert', ...base, 'inactive', 'delete'];
    return ['renew', ...base, 'inactive', 'delete'];
  }

  // active | skipped_today
  return ['skip_today', 'renew', ...base, 'inactive', 'delete'];
}

export function formatINR(v: unknown): string {
  return `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Operations dashboard ─────────────────────────────────────────────────
 * Everything below powers the Operations Dashboard. The rules mirror the way a
 * kitchen actually plans: a delivery happens on a *delivery day* that falls
 * inside the client's plan window and is not in the skip list. Meals are the
 * selected meals on the plan's schedule, and every delivery day produces one
 * box per selected meal (boxes_per_day × meal count is *not* double counted —
 * boxes_per_day is the number of boxes, meals describe their composition).
 * ----------------------------------------------------------------------*/

export type Scope = 'day' | 'month' | 'range';

export type BoxMeals = { total: number; breakfast: number; lunch: number; dinner: number };

export type PlanLike = {
  meals?: string[] | null;
  schedule?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  skip_dates?: string[] | null;
  boxes_per_day?: number | null;
  status?: string | null;
};

/** Inclusive list of ISO dates from `fromISO` to `endISO`. */
export function eachDay(fromISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cursor = parseISO(fromISO);
  const end = parseISO(endISO);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let guard = 0; guard < 800 && cursor <= end; guard++) {
    out.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Does this plan deliver on `dateISO`? True only when the date is a delivery
 * day for the plan's schedule, inside the plan window, and not skipped. An
 * inactive plan never delivers.
 */
export function deliversOn(plan: PlanLike, dateISO: string): boolean {
  if ((plan.status || 'active') === 'inactive') return false;
  const start = plan.start_date || '';
  const end = plan.end_date || '';
  if (!start || !end) return false;
  if (dateISO < start || dateISO > end) return false;
  const schedule = (plan.schedule as ScheduleKey) || 'mon_fri';
  const skips = new Set(Array.isArray(plan.skip_dates) ? plan.skip_dates : []);
  return isDeliveryDay(dateISO, schedule, skips);
}

/**
 * Boxes a plan produces over an inclusive date window, split by meal. Each
 * delivery day contributes `boxes_per_day` boxes, and each box carries one
 * unit per selected meal — so Breakfast + Lunch + Dinner equals the total.
 *
 * A plan that records no meals is treated as serving all three (the reference
 * splits every box into breakfast/lunch/dinner, and legacy rows predate meal
 * tracking), which keeps the per-meal columns summing to the total.
 */
export function boxesForPlan(plan: PlanLike, fromISO: string, endISO: string): BoxMeals {
  const raw = (Array.isArray(plan.meals) ? plan.meals : []).map((m) => String(m).toLowerCase());
  const meals = raw.length > 0 ? raw : ['breakfast', 'lunch', 'dinner'];
  const perDay = Math.max(0, Number(plan.boxes_per_day) || 0);
  const result: BoxMeals = { total: 0, breakfast: 0, lunch: 0, dinner: 0 };
  if (perDay === 0) return result;

  for (const day of eachDay(fromISO, endISO)) {
    if (!deliversOn(plan, day)) continue;
    const boxes = perDay;
    result.total += boxes;
    if (meals.includes('breakfast')) result.breakfast += boxes;
    if (meals.includes('lunch')) result.lunch += boxes;
    if (meals.includes('dinner')) result.dinner += boxes;
  }
  return result;
}

export function addBoxMeals(a: BoxMeals, b: BoxMeals): BoxMeals {
  return {
    total: a.total + b.total,
    breakfast: a.breakfast + b.breakfast,
    lunch: a.lunch + b.lunch,
    dinner: a.dinner + b.dinner,
  };
}

/** First and last day of the month containing `dateISO`. */
export function monthBounds(dateISO: string): { from: string; to: string; label: string } {
  const d = parseISO(dateISO);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: toISO(first),
    to: toISO(last),
    label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  };
}

/** Human label for a scope's date button, matching the reference wording. */
export function scopeLabel(scope: Scope, fromISO: string, toISO: string): string {
  if (scope === 'month') return monthBounds(fromISO).label;
  if (scope === 'day') return formatDate(fromISO);
  return `${formatDate(fromISO)} → ${formatDate(toISO)}`;
}

/** Does a payment date fall inside an inclusive window? */
export function withinRange(dateISO: string | null | undefined, fromISO: string, toISO: string): boolean {
  if (!dateISO) return false;
  return dateISO >= fromISO && dateISO <= toISO;
}
