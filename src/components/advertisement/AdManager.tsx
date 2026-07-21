import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import type { Advertisement, AdPosition } from './types'
import type { AdType } from './types'
import { AdBanner, AdPopup, AdSidebar, AdNotification, AdFullScreen } from './AdDisplays'
import { useAdsByPosition } from '@/hooks/useAdvertisements'

const POSITION_MAP: Record<string, AdPosition> = {
  '/': 'Home Top',
  '/home': 'Home Top',
  '/menu': 'Category Page',
  '/cart': 'Cart Page',
  '/checkout': 'Checkout Page',
  '/orders': 'Post-Order',
  '/summary': 'Post-Order',
  '/nutrition': 'Nutrition Page',
  '/subscriptions': 'Subscriptions Page',
  '/rewards': 'Rewards Page',
}

const POSITION_BOTTOM: Record<string, AdPosition> = {
  '/': 'Home Bottom',
  '/home': 'Home Bottom',
}

const TYPE_COMPONENT: Record<string, React.FC<{ ad: Advertisement; onClose?: () => void }>> = {
  Banner: ({ ad }) => <AdBanner ad={ad} />,
  Popup: ({ ad, onClose }) => <AdPopup ad={ad} onClose={onClose!} />,
  Sidebar: ({ ad }) => <AdSidebar ad={ad} />,
  Notification: ({ ad, onClose }) => <AdNotification ad={ad} onClose={onClose!} />,
  'Full Screen': ({ ad, onClose }) => <AdFullScreen ad={ad} onClose={onClose!} />,
}

function AdSlot({ position }: { position: AdPosition }) {
  const { data: ads, isLoading } = useAdsByPosition(position)
  if (isLoading || !ads?.length) return null
  const ad = ads[0]
  const Component = TYPE_COMPONENT[ad.type] || TYPE_COMPONENT.Banner
  return <Component ad={ad} />
}

export function AdReplace({ position, children }: { position: AdPosition; children: ReactNode }) {
  const { data: ads, isLoading } = useAdsByPosition(position)
  if (isLoading) return <>{children}</>
  if (ads?.length) {
    const ad = ads[0]
    const Component = TYPE_COMPONENT[ad.type] || TYPE_COMPONENT.Banner
    return <Component ad={ad} />
  }
  return <>{children}</>
}

export function AdManager() {
  const { pathname } = useLocation()
  const topPos = POSITION_MAP[pathname]
  const bottomPos = POSITION_BOTTOM[pathname]
  return (
    <>
      {topPos && (
        <div className="w-full py-2 mb-2">
          <AdSlot position={topPos} />
        </div>
      )}
      {bottomPos && (
        <div className="mt-4">
          <AdSlot position={bottomPos} />
        </div>
      )}
    </>
  )
}

export function GlobalAdPopup() {
  const { pathname } = useLocation()
  const [shown, setShown] = useState(false)
  const [ads, setAds] = useState<Advertisement[]>([])
  const [currentAd, setCurrentAd] = useState<Advertisement | null>(null)

  useEffect(() => {
    if (shown) return
    const dismissed = sessionStorage.getItem('ad_popup_dismissed')
    if (dismissed) return
    import('./service').then(({ fetchAdsByPosition }) =>
      fetchAdsByPosition('Home Top').then(results => {
        const popups = results.filter(a => a.type === 'Popup' || a.type === 'Full Screen')
        if (popups.length > 0) {
          setAds(popups)
          setCurrentAd(popups[0])
          setShown(true)
        }
      })
    )
  }, [pathname, shown])

  function handleClose() {
    setCurrentAd(null)
    sessionStorage.setItem('ad_popup_dismissed', 'true')
    setTimeout(() => setShown(false), 300)
  }

  if (!currentAd) return null

  const Component = currentAd.type === 'Full Screen' ? AdFullScreen : AdPopup

  return (
    <AnimatePresence>
      {currentAd && <Component ad={currentAd} onClose={handleClose} />}
    </AnimatePresence>
  )
}

export function GlobalAdNotification() {
  const [dismissed, setDismissed] = useState(false)
  const { data: ads } = useAdsByPosition('Home Top')
  const notification = ads?.find(a => a.type === 'Notification')

  if (dismissed || !notification) return null

  return (
    <AnimatePresence>
      {notification && (
        <AdNotification ad={notification} onClose={() => setDismissed(true)} />
      )}
    </AnimatePresence>
  )
}

export { AdBanner, AdPopup, AdSidebar, AdNotification, AdFullScreen }
