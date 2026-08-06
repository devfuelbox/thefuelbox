'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Phone, User, Search, X, Save, CheckCircle2, Activity, FileText, ThumbsDown, MessageCircle, IndianRupee
} from 'lucide-react';
import { foodLabel } from '@/lib/foodDisplay';
import { normalizeMealPlan, planTotals } from '@/lib/mealPlan';

function getPackages(c: any): Array<{ name: string; days?: number; price: number }> {
  const p = c?.meal_plan_packages;
  if (Array.isArray(p)) return p;
  if (typeof p === 'string') {
    try {
      const parsed = JSON.parse(p);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}



export default function SalesDashboardPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerEnquiries, setCustomerEnquiries] = useState<Record<string, any>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEnquiryId, setEditingEnquiryId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  useEffect(() => {
    fetch('/api/menu', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(setMenuItems)
      .catch(() => setMenuItems([]));
  }, [token]);

  const fetchData = async () => {
    setCustomersLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/sales/enquiries', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (eRes.ok) {
        const enquiries: any[] = await eRes.json();
        const map: Record<string, any> = {};
        enquiries.forEach(e => { map[e.phone] = e; });
        setCustomerEnquiries(map);
      }
    } catch {}
    setCustomersLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const quickAction = async (c: any, sales_status: string) => {
    try {
      const r = await fetch('/api/roles/sales/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          age: c.age || null,
          gender: c.gender || null,
          height: c.height || null,
          weight: c.weight || null,
          food_preference: c.food || null,
          activity_level: c.activity || null,
          goal: c.goal || null,
          meals_per_day: c.freq || null,
          sales_status,
        }),
      });
      if (r.ok) {
        const created = await r.json();
        setCustomerEnquiries(prev => ({ ...prev, [c.phone]: created }));
      }
    } catch {}
  };

  const filtered = customers.filter((c: any) =>
    (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );

  const totals = useMemo(() => {
    const vals = Object.values(customerEnquiries);
    return {
      total: customers.length,
      submitted: vals.filter((e: any) => e.sales_status === 'follow_up').length,
      notInterested: vals.filter((e: any) => e.sales_status === 'not_interested').length,
      closed: vals.filter((e: any) => e.sales_status === 'non_follow_up').length,
      pending: customers.filter(c => !customerEnquiries[c.phone]).length,
    };
  }, [customers, customerEnquiries]);

  const [editForm, setEditForm] = useState({
    customer_name: '', phone: '', email: '', address: '',
    age: 25, gender: 'male', height: 170, weight: 70,
    food_preference: 'veg', activity_level: 'sedentary', goal: 'maintenance', meals_per_day: 3,
    selected_food_items: [] as any[], meal_plan: null as any,
    daily_calories: 0, daily_protein: 0,
    enquiry_date: '', service: 'meal_plan',
    total_amount: 0, paid_amount: 0, payment_method: 'cash', sales_notes: '',
  });

  const planPrice = useMemo(() => {
    const p = planTotals(editForm.meal_plan, menuItems);
    return Math.round(p.price * 100) / 100;
  }, [editForm.meal_plan, menuItems]);

  const openEditModal = (c: any) => {
    const existing = customerEnquiries[c.phone];
    if (existing) {
      setEditingEnquiryId(existing.id);
      setEditForm({
        customer_name: existing.customer_name || c.name || '',
        phone: existing.phone || c.phone || '',
        email: existing.email || c.email || '',
        address: existing.address || c.address || '',
        age: existing.age || c.age || 25,
        gender: existing.gender || c.gender || 'male',
        height: existing.height || c.height || 170,
        weight: existing.weight || c.weight || 70,
        food_preference: existing.food_preference || c.food || 'veg',
        activity_level: existing.activity_level || c.activity || 'sedentary',
        goal: existing.goal || c.goal || 'maintenance',
        meals_per_day: existing.meals_per_day || c.freq || 3,
        selected_food_items: existing.selected_food_items || [],
        meal_plan: existing.meal_plan || c.meal_plan || [],
        daily_calories: existing.daily_calories || 0,
        daily_protein: existing.daily_protein || 0,
        enquiry_date: existing.enquiry_date || new Date().toISOString().split('T')[0],
        service: existing.service || 'meal_plan',
        total_amount: Number(existing.total_amount) || Number(c.meal_plan_price) || 0,
        paid_amount: Number(existing.paid_amount) || 0,
        payment_method: existing.payment_method || 'cash',
        sales_notes: existing.sales_notes || '',
      });
    } else {
      setEditingEnquiryId(null);
      setEditForm({
        customer_name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        age: c.age || 25,
        gender: c.gender || 'male',
        height: c.height || 170,
        weight: c.weight || 70,
        food_preference: c.food || 'veg',
        activity_level: c.activity || 'sedentary',
        goal: c.goal || 'maintenance',
        meals_per_day: c.freq || 3,
        selected_food_items: [],
        meal_plan: c.meal_plan || [],
        daily_calories: 0,
        daily_protein: 0,
        enquiry_date: new Date().toISOString().split('T')[0],
        service: 'meal_plan',
        total_amount: Number(c.meal_plan_price) || 0,
        paid_amount: 0,
        payment_method: 'cash',
        sales_notes: '',
      });
    }
    setSelectedCustomer(c);
    setEditModal(true);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      if (editingEnquiryId) {
        const r = await fetch('/api/roles/sales/enquiries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingEnquiryId, ...editForm, sales_status: 'follow_up' }),
        });
        if (r.ok) {
          const updated = await r.json();
          setCustomerEnquiries(prev => ({ ...prev, [selectedCustomer.phone]: updated }));
          setEditModal(false);
          setSelectedCustomer(null);
          setEditingEnquiryId(null);
        }
      } else {
        const r = await fetch('/api/roles/sales/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editForm),
        });
        if (r.ok) {
          const created = await r.json();
          setCustomerEnquiries(prev => ({ ...prev, [selectedCustomer.phone]: created }));
          setEditModal(false);
          setSelectedCustomer(null);
        }
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Sales Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage customers and submit details for verification.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase">Total Customers</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totals.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-[11px] font-bold text-blue-600 uppercase">Pending Action</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{totals.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Submitted</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totals.submitted}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-[11px] font-bold text-red-500 uppercase">Not Interested</p>
          <p className="text-2xl font-black text-red-500 mt-1">{totals.notInterested}</p>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
              <input type="text" placeholder="Search name or phone..." value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
              {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Meal Plan</th>
                <th className="px-5 py-3">Goal</th>
                <th className="px-5 py-3 text-right">Plan Price</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customersLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No customers found.</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900">{c.name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{c.email || '-'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-600">
                    {c.age ? `${c.age}y / ${c.gender || '-'}` : '-'}
                  </td>
                  <td className="px-5 py-4">
                    {(() => { const p = normalizeMealPlan(customerEnquiries[c.phone]?.meal_plan || c.meal_plan); if (!p || p.meals.length === 0) return <span className="text-xs text-gray-400">-</span>; return (
                      <div className="space-y-0.5">
                        {p.meals.map((m: any, i: number) => (
                          <div key={i} className="text-[11px] text-gray-600 whitespace-nowrap">
                            <span className="font-bold text-gray-800">{m.name}:</span> {m.items?.length || 0} item{(m.items?.length || 0) !== 1 ? 's' : ''}
                          </div>
                        ))}
                        {p.kcal ? <div className="text-[10px] text-gray-400">{p.kcal} kcal</div> : null}
                      </div>
                    ); })()}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold capitalize text-gray-700">{c.goal?.replace(/_/g, ' ') || '-'}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {(() => {
                      const packs = getPackages(c);
                      if (packs.length > 0) {
                        const packPrice = Math.max(0, ...packs.map(p => Number(p.price) || 0));
                        const finalPrice = Number(c.meal_plan_price) || Number(customerEnquiries[c.phone]?.total_amount) || 0;
                        return (
                          <div className="space-y-0.5">
                            {packs.map((p, i) => (
                              <div key={i} className="text-[11px] text-gray-600 whitespace-nowrap">
                                <span className="font-bold text-gray-800">{p.name}:</span> ≈ ₹{Number(p.price).toLocaleString()}
                              </div>
                            ))}
                            {finalPrice > 0 && Math.abs(finalPrice - packPrice) > 0.01 && (
                              <div className="text-[11px] font-black text-emerald-600 whitespace-nowrap">Final: ₹{finalPrice.toLocaleString()}</div>
                            )}
                          </div>
                        );
                      }
                      const amt = Number(c.meal_plan_price) || Number(customerEnquiries[c.phone]?.total_amount) || 0;
                      return amt > 0 ? (
                        <span className="text-xs font-black text-emerald-600">₹{amt.toLocaleString()}</span>
                      ) : <span className="text-xs text-gray-400">-</span>;
                    })()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {!customerEnquiries[c.phone] ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 border-blue-200">
                        New
                      </span>
                    ) : customerEnquiries[c.phone].sales_status === 'follow_up' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Submitted
                      </span>
                    ) : customerEnquiries[c.phone].sales_status === 'non_follow_up' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg bg-gray-50 text-gray-500 border-gray-200">
                        Closed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg bg-red-50 text-red-700 border-red-200">
                        Not Interested
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!customerEnquiries[c.phone] ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition">
                          <FileText className="w-3 h-3" /> Follow Up
                        </button>
                        <button onClick={() => quickAction(c, 'non_follow_up')}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition" title="Non-Follow Up">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => quickAction(c, 'not_interested')}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Not Interested">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : customerEnquiries[c.phone].sales_status === 'follow_up' ? (
                      <button onClick={() => openEditModal(c)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition ml-auto">
                        <FileText className="w-3 h-3" /> Edit
                      </button>
                    ) : customerEnquiries[c.phone].sales_status === 'non_follow_up' ? (
                      <span className="text-xs text-gray-400 font-semibold">Closed</span>
                    ) : (
                      <span className="text-xs text-red-500 font-semibold">Not Interested</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          {totals.submitted} submitted · {totals.notInterested} not interested · {totals.closed} closed · {totals.pending} pending
        </div>
      </div>

      {/* Follow Up Modal */}
      {editModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setEditModal(false)}>
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Follow Up — {selectedCustomer.name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Complete all details for verification</p>
              </div>
              <button onClick={() => setEditModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pt-6 pb-0 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">Registered</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">Meals/Day</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{selectedCustomer.freq || '-'}</p>
                </div>
                {selectedCustomer.loc_status && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase">Location</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{selectedCustomer.loc_status}{selectedCustomer.loc_km ? ` · ${selectedCustomer.loc_km} km` : ''}</p>
                  </div>
                )}
                {selectedCustomer.loc_fee ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase">Delivery Fee</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">₹{Number(selectedCustomer.loc_fee).toLocaleString()}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <form onSubmit={handleSaveDetails} className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> Personal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Customer Name *</label>
                    <input type="text" required value={editForm.customer_name}
                      onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone *</label>
                    <input type="text" required value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                    <input type="email" value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Address</label>
                    <input type="text" value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Health & Dietary Profile
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Age</label>
                    <input type="number" value={editForm.age} onChange={e => setEditForm({ ...editForm, age: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                    <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Height (cm)</label>
                    <input type="number" value={editForm.height} onChange={e => setEditForm({ ...editForm, height: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Weight (kg)</label>
                    <input type="number" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Food Preference</label>
                    <select value={editForm.food_preference} onChange={e => setEditForm({ ...editForm, food_preference: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="veg">Vegetarian</option>
                      <option value="non_veg">Non-Vegetarian</option>
                      <option value="egg">Eggetarian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Meals/Day</label>
                    <select value={editForm.meals_per_day} onChange={e => setEditForm({ ...editForm, meals_per_day: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} meal{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Activity Level</label>
                    <select value={editForm.activity_level} onChange={e => setEditForm({ ...editForm, activity_level: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="sedentary">Sedentary</option>
                      <option value="lightly_active">Lightly Active</option>
                      <option value="moderately_active">Moderately Active</option>
                      <option value="very_active">Very Active</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Fitness Goal</label>
                    <select value={editForm.goal} onChange={e => setEditForm({ ...editForm, goal: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="loss">Weight Loss</option>
                      <option value="gain">Weight Gain</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>

              {(() => { const p = normalizeMealPlan(editForm.meal_plan); if (!p || p.meals.length === 0) return null; return (
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" /> Meal Plan
                  </h3>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-xs font-bold text-gray-700 bg-blue-50 px-3 py-1 rounded-lg">{p.kcal || '-'} kcal</span>
                    <span className="text-xs font-bold text-gray-700 bg-blue-50 px-3 py-1 rounded-lg">{p.protein || '-'}g protein</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {p.meals.map((meal: any, i: number) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                        <p className="text-xs font-bold text-gray-900 mb-2">{meal.name}</p>
                        {meal.items && Array.isArray(meal.items) && meal.items.map((it: any, j: number) => (
                          <p key={j} className="text-[11px] text-gray-600">
                            {foodLabel(it)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Daily Calories (kcal)</label>
                      <input type="number" value={editForm.daily_calories}
                        onChange={e => setEditForm({ ...editForm, daily_calories: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Daily Protein (g)</label>
                      <input type="number" value={editForm.daily_protein}
                        onChange={e => setEditForm({ ...editForm, daily_protein: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              ); })()}

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-600" /> Meal Plan Price
                </h3>
                <p className="text-[11px] text-emerald-600/80 mb-3">Auto-computed from menu prices (per 100g). Edit to apply a discount or negotiate a lower price — the final price flows through to the Verifier, Payment, and Subscription modules.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-emerald-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Auto-computed Plan Cost</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">₹{planPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-1">menu prices per 100g</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Final Meal Plan Price (₹) *</label>
                    <input type="number" min={0} step="0.01" required value={editForm.total_amount}
                      onChange={e => setEditForm({ ...editForm, total_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                    {(() => { const final = Number(editForm.total_amount) || 0; const diff = Math.round((planPrice - final) * 100) / 100; return planPrice > 0 && final > 0 && diff > 0 ? (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">Discount applied — customer saves ₹{diff.toLocaleString()}</p>
                    ) : planPrice > 0 && final > planPrice ? (
                      <p className="text-[11px] font-semibold text-amber-600 mt-1">₹{Math.round((final - planPrice) * 100) / 100} above menu cost</p>
                    ) : null; })()}
                  </div>
                </div>
                {(() => { const packs = getPackages(selectedCustomer); return packs.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Selected in Onboarding</p>
                    <div className="flex flex-wrap gap-2">
                      {packs.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-[11px] font-bold text-gray-700">
                          {p.name} — ≈ ₹{Number(p.price).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null; })()}
              </div>

              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-blue-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" /> Instructions for Verifier
                </h3>
                <p className="text-[11px] text-blue-600/80 mb-3">These notes will be shown to the verifier in the Verifier Dashboard before they process this enquiry.</p>
                <textarea value={editForm.sales_notes} onChange={e => setEditForm({ ...editForm, sales_notes: e.target.value })}
                  rows={3} className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Customer wants an extra 100g chicken on the side. Call before confirming delivery timing." />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditModal(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save & Submit for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
