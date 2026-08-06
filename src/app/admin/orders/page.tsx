"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Eye,
  Phone,
  Target,
  CalendarDays,
  Flame,
  Dumbbell,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { foodLabel } from "@/lib/foodDisplay";

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
  createdAt?: string;
  created_at?: string;
}

const ITEMS_PER_PAGE = 10;

export default function AdminOrdersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected customer for details modal
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  // Filters
  const [customerName, setCustomerName] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // --------------------------------------------------
  // FETCH CUSTOMERS
  // --------------------------------------------------

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch customers");
        }

        return res.json();
      })
      .then((data) => {
        setCustomers(data);
      })
      .catch((err) => {
        console.error("Failed to load customers:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // --------------------------------------------------
  // GET CUSTOMER DATE
  // Supports both createdAt and created_at
  // --------------------------------------------------

  const getCustomerDate = (customer: Customer) => {
    return customer.createdAt || customer.created_at || "";
  };

  // --------------------------------------------------
  // GET MEAL PLAN NAMES
  // --------------------------------------------------

  const getMealPlanNames = (customer: Customer) => {
    return (
      customer.meal_plan?.meals
        ?.map((meal) => meal.name)
        .join(", ") || ""
    );
  };

  // --------------------------------------------------
  // FILTER CUSTOMERS
  // --------------------------------------------------

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // Customer name filter
      const matchesCustomerName =
        customer.name
          ?.toLowerCase()
          .includes(customerName.toLowerCase());

      // Meal plan filter
      const mealPlanNames = getMealPlanNames(customer);

      const matchesPlan =
        !planFilter ||
        mealPlanNames
          .toLowerCase()
          .includes(planFilter.toLowerCase());

      // Date filter
      const customerDate = getCustomerDate(customer);

      let matchesDate = true;

      if (dateFilter && customerDate) {
        const customerDateOnly = new Date(customerDate)
          .toISOString()
          .split("T")[0];

        matchesDate =
          customerDateOnly === dateFilter;
      }

      return (
        matchesCustomerName &&
        matchesPlan &&
        matchesDate
      );
    });
  }, [
    customers,
    customerName,
    planFilter,
    dateFilter,
  ]);

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const totalPages = Math.ceil(
    filteredCustomers.length / ITEMS_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const endIndex =
    startIndex + ITEMS_PER_PAGE;

  const paginatedCustomers =
    filteredCustomers.slice(
      startIndex,
      endIndex
    );

  // --------------------------------------------------
  // RESET PAGE WHEN FILTER CHANGES
  // --------------------------------------------------

  useEffect(() => {
    setCurrentPage(1);
  }, [
    customerName,
    planFilter,
    dateFilter,
  ]);

  // --------------------------------------------------
  // CLEAR FILTERS
  // --------------------------------------------------

  const clearFilters = () => {
    setCustomerName("");
    setPlanFilter("");
    setDateFilter("");
    setCurrentPage(1);
  };

  // --------------------------------------------------
  // OPEN MODAL
  // --------------------------------------------------

  const handleViewDetails = (
    customer: Customer
  ) => {
    setSelectedCustomer(customer);
  };

  // --------------------------------------------------
  // CLOSE MODAL
  // --------------------------------------------------

  const handleCloseModal = () => {
    setSelectedCustomer(null);
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading customer Enquires...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ============================================== */}
      {/* PAGE HEADER */}
      {/* ============================================== */}

      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          Customer Enquires
        </h1>

        <p className="text-gray-500 text-sm mt-1">
          Customers who ordered meal plans from FuelBox.
        </p>
      </div>

      {/* ============================================== */}
      {/* FILTER SECTION */}
      {/* ============================================== */}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-brand-600" />

          <h2 className="font-bold text-gray-900">
            Filter Enquires
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* CUSTOMER NAME */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Name
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />

              <input
                type="text"
                value={customerName}
                onChange={(e) =>
                  setCustomerName(
                    e.target.value
                  )
                }
                placeholder="Search customer name..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* MEAL PLAN */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meal Plan
            </label>

            <select
              value={planFilter}
              onChange={(e) =>
                setPlanFilter(
                  e.target.value
                )
              }
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">
                All Meal Plans
              </option>

              {Array.from(
                new Set(
                  customers.flatMap(
                    (customer) =>
                      customer.meal_plan?.meals?.map(
                        (meal) =>
                          meal.name
                      ) || []
                  )
                )
              ).map((plan) => (
                <option
                  key={plan}
                  value={plan}
                >
                  {plan}
                </option>
              ))}
            </select>
          </div>

          {/* ORDER DATE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Order Date
            </label>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value
                )
              }
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

        </div>

        {/* FILTER FOOTER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100">

          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-bold text-gray-900">
              {filteredCustomers.length}
            </span>{" "}
            customer
            {filteredCustomers.length !== 1
              ? "s"
              : ""}
          </p>

          <button
            onClick={clearFilters}
            disabled={
              !customerName &&
              !planFilter &&
              !dateFilter
            }
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Clear Filters
          </button>

        </div>
      </div>

      {/* ============================================== */}
      {/* ORDERS TABLE */}
      {/* ============================================== */}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">

                <th className="px-6 py-4 text-left">
                  Customer
                </th>

                <th className="px-6 py-4 text-left">
                  Goal
                </th>

                <th className="px-6 py-4 text-left">
                  Meal Plan
                </th>

                <th className="px-6 py-4 text-left">
                  Ordered On
                </th>

                <th className="px-6 py-4 text-right">
                  Action
                </th>

              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">

              {paginatedCustomers.length === 0 ? (

                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-gray-400"
                  >
                    No customer orders found.
                  </td>
                </tr>

              ) : (

                paginatedCustomers.map(
                  (customer) => (

                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 transition"
                    >

                      {/* CUSTOMER */}
                      <td className="px-6 py-5">

                        <div className="font-semibold text-gray-900">
                          {customer.name}
                        </div>

                        <div className="text-sm text-gray-500">
                          {customer.phone}
                        </div>

                      </td>

                      {/* GOAL */}
                      <td className="px-6 py-5">

                        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 capitalize">
                          {customer.goal || "-"}
                        </span>

                      </td>

                      {/* MEAL PLAN */}
                      <td className="px-6 py-5">

                        {customer.meal_plan?.meals?.length ? (

                          <div className="space-y-1">

                            <div className="font-semibold text-gray-900">
                              {customer.meal_plan.meals.length}{" "}
                              {customer.meal_plan.meals.length ===
                              1
                                ? "Meal"
                                : "Meals"}
                            </div>

                            <div className="text-xs text-gray-500 max-w-xs">
                              {getMealPlanNames(
                                customer
                              )}
                            </div>

                          </div>

                        ) : (

                          <span className="text-gray-400">
                            No meal plan
                          </span>

                        )}

                      </td>

                      {/* ORDER DATE */}
                      <td className="px-6 py-5 text-sm text-gray-500">

                        {getCustomerDate(
                          customer
                        )
                          ? new Date(
                              getCustomerDate(
                                customer
                              )
                            ).toLocaleString(
                              "en-IN"
                            )
                          : "-"}

                      </td>

                      {/* ACTION */}
                      <td className="px-6 py-5 text-right">

                        <button
                          onClick={() =>
                            handleViewDetails(
                              customer
                            )
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition"
                        >
                          <Eye className="w-4 h-4" />

                          View Details
                        </button>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

        {/* ============================================== */}
        {/* PAGINATION */}
        {/* ============================================== */}

        {filteredCustomers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100">

            {/* SHOWING COUNT */}
            <p className="text-sm text-gray-500">

              Showing{" "}

              <span className="font-semibold text-gray-900">
                {startIndex + 1}
              </span>

              {" "}to{" "}

              <span className="font-semibold text-gray-900">
                {Math.min(
                  endIndex,
                  filteredCustomers.length
                )}
              </span>

              {" "}of{" "}

              <span className="font-semibold text-gray-900">
                {filteredCustomers.length}
              </span>

            </p>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (

              <div className="flex items-center gap-2">

                {/* PREVIOUS */}
                <button
                  onClick={() =>
                    setCurrentPage(
                      (prev) =>
                        Math.max(
                          prev - 1,
                          1
                        )
                    )
                  }
                  disabled={
                    currentPage === 1
                  }
                  className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />

                  Previous
                </button>

                {/* PAGE NUMBERS */}
                <div className="flex items-center gap-1">

                  {Array.from(
                    {
                      length: totalPages,
                    },
                    (_, index) =>
                      index + 1
                  ).map((page) => (

                    <button
                      key={page}
                      onClick={() =>
                        setCurrentPage(
                          page
                        )
                      }
                      className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${
                        currentPage ===
                        page
                          ? "bg-brand-600 text-white"
                          : "text-gray-600 border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>

                  ))}

                </div>

                {/* NEXT */}
                <button
                  onClick={() =>
                    setCurrentPage(
                      (prev) =>
                        Math.min(
                          prev + 1,
                          totalPages
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next

                  <ChevronRight className="w-4 h-4" />
                </button>

              </div>

            )}

          </div>
        )}

      </div>

      {/* ================================================= */}
      {/* CUSTOMER DETAILS MODAL */}
      {/* ================================================= */}

      {selectedCustomer && (

        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >

          {/* MODAL */}
          <div
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Customer Order Details
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Complete meal plan and customer information
                </p>
              </div>

              <button
                onClick={
                  handleCloseModal
                }
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            {/* MODAL CONTENT */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-150px)]">

              {/* CUSTOMER INFORMATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                {/* NAME */}
                <div className="bg-gray-50 rounded-2xl p-4">

                  <div className="text-xs font-semibold text-gray-500 uppercase">
                    Customer
                  </div>

                  <div className="mt-2 font-bold text-gray-900">
                    {selectedCustomer.name}
                  </div>

                </div>

                {/* PHONE */}
                <div className="bg-gray-50 rounded-2xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                    <Phone className="w-4 h-4" />
                    Phone
                  </div>

                  <div className="mt-2 font-bold text-gray-900">
                    {selectedCustomer.phone ||
                      "-"}
                  </div>

                </div>

                {/* GOAL */}
                <div className="bg-gray-50 rounded-2xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                    <Target className="w-4 h-4" />
                    Goal
                  </div>

                  <div className="mt-2">

                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 capitalize">
                      {selectedCustomer.goal ||
                        "-"}
                    </span>

                  </div>

                </div>

                {/* ORDER DATE */}
                <div className="bg-gray-50 rounded-2xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                    <CalendarDays className="w-4 h-4" />
                    Ordered On
                  </div>

                  <div className="mt-2 font-bold text-gray-900 text-sm">
                    {getCustomerDate(
                      selectedCustomer
                    )
                      ? new Date(
                          getCustomerDate(
                            selectedCustomer
                          )
                        ).toLocaleString(
                          "en-IN"
                        )
                      : "-"}
                  </div>

                </div>

              </div>

              {/* NUTRITION */}
              <div className="mb-6">

                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Nutrition Summary
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* CALORIES */}
                  <div className="flex items-center gap-4 bg-orange-50 border border-orange-100 rounded-2xl p-4">

                    <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-600" />
                    </div>

                    <div>

                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Calories
                      </p>

                      <p className="text-xl font-extrabold text-gray-900">
                        {selectedCustomer.meal_plan?.kcal ??
                          "-"}{" "}
                        kcal
                      </p>

                    </div>

                  </div>

                  {/* PROTEIN */}
                  <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">

                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-blue-600" />
                    </div>

                    <div>

                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Protein
                      </p>

                      <p className="text-xl font-extrabold text-gray-900">
                        {selectedCustomer.meal_plan?.protein ??
                          "-"}{" "}
                        g
                      </p>

                    </div>

                  </div>

                </div>

              </div>

              {/* FULL MEAL PLAN */}
              <div>

                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Full Meal Plan
                </h3>

                {selectedCustomer.meal_plan?.meals?.length ? (

                  <div className="space-y-4">

                    {selectedCustomer.meal_plan.meals.map(
                      (meal, index) => (

                        <div
                          key={index}
                          className="border border-gray-200 rounded-2xl overflow-hidden"
                        >

                          {/* MEAL HEADER */}
                          <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">

                            <div className="flex items-center justify-between">

                              <h4 className="font-bold text-gray-900">
                                {meal.name}
                              </h4>

                              <span className="text-xs font-semibold text-gray-500">
                                Meal{" "}
                                {index + 1}
                              </span>

                            </div>

                          </div>

                          {/* MEAL ITEMS */}
                          <div className="p-5">

                            {meal.items?.length ? (

                              <div className="space-y-2">

                                {meal.items.map(
                                  (
                                    item,
                                    itemIndex
                                  ) => (

                                    <div
                                      key={
                                        itemIndex
                                      }
                                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                                    >

                                      <span className="text-sm font-medium text-gray-700">
                                        {foodLabel(item)}
                                      </span>

                                    </div>

                                  )
                                )}

                              </div>

                            ) : (

                              <p className="text-sm text-gray-400">
                                No food items available
                              </p>

                            )}

                          </div>

                        </div>

                      )
                    )}

                  </div>

                ) : (

                  <div className="border border-gray-200 rounded-2xl p-8 text-center">

                    <p className="text-gray-400">
                      No meal plan available for this customer.
                    </p>

                  </div>

                )}

              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">

              <button
                onClick={
                  handleCloseModal
                }
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
