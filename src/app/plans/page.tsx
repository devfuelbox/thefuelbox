'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Dumbbell,
  HeartPulse,
  Leaf,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

type Goal =
  | 'all'
  | 'weight-loss'
  | 'muscle-gain'
  | 'weight-gain'
  | 'healthy-lifestyle';

type Plan = {
  id: number;
  name: string;
  description: string;
  goal: Exclude<Goal, 'all'>;
  calories: string;
  protein: string;
  meals: number;
  duration: string;
  price: number;
  popular?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    id: 1,
    name: 'Weight Loss Plan',
    description:
      'A balanced calorie-controlled meal plan designed to support healthy and sustainable weight loss.',
    goal: 'weight-loss',
    calories: '1200–1500',
    protein: '60–80g',
    meals: 3,
    duration: '7 Days',
    price: 999,
    popular: true,
    features: [
      'Calorie-controlled meals',
      'High-protein food options',
      'Fresh vegetables and fruits',
      'Balanced nutrition',
    ],
  },
  {
    id: 2,
    name: 'Muscle Gain Plan',
    description:
      'A protein-rich meal plan designed to support muscle growth, recovery, and strength.',
    goal: 'muscle-gain',
    calories: '2200–2800',
    protein: '120–160g',
    meals: 5,
    duration: '7 Days',
    price: 1499,
    features: [
      'High-protein meals',
      'Muscle recovery nutrition',
      'Energy-rich food options',
      'Balanced carbohydrates',
    ],
  },
  {
    id: 3,
    name: 'Healthy Weight Gain',
    description:
      'A nutritious calorie-surplus plan for people looking to gain healthy weight with quality food.',
    goal: 'weight-gain',
    calories: '2200–2600',
    protein: '80–110g',
    meals: 4,
    duration: '7 Days',
    price: 1299,
    features: [
      'Healthy calorie surplus',
      'Nutrient-dense meals',
      'Healthy fats and nuts',
      'Protein-rich food',
    ],
  },
  {
    id: 4,
    name: 'Healthy Lifestyle',
    description:
      'A well-balanced everyday meal plan for maintaining a healthy lifestyle and good nutrition.',
    goal: 'healthy-lifestyle',
    calories: '1600–2000',
    protein: '70–100g',
    meals: 3,
    duration: '7 Days',
    price: 1099,
    features: [
      'Balanced everyday meals',
      'Fresh fruits and vegetables',
      'Healthy food choices',
      'Complete daily nutrition',
    ],
  },
];

const filters = [
  {
    id: 'all' as Goal,
    label: 'All Plans',
    icon: HeartPulse,
  },
  {
    id: 'weight-loss' as Goal,
    label: 'Weight Loss',
    icon: TrendingDown,
  },
  {
    id: 'muscle-gain' as Goal,
    label: 'Muscle Gain',
    icon: Dumbbell,
  },
  {
    id: 'weight-gain' as Goal,
    label: 'Weight Gain',
    icon: TrendingUp,
  },
  {
    id: 'healthy-lifestyle' as Goal,
    label: 'Healthy Lifestyle',
    icon: Leaf,
  },
];

export default function PlansPage() {
  const [activeGoal, setActiveGoal] =
    useState<Goal>('all');

  const [searchTerm, setSearchTerm] =
    useState('');

  const filteredPlans = useMemo(() => {
    const search = searchTerm
      .toLowerCase()
      .trim();

    return plans.filter((plan) => {
      const matchesGoal =
        activeGoal === 'all' ||
        plan.goal === activeGoal;

      const matchesSearch =
        !search ||
        plan.name
          .toLowerCase()
          .includes(search) ||
        plan.description
          .toLowerCase()
          .includes(search);

      return (
        matchesGoal &&
        matchesSearch
      );
    });
  }, [activeGoal, searchTerm]);

  const hasFilters =
    activeGoal !== 'all' ||
    searchTerm !== '';

  const clearFilters = () => {
    setActiveGoal('all');
    setSearchTerm('');
  };

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <Target className="h-7 w-7 text-brand-600" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 sm:text-sm">
            Eat Better. Live Better.
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Choose Your Meal Plan
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Choose a meal plan that matches your health,
            fitness, and nutrition goals.
          </p>

        </div>
      </section>


      {/* Filters */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">

          <div className="flex flex-col gap-3">

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search meal plans..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* Goal Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">

              {filters.map((filter) => {
                const Icon = filter.icon;

                const isActive =
                  activeGoal === filter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      setActiveGoal(filter.id)
                    }
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition sm:text-sm ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />

                    {filter.label}
                  </button>
                );
              })}

            </div>

          </div>

        </div>
      </section>


      {/* Plans */}
      <section className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8">

        {/* Result Header */}
        <div className="mb-6 flex items-center justify-between">

          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              Meal Plans
            </h2>

            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {filteredPlans.length} plans available
            </p>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold text-red-600"
            >
              <X className="h-4 w-4" />

              Clear
            </button>
          )}

        </div>


        {/* Empty State */}
        {filteredPlans.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">

            <Search className="mx-auto h-8 w-8 text-gray-400" />

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No plans found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Try another search or category.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              View All Plans
            </button>

          </div>

        ) : (

          /* Plan Cards */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {filteredPlans.map((plan) => (

              <article
                key={plan.id}
                className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg ${
                  plan.popular
                    ? 'border-brand-500'
                    : 'border-gray-200'
                }`}
              >

                {/* Popular */}
                {plan.popular && (
                  <div className="absolute right-4 top-4 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Popular
                  </div>
                )}


                {/* Card Header */}
                <div className="p-5 sm:p-6">

                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {plan.goal.replace(
                      '-',
                      ' '
                    )}
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-gray-900">
                    {plan.name}
                  </h3>

                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-gray-600">
                    {plan.description}
                  </p>


                  {/* Price */}
                  <div className="mt-5 border-t border-gray-100 pt-5">

                    <span className="text-3xl font-bold text-gray-900">
                      ₹{plan.price}
                    </span>

                    <span className="ml-1 text-sm text-gray-500">
                      / {plan.duration}
                    </span>

                  </div>

                </div>


                {/* Stats */}
                <div className="grid grid-cols-3 border-y border-gray-100 bg-gray-50">

                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-500">
                      Calories
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {plan.calories}
                    </p>
                  </div>

                  <div className="border-x border-gray-100 p-3 text-center">
                    <p className="text-xs text-gray-500">
                      Protein
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {plan.protein}
                    </p>
                  </div>

                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-500">
                      Meals
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {plan.meals}/day
                    </p>
                  </div>

                </div>


                {/* Features */}
                <div className="p-5 sm:p-6">

                  <h4 className="text-sm font-bold text-gray-900">
                    What's Included
                  </h4>

                  <ul className="mt-4 space-y-3">

                    {plan.features.map(
                      (feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />

                          <span>
                            {feature}
                          </span>
                        </li>
                      )
                    )}

                  </ul>


                  {/* Button */}
                  <button
                    type="button"
                    className="mt-6 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    View Plan
                  </button>

                </div>

              </article>

            ))}

          </div>

        )}

      </section>

    </main>
  );
}