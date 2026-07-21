import { useQuery } from '@tanstack/react-query';
import type { FuelBoxFood } from '@/data/fuelbox-menu';
import { META } from '@/data/fuelbox-menu';

const DEFAULT_INGREDIENTS: FuelBoxFood[] = Object.keys(META).map((name, idx) => {
  const m = META[name];
  return {
    id: `ing-${idx + 1}-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    category: m.category,
    group: m.group,
    emoji: m.emoji,
    calories: 120,
    protein: 10,
    carbs: 15,
    fat: 4,
    fiber: 3,
    sugar: 0,
    sodium: 0,
    serving: 'per 100 g',
    tags: m.tags ?? [],
  };
});

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      return DEFAULT_INGREDIENTS;
    },
    staleTime: 1000 * 60 * 5,
  });
}
