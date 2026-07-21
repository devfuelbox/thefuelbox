import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useAuthStore } from '@/store/authStore'
import { AdManager } from '@/components/advertisement/AdManager'

interface DbOrder {
  id: number
  orderId: string
  phone: string
  address: string
  city: string
  pincode: string
  selectedMeals: string[]
  deliveryTimes: Record<string, string>
  status: string
  date: string
  cost: number
  menuSelected: Array<{ id: string; name: string; price: number; cookable: boolean; quantity: number }>
}

interface SupabaseOrder {
  id: string
  user_id: string
  phone: string
  address: string
  city: string
  pincode: string
  selected_meals: string[]
  delivery_times: Record<string, string>
  status: string
  type: string
  plan_id: string | null
  created_at: string
  cost: number
  menu_selected: Array<{ id: string; name: string; price: number; cookable: boolean; quantity: number }>
}

interface SubscriptionInfo {
  name: string
  duration: string
  days: number
  tag: string
  status: string
  startDate: string | null
  endDate: string | null
}

function InvoiceTemplate({ order }: { order: DbOrder }) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const mealsTotal = order.selectedMeals.length * 150
  const menuTotal = order.menuSelected.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)
  const total = order.cost || mealsTotal + menuTotal
  const isConfirmed = order.status === 'confirmed' || order.status === 'delivered' || order.status === 'out_for_delivery' || order.status === 'preparing'

  return (
    <div id={`invoice-${order.orderId}`} style={{ fontFamily: 'Manrope, Inter, system-ui, sans-serif', width: 595, margin: 0, padding: 32, background: '#ffffff', color: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e5e7eb', paddingBottom: 20, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', fontFamily: "'Fraunces', Georgia, serif", color: '#111827' }}>FUEL BOX</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Fresh meals · Delivered daily</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>INVOICE</div>
          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: "'Courier New', monospace", marginTop: 4 }}>#{order.orderId.slice(0, 12)}</div>
        </div>
      </div>

      {!isConfirmed && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M12 9v4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Order is <span style={{ textTransform: 'uppercase' }}>{order.status}</span>. Invoice is for reference only.</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice Date</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmtDate(order.date)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Date</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmtDate(order.date)}</div>
        </div>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Delivery Details</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{order.phone}</div>
        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>{order.address}, {order.city} - {order.pincode}</div>
      </div>

      <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            {['#', 'Item', 'Qty', 'Rate', 'Amount'].map(h => (
              <th key={h} style={{ textAlign: h === 'Qty' ? 'center' : h === 'Rate' || h === 'Amount' ? 'right' : 'left', padding: '8px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.selectedMeals.map((meal, i) => (
            <tr key={meal} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 4px', fontSize: 12, color: '#9ca3af' }}>{i + 1}</td>
              <td style={{ padding: '8px 4px', fontWeight: 600, color: '#111827' }}>{meal}</td>
              <td style={{ padding: '8px 4px', textAlign: 'center', color: '#374151' }}>1</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', color: '#374151' }}>₹150</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>₹150</td>
            </tr>
          ))}
          {order.menuSelected.map((item, i) => (
            <tr key={`menu-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 4px', fontSize: 12, color: '#9ca3af' }}>{order.selectedMeals.length + i + 1}</td>
              <td style={{ padding: '8px 4px', fontWeight: 600, color: '#111827' }}>{item.name || `Item ${i + 1}`}</td>
              <td style={{ padding: '8px 4px', textAlign: 'center', color: '#374151' }}>{item.quantity || 1}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', color: '#374151' }}>₹{item.price || 150}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>₹{(item.price || 150) * (item.quantity || 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #e5e7eb', paddingTop: 12, marginBottom: 20 }}>
        <div style={{ width: 192 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span style={{ fontWeight: 600 }}>₹{total}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Delivery</span>
            <span style={{ fontWeight: 600, color: '#16a34a' }}>FREE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#111827', borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8 }}>
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#9ca3af' }}>Fuel Box · Fresh meals delivered daily</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>This is a computer-generated invoice. No signature required.</div>
      </div>
    </div>
  )
}

export default function Orders() {
  const [tab, setTab] = useState<'meals' | 'subscriptions'>('meals')
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [generating, setGenerating] = useState<string | null>(null)
  const [pdfOrder, setPdfOrder] = useState<DbOrder | null>(null)

  const lastOrderWithMenu = orders.find(o => o.menuSelected.length > 0)

  const fetchSubscription = async () => {
    const supabase = getSupabaseClient()
    const uid = useAuthStore.getState().user?.id
    if (!supabase || !uid) return

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const planId = data.plan_id as string
      const planMeta: Record<string, { name: string; duration: string; days: number; tag: string }> = {
        weekly5: { name: 'Weekly Plan', duration: 'Mon – Fri (5 days)', days: 5, tag: '' },
        monthly20: { name: 'Monthly Basic', duration: 'Mon – Fri (20 days)', days: 20, tag: '10% OFF' },
        monthly24: { name: 'Monthly Plus', duration: 'Mon – Sat (24 days)', days: 24, tag: '15% OFF' },
        monthly30: { name: 'Monthly Premium', duration: 'Mon – Sun (30 days)', days: 30, tag: '20% OFF' },
      }
      const meta = planMeta[planId] || { name: 'Custom Plan', duration: '', days: data.days_per_cycle || 0, tag: '' }
      setSubscription({
        name: meta.name,
        duration: meta.duration || `${data.days_per_cycle || 0} days`,
        days: meta.days,
        tag: meta.tag,
        status: data.status || 'pending',
        startDate: data.start_date || null,
        endDate: data.end_date || null,
      })
    } else {
      setSubscription(null)
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase || !user) return

    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setOrders((data as SupabaseOrder[]).map(o => ({
            id: Number(new Date(o.created_at).getTime()),
            orderId: o.id,
            phone: o.phone || '',
            address: o.address || '',
            city: o.city || '',
            pincode: o.pincode || '',
            selectedMeals: o.selected_meals || [],
            deliveryTimes: o.delivery_times || {},
            status: o.status || 'pending',
            cost: o.cost || 0,
            date: o.created_at,
            menuSelected: o.menu_selected || [],
          })))
        }
      })

    fetchSubscription()
  }, [user])

  // Real-time subscription for order status changes
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase || !user) return

    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newOrder = payload.new as SupabaseOrder | null
          if (!newOrder) return
          setOrders(prev => {
            const updated = prev.map(o =>
              o.id === Number(new Date(newOrder.created_at).getTime())
                ? { ...o, status: newOrder.status }
                : o
            )
            return updated
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Real-time subscription for subscription status changes
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase || !user) return

    const channel = supabase
      .channel('subscriptions-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => { fetchSubscription() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function generatePDF(order: DbOrder) {
    setGenerating(order.orderId)
    setPdfOrder(order)
    await new Promise(r => setTimeout(r, 100))

    const origHtmlBg = document.documentElement.style.backgroundColor
    const origBodyBg = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = '#ffffff'
    document.body.style.backgroundColor = '#ffffff'

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const element = document.getElementById(`invoice-${order.orderId}`)
      if (!element) throw new Error('Invoice element not found')

      const opt = {
        margin: 0,
        filename: `invoice-${order.orderId.slice(0, 8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'px' as const, format: [595, 842] as [number, number], orientation: 'portrait' as const },
      }
      await html2pdf().set(opt).from(element).save()
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      document.documentElement.style.backgroundColor = origHtmlBg
      document.body.style.backgroundColor = origBodyBg
      setGenerating(null)
      setPdfOrder(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'preparing': return 'bg-purple-100 text-purple-800'
      case 'out_for_delivery': return 'bg-orange-100 text-orange-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AdManager />
      <h1 className="text-3xl font-extrabold text-gray-900 font-heading mb-6">My Orders</h1>

      {/* Tabs */}
      <div className="cir-tabs clay-card mb-8">
        <label className="flex items-center">
          <input type="radio" name="order-tab" className="cir-tabs__r"
            checked={tab === 'meals'}
            onChange={() => setTab('meals')} />
          <span className="cir-tabs__t">Meals</span>
        </label>
        <label className="flex items-center">
          <input type="radio" name="order-tab" className="cir-tabs__r"
            checked={tab === 'subscriptions'}
            onChange={() => setTab('subscriptions')} />
          <span className="cir-tabs__t">Subscriptions</span>
        </label>
      </div>

      {tab === 'meals' && (
        <>
          {orders.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
              <Link to={ROUTES.MENU} className="text-brand-600 hover:text-brand-700 font-medium">
                Browse Menu
              </Link>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div key={order.id}>
                <Card className="overflow-hidden animate-[fadeSlideUp_0.5s_ease-out]">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Order placed</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {new Date(order.date).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Delivery</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{order.address}, {order.city}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Order ID</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">#{order.id}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                    <button onClick={() => generatePDF(order)} disabled={generating === order.orderId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 transition disabled:opacity-50"
                    >
                      {generating === order.orderId ? (
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      )}
                      {generating === order.orderId ? 'Downloading…' : 'PDF'}
                    </button>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Meals</p>
                        <div className="flex flex-wrap gap-2">
                          {order.selectedMeals.map(meal => (
                            <span key={meal} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-brand-50 text-brand-700">
                              {meal}
                            </span>
                          ))}
                        </div>
                      </div>
                      {Object.keys(order.deliveryTimes).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Delivery Times</p>
                          <div className="space-y-1">
                            {Object.entries(order.deliveryTimes).map(([meal, time]) => (
                              <p key={meal} className="text-sm text-gray-700">
                                <span className="font-medium">{meal}:</span> {time}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Contact</p>
                        <p className="text-sm text-gray-700">{order.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Total</p>
                        <p className="text-sm font-semibold text-gray-900">₹{order.cost}</p>
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'subscriptions' && (
        <>
          {subscription ? (
            <Card className="overflow-hidden animate-[fadeSlideUp_0.5s_ease-out]">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Current Plan</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{subscription.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Duration</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{subscription.duration}</p>
                </div>
                {subscription.tag && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    {subscription.tag}
                  </span>
                )}
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Plan Days</p>
                    <p className="text-sm text-gray-700">{subscription.days} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                    <p className={`text-sm font-semibold ${subscription.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <p className="text-sm text-gray-600">Want to upgrade or modify your subscription?</p>
                    <button
                      onClick={() => navigate(ROUTES.SUBSCRIPTIONS)}
                      className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 transition shadow-sm cursor-pointer self-start sm:self-auto"
                    >
                      Upgrade Subscription
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-500 mb-4">No active subscription plan.</p>
              <Link to={ROUTES.SUBSCRIPTIONS} className="text-brand-600 hover:text-brand-700 font-medium">
                View Plans
              </Link>
              {lastOrderWithMenu && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      localStorage.setItem('fuelbox_subscription_items', JSON.stringify(lastOrderWithMenu.menuSelected))
                      if (lastOrderWithMenu.selectedMeals.length > 0) {
                        localStorage.setItem('selectedMeals', JSON.stringify(lastOrderWithMenu.selectedMeals))
                      }
                      navigate(ROUTES.SUBSCRIPTIONS)
                    }}
                    className="text-sm text-brand-600 hover:text-brand-700 underline cursor-pointer"
                  >
                    Subscribe to get food at off prices and more rewards
                  </button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {pdfOrder && typeof document !== 'undefined' && document.body && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, opacity: 0.01, pointerEvents: 'none', width: 595 }}>
          <InvoiceTemplate order={pdfOrder} />
        </div>,
        document.body
      )}
    </div>
  )
}
