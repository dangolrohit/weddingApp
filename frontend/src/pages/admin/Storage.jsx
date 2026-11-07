import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  FolderArchive, 
  Image as ImageIcon, 
  FileCheck, 
  ShieldAlert, 
  ArrowUpDown,
  Eye,
  Camera,
  Calendar
} from 'lucide-react';
import { storageApi } from '../../api/storage';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const Storage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState('-storage_bytes');
  const [recalculating, setRecalculating] = useState(false);
  const [clearingZips, setClearingZips] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      const res = await storageApi.getOverview(ordering);
      setData(res);
      setError('');
    } catch {
      setError('Failed to load storage statistics.');
    } finally {
      setLoading(false);
    }
  }, [ordering]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setActionMessage('');
    try {
      const res = await storageApi.recalculate();
      setActionMessage(res.detail || 'Storage recalculated successfully.');
      await fetchOverview();
    } catch {
      setError('Failed to trigger storage recalculation.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleClearZips = async () => {
    if (!window.confirm('Are you sure you want to purge all unreferenced or expired ZIP archives? Active links will not be affected.')) {
      return;
    }
    setClearingZips(true);
    setActionMessage('');
    try {
      const res = await storageApi.clearZips();
      setActionMessage(res.detail || 'Expired ZIP archives cleared.');
      await fetchOverview();
    } catch {
      setError('Failed to purge expired ZIP archives.');
    } finally {
      setClearingZips(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
        <p className="text-xs text-stone-500">Scanning storage partitions and client allocations...</p>
      </div>
    );
  }

  const sysDisk = data?.system_disk || {};
  const breakdown = data?.breakdown || {};
  const clients = data?.client_usage || [];

  return (
    <div className="space-y-8">
      {/* Page Title & Maintenance Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">Storage Overview</h1>
          <p className="text-xs text-stone-500 mt-1">
            Host drive health, media subfolder partitions, and per-client storage quotas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleClearZips}
            disabled={clearingZips}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Delete orphaned ZIP archives"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-500" />
            <span>{clearingZips ? 'Purging ZIPs...' : 'Clear Expired ZIPs'}</span>
          </button>

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Scan disk and reconcile database storage bytes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin text-amber-400' : ''}`} />
            <span>{recalculating ? 'Recalculating...' : 'Recalculate Storage'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage('')} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
      )}

      {/* 80% Warning Banner */}
      {sysDisk.warning && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3.5 shadow-sm">
          <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">Drive Capacity Warning (&gt; 80% Used)</h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your server drive is running low on free space ({sysDisk.usage_percent}% full, only {formatBytes(sysDisk.free_bytes)} free).
              Consider clearing expired ZIP archives, pruning trashed clients, or archiving past seasons to an external backup disk.
            </p>
          </div>
        </div>
      )}

      {/* Host Disk Partition Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-stone-900 text-lg">Server Host Drive (/mnt/photos)</h2>
              <p className="text-xs text-stone-400">Total physical capacity allocated to photo storage</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-stone-900">{sysDisk.usage_percent}%</p>
            <p className="text-xs text-stone-500">
              {formatBytes(sysDisk.used_bytes)} used of {formatBytes(sysDisk.total_bytes)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                sysDisk.warning ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, sysDisk.usage_percent))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-stone-500">
            <span>Free Space: <strong className="text-stone-800">{formatBytes(sysDisk.free_bytes)}</strong></span>
            <span>Platform Media: <strong className="text-stone-800">{formatBytes(breakdown.total_platform)}</strong></span>
          </div>
        </div>
      </div>

      {/* Media Subfolder Breakdown Cards */}
      <div className="space-y-3">
        <h3 className="font-serif font-bold text-stone-900 text-base">Media Breakdown by Variant</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              Originals
            </span>
            <p className="text-xl font-bold text-stone-900 font-mono">{formatBytes(breakdown.originals)}</p>
            <p className="text-[11px] text-stone-500">Camera source files</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              Previews
            </span>
            <p className="text-xl font-bold text-stone-900 font-mono">{formatBytes(breakdown.previews)}</p>
            <p className="text-[11px] text-stone-500">1600px WebP images</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              Thumbnails
            </span>
            <p className="text-xl font-bold text-stone-900 font-mono">{formatBytes(breakdown.thumbs)}</p>
            <p className="text-[11px] text-stone-500">400px WebP grids</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              Showcase
            </span>
            <p className="text-xl font-bold text-stone-900 font-mono">{formatBytes(breakdown.showcase)}</p>
            <p className="text-[11px] text-stone-500">Watermarked JPEGs</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              ZIP Archives
            </span>
            <p className="text-xl font-bold text-stone-900 font-mono">{formatBytes(breakdown.zips)}</p>
            <p className="text-[11px] text-stone-500">Temporary download bundles</p>
          </div>
        </div>
      </div>

      {/* Per-Client Storage Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif font-bold text-stone-900 text-base">Client Storage Allocations</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Storage consumption per wedding gallery, including original media and cached variants.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">Sort by:</span>
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="-storage_bytes">Storage Used (Highest)</option>
              <option value="storage_bytes">Storage Used (Lowest)</option>
              <option value="-photo_count">Photo Count (Highest)</option>
              <option value="-created_at">Date Created (Newest)</option>
            </select>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-xs">
            No active clients registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 border-b border-stone-100 uppercase tracking-wider text-[11px] text-stone-400 font-semibold">
                <tr>
                  <th className="py-3 px-6">Client Gallery</th>
                  <th className="py-3 px-6">Event Date</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Total Photos</th>
                  <th className="py-3 px-6">Storage Used</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-4 px-6 font-medium text-stone-900">
                      <Link to={`/admin/clients/${c.id}`} className="hover:text-amber-700">
                        {c.display_name || (c.bride_name ? `${c.groom_name} & ${c.bride_name}` : c.groom_name)}
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-stone-500">
                      {c.event_date ? new Date(c.event_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        c.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.status === 'archived'
                          ? 'bg-stone-100 text-stone-600'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-stone-700">
                      {c.photo_count}
                    </td>
                    <td className="py-4 px-6 font-mono font-semibold text-stone-900">
                      {formatBytes(c.storage_bytes)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        to={`/admin/clients/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

