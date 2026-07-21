export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'combo' | 'main' | 'side' | 'combo1' | 'combo2' | 'combo3' | 'combo4';
export type MealType = 'pre_workout' | 'post_workout' | 'rest_day'
export type DietCategory = 'veg' | 'non_veg'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  calories: number
  category: MealCategory
  meal_type: MealType
  diet: DietCategory
  image_url: string | null
  is_available: boolean
  score: number | null
  cookable: boolean
}

export interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
}
