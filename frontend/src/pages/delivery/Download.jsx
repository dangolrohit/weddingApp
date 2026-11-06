import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  DownloadCloud, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Camera, 
  FileArchive, 
  Phone, 
  Mail, 
  MessageSquare, 
  RefreshCw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { deliveryApi } from '../../api/delivery';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const Download = () => {
  const { token } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await deliveryApi.getDownloadStatus(token);
      setData(res);
      setError('');
    } catch (err) {
      if (err.response?.status === 410 || err.response?.status === 403) {
        setData(err.response.data);
      } else if (err.response?.status === 404) {
        setError('Download link not found. Please verify the URL.');
      } else {
        setError(err.response?.data?.detail || 'Unable to load download status.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // If status is 'building', automatically poll every 5 seconds
  useEffect(() => {
    if (data?.status === 'building') {
      const timer = setInterval(() => {
        fetchStatus();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [data?.status, fetchStatus]);

  if (loading) {
    return (
      <div className="py-24 px-6 max-w-md mx-auto text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <h2 className="text-xl font-serif font-semibold text-stone-100">Locating Gallery Archives...</h2>
        <p className="text-xs text-stone-400">Verifying secure token credentials.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 px-6 max-w-md mx-auto text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-stone-100">Invalid Link</h1>
        <p className="text-sm text-stone-400 leading-relaxed">{error}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-800 text-stone-200 text-xs font-medium hover:bg-stone-700 transition-colors"
        >
          <span>Return to Studio Home</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Handle Expired / Revoked / Limit Reached Status
  if (['expired', 'revoked', 'limit_reached'].includes(data?.status)) {
    const contact = data?.contact || {};
    return (
      <div className="py-20 px-6 max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-100">
            {data.status === 'expired' && 'Download Link Expired'}
            {data.status === 'revoked' && 'Download Link Revoked'}
            {data.status === 'limit_reached' && 'Download Limit Reached'}
          </h1>
          <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed">
            {data.detail || 'This download link is no longer active.'}
          </p>
        </div>

        <div className="bg-stone-800/50 rounded-3xl border border-stone-700/60 p-8 shadow-xl text-center space-y-5">
          <h3 className="font-serif font-semibold text-stone-200">
            Need a Replacement Link?
          </h3>
          <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
            Don’t worry! Your photos are securely stored on our servers. Contact your photographer below and we will dispatch a fresh 7-day link directly to your email.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-xs font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call {contact.phone}</span>
              </a>
            )}
            {contact.whatsapp && (
              <a
                href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors border border-stone-700"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Email Studio</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle 'building' status
  if (data?.status === 'building') {
    return (
      <div className="py-24 px-6 max-w-md mx-auto text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-stone-100">Preparing Your Photos</h1>
          <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
            Your high-resolution photos are being bundled into uncompressed multi-part ZIP archives. This page will automatically update once ready.
          </p>
        </div>

        <button
          onClick={() => { setRefreshing(true); fetchStatus(); }}
          disabled={refreshing}
          className="px-5 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Check Status Now</span>
        </button>
      </div>
    );
  }

  // 4. ACTIVE DOWNLOAD PORTAL
  const parts = data?.parts || [];
  const expiryDate = data?.expires_at ? new Date(data.expires_at) : null;
  const expiryStr = expiryDate ? expiryDate.toLocaleDateString(undefined, { dateStyle: 'long' }) : '7 days';

  return (
    <div className="py-16 px-6 max-w-4xl mx-auto space-y-10">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Verified Secure Download Link</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-stone-100">
          {data.client_names}
        </h1>

        <div className="flex items-center justify-center gap-4 text-xs text-stone-400 flex-wrap">
          {data.event_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>{new Date(data.event_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-stone-500" />
            <span>{data.photo_count} Total Photos</span>
          </span>
          <span className="flex items-center gap-1.5">
            <FileArchive className="w-3.5 h-3.5 text-stone-500" />
            <span>{formatBytes(data.total_bytes)} Total Size</span>
          </span>
        </div>
      </div>

      {/* Info Status Banner */}
      <div className="rounded-2xl bg-stone-800/40 border border-stone-700/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 text-stone-300">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Link Valid Until: <strong className="text-stone-100 font-mono">{expiryStr}</strong></span>
        </div>

        <div className="flex items-center gap-2 text-stone-400 font-mono">
          <span>Downloads: {data.download_count} of {data.max_downloads} used</span>
        </div>
      </div>

      {/* ZIP Parts Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-serif font-semibold text-stone-200">
          Download Archive Parts ({parts.length})
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {parts.map((part) => {
            const downloadUrl = deliveryApi.getPartDownloadUrl(token, part.part);
            return (
              <div
                key={part.part}
                className="bg-stone-800/60 rounded-2xl border border-stone-700/70 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-amber-500/40 transition-colors shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <FileArchive className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif font-semibold text-stone-100 text-base">
                      Archive Part {part.part}
                    </h3>
                    <p className="text-xs text-stone-400 font-mono">
                      {formatBytes(part.size_bytes)} • {part.photo_count} photos • {part.filename}
                    </p>
                  </div>
                </div>

                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-stone-950 font-medium text-xs hover:bg-amber-300 transition-colors shadow-md shadow-amber-400/10 cursor-pointer self-stretch sm:self-auto"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Download Part {part.part}</span>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Helpful Instructions */}
      <div className="rounded-2xl bg-stone-900/60 border border-stone-800 p-6 space-y-3 text-stone-400 text-xs leading-relaxed">
        <h4 className="font-serif font-semibold text-stone-300 text-sm">Download & Unzipping Tips:</h4>
        <ul className="list-disc list-inside space-y-1.5 text-stone-400">
          <li>We recommend using a desktop computer (Mac or Windows) with a stable Wi-Fi or wired connection.</li>
          <li>These archives are stored uncompressed to maximize download speed and preserve 100% original camera sensor quality.</li>
          <li>After downloading, double-click each ZIP file to extract your wedding photos directly into your picture library.</li>
        </ul>
      </div>
    </div>
  );
};

