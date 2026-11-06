import re
import secrets
import hashlib
import hmac
from django.contrib.auth.hashers import make_password, check_password
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

# Unambiguous characters for passkeys (excluding 0, O, 1, I, L)
UNAMBIGUOUS_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

STOP_WORDS = {'groom', 'bride', 'mr', 'mrs', 'ms', 'and'}

def normalize_name_key(groom_name: str, bride_name: str) -> str:
    """
    Normalizes groom and bride names for robust matching:
    - Lowercase
    - Strip common prefixes/stop words ('groom', 'bride', 'mr', 'mrs', 'and')
    - Strip punctuation and symbols
    - Split into individual words
    - Sort words alphabetically
    - Join with a single space
    Example: 'Groom: John Doe' & 'Bride: Jane Smith' -> 'doe jane john smith'
             'Jane Smith' & 'John Doe' -> 'doe jane john smith'
    """
    combined = f"{groom_name or ''} {bride_name or ''}".lower()
    # Replace non-alphanumeric characters with spaces
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', combined)
    words = [w for w in cleaned.split() if w and w not in STOP_WORDS]
    words.sort()
    return " ".join(words)

def generate_passkey(length: int = 8) -> str:
    """
    Generates an 8-character formatted passkey from unambiguous characters.
    Example: 'K7M2-9QXA'
    """
    part1 = "".join(secrets.choice(UNAMBIGUOUS_CHARS) for _ in range(4))
    part2 = "".join(secrets.choice(UNAMBIGUOUS_CHARS) for _ in range(4))
    return f"{part1}-{part2}"

def hash_passkey(raw_passkey: str) -> str:
    """Cryptographically hashes a passkey using Django's default hasher."""
    return make_password(raw_passkey.strip().upper())

def verify_passkey(raw_passkey: str, hashed_passkey: str) -> bool:
    """Verifies a raw passkey against a stored hash using constant-time check."""
    if not raw_passkey or not hashed_passkey:
        return False
    return check_password(raw_passkey.strip().upper(), hashed_passkey)

def generate_download_token() -> str:
    """Generates a secure 64-character URL-safe random download token."""
    return secrets.token_urlsafe(48)

def hash_download_token(raw_token: str) -> str:
    """Returns SHA256 hex digest of the download token."""
    return hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()

def verify_download_token(raw_token: str, token_hash: str) -> bool:
    """Constant-time comparison for download token verification."""
    computed = hash_download_token(raw_token)
    return hmac.compare_digest(computed, token_hash)

# Signer for 30-minute verified client sessions
_client_session_signer = TimestampSigner(salt='wedding-client-session-salt')

def sign_client_session(client_id: str) -> str:
    """Generates a cryptographically signed timestamped token containing the client_id."""
    return _client_session_signer.sign(str(client_id))

def verify_client_session(signed_token: str, max_age_seconds: int = 1800) -> str | None:
    """
    Verifies the client session token. Returns client_id string if valid,
    or None if expired (over 30 mins) or tampered with.
    """
    if not signed_token:
        return None
    try:
        unsigned_client_id = _client_session_signer.unsign(signed_token, max_age=max_age_seconds)
        return unsigned_client_id
    except (BadSignature, SignatureExpired):
        return None

