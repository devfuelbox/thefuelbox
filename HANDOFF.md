# Fuel Box — Menu & Cart Handoff for Person #4

## Quick Start

```bash
git clone https://github.com/Ganesh-git-dev/fuel-box-website.git
cd fuel-box-website
git checkout feature/menu-cart
git pull origin feature/menu-cart
copy .env.example .env    # Windows
# npm install already done
npm run dev               # http://localhost:5173
```

---

## Branch: `feature/menu-cart`

You own **Menu** (`/menu`) and **Cart** (`/cart`) pages. Work only inside:
- `src/pages/Menu/`
- `src/pages/Cart/`
- Plus shared hooks/stores if needed (add exports to barrel files)

---

## Supabase — Live & Ready

**Project**: `ewyimfqupeddroieojhl`  
**URL in `.env`**: `https://ewyimfqupeddroieojhl.supabase.co`

3 tables exist with public SELECT (no auth needed to read):

### `menu_items` — 44 rows

| Column | Type | Example |
|--------|------|---------|
| `id` | bigint | 1 |
| `name` | text | "Chicken Breast (cooked)" |
| `description` | text | "" |
| `price` | numeric(8,2) | 28.00 |
| `calories` | numeric(7,1) | 165.0 |
| `protein_g` | numeric(6,1) | 31.0 |
| `carbs_g` | numeric(6,1) | 0 |
| `fat_g` | numeric(6,1) | 3.6 |
| `fiber_g` | numeric(6,1) | 0 |
| `score` | numeric(5,1) | 0 |
| `diet` | text | "veg" or "non-veg" |
| `category` | text | "main" or "side" |
| `is_available` | boolean | true |
| `cookable` | boolean | true/false |
| `image_url` | text | "" |
| `created_at` | timestamptz | auto |

### `ingredients` — 40 rows

Per-100g nutrition for all raw ingredients. Columns: `name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `vitamin_a_mcg`, `vitamin_c_mg`, `calcium_mg`, `iron_mg`, `potassium_mg`.

### `subscription_plans` — 9 rows

Pricing tiers: 1/2/3 meals/day × Essential/Pro/Elite. Columns: `name`, `meals_per_day`, `days_per_month`, `monthly_price`, etc.

---

## Menu Items Breakdown

**9 Main Dishes**: Chicken Breast, Paneer, Sweet Potato, White Rice, Chapati, Egg, Lettuce, Paneer Cheese Dressing, Soya

**35 Side Dishes**: All other ingredients (chickpeas, broccoli, fruits, veggies, channa varieties, combos, etc.)

**19 Cookable items** (need preparation = +Rs.5 cooking surcharge):
Chicken Breast, Paneer, Chickpeas, Sweet Potato, White Rice, Chapati, Broccoli, Egg, Green Beans, Cabbage, Purple Cabbage, Lettuce, Paneer Cheese Dressing, Channa with Onions, Black Channa, White Channa, Soya, Beetroot, Peanut

**2 Non-Veg items**: Chicken Breast, Egg (everything else is veg)

---

## Architecture for Menu + Cart

### Fetching Menu Data — `useMenuItems()` (already built)

```ts
import { useMenuItems } from '@/hooks'

function MyComponent() {
  const { data: meals, isLoading, error } = useMenuItems()
  // meals: MenuItem[] with all columns mapped
}
```

Uses **TanStack Query** with 5min cache. Fetches from Supabase `menu_items` table filtered by `is_available = true`.

### MenuItem Type (`src/types/meal.ts`)

```ts
interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  calories: number
  category: 'main' | 'side' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'combo'
  meal_type: 'pre_workout' | 'post_workout' | 'rest_day'
  diet: 'veg' | 'non_veg'
  image_url: string | null
  is_available: boolean
  score: number | null
  cookable: boolean
}
```

### Cart — Zustand Store (`src/store/cartStore.ts`)

```ts
interface CartStore {
  items: CartItem[]
  addItem: (menuItem: MenuItem, quantity?: number) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
}
```

### useCart Hook (`src/hooks/useCart.ts`)

```ts
import { useCart } from '@/hooks'

