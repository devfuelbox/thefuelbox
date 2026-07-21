// import { useState, useEffect, useRef } from 'react';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { z } from 'zod';
// import { ROUTES } from '@/lib/constants';
// import { Link } from 'react-router-dom';
// import { Mail, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

// // ---------------------------------------------------------------------------
// // Validation schema
// // ---------------------------------------------------------------------------
// const schema = z.object({
//   email: z.string().email({ message: 'Please enter a valid email address' }),
// });
// type FormValues = { email: string };

// // ---------------------------------------------------------------------------
// // FloatingInput – dark glassmorphism variant
// // ---------------------------------------------------------------------------
// interface FloatingInputProps {
//   id: string; label: string; type?: string;
//   value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   icon?: React.ReactNode; required?: boolean;
//   autoComplete?: string; error?: string;
//   name?: string; inputRef?: React.Ref<HTMLInputElement>;
//   onBlur?: React.FocusEventHandler<HTMLInputElement>;
// }
// function FloatingInput({ id, label, type = 'text', value, onChange, icon, required, autoComplete, error, name, inputRef, onBlur: externalOnBlur }: FloatingInputProps) {
//   const [focused, setFocused] = useState(false);
//   const lifted = focused || value.length > 0;

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
//       <div
//         style={{
//           position: 'relative', borderRadius: '0.6rem',
//           border: error
//             ? '1.5px solid rgba(239,68,68,0.7)'
//             : focused ? '1.5px solid #16a34a' : '1.5px solid rgba(255,255,255,0.15)',
//           background: error
//             ? 'rgba(239,68,68,0.05)'
//             : focused ? 'rgba(22,163,74,0.06)' : 'rgba(255,255,255,0.06)',
//           backdropFilter: 'blur(8px)',
//           boxShadow: error
//             ? '0 0 0 3px rgba(239,68,68,0.15)'
//             : focused ? '0 0 0 3px rgba(22,163,74,0.18)' : 'none',
//           transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
//         }}
//         onMouseEnter={e => {
//           if (!focused) {
//             (e.currentTarget as HTMLDivElement).style.borderColor = error ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.3)';
//             (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.09)';
//           }
//         }}
//         onMouseLeave={e => {
//           if (!focused) {
//             (e.currentTarget as HTMLDivElement).style.borderColor = error ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.15)';
//             (e.currentTarget as HTMLDivElement).style.background = error ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.06)';
//           }
//         }}
//       >
//         {/* Green left-accent bar */}
//         <div style={{
//           position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px',
//           borderRadius: '0 3px 3px 0', background: error ? '#ef4444' : '#16a34a',
//           opacity: focused ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: 'none',
//         }} />

//         {icon && (
//           <div style={{
//             position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
//             color: error ? '#f87171' : focused ? '#4ade80' : 'rgba(255,255,255,0.4)',
//             transition: 'color 0.2s ease', pointerEvents: 'none',
//           }}>
//             {icon}
//           </div>
//         )}

//         <label htmlFor={id} style={{
//           position: 'absolute',
//           left: icon ? '2.75rem' : '0.875rem',
//           top: lifted ? '0.35rem' : '50%',
//           transform: lifted ? 'translateY(0) scale(0.78)' : 'translateY(-50%)',
//           transformOrigin: 'left center',
//           color: error ? '#f87171' : focused ? '#4ade80' : 'rgba(255,255,255,0.4)',
//           fontSize: '0.95rem', fontWeight: lifted ? 600 : 400, pointerEvents: 'none',
//           transition: 'top 0.18s ease, transform 0.18s ease, color 0.18s ease',
//         }}>
//           {label}
//         </label>

//         <input
//           id={id} name={name} ref={inputRef} type={type} value={value} onChange={onChange}
//           required={required} autoComplete={autoComplete}
//           onFocus={() => setFocused(true)}
//           onBlur={e => { setFocused(false); externalOnBlur?.(e); }}
//           style={{
//             width: '100%', paddingTop: '1.4rem', paddingBottom: '0.5rem',
//             paddingLeft: icon ? '2.75rem' : '0.875rem', paddingRight: '0.875rem',
//             background: 'transparent', border: 'none', outline: 'none',
//             fontSize: '0.95rem', color: '#f9fafb', borderRadius: '0.6rem',
//           }}
//         />
//       </div>
//       {error && (
//         <p style={{ fontSize: '0.78rem', color: '#f87171', marginLeft: '0.25rem' }}>{error}</p>
//       )}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Step indicator
// // ---------------------------------------------------------------------------
// function StepIndicator({ step }: { step: 1 | 2 }) {
//   const steps = [
//     { label: 'Email', num: 1 },
//     { label: 'Check inbox', num: 2 },
//   ];

