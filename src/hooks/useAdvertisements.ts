import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchActiveAdvertisements,
  fetchAllAdvertisements,
  computeAdStats,
} from '@/lib/advertisementApi'
import { fetchActiveAds, fetchAdsByPosition } from '@/components/advertisement/service'
import type {
  Advertisement,
  AdFilters,
  AdStats,
  AdType,
} from '@/types/advertisement'
import type { AdPosition } from '@/components/advertisement/types'

// ── Public Hook (AdvertisementBanner) ───────────────────────

interface UseActiveAdsResult {
  ads: Advertisement[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useActiveAds(type?: AdType): UseActiveAdsResult {
  const [ads, setAds] = useState<Advertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchActiveAdvertisements(type)
      setAds(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load advertisements'
      setError(message)
      setAds([])
    } finally {
      setIsLoading(false)
    }
  }, [type])

  useEffect(() => {
    load()
  }, [load])

  return { ads, isLoading, error, refetch: load }
}

// ── Admin Hook ──────────────────────────────────────────────

interface UseAdminAdsResult {
  ads: Advertisement[]
  stats: AdStats
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useAdminAds(filters: Partial<AdFilters> = {}): UseAdminAdsResult {
  const [ads, setAds] = useState<Advertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAllAdvertisements(filters)
      setAds(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load advertisements'
      setError(message)
      setAds([])
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => computeAdStats(ads), [ads])

  return { ads, stats, isLoading, error, refetch: load }
}

// ── TanStack Query Hooks (AdManager) ────────────────────────

export function useAdvertisements() {
  return useQuery({
    queryKey: ['advertisements', 'active'],
    queryFn: fetchActiveAds,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useAdsByPosition(position: AdPosition) {
  return useQuery({
    queryKey: ['advertisements', 'position', position],
    queryFn: () => fetchAdsByPosition(position),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
