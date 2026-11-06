import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Camera, Lock } from 'lucide-react';

export const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans">
      <header className="border-b border-stone-800/80 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-amber-400" />
          <span className="font-serif tracking-widest text-lg font-semibold text-stone-100">
            WEDDING STUDIO
          </span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/" className="text-stone-300 hover:text-white transition-colors">
            Portfolio
          </Link>
          <Link
            to="/get-my-image"
            className="px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors text-xs font-medium tracking-wide uppercase"
          >
            Get My Image
          </Link>
          <Link
            to="/admin/login"
            className="text-stone-500 hover:text-stone-300 transition-colors"
            title="Admin Login"
          >
            <Lock className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-stone-800/80 py-8 px-6 text-center text-xs text-stone-500">
        <p>© {new Date().getFullYear()} Wedding Studio. Private photo delivery platform.</p>
      </footer>
    </div>
  );
};

