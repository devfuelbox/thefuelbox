import { Button, Card, Input } from '@/components/ui'

export default function OrderStatus() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-gray-900 font-heading">Track Your Order</h1>
      <Card className="mt-6 space-y-4">
        <Input label="Order ID" placeholder="Enter your order ID" />
        <Button className="w-full">Track Order</Button>
      </Card>
    </section>
  )
}