function MyComponent() {
  const { items, addItem, removeItem, totalItems, totalPrice } = useCart()
  addItem(menuItem, 1)    // adds or increments qty
  removeItem(menuItemId)  // removes entirely
}
```

### Routing

All route paths in `ROUTES` enum (`src/lib/constants.ts`):
```ts
ROUTES.MENU  → '/menu'
ROUTES.CART  → '/cart'
```

---

## Cooking Surcharge Logic (IMPORTANT)

Items with `cookable: true` incur a **flat Rs.5 surcharge per unique cookable item type** — NOT per quantity.

Examples:
- Chicken Breast × 2 → +Rs.5 (not +Rs.10)
- Chicken Breast × 2 + Paneer × 1 → +Rs.10 (Rs.5 each)
- Lettuce (not cookable) → +Rs.0

**Implement in cartStore.** The current `totalPrice()` is:

```ts
totalPrice: () => get().items.reduce(
  (sum, item) => sum + item.menuItem.price * item.quantity, 0
)
```

Update to:

```ts
totalPrice: () => {
  const items = get().items
  const basePrice = items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
  const cookingSurcharge = items.filter(item => item.menuItem.cookable).length * 5
  return basePrice + cookingSurcharge
}
```

Also update `CartItem` if needed, but the surcharge is calculated at checkout time — no need to store it per item.

---

## Already Built for You

| Feature | File | Status |
|---------|------|--------|
| Menu page with tabs (All / Main Dishes / Side Dishes) | `src/pages/Menu/index.tsx` | Done |
| Sticky filter tab bar | `src/pages/Menu/index.tsx` | Done |
| Loading spinner state | `src/pages/Menu/index.tsx` | Done |
| Error state | `src/pages/Menu/index.tsx` | Done |
| MealCard component | `src/pages/Menu/index.tsx` | Done |
| `useMenuItems` hook (TanStack Query + Supabase) | `src/hooks/useMenuItems.ts` | Done |
| `useCart` hook (wraps Zustand store) | `src/hooks/useCart.ts` | Done |
| Zustand cart store | `src/store/cartStore.ts` | Done |
| `fetchMenuItems()` in api.ts | `src/lib/api.ts` | Done |
| Supabase client (lazy init, null-safe) | `src/lib/supabaseClient.ts` | Done |
| Shared UI components | `src/components/ui/` | Done |

---

## What You Need to Build

- [ ] Update `totalPrice()` in cartStore to include cooking surcharge
- [ ] Cart page at `src/pages/Cart/` — display items, qty controls, remove, total
- [ ] Add-to-cart button on each Menu card (or "Add" + qty picker)
- [ ] Cart drawer (optional — mobile-friendly)
- [ ] Quantity update UI in Cart
- [ ] Empty cart state

---

## Conventions

1. No hardcoded colors — use Tailwind theme tokens (`text-brand-600`, `bg-energy-500`)
2. Use shared UI components (`Button`, `Input`, `Card`, `Badge`, `Select`, `Spinner`, `Modal`)
3. All Supabase calls through `src/lib/api.ts` or hooks — no direct `supabase.from()` in pages
4. Pages receive no props — read from Zustand stores or TanStack Query
5. Barrel exports in `src/hooks/index.ts`, `src/components/ui/index.ts`
6. Build before commit: `npm run build` (tsc + vite)
7. File names: PascalCase for components, camelCase for hooks/utils

---

## How to Verify

```bash
npm run dev       # Menu page loads live from Supabase at /menu
npm run build     # Zero errors expected
```

Menu page shows 44 items with filter tabs. Cart store is ready for you to wire up.

---

## Migration Scripts (for reference)

In `scripts/`:
- `migrate_menu.py` — regenerates menu_items from Excel data
- `add_cookable.py` — adds cookable column to DB
- `seed_data.py` — seeds all 3 tables from Excel
- `seed.sql` — raw SQL fallback
