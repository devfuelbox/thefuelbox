import Image from 'next/image'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'

export default function HeroSection() {
  const { user } = useAuthStore()
  return (
    <section id="hero-section" className="relative min-h-[90vh] flex items-center overflow-hidden bg-gray-950">
      {/* Background image — LCP element: Next.js Image with priority for automatic preload + WebP/AVIF conversion */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          fill
          className="object-cover opacity-40"
          priority
          quality={80}
          sizes="100vw"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/90 to-gray-950/60 sm:bg-gradient-to-r sm:from-gray-950 sm:via-gray-950/85 sm:to-transparent" />
      </div>

      {/* Decorative glow orbs — use will-change to keep on GPU */}
      <div className="absolute top-20 right-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl will-change-transform" />
      <div className="absolute bottom-20 left-1/4 h-56 w-56 rounded-full bg-energy-500/15 blur-3xl will-change-transform" />
      <div className="absolute top-1/2 right-10 h-40 w-40 rounded-full bg-brand-400/10 blur-2xl will-change-transform" />

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl animate-[fadeSlideUp_0.8s_ease-out_forwards]">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
            #1 Fitness Meal Platform.
          </span>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white font-heading sm:text-5xl lg:text-6xl xl:text-7xl">
            Today's Healthy
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-energy-400 bg-clip-text text-transparent">
              Nutrition Starts Here
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-300">
            Macro-perfect, chef-prepared meals designed for your fitness goals. Delivered fresh daily to keep you on track.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            {user ? (
              <>
                <Link to={ROUTES.MENU} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full bg-brand-500 text-white hover:bg-brand-600 font-semibold px-8 cursor-pointer"
                  >
                    Order Now
                    <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </Link>
                <Link to={ROUTES.QUIZ} className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-gray-600 text-gray-300 hover:border-brand-400 hover:text-brand-400 font-semibold px-8 cursor-pointer"
                  >
                    Take Quiz
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={ROUTES.REGISTER} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full bg-brand-500 text-white hover:bg-brand-600 font-semibold px-8 cursor-pointer"
                  >
                    Order Now
                    <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </Link>
                <Link to={ROUTES.MENU} className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-gray-600 text-gray-300 hover:border-brand-400 hover:text-brand-400 font-semibold px-8 cursor-pointer"
                  >
                    View Menu
                  </Button>
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
