"use client";

import { useEffect, useState } from "react";

interface MealItem {
  id: string;
  g: number;
}

interface Meal {
  name: string;
  items: MealItem[];
}

interface MealPlan {
  kcal?: number;
  protein?: number;
  meals?: Meal[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  goal: string;
  meal_plan: MealPlan;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        //        console.log(data);
        // console.log(data[0]);
        console.log(data[0].created_at);
        console.log(typeof data[0].created_at);
        setCustomers(data);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading customer orders...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          Customer Orders
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Customers who ordered meal plans from FuelBox.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Goal</th>
                <th className="px-6 py-4 text-left">Meal Plan</th>
                <th className="px-6 py-4 text-left">Nutrition</th>
                <th className="px-6 py-4 text-left">Ordered On</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    No customer orders found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 align-top">
                    <td className="px-6 py-5">
                      <div className="font-semibold text-gray-900">
                        {customer.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        {customer.phone}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 capitalize">
                        {customer.goal}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      {customer.meal_plan?.meals?.length ? (
                        <div className="space-y-3">
                          {customer.meal_plan.meals.map((meal, index) => (
                            <div key={index}>
                              <div className="font-semibold text-sm text-gray-900">
                                {meal.name}
                              </div>

                              <ul className="list-disc list-inside text-xs text-gray-600">
                                {meal.items.map((item, idx) => (
                                  <li key={idx}>
                                    {item.id} ({item.g} g)
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">No meal plan</span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm">
                        <div>
                          <strong>Calories:</strong>{" "}
                          {customer.meal_plan?.kcal ?? "-"} kcal
                        </div>

                        <div className="mt-1">
                          <strong>Protein:</strong>{" "}
                          {customer.meal_plan?.protein ?? "-"} g
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-500">
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleString("en-IN")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
