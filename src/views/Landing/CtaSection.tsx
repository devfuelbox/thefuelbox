import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

export default function CtaSection() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="cta-section"
      ref={ref}
      className="relative overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900 py-20 lg:py-28"
    >
      {/* Decorative background shapes */}
      <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-brand-600/30 blur-2xl" />
      <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-energy-600/20 blur-3xl" />

      <div className={`relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <h2 className="text-3xl font-extrabold text-white font-heading sm:text-4xl lg:text-5xl">
          Start Your Health Journey
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-brand-100 leading-relaxed">
          Join thousands of athletes, runners, and health-conscious professionals who fuel their daily wins with macro-perfect nutrition.
        </p>

        <div className="mt-10 flex flex-col justify-center items-center gap-4 sm:flex-row">
          <Link to={ROUTES.QUIZ} className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full bg-brand-600 text-white hover:bg-brand-700 font-semibold px-8 py-3 rounded-xl cursor-pointer"
            >
              Take Quiz
            </Button>
          </Link>
          <Link to={ROUTES.MENU} className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white text-white hover:bg-white/10 font-semibold px-8 py-3 rounded-xl cursor-pointer"
            >
              Explore Menu
            </Button>
          </Link>
          <Link to={ROUTES.REGISTER} className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3 rounded-xl cursor-pointer"
            >
              Try our Trial Box
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
