import React, { useState, useEffect, useMemo } from 'react';
import { equipmentApi } from '../../api/equipment';
import { Modal } from '../../components/Modal';
import { 
  Camera, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  DollarSign, 
  Tag, 
  Clock, 
  Package, 
  Aperture, 
  Mic, 
  Zap, 
  Navigation, 
  HardDrive, 
  Cpu
} from 'lucide-react';

const CATEGORY_ICONS = {
  camera: Camera,
  lens: Aperture,
  lighting: Zap,
  audio: Mic,
  drone: Navigation,
  stabilizer: Cpu,
  storage: HardDrive,
  accessory: Package,
  other: Tag,
};

export const Equipment = () => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('camera');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0.00');
  const [status, setStatus] = useState('available');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [listData, summaryData] = await Promise.all([
        equipmentApi.list({ page_size: 100 }),
        equipmentApi.summary(),
      ]);
      const items = Array.isArray(listData) ? listData : (listData.results || []);
      setEquipmentList(items);
      setSummary(summaryData);
    } catch {
      setError('Failed to load equipment list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('camera');
    setBrand('');
    setModelNumber('');
    setSerialNumber('');
    setPurchaseDate('');
    setPurchasePrice('0.00');
    setStatus('available');
    setAssignedTo('');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setName(item.name || '');
    setCategory(item.category || 'camera');
    setBrand(item.brand || '');
    setModelNumber(item.model_number || '');
    setSerialNumber(item.serial_number || '');
    setPurchaseDate(item.purchase_date || '');
    setPurchasePrice(item.purchase_price || '0.00');
    setStatus(item.status || 'available');
    setAssignedTo(item.assigned_to || '');
    setNotes(item.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveEquipment = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter equipment name.');
      return;
    }

    setFormSaving(true);
    setFormError('');

    const payload = {
      name: name.trim(),
      category,
      brand: brand.trim() || null,
      model_number: modelNumber.trim() || null,
      serial_number: serialNumber.trim() || null,
      purchase_date: purchaseDate || null,
      purchase_price: parseFloat(purchasePrice) || 0.00,
      status,
      assigned_to: assignedTo.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (editingItem) {
        await equipmentApi.update(editingItem.id, payload);
      } else {
        await equipmentApi.create(payload);
      }
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to save equipment.';
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await equipmentApi.delete(itemToDelete.id);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      await fetchData();
    } catch {
      alert('Failed to delete equipment.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered equipment
  const filteredList = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [equipmentList, searchTerm, selectedCategory, selectedStatus]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    equipmentList.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [equipmentList]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">Equipment Inventory</h1>
          <p className="text-stone-500 text-sm mt-1">
            Keep a record of your cameras, lenses, lighting gear, audio equipment, and accessories.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Equipment
        </button>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Gear</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-stone-900 font-serif">
              {summary.total_count}
            </div>
            <div className="text-xs text-stone-500 mt-1">Registered equipment items</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Inventory Value</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-stone-900 font-serif">
              ${Number(summary.total_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1">Estimated asset cost</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Available / Ready</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-teal-700 font-serif">
              {summary.available_count}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Ready for upcoming shoots
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">In Maintenance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-600 font-serif">
              {summary.maintenance_count}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Needs servicing or repair
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by gear name, brand, model, or serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Categories ({equipmentList.length})</option>
            <option value="camera">Camera Bodies ({categoryCounts.camera || 0})</option>
            <option value="lens">Lenses ({categoryCounts.lens || 0})</option>
            <option value="lighting">Lighting & Flash ({categoryCounts.lighting || 0})</option>
            <option value="audio">Audio & Mic ({categoryCounts.audio || 0})</option>
            <option value="drone">Drones ({categoryCounts.drone || 0})</option>
            <option value="stabilizer">Gimbals & Tripods ({categoryCounts.stabilizer || 0})</option>
            <option value="storage">Memory & Drives ({categoryCounts.storage || 0})</option>
            <option value="accessory">Accessories ({categoryCounts.accessory || 0})</option>
            <option value="other">Other Gear ({categoryCounts.other || 0})</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available / Ready</option>
            <option value="in_use">In Use / On Shoot</option>
            <option value="maintenance">In Maintenance</option>
            <option value="retired">Retired / Backup</option>
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Equipment Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-stone-400 text-sm">
            Loading equipment...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-3">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-semibold text-stone-900 text-base">No equipment items found</h3>
            <p className="text-stone-500 text-xs mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Click "Add Equipment" to add your cameras, lenses, lighting, and other gear.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-4">Gear / Item</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Serial #</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Purchase Cost</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredList.map((item) => {
                  const CatIcon = CATEGORY_ICONS[item.category] || Camera;
                  const isAvailable = item.status === 'available';
                  const isInUse = item.status === 'in_use';
                  const isMaint = item.status === 'maintenance';

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center flex-shrink-0">
                            <CatIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-stone-900">{item.name}</div>
                            {(item.brand || item.model_number) && (
                              <div className="text-xs text-stone-400">
                                {[item.brand, item.model_number].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-stone-600 text-xs whitespace-nowrap">
                        {item.category_display || item.category}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-stone-600 whitespace-nowrap">
                        {item.serial_number || <span className="text-stone-300 font-sans">—</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isInUse
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              : isMaint
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              : 'bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          {item.status_display || item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600 whitespace-nowrap">
                        {item.assigned_to || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-800 font-serif text-xs whitespace-nowrap">
                        {parseFloat(item.purchase_price) > 0 ? (
                          `$${Number(item.purchase_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-stone-300 font-sans font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-500 max-w-xs truncate" title={item.notes}>
                        {item.notes || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                            title="Edit equipment"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(item)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete equipment"
                          >
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
        )}
      </div>

      {/* Add / Edit Equipment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Equipment' : 'Add Equipment to Inventory'}
      >
        <form onSubmit={handleSaveEquipment} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sony Alpha A7 IV Body #1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="camera">Camera Body</option>
                <option value="lens">Lens</option>
                <option value="lighting">Lighting & Flash</option>
                <option value="audio">Audio & Mic</option>
                <option value="drone">Drone / Aerial</option>
                <option value="stabilizer">Gimbal / Tripod / Rig</option>
                <option value="storage">Memory Card / Drive</option>
                <option value="accessory">Battery / Filter / Bag</option>
                <option value="other">Other Gear</option>
              </select>
            </div>
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                placeholder="e.g. Sony, Canon, DJI, Godox"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Model Number
              </label>
              <input
                type="text"
                placeholder="e.g. ILCE-7M4, 70-200mm GM II"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Serial Number & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Serial Number
              </label>
              <input
                type="text"
                placeholder="e.g. SN-8924017"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="available">Available / Ready</option>
                <option value="in_use">In Use / On Shoot</option>
                <option value="maintenance">In Maintenance / Repair</option>
                <option value="retired">Retired / Backup</option>
              </select>
            </div>
          </div>

          {/* Purchase Date & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Purchase Price / Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Assigned To <span className="text-stone-400 font-normal">(Photographer / Crew)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Lead Photographer, Videographer A, Studio Kit"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Notes / Condition <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Firmware version, cosmetic condition, accessories included, known quirks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {formSaving ? 'Saving...' : editingItem ? 'Update Equipment' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Equipment Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Are you sure you want to delete <strong className="text-stone-900">{itemToDelete?.name}</strong> from your equipment inventory?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            This action cannot be undone. All recorded history for this item will be removed.
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Equipment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
