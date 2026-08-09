'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, X, Save, ChevronLeft, ChevronRight, UserPlus,
  Shield, UserCog, UserCheck, ChefHat, Truck, Phone, Mail, ToggleLeft, ToggleRight, Key
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', icon: Shield },
  // { value: 'admin', label: 'Admin', icon: UserCog },
  { value: 'sales', label: 'Sales', icon: UserCheck },
  { value: 'verifier', label: 'Verifier', icon: Shield },
  { value: 'chef', label: 'Chef', icon: ChefHat },
  { value: 'delivery_partner', label: 'Delivery Partner', icon: Truck },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin: 'bg-emerald-100 text-emerald-700',
  sales: 'bg-blue-100 text-blue-700',
  verifier: 'bg-purple-100 text-purple-700',
  chef: 'bg-orange-100 text-orange-700',
  delivery_partner: 'bg-cyan-100 text-cyan-700',
};

export default function ManageUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fuelbox_token') : '';

  const defaultForm = { email: '', password: '', role: 'sales', full_name: '', phone: '' };
  const [form, setForm] = useState(defaultForm);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/roles/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setUsers(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openNew = () => {
    setForm(defaultForm);
    setEditUser(null);
    setShowModal(true);
  };

  const openEdit = (u: UserRecord) => {
    setForm({ email: u.email, password: '', role: u.role, full_name: u.full_name || '', phone: u.phone || '' });
    setEditUser(u);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { id: editUser.id, ...form };
        if (!payload.password) delete payload.password;
        const r = await fetch('/api/roles/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          await fetchUsers();
          setShowModal(false);
        }
      } else {
        const r = await fetch('/api/roles/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        if (r.ok) {
          await fetchUsers();
          setShowModal(false);
        } else {
          const data = await r.json();
          alert(data.message || 'Failed to create user');
        }
      }
    } catch {}
    setSaving(false);
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await fetch('/api/roles/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, is_active: !is_active }),
      });
      await fetchUsers();
    } catch {}
  };

  const filtered = users.filter(u => {
    const ms = u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const rs = !roleFilter || u.role === roleFilter;
    return ms && rs;
  });

  const totPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return counts;
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Role Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage users with different roles.</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-700 transition text-sm">
          <UserPlus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {ROLES.map(r => {
          const count = roleCounts[r.value] || 0;
          const Icon = r.icon;
          return (
            <div key={r.value} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <Icon className="w-5 h-5 mx-auto text-gray-500" />
              <p className="text-xs font-bold text-gray-700 mt-1">{r.label}</p>
              <p className="text-lg font-black text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="text" placeholder="Search by name or email..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="text-xs text-gray-400 flex items-center justify-end font-medium">
            {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Name / Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No users found.</td></tr>
              ) : paginated.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900">{u.full_name || 'Unnamed'}</div>
                    <div className="text-[11px] text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-600">{u.phone || '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-1 text-[10px] font-bold rounded-lg ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                      {ROLES.find(r => r.value === u.role)?.label || u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition ${
                        u.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-50'
                      }`}>
                      {u.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => openEdit(u)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editUser ? 'Edit User' : 'Create New User'}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {editUser ? 'Update user details and role' : 'Assign role and access permissions'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role *</label>
                <select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {editUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input type="password" {...(editUser ? {} : { required: true })} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
