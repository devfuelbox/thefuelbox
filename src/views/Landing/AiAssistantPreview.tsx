import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import { useUiStore } from '@/store/uiStore'
import { useScrollReveal } from './useScrollReveal'

export default function AiAssistantPreview() {
  const { ref, isVisible } = useScrollReveal<HTMLElement>()
  const [inputText, setInputText] = useState('')
  const setAiBotOpen = useUiStore((s) => s.setAiBotOpen)
  const setPendingAiMessage = useUiStore((s) => s.setPendingAiMessage)

  const handleOpenAiBot = (text?: string) => {
    if (text?.trim()) {
      setPendingAiMessage(text.trim())
    }
    setAiBotOpen(true)
  }

  return (
    <section
      id="ai-assistant-preview"
      ref={ref}
      className="bg-white py-20 lg:py-28"
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          
          {/* Left Column: Copy */}
          <div className="max-w-xl">
            <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
              Next-Gen Tech
            </span>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 font-heading sm:text-4xl">
              Ask Our AI Nutrition Assistant
            </h2>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              Struggling to calculate macros after a heavy workout? Chat directly with our integrated AI nutritionist. 
            </p>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              Our AI instantly scans your metabolic profile, logs your goals, and offers real-time meal swaps, nutritional breakdowns, and caloric adjustments on the fly.
            </p>
            
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                className="bg-brand-600 hover:bg-brand-750 text-white font-semibold shadow-md transition-colors cursor-pointer py-4 px-6 text-base"
                onClick={() => handleOpenAiBot()}
              >
                Chat with AI Assistant
              </Button>
              <Link to={ROUTES.QUIZ}>
                <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold transition-colors cursor-pointer py-4 text-base">
                  Try Fitness Quiz
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive-looking Chat Interface Mock */}
          <div className="relative">
            {/* Background decorative blob */}
            <div className="absolute -inset-2 bg-gradient-to-tr from-brand-300 to-energy-300 rounded-2xl blur-xl opacity-30" />
            
            <Card className="relative bg-gray-950 border border-gray-800 rounded-2xl shadow-xl overflow-hidden text-white p-6 max-w-lg mx-auto">
              {/* Top chat header */}
              <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
                <div className="relative h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center font-bold text-white text-lg">
                  AI
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-400 rounded-full border border-gray-950 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-heading text-brand-500">Fuel Box</h4>
                  <p className="text-[10px] text-brand-400 font-semibold">Active Nutrition Advisor</p>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="space-y-4 min-h-[220px] text-xs">
                {/* Bubble 1: User */}
                <div className="flex flex-col items-end">
                  <div className="bg-gray-800 text-gray-200 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                    I just finished a heavy leg day. Need a high-protein vegetarian meal under 600 calories.
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1">10:42 AM</span>
                </div>

                {/* Bubble 2: AI */}
                <div className="flex flex-col items-start">
                  <div className="bg-brand-900/60 border border-brand-500/20 text-brand-100 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                    Got it! I recommend the <strong className="text-brand-300">Supercharged Paneer Tikka Bowl</strong>. It packs <strong className="text-white">40g of slow-release casein protein</strong> for recovery, 52g carbs to restock glycogen, and sits at <strong className="text-white">560 kcal</strong>.
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1">10:42 AM</span>
                </div>

                {/* Bubble 3: User */}
                <div className="flex flex-col items-end">
                  <div className="bg-gray-800 text-gray-200 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                    Sounds perfect, swap that in for my Tuesday Dinner.
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1">10:43 AM</span>
                </div>

                {/* Bubble 4: AI */}
                <div className="flex flex-col items-start animate-[pulse_2s_infinite]">
                  <div className="bg-brand-900/60 border border-brand-500/20 text-brand-100 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                    Done! Tuesday dinner swapped. Your updated daily totals are ready to view. Good job on the workout! 💪
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1">Just now</span>
                </div>
              </div>

              {/* Input box */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask AI about recipes, swaps, or goals..."
                  className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 transition-colors"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleOpenAiBot(inputText) }}
                />
                <div
                  className="h-8 w-8 bg-brand-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors"
                  onClick={() => handleOpenAiBot(inputText)}
                >
                  <svg className="h-4 w-4 fill-white" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>
          
        </div>
      </div>
    </section>
  )
}