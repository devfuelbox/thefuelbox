import { useScrollReveal } from './useScrollReveal'

interface NutrientHighlight {
  name: string
  target: string
  percentage: number
  description: string
  role: string
  color: string
  bgColor: string
  strokeColor: string
}

const nutrients: NutrientHighlight[] = [
  {
    name: 'Protein',
    target: '45g - 55g / meal',
    percentage: 85,
    role: 'Muscle Recovery & Hypertrophy',
    description: 'High-density amino acid profiles from lean chicken, paneer, and whey isolate to kickstart protein synthesis and maintain muscle mass.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    strokeColor: 'stroke-orange-500',
  },
  {
    name: 'Carbs',
    target: '50g - 65g / meal',
    percentage: 70,
    role: 'Glycogen Replenishment & Energy',
    description: 'Clean complex carbohydrates including brown rice, quinoa, and sweet potatoes that release glucose slowly, preventing insulin spikes.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    strokeColor: 'stroke-emerald-500',
  },
  {
    name: 'Fiber',
    target: '8g - 12g / meal',
    percentage: 90,
    role: 'Digestion & Prolonged Satiety',
    description: 'Crucial soluble and insoluble fibers from broccoli, zucchini, oats, and chia seeds to support a thriving gut microbiome and slow digestion.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    strokeColor: 'stroke-blue-500',
  },
  {
    name: 'Vitamins & Minerals',
    target: '100% RDA / day',
    percentage: 95,
    role: 'Metabolic & Immune Support',
    description: 'Packed with micronutrients like Zinc, Magnesium, Vitamin D, and B-Complex from colorful organic veggies and superfoods.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    strokeColor: 'stroke-purple-500',
  },
]

export default function NutritionHighlights() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="nutrition-highlights"
      ref={ref}
      className="bg-brand-50/50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            Scientifically Formulated
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Today's Nutrition Highlights
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Every box is precisely structured to contain optimal levels of essential nutrients to fuel your healthy lifestyle.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {nutrients.map((nutrient, index) => {
            return (
              <div
                key={nutrient.name}
                className={`glass-card hover:scale-110 flex flex-col justify-between bg-white border border-gray-100 p-8 rounded-2xl shadow-sm transition-all duration-500 hover:shadow-md ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: isVisible ? `${index * 100}ms` : '0ms' }}
              >
                <div>
                  {/* Gauge indicator */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="relative flex items-center justify-center h-20 w-20">
                      {/* SVG Gauge */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          className="stroke-gray-100 fill-none"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          className={`fill-none transition-all duration-1000 ease-out ${nutrient.strokeColor}`}
                          strokeWidth="6"
                          strokeDasharray="213.6"
                          strokeDashoffset={isVisible ? 213.6 - (213.6 * nutrient.percentage) / 100 : 213.6}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-sm font-extrabold text-gray-800 font-heading">
                        {nutrient.percentage}%
                      </span>
                    </div>

                    <span className={`inline-block rounded-lg px-3 py-1 text-xs font-semibold ${nutrient.bgColor} ${nutrient.color}`}>
                      {nutrient.target}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 font-heading">
                    {nutrient.name}
                  </h3>
                  <p className="text-xs font-bold text-brand-600 mt-1 mb-3">
                    {nutrient.role}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {nutrient.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
