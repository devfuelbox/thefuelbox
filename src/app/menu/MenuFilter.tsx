'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import type { MenuItemData } from '@/app/menu/page';

type FilterType =
  | 'all'
  | 'veg'
  | 'non-veg';

export default function MenuFilter({
  meals,
}: {
  meals: MenuItemData[];
}) {
  const [dietFilter, setDietFilter] =
    useState<FilterType>('all');

  const [categoryFilter, setCategoryFilter] =
    useState<string>('all');

  const [searchTerm, setSearchTerm] =
    useState('');

  const [showFilters, setShowFilters] =
    useState(false);

  /*
   * Get unique categories from database
   *
   * Example:
   * main
   * side
   * fruits
   * nuts
   * vegetables
   * etc.
   */
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        meals
          .map((meal) => meal.category)
          .filter(Boolean)
      )
    );

    return uniqueCategories;
  }, [meals]);

  /*
   * Filter Meals
   */
  const filteredMeals = useMemo(() => {
    return meals.filter((meal) => {

      // Diet filter
      const matchesDiet =
        dietFilter === 'all' ||
        meal.diet.toLowerCase() === dietFilter;

      // Category filter
      const matchesCategory =
        categoryFilter === 'all' ||
        meal.category === categoryFilter;

      // Search
      const search =
        searchTerm.toLowerCase().trim();

      const matchesSearch =
        !search ||
        meal.name
          .toLowerCase()
          .includes(search) ||
        meal.category
          .toLowerCase()
          .includes(search);

      return (
        matchesDiet &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    meals,
    dietFilter,
    categoryFilter,
    searchTerm,
  ]);

  /*
   * Reset Filters
   */
  const resetFilters = () => {
    setDietFilter('all');
    setCategoryFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters =
    dietFilter !== 'all' ||
    categoryFilter !== 'all' ||
    searchTerm !== '';

  return (
    <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">

      {/* Search + Filter Button */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">

        {/* Search */}
        <div className="relative flex-1">

          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search food..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />

        </div>

        {/* Mobile Filter Button */}
        <button
          type="button"
          onClick={() =>
            setShowFilters(!showFilters)
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 sm:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />

          Filters
        </button>

      </div>


      {/* Filters */}
      <div
        className={`${
          showFilters
            ? 'block'
            : 'hidden'
        } mb-6 sm:block`}
      >

        <div className="rounded-2xl border border-gray-200 bg-white p-4">

          {/* Diet Filter */}
          <div>

            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Food Type
            </h3>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={() =>
                  setDietFilter('all')
                }
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  dietFilter === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() =>
                  setDietFilter('veg')
                }
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  dietFilter === 'veg'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                🟢 Veg
              </button>

              <button
                type="button"
                onClick={() =>
                  setDietFilter('non-veg')
                }
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  dietFilter === 'non-veg'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                🔴 Non-Veg
              </button>

            </div>

          </div>


          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-5">

              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Categories
              </h3>

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setCategoryFilter('all')
                  }
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    categoryFilter === 'all'
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>

                {categories.map(
                  (category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        setCategoryFilter(category)
                      }
                      className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${
                        categoryFilter === category
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {category.replace(
                        /([A-Z])/g,
                        ' $1'
                      )}
                    </button>
                  )
                )}

              </div>

            </div>
          )}


          {/* Reset */}
          {hasActiveFilters && (
            <div className="mt-5 border-t border-gray-100 pt-4">

              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />

                Clear all filters
              </button>

            </div>
          )}

        </div>

      </div>


      {/* Result Header */}
      <div className="mb-5 flex items-center justify-between">

        <div>

          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Available Meals
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Showing {filteredMeals.length} of{' '}
            {meals.length} meals
          </p>

        </div>

      </div>


      {/* Empty State */}
      {filteredMeals.length === 0 ? (

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-6 w-6 text-gray-400" />
          </div>

          <h2 className="text-lg font-semibold text-gray-900">
            No food items found
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Try changing your search or filters.
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Clear Filters
          </button>

        </div>

      ) : (

        /* Food Cards */
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

          {filteredMeals.map((meal) => (

            <article
              key={meal.id}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg sm:rounded-2xl"
            >

              {/* Image */}
              <div className="relative aspect-square overflow-hidden bg-gray-100 sm:aspect-[4/3]">

                {meal.image_url ? (
                  <img
                    src={`/images/${meal.image_url}`}
                    alt={meal.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    No Image
                  </div>
                )}

                {/* Diet Badge */}
                {meal.diet && (
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-semibold uppercase sm:left-3 sm:top-3 sm:px-3 sm:text-xs ${
                      meal.diet.toLowerCase() === 'veg'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {meal.diet}
                  </span>
                )}

              </div>


              {/* Content */}
              <div className="p-3 sm:p-4">

                {/* Category */}
                {meal.category && (
                  <p className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-brand-600 sm:text-xs">
                    {meal.category}
                  </p>
                )}

                {/* Name */}
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-gray-900 sm:min-h-[3rem] sm:text-base sm:leading-6">
                  {meal.name}
                </h3>


                {/* Nutrition */}
                <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-gray-100 pt-3 sm:mt-4 sm:gap-2 sm:pt-4">

                  <div className="rounded-md bg-gray-50 px-2 py-1.5 sm:rounded-lg sm:px-3 sm:py-2">
                    <p className="text-[9px] text-gray-500 sm:text-xs">
                      Calories
                    </p>

                    <p className="text-xs font-bold text-gray-900 sm:text-sm">
                      {meal.calories}
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-50 px-2 py-1.5 sm:rounded-lg sm:px-3 sm:py-2">
                    <p className="text-[9px] text-gray-500 sm:text-xs">
                      Protein
                    </p>

                    <p className="text-xs font-bold text-gray-900 sm:text-sm">
                      {meal.protein_g}g
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-50 px-2 py-1.5 sm:rounded-lg sm:px-3 sm:py-2">
                    <p className="text-[9px] text-gray-500 sm:text-xs">
                      Carbs
                    </p>

                    <p className="text-xs font-bold text-gray-900 sm:text-sm">
                      {meal.carbs_g}g
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-50 px-2 py-1.5 sm:rounded-lg sm:px-3 sm:py-2">
                    <p className="text-[9px] text-gray-500 sm:text-xs">
                      Fat
                    </p>

                    <p className="text-xs font-bold text-gray-900 sm:text-sm">
                      {meal.fat_g}g
                    </p>
                  </div>

                </div>


                {/* Fiber */}
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 sm:mt-3 sm:pt-3">

                  <span className="text-[10px] text-gray-500 sm:text-xs">
                    Fiber
                  </span>

                  <span className="text-xs font-semibold text-gray-900 sm:text-sm">
                    {meal.fiber_g}g
                  </span>

                </div>

              </div>

            </article>

          ))}

        </div>

      )}

    </section>
  );
}