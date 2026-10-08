"""Render an original Celtic battle cue, 'Ember Charge', with no borrowed recordings.

Run with Python + numpy/scipy/soundfile/mido/imageio-ffmpeg. For the local preview,
dependencies may also be installed in shots/audio-python (outside the game bundle).
The three voices are a breathy fipple-whistle model, paired plucked strings with
wood-body resonances, and frame/war drums. This script does not change game audio.
"""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'shots' / 'audio-python'))
sys.path.insert(0, str(ROOT / 'shots' / 'audio-python-fast'))
import json
import math
import subprocess
from functools import lru_cache
import numpy as np
import scipy.signal as sig
import soundfile as sf
import mido
import imageio_ffmpeg
from render_kit import Mix, publish

OUT = ROOT / 'audio-previews' / 'ember-charge'
OUT.mkdir(parents=True, exist_ok=True)
SR = 44100
BPM = 144
EIGHTH = 60 / BPM / 2
BAR = EIGHTH * 6
START = .12
DURATION = START + 64 * BAR + 2.4
N = math.ceil(DURATION * SR)
rng = np.random.default_rng(20261007)
stems = {name: np.zeros((N, 2), np.float32) for name in ['whistle', 'lute', 'drums']}
events = []
game_loop = Mix(40, ['whistle', 'lute', 'drums'], circular=True, origin=START+4*BAR)
loop_active = False

def hz(m):
    return 440 * 2 ** ((m - 69) / 12)

def db(x):
    return float(20 * np.log10(max(float(x), 1e-12)))

def filter_audio(x, cutoff, kind='lowpass', order=2):
    return sig.sosfilt(sig.butter(order, cutoff, btype=kind, fs=SR, output='sos'), x)

