"""Settings models.

Two distinct layers, deliberately kept separate:

- `AnalysisSettings`  — per-conversion parameters (the knob popup). These change
  every time you analyze a track.
- `AppSettings`       — global user preferences (theme, default model, defaults).
  These are set once in the preferences panel and stored client-side for now.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Waveshape(str, Enum):
    sine = "sine"
    triangle = "triangle"
    saw = "saw"
    square = "square"


class AnalysisSettings(BaseModel):
    """Per-conversion parameters. `None` means "let the server guess"."""

    key: str | None = None            # e.g. "A minor"; None => auto-detect
    bpm: float | None = None          # None => auto-detect
    period: str = "1/16"              # sync division: 1/4, 1/8, 1/16, 1/32 ... 1 (bar)
    waveshape: Waveshape = Waveshape.saw
    threshold_db: float = -60.0       # spectral noise floor; ignore quieter content
    stem: str = "bass"               # which separated stem to analyze
    separation_model: str = "demucs_htdemucs"


class SuggestedSettings(BaseModel):
    """Server's first-pass guess plus which fields were assumed.

    The client highlights `assumed_fields` in the popup so the user knows what
    to double-check before running the main algorithm.
    """

    settings: AnalysisSettings
    assumed_fields: list[str] = Field(default_factory=list)


class AppSettings(BaseModel):
    """Global preferences. Persisted client-side (localStorage) for now."""

    theme: str = "dark"
    default_separation_model: str = "demucs_htdemucs"
    default_threshold_db: float = -60.0
    default_waveshape: Waveshape = Waveshape.saw
