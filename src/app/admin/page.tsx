'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Utensils, MapPin,
  ArrowUpRight, ArrowDownRight, Activity, Clock, AlertCircle,
  Flame, Dumbbell, Wheat, Apple, Zap, Star, X, Search, Check,
  ClipboardList, ChefHat
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, Area, AreaChart
} from 'recharts';

interface StatsData {
  summary: {
    totalUsers: number;
    totalOrders: number;
    totalMenuItems: number;
    totalCustomers: number;
    totalRevenue: number;
    aov: number;
    waitlistCount: number;
    avgDistance: number;
  };
  goals: Record<string, number>;
  frequencies: Record<string, number>;
  preferences: Record<string, number>;
  slots: Record<string, number>;
  salesHistory: Array<{ date: string; sales: number; orders: number }>;
  recentOrders: Array<{
    id: string; phone: string; cost: number; status: string; type: string; createdAt: string;
  }>;
  popularItems: Array<{ name: string; count: number; revenue: number }>;
  revenueByType: Record<string, number>;
  orderCountByType: Record<string, number>;
}

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const GOAL_COLORS: Record<string, string> = {
  loss: '#F59E0B', gain: '#3B82F6', muscle: '#EF4444', maintenance: '#10B981', other: '#8B5CF6'
};
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

interface CustomerType {
  id: string;
  name: string;
  phone: string;
  goal: string;
  food: string;
  status: string;
  createdAt?: string;
  created_at?: string;
}

interface MenuItemType {
  id: number;
  name: string;
  price: number;
  diet: string;
  category: string;
  is_available: boolean;
  calories: number;
}

