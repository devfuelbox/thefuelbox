import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Modal } from '@/components/ui'
import { useCartStore } from '@/store/cartStore'

const MEALS = [
  { type: "Breakfast", description: "Start your day with a balanced breakfast.", icon: "🌅" },
  { type: "Lunch", description: "Refuel midday with a nutritious lunch.", icon: "☀️" },
  { type: "Dinner", description: "End your day with a satisfying dinner." , icon: "🌙" },
];

const PLANS = [
  { id: "weekly5", name: "Weekly Plan", duration: "Mon – Fri (5 days)", days: 5, tag: "" },
  { id: "monthly20", name: "Monthly Basic", duration: "Mon – Fri (20 days)", days: 20, tag: "10% OFF" },
  { id: "monthly24", name: "Monthly Plus", duration: "Mon – Sat (24 days)", days: 24, tag: "15% OFF" },
  { id: "monthly30", name: "Monthly Premium", duration: "Mon – Sun (30 days)", days: 30, tag: "20% OFF" },
];

const MENU_ITEMS = [
  { id: 1, name: 'Chicken Breast', price: 80, needsCooking: true },
  { id: 2, name: 'Egg White', price: 25, needsCooking: true },
  { id: 3, name: 'Paneer', price: 70, needsCooking: true },
  { id: 4, name: 'Fish', price: 90, needsCooking: true },
  { id: 5, name: 'Tofu', price: 55 },
  { id: 6, name: 'Soya Chunks', price: 30 },
];

function getBasePrice() {
  const stored = localStorage.getItem('fuelbox_subscription_items');
  if (!stored) return 0;
  try {
    const items = JSON.parse(stored);
    if (!Array.isArray(items) || items.length === 0) return 0;

    const mealPrice = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const cookingFee = items.filter((item: any) => item.cookable).length * 5;
    const deliveryCost = 15;
    const profitCost = 20;
    const packagingCost = 5;
    const rawTotal = mealPrice + cookingFee + deliveryCost + profitCost + packagingCost;

    const remainder = rawTotal % 10;
    const rounded = remainder >= 5 ? rawTotal + (10 - remainder) : rawTotal - remainder;
    return rounded - 1;
  } catch {
    return 0;
  }
}

