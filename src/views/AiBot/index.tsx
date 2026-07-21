import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, Input, Spinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { fetchMenuItems, fetchUserSubscription, fetchRecentOrders } from '@/lib/api'
import { useCartStore } from '@/store/cartStore'
import type { MenuItem } from '@/types/meal'
import type { UserSubscription } from '@/types/subscription'

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || ""

interface Message {
  sender: 'user' | 'ai'
  text: string
}

function buildSystemPrompt(
  user: ReturnType<typeof useAuthStore.getState>['user'],
  menuItems: MenuItem[],
  subscription: UserSubscription | null,
  cartItems: Array<{ menuItem: MenuItem; quantity: number }>,
  recentOrders: Awaited<ReturnType<typeof fetchRecentOrders>>,
): string {
  const menuSummary = menuItems.length > 0
    ? menuItems.slice(0, 60).map(item =>
        `- ${item.name} (${item.category}): ${item.calories}cal, ${item.protein}g protein, ${item.carbs}g carbs, ${item.fat}g fat — ₹${item.price}`
      ).join('\n')
    : ''

  const cartSummary = cartItems.length > 0
    ? cartItems.map(item => `- ${item.menuItem.name} × ${item.quantity}`).join('\n')
    : 'Your cart is empty.'

  const cartBlock = `\nCURRENT CART:\n${cartSummary}`

  const ordersBlock = recentOrders.length > 0
    ? `\n\nRECENT ORDERS:\n${recentOrders.map((o, i) =>
        `Order ${i + 1}: ${new Date(o.created_at).toLocaleDateString()} — Status: ${o.status}${o.menu_selected?.length ? ', Items: ' + o.menu_selected.map(m => m.name + ' × ' + m.quantity).join(', ') : ''}${o.selected_meals?.length ? ', Meals: ' + o.selected_meals.join(', ') : ''}`
      ).join('\n')}`
    : '\n\nThis user has no past orders.'

  const scopeRule = `CRITICAL RULE: You ONLY answer questions about FuelBox — our meals, menu, nutrition, subscriptions, pricing, orders, delivery, user profiles, cart, and order history. If the user asks about ANYTHING else (coding, writing, math, general knowledge, other websites, etc.), respond with: "I'm here to help with FuelBox-related questions only. Please ask about our meals, plans, or nutrition." Do NOT answer off-topic questions in any way.`

  if (!user) {
    return `You are the official assistant for FuelBox — a healthy meal delivery service offering fresh chef-prepared meals.

${scopeRule}

The user is browsing as a guest. Answer questions about:
- Meal plans, subscriptions, and pricing
- Menu categories and items
- How FuelBox works and delivery info
- Nutrition philosophy and ingredient quality

DATA I HAVE ACCESS TO:
- Our full menu (names, calories, protein, price, etc.)
- The user's current cart items${cartBlock}

Be friendly, informative, and CONCISE — keep answers to 2-3 sentences max. If the user asks for personal nutrition advice, politely suggest they log in or sign up for personalized recommendations.${ordersBlock}

${menuSummary ? `\nOUR MENU:\n${menuSummary}` : ''}`
  }

  const goalLabels: Record<string, string> = {
    weight_loss: 'Weight Loss',
    muscle_gain: 'Muscle Gain',
    maintenance: 'Maintenance',
    general_health: 'General Health',
  }
  const dietLabels: Record<string, string> = {
    vegetarian: 'Vegetarian',
    non_vegetarian: 'Non-Vegetarian',
    eggetarian: 'Eggetarian',
    vegan: 'Vegan',
  }

  const profileBlock = [
    `Name: ${user.full_name || 'User'}`,
    `Email: ${user.email}`,
    user.gender ? `Gender: ${user.gender}` : '',
    user.dob ? `DOB: ${user.dob}` : '',
    user.height ? `Height: ${user.height} cm` : '',
    user.weight ? `Weight: ${user.weight} kg` : '',
    user.fitness_goal ? `Fitness Goal: ${goalLabels[user.fitness_goal] || user.fitness_goal}` : '',
    user.diet_type ? `Diet Type: ${dietLabels[user.diet_type] || user.diet_type}` : '',
    user.health_issues ? `Health Issues: ${user.health_issues}` : '',
    user.address ? `Address: ${user.address}` : '',
    user.pincode ? `Pincode: ${user.pincode}` : '',
  ].filter(Boolean).join('\n')

  const subLine = subscription
    ? `Subscription: ${(subscription as any).plan_id || 'Active'} (${subscription.status})`
    : ''

  return `You are a personal AI assistant for FuelBox. You have access to this user's profile, cart, subscription, and our menu database.

${scopeRule}

USER PROFILE:
${profileBlock}
${subLine ? `\n${subLine}` : ''}
${cartBlock}

${menuSummary ? `\nOUR MENU:\n${menuSummary}` : ''}

${ordersBlock}

RULES:
- Be EXTREMELY CONCISE — 1-3 sentences per answer, never more
- Give PERSONALIZED meal recommendations from our menu based on their stats and goals
- Calculate daily calorie / protein / carb / fat targets when asked
- Answer questions about their health data, BMI, macros, cart items, orders, subscriptions, and order history
- Be friendly and encouraging
- Do NOT answer anything outside FuelBox topics — politely redirect`
}

