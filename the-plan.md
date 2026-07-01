# Claude Instructions
Application that converts audio to midi. I have the general implementation in mind, but if you have any ideas on better ways to approach certain aspects then give me suggestions.
Can be web app or desktop app. Let me know which is easy.
Would be great if I can make money off of this, maybe some subscription and use gmail accounts.

# The name
Needs a better name

# Look and feel
Modern, sleak. I'll want to search for some existing look and feels as references but maybe we can keep the idea of knobs for some of the values where it a knob would make sense (incremental changes vs jumps. A key should be typed, a threashold or the period can be a knob)

# Why
To help with track analysis, break down chords, or rewrite, but also to come up with ideas and study other tracks.
Take inspiration from serum 2 and speccomp. Also would be cool to have themes that we can switch between, I'll let you find some cool themes online that we can do. Definitely having a bass light and dark theme is important. I think overall the look has to be black and white, with neo blue and purple as highlights.

# The Plan
An audio to midi tool, different from other tools by using assumptions to help piece together a more accurate representation of the track.
The premis is to stem split, then use an fft to get spectral analysis on the track. Then we give the application some information. 
We provide the following information: Key of track, bpm of the track, period, and waveshape. The period is a syned value with the bpm, can be set to any regular interval of 1/4, 1/8, 1/32, up to a bar.
The key helps make assumptions on the notes being played. For the waveform, the algorithm would use peaks in the fft value, from low to high, to reconstruct the chord being played at the given interval.
Say if it were to be a saw, then we can interpolate which frequencies from the fft are generated from the harmonnics vs actually having a different note. We can use a threshold for the fft to ignore anything that's too quiet (Should also be in the settings with the other params). This app works without having to have all the information, but it will also attempt to guess the correct settings first before running the algorithm. The workflow here should probably be a popup, showing all the settings, and maybe highlight the values that are assumed, then the main algo would run.
In the case that there are note sweeps, like the pitch changes a little over time, we'd want the program to either grab the note it lands on, grab the starting and ending note, or generate the whole mpe if that's part of midi information. I know ableton has it in it's midi but Idk if that's standard.
By knowing the assumed waveform, we subtract from the resulting spectral analysis so there's no overlap or we're not generating notes that are way too high that would be resulting from harmonics. In the future, it would be cool to provide any sample, and we can interpolate it's fft, and generate the midi assuming it's using the provided sample. Importantly, it's possible, say the waveform is actually a square, and we set it to saw. We're okaywith just creating new harmonics, that's fine.
The Stem Separation will help us make further assumptions. To start, we can remove the drums, and we can track the vocals/instruments,bass separately. We can start with bass analsis to assume root/chord/key, then bulid up from there. To guess the key, we'd get a list of the notes being played, then using maybe step by step, grabbing startting from the most common frequencies to the least, we can start to guess what the notes in the scale are. Then using the notes in the bass to assume the key after knowing the notes in the scale. We can just assume either the chord at the start or the chord before the end is the root chord. We can also use any existing tritones to figure out the key as the V7 or the diminished 7th chord is used for tention before going back to the root. Note that this app only works for simple tracks, no keychanges, no bpm changes. If there are, we simple won't be able to handle it and the output should just be incorrect.
In terms of midi note length, they should be able to longer than the period itself, we don't want for exampels a bunch of 32nd notes for a chord progresssion changing on each bar. So, the tool should interpolate, using silences to find where to cut the track, maybe even use transiences to help know where to cut the midinotes, otherwise, we can assume that' it's just one long midi note. I Imagine in edm it won't be too big an issue as sidechaining will already break appart the midi notes. Oh I guess we could use change in velocity as well, but in the case that it's sidechain, idk if there's a good way to make it a single note (cause the value should still be there just quieter right? idk let's see) I guess we should also use velocity to match the fft as well.

# Future plans maybe
Would be cool to even be able to model white noise, so we can reverse engineer timbres as well. Maybe like generate wavetables off of fft interpolations, but then use white noise and result in a list of filters that would make the noise match what's in the sound.
