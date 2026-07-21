import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { fetchUserProfile, updateUserProfile, fetchUserSubscription, applyReferralCode, fetchReferralRecords, computeReferralStats } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { Button, Card, Badge, Modal, Input, Select, Spinner } from '@/components/ui'
import { ROUTES } from '@/lib/constants'
import type { User, FitnessGoal, DietType } from '@/types/user'
import type { UserSubscription } from '@/types/subscription'

const FITNESS_GOAL_OPTIONS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'general_health', label: 'General Health' },
]

const DIET_TYPE_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-Vegetarian' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const PLAN_META: Record<string, { name: string; days: number; tag: string }> = {
  weekly5: { name: 'Weekly Plan', days: 5, tag: '' },
  monthly20: { name: 'Monthly Basic', days: 20, tag: '10% OFF' },
  monthly24: { name: 'Monthly Plus', days: 24, tag: '15% OFF' },
  monthly30: { name: 'Monthly Premium', days: 30, tag: '20% OFF' },
}

// ─── Dummy OTP verification widget (testing only) ─────────────────────────────
function PhoneOtpWidget({ phone, onVerified }: { phone: string; onVerified: () => void }) {
  const [stage, setStage] = useState<'idle' | 'sent' | 'verified'>('idle')
  const [otpCode, setOtpCode] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState('')

  const handleSend = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setOtpCode(code)
    setStage('sent')
    setError('')
    setInputVal('')
    console.info(`[FuelBox TEST OTP] Code for ${phone}: ${code}`)
  }

  const handleVerify = () => {
    if (inputVal.trim() === otpCode) {
      setStage('verified')
      setError('')
      onVerified()
    } else {
      setError('Incorrect code. Try again.')
    }
  }

  if (stage === 'idle') {
    return (
      <button
        onClick={handleSend}
        className="text-xs font-semibold text-orange-600 border border-orange-300 rounded-full px-2.5 py-0.5 hover:bg-orange-50 transition-colors"
      >
        Verify →
      </button>
    )
  }

  if (stage === 'sent') {
    return (
      <div className="flex flex-col gap-1.5 mt-1 w-full">
        <p className="text-xs text-gray-500">Enter the 6-digit code sent to +91{phone}</p>
        <p className="text-xs font-bold text-amber-600 bg-amber-50 rounded px-2 py-0.5 w-fit">
          🧪 Testing hint — code: <span className="font-mono tracking-widest">{otpCode}</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter OTP"
            className="w-32 px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleVerify}
            disabled={inputVal.length < 6}
            className="text-xs font-bold text-white bg-orange-500 rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-orange-600 transition-colors"
          >
            Verify
          </button>
          <button onClick={handleSend} className="text-xs text-gray-400 underline underline-offset-2">
            Resend
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
      ✓ Verified
    </span>
  )
}

