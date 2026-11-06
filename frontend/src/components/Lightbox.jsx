import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const Lightbox = ({ photos, currentIndex, onClose, onNavigate }) => {
  const currentPhoto = photos[currentIndex];

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, photos.length, onClose, onNavigate]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between backdrop-blur-md select-none">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between text-stone-300 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-white/10 px-2.5 py-1 rounded-full text-stone-200">
            {currentIndex + 1} / {photos.length}
          </span>
          <span className="text-xs text-stone-400 truncate max-w-xs sm:max-w-md">
            {currentPhoto.original_filename}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-stone-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 flex items-center justify-center relative p-4 min-h-0">
        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all z-10 cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <img
          src={currentPhoto.preview_url}
          alt={currentPhoto.original_filename}
          className="max-h-full max-w-full object-contain rounded shadow-2xl transition-all duration-200"
        />

        {/* Next Button */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all z-10 cursor-pointer"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Bar Details */}
      <div className="p-4 text-center text-xs text-stone-500 font-mono">
        {currentPhoto.width && currentPhoto.height && (
          <span>{currentPhoto.width} × {currentPhoto.height} px</span>
        )}
        {currentPhoto.taken_at && (
          <span> • Shot {new Date(currentPhoto.taken_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
};
