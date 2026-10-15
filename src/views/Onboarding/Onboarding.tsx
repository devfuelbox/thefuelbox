import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Home, Utensils, Receipt } from "lucide-react";
import FuelBoxLogo from "@/components/FuelBoxLogo";
import { slideInLeft, slideInRight, EASE_OUT } from "@/lib/motion";

// The 3D fitness backdrop is lazy + client-only so three.js never enters the
// server bundle or the critical rendering path.
const FitnessScene = dynamic(
  () => import("@/components/three/FitnessScene"),
  { ssr: false },
);
import { useAuthStore } from "@/store/authStore";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { onboardingSupabase } from "@/lib/onboardingSupabaseClient";
import { updateUserProfile } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import {
  calculateHealthMetrics,
  type OnboardingAnswers,
} from "@/lib/healthCalculations";
import { belongsToGoal, toGoalCategoryList } from "@/lib/goalCategories";
import {
  buildPlan,
  coverage,
  DEFAULT_ADD_GRAMS,
  type IngredientData,
  kOf,
  pOf,
  cOf,
  fOf,
  fiOf,
  costOf,
  MEAL_ORDER,
  round1,
  type BuiltPlan,
} from "@/lib/mealSolver";
import {
  clampPortion,
  portionBoundsForGoal,
  toGoalPortions,
} from "@/lib/menuPortionLimits";

// ─── FUELBOX ONBOARDING TOKENS (cream + forest, matches the reference) ─
// The tokens keep their original names so every existing helper renders with
// the new palette; only the values changed. `yolk` is the forest primary, and
// the primary button paints its label in `card` (paper) so the contrast holds.
const C = {
  ink: "#111827", // gray-900 – main dark text
  card: "#FFFFFF", // white card bg
  line: "#E5E7EB", // gray-200 – subtle borders
  yolk: "#16A34A", // brand-600 – primary green
  bone: "#111827", // gray-900 – headings
  muted: "#6B7280", // gray-500 – secondary text
  veg: "#16A34A", // brand green
  egg: "#D97706", // amber-600
  nonveg: "#DC2626", // red-600
  energy: "#EA580C", // energy-600 – orange accent
};
const FOREST = "#1F3D2B";
const FOREST_2 = "#2C5540";
const CREAM = "#F3EDDF";
const PAPER = "#FBF8F1";
const TINT = "#E6EEDF"; // soft green fill for selected / protein
const CTA_GREEN = "#1E7A46";
const FONT_DISPLAY = "'Lora', Georgia, 'Times New Roman', serif";
const FONT_BODY =
  "'Work Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ─── BUSINESS CONFIG ─────────────────────────────────────
const WA_NUMBER = "919384302527"; // Ajith
// The Fuel Box, 14 A2, Masakalipalayam Road, Metha Layout, POAD, Peelamedu,
// Coimbatore, Tamil Nadu 641004. Every distance, free/paid zone and delivery
// fee on this page is measured from this one point — the customer's own
// device location is never touched, only the shop it is measured against.
const KITCHEN = { lat: 11.0218943, lng: 77.0172345 };
const FREE_KM = 5;
const MAX_KM = 30; // beyond this: waitlist
const FEE_PER_KM = 10; // ₹ per km after 5km

// ─── FOODS — sourced exclusively from the `menu_items` database table ──
// There is no static food list and no built-in nutrition or price anywhere in
// this file. Every field below is read straight off a `menu_items` row. If the
// table cannot be read, the onboarding reports the error instead of quietly
// substituting built-in data (see `MenuState`).
// The `IngredientData` shape lives in src/lib/mealSolver.ts, the single module
// that both this screen and the automated tests read.

// How the onboarding may use the menu. `error` means the request failed or the
// table came back with nothing usable; there is deliberately no `fallback` case.
type MenuState =
  | { status: "loading" }
  | { status: "ready"; rows: number }
  | { status: "error"; message: string };

// Menu names carry preparation suffixes ("White Rice (cooked)"), so the map key
// is the normalized name: lowercase, parentheticals and punctuation stripped.
// The key therefore comes from `menu_items` too — nothing is invented here.
const normFoodName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// `menu_items.diet` stores 'veg' / 'non_veg'; normalize to the solver's tags.
const dietTag = (diet: unknown): IngredientData["t"] => {
  const d = String(diet ?? "").toLowerCase().replace(/[^a-z]+/g, "");
  if (d === "egg") return "egg";
  if (d === "nonveg" || d === "nonvegetarian") return "nonveg";
  return "veg";
};

// Builds the food map the solver and the pricing read, straight from DB rows.
// Rows without a usable name are skipped; every other column is taken as-is.
const foodsFromRows = (rows: any[]): Record<string, IngredientData> => {
  const ing: Record<string, IngredientData> = {};
  for (const row of rows) {
    const name = String(row?.name ?? "").trim();
    if (!name) continue;
    const key = normFoodName(name);
    if (!key || ing[key]) continue;
    ing[key] = {
      dbId: Number(row.id ?? 0),
      n: name,
      t: dietTag(row.diet),
      k: Number(row.calories ?? 0),
      p: Number(row.protein_g ?? 0),
      c: Number(row.carbs_g ?? 0),
      f: Number(row.fat_g ?? 0),
      fi: Number(row.fiber_g ?? 0),
      price: Number(row.price ?? 0),
      cookable: row.cookable === true,
      category: String(row.category ?? ""),
      gc: toGoalCategoryList(row.goal_categories),
      min: numOrNull(row.min_grams),
      max: numOrNull(row.max_grams),
      gp: toGoalPortions(row.goal_portions),
    };
  }
  return ing;
};

// NULL / empty mean "no limit"; anything else is whole grams.
const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ─── PLAN LOGIC ──────────────────────────────────────────
const GOALS = {
  loss: { label: "Weight loss", sub: "Drop fat, stay full", plan: "LEAN PLAN" },
  gain: {
    label: "Weight gain",
    sub: "Skinny → solid. Make the scale move",
    plan: "FUEL PLAN",
  },
  muscle: {
    label: "Muscle gain",
    sub: "You train. Build shape, not belly",
    plan: "BULK PLAN",
  },
  maintenance: {
    label: "Maintenance",
    sub: "Maintain shape, stay fueled",
    plan: "FIT PLAN",
  },
};
const ACTIVITY = {
  sedentary: { label: "Mostly sitting", sub: "Desk job, little movement" },
  active: { label: "On my feet", sub: "Walking, light activity daily" },
  gym: { label: "Gym regular", sub: "Training 3+ days a week" },
};

// ─── WIZARD INPUTS → ACTIVITY ─────────────────────────────
// The wizard asks one question — what your day is like (workouts removed).
const DAY_OPTS: Record<string, { base: number; label: string; sub: string }> = {
  sit: { base: 1.2, label: "Mostly sitting", sub: "Office, IT, student" },
  feet: { base: 1.35, label: "On my feet a lot", sub: "Shop, teacher, sales" },
  phys: { base: 1.5, label: "Physical work", sub: "Labour, delivery, farm" },
};
// Bucket into the app's three-level key for compatibility.
function activityFromDayWork(day: string | null, _work?: string | null) {
  const base = (day && DAY_OPTS[day]?.base) || 1.2;
  const multiplier = Math.round(base * 1000) / 1000;
  const key: "sedentary" | "active" | "gym" =
    multiplier < 1.2875 ? "sedentary" : multiplier < 1.4625 ? "active" : "gym";
  return { multiplier, key };
}

// Height / weight unit conversions. The app stores cm and kg; the wizard only
// converts at the edges so every calculation stays in metric.
const CM_PER_FT = 30.48;
const KG_PER_LB = 0.45359237;
const round2 = (x: number) => Math.round(x * 100) / 100;

// Dropdown ranges for the body measurements (used by both the selects and the
// step-1 validation so the two can never drift apart).
const AGE_MIN = 18;
const AGE_MAX = 80;
const HEIGHT_MIN = 120;
const HEIGHT_MAX = 220;
const WEIGHT_MIN = 30;
const WEIGHT_MAX = 200;
// A plain decimal number: digits with an optional decimal part. Rejects "70kg",
// "abc" and "1e2" — the same shape the reference calculator accepted.
const NUM_RE = /^\d+(\.\d+)?$/;
const FREQS = {
  1: {
    label: "1 meal a day",
    sub: "Starter · slow & steady",
    speed: 0.4,
    tag: "Slow",
  },
  2: {
    label: "2 meals a day",
    sub: "Serious · solid pace",
    speed: 0.7,
    tag: "Solid",
  },
  3: {
    label: "3 meals a day",
    sub: "Full Fuel · fastest",
    speed: 1.0,
    tag: "Fastest",
  },
};

// ─── PLAN GENERATION ──────────────────────────────────────
// `buildPlan` and `coverage` live in src/lib/mealSolver.ts. They are pure
// functions — the portion limits (min_grams/max_grams) are enforced there, at
// the source, so every meal here is already inside the configured windows and
// the totals are recomputed from the actual chosen grams.

function timeline(goal: string | null, freq: number) {
  const f = FREQS[freq as keyof typeof FREQS].speed;
  if (goal === "loss") {
    const m = Math.ceil((5 / (1.5 * f)) * 2) / 2;
    return { big: `~${m} months`, sub: "to your first −5 kg" };
  }
  if (goal === "gain") {
    const m = Math.ceil((4 / (1.2 * f)) * 2) / 2;
    return { big: `~${m} months`, sub: "to a solid +4 kg" };
  }
  const w = Math.ceil(12 / f);
  return { big: `~${w} weeks`, sub: "to visible muscle" };
}