//   return (
//     <div style={{ marginBottom: '1.75rem' }}>
//       <div style={{ display: 'flex', alignItems: 'center' }}>
//         {steps.map((s, i) => (
//           <>
//             {/* Step dot */}
//             <div key={`dot-${s.num}`} style={{
//               width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0,
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//               fontSize: '0.75rem', fontWeight: 700,
//               border: step > s.num
//                 ? '2px solid #4ade80'
//                 : step === s.num
//                   ? '2px solid #16a34a'
//                   : '2px solid rgba(255,255,255,0.2)',
//               background: step > s.num
//                 ? '#16a34a'
//                 : step === s.num
//                   ? 'rgba(22,163,74,0.2)'
//                   : 'rgba(255,255,255,0.05)',
//               color: step > s.num ? '#fff' : step === s.num ? '#4ade80' : 'rgba(255,255,255,0.35)',
//               boxShadow: step === s.num ? '0 0 12px rgba(22,163,74,0.4)' : 'none',
//               transition: 'all 0.4s ease',
//             }}>
//               {step > s.num ? (
//                 <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
//                   <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//                 </svg>
//               ) : s.num}
//             </div>

//             {/* Connector line (not after last) */}
//             {i < steps.length - 1 && (
//               <div key={`line-${s.num}`} style={{
//                 flex: 1, height: '2px', margin: '0 0.375rem',
//                 background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden',
//                 borderRadius: '2px',
//               }}>
//                 <div style={{
//                   position: 'absolute', inset: 0,
//                   background: 'linear-gradient(90deg, #16a34a, #4ade80)',
//                   transform: step > 1 ? 'scaleX(1)' : 'scaleX(0)',
//                   transformOrigin: 'left',
//                   transition: 'transform 0.6s ease 0.2s',
//                 }} />
//               </div>
//             )}
//           </>
//         ))}
//       </div>

//       {/* Step labels */}
//       <div style={{ display: 'flex', marginTop: '0.4rem' }}>
//         {steps.map((s, i) => (
//           <div key={`label-${s.num}`} style={{
//             flex: i === 0 ? '0 0 2rem' : '1',
//             textAlign: i === 0 ? 'left' : 'right',
//             fontSize: '0.7rem', fontWeight: 600,
//             color: step === s.num ? '#4ade80' : step > s.num ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)',
//             transition: 'color 0.3s ease',
//           }}>
//             {s.label}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Success state
// // ---------------------------------------------------------------------------
// function SuccessState({ email, onResend, cooldown }: {
//   email: string; onResend: () => void; cooldown: number;
// }) {
//   return (
//     <div style={{ textAlign: 'center', animation: 'fadeInUp 0.5s ease forwards' }}>
//       {/* Animated checkmark ring */}
//       <div style={{
//         width: '80px', height: '80px', borderRadius: '50%',
//         border: '2.5px solid #16a34a', display: 'flex',
//         alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
//         background: 'rgba(22,163,74,0.1)',
//         boxShadow: '0 0 28px rgba(22,163,74,0.35)',
//         animation: 'successPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
//       }}>
//         <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
//           <path
//             d="M8 18l7 7 13-13"
//             stroke="#4ade80"
//             strokeWidth="2.5"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             style={{
//               strokeDasharray: 40,
//               strokeDashoffset: 40,
//               animation: 'drawCheck 0.45s ease 0.35s forwards',
//             }}
//           />
//         </svg>
//       </div>

//       <h2 style={{ color: '#f9fafb', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
//         Email Sent! 🎉
//       </h2>
//       <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
//         We sent a reset link to{' '}
//         <span style={{ color: '#4ade80', fontWeight: 600 }}>{email}</span>.
//         <br />
//         Check your inbox — it might take a minute.
//       </p>

//       {/* Spam tip */}
//       <div style={{
//         background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
//         borderRadius: '0.6rem', padding: '0.75rem 1rem', marginBottom: '1.5rem',
//         fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', textAlign: 'left',
//       }}>
//         💡 <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Tip:</strong> Can't find it? Check your spam or junk folder.
//       </div>

//       {/* Resend with cooldown */}
//       <button
//         onClick={onResend}
//         disabled={cooldown > 0}
//         style={{
//           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
//           width: '100%', padding: '0.7rem 1.5rem',
//           background: cooldown > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(22,163,74,0.12)',
//           border: cooldown > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(22,163,74,0.4)',
//           borderRadius: '0.6rem', cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
//           color: cooldown > 0 ? 'rgba(255,255,255,0.3)' : '#4ade80',
//           fontSize: '0.9rem', fontWeight: 600,
//           transition: 'all 0.2s ease',
//         }}
//       >
//         <RefreshCw size={16} style={{ animation: cooldown === 0 ? 'none' : undefined }} />
//         {cooldown > 0
//           ? `Resend available in ${cooldown}s`
//           : 'Resend reset link'}
//       </button>

