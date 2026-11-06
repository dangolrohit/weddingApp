import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  Heart, 
  Calendar, 
  Camera, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ArrowRight, 
  RefreshCw,
  LogOut,
  Maximize2,
  Clock,
  DownloadCloud
} from 'lucide-react';
import { deliveryApi } from '../../api/delivery';
import { Lightbox } from '../../components/Lightbox';

export const GetMyImage = () => {
  // Session State
  const [sessionToken, setSessionToken] = useState(() => {
    return sessionStorage.getItem('client_session_token') || '';
  });
  const [clientData, setClientData] = useState(() => {
    try {
      const stored = sessionStorage.getItem('client_session_data');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Verification Form State
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [passkey, setPasskey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Gallery Photos State
  const [photos, setPhotos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Link Request State
  const [recipientEmail, setRecipientEmail] = useState('');
  const [requestingLink, setRequestingLink] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');
  const [linkError, setLinkError] = useState('');

  // Logout / Clear Session
  const handleLogout = () => {
    sessionStorage.removeItem('client_session_token');
    sessionStorage.removeItem('client_session_data');
    setSessionToken('');
    setClientData(null);
    setPhotos([]);
    setPage(1);
    setHasMore(false);
    setLinkSuccess('');
    setLinkError('');
  };

  // Handle Verification
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setVerifyError('');

    if (!groomName.trim() || !brideName.trim() || !passkey.trim()) {
      setVerifyError('Please enter both couple names and your passkey.');
      return;
    }

    setVerifying(true);
    try {
      const data = await deliveryApi.verifyClient({
        groom_name: groomName.trim(),
        bride_name: brideName.trim(),
        passkey: passkey.trim().toUpperCase(),
      });

      setSessionToken(data.session_token);
      setClientData(data.client);
      sessionStorage.setItem('client_session_token', data.session_token);
      sessionStorage.setItem('client_session_data', JSON.stringify(data.client));
      setPage(1);
    } catch (err) {
      if (err.response?.status === 429) {
        setVerifyError(err.response.data.detail || 'Too many attempts. Please wait 15 minutes.');
      } else {
        setVerifyError(err.response?.data?.detail || 'Verification failed. Please check your names and passkey.');
      }
    } finally {
      setVerifying(false);
    }
  };

  // Fetch Photos for Verified Client
  const fetchPhotos = useCallback(async (pageNum = 1, append = false) => {
    if (!sessionToken) return;
    setLoadingPhotos(true);
    try {
      const res = await deliveryApi.getClientPhotos(sessionToken, pageNum);
      const results = res.results || [];
      setPhotos((prev) => (append ? [...prev, ...results] : results));
      setHasMore(Boolean(res.next));
      setPage(pageNum);
    } catch (err) {
      if (err.response?.status === 401) {
        // Session expired
        handleLogout();
        setVerifyError('Your session has expired. Please verify your names and passkey again.');
      }
    } finally {
      setLoadingPhotos(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchPhotos(1, false);
    }
  }, [sessionToken, fetchPhotos]);

  // Handle Download Link Request
  const handleRequestLink = async (e) => {
    e.preventDefault();
    setLinkError('');
    setLinkSuccess('');

    if (!clientData?.email_locked && !recipientEmail.trim()) {
      setLinkError('Please enter a valid email address.');
      return;
    }

    setRequestingLink(true);
    try {
      const res = await deliveryApi.requestDownloadLink(sessionToken, recipientEmail.trim());
      setLinkSuccess(res.message);
      // Update local client data if email was locked
      if (res.masked_email) {
        const updated = { ...clientData, email_locked: true, linked_email: res.masked_email };
        setClientData(updated);
        sessionStorage.setItem('client_session_data', JSON.stringify(updated));
      }
    } catch (err) {
      setLinkError(err.response?.data?.detail || 'Failed to dispatch download link. Please try again.');
    } finally {
      setRequestingLink(false);
    }
  };

  // 1. VERIFICATION VIEW (If no active session)
  if (!sessionToken || !clientData) {
    return (
      <div className="py-20 px-6 max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100">
            Client Gallery Access
          </h1>
          <p className="text-sm text-stone-400 max-w-sm mx-auto">
            Enter your names and secret passkey to preview your photos and receive your full collection.
          </p>
        </div>

        <div className="bg-stone-850 bg-stone-800/50 rounded-3xl border border-stone-700/60 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            {verifyError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{verifyError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-stone-300 mb-1.5">
                Groom Name
              </label>
              <input
                type="text"
                required
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
                placeholder="e.g. David Miller"
                className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-stone-300 mb-1.5">
                Bride Name
              </label>
              <input
                type="text"
                required
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
                placeholder="e.g. Emily Watson"
                className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-stone-300">
                  Secret Passkey
                </label>
                <span className="text-[11px] text-stone-500 font-mono">Format: XXXX-XXXX</span>
              </div>
              <input
                type="text"
                required
                value={passkey}
                onChange={(e) => setPasskey(e.target.value.toUpperCase())}
                placeholder="e.g. K7M2-9QXA"
                className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm font-mono tracking-wider focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full mt-2 py-3.5 rounded-xl bg-amber-400 text-stone-950 font-medium text-sm hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Passkey...</span>
                </>
              ) : (
                <>
                  <span>Unlock My Gallery</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-700/60 text-center">
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Protected by constant-time verification & brute-force security.
              Need assistance? Please contact your photographer directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. VERIFIED GALLERY PREVIEW VIEW
  const coupleTitle = `${clientData.groom_name} & ${clientData.bride_name}`;

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto space-y-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-stone-850 via-stone-800 to-stone-850 border border-stone-700/70 p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Heart className="w-4 h-4 fill-amber-400" />
            <span>Private Collection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100">
            {coupleTitle}
          </h1>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            {clientData.event_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>{new Date(clientData.event_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-stone-500" />
              <span>{clientData.photo_count} High-Resolution Photos</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-700/60 border border-stone-600/60 text-stone-300 hover:text-white hover:bg-stone-700 text-xs font-medium transition-colors self-start md:self-auto cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Gallery</span>
        </button>
      </div>

      {/* Delivery Link Request Card */}
      <div className="rounded-2xl bg-stone-800/40 border border-stone-700/60 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif font-semibold text-stone-100 text-lg">
                Download Full High-Resolution Collection
              </h3>
            </div>
            <p className="text-xs text-stone-400 max-w-xl leading-relaxed">
              Receive your entire collection as uncompressed multi-part ZIP files. Links are valid for 7 days.
            </p>
          </div>

          {clientData.email_locked && clientData.linked_email && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs font-mono text-stone-300">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Locked to: {clientData.linked_email}</span>
            </div>
          )}
        </div>

        {linkSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{linkSuccess}</p>
              <p className="text-emerald-400/80">
                Check your inbox (and spam/promotions folder). Follow the instructions inside to download your master ZIP archives.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRequestLink} className="pt-2 flex flex-col sm:flex-row gap-3">
            {linkError && (
              <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{linkError}</span>
              </div>
            )}

            {!clientData.email_locked && (
              <div className="flex-1">
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter your delivery email address"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={requestingLink}
              className="px-6 py-2.5 rounded-xl bg-amber-400 text-stone-950 font-medium text-xs hover:bg-amber-300 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {requestingLink ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing Link...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Me The Download Link</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Photo Grid Preview */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-stone-200">Gallery Previews</h2>
          <span className="text-xs text-stone-400 font-mono">
            Showing {photos.length} of {clientData.photo_count} photos
          </span>
        </div>

        {photos.length === 0 && !loadingPhotos ? (
          <div className="text-center py-20 bg-stone-850/50 rounded-2xl border border-stone-800 text-stone-400 text-xs">
            No ready photos available in your gallery yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-950 border border-stone-800 cursor-pointer hover:border-amber-500/50 transition-all duration-200 shadow-sm hover:shadow-lg"
              >
                <img
                  src={photo.thumb_url || photo.preview_url}
                  alt={photo.original_filename}
                  loading="lazy"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5 drop-shadow" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center pt-4">
            <button
              onClick={() => fetchPhotos(page + 1, true)}
              disabled={loadingPhotos}
              className="px-6 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:text-white hover:bg-stone-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loadingPhotos ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading more photos...</span>
                </>
              ) : (
                <span>Load More Photos</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Component */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        />
      )}
    </div>
  );
};

