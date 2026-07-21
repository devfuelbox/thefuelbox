import { create } from 'zustand'
import type { CartItem, MenuItem } from '@/types/meal'
import { addToCart, removeFromCart, clearDbCart } from '@/lib/api'

interface CartStore {
  items: CartItem[]
  setItems: (items: CartItem[]) => void
  addItem: (menuItem: MenuItem, quantity?: number) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (menuItem, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((item) => item.menuItem.id === menuItem.id)
      const newQuantity = existing ? existing.quantity + quantity : quantity
      
      // Sync with DB
      addToCart(menuItem.id, newQuantity).catch(console.error)
      
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.menuItem.id === menuItem.id
              ? { ...item, quantity: newQuantity }
              : item,
          ),
        }
      }
      return { items: [...state.items, { id: crypto.randomUUID(), menuItem, quantity: newQuantity }] }
    })
  },
  removeItem: (menuItemId) => {
    // Sync with DB
    removeFromCart(menuItemId).catch(console.error)
    
    set((state) => ({
      items: state.items.filter((item) => item.menuItem.id !== menuItemId),
    }))
  },
  updateQuantity: (menuItemId, quantity) => {
    // Sync with DB
    addToCart(menuItemId, quantity).catch(console.error)
    
    set((state) => ({
      items: state.items.map((item) =>
        item.menuItem.id === menuItemId ? { ...item, quantity } : item,
      ),
    }))
  },
  clearCart: () => {
    clearDbCart().catch(console.error)
    set({ items: [] })
  },
  totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  totalPrice: () => get().items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0),
}))
