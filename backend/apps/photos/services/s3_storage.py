import re
import urllib.parse
import logging
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError, EndpointConnectionError, ConnectTimeoutError
from django.conf import settings

logger = logging.getLogger(__name__)

class StorageUnavailableError(Exception):
    """Raised when Garage S3 object storage cannot be reached."""
    pass


class StorageNotFoundError(Exception):
    """Raised when a requested S3 object does not exist in the bucket."""
    pass


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes user-supplied filenames to prevent path traversal or header injection:
    - Strips directory paths
    - Replaces forbidden characters
    - Caps filename length to 200 characters
    """
    if not filename:
        return 'unnamed_file'
    # Remove directory separators
    clean = re.sub(r'[\\/]', '_', filename.strip())
    # Keep safe alphanumeric, dots, dashes, underscores, and spaces
    clean = re.sub(r'[^a-zA-Z0-9.\-_ ]', '_', clean)
    # Deduplicate underscores
    clean = re.sub(r'_+', '_', clean)
    # Truncate to reasonable length while preserving extension
    if len(clean) > 200:
        parts = clean.rsplit('.', 1)
        if len(parts) == 2:
            clean = f"{parts[0][:190]}.{parts[1][:9]}"
        else:
            clean = clean[:200]
    return clean or 'unnamed_file'


def get_s3_client(public: bool = False):
    """
    Constructs a boto3 S3 client configured for Garage S3 with SigV4 and path-style addressing.
    - public=False uses GARAGE_S3_ENDPOINT_URL for backend server-to-storage requests.
    - public=True uses GARAGE_S3_PUBLIC_URL for generating presigned URLs called directly by browsers.
    """
    endpoint = settings.GARAGE_S3_PUBLIC_URL if public else settings.GARAGE_S3_ENDPOINT_URL
    s3_config = Config(
        signature_version='s3v4',
        s3={'addressing_style': 'path'},
        connect_timeout=5,
        read_timeout=15,
        retries={'max_attempts': 3, 'mode': 'standard'}
    )
    return boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=settings.GARAGE_S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.GARAGE_S3_SECRET_ACCESS_KEY,
        region_name=settings.GARAGE_S3_REGION,
        config=s3_config
    )


def generate_presigned_upload_url(key: str, content_type: str = None, expires_in: int = 3600) -> str:
    """Generates a presigned PUT URL for single-request browser uploads."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
    }
    if content_type:
        params['ContentType'] = content_type
    return client.generate_presigned_url('put_object', Params=params, ExpiresIn=expires_in)


def generate_presigned_create_multipart_url(key: str, content_type: str = None, expires_in: int = 3600) -> str:
    """Generates a presigned POST URL with ?uploads for initiating a multipart upload."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
    }
    if content_type:
        params['ContentType'] = content_type
    return client.generate_presigned_url('create_multipart_upload', Params=params, ExpiresIn=expires_in)


def generate_presigned_part_url(key: str, upload_id: str, part_number: int, expires_in: int = 3600) -> str:
    """Generates a presigned PUT URL for uploading an individual multipart part."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
        'UploadId': upload_id,
        'PartNumber': int(part_number),
    }
    return client.generate_presigned_url('upload_part', Params=params, ExpiresIn=expires_in)


def generate_presigned_complete_multipart_url(key: str, upload_id: str, expires_in: int = 3600) -> str:
    """Generates a presigned POST URL for completing a multipart upload."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
        'UploadId': upload_id,
    }
    return client.generate_presigned_url('complete_multipart_upload', Params=params, ExpiresIn=expires_in)


def generate_presigned_abort_multipart_url(key: str, upload_id: str, expires_in: int = 3600) -> str:
    """Generates a presigned DELETE URL for aborting a multipart upload."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
        'UploadId': upload_id,
    }
    return client.generate_presigned_url('abort_multipart_upload', Params=params, ExpiresIn=expires_in)


def generate_presigned_list_parts_url(key: str, upload_id: str, expires_in: int = 3600) -> str:
    """Generates a presigned GET URL for listing already uploaded parts."""
    client = get_s3_client(public=True)
    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
        'UploadId': upload_id,
    }
    return client.generate_presigned_url('list_parts', Params=params, ExpiresIn=expires_in)


def generate_presigned_download_url(key: str, filename: str, expires_in: int = 300, inline: bool = False) -> str:
    """
    Generates a secure, short-lived presigned GET download URL.
    Enforces safe Content-Disposition with RFC 5987 / 6266 filename encoding.
    """
    client = get_s3_client(public=True)
    safe_name = sanitize_filename(filename)
    ascii_name = re.sub(r'[^a-zA-Z0-9.\-_]', '_', safe_name)
    encoded_name = urllib.parse.quote(safe_name)
    disposition_type = 'inline' if inline else 'attachment'
    content_disposition = f'{disposition_type}; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'

    params = {
        'Bucket': settings.GARAGE_S3_BUCKET_NAME,
        'Key': key,
        'ResponseContentDisposition': content_disposition,
    }
    return client.generate_presigned_url('get_object', Params=params, ExpiresIn=expires_in)


def verify_and_get_object_metadata(key: str) -> dict:
    """
    Verifies that the object exists in Garage S3 server-side via head_object.
    Returns metadata dict: {'size': int, 'etag': str, 'content_type': str}.
    Raises StorageNotFoundError or StorageUnavailableError.
    """
    client = get_s3_client(public=False)
    try:
        response = client.head_object(Bucket=settings.GARAGE_S3_BUCKET_NAME, Key=key)
        return {
            'size': int(response.get('ContentLength', 0)),
            'etag': (response.get('ETag') or '').strip('"'),
            'content_type': response.get('ContentType', 'application/octet-stream')
        }
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code in ('404', 'NoSuchKey', 'NotFound'):
            raise StorageNotFoundError(f"Object {key} not found in S3 bucket.")
        logger.error(f"S3 ClientError during head_object for key {key}: {error_code}")
        raise StorageUnavailableError(f"Storage error: {error_code}")
    except (EndpointConnectionError, ConnectTimeoutError) as e:
        logger.error(f"Cannot connect to Garage S3 endpoint: {e}")
        raise StorageUnavailableError("Garage storage server is currently unreachable.")
    except Exception as e:
        logger.error(f"Unexpected error communicating with Garage S3: {e}")
        raise StorageUnavailableError("Object storage service temporarily unavailable.")


def abort_multipart_upload_server(key: str, upload_id: str) -> bool:
    """Aborts a multipart upload server-side to free storage space."""
    client = get_s3_client(public=False)
    try:
        client.abort_multipart_upload(
            Bucket=settings.GARAGE_S3_BUCKET_NAME,
            Key=key,
            UploadId=upload_id
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to abort multipart upload {upload_id} for {key}: {e}")
        return False


def delete_object_server(key: str) -> bool:
    """Deletes an object server-side from Garage S3."""
    client = get_s3_client(public=False)
    try:
        client.delete_object(
            Bucket=settings.GARAGE_S3_BUCKET_NAME,
            Key=key
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to delete object {key} from S3: {e}")
        return False
