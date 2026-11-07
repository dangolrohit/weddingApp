import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { storageApi } from '../../api/storage';
import { 
  Users, 
  Camera, 
  HardDrive, 
  Tag, 
  Send, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  RefreshCw, 
  ShieldAlert, 
  Activity, 
  Calendar,
  Layers
} from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      const res = await storageApi.getDashboard();
      setData(res);
      setError('');
    } catch {
      setError('Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
        <p className="text-xs text-stone-500">Aggregating studio metrics and disk quotas...</p>
      </div>
    );
  }

  const storage = data?.storage || {};
  const pending = data?.pending_work || {};
  const links = data?.download_links || {};
  const recentClients = data?.recent_clients || [];
  const recentActivity = data?.recent_activity || [];
  const chartData = data?.chart || [];
  const categories = data?.categories || [];

  const maxChartCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Studio Production Hub Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Welcome back, {user?.name || 'Photographer'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Real-time status of your client galleries, photo pipeline, and secure downloads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/clients"
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm"
          >
            Manage Clients
          </Link>
          <Link
            to="/admin/storage"
            className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200 transition-colors"
          >
            Storage Details
          </Link>
        </div>
      </div>

      {/* Disk Usage Warning */}
      {storage.warning && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              Server disk storage is above 80% ({storage.usage_percent}% full). Consider clearing expired ZIP archives.
            </span>
          </div>
          <Link to="/admin/storage" className="font-semibold text-amber-800 hover:underline ml-4">
            Manage Disk
          </Link>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clients */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Clients</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-serif font-bold text-stone-900">{data?.total_clients ?? 0}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              +{data?.new_clients_this_month ?? 0} new this month
            </p>
          </div>
        </div>

        {/* Total Photos */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ready Photos</span>
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-serif font-bold text-stone-900">{data?.total_photos ?? 0}</p>
            <p className="text-xs text-stone-400 mt-1">High-res processed photos</p>
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Host Disk Usage</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${storage.warning ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-serif font-bold text-stone-900 font-mono">{storage.usage_percent}%</p>
            <p className="text-xs text-stone-500 mt-1">
              {formatBytes(storage.free_bytes)} free of {formatBytes(storage.total_bytes)}
            </p>
          </div>
        </div>

        {/* Active Download Links */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Download Links</span>
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-serif font-bold text-stone-900">{links.active ?? 0}</p>
            <p className="text-xs text-amber-600 font-medium mt-1">
              {links.expiring_soon ?? 0} expiring in next 7 days
            </p>
          </div>
        </div>
      </div>

      {/* Pending Work Status Strip */}
      {(pending.photos_processing > 0 || pending.photos_failed > 0 || pending.zips_building > 0) && (
        <div className="p-4 rounded-xl bg-stone-900 text-stone-200 text-xs flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-stone-100">Background Worker Operations:</span>
          </div>
          <div className="flex items-center gap-4 text-stone-300">
            {pending.photos_processing > 0 && (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                {pending.photos_processing} photos processing
              </span>
            )}
            {pending.zips_building > 0 && (
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                {pending.zips_building} ZIP bundles building
              </span>
            )}
            {pending.photos_failed > 0 && (
              <span className="flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pending.photos_failed} photos failed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Middle Section: Monthly Growth Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Clients Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-900 text-base">Client Acquisition (Past 6 Months)</h3>
            <span className="text-xs text-stone-400 font-mono">Monthly Galleries</span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-6 border-b border-stone-100 pb-2">
            {chartData.map((item, idx) => {
              const heightPercent = Math.max(12, Math.round((item.count / maxChartCount) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-mono text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div
                    className="w-full max-w-[42px] bg-amber-400 group-hover:bg-amber-500 rounded-t-lg transition-all duration-300 shadow-sm"
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-[10px] text-stone-400 font-medium truncate w-full text-center">
                    {item.month.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-900 text-base">Categories</h3>
            <Link to="/admin/categories" className="text-xs text-amber-700 hover:underline">
              Manage
            </Link>
          </div>

          <div className="space-y-3 pt-2">
            {categories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-stone-800">{cat.name}</span>
                  <span className="text-stone-500 font-mono">{cat.client_count} clients</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-stone-800"
                    style={{
                      width: `${data?.total_clients ? Math.min(100, (cat.client_count / data.total_clients) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Clients & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden space-y-3">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-900 text-base">Recently Added Clients</h3>
            <Link to="/admin/clients" className="text-xs text-amber-700 hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-stone-100">
            {recentClients.length === 0 ? (
              <p className="p-6 text-center text-xs text-stone-400">No clients registered yet.</p>
            ) : (
              recentClients.map((c) => (
                <div key={c.id} className="p-4 px-6 flex items-center justify-between hover:bg-stone-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <Link to={`/admin/clients/${c.id}`} className="font-medium text-stone-900 text-xs hover:text-amber-700">
                      {c.display_name || (c.bride_name ? `${c.groom_name} & ${c.bride_name}` : c.groom_name)}
                    </Link>
                    <div className="flex items-center gap-3 text-[11px] text-stone-400">
                      <span>{c.event_date ? new Date(c.event_date).toLocaleDateString() : 'No date'}</span>
                      <span>• {c.photo_count} photos</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    c.status === 'published'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Activity Feed */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden space-y-3">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-900 text-base">Recent Audit Activity</h3>
            <span className="text-xs text-stone-400 font-mono">Last 10 Actions</span>
          </div>

          <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="p-6 text-center text-xs text-stone-400">No activity logged yet.</p>
            ) : (
              recentActivity.map((a) => (
                <div key={a.id} className="p-3.5 px-6 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-medium text-stone-800 capitalize font-mono text-[11px]">
                      {a.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      By {a.user}
                    </p>
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
