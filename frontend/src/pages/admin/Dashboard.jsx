import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Camera, Users, HardDrive, Tag, ArrowUpRight, ShieldCheck } from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
            <ShieldCheck className="w-4 h-4" />
            <span>Phase 1 Foundation Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Welcome, {user?.name || 'Photographer'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Studio delivery platform backend, database, and JWT authentication running successfully.
          </p>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Clients</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">0</p>
            <p className="text-xs text-stone-400 mt-1">Ready for Phase 2</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Categories</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">0</p>
            <p className="text-xs text-stone-400 mt-1">Ready for Phase 2</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Storage</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">0 GB</p>
            <p className="text-xs text-emerald-600 mt-1">Local disk mount healthy</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Worker Service</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">Online</p>
            <p className="text-xs text-stone-400 mt-1">Celery + Redis</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Camera className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

