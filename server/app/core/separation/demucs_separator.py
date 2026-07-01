"""Demucs backend (default).

Meta's Hybrid Transformer Demucs. The 4-stem model maps directly onto the
pipeline's needs: drop `drums`, analyze `bass` first, then build up.

The `separate()` body is stubbed until `requirements-ml.txt` is installed. Until
then the pipeline falls back to analyzing the raw input so the app runs
end-to-end.
"""
from __future__ import annotations

from .base import BaseSeparator, SeparationModelInfo


class DemucsSeparator(BaseSeparator):
    info = SeparationModelInfo(
        id="demucs_htdemucs",
        name="Demucs (htdemucs, 4-stem)",
        stems=["drums", "bass", "other", "vocals"],
        description="Meta Hybrid Transformer Demucs. Clean 4-stem default.",
    )

    def separate(self, audio_path: str, out_dir: str) -> dict[str, str]:
        # TODO: wire real Demucs, e.g. shell out:
        #   python -m demucs -n htdemucs -o <out_dir> <audio_path>
        # then return {stem: <out_dir>/htdemucs/<track>/<stem>.wav}
        raise NotImplementedError(
            "Install requirements-ml.txt and wire Demucs here. "
            "Return {stem_name: path_to_wav}."
        )
