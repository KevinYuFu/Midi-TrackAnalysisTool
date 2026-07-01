"""HTTP transport. Thin — all real work lives in `core`.

NOTE: `/process` runs synchronously for now, which is fine while the pipeline is
stubbed. Real Demucs takes minutes, so before wiring the ML deps this becomes a
background job + a `/jobs/{id}` status endpoint the client polls. Designed for
that from the start; not built yet.
"""
from __future__ import annotations

import json
import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..core import pipeline
from ..core.separation import list_models
from ..core.settings import AnalysisSettings, SuggestedSettings

router = APIRouter(prefix="/api")


def _save_upload(file: UploadFile, dest_dir: str) -> str:
    dest = os.path.join(dest_dir, file.filename or "input")
    with open(dest, "wb") as f:
        f.write(file.file.read())
    return dest


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/models")
def models() -> list[dict]:
    """Separation models available to the picker."""
    return [m.model_dump() for m in list_models()]


@router.post("/suggest", response_model=SuggestedSettings)
async def suggest(file: UploadFile = File(...)) -> SuggestedSettings:
    """Guess settings for an uploaded track (for the pre-run popup)."""
    with tempfile.TemporaryDirectory() as tmp:
        path = _save_upload(file, tmp)
        return pipeline.suggest_settings(path)


@router.post("/process")
async def process(
    file: UploadFile = File(...),
    settings: str = Form(...),
) -> FileResponse:
    """Run the full pipeline. `settings` is a JSON blob of AnalysisSettings."""
    try:
        parsed = AnalysisSettings(**json.loads(settings))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Bad settings: {e}") from e

    workdir = tempfile.mkdtemp(prefix="a2m_")
    audio_path = _save_upload(file, workdir)
    midi_path = pipeline.process(audio_path, parsed, workdir)
    return FileResponse(midi_path, media_type="audio/midi", filename="output.mid")
