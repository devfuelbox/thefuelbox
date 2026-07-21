import { useCartStore } from '@/store/cartStore'
import type { MenuItem } from '@/types/meal'

export function useCart() {
  const store = useCartStore()

  return {
    items: store.items,
    addItem: (menuItem: MenuItem, quantity?: number) => store.addItem(menuItem, quantity),
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    clearCart: store.clearCart,
    totalItems: store.totalItems(),
    totalPrice: store.totalPrice(),
  }
}