// Grams are solved on a 0.1g grid; show one decimal only when needed so
// whole portions stay clean ("150g", "158.2g").
const fmtG = (g: number) => {
  const r = Math.round(g * 10) / 10;
  return Number.isInteger(r) ? `${r}` : r.toFixed(1);
};

// Groups a 10-digit mobile as "98765 43210" for display only; state stays raw.
const fmtPhone = (d: string) =>
  d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d;

// Quantities render in grams — the solver's unit — so a portion size is never
// guessed from a hardcoded table. The allowed serving window itself comes from
// `menu_items` min_grams/max_grams; the planner clamps to it.
const fmtQty = (_ing: Record<string, IngredientData>, it: any) => `${fmtG(it.g)}g`;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371,
    toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat),
    dLng = toR(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function zoneFor(km: number) {
  if (km <= FREE_KM) return { zone: "free", fee: 0 };
  if (km <= MAX_KM)
    return { zone: "paid", fee: Math.ceil(km - FREE_KM) * FEE_PER_KM };
  return { zone: "out", fee: null };
}

interface LocState {
  status: string;
  km: number | null;
  fee: number | null;
  lat: number | null;
  lng: number | null;
}

function FoodMark({ type, size = 14 }: { type: string; size?: number }) {
  const color = type === "veg" ? C.veg : type === "egg" ? C.egg : C.nonveg;
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
        flexShrink: 0,
      }}
      aria-label={type}
    >
      {type === "nonveg" ? (
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${size * 0.28}px solid transparent`,
            borderRight: `${size * 0.28}px solid transparent`,
            borderBottom: `${size * 0.48}px solid ${color}`,
          }}
        />
      ) : (
        <span
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: "50%",
            background: color,
          }}
        />
      )}
    </span>
  );
}

function useCountUp(target: number, duration = 1300) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return val;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 11,
        letterSpacing: "0.22em",
        color: C.yolk,
        textTransform: "uppercase",
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: "clamp(30px, 8vw, 40px)",
        color: C.bone,
        lineHeight: 1.05,
        textTransform: "uppercase",
        letterSpacing: "0.01em",
        margin: "0 0 24px",
      }}
    >
      {children}
    </h2>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  sub,
  mark,
  right,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  mark?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left"
      whileTap={{ scale: 0.985 }}
      whileHover={selected ? undefined : { y: -1 }}
      animate={selected ? { scale: 1.01 } : { scale: 1 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      style={{
        background: selected ? "rgba(22,163,74,0.08)" : C.card,
        border: `1.5px solid ${selected ? C.yolk : C.line}`,
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 10,
        cursor: "pointer",
        transition: "border-color 160ms, background 160ms",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {mark}
      <span style={{ flex: 1 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 16,
            color: C.bone,
          }}
        >
          {title}
        </span>
        {sub && (
          <span
            style={{
              display: "block",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.muted,
              marginTop: 3,
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {right || (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2px solid ${selected ? C.yolk : C.line}`,
            background: selected ? C.yolk : "transparent",
            transition: "all 160ms",
          }}
        />
      )}
    </motion.button>
  );
}

