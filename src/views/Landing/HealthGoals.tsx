import { useNavigate } from 'react-router-dom'
import { Card, Button } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

interface GoalCategory {
  title: string
  subtitle: string
  description: string
  stats: string
  colorClass: string
  badgeColor: string
  icon: React.ReactNode
  goalKey: string
}

const goals: GoalCategory[] = [
  {
    title: 'Weight Loss',
    subtitle: 'Fat Burn & Lean Muscle Definition',
    description: 'Scientifically calibrated calorie-deficit meals high in dietary fiber and protein. Keeps you full for hours while melting stubborn fat reserves.',
    stats: 'Avg. 450 kcal | 35g Protein',
    colorClass: 'border-emerald-500/20 hover:border-emerald-500 hover:shadow-emerald-500/5',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    goalKey: 'weight_loss',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2M2 22h20N12 2a10 10 0 110 20 10 10 0 010-20z" />
      </svg>
    ),
  },
  {
    title: 'Weight Gain',
    subtitle: 'Healthy Calorie Surplus & Size',
    description: 'Clean carb loading and calorie-dense whole foods designed to build healthy body mass and increase power without storing excess body fat.',
    stats: 'Avg. 800 kcal | 45g Protein',
    colorClass: 'border-orange-500/20 hover:border-orange-500 hover:shadow-orange-500/5',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    goalKey: 'weight_gain',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: 'Healthy Weight',
    subtitle: 'Macro Balance & Daily Vitality',
    description: 'Perfect for maintaining your physique, boosting mental clarity, and stabilizing energy throughout the work or gym day.',
    stats: 'Avg. 600 kcal | 30g Protein',
    colorClass: 'border-blue-500/20 hover:border-blue-500 hover:shadow-blue-500/5',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    goalKey: 'balanced_meal',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Muscle Building',
    subtitle: 'Hypertrophy & Strength Optimization',
    description: 'Protein-packed meals loaded with complex carbs and vital amino acids to accelerate tissue synthesis, repair fibers, and skyrocket recovery.',
    stats: 'Avg. 700 kcal | 55g Protein',
    colorClass: 'border-red-500/20 hover:border-red-500 hover:shadow-red-500/5',
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    goalKey: 'muscle_building',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
]

export default function HealthGoals() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()
  const navigate = useNavigate()

  const handleSelectGoal = (goalKey: string) => {
    localStorage.setItem('selectedGoal', goalKey)
    navigate(ROUTES.REGISTER)
  }

  return (
    <section
      id="health-goals"
      ref={ref}
      className="bg-gray-50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            Tailored To You
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Choose Your Health Goal
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            No matter what you're training for, we customize meal plans to match your metabolic needs.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {goals.map((goal, index) => (
            <Card
              key={goal.title}
              hover
              className={`glass-card hover:scale-110 flex flex-col justify-between border bg-white p-6 transition-all duration-500 ${goal.colorClass} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: isVisible ? `${index * 100}ms` : '0ms' }}
            >
              <div>
                <div className={`inline-flex rounded-xl p-3 ${goal.badgeColor} mb-4`}>
                  {goal.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 font-heading">{goal.title}</h3>
                <p className="text-xs font-semibold text-brand-600 mt-1 mb-3">{goal.subtitle}</p>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{goal.description}</p>
              </div>

              <div className="mt-6">
                <div className="text-xs font-semibold text-gray-400 mb-4 border-t pt-3 flex justify-between">
                  <span>Target Nutrition:</span>
                  <span className="text-gray-700">{goal.stats}</span>
                </div>
                <Button
                  className="w-full justify-center bg-gray-900 hover:bg-brand-600 text-white transition-colors duration-300 py-2 rounded-lg cursor-pointer"
                  onClick={() => handleSelectGoal(goal.goalKey)}
                >
                  Select Goal
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