//       {/* Cooldown progress bar */}
//       {cooldown > 0 && (
//         <div style={{
//           marginTop: '0.5rem', height: '3px', borderRadius: '2px',
//           background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
//         }}>
//           <div style={{
//             height: '100%', borderRadius: '2px',
//             background: 'linear-gradient(90deg, #16a34a, #4ade80)',
//             width: `${(cooldown / 60) * 100}%`,
//             transition: 'width 1s linear',
//           }} />
//         </div>
//       )}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Floating food emojis
// // ---------------------------------------------------------------------------
// const FOOD_EMOJIS = ['🥗', '🍱', '🥑', '🫙', '🥦', '🍎', '🏋️', '💪', '🔥', '🥩', '🫐', '🥕'];
// function FoodEmojis() {
//   return (
//     <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
//       {FOOD_EMOJIS.map((emoji, i) => (
//         <span key={i} style={{
//           position: 'absolute', fontSize: `${1.1 + (i % 3) * 0.35}rem`,
//           left: `${(i * 8.3) % 100}%`, opacity: 0.07,
//           animation: `floatUp ${14 + (i % 6) * 3}s linear ${i * 1.8}s infinite`,
//           userSelect: 'none',
//         }}>
//           {emoji}
//         </span>
//       ))}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Forgot Password page
// // ---------------------------------------------------------------------------
// const RESEND_COOLDOWN_SECS = 60;

// export default function ForgotPassword() {
//   const [step, setStep] = useState<1 | 2>(1);
//   const [submittedEmail, setSubmittedEmail] = useState('');
//   const [cooldown, setCooldown] = useState(0);
//   const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
//     useForm<FormValues>({ resolver: zodResolver(schema) });

//   const rEmail = register('email');
//   const emailValue = watch('email', '');

//   // Cooldown timer
//   const startCooldown = () => {
//     setCooldown(RESEND_COOLDOWN_SECS);
//     if (timerRef.current) clearInterval(timerRef.current);
//     timerRef.current = setInterval(() => {
//       setCooldown(prev => {
//         if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

//   const onSubmit = async (data: FormValues) => {
//     // TODO: integrate Supabase password reset functionality
//     console.log('Forgot password request', data);
//     setSubmittedEmail(data.email);
//     setStep(2);
//     startCooldown();
//   };

//   const handleResend = async () => {
//     if (cooldown > 0) return;
//     // TODO: re-trigger Supabase reset
//     console.log('Resend to', submittedEmail);
//     startCooldown();
//   };

//   return (
//     <>
//       <style>{`
//         @keyframes floatUp {
//           0%   { transform: translateY(100vh) rotate(0deg);   opacity: 0; }
//           10%  { opacity: 0.07; }
//           90%  { opacity: 0.07; }
//           100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
//         }
//         @keyframes blobDrift1 {
//           0%   { transform: translate(0,0) rotate(0deg) scale(1); }
//           100% { transform: translate(60px,80px) rotate(25deg) scale(1.1); }
//         }
//         @keyframes blobDrift2 {
//           0%   { transform: translate(0,0) rotate(0deg) scale(1); }
//           100% { transform: translate(-50px,-60px) rotate(-20deg) scale(1.08); }
//         }
//         @keyframes blobDrift3 {
//           0%   { transform: translate(0,0) scale(1); }
//           100% { transform: translate(-30px,40px) scale(0.9); }
//         }
//         @keyframes successPop {
//           0%   { transform: scale(0); opacity: 0; }
//           60%  { transform: scale(1.1); }
//           100% { transform: scale(1);   opacity: 1; }
//         }
//         @keyframes drawCheck {
//           to { stroke-dashoffset: 0; }
//         }
//         @keyframes fadeInUp {
//           from { opacity: 0; transform: translateY(16px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }
//         .fuel-btn-primary {
//           display: flex; align-items: center; justify-content: center; gap: 0.5rem;
//           width: 100%; padding: 0.75rem 1.5rem;
//           background: linear-gradient(135deg, #ea580c, #f97316);
//           color: #fff; font-weight: 700; font-size: 0.95rem;
//           border: none; border-radius: 0.6rem; cursor: pointer;
//           transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
//           box-shadow: 0 4px 16px rgba(234,88,12,0.35);
//         }
//         .fuel-btn-primary:hover:not(:disabled) {
//           transform: scale(1.02); filter: brightness(1.08);
//           box-shadow: 0 6px 24px rgba(234,88,12,0.5);
//         }
//         .fuel-btn-primary:active:not(:disabled) { transform: scale(0.98); }
//         .fuel-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
//         .fuel-link { color: #fb923c; font-weight: 600; text-decoration: none; transition: color 0.2s ease; }
//         .fuel-link:hover { color: #4ade80; }
//       `}</style>

