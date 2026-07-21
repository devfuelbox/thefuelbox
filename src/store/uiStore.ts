import { create } from 'zustand'

interface UiStore {
  isMobileMenuOpen: boolean
  isCartDrawerOpen: boolean
  isAiBotOpen: boolean
  pendingAiMessage: string
  toggleMobileMenu: () => void
  toggleCartDrawer: () => void
  setAiBotOpen: (open: boolean) => void
  setPendingAiMessage: (msg: string) => void
  closeAll: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  isMobileMenuOpen: false,
  isCartDrawerOpen: false,
  isAiBotOpen: false,
  pendingAiMessage: '',
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  toggleCartDrawer: () => set((state) => ({ isCartDrawerOpen: !state.isCartDrawerOpen })),
  setAiBotOpen: (open) => set({ isAiBotOpen: open }),
  setPendingAiMessage: (msg) => set({ pendingAiMessage: msg }),
  closeAll: () => set({ isMobileMenuOpen: false, isCartDrawerOpen: false }),
}))
