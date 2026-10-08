// Original Celtic score: harp/lute/flute in town, whistle/lute/war drums in battle.
// The existing music bus handles volume, pause filtering and impact ducking.
const BASE = import.meta.env?.BASE_URL ?? '/';
export const MUSIC_TRACKS = Object.freeze({
  calm: { title: '石闸暮光', file: 'stonegate-at-dusk-loop' },
  battle: { title: '余烬冲锋', file: 'ember-charge-loop' },
});
const LEVEL = { title: .64, calm: .72, battle: .72, boss: .82, victory: .68, defeat: 0, silence: 0 };
const trackFor = (state) => state === 'battle' || state === 'boss' ? 'battle'
  : state === 'title' || state === 'calm' || state === 'victory' ? 'calm' : null;

export function createMusic(E) {
  const { ctx } = E;
  const output = ctx.createGain();
  output.connect(E.buses.music);
  const buffers = new Map(), loading = new Map(), errors = new Map(), offsets = new Map();
  const sources = new Set();
  const requests = new AbortController();
  let state = 'silence', intensity = .3, lowHp = false, active = null, disposed = false, scheduled = 0;

  function gainForState() {
    return LEVEL[state] * (trackFor(state) === 'battle' ? .90 + .12 * intensity - (lowHp ? .04 : 0) : 1);
  }
  function currentGain(clip, now) {
    const f = clip.fade;
    if (!f) return clip.gain.gain.value;
    const k = Math.max(0, Math.min(1, (now - f.start) / f.duration));
    return f.from + (f.to - f.from) * k;
  }
  function fade(clip, value, now, seconds) {
    const from = currentGain(clip, now);
    clip.gain.gain.cancelScheduledValues(now);
    clip.gain.gain.setValueAtTime(from, now);
    clip.gain.gain.linearRampToValueAtTime(value, now + seconds);
    clip.fade = { from, to: value, start: now, duration: seconds };
  }
  function position(clip, now) {
    return (clip.offset + Math.max(0, now - clip.start)) % clip.source.buffer.duration;
  }
  function retire(clip, now, seconds) {
    offsets.set(clip.key, position(clip, now));
    fade(clip, 0, now, seconds);
    clip.source.stop(now + seconds + .02);
  }

  async function load(key) {
    if (buffers.has(key)) return buffers.get(key);
    if (loading.has(key)) return loading.get(key);
    const promise = (async () => {
      const failures = [];
      for (const extension of ['ogg', 'mp3']) {
        try {
          const url = BASE + 'assets/music/' + MUSIC_TRACKS[key].file + '.' + extension;
          const response = await fetch(url, { signal: requests.signal });
          if (!response.ok) throw new Error(response.status + ' ' + url);
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          if (disposed) return null;
          buffers.set(key, buffer);
          errors.delete(key);
          reconcile(ctx.currentTime);
          return buffer;
        } catch (error) {
          if (disposed || requests.signal.aborted) return null;
          failures.push(error.message);
        }
      }
      errors.set(key, failures.join('; '));
      console.warn('[music] ' + MUSIC_TRACKS[key].title + ' could not load: ' + failures.join('; '));
      return null;
    })().finally(() => loading.delete(key));
    loading.set(key, promise);
    return promise;
  }

  function reconcile(now = ctx.currentTime) {
    if (disposed || ctx.state === 'closed') return;
    const key = trackFor(state);
    if (key && !buffers.has(key)) {
      if (!errors.has(key)) void load(key);
      return; // Keep the outgoing track until the incoming one is decoded.
    }
    if (active?.key === key) {
      fade(active, gainForState(), now, .35);
      return;
    }
    const duration = key === 'battle' ? .65 : 1.2;
    if (active) { retire(active, now, duration); active = null; }
    if (!key) return;
    const source = ctx.createBufferSource();
    source.buffer = buffers.get(key);
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = source.buffer.duration;
    const gain = ctx.createGain(); gain.gain.value = 0;
    source.connect(gain).connect(output);
    const clip = { key, source, gain, start: now, offset: offsets.get(key) ?? 0, fade: null };
    active = clip;
    sources.add(clip);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); sources.delete(clip);
      if (active === clip) active = null;
    };
    source.start(now, clip.offset);
    scheduled++;
    fade(clip, gainForState(), now, duration);
  }

  function setState(name, now = ctx.currentTime) {
    if (!(name in LEVEL) || disposed || name === state) return;
    state = name;
    reconcile(now);
  }
  function update() {} // Loops and fades run on the audio clock, including during hit-stop.
  function sting(kind, now = ctx.currentTime) {
    if (kind === 'finalKill') setState('silence', now);
  }
  function ready() { return Promise.all(Object.keys(MUSIC_TRACKS).map(load)); }
  function dispose() {
    disposed = true;
    requests.abort();
    for (const clip of sources) {
      try { clip.source.stop(); } catch { /* Already ended. */ }
      clip.source.disconnect(); clip.gain.disconnect();
    }
    sources.clear(); buffers.clear(); active = null; output.disconnect();
  }
  return {
    update, setState, sting, ready, dispose, output,
    setIntensity(value) {
      const next = Math.max(0, Math.min(1, value));
      if (Math.abs(next - intensity) < .025) return;
      intensity = next;
      if (active && trackFor(state) === 'battle') fade(active, gainForState(), ctx.currentTime, .35);
    },
    setLowHealth(value) {
      lowHp = !!value;
      if (active && trackFor(state) === 'battle') fade(active, gainForState(), ctx.currentTime, .35);
    },
    get state() { return state; },
    stats: () => ({
      state, track: active?.key ?? null, title: active ? MUSIC_TRACKS[active.key].title : null,
      position: active ? position(active, ctx.currentTime) : 0,
      duration: active?.source.buffer.duration ?? 0,
      gain: active ? currentGain(active, ctx.currentTime) : 0,
      loop: !!active?.source.loop, sources: sources.size,
      loaded: [...buffers.keys()], loading: [...loading.keys()], errors: Object.fromEntries(errors),
      queue: 0, renders: 0, scheduled, dropped: 0,
    }),
  };
}