function Slider({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        className="flex items-end justify-between"
        style={{ marginBottom: 8 }}
      >
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 34,
            color: C.yolk,
            lineHeight: 1,
          }}
        >
          {value}
          <span
            style={{
              fontSize: 15,
              color: C.muted,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: C.yolk, height: 26 }}
      />
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="w-full"
      whileHover={disabled || reduce ? undefined : { y: -2 }}
      whileTap={disabled || reduce ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      style={{
        background: disabled ? C.line : C.yolk,
        color: disabled ? C.muted : PAPER,
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: 16,
        border: "none",
        borderRadius: 12,
        padding: "15px",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.01em",
        transition: "background 150ms, transform 120ms",
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── 2-STEP WIZARD HELPERS (cream + forest, matches the reference) ──
// These lay out the wizard controls only — every value and handler still comes
// from the same state and constants as before. No logic is defined here.

// A labelled field with an optional inline hint, a right-aligned action (used
// for the cm/ft and kg/lb unit toggles) and an error line.
function WzField({
  label,
  opt,
  error,
  action,
  children,
}: {
  label: string;
  opt?: string;
  error?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 14,
            color: C.ink,
          }}
        >
          {label}
          {opt && (
            <span style={{ fontWeight: 400, color: C.muted }}> {opt}</span>
          )}
        </label>
        {action}
      </div>
      {children}
      {error && (
        <p
          role="alert"
          style={{
            color: C.nonveg,
            fontSize: 13,
            margin: "6px 0 0",
            fontFamily: FONT_BODY,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// A compact cm/ft or kg/lb switch that sits on the field's label row.
function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: `1.5px solid ${C.line}`,
        borderRadius: 999,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <motion.button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            whileTap={{ scale: 0.98 }}
            whileHover={on ? undefined : { y: -1 }}
            animate={on ? { scale: 1.01 } : { scale: 1 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            style={{
              padding: "3px 12px",
              border: 0,
              cursor: "pointer",
              background: on ? FOREST : "transparent",
              color: on ? PAPER : C.muted,
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// Segmented single-select. `stack` renders full-width, left-aligned rows with a
// sub-label (used for "What's your day like?"); otherwise a grid of pills.
function Seg<T extends string | number>({
  value,
  options,
  onChange,
  columns = 2,
  stack = false,
}: {
  value: T | null | undefined;
  options: Array<{ value: T; label: string; sub?: string }>;
  onChange: (v: T) => void;
  columns?: number;
  stack?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: stack ? "1fr" : `repeat(${columns}, 1fr)`,
        gap: 8,
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.985 }}
            whileHover={{ y: on ? 0 : -1 }}
            animate={on ? { scale: 1.01 } : { scale: 1 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            style={{
              textAlign: stack ? "left" : "center",
              padding: stack ? "12px 14px" : "11px 8px",
              border: `1.5px solid ${on ? FOREST : C.line}`,
              borderRadius: 10,
              background: on ? FOREST : "#fff",
              color: on ? PAPER : C.ink,
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: on ? 600 : 500,
              cursor: "pointer",
              lineHeight: 1.25,
              transition: "background 150ms, border-color 150ms",
            }}
          >
            <span style={{ display: "block" }}>{o.label}</span>
            {o.sub && (
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  opacity: 0.78,
                  marginTop: 2,
                }}
              >
                {o.sub}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Dropdown for age / height / weight. Stores a number; 0 renders the placeholder
// option. Options run min..max inclusive in `step` increments (0.5 for the
// decimal measurements). Whole values show without a trailing .0.
function NumSelect({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  placeholder: string;
  suffix?: string;
}) {
  const opts: number[] = [];
  const count = Math.round((max - min) / step);
  for (let k = 0; k <= count; k++) {
    opts.push(Math.round((min + k * step) * 10) / 10);
  }
  const label = (n: number) => {
    const s = Number.isInteger(n) ? `${n}` : n.toFixed(1);
    return suffix ? `${s} ${suffix}` : s;
  };
  return (
    <select
      value={value ? String(value) : ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? 0 : Number(e.target.value))
      }
      style={{
        width: "100%",
        padding: "12px",
        paddingRight: 36,
        fontFamily: FONT_BODY,
        fontSize: 16,
        border: `1.5px solid ${C.line}`,
        borderRadius: 10,
        background: "#fff",
        color: value ? C.ink : C.muted,
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235E6A61' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      <option value="">{placeholder}</option>
      {opts.map((n) => (
        <option key={n} value={n}>
          {label(n)}
        </option>
      ))}
    </select>
  );
}

function StepTag({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: FOREST_2,
        margin: "0 0 6px",
      }}
    >
      {children}
    </p>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 600,
        fontSize: "clamp(20px, 5vw, 24px)",
        color: FOREST,
        margin: "0 0 14px",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

// ─── SINGLE-PAGE FORM LAYOUT HELPERS ─────────────────────
// The quiz used to be one question per screen. It is now a single table-style
// page, so these helpers only lay the EXISTING fields out — every option, value
// and handler still comes from the same constants and state as before. No
// calculation, validation or data shape is defined here.
function SectionTitle({
  step,
  children,
}: {
  step: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 8,
        padding: "16px 16px 6px",
        borderTop: `1px solid ${C.line}`,
        background: "rgba(22,163,74,0.04)",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: C.yolk,
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: 11,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {step}
      </span>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.bone,
        }}
      >
        {children}
      </span>
    </div>
  );
}

// One table-style row: the field label sits to the left on desktop and stacks
// above the control on small screens.
function FieldRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center"
      style={{
        gap: 10,
        padding: "14px 16px",
        borderTop: `1px solid ${C.line}`,
      }}
    >
      <div className="sm:flex-shrink-0" style={{ width: "100%", maxWidth: 180 }}>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 14,
            color: C.bone,
          }}
        >
          {title}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: C.muted,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <div className="flex-1" style={{ minWidth: 0, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

// Compact single-select buttons — the table's cell control. The selected style
// matches the old option cards (green tint + green border) so the brand look is
// unchanged.
function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = "grid-cols-2 sm:grid-cols-4",
}: {
  options: Array<{
    value: T;
    label: string;
    sub?: string;
    mark?: React.ReactNode;
  }>;
  value: T | null | undefined;
  onChange: (v: T) => void;
  columns?: string;
}) {
  return (
    <div className={`grid ${columns}`} style={{ gap: 8 }}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className="text-left"
            whileTap={{ scale: 0.985 }}
            whileHover={selected ? undefined : { y: -1 }}
            animate={selected ? { scale: 1.01 } : { scale: 1 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            style={{
              background: selected ? "rgba(22,163,74,0.10)" : "#fff",
              border: `1.5px solid ${selected ? C.yolk : C.line}`,
              borderRadius: 12,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: FONT_BODY,
              fontSize: 14,
              fontWeight: 600,
              color: selected ? C.yolk : C.bone,
              transition: "border-color 160ms, background 160ms",
            }}
          >
            <span className="flex items-center" style={{ gap: 8 }}>
              {o.mark}
              <span>{o.label}</span>
            </span>
            {o.sub && (
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: selected ? C.yolk : C.muted,
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                {o.sub}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Slider + live value, used for age / height / weight in the table rows. Same
// range inputs and bounds as the original sliders.
function RangeField({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: C.yolk, height: 26, minWidth: 0 }}
      />
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 20,
          color: C.yolk,
          minWidth: 66,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
        <span style={{ fontSize: 13, color: C.muted, fontFamily: FONT_BODY }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

// Plain text input styled to sit in a table cell.
function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  name,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  maxLength?: number;
  name?: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full"
      style={{
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: 600,
        color: C.bone,
        padding: "12px 14px",
        border: `1.5px solid ${C.line}`,
        borderRadius: 10,
        background: "#fff",
        outline: "none",
      }}
    />
  );
}

// ─── RESULT SCREEN (top-level, not nested in Onboarding) ─
// Hoisting this out means its `vary`/`freq` state survives any re-render of
// the parent Onboarding component — a nested definition would get a new
// function identity on every parent render and React would remount it,
// silently resetting the user's picks.
function Result({
  a,
  loc,
  ing,
  menu,
  saveStep,
  setLoc,
  dayLabel,
}: {
  a: OnboardingAnswers;
  loc: LocState;
  ing: Record<string, IngredientData>;
  menu: MenuState;
  saveStep: (next: number, updatedAnswers?: OnboardingAnswers) => void;
  setLoc: (loc: LocState) => void;
  dayLabel?: string;
}) {
  const navigate = useNavigate();
  const [vary, setVary] = useState(0);
  const [freq, setFreq] = useState(a.freq || 1);

  // The effective goal key — the same one the solver and the per-goal portion
  // windows resolve against (a goal without its own limits inherits the
  // default min/max of each food).
  const goalKey = a.goal || "loss";

  // The foods offered for the goal this user picked. A food qualifies when it
  // has no goal categories (uncategorized — how every item starts) or when its
  // list includes the selected goal (see belongsToGoal). This same set drives
  // the auto-built plan and the "add food" dropdown, so the meals on screen
  // are always made of the foods the user's goal is supposed to show.
  const goalFoods = useMemo(() => {
    const keys = new Set<string>();
    for (const [id, d] of Object.entries(ing)) {
      if (belongsToGoal(d.gc, goalKey)) keys.add(id);
    }
    return keys;
  }, [ing, goalKey]);

  const plan = buildPlan(a, vary, ing, goalFoods);

  const [customPlan, setCustomPlan] = useState<any>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    setCustomPlan(plan);
  }, [vary, ing, goalFoods]);

  const planToUse = customPlan || plan;
  const cov = coverage(planToUse, freq, ing, a.preferredSlots);
  const tl = timeline(a.goal, freq);
  const metrics = calculateHealthMetrics(a);
  const n = useCountUp(metrics.proteinG);
  const waitlist = loc.status === "out";
  const delivFee =
    loc.status === "free" ? 0 : loc.status === "paid" ? loc.fee : null;

  const kcalOfMeal = (m: any) =>
    Math.round(
      m.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0),
    );
  const protOfMeal = (m: any) =>
    Math.round(
      m.items.reduce((s: number, it: any) => s + pOf(ing, it.id, it.g), 0),
    );
  // Fat is the one macro a whole gram can hide, so it is carried at 0.1 g all
  // the way up: the food's own share, the meal's total, and the day's total are
  // summed from the same figures and never rounded twice.
  const fatOfMeal = (m: any) =>
    round1(
      m.items.reduce(
        (s: number, it: any) => s + round1(fOf(ing, it.id, it.g)),
        0,
      ),
    );
  const delKcal = cov.delMeals.reduce(
    (s: number, m: any) => s + kcalOfMeal(m),
    0,
  );

  // ─── FIXED TARGET vs SELECTED NUTRITION ───
  const [foodSearch, setFoodSearch] = useState("");
  const fixedTarget = useMemo(() => ({
    calories: metrics.goalCalories,
    protein: metrics.proteinG,
    carbs: metrics.carbsG,
    fat: metrics.fatG,
    fiber: metrics.fiberG,
  }), [metrics.goalCalories, metrics.proteinG, metrics.carbsG, metrics.fatG, metrics.fiberG]);
  const selectedNutrition = useMemo(() => {
    const items = cov.delMeals.flatMap((m: any) => m.items);
    const calories = Math.round(items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0));
    const protein = Math.round(items.reduce((s: number, it: any) => s + pOf(ing, it.id, it.g), 0));
    const carbs = Math.round(items.reduce((s: number, it: any) => s + cOf(ing, it.id, it.g), 0));
    // Fat: each food's share (grams/100 x fat_g) is kept to 0.1 g, the meals
    // add those up, and the day adds the meals — so the three levels on screen
    // always total each other exactly, and updates propagate straight through.
    const fat = round1(
      cov.delMeals.reduce((s: number, m: any) => s + fatOfMeal(m), 0),
    );
    const fiber = Math.round(items.reduce((s: number, it: any) => s + fiOf(ing, it.id, it.g), 0) * 10) / 10;
    return { calories, protein, carbs, fat, fiber };
  }, [cov.delMeals, ing]);
  const remaining = useMemo(() => ({
    calories: fixedTarget.calories - selectedNutrition.calories,
    protein: fixedTarget.protein - selectedNutrition.protein,
    carbs: fixedTarget.carbs - selectedNutrition.carbs,
    fat: fixedTarget.fat - selectedNutrition.fat,
    fiber: Math.round((fixedTarget.fiber - selectedNutrition.fiber) * 10) / 10,
  }), [fixedTarget, selectedNutrition]);

  // ─── PER-MEAL CALORIE LIMIT (fixed, reusable) ───
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  // Each meal's own share of the daily target (daily ÷ 3, remainder split
  // across the first meals) — the exact number the solver hit, so limits
  // shown and enforced match the plan to the calorie.
  const perMealKcalOf = useCallback((mealName: string) => {
    const t = (planToUse as any).mealTargets?.[mealName];
    return typeof t?.kcal === "number" ? t.kcal : Math.round(fixedTarget.calories / MEAL_ORDER.length);
  }, [planToUse, fixedTarget.calories]);
  const perMealProteinOf = useCallback((mealName: string) => {
    const t = (planToUse as any).mealTargets?.[mealName];
    return typeof t?.protein === "number" ? t.protein : Math.round(fixedTarget.protein / MEAL_ORDER.length);
  }, [planToUse, fixedTarget.protein]);
  const canAddToMeal = useCallback((mealName: string, itemId: string) => {
    const meal = planToUse.meals.find((m: any) => m.name === mealName);
    const current = meal ? Math.round(meal.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0)) : 0;
    // The same clamp the solver applies: the "add" dropdown always previews the
    // portion it would actually add, never an amount below/above the food's limits.
    const d = ing[itemId];
    const grams = d ? clampPortion(DEFAULT_ADD_GRAMS, portionBoundsForGoal({ min_grams: d.min, max_grams: d.max, goal_portions: d.gp }, goalKey)) : DEFAULT_ADD_GRAMS;
    const foodKcal = Math.round(kOf(ing, itemId, grams));
    return current + foodKcal <= perMealKcalOf(mealName);
  }, [planToUse.meals, ing, perMealKcalOf, goalKey]);

  const bmiLine = () => {
    const b = metrics.bmi.toFixed(1);
    if (a.goal === "loss" && metrics.bmi >= 25)
      return `BMI ${b} — meals stay filling but calorie-smart. You'll never feel like you're dieting.`;
    if (a.goal === "gain" && metrics.bmi < 18.5)
      return `BMI ${b} — clean surplus. Real food calories, zero junk.`;
    if (a.goal === "muscle")
      return `BMI ${b} — protein does the building. We do the cooking.`;
    return `BMI ${b} — dialed to your body, not a template.`;
  };

  const waLink = () => {
    const mealsTxt = planToUse.meals
      .map(
        (m: any) =>
          `${cov.delNames.includes(m.name) ? "🟨" : "▫️"} ${m.name}: ${m.items.map((it: any) => `${ing[it.id].n} ${fmtQty(ing, it)}`).join(", ")}`,
      )
      .join("\n");
    const locTxt =
      loc.km != null
        ? `Location: ${loc.km} km from The Fuel Box, Peelamedu (maps.google.com/?q=${loc.lat},${loc.lng}) — ${loc.status === "free" ? "FREE delivery" : loc.status === "paid" ? `delivery ₹${loc.fee}/day` : "outside zone (waitlist)"}`
        : "Location: will confirm on WhatsApp";
    const msg =
      `Hi Ajith! ${waitlist ? "WAITLIST — outside 30km.\n" : ""}FuelBox plan for ${a.name}:\n` +
      `Goal: ${a.goal ? GOALS[a.goal].label : ""} (${a.goal ? GOALS[a.goal].plan : ""}) · ${a.food} · ${FREQS[freq as keyof typeof FREQS].label}\n` +
      `Target: ${planToUse.protT}g protein · ~${planToUse.kcalT} kcal/day\n` +
      `FuelBox covers: ${cov.delProt}g/day (🟨 = FuelBox delivers)\n\n${mealsTxt}\n\n` +
      `Food ₹${cov.price}/day${delivFee != null ? ` + delivery ₹${delivFee}/day` : " + delivery TBD"}\n` +
      `26-day pack ≈ ₹${(cov.price + (delivFee || 0)) * 26}\n` +
      `Timeline: ${tl.big} ${tl.sub}\n${locTxt}\nPhone: ${a.phone}`;
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const recalculatePlan = (updatedMeals: any[]) => {
    const flatItems: Array<{ id: string; g: number }> = [];
    updatedMeals.forEach((m) => {
      m.items.forEach((it: any) => {
        const existing = flatItems.find((x) => x.id === it.id);
        if (existing) {
          existing.g += it.g;
        } else {
          flatItems.push({ id: it.id, g: it.g });
        }
      });
    });

    const protein = Math.round(
      flatItems.reduce((s, it) => s + pOf(ing, it.id, it.g), 0),
    );
    const kcal = Math.round(
      flatItems.reduce((s, it) => s + kOf(ing, it.id, it.g), 0),
    );

    return {
      ...planToUse,
      meals: updatedMeals,
      items: flatItems,
      protein,
      kcal,
    };
  };

  const handleRemoveItem = (mealName: string, itemId: string) => {
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== mealName) return m;
      return { ...m, items: m.items.filter((it: any) => it.id !== itemId) };
    });
    setCustomPlan(recalculatePlan(updatedMeals));
  };

  const handleAddItem = (mealName: string, itemId: string) => {
    const d = ing[itemId];
    if (!d) return;
    // The food's configured window (when set) clamps the default serving, so a
    // manual addition is always a legal portion — never below min, never past max.
    const bounds = portionBoundsForGoal({ min_grams: d.min, max_grams: d.max, goal_portions: d.gp }, goalKey);
    const defaultQty = clampPortion(DEFAULT_ADD_GRAMS, bounds);
    const targetMeal = mealName || cov.delNames[0] || planToUse.meals[0]?.name;
    if (!targetMeal) return;
    const targetMealObj = planToUse.meals.find((m: any) => m.name === targetMeal);
    if (targetMealObj?.items.some((it: any) => it.id === itemId)) {
      showToast("Food already added");
      return;
    }
    const current = targetMealObj ? Math.round(targetMealObj.items.reduce((s: number, it: any) => s + kOf(ing, it.id, it.g), 0)) : 0;
    const foodKcal = Math.round(kOf(ing, itemId, defaultQty));
    const lim = perMealKcalOf(targetMeal);
    if (current + foodKcal > lim) {
      showToast(`Calorie limit reached — You can only add food up to ${lim} kcal for this meal.`);
      return;
    }
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== targetMeal) return m;
      return {
        ...m,
        items: [...m.items, { id: itemId, g: defaultQty }],
      };
    });
    setCustomPlan(recalculatePlan(updatedMeals));
  };

  const handleOrderOnWhatsApp = async () => {
    // Validation BEFORE DB save/API request: block empty meal plan
    const totalDeliveredItems = cov.delMeals.reduce((s: number, m: any) => s + m.items.length, 0);
    const totalDeliveredCalories = cov.delMeals.reduce(
      (s: number, m: any) => s + m.items.reduce((x: number, it: any) => x + kOf(ing, it.id, it.g), 0),
      0,
    );
    const totalFoodItems = planToUse.meals.reduce((s: number, m: any) => s + m.items.length, 0);
    if (totalDeliveredItems === 0 || totalDeliveredCalories === 0 || totalFoodItems === 0) {
      showToast("Please select at least one food item before placing the order.");
      return;
    }

    setIsOrdering(true);
    setOrderError("");

    // Save only the FuelBox-delivered meals (based on the user's chosen meal
    // count/slots), so admin views show exactly what was ordered — not the
    // full 3-meal day.
    const deliveredPlan = {
      ...planToUse,
      meals: cov.delMeals,
      items: cov.delMeals.flatMap((m: any) => m.items),
      protein: cov.delProt,
      kcal: Math.round(
        cov.delMeals.reduce(
          (s: number, m: any) =>
            s +
            m.items.reduce(
              (x: number, it: any) => x + kOf(ing, it.id, it.g),
              0,
            ),
          0,
        ),
      ),
    };

    try {
      // Save customer + final (possibly customized) plan to DB
      const delivPerDay = delivFee || 0;
      const packages = [
        { name: "5-day trial", days: 5, price: Math.round((cov.price + delivPerDay) * 5) },
        { name: "26-day pack", days: 26, price: Math.round((cov.price + delivPerDay) * 26) },
      ];
      const res = await fetch("/api/onboarding/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: a.name,
          phone: a.phone,
          email: a.email,
          goal: a.goal,
          age: a.age,
          gender: a.gender,
          height: a.height,
          weight: a.weight,
          food: a.food,
          activity: a.activity,
          freq,
          loc_status: loc.status,
          loc_km: loc.km,
          loc_fee: loc.fee,
          loc_lat: loc.lat,
          loc_lng: loc.lng,
          meal_plan: deliveredPlan,
          meal_plan_price: packages[1].price,
          meal_plan_packages: packages,
        }),
      });
    } catch (err: any) {
      console.error("[Order] Failed to save customer to DB:", err);
      // Non-blocking — still open WhatsApp even if DB write fails
    }

    // Open WhatsApp
    window.open(waLink(), "_blank");
    setIsOrdering(false);
  };

  // One line under the sticker title: gender · age · height · weight · day.
  // Prefer the exact day label the user tapped, falling back to the activity label.
  const activityLine = dayLabel
    ? dayLabel
    : a.activity
      ? ACTIVITY[a.activity].label
      : "";
  const detailsLine = [
    a.gender || "",
    a.age ? `${a.age} yrs` : "",
    a.height ? `${a.height} cm` : "",
    a.weight ? `${a.weight} kg` : "",
    activityLine,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div key="s9" style={{ paddingTop: 12 }}>
      {/* `menu_items` is the only food source. If it could not be read, say so
          instead of showing a plan built from nothing. */}
      {menu.status === "error" && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 15,
            color: C.nonveg,
            background: "#FEE2E2",
            border: "1px solid #FECACA",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 24,
          }}
        >
          <strong>Menu unavailable.</strong> We could not load foods from the
          menu_items table ({menu.message}). Your plan and price cannot be
          calculated until it is reachable — please reload to try again.
        </div>
      )}

      <Eyebrow>Here's your number</Eyebrow>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 15,
          color: C.muted,
          lineHeight: 1.5,
          margin: "0 0 16px",
        }}
      >
        {bmiLine()}
      </p>

      {a.goal === "loss" && metrics.bmi < 18.5 && (
        <div
          style={{
            background: "rgba(232,185,49,0.08)",
            border: `1.5px solid ${C.egg}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.bone,
              lineHeight: 1.55,
            }}
          >
            Brother, honestly — at BMI {metrics.bmi.toFixed(1)} you don't need
            weight loss. Your real glow-up is{" "}
            <b style={{ color: C.yolk }}>muscle gain</b>. Retake the quiz and
            pick it — same price range, way better mirror results.
          </div>
        </div>
      )}

      {/* The bordered "timeline + speed" card used to sit here. Its pace headline
          and its "FuelBox delivers …" summary were removed earlier, which left
          an empty 20px-padded box on the screen at 3 meals, so the container is
          gone too. The two things it still carried are kept, unframed, in its
          place: the self-cooked meal note and the "add a meal" control. */}
      {cov.selfMeals.length > 0 && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.muted,
            marginBottom: 14,
          }}
        >
          {cov.selfMeals.map((m: any) => m.name).join(" + ")} from your side
          (list on WhatsApp)
        </div>
      )}

      {freq < 3 && (
        <button
          onClick={() => setFreq(freq + 1)}
          className="w-full"
          style={{
            marginTop: 14,
            marginBottom: 14,
            background: C.yolk,
            color: C.ink,
            border: "none",
            borderRadius: 10,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 14,
            padding: "12px",
            cursor: "pointer",
          }}
        >
          ⚡ Cut my timeline — add a meal
        </button>
      )}

      {/* RESULT — FuelBox sticker card (daily kcal + macros) */}
      <div
        className="card-anim"
        style={{
          background: PAPER,
          border: `2px solid ${FOREST}`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: FOREST,
            color: PAPER,
            padding: "16px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <span
            style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 17 }}
          >
            {a.name ? `${a.name}, your daily fuel` : "Your daily fuel"}
          </span>
          <span style={{ fontSize: 13, opacity: 0.85, fontFamily: FONT_BODY }}>
            {a.goal ? GOALS[a.goal].label : ""}
          </span>
        </div>
        {detailsLine && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.ink,
              padding: "10px 18px",
              margin: 0,
              borderBottom: `1px solid ${C.line}`,
              background: "#fff",
            }}
          >
            {detailsLine}
          </p>
        )}
        <div
          style={{
            padding: 18,
            borderBottom: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <b
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 48,
              lineHeight: 1,
              color: FOREST,
            }}
          >
            {fixedTarget.calories.toLocaleString("en-IN")}
          </b>
          <span style={{ color: C.muted, fontFamily: FONT_BODY }}>
            kcal per day
          </span>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          {[
            { k: "Protein", v: `${fixedTarget.protein} g`, on: true },
            { k: "Carbs", v: `${fixedTarget.carbs} g`, on: false },
            { k: "Fat", v: `${fixedTarget.fat} g`, on: false },
            { k: "Fiber", v: `${fixedTarget.fiber} g`, on: false },
          ].map((t, i, arr) => (
            <div
              key={t.k}
              className={`card-anim stagger-${i + 1}`}
              style={{
                padding: "14px 6px",
                textAlign: "center",
                borderRight:
                  i < arr.length - 1 ? `1px solid ${C.line}` : "none",
                background: t.on ? TINT : "transparent",
              }}
            >
              <b
                style={{
                  display: "block",
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  color: FOREST,
                }}
              >
                {t.v}
              </b>
              <span
                style={{ fontSize: 13, color: C.muted, fontFamily: FONT_BODY }}
              >
                {t.k}
              </span>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.muted,
            padding: "12px 18px",
            borderTop: `1px solid ${C.line}`,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Your body burns about {Math.round(metrics.tdee).toLocaleString("en-IN")}{" "}
          kcal a day at this activity level.{" "}
          {a.goal === "loss"
            ? "This target sets a gentle deficit for steady fat loss."
            : a.goal === "maintenance"
              ? "This target holds your current weight."
              : "This target adds a surplus to support gain."}
        </p>
      </div>

      {/* PRICE + DELIVERY CARD */}
      {/* <div
        style={{
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 14,
        }}
      >
        <div className="flex items-start justify-between flex-col">
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 26,
                color: C.bone,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              {a.goal ? GOALS[a.goal].plan : ""}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: C.muted,
                marginTop: 5,
              }}
            >
              ~{delKcal} kcal FuelBox meals · ~{planToUse.kcal} kcal full day
              · 🟨 = FuelBox delivers
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 24,
                color: C.yolk,
                lineHeight: 1,
              }}
            >
              ₹{cov.price}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11,
                color: C.muted,
                marginTop: 3,
              }}
            >
              food / day
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: C.line, margin: "16px 0" }} />

        {planToUse.limitWarning && (
          <div
            className="card-anim stagger-1"
            style={{
              background: "rgba(183,121,31,0.08)",
              border: `1.5px solid ${C.egg}`,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: C.bone,
              lineHeight: 1.5,
            }}
          >
            <b style={{ color: C.egg }}>Portion limits applied. </b>
            {planToUse.limitWarning}
          </div>
        )}

        <div
          className="flex items-center justify-between card-anim stagger-2"
          style={{ marginBottom: 4 }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            Delivery{loc.km != null ? ` · ${loc.km} km` : ""}
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: delivFee === 0 ? C.veg : C.yolk,
            }}
          >
            {waitlist
              ? "—"
              : delivFee === 0
                ? "FREE ✓"
                : delivFee != null
                  ? `₹${delivFee}/day`
                  : "on WhatsApp"}
          </span>
        </div>
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 4 }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            5-day trial
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            ≈ ₹{((cov.price + (delivFee || 0)) * 5).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between card-anim stagger-4">
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.bone,
            }}
          >
            26-day pack
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: 700,
              color: C.yolk,
            }}
          >
            ≈ ₹{((cov.price + (delivFee || 0)) * 26).toLocaleString("en-IN")}
          </span>
        </div>
        {planToUse.protein < planToUse.protT - 8 && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: C.muted,
              lineHeight: 1.5,
              marginTop: 10,
            }}
          >
            Honest note: pure-veg foods max out at ~{planToUse.protein}g/day —
            we've packed the maximum. Quality protein, no fake numbers.
          </div>
        )}
      </div> */}

      {/* <button
        onClick={() => setVary((v) => v + 1)}
        className="w-full"
        style={{
          background: "transparent",
          border: `1.5px solid ${C.line}`,
          borderRadius: 12,
          color: C.bone,
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 700,
          padding: "13px",
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        ↻ Mix the foods differently
      </button> */}

      {orderError && (
        <div
          style={{
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.nonveg,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {orderError}
        </div>
      )}

      <PrimaryBtn onClick={handleOrderOnWhatsApp} disabled={isOrdering}>
        {isOrdering ? "Opening WhatsApp..." : "Order this plan on WhatsApp"}
      </PrimaryBtn>

      {/* Go To Home — navigate to /home; Home page shows OTP + account setup for new users */}
      {/* <button onClick={() => navigate(ROUTES.HOME, { state: { triggerOtp: true, phone: a.phone, pendingReg: true, pendingName: a.name } })} className="w-full" style={{
        marginTop: 10, background: "transparent", border: `1.5px solid ${C.yolk}`, borderRadius: 12,
        color: C.yolk, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700,
        padding: "13px", cursor: "pointer",
      }}>
        🏠 Go To Home
      </button> */}

      <div
        style={{
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          margin: "18px 0 0",
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.bone,
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: C.yolk }}>Balanced by design.</b> Your box isn't
          protein alone — rice, chapati, veg and fruit come with it, so you get
          fiber and energy too. Targets stay inside safe limits.
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.6,
            marginTop: 6,
          }}
        >
          Have kidney issues, diabetes, or are pregnant? Please check with your
          doctor before starting.
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: C.bone,
          fontWeight: 700,
          textAlign: "center",
          margin: "18px 0 4px",
        }}
      >
        We know brother — you can do this. Namma achieve pannuvom. 💪
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          color: C.muted,
          textAlign: "center",
          lineHeight: 1.5,
          margin: "10px 0 4px",
        }}
      >
        Timelines are estimates from standard nutrition math, assuming strict
        diet + regular home workout. Not medical advice.
      </div>

      {/* Back to step 1 so details can be edited (matches the reference). */}
      <button
        type="button"
        onClick={() => saveStep(1)}
        style={{
          display: "block",
          margin: "18px auto 0",
          background: "none",
          border: 0,
          color: FOREST,
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "underline",
          cursor: "pointer",
          padding: 8,
        }}
      >
        ↩ Change my details
      </button>

      {/* Toast for meal calorie limit */}
      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: C.bone, color: "#fff", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, padding: "12px 16px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 9999, maxWidth: "90vw", textAlign: "center", lineHeight: 1.4 }}>
          {toast.includes(" — ") ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: 2 }}>{toast.split(" — ")[0]}</div>
              <div style={{ fontWeight: 500, fontSize: 12, opacity: 0.9 }}>{toast.split(" — ")[1]}</div>
            </>
          ) : (
            <div>{toast}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const loggedInUser = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [a, setA] = useState<OnboardingAnswers>({
    goal: null,
    // 0 renders as empty so the field shows its "e.g." placeholder; step 1
    // requires a real value before continuing and calculateHealthMetrics already
    // falls back to sane defaults for 0.
    age: 0,
    gender: null,
    height: 0,
    weight: 0,
    food: null,
    activity: null,
    freq: null,
    name: "",
    email: "",
    phone: "",
    preferredSlots: [],
  });

  const [loc, setLoc] = useState<LocState>({
    status: "idle",
    km: null,
    fee: null,
    lat: null,
    lng: null,
  });
  const [sessionId, setSessionId] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizationError, setFinalizationError] = useState("");
  // "What's your day like?" is UI-only (not part of OnboardingAnswers);
  // it sets `activity` / `activityMultiplier`.
  const [day, setDay] = useState<string | null>(null);
  const [work, setWork] = useState<string | null>(null);
  // Height / weight are typed in the chosen unit; the canonical value stays in
  // cm / kg on `a` so every calculation is metric.
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  // Raw text for the three measured fields so the exact typed value can be
  // validated (blank / not a number / not whole / out of range). The numeric
  // mirror still lives in `a` for the calculation and the plan.
  const [ageStr, setAgeStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [weightStr, setWeightStr] = useState("");
  // Per-field errors, keyed by field, all shown together on Calculate.
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Transient toasts. Every validation error also pops here as a toast while the
  // inline message under each field stays put.
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const set = (k: keyof OnboardingAnswers, v: any) =>
    setA((p) => ({ ...p, [k]: v }));

  // Day sets the exact activity multiplier (workouts removed).
  useEffect(() => {
    const { multiplier, key } = activityFromDayWork(day, null);
    setA((p) =>
      p.activity === key && p.activityMultiplier === multiplier
        ? p
        : { ...p, activity: key, activityMultiplier: multiplier },
    );
  }, [day]);
  const chooseDay = (k: string) => setDay(k);
  const chooseWork = (_k: string) => setWork(null);
  // Clear one field's error as soon as the user edits that field.
  const clearError = (k: string) =>
    setErrors((p) => (p[k] ? { ...p, [k]: "" } : p));

  // Age accepts digits and a single decimal point only — letters never land in
  // the field, so age can only ever be a number (or a blank/incomplete entry).
  const onAgeChange = (v: string) => {
    let s = v.replace(/[^0-9.]/g, "");
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    setAgeStr(s);
    set("age", NUM_RE.test(s.trim()) ? Number(s.trim()) : 0);
    clearError("age");
  };
  const heightToCm = (s: string) => {
    const t = s.trim();
    if (!NUM_RE.test(t)) return 0;
    const n = Number(t);
    return heightUnit === "ft" ? round2(n * CM_PER_FT) : n;
  };
  const weightToKg = (s: string) => {
    const t = s.trim();
    if (!NUM_RE.test(t)) return 0;
    const n = Number(t);
    return weightUnit === "lb" ? round2(n * KG_PER_LB) : n;
  };
  const onHeightChange = (v: string) => {
    setHeightStr(v);
    set("height", heightToCm(v));
    clearError("height");
  };
  const onWeightChange = (v: string) => {
    setWeightStr(v);
    set("weight", weightToKg(v));
    clearError("weight");
  };
  const changeHeightUnit = (u: "cm" | "ft") => {
    if (u === heightUnit) return;
    const cm = heightToCm(heightStr);
    setHeightStr(
      cm ? String(u === "ft" ? round2(cm / CM_PER_FT) : round1(cm)) : "",
    );
    setHeightUnit(u);
    clearError("height");
  };
  const changeWeightUnit = (u: "kg" | "lb") => {
    if (u === weightUnit) return;
    const kg = weightToKg(weightStr);
    setWeightStr(
      kg ? String(u === "lb" ? round1(kg / KG_PER_LB) : round1(kg)) : "",
    );
    setWeightUnit(u);
    clearError("weight");
  };

  // Every rule, checked together so all errors can be shown at once. Nothing is
  // calculated unless this returns an empty set.
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!a.gender) e.gender = "Please select your gender.";
    const ageS = ageStr.trim();
    const ageN = NUM_RE.test(ageS) ? Number(ageS) : NaN;
    if (isNaN(ageN) || ageN % 1 !== 0 || ageN > AGE_MAX) {
      e.age = "Please enter your age in whole years (18–80).";
    } else if (ageN < AGE_MIN) {
      e.age = "FuelBox plans are for adults 18+.";
    }
    const cm = heightToCm(heightStr);
    if (!cm || cm < HEIGHT_MIN || cm > HEIGHT_MAX) {
      e.height = "Please enter a height between 120 and 220 cm.";
    }
    const kg = weightToKg(weightStr);
    if (!kg || kg < WEIGHT_MIN || kg > WEIGHT_MAX) {
      e.weight = "Please enter a weight between 30 and 200 kg.";
    }
    if (!day) e.day = "Please select what your day is like.";
    if (!a.goal) e.goal = "Please select your goal.";
    if (!a.food) e.food = "Please select your food preference.";
    if (a.freq === null) e.freq = "Please select your meals per day.";
    else if ((a.preferredSlots || []).length !== a.freq)
      e.slots = `Pick ${a.freq} meal${a.freq > 1 ? "s" : ""} a day.`;
    return e;
  };

  const handleStep1 = () => {
    const e = validateStep1();
    setErrors(e);
    const msgs = Object.values(e).filter(Boolean);
    if (msgs.length) {
      // Mirror every error as a toast (replacing any toasts from a prior attempt).
      setToasts([]);
      msgs.forEach((m) => pushToast(m));
      return;
    }
    saveStep(2);
  };

  // Check for goal query param or path on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const goalParam = urlParams.get("goal");
      if (
        goalParam === "loss" ||
        goalParam === "gain" ||
        goalParam === "muscle" ||
        goalParam === "maintenance"
      ) {
        setA((prev) => ({ ...prev, goal: goalParam as any }));
        setStep(1);
        // Clear query parameters from URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, []);

  // The food map, built exclusively from the `menu_items` rows. Empty until the
  // fetch lands, and left empty on failure — there is no built-in food list to
  // fall back to, which is exactly why `menu` carries the error for the UI.
  const [ing, setIng] = useState<Record<string, IngredientData>>({});
  const [menu, setMenu] = useState<MenuState>({ status: "loading" });

  // `menu_items` is the single source of truth for names, nutrition and prices.
  useEffect(() => {
    let cancelled = false;
    const loadDbFoods = async () => {
      try {
        const res = await fetch("/api/menu");
        if (!res.ok) {
          throw new Error(`Menu request failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Menu response was not a list of menu_items rows");
        }
        const next = foodsFromRows(data);
        const count = Object.keys(next).length;
        if (count === 0) {
          throw new Error("No available items in menu_items");
        }
        if (cancelled) return;
        setIng(next);
        setMenu({ status: "ready", rows: count });
      } catch (err: any) {
        if (cancelled) return;
        // Surface it rather than quietly reverting to built-in foods.
        console.warn("Failed to load menu_items:", err);
        setIng({});
        setMenu({
          status: "error",
          message: err?.message || "Could not load the food menu",
        });
      }
    };
    loadDbFoods();
    return () => {
      cancelled = true;
    };
  }, []);

  // Onboarding always starts fresh: any in-progress state left behind by an
  // earlier build (or a previous visit) is purged on mount. Only the final,
  // explicitly-required handoff keys are ever written (see handleFinalize).
  useEffect(() => {
    try {
      localStorage.removeItem("fuelbox_onboarding_session_id");
      localStorage.removeItem("fuelbox_onboarding_step");
      localStorage.removeItem("fuelbox_onboarding_answers");
    } catch (_) {}
  }, []);

  // Save progress step-by-step to the NEW database
  const saveStep = async (nextStep: number, updatedAnswers = a) => {
    let curSessionId = sessionId;

    // Step 0 -> 1 transition triggers initial insert
    if (!curSessionId) {
      curSessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
      setSessionId(curSessionId);

      // Fire-and-forget insert if configured
      if (onboardingSupabase?.from) {
        onboardingSupabase
          .from("onboarding_progress")
          .insert({
            id: curSessionId,
            status: "in_progress",
            current_step: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .then(({ error }: any) => {
            if (error)
              console.warn(
                "Failed to create onboarding session in new DB:",
                error,
              );
          })
          .catch(() => {});
      }
    }

    setStep(nextStep);

    // Update in new DB if configured — log result for verification
    if (onboardingSupabase?.from) {
      onboardingSupabase
        .from("onboarding_progress")
        .update({
          current_step: nextStep,
          goal: updatedAnswers.goal,
          age: updatedAnswers.age,
          gender: updatedAnswers.gender,
          height: updatedAnswers.height,
          weight: updatedAnswers.weight,
          food: updatedAnswers.food,
          activity: updatedAnswers.activity,
          freq: updatedAnswers.freq,
          loc_status: loc.status,
          loc_km: loc.km,
          loc_fee: loc.fee,
          loc_lat: loc.lat,
          loc_lng: loc.lng,
          name: updatedAnswers.name,
          phone: updatedAnswers.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", curSessionId)
        .select()
        .then(({ data, error }: any) => {
          if (error) console.error("[DB] ❌ Step update failed:", error);
          else console.log(`[DB] ✅ Step ${nextStep} saved:`, data);
        })
        .catch(() => {});
    }
  };

  const pick = (k: keyof OnboardingAnswers, v: any, next: number) => {
    const updated = { ...a, [k]: v };
    setA(updated);
    setTimeout(() => saveStep(next, updated), 260);
  };

  // Meals-per-day and slot selection now live on the single page. The logic is
  // identical to the old Step 6: picking N meals pre-selects the default slots
  // (all three at 3 meals, none below) and slots toggle within the limit.
  const chooseFreq = (num: number) => {
    const defaultSlots = num === 3 ? [...MEAL_ORDER] : [];
    setA((prev) => ({ ...prev, freq: num, preferredSlots: defaultSlots }));
  };

  const toggleSlot = (slot: string) => {
    setA((prev) => {
      let slots = [...(prev.preferredSlots || [])];
      const freq = prev.freq || 1;
      if (slots.includes(slot)) {
        slots = slots.filter((s) => s !== slot);
      } else if (freq === 1) {
        slots = [slot];
      } else if (slots.length < freq) {
        slots.push(slot);
      } else {
        slots.shift();
        slots.push(slot);
      }
      return { ...prev, preferredSlots: slots };
    });
  };

  const askLocation = () => {
    setLoc((p) => ({ ...p, status: "loading" }));
    if (!navigator.geolocation) {
      setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const km = haversineKm(here, KITCHEN);
        const z = zoneFor(km);
        setLoc({
          status: z.zone,
          km: Math.round(km * 10) / 10,
          fee: z.fee,
          lat: here.lat,
          lng: here.lng,
        });
      },
      () => {
        setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const phoneOk = /^[6-9]\d{9}$/.test(a.phone);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim());

  // The single-page form is submittable only when every required choice is made
  // — the same gates the old per-step Next buttons enforced.
  const formComplete =
    phoneOk &&
    emailOk &&
    !!a.name.trim() &&
    !!a.goal &&
    !!a.gender &&
    !!a.food &&
    !!a.activity &&
    a.freq !== null &&
    (a.preferredSlots || []).length === a.freq;

  // The live target shown (blurred) on step 2 — the same figure Result renders.
  const previewMetrics = calculateHealthMetrics(a);

  // Handle "Get My Plan" — only generates and displays the plan (no DB write, no WhatsApp)
  const handleFinalize = async () => {
    if (!phoneOk || !a.name.trim() || !emailOk) return;
    setIsFinalizing(true);
    setFinalizationError("");

    try {
      // Save step 8 details to onboarding session
      await saveStep(8);

      // ─── Supabase profile sync if already logged in ───
      const oldSupabase = getSupabaseClient();
      if (loggedInUser && oldSupabase) {
        const mappedGoal =
          a.goal === "loss"
            ? "weight_loss"
            : a.goal === "gain"
              ? "weight_gain"
              : a.goal === "muscle"
                ? "muscle_gain"
                : "maintenance";
        const mappedDiet =
          a.food === "veg"
            ? "vegetarian"
            : a.food === "egg"
              ? "eggetarian"
              : "non_vegetarian";

        await updateUserProfile({
          full_name: a.name,
          phone: a.phone,
          gender: a.gender?.toLowerCase() as any,
          height: a.height,
          weight: a.weight,
          fitness_goal: mappedGoal as any,
          diet_type: mappedDiet as any,
        });
      }

      try {
        const cleanPhone = a.phone.replace(/\D/g, "");
        localStorage.setItem(
          "fuelbox_pending_reg",
          JSON.stringify({ name: a.name, phone: cleanPhone || a.phone }),
        );
        localStorage.setItem(
          "fuelbox_onboarding_answers_final",
          JSON.stringify(a),
        );
      } catch (_) {}

      // Show the results / meal plan screen
      setStep(9);
    } catch (err: any) {
      console.error("Finalization failed:", err);
      setFinalizationError(
        err.message ||
          "Failed to finalize. Please check details and try again.",
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const screen = () => {
    switch (step) {
      case 0:
        return (
          <div key="s0" style={{ paddingTop: 48 }}>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: C.muted,
                marginBottom: 6,
              }}
            >
              we don't count{" "}
              <span
                style={{
                  textDecoration: "line-through",
                  textDecorationColor: C.yolk,
                  textDecorationThickness: 2,
                }}
              >
                meals
              </span>
              .
            </div>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                textTransform: "uppercase",
                fontSize: "clamp(52px, 15vw, 84px)",
                lineHeight: 0.95,
                color: C.bone,
                margin: "0 0 18px",
              }}
            >
              We count
              <br />
              <span style={{ color: C.yolk }}>protein.</span>
            </h1>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 32,
              }}
            >
              60 seconds. One plan built on your exact daily protein number —
              cooked and delivered in Coimbatore. Fuel your decision.
            </p>
            <PrimaryBtn onClick={() => saveStep(1)}>
              Find my number →
            </PrimaryBtn>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: C.muted,
                textAlign: "center",
                marginTop: 14,
              }}
            >
              Free plan · No signup · Order on WhatsApp
            </div>
          </div>
        );

      case 1:
        return (
          <div key="s1">
            <StepTag>Step 1 of 2</StepTag>
            <StepTitle>Tell us about you</StepTitle>
            <div
              style={{
                background: PAPER,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: 20,
              }}
            >
              <WzField label="Your name">
                <TextField
                  name="name"
                  autoComplete="name"
                  value={a.name}
                  onChange={(v) => set("name", v)}
                  placeholder="e.g. Rahul"
                />
              </WzField>

              <WzField label="Gender" error={errors.gender}>
                <Seg
                  value={a.gender}
                  onChange={(v) => {
                    set("gender", v);
                    clearError("gender");
                  }}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                  ]}
                />
              </WzField>

              <WzField label="Age" error={errors.age}>
                <TextField
                  value={ageStr}
                  onChange={onAgeChange}
                  placeholder="e.g. 26"
                  inputMode="numeric"
                  maxLength={3}
                />
              </WzField>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <WzField
                  label={`Height (${heightUnit})`}
                  error={errors.height}
                  action={
                    <UnitToggle
                      value={heightUnit}
                      onChange={changeHeightUnit}
                      options={[
                        { value: "cm", label: "cm" },
                        { value: "ft", label: "ft" },
                      ]}
                    />
                  }
                >
                  <TextField
                    value={heightStr}
                    onChange={onHeightChange}
                    placeholder={heightUnit === "cm" ? "e.g. 172.5" : "e.g. 5.66"}
                    inputMode="decimal"
                    maxLength={6}
                  />
                </WzField>
                <WzField
                  label={`Weight (${weightUnit})`}
                  error={errors.weight}
                  action={
                    <UnitToggle
                      value={weightUnit}
                      onChange={changeWeightUnit}
                      options={[
                        { value: "kg", label: "kg" },
                        { value: "lb", label: "lb" },
                      ]}
                    />
                  }
                >
                  <TextField
                    value={weightStr}
                    onChange={onWeightChange}
                    placeholder={weightUnit === "kg" ? "e.g. 70.5" : "e.g. 155"}
                    inputMode="decimal"
                    maxLength={6}
                  />
                </WzField>
              </div>

              <WzField label="What's your day like?" error={errors.day}>
                <Seg
                  stack
                  value={day}
                  onChange={(v) => {
                    chooseDay(v);
                    clearError("day");
                  }}
                  options={Object.entries(DAY_OPTS).map(([k, d]) => ({
                    value: k,
                    label: d.label,
                    sub: d.sub,
                  }))}
                />
              </WzField>

              {/* Workouts per week removed per request */}

              <WzField label="Your goal" error={errors.goal}>
                <Seg
                  value={a.goal}
                  onChange={(v) => {
                    set("goal", v);
                    clearError("goal");
                  }}
                  options={[
                    { value: "loss", label: "Weight loss" },
                    { value: "maintenance", label: "Maintenance" },
                    { value: "muscle", label: "Muscle gain" },
                    { value: "gain", label: "Weight gain" },
                  ]}
                />
              </WzField>

              <WzField label="Food preference" error={errors.food}>
                <Seg
                  columns={3}
                  value={a.food}
                  onChange={(v) => {
                    set("food", v);
                    clearError("food");
                  }}
                  options={[
                    { value: "veg", label: "Pure veg" },
                    { value: "egg", label: "Veg + egg" },
                    { value: "nonveg", label: "Non-veg" },
                  ]}
                />
              </WzField>

              <WzField label="Meals a day" error={errors.freq}>
                <Seg
                  columns={3}
                  value={a.freq}
                  onChange={(v) => {
                    chooseFreq(v as number);
                    clearError("freq");
                    clearError("slots");
                  }}
                  options={[
                    { value: 1, label: "1 meal" },
                    { value: 2, label: "2 meals" },
                    { value: 3, label: "3 meals" },
                  ]}
                />
              </WzField>

              {a.freq !== null && (
                <WzField
                  label="Which meals"
                  opt={`(choose ${a.freq})`}
                  error={errors.slots}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                    }}
                  >
                    {MEAL_ORDER.map((slot) => {
                      const on = (a.preferredSlots || []).includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => toggleSlot(slot)}
                          style={{
                            padding: "11px 8px",
                            border: `1.5px solid ${on ? FOREST : C.line}`,
                            borderRadius: 10,
                            background: on ? FOREST : "#fff",
                            color: on ? PAPER : C.ink,
                            fontFamily: FONT_BODY,
                            fontSize: 15,
                            fontWeight: on ? 600 : 500,
                            cursor: "pointer",
                            transition: "background 150ms, border-color 150ms",
                          }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </WzField>
              )}

              <PrimaryBtn onClick={handleStep1}>Calculate my numbers</PrimaryBtn>
            </div>
          </div>
        );

      case 2:
        return (
          <div key="s2">
            <StepTag>Step 2 of 2</StepTag>
            <StepTitle>Your numbers are ready</StepTitle>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#fff",
                border: `1.5px solid ${C.line}`,
                borderRadius: 12,
                overflow: "hidden",
                margin: "0 0 18px",
              }}
            >
              <div style={{ padding: "14px 10px", textAlign: "center" }}>
                <b
                  style={{
                    display: "block",
                    fontFamily: FONT_DISPLAY,
                    fontSize: 30,
                    lineHeight: 1.1,
                    color: FOREST,
                    filter: "blur(7px)",
                    userSelect: "none",
                  }}
                >
                  {previewMetrics.goalCalories}
                </b>
                <span style={{ fontSize: 13, color: C.muted }}>
                  kcal per day
                </span>
              </div>
              <div
                style={{
                  padding: "14px 10px",
                  textAlign: "center",
                  background: TINT,
                  borderLeft: `1.5px solid ${C.line}`,
                }}
              >
                <b
                  style={{
                    display: "block",
                    fontFamily: FONT_DISPLAY,
                    fontSize: 30,
                    lineHeight: 1.1,
                    color: FOREST,
                    filter: "blur(7px)",
                    userSelect: "none",
                  }}
                >
                  {previewMetrics.proteinG}
                </b>
                <span style={{ fontSize: 13, color: C.muted }}>protein g</span>
              </div>
            </div>

            <div
              style={{
                background: PAPER,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: 20,
              }}
            >
              <WzField label="Your WhatsApp number to unlock them">
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0 12px",
                      border: `1.5px solid ${C.line}`,
                      borderRight: 0,
                      borderRadius: "10px 0 0 10px",
                      background: CREAM,
                      fontWeight: 600,
                      color: C.ink,
                      fontFamily: FONT_BODY,
                      fontSize: 15,
                    }}
                  >
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={fmtPhone(a.phone)}
                    onChange={(e) =>
                      set(
                        "phone",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    placeholder="98765 43210"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "12px",
                      border: `1.5px solid ${C.line}`,
                      borderLeft: 0,
                      borderRadius: "0 10px 10px 0",
                      background: "#fff",
                      color: C.ink,
                      fontFamily: FONT_BODY,
                      fontSize: 18,
                      letterSpacing: "0.06em",
                      fontWeight: 500,
                      outline: "none",
                    }}
                  />
                </div>
              </WzField>

              <WzField label="Your email">
                <TextField
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={a.email}
                  onChange={(v) => set("email", v)}
                  placeholder="you@example.com"
                />
              </WzField>

              <WzField label="Delivery location">
                {loc.status === "idle" || loc.status === "loading" ? (
                  <div>
                    <button
                      type="button"
                      onClick={askLocation}
                      disabled={loc.status === "loading"}
                      className="w-full"
                      style={{
                        background: "#fff",
                        border: `1.5px solid ${FOREST}`,
                        borderRadius: 10,
                        color: FOREST,
                        fontFamily: FONT_BODY,
                        fontSize: 15,
                        fontWeight: 600,
                        padding: "13px",
                        cursor: loc.status === "loading" ? "wait" : "pointer",
                        opacity: loc.status === "loading" ? 0.6 : 1,
                      }}
                    >
                      {loc.status === "loading"
                        ? "Getting your location…"
                        : "📍 Use my current location"}
                    </button>
                    <p
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        color: C.muted,
                        margin: "6px 0 0",
                      }}
                    >
                      Helps us confirm we can deliver to you.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      background:
                        loc.status === "free" || loc.status === "paid"
                          ? TINT
                          : "#fff",
                      borderRadius: 10,
                      padding: "12px 14px",
                      border: `1.5px solid ${
                        loc.status === "out"
                          ? C.nonveg
                          : loc.status === "free"
                            ? C.veg
                            : C.line
                      }`,
                    }}
                  >
                    {loc.status === "free" && (
                      <>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontWeight: 700,
                            fontSize: 14,
                            color: C.ink,
                          }}
                        >
                          You're {loc.km} km from our kitchen ✓
                        </div>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontSize: 13,
                            color: C.veg,
                            marginTop: 2,
                            fontWeight: 700,
                          }}
                        >
                          FREE delivery for you
                        </div>
                      </>
                    )}
                    {loc.status === "paid" && (
                      <>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontWeight: 700,
                            fontSize: 14,
                            color: C.ink,
                          }}
                        >
                          You're {loc.km} km away
                        </div>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontSize: 13,
                            color: FOREST_2,
                            marginTop: 2,
                            fontWeight: 700,
                          }}
                        >
                          Delivery ₹{loc.fee}/day (₹{FEE_PER_KM}/km after{" "}
                          {FREE_KM} km)
                        </div>
                      </>
                    )}
                    {loc.status === "out" && (
                      <>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontWeight: 700,
                            fontSize: 14,
                            color: C.ink,
                          }}
                        >
                          You're {loc.km} km out — just past our {MAX_KM} km ring
                          💔
                        </div>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontSize: 12,
                            color: C.muted,
                            marginTop: 2,
                            lineHeight: 1.5,
                          }}
                        >
                          We're Coimbatore-only for now. Drop your details —
                          you're first in line when we expand.
                        </div>
                      </>
                    )}
                    {(loc.status === "denied" || loc.status === "skip") && (
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 12,
                          color: C.muted,
                          lineHeight: 1.5,
                        }}
                      >
                        No problem — we'll confirm your delivery location on
                        WhatsApp.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={askLocation}
                      style={{
                        marginTop: 8,
                        background: "none",
                        border: 0,
                        padding: 0,
                        color: FOREST,
                        fontFamily: FONT_BODY,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      {loc.status === "denied" || loc.status === "skip"
                        ? "Try my location again"
                        : "Use my location instead"}
                    </button>
                  </div>
                )}
              </WzField>

              {finalizationError && (
                <p
                  role="alert"
                  style={{
                    color: C.nonveg,
                    background: "rgba(163,54,31,0.08)",
                    border: `1px solid ${C.nonveg}`,
                    borderRadius: 10,
                    padding: 10,
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    margin: "0 0 12px",
                  }}
                >
                  {finalizationError}
                </p>
              )}

              <PrimaryBtn
                onClick={handleFinalize}
                disabled={!formComplete || isFinalizing}
              >
                {isFinalizing ? "Loading…" : "Show my numbers"}
              </PrimaryBtn>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  display: "block",
                  margin: "12px auto 0",
                  background: "none",
                  border: 0,
                  color: FOREST,
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 6,
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        );

      case 9:
        return (
          <Result
            a={a}
            loc={loc}
            ing={ing}
            menu={menu}
            saveStep={saveStep}
            setLoc={setLoc}
            dayLabel={day ? DAY_OPTS[day]?.label : ""}
          />
        );
      default:
        return null;
    }
  };

  const prevStepRef = useRef(step);
  const dir = step >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        position: "relative",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap');
        .anim { animation: fadeUp 360ms cubic-bezier(0.16, 0.8, 0.2, 1) both; }
        .anim-delayed { animation: fadeUp 360ms cubic-bezier(0.16, 0.8, 0.2, 1) both; animation-delay: 80ms; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .toast { animation: toastIn 220ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-12px) scale(0.98); } to { opacity: 1; transform: none; } }
        .seg input+label { transition: all 160ms cubic-bezier(0.16, 0.8, 0.2, 1); will-change: transform, background-color, border-color; }
        .seg input:checked+label { transform: scale(1.02); box-shadow: 0 4px 12px -4px rgba(31,61,43,0.25); }
        .seg input:not(:checked)+label:hover { transform: translateY(-1px); border-color: ${FOREST_2}; }
        input, select, textarea { transition: border-color 180ms ease, box-shadow 180ms ease, transform 120ms ease; }
        input:focus-visible, select:focus-visible { box-shadow: 0 0 0 3px rgba(30,122,70,0.15); transform: translateY(-1px); }
        .card-anim { animation: slideUp 360ms cubic-bezier(0.16, 0.8, 0.2, 1) both; }
        .stagger-1 { animation-delay: 40ms; }
        .stagger-2 { animation-delay: 80ms; }
        .stagger-3 { animation-delay: 120ms; }
        .stagger-4 { animation-delay: 160ms; }
        .stagger-5 { animation-delay: 200ms; }
        button, .btn, .cta a { transition: all 160ms cubic-bezier(0.16, 0.8, 0.2, 1); will-change: transform, background-color, box-shadow; }
        button:hover:not(:disabled), .btn:hover:not(:disabled), .cta a:hover { transform: translateY(-1px); box-shadow: 0 6px 20px -10px rgba(31,61,43,0.45); }
        button:active:not(:disabled), .btn:active:not(:disabled), .cta a:active { transform: scale(0.995); }
        input[type="range"]::-webkit-slider-thumb { cursor: pointer; transition: transform 140ms ease, box-shadow 140ms ease; }
        input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.08); box-shadow: 0 2px 8px rgba(31,61,43,0.25); }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid ${C.yolk}; outline-offset: 3px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .anim { animation: none; } .toast { animation: none; } * { transition: none !important; } }
        /* Keep the last step clear of the fixed bottom nav on mobile/tablet */
        @media (max-width: 1023px) {
          .fuelbox-onboarding-main { padding-bottom: 128px !important; }
        }
      `,
        }}
      />

      {/* Toast layer — every validation error also pops here, transiently. The
          inline message under each field stays as well. */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          zIndex: 2000,
          pointerEvents: "none",
          padding: "0 14px",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="toast"
            style={{
              pointerEvents: "auto",
              width: "100%",
              maxWidth: 440,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: C.nonveg,
              color: PAPER,
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: "11px 14px",
              fontFamily: FONT_BODY,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.35,
              boxShadow: "0 10px 30px rgba(26,35,29,0.28)",
            }}
          >
            <span style={{ fontSize: 15, lineHeight: "20px" }}>⚠️</span>
            <span style={{ flex: 1 }}>{t.text}</span>
          </div>
        ))}
      </div>

      <FitnessScene
        style={{ position: "fixed", zIndex: 0 }}
        opacity={0.4}
        safeWidth={step === 1 || step === 2 ? 560 : 440}
        mobileCast={step === 0}
      />
      <div
        className="mx-auto fuelbox-onboarding-main"
        style={{ maxWidth: step === 1 || step === 2 ? 560 : 440, padding: "0 22px 48px", position: "relative", zIndex: 1 }}
      >
        <div
          className="flex items-center justify-center sm:justify-between gap-3"
          style={{ padding: "20px 0 14px" }}
        >
          <div className="flex flex-1 min-w-0 justify-center sm:justify-start items-center" style={{ display: "flex", alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
            <FuelBoxLogo />
          </div>
          {step === 1 && (
            <motion.button
              onClick={() => saveStep(0)}
              className="shrink-0"
              whileTap={{ scale: 0.985 }}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              style={{
                background: "transparent",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                color: C.muted,
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ← Back
            </motion.button>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={dir >= 1 ? slideInRight : slideInLeft}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={{ duration: 0.32, ease: EASE_OUT }}
          >
            {screen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation — mobile & tablet only (hidden on desktop) */}
      <OnboardingBottomNav />
    </div>
  );
}

// Fixed bottom navigation for the Customer Onboarding page — visible on mobile
// and tablet viewports only (hidden at `lg`/desktop breakpoint and above).
function OnboardingBottomNav() {
  const pathname = usePathname() || "/";

  const items = [
    {
      label: "Home",
      icon: Home,
      href: "/",
      isActive: (p: string) => p === "/",
    },
    {
      label: "Menu",
      icon: Utensils,
      href: "/menu",
      isActive: (p: string) => p.startsWith("/menu"),
    },
    {
      label: "Plans",
      icon: Receipt,
      href: "/plans",
      isActive: (p: string) => p.startsWith("/plans"),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
        paddingTop: 8,
        paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className="flex flex-col items-center gap-1 text-center transition-all duration-200 active:scale-95"
              style={{ minWidth: 64 }}
            >
              <div
                className={`flex items-center justify-center rounded-xl p-1 transition-colors duration-200 ${
                  active
                    ? "bg-[#16a34a]/10 text-[#16a34a]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[10px] tracking-wide transition-colors duration-200 ${
                  active ? "font-bold text-[#16a34a]" : "font-semibold text-gray-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
