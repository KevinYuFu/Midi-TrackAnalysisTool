"""The compute core, decoupled from transport.

`suggest_settings()` and `process()` are plain functions with clear inputs and
outputs. They don't know or care whether they're called from a local FastAPI
process, a cheap CPU VM, or a Modal pay-per-job GPU function later.
"""
from __future__ import annotations

import os

from . import analysis, midi_export, transcribe
from .separation import get_separator
from .settings import AnalysisSettings, SuggestedSettings

# Fields the server guesses when analyzing a track.
_ASSUMED = ["root", "scale", "bpm", "period"]


def suggest_settings(audio_path: str) -> SuggestedSettings:
    """First pass: guess settings so the UI can pre-fill and highlight them."""
    root, scale = analysis.detect_key(audio_path)
    settings = AnalysisSettings(root=root, scale=scale, bpm=analysis.detect_bpm(audio_path))
    return SuggestedSettings(settings=settings, assumed_fields=list(_ASSUMED))


def process(audio_path: str, settings: AnalysisSettings, out_dir: str) -> str:
    """Full run: separate into all stems -> transcribe -> merge -> export MIDI.

    Returns the path to the written MIDI file.
    """
    separator = get_separator(settings.separation_model)
    try:
        stems = separator.separate(audio_path, out_dir)  # all stems
    except NotImplementedError:
        stems = {}  # skeleton fallback: no ML installed yet

    # TODO: transcribe across all stems and merge into one MIDI. Stub uses the
    # raw input so the app runs end-to-end.
    _ = stems
    notes = transcribe.transcribe(audio_path, settings)
    midi_path = os.path.join(out_dir, "output.mid")
    midi_export.notes_to_midi(notes, bpm=settings.bpm or 120.0, path=midi_path)
    return midi_path
