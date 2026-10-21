'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, User, Target, Utensils, CalendarDays, IndianRupee,
  Plus, X, CheckCircle2, Loader2, AlertTriangle, UserPlus,
} from 'lucide-react';

type GoalKey = 'loss' | 'gain' | 'muscle' | 'maintenance';
type PlanKey = 'trial' | 'package';
type ScheduleKey = 'mon_fri' | 'mon_sat';
type MealKey = 'breakfast' | 'lunch' | 'dinner';

const GOALS: { key: GoalKey; label: string }[] = [
  { key: 'loss', label: 'Weight Loss' },
  { key: 'gain', label: 'Weight Gain' },
  { key: 'muscle', label: 'Muscle Gain' },
  { key: 'maintenance', label: 'Healthy Meal' },
];

const MEALS: { key: MealKey; label: string; hint: string; defaultTime: string }[] = [
  { key: 'breakfast', label: 'Breakfast', hint: 'Morning start', defaultTime: '8:00 AM' },
  { key: 'lunch', label: 'Lunch', hint: 'Midday main', defaultTime: '12:30 PM' },
  { key: 'dinner', label: 'Dinner', hint: 'Evening meal', defaultTime: '7:30 PM' },
];

const PLANS: { key: PlanKey; label: string; hint: string; max: number }[] = [
  { key: 'trial', label: 'Trial Plan', hint: '1–6 days', max: 6 },
  { key: 'package', label: 'Package Plan', hint: '1–26 days', max: 26 },
];

const SCHEDULES: { key: ScheduleKey; label: string; hint: string; offDays: number[] }[] = [
  { key: 'mon_fri', label: 'Monday – Friday', hint: 'Sat & Sun off', offDays: [0, 6] },
  { key: 'mon_sat', label: 'Monday – Saturday', hint: 'Sunday off', offDays: [0] },
];

