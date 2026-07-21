import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import BottomNav from './BottomNav'
import MobileSwipeStrip from './MobileSwipeStrip'
import AiBot from '@/views/AiBot'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/lib/constants'
import { GlobalAdPopup, GlobalAdNotification } from '@/components/advertisement/AdManager'

// Pages that live inside the swipe strip — everything else uses <Outlet />.
function isSwipablePath(path: string): boolean {
  return (
    path === '/' ||
    path === '/home' ||
    path.startsWith('/menu') ||
    path.startsWith('/nutrition') ||
    path.startsWith('/subscriptions') ||
    path.startsWith('/orders') ||
    path.startsWith('/rewards') ||
    path.startsWith('/profile')
  )
}

// ─── Floating CTA buttons ──────────────────────────────────────────────────────
function FloatingTopButtons() {
  const { user, hasPurchased } = useAuthStore()
  const [hover, setHover] = useState(false)
  const trialClicked =
    typeof window !== 'undefined' && localStorage.getItem('isTrialOrder') === 'true'
  const showTrial = (!user || !hasPurchased) && !trialClicked
  const profileIncomplete =
    user &&
    (!user.gender || !user.height || !user.weight || !user.dob || !user.fitness_goal)

  if (!showTrial && !profileIncomplete) return null

  return (
    <>
      {showTrial && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <Link
            to={ROUTES.MENU}
            onClick={() => {
              try {
                localStorage.setItem('isTrialOrder', 'true')
              } catch (_) {}
            }}
            className="get-started-btn-green no-underline"
          >
            <div className="btn-outer">
              <div className="btn-inner">
                <span>Try our Trial Box</span>
              </div>
            </div>
          </Link>
        </div>
      )}
      {profileIncomplete && (
        <div className="fixed top-20 right-6 z-50">
          <Link
            to={ROUTES.PROFILE}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="get-started-btn no-underline"
          >
            <div className="btn-outer">
              <div className="btn-inner">
                <span>{hover ? 'Get personalized meals' : 'Update Profile'}</span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </>
  )
}

// ─── PageLayout ────────────────────────────────────────────────────────────────
export default function PageLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useAuth()

  const { user } = useAuthStore()

  // ── Guest redirect guard ───────────────────────────────────────────────────
  // If not logged in and has not completed onboarding (no OTP verified yet),
  // redirect to Onboarding ('/') for any page other than '/' or '/login'.
  // Exception: /profile is the "Complete Your Profile" form — guests reach it
  // after onboarding finishes, so allow it when fuelbox_pending_reg is set.
  useEffect(() => {
    const hasVerifiedOtp = localStorage.getItem('fuelbox_pending_reg') !== null
    if (!user && !hasVerifiedOtp && pathname !== '/' && pathname !== '/login') {
      navigate('/', { replace: true })
    }
  }, [user, pathname, navigate])

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false)
  const [screenWidth, setScreenWidth] = useState(390)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 768)
      setScreenWidth(window.innerWidth)
    }
    update()
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const swipeable = isSwipablePath(pathname)

  // Scroll to top on non-swipe page navigations (swipe pages handle their own
  // scroll via the strip position, not the window scroll position).
  useEffect(() => {
    if (!swipeable) window.scrollTo(0, 0)
  }, [pathname, swipeable])

  const isAuthPage = pathname === '/' || pathname === '/login'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {!isAuthPage && <Navbar />}

      <main
        className={`flex-1 ${!isAuthPage ? 'pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0' : ''} relative overflow-x-hidden`}
      >
        {isMobile && swipeable && !(pathname.startsWith('/profile') && !user) && !(pathname.startsWith('/home') && !user) ? (
          /*
           * Mobile + swipeable page → render the horizontal strip.
           * All 6 pages are always mounted side-by-side; the strip slides as
           * one GPU-accelerated unit, so there is never a blank gap visible.
           *
           * Exception: /profile and /home for unauthenticated users should not
           * use the swipe strip.
           * - /profile is the "Complete Your Profile" registration form.
           * - /home is the login/verification landing page which handles OTP.
           * Both must fall through to the standard <Outlet /> below so their respective
           * components are rendered correctly and can capture inputs/states properly.
           */
          <MobileSwipeStrip screenWidth={screenWidth} />
        ) : (
          /*
           * Desktop OR a non-swipeable route (cart, checkout, login, …).
           * Uses the standard router <Outlet /> with a simple fade transition.
           */
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {!isAuthPage && <Footer />}
      {!isAuthPage && <BottomNav />}
      {!isAuthPage && <GlobalAdNotification />}
      {!isAuthPage && <GlobalAdPopup />}
      {!isAuthPage && <AiBot />}
      {!isAuthPage && <FloatingTopButtons />}
    </div>
  )
}

