import { Link } from 'react-router-dom'
import { Card, Button } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useScrollReveal } from './useScrollReveal'

export default function RewardsPreview() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()

  return (
    <section
      id="rewards-preview"
      ref={ref}
      className="bg-brand-50/50 py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          
          {/* Left Column: Gamified Visuals */}
          <div className="order-2 lg:order-1 relative">
            <div className="absolute -inset-2 bg-gradient-to-tr from-brand-300 to-energy-300 rounded-2xl blur-xl opacity-30" />
            
            <Card className="relative bg-white border border-gray-150 rounded-2xl shadow-lg p-6 max-w-lg mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Active Streak Challenge</h4>
                  <p className="text-xl font-extrabold text-gray-900 font-heading mt-0.5">8 Days Streak! 🔥</p>
                </div>
                <div className="bg-energy-100 text-energy-700 px-3 py-1 rounded-full text-xs font-bold">
                  Multiplier: 1.5x
                </div>
              </div>

              {/* Progress circles & tracks */}
              <div className="relative mb-6 pt-2">
                <div className="flex justify-between items-center text-center">
                  {[
                    { day: 'Day 1', points: '+10p', active: true },
                    { day: 'Day 5', points: '+50p', active: true },
                    { day: 'Day 10', points: '+100p', active: false },
                    { day: 'Day 20', points: '+300p', active: false },
                  ].map((milestone, idx) => (
                    <div key={idx} className="relative z-10 flex flex-col items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-colors ${
                        milestone.active
                          ? 'bg-brand-600 border-brand-600 text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                        {milestone.active ? '✓' : milestone.day.split(' ')[1]}
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${milestone.active ? 'text-gray-800' : 'text-gray-400'}`}>
                        {milestone.day}
                      </span>
                      <span className="text-[9px] text-gray-400 font-semibold">{milestone.points}</span>
                    </div>
                  ))}
                </div>
                
                {/* Horizontal line track */}
                <div className="absolute top-7 left-5 right-5 h-[2px] bg-gray-100 -z-0" />
                <div className="absolute top-7 left-5 w-[42%] h-[2px] bg-brand-600 -z-0 transition-all duration-1000" />
              </div>

              {/* Reward Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <h5 className="text-xs font-bold text-gray-800">Streak Gold Box Unlock</h5>
                      <p className="text-[10px] text-gray-500">Reach 20 days streak to unlock free premium meals.</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-bold">12 Days Left</span>
                </div>

                <div className="flex items-center justify-between border border-brand-100 rounded-xl p-3 bg-brand-50/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💪</span>
                    <div>
                      <h5 className="text-xs font-bold text-brand-850">Earned Points Balance</h5>
                      <p className="text-[10px] text-brand-600">Redeem points for gym supplements & merchandise.</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-brand-700">840 Pts</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Copy */}
          <div className="order-1 lg:order-2 max-w-xl">
            <span className="inline-block rounded-full bg-energy-100 px-4 py-1.5 text-sm font-semibold text-energy-700">
              Gamified Fitness
            </span>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
              Play hard. Eat clean. Earn rewards.
            </h2>
            
            <div className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 font-bold">
                  ★
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 font-heading">Earn Points Every Day</h4>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Earn 50 points for every clean meal eaten and 2500-4500* points for inviting workout buddies.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-energy-100 text-energy-600 flex items-center justify-center flex-shrink-0 font-bold">
                  🔥
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 font-heading">Streak Tracking Multipliers</h4>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Maintain your subscription streak. Hit 5, 10, or 20 days consecutive clean eating milestones to activate point multipliers and unlock custom merchandise.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <Link to={ROUTES.REWARDS}>
                <Button className="w-full sm:w-auto justify-center bg-gray-900 hover:bg-brand-600 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-colors cursor-pointer">
                  Explore Rewards Store
                </Button>
              </Link>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                *Inviting points distribution is subject to Fuel Box's{' '}
                <Link to={ROUTES.TERMS} className="font-medium transition-colors duration-200" style={{ color: '#16a34a' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#ea580c'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#16a34a'}
                >Terms & Conditions</Link>.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
