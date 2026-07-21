import { useState } from 'react'
import { Mail, User, MessageSquare, CheckCircle } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { submitContactForm } from '@/lib/api'

function FloatingInput({
  id, label, type = 'text', value, onChange, icon, required, autoComplete, multiline,
}: {
  id: string; label: string; type?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; icon?: React.ReactNode; required?: boolean; autoComplete?: string; multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0

  const sharedStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: '0.6rem',
    border: focused ? '1px solid #16a34a' : '1px solid #d1d5db',
    background: '#fff',
    boxShadow: focused ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  }

  return (
    <div
      style={sharedStyle}
      onMouseEnter={e => {
        if (!focused) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.3)'
          ;(e.currentTarget as HTMLDivElement).style.background = '#f9fafb'
        }
      }}
      onMouseLeave={e => {
        if (!focused) {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'
          ;(e.currentTarget as HTMLDivElement).style.background = '#ffffff'
        }
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px',
        borderRadius: '0 3px 3px 0', background: '#000',
        opacity: focused ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: 'none',
      }} />

      {icon && (
        <div style={{
          position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          color: '#000', transition: 'color 0.2s ease', pointerEvents: 'none',
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
        color: '#000',
        fontSize: '0.95rem',
        fontWeight: lifted ? 600 : 400,
        pointerEvents: 'none',
        transition: 'top 0.18s ease, transform 0.18s ease, color 0.18s ease',
        paddingInline: lifted ? '2px' : '0',
      }}>
        {label}
      </label>

      {multiline ? (
        <textarea
          id={id} value={value} onChange={onChange} required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', paddingTop: '1.4rem', paddingBottom: '0.5rem',
            paddingLeft: icon ? '2.75rem' : '0.875rem',
            paddingRight: '0.875rem',
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.95rem', color: '#111827', borderRadius: '0.6rem',
            minHeight: '120px', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
      ) : (
        <input
          id={id} type={type} value={value} onChange={onChange}
          required={required} autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', paddingTop: '1.4rem', paddingBottom: '0.5rem',
            paddingLeft: icon ? '2.75rem' : '0.875rem',
            paddingRight: '0.875rem',
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.95rem', color: '#111827', borderRadius: '0.6rem',
          }}
        />
      )}
    </div>
  )
}

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) return

    setSubmitting(true)
    setError('')
    try {
      await submitContactForm(formData)
      setIsSubmitted(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e2f0e2, #fde8d8)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px', padding: '1rem' }}>
          <Card className="p-8 border border-gray-200 bg-white rounded-2xl shadow-sm space-y-4 text-center clay-card">
            <div className="mx-auto w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Thank You, {formData.name}!</h1>
            <p className="text-gray-600">
              Your message has been received. We will get back to you at <span className="font-semibold">{formData.email}</span> as soon as possible.
            </p>
            <Button
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                setIsSubmitted(false)
                setFormData({ name: '', email: '', message: '' })
              }}
            >
              Send Another Message
            </Button>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e2f0e2, #fde8d8)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
      `}</style>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '480px', padding: '1rem' }}>
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '1.25rem',
          animation: 'fadeIn 0.6s ease forwards',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
          padding: '2.25rem 2rem', position: 'relative',
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            borderRadius: '1px',
          }} />

          <h1 style={{ textAlign: 'center', color: '#111827', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Contact Us
          </h1>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Have a question? We'd love to hear from you.
          </p>

          {error && (
            <p style={{
              color: '#f87171', fontSize: '0.85rem', textAlign: 'center',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '1rem',
            }}>
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FloatingInput
              id="name" label="Your Name" type="text"
              value={formData.name} onChange={e => handleInputChange('name', e.target.value)}
              icon={<User size={18} />} required autoComplete="name"
            />
            <FloatingInput
              id="email" label="Your Email" type="email"
              value={formData.email} onChange={e => handleInputChange('email', e.target.value)}
              icon={<Mail size={18} />} required autoComplete="email"
            />
            <FloatingInput
              id="message" label="Message" multiline
              value={formData.message} onChange={e => handleInputChange('message', e.target.value)}
              icon={<MessageSquare size={18} />} required
            />

            <button type="submit" disabled={submitting} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', padding: '0.75rem 1.5rem',
              background: '#e8510a', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              border: 'none', borderRadius: '0.6rem', cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
              boxShadow: '0 4px 16px rgba(234,88,12,0.35)', opacity: submitting ? 0.6 : 1,
              marginTop: '0.25rem',
            }}
              onMouseEnter={e => { if (!submitting) { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(234,88,12,0.5)' } }}
              onMouseLeave={e => { if (!submitting) { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.filter = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,88,12,0.35)' } }}
              onMouseDown={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
              onMouseUp={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)' }}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