export default function AiBot() {
  const user = useAuthStore((s) => s.user)
  const isAiBotOpen = useUiStore((s) => s.isAiBotOpen)
  const setAiBotOpen = useUiStore((s) => s.setAiBotOpen)
  const pendingAiMessage = useUiStore((s) => s.pendingAiMessage)
  const setPendingAiMessage = useUiStore((s) => s.setPendingAiMessage)
  const [isOpen, setIsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [recentOrders, setRecentOrders] = useState<Awaited<ReturnType<typeof fetchRecentOrders>>>([])
  const [dataReady, setDataReady] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const systemPromptRef = useRef('')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isAiBotOpen && !isOpen) {
      setIsOpen(true)
    }
  }, [isAiBotOpen])

  useEffect(() => {
    if (isOpen && pendingAiMessage && messages.length === 0) {
      const msg = pendingAiMessage
      setPendingAiMessage('')
      setMessage(msg)
    }
  }, [isOpen, pendingAiMessage])

  useEffect(() => {
    if (isOpen && message && !loading && messages.length === 0 && pendingAiMessage === '') {
      const timer = setTimeout(() => handleSend(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, message, loading])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && messages.length === 0) {
        setShowTooltip(true)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [isOpen, messages])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      const [items, sub, orders] = await Promise.all([
        fetchMenuItems().catch(() => [] as MenuItem[]),
        user ? fetchUserSubscription(user.id).catch(() => null) : Promise.resolve(null),
        user ? fetchRecentOrders(user.id).catch(() => []) : Promise.resolve([]),
      ])
      if (cancelled) return
      setMenuItems(items)
      setSubscription(sub)
      setRecentOrders(orders)
      setDataReady(true)
    })()
    return () => { cancelled = true }
  }, [isOpen, user])

  const cartItems = useCartStore((s) => s.items)

  const getSystemPrompt = useCallback(() => {
    return buildSystemPrompt(user, menuItems, subscription, cartItems, recentOrders)
  }, [user, menuItems, subscription, cartItems, recentOrders])

  const askAILive = async (userMessage: string): Promise<string> => {
    if (!GROQ_API_KEY) return "AI is not configured. Please set VITE_GROQ_API_KEY in .env"
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPromptRef.current },
            { role: "user", content: userMessage }
          ],
          temperature: 0.7
        })
      })

      const data = await response.json()
      if (!response.ok) return `API Error: ${data.error?.message || 'Check your Groq key.'}`
      return data.choices[0].message.content
    } catch (error) {
      console.error(error)
      return "Connection error. Please try again."
    }
  }

  const handleSend = async () => {
    if (!message.trim()) return

    systemPromptRef.current = getSystemPrompt()

    const userText = message
    setMessage('')
    setMessages((prev) => [...prev, { sender: 'user', text: userText }])
    setLoading(true)
    setShowTooltip(false)

    try {
      const aiResponse = await askAILive(userText)
      setMessages((prev) => [...prev, { sender: 'ai', text: aiResponse }])
    } catch {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Connection timeout. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
    setAiBotOpen(!isOpen)
    setShowTooltip(false)
  }

  return (
    <div
      className="fixed right-4 md:right-6 z-50 font-sans flex flex-col items-end selection:bg-orange-200"
      style={{
        bottom: isMobile
          ? 'calc(70px + env(safe-area-inset-bottom, 0px))'
          : '1.5rem'
      }}
    >

      <div
        className={`transition-all duration-300 ease-out origin-bottom-right transform ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-8 pointer-events-none'
        }`}
      >
        {isOpen && (
          <Card className="mb-4 w-85 sm:w-96 h-[480px] flex flex-col shadow-2xl border border-gray-150 bg-white rounded-2xl overflow-hidden">

            <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 p-4 text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <span className="w-2.5 h-2.5 bg-green-400 rounded-full block" />
                  <span className="w-2.5 h-2.5 bg-green-400 rounded-full block absolute top-0 left-0 animate-ping opacity-75" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-wide">FuelBox Digital Coach</h3>
                  <p className="text-[11px] text-orange-100 tracking-wider">Online & Ready</p>
                </div>
              </div>
              <button
                onClick={toggleChat}
                className="text-white/80 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-4">
                  <div className="text-4xl mb-3 animate-bounce">🥗</div>
                  <p className="text-sm font-semibold text-gray-700">
                    {user ? 'FuelBox Personal Coach' : 'FuelBox Assistant'}
                  </p>
                  <p className="text-xs mt-1 text-gray-400 leading-relaxed">
                    {user
                      ? "I have access to your profile and our menu. Ask me for personalized meal recommendations!"
                      : "Ask me anything about FuelBox meals, plans, or nutrition."}
                  </p>
                  {!dataReady && (
                    <p className="text-xs mt-2 text-orange-400 animate-pulse">Loading your data...</p>
                  )}
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm shadow-sm whitespace-pre-wrap tracking-wide transition-all ${
                      msg.sender === 'user'
                        ? 'ml-auto bg-orange-500 text-white rounded-br-none'
                        : 'mr-auto bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}

              {loading && (
                <div className="flex items-center gap-2 text-gray-400 text-xs bg-white border px-3 py-2.5 rounded-2xl w-max shadow-sm">
                  <Spinner size="sm" className="text-orange-500 animate-spin" />
                  <span>Analyzing macro data...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t bg-white flex gap-2 items-center shadow-inner">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={user ? "Ask about your meals..." : "Ask about FuelBox..."}
                className="flex-1 focus-visible:ring-orange-500 border-gray-200"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              />
              <Button onClick={handleSend} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 transition-all shadow-sm">
                Send
              </Button>
            </div>
          </Card>
        )}
      </div>

      <div className="relative flex items-center justify-end">

        {showTooltip && !tooltipDismissed && (
          <div className="absolute right-13 md:right-16 bottom-1 mr-1 bg-gray-900 text-white text-xs py-2 px-3 rounded-xl shadow-xl whitespace-nowrap tracking-wide animate-fade-in transition-all border border-gray-800 flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setTooltipDismissed(true) }}
              className="text-gray-400 hover:text-white text-sm leading-none p-0.5 rounded hover:bg-gray-700 transition-colors"
            >
              ✕
            </button>
            <span>
              <span className="font-semibold text-orange-400">FuelBox AI:</span> Have a nutrition question? Let's talk!
            </span>
            <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-t border-gray-800" />
          </div>
        )}

        <div className="relative group">
          {!isOpen && (
            <span className="absolute top-0 left-0 w-11 h-11 md:w-14 md:h-14 bg-orange-500 rounded-full animate-ping opacity-40 pointer-events-none scale-105" />
          )}

          <button
            onClick={toggleChat}
            className="relative w-11 h-11 md:w-14 md:h-14 bg-gradient-to-tr from-orange-500 via-orange-600 to-amber-500 text-white rounded-full flex items-center justify-center shadow-xl font-bold text-lg md:text-2xl active:scale-90 hover:scale-110 transition-all duration-300"
          >
            {isOpen ? (
              <span className="block transform rotate-0 scale-100 transition-transform duration-300">✕</span>
            ) : (
              <span className="block transform hover:rotate-12 transition-transform duration-200">💬</span>
            )}
          </button>
        </div>

      </div>

    </div>
  )
}
