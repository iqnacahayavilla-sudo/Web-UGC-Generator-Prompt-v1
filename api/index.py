"""
Vercel Serverless Function Entrypoint for FastAPI Backend
Sinergi Visual UGC Generator Prompt
"""
import sys
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

for p in [str(BACKEND_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from server import app
except Exception as e:
    import traceback
    err_str = traceback.format_exc()
    print(f"[FATAL SERVER INIT ERROR] {err_str}")
    from fastapi import FastAPI, Response
    app = FastAPI()
    @app.api_route("/{path:path}", methods=["GET", "POST", "OPTIONS", "HEAD", "PUT", "DELETE"])
    def error_handler(path: str):
        return Response(
            content=f"Server Initialization Error:\n{err_str}",
            status_code=500,
            media_type="text/plain"
        )

# Vercel ASGI Handler
__all__ = ["app"]
