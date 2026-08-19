"""
Vercel Serverless Function Entrypoint for FastAPI Backend (Frontend Root Adapter)
Sinergi Visual UGC Generator Prompt
"""
import sys
import os
from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = FRONTEND_DIR.parent
BACKEND_DIR = ROOT_DIR / "backend"

for p in [str(BACKEND_DIR), str(ROOT_DIR), str(FRONTEND_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from server import app

# Vercel ASGI Handler
__all__ = ["app"]
