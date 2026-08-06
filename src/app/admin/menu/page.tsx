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
} from 'lucide-react';

type PriceUnit = 'kg' | 'piece';

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
  diet: 'veg' | 'non_veg';
  category: string;
  cookable: boolean;
  is_available: boolean;
}

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
    diet: 'veg' as 'veg' | 'non_veg',
    category: 'main',
    cookable: false,
    is_available: true,
  });

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

  const handleEditItem = (item: MenuItem) => {
    setEditingItem({
      ...item,
      price_unit: item.price_unit || 'piece',
    });

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
      const res = await fetch(
        `/api/menu/${editingItem.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editingItem.name,
            diet: editingItem.diet,
            price: Number(editingItem.price),
            price_unit:
              editingItem.price_unit || 'piece',
            is_available:
              editingItem.is_available,
          }),
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
              }
            : item
        )
      );

      setShowEditModal(false);
      setEditingItem(null);

      alert('Food item updated successfully');
    } catch (error) {
      console.error(
        'Failed to update food item:',
        error
      );

      alert(
        'Failed to update food item. Please try again.'
      );
    } finally {
      setSavingEdit(false);
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
      const res = await fetch(
        '/api/menu',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            newItem
          ),
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
    } catch (error) {
      console.error(
        'Failed to create food item:',
        error
      );

      alert(
        'Failed to create food item'
      );
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Food Item & Pricing Management
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Add new meals, update prices,
            manage food types and stock
            availability.
          </p>
        </div>

        <button
          onClick={() =>
            setShowAddModal(true)
          }
          className="px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition flex items-center space-x-2 text-sm"
        >
          <Plus className="w-4 h-4" />

          <span>
            Add New Food Item
          </span>
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />

        <input
          type="text"
          placeholder="Filter food items by name or category..."
          value={search}
          onChange={(e) => {
            setSearch(
              e.target.value
            );

            setCurrentPage(1);
          }}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">

            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">

                <th className="py-4 px-6">
                  Item Name
                </th>

                <th className="py-4 px-6">
                  Food Type
                </th>

                <th className="py-4 px-6">
                  Category
                </th>

                <th className="py-4 px-6">
                  Price
                </th>

                <th className="py-4 px-6">
                  Cookable
                </th>

                <th className="py-4 px-6">
                  Status
                </th>

                <th className="py-4 px-6 text-right">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">

              {/* LOADING */}
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-gray-400 font-medium"
                  >
                    Loading food items...
                  </td>
                </tr>

              ) : filtered.length === 0 ? (

                /* EMPTY */
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-gray-400 font-medium"
                  >
                    No food items found matching filter.
                  </td>
                </tr>

              ) : (

                /* ITEMS */
                paginatedItems.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition"
                    >

                      {/* NAME */}
                      <td className="py-4 px-6 font-bold text-gray-900">

                        {item.name}

                        <span className="block text-xs font-normal text-gray-400">
                          {item.calories || 0}{' '}
                          kcal | P:{' '}
                          {item.protein_g || 0}g
                          {' '}C:{' '}
                          {item.carbs_g || 0}g
                          {' '}F:{' '}
                          {item.fat_g || 0}g
                        </span>

                      </td>

                      {/* FOOD TYPE */}
                      <td className="py-4 px-6">

                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                            item.diet ===
                            'non_veg'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.diet ===
                          'non_veg'
                            ? '🔴 Non-Veg'
                            : '🟢 Veg'}
                        </span>

                      </td>

                      {/* CATEGORY */}
                      <td className="py-4 px-6 capitalize font-semibold text-gray-600">
                        {item.category}
                      </td>

                      {/* PRICE */}
                      <td className="py-4 px-6 font-bold text-gray-900">

                        {editingPriceId ===
                        item.id ? (

                          <div className="flex items-center gap-1">

                            <input
                              type="number"
                              step="0.5"
                              value={
                                editingPriceValue
                              }
                              onChange={(e) =>
                                setEditingPriceValue(
                                  e.target.value
                                )
                              }
                              className="w-20 px-2 py-1 bg-gray-100 border border-brand-500 rounded text-sm font-bold"
                            />

                            <button
                              onClick={() =>
                                handleSavePrice(
                                  item.id
                                )
                              }
                              className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingPriceId(
                                  null
                                );

                                setEditingPriceValue(
                                  ''
                                );
                              }}
                              className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                          </div>

                        ) : (

                          <div className="flex items-center gap-2">

                            <span>
                              ₹
                              {Number(
                                item.price
                              ).toFixed(2)}
                              {' / '}
                              {item.price_unit ===
                              'kg'
                                ? 'Kg'
                                : 'Piece'}
                            </span>

                            <button
                              onClick={() => {
                                setEditingPriceId(
                                  item.id
                                );

                                setEditingPriceValue(
                                  String(
                                    item.price
                                  )
                                );
                              }}
                              className="text-gray-400 hover:text-brand-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                          </div>

                        )}

                      </td>

                      {/* COOKABLE */}
                      <td className="py-4 px-6">

                        {item.cookable ? (

                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold bg-energy-100 text-energy-700">

                            <ChefHat className="w-3 h-3" />

                            <span>
                              Yes (+Rs.5)
                            </span>

                          </span>

                        ) : (

                          <span className="text-gray-400 text-xs">
                            No
                          </span>

                        )}

                      </td>

                      {/* STATUS */}
                      <td className="py-4 px-6">

                        <button
                          onClick={() =>
                            handleToggleStock(
                              item.id,
                              item.is_available
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center space-x-1 ${
                            item.is_available
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >

                          {item.is_available ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3" />
                          )}

                          <span>
                            {item.is_available
                              ? 'In Stock'
                              : 'Out of Stock'}
                          </span>

                        </button>

                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-6">

                        <div className="flex items-center justify-end gap-2">

                          {/* EDIT BUTTON */}
                          <button
                            onClick={() =>
                              handleEditItem(
                                item
                              )
                            }
                            title="Edit Food Item"
                            className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* DELETE BUTTON */}
                          <button
                            onClick={() =>
                              handleDeleteItem(
                                item.id
                              )
                            }
                            title="Delete Food Item"
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )

              )}

            </tbody>

          </table>
        </div>

        {/* PAGINATION */}
        {!loading &&
          filtered.length > 0 &&
          totalPages > 0 && (

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100">

              {/* ITEM COUNT */}
              <p className="text-sm text-gray-500">

                Showing{' '}

                <span className="font-semibold text-gray-700">
                  {startIndex + 1}
                </span>

                {' '}to{' '}

                <span className="font-semibold text-gray-700">
                  {Math.min(
                    endIndex,
                    filtered.length
                  )}
                </span>

                {' '}of{' '}

                <span className="font-semibold text-gray-700">
                  {filtered.length}
                </span>

                {' '}items

              </p>

              {/* CONTROLS */}
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
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
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
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>

              </div>

            </div>

          )}

      </div>

      {/* ================================================ */}
      {/* EDIT FOOD MODAL */}
      {/* ================================================ */}

      {showEditModal &&
        editingItem && (

          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">

              {/* MODAL HEADER */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">

                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Edit Food Item
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Update food information
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowEditModal(
                      false
                    );

                    setEditingItem(
                      null
                    );
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>

              </div>

              {/* EDIT FORM */}
              <form
                onSubmit={
                  handleEditSubmit
                }
                className="p-6 space-y-5"
              >

                {/* FOOD NAME */}
                <div>

                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Food Name
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      editingItem.name
                    }
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        name: e.target.value,
                      })
                    }
                    placeholder="Enter food name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                </div>

                {/* FOOD TYPE */}
                <div>

                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Food Type
                  </label>

                  <select
                    value={
                      editingItem.diet
                    }
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        diet: e.target
                          .value as
                          | 'veg'
                          | 'non_veg',
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="veg">
                      🟢 Veg
                    </option>

                    <option value="non_veg">
                      🔴 Non-Veg
                    </option>

                  </select>

                </div>

                {/* PRICE */}
                <div>

                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Price
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={
                      editingItem.price
                    }
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        price: Number(
                          e.target.value
                        ),
                      })
                    }
                    placeholder="Enter price"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                </div>

                {/* PRICE UNIT */}
                <div>

                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Price By
                  </label>

                  <div className="grid grid-cols-2 gap-3">

                    {/* PER KG */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          price_unit: 'kg',
                        })
                      }
                      className={`px-4 py-3 rounded-xl border-2 font-bold transition ${
                        editingItem.price_unit ===
                        'kg'
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Price Per Kg
                    </button>

                    {/* PER PIECE */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          price_unit:
                            'piece',
                        })
                      }
                      className={`px-4 py-3 rounded-xl border-2 font-bold transition ${
                        editingItem.price_unit ===
                        'piece'
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Price Per Piece
                    </button>

                  </div>

                </div>

                {/* STOCK STATUS */}
                <div>

                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Stock Status
                  </label>

                  <div className="grid grid-cols-2 gap-3">

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
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold transition ${
                        editingItem.is_available
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      In Stock
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
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold transition ${
                        !editingItem.is_available
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <EyeOff className="w-4 h-4" />
                      Out of Stock
                    </button>

                  </div>

                </div>

                {/* ACTION BUTTONS */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">

                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(
                        false
                      );

                      setEditingItem(
                        null
                      );
                    }}
                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      savingEdit
                    }
                    className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />

                    {savingEdit
                      ? 'Saving...'
                      : 'Save Changes'}

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

        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">

              <h2 className="text-xl font-bold text-gray-900">
                Add New Food Item
              </h2>

              <button
                onClick={() =>
                  setShowAddModal(false)
                }
                className="p-1 text-gray-400 hover:text-gray-600"
              >
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
              <div>

                <label className="block font-bold text-gray-700 mb-1">
                  Item Name
                </label>

                <input
                  type="text"
                  required
                  value={
                    newItem.name
                  }
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      name: e.target
                        .value,
                    })
                  }
                  placeholder="e.g., Chicken Breast"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                />

              </div>

              {/* DESCRIPTION */}
              <div>

                <label className="block font-bold text-gray-700 mb-1">
                  Description
                </label>

                <input
                  type="text"
                  value={
                    newItem.description
                  }
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      description:
                        e.target.value,
                    })
                  }
                  placeholder="Short summary of food dish"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                />

              </div>

              {/* CATEGORY & DIET */}
              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="block font-bold text-gray-700 mb-1">
                    Category
                  </label>

                  <select
                    value={
                      newItem.category
                    }
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        category:
                          e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="main">
                      Main Dish
                    </option>

                    <option value="side">
                      Side Dish
                    </option>

                    <option value="combo">
                      Combo
                    </option>

                  </select>

                </div>

                <div>

                  <label className="block font-bold text-gray-700 mb-1">
                    Food Type
                  </label>

                  <select
                    value={
                      newItem.diet
                    }
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        diet: e.target
                          .value as
                          | 'veg'
                          | 'non_veg',
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="veg">
                      🟢 Veg
                    </option>

                    <option value="non_veg">
                      🔴 Non-Veg
                    </option>

                  </select>

                </div>

              </div>

              {/* PRICE & PRICE UNIT */}
              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="block font-bold text-gray-700 mb-1">
                    Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={
                      newItem.price
                    }
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        price: parseFloat(
                          e.target.value
                        ),
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  />

                </div>

                <div>

                  <label className="block font-bold text-gray-700 mb-1">
                    Price By
                  </label>

                  <select
                    value={
                      newItem.price_unit
                    }
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        price_unit:
                          e.target.value as PriceUnit,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  >

                    <option value="piece">
                      Per Piece
                    </option>

                    <option value="kg">
                      Per Kg
                    </option>

                  </select>

                </div>

              </div>

              {/* CALORIES */}
              <div>

                <label className="block font-bold text-gray-700 mb-1">
                  Calories (kcal)
                </label>

                <input
                  type="number"
                  required
                  value={
                    newItem.calories
                  }
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      calories:
                        parseFloat(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                />

              </div>

              {/* STOCK */}
              <div>

                <label className="block font-bold text-gray-700 mb-2">
                  Stock Status
                </label>

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setNewItem({
                        ...newItem,
                        is_available:
                          true,
                      })
                    }
                    className={`px-4 py-2 rounded-xl border-2 font-bold ${
                      newItem.is_available
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200'
                    }`}
                  >
                    In Stock
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewItem({
                        ...newItem,
                        is_available:
                          false,
                      })
                    }
                    className={`px-4 py-2 rounded-xl border-2 font-bold ${
                      !newItem.is_available
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200'
                    }`}
                  >
                    Out of Stock
                  </button>

                </div>

              </div>

              {/* COOKABLE */}
              <div className="flex items-center space-x-3 pt-2">

                <input
                  type="checkbox"
                  id="cookableCheck"
                  checked={
                    newItem.cookable
                  }
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      cookable:
                        e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-brand-600 rounded"
                />

                <label
                  htmlFor="cookableCheck"
                  className="font-bold text-gray-700"
                >
                  Requires Cooking
                  (+Rs.5 Surcharge)
                </label>

              </div>

              {/* BUTTONS */}
              <div className="flex justify-end space-x-3 pt-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowAddModal(
                      false
                    )
                  }
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
