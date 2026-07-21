import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui';
import { ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { applyReferralCode } from '@/lib/api';
import { registerSchema } from '@/lib/validation/auth';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, MapPin, Gift, ArrowRight, Send, CheckCircle, Shield } from 'lucide-react';

// ---------------------------------------------------------------------------
// FloatingInput – dark glassmorphism variant with react-hook-form support
// ---------------------------------------------------------------------------
interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  name?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  rightPad?: string;
}

function FloatingInput({
  id, label, type = 'text', value, defaultValue, icon, rightSlot,
  required, autoComplete, error, inputRef, name, onChange, onBlur: externalOnBlur, inputMode, rightPad,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!defaultValue);
  const lifted = focused || hasValue || (value !== undefined && value.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div
        style={{
          position: 'relative', borderRadius: '0.6rem',
          border: error
            ? '1.5px solid rgba(239,68,68,0.7)'
            : focused ? '1.5px solid #16a34a' : '1.5px solid #d1d5db',
          background: error
            ? 'rgba(239,68,68,0.05)'
            : focused ? 'rgba(22,163,74,0.06)' : '#ffffff',
          backdropFilter: 'blur(8px)',
          boxShadow: error
            ? '0 0 0 3px rgba(239,68,68,0.15)'
            : focused ? '0 0 0 3px rgba(22,163,74,0.18)' : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
        }}
        onMouseEnter={e => {
          if (!focused) {
            (e.currentTarget as HTMLDivElement).style.borderColor = error
              ? 'rgba(239,68,68,0.9)' : 'rgba(0,0,0,0.3)';
            (e.currentTarget as HTMLDivElement).style.background = '#f9fafb';
          }
        }}
        onMouseLeave={e => {
          if (!focused) {
            (e.currentTarget as HTMLDivElement).style.borderColor = error
              ? 'rgba(239,68,68,0.7)' : '#d1d5db';
            (e.currentTarget as HTMLDivElement).style.background = error
              ? 'rgba(239,68,68,0.05)' : '#ffffff';
          }
        }}
      >
        {/* Green left-accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px',
          borderRadius: '0 3px 3px 0', background: error ? '#ef4444' : '#16a34a',
          opacity: focused ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: 'none',
        }} />

        {icon && (
          <div style={{
            position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            color: error ? '#f87171' : focused ? '#16a34a' : '#9ca3af',
            transition: 'color 0.2s ease', pointerEvents: 'none',
          }}>
            {icon}
          </div>
        )}

        <label htmlFor={id} style={{
          position: 'absolute',
          left: icon ? '2.75rem' : '0.875rem',
          top: lifted ? '0.35rem' : '50%',
          transform: lifted ? 'translateY(0) scale(0.78)' : 'translateY(-50%)',
          transformOrigin: 'left center',
          color: error ? '#f87171' : focused ? '#16a34a' : '#6b7280',
          fontSize: '0.95rem', fontWeight: lifted ? 600 : 400, pointerEvents: 'none',
          transition: 'top 0.18s ease, transform 0.18s ease, color 0.18s ease',
        }}>
          {label}
        </label>

        <input
          id={id} name={name} ref={inputRef} type={type}
          defaultValue={defaultValue} value={value}
          required={required} autoComplete={autoComplete}
          inputMode={inputMode}
          onChange={e => { setHasValue(e.target.value.length > 0); onChange?.(e); }}
          onFocus={() => setFocused(true)}
          onBlur={e => { setFocused(false); externalOnBlur?.(e); }}
          style={{
            width: '100%', paddingTop: '1.4rem', paddingBottom: '0.5rem',
            paddingLeft: icon ? '2.75rem' : '0.875rem',
            paddingRight: rightPad ?? (rightSlot ? '2.75rem' : '0.875rem'),
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.95rem', color: '#111827', borderRadius: '0.6rem',
          }}
        />

        {rightSlot && (
          <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
            {rightSlot}
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '0.78rem', color: '#f87171', marginLeft: '0.25rem' }}>{error}</p>
      )}
    </div>
  );
}

function PasswordInput(props: Omit<FloatingInputProps, 'type' | 'rightSlot'>) {
  const [show, setShow] = useState(false);
  return (
    <FloatingInput
      {...props}
      type={show ? 'text' : 'password'}
      rightSlot={
        show
          ? <EyeOff size={18} style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={() => setShow(false)} />
          : <Eye size={18} style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={() => setShow(true)} />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Floating food emojis
// ---------------------------------------------------------------------------
const FOOD_EMOJIS = ['🥗', '🍱', '🥑', '🫙', '🥦', '🍎', '🏋️', '💪', '🔥', '🥩', '🫐', '🥕'];
function FoodEmojis() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {FOOD_EMOJIS.map((emoji, i) => (
        <span key={i} style={{
          position: 'absolute', fontSize: `${1.1 + (i % 3) * 0.35}rem`,
          left: `${(i * 8.3) % 100}%`, opacity: 0.07,
          animation: `floatUp ${14 + (i % 6) * 3}s linear ${i * 1.8}s infinite`,
          userSelect: 'none',
        }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registration page
// ---------------------------------------------------------------------------
type RegistrationFormValues = {
  firstName: string; lastName: string; email: string;
  mobileNumber: string; password: string; confirmPassword: string; pinCode: string; referralCode?: string;
};

export default function Registration() {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState('');
  const [otpStep, setOtpStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [otpValue, setOtpValue] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<RegistrationFormValues>({ 
      resolver: zodResolver(registerSchema),
      defaultValues: {
        referralCode: refCode || '',
      }
    });

  const startOtpTimer = () => {
    setOtpTimer(60);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) { clearInterval(otpTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (otpTimerRef.current) clearInterval(otpTimerRef.current); }, []);

  const emailValue = watch('email', '');

  const handleSendOtp = async () => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setOtpError('Enter a valid email first');
      return;
    }
    setIsSendingOtp(true);
    setOtpError('');
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const { error } = await supabase.from('otp_verifications').insert({
        email: emailValue,
        otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke('send-otp', {
        body: { email: emailValue, otp },
      });

      if (fnError) {
        console.error('Edge Function error:', fnError);
      }

      setOtpStep('sent');
      startOtpTimer();
    } catch (err) {
      console.error(err);
      setOtpError('Failed to send OTP. Try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) return;
    setIsVerifyingOtp(true);
    setOtpError('');
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error } = await supabase.rpc('verify_email_otp', {
        p_email: emailValue,
        p_otp: otpValue,
      });

      if (error) throw error;

      if (data === true) {
        setOtpStep('verified');
      } else {
        setOtpError('Invalid or expired OTP. Try again.');
      }
    } catch (err) {
      console.error(err);
      setOtpError('Invalid OTP. Try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const onSubmit = async (data: RegistrationFormValues) => {
    if (otpStep !== 'verified') {
      setSubmitError('Please verify your email with OTP first.');
      return;
    }
    setSubmitError('');
    const { firstName, lastName, email, password, mobileNumber, pinCode, referralCode } = data;
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { error: fnError } = await supabase.functions.invoke('create-account', {
        body: {
          email,
          password,
          fullName: `${firstName} ${lastName}`,
          mobileNumber,
          pinCode,
          referralCode,
        },
      });

      if (fnError) {
        let msg = fnError.message;
        try {
          const body = await (fnError as any).context?.json();
          msg = body?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // ── Frontend Fallback for Referral linking ────────────────────────────────
      // If the edge function wasn't deployed, it won't link the referral. 
      // We do it here from the frontend just to be 100% sure.
      if (referralCode && referralCode.trim() !== '' && authData?.user?.id) {
        try {
          const result = await applyReferralCode(referralCode.trim().toUpperCase(), authData.user.id)
          if (!result.success) {
            console.warn('Referral code fallback failed:', result.message)
          }
        } catch (e) {
          console.warn('Failed to link referral in frontend fallback:', e);
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
      navigate(from || ROUTES.HOME, { replace: true });
    } catch (e) {
      setSubmitError('Something went wrong. Please try again.');
      console.error(e);
    }
  };

  const rFirstName = register('firstName');
  const rLastName = register('lastName');
  const rEmail = register('email');
  const rMobile = register('mobileNumber');
  const rPassword = register('password');
  const rConfirm = register('confirmPassword');
  const rPin = register('pinCode');
  const rReferral = register('referralCode');

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(100vh) rotate(0deg);   opacity: 0; }
          10%  { opacity: 0.07; }
          90%  { opacity: 0.07; }
          100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }
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
        .fuel-btn-orange {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #ea580c, #f97316);
          color: #fff; font-weight: 700; font-size: 0.95rem;
          border: none; border-radius: 0.6rem; cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
          box-shadow: 0 4px 16px rgba(234,88,12,0.35);
        }
        .fuel-btn-orange:hover:not(:disabled) {
          transform: scale(1.02); filter: brightness(1.08);
          box-shadow: 0 6px 24px rgba(234,88,12,0.5);
        }
        .fuel-btn-orange:active:not(:disabled) { transform: scale(0.98); }
        .fuel-btn-orange:disabled { opacity: 0.6; cursor: not-allowed; }
        .fuel-link { color: #ea580c; font-weight: 600; text-decoration: none; transition: color 0.2s ease; }
        .fuel-link:hover { color: #16a34a; }
        .fuel-link-green { color: #16a34a !important; }
        .fuel-link-green:hover { color: #ea580c !important; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e8f5e9 0%, #f0fdf4 35%, #fff8f0 70%, #ffffff 100%)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        {/* Blobs */}
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
          position: 'absolute', width: '220px', height: '220px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(251,146,60,0.18) 0%, transparent 70%)',
          top: '20%', right: '18%', pointerEvents: 'none',
          animation: 'blobDrift3 22s ease-in-out infinite alternate',
        }} />
        <FoodEmojis />

        {/* Glass card */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '1.25rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.5) inset',
            position: 'relative',
          }} className="px-5 py-6 sm:px-8 sm:py-8">
            {/* Shimmer line */}
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
            }} />

            <h1 style={{ textAlign: 'center', color: '#111827', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.2rem' }}>
              Create Account
            </h1>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Join <span style={{ color: '#16a34a', fontWeight: 700 }}>Fuel Box</span> and fuel your fitness
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Google button */}
              <button type="button" onClick={loginWithGoogle} className="fuel-btn-orange" style={{
                background: '#ffffff',
                border: '1px solid #d1d5db',
                boxShadow: 'none', color: '#374151', fontWeight: 600,
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#9ca3af';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                  background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
                }}>
                  <svg viewBox="0 0 533.5 544.3" style={{ width: '1rem', height: '1rem' }} xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M533.5 278.4c0-18.3-1.6-36-4.6-53.2H272v100.7h146.9c-6.4 34.9-25.6 64.5-54.5 84.1v70.1h88c51.6-47.5 81.1-117.5 81.1-201.7z" />
                    <path fill="#4285F4" d="M272 544.3c73.4 0 134.9-24.3 179.9-66l-88-70.1c-24.5 16.4-55.7 26-91.9 26-70.6 0-130.4-47.5-151.7-111.4h-90v70.5c45.1 89.9 138.1 150 241.7 150z" />
                    <path fill="#FBBC05" d="M120.3 323c-5.8-16.8-9.1-34.8-9.1-53.5s3.3-36.7 9.1-53.5v-70.5h-90c-18.6 36.5-29.2 78.2-29.2 124s10.6 87.5 29.2 124l90-70.5z" />
                    <path fill="#34A853" d="M272 107c39.9 0 75.9 13.8 104.1 40.9l78-78c-47.9-44.5-110.5-71.9-182.1-71.9-103.6 0-196.5 60.1-241.7 150l90 70.5c21.3-63.9 81-111.4 151.7-111.4z" />
                  </svg>
                </div>
                <span>Sign up with Google</span>
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Name row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FloatingInput
                    id="firstName" label="First Name" icon={<User size={16} />}
                    name={rFirstName.name} inputRef={rFirstName.ref}
                    onChange={rFirstName.onChange} onBlur={rFirstName.onBlur}
                    error={errors.firstName?.message} autoComplete="given-name"
                  />
                  <FloatingInput
                    id="lastName" label="Last Name" icon={<User size={16} />}
                    name={rLastName.name} inputRef={rLastName.ref}
                    onChange={rLastName.onChange} onBlur={rLastName.onBlur}
                    error={errors.lastName?.message} autoComplete="family-name"
                  />
                </div>

                <FloatingInput
                  id="email" label="Email" type="email" icon={<Mail size={16} />}
                  name={rEmail.name} inputRef={rEmail.ref}
                  onChange={rEmail.onChange} onBlur={rEmail.onBlur}
                  error={errors.email?.message} autoComplete="email"
                  rightPad="8rem" rightSlot={otpStep === 'idle' ? (
                    <button type="button" onClick={handleSendOtp} disabled={isSendingOtp} style={{
                      fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap',
                      padding: '0.4rem 0.85rem', border: 'none', borderRadius: '0.4rem',
                      cursor: isSendingOtp ? 'not-allowed' : 'pointer',
                      color: isSendingOtp ? '#9ca3af' : '#fff',
                      background: isSendingOtp ? '#e5e7eb' : '#f97316',
                      transition: 'all 0.15s ease',
                    }}
                      onMouseEnter={e => { if (!isSendingOtp) { (e.currentTarget as HTMLButtonElement).style.background = '#ea580c'; } }}
                      onMouseLeave={e => { if (!isSendingOtp) { (e.currentTarget as HTMLButtonElement).style.background = '#f97316'; } }}
                    >
                      {isSendingOtp ? '…' : 'Send OTP'}
                    </button>
                  ) : undefined}
                />

                {otpStep === 'sent' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', animation: 'fadeInUp 0.3s ease forwards' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit OTP"
                        value={otpValue}
                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setOtpValue(v); }}
                        style={{
                          flex: 1, padding: '0.65rem 0.875rem', fontSize: '1rem', letterSpacing: '0.3em',
                          textAlign: 'center', fontWeight: 700,
                          border: otpError ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid #d1d5db',
                          borderRadius: '0.6rem', outline: 'none', background: '#fff',
                          transition: 'border-color 0.2s ease',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#16a34a'; }}
                        onBlur={e => { e.target.style.borderColor = otpError ? 'rgba(239,68,68,0.7)' : '#d1d5db'; }}
                      />
                      <button type="button" onClick={handleVerifyOtp} disabled={otpValue.length < 6 || isVerifyingOtp} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap',
                        color: '#fff', background: otpValue.length < 6 ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #22c55e)',
                        border: 'none', borderRadius: '0.6rem', cursor: otpValue.length < 6 ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: otpValue.length >= 6 ? '0 3px 12px rgba(22,163,74,0.3)' : 'none',
                      }}>
                        <Shield size={16} />
                        {isVerifyingOtp ? '…' : 'Verify'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {otpError && <span style={{ fontSize: '0.78rem', color: '#f87171' }}>{otpError}</span>}
                      {!otpError && <span />}
                      {otpTimer > 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Resend in {otpTimer}s</span>
                      ) : (
                        <button type="button" onClick={handleSendOtp} disabled={isSendingOtp} style={{
                          fontSize: '0.78rem', fontWeight: 600, color: '#16a34a',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        }}>
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {otpStep === 'verified' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.55rem 0.875rem', borderRadius: '0.6rem',
                    background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                    fontSize: '0.85rem', fontWeight: 600, color: '#16a34a',
                    animation: 'fadeInUp 0.3s ease forwards',
                  }}>
                    <CheckCircle size={18} />
                    Email verified
                  </div>
                )}

                <FloatingInput
                  id="mobileNumber" label="Mobile Number" type="tel" icon={<Phone size={16} />}
                  name={rMobile.name} inputRef={rMobile.ref}
                  onChange={rMobile.onChange} onBlur={rMobile.onBlur}
                  error={errors.mobileNumber?.message} autoComplete="tel"
                />

                <PasswordInput
                  id="password" label="Password" icon={<Lock size={16} />}
                  name={rPassword.name} inputRef={rPassword.ref}
                  onChange={rPassword.onChange} onBlur={rPassword.onBlur}
                  error={errors.password?.message} autoComplete="new-password"
                />

                <PasswordInput
                  id="confirmPassword" label="Confirm Password" icon={<Lock size={16} />}
                  name={rConfirm.name} inputRef={rConfirm.ref}
                  onChange={rConfirm.onChange} onBlur={rConfirm.onBlur}
                  error={errors.confirmPassword?.message} autoComplete="new-password"
                />

                <FloatingInput
                  id="pinCode" label="Pincode" type="text" inputMode="numeric" icon={<MapPin size={16} />}
                  name={rPin.name} inputRef={rPin.ref}
                  onChange={rPin.onChange} onBlur={rPin.onBlur}
                  error={errors.pinCode?.message} autoComplete="postal-code"
                />

                <FloatingInput
                  id="referralCode" label="Referral Code (Optional)" icon={<Gift size={16} />}
                  name={rReferral.name} inputRef={rReferral.ref}
                  onChange={rReferral.onChange} onBlur={rReferral.onBlur}
                  error={errors.referralCode?.message} autoComplete="off"
                />

                {submitError && (
                  <p style={{
                    color: '#111827', fontSize: '0.85rem', textAlign: 'center',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '0.5rem', padding: '0.5rem 0.75rem',
                  }}>
                    {submitError}
                  </p>
                )}

                <button type="submit" disabled={isSubmitting} className="fuel-btn-orange" style={{ marginTop: '0.25rem' }}>
                  <span>{isSubmitting ? 'Creating account…' : 'Create Account'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>

            {/* <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '1.25rem' }}>
              Already have an account?{' '}
              <Link to={ROUTES.LOGIN} className="fuel-link" style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}>Log In</Link>
            </p> */}
          </div>
        </div>
      </section>
    </>
  );
}