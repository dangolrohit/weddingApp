import React from 'react';
import { Eye, EyeOff, Trash2, Star, RefreshCw, AlertCircle } from 'lucide-react';

export const PhotoGrid = ({
  photos,
  onPhotoClick,
  onToggleHide,
  onDeletePhoto,
}) => {
  if (!photos || photos.length === 0) {
    return (
      <div className="p-12 text-center text-stone-400">
        <p className="text-sm">No photos uploaded to this gallery yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className={`group relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200/80 shadow-sm transition-all duration-150 ${
            photo.is_hidden ? 'opacity-40 grayscale' : 'hover:shadow-md'
          }`}
        >
          {/* Thumbnail Image */}
          <img
            src={photo.thumb_url}
            alt={photo.original_filename}
            loading="lazy"
            onClick={() => onPhotoClick(index)}
            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
          />

          {/* Status Overlay */}
          {photo.status === 'processing' && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5 text-white">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-[10px] font-mono tracking-wider uppercase">Processing</span>
            </div>
          )}

          {photo.status === 'failed' && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-mono flex items-center gap-1 shadow">
              <AlertCircle className="w-3 h-3" />
              <span>Failed</span>
            </div>
          )}

          {/* Showcase Badge (1, 2, 3) */}
          {photo.showcase_order && (
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
              <Star className="w-3 h-3 fill-stone-950" />
              <span>Showcase #{photo.showcase_order}</span>
            </div>
          )}

          {/* Hidden Badge */}
          {photo.is_hidden && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-stone-900/80 text-stone-300 text-[10px] font-mono flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              <span>Hidden</span>
            </div>
          )}

          {/* Hover Actions Bar */}
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPhotoClick(index);
              }}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              title="Preview Photo"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHide(photo);
                }}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                title={photo.is_hidden ? "Unhide Photo" : "Hide from Client Preview"}
              >
                {photo.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePhoto(photo);
                }}
                className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                title="Delete Photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
