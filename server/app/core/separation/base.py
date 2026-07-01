"""Stem-separation interface.

Every separation backend (Demucs today; MDX-Net / Roformer later) implements
`BaseSeparator`. The rest of the pipeline only ever talks to this interface, so
swapping models is adding a file + a registry entry, never a rewrite.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


class SeparationModelInfo(BaseModel):
    """Describes a model so the UI can populate the picker dynamically."""

    id: str                 # stable identifier, e.g. "demucs_htdemucs"
    name: str               # human label, e.g. "Demucs (htdemucs, 4-stem)"
    stems: list[str]        # stems it produces, e.g. ["drums","bass","other","vocals"]
    description: str


class BaseSeparator(ABC):
    """Contract for a stem separator."""

    info: SeparationModelInfo

    @abstractmethod
    def separate(self, audio_path: str, out_dir: str) -> dict[str, str]:
        """Split `audio_path` into stems.

        Returns a mapping of stem name -> path to that stem's audio file,
        written under `out_dir`.
        """
        raise NotImplementedError
