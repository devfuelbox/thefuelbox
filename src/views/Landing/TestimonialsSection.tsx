import { Card } from '@/components/ui'
import { useScrollReveal } from './useScrollReveal'

const testimonials = [
  {
    name: 'Aravind Sharma',
    role: 'Calisthenics Athlete',
    quote: 'Fuel Box completely changed my nutrition game. The meals are macro-accurate, taste amazing, and save me 10+ hours of cooking every week. My performance has never been better!',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    name: 'Pooja Patel',
    role: 'Software Engineer & Runner',
    quote: 'As a busy developer, I used to skip meals or order junk. Fuel Box makes it so easy to stick to my calorie goals. The AI suggestions are spot-on, and the quality is outstanding.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    name: 'Vikram Malhotra',
    role: 'Fitness Coach',
    quote: 'I recommend Fuel Box to all my clients. Most meal prep services are bland and boring, but their menu is incredibly diverse and delicious. FSSAI-certified kitchen standards show!',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
  },
]

export default function TestimonialsSection() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="testimonials-section"
      ref={ref}
      className="bg-brand-50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            Success Stories
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
            Loved by Active People
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            See how Fuel Box helps athletes, professionals, and everyday people reach their fitness goals.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card
              key={testimonial.name}
              hover
              className={`flex flex-col justify-between border-gray-100 bg-white p-8 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: isVisible ? `${index * 150}ms` : '0ms' }}
            >
              <div>
                {/* Stars */}
                <div className="flex gap-1 text-energy-500">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <p className="mt-6 text-gray-600 italic leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="h-12 w-12 rounded-full object-cover border-2 border-brand-200"
                />
                <div>
                  <h4 className="font-bold text-gray-900 font-heading">{testimonial.name}</h4>
                  <p className="text-xs text-brand-600 font-semibold">{testimonial.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
