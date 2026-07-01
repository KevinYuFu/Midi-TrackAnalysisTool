"""Settings models.

Two distinct layers, deliberately kept separate:

- `AnalysisSettings`  — per-conversion parameters (the synth knobs). These change
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


class SweepMode(str, Enum):
    snap = "snap"            # snap a pitch sweep to the note it lands on
    start_end = "start_end"  # emit start + end notes
    mpe = "mpe"              # full per-note pitch bend (MPE)


class Stem(str, Enum):
    bass = "bass"
    other = "other"
    vocals = "vocals"
    drums = "drums"


class AnalysisSettings(BaseModel):
    """Per-conversion parameters. `None` means "let the server guess"."""

    key: str | None = None            # e.g. "A minor"; None => auto-detect
    bpm: float | None = None          # None => auto-detect
    downbeat_ms: float = 0.0          # where beat 1 sits (ms) — anchors period sync
    period: str = "1/16"             # sync division: 1/4, 1/8, 1/16, 1/32 ... 1 (bar)
    waveshape: Waveshape = Waveshape.saw
    sweep_mode: SweepMode = SweepMode.snap
    stem: Stem = Stem.bass           # which separated stem to analyze
    separation_model: str = "demucs_htdemucs"

    threshold_db: float = -60.0       # spectral noise floor; ignore quieter content
    harmonic_strength: float = 0.7    # 0..1 — how hard to subtract harmonic templates
    unison_cluster: float = 0.5       # 0..1 — cluster detuned/unison peaks into one
    min_note_ms: float = 60.0         # shortest note the transcriber will emit
    max_polyphony: int = 6            # max simultaneous notes
    velocity_from_fft: bool = True    # derive velocity from spectral energy


class SuggestedSettings(BaseModel):
    """Server's first-pass guess plus which fields were assumed.

    The client highlights `assumed_fields` in the UI so the user knows what to
    double-check before running the main algorithm.
    """

    settings: AnalysisSettings
    assumed_fields: list[str] = Field(default_factory=list)


class AppSettings(BaseModel):
    """Global preferences. Persisted client-side (localStorage) for now."""

    theme: str = "dark"
    default_separation_model: str = "demucs_htdemucs"
    default_threshold_db: float = -60.0
    default_waveshape: Waveshape = Waveshape.saw
