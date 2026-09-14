'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ChefHat,
  Eye,
  EyeOff,
  Save,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

type PriceUnit = 'kg' | 'piece';

type DietType = 'veg' | 'egg' | 'non_veg';

interface MenuItem {
  id: string | number;
  name: string;
  description?: string;
  price: number;
  price_unit?: PriceUnit;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  diet: DietType;
  category: string;
  cookable: boolean;
  is_available: boolean;
  image_url?: string | null;
}

const getDietConfig = (diet: string) => {
  const d = diet?.toLowerCase();
  if (d === 'egg') return { label: '🥚 Egg', classes: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (d === 'non_veg') return { label: '🔴 Non-Veg', classes: 'bg-red-100 text-red-700 border border-red-200' };
  return { label: '🟢 Veg', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
};

const normalizeImageUrlForStorage = (url?: string | null): string | null => {
  if (!url) return null;
  let p = url.trim();
  // Strip absolute origin (http://localhost:3000, https://localhost:3000, https://<prod-host>, etc.)
  // Do not store https://localhost... — store only relative pathname
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const u = new URL(p);
      // Only strip if pathname looks like an app asset (/images/* or /uploads/*) or localhost host
      // For external CDNs, keep as-is (not relevant for menu, but safe)
      const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.pathname.startsWith('/images/') || u.pathname.startsWith('/uploads/');
      if (isLocal) {
        p = u.pathname;
      } else {
        return p; // keep external absolute URL
      }
    } catch {
      // if URL parsing fails, keep as-is and try next normalization
    }
  }
  // Ensure leading slash for relative paths
  if (p && !p.startsWith('/') && !p.startsWith('data:') && !p.startsWith('blob:')) {
    p = `/${p}`;
  }
  // If bare filename like "paneer.jpg" without folder, it will be "/paneer.jpg" -> normalize to "/images/paneer.jpg"
  if (p && /^\/[^/]+\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(p) && !p.startsWith('/images/') && !p.startsWith('/uploads/')) {
    p = `/images${p}`;
  }
  return p;
};

const getDisplayImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const normalized = normalizeImageUrlForStorage(url);
  if (!normalized) return null;
  // If normalized is already an absolute path (/images/... or /uploads/...) return it
  if (normalized.startsWith('/images/') || normalized.startsWith('/uploads/') || normalized.startsWith('/')) return normalized;
  return `/images/${normalized.replace(/^\//, '')}`;
};

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline Price Editing
  const [editingPriceId, setEditingPriceId] = useState<
    string | number | null
  >(null);

  const [editingPriceValue, setEditingPriceValue] =
    useState<string>('');

  // Add Form
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: 25,
    price_unit: 'piece' as PriceUnit,
    calories: 150,
    protein_g: 15,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 3,
    diet: 'veg' as DietType,
    category: 'main',
    cookable: false,
    is_available: true,
  });

  // Image upload states - Add
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  // Image upload states - Edit
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // --------------------------------------------------
  // LOAD MENU
  // --------------------------------------------------

  const loadMenu = () => {
    setLoading(true);

    fetch('/api/menu')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load menu');
        }

        return res.json();
      })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load menu:', error);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------

  const filtered = items.filter(
    (item) =>
      item.name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (item.category &&
        item.category
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const totalPages = Math.ceil(
    filtered.length / itemsPerPage
  );

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const endIndex =
    startIndex + itemsPerPage;

  const paginatedItems = filtered.slice(
    startIndex,
    endIndex
  );

  // --------------------------------------------------
  // OPEN EDIT MODAL
  // --------------------------------------------------

  // --------------------------------------------------
  // IMAGE HELPERS
  // --------------------------------------------------
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to upload image');
    }
    const data = await res.json();
    // Ensure we never store absolute https://localhost:3000... — normalize to relative
    const normalized = normalizeImageUrlForStorage(data.url as string);
    return (normalized as string) || (data.url as string);
  };

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max 5MB allowed');
      return;
    }
    if (newImagePreview && newImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(newImagePreview);
    }
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max 5MB allowed');
      return;
    }
    if (editImagePreview && editImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  };

  const clearNewImage = () => {
    if (newImagePreview && newImagePreview.startsWith('blob:')) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
  };

  const clearEditImage = () => {
    if (editImagePreview && editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
    setEditImageFile(null);
    // revert preview to original image
    if (editingItem?.image_url) {
      setEditImagePreview(getDisplayImageUrl(editingItem.image_url));
    } else {
      setEditImagePreview(null);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem({
      ...item,
      price_unit: item.price_unit || 'piece',
      calories: item.calories ?? 0,
      protein_g: item.protein_g ?? 0,
      carbs_g: item.carbs_g ?? 0,
      fat_g: item.fat_g ?? 0,
      fiber_g: item.fiber_g ?? 0,
    });
    setEditImageFile(null);
    setEditImagePreview(getDisplayImageUrl(item.image_url));
    setShowEditModal(true);
  };

  // --------------------------------------------------
  // SAVE EDIT ITEM
  // --------------------------------------------------

  const handleEditSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!editingItem) return;

    setSavingEdit(true);

    try {
      let imageUrl: string | undefined = undefined;
      if (editImageFile) {
        setUploading(true);
        imageUrl = await uploadImage(editImageFile);
        setUploading(false);
      }

      const payload: Record<string, unknown> = {
        name: editingItem.name,
        diet: editingItem.diet,
        price: Number(editingItem.price),
        price_unit:
          editingItem.price_unit || 'piece',
        is_available:
          editingItem.is_available,
        calories: Number(editingItem.calories) || 0,
        protein_g: Number(editingItem.protein_g) || 0,
        carbs_g: Number(editingItem.carbs_g) || 0,
        fat_g: Number(editingItem.fat_g) || 0,
        fiber_g: Number(editingItem.fiber_g) || 0,
      };
      // Only include image_url if a new image was uploaded - keeps existing if unchanged
      // Normalize to relative path so DB never stores https://localhost:3000...
      if (imageUrl) {
        payload.image_url = normalizeImageUrlForStorage(imageUrl) || imageUrl;
      }

      const res = await fetch(
        `/api/menu/${editingItem.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error(
          'Failed to update food item'
        );
      }

      const updatedItem = await res.json();

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...updatedItem,
                name: editingItem.name,
                diet: editingItem.diet,
                price: Number(
                  editingItem.price
                ),
                price_unit:
                  editingItem.price_unit ||
                  'piece',
                is_available:
                  editingItem.is_available,
                calories: Number(editingItem.calories) || 0,
                protein_g: Number(editingItem.protein_g) || 0,
                carbs_g: Number(editingItem.carbs_g) || 0,
                fat_g: Number(editingItem.fat_g) || 0,
                fiber_g: Number(editingItem.fiber_g) || 0,
                image_url: imageUrl || item.image_url || updatedItem.image_url,
              }
            : item
        )
      );

      if (editImagePreview && editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
      setEditImageFile(null);
      setEditImagePreview(null);
      setShowEditModal(false);
      setEditingItem(null);

      alert('Food item updated successfully');
    } catch (error) {
      console.error(
        'Failed to update food item:',
        error
      );

      alert(
        error instanceof Error ? error.message : 'Failed to update food item. Please try again.'
      );
    } finally {
      setSavingEdit(false);
      setUploading(false);
    }
  };

  // --------------------------------------------------
  // INLINE PRICE UPDATE
  // --------------------------------------------------

  const handleSavePrice = async (
    id: string | number
  ) => {
    const numericPrice = parseFloat(
      editingPriceValue
    );

    if (isNaN(numericPrice)) return;

    try {
      const res = await fetch(
        `/api/menu/${id}/price`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price: numericPrice,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          'Failed to update price'
        );
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id
            ? {
                ...item,
                price: numericPrice,
              }
            : item
        )
      );

      setEditingPriceId(null);
      setEditingPriceValue('');
    } catch (error) {
      console.error(
        'Failed to update price:',
        error
      );

      alert('Failed to update price');
    }
  };

  // --------------------------------------------------
  // TOGGLE STOCK
  // --------------------------------------------------

  const handleToggleStock = async (
    id: string | number,
    currentStatus: boolean
  ) => {
    try {
      const res = await fetch(
        `/api/menu/${id}/availability`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_available: !currentStatus,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          'Failed to update stock status'
        );
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id
            ? {
                ...item,
                is_available:
                  !currentStatus,
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        'Failed to update stock:',
        error
      );

      alert(
        'Failed to update stock status'
      );
    }
  };

  // --------------------------------------------------
  // DELETE ITEM
  // --------------------------------------------------

  const handleDeleteItem = async (
    id: string | number
  ) => {
    if (
      !confirm(
        'Are you sure you want to delete this food item?'
      )
    ) {
      return;
    }

    try {
      // If you have a DELETE API, use this:
      //
      // const res = await fetch(`/api/menu/${id}`, {
      //   method: 'DELETE',
      // });
      //
      // if (!res.ok) {
      //   throw new Error('Failed to delete item');
      // }

      setItems((prevItems) =>
        prevItems.filter(
          (item) => item.id !== id
        )
      );

      // Keep pagination valid
      const remainingItems =
        filtered.length - 1;

      const newTotalPages = Math.max(
        1,
        Math.ceil(
          remainingItems / itemsPerPage
        )
      );

      if (
        currentPage > newTotalPages
      ) {
        setCurrentPage(
          newTotalPages
        );
      }
    } catch (error) {
      console.error(
        'Failed to delete item:',
        error
      );

      alert(
        'Failed to delete food item'
      );
    }
  };

  // --------------------------------------------------
  // CREATE NEW ITEM
  // --------------------------------------------------

  const handleCreateSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setUploading(true);
      let imageUrl: string | undefined = undefined;
      if (newImageFile) {
        imageUrl = await uploadImage(newImageFile);
      }

      const normalizedUrl = imageUrl ? normalizeImageUrlForStorage(imageUrl) || imageUrl : undefined;
      const payload = {
        ...newItem,
        ...(normalizedUrl ? { image_url: normalizedUrl } : {}),
      };

      const res = await fetch(
        '/api/menu',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error(
          'Failed to create item'
        );
      }

      const created =
        await res.json();

      setItems((prevItems) => [
        ...prevItems,
        created,
      ]);

      setShowAddModal(false);

      setCurrentPage(1);

      // Reset form
      setNewItem({
        name: '',
        description: '',
        price: 25,
        price_unit: 'piece',
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
      if (newImagePreview && newImagePreview.startsWith('blob:')) URL.revokeObjectURL(newImagePreview);
      setNewImageFile(null);
      setNewImagePreview(null);
    } catch (error) {
      console.error(
        'Failed to create food item:',
        error
      );

      alert(
        error instanceof Error ? error.message : 'Failed to create food item'
      );
    } finally {
      setUploading(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-hidden">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight break-words">
            Food Item & Pricing Management
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed">
            Add new meals, update prices, manage food types and stock availability.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto shrink-0 px-5 py-3 sm:py-2.5 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 active:scale-[0.98] transition flex items-center justify-center gap-2 text-sm min-h-[44px]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add New Food Item</span>
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative w-full sm:max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter food items by name or category..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-9 pr-4 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
        />
      </div>

      {/* DESKTOP TABLE - hidden on mobile, visible on lg+ */}
      <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6">Image</th>
                <th className="py-4 px-6">Item Name</th>
                <th className="py-4 px-6">Food Type</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Fiber (g)</th>
                <th className="py-4 px-6">Fat (g)</th>
                <th className="py-4 px-6">Carbs (g)</th>
                <th className="py-4 px-6">Protein (g)</th>
                <th className="py-4 px-6">Price</th>
                <th className="py-4 px-6">Cookable</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400 font-medium">
                    Loading food items...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400 font-medium">
                    No food items found matching filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-6">
                      {getDisplayImageUrl(item.image_url) ? (
                        <img
                          src={getDisplayImageUrl(item.image_url) as string}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-sm"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      <span className="block truncate max-w-[180px] xl:max-w-[220px]">{item.name}</span>
                      <span className="block text-xs font-normal text-gray-400 mt-0.5">
                        {item.calories || 0} kcal | P: {item.protein_g || 0}g C: {item.carbs_g || 0}g F: {item.fat_g || 0}g Fiber: {item.fiber_g || 0}g
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {(() => { const cfg = getDietConfig(item.diet); return <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold border ${cfg.classes}`}>{cfg.label}</span>; })()}
                    </td>
                    <td className="py-4 px-6 capitalize font-semibold text-gray-600">{item.category}</td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{item.fiber_g ?? 0}g</td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{item.fat_g ?? 0}g</td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{item.carbs_g ?? 0}g</td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{item.protein_g ?? 0}g</td>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {editingPriceId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" step="0.5" value={editingPriceValue} onChange={(e) => setEditingPriceValue(e.target.value)} className="w-20 px-2 py-1 bg-gray-100 border border-brand-500 rounded text-sm font-bold focus:outline-none focus:ring-1 focus:ring-brand-500" />
                          <button onClick={() => handleSavePrice(item.id)} className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700 transition">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setEditingPriceId(null); setEditingPriceValue(''); }} className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>₹{Number(item.price).toFixed(2)} / {item.price_unit === 'kg' ? 'Kg' : 'Piece'}</span>
                          <button onClick={() => { setEditingPriceId(item.id); setEditingPriceValue(String(item.price)); }} className="text-gray-400 hover:text-brand-600 transition p-1">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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
                    <td className="py-4 px-6">
                      <button onClick={() => handleToggleStock(item.id, item.is_available)} className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center space-x-1 ${item.is_available ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                        {item.is_available ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditItem(item)} title="Edit Food Item" className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} title="Delete Food Item" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARDS - visible on mobile, hidden on lg+ */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="inline-flex items-center gap-2 text-gray-400 font-medium text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
              Loading food items...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 font-medium text-sm">
            No food items found matching filter.
          </div>
        ) : (
          paginatedItems.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 transition hover:shadow-md">
              {/* Header: Image + Name + Diet badge */}
              <div className="flex items-start gap-3">
                {getDisplayImageUrl(item.image_url) ? (
                  <img
                    src={getDisplayImageUrl(item.image_url) as string}
                    alt={item.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-[15px] leading-tight break-words">{item.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 capitalize flex flex-wrap items-center gap-1.5">
                    <span className="truncate">{item.category}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                    <span className="shrink-0">{item.calories || 0} kcal</span>
                    {item.cookable && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-energy-700 bg-energy-50 px-1.5 py-0.5 rounded shrink-0">
                          <ChefHat className="w-3 h-3" />
                          Cookable +Rs.5
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {(() => { const cfg = getDietConfig(item.diet); return <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.classes}`}>{cfg.label}</span>; })()}
              </div>

              {/* Nutrition grid - 2 columns, compact */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fiber</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{item.fiber_g ?? 0}<span className="text-xs font-medium text-gray-500"> g</span></p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fat</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{item.fat_g ?? 0}<span className="text-xs font-medium text-gray-500"> g</span></p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Carbs</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{item.carbs_g ?? 0}<span className="text-xs font-medium text-gray-500"> g</span></p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Protein</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{item.protein_g ?? 0}<span className="text-xs font-medium text-gray-500"> g</span></p>
                </div>
              </div>

              {/* Price + Status row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {editingPriceId === item.id ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input type="number" step="0.5" value={editingPriceValue} onChange={(e) => setEditingPriceValue(e.target.value)} className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 border border-brand-500 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Price" />
                      <button onClick={() => handleSavePrice(item.id)} className="shrink-0 p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingPriceId(null); setEditingPriceValue(''); }} className="shrink-0 p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-gray-900 text-sm shrink-0">₹{Number(item.price).toFixed(2)}<span className="text-gray-500 font-medium text-xs"> / {item.price_unit === 'kg' ? 'Kg' : 'Piece'}</span></span>
                      <button onClick={() => { setEditingPriceId(item.id); setEditingPriceValue(String(item.price)); }} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Edit price">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                <button onClick={() => handleToggleStock(item.id, item.is_available)} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition min-h-[36px] ${item.is_available ? 'bg-emerald-100 text-emerald-700 active:bg-emerald-200' : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}>
                  {item.is_available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => handleEditItem(item)} className="inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-600 text-white font-bold text-sm min-h-[44px] active:scale-[0.98] hover:bg-brand-700 transition shadow-sm">
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={() => handleDeleteItem(item.id)} className="inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white border border-red-200 text-red-600 font-bold text-sm min-h-[44px] active:scale-[0.98] hover:bg-red-50 transition">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PAGINATION - shared, responsive */}
      {!loading && filtered.length > 0 && totalPages > 0 && (
        <div className="bg-white lg:bg-white rounded-2xl border border-gray-100 shadow-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500 text-center sm:text-left">
            Showing <span className="font-semibold text-gray-700">{startIndex + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(endIndex, filtered.length)}</span> of <span className="font-semibold text-gray-700">{filtered.length}</span> items
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px]">
              Previous
            </button>
            <div className="flex items-center gap-1 flex-wrap justify-center max-w-[200px] sm:max-w-none">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-9 h-9 sm:w-9 sm:h-9 rounded-xl text-sm font-semibold transition min-w-[36px] min-h-[36px] ${currentPage === page ? 'bg-brand-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  {page}
                </button>
              ))}
            </div>
            <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px]">
              Next
            </button>
          </div>
        </div>
      )}


      {/* ================================================ */}
      {/* EDIT FOOD MODAL */}
      {/* ================================================ */}

      {showEditModal &&
        editingItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain my-auto">

              {/* MODAL HEADER */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-3xl z-10">
                <div className="min-w-0 pr-3">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Edit Food Item</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">Update food information</p>
                </div>
                <button
                  onClick={() => {
                    if (editImagePreview && editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
                    setEditImageFile(null);
                    setEditImagePreview(null);
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="shrink-0 p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* EDIT FORM */}
              <form onSubmit={handleEditSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">

                {/* FOOD NAME */}
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Food Name</label>
                  <input type="text" required value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value, })} placeholder="Enter food name" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder:text-gray-400" />
                </div>

                {/* FOOD TYPE */}
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Food Type</label>
                  <select value={editingItem.diet} onChange={(e) => setEditingItem({ ...editingItem, diet: e.target.value as DietType, })} className="w-full min-w-0 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm">
                    <option value="veg">🟢 Veg</option>
                    <option value="egg">🥚 Egg</option>
                    <option value="non_veg">🔴 Non-Veg</option>
                  </select>
                </div>

                {/* FOOD IMAGE - Edit with preview, show current and allow replace */}
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Food Image</label>
                  {/* Current / Preview */}
                  {editImagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-2 mb-3">
                      <img src={editImagePreview} alt="Preview" className="w-full h-40 sm:h-48 object-contain rounded-lg bg-white" />
                      {editImageFile && (
                        <button
                          type="button"
                          onClick={clearEditImage}
                          className="absolute top-3 right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow"
                          title="Remove new image and revert to original"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1.5 text-center truncate px-2">
                        {editImageFile ? `${editImageFile.name} (new)` : 'Current image - select a new file below to replace'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center mb-3">
                      <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No image. Upload one below.</p>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageChange}
                      className="block w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-700 file:transition file:cursor-pointer cursor-pointer bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 file:min-h-[36px]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">If no new image is selected, the existing image will be kept.</p>
                </div>

                {/* PRICE */}
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Price</label>
                  <input type="number" min="0" step="0.01" required value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value), })} placeholder="Enter price" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                </div>

                {/* PRICE UNIT */}
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Price By</label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button type="button" onClick={() => setEditingItem({ ...editingItem, price_unit: 'kg', })} className={`px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${editingItem.price_unit === 'kg' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-50'}`}>
                      Price Per Kg
                    </button>
                    <button type="button" onClick={() => setEditingItem({ ...editingItem, price_unit: 'piece', })} className={`px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${editingItem.price_unit === 'piece' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-50'}`}>
                      Price Per Piece
                    </button>
                  </div>
                </div>

                {/* NUTRITION FIELDS - Grouped section */}
                <div className="rounded-2xl bg-gray-50/70 border border-gray-100 p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-brand-600 rounded-full shrink-0" />
                    <h3 className="text-sm font-bold text-gray-900">Nutrition Information</h3>
                    <span className="text-xs text-gray-500 ml-auto hidden sm:inline">per serving</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Calories (kcal)</label>
                      <input type="number" min="0" step="0.1" value={editingItem.calories ?? 0} onChange={(e) => setEditingItem({ ...editingItem, calories: parseFloat(e.target.value) || 0, })} className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Protein (g)</label>
                      <input type="number" min="0" step="0.1" value={editingItem.protein_g ?? 0} onChange={(e) => setEditingItem({ ...editingItem, protein_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 15" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Carbs (g)</label>
                      <input type="number" min="0" step="0.1" value={editingItem.carbs_g ?? 0} onChange={(e) => setEditingItem({ ...editingItem, carbs_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 20" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Fat (g)</label>
                      <input type="number" min="0" step="0.1" value={editingItem.fat_g ?? 0} onChange={(e) => setEditingItem({ ...editingItem, fat_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 5" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400" />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Fiber (g)</label>
                      <input type="number" min="0" step="0.1" value={editingItem.fiber_g ?? 0} onChange={(e) => setEditingItem({ ...editingItem, fiber_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 3" className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* STOCK STATUS */}
                <div>

                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
                    Stock Status
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">

                    {/* IN STOCK */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          is_available:
                            true,
                        })
                      }
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${editingItem.is_available ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-50'}`}
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span className="truncate">In Stock</span>
                    </button>

                    {/* OUT OF STOCK */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          is_available:
                            false,
                        })
                      }
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${!editingItem.is_available ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-50'}`}
                    >
                      <EyeOff className="w-4 h-4 shrink-0" />
                      <span className="truncate">Out of Stock</span>
                    </button>

                  </div>

                </div>

                {/* ACTION BUTTONS - stack on mobile */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100">

                  <button type="button" onClick={() => { if (editImagePreview && editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview); setEditImageFile(null); setEditImagePreview(null); setShowEditModal(false); setEditingItem(null); }} className="w-full sm:w-auto px-5 py-3.5 sm:py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 active:bg-gray-200 transition text-sm min-h-[44px]">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingEdit || uploading} className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm min-h-[44px] shadow-sm transition">
                    <Save className="w-4 h-4 shrink-0" />
                    {savingEdit || uploading ? (uploading ? 'Uploading...' : 'Saving...') : 'Save Changes'}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

      {/* ================================================ */}
      {/* ADD FOOD MODAL */}
      {/* ================================================ */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain my-auto">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 sticky top-0 bg-white z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-4 sm:pt-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Add New Food Item</h2>
              <button onClick={() => { if (newImagePreview && newImagePreview.startsWith('blob:')) URL.revokeObjectURL(newImagePreview); setNewImageFile(null); setNewImagePreview(null); setShowAddModal(false); }} className="shrink-0 p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                handleCreateSubmit
              }
              className="space-y-4 text-sm"
            >

              {/* NAME */}
              <div className="min-w-0">
                <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Item Name</label>
                <input type="text" required value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value, })} placeholder="e.g., Chicken Breast" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {/* DESCRIPTION */}
              <div className="min-w-0">
                <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Description</label>
                <input type="text" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value, })} placeholder="Short summary of food dish" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              {/* FOOD IMAGE - Add with preview */}
              <div className="min-w-0">
                <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Food Image</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewImageChange}
                    className="block w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-700 file:transition file:cursor-pointer cursor-pointer bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 file:min-h-[36px]"
                  />
                </div>
                {newImagePreview ? (
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-2">
                    <img src={newImagePreview} alt="Preview" className="w-full h-40 sm:h-48 object-contain rounded-lg bg-white" />
                    <button
                      type="button"
                      onClick={clearNewImage}
                      className="absolute top-3 right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-[11px] text-gray-500 mt-1.5 text-center truncate px-2">{newImageFile?.name}</p>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <ImageIcon className="w-4 h-4 shrink-0" />
                    <span>No image selected. Preview will appear here.</span>
                  </div>
                )}
              </div>

              {/* CATEGORY & DIET */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Category</label>
                  <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value, })} className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="main">Main Dish</option>
                    <option value="side">Side Dish</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Food Type</label>
                  <select value={newItem.diet} onChange={(e) => setNewItem({ ...newItem, diet: e.target.value as DietType, })} className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="veg">🟢 Veg</option>
                    <option value="egg">🥚 Egg</option>
                    <option value="non_veg">🔴 Non-Veg</option>
                  </select>
                </div>
              </div>

              {/* PRICE & PRICE UNIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Price (₹)</label>
                  <input type="number" min="0" step="0.5" required value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0, })} className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Price By</label>
                  <select value={newItem.price_unit} onChange={(e) => setNewItem({ ...newItem, price_unit: e.target.value as PriceUnit, })} className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="piece">Per Piece</option>
                    <option value="kg">Per Kg</option>
                  </select>
                </div>
              </div>

              {/* CALORIES */}
              <div className="min-w-0">
                <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Calories (kcal)</label>
                <input type="number" required value={newItem.calories} onChange={(e) => setNewItem({ ...newItem, calories: parseFloat(e.target.value) || 0, })} className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              {/* NUTRITION - Fiber, Fat, Carbs, Protein - grouped, responsive */}
              <div className="rounded-xl bg-gray-50/70 border border-gray-100 p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-brand-600 rounded-full shrink-0" />
                  <h3 className="text-sm font-bold text-gray-900">Nutrition Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Protein (g)</label>
                  <input type="number" min="0" step="0.1" required value={newItem.protein_g} onChange={(e) => setNewItem({ ...newItem, protein_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 15" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Carbs (g)</label>
                  <input type="number" min="0" step="0.1" required value={newItem.carbs_g} onChange={(e) => setNewItem({ ...newItem, carbs_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 20" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Fat (g)</label>
                  <input type="number" min="0" step="0.1" required value={newItem.fat_g} onChange={(e) => setNewItem({ ...newItem, fat_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 5" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="min-w-0">
                  <label className="block font-bold text-gray-700 mb-1 text-xs sm:text-sm">Fiber (g)</label>
                  <input type="number" min="0" step="0.1" required value={newItem.fiber_g} onChange={(e) => setNewItem({ ...newItem, fiber_g: parseFloat(e.target.value) || 0, })} placeholder="e.g., 3" className="w-full min-w-0 px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              </div>

              {/* STOCK */}
              <div>
                <label className="block font-bold text-gray-700 mb-2 text-xs sm:text-sm">Stock Status</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button type="button" onClick={() => setNewItem({ ...newItem, is_available: true, })} className={`px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${newItem.is_available ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                    In Stock
                  </button>
                  <button type="button" onClick={() => setNewItem({ ...newItem, is_available: false, })} className={`px-2 sm:px-4 py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition min-h-[44px] ${!newItem.is_available ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Out of Stock
                  </button>
                </div>
              </div>

              {/* COOKABLE */}
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="cookableCheck" checked={newItem.cookable} onChange={(e) => setNewItem({ ...newItem, cookable: e.target.checked, })} className="w-4 h-4 text-brand-600 rounded shrink-0" />
                <label htmlFor="cookableCheck" className="font-bold text-gray-700 text-xs sm:text-sm leading-tight">Requires Cooking (+Rs.5 Surcharge)</label>
              </div>

              {/* BUTTONS - stack on mobile */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { if (newImagePreview && newImagePreview.startsWith('blob:')) URL.revokeObjectURL(newImagePreview); setNewImageFile(null); setNewImagePreview(null); setShowAddModal(false); }} className="w-full sm:w-auto px-4 py-3.5 sm:py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 text-sm min-h-[44px] transition">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="w-full sm:w-auto px-6 py-3.5 sm:py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow text-sm min-h-[44px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</> : 'Save Food Item'}
                </button>
              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}
