import React, { useState, useEffect } from 'react';
import { photosApi } from '../api/photos';
import { Star, Check, AlertCircle, Save, Sparkles, RefreshCw } from 'lucide-react';

export const ShowcasePicker = ({ clientId, photos, onShowcaseUpdated }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Populate currently selected showcase photos ordered by showcase_order
    const current = photos
      .filter((p) => p.showcase_order != null)
      .sort((a, b) => a.showcase_order - b.showcase_order)
      .map((p) => p.id);
    setSelectedIds(current);
  }, [photos]);

  const toggleSelect = (photoId) => {
    setMessage('');
    setError('');
    if (selectedIds.includes(photoId)) {
      setSelectedIds(selectedIds.filter((id) => id !== photoId));
    } else {
      if (selectedIds.length >= 3) {
        setError('You can select a maximum of 3 showcase photos per client.');
        return;
      }
      setSelectedIds([...selectedIds, photoId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await photosApi.updateShowcase(clientId, selectedIds);
      setMessage('Showcase photos successfully updated! Watermarked versions generated.');
      if (onShowcaseUpdated) {
        onShowcaseUpdated();
      }
      setTimeout(() => setMessage(''), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update showcase photos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Public Portfolio Showcase</span>
          </div>
          <h3 className="font-serif font-bold text-stone-900 text-lg mt-0.5">
            Select 3 Photos for Public Portfolio ({selectedIds.length} / 3 selected)
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-xl">
            These 3 photos will be displayed on the public portfolio page with your studio watermark burned in. Couple names are kept completely private.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || selectedIds.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Showcase Selection'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selectable Photos Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {photos.map((photo) => {
          const selectedIndex = selectedIds.indexOf(photo.id);
          const isSelected = selectedIndex !== -1;

          return (
            <div
              key={photo.id}
              onClick={() => toggleSelect(photo.id)}
              className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-150 select-none ${
                isSelected
                  ? 'border-amber-500 ring-2 ring-amber-500/30 scale-[0.98]'
                  : 'border-stone-200 hover:border-stone-400 opacity-80 hover:opacity-100'
              }`}
            >
              <img
                src={photo.thumb_url}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Selection order badge */}
              {isSelected ? (
                <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center shadow-md">
                  #{selectedIndex + 1}
                </div>
              ) : (
                <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/40 text-white/80 border border-white/40 text-xs flex items-center justify-center backdrop-blur-sm">
                  <Star className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
