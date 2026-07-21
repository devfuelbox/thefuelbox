export default function DeliveryPolicy() {
  return (
    <div>
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-white font-heading sm:text-5xl">
            Shipping & Delivery Policy
          </h1>
          <p className="mt-2 text-gray-300">Last updated: July 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8 text-gray-600 leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">1. Delivery Areas</h2>
            <p className="mt-2">
              Fuel Box currently delivers only to the areas and zones listed on our website. Users are advised to check the current serviceable areas before subscribing, as orders can only be delivered within these specified zones. We are actively expanding our delivery network across Coimbatore and Tamil Nadu.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">2. Delivery Address and Timing</h2>
            <p className="mt-2">
              Users must provide an accurate and complete delivery address along with their preferred delivery timing at the time of placing an order. Meals will be delivered to the address entered on the Fuel Box platform at the time of subscription.
            </p>
            <p className="mt-2">
              Delivery time slots are determined by operational capacity and partner kitchen coverage. We strive to deliver within the estimated window, but delays may occur due to traffic, weather, or other factors beyond our control.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">3. Changes to Delivery Address or Recipient</h2>
            <p className="mt-2">
              If a user wishes to change the delivery address, or have the order delivered to a different address or recipient, such changes must be communicated to Fuel Box at least <strong>2-4 hours</strong> before the scheduled delivery time. Requests made after this window may not be accommodated, and the meal will be delivered to the address originally provided.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">4. Delivery Charges</h2>
            <p className="mt-2">
              All delivery charges are included within the price of the meal box. No separate or additional delivery fee will be charged to the user.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">5. Damaged, Opened, or Tampered Deliveries</h2>
            <p className="mt-2">
              If a user receives a meal box that appears damaged, opened, or tampered with at the time of delivery, the user must:
            </p>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>Report the issue immediately to Fuel Box, and</li>
              <li>Refuse to accept the meal box, providing clear photo proof of the damage or tampering as evidence.</li>
            </ol>
            <p className="mt-2">
              If the user accepts the meal box at the time of delivery without reporting the issue or providing photo proof, Fuel Box will not be held responsible for the condition of that meal box, and the user will be responsible for it thereafter.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">6. Delivery Delays</h2>
            <p className="mt-2">
              Fuel Box will make every reasonable effort to deliver meals on time. However, delays caused by weather conditions, traffic, public holidays, technical issues, or other unforeseen circumstances may occasionally occur. We appreciate your understanding and patience in such situations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">7. Customer Responsibility</h2>
            <p className="mt-2">
              Customers are responsible for providing accurate delivery details, including address and contact information. Customers should also ensure that someone is available to receive the order during the selected delivery time. Fuel Box is not responsible for failed deliveries due to incorrect information or unavailability at the delivery location.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">8. Contact Us</h2>
            <p className="mt-2">
              For questions about delivery or to report an issue:
            </p>
            <p className="mt-2">
              Email: help@fuelbox.in
              <br />
              Phone: +91 98765 43210
              <br />
              Response time: Within 24 hours on weekdays
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
