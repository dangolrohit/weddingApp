import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clientsApi } from '../../api/clients';
import { categoriesApi } from '../../api/categories';
import { Modal } from '../../components/Modal';
import { PasskeyModal } from '../../components/PasskeyModal';
import { SendLinkModal } from '../../components/SendLinkModal';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Camera, 
  Trash2, 
  RotateCcw, 
  Send, 
  Eye, 
  Edit3, 
  AlertCircle, 
  RefreshCw,
  HardDrive,
  Clock,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export const Clients = () => {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ count: 0, current_page: 1, total_pages: 1 });

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'trash'

  // Create Client Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedEmail, setLinkedEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [statusVal, setStatusVal] = useState('draft');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Passkey Modal State
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [generatedPasskey, setGeneratedPasskey] = useState('');
  const [passkeyClientNames, setPasskeyClientNames] = useState('');

  // Delete / Trash Confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Send Link Modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedClientForSend, setSelectedClientForSend] = useState(null);

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(data);
    } catch {
      // Non-blocking
    }
  };

  const fetchClients = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        trash: activeTab === 'trash',
        search: search.trim() || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        ordering,
      };
      const data = await clientsApi.list(params);
      setClients(data.results || []);
      setPagination({
        count: data.count || 0,
        current_page: data.current_page || 1,
        total_pages: data.total_pages || 1,
      });
    } catch {
      setError('Failed to load clients. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, selectedCategory, selectedStatus, ordering]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchClients(1);
  }, [fetchClients]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);

    try {
      const res = await clientsApi.create({
        groom_name: groomName.trim(),
        bride_name: brideName.trim(),
        event_date: eventDate || null,
        package_price: parseFloat(packagePrice) || 0.00,
        category_id: categoryId || null,
        phone: phone.trim() || null,
        linked_email: linkedEmail.trim() || null,
        notes: notes.trim() || null,
        status: statusVal,
      });

      setCreateModalOpen(false);
      // Reset form
      setGroomName('');
      setBrideName('');
      setEventDate('');
      setPackagePrice('');
      setCategoryId('');
      setPhone('');
      setLinkedEmail('');
      setNotes('');
      setStatusVal('draft');

      // Refresh list
      fetchClients(1);

      // Show the generated passkey modal
      if (res.raw_passkey) {
        setGeneratedPasskey(res.raw_passkey);
        setPasskeyClientNames(res.bride_name ? `${res.groom_name} & ${res.bride_name}` : res.groom_name);
        setPasskeyModalOpen(true);
      }
    } catch (err) {
      const msg = err.response?.data?.groom_name?.[0] ||
                  err.response?.data?.bride_name?.[0] ||
                  err.response?.data?.detail ||
                  'Failed to create client.';
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      await clientsApi.delete(clientToDelete.id);
      setDeleteModalOpen(false);
      setClientToDelete(null);
      fetchClients(pagination.current_page);
    } catch {
      alert('Failed to delete client.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (client) => {
    try {
      await clientsApi.restore(client.id);
      fetchClients(pagination.current_page);
    } catch {
      alert('Failed to restore client.');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Clients</h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage couple galleries, access passkeys, photo counts, and delivery links.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-stone-100 rounded-xl hover:bg-stone-800 text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Client</span>
        </button>
      </div>

      {/* Tabs & Search / Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Active vs Trash Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'active'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Active Galleries
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'trash'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash (30 Days)</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by groom or bride name..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-1.5 text-stone-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-amber-600"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-amber-600"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {/* Sorting Filter */}
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-amber-600"
          >
            <option value="-created_at">Newest First</option>
            <option value="created_at">Oldest First</option>
            <option value="-event_date">Event Date (Recent first)</option>
            <option value="event_date">Event Date (Earliest first)</option>
            <option value="groom_name">Name (A-Z)</option>
            <option value="-photo_count">Most Photos</option>
          </select>

          {(search || selectedCategory || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
                setSelectedStatus('');
              }}
              className="text-stone-400 hover:text-stone-600 font-medium ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchClients(1)} className="text-xs font-semibold underline">Retry</button>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-stone-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-500" />
            <p className="text-sm">Loading client galleries...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-16 text-center text-stone-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <h3 className="font-serif font-semibold text-stone-800 text-base">
              {activeTab === 'trash' ? 'Trash is empty' : 'No clients found'}
            </h3>
            <p className="text-sm text-stone-400 mt-1 mb-4">
              {activeTab === 'trash'
                ? 'Soft-deleted clients will stay here for 30 days.'
                : 'Create your first wedding client to start uploading photos.'}
            </p>
            {activeTab !== 'trash' && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-100 rounded-lg text-xs font-medium hover:bg-stone-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Client</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Client / Event</th>
                  <th className="py-3 px-6">Event Date</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Photos</th>
                  <th className="py-3 px-6">Storage</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Link</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm text-stone-700">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Couple & Cover */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200/80 overflow-hidden flex-shrink-0 flex items-center justify-center text-stone-400">
                          {c.cover_photo ? (
                            <img src={c.cover_photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-5 h-5 text-stone-300" />
                          )}
                        </div>
                        <div>
                          <Link
                            to={`/admin/clients/${c.id}`}
                            className="font-medium text-stone-900 hover:text-amber-700 transition-colors"
                          >
                            {c.bride_name ? `${c.groom_name} & ${c.bride_name}` : c.groom_name}
                          </Link>
                          <p className="text-xs text-stone-400 font-mono">
                            Added {new Date(c.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Event Date */}
                    <td className="py-4 px-6 text-xs text-stone-600 font-medium">
                      {c.event_date ? new Date(c.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-6">
                      {c.category_name ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          {c.category_name}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Unassigned</span>
                      )}
                    </td>

                    {/* Photo Count */}
                    <td className="py-4 px-6">
                      <span className="font-mono text-xs text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                        {c.photo_count || 0}
                      </span>
                    </td>

                    {/* Storage */}
                    <td className="py-4 px-6 font-mono text-xs text-stone-500">
                      {formatBytes(c.storage_bytes)}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        c.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.status === 'archived'
                          ? 'bg-stone-100 text-stone-600 border border-stone-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    {/* Link Status */}
                    <td className="py-4 px-6">
                      {c.link_status?.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : c.link_status?.status === 'expired' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Expired
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      {activeTab === 'trash' ? (
                        <button
                          onClick={() => handleRestore(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-medium transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedClientForSend(c);
                              setSendModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            title="Send Download Link"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/admin/clients/${c.id}`}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                            title="View Gallery"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => {
                              setClientToDelete(c);
                              setDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition-colors"
                            title="Move to trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.total_pages > 1 && (
              <div className="py-3 px-6 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>
                  Showing page {pagination.current_page} of {pagination.total_pages} ({pagination.count} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pagination.current_page <= 1}
                    onClick={() => fetchClients(pagination.current_page - 1)}
                    className="px-3 py-1 rounded bg-stone-100 text-stone-700 disabled:opacity-40 hover:bg-stone-200"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.current_page >= pagination.total_pages}
                    onClick={() => fetchClients(pagination.current_page + 1)}
                    className="px-3 py-1 rounded bg-stone-100 text-stone-700 disabled:opacity-40 hover:bg-stone-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Client Gallery"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Client / Event Name *
              </label>
              <input
                type="text"
                required
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
                placeholder="e.g. David & Emily, Sophia, or Acme Corp"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Partner Name (Optional)
              </label>
              <input
                type="text"
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
                placeholder="e.g. Emily Watson (leave blank for solo events)"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Event Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Package Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={packagePrice}
                onChange={(e) => setPackagePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Linked Email (Optional)
            </label>
            <input
              type="email"
              value={linkedEmail}
              onChange={(e) => setLinkedEmail(e.target.value)}
              placeholder="couple@example.com"
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Gallery Status
            </label>
            <div className="flex items-center gap-4 text-xs font-medium text-stone-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={statusVal === 'draft'}
                  onChange={() => setStatusVal('draft')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Draft (Private)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={statusVal === 'published'}
                  onChange={() => setStatusVal('published')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Published (Active for Client)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="archived"
                  checked={statusVal === 'archived'}
                  onChange={() => setStatusVal('archived')}
                  className="text-stone-600 focus:ring-stone-500"
                />
                <span>Archived</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private photographer notes..."
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="px-5 py-2 bg-stone-900 text-stone-100 rounded-lg text-xs font-medium hover:bg-stone-800 disabled:opacity-50"
            >
              {formSaving ? 'Creating...' : 'Create & Generate Passkey'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Move Client to Trash"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Are you sure you want to move <strong>{clientToDelete?.display_name || (clientToDelete?.bride_name ? `${clientToDelete?.groom_name} & ${clientToDelete?.bride_name}` : clientToDelete?.groom_name)}</strong> to the trash?
          </p>
          <p className="text-xs text-stone-400">
            The client will remain in the trash for 30 days before permanent file deletion. You can restore it anytime before then.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
            >
              {deleting ? 'Moving...' : 'Move to Trash'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Passkey Generated Modal */}
      <PasskeyModal
        isOpen={passkeyModalOpen}
        onClose={() => setPasskeyModalOpen(false)}
        passkey={generatedPasskey}
        clientNames={passkeyClientNames}
        isRegenerated={false}
      />

      {/* Send Download Link Modal */}
      <SendLinkModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        client={selectedClientForSend}
        onSuccess={fetchClients}
      />
    </div>
  );
};

