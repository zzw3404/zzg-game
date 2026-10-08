"""Original restful town cue: harp, lute and concert flute. No borrowed recordings."""
from render_kit import ROOT, SR, np, json, Mix, harp, lute, flute, publish, write_midi

TITLE = 'Stonegate at Dusk / 石闸暮光'
CUE = 'stonegate-at-dusk'
BPM = 72
BEAT = 60/BPM
BAR = 3*BEAT
START = .14
N_BARS = 40
rng = np.random.default_rng(20261008)
full = Mix(START+N_BARS*BAR+3.8, ['harp', 'lute', 'flute'])
# The central 32 bars form a complete harmonic cycle. Tails wrap into the next repetition.
loop = Mix(32*BAR, ['harp', 'lute', 'flute'], circular=True, origin=START+4*BAR)
events = []

CHORDS = {
    'G': [43, 55, 59, 62, 67, 71],
    'D': [38, 50, 57, 62, 66, 69],
    'Em': [40, 52, 55, 59, 64, 67],
    'C': [36, 48, 55, 60, 64, 67],
    'Am': [45, 52, 57, 60, 64, 69],
}
PLAN_A = ['G', 'D', 'Em', 'C', 'G', 'Am', 'C', 'D']
PLAN_B = ['Em', 'C', 'G', 'D', 'Em', 'Am', 'C', 'D']
# Three quarter-note beats per measure, with small breathing gaps between phrases.
A = [
    [(79,1.5),(81,.5),(83,1)],
    [(81,1),(78,.5),(76,.5),(74,1)],
    [(76,1.5),(79,.5),(83,1)],
    [(84,1),(83,1),(79,.5),(None,.5)],
    [(83,1),(81,.5),(79,.5),(74,1)],
    [(76,1.5),(79,.5),(81,1)],
    [(79,1),(76,1),(74,1)],
    [(78,1),(76,.5),(74,.5),(None,1)],
]
B = [
    [(76,1),(79,1),(83,1)],
    [(84,1.5),(83,.5),(79,1)],
    [(83,1),(86,1),(83,.5),(None,.5)],
    [(81,1.5),(78,.5),(74,1)],
    [(79,1),(83,.5),(81,.5),(79,1)],
    [(81,1),(79,1),(76,1)],
    [(79,1.5),(76,.5),(72,1)],
    [(74,1),(78,1),(None,1)],
]

def play(part, pitch, time, duration, velocity, voice, gain, pan):
    audio = voice(pitch, duration) if part == 'flute' else voice(pitch, bar%3)
    full.add(part, audio, time, gain*velocity, pan)
    if 4 <= bar < 36:
        loop.add(part, audio, time, gain*velocity, pan)
    events.append(dict(part=part, note=int(pitch), time=float(time), duration=float(duration), velocity=float(velocity)))

for bar in range(N_BARS):
    t = START+bar*BAR
    middle = 20 <= bar < 28
    if bar < 4:
        chord = ['G','C','Am','D'][bar]
    elif bar >= 36:
        chord = ['C','Am','D','G'][bar-36]
    else:
        chord = (PLAN_B if middle else PLAN_A)[(bar-20 if middle else bar-4)%8]
    notes = CHORDS[chord]
    # Harp: a light ascending/returning figure, warm bass and occasional upper harmonics.
    pattern = [notes[1], notes[2], notes[3], notes[4], notes[3], notes[2]]
    for step, pitch in enumerate(pattern):
        if bar == 39 and step > 0:
            continue
        onset = t+step*BEAT*.5+rng.uniform(-.009, .009)
        velocity = (.77 if step == 0 else .54)*rng.uniform(.93, 1.07)
        play('harp', pitch, onset, BEAT*.9, velocity, harp, .095, -.27)
    if bar%2 == 0 or bar == 39:
        play('harp', notes[0], t, BEAT*2.8, .65, harp, .15, -.12)
    # Lute: a soft bass on the first beat and a brushed chord reply on the third.
    play('lute', notes[1], t+.025, BEAT*1.8, .62, lute, .063, .23)
    if bar != 39:
        for course, pitch in enumerate(notes[2:5]):
            play('lute', pitch, t+2*BEAT+.010*course, BEAT*.85, .39, lute, .045, .31)
    if 12 <= bar < 20 or 28 <= bar < 36:
        play('harp', notes[4]+12, t+2.5*BEAT, BEAT*.7, .36, harp, .055, -.35)
    # Flute enters after the instrumental invitation and leaves two bars of air between repetitions.
    if bar < 4:
        phrase = []
    elif bar >= 36:
        phrase = [[(79,1.5),(76,1.5)],[(81,1),(79,1),(76,1)],[(78,1.5),(74,1.5)],[(79,3)]][bar-36]
    elif 18 <= bar < 20 or 34 <= bar < 36:
        phrase = []
    else:
        phrase = (B if middle else A)[(bar-20 if middle else bar-4)%8]
    offset = 0
    for pitch, beats in phrase:
        if pitch is not None:
            onset = t+offset*BEAT+rng.uniform(-.012, .012)
            duration = max(.18, beats*BEAT-.08)
            velocity = (.66 if middle else .61)*rng.uniform(.96, 1.04)
            play('flute', pitch, onset, duration, velocity, lambda m, d: flute(m, d, rng), .145, .045)
        offset += beats
    assert not phrase or offset == 3

settings = {'harp':(.26,.40), 'lute':(.18,.29), 'flute':(.32,.47)}
print('Town score rendered; mastering preview and circular loop...', flush=True)
preview = publish(full.render(settings), CUE, target=-19)
game = publish(loop.render(settings), CUE, loop=True, target=-19)
out = ROOT/'audio-previews'/CUE
write_midi(events, out/f'{CUE}.mid', TITLE, BPM, (3,4), [('harp',0,46,47),('lute',1,24,83),('flute',2,73,67)], 'G')
(out/'score.json').write_text(json.dumps(events, indent=2), encoding='utf8')
(out/'README.md').write_text('''# 石闸暮光 · Stonegate at Dusk

原创主城曲，竖琴、鲁特琴、长笛合成音色，3/4 拍，72 BPM，G 大调。
试听约 104 秒；游戏循环 80 秒，包含主旋律、应答和再现。
循环在合成与混响阶段保留跨边界的声音尾部，不含试听版的开头和收尾。
MP3/WAV 是试听和母带，MIDI 可编辑；游戏使用 public/assets/music 中的循环文件。
没有使用第三方录音或已有曲目。生成脚本：tools/audio/render-stonegate.py。
''', encoding='utf8')
print(json.dumps(dict(title=TITLE, preview=preview, game=game), ensure_ascii=False, indent=2), flush=True)