function computePrice(mealsPerDay: number, days: number, planId: string, basePrice: number) {
  if (basePrice === 0) return { displayPrice: 0, strikePrice: 0 };
  const effectiveMeals = Math.max(1, mealsPerDay);
  const raw = effectiveMeals * days * basePrice;
  const strikePrice = raw;
  let discount = 0;
  if (planId === 'monthly20') discount = 0.10;
  else if (planId === 'monthly24') discount = 0.15;
  else if (planId === 'monthly30') discount = 0.20;
  const discounted = Math.round(raw * (1 - discount));
  const remainder = discounted % 10;
  const rounded = remainder >= 5 ? discounted + (10 - remainder) : discounted - remainder;
  const displayPrice = rounded - 1;
  return { displayPrice, strikePrice };
}

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const cartItems = useCartStore(s => s.items);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [showConfirm, setShowConfirm] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const state = location.state as Record<string, unknown> | null;

    if (state?.selectedMeals) {
      setSelectedMeals(state.selectedMeals as string[]);
    } else {
      const saved = localStorage.getItem('selectedMeals');
      if (saved) { try { setSelectedMeals(JSON.parse(saved)) } catch {} }
    }

    if (state?.type === 'subscription' && state?.planId) {
      setSelectedPlan(state.planId as string);
    } else {
      const plan = localStorage.getItem('selectedPlan');
      if (plan) setSelectedPlan(plan);
    }

    if (state?.deliveryTimes) {
      setDeliveryTimes(state.deliveryTimes as Record<string, string>);
    } else {
      const savedDt = localStorage.getItem('deliveryTimes');
      if (savedDt) { try { setDeliveryTimes(JSON.parse(savedDt)) } catch {} }
    }
  }, [location.state]);

  const stateType = (location.state as Record<string, unknown> | null)?.type
  const isMealOrder = stateType === 'meal';
  const COOKING_CHARGE = 5;
  const subtotal = cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const cookingFee = cartItems.reduce((sum, item) => sum + (item.menuItem.cookable ? COOKING_CHARGE : 0), 0);
  const DELIVERY_CHARGE = 15;
  const PROFIT_MARGIN = 20;
  const otherCharges = cookingFee + DELIVERY_CHARGE + PROFIT_MARGIN;
  const cartTotal = subtotal + otherCharges;

  const plan = PLANS.find(p => p.id === selectedPlan);
  const basePrice = getBasePrice();
  const priceInfo = plan ? computePrice(selectedMeals.length, plan.days, plan.id, basePrice) : null;

  const handleRequestOrder = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: 'Request was Successful ✓', visible: true });
    toastTimer.current = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    useCartStore.getState().clearCart();
    setTimeout(() => setShowConfirm(true), 500);
  };

  return (
    <>
      <style>{`
        @keyframes blobDrift1 {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); }
          100% { transform: translate(60px,80px) rotate(25deg) scale(1.1); }
        }
        @keyframes blobDrift2 {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); }
          100% { transform: translate(-50px,-60px) rotate(-20deg) scale(1.08); }
        }
        @keyframes blobDrift3 {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(-30px,40px) scale(0.9); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e2f0e2, #fde8d8)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '3rem',
      }}>
        <div style={{
          position: 'absolute', width: '520px', height: '520px',
          borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
          background: 'radial-gradient(ellipse at center, rgba(22,163,74,0.18) 0%, transparent 70%)',
          top: '-120px', left: '-100px', pointerEvents: 'none',
          animation: 'blobDrift1 14s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: '460px', height: '460px',
          borderRadius: '45% 55% 40% 60% / 60% 40% 55% 45%',
          background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.15) 0%, transparent 70%)',
          bottom: '-80px', right: '-80px', pointerEvents: 'none',
          animation: 'blobDrift2 18s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: '220px', height: '220px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(251,146,60,0.18) 0%, transparent 70%)',
          top: '20%', right: '18%', pointerEvents: 'none',
          animation: 'blobDrift3 22s ease-in-out infinite alternate',
        }} />

        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '520px', padding: '0 1rem' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '1.25rem',
            animation: 'fadeIn 0.6s ease forwards',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.08) inset',
            padding: '2rem',
          }}>
            <h1 style={{ textAlign: 'center', color: '#111827', fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              Order Summary
            </h1>

            {isMealOrder ? (
              <>
                {cartItems.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Items Ordered
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {cartItems.map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{item.menuItem.name}</span>
                          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{item.quantity} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {plan && (
                  <div style={{ borderRadius: '0.75rem', background: '#f0fdf4', padding: '1rem', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>{plan.name}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.125rem' }}>{plan.duration}</p>
                      </div>
                      {plan.tag && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem',
                          fontSize: '0.75rem', fontWeight: 700, borderRadius: '9999px',
                          background: '#16a34a', color: '#fff',
                        }}>
                          {plan.tag}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Meal Selection
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {MEALS.map(meal => (
                      <span
                        key={meal.type}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700,
                          borderRadius: '0.5rem',
                          background: selectedMeals.includes(meal.type) ? '#16a34a' : '#f3f4f6',
                          color: selectedMeals.includes(meal.type) ? '#fff' : '#6b7280',
                          boxShadow: selectedMeals.includes(meal.type) ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
                        }}
                      >
                        {meal.icon} {meal.type} {selectedMeals.includes(meal.type) && '✓'}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {Object.keys(deliveryTimes).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Delivery Times
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {Object.entries(deliveryTimes).map(([meal, time]) => (
                    <div key={meal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{meal}</span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(priceInfo || isMealOrder) && (
              <>
                {isMealOrder ? (
                  <div style={{ borderRadius: '0.75rem', background: '#f9fafb', padding: '1rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Subtotal</span>
                      <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 600 }}>₹{subtotal}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Other Charges {cookingFee > 0 ? `(Cooking ₹${cookingFee} + Delivery ₹${DELIVERY_CHARGE} + ₹${PROFIT_MARGIN})` : `(Delivery ₹${DELIVERY_CHARGE} + ₹${PROFIT_MARGIN})`}</span>
                      <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 600 }}>₹{otherCharges}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total
                      </span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>
                        ₹{cartTotal}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ borderRadius: '0.75rem', background: '#f9fafb', padding: '1rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Total
                    </span>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>
                      ₹{priceInfo?.displayPrice ?? 0}
                    </span>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleRequestOrder}
              style={{
                width: '100%', padding: '0.75rem 1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: '#e8510a',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                border: 'none', borderRadius: '0.6rem', cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 4px 16px rgba(234,88,12,0.35)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(234,88,12,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,88,12,0.35)';
              }}
            >
              Request Order
            </button>
          </div>
        </div>
      </section>

      {toast.visible && (
        <div className="fixed bottom-24 right-8 z-50 backdrop-blur-xl bg-green-500/20 border border-green-400/40 shadow-2xl rounded-2xl px-7 py-5 text-base font-semibold text-green-900 animate-fade-in min-w-[320px]">
          <span className="flex items-center gap-3">
            <svg className="h-6 w-6 text-green-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {toast.message}
          </span>
        </div>
      )}

      <Modal isOpen={showConfirm} onClose={() => { setShowConfirm(false); navigate('/orders'); }} title="Order Confirmed" size="md">
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-gray-700 text-base leading-relaxed">
            Our team associate will contact you within 2–4 working hours to confirm your order. 
            Thank you for your patience. The payment process will be discussed by the team associate.
          </p>
          <button
            onClick={() => { setShowConfirm(false); navigate('/orders'); }}
            style={{
              width: '100%', padding: '0.75rem 1.5rem',
              background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              border: 'none', borderRadius: '0.6rem', cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
              (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(22,163,74,0.5)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(22,163,74,0.35)';
            }}
          >
            Got it
          </button>
        </div>
      </Modal>
    </>
  )
}
