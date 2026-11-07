import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Camera, Lock, Key, Mail, Heart } from 'lucide-react';
import { publicApi } from '../api/public';

export const PublicLayout = () => {
  const [branding, setBranding] = useState(null);
  const location = useLocation();

  useEffect(() => {
    publicApi.getBranding()
      .then((data) => {
        if (data?.branding) setBranding(data.branding);
      })
      .catch(() => {});
  }, []);

  const studioName = branding?.studio_name || 'WEDDING STUDIO';

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans selection:bg-amber-400 selection:text-stone-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800/80 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-400 group-hover:text-stone-950 transition-colors">
            <Camera className="w-4 h-4" />
          </div>
          <span className="font-serif tracking-widest text-base sm:text-lg font-bold text-stone-100 group-hover:text-amber-400 transition-colors uppercase">
            {studioName}
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm">
          <Link
            to="/#portfolio"
            className="text-stone-300 hover:text-white transition-colors hidden sm:inline"
          >
            Portfolio
          </Link>
          <Link
            to="/#about"
            className="text-stone-300 hover:text-white transition-colors hidden md:inline"
          >
            About
          </Link>
          <Link
            to="/#contact"
            className="text-stone-300 hover:text-white transition-colors hidden sm:inline"
          >
            Contact
          </Link>

          <Link
            to="/client-login"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-400 text-stone-950 font-medium text-xs tracking-wide hover:bg-amber-300 transition-colors shadow-sm"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Client Login</span>
          </Link>

          <Link
            to="/admin/login"
            className="text-stone-500 hover:text-stone-300 transition-colors p-1"
            title="Studio Admin Login"
          >
            <Lock className="w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Main Content View */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-950/60 py-12 px-6 text-stone-400 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-serif font-bold text-stone-200 uppercase tracking-widest text-sm">
              {studioName}
            </p>
            <p className="text-stone-500">
              Handcrafted wedding stories & private high-resolution gallery delivery.
            </p>
          </div>

          <div className="flex items-center gap-6 text-stone-400">
            {branding?.phone && (
              <span className="hover:text-stone-200">{branding.phone}</span>
            )}
            {branding?.email && (
              <a href={`mailto:${branding.email}`} className="hover:text-amber-400 transition-colors">
                {branding.email}
              </a>
            )}
            <Link to="/admin/login" className="hover:text-stone-300 transition-colors">
              Admin
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-stone-600 text-[11px]">
          <p>© {new Date().getFullYear()} {studioName}. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built for private client photo delivery <Heart className="w-3 h-3 text-amber-500/50" />
          </p>
        </div>
      </footer>
    </div>
  );
};
