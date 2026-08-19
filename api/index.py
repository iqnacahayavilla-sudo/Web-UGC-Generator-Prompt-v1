"""
Vercel Serverless Function Entrypoint for FastAPI Backend
Sinergi Visual UGC Generator Prompt
"""
import sys
import os
from pathlib import Path

# Ensure backend directory is in Python path for module resolution
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Import the FastAPI application instance from backend.server
from server import app

# Vercel WSGI/ASGI Serverless Handler
# Vercel looks for the 'app' object in the entrypoint file
__all__ = ["app"]
