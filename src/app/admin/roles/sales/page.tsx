'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Phone, User, Search, X, Save, CheckCircle2, Activity, FileText, ThumbsDown, MessageCircle, IndianRupee, Bell, DollarSign, Trash2,
  CalendarDays, Clock, Coffee, Sun, Loader2, RotateCcw, Ban, SkipForward, XCircle, RefreshCw, Repeat, Download
} from 'lucide-react';
import { foodLabel } from '@/lib/foodDisplay';
import { normalizeMealPlan, planTotals } from '@/lib/mealPlan';
import { calculateItemNutrition } from '@/lib/nutrition/calculations';

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

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'online', 'other'];

const GOAL_LABELS: Record<string, string> = {
  loss: 'Weight Loss',
  gain: 'Weight Gain',
  muscle: 'Muscle Gain',
  maintenance: 'Weight Maintenance',
};

function goalLabel(goal: any): string {
  if (!goal) return '-';
  const g = String(goal).trim().toLowerCase();
  if (GOAL_LABELS[g]) return GOAL_LABELS[g];
  return g.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(s: string): string {
  if (!s) return '-';
  const [y, m, d] = String(s).split('-');
  return `${d}-${m}-${y}`;
}

function todayAtMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

const MEAL_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const DELIVERY_STYLES: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700 border-gray-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  out_for_delivery: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_delivered: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-purple-50 text-purple-700 border-purple-200',
  rescheduled: 'bg-orange-50 text-orange-700 border-orange-200',
};
const DELIVERY_ICONS: Record<string, any> = {
  scheduled: Clock, preparing: Clock, out_for_delivery: Clock,
  delivered: CheckCircle2, not_delivered: XCircle, skipped: Ban, rescheduled: RotateCcw,
};
const DAY_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  skipped: 'bg-purple-100 text-purple-800 border-purple-300',
  ongoing: 'bg-blue-100 text-blue-800 border-blue-300',
  partial: 'bg-amber-100 text-amber-800 border-amber-300',
};



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
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [enquiriesList, setEnquiriesList] = useState<any[]>([]);
  const [recordPay, setRecordPay] = useState({ amount: 0, method: 'cash', date: '', note: '' });
  const [recording, setRecording] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deliverySubTab, setDeliverySubTab] = useState<'delivery' | 'subscription'>('delivery');
  const [editingDailyPlan, setEditingDailyPlan] = useState<{ day: number; meal: string } | null>(null);
  const [perDayOverrides, setPerDayOverrides] = useState<Record<number, any>>({});
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewDays, setRenewDays] = useState<number>(7);
  const [renewAuto, setRenewAuto] = useState<boolean>(false);
  const [renewSaving, setRenewSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerForm, setAddCustomerForm] = useState({
    name: '', phone: '', email: '', address: '',
    age: 25, gender: 'male', height: 170, weight: 70,
    food: 'veg', activity: 'sedentary', goal: 'maintenance', freq: 1,
  });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3000);
  };

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
      const [cRes, eRes, sRes, dRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/sales/enquiries', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/subscriptions', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null as any),
        fetch('/api/admin/deliveries', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null as any),
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (eRes.ok) {
        const enquiries: any[] = await eRes.json();
        const map: Record<string, any> = {};
        enquiries.forEach(e => { map[e.phone] = e; });
        setCustomerEnquiries(map);
        setEnquiriesList(enquiries);
      }
      if (sRes && sRes.ok) {
        const subs = await sRes.json();
        setSubscriptions(Array.isArray(subs) ? subs : []);
      }
      if (dRes && dRes.ok) {
        const dels = await dRes.json();
        setDeliveries(Array.isArray(dels) ? dels : []);
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
    next_payment_date: '', follow_up_note: '', follow_up_status: 'pending',
  });

  const planPrice = useMemo(() => {
    const p = planTotals(editForm.meal_plan, menuItems);
    return Math.round(p.price * 100) / 100;
  }, [editForm.meal_plan, menuItems]);

  const availableFoods = useMemo(() => menuItems.filter((i: any) => i.is_available), [menuItems]);

  const selectedSubscription = useMemo(() => {
    if (!selectedCustomer) return null;
    const mapped: any = customerEnquiries[selectedCustomer.phone];
    if (mapped?.subscription) return mapped.subscription;
    const candidates = enquiriesList.filter((e: any) => e.phone === selectedCustomer.phone);
    for (const enq of candidates) {
      if ((enq as any).subscription) return (enq as any).subscription;
      const sub = subscriptions.find((s: any) => s.customer_enquiry_id === enq.id);
      if (sub) return sub;
    }
    if (mapped) {
      return subscriptions.find((s: any) => s.customer_enquiry_id === mapped.id) || null;
    }
    return null;
  }, [selectedCustomer, customerEnquiries, subscriptions, enquiriesList]);

  const selectedDeliveries = useMemo(() => {
    if (!selectedSubscription) return [];
    if (Array.isArray((selectedSubscription as any).deliveries) && (selectedSubscription as any).deliveries.length > 0) {
      return [...(selectedSubscription as any).deliveries].sort((a: any, b: any) => a.day_number - b.day_number || String(a.meal_slot).localeCompare(String(b.meal_slot)));
    }
    return deliveries
      .filter((d: any) => d.subscription_id === selectedSubscription.id)
      .sort((a: any, b: any) => a.day_number - b.day_number || String(a.meal_slot).localeCompare(String(b.meal_slot)));
  }, [selectedSubscription, deliveries]);

  const dailyMealPlan = useMemo(() => {
    // Per-day stored shape: [{day, date, meals}, ...] length 7 — use directly (with overrides)
    if (Array.isArray(editForm.meal_plan) && editForm.meal_plan.length > 0 && (editForm.meal_plan[0] as any)?.day && Array.isArray((editForm.meal_plan[0] as any)?.meals)) {
      const perDay = (editForm.meal_plan as any[]).slice(0, 7).map((d: any) => ({
        day: d.day,
        date: d.date || '-',
        meals: (perDayOverrides[d.day] as any) || d.meals,
      }));
      // If overrides for days not in stored plan, merge
      Object.keys(perDayOverrides).forEach(k => {
        const dayNum = Number(k);
        if (!perDay.some(d => d.day === dayNum)) {
          perDay.push({ day: dayNum, date: '-', meals: perDayOverrides[dayNum] });
        }
      });
      return perDay.sort((a: any, b: any) => a.day - b.day);
    }
    const p = normalizeMealPlan(editForm.meal_plan);
    if (!p || !p.meals.length) return [];
    const baseMeals = p.meals;
    if (selectedSubscription && selectedDeliveries.length > 0) {
      const byDay: Record<number, any[]> = {};
      selectedDeliveries.forEach((d: any) => {
        (byDay[d.day_number] ||= []).push(d);
      });
      return Object.entries(byDay)
        .sort(([a], [b]) => Number(a) - Number(b))
        .slice(0, 7)
        .map(([day, dels]) => ({
          day: Number(day),
          date: (dels as any[])[0]?.scheduled_date || '-',
          meals: (perDayOverrides[Number(day)] as any) || baseMeals,
        }));
    }
    const duration = selectedSubscription?.duration_days || editForm.meals_per_day || 3;
    const daysToShow = Math.min(duration, 7);
    return Array.from({ length: daysToShow }, (_, i) => ({
      day: i + 1,
      date: selectedSubscription ? new Date(new Date(selectedSubscription.start_date).getTime() + i * 86400000).toISOString().split('T')[0] : '-',
      meals: (perDayOverrides[i + 1] as any) || baseMeals,
    }));
  }, [editForm.meal_plan, selectedSubscription, selectedDeliveries, perDayOverrides]);

  const groupedDeliveriesForTab = useMemo(() => {
    const grouped: Record<number, typeof selectedDeliveries> = {};
    for (const d of selectedDeliveries) {
      if (!grouped[d.day_number]) grouped[d.day_number] = [] as any;
      (grouped[d.day_number] as any).push(d);
    }
    return grouped;
  }, [selectedDeliveries]);

  const dayStatusForTab = useMemo(() => {
    const map: Record<number, string> = {};
    const ongoingStatuses = ['scheduled', 'preparing', 'out_for_delivery'];
    for (const [day, dels] of Object.entries(groupedDeliveriesForTab)) {
      const statuses = (dels as any[]).map((d: any) => d.status);
      if (statuses.every((s: string) => s === 'delivered')) map[Number(day)] = 'delivered';
      else if (statuses.every((s: string) => s === 'skipped')) map[Number(day)] = 'skipped';
      else if (statuses.some((s: string) => ongoingStatuses.includes(s))) map[Number(day)] = 'ongoing';
      else map[Number(day)] = 'partial';
    }
    return map;
  }, [groupedDeliveriesForTab]);

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
        next_payment_date: existing.next_payment_date || '',
        follow_up_note: existing.follow_up_note || '',
        follow_up_status: existing.follow_up_status || 'pending',
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
        next_payment_date: '',
        follow_up_note: '',
        follow_up_status: 'pending',
      });
    }
    setRecordPay({ amount: 0, method: 'cash', date: '', note: '' });
    setPerDayOverrides({});
    setEditingDailyPlan(null);
    setDeliverySubTab('delivery');
    setSelectedCustomer(c);
    setEditModal(true);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      let payloadMealPlan: any = editForm.meal_plan;
      if (Object.keys(perDayOverrides).length > 0 && dailyMealPlan.length === 7) {
        const perDayArray = dailyMealPlan.map((day: any) => {
          const override = perDayOverrides[day.day];
          if (override) return { ...day, meals: override };
          return day;
        });
        payloadMealPlan = perDayArray;
      }
      if (editingEnquiryId) {
        const r = await fetch('/api/roles/sales/enquiries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingEnquiryId, ...editForm, meal_plan: payloadMealPlan, sales_status: 'follow_up' }),
        });
        if (r.ok) {
          const updated = await r.json();
          setCustomerEnquiries(prev => ({ ...prev, [selectedCustomer.phone]: updated }));
          setEditModal(false);
          setSelectedCustomer(null);
          setEditingEnquiryId(null);
          setPerDayOverrides({});
        }
      } else {
        const r = await fetch('/api/roles/sales/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...editForm, meal_plan: payloadMealPlan }),
        });
        if (r.ok) {
          const created = await r.json();
          setCustomerEnquiries(prev => ({ ...prev, [selectedCustomer.phone]: created }));
          setEditModal(false);
          setSelectedCustomer(null);
          setPerDayOverrides({});
        }
      }
    } catch {}
    setSaving(false);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCustomerForm.name.trim() || !addCustomerForm.phone.trim()) {
      showToast('Name and phone are required', true);
      return;
    }
    const cleanPhone = addCustomerForm.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      showToast('Valid 10-digit phone required', true);
      return;
    }
    if (customers.some((c: any) => String(c.phone).replace(/\D/g, '').slice(-10) === cleanPhone) || customerEnquiries[cleanPhone]) {
      showToast('Customer with this phone already exists', true);
      return;
    }
    setAddingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: addCustomerForm.name.trim(),
          phone: cleanPhone,
          email: addCustomerForm.email.trim() || null,
          address: addCustomerForm.address.trim() || null,
          goal: addCustomerForm.goal,
          age: addCustomerForm.age,
          gender: addCustomerForm.gender,
          height: addCustomerForm.height,
          weight: addCustomerForm.weight,
          food: addCustomerForm.food,
          activity: addCustomerForm.activity,
          freq: addCustomerForm.freq,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create customer');
      }
      const created = await res.json();
      const cust = (created && (created as any).customer) ? (created as any).customer : created;
      setCustomers((prev) => [cust, ...prev]);
      setShowAddCustomerModal(false);
      setAddCustomerForm({
        name: '', phone: '', email: '', address: '',
        age: 25, gender: 'male', height: 170, weight: 70,
        food: 'veg', activity: 'sedentary', goal: 'maintenance', freq: 1,
      });
      showToast(`Customer ${cust.name || addCustomerForm.name} added successfully`);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add customer', true);
    }
    setAddingCustomer(false);
  };

  function getRenewPeriodSales(sub: any) {
    if (!sub) return { currentStart: '-', currentEnd: '-', newStart: '-', newEnd: '-' };
    const end = (sub as any).actual_end_date || (() => {
      const s = new Date(sub.start_date + 'T00:00:00');
      const totalSkipped = Array.isArray(sub.skipped_meals) ? sub.skipped_meals.length : 0;
      const e = new Date(s);
      e.setDate(e.getDate() + (sub.duration_days - 1) + (sub.paused_days || 0) + totalSkipped);
      return e.toISOString().split('T')[0];
    })();
    const oldEnd = new Date(end + 'T00:00:00');
    const newStart = new Date(oldEnd);
    newStart.setDate(newStart.getDate() + 1);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + renewDays - 1);
    return {
      currentStart: sub.start_date,
      currentEnd: end,
      newStart: newStart.toISOString().split('T')[0],
      newEnd: newEnd.toISOString().split('T')[0],
    };
  }

  async function handleRenewSales() {
    if (!selectedSubscription) return;
    if (!renewDays || renewDays < 1 || renewDays > 90) { showToast('Select 1-90 days', true); return; }
    setRenewSaving(true);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selectedSubscription.id, action: 'renew', renewal_days: renewDays, auto_renew: renewAuto }),
      });
      if (!res.ok) { const j = await res.json().catch(()=>({})); showToast(j.message||'Renew failed', true); return; }
      const updated = await res.json();
      const clean = updated._renew ? (()=>{ const { _renew, ...rest}=updated; return rest; })() : updated;
      setSubscriptions(prev => prev.map(s=> s.id===selectedSubscription.id ? clean : s));
      // refresh deliveries
      fetchData();
      setShowRenewModal(false);
      showToast(`Renewed for ${renewDays} days${renewAuto ? ' · Auto-renew ON' : ''}`);
    } catch(e){ console.error(e); showToast('Renew error', true); }
    setRenewSaving(false);
  }

  const handleDownloadPdf = async (customer: any) => {
    const enquiry = customerEnquiries[customer.phone] || enquiriesList.find((e:any)=> e.phone===customer.phone) || null;
    const sub = (() => {
      if (!enquiry) return null;
      return subscriptions.find((s:any)=> s.customer_enquiry_id===enquiry.id) || null;
    })();
    if (!enquiry && !customer) {
      showToast('No customer data found for PDF', true);
      return;
    }
    const key = customer.phone || customer.id;
    setDownloadingPdf(key);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { default: CustomerPdf } = await import('@/components/pdf/CustomerPdf');
      const React = await import('react');
      const doc = React.createElement(CustomerPdf, {
        customer,
        enquiry,
        subscription: sub,
      });
      const blob = await pdf(doc as any).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FuelBox_${(enquiry?.customer_name || customer.name || 'Customer').replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded');
    } catch (err:any) {
      console.error('[PDF] failed', err);
      showToast('Failed to generate PDF', true);
    }
    setDownloadingPdf(null);
  };

  const handleDownloadPdfForEnquiry = async (enquiry: any) => {
    const cust = customers.find((c:any)=> c.phone===enquiry.phone) || { name: enquiry.customer_name, phone: enquiry.phone, email: enquiry.email };
    await handleDownloadPdf(cust);
  };

  const paymentReminders = useMemo(() => {
    const today = todayAtMidnight();
    return Object.values(customerEnquiries)
      .filter((e: any) => {
        const next = e?.next_payment_date;
        const outstanding = Number(e?.outstanding_amount) || 0;
        if (!next || outstanding <= 0) return false;
        if (e.follow_up_status === 'completed') return false;
        const reminderStart = parseDateOnly(next);
        reminderStart.setDate(reminderStart.getDate() - 2);
        return today >= reminderStart;
      })
      .map((e: any) => ({
        ...e,
        daysLeft: Math.max(0, Math.ceil((parseDateOnly(e.next_payment_date).getTime() - today.getTime()) / 86400000)),
      }))
      .sort((a: any, b: any) => String(a.next_payment_date).localeCompare(String(b.next_payment_date)));
  }, [customerEnquiries]);

  const openFollowUpFor = (e: any) => {
    const c = customers.find(x => x.phone === e.phone);
    openEditModal(c || {
      name: e.customer_name, phone: e.phone, email: e.email, address: e.address,
      age: e.age, gender: e.gender, height: e.height, weight: e.weight,
      food: e.food_preference, activity: e.activity_level, goal: e.goal,
      freq: e.meals_per_day, meal_plan: e.meal_plan, meal_plan_price: e.total_amount,
    });
  };

  const markFollowUpCompleted = async (e: any) => {
    try {
      const r = await fetch('/api/roles/sales/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: e.id, follow_up_status: 'completed' }),
      });
      if (r.ok) {
        const updated = await r.json();
        setCustomerEnquiries(prev => ({ ...prev, [e.phone]: updated }));
      }
    } catch {}
  };

  const handleRecordPayment = async () => {
    if (!editingEnquiryId || !selectedCustomer || recordPay.amount <= 0) return;
    setRecording(true);
    try {
      const r = await fetch('/api/roles/sales/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingEnquiryId,
          additional_payment: Number(recordPay.amount),
          payment_method: recordPay.method,
          payment_date: recordPay.date || new Date().toISOString().split('T')[0],
          payment_note: recordPay.note,
        }),
      });
      if (r.ok) {
        const updated = await r.json();
        setCustomerEnquiries(prev => ({ ...prev, [selectedCustomer.phone]: updated }));
        setEditForm(f => ({
          ...f,
          paid_amount: Number(updated.paid_amount),
          payment_method: recordPay.method,
          follow_up_status: updated.follow_up_status || f.follow_up_status,
        }));
        setRecordPay({ amount: 0, method: 'cash', date: '', note: '' });
      }
    } catch {}
    setRecording(false);
  };

  const handleDeleteEnquiry = async () => {
    if (!deleteConfirm?.id) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/roles/sales/enquiries?id=${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setCustomerEnquiries(prev => {
          const next = { ...prev };
          delete next[deleteConfirm.phone];
          return next;
        });
        setDeleteConfirm(null);
        showToast('Customer enquiry deleted successfully.');
      } else {
        const j = await r.json().catch(() => ({}));
        showToast(j.message || 'Failed to delete customer enquiry.', true);
      }
    } catch {
      showToast('Failed to delete customer enquiry.', true);
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Sales Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage customers and submit details for verification. Onboarding customers appear automatically; you can also add manually.</p>
        </div>
        <button
          onClick={() => setShowAddCustomerModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm shadow-sm shrink-0 min-h-[44px] w-full sm:w-auto"
        >
          <User className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Payment Follow-up Reminders */}
      {paymentReminders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
              Payment Follow-up Reminders
            </h2>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">
              {paymentReminders.length} due
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paymentReminders.map((r: any) => (
              <div key={r.id} className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-amber-600" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">Payment Follow-up Reminder</p>
                      <p className="text-[11px] text-amber-700 font-bold">Customer: {r.customer_name}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${
                    r.daysLeft === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.daysLeft === 0 ? 'Due today' : `Due in ${r.daysLeft} day${r.daysLeft !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-white rounded-lg border border-amber-200 p-2.5 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Pending Amount</p>
                    <p className="text-sm font-black text-red-500 mt-0.5">₹{Number(r.outstanding_amount).toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-amber-200 p-2.5 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Next Payment</p>
                    <p className="text-sm font-black text-gray-900 mt-0.5">{formatDate(r.next_payment_date)}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-amber-200 p-2.5 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Status</p>
                    <p className="text-sm font-black text-amber-600 mt-0.5 capitalize">{r.payment_status?.replace(/_/g, ' ') || 'pending'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-700 mt-3">
                  <span className="font-bold">Reminder:</span> Follow up with the customer regarding the pending payment.
                </p>
                {r.follow_up_note ? (
                  <p className="text-[11px] text-amber-800 mt-1.5 italic">"{r.follow_up_note}"</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button onClick={() => openFollowUpFor(r)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition">
                    <FileText className="w-3.5 h-3.5" /> Follow Up
                  </button>
                  <button onClick={() => markFollowUpCompleted(r)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <span className="text-xs font-semibold text-gray-700">{goalLabel(customerEnquiries[c.phone]?.goal || c.goal)}</span>
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
                        <button onClick={() => handleDownloadPdf(c)} disabled={downloadingPdf===c.phone}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50" title="Download PDF">
                          {downloadingPdf===c.phone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition">
                          <FileText className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => handleDownloadPdf(c)} disabled={downloadingPdf===c.phone}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50" title="Download PDF">
                          {downloadingPdf===c.phone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(customerEnquiries[c.phone])}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete Enquiry">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : customerEnquiries[c.phone].sales_status === 'non_follow_up' ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400 font-semibold">Closed</span>
                        <button onClick={() => handleDownloadPdf(c)} disabled={downloadingPdf===c.phone}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50" title="Download PDF">
                          {downloadingPdf===c.phone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(customerEnquiries[c.phone])}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete Enquiry">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-red-500 font-semibold">Not Interested</span>
                        <button onClick={() => handleDownloadPdf(c)} disabled={downloadingPdf===c.phone}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50" title="Download PDF">
                          {downloadingPdf===c.phone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(customerEnquiries[c.phone])}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete Enquiry">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownloadPdf(selectedCustomer)} disabled={downloadingPdf===selectedCustomer.phone}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition">
                  {downloadingPdf===selectedCustomer.phone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
                </button>
                <button onClick={() => setEditModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                      <option value="muscle">Muscle Gain</option>
                      <option value="maintenance">Weight Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>
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

              {selectedSubscription && (
                <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
                  <h3 className="text-sm font-extrabold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-600" /> Subscription
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    <div className="bg-white border border-indigo-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">Current Period</p>
                      <p className="text-xs font-black text-gray-900 mt-1">{formatDate(selectedSubscription.start_date)} → {formatDate((selectedSubscription as any).actual_end_date || getRenewPeriodSales(selectedSubscription).currentEnd)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{selectedSubscription.duration_days} days · {selectedSubscription.status}</p>
                    </div>
                    <div className="bg-white border border-indigo-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">Auto Renew</p>
                      <p className={`text-xs font-black mt-1 ${(selectedSubscription as any).auto_renew ? 'text-emerald-700' : 'text-gray-500'}`}>{(selectedSubscription as any).auto_renew ? `ON · ${(selectedSubscription as any).auto_renew_days} days` : 'OFF'}</p>
                      {(selectedSubscription as any).auto_renew && <p className="text-[10px] text-emerald-600 mt-0.5">Auto-extends</p>}
                    </div>
                    <div className="bg-white border border-indigo-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">Deliveries</p>
                      <p className="text-xs font-black text-gray-900 mt-1">{selectedDeliveries.length} records</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{selectedDeliveries.filter((d:any)=> d.status==='scheduled').length} scheduled</p>
                    </div>
                  </div>
                  {(selectedSubscription as any).renewal_history && Array.isArray((selectedSubscription as any).renewal_history) && (selectedSubscription as any).renewal_history.length>0 && (
                    <div className="mb-3 bg-white border border-indigo-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Renewal History</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedSubscription as any).renewal_history.slice(-3).map((r:any,i:number)=> (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-bold text-gray-700">{formatDate(r.previous_end_date)} → {formatDate(r.new_end_date)} · {r.renewal_days}d {r.auto_renew ? '· Auto' : ''}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-600">Actions:</span>
                    <button type="button" onClick={()=> { setRenewDays((selectedSubscription as any).auto_renew_days || 7); setRenewAuto(!!(selectedSubscription as any).auto_renew); setShowRenewModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white border border-emerald-600 rounded-xl font-bold hover:bg-emerald-700 transition text-xs shadow-sm">
                      <RefreshCw className="w-3.5 h-3.5" /> Renew
                    </button>
                    <span className="text-[11px] text-gray-400">Extends {renewDays} days keeping meal plan & deliveries</span>
                  </div>
                </div>
              )}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600" /> Payment Follow-up
                </h3>
                <p className="text-[11px] text-amber-600/80 mb-3">Record the next payment date and follow-up note. A reminder will appear on the Sales Dashboard 2 days before the payment date until the payment is recorded or the follow-up is completed.</p>
                {(() => { const total = Number(editForm.total_amount) || 0; const paid = Number(editForm.paid_amount) || 0; const pending = Math.max(0, total - paid); return (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="bg-white border border-amber-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Total Amount</p>
                        <p className="text-lg font-black text-gray-900 mt-0.5">₹{total.toLocaleString()}</p>
                      </div>
                      <div className="bg-white border border-amber-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Amount Paid</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">₹{paid.toLocaleString()}</p>
                      </div>
                      <div className="bg-white border border-amber-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Pending Amount</p>
                        <p className={`text-lg font-black mt-0.5 ${pending > 0 ? 'text-red-500' : 'text-gray-600'}`}>₹{pending.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Next Payment Date</label>
                        <input type="date" value={editForm.next_payment_date}
                          onChange={e => setEditForm({ ...editForm, next_payment_date: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Follow-up Status</label>
                        <select value={editForm.follow_up_status}
                          onChange={e => setEditForm({ ...editForm, follow_up_status: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500">
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Follow-up Note</label>
                      <textarea value={editForm.follow_up_note}
                        onChange={e => setEditForm({ ...editForm, follow_up_note: e.target.value })}
                        rows={2} className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                        placeholder="e.g., Customer said they will make the next payment on the selected date." />
                    </div>
                    {editingEnquiryId && pending > 0 && (
                      <div className="bg-white border border-amber-200 rounded-xl p-4">
                        <p className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" /> Record Payment
                        </p>
                        <p className="text-[11px] text-gray-500 mb-3">Record a partial or full payment — the paid amount and pending balance update automatically.</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₹)</label>
                            <input type="number" min={0} max={pending} value={recordPay.amount}
                              onChange={e => setRecordPay({ ...recordPay, amount: Number(e.target.value) })}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Method</label>
                            <select value={recordPay.method}
                              onChange={e => setRecordPay({ ...recordPay, method: e.target.value })}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
                            <input type="date" value={recordPay.date}
                              onChange={e => setRecordPay({ ...recordPay, date: e.target.value })}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Note</label>
                            <input type="text" value={recordPay.note}
                              onChange={e => setRecordPay({ ...recordPay, note: e.target.value })}
                              placeholder="e.g., Partial payment"
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-3">
                          <span className="text-xs text-gray-600">
                            After this payment: <span className="font-black text-gray-900">₹{Math.max(0, pending - recordPay.amount).toLocaleString()}</span> pending
                          </span>
                          <button type="button" onClick={handleRecordPayment} disabled={recording || recordPay.amount <= 0}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                            <DollarSign className="w-3.5 h-3.5" /> {recording ? 'Recording...' : 'Record Payment'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ); })()}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Customer Enquiry</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Are you sure you want to delete this customer enquiry? This action cannot be undone.
                </p>
                {deleteConfirm.customer_name && (
                  <p className="text-xs font-semibold text-gray-400 mt-2">
                    Customer: {deleteConfirm.customer_name} {deleteConfirm.phone ? `(${deleteConfirm.phone})` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" disabled={deleting} onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={deleting} onClick={handleDeleteEnquiry}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition text-sm flex items-center gap-2 disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal — Sales */}
      {showRenewModal && selectedSubscription && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=> !renewSaving && setShowRenewModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e=> e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-emerald-600" /> Renew Subscription</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer?.name || (customerEnquiries[selectedCustomer?.phone||''] as any)?.customer_name || 'Customer'} · {selectedSubscription.duration_days} days</p>
              </div>
              <button onClick={()=> !renewSaving && setShowRenewModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase">Current Period</p>
                  <p className="text-xs font-black text-gray-900 mt-1">{formatDate(getRenewPeriodSales(selectedSubscription).currentStart)} → {formatDate(getRenewPeriodSales(selectedSubscription).currentEnd)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{selectedSubscription.duration_days} days</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">New Period</p>
                  <p className="text-xs font-black text-emerald-700 mt-1">{formatDate(getRenewPeriodSales(selectedSubscription).newStart)} → {formatDate(getRenewPeriodSales(selectedSubscription).newEnd)}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{renewDays} days · Auto {renewAuto ? 'ON' : 'OFF'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">Renew for</p>
                <div className="grid grid-cols-3 gap-2">
                  {[7,14,30].map(d=> (
                    <button key={d} type="button" onClick={()=> setRenewDays(d)} className={`py-2.5 rounded-xl font-bold text-sm border transition ${renewDays===d ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{d} Days</button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Custom Days (1-90)</label>
                  <input type="number" min={1} max={90} value={renewDays} onChange={e=> setRenewDays(Math.max(1, Math.min(90, Number(e.target.value)||1)))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Enter days" />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Repeat className="w-4 h-4 text-emerald-600" /> Auto Renew</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Automatically extend for {renewDays} days when period ends</p>
                </div>
                <button type="button" onClick={()=> setRenewAuto(v=> !v)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${renewAuto ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${renewAuto ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {renewAuto && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Auto-renew ON: After {formatDate(getRenewPeriodSales(selectedSubscription).newEnd)} it will automatically create next {renewDays}-day period.</p>
              )}
              <p className="text-[11px] text-gray-400">Extends delivery schedule & keeps 7-day meal plan, day-wise edits, and customer details.</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={()=> setShowRenewModal(false)} disabled={renewSaving} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm">Cancel</button>
              <button onClick={handleRenewSales} disabled={renewSaving} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {renewSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {renewSaving ? 'Renewing...' : `Renew ${renewDays} Days`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer — Manual Entry (Sales) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => !addingCustomer && setShowAddCustomerModal(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl mb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Customer — Manual Entry</h2>
                <p className="text-sm text-gray-500 mt-0.5">Enter customer details manually. Uses same database & validation as onboarding.</p>
              </div>
              <button onClick={() => !addingCustomer && setShowAddCustomerModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddCustomer}
              className="p-6 space-y-6"
            >
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> Personal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Customer Name *</label>
                    <input type="text" required value={addCustomerForm.name} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, name: e.target.value })} placeholder="e.g., Arjun Kumar" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone *</label>
                    <input type="tel" required value={addCustomerForm.phone} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile" inputMode="numeric" maxLength={10} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                    <input type="email" value={addCustomerForm.email} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, email: e.target.value })} placeholder="optional" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Address</label>
                    <input type="text" value={addCustomerForm.address} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, address: e.target.value })} placeholder="Optional" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Health & Preferences
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Age</label>
                    <input type="number" min={10} max={100} value={addCustomerForm.age} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, age: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                    <select value={addCustomerForm.gender} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, gender: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Height (cm)</label>
                    <input type="number" value={addCustomerForm.height} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, height: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Weight (kg)</label>
                    <input type="number" value={addCustomerForm.weight} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, weight: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Food</label>
                    <select value={addCustomerForm.food} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, food: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="veg">Vegetarian</option>
                      <option value="non_veg">Non-Vegetarian</option>
                      <option value="egg">Eggetarian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Activity</label>
                    <select value={addCustomerForm.activity} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, activity: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="sedentary">Sedentary</option>
                      <option value="active">On my feet</option>
                      <option value="gym">Gym regular</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Goal</label>
                    <select value={addCustomerForm.goal} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, goal: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="loss">Weight Loss</option>
                      <option value="gain">Weight Gain</option>
                      <option value="muscle">Muscle Gain</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Meals/Day</label>
                    <select value={addCustomerForm.freq} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, freq: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{n} meal{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Same validation as onboarding: phone must be 10 digits, name required. Duplicate phone will be blocked.</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} disabled={addingCustomer} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm min-h-[44px] disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={addingCustomer} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-sm min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50">
                  {addingCustomer ? 'Adding...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Success / Error Toast */}
      {toast && (
        <div className={`fixed inset-x-0 top-4 mx-auto max-w-sm z-[70] rounded-md px-4 py-3 text-center text-sm text-white shadow-lg ${
          toast.error ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
