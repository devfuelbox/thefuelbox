'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, X, Save, Trash2, Eye, DollarSign, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, CalendarDays, User, Ruler, Weight, Flame, Dumbbell,
  Wheat, Apple, Utensils, Clock, CheckCircle2, AlertTriangle, Target,
  Activity, Zap, Coffee, Sun, Moon, Star, FileText, CreditCard, Hash, ThumbsDown, MessageCircle
} from 'lucide-react';
import { calculateNutrition, calculateItemNutrition, distributeMeals } from '@/lib/nutrition/calculations';
import { canonicalMealPlan, normalizeMealPlan, planTotals, selectedFoodItemsFromPlan } from '@/lib/mealPlan';

interface FoodItem {
  id: number;
  name: string;
  price: number;
  diet: string;
  category: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_available: boolean;
}

interface SelectedFood {
  id: number | string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealPlanMeal {
  name: string;
  items: Array<{ id: number | string; name: string; grams: number; calories: number; protein: number }>;
  total_calories: number;
  total_protein: number;
}

interface PaymentHistoryEntry {
  amount: number;
  method: string;
  date: string;
  note: string;
}

interface EnquiryRecord {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  food_preference: string | null;
  activity_level: string | null;
  goal: string | null;
  meals_per_day: number | null;
  selected_food_items: SelectedFood[];
  meal_plan: MealPlanMeal[];
  daily_calories: number | null;
  daily_protein: number | null;
  enquiry_date: string | null;
  service: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_method: string | null;
  payment_date: string | null;
  payment_status: string;
  notes: string | null;
  payment_history: PaymentHistoryEntry[];
  sales_notes: string | null;
  sales_status: string | null;
  order_status: string | null;
  created_at: string;
}

const STAT_COLORS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};
const STAT_ICONS: Record<string, any> = { paid: CheckCircle2, partially_paid: AlertTriangle, pending: Clock };
const SALES_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  follow_up: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  non_follow_up: 'bg-gray-50 text-gray-500 border-gray-200',
  not_interested: 'bg-red-50 text-red-700 border-red-200',
};
const SALES_LABELS: Record<string, string> = {
  new: 'New',
  follow_up: 'Submitted',
  non_follow_up: 'Closed',
  not_interested: 'Not Interested',
};
const MEAL_ICONS: Record<string, any> = { Morning: Coffee, Afternoon: Sun, Evening: Zap, Night: Moon };
const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' },
  { value: 'very_active', label: 'Very Active' },
];
const GOAL_OPTIONS = [
  { value: 'loss', label: 'Weight Loss' },
  { value: 'gain', label: 'Weight Gain' },
  { value: 'maintenance', label: 'Maintenance' },
];
const SERVICES = ['meal_plan', 'weekly_plan', 'monthly_plan', 'custom_plan', 'consultation', 'other'];
const METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'online', 'other'];

const salesStatusOf = (r: EnquiryRecord): string => r.sales_status || 'new';

