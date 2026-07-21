import type {
  Advertisement,
  AdvertisementFormData,
  AdStats,
  AdFilters,
  AdType,
  AdDisplayStatus,
} from '@/types/advertisement'

// ── In-Memory Advertisements Store ─────────────────────────
let sampleAds: Advertisement[] = [
  {
    id: 'ad-1',
    name: 'High Protein Meal Box Special',
    image_url: '/images/chicken.jpg',
    short_description: 'Get 20% extra protein on monthly subscriptions!',
    ad_type: 'home_banner',
    cta_text: 'Claim Offer',
    redirect_url: '/subscriptions',
    start_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'active',
    views: 125,
    clicks: 18,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ad-2',
    name: 'Macro Customization Quiz',
    image_url: '/images/sweetpotato.jpg',
    short_description: 'Calculate your exact BMR and daily protein requirement.',
    ad_type: 'menu_banner',
    cta_text: 'Take Quiz',
    redirect_url: '/quiz',
    start_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'active',
    views: 89,
    clicks: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function computeAdDisplayStatus(ad: Advertisement): AdDisplayStatus {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(ad.start_date)
  const end = new Date(ad.end_date)

  if (ad.status === 'inactive') return 'inactive'
  if (start > now) return 'scheduled'
  if (end < now) return 'expired'
  return 'active'
}

export function computeAdStats(ads: Advertisement[]): AdStats {
  const total = ads.length
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const active = ads.filter((ad) => {
    const start = new Date(ad.start_date)
    const end = new Date(ad.end_date)
    return ad.status === 'active' && start <= now && end >= now
  }).length

  const total_views = ads.reduce((sum, ad) => sum + (ad.views ?? 0), 0)
  const total_clicks = ads.reduce((sum, ad) => sum + (ad.clicks ?? 0), 0)
  const ctr = total_views > 0 ? (total_clicks / total_views) * 100 : 0

  return { total, active, total_views, total_clicks, ctr }
}

export async function uploadAdImage(file: File): Promise<string> {
  return URL.createObjectURL(file)
}

export async function deleteAdImage(_imageUrl: string): Promise<void> {}

export async function fetchActiveAdvertisements(type?: AdType): Promise<Advertisement[]> {
  return sampleAds.filter((ad) => !type || ad.ad_type === type)
}

export async function fetchAllAdvertisements(filters?: Partial<AdFilters>): Promise<Advertisement[]> {
  let list = [...sampleAds]
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    list = list.filter((ad) => ad.name.toLowerCase().includes(q))
  }
  return list
}

export async function fetchAdvertisementById(id: string): Promise<Advertisement> {
  const ad = sampleAds.find((a) => a.id === id)
  if (!ad) throw new Error('Advertisement not found')
  return ad
}

export async function createAdvertisement(formData: AdvertisementFormData): Promise<Advertisement> {
  const newAd: Advertisement = {
    id: `ad-${Date.now()}`,
    name: formData.name,
    image_url: formData.image_url ?? '/images/chicken.jpg',
    short_description: formData.short_description,
    ad_type: formData.ad_type,
    cta_text: formData.cta_text,
    redirect_url: formData.redirect_url,
    start_date: formData.start_date,
    end_date: formData.end_date,
    status: formData.status,
    views: 0,
    clicks: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  sampleAds.push(newAd)
  return newAd
}

export async function updateAdvertisement(
  id: string,
  formData: AdvertisementFormData,
  _oldImageUrl?: string | null
): Promise<Advertisement> {
  const idx = sampleAds.findIndex((a) => a.id === id)
  if (idx === -1) throw new Error('Advertisement not found')
  sampleAds[idx] = {
    ...sampleAds[idx],
    ...formData,
  }
  return sampleAds[idx]
}

export async function deleteAdvertisement(ad: Advertisement): Promise<void> {
  sampleAds = sampleAds.filter((a) => a.id !== ad.id)
}

export async function incrementAdView(id: string): Promise<void> {
  const ad = sampleAds.find((a) => a.id === id)
  if (ad) ad.views = (ad.views ?? 0) + 1
}

export async function incrementAdClick(id: string): Promise<void> {
  const ad = sampleAds.find((a) => a.id === id)
  if (ad) ad.clicks = (ad.clicks ?? 0) + 1
}
