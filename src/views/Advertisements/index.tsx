/**
 * Advertisement Management Admin Dashboard
 * =========================================
 * Full CRUD interface for managing advertisements in Supabase.
 *
 * Features:
 *  - Stat cards (total, active, views, clicks, CTR)
 *  - Search + Status filter + Date range filter
 *  - Data table with all columns + actions
 *  - Add / Edit modal with image upload & form validation
 *  - View modal (read-only detailed view)
 *  - Delete confirmation modal
 *  - Real-time stats after every mutation
 *  - Admin-only access guard (email check)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useAdminAds } from '@/hooks/useAdvertisements'
import {
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
} from '@/lib/advertisementApi'
import { computeAdDisplayStatus } from '@/lib/advertisementApi'
import { ROUTES } from '@/lib/constants'
import type {
  Advertisement,
  AdvertisementFormData,
  AdFormErrors,
  AdFilters,
  AdType,
  AdStatus,
  AdDisplayStatus,
} from '@/types/advertisement'
import {
  AD_TYPE_LABELS,
  AD_DISPLAY_STATUS_LABELS,
} from '@/types/advertisement'

// ── Constants ───────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@fuelbox.in' // Change to your admin email

const AD_TYPES: Array<{ value: AdType; label: string }> = [
  { value: 'home_banner', label: 'Home Banner' },
  { value: 'menu_banner', label: 'Menu Banner' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'popup', label: 'Popup' },
]

const FILTER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
]

const INITIAL_FORM: AdvertisementFormData = {
  name: '',
  image: null,
  image_url: null,
  short_description: '',
  ad_type: 'home_banner',
  cta_text: '',
  redirect_url: '',
  start_date: '',
  end_date: '',
  status: 'inactive',
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function validateAdForm(data: AdvertisementFormData): AdFormErrors {
  const errors: AdFormErrors = {}
  if (!data.name.trim()) errors.name = 'Advertisement name is required'
  else if (data.name.trim().length > 100) errors.name = 'Name must be under 100 characters'

  if (!data.ad_type) errors.ad_type = 'Advertisement type is required'
  if (!data.start_date) errors.start_date = 'Start date is required'
  if (!data.end_date) errors.end_date = 'End date is required'
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    errors.end_date = 'End date must be after start date'
  }
  if (data.redirect_url && data.redirect_url.trim()) {
    const url = data.redirect_url.trim()
    if (!url.startsWith('/') && !url.startsWith('#') && !url.startsWith('http')) {
      errors.redirect_url = 'URL must start with /, #, http:// or https://'
    }
  }
  return errors
}

// ── Status Badge ───────────────────────────────────────────
const STATUS_BADGE_STYLES: Record<AdDisplayStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 border border-gray-200',
  scheduled: 'bg-blue-100 text-blue-700 border border-blue-200',
  expired: 'bg-red-100 text-red-700 border border-red-200',
}

const STATUS_BADGE_DOTS: Record<AdDisplayStatus, string> = {
  active: 'bg-emerald-500 animate-pulse',
  inactive: 'bg-gray-400',
  scheduled: 'bg-blue-500',
  expired: 'bg-red-500',
}

function StatusBadge({ ad }: { ad: Advertisement }) {
  const displayStatus = computeAdDisplayStatus(ad)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[displayStatus]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_BADGE_DOTS[displayStatus]}`} />
      {AD_DISPLAY_STATUS_LABELS[displayStatus]}
    </span>
  )
}

// ── Stat Cards ─────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  gradient: string
  sub?: string
}

function StatCard({ label, value, icon, gradient, sub }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{label}</p>
          <p className="mt-1 text-3xl font-bold font-heading">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-white/60">{sub}</p>}
        </div>
        <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">
          {icon}
        </div>
      </div>
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/10" />
    </motion.div>
  )
}

// ── Image Preview ──────────────────────────────────────────
interface ImageUploadProps {
  previewUrl: string | null
  onFileChange: (file: File | null) => void
  error?: string
}

function ImageUploadField({ previewUrl, onFileChange, error }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      alert('Image size must be under 5MB')
      return
    }
    onFileChange(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-gray-700">Advertisement Image</label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative flex items-center justify-center w-full h-44 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50'
          }`}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white font-semibold text-sm">Change Image</span>
            </div>
          </>
        ) : (
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="mt-2 text-sm font-medium text-gray-600">Click to upload image</p>
            <p className="text-xs text-gray-400">PNG, JPG, WebP — max 5MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Ad Form Modal ──────────────────────────────────────────
interface AdFormModalProps {
  isOpen: boolean
  editAd: Advertisement | null
  onClose: () => void
  onSaved: () => void
}

function AdFormModal({ isOpen, editAd, onClose, onSaved }: AdFormModalProps) {
  const [form, setForm] = useState<AdvertisementFormData>(INITIAL_FORM)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<AdFormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Populate form when editing
  useEffect(() => {
    if (editAd) {
      setForm({
        name: editAd.name,
        image: null,
        image_url: editAd.image_url,
        short_description: editAd.short_description ?? '',
        ad_type: editAd.ad_type,
        cta_text: editAd.cta_text ?? '',
        redirect_url: editAd.redirect_url ?? '',
        start_date: editAd.start_date,
        end_date: editAd.end_date,
        status: editAd.status,
      })
      setImagePreview(editAd.image_url)
    } else {
      setForm(INITIAL_FORM)
      setImagePreview(null)
    }
    setErrors({})
    setSaveError(null)
  }, [editAd, isOpen])

  const handleImageChange = (file: File | null) => {
    setForm((f) => ({ ...f, image: file }))
    if (file) {
      const url = URL.createObjectURL(file)
      setImagePreview(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setImagePreview(form.image_url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateAdForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      if (editAd) {
        await updateAdvertisement(editAd.id, form, editAd.image_url)
      } else {
        await createAdvertisement(form)
      }
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 font-heading">
            {editAd ? 'Edit Advertisement' : 'New Advertisement'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Image Upload */}
          <ImageUploadField
            previewUrl={imagePreview}
            onFileChange={handleImageChange}
            error={errors.image as string | undefined}
          />

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Advertisement Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((err) => ({ ...err, name: undefined })) }}
              placeholder="e.g. Summer Sale Banner"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-brand-500'}`}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Short Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Short Description</label>
            <textarea
              value={form.short_description}
              onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
              placeholder="Brief description shown on the banner..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 resize-none"
            />
          </div>

          {/* Row: Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.ad_type}
                onChange={(e) => setForm((f) => ({ ...f, ad_type: e.target.value as AdType }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 bg-white cursor-pointer"
              >
                {AD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AdStatus }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 bg-white cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* CTA Text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">CTA Button Text</label>
            <input
              type="text"
              value={form.cta_text}
              onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
              placeholder="e.g. Order Now, Learn More"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500"
            />
          </div>

          {/* Redirect URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Redirect URL</label>
            <input
              type="text"
              value={form.redirect_url}
              onChange={(e) => { setForm((f) => ({ ...f, redirect_url: e.target.value })); setErrors((err) => ({ ...err, redirect_url: undefined })) }}
              placeholder="/menu or https://example.com"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${errors.redirect_url ? 'border-red-400' : 'border-gray-300 focus:border-brand-500'}`}
            />
            {errors.redirect_url && <p className="text-xs text-red-600">{errors.redirect_url}</p>}
            <p className="text-xs text-gray-400">Use /route for internal pages, or https://... for external links</p>
          </div>

          {/* Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => { setForm((f) => ({ ...f, start_date: e.target.value })); setErrors((err) => ({ ...err, start_date: undefined })) }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${errors.start_date ? 'border-red-400' : 'border-gray-300 focus:border-brand-500'}`}
              />
              {errors.start_date && <p className="text-xs text-red-600">{errors.start_date}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => { setForm((f) => ({ ...f, end_date: e.target.value })); setErrors((err) => ({ ...err, end_date: undefined })) }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${errors.end_date ? 'border-red-400' : 'border-gray-300 focus:border-brand-500'}`}
              />
              {errors.end_date && <p className="text-xs text-red-600">{errors.end_date}</p>}
            </div>
          </div>

          {/* Save Error */}
          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                editAd ? 'Save Changes' : 'Create Advertisement'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── View Modal ─────────────────────────────────────────────
