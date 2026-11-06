import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientsApi } from '../../api/clients';
import { categoriesApi } from '../../api/categories';
import { photosApi } from '../../api/photos';
import { Modal } from '../../components/Modal';
import { PasskeyModal } from '../../components/PasskeyModal';
import { UploadDropzone } from '../../components/UploadDropzone';
import { PhotoGrid } from '../../components/PhotoGrid';
import { Lightbox } from '../../components/Lightbox';
import { ShowcasePicker } from '../../components/ShowcasePicker';
import { SendLinkModal } from '../../components/SendLinkModal';
import { deliveryApi } from '../../api/delivery';
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
  UploadCloud
} from 'lucide-react';

export const ClientDetail = () => {
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
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

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'showcase', 'links'
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Send Link Modal & Link History State
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const fetchClientData = useCallback(async () => {
    try {
      const [clientData, catData, photoData] = await Promise.all([
        clientsApi.get(id),
        categoriesApi.list(),
        photosApi.list(id),
      ]);
      setClient(clientData);
      setCategories(catData);
      setPhotos(photoData);
    } catch {
      setError('Failed to load client details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const data = await deliveryApi.adminGetClientLinks(id);
      setLinks(data || []);
    } catch {
      // ignore
    } finally {
      setLoadingLinks(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'links') {
      fetchLinks();
    }
  }, [activeTab, fetchLinks]);

  const handleRevokeLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to revoke this download link immediately?')) return;
    try {
      await deliveryApi.adminRevokeLink(linkId);
      fetchLinks();
    } catch {
      alert('Failed to revoke download link.');
    }
  };

  // If any photo is in 'processing' status, poll status every 4 seconds
  useEffect(() => {
    const hasProcessing = photos.some((p) => p.status === 'processing');
    if (!hasProcessing) return;

    const timer = setInterval(async () => {
      try {
        const updatedPhotos = await photosApi.list(id);
        setPhotos(updatedPhotos);
        // Refresh client storage/counts
        const updatedClient = await clientsApi.get(id);
        setClient(updatedClient);
      } catch {
        // Silently retry next tick
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [photos, id]);

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

  const handleToggleHide = async (photo) => {
    try {
      const updated = await photosApi.update(photo.id, { is_hidden: !photo.is_hidden });
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? updated : p)));
    } catch {
      alert('Failed to update photo visibility.');
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(`Delete photo "${photo.original_filename}"? This removes it permanently from disk.`)) {
      return;
    }
    try {
      await photosApi.delete(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      // Refresh client stats
      const updatedClient = await clientsApi.get(id);
      setClient(updatedClient);
    } catch {
      alert('Failed to delete photo.');
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

      {/* Main Client Info Banner */}
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
              onClick={() => setSendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Link</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-stone-100 text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span>Upload Photos</span>
            </button>

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
              {photos.length}
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
          Photo Gallery ({photos.length})
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
        <div className="space-y-6">
          <UploadDropzone
            clientId={client.id}
            onUploadComplete={fetchClientData}
          />

          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
              <h3 className="font-semibold text-stone-900 text-sm">
                Gallery Photos ({photos.length})
              </h3>
              <span className="text-xs text-stone-400">
                Click any photo to preview in lightbox
              </span>
            </div>

            <PhotoGrid
              photos={photos}
              onPhotoClick={(index) => setLightboxIndex(index)}
              onToggleHide={handleToggleHide}
              onDeletePhoto={handleDeletePhoto}
            />
          </div>
        </div>
      )}

      {activeTab === 'showcase' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 sm:p-8 shadow-sm">
          <ShowcasePicker
            clientId={client.id}
            photos={photos}
            onShowcaseUpdated={fetchClientData}
          />
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-base">Delivery Link History</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Multi-part uncompressed ZIP links dispatched to this client.
              </p>
            </div>
            <button
              onClick={() => setSendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send New Link</span>
            </button>
          </div>

          {loadingLinks ? (
            <div className="py-16 text-center text-stone-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-400" />
              <span>Loading delivery logs...</span>
            </div>
          ) : links.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-xs space-y-3">
              <Clock className="w-10 h-10 text-stone-300 mx-auto" />
              <p>No delivery links have been dispatched to this client yet.</p>
              <button
                onClick={() => setSendModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-medium cursor-pointer"
              >
                Send First Link
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 border-b border-stone-100 uppercase tracking-wider text-[11px] text-stone-400 font-semibold">
                  <tr>
                    <th className="py-3 px-6">Recipient Email</th>
                    <th className="py-3 px-6">Created</th>
                    <th className="py-3 px-6">Expires</th>
                    <th className="py-3 px-6">Downloads</th>
                    <th className="py-3 px-6">Dispatched By</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {links.map((link) => (
                    <tr key={link.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-4 px-6 font-medium text-stone-900 font-mono">
                        {link.email}
                      </td>
                      <td className="py-4 px-6 text-stone-500">
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-stone-500 font-mono">
                        {new Date(link.expires_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 font-mono">
                        {link.download_count} / {link.max_downloads}
                      </td>
                      <td className="py-4 px-6 text-stone-500">
                        {link.created_by_name}
                      </td>
                      <td className="py-4 px-6">
                        {link.revoked_at ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Revoked
                          </span>
                        ) : !link.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600">
                            Expired
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {link.is_active && (
                          <button
                            onClick={() => handleRevokeLink(link.id)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Viewer */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIndex) => setLightboxIndex(newIndex)}
        />
      )}

      {/* Upload Modal (Triggered by Upload button) */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Client Photos"
        maxWidth="max-w-2xl"
      >
        <UploadDropzone
          clientId={client.id}
          onUploadComplete={fetchClientData}
        />
      </Modal>

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
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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

      {/* Send Download Link Modal */}
      <SendLinkModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        client={client}
        onSuccess={() => {
          fetchClientData();
          fetchLinks();
        }}
      />
    </div>
  );
};
