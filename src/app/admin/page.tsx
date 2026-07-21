'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Utensils, ShoppingBag, Users, DollarSign, ArrowUpRight, PlusCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 142,
    totalOrders: 89,
    totalMenuItems: 44,
    activeSubscriptions: 28,
    totalRevenue: 15420,
  });

  const statCards = [
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-emerald-500' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'bg-blue-500' },
    { label: 'Food Menu Items', value: stats.totalMenuItems, icon: Utensils, color: 'bg-emerald-600' },
    { label: 'Active Users', value: stats.totalUsers, icon: Users, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Monitor application metrics, manage menu pricing, and process live orders.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-2xl text-white ${card.color} shadow-md`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Quick Management Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admin/menu"
            className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <PlusCircle className="w-6 h-6 text-emerald-600" />
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition">Manage Menu & Prices</h3>
                <p className="text-xs text-gray-500">Add food items, edit prices & toggle stock</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
          </Link>

          <Link
            href="/admin/orders"
            className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition">Monitor Orders</h3>
                <p className="text-xs text-gray-500">View live customer orders & update status</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
          </Link>

          <Link
            href="/admin/users"
            className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition">User Management</h3>
                <p className="text-xs text-gray-500">View user accounts & activity log</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
          </Link>
        </div>
      </div>
    </div>
  );
}
