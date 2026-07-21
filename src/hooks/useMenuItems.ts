import { useQuery } from '@tanstack/react-query';
import type { MenuItem } from '@/types/meal';
import { FUEL_BOX_MENU } from '@/data/fuelbox-menu';

function mapRow(row: Record<string, any>): MenuItem {
  return {
    id: String(row.id),
    name: row.name as string,
    description: (row.description as string) ?? '',
    price: Number(row.price),
    protein: Number(row.protein_g ?? row.protein ?? 0),
    carbs: Number(row.carbs_g ?? row.carbs ?? 0),
    fat: Number(row.fat_g ?? row.fat ?? 0),
    fiber: Number(row.fiber_g ?? row.fiber ?? 0),
    calories: Number(row.calories ?? 0),
    category: (row.category as MenuItem['category']) ?? 'combo',
    meal_type: 'post_workout',
    diet: (row.diet as MenuItem['diet']) ?? 'veg',
    image_url: (row.image_url as string) ?? null,
    is_available: row.is_available ?? true,
    score: row.score != null ? Number(row.score) : null,
    cookable: Boolean(row.cookable),
  };
}

export function useMenuItems() {
  return useQuery({
    queryKey: ['menu_items'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Failed to fetch menu from API');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(mapRow);
        }
      } catch (err) {
        console.warn('Using fallback menu data:', err);
      }
      return FUEL_BOX_MENU;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
