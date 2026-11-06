import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Sparkles, ArrowRight } from 'lucide-react';

export const Home = () => {
  return (
    <div className="py-20 px-6 max-w-5xl mx-auto text-center space-y-8">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-xs font-medium">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Timeless Wedding Stories & Private Client Delivery</span>
      </div>

      <h1 className="text-4xl sm:text-6xl font-serif font-bold text-stone-100 tracking-tight leading-tight">
        Preserving the moments that matter forever.
      </h1>

      <p className="max-w-2xl mx-auto text-stone-400 text-base sm:text-lg">
        Handcrafted wedding photography. If you are a client looking for your gallery, enter your names and passkey in the client portal.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link
          to="/get-my-image"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-stone-950 font-medium hover:bg-amber-300 transition-colors"
        >
          <span>Access Your Photos</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/admin/login"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
        >
          <span>Studio Admin</span>
        </Link>
      </div>
    </div>
  );
};

