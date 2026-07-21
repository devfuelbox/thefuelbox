
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { onboardingSupabase } from "@/lib/onboardingSupabaseClient"
import { updateUserProfile } from "@/lib/api"
import { ROUTES } from "@/lib/constants"
import { calculateHealthMetrics, type OnboardingAnswers } from "@/lib/healthCalculations"

// ─── FUELBOX BRAND TOKENS (matches website theme) ───────
const C = {
  ink: "#111827",       // gray-900 – main dark text
  card: "#FFFFFF",      // white card bg
  line: "#E5E7EB",      // gray-200 – subtle borders
  yolk: "#16A34A",      // brand-600 – primary green
  bone: "#111827",      // gray-900 – headings
  muted: "#6B7280",     // gray-500 – secondary text
  veg: "#16A34A",       // brand green
  egg: "#D97706",       // amber-600
  nonveg: "#DC2626",    // red-600
  energy: "#EA580C",    // energy-600 – orange accent
}
const FONT_DISPLAY = "'Poppins', sans-serif"
const FONT_BODY = "'Inter', sans-serif"

// ─── BUSINESS CONFIG ─────────────────────────────────────
const WA_NUMBER = "919384302527" // Ajith
const KITCHEN = { lat: 11.0197, lng: 76.992 } // Nava India junction, Coimbatore
const FREE_KM = 5
const MAX_KM = 30          // beyond this: waitlist
const FEE_PER_KM = 10      // ₹ per km after 5km
const MARGIN = 1.4         // cost + 40%
const PREP_COST = 15       // ₹ per delivered meal: packaging + gas + labor

// ─── INGREDIENTS — nutrients + wholesale ₹/kg ──
// BASE_ING is the static fallback. Live prices/macros fetched from the DB are
// layered on top as overrides in component state (see `ing` below) rather
// than mutated in place, so this object stays a stable, shared reference.
interface IngredientData {
  n: string
  t: "veg" | "egg" | "nonveg"
  k: number
  p: number
  price: number
  unit?: number
  uname?: string
}

const BASE_ING: Record<string, IngredientData> = {
  chicken:     { n: "Chicken Breast", t: "nonveg", k: 165, p: 31,   price: 28 },
  egg:         { n: "Eggs",           t: "egg",    k: 155, p: 13,   price: 14, unit: 50,  uname: "egg" },
  paneer:      { n: "Paneer",         t: "veg",    k: 275, p: 19,   price: 26 },
  soya:        { n: "Soya Chunks",    t: "veg",    k: 345, p: 52,   price: 10 },
  channaW:     { n: "White Channa",   t: "veg",    k: 164, p: 8.9,  price: 11 },
  blackchanna: { n: "Black Channa",   t: "veg",    k: 130, p: 6.0,  price: 10 },
  peanut:      { n: "Peanuts",        t: "veg",    k: 567, p: 25.8, price: 14 },
  rice:        { n: "White Rice",     t: "veg",    k: 130, p: 2.7,  price: 5 },
  chapati:     { n: "Chapati",        t: "veg",    k: 299, p: 7.9,  price: 8,  unit: 50,  uname: "pc" },
  sweetpotato: { n: "Sweet Potato",   t: "veg",    k: 76,  p: 1.4,  price: 8 },
  broccoli:    { n: "Broccoli",       t: "veg",    k: 34,  p: 2.8,  price: 20 },
  carrot:      { n: "Carrot",         t: "veg",    k: 41,  p: 0.9,  price: 7 },
  beetroot:    { n: "Beetroot",       t: "veg",    k: 43,  p: 1.6,  price: 4 },
  cucumber:    { n: "Cucumber",       t: "veg",    k: 16,  p: 0.7,  price: 5 },
  cabbageP:    { n: "Purple Cabbage", t: "veg",    k: 31,  p: 1.4,  price: 6 },
  banana:      { n: "Banana",         t: "veg",    k: 89,  p: 1.1,  price: 6,  unit: 120, uname: "pc" },
  papaya:      { n: "Papaya",         t: "veg",    k: 43,  p: 0.5,  price: 3 },
  guava:       { n: "Guava",          t: "veg",    k: 68,  p: 2.6,  price: 6 },
  apple:       { n: "Apple",          t: "veg",    k: 52,  p: 0.3,  price: 10 },
  orange:      { n: "Orange",         t: "veg",    k: 47,  p: 0.9,  price: 8 },
  watermelon:  { n: "Watermelon",     t: "veg",    k: 30,  p: 0.6,  price: 5 },
}

const kOf = (ing: Record<string, IngredientData>, id: string, g: number) => (ing[id].k * g) / 100
const pOf = (ing: Record<string, IngredientData>, id: string, g: number) => (ing[id].p * g) / 100
const costOf = (ing: Record<string, IngredientData>, id: string, g: number) => (ing[id].price * g) / 100

const MEAL_OF: Record<string, string> = {
  egg: "Morning", papaya: "Morning", soya: "Morning", banana: "Morning", guava: "Morning", apple: "Morning", orange: "Morning", watermelon: "Morning",
  rice: "Afternoon", chicken: "Afternoon", channaW: "Afternoon", broccoli: "Afternoon", cucumber: "Afternoon", sweetpotato: "Afternoon", blackchanna: "Afternoon",
  chapati: "Night", paneer: "Night", carrot: "Night", beetroot: "Night", peanut: "Night", cabbageP: "Night",
}
const MEAL_ORDER = ["Morning", "Afternoon", "Night"]

// ─── PLAN LOGIC ──────────────────────────────────────────
const GOALS = {
  loss:        { label: "Weight loss", sub: "Drop fat, stay full",                 plan: "LEAN PLAN" },
  gain:        { label: "Weight gain", sub: "Skinny → solid. Make the scale move", plan: "FUEL PLAN" },
  muscle:      { label: "Muscle gain", sub: "You train. Build shape, not belly",   plan: "BULK PLAN" },
  maintenance: { label: "Maintenance", sub: "Maintain shape, stay fueled",        plan: "FIT PLAN" }
}
const ACTIVITY = {
  sedentary: { label: "Mostly sitting", sub: "Desk job, little movement" },
  active:    { label: "On my feet",     sub: "Walking, light activity daily" },
  gym:       { label: "Gym regular",    sub: "Training 3+ days a week" },
}
const FREQS = {
  1: { label: "1 meal a day",  sub: "Starter · slow & steady", speed: 0.4, tag: "Slow" },
  2: { label: "2 meals a day", sub: "Serious · solid pace",    speed: 0.7, tag: "Solid" },
  3: { label: "3 meals a day", sub: "Full Fuel · fastest",     speed: 1.0, tag: "Fastest" },
}

