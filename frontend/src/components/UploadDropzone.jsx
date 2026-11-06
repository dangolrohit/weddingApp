import React, { useState, useRef, useCallback } from 'react';
import { photosApi } from '../api/photos';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, X, FileImage } from 'lucide-react';

export const UploadDropzone = ({ clientId, onUploadComplete }) => {
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const processQueue = useCallback(async (filesToUpload) => {
    setIsUploading(true);

    for (let i = 0; i < filesToUpload.length; i++) {
      const item = filesToUpload[i];
      if (item.status === 'ready' || item.status === 'failed') continue;

      // Update item to uploading
      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading', progress: 0 } : q))
      );

      try {
        await photosApi.upload(clientId, item.file, (progress) => {
          setQueue((prev) =>
            prev.map((q, idx) => (idx === i ? { ...q, progress } : q))
          );
        });

        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'ready', progress: 100 } : q))
        );

        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (err) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? {
                  ...q,
                  status: 'failed',
                  error: err.response?.data?.detail || 'Upload failed',
                }
              : q
          )
        );
      }
    }

    setIsUploading(false);
  }, [clientId, onUploadComplete]);

  const addFilesToQueue = (fileList) => {
    const validFiles = Array.from(fileList).filter((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'heic'].includes(ext);
    });

    if (validFiles.length === 0) return;

    const newQueueItems = validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending', // pending, uploading, ready, failed
      error: null,
    }));

    setQueue((prev) => {
      const updated = [...prev, ...newQueueItems];
      setTimeout(() => processQueue(updated), 50);
      return updated;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const clearFinished = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'ready'));
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none ${
          dragOver
            ? 'border-amber-500 bg-amber-500/5 scale-[1.005]'
            : 'border-stone-300 hover:border-amber-500/50 bg-stone-50/50 hover:bg-stone-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-3 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="font-serif font-semibold text-stone-900 text-base">
            Drag & drop wedding photos here
          </h3>

          <p className="text-xs text-stone-500">
            Supports high-resolution JPEG, PNG, WebP, TIFF & HEIC.
            <br />
            Thumbnails (400px) and previews (1600px) are generated automatically in the background.
          </p>

          <div className="pt-2">
            <span className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-stone-900 text-white shadow-sm">
              Browse Files
            </span>
          </div>
        </div>
      </div>

      {/* Upload Progress List */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700 pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <span>Upload Queue ({queue.filter((q) => q.status === 'ready').length} of {queue.length} ready)</span>
              {isUploading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />}
            </div>
            {!isUploading && (
              <button
                onClick={clearFinished}
                className="text-stone-400 hover:text-stone-600 text-xs font-medium cursor-pointer"
              >
                Clear completed
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {queue.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-stone-50 border border-stone-200/60 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileImage className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-stone-400 font-mono">{formatSize(item.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.status === 'uploading' && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-600 h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-stone-500 w-8 text-right">
                        {item.progress}%
                      </span>
                    </div>
                  )}

                  {item.status === 'ready' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready
                    </span>
                  )}

                  {item.status === 'pending' && (
                    <span className="text-stone-400 text-[11px] font-mono">Queued</span>
                  )}

                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]" title={item.error}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
