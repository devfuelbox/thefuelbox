import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Advertisement } from './types'
import { incrementAdViews, incrementAdClicks } from './service'

interface AdBaseProps {
  ad: Advertisement
  children: React.ReactNode
}

function AdTracker({ ad, children }: AdBaseProps) {
  const tracked = useRef(false)
  useEffect(() => {
    if (!tracked.current) {
      incrementAdViews(ad.id)
      tracked.current = true
    }
  }, [ad.id])
  return <>{children}</>
}

function handleAdClick(ad: Advertisement) {
  incrementAdClicks(ad.id)
  if (ad.targetUrl) {
    window.open(ad.targetUrl, '_blank', 'noopener,noreferrer')
  }
}

export function AdBanner({ ad }: { ad: Advertisement }) {
  return (
    <AdTracker ad={ad}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => handleAdClick(ad)}
        className="ad-banner-wrapper relative w-full overflow-hidden cursor-pointer group"
      >
        <img
          src={ad.imageUrl}
          alt={ad.title}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '40vw' }}
          className="ad-banner-img object-contain transition-transform duration-500 group-hover:scale-105"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        {ad.ctaText && (
          <div className="absolute bottom-2 right-3">
            <span className="inline-block px-3 py-1 rounded-lg bg-energy-500 text-white text-xs font-bold shadow-lg">
              {ad.ctaText}
            </span>
          </div>
        )}
      </motion.div>
    </AdTracker>
  )
}

export function AdPopup({ ad, onClose }: { ad: Advertisement; onClose: () => void }) {
  return (
    <AdTracker ad={ad}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
          >
            ✕
          </button>
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="w-full object-cover"
            style={{ maxHeight: 240 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="p-5">
            <h3 className="text-lg font-bold text-gray-900">{ad.title}</h3>
            {ad.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{ad.description}</p>
            )}
            <button
              onClick={() => handleAdClick(ad)}
              className="mt-4 w-full py-2.5 rounded-xl bg-energy-500 text-white font-bold text-sm hover:bg-energy-600 transition"
            >
              {ad.ctaText || 'Learn More'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AdTracker>
  )
}

export function AdSidebar({ ad }: { ad: Advertisement }) {
  return (
    <AdTracker ad={ad}>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => handleAdClick(ad)}
        className="rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer group hover:shadow-md transition-shadow"
      >
        <img
          src={ad.imageUrl}
          alt={ad.title}
          className="w-full object-cover"
          style={{ maxHeight: 160 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="p-3">
          <h4 className="text-sm font-bold text-gray-900 truncate">{ad.title}</h4>
          {ad.ctaText && (
            <span className="inline-block mt-1.5 text-xs font-semibold text-energy-500">{ad.ctaText} →</span>
          )}
        </div>
      </motion.div>
    </AdTracker>
  )
}

export function AdNotification({ ad, onClose }: { ad: Advertisement; onClose: () => void }) {
  return (
    <AdTracker ad={ad}>
      <motion.div
        initial={{ opacity: 0, y: -60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -60 }}
        onClick={() => handleAdClick(ad)}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-brand-600 to-energy-500 text-white px-4 py-3 cursor-pointer flex items-center justify-between shadow-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📢</span>
          <p className="text-sm font-semibold">{ad.title}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          className="text-white/80 hover:text-white transition"
        >
          ✕
        </button>
      </motion.div>
    </AdTracker>
  )
}

export function AdFullScreen({ ad, onClose }: { ad: Advertisement; onClose: () => void }) {
  return (
    <AdTracker ad={ad}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-w-4xl w-full mx-4"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 hover:text-gray-900 transition"
          >
            ✕
          </button>
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="w-full rounded-2xl shadow-2xl"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-bold text-white">{ad.title}</h2>
            {ad.description && (
              <p className="text-white/80 mt-1 max-w-lg mx-auto">{ad.description}</p>
            )}
            <button
              onClick={() => handleAdClick(ad)}
              className="mt-4 px-8 py-3 rounded-xl bg-energy-500 text-white font-bold text-base hover:bg-energy-600 transition shadow-lg"
            >
              {ad.ctaText || 'Learn More'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AdTracker>
  )
}