const TIME_RE = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(am|pm)$/i;

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (iso: string) => new Date(`${iso}T00:00:00`);
const todayISO = () => toISO(new Date());
const formatDate = (iso: string) => {
  if (!iso) return '-';
  const d = parseISO(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Walk the calendar from `start`, counting only delivery days: weekdays allowed
// by the chosen schedule that are not skipped. The end date is the `duration`-th
// delivery day, so a skip date pushes it forward only when that date would have
// been a delivery day — exactly what the live summary promises.
function computeEndDate(startISO: string, duration: number, scheduleKey: ScheduleKey, skips: string[]) {
  const off = SCHEDULES.find((s) => s.key === scheduleKey)?.offDays ?? [0, 6];
  const skipped = new Set(skips);
  if (!startISO || !duration || duration < 1) return '';
  const cursor = parseISO(startISO);
  if (Number.isNaN(cursor.getTime())) return '';
  let counted = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (!off.includes(cursor.getDay()) && !skipped.has(toISO(cursor))) {
      counted += 1;
      if (counted === duration) return toISO(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return '';
}

export default function NewClientPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  // Client details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Goal
  const [goal, setGoal] = useState<GoalKey | ''>('');

  // Meals & delivery time
  const [meals, setMeals] = useState<Record<MealKey, boolean>>({
    breakfast: false,
    lunch: true,
    dinner: false,
  });
  const [mealTimes, setMealTimes] = useState<Record<MealKey, string>>({
    breakfast: '8:00 AM',
    lunch: '12:30 PM',
    dinner: '7:30 PM',
  });

  // Plan, duration & schedule
  const [plan, setPlan] = useState<PlanKey>('trial');
  const [duration, setDuration] = useState(3);
  const [scheduleKey, setScheduleKey] = useState<ScheduleKey>('mon_fri');
  const [startDate, setStartDate] = useState(todayISO());
  const [skipDraft, setSkipDraft] = useState('');
  const [skipDates, setSkipDates] = useState<string[]>([]);

  // Payment
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Submission state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingPhones, setExistingPhones] = useState<string[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem('fuelbox_token') || '');
    const auth = { Authorization: `Bearer ${localStorage.getItem('fuelbox_token') || ''}` };
    const load = async () => {
      try {
        const [cRes, eRes] = await Promise.all([
          fetch('/api/customers', { headers: auth }),
          fetch('/api/roles/sales/enquiries', { headers: auth }),
        ]);
        const rows: string[] = [];
        if (cRes.ok) {
          const list: any[] = await cRes.json();
          list.forEach((c) => rows.push(String(c.phone || '').replace(/\D/g, '').slice(-10)));
        }
        if (eRes.ok) {
          const list: any[] = await eRes.json();
          list.forEach((e) => rows.push(String(e.phone || '').replace(/\D/g, '').slice(-10)));
        }
        setExistingPhones(rows.filter(Boolean));
      } catch {
        // duplicate check degrades gracefully — the API-side upsert still protects the customer row
      }
    };
    load();
  }, []);

  const planMeta = PLANS.find((p) => p.key === plan)!;
  const scheduleMeta = SCHEDULES.find((s) => s.key === scheduleKey)!;
  const boxesPerDay = MEALS.filter((m) => meals[m.key]).length;
  const endDate = useMemo(
    () => computeEndDate(startDate, duration, scheduleKey, skipDates),
    [startDate, duration, scheduleKey, skipDates],
  );
  const totalNum = Number(total) || 0;
  const paidNum = Number(paid) || 0;
  const balance = Math.max(0, totalNum - paidNum);
  const totalBoxes = boxesPerDay * duration;

  // Once a client is saved, return to the Clients dashboard so the new row is
  // visible in the table. The success card stays long enough to be read, and the
  // "View Clients" button offers an immediate jump.
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => router.push('/admin/roles/sales'), 2500);
    return () => window.clearTimeout(t);
  }, [saved, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    const clean = phone.replace(/\D/g, '');
    if (!name.trim()) e.name = 'Client name is required';
    if (!/^[6-9]\d{9}$/.test(clean)) e.phone = 'Enter a valid 10-digit mobile number';
    else if (existingPhones.includes(clean)) e.phone = 'A client with this mobile number already exists';
    if (!address.trim()) e.address = 'Delivery address is required';
    if (!goal) e.goal = 'Choose a goal for this client';
    if (boxesPerDay < 1) e.meals = 'Select at least one meal';
    MEALS.forEach((m) => {
      if (meals[m.key] && !TIME_RE.test(mealTimes[m.key].trim())) {
        e[`time_${m.key}`] = `Enter a time like ${m.defaultTime}`;
      }
    });
    if (!planMeta) e.plan = 'Choose a plan';
    if (!Number.isInteger(duration) || duration < 1 || duration > planMeta.max) {
      e.duration = `Duration must be between 1 and ${planMeta.max} days`;
    }
    if (!startDate) e.startDate = 'Start date is required';
    if (skipDates.some((s) => startDate && s < startDate)) {
      e.skipDates = 'Skip dates must be on or after the start date';
    }
    if (startDate && duration >= 1 && !endDate) {
      e.startDate = 'Plan does not fit the schedule — check start date, duration and skips';
    }
    if (!(totalNum > 0)) e.total = 'Total amount must be greater than ₹0';
    if (paidNum < 0) e.paid = 'Paid amount cannot be negative';
    if (totalNum > 0 && paidNum > totalNum) e.paid = 'Paid amount cannot exceed the total amount';
    if (balance > 0 && !dueDate) e.dueDate = 'Balance due date is required while a balance is pending';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving || saved) return;
    setFormError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setFormError('Please fix the highlighted fields before creating the client.');
      return;
    }

    setSaving(true);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const chosen = MEALS.filter((m) => meals[m.key]);
    const timeSlot = chosen.map((m) => `${m.label} ${mealTimes[m.key].trim()}`).join(' · ');
    const scheduleNote = [
      `${planMeta.label} · ${duration} delivery ${duration === 1 ? 'day' : 'days'}`,
      `${scheduleMeta.label} (${scheduleMeta.hint})`,
      `Start ${formatDate(startDate)}`,
      `End ${formatDate(endDate)}`,
      skipDates.length ? `Skip ${skipDates.map(formatDate).join(', ')}` : '',
      `${boxesPerDay} ${boxesPerDay === 1 ? 'box' : 'boxes'}/day`,
      balance > 0 && dueDate ? `Balance ₹${balance.toLocaleString('en-IN')} due ${formatDate(dueDate)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    try {
      // 1. Shared `customers` row (same table onboarding writes to) — the API
      //    upserts by phone, so re-submitting can never duplicate the client.
      const cRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          goal,
          freq: boxesPerDay,
          meal_plan_price: totalNum,
          meal_plan_packages: [{ name: `${planMeta.label} · ${duration} days`, days: duration, price: totalNum }],
        }),
      });
      if (!cRes.ok) {
        const j = await cRes.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to save client details');
      }

      // 2. Sales enquiry row: address, payment, delivery schedule.
      const eRes = await fetch('/api/roles/sales/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: name.trim(),
          phone: cleanPhone,
          address: address.trim(),
          goal,
          meals_per_day: boxesPerDay,
          enquiry_date: todayISO(),
          total_amount: totalNum,
          paid_amount: paidNum,
          payment_method: 'cash',
          next_payment_date: dueDate || null,
          sales_status: 'follow_up',
          delivery_time_slot: timeSlot,
          special_instructions: scheduleNote,
        }),
      });
      if (!eRes.ok) {
        const j = await eRes.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to save payment and schedule details');
      }

      // 3. TFBC client row — the single source of truth the Clients page reads.
      //    Best-effort: the shared customer/enquiry rows above are already the
      //    canonical Sales record, so a duplicate-mobile client row is not fatal.
      const clientRes = await fetch('/api/roles/sales/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          address: address.trim(),
          goal,
          plan_type: plan,
          duration_days: duration,
          boxes_per_day: boxesPerDay,
          meals: chosen.map((m) => ({ key: m.key, label: m.label, time: mealTimes[m.key].trim() })),
          schedule: scheduleKey,
          start_date: startDate,
          skip_dates: skipDates,
          total_amount: totalNum,
          paid_amount: paidNum,
          balance_due_date: dueDate || null,
        }),
      });
      if (!clientRes.ok && clientRes.status !== 409) {
        const j = await clientRes.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create the client record');
      }

      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err?.message || 'Something went wrong while saving the client. Please try again.');
      setSaving(false);
    }
  };

  const err = (key: string) =>
    errors[key] ? (
      <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> {errors[key]}
      </p>
    ) : null;
  const inputCls = (key: string) =>
    `w-full px-3 py-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
      errors[key] ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
    }`;
  const chipCls = (selected: boolean) =>
    `px-4 py-3 rounded-xl border-2 text-sm font-bold text-left transition ${
      selected
        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40'
    }`;

  if (saved) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-emerald-200 p-8 md:p-10 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Client created</h1>
          <p className="text-sm text-gray-500 mt-2">
            <span className="font-bold text-gray-800">{name}</span> was saved with{' '}
            {planMeta.label} · {duration} {duration === 1 ? 'day' : 'days'} · {totalBoxes}{' '}
            {totalBoxes === 1 ? 'box' : 'boxes'} · {formatDate(startDate)} to {formatDate(endDate)}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Link
              href="/admin/roles/sales"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm min-h-[44px]"
            >
              View Clients
            </Link>
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setSaving(false);
                setErrors({});
                setName('');
                setPhone('');
                setAddress('');
                setGoal('');
                setDuration(3);
                setStartDate(todayISO());
                setSkipDates([]);
                setSkipDraft('');
                setTotal('');
                setPaid('');
                setDueDate('');
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Create another client
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/roles/sales"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Clients
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            New Client
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Onboard a new meal box client with goal, meals, plan and payment.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Client details ─────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Client details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Client name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Arjun Kumar"
                  className={inputCls('name')}
                />
                {err('name')}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputCls('phone')}
                />
                {err('phone')}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Delivery address *</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Flat / street / area / landmark"
                  rows={2}
                  className={inputCls('address')}
                />
                {err('address')}
              </div>
            </div>
          </section>

          {/* ── Step 1 · Goal ─────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <p className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 inline-block mb-2">
              STEP 1
            </p>
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" /> Choose your goal
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGoal(g.key)}
                  className={chipCls(goal === g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {err('goal')}
          </section>

          {/* ── Step 2 · Meals & delivery time ─────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <p className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 inline-block mb-2">
              STEP 2
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-blue-600" /> Meals &amp; delivery time
              </h2>
              <span className="text-xs font-black text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5">
                {boxesPerDay} {boxesPerDay === 1 ? 'box' : 'boxes'} / day
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MEALS.map((m) => (
                <div
                  key={m.key}
                  className={`rounded-xl border-2 p-4 transition ${
                    meals[m.key]
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMeals({ ...meals, [m.key]: !meals[m.key] })}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{m.label}</span>
                      <span className="block text-[11px] text-gray-500 mt-0.5">{m.hint}</span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        meals[m.key] ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      {meals[m.key] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                  {meals[m.key] ? (
                    <div className="mt-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Delivery time
                      </label>
                      <input
                        type="text"
                        value={mealTimes[m.key]}
                        onChange={(e) => setMealTimes({ ...mealTimes, [m.key]: e.target.value })}
                        placeholder={`HH:MM AM/PM e.g. ${m.defaultTime}`}
                        className={inputCls(`time_${m.key}`)}
                      />
                      {err(`time_${m.key}`)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {err('meals')}
          </section>

          {/* ── Step 3 · Plan, duration & schedule ────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <p className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 inline-block mb-2">
              STEP 3
            </p>
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" /> Plan, duration &amp; schedule
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPlan(p.key);
                    // Keep the chosen duration valid for the new plan's range.
                    setDuration((d) => Math.min(d, p.max));
                  }}
                  className={chipCls(plan === p.key)}
                >
                  <span className="block">{p.label}</span>
                  <span className="block text-[11px] font-semibold opacity-70 mt-0.5">{p.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Duration (delivery days)
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: planMeta.max }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`min-w-[38px] h-9 px-2 rounded-lg border-2 text-xs font-black transition ${
                      duration === d
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {err('duration')}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-bold text-gray-700 mb-2">Delivery schedule</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCHEDULES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setScheduleKey(s.key)}
                    className={chipCls(scheduleKey === s.key)}
                  >
                    <span className="block">{s.label}</span>
                    <span className="block text-[11px] font-semibold opacity-70 mt-0.5">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Start date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls('startDate')}
                />
                {err('startDate')}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">End date (auto)</label>
                <div className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                  {endDate ? formatDate(endDate) : '—'}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Skip dates <span className="font-semibold text-gray-400 normal-case">(end date moves forward)</span>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="date"
                  value={skipDraft}
                  min={startDate || undefined}
                  onChange={(e) => setSkipDraft(e.target.value)}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!skipDraft) return;
                    if (startDate && skipDraft < startDate) {
                      setErrors((prev) => ({
                        ...prev,
                        skipDates: 'Skip dates must be on or after the start date',
                      }));
                      return;
                    }
                    if (!skipDates.includes(skipDraft)) {
                      setSkipDates((prev) => [...prev, skipDraft].sort());
                    }
                    setSkipDraft('');
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.skipDates;
                      return next;
                    });
                  }}
                  className="h-[42px] px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {err('skipDates')}
              {skipDates.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {skipDates.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-800"
                    >
                      {formatDate(s)}
                      <button
                        type="button"
                        aria-label={`Remove skip date ${s}`}
                        onClick={() => setSkipDates((prev) => prev.filter((d) => d !== s))}
                        className="w-4 h-4 rounded-full bg-amber-200 hover:bg-amber-300 flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Step 4 · Payment ──────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <p className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 inline-block mb-2">
              STEP 4
            </p>
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" /> Payment
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Total amount (₹) *</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className={inputCls('total')}
                />
                {err('total')}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Paid amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className={inputCls('paid')}
                />
                {err('paid')}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Balance (₹)</label>
                <div className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-black text-gray-900">
                  {balance.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Balance due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls('dueDate')}
                />
                {err('dueDate')}
              </div>
            </div>
          </section>
        </div>

        {/* ── Summary ──────────────────────────────── */}
        <aside className="lg:sticky lg:top-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase mb-4">Summary</p>
            <dl className="space-y-3 text-sm">
              {[
                ['Plan', `${planMeta.label === 'Trial Plan' ? 'Trial' : 'Package'} · ${duration} ${duration === 1 ? 'day' : 'days'}`],
                ['Goal', GOALS.find((g) => g.key === goal)?.label || '—'],
                ['Boxes / day', String(boxesPerDay)],
                ['Total boxes', String(totalBoxes)],
                ['Start', formatDate(startDate)],
                ['End', formatDate(endDate)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 font-semibold">{label}</dt>
                  <dd className="font-bold text-gray-900 text-right truncate">{value}</dd>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {[
                  ['Total', `₹${totalNum.toLocaleString('en-IN')}`],
                  ['Paid', `₹${paidNum.toLocaleString('en-IN')}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 font-semibold">{label}</dt>
                    <dd className="font-bold text-gray-900 text-right">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-700 font-bold">Balance</dt>
                  <dd
                    className={`font-black text-right ${
                      balance > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    ₹{balance.toLocaleString('en-IN')}
                  </dd>
                </div>
              </div>
            </dl>

            {formError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition text-sm shadow-sm min-h-[44px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Create Client
                </>
              )}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}

