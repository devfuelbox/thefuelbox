import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'
import { updateUserProfile, fetchUserProfile, saveOrder, saveSubscription } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useCartStore } from '@/store/cartStore'
import { AdManager } from '@/components/advertisement/AdManager'

interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  autoComplete?: string;
}

function FloatingInput({
  id, label, type = 'text', value, onChange, required, autoComplete,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '0.6rem',
        border: focused ? '1px solid #16a34a' : '1px solid #d1d5db',
        background: '#fff',
        backdropFilter: 'none',
        boxShadow: focused ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
      }}
      onMouseEnter={e => {
        if (!focused) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.3)';
          (e.currentTarget as HTMLDivElement).style.background = '#f9fafb';
        }
      }}
      onMouseLeave={e => {
        if (!focused) {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db';
          (e.currentTarget as HTMLDivElement).style.background = '#ffffff';
        }
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px',
        borderRadius: '0 3px 3px 0', background: '#000',
        opacity: focused ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: 'none',
      }} />

      <label htmlFor={id} style={{
        position: 'absolute',
        left: '0.875rem',
        top: lifted ? '0.35rem' : '50%',
        transform: lifted ? 'translateY(0) scale(0.78)' : 'translateY(-50%)',
        transformOrigin: 'left center',
        color: '#000',
        fontSize: '0.95rem',
        fontWeight: lifted ? 600 : 400,
        pointerEvents: 'none',
        transition: 'top 0.18s ease, transform 0.18s ease, color 0.18s ease',
        background: 'transparent',
        paddingInline: lifted ? '2px' : '0',
      }}>
        {label}
      </label>

      <input
        id={id} type={type} value={value} onChange={onChange}
        required={required} autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', paddingTop: '1.4rem', paddingBottom: '0.5rem',
          paddingLeft: '0.875rem', paddingRight: '0.875rem',
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '0.95rem', color: '#111827', borderRadius: '0.6rem',
        }}
      />
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPurchased } = useAuthStore();
  const [phone, setPhone] = useState('');
  
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let profileData: any = null;
    
    if (user) {
      profileData = user;
    } else {
      const guestStr = localStorage.getItem('guest_profile');
      if (guestStr) {
        try {
          profileData = JSON.parse(guestStr);
        } catch (e) {}
      }
    }

    if (profileData && !profileLoaded) {
      if (profileData.address) setAddress(profileData.address);
      if (profileData.city) setCity(profileData.city);
      if (profileData.pincode) setPincode(profileData.pincode);
      setProfileLoaded(true);
    }
  }, [user]);

  const handleSaveToProfile = async (checked: boolean) => {
    setSaveToProfile(checked);
    if (checked && user) {
      try {
        const profile = await fetchUserProfile(user.id);
        if (profile) {
          if (profile.address) setAddress(profile.address);
          if (profile.city) setCity(profile.city);
          if (profile.pincode) setPincode(profile.pincode);
          if (profile.phone) setPhone(profile.phone);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (!address || !city || !pincode) {
      alert("Please fill in all delivery details");
      return;
    }
    
    setIsSaving(true);
    
    if (saveToProfile && user) {
      try {
        await updateUserProfile({
          address,
          city,
          pincode,
          phone
        });
      } catch (err) {
        console.error("Failed to save address to profile:", err);
      }
    }
    
    const selectedMeals = Object.keys(deliveryTimes).filter(m => deliveryTimes[m].trim() !== '')
    const filteredDeliveryTimes = Object.fromEntries(
      Object.entries(deliveryTimes).filter(([_, v]) => v.trim() !== '')
    )

    const routeState = location.state as Record<string, unknown> | null
    const isSubscription = routeState?.type === 'subscription'
    
    if (isSubscription) {
      const planId = routeState?.planId as string || ''
      const planDays = planId === 'weekly5' ? 5 : planId === 'monthly20' ? 20 : planId === 'monthly24' ? 24 : planId === 'monthly30' ? 30 : 0

      let menuChosen: Array<[string, number]> = []
      try {
        const stored = localStorage.getItem('fuelbox_subscription_items')
        if (stored) {
          const items = JSON.parse(stored)
          if (Array.isArray(items)) {
            menuChosen = items.map((item: any) => [item.name, item.quantity] as [string, number])
          }
        }
      } catch (e) {
        console.warn('Failed to parse fuelbox_subscription_items', e)
      }

      let cost = 0
      try {
        const stored = localStorage.getItem('fuelbox_subscription_items')
        if (stored) {
          const items = JSON.parse(stored)
          if (Array.isArray(items) && items.length > 0) {
            const mealPrice = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0)
            const cookingFee = items.filter((item: any) => item.cookable).length * 5
            const rawTotal = mealPrice + cookingFee + 15 + 20 + 5
            const r = rawTotal % 10
            const basePrice = (r >= 5 ? rawTotal + (10 - r) : rawTotal - r) - 1

            const effectiveMeals = Math.max(1, selectedMeals.length || 1)
            const raw = effectiveMeals * planDays * basePrice
            let discount = 0
            if (planId === 'monthly20') discount = 0.10
            else if (planId === 'monthly24') discount = 0.15
            else if (planId === 'monthly30') discount = 0.20
            const discounted = Math.round(raw * (1 - discount))
            const dr = discounted % 10
            cost = (dr >= 5 ? discounted + (10 - dr) : discounted - dr) - 1
          }
        }
      } catch (e) { /* ignore */ }

      await saveSubscription({
        planId,
        mealsPerDay: selectedMeals.length || 1,
        daysPerCycle: planDays,
        cost,
        status: 'pending',
        selectedMeals,
        phone,
        address,
        city,
        pincode,
        deliveryTimes: filteredDeliveryTimes,
        menuChosen,
      })
    } else {
      const cartItems = useCartStore.getState().items
      const menuSelected = cartItems.map(item => ({
        id: item.menuItem.id,
        name: item.menuItem.name,
        price: item.menuItem.price,
        cookable: item.menuItem.cookable ?? false,
        quantity: item.quantity,
      }))

      const subtotal = cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
      const cookingFee = cartItems.reduce((sum, item) => sum + (item.menuItem.cookable ? 5 : 0), 0)
      const rawCost = subtotal + cookingFee + 15 + 20 + 5
      const cr = rawCost % 10
      const cost = (cr >= 5 ? rawCost + (10 - cr) : rawCost - cr) - 1

      await saveOrder({
        phone,
        address,
        city,
        pincode,
        cost,
        selected_meals: selectedMeals,
        delivery_times: filteredDeliveryTimes,
        status: 'pending',
        type: 'meal',
        menuSelected,
      })
    }

    const s = getSupabaseClient()
    if (s && user) {
      const { count } = await s
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      useAuthStore.getState().setHasPurchased((count ?? 0) > 0)
    }
    
    try { localStorage.removeItem('isTrialOrder') } catch (e) {}
    
    setIsSaving(false);
    const pointsToUse = (location.state as Record<string, unknown> | null)?.pointsToUse as number || 0
    navigate('/payment', { state: { phone, address, city, pincode, selectedMeals, deliveryTimes: filteredDeliveryTimes, type: isSubscription ? 'subscription' : 'meal', pointsToUse } });
  };

  useEffect(() => {
    const routeState = location.state as Record<string, unknown> | null;
    if (routeState?.selectedMeals) {
      const meals = routeState.selectedMeals as string[];
      const initial: Record<string, string> = {};
      meals.forEach(m => { initial[m] = '' });
      setDeliveryTimes(initial);
    }
  }, []);

  const MEAL_TIME_DATA: Record<string, { label: string; endMinutes: number; slots: string[] }> = {
    Breakfast: {
      label: 'Breakfast (6:00 AM - 9:30 AM)',
      endMinutes: 9 * 60 + 30,
      slots: ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM'],
    },
    Lunch: {
      label: 'Lunch (11:30 AM - 3:30 PM)',
      endMinutes: 15 * 60 + 30,
      slots: ['11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'],
    },
    Dinner: {
      label: 'Dinner (7:00 PM - 10:00 PM)',
      endMinutes: 22 * 60,
      slots: ['7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM'],
    },
  };

  function getCurrentMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function parseTimeToMinutes(timeStr: string): number {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const routeState = location.state as Record<string, unknown> | null
  const isSubscription = routeState?.type === 'subscription'

  const now = getCurrentMinutes();

  const isTrialOrder = localStorage.getItem('isTrialOrder') === 'true';

  const mealAvailability = (['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => {
    const info = MEAL_TIME_DATA[meal];
    const isPast = isSubscription ? false : now >= info.endMinutes;
    const availableSlots = isSubscription ? info.slots : (isPast ? [] : info.slots.filter(s => parseTimeToMinutes(s) > now + 60));
    return { meal, info, isPast, availableSlots };
  });

  const hasTimeSelection = Object.values(deliveryTimes).some(v => v.trim() !== '');
  const isFormValid = 
    address.trim() !== '' && 
    city.trim() !== '' && 
    pincode.trim() !== '' && 
    phone.trim() !== '' && 
    hasTimeSelection;

  return (
    <>
      <AdManager />
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

        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '640px', padding: '0 1rem' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '1.25rem',
            animation: 'fadeIn 0.6s ease forwards',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.08) inset',
          }} className="px-5 py-6 sm:px-8 sm:py-9">
            <h1 style={{ textAlign: 'center', color: '#111827', fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              Checkout
            </h1>

            <div className="space-y-4">
              <FloatingInput 
                id="address" label="Delivery Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <FloatingInput 
                id="city" label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <FloatingInput 
                id="pincode" label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
              <FloatingInput 
                id="phone" label="Mobile Number" type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="saveToProfile" 
                    checked={saveToProfile}
                    onChange={(e) => handleSaveToProfile(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', accentColor: '#16a34a' }}
                  />
                  <label htmlFor="saveToProfile" style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    Save this address and number to my profile
                  </label>
                </div>
              )}
              
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>Select Meals & Delivery Timing</h3>
                <div className="space-y-3">
                  {mealAvailability.map(({ meal, info, isPast, availableSlots }) => {
                    const isChecked = meal in deliveryTimes
                    return (
                      <div key={meal} style={{
                        padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb',
                        opacity: isPast ? 0.5 : 1, transition: 'opacity 0.2s',
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isPast ? 'not-allowed' : 'pointer' }}>
                          <input type="checkbox" checked={isChecked}
                            disabled={isPast || availableSlots.length === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDeliveryTimes(prev => ({ ...prev, [meal]: '' }))
                              } else {
                                setDeliveryTimes(prev => {
                                  const next = { ...prev }
                                  delete next[meal]
                                  return next
                                })
                              }
                            }}
                            style={{ width: '1.1rem', height: '1.1rem', accentColor: '#16a34a' }}
                          />
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{info.label}</span>
                          {isPast && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>— Window closed</span>}
                          {!isPast && availableSlots.length === 0 && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>— No slots available</span>}
                        </label>
                        {isChecked && (
                          <select
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                            value={deliveryTimes[meal] || ''}
                            onChange={(e) => setDeliveryTimes({...deliveryTimes, [meal]: e.target.value})}
                            style={{ marginTop: '0.5rem' }}
                          >
                            <option value="">Select preferred time</option>
                            {availableSlots.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '1rem' }}>
                <button
                  onClick={handlePlaceOrder}
                  disabled={!isFormValid || isSaving}
                  style={{
                    width: '100%', padding: '0.75rem 1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: !isFormValid || isSaving ? '#d1d5db' : '#e8510a',
                    color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    border: 'none', borderRadius: '0.6rem', cursor: !isFormValid || isSaving ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: isFormValid && !isSaving ? '0 4px 16px rgba(234,88,12,0.35)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (isFormValid && !isSaving) {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                      (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(234,88,12,0.5)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = isFormValid && !isSaving ? '0 4px 16px rgba(234,88,12,0.35)' : 'none';
                  }}
                >
                  {isSaving ? 'Placing Order…' : isTrialOrder && !hasPurchased && !isSubscription ? 'Order Trial Box' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
