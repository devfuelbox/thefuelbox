import { useScrollReveal } from './useScrollReveal'

const features = [
  {
    title: 'Nutrition Focused',
    description: 'Curated by sports dietitians to match strict athletic macros. No added sugars, zero trans fats, and balanced glycemic loads for sustained daily performance.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
      </svg>
    ),
    accent: 'brand',
  },
  {
    title: 'Fresh Ingredients',
    description: '100% natural, farm-to-fork ingredients. Hand-picked vegetables and lean proteins cooked daily in hygienic FSSAI-certified kitchens. Never frozen.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
      </svg>
    ),
    accent: 'energy',
  },
  {
    title: 'Affordable Pricing',
    description: 'Subscriptions cost less than individual food app deliveries. Save on groceries, gas, cooking hours, and cleaning, with absolute price predictability.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1M18 12a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
    ),
    accent: 'brand',
  },
  {
    title: 'Gym Friendly Delivery',
    description: 'Delivered in food-grade leakproof containers right to your gym locker room, home, or office workspace. Optimized timing to fuel your workouts perfectly.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    accent: 'energy',
  },
]

const accentStyles = {
  brand: {
    bg: 'bg-brand-100',
    text: 'text-brand-600',
    hoverBg: 'group-hover:bg-brand-600',
    hoverText: 'group-hover:text-white',
    border: 'hover:border-brand-200',
  },
  energy: {
    bg: 'bg-energy-100',
    text: 'text-energy-600',
    hoverBg: 'group-hover:bg-energy-600',
    hoverText: 'group-hover:text-white',
    border: 'hover:border-energy-200',
  },
}

export default function WhyFuelBox() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="why-fuel-box"
      ref={ref}
      className="bg-brand-50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-energy-100 px-4 py-1.5 text-sm font-semibold text-energy-700">
            Why Choose Us
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Why Fuel Box?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            We&apos;re not just another food delivery app. We&apos;re your fitness nutrition partner.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const styles = accentStyles[feature.accent as keyof typeof accentStyles]
            return (
              <div
                key={feature.title}
                className={`glass-card hover:scale-110 group rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-500 hover:shadow-lg ${styles.border} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: isVisible ? `${index * 100}ms` : '0ms' }}
              >
                <div className={`inline-flex rounded-xl p-3 transition-colors duration-300 ${styles.bg} ${styles.text} ${styles.hoverBg} ${styles.hoverText}`}>
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900 font-heading">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