export default function AdminEnquiriesPage() {
  const [records, setRecords] = useState<EnquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [salesFilter, setSalesFilter] = useState('');
  const [page, setPage] = useState(1);
  const P = 10;

  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<EnquiryRecord | null>(null);
  const [viewing, setViewing] = useState<EnquiryRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addPayModal, setAddPayModal] = useState(false);
  const [addPayForm, setAddPayForm] = useState({ amount: 0, method: 'cash', date: '', note: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const defaultForm = {
    customer_name: '', phone: '', email: '', address: '',
    age: 25, gender: 'male', height: 170, weight: 70,
    food_preference: 'veg', activity_level: 'sedentary', goal: 'maintenance', meals_per_day: 3,
    selected_food_items: [] as SelectedFood[],
    meal_plan: [] as MealPlanMeal[],
    daily_calories: 0, daily_protein: 0,
    enquiry_date: '', service: 'meal_plan',
    total_amount: 0, paid_amount: 0, payment_method: 'cash', payment_date: '', notes: '',
    sales_notes: '',
  };
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    fetch('/api/menu').then(r => r.json()).then(setMenuItems).catch(() => {});
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/enquiries', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setRecords(await r.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchRecords(); }, []);

  const nut = useMemo(() => calculateNutrition({
    weight: form.weight || 70, height: form.height || 170, age: form.age || 25,
    gender: (form.gender as any) || 'male', goal: (form.goal as any) || 'maintenance',
    activity: (form.activity_level as any) || 'sedentary',
    food_preference: (form.food_preference as any) || 'veg',
    meals_per_day: form.meals_per_day || 3,
  }), [form.weight, form.height, form.age, form.gender, form.goal, form.activity_level, form.meals_per_day]);

  const computedOutstanding = Math.max(0, (form.total_amount || 0) - (form.paid_amount || 0));
  const computedStatus = form.total_amount <= 0 ? 'pending'
    : (form.paid_amount || 0) >= form.total_amount ? 'paid'
    : (form.paid_amount || 0) > 0 ? 'partially_paid' : 'pending';

  const filtered = records.filter(r => {
    const ms = r.customer_name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search);
    const ss = !statusFilter || r.payment_status === statusFilter;
    const sf = !salesFilter || salesStatusOf(r) === salesFilter;
    return ms && ss && sf;
  });
  const totPages = Math.ceil(filtered.length / P);
  const paginated = filtered.slice((page - 1) * P, page * P);
  useEffect(() => { setPage(1); }, [search, statusFilter, salesFilter]);

  // Food item selection
  const [foodSearch, setFoodSearch] = useState('');
  const availableFoods = menuItems.filter(i => i.is_available);

  const toggleFoodItem = (item: FoodItem) => {
    setForm(prev => {
      const exists = prev.selected_food_items.find(f => f.id === item.id);
      if (exists) {
        return { ...prev, selected_food_items: prev.selected_food_items.filter(f => f.id !== item.id) };
      }
      const nut = calculateItemNutrition(item, 100);
      return {
        ...prev,
        selected_food_items: [...prev.selected_food_items, { id: item.id, name: item.name, grams: 100, ...nut }],
      };
    });
  };

  const updateFoodGrams = (id: number | string, grams: number) => {
    setForm(prev => {
      const items = prev.selected_food_items.map(f => {
        if (f.id !== id) return f;
        const menuItem = menuItems.find(m => m.id === id);
        const nut = menuItem ? calculateItemNutrition(menuItem, grams) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
        return { ...f, grams, ...nut };
      });
      return { ...prev, selected_food_items: items };
    });
  };

  const generateMealPlan = () => {
    const meals = distributeMeals(form.selected_food_items, form.meals_per_day || 3);
    setForm(prev => ({ ...prev, meal_plan: meals }));
  };

  const openNew = () => {
    setForm(defaultForm);
    setSelected(null);
    setShowModal(true);
  };

  const openEdit = (r: EnquiryRecord) => {
    const planArray = canonicalMealPlan(r.meal_plan, menuItems);
    const existingFoods = (r.selected_food_items || []).length
      ? r.selected_food_items
      : selectedFoodItemsFromPlan(r.meal_plan, menuItems);
    setForm({
      customer_name: r.customer_name, phone: r.phone, email: r.email || '', address: r.address || '',
      age: r.age || 25, gender: r.gender || 'male', height: r.height || 170, weight: r.weight || 70,
      food_preference: r.food_preference || 'veg', activity_level: r.activity_level || 'sedentary',
      goal: r.goal || 'maintenance',
      meals_per_day: r.meals_per_day || (planArray.length ? planArray.length : 3),
      selected_food_items: existingFoods,
      meal_plan: planArray,
      daily_calories: r.daily_calories || 0, daily_protein: r.daily_protein || 0,
      enquiry_date: r.enquiry_date || '', service: r.service || 'meal_plan',
      total_amount: Number(r.total_amount), paid_amount: Number(r.paid_amount),
      payment_method: r.payment_method || 'cash', payment_date: r.payment_date || '', notes: r.notes || '',
      sales_notes: r.sales_notes || '',
    });
    setSelected(r);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.meal_plan.length && payload.selected_food_items.length) {
        const meals = distributeMeals(payload.selected_food_items, payload.meals_per_day || 3);
        payload.meal_plan = meals;
      }

      const method = selected ? 'PATCH' : 'POST';
      const body = selected ? { id: selected.id, ...payload, sales_status: 'follow_up' } : { ...payload, sales_status: 'follow_up' };
      const res = await fetch('/api/admin/enquiries', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchRecords();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save enquiry.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/admin/enquiries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      setRecords(prev => prev.filter(r => r.id !== id));
      setDeleteId(null);
    } catch { alert('Failed to delete.'); }
  };

  const handleAddPayment = async () => {
    if (!viewing || addPayForm.amount <= 0) return;
    try {
      const res = await fetch('/api/admin/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: viewing.id,
          additional_payment: addPayForm.amount,
          payment_method: addPayForm.method,
          payment_date: addPayForm.date || new Date().toISOString().split('T')[0],
          payment_note: addPayForm.note,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchRecords();
      setAddPayModal(false);
      setAddPayForm({ amount: 0, method: 'cash', date: '', note: '' });
      setViewing(null);
    } catch { alert('Failed to add payment.'); }
  };

  const quickAction = async (r: EnquiryRecord, sales_status: string) => {
    try {
      const res = await fetch('/api/admin/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: r.id, sales_status }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchRecords();
    } catch { alert('Failed to update status.'); }
  };

  const totals = useMemo(() => ({
    revenue: records.reduce((s, r) => s + Number(r.paid_amount), 0),
    outstanding: records.reduce((s, r) => s + Number(r.outstanding_amount), 0),
    count: records.length,
  }), [records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            payment management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Complete customer, nutrition, meal plan & payment management.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-700 transition text-sm">
          <Plus className="w-4 h-4" /> New Enquiry
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Collected Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-50"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">₹{totals.revenue.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">{totals.count} enquiries</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Outstanding</span>
            <div className="p-2 rounded-lg bg-red-50"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">₹{totals.outstanding.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">Pending collection</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Status</span>
            <div className="p-2 rounded-lg bg-blue-50"><CreditCard className="w-4 h-4 text-blue-600" /></div>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {records.filter(r => r.payment_status === 'pending').length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> {records.filter(r => r.payment_status === 'partially_paid').length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {records.filter(r => r.payment_status === 'paid').length}</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="text" placeholder="Search name or phone..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
            <option value="">All Payments</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
          <select value={salesFilter} onChange={e => setSalesFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
            <option value="">All Sales Status</option>
            <option value="new">New</option>
            <option value="follow_up">Submitted</option>
            <option value="non_follow_up">Closed</option>
            <option value="not_interested">Not Interested</option>
          </select>
          <div className="text-xs text-gray-400 flex items-center justify-end font-medium">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Health Profile</th>
                <th className="px-5 py-3">Goal / Meals</th>
                <th className="px-5 py-3">Cal / Prot</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Sales</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400">No enquiries found.</td></tr>
              ) : paginated.map(r => {
                const SI = STAT_ICONS[r.payment_status] || Clock;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{r.customer_name}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {r.phone}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-semibold">
                      {r.age}y / {r.height}cm / {r.weight}kg<br />
                      <span className="text-gray-400 capitalize">{r.gender}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="capitalize text-xs font-bold text-gray-700 block">{r.goal?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-gray-400">{r.meals_per_day} meals/day</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-bold text-gray-900">{r.daily_calories || '-'} kcal</div>
                      <div className="text-[10px] text-gray-400">{r.daily_protein || '-'}g protein</div>
                    </td>
                    <td className="px-5 py-4 font-black text-gray-900">₹{Number(r.total_amount).toLocaleString()}</td>
                    <td className="px-5 py-4 font-bold text-emerald-600">₹{Number(r.paid_amount).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className={`font-bold ${r.payment_status === 'paid' ? 'text-gray-400' : 'text-red-500'}`}>
                        ₹{Number(r.outstanding_amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg ${STAT_COLORS[r.payment_status] || 'bg-gray-100'}`}>
                        <SI className="w-3 h-3" />
                        {r.payment_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg ${SALES_COLORS[salesStatusOf(r)]}`}>
                        {SALES_LABELS[salesStatusOf(r)]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {salesStatusOf(r) !== 'non_follow_up' && salesStatusOf(r) !== 'not_interested' && (
                          <>
                            <button onClick={() => quickAction(r, 'not_interested')}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Mark Not Interested">
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => quickAction(r, 'non_follow_up')}
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Mark Closed">
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => { setViewing(r); setAddPayModal(true); }}
                          disabled={r.payment_status === 'paid'}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-30" title="Add Payment">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setViewing(r); }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(r)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Edit">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(r.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-bold">{(page - 1) * P + 1}</span> to <span className="font-bold">{Math.min(page * P, filtered.length)}</span> of <span className="font-bold">{filtered.length}</span>
            </p>
            {totPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                {Array.from({ length: totPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${page === p ? 'bg-emerald-600 text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totPages, p + 1))} disabled={page === totPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== ADD / EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected ? 'Edit Enquiry' : 'New Customer Enquiry'}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Complete customer, nutrition, meal plan & payment details</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* ── CUSTOMER DETAILS ── */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> Personal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Customer Name *</label>
                    <input type="text" required value={form.customer_name}
                      onChange={e => setForm({ ...form, customer_name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone *</label>
                    <input type="text" required value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Address</label>
                    <input type="text" value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* ── HEALTH & DIETARY ── */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" /> Health & Dietary Profile
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Age</label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                      <input type="number" value={form.age} onChange={e => setForm({ ...form, age: Number(e.target.value) })}
                        className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                    <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Height (cm)</label>
                    <div className="relative">
                      <Ruler className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                      <input type="number" value={form.height} onChange={e => setForm({ ...form, height: Number(e.target.value) })}
                        className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Weight (kg)</label>
                    <div className="relative">
                      <Weight className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                      <input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })}
                        className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Food Preference</label>
                    <select value={form.food_preference} onChange={e => setForm({ ...form, food_preference: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      <option value="veg">Vegetarian</option>
                      <option value="non_veg">Non-Vegetarian</option>
                      <option value="egg">Eggetarian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Meals/Day</label>
                    <select value={form.meals_per_day} onChange={e => setForm({ ...form, meals_per_day: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} meal{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Activity Level</label>
                    <select value={form.activity_level} onChange={e => setForm({ ...form, activity_level: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Fitness Goal</label>
                    <select value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── AUTO-CALCULATED NUTRITION ── */}
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/30 rounded-xl border border-emerald-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4" /> Auto-Calculated Nutrition
                  </h4>
                  <span className="text-[10px] text-emerald-600 font-semibold">Updates in real-time</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 text-center">
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">BMR</p>
                    <p className="text-lg font-black text-gray-900">{nut.bmr}</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">TDEE</p>
                    <p className="text-lg font-black text-gray-900">{nut.tdee}</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Goal Cal</p>
                    <p className="text-lg font-black text-emerald-600">{nut.goal_calories}</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Protein</p>
                    <p className="text-lg font-black text-blue-600">{nut.protein_g}g</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Carbs</p>
                    <p className="text-lg font-black text-amber-600">{nut.carbs_g}g</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Fat</p>
                    <p className="text-lg font-black text-rose-600">{nut.fat_g}g</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Prot/kg</p>
                    <p className="text-lg font-black text-purple-600">{nut.protein_per_kg}g</p>
                  </div>
                </div>
              </div>

              {/* ── FOOD ITEM SELECTOR ── */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Apple className="w-4 h-4 text-emerald-600" /> Select Food Items
                </h3>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input type="text" placeholder="Search food items..." value={foodSearch}
                    onChange={e => setFoodSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
                  {availableFoods.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).slice(0, 24).map(item => {
                    const isSel = form.selected_food_items.some(f => f.id === item.id);
                    return (
                      <button key={item.id} type="button" onClick={() => toggleFoodItem(item)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left ${
                          isSel ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                        <div className="truncate">{item.name}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{item.calories} kcal | {item.protein_g}g P</div>
                      </button>
                    );
                  })}
                </div>

                {form.selected_food_items.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600">{form.selected_food_items.length} items selected</span>
                      <button type="button" onClick={generateMealPlan}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">
                        Generate Meal Plan
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-center">Grams</th>
                            <th className="px-3 py-2 text-center">Cal</th>
                            <th className="px-3 py-2 text-center">Prot</th>
                            <th className="px-3 py-2 text-center">Carbs</th>
                            <th className="px-3 py-2 text-center">Fat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.selected_food_items.map(f => (
                            <tr key={f.id} className="border-b border-gray-50">
                              <td className="px-3 py-2 font-semibold text-gray-700">{f.name}</td>
                              <td className="px-3 py-2 text-center">
                                <input type="number" min={0} step={10} value={f.grams}
                                  onChange={e => updateFoodGrams(f.id, Number(e.target.value))}
                                  className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs font-bold" />
                              </td>
                              <td className="px-3 py-2 text-center font-bold">{f.calories}</td>
                              <td className="px-3 py-2 text-center text-blue-600 font-bold">{f.protein}g</td>
                              <td className="px-3 py-2 text-center text-amber-600 font-bold">{f.carbs}g</td>
                              <td className="px-3 py-2 text-center text-rose-600 font-bold">{f.fat}g</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-bold">
                            <td className="px-3 py-2 text-gray-700">Total</td>
                            <td className="px-3 py-2 text-center">{form.selected_food_items.reduce((s, f) => s + f.grams, 0)}g</td>
                            <td className="px-3 py-2 text-center">{form.selected_food_items.reduce((s, f) => s + f.calories, 0)}</td>
                            <td className="px-3 py-2 text-center text-blue-600">{form.selected_food_items.reduce((s, f) => s + f.protein, 0).toFixed(1)}g</td>
                            <td className="px-3 py-2 text-center text-amber-600">{form.selected_food_items.reduce((s, f) => s + f.carbs, 0).toFixed(1)}g</td>
                            <td className="px-3 py-2 text-center text-rose-600">{form.selected_food_items.reduce((s, f) => s + f.fat, 0).toFixed(1)}g</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* ── MEAL PLAN ── */}
              {form.meal_plan.length > 0 && (
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-600" /> Generated Meal Plan
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {form.meal_plan.map((meal, idx) => {
                      const MI = MEAL_ICONS[meal.name] || Coffee;
                      return (
                        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MI className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-bold text-gray-900">{meal.name}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-semibold">
                              {meal.total_calories} kcal / {meal.total_protein}g P
                            </div>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {meal.items.length > 0 ? meal.items.map((it, ii) => (
                              <div key={ii} className="flex justify-between text-[11px]">
                                <span className="font-medium text-gray-700">{it.name}</span>
                                <span className="font-semibold text-gray-500">{it.grams}g · {it.calories}kcal</span>
                              </div>
                            )) : (
                              <p className="text-[11px] text-gray-400 italic">Auto-distributed</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ENQUIRY & SERVICE ── */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" /> Enquiry & Service Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Enquiry Date</label>
                    <input type="date" value={form.enquiry_date}
                      onChange={e => setForm({ ...form, enquiry_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Service / Plan</label>
                    <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      {SERVICES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
                    <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                      {METHODS.map(m => <option key={m} value={m}>{m.replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── PAYMENT ── */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Billing & Payment
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Total Bill (₹) *</label>
                    <input type="number" min={0} required value={form.total_amount}
                      onChange={e => setForm({ ...form, total_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Amount Paid (₹)</label>
                    <input type="number" min={0} value={form.paid_amount}
                      onChange={e => setForm({ ...form, paid_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Payment Date</label>
                    <input type="date" value={form.payment_date}
                      onChange={e => setForm({ ...form, payment_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Total Bill</p>
                      <p className="text-xl font-black text-gray-900">₹{Number(form.total_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Paid</p>
                      <p className="text-xl font-black text-emerald-600">₹{Number(form.paid_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Outstanding</p>
                      <p className={`text-xl font-black ${computedOutstanding > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                        ₹{computedOutstanding.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Status</p>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                        computedStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        computedStatus === 'partially_paid' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {computedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                  {(() => { const cost = planTotals(form.meal_plan, menuItems).price; return cost > 0 ? (
                    <p className="text-[11px] text-gray-500 mt-2 text-center">
                      Auto-computed plan cost: <span className="font-bold text-emerald-600">₹{cost.toLocaleString()}</span>
                      <span className="text-gray-400"> (menu prices per 100g)</span>
                    </p>
                  ) : null; })()}
                </div>
              </div>

              {/* ── NOTES ── */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Remarks</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-blue-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" /> Instructions for Verifier
                </h3>
                <p className="text-[11px] text-blue-600/80 mb-3">These notes will be shown to the verifier in the Verifier Dashboard before they process this enquiry.</p>
                <textarea value={form.sales_notes} onChange={e => setForm({ ...form, sales_notes: e.target.value })}
                  rows={3} className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Customer wants an extra 100g chicken on the side. Call before confirming delivery timing." />
              </div>

              {/* ── SUBMIT ── */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : selected ? 'Update Enquiry' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== VIEW DETAILS MODAL ===== */}
      {viewing && !addPayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setViewing(null)}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Enquiry Details</h2>
                <p className="text-sm text-gray-400 mt-0.5">Complete record for {viewing.customer_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-bold rounded-lg ${SALES_COLORS[salesStatusOf(viewing)]}`}>
                  {SALES_LABELS[salesStatusOf(viewing)]}
                </span>
                <button onClick={() => { setViewing(null); openEdit(viewing); }}
                  className="px-3 py-2 text-xs font-bold text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition">Edit</button>
                <button onClick={() => setViewing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Personal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer</p>
                  <p className="font-bold text-gray-900">{viewing.customer_name}</p>
                  <p className="text-xs text-gray-500">{viewing.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Age / Gender</p>
                  <p className="font-bold text-gray-900">{viewing.age || '-'}y / <span className="capitalize">{viewing.gender || '-'}</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Height / Weight</p>
                  <p className="font-bold text-gray-900">{viewing.height || '-'}cm / {viewing.weight || '-'}kg</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</p>
                  <p className="font-bold text-gray-900 text-sm truncate">{viewing.email || '-'}</p>
                </div>
              </div>

              {/* Health & Nutrition */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 text-center">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Diet</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.food_preference?.replace(/_/g, ' ') || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Activity</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.activity_level?.replace(/_/g, ' ') || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Goal</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.goal?.replace(/_/g, ' ') || '-'}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Meals</p><p className="text-sm font-bold text-gray-900">{viewing.meals_per_day || '-'}/day</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Calories</p><p className="text-sm font-bold text-emerald-600">{viewing.daily_calories || '-'} kcal</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Protein</p><p className="text-sm font-bold text-blue-600">{viewing.daily_protein || '-'}g</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Service</p><p className="text-sm font-bold text-gray-900 capitalize">{viewing.service?.replace(/_/g, ' ') || '-'}</p></div>
                </div>
              </div>

              {/* Food Items */}
              {(() => {
                const foods = (viewing.selected_food_items && viewing.selected_food_items.length)
                  ? viewing.selected_food_items
                  : selectedFoodItemsFromPlan(viewing.meal_plan, menuItems);
                if (!foods.length) return null;
                return (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Apple className="w-4 h-4 text-emerald-600" /> Selected Foods</h3>
                    <div className="flex flex-wrap gap-2">
                      {foods.map(f => (
                        <span key={f.id} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">
                          {f.name} <span className="text-gray-400 font-normal">({f.grams}g)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Meal Plan */}
              {(() => { const p = normalizeMealPlan(viewing.meal_plan); if (!p || !p.meals.length) return null; return (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Utensils className="w-4 h-4 text-emerald-600" /> Meal Plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {p.meals.map((meal, idx) => {
                      const MI = MEAL_ICONS[meal.name] || Coffee;
                      return (
                        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <MI className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-xs font-bold text-gray-900">{meal.name}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">{meal.total_calories} kcal</span>
                          </div>
                          <div className="p-3 space-y-1">
                            {meal.items.map((it, ii) => (
                              <div key={ii} className="flex justify-between text-[11px]">
                                <span className="text-gray-700">{it.name}</span>
                                <span className="text-gray-500">{it.grams}g</span>
                              </div>
                            ))}
                            {meal.items.length === 0 && (
                              <p className="text-[11px] text-gray-400 italic">No items</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ); })()}

              {/* Address */}
              {viewing.address && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</p>
                  <p className="text-sm font-semibold text-gray-700">{viewing.address}</p>
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Payment Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] font-bold text-gray-400 uppercase">Total</p><p className="text-lg font-black text-gray-900">₹{Number(viewing.total_amount).toLocaleString()}</p></div>
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] font-bold text-gray-400 uppercase">Paid</p><p className="text-lg font-black text-emerald-600">₹{Number(viewing.paid_amount).toLocaleString()}</p></div>
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] font-bold text-gray-400 uppercase">Due</p><p className={`text-lg font-black ${viewing.payment_status === 'paid' ? 'text-gray-400' : 'text-red-500'}`}>₹{Number(viewing.outstanding_amount).toLocaleString()}</p></div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold rounded-lg ${STAT_COLORS[viewing.payment_status]}`}>
                      {(() => { const Icon = STAT_ICONS[viewing.payment_status] || Clock; return <Icon className="w-3 h-3" />; })()}
                      {viewing.payment_status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1 capitalize">{viewing.payment_method || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">Payment History</h3>
                  {viewing.payment_status !== 'paid' && (
                    <button onClick={() => setAddPayModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition">
                      <Plus className="w-3 h-3" /> Add Payment
                    </button>
                  )}
                </div>
                {viewing.payment_history && viewing.payment_history.length > 0 ? (
                  <div className="space-y-2">
                    {(Array.isArray(viewing.payment_history) ? viewing.payment_history : []).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">₹{Number(entry.amount).toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{entry.date} via {entry.method}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500 italic">{entry.note || 'Payment'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm font-medium text-center py-4">No payment history</p>
                )}
              </div>

              {viewing.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{viewing.notes}</p>
                </div>
              )}
              {viewing.sales_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Instructions for Verifier</p>
                  <p className="text-sm text-blue-800">{viewing.sales_notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => setViewing(null)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD PAYMENT MODAL ===== */}
      {addPayModal && viewing && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setAddPayModal(false); setViewing(null); }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">For: {viewing.customer_name}</p>
              </div>
              <button onClick={() => { setAddPayModal(false); setViewing(null); }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
                <p className="text-[10px] font-bold text-amber-600 uppercase">Outstanding</p>
                <p className="text-2xl font-black text-red-500">₹{Number(viewing.outstanding_amount).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount (₹) *</label>
                <input type="number" min={0} max={Number(viewing.outstanding_amount)} value={addPayForm.amount}
                  onChange={e => setAddPayForm({ ...addPayForm, amount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Method</label>
                  <select value={addPayForm.method} onChange={e => setAddPayForm({ ...addPayForm, method: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                    {METHODS.map(m => <option key={m} value={m}>{m.replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Date</label>
                  <input type="date" value={addPayForm.date}
                    onChange={e => setAddPayForm({ ...addPayForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Note</label>
                <input type="text" value={addPayForm.note} onChange={e => setAddPayForm({ ...addPayForm, note: e.target.value })}
                  placeholder="e.g., Second installment" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex justify-between text-sm">
                <span className="font-semibold text-gray-600">After this payment:</span>
                <span className="font-black text-gray-900">₹{Math.max(0, Number(viewing.outstanding_amount) - addPayForm.amount).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setAddPayModal(false); setViewing(null); }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={handleAddPayment} disabled={addPayForm.amount <= 0}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Enquiry?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
