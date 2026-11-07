import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Heart, 
  Calendar, 
  Camera, 
  Film, 
  Archive, 
  DownloadCloud, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck,
  FileText
} from 'lucide-react';
import { albumsApi } from '../../api/albums';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const AlbumView = () => {
  const { shareToken } = useParams();

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // null, 404, 410, 403, 503
  const [errorMessage, setErrorMessage] = useState('');
  
  const [album, setAlbum] = useState(null);
  const [archives, setArchives] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter tab: 'all' | 'photo' | 'video'
  const [filterType, setFilterType] = useState('all');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetch album metadata & first page
  const fetchAlbumData = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await albumsApi.getClientAlbum(shareToken, pageNum);

      if (res.results) {
        setAlbum(res.results.album);
        setArchives(res.results.archives || []);
        if (pageNum === 1) {
          setItems(res.results.items || []);
        } else {
          setItems((prev) => [...prev, ...(res.results.items || [])]);
        }
        setHasMore(Boolean(res.next));
      } else {
        // Unpaginated fallback
        setAlbum(res.album);
        setArchives(res.archives || []);
        setItems(res.items || []);
        setHasMore(false);
      }
      setErrorStatus(null);
      setErrorMessage('');
    } catch (err) {
      console.error('Failed to load album:', err);
      const st = err.response?.status;
      setErrorStatus(st || 500);
      setErrorMessage(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        (st === 503 ? 'Object storage is temporarily unavailable. Please retry in a few moments.' : 'Unable to load album.')
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [shareToken]);

  useEffect(() => {
    fetchAlbumData(1);
  }, [fetchAlbumData]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchAlbumData(nextPage);
  };

  // Download individual media directly via presigned S3 URL
  const handleDownloadOriginal = async (e, mediaId, filename) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(mediaId);
      const res = await albumsApi.getClientDownloadUrl(shareToken, mediaId);
      if (res.download_url) {
        // Direct browser transfer from Garage S3
        const link = document.createElement('a');
        link.href = res.download_url;
        link.setAttribute('download', filename || res.filename || 'wedding_photo');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert(err.response?.data?.error || 'Storage temporarily unavailable. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterType === 'all') return true;
    return item.media_type === filterType;
  });

  // Lightbox item
  const currentLightboxItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null;

  const nextLightbox = () => {
    if (lightboxIndex !== null && lightboxIndex < filteredItems.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const prevLightbox = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') nextLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredItems.length]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <h2 className="text-xl font-serif text-stone-200">Loading your wedding gallery...</h2>
        <p className="text-sm text-stone-400 mt-1">Connecting to private storage</p>
      </div>
    );
  }

  // Error States
  if (errorStatus) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-stone-800/80 border border-stone-700/60 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-md">
          {errorStatus === 503 ? (
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <HardDrive className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}

          <h2 className="text-2xl font-serif font-bold text-white mb-2">
            {errorStatus === 410 ? 'Link Expired or Revoked' : 
             errorStatus === 403 ? 'Access Restricted' :
             errorStatus === 503 ? 'Storage Temporarily Unavailable' : 'Gallery Not Found'}
          </h2>

          <p className="text-stone-300 text-sm mb-6 leading-relaxed">
            {errorMessage}
          </p>

          <div className="flex flex-col gap-3">
            {errorStatus === 503 && (
              <button
                onClick={() => fetchAlbumData(1)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </button>
            )}
            <Link
              to="/"
              className="w-full py-3 bg-stone-700/60 hover:bg-stone-700 text-stone-200 font-medium rounded-xl transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-white">
      {/* Hero Header */}
      <header className="relative pt-20 pb-16 px-6 border-b border-stone-800 bg-gradient-to-b from-stone-900 to-stone-950">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-5 tracking-wide uppercase">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Private Wedding Gallery</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif font-normal text-stone-50 tracking-tight mb-3">
            {album?.title || 'Wedding Memories'}
          </h1>

          <p className="text-lg text-amber-200/90 font-serif italic mb-4">
            {album?.client_names}
          </p>

          {album?.description && (
            <p className="max-w-2xl mx-auto text-stone-400 text-sm leading-relaxed mb-6">
              {album.description}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-stone-400">
            {album?.event_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-stone-500" />
                {new Date(album.event_date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-stone-500" />
              {items.length} High-Res Items
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              End-to-End Private Storage
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Prepared Archives ("Download All" Multi-Part Collections) */}
        {archives.length > 0 && (
          <section className="mb-12 bg-stone-900/60 border border-stone-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Archive className="w-4 h-4" />
                  <span>Download Complete Collection</span>
                </div>
                <h2 className="text-xl font-serif text-stone-100 font-semibold">
                  Prepared ZIP Archives
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Pre-packaged original files organized into multi-part archives for fast direct download.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {archives.map((arch) => (
                <div
                  key={arch.id}
                  className="bg-stone-950/70 border border-stone-800/80 hover:border-amber-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-stone-950 transition-colors flex-shrink-0">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-200 truncate">
                        Part {arch.part_number}: {arch.filename}
                      </p>
                      <p className="text-xs text-stone-400 font-mono mt-0.5">
                        {formatBytes(arch.byte_size)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDownloadOriginal(e, arch.id, arch.filename)}
                    disabled={downloadingId === arch.id}
                    className="p-2.5 rounded-xl bg-stone-800 hover:bg-amber-600 hover:text-white text-stone-300 transition-colors flex-shrink-0 flex items-center gap-1.5 text-xs font-medium"
                    title="Download ZIP Archive directly from storage"
                  >
                    {downloadingId === arch.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <>
                        <DownloadCloud className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gallery Section Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-serif text-stone-100">Gallery Previews</h2>
            <p className="text-xs text-stone-400">Click any image to expand and view in high resolution</p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-stone-900 border border-stone-800 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterType === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilterType('photo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterType === 'photo'
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Photos ({items.filter((i) => i.media_type === 'photo').length})
            </button>
            <button
              onClick={() => setFilterType('video')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterType === 'video'
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Videos ({items.filter((i) => i.media_type === 'video').length})
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-stone-800 rounded-3xl">
            <Camera className="w-10 h-10 text-stone-600 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">No items found matching the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setLightboxIndex(idx)}
                className="group relative aspect-square bg-stone-900 rounded-2xl overflow-hidden border border-stone-800/80 hover:border-amber-500/50 cursor-pointer shadow-md transition-all duration-300"
              >
                {/* Media Preview */}
                {item.preview_url ? (
                  <img
                    src={item.preview_url}
                    alt={item.original_filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-stone-900 text-stone-500 group-hover:text-amber-400 transition-colors">
                    {item.media_type === 'video' ? (
                      <Film className="w-10 h-10 mb-2" />
                    ) : item.is_archive ? (
                      <Archive className="w-10 h-10 mb-2" />
                    ) : (
                      <FileText className="w-10 h-10 mb-2" />
                    )}
                    <span className="text-xs text-stone-300 text-center truncate max-w-full px-2">
                      {item.original_filename}
                    </span>
                    <span className="text-[10px] text-stone-500 mt-1 font-mono">
                      {formatBytes(item.byte_size)}
                    </span>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-white truncate drop-shadow-md">
                      {item.original_filename}
                    </p>
                    <p className="text-[10px] text-stone-300 font-mono">
                      {formatBytes(item.byte_size)}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDownloadOriginal(e, item.id, item.original_filename)}
                    disabled={downloadingId === item.id}
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-amber-600 text-white transition-colors shadow-lg flex-shrink-0"
                    title="Download Original"
                  >
                    {downloadingId === item.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Badge for video */}
                {item.media_type === 'video' && (
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-stone-950/70 backdrop-blur-md text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    <span>Video</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-12 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 text-sm font-semibold rounded-2xl transition-colors inline-flex items-center gap-2"
            >
              {loadingMore && <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />}
              <span>{loadingMore ? 'Loading more photos...' : 'Load More Photos'}</span>
            </button>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {currentLightboxItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-5 right-5 p-3 rounded-full bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors z-50"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left Arrow */}
          {lightboxIndex > 0 && (
            <button
              onClick={prevLightbox}
              className="absolute left-5 p-3 rounded-full bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors z-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Right Arrow */}
          {lightboxIndex < filteredItems.length - 1 && (
            <button
              onClick={nextLightbox}
              className="absolute right-5 p-3 rounded-full bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors z-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Lightbox Center Content */}
          <div className="max-w-5xl max-h-[85vh] p-4 flex flex-col items-center justify-center">
            {currentLightboxItem.preview_url ? (
              <img
                src={currentLightboxItem.preview_url}
                alt={currentLightboxItem.original_filename}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="w-96 h-64 bg-stone-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-stone-800">
                {currentLightboxItem.media_type === 'video' ? (
                  <Film className="w-16 h-16 text-amber-500 mb-4" />
                ) : (
                  <FileText className="w-16 h-16 text-stone-400 mb-4" />
                )}
                <p className="text-sm font-semibold text-white">{currentLightboxItem.original_filename}</p>
                <p className="text-xs text-stone-400 font-mono mt-1">{formatBytes(currentLightboxItem.byte_size)}</p>
              </div>
            )}

            {/* Bottom details bar */}
            <div className="mt-4 flex items-center justify-between gap-6 w-full max-w-xl px-4 py-2 bg-stone-900/80 border border-stone-800 rounded-2xl text-xs text-stone-300">
              <span className="truncate">{currentLightboxItem.original_filename}</span>
              <span className="font-mono text-stone-400">{formatBytes(currentLightboxItem.byte_size)}</span>
              <button
                onClick={(e) => handleDownloadOriginal(e, currentLightboxItem.id, currentLightboxItem.original_filename)}
                disabled={downloadingId === currentLightboxItem.id}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl flex items-center gap-1.5 transition-colors"
              >
                {downloadingId === currentLightboxItem.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="w-3.5 h-3.5" />
                )}
                <span>Download Original</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-stone-900 text-center text-xs text-stone-600">
        <p>Private & Secure Wedding Photography Delivery &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