const POPULAR_ITEMS_KEY = 'fuelbox_popular_items';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('fuelbox_user_role') || '';
    if (role === 'sales') router.replace('/admin/roles/sales');
    else if (role === 'verifier') router.replace('/admin/roles/verifier');
    else if (role === 'chef') router.replace('/admin/roles/chef');
    else if (role === 'delivery_partner') router.replace('/admin/roles/delivery');
    else setRedirecting(false);
  }, [router]);
  const [recentOrders, setRecentOrders] = useState<CustomerType[]>([]);
  const [popularModalOpen, setPopularModalOpen] = useState(false);
  const [allMenuItems, setAllMenuItems] = useState<MenuItemType[]>([]);
  const [selectedPopularIds, setSelectedPopularIds] = useState<Set<number>>(new Set());
  const [popularSearch, setPopularSearch] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(POPULAR_ITEMS_KEY);
    if (saved) {
      try {
        const ids = JSON.parse(saved) as number[];
        setSelectedPopularIds(new Set(ids));
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetch('/api/menu')
      .then(r => r.json())
      .then(items => setAllMenuItems(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(POPULAR_ITEMS_KEY, JSON.stringify(Array.from(selectedPopularIds)));
  }, [selectedPopularIds]);

  const togglePopularItem = (id: number) => {
    setSelectedPopularIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPopular = () => {
    const available = allMenuItems.filter(i => i.is_available);
    setSelectedPopularIds(new Set(available.map(i => i.id)));
  };

  const clearAllPopular = () => {
    setSelectedPopularIds(new Set());
  };

  useEffect(() => {
  const fetchRecentOrders = async () => {
    try {
      const response = await fetch("/api/customers");

      if (!response.ok) {
        throw new Error("Failed to fetch customers");
      }

      const data = await response.json();

      const latestOrders = [...data]
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || b.created_at
            ).getTime() -
            new Date(
              a.createdAt || a.created_at
            ).getTime()
        )
        .slice(0, 5);

      setRecentOrders(latestOrders);
    } catch (error) {
      console.error(
        "Failed to fetch recent orders:",
        error
      );
    }
  };

  fetchRecentOrders();
}, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('fuelbox_token');
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token || ''}` },
        });
        if (!res.ok) {
          if (res.status === 401) throw new Error('Unauthorized. Please log in again.');
          throw new Error('Failed to fetch dashboard statistics.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (redirecting || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
        </div>
        <p className="text-gray-500 text-sm font-semibold animate-pulse">Loading dashboard analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900">Failed to Load Dashboard</h3>
        <p className="text-gray-600 text-sm">{error || 'Data unavailable.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm shadow hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, goals, frequencies, preferences, slots, salesHistory, popularItems, revenueByType, orderCountByType } = data;

  const trend = salesHistory.length >= 2
    ? ((salesHistory[salesHistory.length - 1].sales - salesHistory[0].sales) / (salesHistory[0].sales || 1)) * 100
    : 0;
  const orderTrend = salesHistory.length >= 2
    ? ((salesHistory[salesHistory.length - 1].orders - salesHistory[0].orders) / (salesHistory[0].orders || 1)) * 100
    : 0;

  const totalGoals = Object.values(goals).reduce((a, b) => a + b, 0) || 1;
  const goalLabels: Record<string, string> = {
    loss: 'Weight Loss', gain: 'Weight Gain', muscle: 'Muscle Gain', maintenance: 'Maintenance', other: 'Other'
  };

  const statCards = [
    {
      label: 'Total Revenue', value: `₹${(summary.totalRevenue).toLocaleString()}`,
      icon: DollarSign, change: trend, desc: 'Payments collected',
      color: 'emerald', gradient: 'from-emerald-500 to-emerald-600'
    },
    {
      label: 'Active Customers', value: summary.totalCustomers,
      icon: Users, change: null, desc: 'Completed profiles',
      color: 'purple', gradient: 'from-purple-500 to-purple-600'
    },
    {
      label: 'Total Orders', value: summary.totalOrders,
      icon: ShoppingBag, change: orderTrend, desc: 'All time orders',
      color: 'blue', gradient: 'from-blue-500 to-blue-600'
    },
    {
      label: 'Avg Order Value', value: `₹${summary.aov.toLocaleString()}`,
      icon: TrendingUp, change: null, desc: 'Revenue per order',
      color: 'amber', gradient: 'from-amber-500 to-amber-600'
    },
    {
      label: 'Menu Items', value: summary.totalMenuItems,
      icon: Utensils, change: null, desc: 'Available food items',
      color: 'rose', gradient: 'from-rose-500 to-rose-600'
    },
    {
      label: 'Avg Distance', value: `${summary.avgDistance} km`,
      icon: MapPin, change: null, desc: 'Delivery radius',
      color: 'cyan', gradient: 'from-cyan-500 to-cyan-600'
    },
  ];

  const revenueChartData = salesHistory.map(s => ({
    ...s,
    date: new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
  }));

  const goalsChartData = Object.entries(goals).map(([key, value]) => ({
    name: goalLabels[key] || key,
    value,
    color: GOAL_COLORS[key] || '#6B7280'
  }));

  const popularChartData = popularItems.slice(0, 8).map(item => ({
    name: item.name.length > 20 ? item.name.slice(0, 20) + '...' : item.name,
    orders: item.count,
    revenue: Math.round(item.revenue)
  }));

  const revenueByTypeData = Object.entries(revenueByType).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: Math.round(value),
    count: orderCountByType[key] || 0
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Business Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time analytics, revenue tracking, and business performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-500">Live</span>
          <span className="text-xs text-gray-300">|</span>
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-lg bg-${card.color}-50`}>
                  <Icon className={`w-4 h-4 text-${card.color}-600`} />
                </div>
              </div>
              <div className="text-xl font-black text-gray-900">{card.value}</div>
              <div className="flex items-center gap-1.5 mt-1">
                {card.change !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${card.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {card.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(card.change).toFixed(1)}%
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-medium">{card.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-400">Daily revenue over the last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-gray-500">Orders</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 700, color: '#111827' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="Revenue" />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#60A5FA" strokeWidth={2} dot={{ fill: '#60A5FA', strokeWidth: 2, r: 3 }} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meal Plan Goals */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900">Meal Plan Goals</h2>
            <p className="text-xs text-gray-400">Customer goal distribution</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalsChartData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value} customers`, 'Count']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {goalsChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Popular Items & Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Food Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Popular Food Items</h2>
                <p className="text-xs text-gray-400">
                  {selectedPopularIds.size > 0
                    ? `${selectedPopularIds.size} items selected manually`
                    : 'Most ordered items by count'}
                </p>
              </div>
              <button
                onClick={() => setPopularModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition"
              >
                <Star className="w-3.5 h-3.5" />
                Manage
              </button>
            </div>
          </div>
          {(selectedPopularIds.size > 0
            ? allMenuItems
                .filter(i => selectedPopularIds.has(i.id))
                .map(i => ({ name: i.name, orders: 0, revenue: 0 }))
            : popularChartData
          ).length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedPopularIds.size > 0
                    ? allMenuItems
                        .filter(i => selectedPopularIds.has(i.id))
                        .map((i, idx) => ({
                          name: i.name.length > 20 ? i.name.slice(0, 20) + '...' : i.name,
                          orders: popularItems.find(p => p.name === i.name)?.count || 0,
                          revenue: popularItems.find(p => p.name === i.name)?.revenue || 0
                        }))
                        .sort((a, b) => b.orders - a.orders)
                    : popularChartData
                  }
                  layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => [`${value} orders`, 'Ordered']}
                  />
                  <Bar dataKey="orders" radius={[0, 6, 6, 0]} barSize={18}>
                    {(selectedPopularIds.size > 0
                      ? allMenuItems.filter(i => selectedPopularIds.has(i.id))
                      : popularChartData
                    ).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium">
              No food items selected. Click "Manage" to choose popular items.
            </div>
          )}
        </div>

        {/* Revenue by Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900">Revenue by Type</h2>
            <p className="text-xs text-gray-400">Breakdown across order categories</p>
          </div>
          {revenueByTypeData.length > 0 ? (
            <div className="flex items-center gap-6 h-64">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByTypeData}
                      cx="50%" cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {revenueByTypeData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3">
                {revenueByTypeData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-semibold text-gray-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-gray-900">₹{item.value.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400">{item.count} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium">
              No revenue data available yet
            </div>
          )}
        </div>
      </div>

      {/* Operational Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Delivery Slots */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Slots</h3>
          <div className="space-y-2.5">
            {Object.entries(slots).map(([slot, count]) => {
              const maxCount = Math.max(...Object.values(slots), 1);
              const pct = (count / maxCount) * 100;
              return (
                <div key={slot}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">{slot}</span>
                    <span className="font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Meal Frequencies */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Meal Frequency</h3>
          <div className="space-y-2.5">
            {Object.entries(frequencies).map(([freq, count]) => {
              const maxCount = Math.max(...Object.values(frequencies), 1);
              const pct = (count / maxCount) * 100;
              return (
                <div key={freq}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">{freq} meal{freq !== '1' ? 's' : ''}/day</span>
                    <span className="font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logistics & Dietary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Logistics & Dietary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Avg Distance</div>
              <div className="flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-black text-gray-900 text-sm">{summary.avgDistance} km</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Waitlist</div>
              <div className="flex items-center justify-center gap-1">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-black text-gray-900 text-sm">{summary.waitlistCount}</span>
              </div>
            </div>
            <div className="col-span-2 bg-gray-50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">Dietary Preference</div>
              <div className="flex justify-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Veg: {preferences.veg}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span>Egg: {preferences.egg}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Non-Veg: {preferences.nonveg}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Enquires</h2>
            <p className="text-xs text-gray-400">Latest customer checkouts</p>
          </div>
          <Link href="/admin/orders" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">NAME</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Food</th>
                <th className="px-5 py-3 text-center"></th>
                 <th className="px-5 py-3">Date</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.slice(0, 2).map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3.5 font-bold text-gray-900 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                  <td className="px-5 py-3.5 text-gray-500 font-semibold">+91 {o.name}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                   {o.phone}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md uppercase">{o.goal || '-'}</span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-gray-900">₹{o.food || 0}</td>
                  <td className="px-5 py-3.5 text-center">
                  </td>
<td className="px-5 py-3.5 font-black text-gray-900">
                   {new Date(o.createdAt || o.created_at || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                   </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400 font-medium text-sm">No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/menu" className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Utensils className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm group-hover:text-emerald-600 transition">Menu & Prices</h3>
                <p className="text-[11px] text-gray-500">Manage items & stock</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
          </Link>

          <Link href="/admin/orders" className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition">View Orders</h3>
                <p className="text-[11px] text-gray-500">Monitor checkouts</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </Link>

          <Link href="/admin/users" className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm group-hover:text-purple-600 transition">Users</h3>
                <p className="text-[11px] text-gray-500">Manage accounts</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
          </Link>

          <Link href="/admin/roles/sales" className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition">Sales Dashboard</h3>
                <p className="text-[11px] text-gray-500">Customers, follow-ups & verification</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </Link>

          <Link href="/admin/roles/chef" className="p-4 rounded-xl border border-orange-200 bg-orange-50/50 hover:bg-orange-50 hover:border-orange-300 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <ChefHat className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm group-hover:text-orange-600 transition">Chef Dashboard</h3>
                <p className="text-[11px] text-gray-500">Orders, cooking & delivery readiness</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600" />
          </Link>
        </div>
      </div>

      {/* Popular Items Selection Modal */}
      {popularModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPopularModalOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Choose Popular Items</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select items to feature on dashboard</p>
              </div>
              <button onClick={() => setPopularModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={popularSearch}
                  onChange={e => setPopularSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs font-semibold text-gray-500">
                  {selectedPopularIds.size} of {allMenuItems.length} selected
                </p>
                <div className="flex gap-2">
                  <button onClick={selectAllPopular} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-50 transition">
                    Select All
                  </button>
                  <button onClick={clearAllPopular} className="text-xs font-bold text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition">
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {allMenuItems
                .filter(i => i.name.toLowerCase().includes(popularSearch.toLowerCase()))
                .map(item => {
                  const isSelected = selectedPopularIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => togglePopularItem(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                        isSelected
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.diet === 'non_veg' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {item.diet === 'non_veg' ? 'Non-Veg' : 'Veg'}
                          </span>
                          <span>₹{item.price}</span>
                          <span>{item.calories} kcal</span>
                        </div>
                      </div>
                      {popularItems.find(p => p.name === item.name) && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md shrink-0">
                          {popularItems.find(p => p.name === item.name)!.count} orders
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{selectedPopularIds.size} items will show on dashboard</p>
              <div className="flex gap-2">
                <button onClick={() => setPopularModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition">
                  Cancel
                </button>
                <button
                  onClick={() => setPopularModalOpen(false)}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
