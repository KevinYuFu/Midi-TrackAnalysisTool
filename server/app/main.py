"""FastAPI entry point.

Run locally:
    cd server
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router

app = FastAPI(title="Audio-to-MIDI (working title)")

# The Vite dev server proxies /api, so CORS isn't strictly needed in dev, but
# this keeps direct browser calls working too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "audio-to-midi", "docs": "/docs"}
