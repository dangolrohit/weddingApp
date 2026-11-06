import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Camera, 
  Sparkles, 
  ArrowRight, 
  Key, 
  Calendar, 
  Mail, 
  Phone, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Maximize2,
  Heart,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { publicApi } from '../../api/public';
import { Lightbox } from '../../components/Lightbox';

export const Home = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [branding, setBranding] = useState(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Inquiry Form
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryDate, setInquiryDate] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState('');
  const [inquiryError, setInquiryError] = useState('');

  // Initial Load: Categories & Branding
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [cats, brand] = await Promise.all([
          publicApi.getCategories(),
          publicApi.getBranding(),
        ]);
        setCategories(cats || []);
        if (brand?.branding) {
          setBranding(brand.branding);
        }
      } catch (err) {
        console.error('Failed to load public metadata:', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch Showcase photos when category changes
  const fetchShowcase = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const data = await publicApi.getShowcase(selectedCategory);
      setPhotos(data || []);
    } catch (err) {
      console.error('Failed to load showcase photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchShowcase();
  }, [fetchShowcase]);

  // Handle Inquiry Submit
  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setInquiryError('');
    setInquirySuccess('');

    if (!inquiryEmail && !inquiryPhone) {
      setInquiryError('Please provide an email or phone number so we can reach you.');
      return;
    }

    setSubmittingInquiry(true);
    try {
      const res = await publicApi.submitInquiry({
        name: inquiryName,
        email: inquiryEmail,
        phone: inquiryPhone,
        event_date: inquiryDate || null,
        message: inquiryMessage,
      });
      setInquirySuccess(res.message || 'Thank you! Your inquiry has been sent.');
      setInquiryName('');
      setInquiryEmail('');
      setInquiryPhone('');
      setInquiryDate('');
      setInquiryMessage('');
    } catch (err) {
      setInquiryError(err.response?.data?.detail || 'Failed to submit inquiry. Please try again.');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const studioName = branding?.studio_name || 'Wedding Studio';

  return (
    <div className="space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-24 pb-16 px-6 max-w-5xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800/80 border border-stone-700/80 text-amber-400 text-xs font-medium tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Timeless Stories & Private Client Delivery</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif font-bold text-stone-100 tracking-tight leading-[1.15]">
          Preserving the emotions that define your story.
        </h1>

        <p className="max-w-2xl mx-auto text-stone-400 text-base sm:text-lg leading-relaxed">
          Artisanal wedding photography celebrating authentic romance and timeless candid memories.
          Every couple receives an exclusive private gallery with high-resolution delivery.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a
            href="#portfolio"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 text-stone-950 font-medium hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 cursor-pointer"
          >
            <span>Explore Portfolio</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            to="/get-my-image"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Client Passkey Portal</span>
          </Link>
        </div>
      </section>

      {/* 2. PORTFOLIO SHOWCASE SECTION */}
      <section id="portfolio" className="max-w-7xl mx-auto px-6 space-y-10 scroll-mt-20">
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-amber-500">Showcase Gallery</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100">Featured Moments</h2>
          <p className="text-stone-400 text-sm max-w-xl mx-auto">
            A curated showcase of our favorite wedding and celebration captures.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-400 text-stone-950 shadow-md font-semibold'
                : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700/60'
            }`}
          >
            All Work
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-amber-400 text-stone-950 shadow-md font-semibold'
                  : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700/60'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Photos Grid */}
        {loadingPhotos ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="aspect-[4/3] rounded-2xl bg-stone-800/60 animate-pulse border border-stone-800" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20 bg-stone-800/30 rounded-3xl border border-stone-800 max-w-md mx-auto space-y-3">
            <Camera className="w-10 h-10 text-stone-600 mx-auto" />
            <h3 className="font-serif font-semibold text-stone-200">No Showcase Photos</h3>
            <p className="text-xs text-stone-400">
              {selectedCategory === 'all'
                ? 'Portfolio items will appear here once published by the studio.'
                : 'No photos currently published under this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-950 border border-stone-800/80 cursor-pointer shadow-md hover:shadow-2xl hover:border-amber-500/40 transition-all duration-300"
              >
                <img
                  src={photo.url}
                  alt={photo.category_name || 'Wedding Showcase'}
                  loading="lazy"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />

                {/* Overlay gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  <div className="flex justify-end">
                    <span className="p-2 rounded-full bg-black/60 text-white/90 backdrop-blur-sm">
                      <Maximize2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    {photo.category_name && (
                      <span className="text-[11px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
                        {photo.category_name}
                      </span>
                    )}
                    <span className="text-[11px] text-stone-300 font-mono">View Full</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. CLIENT PRIVATE DELIVERY CALLOUT */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl bg-gradient-to-br from-stone-800/80 via-stone-800/40 to-stone-900 border border-stone-700/60 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-400">
              <Key className="w-4 h-4" />
              <span>Are You Our Client?</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
              Access your full wedding collection safely.
            </h3>
            <p className="text-sm text-stone-400 leading-relaxed">
              Enter your names and the secret passkey given by your photographer to preview your images and receive an uncompressed 7-day download link directly to your inbox.
            </p>
          </div>

          <Link
            to="/get-my-image"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 text-stone-950 font-medium hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
          >
            <span>Get My Images</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 4. ABOUT / PHILOSOPHY SECTION */}
      <section id="about" className="max-w-5xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-amber-500">The Studio</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100">About {studioName}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-stone-800/40 rounded-2xl p-6 border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Heart className="w-5 h-5" />
            </div>
            <h4 className="font-serif font-semibold text-stone-200 text-lg">Candid & Emotive</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              We focus on genuine laughter, quiet whispers, and unplanned tears over rigid poses, creating memories that breathe.
            </p>
          </div>

          <div className="bg-stone-800/40 rounded-2xl p-6 border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-serif font-semibold text-stone-200 text-lg">Private & Protected</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Your photos belong to you. Only curated showcase photos appear publicly; your complete wedding gallery stays strictly encrypted and passkey-protected.
            </p>
          </div>

          <div className="bg-stone-800/40 rounded-2xl p-6 border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-serif font-semibold text-stone-200 text-lg">Master Quality</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Processed with calibrated color science and delivered as uncompressed ZIP bundles ready for heirloom album printing.
            </p>
          </div>
        </div>
      </section>

      {/* 5. CONTACT / INQUIRY SECTION */}
      <section id="contact" className="max-w-3xl mx-auto px-6 space-y-8 scroll-mt-20">
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-amber-500">Get in Touch</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100">Let’s Capture Your Day</h2>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            Available for weddings, pre-weddings, and destination celebrations worldwide.
          </p>
        </div>

        <div className="bg-stone-800/50 rounded-3xl border border-stone-700/60 p-8 sm:p-10 shadow-xl">
          {inquirySuccess ? (
            <div className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-xl font-serif font-semibold text-stone-100">Message Received!</h3>
              <p className="text-sm text-stone-400 max-w-md mx-auto">{inquirySuccess}</p>
              <button
                onClick={() => setInquirySuccess('')}
                className="mt-4 px-5 py-2 rounded-xl bg-stone-700 text-stone-200 text-xs hover:bg-stone-600 transition-colors cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleInquirySubmit} className="space-y-4">
              {inquiryError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{inquiryError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="e.g. Rachel & Alex"
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 uppercase tracking-wider mb-1.5">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={inquiryDate}
                    onChange={(e) => setInquiryDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 uppercase tracking-wider mb-1.5">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="+1 555-0100"
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 uppercase tracking-wider mb-1.5">
                  Tell us about your celebration
                </label>
                <textarea
                  rows={4}
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="Location, venue, estimated guest count, or any special moments you want covered..."
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingInquiry}
                className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-medium text-sm hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submittingInquiry ? (
                  <span>Sending inquiry...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Inquiry</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Lightbox for Showcase Photos */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIndex) => setLightboxIndex(newIndex)}
        />
      )}
    </div>
  );
};