function buildPlan(a: OnboardingAnswers, variant: number, ing: Record<string, IngredientData>) {
  const goal = a.goal || 'loss'
  const metrics = calculateHealthMetrics(a)
  const kcalT = metrics.goalCalories
  const protT = metrics.proteinG

  // Dynamic protein pools for variant scrambling
  const nonvegPools: [string, number][][] = [
    [["chicken", 250], ["egg", 150], ["paneer", 100], ["soya", 40]],
    [["egg", 200], ["chicken", 200], ["soya", 60], ["paneer", 80]],
    [["paneer", 200], ["chicken", 220], ["egg", 100], ["blackchanna", 120]],
    [["chicken", 280], ["soya", 80], ["egg", 150], ["peanut", 35]],
  ]
  const eggPools: [string, number][][] = [
    [["egg", 150], ["paneer", 150], ["soya", 60], ["channaW", 150]],
    [["soya", 80], ["egg", 200], ["paneer", 100], ["blackchanna", 140]],
    [["paneer", 220], ["egg", 150], ["channaW", 120], ["peanut", 40]],
  ]
  const vegPools: [string, number][][] = [
    [["paneer", 200], ["soya", 100], ["channaW", 150], ["peanut", 30]],
    [["soya", 120], ["paneer", 180], ["blackchanna", 160], ["peanut", 35]],
    [["channaW", 200], ["paneer", 160], ["soya", 80], ["peanut", 40]],
    [["paneer", 220], ["blackchanna", 180], ["soya", 60], ["peanut", 30]],
  ]

  const userFood = a.food || 'veg'
  const poolList = userFood === 'nonveg' ? nonvegPools : userFood === 'egg' ? eggPools : vegPools
  const srcs = poolList[variant % poolList.length]

  const items: Array<{ id: string; g: number }> = []
  const add = (id: string, g: number) => {
    if (g <= 0) return
    const e = items.find((i) => i.id === id)
    if (e) e.g += g; else items.push({ id, g })
  }

  // Rotate Veggies based on variant
  const vegRotations: [string, number][][] = [
    [["broccoli", 100], ["carrot", 50], ["beetroot", 50]],
    [["cucumber", 120], ["cabbageP", 80], ["broccoli", 80]],
    [["carrot", 80], ["cucumber", 100], ["beetroot", 60]],
    [["broccoli", 120], ["cabbageP", 60], ["carrot", 60]],
  ]
  const vegSet = vegRotations[variant % vegRotations.length]
  vegSet.forEach(([vId, vG]) => add(vId as string, vG as number))

  // Rotate Fruits based on variant
  const fruitRotations: [string, number][] = [
    goal === "loss" ? ["papaya", 150] : ["banana", 120],
    goal === "loss" ? ["apple", 140] : ["orange", 150],
    goal === "loss" ? ["watermelon", 180] : ["banana", 150],
    goal === "loss" ? ["guava", 130] : ["apple", 140],
  ]
  const [fId, fG] = fruitRotations[variant % fruitRotations.length]
  add(fId as string, fG as number)

  // Rotate Carbs based on variant
  const carbRotations = [
    { rice: goal === "loss" ? 100 : goal === "gain" ? 250 : 200, chap: goal === "loss" ? 50 : 100, sweet: 0 },
    { rice: goal === "loss" ? 50 : goal === "gain" ? 180 : 120, chap: goal === "loss" ? 100 : 150, sweet: 0 },
    { rice: 0, chap: goal === "loss" ? 100 : 200, sweet: goal === "loss" ? 120 : 200 },
    { rice: goal === "loss" ? 120 : 220, chap: 0, sweet: goal === "loss" ? 100 : 150 },
  ]
  const carbChoice = carbRotations[variant % carbRotations.length]
  let riceG = carbChoice.rice
  let chapG = carbChoice.chap
  let sweetG = carbChoice.sweet
  if (sweetG > 0) add("sweetpotato", sweetG)

  let need = protT
    - items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0)
    - pOf(ing, "rice", riceG) - pOf(ing, "chapati", chapG)

  for (const [id, cap] of srcs) {
    if (need <= 1) break
    const step = ing[id].unit || 10
    let g = Math.min(cap as number, Math.ceil((need / ing[id].p) * 100))
    g = Math.round(g / step) * step
    if (g <= 0) continue
    add(id, g)
    need -= pOf(ing, id, g)
  }

  const caps = goal === "loss"
    ? { rice: 250, chap: 100, ban: 240, pea: 30 }
    : { rice: 350, chap: 200, ban: 360, pea: 60 }
  let banX = 0, peaX = 0
  const total = () =>
    items.reduce((s, it) => s + kOf(ing, it.id, it.g), 0)
    + kOf(ing, "rice", riceG) + kOf(ing, "chapati", chapG)
    + kOf(ing, "banana", banX) + kOf(ing, "peanut", peaX)

  // Two independent guards: tightening down and topping up are separate
  // passes, so each gets its own iteration budget instead of sharing one.
  let guard1 = 0
  while (total() > kcalT + 80 && guard1++ < 20) {
    if (riceG > 50) riceG -= 25
    else if (chapG > 0) chapG -= 50
    else break
  }
  let guard2 = 0
  while (total() < kcalT - 120 && guard2++ < 60) {
    if (riceG < caps.rice) riceG += 25
    else if (banX < caps.ban) banX += 60
    else if (peaX < caps.pea) peaX += 10
    else if (chapG < caps.chap) chapG += 50
    else break
  }
  if (riceG > 0) add("rice", riceG)
  if (chapG > 0) add("chapati", chapG)
  if (banX > 0) add("banana", banX)
  if (peaX > 0) add("peanut", peaX)

  const protein = Math.round(items.reduce((s, it) => s + pOf(ing, it.id, it.g), 0))
  const kcal = Math.round(items.reduce((s, it) => s + kOf(ing, it.id, it.g), 0))
  const meals = MEAL_ORDER.map((m) => ({
    name: m,
    items: items.filter((it) => (MEAL_OF[it.id] || "Afternoon") === m),
  })).filter((m: any) => m.items.length)

  return { items, meals, protein, kcal, protT, kcalT }
}

