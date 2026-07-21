/**
 * Advertisement Management System — TypeScript Types
 * ====================================================
 * Core type definitions used across admin dashboard,
 * public banner components, and the API layer.
 */

// ── Advertisement Types ────────────────────────────────────

/** The placement / category of an advertisement */
export type AdType = 'home_banner' | 'menu_banner' | 'sidebar' | 'popup'

/** The lifecycle status set by the admin */
export type AdStatus = 'active' | 'inactive'

/**
 * The computed display status that accounts for date range
 * in addition to the admin-set status field.
 */
export type AdDisplayStatus = 'active' | 'inactive' | 'scheduled' | 'expired'

// ── Core Entity ────────────────────────────────────────────

/** Full advertisement record as stored in Supabase */
export interface Advertisement {
  id: string
  name: string
  image_url: string | null
  short_description: string | null
  ad_type: AdType
  cta_text: string | null
  redirect_url: string | null
  /** ISO date string "YYYY-MM-DD" */
  start_date: string
  /** ISO date string "YYYY-MM-DD" */
  end_date: string
  status: AdStatus
  views: number
  clicks: number
  created_at: string
  updated_at: string
}

// ── Form Data ──────────────────────────────────────────────

/** Data shape used in the admin add/edit form */
export interface AdvertisementFormData {
  name: string
  /** New image file selected for upload (null if unchanged) */
  image: File | null
  /** Existing image URL from Supabase Storage */
  image_url: string | null
  short_description: string
  ad_type: AdType
  cta_text: string
  redirect_url: string
  start_date: string
  end_date: string
  status: AdStatus
}

// ── Validation Errors ──────────────────────────────────────

export type AdFormErrors = Partial<Record<keyof AdvertisementFormData, string>>

// ── Analytics / Stats ─────────────────────────────────────

/** Aggregated statistics shown in the admin dashboard header */
export interface AdStats {
  total: number
  active: number
  total_views: number
  total_clicks: number
  /** CTR = (clicks / views) × 100, shown as a percentage */
  ctr: number
}

// ── Filters ────────────────────────────────────────────────

/** Filters available in the admin advertisements table */
export interface AdFilters {
  search: string
  status: 'all' | AdStatus | 'scheduled' | 'expired'
  startDateFrom: string
  startDateTo: string
}

// ── Constants ──────────────────────────────────────────────

export const AD_TYPE_LABELS: Record<AdType, string> = {
  home_banner: 'Home Banner',
  menu_banner: 'Menu Banner',
  sidebar: 'Sidebar',
  popup: 'Popup',
} as const

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
} as const

export const AD_DISPLAY_STATUS_LABELS: Record<AdDisplayStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  scheduled: 'Scheduled',
  expired: 'Expired',
} as const
