# Audio → MIDI (working title)

Convert audio to MIDI by using **musical assumptions** (key, waveshape, harmonic
structure) to constrain the transcription — aimed at simple, single-key tracks
for study, chord breakdown, and idea generation.

## Architecture

```
client/                 React + TypeScript + Vite (the UI)
server/                 Python + FastAPI (compute)
  app/
    main.py              FastAPI entry
    api/routes.py        HTTP transport (thin)
    core/
      pipeline.py        process() / suggest_settings()  ← the compute seam
      separation/        pluggable stem-split models (Demucs today)
      analysis.py        BPM / key / spectral estimation (librosa)
      transcribe.py      the transcription core (the differentiator)
      midi_export.py     notes → Standard MIDI File
      settings.py        AnalysisSettings (per-run) + AppSettings (global)
```

**Key design rule:** the DSP/ML lives behind two plain functions —
`suggest_settings(audio)` and `process(audio, settings)`. Transport (local
FastAPI now; a cheap CPU VM at beta; Modal pay-per-job GPU at scale) is a
deployment detail that never leaks into the algorithm.

**Two settings layers:**
- *Per-conversion* (`AnalysisSettings`): key, bpm, period, waveshape, threshold,
  stem — the knob popup, with auto-guessed fields highlighted.
- *Global* (`AppSettings`): theme + default stem model — the Preferences panel.

**Pluggable separation:** models register in `core/separation/`. Demucs is the
default; MDX-Net / Roformer drop in as new files behind the same interface, and
the picker updates automatically via `/api/models`.

## Run it (dev)

**Quickest:** `./dev.sh` — starts the API + web client together. Edit any file
and just refresh http://localhost:5173 (Vite hot-reloads; Ctrl-C stops both).

Or run the two halves manually in separate terminals:

**Server** (runs end-to-end on stubs — no heavy deps needed yet):
```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Client:**
```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Upload any audio file → it "analyzes" (stub) → adjust settings → Convert
downloads a valid `.mid` (currently a placeholder C-major chord).

## Build-out order

1. **De-risk the transcription core** (`transcribe.py`) on reference tracks with
   known MIDI — this is make-or-break. Requires `requirements-analysis.txt`.
2. Wire real Demucs (`separation/demucs_separator.py`) — `requirements-ml.txt`.
   ⚠️ Verify model **weight** licenses before commercial use.
3. Real BPM/key detection (`analysis.py`).
4. Background jobs + `/jobs/{id}` polling (Demucs takes minutes; the sync
   `/process` is a placeholder).
5. Accounts (Google OAuth) + Stripe, then Modal for pay-per-job GPU.

## Status

Skeleton. Every DSP/ML step is a documented stub; the full request→response loop
works so the seams are proven before the hard parts land.