def envelope(n, attack=.013, release=.035):
    e = np.ones(n)
    a, r = min(n // 2, int(attack * SR)), min(n // 2, int(release * SR))
    e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    e[-r:] = np.sin(np.linspace(np.pi / 2, 0, r)) ** 2
    return e

def add(name, audio, time, gain, pan=0):
    if loop_active:
        game_loop.add(name, audio, time, gain, pan)
    offset = max(0, round(time * SR))
    n = min(len(audio), N - offset)
    if n <= 0:
        return
    angle = (pan + 1) * np.pi / 4
    stems[name][offset:offset+n, 0] += (audio[:n] * gain * np.cos(angle)).astype(np.float32)
    stems[name][offset:offset+n, 1] += (audio[:n] * gain * np.sin(angle)).astype(np.float32)

def note_event(part, midi, time, dur, velocity, pan=0):
    events.append(dict(part=part, note=int(midi), time=float(time), duration=float(dur), velocity=float(velocity), pan=float(pan)))

def whistle(midi, dur, ornament=0, strength=.8):
    n = max(200, round((dur + .035) * SR))
    t = np.arange(n) / SR
    vibrato = .10 * np.sin(2*np.pi*(5.25 + rng.uniform(-.18, .18))*t + rng.uniform(0, 6)) * np.clip((t-.15)/.20, 0, 1)
    drift = .014 * np.sin(2*np.pi*1.2*t + rng.uniform(0, 6))
    pitch = vibrato + drift - .22*np.exp(-t/.018)
    # Short finger cuts and taps articulate the note rather than gliding between it.
    if ornament:
        center = .047 if dur < .35 else .095
        pitch += ornament * np.exp(-((t-center)/.010) ** 6)
        if dur > .5:
            pitch -= 2 * np.exp(-((t-.245)/.008) ** 6)
    phase = 2*np.pi*np.cumsum(hz(midi) * 2**(pitch/12)) / SR
    pressure = (.95 + .032*np.sin(2*np.pi*3.1*t + rng.uniform(0, 6))) * envelope(n, .016, .047)
    # A mostly sinusoidal pipe, with breath-dependent upper partials.
    x = np.zeros(n)
    for h, amp in enumerate([1, .18, .075, .028, .012, .006], 1):
        x += amp * np.sin(h*phase + .035*h) * (1 if h == 1 else (.65 + .35*pressure))
    air = filter_audio(rng.normal(0, 1, n), [1600, 7200], 'bandpass', 2)
    chiff = filter_audio(rng.normal(0, 1, n), [900, 5500], 'bandpass', 2) * np.exp(-t/.027)
    x = pressure * (x + .027*air + .035*chiff)
    return (x * .68).astype(np.float32)

@lru_cache(maxsize=140)
def pluck(midi, variation=0):
    local = np.random.default_rng(5000 + midi * 19 + variation)
    t = np.arange(round(SR * 2.65)) / SR
    f0 = hz(midi)
    x = np.zeros(len(t))
    # Two close strings per course: the second string begins a few milliseconds later.
    for course, cents in enumerate([-1.6, 2.1]):
        dt = .0025 * course
        u = np.maximum(0, t-dt)
        f = f0 * 2**(cents/1200)
        pos = .21 + variation * .008
        for h in range(1, min(24, int((SR*.44)/f))):
            amp = np.sin(np.pi*h*pos) / h**1.36
            decay = (1.1 if midi < 57 else .82) / (1 + .10*h**1.35)
            partial = f*h*np.sqrt(1 + .000025*h*h)
            x += .5*amp*np.sin(2*np.pi*partial*u) * np.exp(-u/decay) * (t >= dt)
    attack = filter_audio(local.normal(0, 1, len(t)), [500, 6200], 'bandpass')
    x += .07*attack*np.exp(-t/.012)
    # The wooden bowl adds a small, quickly damped body response.
    for f, amp in [(145, .035), (310, .025), (610, .012)]:
        x += amp*np.sin(2*np.pi*f*t) * np.exp(-t/.055)
    x = filter_audio(filter_audio(x, 60, 'highpass'), 6800)
    x[:80] *= np.linspace(0, 1, 80)
    x[-500:] *= np.linspace(1, 0, 500)
    return (x * 1.8).astype(np.float32)

@lru_cache(maxsize=32)
def drum(kind, variation=0):
    local = np.random.default_rng(120 + variation*17 + len(kind))
    dur = 1.65 if kind == 'war' else .80
    t = np.arange(round(SR * dur)) / SR
    if kind == 'war':
        low, high, decay, attack = 57 + variation, 97 + variation, .27, .045
    elif kind == 'frame':
        low, high, decay, attack = 103 + variation*3, 151 + variation*3, .14, .023
    elif kind == 'tap':
        low, high, decay, attack = 167 + variation*3, 215 + variation*2, .065, .016
    else:
        low, high, decay, attack = 290, 390, .028, .009
    phase = 2*np.pi*(low*t + (high-low)*.021*(1-np.exp(-t/.021)))
    x = np.zeros(len(t))
    for h, a in [(1, 1), (1.59, .30), (2.14, .16), (2.30, .12), (2.65, .08), (3.3, .035)]:
        x += a*np.sin(phase*h + .03) * np.exp(-t/(decay / (1+(h-1)*.6)))
    skin = filter_audio(local.normal(0, 1, len(t)), [280, 3500], 'bandpass')
    x += skin*np.exp(-t/attack)*(.32 if kind == 'war' else .44)
    if kind == 'rim':
        wood = filter_audio(local.normal(0, 1, len(t)), [1200, 6000], 'bandpass')
        x += .32*wood*np.exp(-t/.014)
    x *= 1-np.exp(-t/.0013)
    x = filter_audio(x, 35, 'highpass')
    return (x / max(np.max(np.abs(x)), 1e-6)).astype(np.float32)

D, E, F, G, A, B, C, d, e = 74, 76, 77, 79, 81, 83, 84, 86, 88
# Each measure contains six eighth-note units. The tune is newly composed.
THEME_A = [
    [(D,1),(F,1),(A,1),(A,3)],
    [(G,1),(E,1),(D,1),(E,1),(F,1),(G,1)],
    [(A,1),(d,1),(C,1),(B,1),(A,1),(G,1)],
    [(E,2),(F,1),(D,3)],
    [(D,1),(F,1),(A,1),(C,2),(B,1)],
    [(A,1),(G,1),(F,1),(E,1),(D,1),(E,1)],
    [(F,1),(G,1),(A,1),(d,1),(C,1),(A,1)],
    [(G,1),(E,1),(D,3),(None,1)],
]
THEME_B = [
    [(d,1),(A,1),(C,1),(d,3)],
    [(C,1),(B,1),(A,1),(G,1),(A,1),(C,1)],
    [(B,1),(G,1),(d,1),(C,1),(B,1),(A,1)],
    [(G,1),(E,1),(G,1),(A,2),(C,1)],
    [(d,1),(e,1),(d,1),(C,1),(A,1),(G,1)],
    [(A,1),(d,1),(C,1),(B,1),(G,1),(A,1)],
    [(G,1),(F,1),(E,1),(A,1),(G,1),(E,1)],
    [(D,3),(F,1),(E,1),(D,1)],
]
BREAK = [
    [(D-12,3),(A-12,2),(None,1)],
    [(F-12,2),(E-12,1),(D-12,2),(None,1)],
    [(G-12,3),(C-12,2),(None,1)],
    [(E-12,3),(G-12,2),(None,1)],
    [(B-12,2),(A-12,1),(G-12,2),(None,1)],
    [(G-12,3),(A-12,2),(None,1)],
    [(A-12,2),(C-12,1),(E-12,2),(G-12,1)],
    [(A-12,1),(B-12,1),(C-12,1),(D,3)],
]
CHORDS = {
    'Dm': [38, 50, 57, 62, 65, 69],
    'C': [36, 48, 55, 60, 64, 67],
    'G': [43, 50, 55, 59, 62, 67],
    'Am': [45, 52, 57, 60, 64, 69],
}
PLAN_A = ['Dm','Dm','C','C','G','G','Dm','Dm']
PLAN_B = ['Dm','C','G','G','Dm','C','G','Am']
sections = [(0, 4, 'Drums at the gate'), (4, 20, 'First charge'), (20, 36, 'Whistle rally'), (36, 44, 'Hold the line'), (44, 60, 'Second charge'), (60, 64, 'Final strike')]

for bar in range(64):
    loop_active = 4 <= bar < 36
    time = START + bar*BAR
    breakdown = 36 <= bar < 44
    climax = 44 <= bar < 60
    final = bar >= 60
    intensity = .53 + .10*bar if bar < 4 else .55 if breakdown else 1.12 if climax else 1
    if final:
        chord = ['Dm', 'C', 'G', 'Dm'][bar-60]
    elif breakdown:
        chord = ['Dm', 'Dm', 'C', 'C', 'G', 'G', 'Am', 'Dm'][bar-36]
    elif 20 <= bar < 36:
        chord = PLAN_B[(bar-20) % 8]
    else:
        phrase_start = 44 if climax else 4 if bar >= 4 else 0
        chord = PLAN_A[(bar-phrase_start) % 8]
    notes = CHORDS[chord]

    # Root-and-fifth pulse and crossed courses keep the plucked instrument audible under the drums.
    pattern = [notes[1], notes[3], notes[5], notes[2], notes[4], notes[3]]
    for k, pitch in enumerate(pattern):
        if bar == 63 and k > 0:
            continue
        velocity = (.91 if k in [0,3] else .62) * rng.uniform(.93, 1.07)
        onset = time+k*EIGHTH+rng.uniform(-.006, .006)
        add('lute', pluck(pitch, bar % 3), onset, .105*velocity*(.83 if breakdown else 1), -.34)
        note_event('lute', pitch, onset, EIGHTH*.88, velocity, -.34)
    for k in [0, 3]:
        if bar == 63 and k:
            continue
        onset = time+k*EIGHTH
        add('lute', pluck(notes[0], bar % 2), onset, .17*(.78 if breakdown else 1), -.1)
        note_event('lute', notes[0], onset, EIGHTH*2.6, .85, -.1)
        # A brush across three paired courses, played with a few milliseconds between them.
        if not breakdown or bar % 2 == 0:
            for j, pitch in enumerate(notes[2:5]):
                on = onset + .008*j
                add('lute', pluck(pitch, (bar+1) % 3), on, .047*(1.15 if climax else 1), .29)
                note_event('lute2', pitch, on, EIGHTH*1.8, .43, .29)
    if climax:
        for k, pitch in [(1.5,notes[4]),(4.5,notes[5])]:
            onset = time+k*EIGHTH
            add('lute', pluck(pitch, 2), onset, .070, .32)
            note_event('lute2', pitch, onset, EIGHTH*.42, .50, .32)

    # Drum patterns: heavy downbeats, a frame-drum reply, soft alternating strokes, and phrase-end rolls.
    hits = [(0,'war',.92,-.12),(3,'war',.78,.10),(2,'frame',.69,-.29),(5,'frame',.77,.29),(1,'tap',.38,-.22),(4,'tap',.40,.25),(1.5,'rim',.19,.35),(4.5,'tap',.22,-.35)]
    if breakdown:
        hits = [(0,'war',.50,-.08),(3,'frame',.38,.12),(5,'tap',.27,.20)]
    if bar % 4 == 3 and bar != 63:
        hits += [(5.25,'tap',.30,-.25),(5.5,'frame',.37,.24),(5.75,'tap',.44,-.22)]
    if climax and bar % 2 == 1:
        hits += [(2.5,'frame',.36,.31)]
    if bar == 63:
        hits = [(0,'war',1,-.1),(0,'frame',.85,.1)]
    for k, kind, velocity, pan in hits:
        onset = time+k*EIGHTH+rng.uniform(-.004, .004)
        gain = (.34 if kind == 'war' else .25 if kind == 'frame' else .16 if kind == 'tap' else .11)*velocity*intensity
        add('drums', drum(kind, bar % 4), onset, gain, pan)
        note_event('drums', {'war':36,'frame':43,'tap':45,'rim':76}[kind], onset, .13, min(.98, velocity*intensity), pan)

    # Whistle: an anacrusis in the intro, A/B themes, a lower answer, and a decorated final reprise.
    if bar < 2:
        phrase = []
    elif bar < 4:
        phrase = [(A-12,2),(D,2),(F,1),(E,1)] if bar == 2 else [(G,1),(A,1),(C,1),(A,2),(None,1)]
    elif breakdown:
        phrase = BREAK[bar-36]
    elif 20 <= bar < 36:
        phrase = THEME_B[(bar-20) % 8]
    elif final:
        phrase = [[(d,1),(A,1),(F,1),(D,3)],[(C,1),(G,1),(E,1),(G,3)],[(B,1),(A,1),(G,1),(E,1),(F,1),(E,1)],[(D,6)]][bar-60]
    else:
        phrase = THEME_A[(bar-4 if bar < 20 else bar-44) % 8]
    offset = 0
    for j, (pitch, units) in enumerate(phrase):
        if pitch is not None:
            onset = time+offset*EIGHTH+rng.uniform(-.003, .003)
            dur = units*EIGHTH-(.025 if units >= 3 else .016)
            ornament = 2 if (j == 0 and bar % 2 == 0) or (climax and units >= 2) else 0
            velocity = (.73 if breakdown else .80 if bar < 4 else .92 if climax else .84)*rng.uniform(.97, 1.03)
            add('whistle', whistle(pitch, dur, ornament, velocity), onset, .18*velocity, .045)
            note_event('whistle', pitch, onset, dur, velocity, .045)
        offset += units
    if phrase and offset != 6:
        raise ValueError(f'Measure {bar} contains {offset} eighths')

print('Score rendered; mixing acoustic room...', flush=True)
publish(game_loop.render({'whistle':(.27,.35), 'lute':(.16,.23), 'drums':(.12,.20)}, {'whistle':1.55, 'lute':.65, 'drums':1.13}), 'ember-charge', loop=True, target=-16)

def room(name, dry):
    local = np.random.default_rng(41 + len(name))
    length = int(SR*1.35)
    t = np.arange(length)/SR
    decay = .35 if name == 'whistle' else .23 if name == 'lute' else .20
    wet = .27 if name == 'whistle' else .16 if name == 'lute' else .12
    result = dry.copy()
    for channel in [0,1]:
        ir = local.normal(0,1,length)*np.exp(-t/decay)
        ir = filter_audio(ir, [180, 6300], 'bandpass')
        ir /= max(np.linalg.norm(ir), 1e-9)
        ir *= .22
        for delay, gain in [(.026+channel*.005,.48),(.047-channel*.004,.32),(.079+channel*.009,.20),(.121-channel*.011,.12)]:
            ir[int(delay*SR)] += gain
        reflected = sig.fftconvolve(.82*dry[:,channel]+.18*dry[:,1-channel], ir)[:N]
        result[:,channel] += wet*reflected
    return result

metrics = {}
mix = np.zeros((N,2), np.float32)
for name, stem in stems.items():
    # Give the melody a clear lead while retaining the drum transients and lute pulse.
    stem *= {'whistle': 1.55, 'lute': .65, 'drums': 1.13}[name]
    metrics[name] = dict(rms_dbfs=db(np.sqrt(np.mean(stem.astype(np.float64)**2))), peak_dbfs=db(np.max(np.abs(stem))))
    mix += room(name, stem)
# A short overall fade protects both file boundaries; the ending retains its natural room tail.
mix[:int(SR*.04)] *= np.linspace(0,1,int(SR*.04))[:,None]
mix[-int(SR*.8):] *= np.linspace(1,0,int(SR*.8))[:,None]
mix = filter_audio(mix.T, 28, 'highpass').T.astype(np.float32)
if not np.all(np.isfinite(mix)):
    raise ValueError('Non-finite audio')
mix *= .80 / max(float(np.max(np.abs(mix))), .01)
temporary = OUT / 'ember-charge-unmastered.wav'
sf.write(temporary, mix, SR, subtype='PCM_24')

# Master the preview at a comfortable, measured loudness, with headroom for playback.
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
base = [ffmpeg, '-hide_banner', '-nostdin', '-y', '-i', str(temporary)]
scan = subprocess.run(base+['-af','loudnorm=I=-16:TP=-1.2:LRA=9:print_format=json','-f','null','NUL'], capture_output=True, text=True, check=True)
stats, _ = json.JSONDecoder().raw_decode(scan.stderr[scan.stderr.rfind('{'):])
master = 'loudnorm=I=-16:TP=-1.2:LRA=9:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}'.format(**stats)
wav = OUT / 'ember-charge-preview.wav'
mp3 = OUT / 'ember-charge-preview.mp3'
subprocess.run(base+['-af',master,'-ar',str(SR),'-c:a','pcm_s16le',str(wav)], capture_output=True, check=True)
subprocess.run([ffmpeg,'-hide_banner','-nostdin','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','192k','-metadata','title=Ember Charge - Celtic Battle','-metadata','artist=Original game music preview',str(mp3)], capture_output=True, check=True)
temporary.unlink()

# Preserve an editable four-part score. MIDI uses GM substitutes for these custom synthesis voices.
mid = mido.MidiFile(ticks_per_beat=480)
meta = mido.MidiTrack(); mid.tracks.append(meta)
meta.append(mido.MetaMessage('track_name', name='Ember Charge / original Celtic battle cue'))
meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
meta.append(mido.MetaMessage('time_signature', numerator=6, denominator=8))
meta.append(mido.MetaMessage('key_signature', key='Dm'))
last_tick = 0
for first, end, label in sections:
    tick = round((START+first*BAR) * BPM/60 * 480)
    meta.append(mido.MetaMessage('marker', text=label, time=tick-last_tick)); last_tick=tick
for part, channel, program, pan in [('whistle',0,78,67),('lute',1,24,42),('lute2',2,24,84),('drums',9,0,64)]:
    track = mido.MidiTrack(); mid.tracks.append(track)
    track.append(mido.MetaMessage('track_name', name=part))
    if channel != 9:
        track.append(mido.Message('program_change', program=program, channel=channel))
    track.append(mido.Message('control_change', control=10, value=pan, channel=channel))
    ordered = []
    for ev in events:
        if ev['part'] != part:
            continue
        start = round(ev['time']*BPM/60*480)
        end = round((ev['time']+ev['duration'])*BPM/60*480)
        velocity = int(np.clip(ev['velocity']*110, 1, 125))
        ordered += [(start,1,mido.Message('note_on',note=ev['note'],velocity=velocity,channel=channel)), (end,0,mido.Message('note_off',note=ev['note'],velocity=0,channel=channel))]
    ordered.sort(key=lambda x:(x[0],x[1]))
    prev = 0
    for tick, _, msg in ordered:
        track.append(msg.copy(time=tick-prev)); prev=tick
mid.save(OUT/'ember-charge.mid')

audio, rate = sf.read(wav)
check = subprocess.run([ffmpeg, '-hide_banner', '-nostdin', '-i', str(wav), '-af', 'loudnorm=I=-16:TP=-1.2:LRA=9:print_format=json', '-f', 'null', 'NUL'], capture_output=True, text=True, check=True)
master_stats, _ = json.JSONDecoder().raw_decode(check.stderr[check.stderr.rfind('{'):])
report = dict(title='Ember Charge / 余烬冲锋', seconds=len(audio)/rate, sample_rate=rate, meter='6/8', bpm_quarter=BPM, mode='D Dorian', events=len(events), stems=metrics, peak_dbfs=db(np.max(np.abs(audio))), rms_dbfs=db(np.sqrt(np.mean(audio**2))), clipped_samples=int(np.count_nonzero(np.abs(audio)>=.9999)), loudness_analysis=master_stats, unmastered_loudness_analysis=stats, sections=[dict(start=START+first*BAR,end=START+end*BAR,label=label) for first,end,label in sections], files=dict(mp3=str(mp3),wav=str(wav),midi=str(OUT/'ember-charge.mid')))
if report['clipped_samples']:
    raise ValueError('Clipped master')
(OUT/'render-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
(OUT/'score.json').write_text(json.dumps(events,indent=2),encoding='utf8')
(OUT/'README.md').write_text('''# 余烬冲锋 · Ember Charge

原创凯尔特风格战斗配乐试听。约 82 秒，6/8 拍，四分音符 = 144 BPM，D Dorian。

- `ember-charge-preview.mp3`：192 kbps 立体声试听。
- `ember-charge-preview.wav`：44.1 kHz / 16 bit 立体声母带。
- `ember-charge.mid`：可编辑音符与节奏；GM 乐器是替代音色，不等同于 WAV 中的合成音色。
- `score.json`、`render-report.json`：编曲事件、段落时间与音频检查结果。

哨笛、双弦拨弦与战鼓均由脚本合成，没有使用已有歌曲或第三方演奏采样。旋律由本次任务编写。
试听编曲包含开头和收尾。游戏使用主体 32 小节的 40 秒循环版本，位于 public/assets/music/。
重做请运行 `tools/audio/render-celtic-battle.py`。依赖 numpy、scipy、soundfile、mido、imageio-ffmpeg。
''',encoding='utf8')
print(json.dumps(report,indent=2,ensure_ascii=False), flush=True)