function coverage(plan: any, freq: number, ing: Record<string, IngredientData>) {
  const protOf = (m: any) => m.items.reduce((s: number, it: any) => s + pOf(ing, it.id, it.g), 0)
  const ranked = [...plan.meals].sort((x: any, y: any) => protOf(y) - protOf(x))
  const delNames = freq >= 3 ? plan.meals.map((m: any) => m.name) : ranked.slice(0, freq).map((m: any) => m.name)
  const delMeals = plan.meals.filter((m: any) => delNames.includes(m.name))
  const selfMeals = plan.meals.filter((m: any) => !delNames.includes(m.name))
  const delProt = Math.round(delMeals.reduce((s: number, m: any) => s + protOf(m), 0))
  const cost = delMeals.reduce((s: number, m: any) => s + m.items.reduce((x: number, it: any) => x + costOf(ing, it.id, it.g), 0), 0)
    + PREP_COST * delMeals.length
  const price = Math.ceil((cost * MARGIN) / 5) * 5 // sell = (ingredients + prep) + 40%, rounded up to ₹5
  return { delNames, delMeals, selfMeals, delProt, price }
}

function timeline(goal: string | null, freq: number) {
  const f = FREQS[freq as keyof typeof FREQS].speed
  if (goal === "loss")   { const m = Math.ceil((5 / (1.5 * f)) * 2) / 2; return { big: `~${m} months`, sub: "to your first −5 kg" } }
  if (goal === "gain")   { const m = Math.ceil((4 / (1.2 * f)) * 2) / 2; return { big: `~${m} months`, sub: "to a solid +4 kg" } }
  const w = Math.ceil(12 / f)
  return { big: `~${w} weeks`, sub: "to visible muscle" }
}

const fmtQty = (ing: Record<string, IngredientData>, it: any) => {
  const d = ing[it.id]
  if (d.unit) {
    const c = Math.round(it.g / d.unit)
    return `${c} ${d.uname}${c > 1 ? "s" : ""} (${it.g}g)`
  }
  return `${it.g}g`
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function zoneFor(km: number) {
  if (km <= FREE_KM) return { zone: "free", fee: 0 }
  if (km <= MAX_KM) return { zone: "paid", fee: Math.ceil(km - FREE_KM) * FEE_PER_KM }
  return { zone: "out", fee: null }
}

interface LocState {
  status: string
  km: number | null
  fee: number | null
  lat: number | null
  lng: number | null
}

function FoodMark({ type, size = 14 }: { type: string; size?: number }) {
  const color = type === "veg" ? C.veg : type === "egg" ? C.egg : C.nonveg
  return (
    <span style={{
      width: size, height: size, border: `1.5px solid ${color}`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 2, flexShrink: 0,
    }} aria-label={type}>
      {type === "nonveg" ? (
        <span style={{
          width: 0, height: 0,
          borderLeft: `${size * 0.28}px solid transparent`,
          borderRight: `${size * 0.28}px solid transparent`,
          borderBottom: `${size * 0.48}px solid ${color}`,
        }} />
      ) : (
        <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: color }} />
      )}
    </span>
  )
}

function useCountUp(target: number, duration = 1300) {
  const [val, setVal] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const reduce = typeof window !== "undefined" &&
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) { setVal(target); return }
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return val
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FONT_BODY, fontSize: 11, letterSpacing: "0.22em", color: C.yolk, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>{children}</div>
}

function Question({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(30px, 8vw, 40px)", color: C.bone, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.01em", margin: "0 0 24px" }}>{children}</h2>
}

