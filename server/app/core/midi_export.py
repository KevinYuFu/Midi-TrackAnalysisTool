"""Note list -> Standard MIDI File, using mido (light, pure-Python)."""
from __future__ import annotations

import mido

from .types import Note


def notes_to_midi(
    notes: list[Note],
    bpm: float = 120.0,
    path: str = "output.mid",
    ticks_per_beat: int = 480,
) -> str:
    mid = mido.MidiFile(ticks_per_beat=ticks_per_beat)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    tempo = mido.bpm2tempo(bpm)  # microseconds per beat
    track.append(mido.MetaMessage("set_tempo", tempo=tempo))
    sec_per_tick = (tempo / 1_000_000) / ticks_per_beat

    # Build absolute-time events, then convert to delta times.
    events: list[tuple[int, mido.Message]] = []
    for n in notes:
        start = int(round(n.start / sec_per_tick))
        end = int(round(n.end / sec_per_tick))
        events.append((start, mido.Message("note_on", note=n.pitch, velocity=n.velocity)))
        events.append((end, mido.Message("note_off", note=n.pitch, velocity=0)))

    # note_off before note_on at the same tick (msg_type: off=0 sorts first).
    events.sort(key=lambda e: (e[0], e[1].type == "note_on"))

    prev = 0
    for tick, msg in events:
        msg.time = tick - prev
        prev = tick
        track.append(msg)

    mid.save(path)
    return path
