"""Storage service for product images.
Supports local filesystem storage with seamless fallback to Emergent Object Storage if configured.
"""
import os
import uuid
import logging
from pathlib import Path

logger = logging.getLogger("storage_service")

ROOT_DIR = Path(__file__).resolve().parent.parent
# In Vercel serverless functions, root filesystem is read-only, use /tmp/uploads
if os.environ.get("VERCEL") or not os.access(ROOT_DIR, os.W_OK):
    UPLOAD_DIR = Path("/tmp") / "uploads"
else:
    UPLOAD_DIR = ROOT_DIR / "uploads"

MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _emergent_key():
    return os.environ.get("EMERGENT_LLM_KEY")


def init_storage(force: bool = False):
    """Initialize storage (ensure uploads folder exists)."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Local storage directory ready at: {UPLOAD_DIR}")
    return "local_storage"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Save object to local uploads directory or remote if configured."""
    init_storage()
    # Normalize path (e.g., if path is 'ugc-prompt-studio/products/xxx.jpg' or 'xxx.jpg')
    filename = os.path.basename(path)
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(data)
    return {"path": filename, "content_type": content_type, "size": len(data)}


def get_object(path: str):
    """Retrieve object content from local uploads directory."""
    filename = os.path.basename(path)
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise FileNotFoundError(f"File {path} not found")
    
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    with open(file_path, "rb") as f:
        content = f.read()
    return content, content_type


def upload_product_image(data: bytes, ext: str) -> dict:
    """Save an uploaded product image."""
    ext = ext.lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    filename = f"{uuid.uuid4()}.{ext}"
    result = put_object(filename, data, content_type)
    return {"path": result["path"], "content_type": content_type, "size": result.get("size")}
