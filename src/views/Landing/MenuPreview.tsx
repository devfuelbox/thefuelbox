import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Badge } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

interface Meal {
  type: string
  name: string
  image: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

interface DayMenu {
  dayName: string
  comboName: string
  tagline: string
  meals: Meal[]
}

const weeklyMenu: DayMenu[] = [
  {
    dayName: 'Monday',
    comboName: 'Power-Up Kickstart Combo',
    tagline: 'High energy meals to fuel your start of the work and training week.',
    meals: [
      {
        type: 'Breakfast',
        name: 'Avocado Wholewheat Toast with Sunny-Side Eggs',
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 380,
        protein: 18,
        carbs: 32,
        fats: 14,
      },
      {
        type: 'Lunch/Dinner',
        name: 'Citrus Herb Grilled Chicken Breast with Quinoa Pilaf',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 550,
        protein: 48,
        carbs: 45,
        fats: 12,
      },
    ],
  },
  {
    dayName: 'Tuesday',
    comboName: 'Lean Define Combo',
    tagline: 'Calorie-optimized options focusing on lean protein retention and low fat.',
    meals: [
      {
        type: 'Breakfast',
        name: 'High-Protein Blueberry Oats Pancakes',
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 410,
        protein: 26,
        carbs: 48,
        fats: 8,
      },
      {
        type: 'Lunch/Dinner',
        name: 'Sesame Teriyaki Tofu & Steamed Broccoli Brown Rice',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 480,
        protein: 28,
        carbs: 58,
        fats: 10,
      },
    ],
  },
  {
    dayName: 'Wednesday',
    comboName: 'Midweek Recovery Combo',
    tagline: 'Packed with Omega-3 fats and slow-digesting clean carbs to heal muscle tissue.',
    meals: [
      {
        type: 'Breakfast',
        name: 'Egg White Frittata with Mushrooms & Spinach',
        image: 'https://images.unsplash.com/photo-1513442542250-854d436a73f2?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 320,
        protein: 24,
        carbs: 12,
        fats: 10,
      },
      {
        type: 'Lunch/Dinner',
        name: 'Baked Atlantic Salmon with Rosemary Roasted Sweet Potatoes',
        image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 590,
        protein: 42,
        carbs: 40,
        fats: 18,
      },
    ],
  },
  {
    dayName: 'Thursday',
    comboName: 'Metabolic Booster Combo',
    tagline: 'High fiber and thermogenic spice blends to naturally elevate metabolism.',
    meals: [
      {
        type: 'Breakfast',
        name: 'Greek Yogurt Parfait with Mixed Berries & Chia',
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 290,
        protein: 20,
        carbs: 28,
        fats: 6,
      },
      {
        type: 'Lunch/Dinner',
        name: 'Zesty Lentil Medley Bowl with Grilled Paneer / Chicken',
        image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 520,
        protein: 36,
        carbs: 52,
        fats: 12,
      },
    ],
  },
  {
    dayName: 'Friday',
    comboName: 'Weekend Warrior Fuel',
    tagline: 'A clean yet super-tasty combo to prime your glycogen stores for weekend sports.',
    meals: [
      {
        type: 'Breakfast',
        name: 'Smoked Turkey / Paneer Wholewheat Breakfast Wrap',
        image: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 360,
        protein: 22,
        carbs: 35,
        fats: 10,
      },
      {
        type: 'Lunch/Dinner',
        name: 'Spicy Chicken/Chickpea Tikka Masala with Cauliflower Rice',
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&h=200&fit=crop&auto=format&fm=webp',
        calories: 510,
        protein: 45,
        carbs: 22,
        fats: 16,
      },
    ],
  },
]

export default function MenuPreview() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  const activeDay = weeklyMenu[selectedDayIndex]

  // Calculate total combo macros
  const totalMacros = activeDay.meals.reduce(
    (acc, meal) => {
      acc.calories += meal.calories
      acc.protein += meal.protein
      acc.carbs += meal.carbs
      acc.fats += meal.fats
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  )

  return (
    <section
      id="menu-preview"
      ref={ref}
      className="bg-gray-50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            Fresh Menu Preview
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Daily Menu Preview
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Take a sneak peek at what your weekly healthy plan looks like. Swap meals anytime inside your active subscription.
          </p>
        </div>

        {/* Day selection tabs */}
        <div className="mt-12 flex flex-wrap justify-center">
          <div className="cir-tabs clay-card">
            {weeklyMenu.map((day, idx) => (
              <label key={day.dayName} className="flex items-center">
                <input
                  type="radio"
                  name="day-tab"
                  className="cir-tabs__r"
                  checked={selectedDayIndex === idx}
                  onChange={() => setSelectedDayIndex(idx)}
                />
                <span className="cir-tabs__t">{day.dayName}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Active combo showcase */}
        <div className="mt-8 max-w-4xl mx-auto">
          <Card key={selectedDayIndex} className="bg-white border border-gray-150 p-6 md:p-8 shadow-sm animate-[fadeSlideUp_0.5s_ease-out]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 mb-6 gap-4">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">{activeDay.dayName} Combos</span>
                <h3 className="text-2xl font-bold text-gray-900 font-heading mt-1">{activeDay.comboName}</h3>
                <p className="text-sm text-gray-500 mt-1">{activeDay.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-brand-50 border border-brand-200 text-brand-700 rounded-lg px-3 py-1 font-semibold text-xs">
                  {totalMacros.calories} Calories
                </Badge>
                <Badge className="bg-energy-50 border border-energy-200 text-energy-700 rounded-lg px-3 py-1 font-semibold text-xs">
                  {totalMacros.protein}g Protein
                </Badge>
                <Badge className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-1 font-semibold text-xs">
                  {totalMacros.carbs}g Carbs
                </Badge>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {activeDay.meals.map((meal, index) => (
                <div key={index} className="flex gap-4 border border-gray-50 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="h-24 w-24 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <img
                      src={meal.image}
                      alt={meal.name}
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        (e.currentTarget.parentElement as HTMLDivElement).innerHTML = '<span class="text-2xl">🍽️</span>';
                      }}
                    />
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white border px-2 py-0.5 rounded-full mb-1">
                        {meal.type}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 leading-snug">{meal.name}</h4>
                    </div>
                    <div className="flex gap-3 text-xs font-medium text-gray-500 mt-2">
                      <span>{meal.calories} kcal</span>
                      <span>•</span>
                      <span>P: {meal.protein}g</span>
                      <span>•</span>
                      <span>C: {meal.carbs}g</span>
                      <span>•</span>
                      <span>F: {meal.fats}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center border-t pt-6 gap-4">
              <span className="text-xs text-gray-400">
                * Nutritional values are indicative and depend on customization choices.
              </span>
              <div className="flex gap-4 w-full sm:w-auto">
                <Link to={ROUTES.MENU} className="w-full sm:w-auto">
                  <Button className="w-full justify-center bg-gray-900 text-white hover:bg-brand-600 py-2.5 px-6 rounded-lg cursor-pointer">
                    Explore Menu
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