//       <section style={{
//         minHeight: '100vh',
//         background: 'linear-gradient(135deg, #0a1f0e 0%, #1a2e1c 35%, #1c1c1c 70%, #0f0f0f 100%)',
//         position: 'relative', overflow: 'hidden',
//         display: 'flex', alignItems: 'center', justifyContent: 'center',
//         padding: '2rem 1rem',
//       }}>
//         {/* Blobs */}
//         <div style={{
//           position: 'absolute', width: '520px', height: '520px',
//           borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
//           background: 'radial-gradient(ellipse at center, rgba(22,163,74,0.3) 0%, transparent 70%)',
//           top: '-120px', left: '-100px', pointerEvents: 'none',
//           animation: 'blobDrift1 14s ease-in-out infinite alternate',
//         }} />
//         <div style={{
//           position: 'absolute', width: '460px', height: '460px',
//           borderRadius: '45% 55% 40% 60% / 60% 40% 55% 45%',
//           background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.28) 0%, transparent 70%)',
//           bottom: '-80px', right: '-80px', pointerEvents: 'none',
//           animation: 'blobDrift2 18s ease-in-out infinite alternate',
//         }} />
//         <div style={{
//           position: 'absolute', width: '220px', height: '220px', borderRadius: '50%',
//           background: 'radial-gradient(ellipse, rgba(251,146,60,0.18) 0%, transparent 70%)',
//           top: '20%', right: '18%', pointerEvents: 'none',
//           animation: 'blobDrift3 22s ease-in-out infinite alternate',
//         }} />
//         <FoodEmojis />

//         {/* Glass card */}
//         <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>
//           <div style={{
//             background: 'rgba(255,255,255,0.06)',
//             backdropFilter: 'blur(28px) saturate(160%)',
//             WebkitBackdropFilter: 'blur(28px) saturate(160%)',
//             border: '1px solid rgba(255,255,255,0.12)',
//             borderRadius: '1.25rem',
//             boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
//             padding: '2.25rem 2rem',
//             position: 'relative',
//           }}>
//             {/* Shimmer line */}
//             <div style={{
//               position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
//               background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
//             }} />

//             {/* Brand mark */}
//             <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
//               <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '1.25rem', fontFamily: 'Poppins, sans-serif' }}>Fuel</span>
//               <span style={{ color: '#fb923c', fontWeight: 800, fontSize: '1.25rem', fontFamily: 'Poppins, sans-serif' }}>Box</span>
//             </p>

//             {/* Step indicator */}
//             <StepIndicator step={step} />

//             {/* ── Step 1: Email form ── */}
//             {step === 1 && (
//               <div style={{ animation: 'fadeInUp 0.4s ease forwards' }}>
//                 <h1 style={{ color: '#f9fafb', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>
//                   Reset Password
//                 </h1>
//                 <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
//                   Enter the email tied to your account and we'll send you a reset link straight away.
//                 </p>

//                 <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
//                   <FloatingInput
//                     id="email" label="Email address" type="email"
//                     value={emailValue}
//                     onChange={rEmail.onChange}
//                     name={rEmail.name} inputRef={rEmail.ref}
//                     onBlur={rEmail.onBlur}
//                     icon={<Mail size={18} />} required autoComplete="email"
//                     error={errors.email?.message}
//                   />

//                   <button type="submit" disabled={isSubmitting} className="fuel-btn-primary">
//                     <span>{isSubmitting ? 'Sending…' : 'Send Reset Link'}</span>
//                     {!isSubmitting && <ArrowRight size={18} />}
//                   </button>
//                 </form>
//               </div>
//             )}

//             {/* ── Step 2: Success state ── */}
//             {step === 2 && (
//               <SuccessState
//                 email={submittedEmail}
//                 onResend={handleResend}
//                 cooldown={cooldown}
//               />
//             )}

//             {/* Back to login */}
//             <div style={{
//               marginTop: '1.5rem', paddingTop: '1.25rem',
//               borderTop: '1px solid rgba(255,255,255,0.08)',
//               display: 'flex', justifyContent: 'center',
//             }}>
//               <Link to={ROUTES.LOGIN} className="fuel-link" style={{
//                 display: 'flex', alignItems: 'center', gap: '0.375rem',
//                 fontSize: '0.875rem',
//               }}>
//                 <ArrowLeft size={15} />
//                 Back to Login
//               </Link>
//             </div>
//           </div>
//         </div>
//       </section>
//     </>
//   );
// }