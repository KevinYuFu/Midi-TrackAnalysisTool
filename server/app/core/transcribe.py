"""Transcription core — the make-or-break part.

This is where the project's differentiator lives: use the assumed key +
waveshape to constrain a CQT peak-picking / harmonic-matching-pursuit search
(subtract the waveshape's harmonic template for each detected fundamental so
harmonics aren't mistaken for new notes).

Whether this is built from scratch or layered on top of a neural baseline
(Basic Pitch) is still an open decision — but either way it lives behind this
one function, so the choice doesn't leak into the rest of the app.

STUB: returns a C-major triad so the end-to-end pipeline produces valid MIDI.
"""
from __future__ import annotations

from .settings import AnalysisSettings
from .types import Note


def transcribe(stem_path: str, settings: AnalysisSettings) -> list[Note]:
    """Transcribe one stem into notes. STUB."""
    return [
        Note(pitch=60, start=0.0, end=1.0),  # C
        Note(pitch=64, start=0.0, end=1.0),  # E
        Note(pitch=67, start=0.0, end=1.0),  # G
    ]
