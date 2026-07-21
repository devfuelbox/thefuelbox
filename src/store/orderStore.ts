import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Order } from '@/types/order'

interface OrderStore {
  orders: Order[]
  addOrder: (order: Order) => void
  clearOrders: () => void
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      clearOrders: () => set({ orders: [] }),
    }),
    {
      name: 'fuelbox-orders',
    }
  )
)
