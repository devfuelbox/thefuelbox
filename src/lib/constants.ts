export const ROUTES = {
  LANDING: '/',
  HOME: '/home',
  ABOUT: '/about',
  MENU: '/menu',
  LOGIN: '/login',
  REGISTER: '/register',
  QUIZ: '/quiz',
  PROFILE: '/profile',
  AI_BOT: '/ai-bot',
  CART: '/cart',
  CHECKOUT: '/checkout',
  NUTRITION: '/nutrition',
  SUBSCRIPTIONS: '/subscriptions',
  SUMMARY: '/summary',
  REFERRALS: '/referrals',
  FORGOT_PASSWORD: '/forgot-password',
  CONTACT: '/contact',
  REWARDS: '/rewards',
  ORDER_STATUS: '/order-status',
  TERMS: '/terms',
  REFUND_POLICY: '/refund-policy',
  PRIVACY_POLICY: '/privacy-policy',
  DELIVERY_POLICY: '/delivery-policy',
  ORDERS: '/orders',

} as const

export const FITNESS_GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'general_health', label: 'General Health' },
] as const

export const MEAL_TIMES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const

export const SUBSCRIPTION_TIERS = [
  { meals: 1, days: 20, monthly: 3499, label: '1 Meal/Day - Essential' },
  { meals: 1, days: 30, monthly: 4999, label: '1 Meal/Day - Elite' },
  { meals: 2, days: 20, monthly: 6699, label: '2 Meals/Day - Essential' },
  { meals: 2, days: 30, monthly: 9499, label: '2 Meals/Day - Elite' },
  { meals: 3, days: 20, monthly: 9999, label: '3 Meals/Day - Essential' },
  { meals: 3, days: 30, monthly: 13999, label: '3 Meals/Day - Elite' },
] as const
