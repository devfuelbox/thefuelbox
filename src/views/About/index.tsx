export default function About() {
  const stats = [
    { value: '105B', label: 'Indian healthy food market (USD)' },
    { value: '73%', label: 'Indians with protein deficiency' },
    { value: '15%', label: 'Fitness market CAGR' },
    { value: '1st', label: 'Fitness-first food platform in India' },
  ]

  const values = [
    {
      title: 'Macro Accuracy',
      desc: 'Every meal tagged with verified protein, carbs, fat, and calories. No guesswork.',
    },
    {
      title: 'Workout Alignment',
      desc: 'Pre-workout, post-workout, or rest day — meals matched to your training schedule.',
    },
    {
      title: 'Partner Ecosystem',
      desc: 'Open network of certified healthy cloud kitchens, not a locked-in walled garden.',
    },
    {
      title: 'Local First',
      desc: 'Built for Indian taste buds, Indian ingredients, and Indian fitness goals.',
    },
  ]

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-600 to-brand-800 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-white font-heading sm:text-5xl">
            About Fuel Box
          </h1>
          <p className="mt-4 text-lg text-brand-100">
            Your Health Under Control
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-50 p-6 text-center">
              <p className="text-3xl font-extrabold text-brand-600">{s.value}</p>
              <p className="mt-1 text-sm text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 font-heading">Our Mission</h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            To make healthy eating simple, affordable, and accessible for every fitness-focused individual.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            Fuel Box stands for fuel for the body — nutrition that powers workouts. We deliver macro-accurate, goal-aligned meals to gym-goers and busy professionals who value their health but don't have time to meal prep.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 font-heading">The Problem</h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            73% of Indians consume less protein than the recommended daily intake. On existing food delivery platforms, healthy options are buried, overpriced, or have unreliable nutrition data. Gym-goers and busy professionals have no way to order meals that match their fitness goals and workout schedule.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            Every 9th order on Swiggy in January 2026 was a healthy food order — the demand is massive but no platform today integrates food delivery with fitness tracking.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 font-heading">Our Approach</h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Fuel Box launched in Coimbatore with a simple hypothesis: people who work out need proper fuel, but the food delivery apps they use don't know they work out. Starting with a pilot in Singanallur, we validated customer demand, subscription retention, and gym partnerships before expanding across the city and beyond.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            Our dynamic weekly menu rotation — Paneer Combo, Sprouts Combo, Mixed Protein, Channa Combo, Balanced Meal — ensures variety and prevents meal boredom, because we know that nutrition is a daily habit, not a one-time decision.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 font-heading text-center">
            The Fuel Box Difference
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-xl font-bold text-gray-900">{v.title}</h3>
                <p className="mt-2 text-gray-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 font-heading">Our Story</h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Born in Coimbatore, Fuel Box is building India's first fitness-integrated food ecosystem. We combine fitness goal tracking with macro-accurate meal delivery from certified partner kitchens. Starting with Phase 1 in Singanallur, we're expanding across Coimbatore and Tamil Nadu — with a vision to make healthy eating effortless for every fitness-focused Indian.
          </p>
        </div>
      </section>
    </div>
  )
}
