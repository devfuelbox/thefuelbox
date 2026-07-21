export type AdStatus = 'Active' | 'Inactive' | 'Scheduled' | 'Expired'
export type AdType = 'Banner' | 'Popup' | 'Sidebar' | 'Full Screen' | 'Notification'
export type AdPosition =
  | 'Home Top'
  | 'Home Bottom'
  | 'Category Page'
  | 'Cart Page'
  | 'Checkout Page'
  | 'Post-Order'
  | 'Nutrition Page'
  | 'Subscriptions Page'
  | 'Rewards Page'

export interface Advertisement {
  id: string
  title: string
  description: string
  imageUrl: string
  type: AdType
  targetUrl: string
  position: AdPosition
  status: AdStatus
  startDate: string
  endDate: string
  priority: number
  ctaText: string
  views: number
  clicks: number
  createdAt: string
  updatedAt: string
}