function OptionCard({ selected, onClick, title, sub, mark, right }: { selected: boolean; onClick: () => void; title: string; sub?: string; mark?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full text-left" style={{
      background: selected ? "rgba(22,163,74,0.08)" : C.card,
      border: `1.5px solid ${selected ? C.yolk : C.line}`,
      borderRadius: 14, padding: "16px 18px", marginBottom: 10,
      cursor: "pointer", transition: "border-color 160ms, background 160ms",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {mark}
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, color: C.bone }}>{title}</span>
        {sub && <span style={{ display: "block", fontFamily: FONT_BODY, fontSize: 13, color: C.muted, marginTop: 3 }}>{sub}</span>}
      </span>
      {right || <span style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? C.yolk : C.line}`,
        background: selected ? C.yolk : "transparent", transition: "all 160ms",
      }} />}
    </button>
  )
}

function Slider({ label, unit, value, min, max, onChange }: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-end justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: C.yolk, lineHeight: 1 }}>
          {value}<span style={{ fontSize: 15, color: C.muted, fontFamily: FONT_BODY, fontWeight: 600, marginLeft: 4 }}>{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.yolk, height: 26 }} />
    </div>
  )
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full" style={{
      background: disabled ? C.line : C.yolk, color: disabled ? C.muted : C.ink,
      fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16,
      border: "none", borderRadius: 12, padding: "16px",
      cursor: disabled ? "not-allowed" : "pointer",
      letterSpacing: "0.02em", transition: "opacity 160ms",
    }}>{children}</button>
  )
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
  saveStep,
  setLoc,
}: {
  a: OnboardingAnswers
  loc: LocState
  ing: Record<string, IngredientData>
  saveStep: (next: number, updatedAnswers?: OnboardingAnswers) => void
  setLoc: (loc: LocState) => void
}) {
  const navigate = useNavigate()
  const [vary, setVary] = useState(0)
  const [freq, setFreq] = useState(a.freq || 1)
  const plan = buildPlan(a, vary, ing)

  const [customPlan, setCustomPlan] = useState<any>(null)
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderError, setOrderError] = useState("")

  useEffect(() => {
    setCustomPlan(plan)
  }, [vary])

  const planToUse = customPlan || plan
  const cov = coverage(planToUse, freq, ing)
  const tl = timeline(a.goal, freq)
  const metrics = calculateHealthMetrics(a)
  const n = useCountUp(metrics.proteinG)
  const waitlist = loc.status === "out"
  const delivFee = loc.status === "free" ? 0 : loc.status === "paid" ? loc.fee : null

  const bmiLine = () => {
    const b = metrics.bmi.toFixed(1)
    if (a.goal === "loss" && metrics.bmi >= 25) return `BMI ${b} — meals stay filling but calorie-smart. You'll never feel like you're dieting.`
    if (a.goal === "gain" && metrics.bmi < 18.5) return `BMI ${b} — clean surplus. Real food calories, zero junk.`
    if (a.goal === "muscle") return `BMI ${b} — protein does the building. We do the cooking.`
    return `BMI ${b} — dialed to your body, not a template.`
  }

  const waLink = () => {
    const mealsTxt = planToUse.meals.map((m: any) =>
      `${cov.delNames.includes(m.name) ? "🟨" : "▫️"} ${m.name}: ${m.items.map((it: any) => `${ing[it.id].n} ${fmtQty(ing, it)}`).join(", ")}`
    ).join("\n")
    const locTxt = loc.km != null
      ? `Location: ${loc.km} km from Nava India (maps.google.com/?q=${loc.lat},${loc.lng}) — ${loc.status === "free" ? "FREE delivery" : loc.status === "paid" ? `delivery ₹${loc.fee}/day` : "outside zone (waitlist)"}`
      : "Location: will confirm on WhatsApp"
    const msg = `Hi Ajith! ${waitlist ? "WAITLIST — outside 30km.\n" : ""}FuelBox plan for ${a.name}:\n` +
      `Goal: ${a.goal ? GOALS[a.goal].label : ''} (${a.goal ? GOALS[a.goal].plan : ''}) · ${a.food} · ${FREQS[freq as keyof typeof FREQS].label}\n` +
      `Target: ${planToUse.protT}g protein · ~${planToUse.kcalT} kcal/day\n` +
      `FuelBox covers: ${cov.delProt}g/day (🟨 = FuelBox delivers)\n\n${mealsTxt}\n\n` +
      `Food ₹${cov.price}/day${delivFee != null ? ` + delivery ₹${delivFee}/day` : " + delivery TBD"}\n` +
      `21-day pack ≈ ₹${(cov.price + (delivFee || 0)) * 21}\n` +
      `Timeline: ${tl.big} ${tl.sub}\n${locTxt}\nPhone: ${a.phone}`
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`
  }

  const recalculatePlan = (updatedMeals: any[]) => {
    const flatItems: Array<{ id: string; g: number }> = []
    updatedMeals.forEach((m) => {
      m.items.forEach((it: any) => {
        const existing = flatItems.find((x) => x.id === it.id)
        if (existing) {
          existing.g += it.g
        } else {
          flatItems.push({ id: it.id, g: it.g })
        }
      })
    })

    const protein = Math.round(flatItems.reduce((s, it) => s + pOf(ing, it.id, it.g), 0))
    const kcal = Math.round(flatItems.reduce((s, it) => s + kOf(ing, it.id, it.g), 0))

    return {
      ...planToUse,
      meals: updatedMeals,
      items: flatItems,
      protein,
      kcal
    }
  }

  const handleUpdateQty = (mealName: string, itemId: string, direction: number) => {
    const d = ing[itemId]
    const step = d.unit || 25
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== mealName) return m
      const updatedItems = m.items.map((it: any) => {
        if (it.id !== itemId) return it
        const newG = Math.max(0, it.g + direction * step)
        return { ...it, g: newG }
      }).filter((it: any) => it.g > 0)
      return { ...m, items: updatedItems }
    })
    setCustomPlan(recalculatePlan(updatedMeals))
  }

  const handleAddItem = (mealName: string, itemId: string) => {
    const d = ing[itemId]
    const defaultQty = d.unit || 50
    const updatedMeals = planToUse.meals.map((m: any) => {
      if (m.name !== mealName) return m
      const alreadyExists = m.items.some((it: any) => it.id === itemId)
      if (alreadyExists) return m
      return {
        ...m,
        items: [...m.items, { id: itemId, g: defaultQty }]
      }
    })
    setCustomPlan(recalculatePlan(updatedMeals))
  }

  const handleOrderOnWhatsApp = async () => {
    setIsOrdering(true)
    setOrderError("")

    try {
      // Save customer + final (possibly customized) plan to DB
      await fetch('/api/onboarding/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          meal_plan: planToUse,
        }),
      })
    } catch (err: any) {
      console.error('[Order] Failed to save customer to DB:', err)
      // Non-blocking — still open WhatsApp even if DB write fails
    }

    // Open WhatsApp
    window.open(waLink(), '_blank')
    setIsOrdering(false)
  }

  return (
    <div key="s9" className="anim" style={{ paddingTop: 12 }}>
      <Eyebrow>Your number</Eyebrow>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(96px, 30vw, 150px)", lineHeight: 0.9, color: C.yolk }}>
        {n}<span style={{ fontSize: "0.32em", color: C.bone }}>g</span>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.bone, fontWeight: 600, margin: "10px 0 4px" }}>
        of protein. Every single day, {a.name.split(" ")[0]}.
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 22 }}>{bmiLine()}</div>

      {a.goal === "loss" && metrics.bmi < 18.5 && (
        <div style={{ background: "rgba(232,185,49,0.08)", border: `1.5px solid ${C.egg}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.bone, lineHeight: 1.55 }}>
            Brother, honestly — at BMI {metrics.bmi.toFixed(1)} you don't need weight loss. Your real glow-up is <b style={{ color: C.yolk }}>muscle gain</b>. Retake the quiz and pick it — same price range, way better mirror results.
          </div>
        </div>
      )}

      {/* TIMELINE + SPEED */}
      <div style={{ background: C.card, border: `1.5px solid ${C.yolk}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
          At {FREQS[freq as keyof typeof FREQS].label} · {FREQS[freq as keyof typeof FREQS].tag} pace
        </div>
        <div key={freq} className="anim" style={{ fontFamily: FONT_DISPLAY, fontSize: 44, color: C.yolk, lineHeight: 1.05, margin: "6px 0 2px" }}>
          {tl.big}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.bone, fontWeight: 600 }}>{tl.sub}</div>

        {/* coverage bar */}
        <div style={{ margin: "16px 0 6px", height: 8, background: C.line, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, Math.round((cov.delProt / planToUse.protT) * 100))}%`, background: C.yolk, borderRadius: 6, transition: "width 400ms ease" }} />
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted }}>
          FuelBox delivers <b style={{ color: C.yolk }}>{cov.delProt}g</b> of your {planToUse.protT}g/day
          {cov.selfMeals.length > 0 && ` · ${cov.selfMeals.map((m: any) => m.name).join(" + ")} from your side (list on WhatsApp)`}
        </div>

        {freq < 3 && (
          <button onClick={() => setFreq(freq + 1)} className="w-full" style={{
            marginTop: 14, background: C.yolk, color: C.ink, border: "none", borderRadius: 10,
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, padding: "12px", cursor: "pointer",
          }}>
            ⚡ Cut my timeline — add a meal
          </button>
        )}
      </div>

      {/* PLAN CARD */}
      <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: C.bone, textTransform: "uppercase", lineHeight: 1 }}>{a.goal ? GOALS[a.goal].plan : ''}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, marginTop: 5 }}>~{planToUse.kcal} kcal full day · 🟨 = FuelBox delivers</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: C.yolk, lineHeight: 1 }}>₹{cov.price}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, marginTop: 3 }}>food / day</div>
          </div>
        </div>
        <div style={{ height: 1, background: C.line, margin: "16px 0" }} />
        {planToUse.meals.map((m: any) => {
          const mine = cov.delNames.includes(m.name)
          return (
            <div key={m.name} style={{ marginBottom: 14, opacity: mine ? 1 : 0.6, background: "rgba(0,0,0,0.02)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: mine ? C.yolk : C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700, marginBottom: 7 }}>
                {mine ? "🟨 " : ""}{m.name}{mine ? " — FuelBox" : " — your side"}
              </div>
              {m.items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                  <span className="flex items-center" style={{ gap: 9 }}>
                    <FoodMark type={ing[it.id].t} size={13} />
                    <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.bone, display: "flex", flexDirection: "column" }}>
                      <span>{ing[it.id].n}</span>
                      <span style={{ color: C.muted, fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        {fmtQty(ing, it)}
                        <span className="inline-flex items-center" style={{ gap: 4 }}>
                          <button
                            onClick={() => handleUpdateQty(m.name, it.id, -1)}
                            style={{
                              width: 20, height: 20, borderRadius: "50%", border: `1px solid ${C.line}`,
                              background: C.card, color: C.bone, display: "inline-flex", alignItems: "center",
                              justifyContent: "center", cursor: "pointer", fontWeight: "bold", fontSize: 12
                            }}
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleUpdateQty(m.name, it.id, 1)}
                            style={{
                              width: 20, height: 20, borderRadius: "50%", border: `1px solid ${C.line}`,
                              background: C.card, color: C.bone, display: "inline-flex", alignItems: "center",
                              justifyContent: "center", cursor: "pointer", fontWeight: "bold", fontSize: 12
                            }}
                          >
                            +
                          </button>
                        </span>
                      </span>
                    </span>
                  </span>
                  {pOf(ing, it.id, it.g) >= 1 ? (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.yolk }}>{Math.round(pOf(ing, it.id, it.g))}g protein</span>
                  ) : (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: C.muted }}>vitamins ✓</span>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <select
                  value=""
                  onChange={(e) => {
                    const newId = e.target.value
                    if (newId) handleAddItem(m.name, newId)
                  }}
                  style={{
                    fontFamily: FONT_BODY, fontSize: 12, color: C.yolk,
                    background: "rgba(22,163,74,0.06)", border: `1px dashed ${C.yolk}`,
                    borderRadius: 8, padding: "5px 10px", cursor: "pointer", outline: "none", width: "100%"
                  }}
                >
                  <option value="" disabled>+ Add ingredient to {m.name}</option>
                  {Object.keys(BASE_ING).map((key) => {
                    const name = BASE_ING[key].n
                    const alreadyInMeal = m.items.some((it: any) => it.id === key)
                    if (alreadyInMeal) return null
                    return <option key={key} value={key}>{name}</option>
                  })}
                </select>
              </div>
            </div>
          )
        })}
        <div style={{ height: 1, background: C.line, margin: "4px 0 12px" }} />
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.bone }}>
            Delivery{loc.km != null ? ` · ${loc.km} km` : ""}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: delivFee === 0 ? C.veg : C.yolk }}>
            {waitlist ? "—" : delivFee === 0 ? "FREE ✓" : delivFee != null ? `₹${delivFee}/day` : "on WhatsApp"}
          </span>
        </div>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.bone }}>7-day trial</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.bone }}>
            ≈ ₹{((cov.price + (delivFee || 0)) * 7).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.bone }}>21-day pack</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 700, color: C.yolk }}>
            ≈ ₹{((cov.price + (delivFee || 0)) * 21).toLocaleString("en-IN")}
          </span>
        </div>
        {planToUse.protein < planToUse.protT - 8 && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 10 }}>
            Honest note: pure-veg foods max out at ~{planToUse.protein}g/day — we've packed the maximum. Quality protein, no fake numbers.
          </div>
        )}
      </div>

      <button onClick={() => setVary((v) => v + 1)} className="w-full" style={{
        background: "transparent", border: `1.5px solid ${C.line}`, borderRadius: 12,
        color: C.bone, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, padding: "13px", cursor: "pointer", marginBottom: 10,
      }}>↻ Mix the foods differently</button>

      {orderError && (
        <div style={{
          textAlign: "center", fontFamily: FONT_BODY, fontSize: 13,
          color: C.nonveg, fontWeight: 600, marginBottom: 10
        }}>
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

      <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", margin: "18px 0 0" }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.bone, lineHeight: 1.6 }}>
          <b style={{ color: C.yolk }}>Balanced by design.</b> Your box isn't protein alone — rice, chapati, veg and fruit come with it, so you get fiber and energy too. Targets stay inside safe limits.
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 6 }}>
          Have kidney issues, diabetes, or are pregnant? Please check with your doctor before starting.
        </div>
      </div>

      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.bone, fontWeight: 700, textAlign: "center", margin: "18px 0 4px" }}>
        We know brother — you can do this. Namma achieve pannuvom. 💪
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.5, margin: "10px 0 4px" }}>
        Timelines are estimates from standard nutrition math, assuming strict diet + regular home workout. Not medical advice.
      </div>

      {/* <button onClick={() => {
        saveStep(0, { goal: null, age: 25, gender: null, height: 170, weight: 70, food: null, activity: null, freq: null, name: "", email: "", phone: "" })
        setLoc({ status: "idle", km: null, fee: null, lat: null, lng: null })
      }}
        className="w-full" style={{
          background: "transparent", border: "none", color: C.muted, fontFamily: FONT_BODY,
          fontSize: 13, fontWeight: 600, padding: "14px", cursor: "pointer",
          textDecoration: "underline", textUnderlineOffset: 3,
        }}>Retake quiz</button> */}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const loggedInUser = useAuthStore((s) => s.user)

  const [step, setStep] = useState(0)
  const [a, setA] = useState<OnboardingAnswers>({
    goal: null, age: 25, gender: null, height: 170, weight: 70,
    food: null, activity: null, freq: null,
    name: "", email: "", phone: "",
  })

  const [loc, setLoc] = useState<LocState>({ status: "idle", km: null, fee: null, lat: null, lng: null })
  const [sessionId, setSessionId] = useState("")
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalizationError, setFinalizationError] = useState("")

  const set = (k: keyof OnboardingAnswers, v: any) => setA((p) => ({ ...p, [k]: v }))
  const TOTAL = 8

  // Live ingredient data: BASE_ING merged with any DB-fetched overrides.
  // Overrides live in state, not on a mutated shared object, so this is
  // reactive and safe across multiple mounts.
  const [ingOverrides, setIngOverrides] = useState<Record<string, Partial<IngredientData>>>({})
  const [dbLoaded, setDbLoaded] = useState(false)
  const ing = useMemo(() => {
    const merged: Record<string, IngredientData> = {}
    for (const key of Object.keys(BASE_ING)) {
      merged[key] = { ...BASE_ING[key], ...(ingOverrides[key] || {}) }
    }
    return merged
  }, [ingOverrides])

  // Fetch live menu prices/macros from the database on mount
  useEffect(() => {
    const loadDbFoods = async () => {
      try {
        const client = getSupabaseClient()
        if (!client) return
        const { data, error } = await client
          .from("menu_items")
          .select("*")
          .eq("is_available", true)
        if (error || !data || data.length === 0) return

        const overrides: Record<string, Partial<IngredientData>> = {}
        data.forEach((row: any) => {
          const nameLower = row.name.toLowerCase()
          let targetKey: string | null = null

          if (nameLower.includes("chicken breast")) targetKey = "chicken"
          else if (nameLower === "paneer") targetKey = "paneer"
          else if (nameLower.includes("egg") && !nameLower.includes("dressing")) targetKey = "egg"
          else if (nameLower.includes("soya")) targetKey = "soya"
          else if (nameLower.includes("white channa") || nameLower === "channa with onions (cooked)") targetKey = "channaW"
          else if (nameLower.includes("peanut")) targetKey = "peanut"
          else if (nameLower.includes("rice")) targetKey = "rice"
          else if (nameLower.includes("chapati")) targetKey = "chapati"
          else if (nameLower.includes("broccoli")) targetKey = "broccoli"
          else if (nameLower.includes("carrot")) targetKey = "carrot"
          else if (nameLower.includes("beetroot")) targetKey = "beetroot"
          else if (nameLower.includes("banana") && (nameLower.includes("regular") || nameLower === "banana")) targetKey = "banana"
          else if (nameLower.includes("papaya")) targetKey = "papaya"
          else if (nameLower.includes("guava")) targetKey = "guava"

          if (targetKey && BASE_ING[targetKey]) {
            overrides[targetKey] = {
              k: Number(row.calories ?? BASE_ING[targetKey].k),
              p: Number(row.protein_g ?? BASE_ING[targetKey].p),
              price: Number(row.price ?? BASE_ING[targetKey].price),
            }
          }
        })

        if (Object.keys(overrides).length > 0) {
          setIngOverrides(overrides)
          setDbLoaded(true)
          console.log("[Onboarding] Mapped menu item prices from Supabase:", data.length)
        }
      } catch (err) {
        console.warn("Failed to load menu items from primary DB:", err)
      }
    }
    loadDbFoods()
  }, [])

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("fuelbox_onboarding_session_id")
      const savedStep = localStorage.getItem("fuelbox_onboarding_step")
      const savedAnswers = localStorage.getItem("fuelbox_onboarding_answers")

      if (savedSession) {
        setSessionId(savedSession)
      }
      if (savedStep) {
        setStep(Number(savedStep))
      }
      if (savedAnswers) {
        setA(JSON.parse(savedAnswers))
      }
    } catch (_) {}
  }, [])

  // Save progress step-by-step to the NEW database
  const saveStep = async (nextStep: number, updatedAnswers = a) => {
    let curSessionId = sessionId

    // Step 0 -> 1 transition triggers initial insert
    if (!curSessionId) {
      curSessionId = crypto.randomUUID()
      setSessionId(curSessionId)
      try {
        localStorage.setItem("fuelbox_onboarding_session_id", curSessionId)
      } catch (_) {}

      // Fire-and-forget insert if configured
      if (onboardingSupabase?.from) {
        onboardingSupabase.from("onboarding_progress").insert({
          id: curSessionId,
          status: "in_progress",
          current_step: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).then(({ error }: any) => {
          if (error) console.warn("Failed to create onboarding session in new DB:", error)
        }).catch(() => {})
      }
    }

    setStep(nextStep)
    try {
      localStorage.setItem("fuelbox_onboarding_step", String(nextStep))
      localStorage.setItem("fuelbox_onboarding_answers", JSON.stringify(updatedAnswers))
    } catch (_) {}

    // Update in new DB if configured — log result for verification
    if (onboardingSupabase?.from) {
      onboardingSupabase.from("onboarding_progress").update({
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
        updated_at: new Date().toISOString()
      }).eq("id", curSessionId).select().then(({ data, error }: any) => {
        if (error) console.error("[DB] ❌ Step update failed:", error)
        else console.log(`[DB] ✅ Step ${nextStep} saved:`, data)
      }).catch(() => {})
    }
  }

  const pick = (k: keyof OnboardingAnswers, v: any, next: number) => {
    const updated = { ...a, [k]: v }
    setA(updated)
    setTimeout(() => saveStep(next, updated), 260)
  }

  const askLocation = () => {
    setLoc((p) => ({ ...p, status: "loading" }))
    if (!navigator.geolocation) {
      setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const km = haversineKm(here, KITCHEN)
        const z = zoneFor(km)
        setLoc({ status: z.zone, km: Math.round(km * 10) / 10, fee: z.fee, lat: here.lat, lng: here.lng })
      },
      () => {
        setLoc({ status: "denied", km: null, fee: null, lat: null, lng: null })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const phoneOk = /^[6-9]\d{9}$/.test(a.phone)

  // Handle "Get My Plan" — only generates and displays the plan (no DB write, no WhatsApp)
  const handleFinalize = async () => {
    if (!phoneOk || !a.name.trim()) return
    setIsFinalizing(true)
    setFinalizationError("")

    try {
      // Save step 8 details to onboarding session
      await saveStep(8)

      // ─── Supabase profile sync if already logged in ───
      const oldSupabase = getSupabaseClient()
      if (loggedInUser && oldSupabase) {
        const mappedGoal = a.goal === 'loss' ? 'weight_loss' : a.goal === 'gain' ? 'weight_gain' : a.goal === 'muscle' ? 'muscle_gain' : 'maintenance'
        const mappedDiet = a.food === 'veg' ? 'vegetarian' : a.food === 'egg' ? 'eggetarian' : 'non_vegetarian'

        await updateUserProfile({
          full_name: a.name,
          phone: a.phone,
          gender: a.gender?.toLowerCase() as any,
          height: a.height,
          weight: a.weight,
          fitness_goal: mappedGoal as any,
          diet_type: mappedDiet as any,
        })
      }

      try {
        const cleanPhone = a.phone.replace(/\D/g, '')
        localStorage.setItem('fuelbox_pending_reg', JSON.stringify({ name: a.name, phone: cleanPhone || a.phone }))
        localStorage.setItem('fuelbox_onboarding_answers_final', JSON.stringify(a))
      } catch (_) {}

      // Clear onboarding progress keys
      localStorage.removeItem("fuelbox_onboarding_session_id")
      localStorage.removeItem("fuelbox_onboarding_step")
      localStorage.removeItem("fuelbox_onboarding_answers")

      // Show the results / meal plan screen
      setStep(9)
    } catch (err: any) {
      console.error("Finalization failed:", err)
      setFinalizationError(err.message || "Failed to finalize. Please check details and try again.")
    } finally {
      setIsFinalizing(false)
    }
  }

  const screen = () => {
    switch (step) {
      case 0: return (
        <div key="s0" className="anim" style={{ paddingTop: 48 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.muted, marginBottom: 6 }}>
            we don't count <span style={{ textDecoration: "line-through", textDecorationColor: C.yolk, textDecorationThickness: 2 }}>meals</span>.
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, textTransform: "uppercase", fontSize: "clamp(52px, 15vw, 84px)", lineHeight: 0.95, color: C.bone, margin: "0 0 18px" }}>
            We count<br /><span style={{ color: C.yolk }}>protein.</span>
          </h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.muted, lineHeight: 1.6, marginBottom: 32 }}>
            60 seconds. One plan built on your exact daily protein number — cooked and delivered in Coimbatore. Fuel your decision.
          </p>
          <PrimaryBtn onClick={() => saveStep(1)}>Find my number →</PrimaryBtn>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, textAlign: "center", marginTop: 14 }}>
            Free plan · No signup · Order on WhatsApp
          </div>
        </div>
      )

      case 1: return (
        <div key="s1" className="anim">
          <Eyebrow>Step 1 / {TOTAL}</Eyebrow>
          <Question>What's the goal?</Question>
          {Object.entries(GOALS).map(([k, g]) => (
            <OptionCard key={k} selected={a.goal === k} onClick={() => pick("goal", k, 2)} title={g.label} sub={g.sub} />
          ))}
        </div>
      )

      case 2: return (
        <div key="s2" className="anim">
          <Eyebrow>Step 2 / {TOTAL}</Eyebrow>
          <Question>About you.</Question>
          <Slider label="Age" unit="yrs" value={a.age} min={16} max={65} onChange={(v) => set("age", v)} />
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 10 }}>Gender</div>
          <div className="flex" style={{ gap: 10, marginBottom: 28 }}>
            {["Male", "Female"].map((g) => (
              <button key={g} onClick={() => set("gender", g)} style={{
                flex: 1, padding: "13px", borderRadius: 12, cursor: "pointer",
                fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15,
                background: a.gender === g ? "rgba(22,163,74,0.08)" : C.card,
                border: `1.5px solid ${a.gender === g ? C.yolk : C.line}`,
                color: a.gender === g ? C.yolk : C.bone, transition: "all 160ms",
              }}>{g}</button>
            ))}
          </div>
          <PrimaryBtn disabled={!a.gender} onClick={() => saveStep(3)}>Next →</PrimaryBtn>
        </div>
      )

      case 3: return (
        <div key="s3" className="anim">
          <Eyebrow>Step 3 / {TOTAL}</Eyebrow>
          <Question>Your build.</Question>
          <Slider label="Height" unit="cm" value={a.height} min={140} max={200} onChange={(v) => set("height", v)} />
          <Slider label="Weight" unit="kg" value={a.weight} min={40} max={130} onChange={(v) => set("weight", v)} />
          <PrimaryBtn onClick={() => saveStep(4)}>Next →</PrimaryBtn>
        </div>
      )

      case 4: return (
        <div key="s4" className="anim">
          <Eyebrow>Step 4 / {TOTAL}</Eyebrow>
          <Question>How do you eat?</Question>
          <OptionCard selected={a.food === "veg"} onClick={() => pick("food", "veg", 5)} title="Pure veg" sub="Paneer, soya, channa, millets" mark={<FoodMark type="veg" />} />
          <OptionCard selected={a.food === "egg"} onClick={() => pick("food", "egg", 5)} title="Veg + egg" sub="Everything veg, plus eggs" mark={<FoodMark type="egg" />} />
          <OptionCard selected={a.food === "nonveg"} onClick={() => pick("food", "nonveg", 5)} title="Non-veg" sub="Chicken, eggs, the works" mark={<FoodMark type="nonveg" />} />
        </div>
      )

      case 5: return (
        <div key="s5" className="anim">
          <Eyebrow>Step 5 / {TOTAL}</Eyebrow>
          <Question>Your day looks like…</Question>
          {Object.entries(ACTIVITY).map(([k, v]) => (
            <OptionCard key={k} selected={a.activity === k} onClick={() => pick("activity", k, 6)} title={v.label} sub={v.sub} />
          ))}
        </div>
      )

      case 6: return (
        <div key="s6" className="anim">
          <Eyebrow>Step 6 / {TOTAL}</Eyebrow>
          <Question>How many times<br />should we fuel you?</Question>
          {Object.entries(FREQS).map(([k, f]) => (
            <OptionCard key={k} selected={a.freq === Number(k)} onClick={() => pick("freq", Number(k), 7)}
              title={f.label} sub={f.sub}
              right={<span style={{
                fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                color: Number(k) === 3 ? "#FFFFFF" : C.yolk,
                background: Number(k) === 3 ? C.yolk : "rgba(22,163,74,0.10)",
                padding: "5px 10px", borderRadius: 20, textTransform: "uppercase",
              }}>{f.tag}</span>} />
          ))}
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>
            More FuelBox meals = more of your day on target = faster result. You'll see the difference on the next screen.
          </div>
        </div>
      )

      case 7: return (
        <div key="s7" className="anim">
          <Eyebrow>Step 7 / {TOTAL}</Eyebrow>
          <Question>Where do we<br />deliver?</Question>
          {loc.status === "idle" || loc.status === "loading" ? (
            <>
              <PrimaryBtn onClick={askLocation} disabled={loc.status === "loading"}>
                {loc.status === "loading" ? "Locating…" : "📍 Use my location"}
              </PrimaryBtn>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, lineHeight: 1.6, margin: "14px 0" }}>
                Free delivery within {FREE_KM} km of Nava India. Up to {MAX_KM} km: ₹{FEE_PER_KM}/km after the free zone — calculated live.
              </div>
              <button onClick={() => { setLoc({ status: "skip", km: null, fee: null, lat: null, lng: null }); saveStep(8) }}
                className="w-full" style={{
                  background: "transparent", border: `1.5px solid ${C.line}`, borderRadius: 12,
                  color: C.muted, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, padding: "13px", cursor: "pointer",
                }}>
                Skip — I'll confirm location on WhatsApp
              </button>
            </>
          ) : (
            <>
              <div style={{
                background: C.card, borderRadius: 14, padding: "18px",
                border: `1.5px solid ${loc.status === "out" ? C.nonveg : loc.status === "free" ? C.veg : C.line}`,
                marginBottom: 14,
              }}>
                {loc.status === "free" && (<>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, color: C.bone }}>You're {loc.km} km from our kitchen ✓</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.veg, marginTop: 4, fontWeight: 700 }}>FREE delivery for you</div>
                </>)}
                {loc.status === "paid" && (<>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, color: C.bone }}>You're {loc.km} km away</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.yolk, marginTop: 4, fontWeight: 700 }}>Delivery ₹{loc.fee}/day (₹{FEE_PER_KM}/km after {FREE_KM} km)</div>
                </>)}
                {loc.status === "out" && (<>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, color: C.bone }}>You're {loc.km} km out — just past our {MAX_KM} km ring 💔</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>We're Coimbatore-only for now. Drop your number — you're first in line when we expand.</div>
                </>)}
                {loc.status === "denied" && (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Couldn't get your location. No problem — we'll confirm delivery on WhatsApp.</div>
                )}
              </div>
              <PrimaryBtn onClick={() => saveStep(8)}>Next →</PrimaryBtn>
            </>
          )}
        </div>
      )

      case 8: return (
        <div key="s8" className="anim">
          <Eyebrow>Step 8 / {TOTAL}</Eyebrow>
          <Question>Where do we send<br />your plan?</Question>
          {finalizationError && (
            <div style={{ color: C.nonveg, fontSize: 13, background: "rgba(168,50,50,0.1)", border: `1px solid ${C.nonveg}`, borderRadius: 10, padding: 10, marginBottom: 12, fontFamily: FONT_BODY }}>
              {finalizationError}
            </div>
          )}
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "4px 16px", marginBottom: 10 }}>
            <input type="text" value={a.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Your name" className="w-full"
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: FONT_BODY, fontSize: 17, fontWeight: 600, color: C.bone, padding: "14px 0" }} />
          </div>
          <div className="flex items-center" style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "4px 16px", marginBottom: 12 }}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, color: C.muted, fontSize: 16, marginRight: 10 }}>+91</span>
            <input type="tel" inputMode="numeric" maxLength={10} value={a.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="WhatsApp number" className="w-full"
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: FONT_BODY, fontSize: 17, fontWeight: 600, color: C.bone, padding: "14px 0", letterSpacing: "0.06em" }} />
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
            Your plan + price lands on WhatsApp from Ajith. No spam, no calls.
          </div>
          <PrimaryBtn disabled={!phoneOk || !a.name.trim() || isFinalizing} onClick={handleFinalize}>
            {isFinalizing ? "Generating Plan..." : "Get my plan →"}
          </PrimaryBtn>
        </div>
      )

      case 9: return (
        <Result
          a={a}
          loc={loc}
          ing={ing}
          saveStep={saveStep}
          setLoc={setLoc}
        />
      )
      default: return null
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #e2f0e2 0%, #fde8d8 100%)" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        .anim { animation: fadeUp 320ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        input[type="range"]::-webkit-slider-thumb { cursor: pointer; }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid ${C.yolk}; outline-offset: 3px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .anim { animation: none; } * { transition: none !important; } }
      ` }} />

      <div className="mx-auto" style={{ maxWidth: 440, padding: "0 22px 48px" }}>
        <div className="flex items-center justify-between" style={{ padding: "20px 0 14px" }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="FuelBox" style={{ height: 32, width: 'auto', objectFit: 'contain' }} onError={(e) => {
              e.currentTarget.style.display = 'none';
              const textEl = e.currentTarget.nextSibling as HTMLDivElement;
              if (textEl) textEl.style.display = 'block';
            }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: "0.02em", fontWeight: 800, display: 'none' }}>
              <span style={{ color: "#16a34a" }}>Fuel</span><span style={{ color: "#111827" }}>Box</span>
            </div>
          </div>
          {step >= 1 && step <= TOTAL && (
            <button onClick={() => saveStep(step - 1)} style={{
              background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8,
              color: C.muted, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600,
              padding: "6px 12px", cursor: "pointer",
            }}>← Back</button>
          )}
        </div>
        {step >= 1 && step <= TOTAL && (
          <div style={{ height: 3, background: C.line, borderRadius: 2, marginBottom: 30 }}>
            <div style={{ height: "100%", width: `${(step / TOTAL) * 100}%`, background: C.yolk, borderRadius: 2, transition: "width 300ms ease" }} />
          </div>
        )}
        {screen()}
      </div>
    </div>
  )
}
