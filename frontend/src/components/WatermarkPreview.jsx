import React from 'react';

export const WatermarkPreview = ({ settings }) => {
  const {
    enabled = false,
    type = 'text',
    text = 'Wedding Studio',
    image_key = '',
    position = 'bottom-right',
    opacity = 60,
    scale = 20,
  } = settings || {};

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4 text-left';
      case 'top-right':
        return 'top-4 right-4 text-right';
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center';
      case 'bottom-left':
        return 'bottom-4 left-4 text-left';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4 text-right';
    }
  };

  const getFontSize = () => {
    // scale from 10 to 50 maps to font sizes
    const base = Math.max(12, Math.min(36, Math.round((scale / 100) * 80)));
    return `${base}px`;
  };

  const getImageWidth = () => {
    return `${Math.max(40, Math.min(200, Math.round((scale / 100) * 400)))}px`;
  };

  return (
    <div className="relative w-full aspect-[16/10] bg-stone-900 rounded-xl overflow-hidden shadow-md border border-stone-300">
      {/* Sample wedding photograph mockup */}
      <img
        src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
        alt="Watermark preview backdrop"
        className="w-full h-full object-cover opacity-85 select-none pointer-events-none"
      />

      {/* Dark gradient for realism */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

      {/* Watermark Overlay */}
      {enabled ? (
        <div
          className={`absolute pointer-events-none select-none transition-all duration-150 ${getPositionClasses()}`}
          style={{ opacity: opacity / 100 }}
        >
          {type === 'image' && image_key ? (
            <img
              src={`/files/${image_key}`}
              alt="Watermark logo"
              style={{ width: getImageWidth() }}
              className="drop-shadow-lg object-contain"
            />
          ) : (
            <span
              className="font-serif tracking-widest uppercase font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] border-b border-white/60 pb-0.5 inline-block"
              style={{ fontSize: getFontSize() }}
            >
              {text || 'Wedding Studio'}
            </span>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-stone-300 text-xs font-medium uppercase tracking-wider backdrop-blur-[1px]">
          Watermark Disabled
        </div>
      )}

      {/* Indicator pill */}
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-[10px] text-stone-300 font-mono tracking-wider backdrop-blur-sm">
        Live Showcase Preview
      </div>
    </div>
  );
};

