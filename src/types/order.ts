import type { MenuItem } from './meal'

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: string
  menuItem: MenuItem
  quantity: number
  price: number
}

export interface Order {
  id: string
  user_id: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  delivery_address: string
  payment_method: string
  created_at: string
  updated_at: string
}

export interface CheckoutFormData {
  delivery_address: string
  city: string
  pincode: string
  phone: string
  payment_method: 'cod' | 'razorpay' | 'upi'
  notes: string
}
