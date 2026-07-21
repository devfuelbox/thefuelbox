import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

const steps = [
  {
    number: '01',
    title: 'Take Quiz',
    description: 'Tell us your fitness goals, dietary preferences, allergies, and daily schedule. Our smart engine maps your metabolic requirements in 2 minutes.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    link: ROUTES.QUIZ,
    linkText: 'Start Quiz',
  },
  {
    number: '02',
    title: 'Get Recommendation',
    description: 'Instantly receive a macro-accurate meal and subscription recommendation tailored to your caloric and nutrient needs.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    link: ROUTES.MENU,
    linkText: 'View Options',
  },
  {
    number: '03',
    title: 'Order Meal',
    description: 'Confirm your custom plan. Meals are prepared fresh in hygienic kitchens and delivered straight to your home, office, or gym partner hub.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    link: ROUTES.MENU,
    linkText: 'Order Now',
  },
  {
    number: '04',
    title: 'Track Progress',
    description: 'Track your deliveries, log workouts, monitor weight trends, and maintain calorie streaks inside your fitness dashboard.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
    link: ROUTES.HOME,
    linkText: 'Go to Dashboard',
  },
]

export default function HowItWorks() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="bg-white py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            Simple Process
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            How Fuel Box Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Achieving your dream physique is now as simple as clicking four times. No macro calculating, no prep stress.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`glass-card hover:scale-110 group relative rounded-2xl border border-gray-100 bg-gray-50 p-8 transition-all duration-500 hover:border-brand-200 hover:bg-brand-55 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: isVisible ? `${index * 150}ms` : '0ms' }}
            >
              {/* Step number */}
              <span className="text-5xl font-extrabold text-brand-100 font-heading transition-colors duration-300 group-hover:text-brand-200">
                {step.number}
              </span>

              {/* Icon */}
              <div className="mt-4 inline-flex rounded-xl bg-brand-100 p-3 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                {step.icon}
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900 font-heading">
                {step.title}
              </h3>
              <p className="mt-2 text-gray-500 leading-relaxed text-sm">
                {step.description}
              </p>

              <Link
                to={step.link}
                className="mt-4 inline-flex items-center text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                {step.linkText}
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              {/* Connector line (hidden on last item and mobile) */}
              {index < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden h-0.5 w-8 bg-brand-200 lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
