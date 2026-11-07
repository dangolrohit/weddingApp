import os
import re
import uuid
import shutil
import mimetypes
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, FileResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@method_decorator(csrf_exempt, name='dispatch')
class DevS3MockView(View):
    """
    Lightweight, drop-in local development mock S3 server.
    Handles:
    - CORS preflights (OPTIONS)
    - Single PUT object uploads
    - Multipart uploads (?uploads, ?uploadId, ?partNumber)
    - HEAD object inspection
    - GET object retrieval and downloads
    - DELETE object / abort multipart
    Only used in local development when Garage is not running or GARAGE_S3_USE_LOCAL_MOCK=True.
    In production, files upload directly to Garage S3 on Ubuntu without passing through Django.
    """

    def _cors_response(self, response: HttpResponse) -> HttpResponse:
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, HEAD, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        response['Access-Control-Expose-Headers'] = 'ETag, Content-Length, Content-Type, Content-Disposition'
        response['Access-Control-Max-Age'] = '86400'
        return response

    def _get_storage_dir(self) -> Path:
        base = Path(settings.MEDIA_ROOT) / 'dev_s3'
        base.mkdir(parents=True, exist_ok=True)
        return base

    def _get_chunks_dir(self) -> Path:
        chunks = Path(settings.MEDIA_ROOT) / 'dev_s3_chunks'
        chunks.mkdir(parents=True, exist_ok=True)
        return chunks

    def _extract_key(self, path: str) -> str:
        # Strip leading bucket name if present (e.g. 'wedding-storage/albums/...' -> 'albums/...')
        bucket = getattr(settings, 'GARAGE_S3_BUCKET_NAME', 'wedding-storage')
        clean = path.strip('/')
        if clean.startswith(f"{bucket}/"):
            clean = clean[len(bucket) + 1:]
        return clean

    def options(self, request, *args, **kwargs):
        """Respond 200 to CORS preflight OPTIONS requests."""
        resp = HttpResponse(status=200)
        return self._cors_response(resp)

    def put(self, request, path='', *args, **kwargs):
        """Handle single-part upload or multipart part upload."""
        key = self._extract_key(path)
        upload_id = request.GET.get('uploadId')
        part_number = request.GET.get('partNumber')

        if upload_id and part_number:
            # Multipart Part upload
            chunk_dir = self._get_chunks_dir() / upload_id
            chunk_dir.mkdir(parents=True, exist_ok=True)
            part_file = chunk_dir / f"part_{int(part_number):05d}"
            with open(part_file, 'wb') as f:
                f.write(request.body)
            etag = f'"part-{part_number}"'
            resp = HttpResponse(status=200)
            resp['ETag'] = etag
            return self._cors_response(resp)

        # Single PUT object upload
        dest_path = self._get_storage_dir() / key
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, 'wb') as f:
            f.write(request.body)

        etag = f'"dev-{uuid.uuid4().hex[:12]}"'
        resp = HttpResponse(status=200)
        resp['ETag'] = etag
        return self._cors_response(resp)

    def post(self, request, path='', *args, **kwargs):
        """Handle InitiateMultipartUpload (?uploads) and CompleteMultipartUpload (?uploadId)."""
        key = self._extract_key(path)
        bucket = getattr(settings, 'GARAGE_S3_BUCKET_NAME', 'wedding-storage')

        # 1. Initiate Multipart Upload
        if 'uploads' in request.GET:
            upload_id = uuid.uuid4().hex
            chunk_dir = self._get_chunks_dir() / upload_id
            chunk_dir.mkdir(parents=True, exist_ok=True)

            xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>{bucket}</Bucket>
  <Key>{key}</Key>
  <UploadId>{upload_id}</UploadId>
</InitiateMultipartUploadResult>"""
            resp = HttpResponse(xml_body, content_type='application/xml', status=200)
            return self._cors_response(resp)

        # 2. Complete Multipart Upload
        upload_id = request.GET.get('uploadId')
        if upload_id:
            chunk_dir = self._get_chunks_dir() / upload_id
            dest_path = self._get_storage_dir() / key
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Assemble all parts in numerical order
            if chunk_dir.exists():
                part_files = sorted(chunk_dir.glob("part_*"))
                with open(dest_path, 'wb') as outfile:
                    for pf in part_files:
                        with open(pf, 'rb') as infile:
                            shutil.copyfileobj(infile, outfile)
                shutil.rmtree(chunk_dir, ignore_errors=True)

            xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Location>http://127.0.0.1:8000/api/dev-s3/{bucket}/{key}</Location>
  <Bucket>{bucket}</Bucket>
  <Key>{key}</Key>
  <ETag>"completed-multipart"</ETag>
</CompleteMultipartUploadResult>"""
            resp = HttpResponse(xml_body, content_type='application/xml', status=200)
            return self._cors_response(resp)

        resp = HttpResponse(status=400)
        return self._cors_response(resp)

    def head(self, request, path='', *args, **kwargs):
        """Respond with object metadata (size, content-type, etag)."""
        key = self._extract_key(path)
        dest_path = self._get_storage_dir() / key
        if not dest_path.exists():
            resp = HttpResponse(status=404)
            return self._cors_response(resp)

        stat = dest_path.stat()
        content_type, _ = mimetypes.guess_type(str(dest_path))
        resp = HttpResponse(status=200)
        resp['Content-Length'] = str(stat.st_size)
        resp['Content-Type'] = content_type or 'application/octet-stream'
        resp['ETag'] = f'"dev-{stat.st_mtime_ns}"'
        return self._cors_response(resp)

    def get(self, request, path='', *args, **kwargs):
        """Serve uploaded file or download archive."""
        key = self._extract_key(path)
        dest_path = self._get_storage_dir() / key
        if not dest_path.exists():
            resp = HttpResponse(status=404)
            return self._cors_response(resp)

        content_type, _ = mimetypes.guess_type(str(dest_path))
        response = FileResponse(open(dest_path, 'rb'), content_type=content_type or 'application/octet-stream')

        # Custom filename or response-content-disposition if requested
        rcd = request.GET.get('response-content-disposition') or request.GET.get('ResponseContentDisposition')
        if rcd:
            response['Content-Disposition'] = rcd
        elif request.GET.get('filename'):
            response['Content-Disposition'] = f'attachment; filename="{request.GET["filename"]}"'

        return self._cors_response(response)

    def delete(self, request, path='', *args, **kwargs):
        """Delete object or abort multipart upload."""
        upload_id = request.GET.get('uploadId')
        if upload_id:
            chunk_dir = self._get_chunks_dir() / upload_id
            shutil.rmtree(chunk_dir, ignore_errors=True)
            resp = HttpResponse(status=204)
            return self._cors_response(resp)

        key = self._extract_key(path)
        dest_path = self._get_storage_dir() / key
        if dest_path.exists():
            dest_path.unlink()

        resp = HttpResponse(status=204)
        return self._cors_response(resp)
