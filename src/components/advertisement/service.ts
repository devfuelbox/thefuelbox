import type { Advertisement, AdPosition } from './types'

const defaultAds: Advertisement[] = [
  {
    id: 'ad-service-1',
    title: 'High Protein Meal Plans',
    description: 'Freshly cooked macro-balanced meals delivered daily.',
    imageUrl: '/images/chicken.jpg',
    type: 'Banner',
    targetUrl: '/menu',
    position: 'Home Top',
    status: 'Active',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    priority: 1,
    ctaText: 'Order Now',
    views: 10,
    clicks: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export async function fetchActiveAds(): Promise<Advertisement[]> {
  return defaultAds
}

export async function fetchAdsByPosition(_position: AdPosition): Promise<Advertisement[]> {
  return defaultAds
}

export async function incrementAdViews(_id: string): Promise<void> {}

export async function incrementAdClicks(_id: string): Promise<void> {}
