"""Spectral analysis + musical estimation.

Stubbed for now. Real implementation (librosa) plan:
- detect_bpm  -> librosa.beat.beat_track
- detect_key  -> chroma / CQT pitch-class profile + Krumhansl-Schmuckler, refined
                 with bass-root and tritone heuristics from the design notes.
- spectrum    -> Constant-Q Transform (log-spaced bins align with semitones),
                 not raw FFT, for cleaner "which peak is which note".
"""
from __future__ import annotations


def detect_bpm(audio_path: str) -> float:
    """Estimate tempo. STUB."""
    return 120.0


def detect_key(audio_path: str) -> tuple[str, str]:
    """Estimate key as (root, scale), e.g. ("A", "Minor"). STUB."""
    return ("A", "Minor")
