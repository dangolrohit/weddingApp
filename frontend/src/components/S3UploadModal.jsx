import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  X, 
  CloudUpload, 
  Archive, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { albumsApi } from '../api/albums';

// Helper to downscale image to lightweight WebP preview thumbnail inside browser
const generateThumbnailBlob = async (file, maxWidth = 600, quality = 0.8) => {
  if (!file.type.startsWith('image/')) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

export const S3UploadModal = ({ isOpen, onClose, albumId, albumTitle, onUploadComplete }) => {
  const containerRef = useRef(null);
  const uppyRef = useRef(null);

  const [loadingUppy, setLoadingUppy] = useState(true);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [archivePartNo, setArchivePartNo] = useState(1);
  const [uploadStats, setUploadStats] = useState({ total: 0, completed: 0, failed: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  // Lazy-load Uppy modules and initialize dashboard
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    let uppyInstance = null;

    const initUppy = async () => {
      setLoadingUppy(true);
      setErrorMsg('');

      try {
        // Dynamically import Uppy packages and styles
        const [
          { default: Uppy },
          { default: Dashboard },
          { default: AwsS3 }
        ] = await Promise.all([
          import('@uppy/core'),
          import('@uppy/dashboard'),
          import('@uppy/aws-s3'),
          import('@uppy/core/css/style.min.css'),
          import('@uppy/dashboard/css/style.min.css')
        ]);

        if (!isSubscribed) return;

        uppyInstance = new Uppy({
          id: `garage-uploader-${albumId}`,
          autoProceed: false,
          allowMultipleUploadBatches: true,
          restrictions: {
            maxNumberOfFiles: 500,
            maxFileSize: 50 * 1024 * 1024 * 1024, // 50 GB per file
          },
          info: (msg) => {
            console.log('[Uppy]', msg);
          }
        });

        // Configure AwsS3 plugin for direct Garage S3 uploads
        uppyInstance.use(AwsS3, {
          limit: 3, // Bound concurrency to 3 simultaneous uploads
          // Files > 20MB use multipart chunks; small files use single PUT
          shouldUseMultipart: (file) => (file.size || 0) > 20 * 1024 * 1024,
          generateObjectKey: (file) => file.meta.key || `albums/${albumId}/${file.name}`,
          signRequest: async (req) => {
            try {
              const res = await albumsApi.signS3Request(albumId, {
                method: req.method,
                key: req.key,
                uploadId: req.uploadId,
                partNumber: req.partNumber,
                contentType: req.contentType,
              });
              return {
                url: res.url,
                key: res.key
              };
            } catch (err) {
              console.error('Failed to sign S3 request:', err);
              throw err;
            }
          }
        });

        // Attach Dashboard UI
        uppyInstance.use(Dashboard, {
          target: containerRef.current,
          inline: true,
          height: 380,
          width: '100%',
          showProgressDetails: true,
          proudlyDisplayPoweredByUppy: false,
          note: 'Direct high-speed transfer to Garage S3 (large files never pass through website backend)',
          theme: 'light'
        });

        // Hook: Before uploading, prepare file on server & generate thumbnail in browser
        uppyInstance.on('file-added', async (file) => {
          try {
            // Check if archive mode or archive extension
            const isArchive = isArchiveMode || /\.(zip|tar|gz|tgz|rar|7z)$/i.test(file.name);
            const partMatch = file.name.match(/part\s*(\d+)/i) || file.name.match(/(\d+)\.zip$/i);
            const partNo = partMatch ? parseInt(partMatch[1], 10) : (isArchive ? archivePartNo : null);

            // Step 1: Call prepareMediaUpload
            const prep = await albumsApi.prepareMediaUpload(albumId, {
              filename: file.name,
              content_type: file.type || 'application/octet-stream',
              byte_size: file.size,
              is_archive: isArchive,
              archive_part_number: partNo
            });

            // Store server metadata on Uppy file
            uppyInstance.setFileMeta(file.id, {
              key: prep.object_key,
              mediaId: prep.media_id,
              previewKey: prep.preview_key,
              previewUploadUrl: prep.preview_upload_url,
              isArchive: isArchive,
            });

            // Step 2: Generate small preview thumbnail in browser and upload directly
            if (prep.preview_upload_url && file.data instanceof Blob && file.type?.startsWith('image/')) {
              generateThumbnailBlob(file.data).then((thumbBlob) => {
                if (thumbBlob) {
                  fetch(prep.preview_upload_url, {
                    method: 'PUT',
                    body: thumbBlob,
                    headers: { 'Content-Type': 'image/webp' }
                  }).catch((e) => console.warn('Thumbnail preview upload skipped:', e));
                }
              });
            }
          } catch (err) {
            console.error('Failed to prepare media upload:', err);
            uppyInstance.info(`Failed to prepare ${file.name}: ${err.message}`, 'error', 5000);
          }
        });

        // Hook: When individual file upload finishes, call backend to verify object in Garage S3
        uppyInstance.on('upload-success', async (file) => {
          const mediaId = file.meta?.mediaId;
          if (mediaId) {
            try {
              await albumsApi.completeMediaUpload(albumId, mediaId);
              setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1 }));
            } catch (err) {
              console.error(`Verification failed for ${file.name}:`, err);
              uppyInstance.info(`Storage verification failed for ${file.name}`, 'warning', 5000);
            }
          }
        });

        // Hook: Overall batch complete
        uppyInstance.on('complete', (result) => {
          setUploadStats((prev) => ({
            ...prev,
            total: (result.successful?.length || 0) + (result.failed?.length || 0),
            failed: result.failed?.length || 0
          }));
          if (result.successful?.length > 0 && onUploadComplete) {
            onUploadComplete();
          }
        });

        // Hook: User removed or cancelled file
        uppyInstance.on('file-removed', async (file) => {
          const mediaId = file.meta?.mediaId;
          if (mediaId && file.progress?.uploadStarted && !file.progress?.uploadComplete) {
            try {
              await albumsApi.abortMediaUpload(albumId, mediaId);
            } catch (e) {
              console.warn('Failed to notify backend abort:', e);
            }
          }
        });

        uppyRef.current = uppyInstance;
        setLoadingUppy(false);
      } catch (err) {
        console.error('Error initializing Uppy:', err);
        setErrorMsg('Failed to initialize upload component. Check network connection.');
        setLoadingUppy(false);
      }
    };

    initUppy();

    return () => {
      isSubscribed = false;
      if (uppyInstance) {
        try {
          uppyInstance.close();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen, albumId, isArchiveMode, archivePartNo, onUploadComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Upload to Cloud Storage: {albumTitle}
              </h3>
              <p className="text-xs text-stone-500">
                Direct browser upload to Ubuntu Garage S3 server (10–30 GB collections)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Mode Selector & Options */}
        <div className="px-6 py-3 bg-amber-50/40 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isArchiveMode}
                onChange={(e) => setIsArchiveMode(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300"
              />
              <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-amber-600" />
                Upload as Prepared ZIP Archive ("Download All" parts)
              </span>
            </label>

            {isArchiveMode && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Part No:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={archivePartNo}
                  onChange={(e) => setArchivePartNo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          <div className="text-xs text-stone-500 flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-stone-400" />
            <span>Max 3 concurrent transfers</span>
          </div>
        </div>

        {/* Interrupted Upload Recovery Banner */}
        <div className="px-6 py-2.5 bg-sky-50 border-b border-sky-100 flex items-start gap-2.5 text-xs text-sky-800">
          <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Interrupted Upload Recovery: </strong>
            Garage S3 multipart uploads are trackable. If your page reloads during upload, simply re-select the same files and start upload; completed chunks will automatically resume without restarting from scratch.
          </div>
        </div>

        {/* Uppy Dashboard Container */}
        <div className="p-6">
          {loadingUppy && (
            <div className="h-[380px] flex flex-col items-center justify-center gap-3 text-stone-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Initializing Garage S3 direct transfer pipeline...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div
            ref={containerRef}
            className={`w-full overflow-hidden rounded-xl border border-stone-200 ${loadingUppy ? 'hidden' : 'block'}`}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Files upload directly to Garage S3 via signed tokens. Server memory and bandwidth are 100% isolated.</span>
          </div>
          <button
            onClick={() => {
              if (onUploadComplete) onUploadComplete();
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
