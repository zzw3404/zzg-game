"""Small offline instrument and mastering helpers for the original game score."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
for folder in ['audio-python', 'audio-python-fast']:
    sys.path.insert(0, str(ROOT / 'shots' / folder))
import json
import math
import subprocess
from functools import lru_cache
import numpy as np
import scipy.signal as sig
import soundfile as sf
import imageio_ffmpeg
import mido

SR = 44100
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def db(value):
    return float(20 * np.log10(max(float(value), 1e-12)))

def filt(x, cutoff, kind='lowpass', order=2):
    return sig.sosfilt(sig.butter(order, cutoff, btype=kind, fs=SR, output='sos'), x)

def env(n, attack, release):
    result = np.ones(n)
    a, r = min(n//2, round(attack*SR)), min(n//2, round(release*SR))
    result[:a] = np.sin(np.linspace(0, np.pi/2, a))**2
    result[-r:] = np.sin(np.linspace(np.pi/2, 0, r))**2
    return result

@lru_cache(maxsize=96)
def harp(midi, variation=0):
    t = np.arange(round(4.4*SR))/SR
    x = np.zeros(len(t))
    f = hz(midi)
    # A single, clean string, with a longer fundamental and rapidly softened partials.
    for h in range(1, min(17, int(SR*.43/f))):
        amp = np.sin(np.pi*h*(.23+.009*variation)) / h**1.5
        decay = (1.25 if midi < 62 else .93) / (1+.085*h**1.42)
        x += amp*np.sin(2*np.pi*f*h*np.sqrt(1+.000006*h*h)*t+.012*h)*np.exp(-t/decay)
    x += .018*np.sin(2*np.pi*220*t)*np.exp(-t/.055)
    x = filt(filt(x, 55, 'highpass'), 7900)
    return (x*env(len(t), .003, .1)*1.45).astype(np.float32)

@lru_cache(maxsize=96)
def lute(midi, variation=0):
    t = np.arange(round(3.1*SR))/SR
    f = hz(midi)
    x = np.zeros(len(t))
    for course, cents in enumerate([-1.8, 1.9]):
        u = np.maximum(0, t-.0028*course)
        for h in range(1, min(20, int(SR*.43/f))):
            amp = np.sin(np.pi*h*(.20+.01*variation)) / h**1.42
            decay = (1.03 if midi < 57 else .79)/(1+.13*h**1.3)
            x += .5*amp*np.sin(2*np.pi*f*2**(cents/1200)*h*np.sqrt(1+.000021*h*h)*u)*np.exp(-u/decay)*(t >= .0028*course)
    noise = np.random.default_rng(781+midi*11+variation).normal(0, 1, len(t))
    x += .028*filt(noise, [550, 5700], 'bandpass')*np.exp(-t/.010)
    for body, strength in [(145, .028), (310, .018), (610, .008)]:
        x += strength*np.sin(2*np.pi*body*t)*np.exp(-t/.05)
    return (filt(filt(x, 55, 'highpass'), 5700)*env(len(t), .0025, .1)*1.65).astype(np.float32)

def flute(midi, duration, rng):
    t = np.arange(round((duration+.1)*SR))/SR
    vibrato = .115*np.sin(2*np.pi*4.65*t+rng.uniform(0, 6))*np.clip((t-.38)/.4, 0, 1)
    drift = .018*np.sin(2*np.pi*.85*t+rng.uniform(0, 6))
    phase = 2*np.pi*np.cumsum(hz(midi)*2**((vibrato+drift-.06*np.exp(-t/.055))/12))/SR
    pressure = env(len(t), .085, .16) * (.85+.15*np.sin(np.pi*np.clip(t/duration, 0, 1)))
    x = np.sin(phase)+.13*np.sin(2*phase)+.046*np.sin(3*phase)+.014*np.sin(4*phase)
    breath = filt(rng.normal(0, 1, len(t)), [1900, 6500], 'bandpass')
    return ((x+.019*breath)*pressure*.67).astype(np.float32)

class Mix:
    def __init__(self, duration, names, *, circular=False, origin=0):
        self.n = round(duration*SR)
        self.circular = circular
        self.origin = origin
        self.stems = {name: np.zeros((self.n, 2), np.float32) for name in names}

    def add(self, name, voice, time, gain, pan=0):
        offset = round((time-self.origin)*SR)
        angle = (pan+1)*np.pi/4
        stereo = voice[:, None]*np.array([np.cos(angle), np.sin(angle)])[None, :]*gain
        if self.circular:
            offset %= self.n
            first = min(len(voice), self.n-offset)
            self.stems[name][offset:offset+first] += stereo[:first].astype(np.float32)
            if first < len(voice):
                self.stems[name][:len(voice)-first] += stereo[first:].astype(np.float32)
        else:
            left, right = max(0, offset), min(self.n, offset+len(voice))
            if right > left:
                self.stems[name][left:right] += stereo[left-offset:right-offset].astype(np.float32)

    def render(self, settings, gains=None):
        result = np.zeros((self.n, 2), np.float64)
        for index, (name, stem) in enumerate(self.stems.items()):
            dry = stem.astype(np.float64)*(gains or {}).get(name, 1)
            wet, decay = settings[name]
            rng = np.random.default_rng(512+index)
            count = round(1.8*SR)
            t = np.arange(count)/SR
            for channel in [0, 1]:
                ir = filt(rng.normal(0, 1, count)*np.exp(-t/decay), [180, 6100], 'bandpass')
                ir *= .20/max(np.linalg.norm(ir), 1e-10)
                for delay, amount in [(.027+channel*.006, .45), (.055-channel*.008, .31), (.092+channel*.01, .17)]:
                    ir[round(delay*SR)] += amount
                voice = .87*dry[:, channel]+.13*dry[:, 1-channel]
                if self.circular:
                    reflected = np.fft.irfft(np.fft.rfft(voice)*np.fft.rfft(ir, n=self.n), n=self.n)
                else:
                    reflected = sig.fftconvolve(voice, ir)[:self.n]
                result[:, channel] += dry[:, channel]+wet*reflected
        if self.circular:
            # Warm up the filter for one full period to preserve the seam's filter state.
            result = filt(np.concatenate([result, result]).T, 28, 'highpass').T[self.n:]
        else:
            result = filt(result.T, 28, 'highpass').T
            fade = round(.8*SR)
            result[-fade:] *= np.linspace(1, 0, fade)[:, None]
        assert np.all(np.isfinite(result))
        return result.astype(np.float32)

def run(args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-y']+args, capture_output=True, text=True, check=True)

def loudness(path):
    scan = run(['-i', str(path), '-af', 'loudnorm=I=-16:TP=-1:LRA=9:print_format=json', '-f', 'null', 'NUL'])
    return json.JSONDecoder().raw_decode(scan.stderr[scan.stderr.rfind('{'):])[0]

def publish(audio, cue, *, loop=False, target=-18):
    out = ROOT/'audio-previews'/cue
    out.mkdir(parents=True, exist_ok=True)
    kind = 'loop' if loop else 'preview'
    wav = out/f'{cue}-{kind}.wav'
    sf.write(wav, audio, SR, subtype='PCM_24')
    measured = loudness(wav)
    # A constant gain preserves the waveform and the circular reverb at the loop boundary.
    gain_db = min(target-float(measured['input_i']), -1.3-float(measured['input_tp']))
    audio = audio*10**(gain_db/20)
    sf.write(wav, audio, SR, subtype='PCM_16')
    mp3 = out/f'{cue}-{kind}.mp3'
    run(['-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k', str(mp3)])
    paths = dict(wav=str(wav), mp3=str(mp3))
    if loop:
        assets = ROOT/'public'/'assets'/'music'
        assets.mkdir(parents=True, exist_ok=True)
        for ext, codec, bitrate in [('ogg', 'libvorbis', '160k'), ('mp3', 'libmp3lame', '192k')]:
            path = assets/f'{cue}-loop.{ext}'
            run(['-i', str(wav), '-c:a', codec, '-b:a', bitrate, str(path)])
            paths[ext] = str(path)
    report = dict(seconds=len(audio)/SR, sample_rate=SR, channels=2, loop=loop, peak_dbfs=db(np.max(np.abs(audio))), rms_dbfs=db(np.sqrt(np.mean(audio.astype(np.float64)**2))), clipped_samples=int(np.count_nonzero(np.abs(audio)>=.9999)), loudness=loudness(wav), files=paths)
    if loop:
        report['boundary_step'] = float(np.max(np.abs(audio[0]-audio[-1])))
    assert report['clipped_samples'] == 0
    (out/f'{kind}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    return report

def write_midi(events, out, title, bpm, meter, parts, key):
    midi = mido.MidiFile(ticks_per_beat=480)
    meta = mido.MidiTrack(); midi.tracks.append(meta)
    meta.extend([mido.MetaMessage('track_name', name=title.split(' / ')[0]), mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)), mido.MetaMessage('time_signature', numerator=meter[0], denominator=meter[1]), mido.MetaMessage('key_signature', key=key)])
    for part, channel, program, pan in parts:
        track = mido.MidiTrack(); midi.tracks.append(track)
        track.extend([mido.MetaMessage('track_name', name=part), mido.Message('program_change', program=program, channel=channel), mido.Message('control_change', control=10, value=pan, channel=channel)])
        timeline = []
        for event in events:
            if event['part'] != part:
                continue
            start = round(event['time']*bpm/60*480)
            end = round((event['time']+event['duration'])*bpm/60*480)
            velocity = int(np.clip(event['velocity']*110, 1, 125))
            timeline.extend([(start, 1, mido.Message('note_on', channel=channel, note=event['note'], velocity=velocity)), (end, 0, mido.Message('note_off', channel=channel, note=event['note'], velocity=0))])
        previous = 0
        for tick, _, message in sorted(timeline, key=lambda item: (item[0], item[1])):
            track.append(message.copy(time=tick-previous)); previous=tick
    midi.save(out)
