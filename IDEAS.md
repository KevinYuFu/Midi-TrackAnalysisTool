# Future ideas / backlog

Running list of things we've talked about but deferred. Add freely.

## Waveform / beatgrid
- **Adaptive waveform fidelity based on BPM** — use the set BPM to choose how much
  time-resolution to render (finer for faster tracks / when zoomed to a beat).
- Tune the waveform RGB toward true Rekordbox colors (currently literal R=lows,
  G=mids, B=highs).
- A dedicated **zoom button / affordance** and a "reset view" control (we have the
  scroll wheel + a vertical zoom slider so far).
- Optional moving playback cursor while playing (today the playhead is fixed at
  center and the waveform doesn't scroll).
- **Auto-detect the downbeat / beatgrid** so the user only nudges it.

## Transcription core (the differentiator)
- Decide: from-scratch DSP (CQT peak-picking + harmonic-template subtraction) vs
  layering on a neural baseline (Basic Pitch). De-risk on reference tracks with
  known MIDI first.
- Automatic unison/detune handling (cluster high-energy FFT bins → one note).
- Pitch sweeps: snap / start+end / MPE export.

## Stems & audio
- Swap the separation model (MDX-Net / Roformer) behind `separation/` when quality
  needs it. Verify model-weight licenses before commercial use.

## Timbre / synthesis (longer term)
- Provide a sample, interpolate its FFT, and transcribe assuming that sample.
- Generate wavetables from FFT interpolations.
- Model white-noise timbres as a set of filters that match the sound.

## Product / infra
- Accounts (Google OAuth) + Stripe subscriptions.
- Move heavy jobs to Modal (pay-per-job GPU); background jobs + `/jobs/{id}` polling
  for long Demucs runs.
- Screenshot-based visual verification in the dev loop.
