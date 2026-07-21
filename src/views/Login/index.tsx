import { Eye, Lock, User, EyeOff, ArrowRight, Dumbbell } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// FloatingInput
// ---------------------------------------------------------------------------
interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
}

function FloatingInput({
  id, label, type = 'text', value, onChange, icon, rightSlot, required, autoComplete,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div
      className={`relative rounded-[0.6rem] border bg-white transition-[border-color,box-shadow] duration-200 ${
        focused
          ? 'border-green-600 shadow-[0_0_0_2px_rgba(22,163,74,0.2)]'
          : 'border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
      }`}
    >
      {/* left accent bar */}
      <div
        className={`absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-[3px] bg-green-600 pointer-events-none transition-opacity duration-200 ${
          focused ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {icon && (
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 ${
            focused ? 'text-green-600' : 'text-gray-500'
          }`}
        >
          {icon}
        </div>
      )}

      <label
        htmlFor={id}
        className={`absolute origin-left pointer-events-none text-[0.95rem] transition-[top,transform,color] duration-[180ms] ${
          icon ? 'left-11' : 'left-3.5'
        } ${
          lifted ? 'top-[0.35rem] translate-y-0 scale-[0.78] font-semibold' : 'top-1/2 -translate-y-1/2 font-normal'
        } ${focused ? 'text-green-600' : 'text-gray-500'}`}
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-[0.6rem] border-none bg-transparent pt-[1.4rem] pb-2 text-[0.95rem] text-gray-900 outline-none ${
          icon ? 'pl-11' : 'pl-3.5'
        } ${rightSlot ? 'pr-11' : 'pr-3.5'}`}
      />

      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

// Floating food emoji ambient layer
const FOOD_EMOJIS = ['🥗', '🥑', '🍅', '🍔', '🍕', '🥤'];
function FoodEmojis() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {FOOD_EMOJIS.map((emoji, i) => (
        <span
          key={i}
          className="absolute select-none opacity-[0.07]"
          style={{
            fontSize: `${1.2 + (i % 3) * 0.4}rem`,
            left: `${(i * 8.3) % 100}%`,
            animation: `floatUp ${14 + (i % 6) * 3}s linear ${i * 1.8}s infinite`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { login, isLoading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setSubmitting(true);

  try {
    await login(email, password);

    // Get user role after successful login
    const role = localStorage.getItem("fuelbox_user_role");

    console.log("Logged in Role:", role);

    if (role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    // Normal users
    const from = (
      location.state as { from?: { pathname: string } } | null
    )?.from?.pathname;

    navigate(from || ROUTES.HOME, { replace: true });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Invalid email or password";

    setError(msg);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <>
      {/* Only truly custom keyframes live here — everything else is Tailwind utilities */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.07; }
          90%  { opacity: 0.07; }
          100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blobDrift1 {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(60px,80px) scale(1.1); }
        }
        @keyframes blobDrift2 {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(-50px,-60px) scale(1.08); }
        }
      `}</style>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#e2f0e2] to-[#fde8d8]">
        {/* blobs */}
        <div
          className="pointer-events-none absolute -left-[100px] -top-[120px] h-[520px] w-[520px] rounded-[60%_40%_55%_45%/50%_60%_40%_50%] bg-[radial-gradient(ellipse_at_center,rgba(22,163,74,0.18)_0%,transparent_70%)]"
          style={{ animation: 'blobDrift1 14s ease-in-out infinite alternate' }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-[460px] w-[460px] rounded-[45%_55%_40%_60%/60%_40%_55%_45%] bg-[radial-gradient(ellipse_at_center,rgba(234,88,12,0.15)_0%,transparent_70%)]"
          style={{ animation: 'blobDrift2 18s ease-in-out infinite alternate' }}
        />

        <FoodEmojis />

        <div className="relative z-10 w-full max-w-[420px] p-4">
          <div
            className="relative rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:px-8 sm:py-9"
            style={{ animation: 'fadeIn 0.6s ease forwards' }}
          >
            {/* Header */}
            <h1 className="mb-1 text-center text-[1.75rem] font-extrabold text-gray-900">
              Welcome Back! 💪🏻
            </h1>
            <p className="mb-2 text-center text-[0.9rem] text-gray-500">
              Login as admin
            </p>
            <div className="mb-5 text-center">
              <span className="text-[28px] font-extrabold text-[#e8510a]">Fuel </span>
              <span className="text-[28px] font-extrabold text-green-500">Box</span>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-green-600/20" />
              <Dumbbell size={16} className="text-green-600" />
              <div className="h-px flex-1 bg-green-600/20" />
            </div>

            {/* Email + Password Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FloatingInput
                id="email" label="Email" type="email"
                value={email} onChange={e => setEmail(e.target.value)}
                icon={<User size={18} />} required autoComplete="username"
              />
              <FloatingInput
                id="password" label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                icon={<Lock size={18} />} required autoComplete="current-password"
                rightSlot={
                  showPassword
                    ? <EyeOff size={18} className="cursor-pointer text-gray-500" onClick={() => setShowPassword(false)} />
                    : <Eye size={18} className="cursor-pointer text-gray-500" onClick={() => setShowPassword(true)} />
                }
              />

              <div className="-mt-1 flex justify-start">
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-[0.85rem] font-semibold text-orange-400 no-underline transition-colors duration-200 hover:text-green-400"
                >
                  Forgot Password?
                </Link>
              </div>

              {error && (
                <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-center text-[0.85rem] text-red-400">
                  {error}
                </p>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={submitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-[0.6rem] border-none bg-[#e8510a] px-6 py-[0.85rem] text-[0.95rem] font-bold text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] transition-transform duration-200 enabled:hover:scale-[1.02] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{submitting ? 'Logging in…' : 'Login'}</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Hidden: Google + Signup (code kept, not deleted) */}
            {false && <>{loginWithGoogle}</>}
          </div>
        </div>
      </section>
    </>
  )
}