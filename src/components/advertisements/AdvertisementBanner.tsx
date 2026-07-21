/**
 * AdvertisementBanner — Public-facing Banner Component
 * =====================================================
 * Displays active advertisements fetched from Supabase.
 *
 * Behavior:
 *  - 0 ads  → renders null (no layout shift)
 *  - 1 ad   → full-width premium single banner
 *  - 2+ ads → auto-sliding carousel with dots & arrows
 *
 * Analytics:
 *  - View counted via IntersectionObserver (once per mount)
 *  - Click counted before navigation
 *
 * Navigation:
 *  - Internal URL → React Router navigate()
 *  - External URL → window.open() in new tab
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useActiveAds } from '@/hooks/useAdvertisements'
import { incrementAdView, incrementAdClick } from '@/lib/advertisementApi'
import type { AdType, Advertisement } from '@/types/advertisement'

// ── Constants ──────────────────────────────────────────────
const CAROUSEL_INTERVAL_MS = 5000
const TRANSITION_DURATION = 0.6

// ── Skeleton ───────────────────────────────────────────────
function BannerSkeleton() {
  return (
    <div className="w-full rounded-3xl overflow-hidden animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 h-56 sm:h-64 lg:h-72" />
  )
}

// ── Redirect Helper ────────────────────────────────────────
function isInternalUrl(url: string): boolean {
  if (!url) return false
  return url.startsWith('/') || url.startsWith('#') || !url.startsWith('http')
}

// ── Single Banner Layout ───────────────────────────────────
interface BannerSlideProps {
  ad: Advertisement
  onClick: (ad: Advertisement) => void
  priority?: boolean
}

function BannerSlide({ ad, onClick }: BannerSlideProps) {
  return (
    <div
      className="relative w-full h-56 sm:h-64 lg:h-80 overflow-hidden rounded-3xl cursor-pointer group"
      onClick={() => onClick(ad)}
      role="button"
      tabIndex={0}
      aria-label={`Advertisement: ${ad.name}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick(ad)}
    >
      {/* Background Image */}
      {ad.image_url ? (
        <img
          src={ad.image_url}
          alt={ad.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-energy-500" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12 lg:px-16 max-w-2xl">
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl sm:text-2xl lg:text-3xl font-bold text-white font-heading leading-tight drop-shadow-lg"
        >
          {ad.name}
        </motion.h3>

        {ad.short_description && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-sm sm:text-base text-white/85 leading-relaxed line-clamp-2"
          >
            {ad.short_description}
          </motion.p>
        )}

        {ad.cta_text && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-energy-500 hover:bg-energy-600 text-white font-semibold px-5 py-2.5 text-sm transition-all duration-200 shadow-lg shadow-energy-500/30 group-hover:shadow-energy-500/50">
              {ad.cta_text}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ── Carousel Dots ──────────────────────────────────────────
interface CarouselDotsProps {
  total: number
  current: number
  onDotClick: (index: number) => void
}

function CarouselDots({ total, current, onDotClick }: CarouselDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4" role="tablist" aria-label="Carousel navigation">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Go to slide ${i + 1}`}
          onClick={() => onDotClick(i)}
          className={`transition-all duration-300 rounded-full cursor-pointer ${
            i === current
              ? 'w-8 h-2.5 bg-brand-600'
              : 'w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400'
          }`}
        />
      ))}
    </div>
  )
}

// ── Carousel Arrow Button ──────────────────────────────────
function CarouselArrow({
  direction,
  onClick,
}: {
  direction: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === 'left' ? 'Previous advertisement' : 'Next advertisement'}
      className="absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/40 transition-all duration-200 cursor-pointer shadow-lg"
      style={{ [direction === 'left' ? 'left' : 'right']: '16px' }}
    >
      {direction === 'left' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────
interface AdvertisementBannerProps {
  /** The placement type of advertisements to display */
  type: AdType
  /** Optional additional class names for the wrapper */
  className?: string
}

export default function AdvertisementBanner({ type, className = '' }: AdvertisementBannerProps) {
  const navigate = useNavigate()
  const { ads, isLoading } = useActiveAds(type)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = next, -1 = prev
  const [hasTrackedViews, setHasTrackedViews] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-slide for carousel ──────────────────────────────
  const goToNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % ads.length)
  }, [ads.length])

  const goToPrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length)
  }, [ads.length])

  const goToDot = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
  }, [currentIndex])

  useEffect(() => {
    if (ads.length <= 1) return
    timerRef.current = setInterval(goToNext, CAROUSEL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [ads.length, goToNext])

  // Reset to first slide when ads change
  useEffect(() => {
    setCurrentIndex(0)
    setHasTrackedViews(new Set())
  }, [ads.length])

  // ── View Tracking via IntersectionObserver ───────────────
  useEffect(() => {
    if (ads.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Track view for all visible ads on mount
            ads.forEach((ad) => {
              if (!hasTrackedViews.has(ad.id)) {
                setHasTrackedViews((prev) => new Set([...prev, ad.id]))
                incrementAdView(ad.id)
              }
            })
          }
        })
      },
      { threshold: 0.5 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads])

  // ── Click Handler ────────────────────────────────────────
  const handleAdClick = useCallback(async (ad: Advertisement) => {
    // Increment click count (best-effort, non-blocking)
    incrementAdClick(ad.id).catch(() => {})

    if (!ad.redirect_url) return

    if (isInternalUrl(ad.redirect_url)) {
      navigate(ad.redirect_url)
    } else {
      window.open(ad.redirect_url, '_blank', 'noopener,noreferrer')
    }
  }, [navigate])

  // ── Render States ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`w-full ${className}`}>
        <BannerSkeleton />
      </div>
    )
  }

  if (ads.length === 0) return null

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  }

  // ── Single Banner ────────────────────────────────────────
  if (ads.length === 1) {
    return (
      <div ref={containerRef} className={`w-full ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <BannerSlide ad={ads[0]} onClick={handleAdClick} priority />
        </motion.div>
      </div>
    )
  }

  // ── Carousel (2+ ads) ────────────────────────────────────
  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Carousel container */}
        <div className="relative overflow-hidden rounded-3xl">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30, duration: TRANSITION_DURATION },
                opacity: { duration: 0.3 },
              }}
              className="w-full"
            >
              <BannerSlide
                ad={ads[currentIndex]}
                onClick={handleAdClick}
              />
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <CarouselArrow direction="left" onClick={goToPrev} />
          <CarouselArrow direction="right" onClick={goToNext} />

          {/* Slide counter badge */}
          <div className="absolute bottom-3 right-4 z-10 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium text-white">
            {currentIndex + 1} / {ads.length}
          </div>
        </div>

        {/* Dots */}
        <CarouselDots
          total={ads.length}
          current={currentIndex}
          onDotClick={goToDot}
        />
      </motion.div>
    </div>
  )
}
