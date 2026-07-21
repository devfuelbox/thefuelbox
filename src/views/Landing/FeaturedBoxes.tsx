import { useNavigate } from 'react-router-dom'
import Image from 'next/image'
import { Card, Button, Badge } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

interface FuelBoxPreview {
  type: string
  title: string
  subtitle: string
  description: string
  macros: {
    protein: string
    carbs: string
    fats: string
    calories: string
  }
  dishes: string[]
  accentColor: string
  badgeText: string
  badgeColor: string
  buttonClass: string
  image: string
}

const boxes: FuelBoxPreview[] = [
  {
    type: 'veg',
    title: 'Veg Fuel Box',
    subtitle: '100% Plant-Based Strength',
    description: 'Packed with premium paneer, tofu, organic quinoa, sprouted lentils, and fresh leafy greens. Designed for clean plant-based muscle recovery and gut wellness.',
    macros: {
      protein: '35g - 42g',
      carbs: '55g - 65g',
      fats: '12g - 16g',
      calories: '550 - 620 kcal',
    },
    dishes: ['Paneer Tikka Salad with Mint Dressing', 'Quinoa & Black Bean Power Bowl', 'High-Protein Lentil & Spinach Mash', 'Sesame Tofu Stir Fry with Brown Rice'],
    accentColor: 'border-emerald-500/20 hover:border-emerald-500 shadow-emerald-500/5',
    badgeText: 'Pure Vegetarian',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300&fm=webp',
  },
  {
    type: 'non-veg',
    title: 'Non-Veg Fuel Box',
    subtitle: 'Lean Animal Protein & Power',
    description: 'Features farm-fresh chicken breast, wild-caught salmon, lean turkey, and egg whites combined with energy-giving complex carbohydrates and steamed greens.',
    macros: {
      protein: '45g - 58g',
      carbs: '48g - 60g',
      fats: '10g - 14g',
      calories: '580 - 680 kcal',
    },
    dishes: ['Herb Grilled Chicken with Steamed Broccoli', 'Teriyaki Wild Salmon & Quinoa Pilaf', 'Egg White Scramble with Sweet Potato Mash', 'Lean Chicken Keema Wrap with Wholewheat'],
    accentColor: 'border-orange-500/20 hover:border-orange-500 shadow-orange-500/5',
    badgeText: 'Lean Meat & Eggs',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    buttonClass: 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300&fm=webp',
  },
]

export default function FeaturedBoxes() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()
  const navigate = useNavigate()

  const handleCustomizeBox = (dietType: string) => {
    localStorage.setItem('selectedDiet', dietType)
    navigate(ROUTES.REGISTER)
  }

  return (
    <section
      id="featured-boxes"
      ref={ref}
      className="bg-white py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-energy-100 px-4 py-1.5 text-sm font-semibold text-energy-700">
            Our Core Menu
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Featured Fuel Boxes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Handcrafted by culinary chefs and approved by certified nutritionists to ensure perfect flavor and macronutrient harmony.
          </p>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-2 max-w-5xl mx-auto">
          {boxes.map((box, index) => (
            <Card
              key={box.type}
              hover
              className={`overflow-hidden border bg-white flex flex-col justify-between transition-all duration-700 ${box.accentColor} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: isVisible ? `${index * 200}ms` : '0ms' }}
            >
              <div>
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={box.image}
                    alt={box.title}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className={`${box.badgeColor} border-none font-semibold px-3 py-1 text-xs uppercase tracking-wider rounded-full shadow-sm`}>
                      {box.badgeText}
                    </Badge>
                  </div>
                </div>

                <div className="p-6 pb-0">
                  <h3 className="text-2xl font-bold text-gray-900 font-heading">{box.title}</h3>
                  <p className="text-sm font-medium text-brand-600 mt-1 mb-4">{box.subtitle}</p>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">{box.description}</p>

                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Macronutrient Target Per Meal</h4>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <span className="block text-xs text-gray-400 font-medium">Protein</span>
                        <span className="text-sm font-bold text-gray-800">{box.macros.protein}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <span className="block text-xs text-gray-400 font-medium">Carbs</span>
                        <span className="text-sm font-bold text-gray-800">{box.macros.carbs}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <span className="block text-xs text-gray-400 font-medium">Fats</span>
                        <span className="text-sm font-bold text-gray-800">{box.macros.fats}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <span className="block text-xs text-gray-400 font-medium">Energy</span>
                        <span className="text-sm font-bold text-brand-600">{box.macros.calories}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sample Weekly Delights</h4>
                    <ul className="space-y-2">
                      {box.dishes.map((dish, i) => (
                        <li key={i} className="flex items-center text-xs text-gray-600 gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${box.type === 'veg' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                          {dish}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                <Button
                  className={`w-full justify-center py-2.5 rounded-xl font-semibold shadow-sm transition-all duration-300 ${box.buttonClass}`}
                  onClick={() => handleCustomizeBox(box.type)}
                >
                  Customize Your Box
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
