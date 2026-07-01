"""Settings models.

Two distinct layers, deliberately kept separate:

- `AnalysisSettings`  — per-conversion parameters sent with each track.
- `AppSettings`       — global user preferences (theme, model, spectral params),
  stored client-side for now.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Waveshape(str, Enum):
    sine = "sine"
    triangle = "triangle"
    saw = "saw"
    square = "square"


class SweepMode(str, Enum):
    snap = "snap"            # snap a pitch sweep to the note it lands on
    start_end = "start_end"  # emit start + end notes
    mpe = "mpe"              # full per-note pitch bend (MPE)


class AnalysisSettings(BaseModel):
    """Per-conversion parameters. The tool analyzes all stems together."""

    root: str = "C"                   # key root, e.g. "A"
    scale: str = "Minor"             # scale name, e.g. "Minor", "Dorian"
    bpm: float | None = None          # None => auto-detect
    downbeat_ms: float = 0.0          # where beat 1 sits (ms) — anchors period sync
    period: str = "1/16"             # sync division: 1/4, 1/8, 1/16, 1/32 ... 1 (bar)
    waveshape: Waveshape = Waveshape.saw
    sweep_mode: SweepMode = SweepMode.snap
    separation_model: str = "demucs_htdemucs"

    # Spectral params (edited in Preferences on the client).
    threshold_db: float = -60.0       # spectral noise floor
    harmonic_strength: float = 0.7    # 0..1 — how hard to subtract harmonic templates
    velocity_from_fft: bool = True    # derive velocity from spectral energy

    # Internal: unison/detune peaks are clustered automatically (not user-facing).
    unison_cluster: float = 0.5


class SuggestedSettings(BaseModel):
    """Server's first-pass guess plus which fields were assumed (for highlighting)."""

    settings: AnalysisSettings
    assumed_fields: list[str] = Field(default_factory=list)


class AppSettings(BaseModel):
    """Global preferences mirror. Persisted client-side (localStorage) for now."""

    theme: str = "dark"
    separation_model: str = "demucs_htdemucs"
    threshold_db: float = -60.0
    harmonic_strength: float = 0.7
    velocity_from_fft: bool = True
