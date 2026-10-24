"""Vercel's supported FastAPI entrypoint; also usable by any ASGI host."""
from backend.app import app

__all__ = ["app"]
