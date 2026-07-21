'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, ChefHat, Eye, EyeOff, Save } from 'lucide-react';

export default function AdminMenuPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | number | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: 25,
    calories: 150,
    protein_g: 15,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 3,
    diet: 'veg',
    category: 'main',
    cookable: false,
    is_available: true,
  });

  const loadMenu = () => {
    setLoading(true);
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleSavePrice = async (id: string | number) => {
    const numericPrice = parseFloat(editingPriceValue);
    if (isNaN(numericPrice)) return;

    try {
      await fetch(`/api/menu/${id}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: numericPrice }),
      });
      setItems(items.map((item) => (item.id === id ? { ...item, price: numericPrice } : item)));
      setEditingPriceId(null);
    } catch {
      alert('Failed to update price');
    }
  };

  const handleToggleStock = async (id: string | number, currentStatus: boolean) => {
    try {
      await fetch(`/api/menu/${id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentStatus }),
      });
      setItems(items.map((item) => (item.id === id ? { ...item, is_available: !currentStatus } : item)));
    } catch {
      alert('Failed to update stock status');
    }
  };

  const handleDeleteItem = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      const created = await res.json();
      setItems([...items, created]);
      setShowAddModal(false);
    } catch {
      alert('Failed to create food item');
    }
  };

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Food Item & Pricing Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Add new meals, update prices inline, edit categories, and toggle item availability.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition flex items-center space-x-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Food Item</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Filter food items by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6">Item Name</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Diet</th>
                <th className="py-4 px-6">Cookable</th>
                <th className="py-4 px-6">Price (₹)</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    Loading food items...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    No food items found matching filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {item.name}
                      <span className="block text-xs font-normal text-gray-400">
                        {item.calories} kcal | P: {item.protein_g}g C: {item.carbs_g}g F: {item.fat_g}g
                      </span>
                    </td>
                    <td className="py-4 px-6 capitalize font-semibold text-gray-600">
                      {item.category}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          item.diet === 'non_veg'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.diet === 'non_veg' ? '🔴 Non-Veg' : '🟢 Veg'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {item.cookable ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold bg-energy-100 text-energy-700">
                          <ChefHat className="w-3 h-3" />
                          <span>Yes (+Rs.5)</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {editingPriceId === item.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.5"
                            value={editingPriceValue}
                            onChange={(e) => setEditingPriceValue(e.target.value)}
                            className="w-20 px-2 py-1 bg-gray-100 border border-brand-500 rounded text-sm font-bold"
                          />
                          <button
                            onClick={() => handleSavePrice(item.id)}
                            className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span>₹{Number(item.price).toFixed(2)}</span>
                          <button
                            onClick={() => {
                              setEditingPriceId(item.id);
                              setEditingPriceValue(String(item.price));
                            }}
                            className="text-gray-400 hover:text-brand-600"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStock(item.id, item.is_available)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center space-x-1 ${
                          item.is_available
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {item.is_available ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xl font-bold text-gray-900">Add New Food Item</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g., Grilled Salmon"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Short summary of food dish"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="main">Main Dish</option>
                    <option value="side">Side Dish</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Diet</label>
                  <select
                    value={newItem.diet}
                    onChange={(e) => setNewItem({ ...newItem, diet: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="veg">🟢 Veg</option>
                    <option value="non_veg">🔴 Non-Veg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    required
                    value={newItem.calories}
                    onChange={(e) => setNewItem({ ...newItem, calories: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="cookableCheck"
                  checked={newItem.cookable}
                  onChange={(e) => setNewItem({ ...newItem, cookable: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <label htmlFor="cookableCheck" className="font-bold text-gray-700">
                  Requires Cooking (+Rs.5 Surcharge)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow"
                >
                  Save Food Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