function AdViewModal({ ad, onClose, onEdit }: { ad: Advertisement; onClose: () => void; onEdit: () => void }) {
  const ctr = ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(2) : '0.00'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 font-heading">Advertisement Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {ad.image_url && (
            <img src={ad.image_url} alt={ad.name} className="w-full h-48 object-cover rounded-xl" />
          )}
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-gray-900">{ad.name}</h3>
            <StatusBadge ad={ad} />
          </div>
          {ad.short_description && <p className="text-sm text-gray-600">{ad.short_description}</p>}

          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="Type" value={AD_TYPE_LABELS[ad.ad_type]} />
            <InfoItem label="CTA Text" value={ad.cta_text || '—'} />
            <InfoItem label="Start Date" value={formatDate(ad.start_date)} />
            <InfoItem label="End Date" value={formatDate(ad.end_date)} />
            <InfoItem label="Views" value={formatNumber(ad.views)} />
            <InfoItem label="Clicks" value={formatNumber(ad.clicks)} />
            <InfoItem label="CTR" value={`${ctr}%`} />
            {ad.redirect_url && <InfoItem label="Redirect URL" value={ad.redirect_url} />}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors cursor-pointer"
            >
              Edit Advertisement
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900 break-all">{value}</p>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────
function DeleteConfirmModal({
  ad,
  onClose,
  onDeleted,
}: {
  ad: Advertisement
  onClose: () => void
  onDeleted: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteAdvertisement(ad)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Delete Advertisement</h3>
          <p className="mt-2 text-sm text-gray-600">
            Are you sure you want to delete <strong>"{ad.name}"</strong>? This action cannot be undone.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl bg-gray-100 px-4 py-3 animate-pulse">
          <div className="h-12 w-16 rounded-lg bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-200" />
          </div>
          <div className="h-6 w-16 rounded-full bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-lg bg-gray-200" />
            <div className="h-8 w-8 rounded-lg bg-gray-200" />
            <div className="h-8 w-8 rounded-lg bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function AdvertisementsAdmin() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Admin guard
  useEffect(() => {
    if (!user) {
      navigate(ROUTES.LOGIN)
      return
    }
    if (user.email !== ADMIN_EMAIL) {
      navigate(ROUTES.HOME)
    }
  }, [user, navigate])

  // Filters state
  const [filters, setFilters] = useState<Partial<AdFilters>>({
    search: '',
    status: 'all',
    startDateFrom: '',
    startDateTo: '',
  })

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }))
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Data
  const { ads, stats, isLoading, refetch } = useAdminAds(filters)

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editAd, setEditAd] = useState<Advertisement | null>(null)
  const [viewAd, setViewAd] = useState<Advertisement | null>(null)
  const [deleteAd, setDeleteAd] = useState<Advertisement | null>(null)

  const handleAdd = useCallback(() => {
    setEditAd(null)
    setShowFormModal(true)
  }, [])

  const handleEdit = useCallback((ad: Advertisement) => {
    setViewAd(null)
    setEditAd(ad)
    setShowFormModal(true)
  }, [])

  const handleView = useCallback((ad: Advertisement) => {
    setViewAd(ad)
  }, [])

  const handleDelete = useCallback((ad: Advertisement) => {
    setDeleteAd(ad)
  }, [])

  if (!user || user.email !== ADMIN_EMAIL) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-50/20 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Advertisement Management</h1>
            <p className="mt-1 text-sm text-gray-500">Create and manage your promotional banners and campaigns</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Advertisement
          </motion.button>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Total Ads"
            value={stats.total}
            gradient="bg-gradient-to-br from-slate-700 to-slate-900"
            icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          />
          <StatCard
            label="Active Ads"
            value={stats.active}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Total Views"
            value={formatNumber(stats.total_views)}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          />
          <StatCard
            label="Total Clicks"
            value={formatNumber(stats.total_clicks)}
            gradient="bg-gradient-to-br from-energy-500 to-energy-700"
            icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>}
          />
          <StatCard
            label="CTR"
            value={`${stats.ctr.toFixed(2)}%`}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
            sub="Clicks ÷ Views × 100"
            icon={<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search advertisements..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filters.status ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as AdFilters['status'] }))}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-brand-500 cursor-pointer min-w-[140px]"
            >
              {FILTER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDateFrom ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, startDateFrom: e.target.value }))}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={filters.startDateTo ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, startDateTo: e.target.value }))}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </div>

            {/* Reset */}
            {(filters.search || filters.status !== 'all' || filters.startDateFrom || filters.startDateTo) && (
              <button
                onClick={() => { setSearchInput(''); setFilters({ search: '', status: 'all', startDateFrom: '', startDateTo: '' }) }}
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : ads.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">No advertisements found</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-sm">
                {filters.search || filters.status !== 'all' ? 'Try adjusting your filters.' : 'Get started by creating your first advertisement.'}
              </p>
              {!filters.search && filters.status === 'all' && (
                <button
                  onClick={handleAdd}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Advertisement
                </button>
              )}
            </div>
          ) : (
            /* Table */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Image', 'Name', 'Type', 'Status', 'Start Date', 'End Date', 'Views', 'Clicks', 'CTR', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence>
                    {ads.map((ad) => {
                      const ctr = ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(2) : '0.00'
                      return (
                        <motion.tr
                          key={ad.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group hover:bg-brand-50/30 transition-colors"
                        >
                          {/* Image */}
                          <td className="px-4 py-3">
                            {ad.image_url ? (
                              <img
                                src={ad.image_url}
                                alt={ad.name}
                                className="h-12 w-16 rounded-lg object-cover ring-1 ring-gray-200"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-12 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                </svg>
                              </div>
                            )}
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900 line-clamp-1 max-w-[180px]">{ad.name}</p>
                            {ad.short_description && (
                              <p className="text-xs text-gray-400 line-clamp-1 max-w-[180px]">{ad.short_description}</p>
                            )}
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {AD_TYPE_LABELS[ad.ad_type]}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge ad={ad} />
                          </td>

                          {/* Start Date */}
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(ad.start_date)}</td>

                          {/* End Date */}
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(ad.end_date)}</td>

                          {/* Views */}
                          <td className="px-4 py-3 font-mono text-sm text-gray-700">{formatNumber(ad.views)}</td>

                          {/* Clicks */}
                          <td className="px-4 py-3 font-mono text-sm text-gray-700">{formatNumber(ad.clicks)}</td>

                          {/* CTR */}
                          <td className="px-4 py-3">
                            <span className={`font-semibold text-sm ${parseFloat(ctr) >= 5 ? 'text-emerald-600' : parseFloat(ctr) >= 2 ? 'text-energy-600' : 'text-gray-600'}`}>
                              {ctr}%
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* View */}
                              <button
                                onClick={() => handleView(ad)}
                                title="View"
                                className="rounded-lg p-2 text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              {/* Edit */}
                              <button
                                onClick={() => handleEdit(ad)}
                                title="Edit"
                                className="rounded-lg p-2 text-gray-400 hover:bg-energy-50 hover:text-energy-600 transition-colors cursor-pointer"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(ad)}
                                title="Delete"
                                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          {!isLoading && ads.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-3">
              <p className="text-xs text-gray-500">
                Showing <strong>{ads.length}</strong> advertisement{ads.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showFormModal && (
          <AdFormModal
            isOpen={showFormModal}
            editAd={editAd}
            onClose={() => setShowFormModal(false)}
            onSaved={refetch}
          />
        )}
        {viewAd && (
          <AdViewModal
            ad={viewAd}
            onClose={() => setViewAd(null)}
            onEdit={() => handleEdit(viewAd)}
          />
        )}
        {deleteAd && (
          <DeleteConfirmModal
            ad={deleteAd}
            onClose={() => setDeleteAd(null)}
            onDeleted={refetch}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