export default function Profile() {

  const { user: authUser } = useAuthStore()
  const { logout, signup, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [profile, setProfile] = useState<User | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [submittingReferral, setSubmittingReferral] = useState(false)
  const [referralMsg, setReferralMsg] = useState('')
  const [referralStats, setReferralStats] = useState({ stage: 0, total_referred: 0, successful_count: 0, pending_count: 0, total_points: 0 })

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    dob: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    fitness_goal: '' as FitnessGoal | '',
    diet_type: '' as DietType | '',
    address: '',
    city: '',
    pincode: '',
    health_issues: '',
    email: '',
    password: '',
    confirm_password: '',
  })

  useEffect(() => {
    if (!authUser?.id) {
      // 1. Try to load onboarding answers first
      const pendingRegStr = localStorage.getItem('fuelbox_pending_reg')
      const onboardingAnswersStr = localStorage.getItem('fuelbox_onboarding_answers_final')
      
      let parsedReg = pendingRegStr ? JSON.parse(pendingRegStr) : null
      let parsedAns = onboardingAnswersStr ? JSON.parse(onboardingAnswersStr) : null

      if (parsedReg || parsedAns) {
        const mappedGoal = parsedAns?.goal === 'loss' ? 'weight_loss' : parsedAns?.goal === 'gain' ? 'muscle_gain' : parsedAns?.goal === 'muscle' ? 'muscle_gain' : parsedAns?.goal === 'maintenance' ? 'maintenance' : ''
        const mappedDiet = parsedAns?.food === 'veg' ? 'vegetarian' : parsedAns?.food === 'egg' ? 'eggetarian' : parsedAns?.food === 'nonveg' ? 'non_vegetarian' : ''

        setFormData({
          full_name: parsedReg?.name || parsedAns?.name || '',
          phone: parsedReg?.phone || parsedAns?.phone || '',
          dob: '',
          gender: parsedAns?.gender?.toLowerCase() || '',
          height: parsedAns?.height ? String(parsedAns?.height) : '',
          weight: parsedAns?.weight ? String(parsedAns?.weight) : '',
          fitness_goal: mappedGoal,
          diet_type: mappedDiet,
          address: '',
          city: '',
          pincode: '',
          health_issues: '',
          email: '',
          password: '',
          confirm_password: '',
        })
      } else {
        // Fallback to guest_profile
        const guestStr = localStorage.getItem('guest_profile')
        if (guestStr) {
          try {
            const parsed = JSON.parse(guestStr)
            setProfile(parsed)
            setFormData({
              full_name: parsed.full_name || '',
              phone: parsed.phone || '',
              dob: parsed.dob || '',
              gender: parsed.gender || '',
              height: parsed.height ? String(parsed.height) : '',
              weight: parsed.weight ? String(parsed.weight) : '',
              fitness_goal: parsed.fitness_goal || '',
              diet_type: parsed.diet_type || '',
              address: parsed.address || '',
              city: parsed.city || '',
              pincode: parsed.pincode || '',
              health_issues: parsed.health_issues || '',
              email: '',
              password: '',
              confirm_password: '',
            })
          } catch (e) {}
        }
      }
      const savedOrders = JSON.parse(localStorage.getItem('db_orders') || '[]')
      setOrders(savedOrders)
      setIsLoading(false)
      return
    }

    async function loadData() {
      try {
        setIsLoading(true)
        const [userProfile, userSub] = await Promise.all([
          fetchUserProfile(authUser!.id),
          fetchUserSubscription(authUser!.id),
        ])
        setProfile(userProfile)
        setSubscription(userSub)
        
        const savedOrders = JSON.parse(localStorage.getItem('db_orders') || '[]')
        setOrders(savedOrders)

        // Initialize form data
        setFormData({
          full_name: userProfile.full_name || '',
          phone: userProfile.phone || '',
          dob: userProfile.dob || '',
          gender: userProfile.gender || '',
          height: userProfile.height ? String(userProfile.height) : '',
          weight: userProfile.weight ? String(userProfile.weight) : '',
          fitness_goal: userProfile.fitness_goal || '',
          diet_type: userProfile.diet_type || '',
          address: userProfile.address || '',
          city: userProfile.city || '',
          pincode: userProfile.pincode || '',
          health_issues: userProfile.health_issues || '',
          email: '',
          password: '',
          confirm_password: '',
        })

        // Load referral stats (non-critical — won't block profile loading)
        try {
          const refRecords = await fetchReferralRecords(authUser!.id)
          if (refRecords.length > 0) {
            const stats = computeReferralStats(refRecords)
            setReferralStats(stats)
          }
        } catch (_e) {
          // Referral stats are optional, don't block the page
        }
      } catch (err) {
        console.error('Failed to load profile data:', err)
        setError('Failed to load profile details. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [authUser])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)

    // Form validations
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address.')
      setIsSaving(false)
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      setIsSaving(false)
      return
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.')
      setIsSaving(false)
      return
    }
    if (!formData.full_name.trim()) {
      setError('Name is required')
      setIsSaving(false)
      return
    }

    const heightVal = formData.height ? Number(formData.height) : undefined
    const weightVal = formData.weight ? Number(formData.weight) : undefined

    if (heightVal !== undefined && (isNaN(heightVal) || heightVal <= 0 || heightVal > 300)) {
      setError('Please enter a valid height in cm (1-300)')
      setIsSaving(false)
      return
    }

    if (weightVal !== undefined && (isNaN(weightVal) || weightVal <= 0 || weightVal > 500)) {
      setError('Please enter a valid weight in kg (1-500)')
      setIsSaving(false)
      return
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Database client not initialized.')

      // Check duplicates
      const { data: dupEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email.trim())
        .maybeSingle()
      if (dupEmail) {
        setError('This email is already in use by another account.')
        setIsSaving(false)
        return
      }

      if (formData.phone) {
        const cleanPhoneInput = formData.phone.replace(/\D/g, '')
        const { data: allPhonesForReg } = await supabase
          .from('profiles')
          .select('id, phone')
          .not('phone', 'is', null)
        const dupPhone = allPhonesForReg?.find(
          (p: any) => p.phone?.replace(/\D/g, '') === cleanPhoneInput
        ) || null
        if (dupPhone) {
          setError('This mobile number is already in use by another account.')
          setIsSaving(false)
          return
        }
      }

      const { data: dupName } = await supabase
        .from('profiles')
        .select('id')
        .eq('full_name', formData.full_name.trim())
        .maybeSingle()
      if (dupName) {
        setError('This name is already registered. Please choose another name.')
        setIsSaving(false)
        return
      }

      // 1. Try create-account function or standard signup
      // Always store phone as digits-only to prevent format mismatches
      const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : formData.phone

      let created = false
      try {
        const { error: fnErr } = await supabase.functions.invoke('create-account', {
          body: {
            email: formData.email.trim(),
            password: formData.password,
            fullName: formData.full_name,
            mobileNumber: cleanPhone,
          },
        })
        if (!fnErr) created = true
      } catch (_) {}

      if (!created) {
        await signup(
          formData.email.trim(),
          formData.password,
          formData.full_name,
          cleanPhone
        )
      }

      // 2. Sign in to trigger session creation
      await login(formData.email.trim(), formData.password)

      // 3. Get session/user profile and update the database profile details
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await updateUserProfile({
          full_name: formData.full_name,
          phone: cleanPhone,
          dob: formData.dob || undefined,
          gender: formData.gender || undefined,
          height: heightVal,
          weight: weightVal,
          fitness_goal: (formData.fitness_goal || null) as FitnessGoal | null,
          diet_type: (formData.diet_type || null) as DietType | null,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          health_issues: formData.health_issues,
        })
      }

      // 4. Clean up localStorage
      localStorage.removeItem('fuelbox_pending_reg')
      localStorage.removeItem('fuelbox_onboarding_answers_final')

      // 5. Navigate to Home
      navigate(ROUTES.HOME)
    } catch (err: any) {
      console.error('[Profile Reg] Error:', err)
      setError(err?.message || 'Failed to complete profile registration. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)

    // Form validations
    if (!formData.full_name.trim()) {
      setError('Name is required')
      setIsSaving(false)
      return
    }

    if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
      setError('Mobile number must be a valid 10-digit number')
      setIsSaving(false)
      return
    }

    if (formData.pincode && !/^\d{6}$/.test(formData.pincode.trim())) {
      setError('Pincode must be a valid 6-digit number')
      setIsSaving(false)
      return
    }

    const heightVal = formData.height ? Number(formData.height) : undefined
    const weightVal = formData.weight ? Number(formData.weight) : undefined

    if (heightVal !== undefined && (isNaN(heightVal) || heightVal <= 0 || heightVal > 300)) {
      setError('Please enter a valid height in cm (1-300)')
      setIsSaving(false)
      return
    }

    if (weightVal !== undefined && (isNaN(weightVal) || weightVal <= 0 || weightVal > 500)) {
      setError('Please enter a valid weight in kg (1-500)')
      setIsSaving(false)
      return
    }

    try {
      const supabase = getSupabaseClient()
      if (supabase && authUser?.id) {
        // Check duplicate name
        if (formData.full_name.trim() !== profile?.full_name) {
          const { data: dupName } = await supabase
            .from('profiles')
            .select('id')
            .eq('full_name', formData.full_name.trim())
            .neq('id', authUser.id)
            .maybeSingle()
          if (dupName) {
            setError('This name is already registered by another account.')
            setIsSaving(false)
            return
          }
        }

        // Check duplicate phone (robust: strip spaces/formatting before comparing)
        if (formData.phone) {
          const cleanPhoneEdit = formData.phone.replace(/\D/g, '')
          const currentClean = profile?.phone?.replace(/\D/g, '') || ''
          if (cleanPhoneEdit !== currentClean) {
            const { data: allPhonesEdit } = await supabase
              .from('profiles')
              .select('id, phone')
              .not('phone', 'is', null)
              .neq('id', authUser.id)
            const dupPhone = allPhonesEdit?.find(
              (p: any) => p.phone?.replace(/\D/g, '') === cleanPhoneEdit
            ) || null
            if (dupPhone) {
              setError('This mobile number is already in use by another account.')
              setIsSaving(false)
              return
            }
          }
        }
      }

      const cleanPhoneForUpdate = formData.phone ? formData.phone.replace(/\D/g, '') : formData.phone
      const updateData = {
        full_name: formData.full_name,
        phone: cleanPhoneForUpdate,
        dob: formData.dob,
        gender: formData.gender || undefined,
        height: heightVal,
        weight: weightVal,
        fitness_goal: (formData.fitness_goal || null) as FitnessGoal | null,
        diet_type: (formData.diet_type || null) as DietType | null,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode,
        health_issues: formData.health_issues,
      }

      let updated: User
      if (authUser?.id) {
        // Save to Supabase for logged-in users
        updated = await updateUserProfile(updateData)
      } else {
        // Save to local database for guests
        updated = {
          id: 'guest',
          email: '',
          avatar_url: null,
          created_at: new Date().toISOString(),
          ...updateData,
          gender: updateData.gender as User['gender'],
        }
        localStorage.setItem('guest_profile', JSON.stringify(updated))
      }

      setProfile(updated)
      setIsEditModalOpen(false)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update profile. Please try again.'
      setError(errMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmitReferral = async () => {
    if (!referralCode.trim() || !authUser?.id) return
    setSubmittingReferral(true)
    setReferralMsg('')

    try {
      const code = referralCode.trim().toUpperCase()
      const result = await applyReferralCode(code, authUser.id)
      if (!result.success) {
        setReferralMsg(result.message || 'Failed to apply referral code. Please try again.')
        return
      }

      setProfile((prev) =>
        prev
          ? { ...prev, referred_by_name: result.referrerName || prev.referred_by_name }
          : prev
      )
      setReferralMsg(`Referral applied successfully! You were referred by ${result.referrerName || 'your friend'}.`)
      setReferralCode('')
    } catch {
      setReferralMsg('Something went wrong. Please try again.')
    } finally {
      setSubmittingReferral(false)
    }
  }

  // Calculate BMI and Category
  const getBmiDetails = () => {
    const heightCm = profile?.height
    const weightKg = profile?.weight
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
      return { bmi: null, category: 'Not set', badgeVariant: 'neutral' as const }
    }

    const heightM = heightCm / 100
    const bmi = weightKg / (heightM * heightM)
    const bmiRounded = Math.round(bmi * 10) / 10

    let category: string
    let badgeVariant: 'success' | 'warning' | 'error' | 'neutral' | 'brand'

    if (bmiRounded < 18.5) {
      category = 'Underweight'
      badgeVariant = 'neutral'
    } else if (bmiRounded >= 18.5 && bmiRounded < 25) {
      category = 'Normal'
      badgeVariant = 'success'
    } else if (bmiRounded >= 25 && bmiRounded < 30) {
      category = 'Overweight'
      badgeVariant = 'warning'
    } else {
      category = 'Obese'
      badgeVariant = 'error'
    }

    return { bmi: bmiRounded, category, badgeVariant }
  }

  const { bmi, category: bmiCategory, badgeVariant: bmiBadgeVariant } = getBmiDetails()

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!authUser) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg p-6 sm:p-8" style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E5E7EB' }}>
          <div className="text-center mb-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 text-2xl mb-3 border border-green-200">
              📝
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 font-heading">Complete Your Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Set your password and check your details to access your plan</p>
            {location.state?.fromOnboarding && (
              <div className="mt-4 rounded-xl bg-green-50 p-4 border border-green-200 text-left">
                <p className="text-sm font-semibold text-green-800">
                  🎉 OTP verified successfully!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Please complete the form below to create your account. This is required so you can log back in later and access all features like ordering, rewards, and nutrition calculators.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            {/* Account Credentials */}
            <div className="border-b border-gray-100 pb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">1. Account Credentials</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Email Address *"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Password *"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Confirm Password *"
                    name="confirm_password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={handleInputChange}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="border-b border-gray-100 pb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">2. Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name *"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Mobile Number *"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  disabled
                />
                <Input
                  label="Date of Birth"
                  name="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                />
                <Select
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  options={GENDER_OPTIONS}
                  placeholder="Select Gender"
                />
              </div>
            </div>

            {/* Physical Profile */}
            <div className="border-b border-gray-100 pb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">3. Physical Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Height (cm)"
                  name="height"
                  type="number"
                  value={formData.height}
                  onChange={handleInputChange}
                  placeholder="e.g. 175"
                />
                <Input
                  label="Weight (kg)"
                  name="weight"
                  type="number"
                  value={formData.weight}
                  onChange={handleInputChange}
                  placeholder="e.g. 70"
                />
                <Select
                  label="Fitness Goal"
                  name="fitness_goal"
                  value={formData.fitness_goal}
                  onChange={handleInputChange}
                  options={FITNESS_GOAL_OPTIONS}
                  placeholder="Select Goal"
                />
                <Select
                  label="Diet Preference"
                  name="diet_type"
                  value={formData.diet_type}
                  onChange={handleInputChange}
                  options={DIET_TYPE_OPTIONS}
                  placeholder="Select Diet"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">4. Delivery Address</h3>
              <div className="space-y-4">
                <Input
                  label="Delivery Address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="House/Office No, Street, Locality"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Coimbatore"
                  />
                  <Input
                    label="Pincode"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="641001"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-base mt-6"
              isLoading={isSaving}
            >
              Save Profile & Access FuelBox →
            </Button>
          </form>
        </Card>
      </section>
    )
  }

  // Generate User Initials for Avatar Fallback
  const getInitials = () => {
    if (!profile?.full_name) return 'FB'
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner & Hero Card */}
      <Card padding="none" className="overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-600 via-brand-500 to-energy-500 sm:h-40" />
        <div className="relative px-6 pb-6 pt-16 sm:px-8 sm:pt-20">
          <div className="absolute -top-16 left-6 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:-top-20 sm:h-36 sm:w-36 sm:text-4xl">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              getInitials()
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 font-heading">
                {profile?.full_name || '-'}
              </h1>
              <p className="text-sm font-medium text-gray-500">{profile?.email || '-'}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.REFERRALS)}
                className="w-full sm:w-auto shadow-sm border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                leftIcon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                Refer & Earn
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.REWARDS)}
                className="w-full sm:w-auto shadow-sm border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                leftIcon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                My Rewards
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsEditModalOpen(true)}
                className="w-full sm:w-auto shadow-sm"
                leftIcon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
              >
                Edit Profile
              </Button>
            </div>
          </div>

          {/* Referral entry / referred-by badge */}
          {profile && (
            <div className="mt-4 px-1">
              {profile.referred_by_name ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
                  🤝 You were referred by <strong>{profile.referred_by_name}</strong>
                </span>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter referral code"
                    className="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!referralCode.trim() || submittingReferral}
                    onClick={handleSubmitReferral}
                  >
                    {submittingReferral ? <Spinner size="sm" /> : 'Submit'}
                  </Button>
                  {referralMsg && (
                    <p className={`text-xs ${referralMsg.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>
                      {referralMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        {/* Left Column - Subscription & Details */}
        <div className="space-y-8 md:col-span-1 order-last">
          {/* Subscription Panel */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              My Subscription
            </h2>
            <div className="mt-4">
              {subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={subscription.status === 'active' ? 'brand' : 'warning'}>
                        {subscription.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-semibold text-gray-500">
                        {(subscription as any).days_per_cycle || 0} Days Cycle
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{PLAN_META[(subscription as any).plan_id]?.name || 'Subscription'} Plan</h3>
                      <p className="text-sm text-gray-600">{(subscription as any).meals_per_day || 0} meal(s) per day</p>
                    </div>
                  <div className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <p>Renews on: <strong>{new Date(subscription.end_date).toLocaleDateString()}</strong></p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-sm mt-2"
                    onClick={() => navigate(ROUTES.SUBSCRIPTIONS)}
                  >
                    Manage Plan
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-500">No active subscription plan</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => navigate(ROUTES.SUBSCRIPTIONS)}
                  >
                    Subscribe Now
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Referral Progress Card */}
          {authUser && referralStats.total_referred > 0 && (
            <Card className="shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900 font-heading">🔗 Referral Progress</h2>
                <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                  Stage {referralStats.stage} / 5
                </span>
              </div>
              <div className="mt-4">
                {/* Stage bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Stage progress</span>
                    <span className="font-semibold text-orange-600">{referralStats.stage} of 5 successful</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(referralStats.stage / 5) * 100}%`,
                        background: 'linear-gradient(90deg, #e8510a, #fb923c)',
                      }}
                    />
                  </div>
                </div>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-extrabold text-gray-900">{referralStats.total_referred}</p>
                    <p className="text-xs text-gray-500">Total Referred</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-extrabold text-green-700">{referralStats.successful_count}</p>
                    <p className="text-xs text-gray-500">Successful</p>
                  </div>
                  <div className="text-center bg-amber-50 rounded-lg p-2">
                    <p className="text-lg font-extrabold text-amber-600">{referralStats.pending_count}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="text-center bg-purple-50 rounded-lg p-2">
                    <p className="text-lg font-extrabold text-purple-700">{referralStats.total_points}</p>
                    <p className="text-xs text-gray-500">Points Earned</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 text-xs text-orange-600 hover:bg-orange-50"
                  onClick={() => navigate(ROUTES.REFERRALS)}
                >
                  View Full Referral Dashboard →
                </Button>
              </div>
            </Card>
          )}

          {/* Order History */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Order History
            </h2>
            <div className="mt-4">
              {orders && orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order: any, idx: number) => (
                    <div key={order.id || idx} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 border border-gray-100">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Order #{order.id || idx + 1}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.date || new Date()).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                      </div>
                      <Badge variant={order.status === 'completed' ? 'success' : 'warning'}>
                        {(order.status || 'pending').toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                  {orders.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => navigate(ROUTES.ORDER_STATUS)}>
                      View All Orders
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-500">No orders made yet</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate(ROUTES.MENU)}>
                    Order Now
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Goal & Preferences Card */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Preferences
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Fitness Goal</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800">
                    {FITNESS_GOAL_OPTIONS.find((g) => g.value === profile?.fitness_goal)?.label || '-'}
                  </span>
                  {profile?.fitness_goal && <Badge variant="brand">Goal</Badge>}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Diet Preference</label>
                <span className="mt-1 block text-lg font-semibold text-gray-800">
                  {DIET_TYPE_OPTIONS.find((d) => d.value === profile?.diet_type)?.label || '-'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Columns - Profile Details Dashboard */}
        <div className="space-y-8 md:col-span-2">
          {/* Personal Details */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Personal Information
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Mobile Number</label>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <p className="text-base font-semibold text-gray-800">{profile?.phone || '-'}</p>
                  {(profile as any)?.phone_verified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                      ✓ Verified
                    </span>
                  ) : profile?.phone ? (
                    <PhoneOtpWidget phone={profile.phone} onVerified={() => setProfile((p) => p ? { ...p, phone_verified: true } as any : p)} />
                  ) : null}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Email Address</label>
                <p className="mt-1 text-base font-semibold text-gray-800">{profile?.email || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Date of Birth</label>
                <p className="mt-1 text-base font-semibold text-gray-800">
                  {profile?.dob ? new Date(profile.dob).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Gender</label>
                <p className="mt-1 text-base font-semibold text-gray-800">
                  {GENDER_OPTIONS.find((g) => g.value === profile?.gender)?.label || '-'}
                </p>
              </div>
            </div>
          </Card>


          {/* Physical Profile & BMI Widget */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Physical Profile
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Height</label>
                <p className="mt-1 text-2xl font-bold text-gray-800">
                  {profile?.height ? `${profile.height} cm` : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Weight</label>
                <p className="mt-1 text-2xl font-bold text-gray-800">
                  {profile?.weight ? `${profile.weight} kg` : '-'}
                </p>
              </div>

              {/* BMI widget */}
              <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                <label className="text-xs font-bold text-gray-400 uppercase block">Body Mass Index (BMI)</label>
                {bmi ? (
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-brand-600 font-heading">{bmi}</span>
                    <Badge variant={bmiBadgeVariant} className="text-xs">{bmiCategory}</Badge>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-gray-500">Provide height & weight to calculate</p>
                )}
              </div>
            </div>
          </Card>

          {/* Location details */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Location & Delivery Address
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Delivery Address</label>
                <p className="mt-1 text-base font-semibold text-gray-800 leading-relaxed">
                  {profile?.address || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">City</label>
                <p className="mt-1 text-base font-semibold text-gray-800">
                  {profile?.city || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Pincode</label>
                <p className="mt-1 text-base font-bold text-gray-800">
                  {profile?.pincode || '-'}
                </p>
              </div>
            </div>
          </Card>

          {/* Health Issues */}
          <Card className="shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 font-heading">
              Medical & Health Conditions
            </h2>
            <div className="mt-4">
              <label className="text-xs font-semibold text-gray-400 uppercase block">Health Issues / Allergies</label>
              <p className="mt-1 text-base font-semibold text-gray-800 leading-relaxed bg-brand-50/50 p-3 rounded-lg border border-brand-100/50">
                {profile?.health_issues || '-'}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Log Out Button Section */}
      <div className="mt-12 border-t border-gray-200 pt-8 flex justify-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setShowLogoutModal(true)}
          className="w-full max-w-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 focus:ring-red-500 transition-colors shadow-sm"
          leftIcon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
        >
          Log Out Account
        </Button>
      </div>

      {/* Edit Profile Modal Dialog */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Details"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1 py-1">
          {error && (
            <div className="rounded-md bg-red-50 p-3 border border-red-200">
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name *"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Mobile Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="e.g. 9876543210"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date of Birth"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
            />
            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              options={GENDER_OPTIONS}
              placeholder="Select Gender"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Height (cm)"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleInputChange}
              placeholder="e.g. 175"
              min="1"
              max="300"
            />
            <Input
              label="Weight (kg)"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleInputChange}
              placeholder="e.g. 70"
              min="1"
              max="500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Fitness Goal"
              name="fitness_goal"
              value={formData.fitness_goal}
              onChange={handleInputChange}
              options={FITNESS_GOAL_OPTIONS}
              placeholder="Select Fitness Goal"
            />
            <Select
              label="Diet Preference"
              name="diet_type"
              value={formData.diet_type}
              onChange={handleInputChange}
              options={DIET_TYPE_OPTIONS}
              placeholder="Select Diet"
            />
          </div>

          <div className="space-y-4">
            <Input
              label="Delivery Address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="House/Office No, Street, Locality"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="e.g. Coimbatore"
              />
              <Input
                label="Pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleInputChange}
                placeholder="e.g. 600001"
                maxLength={6}
              />
            </div>
          </div>

          <div>
            <Input
              label="Health Issues / Food Allergies"
              name="health_issues"
              value={formData.health_issues}
              onChange={handleInputChange}
              placeholder="e.g. Diabetes, Peanut Allergy, Gluten intolerance"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Log Out">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">Are you sure you want to log out of your account?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLogoutModal(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500 border-transparent text-white"
              onClick={() => { setShowLogoutModal(false); handleLogout(); }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
