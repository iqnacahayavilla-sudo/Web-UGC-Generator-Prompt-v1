"""
Vercel Serverless Function for /api/generate endpoint
Sinergi Visual UGC Generator Prompt
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from server import app

# Vercel ASGI Handler
__all__ = ["app"]
