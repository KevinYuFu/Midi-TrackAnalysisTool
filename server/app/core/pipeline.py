"""The compute core, decoupled from transport.

`suggest_settings()` and `process()` are plain functions with clear inputs and
outputs. They don't know or care whether they're called from a local FastAPI
process, a cheap CPU VM, or a Modal pay-per-job GPU function later. Keep it that
way: the "where it runs" stays a deployment detail.
"""
from __future__ import annotations

import os

from . import analysis, midi_export, transcribe
from .separation import get_separator
from .settings import AnalysisSettings, SuggestedSettings

# Fields the server guesses when the user hasn't supplied them.
_ASSUMED = ["key", "bpm", "period", "waveshape", "threshold_db"]


def suggest_settings(audio_path: str) -> SuggestedSettings:
    """First pass: guess settings so the UI can pre-fill and highlight them."""
    settings = AnalysisSettings(
        key=analysis.detect_key(audio_path),
        bpm=analysis.detect_bpm(audio_path),
    )
    return SuggestedSettings(settings=settings, assumed_fields=list(_ASSUMED))


def process(audio_path: str, settings: AnalysisSettings, out_dir: str) -> str:
    """Full run: separate -> transcribe target stem -> export MIDI.

    Returns the path to the written MIDI file.
    """
    separator = get_separator(settings.separation_model)
    try:
        stems = separator.separate(audio_path, out_dir)
        stem_path = stems.get(settings.stem, audio_path)
    except NotImplementedError:
        # Skeleton fallback: no ML installed yet — analyze the raw input.
        stem_path = audio_path

    notes = transcribe.transcribe(stem_path, settings)
    midi_path = os.path.join(out_dir, "output.mid")
    midi_export.notes_to_midi(notes, bpm=settings.bpm or 120.0, path=midi_path)
    return midi_path
