"""Separation model registry.

Add a new backend by importing its class and registering it below. The API
exposes `list_models()` so the frontend picker stays in sync automatically.
"""
from __future__ import annotations

from .base import BaseSeparator, SeparationModelInfo
from .demucs_separator import DemucsSeparator

# id -> separator class
_SEPARATORS: dict[str, type[BaseSeparator]] = {
    DemucsSeparator.info.id: DemucsSeparator,
    # Future: MdxSeparator.info.id: MdxSeparator,
    #         RoformerSeparator.info.id: RoformerSeparator,
}

DEFAULT_MODEL = DemucsSeparator.info.id


def list_models() -> list[SeparationModelInfo]:
    """All registered models, for the settings picker."""
    return [cls.info for cls in _SEPARATORS.values()]


def get_separator(model_id: str) -> BaseSeparator:
    cls = _SEPARATORS.get(model_id)
    if cls is None:
        raise ValueError(f"Unknown separation model: {model_id!r}")
    return cls()
