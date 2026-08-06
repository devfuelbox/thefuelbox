'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Search, X, Save, Trash2, ChevronLeft, ChevronRight,
  ChefHat, Truck, Link, Unlink
} from 'lucide-react';

interface MappingRecord {
  id: string;
  chef_id: string;
  delivery_partner_id: string;
  is_active: boolean;
}

interface UserRecord {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export default function DeliveryMappingsPage() {
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [chefs, setChefs] = useState<UserRecord[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, cRes, dRes] = await Promise.all([
        fetch('/api/roles/admin/mappings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/admin/users?role=chef', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles/admin/users?role=delivery_partner', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (mRes.ok) setMappings(await mRes.json());
      if (cRes.ok) setChefs(await cRes.json());
      if (dRes.ok) setDeliveryPartners(await dRes.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const [form, setForm] = useState({ chef_id: '', delivery_partner_id: '' });

  const openNew = () => {
    setForm({ chef_id: '', delivery_partner_id: '' });
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/roles/admin/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        await fetchData();
        setShowModal(false);
      } else {
        const data = await r.json();
        alert(data.message || 'Failed to create mapping');
      }
    } catch {}
    setSaving(false);
  };

  const removeMapping = async (id: string) => {
    try {
      await fetch('/api/roles/admin/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, is_active: false }),
      });
      await fetchData();
    } catch {}
  };

  const getName = (id: string, list: UserRecord[]) => {
    const u = list.find(l => l.id === id);
    return u?.full_name || u?.email || id;
  };

  const filtered = mappings.filter(m => m.is_active);
  const totPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const unassignedChefs = chefs.filter(c => !mappings.some(m => m.chef_id === c.id && m.is_active));
  const unassignedPartners = deliveryPartners.filter(d => !mappings.some(m => m.delivery_partner_id === d.id && m.is_active));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Chef-Delivery Partner Mapping
          </h1>
          <p className="text-gray-500 text-sm mt-1">Assign delivery partners to chefs for order routing.</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-700 transition text-sm">
          <Plus className="w-4 h-4" /> Add Mapping
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <div className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-[11px] font-bold text-orange-600 uppercase">Assigned Chefs</p>
              <p className="text-2xl font-black text-gray-900">{new Set(filtered.map(m => m.chef_id)).size} / {chefs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-cyan-200 p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-cyan-500" />
            <div>
              <p className="text-[11px] font-bold text-cyan-600 uppercase">Assigned Partners</p>
              <p className="text-2xl font-black text-gray-900">{new Set(filtered.map(m => m.delivery_partner_id)).size} / {deliveryPartners.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Chef</th>
                <th className="px-5 py-3">Delivery Partner</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={3} className="py-12 text-center text-gray-400">No mappings configured.</td></tr>
              ) : paginated.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-orange-500" />
                      <span className="font-bold text-gray-900">{getName(m.chef_id, chefs)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-cyan-500" />
                      <span className="font-bold text-gray-900">{getName(m.delivery_partner_id, deliveryPartners)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => removeMapping(m.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Remove Mapping">
                      <Unlink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">{filtered.length} active mapping{filtered.length !== 1 ? 's' : ''}</p>
            {totPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs text-gray-500">{page} / {totPages}</span>
                <button onClick={() => setPage(p => Math.min(totPages, p + 1))} disabled={page === totPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Mapping Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create Mapping</h2>
                <p className="text-sm text-gray-400 mt-0.5">Assign a delivery partner to a chef</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Chef</label>
                <select required value={form.chef_id} onChange={e => setForm({ ...form, chef_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select chef...</option>
                  {chefs.map(c => (
                    <option key={c.id} value={c.id} disabled={!unassignedChefs.find(u => u.id === c.id) && mappings.some(m => m.chef_id === c.id && m.is_active)}>
                      {c.full_name || c.email} {!unassignedChefs.find(u => u.id === c.id) && mappings.some(m => m.chef_id === c.id && m.is_active) ? '(already mapped)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Partner</label>
                <select required value={form.delivery_partner_id} onChange={e => setForm({ ...form, delivery_partner_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select delivery partner...</option>
                  {deliveryPartners.map(d => (
                    <option key={d.id} value={d.id} disabled={!unassignedPartners.find(u => u.id === d.id) && mappings.some(m => m.delivery_partner_id === d.id && m.is_active)}>
                      {d.full_name || d.email} {!unassignedPartners.find(u => u.id === d.id) && mappings.some(m => m.delivery_partner_id === d.id && m.is_active) ? '(already mapped)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  {saving ? 'Creating...' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
