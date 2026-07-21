/**
 * MobileSwipeStrip
 *
 * Renders all swipeable pages side-by-side in a single horizontal strip and
 * slides the strip as one unit — exactly like Instagram's home / reels tabs.
 *
 * Touch handling strategy
 * ───────────────────────
 * Framer Motion's built-in `drag="x"` prop uses pointer-events internally.
 * On real iOS Safari and many Android browsers, combining pointer-event drag
 * with `touchAction: 'pan-y'` causes the browser to silently absorb the
 * horizontal touch and never deliver it to the JS handler — resulting in a
 * strip that only works with a mouse cursor but not with a real finger.
 *
 * The fix is to register native `touchstart / touchmove / touchend` listeners
 * directly on the DOM node with `{ passive: false }` for touchmove.
 * This lets us:
 *  1. Measure the first few pixels of movement to decide direction.
 *  2. Call e.preventDefault() ONLY when the gesture is horizontal, so
 *     vertical scroll still works normally everywhere inside the pages.
 *  3. Update the Framer Motion motion-value directly for buttery-smooth
 *     GPU-accelerated translateX — no layout thrashing.
 *
 * Height and White Space Fix (Instagram-style)
 * ───────────────────────────────────────────
 * Because all pages are laid out side-by-side in a flex container, the container
 * naturally stretches to match the height of the tallest page (e.g. Menu).
 * This causes a massive blank space at the bottom of shorter pages before the
 * footer is reached.
 *
 * To fix this:
 *  – Active Page: height is set to `auto` and overflow is `visible` so it
 *    scrolls and displays normally.
 *  – Inactive Pages: when static, they are set to `height: 0px` and `visibility: hidden`
 *    so they do not contribute to the parent height or show up.
 *  – During Swiping/Transitioning: inactive pages temporarily expand to `100vh` and
 *    become `visible` so they are fully seen as they slide across the screen.
 *
 * Desktop: this component is never rendered. PageLayout renders <Outlet />
 * directly on desktop — no change to desktop behaviour at all.
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useMotionValue, animate } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/store/authStore'

// ── Page skeleton shown while a lazy page chunk is loading ─────────────────────
function PageSkeleton() {
  return (
    <div className="min-h-[60vh] flex flex-col gap-4 p-4 animate-pulse" aria-hidden="true">
      <div className="h-48 rounded-2xl bg-gray-100" />
      <div className="h-6 rounded bg-gray-100 w-3/4" />
      <div className="h-4 rounded bg-gray-100 w-1/2" />
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="h-32 rounded-xl bg-gray-100" />
        <div className="h-32 rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}

// ─── Swipeable page components — lazy loaded to keep initial JS minimal ─────────
// Each module is only fetched when the user swipes/navigates to that page.
const Onboarding = dynamic(() => import('@/views/Onboarding/Onboarding'), {
  ssr: false,
  loading: () => <PageSkeleton />,
})
const Orders = dynamic(() => import('@/views/Orders'), {
  ssr: false,
  loading: () => <PageSkeleton />,
})
const Rewards = dynamic(() => import('@/views/Rewards'), {
  ssr: false,
  loading: () => <PageSkeleton />,
})
const Profile = dynamic(() => import('@/views/Profile'), {
  ssr: false,
  loading: () => <PageSkeleton />,
})

// Route helpers are now defined dynamically inside the component to handle login/logout routes.

// ─── Slot ──────────────────────────────────────────────────────────────────────
interface SlotProps {
  children: React.ReactNode
  isActive: boolean
  isTransitioning: boolean
}

function Slot({ children, isActive, isTransitioning }: SlotProps) {
  return (
    <div
      style={{
        width: '100vw',
        flexShrink: 0,
        overflowX: 'hidden',
        // When active: take full height of content so we can scroll it normally.
        // When transitioning (drag/nav): show the page so it is visible as it slides.
        // When inactive and static: collapse to 0px so it doesn't stretch the container.
        height: isActive ? 'auto' : (isTransitioning ? '100vh' : '0px'),
        overflowY: isActive ? 'visible' : 'hidden',
        visibility: isActive || isTransitioning ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  )
}

// ─── ProtectedSlot ─────────────────────────────────────────────────────────────
function ProtectedSlot({ user, children }: { user: unknown; children: React.ReactNode }) {
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <p className="text-gray-500 text-sm">Please log in to view this page.</p>
      </div>
    )
  }
  return <>{children}</>
}

// ─── MobileSwipeStrip ──────────────────────────────────────────────────────────
interface Props {
  screenWidth: number
}

export default function MobileSwipeStrip({ screenWidth: sw }: Props) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const routes = user 
    ? ['/home', '/menu', '/nutrition', '/orders', '/rewards', '/profile'] 
    : ['/', '/menu', '/subscriptions']
  const pageCount = routes.length

  const getIndex = (path: string) => {
    if (path === '/' || path === '/home') return 0
    if (path.startsWith('/menu')) return 1
    if (user) {
      if (path.startsWith('/nutrition')) return 2
      if (path.startsWith('/orders') || path.startsWith('/subscriptions')) return 3
      if (path.startsWith('/rewards')) return 4
      if (path.startsWith('/profile')) return 5
    } else {
      if (path.startsWith('/subscriptions')) return 2
    }
    return -1
  }

  const currentIndex = getIndex(pathname)

  // Track if we are swiping or animating between pages.
  const [isTransitioning, setIsTransitioning] = useState(false)

  // ── Motion value drives the strip's CSS transform ──────────────────────────
  const x = useMotionValue(currentIndex !== -1 ? -currentIndex * sw : 0)

  // Stable refs so touch-event closures always read the latest values.
  const indexRef = useRef(currentIndex)
  const swRef = useRef(sw)
  const navigateRef = useRef(navigate)
  const userRef = useRef(user)
  const routesRef = useRef(routes)
  const pageCountRef = useRef(pageCount)

  useEffect(() => { indexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { swRef.current = sw }, [sw])
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { routesRef.current = routes }, [routes])
  useEffect(() => { pageCountRef.current = pageCount }, [pageCount])

  // ── Sync strip when URL changes externally (bottom-nav, back button) ────────
  useEffect(() => {
    if (currentIndex === -1) return

    // Scroll window to top on page change
    window.scrollTo(0, 0)

    const target = -currentIndex * sw
    if (Math.abs(x.get() - target) > 4) {
      setIsTransitioning(true)
      animate(x, target, {
        type: 'spring',
        stiffness: 320,
        damping: 30,
        restDelta: 0.5,
        onComplete: () => setIsTransitioning(false),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentIndex])

  // Re-snap when orientation changes.
  useEffect(() => {
    if (currentIndex === -1) return
    x.set(-currentIndex * sw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sw])

  // ── Native touch handling ───────────────────────────────────────────────────
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return

    // Touch state — all mutable, lives outside React state to avoid re-renders.
    let startX = 0
    let startY = 0
    let startTime = 0
    let tracking: 'undecided' | 'horizontal' | 'vertical' = 'undecided'

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startTime = Date.now()
      tracking = 'undecided'
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      // Determine direction from the first 8 px of movement.
      if (tracking === 'undecided') {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          tracking = 'horizontal'
          setIsTransitioning(true) // Start transitioning state as soon as drag is horizontal
        } else if (Math.abs(dy) > 8) {
          tracking = 'vertical'
        }
      }

      if (tracking !== 'horizontal') return

      // We own this gesture — stop the browser from scrolling.
      e.preventDefault()

      const idx = indexRef.current
      const screenW = swRef.current
      const rawX = -idx * screenW + dx

      // Elastic resistance at the first / last page.
      const minX = -(pageCountRef.current - 1) * screenW
      const maxX = 0
      let clamped = rawX
      if (rawX > maxX) clamped = (rawX - maxX) * 0.25         // past first page
      if (rawX < minX) clamped = minX + (rawX - minX) * 0.25  // past last page

      x.set(clamped)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (tracking !== 'horizontal') {
        tracking = 'undecided'
        return
      }

      const dx = e.changedTouches[0].clientX - startX
      const dt = Math.max(Date.now() - startTime, 1)
      const velocity = (dx / dt) * 1000 // px / s

      const idx = indexRef.current
      const screenW = swRef.current
      const DIST = screenW * 0.22
      const VEL = 350

      const goNext = (dx < -DIST || velocity < -VEL) && idx < pageCountRef.current - 1
      const goPrev = (dx > DIST || velocity > VEL) && idx > 0

      if (goNext) {
        const next = idx + 1
        animate(x, -next * screenW, {
          type: 'spring',
          stiffness: 320,
          damping: 30,
          restDelta: 0.5,
          onComplete: () => setIsTransitioning(false),
        })
        navigateRef.current(routesRef.current[next] ?? '/')
      } else if (goPrev) {
        const prev = idx - 1
        animate(x, -prev * screenW, {
          type: 'spring',
          stiffness: 320,
          damping: 30,
          restDelta: 0.5,
          onComplete: () => setIsTransitioning(false),
        })
        navigateRef.current(routesRef.current[prev] ?? '/')
      } else {
        // Below threshold — spring back to the current page slot.
        animate(x, -idx * screenW, {
          type: 'spring',
          stiffness: 450,
          damping: 40,
          restDelta: 0.5,
          onComplete: () => setIsTransitioning(false),
        })
      }

      tracking = 'undecided'
    }

    // { passive: false } is required on touchmove so we can call preventDefault.
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    /*
     * Outer clip — prevents the browser from showing a horizontal scrollbar
     * and stops users from manually panning beyond the viewport.
     * position:relative keeps absolutely-positioned children of pages working.
     */
    <div style={{ overflow: 'hidden', width: '100vw', position: 'relative' }}>
      <motion.div
        ref={stripRef}
        style={{
          x,
          display: 'flex',
          width: `${pageCount * 100}vw`,
          willChange: 'transform', // hint to the browser to promote to GPU layer
        }}
      >
        {user ? (
          <>
            {/* 3 — Orders */}
            <Slot isActive={currentIndex === 3} isTransitioning={isTransitioning}>
              <Orders />
            </Slot>

            {/* 4 — Rewards */}
            <Slot isActive={currentIndex === 4} isTransitioning={isTransitioning}>
              <Rewards />
            </Slot>

            {/* 5 — Profile */}
            <Slot isActive={currentIndex === 5} isTransitioning={isTransitioning}>
              <Profile />
            </Slot>
          </>
        ) : (
          <>
            {/* 0 — Onboarding */}
            <Slot isActive={currentIndex === 0} isTransitioning={isTransitioning}>
              <Onboarding />
            </Slot>
          </>
        )}
      </motion.div>
    </div>
  )
}
