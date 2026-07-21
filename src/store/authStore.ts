import { create } from 'zustand'
import type { User } from '@/types/user'

interface AuthStore {
  user: User | null
  session: unknown | null
  isLoading: boolean
  hasPurchased: boolean
  setUser: (user: User | null) => void
  setSession: (session: unknown | null) => void
  setLoading: (isLoading: boolean) => void
  setHasPurchased: (val: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  hasPurchased: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasPurchased: (val) => set({ hasPurchased: val }),
  logout: () => set({ user: null, session: null }),
}))
