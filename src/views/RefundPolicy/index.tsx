export default function RefundPolicy() {
  return (
    <div>
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-white font-heading sm:text-5xl">
            Refund & Cancellation Policy
          </h1>
          <p className="mt-2 text-gray-300">Last updated: July 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8 text-gray-600 leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">1. Cancellation Within 48 Hours of Purchase</h2>
            <p className="mt-2">
              If a subscription is cancelled within 48 hours of purchase, the following applies:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>The cost of all meal boxes already delivered will be deducted from the total subscription amount.</li>
              <li>An additional charge equivalent to the cost of one extra meal box will also be deducted, as ingredients for the next meal may already be in preparation.</li>
              <li>The remaining balance will be refunded to your original payment method within 5-7 working days.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">2. Cancellation After 48 Hours of Purchase</h2>
            <p className="mt-2">
              If a subscription is cancelled after 48 hours from the time of purchase, the refund amount will be calculated based on meals already delivered and the timing of the cancellation request:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li><strong>Before that day's meal delivery:</strong> The cost of the previous day's meal and the current day's meal will be deducted.</li>
              <li><strong>After that day's meal delivery:</strong> The cost of the next day's meal will also be deducted, in addition to the above.</li>
            </ul>
            <p className="mt-2">
              Following these deductions, a <strong>30% cancellation charge</strong> will be applied to the remaining balance. The final refundable amount will be credited to your original payment method within 5-7 working days.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">3. Cancellation at Time of Delivery</h2>
            <p className="mt-2">
              If a user cancels an order at the time of delivery, the order may be taken back; however, the cost of that meal box will still be deducted, as it has already been prepared and dispatched.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">4. Skip Day Policy</h2>
            <p className="mt-2">
              Users wishing to skip a meal day must notify Fuel Box at least <strong>20 hours</strong> before the scheduled delivery time. Requests made after this window will not be honoured, and the cost for that day's meal will still be charged.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">5. Taste Complaint & Replacement Policy</h2>
            <p className="mt-2">
              If a user is dissatisfied with the taste of a meal:
            </p>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>Fuel Box will first offer a replacement meal or alternative meal option upon receiving the complaint.</li>
              <li>The user must try the replacement meal and confirm whether the issue persists.</li>
              <li>If the user remains dissatisfied after the replacement, Fuel Box may treat this as a valid reason for cancellation or refund, subject to the deduction terms outlined in Sections 1-3.</li>
            </ol>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">6. Damaged or Tampered Deliveries</h2>
            <p className="mt-2">
              If a user receives a meal box that appears damaged, opened, or tampered with at the time of delivery, the user must:
            </p>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>Report the issue immediately to Fuel Box, and</li>
              <li>Refuse to accept the meal box, providing clear photo proof of the damage or tampering as evidence.</li>
            </ol>
            <p className="mt-2">
              If the user accepts the meal box at the time of delivery without reporting the issue or providing photo proof, Fuel Box will not be held responsible for the condition of that meal box.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">7. Refund Processing</h2>
            <p className="mt-2">
              All eligible refunds are processed only after verification of the cancellation request, the reason provided, and the current subscription status. Approved refunds will be credited to the user's original payment method within <strong>5-7 working days</strong>.
            </p>
            <p className="mt-2">
              Refund eligibility depends on the subscription timeline, delivery status, and meal preparation stage at the time of the request. Fuel Box reserves the right to review each refund request individually to ensure fairness, while accounting for meals that are already prepared, dispatched, or scheduled.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">8. Non-Refundable Items</h2>
            <p className="mt-2">
              The following are not eligible for refunds:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Meal cost for orders cancelled at the time of delivery (already prepared and dispatched)</li>
              <li>Skip day requests made less than 20 hours before delivery</li>
              <li>Issues caused by incorrect delivery address provided by the user</li>
              <li>Deterioration in food quality resulting from improper storage or delayed consumption after delivery</li>
              <li>Damaged or tampered deliveries accepted without immediate reporting and photo proof</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">9. How to Request a Refund</h2>
            <p className="mt-2">
              Contact our support team with your order ID and issue details:
            </p>
            <p className="mt-2">
              Email: help@fuelbox.in
              <br />
              Phone: +91 98765 43210
              <br />
              Response time: Within 24 hours on weekdays
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-6 border border-gray-200">
            <p className="text-sm text-gray-500">
              Fuel Box reserves the right to refuse refund requests if we suspect abuse of this policy. We are committed to fair and transparent resolution of all concerns.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
