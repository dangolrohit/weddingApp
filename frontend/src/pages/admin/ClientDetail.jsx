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
import { paymentsApi } from '../../api/payments';
import { albumsApi } from '../../api/albums';
import { S3UploadModal } from '../../components/S3UploadModal';
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
  UploadCloud,
  CreditCard,
  DollarSign,
  Plus,
  Banknote,
  Smartphone,
  CloudUpload,
  FolderPlus,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Archive,
  Film,
  FileText,
  CheckCircle2,
  ChevronRight,
  DownloadCloud
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
  const [packagePrice, setPackagePrice] = useState('0.00');
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
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'showcase', 'links', 'payments'
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Send Link Modal & Link History State
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Payments Tab State
  const [paymentData, setPaymentData] = useState(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [recordPayOpen, setRecordPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payType, setPayType] = useState('advance');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');

  // Albums & Cloud Storage (Garage S3) State
  const [albums, setAlbums] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumMedia, setAlbumMedia] = useState([]);
  const [loadingAlbumMedia, setLoadingAlbumMedia] = useState(false);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [createAlbumError, setCreateAlbumError] = useState('');
  const [s3UploadOpen, setS3UploadOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentShareData, setCurrentShareData] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [deletingAlbumId, setDeletingAlbumId] = useState(null);
  const [deletingMediaId, setDeletingMediaId] = useState(null);
  const [shareInviteModalOpen, setShareInviteModalOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

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

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const data = await paymentsApi.getClientPayments(id);
      setPaymentData(data);
    } catch {
      // ignore
    } finally {
      setLoadingPayments(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab, fetchPayments]);

  const fetchAlbums = useCallback(async () => {
    setLoadingAlbums(true);
    try {
      const data = await albumsApi.listClientAlbums(id);
      setAlbums(data || []);
      if (data && data.length > 0) {
        setSelectedAlbum((prev) => {
          if (!prev) return data[0];
          const found = data.find((a) => a.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedAlbum(null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAlbums(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const handleOpenDefaultUpload = async () => {
    let target = selectedAlbum;
    if (!target && albums.length > 0) {
      target = albums[0];
      setSelectedAlbum(target);
    }
    if (!target && client) {
      try {
        const defTitle = `${client.groom_name} & ${client.bride_name} Wedding Album`;
        target = await albumsApi.createClientAlbum(id, {
          title: defTitle,
          description: `Primary wedding collection for ${client.groom_name} & ${client.bride_name}.`
        });
        await fetchAlbums();
        setSelectedAlbum(target);
      } catch (err) {
        console.error('Failed to auto-create default album:', err);
      }
    }
    setS3UploadOpen(true);
  };

  const fetchAlbumMedia = useCallback(async (albumId) => {
    if (!albumId) return;
    setLoadingAlbumMedia(true);
    try {
      const res = await albumsApi.listAlbumMedia(albumId);
      setAlbumMedia(res.results || res || []);
    } catch {
      // ignore
    } finally {
      setLoadingAlbumMedia(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAlbum?.id) {
      fetchAlbumMedia(selectedAlbum.id);
    }
  }, [selectedAlbum?.id, fetchAlbumMedia]);

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) {
      setCreateAlbumError('Please enter an album title.');
      return;
    }
    setCreatingAlbum(true);
    setCreateAlbumError('');
    try {
      const newAlb = await albumsApi.createClientAlbum(id, {
        title: newAlbumTitle.trim(),
        description: newAlbumDesc.trim()
      });
      setCreateAlbumOpen(false);
      setNewAlbumTitle('');
      setNewAlbumDesc('');
      await fetchAlbums();
      setSelectedAlbum(newAlb);
    } catch (err) {
      setCreateAlbumError(err.response?.data?.title?.[0] || 'Failed to create album.');
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handleTogglePublish = async (album) => {
    const nextStatus = album.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await albumsApi.updateAlbum(album.id, { status: nextStatus });
      setSelectedAlbum(updated);
      fetchAlbums();
    } catch {
      alert('Failed to update album status.');
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm('Are you sure you want to delete this album and its stored files from Garage S3?')) return;
    setDeletingAlbumId(albumId);
    try {
      await albumsApi.deleteAlbum(albumId);
      await fetchAlbums();
      fetchClientData();
    } catch {
      alert('Failed to delete album.');
    } finally {
      setDeletingAlbumId(null);
    }
  };

  const handleGenerateShare = async (albumId) => {
    setGeneratingShare(true);
    setShareCopied(false);
    try {
      const data = await albumsApi.generateShareLink(albumId, 30);
      setCurrentShareData(data);
      setShareModalOpen(true);
      fetchAlbums();
    } catch {
      alert('Failed to generate share link.');
    } finally {
      setGeneratingShare(false);
    }
  };

  const handleRevokeShare = async (albumId) => {
    if (!window.confirm('Are you sure you want to revoke this share link? Clients will immediately lose access.')) return;
    try {
      await albumsApi.revokeShareLink(albumId);
      alert('Share link revoked.');
      fetchAlbums();
    } catch {
      alert('Failed to revoke share link.');
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Delete this file from Garage S3 storage?')) return;
    setDeletingMediaId(mediaId);
    try {
      await albumsApi.deleteAlbumMedia(selectedAlbum.id, mediaId);
      fetchAlbumMedia(selectedAlbum.id);
      fetchAlbums();
      fetchClientData();
    } catch {
      alert('Failed to delete file.');
    } finally {
      setDeletingMediaId(null);
    }
  };

  const getClientInviteMessage = () => {
    if (!client) return '';
    const activeAlb = selectedAlbum || (albums.length > 0 ? albums[0] : null);
    const albumUrl = currentShareData?.share_url 
      ? `${window.location.origin}${currentShareData.share_url}`
      : (activeAlb?.share_token_hash ? `${window.location.origin}/album/${activeAlb.share_token_hash}` : '');
    const clientLoginUrl = `${window.location.origin}/client-login`;

    return `Dear ${client.groom_name} & ${client.bride_name}, 💍✨

Your wedding photos & videos are ready! You can view and download your full collection using your private gallery link:
${albumUrl ? `\n📸 Direct Album Link:\n${albumUrl}\n` : ''}
🔐 Website Client Portal:
URL: ${clientLoginUrl}
Couple Names: ${client.groom_name} & ${client.bride_name}
${newPasskey ? `Secret Passkey: ${newPasskey}` : 'Use your assigned Secret Passkey'}

Thank you for choosing us to capture your unforgettable day!`;
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(getClientInviteMessage());
    const cleanPhone = (client.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent(`Your Wedding Gallery is Ready - ${client.groom_name} & ${client.bride_name}`);
    const body = encodeURIComponent(getClientInviteMessage());
    window.location.href = `mailto:${client.linked_email || ''}?subject=${subject}&body=${body}`;
  };

  const handleOpenRecordPay = () => {
    setPayAmount('');
    setPayMethod('cash');
    setPayType('advance');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayNotes('');
    setPayError('');
    setRecordPayOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(payAmount);
    if (!numAmount || numAmount <= 0) {
      setPayError('Please enter a valid payment amount greater than zero.');
      return;
    }
    setPaySaving(true);
    setPayError('');
    try {
      await paymentsApi.create({
        client: id,
        amount: numAmount.toFixed(2),
        method: payMethod,
        payment_type: payType,
        payment_date: payDate,
        reference_no: payRef.trim() || null,
        notes: payNotes.trim() || null,
      });
      setRecordPayOpen(false);
      fetchPayments();
      fetchClientData();
    } catch (err) {
      setPayError(err.response?.data?.amount?.[0] || 'Failed to record payment.');
    } finally {
      setPaySaving(false);
    }
  };

  const handleDeletePayment = async (payId) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await paymentsApi.delete(payId);
      fetchPayments();
      fetchClientData();
    } catch {
      alert('Failed to delete payment.');
    }
  };

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
    setPackagePrice(client.package_price || '0.00');
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
        package_price: parseFloat(packagePrice) || 0.00,
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
              onClick={() => setShareInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Invite / WhatsApp</span>
            </button>

            <button
              onClick={() => setSendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Email Link</span>
            </button>

            <button
              onClick={handleOpenDefaultUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-amber-200" />
              <span>Upload Photos (Garage S3)</span>
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
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'payments'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payments & Billing</span>
        </button>
        <button
          onClick={() => setActiveTab('albums')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'albums'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <CloudUpload className="w-3.5 h-3.5" />
          <span>Cloud Albums & S3 ({albums.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          {/* Default Garage S3 Direct Upload Banner */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 rounded-2xl p-6 text-white border border-stone-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20 flex-shrink-0">
                <CloudUpload className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
                    Default Storage: Garage S3
                  </span>
                  <span className="text-xs text-stone-400">• Multi-disk SSD</span>
                </div>
                <h3 className="text-base font-bold text-stone-100">
                  {selectedAlbum ? `Direct Upload to: ${selectedAlbum.title}` : 'Direct High-Speed Cloud Upload'}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5 max-w-xl">
                  Files upload directly from your browser to the Ubuntu storage server via short-lived signed requests. Large 10–30 GB collections, 4K videos, and ZIP archives never pass through the website backend.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleOpenDefaultUpload}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <CloudUpload className="w-4 h-4" />
                <span>Upload Photos & Videos</span>
              </button>
            </div>
          </div>

          {/* Garage S3 Media Grid (Default Storage Items) */}
          {albumMedia.filter((m) => !m.is_archive).length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
                <div>
                  <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-amber-600" />
                    <span>Garage S3 Media Items ({albumMedia.filter((m) => !m.is_archive).length})</span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Original files stored securely on Ubuntu Garage S3 object storage
                  </p>
                </div>
                <button
                  onClick={handleOpenDefaultUpload}
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {albumMedia.filter((m) => !m.is_archive).map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200 shadow-xs"
                  >
                    {item.preview_url ? (
                      <img
                        src={item.preview_url}
                        alt={item.original_filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-stone-400">
                        {item.media_type === 'video' ? (
                          <Film className="w-6 h-6 text-amber-600 mb-1" />
                        ) : (
                          <FileText className="w-6 h-6 mb-1" />
                        )}
                        <span className="text-[10px] text-stone-600 truncate max-w-full px-1">
                          {item.original_filename}
                        </span>
                      </div>
                    )}

                    {/* Hover controls */}
                    <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 text-white">
                      <span className="text-[10px] font-mono truncate mr-1">
                        {formatBytes(item.byte_size)}
                      </span>
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        disabled={deletingMediaId === item.id}
                        className="p-1 rounded bg-stone-800/80 hover:bg-rose-600 text-stone-200 hover:text-white transition-colors"
                        title="Delete media from Garage S3"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy Showcase Photos (if any exist) */}
          {photos.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
                <h3 className="font-semibold text-stone-900 text-sm">
                  Showcase / Portfolio Photos ({photos.length})
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
          )}

          {/* Empty state when neither S3 nor legacy photos exist */}
          {albumMedia.filter((m) => !m.is_archive).length === 0 && photos.length === 0 && (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-stone-200 p-8">
              <CloudUpload className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-stone-700">No Photos or Videos Uploaded Yet</h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto mt-1 mb-5">
                Upload your client's wedding photos, 4K highlight videos, or prepared ZIP archives directly to your private Garage S3 storage server.
              </p>
              <button
                onClick={handleOpenDefaultUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <CloudUpload className="w-4 h-4" />
                <span>Upload First Collection</span>
              </button>
            </div>
          )}
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

      {/* Payments Tab Panel */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Contract Package</span>
              <p className="text-xl font-serif font-bold text-stone-900 mt-1">
                ${Number(paymentData?.package_price ?? client.package_price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Total Paid</span>
              <p className="text-xl font-serif font-bold text-emerald-700 mt-1">
                ${Number(paymentData?.total_paid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Remaining Balance</span>
              <p className="text-xl font-serif font-bold text-rose-600 mt-1">
                ${Number(paymentData?.pending_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Status</span>
                <div className="mt-1">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    paymentData?.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : paymentData?.payment_status === 'partial'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {paymentData?.payment_status || 'unpaid'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payments Table Header */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-4 border-b border-stone-100">
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">Payment Receipts & History</h3>
                <p className="text-xs text-stone-400 mt-0.5">Record advance booking deposit, milestones, and cash/online payments.</p>
              </div>
              <button
                onClick={handleOpenRecordPay}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-medium transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            </div>

            {loadingPayments ? (
              <div className="py-12 text-center text-xs text-stone-400">Loading payments...</div>
            ) : !paymentData?.payments?.length ? (
              <div className="py-12 text-center text-stone-500 text-xs space-y-2">
                <CreditCard className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p>No payments recorded for this client yet.</p>
                <button
                  onClick={handleOpenRecordPay}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-medium cursor-pointer"
                >
                  Record First Payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-600">
                  <thead className="bg-stone-50 border-b border-stone-100 uppercase tracking-wider text-[11px] text-stone-400 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Reference / Txn</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paymentData.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">{p.payment_date}</td>
                        <td className="py-3 px-4 font-bold text-stone-900 font-serif">
                          ${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            p.method === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {p.method_display || p.method}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700">
                            {p.payment_type_display || p.payment_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-500">
                          {p.reference_no || '—'}
                        </td>
                        <td className="py-3 px-4 text-stone-500 max-w-xs truncate">
                          {p.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                            title="Delete payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Albums & Cloud Storage (Garage S3) Tab Panel */}
      {activeTab === 'albums' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold tracking-wider uppercase mb-1">
                <CloudUpload className="w-4 h-4" />
                <span>Garage S3 Direct Storage</span>
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                Wedding Albums & High-Capacity Storage
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Upload 10–30 GB high-resolution collections directly from browser to Ubuntu storage server.
              </p>
            </div>
            <button
              onClick={() => {
                setNewAlbumTitle('');
                setNewAlbumDesc('');
                setCreateAlbumError('');
                setCreateAlbumOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create New Album</span>
            </button>
          </div>

          {loadingAlbums ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400 bg-white rounded-2xl border border-stone-200/80">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs font-medium">Loading albums...</p>
            </div>
          ) : albums.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-stone-200">
              <CloudUpload className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-stone-700">No Wedding Albums Created</h4>
              <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1 mb-5">
                Create an album to start uploading 10–30 GB high-res photo/video collections directly to Garage S3.
              </p>
              <button
                onClick={() => setCreateAlbumOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Album</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Albums List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 px-1">
                  Client Albums ({albums.length})
                </h4>
                {albums.map((alb) => {
                  const isSelected = selectedAlbum?.id === alb.id;
                  return (
                    <div
                      key={alb.id}
                      onClick={() => setSelectedAlbum(alb)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/60 border-amber-300 shadow-sm ring-1 ring-amber-300'
                          : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h5 className="font-semibold text-sm text-stone-900 truncate">
                          {alb.title}
                        </h5>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            alb.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {alb.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-500">
                        <span>{alb.ready_media_count} files</span>
                        <span>•</span>
                        <span>{formatBytes(alb.total_bytes)}</span>
                        {alb.archive_count > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-medium">
                              {alb.archive_count} ZIP part{alb.archive_count > 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>

                      {alb.is_share_active && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Share link active</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Selected Album Details & Content */}
              {selectedAlbum && (
                <div className="lg:col-span-2 space-y-6">
                  {/* Selected Album Control Header */}
                  <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-stone-900">
                            {selectedAlbum.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              selectedAlbum.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {selectedAlbum.status}
                          </span>
                        </div>
                        {selectedAlbum.description && (
                          <p className="text-xs text-stone-500 mt-1">
                            {selectedAlbum.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Publish/Draft Toggle */}
                        <button
                          onClick={() => handleTogglePublish(selectedAlbum)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                            selectedAlbum.status === 'published'
                              ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-300'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600'
                          }`}
                        >
                          {selectedAlbum.status === 'published' ? 'Switch to Draft' : 'Publish Album'}
                        </button>

                        {/* Direct S3 Upload Button */}
                        <button
                          onClick={() => setS3UploadOpen(true)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>Direct S3 Upload</span>
                        </button>

                        {/* Share Link Button */}
                        <button
                          onClick={() => handleGenerateShare(selectedAlbum.id)}
                          disabled={generatingShare}
                          className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{selectedAlbum.is_share_active ? 'Share Link' : 'Generate Link'}</span>
                        </button>

                        {/* Delete Album */}
                        <button
                          onClick={() => handleDeleteAlbum(selectedAlbum.id)}
                          disabled={deletingAlbumId === selectedAlbum.id}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete album and all S3 objects"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-4 pt-4 text-center">
                      <div className="bg-stone-50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-stone-500 tracking-wider">Total Media</span>
                        <p className="text-base font-bold text-stone-900 mt-0.5">{selectedAlbum.ready_media_count}</p>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-stone-500 tracking-wider">Storage Used</span>
                        <p className="text-base font-bold text-stone-900 mt-0.5 font-mono">{formatBytes(selectedAlbum.total_bytes)}</p>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase text-stone-500 tracking-wider">Prepared ZIPs</span>
                        <p className="text-base font-bold text-stone-900 mt-0.5">{selectedAlbum.archive_count}</p>
                      </div>
                    </div>

                    {/* Active Share Link Banner if published */}
                    {selectedAlbum.is_share_active && (
                      <div className="mt-4 p-3 bg-emerald-50/80 border border-emerald-200/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Client gallery is live and accessible via private token link.</span>
                        </div>
                        <button
                          onClick={() => handleRevokeShare(selectedAlbum.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline cursor-pointer"
                        >
                          Revoke Access
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Prepared ZIP Archives (Download All Parts) Subsection */}
                  {albumMedia.filter((m) => m.is_archive).length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
                        <Archive className="w-4 h-4" />
                        <span>Prepared ZIP Archives ("Download All" Parts)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {albumMedia.filter((m) => m.is_archive).map((arch) => (
                          <div
                            key={arch.id}
                            className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Archive className="w-5 h-5 text-amber-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-stone-800 truncate">
                                  {arch.original_filename}
                                </p>
                                <p className="text-[10px] text-stone-500 font-mono">
                                  {formatBytes(arch.byte_size)}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteMedia(arch.id)}
                              disabled={deletingMediaId === arch.id}
                              className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                              title="Delete archive from S3"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Media Items Gallery Subsection */}
                  <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <h4 className="text-sm font-bold text-stone-900">
                        Album Media Items ({albumMedia.filter((m) => !m.is_archive).length})
                      </h4>
                      <button
                        onClick={() => fetchAlbumMedia(selectedAlbum.id)}
                        className="p-1 text-stone-400 hover:text-stone-700 transition-colors"
                        title="Refresh media"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {loadingAlbumMedia ? (
                      <div className="py-12 text-center text-stone-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-2" />
                        <p className="text-xs">Loading media items...</p>
                      </div>
                    ) : albumMedia.filter((m) => !m.is_archive).length === 0 ? (
                      <div className="py-12 text-center border border-dashed border-stone-200 rounded-xl text-stone-400">
                        <Camera className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                        <p className="text-xs">No media items uploaded to this album yet.</p>
                        <button
                          onClick={() => setS3UploadOpen(true)}
                          className="mt-3 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
                        >
                          Start S3 Upload
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {albumMedia.filter((m) => !m.is_archive).map((item) => (
                          <div
                            key={item.id}
                            className="group relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200 shadow-xs"
                          >
                            {item.preview_url ? (
                              <img
                                src={item.preview_url}
                                alt={item.original_filename}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-stone-400">
                                {item.media_type === 'video' ? (
                                  <Film className="w-6 h-6 text-amber-600 mb-1" />
                                ) : (
                                  <FileText className="w-6 h-6 mb-1" />
                                )}
                                <span className="text-[10px] text-stone-600 truncate max-w-full px-1">
                                  {item.original_filename}
                                </span>
                              </div>
                            )}

                            {/* Hover bar */}
                            <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 text-white">
                              <span className="text-[10px] font-mono truncate mr-1">
                                {formatBytes(item.byte_size)}
                              </span>
                              <button
                                onClick={() => handleDeleteMedia(item.id)}
                                disabled={deletingMediaId === item.id}
                                className="p-1 rounded bg-stone-800/80 hover:bg-rose-600 text-stone-200 hover:text-white transition-colors"
                                title="Delete media from Garage S3"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                Package Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={packagePrice}
                onChange={(e) => setPackagePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
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

      {/* Record Payment Modal for this client */}
      <Modal
        isOpen={recordPayOpen}
        onClose={() => setRecordPayOpen(false)}
        title={`Record Payment for ${client.groom_name} & ${client.bride_name}`}
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          {payError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{payError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Amount ($) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Method *
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="cash">Cash</option>
                <option value="online">Online / Wire Transfer</option>
                <option value="upi">UPI / QR Code</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Stage *
              </label>
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="advance">Advance / Booking Deposit</option>
                <option value="partial">Partial Payment / Milestone</option>
                <option value="installment">Installment</option>
                <option value="final">Final Settlement</option>
                <option value="full">Full Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Reference / Txn ID
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-9982, Cheque 0014, Receipt #3"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Payment remarks..."
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setRecordPayOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paySaving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl text-xs transition-colors disabled:opacity-50"
            >
              {paySaving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Album Modal */}
      <Modal
        isOpen={createAlbumOpen}
        onClose={() => setCreateAlbumOpen(false)}
        title="Create Wedding Album"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateAlbum} className="space-y-4">
          {createAlbumError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createAlbumError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Album Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Wedding Day & Reception"
              value={newAlbumTitle}
              onChange={(e) => setNewAlbumTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Private notes or client greeting message..."
              value={newAlbumDesc}
              onChange={(e) => setNewAlbumDesc(e.target.value)}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCreateAlbumOpen(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingAlbum}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {creatingAlbum ? 'Creating...' : 'Create Album'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Album Share Link Generated"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-600 leading-relaxed">
            This private link contains a high-entropy share token. Anyone with this link can view previews and download high-resolution photos and ZIP archives directly from Garage S3.
          </p>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2">
            <code className="text-xs text-amber-700 font-mono truncate select-all">
              {window.location.origin}{currentShareData?.share_url}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${currentShareData?.share_url}`);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 3000);
              }}
              className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-medium rounded-lg flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              {shareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
            <span>Link active for 30 days</span>
            {currentShareData?.share_url && (
              <a
                href={currentShareData.share_url}
                target="_blank"
                rel="noreferrer"
                className="text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
              >
                <span>Open Gallery in New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShareModalOpen(false)}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Share Invite & WhatsApp Template Modal */}
      <Modal
        isOpen={shareInviteModalOpen}
        onClose={() => setShareInviteModalOpen(false)}
        title="Share Gallery Invite with Client"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-600 leading-relaxed">
            Send this pre-formatted invitation message to <strong>{client?.groom_name} & {client?.bride_name}</strong> via WhatsApp, SMS, or Email. They can open their private gallery in 1 click or log in at <code>/client-login</code> with their secret passkey.
          </p>

          {/* Quick Details Chips */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-stone-500">Couple Names</span>
              <p className="font-semibold text-stone-900 mt-0.5">{client?.groom_name} & {client?.bride_name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-stone-500">Client Login Passkey</span>
              <p className="font-mono font-semibold text-amber-700 mt-0.5">{newPasskey || '(Saved on client profile)'}</p>
            </div>
          </div>

          {/* Pre-formatted Message Textarea */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Ready-to-Send Message Preview
            </label>
            <textarea
              readOnly
              rows={8}
              value={getClientInviteMessage()}
              className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono leading-relaxed select-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Action Buttons: Copy, WhatsApp, Email */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
            <button
              onClick={() => {
                navigator.clipboard.writeText(getClientInviteMessage());
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 3000);
              }}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Message</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEmail}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Email</span>
              </button>

              <button
                onClick={handleOpenWhatsApp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Send via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* S3 Direct Browser Upload Modal (Uppy + Garage) */}
      {selectedAlbum && (
        <S3UploadModal
          isOpen={s3UploadOpen}
          onClose={() => setS3UploadOpen(false)}
          albumId={selectedAlbum.id}
          albumTitle={selectedAlbum.title}
          onUploadComplete={() => {
            fetchAlbumMedia(selectedAlbum.id);
            fetchAlbums();
            fetchClientData();
          }}
        />
      )}
    </div>
  );
};
