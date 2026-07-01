"""Shared data types for the analysis pipeline."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Note:
    """A single transcribed MIDI note.

    Times are in seconds; `pitch` is a MIDI note number (0-127).
    `pitch_bend` is reserved for later MPE / pitch-sweep support.
    """

    pitch: int
    start: float
    end: float
    velocity: int = 100
    pitch_bend: list[tuple[float, float]] | None = None  # (time_s, semitones)
