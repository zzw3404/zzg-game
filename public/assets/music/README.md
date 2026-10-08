# Original Celtic game music

- `stonegate-at-dusk-loop`: harp, lute and flute; 80 seconds, 3/4, 72 BPM. Town, title, exploration and victory.
- `ember-charge-loop`: whistle, lute and war drums; 40 seconds, 6/8. Enemy encounters and boss battles.

OGG is the first playback format; MP3 is a decoding fallback. Both contain the complete loop period.
Loop tails and room reflections are rendered circularly, so there is no introduction, final fade or inserted silence.
The music controller in `src/audio/music.js` decodes each track once, loops on the Web Audio clock, and crossfades states.

These are original compositions rendered with original synthesised voices, without third-party music or recordings.
Re-render using `tools/audio/render-stonegate.py` and `tools/audio/render-celtic-battle.py`.
Full listening previews, WAV masters, MIDI and measurement reports are in `audio-previews/`.
