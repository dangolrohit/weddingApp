import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { clientsApi } from '../../api/clients';
import { categoriesApi } from '../../api/categories';
import { Modal } from '../../components/Modal';
import { PasskeyModal } from '../../components/PasskeyModal';
import { 
  ArrowLeft, 
  Calendar, 
  Tag, 
  HardDrive, 
  Key, 
  Mail, 
  Phone, 
  Send, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  RefreshCw,
  Camera,
  Star,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Passkey Modal State
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [newPasskey, setNewPasskey] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedEmail, setLinkedEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [statusVal, setStatusVal] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'showcase', 'links'

  const fetchClientData = async () => {
    setLoading(true);
    setError('');
    try {
      const [clientData, catData] = await Promise.all([
        clientsApi.get(id),
        categoriesApi.list(),
      ]);
      setClient(clientData);
      setCategories(catData);
    } catch {
      setError('Failed to load client details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const handleOpenEdit = () => {
    if (!client) return;
    setGroomName(client.groom_name);
    setBrideName(client.bride_name);
    setEventDate(client.event_date || '');
    setCategoryId(client.category?.id || '');
    setPhone(client.phone || '');
    setLinkedEmail(client.linked_email || '');
    setNotes(client.notes || '');
    setStatusVal(client.status);
    setEditError('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setSaving(true);
    try {
      const updated = await clientsApi.update(client.id, {
        groom_name: groomName.trim(),
        bride_name: brideName.trim(),
        event_date: eventDate || null,
        category_id: categoryId || null,
        phone: phone.trim() || null,
        linked_email: linkedEmail.trim() || null,
        notes: notes.trim() || null,
        status: statusVal,
      });
      setClient(updated);
      setEditModalOpen(false);
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update client.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegeneratePasskey = async () => {
    if (!window.confirm('Are you sure you want to regenerate the passkey? The previous passkey will stop working immediately.')) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await clientsApi.regeneratePasskey(client.id);
      setNewPasskey(res.raw_passkey);
      setPasskeyModalOpen(true);
    } catch {
      alert('Failed to regenerate passkey.');
    } finally {
      setRegenerating(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-stone-500" />
        <p className="text-sm">Loading client gallery...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to clients
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error || 'Client not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          to="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Clients</span>
        </Link>
      </div>

      {/* Main Client Info Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                client.status === 'published'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : client.status === 'archived'
                  ? 'bg-stone-100 text-stone-600 border border-stone-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {client.status}
              </span>
              {client.category?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                  <Tag className="w-3 h-3" />
                  {client.category.name}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">
              {client.groom_name} & {client.bride_name}
            </h1>

            <p className="text-xs text-stone-400 font-mono mt-1">
              Normalized Matching Key: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">{client.name_key}</code>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRegeneratePasskey}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>{regenerating ? 'Regenerating...' : 'Regenerate Passkey'}</span>
            </button>

            <button
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100">
            <span className="text-stone-400 uppercase tracking-wider font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Event Date
            </span>
            <p className="font-semibold text-stone-800 text-sm mt-1">
              {client.event_date ? new Date(client.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100">
            <span className="text-stone-400 uppercase tracking-wider font-medium flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> Total Photos
            </span>
            <p className="font-semibold text-stone-800 text-sm mt-1">
              {client.photo_count || 0}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100">
            <span className="text-stone-400 uppercase tracking-wider font-medium flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" /> Storage Used
            </span>
            <p className="font-semibold text-stone-800 text-sm mt-1 font-mono">
              {formatBytes(client.storage_bytes)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100">
            <span className="text-stone-400 uppercase tracking-wider font-medium flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Linked Email
            </span>
            <p className="font-semibold text-stone-800 text-sm mt-1 truncate" title={client.linked_email || 'None'}>
              {client.linked_email || 'Not saved yet'}
            </p>
          </div>
        </div>

        {client.notes && (
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-stone-600">
            <span className="font-semibold text-amber-900 block mb-0.5">Photographer Notes:</span>
            {client.notes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('photos')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors cursor-pointer ${
            activeTab === 'photos'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          Photo Gallery ({client.photo_count || 0})
        </button>
        <button
          onClick={() => setActiveTab('showcase')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'showcase'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          <span>Showcase Picker (Max 3)</span>
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'links'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Delivery History</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'photos' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center shadow-sm">
          <Camera className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-stone-800 text-base">Photo Upload Pipeline</h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-4">
            Drag-and-drop multi-file uploader with progress tracking and Celery variant generation scheduled for Phase 3.
          </p>
        </div>
      )}

      {activeTab === 'showcase' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center shadow-sm">
          <Star className="w-12 h-12 text-amber-400/60 mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-stone-800 text-base">Public Showcase Picker</h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-4">
            Select up to 3 watermarked photos for the public portfolio. Scheduled for Phase 4.
          </p>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center shadow-sm">
          <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-stone-800 text-base">Delivery Link History</h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-4">
            Logs of sent 7-day download links, download counts, and revocation status scheduled for Phase 6.
          </p>
        </div>
      )}

      {/* Edit Client Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Client Gallery"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Groom Name *
              </label>
              <input
                type="text"
                required
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Bride Name *
              </label>
              <input
                type="text"
                required
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
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
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Linked Email
              </label>
              <input
                type="email"
                value={linkedEmail}
                onChange={(e) => setLinkedEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Status
            </label>
            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
            >
              <option value="draft">Draft (Private)</option>
              <option value="published">Published (Accessible for Client)</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-stone-100 rounded-lg text-xs font-medium hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Passkey Modal */}
      <PasskeyModal
        isOpen={passkeyModalOpen}
        onClose={() => setPasskeyModalOpen(false)}
        passkey={newPasskey}
        clientNames={`${client.groom_name} & ${client.bride_name}`}
        isRegenerated={true}
      />
    </div>
  );
};
