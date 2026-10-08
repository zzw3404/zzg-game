// Touch controls for phones and tablets: DOM + CSS over the canvas (no draw calls), in the HUD's ink. A floating
// thumb-stick under the left thumb, camera look by dragging the right side, and a fan of brush-ensō buttons under the
// right thumb. Everything is written into input.touch (game/input.js), so gameplay sees exactly the actions of the
// keyboard, mouse and pad. Owner: UI (U).
//   createTouchControls(app, { game, hud }) → { el, layout(), dispose() } | null (not a touch device)
//   Shown on coarse-pointer devices; ?touch=1 forces it (a mouse can drive it), ?touch=0 turns it off.
//   · stick: lands wherever the left thumb goes down (left 40 %), rests faintly bottom-left; analog move, pushed past
//     the rim = sprint (疾)
//   · look: drag anywhere on the right side that is not a button
//   · 斩 light (hold = heavy charge; the glyph turns 劈) · 闪 dodge · 格 block (tap at impact = parry) · 火 fire slash
//     (the ring fills with focus, gold when ready) · 锁 lock-on · 剑 draw/sheathe · ‖ pause
//   · portrait: a brush note to turn the phone (横屏游玩更佳); play still works
//   · the screens stay tap-driven by the HUD (title, pause menu, endings); here only their words change
// Only transform/opacity animate; geometry is written on resize, never read per frame.
import { bus } from '../core/bus.js';
import { SPELLS } from '../game/spells.js';

// a: action, g: glyph, k: size class, ang: position round 斩 (screen degrees: 180 = left, 270 = up), ring: 1 | 2,
// rot: turn of the brush ensō so no two rings look stamped
const BUTTONS = [
  { a: 'light', g: '攻击', k: 'main', rot: -18 },
  { a: 'dodge', g: '闪避', k: 'mid', ang: 182, ring: 1, rot: 40 },
  { a: 'block', g: '格挡', k: 'mid', ang: 226, ring: 1, rot: 160 },
  { a: 'special', g: '施法', k: 'mid', ang: 270, ring: 1, rot: 0 },
  { a: 'lock', g: '锁定', k: 'small', ang: 204, ring: 2, rot: 250 },
  { a: 'draw', g: '拔剑', k: 'small', ang: 248, ring: 2, rot: 100 },
];
const SIZE = { main: 88, mid: 60, small: 46 };     // px at u = 1
const RING = [0, 102, 168];
const STICK_R = 54;                                // ring radius (px at u = 1); the knob travels to the rim
const DEAD = 0.14, SPRINT_ON = 1.12, SPRINT_OFF = 0.96, FOLLOW = 1.45;

// the in-game hint and the pause menu's 招式 list, for thumbs
const HINT = [['左侧拖动', '移动', 'move'], ['右侧拖动', '视角', 'look'], ['长按攻击', '重击', 'heavy attack'], ['及时格挡', '招架', 'parry']];
const CONTROLS = [
  ['左侧拖动', '移动', 'move'], ['超出摇杆', '奔跑', 'sprint'], ['右侧拖动', '视角', 'look'], ['点击攻击', '攻击', 'attack'],
  ['长按攻击', '重击', 'heavy attack'], ['长按格挡', '格挡 / 招架', 'block · timed parry'], ['闪避', '闪避', 'dodge'], ['锁定', '锁定', 'lock on'],
  ['1 / 2 / 3', '选择法术', 'select spell'], ['施法', '施法', 'cast spell'], ['拔剑', '拔剑 / 收剑', 'draw · sheathe'], ['‖', '暂停', 'pause'],
];

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Touch UI wanted? ?touch=1 / ?touch=0 win; otherwise a coarse primary pointer (phone, tablet). */
export function touchWanted(params) {
  const t = params?.get?.('touch');
  if (t === '0') return false;
  if (t === '1') return true;
  return coarse();
}

export function createTouchControls(app, { game, hud } = {}) {
  const input = game?.input, root = hud?.el;
  if (!input?.touch || !root || !touchWanted(app.params ?? new URLSearchParams(location.search))) return null;
  injectCSS();
  const T = input.touch;
  T.enabled = true;
  input.exitLock();
  const realTouch = coarse();

  // ---------------------------------------------------------------- DOM
  const layer = document.createElement('div');
  layer.className = 'wxt';
  layer.innerHTML = `
    <div class="zone zl"></div><div class="zone zr"></div>
    <div class="stick"><div class="wash"></div><div class="ring"></div><div class="g">移动</div><div class="fast">奔跑</div><div class="knob"><i></i></div></div>
    ${BUTTONS.map((B) => `<div class="tb ${B.k}" data-a="${B.a}" style="--rot:${B.rot}deg"><i class="bg"></i>${B.a === 'special' ? '<i class="rt m"></i>' : ''}<i class="gl"></i><i class="r m"></i><i class="bl m"></i><b>${B.g}</b></div>`).join('')}
    <div class="tp"><i class="bg"></i><i class="r m"></i><i class="s m"></i><i class="s m"></i></div>
    <div class="spellpick">${[1, 2, 3].map(i => `<button type="button" data-spell="${i}"><b>${i}</b><span>${SPELLS[i].short}</span></button>`).join('')}</div>
    <div class="probe"></div>`;
  root.insertBefore(layer, root.querySelector('.scr'));   // under the screens (title, pause, endings)
  const rot = document.createElement('div');
  rot.className = 'wxrot';
  rot.innerHTML = '<i class="ph"></i><b>横屏游玩更佳</b><em>best played sideways</em>';
  root.appendChild(rot);
  root.classList.add('touch');
  document.documentElement.classList.add('wx-touch');

  const $ = (s) => layer.querySelector(s);
  const zl = $('.zl'), zr = $('.zr'), stick = $('.stick'), knob = $('.knob'), pauseBtn = $('.tp'), spellpick = $('.spellpick'), probe = $('.probe');
  const buttons = BUTTONS.map((B) => ({ ...B, el: layer.querySelector(`.tb[data-a="${B.a}"]`), id: null, flip: false }));
  const btn = Object.fromEntries(buttons.map((B) => [B.a, B]));
  const glyphMain = btn.light.el.querySelector('b');

  // screens: tap words, and the touch list in the pause menu / in-game hint
  const rows = (list) => list.map(([k, zh, en]) => `<kbd>${k}</kbd><span>${zh}<i>${en}</i></span>`).join('');
  const setHTML = (sel, html) => { const n = root.querySelector(sel); if (n) n.innerHTML = html; };
  setHTML('.title .go .t i', 'tap to begin');
  setHTML('.pause .ctl', rows(CONTROLS));
  setHTML('.hint', rows(HINT));

  // ---------------------------------------------------------------- layout (on resize only)
  const S = {
    W: 0, H: 0, u: 1, R: STICK_R, rest: { x: 0, y: 0 }, sa: { t: 0, r: 0, b: 0, l: 0 }, k: 0.006,
    id: null, bx: 0, by: 0, sprint: false, look: null, lx: 0, ly: 0, state: '', portrait: false, rotT: 0,
  };
  const pointers = new Set();
  const count = () => { T.n = pointers.size; };
  function layout() {
    const cs = getComputedStyle(probe);                // env(safe-area-inset-*), read once per resize
    const sa = S.sa = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    const W = S.W = innerWidth, H = S.H = innerHeight;
    const portrait = H > W;
    if (portrait !== S.portrait) { S.portrait = portrait; S.rotT = 0; root.classList.toggle('portrait', portrait); root.classList.remove('rot-seen'); }
    const u = S.u = clamp(Math.min(W, H) / 400, 0.82, 1.3) * (portrait ? clamp(W / 460, 0.8, 1) : 1);
    const m = 18 * u;
    // the attack fan: 斩 in the corner, the rest on two arcs round it
    const cx = W - sa.r - m - SIZE.main * u / 2, cy = H - sa.b - m - SIZE.main * u / 2;
    for (const B of buttons) {
      const d = SIZE[B.k] * u, r = RING[B.ring ?? 0] * u, a = (B.ang ?? 0) * Math.PI / 180;
      box(B.el, cx + Math.cos(a) * r, cy + Math.sin(a) * r, d);
    }
    const pd = 42 * u;
    box(pauseBtn, W - sa.r - 14 * u - pd / 2, sa.t + 12 * u + pd / 2, pd);
    spellpick.style.right = `${(sa.r + 16 * u).toFixed(1)}px`;
    spellpick.style.top = `${(sa.t + 68 * u).toFixed(1)}px`;
    // the stick rests bottom-left; its zone is the left 40 % (half the width when upright)
    S.R = STICK_R * u;
    S.rest.x = sa.l + m + S.R + 6 * u; S.rest.y = H - sa.b - m - S.R;
    const zw = Math.round(W * (portrait ? 0.5 : 0.4));
    zl.style.width = `${zw}px`; zr.style.left = `${zw}px`;
    stick.style.width = stick.style.height = `${(2 * S.R).toFixed(1)}px`;
    stick.style.setProperty('--d', `${(2 * S.R).toFixed(1)}px`);
    if (S.id === null) placeStick(S.rest.x, S.rest.y);
    S.k = clamp(5.4 / W, 0.004, 0.009);             // look: a drag across the whole screen turns ~300°
    // the HUD on touch: vitals up in the top-left, sized to leave the boss bar the centre; the hint beneath them
    const vs = clamp(0.62 * u, 0.55, 0.8), fs = 84 * vs;
    const bossW = portrait ? W * 0.84 : clamp(W * 0.36, 220, 480);
    const avail = portrait ? W - sa.l - sa.r - 40 : (W - bossW) / 2 - 16 - sa.l - 12;
    const rs = root.style;
    rs.setProperty('--tvs', vs.toFixed(3)); rs.setProperty('--tvh', `${fs.toFixed(1)}px`);
    rs.setProperty('--thw', `${clamp(avail - fs - 10, 120, 300 * u).toFixed(1)}px`); rs.setProperty('--tbw', `${bossW.toFixed(1)}px`);
  }
  function box(el, x, y, d) {
    const s = el.style;
    s.left = `${(x - d / 2).toFixed(1)}px`; s.top = `${(y - d / 2).toFixed(1)}px`;
    s.width = s.height = `${d.toFixed(1)}px`;
    s.setProperty('--d', `${d.toFixed(1)}px`);
  }
  function placeStick(x, y) { stick.style.transform = `translate3d(${(x - S.R).toFixed(1)}px,${(y - S.R).toFixed(1)}px,0)`; }
  function placeKnob(x, y) { knob.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; }

  // ---------------------------------------------------------------- stick
  function setSprint(on) {
    if (on === S.sprint) return;
    S.sprint = on;
    T.hold('sprint', on);
    stick.classList.toggle('fast', on);
  }
  function stickMove(x, y) {
    let dx = x - S.bx, dy = y - S.by, d = Math.hypot(dx, dy);
    const R = S.R, far = R * FOLLOW;
    if (d > far) {                                  // the ring follows a thumb that runs away from it
      const k = (d - far) / d;
      S.bx += dx * k; S.by += dy * k; dx = x - S.bx; dy = y - S.by; d = far;
      placeStick(S.bx, S.by);
    }
    const c = d > R ? R / d : 1;
    placeKnob(dx * c, dy * c);
    const raw = d / R, mag = raw < DEAD ? 0 : Math.min(1, (raw - DEAD) / (0.92 - DEAD));
    const nx = d > 1e-3 ? dx / d : 0, ny = d > 1e-3 ? dy / d : 0;
    T.setMove(nx * mag, -ny * mag);                 // screen up = forward
    setSprint(S.sprint ? raw > SPRINT_OFF : raw > SPRINT_ON);
  }
  function stickEnd() {
    if (S.id === null) return;
    pointers.delete(S.id); count();
    S.id = null;
    T.setMove(0, 0);
    setSprint(false);
    stick.classList.remove('live');
    placeKnob(0, 0);
    placeStick(S.rest.x, S.rest.y);
  }
  zl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.id !== null) return;
    S.id = e.pointerId; pointers.add(e.pointerId); count();
    try { zl.setPointerCapture(e.pointerId); } catch { /* synthetic event */ }
    const R = S.R, sa = S.sa;
    S.bx = clamp(e.clientX, sa.l + R + 6, S.W - R - 6);
    S.by = clamp(e.clientY, sa.t + R + 6, S.H - sa.b - R - 6);
    stick.classList.add('live');
    placeStick(S.bx, S.by);
    stickMove(e.clientX, e.clientY);
  });
  zl.addEventListener('pointermove', (e) => { if (e.pointerId === S.id) stickMove(e.clientX, e.clientY); });

  // ---------------------------------------------------------------- look
  function lookEnd() { if (S.look === null) return; pointers.delete(S.look); count(); S.look = null; }
  zr.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.look !== null) return;
    S.look = e.pointerId; pointers.add(e.pointerId); count();
    S.lx = e.clientX; S.ly = e.clientY;
    try { zr.setPointerCapture(e.pointerId); } catch { /* synthetic event */ }
  });
  zr.addEventListener('pointermove', (e) => {
    if (e.pointerId !== S.look) return;
    const dx = e.clientX - S.lx, dy = e.clientY - S.ly;
    S.lx = e.clientX; S.ly = e.clientY;
    if (dx || dy) T.look(dx * S.k, dy * S.k * 0.8);   // the mouse's sense: drag right looks right, drag up looks up
  });

  // ---------------------------------------------------------------- buttons
  const buzz = (ms) => { try { if (realTouch) navigator.vibrate?.(ms); } catch { /* not allowed */ } };
  function release(B) {
    if (B.id === null) return;
    pointers.delete(B.id); count();
    B.id = null;
    T.hold(B.a, false);
    B.el.classList.remove('on');
  }
  for (const B of buttons) {
    B.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (B.id !== null) return;
      B.id = e.pointerId; pointers.add(e.pointerId); count();
      try { B.el.setPointerCapture(e.pointerId); } catch { /* synthetic event */ }
      T.hold(B.a, true);                              // held like the key: 斩 held = charge, 格 held = guard
      B.flip = !B.flip;                               // alternate two keyframes: the ink bloom restarts without a reflow
      B.el.classList.remove('p1', 'p2');
      B.el.classList.add('on', B.flip ? 'p1' : 'p2');
      buzz(B.k === 'main' ? 9 : 6);
    });
  }
  for (const pick of spellpick.querySelectorAll('button')) pick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const action = `spell${pick.dataset.spell}`;
    T.hold(action, true); T.hold(action, false);
    buzz(5);
  });
  let tapFlip = false;
  pauseBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    T.hold('pause', true); T.hold('pause', false);  // one press edge: gameplay's pause toggle, as Esc
    tapFlip = !tapFlip;
    pauseBtn.classList.remove('p1', 'p2'); pauseBtn.classList.add(tapFlip ? 'p1' : 'p2');
    buzz(6);
  });
  // lifts: pointer capture sends every up/cancel to the element that took the touch
  const ends = [[zl, stickEnd, () => S.id], [zr, lookEnd, () => S.look], ...buttons.map((B) => [B.el, () => release(B), () => B.id])];
  for (const [el, end, id] of ends) for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, (e) => { if (e.pointerId === id()) end(); });

  function releaseAll() {
    stickEnd(); lookEnd();
    for (const B of buttons) release(B);
    pointers.clear(); count();
    T.clear();
    S.sprint = false; stick.classList.remove('fast');
  }

  // ---------------------------------------------------------------- page behaviour on touch
  const noDefault = (e) => e.preventDefault();
  layer.addEventListener('contextmenu', noDefault);
  // no scroll, rubber-band or pinch-zoom anywhere in the game (the volume slider runs on pointer events)
  document.addEventListener('touchmove', noDefault, { passive: false });
  document.addEventListener('gesturestart', noDefault);
  // going to the background mid-fight pauses (on touch there is no pointer lock to lose)
  const onVis = () => { if (!document.hidden) return; if (root.dataset.state === 'playing') game.setPaused?.(true); releaseAll(); };
  document.addEventListener('visibilitychange', onVis);
  // the tap that leaves the title also asks for full screen in landscape (Android, iPad; iPhone Safari has no API).
  // S.state is last frame's: the HUD has already turned this very tap into ui:start by the time we see it.
  let fsArmed = false;
  const onDown = () => { fsArmed = S.state === 'title'; };
  const onUp = () => {
    if (!fsArmed || !realTouch) return;
    fsArmed = false;
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) return;
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    try {
      const p = req?.({ navigationUI: 'hide' });
      p?.then?.(() => screen.orientation?.lock?.('landscape')?.catch?.(() => {}))?.catch?.(() => {});
    } catch { /* not allowed */ }
  };
  addEventListener('pointerdown', onDown, true);
  addEventListener('pointerup', onUp, true);
  let focusMax = 100;
  const offFocus = bus.on('player:focus', (p) => { if (p?.max) focusMax = p.max; });

  // ---------------------------------------------------------------- per frame: poll the hero, flip classes on change
  const flags = { charge: false, guard: false, sheathed: false, lock: false, full: false, f: -1, spell: 0 };
  const flag = (k, v, el, cls) => { if (flags[k] === v) return; flags[k] = v; el.classList.toggle(cls, v); };
  function update(dt, t, _app, rawDt = dt) {
    const st = root.dataset.state;
    if (st !== S.state) { releaseAll(); S.state = st; }
    if (S.portrait && (st === 'playing' || st === 'title') && !root.classList.contains('rot-seen')) {
      S.rotT += Math.min(rawDt, 0.1);
      if (st === 'playing' && S.rotT > 7) root.classList.add('rot-seen');   // read by now: out of the way
    }
    if (st !== 'playing') return;
    const P = game.player;
    if (!P) return;
    const charge = P.state === 'charge';
    if (charge !== flags.charge) glyphMain.textContent = charge ? '重击' : '攻击';
    flag('charge', charge, btn.light.el, 'charge');
    flag('guard', P.state === 'block' || P.state === 'parry', btn.block.el, 'act');
    flag('sheathed', !P.drawn, btn.draw.el, 'off');
    flag('lock', !!P.lock?.alive, btn.lock.el, 'lit');
    const f = clamp(P.focus / focusMax, 0, 1);
    if (Math.abs(f - flags.f) > 0.004) { flags.f = f; btn.special.el.style.setProperty('--f', f.toFixed(3)); }
    if (flags.spell !== P.selectedSpell) {
      flags.spell = P.selectedSpell;
      btn.special.el.querySelector('b').textContent = SPELLS[P.selectedSpell].short;
      for (const pick of spellpick.querySelectorAll('button')) pick.classList.toggle('selected', Number(pick.dataset.spell) === P.selectedSpell);
    }
    for (const pick of spellpick.querySelectorAll('button')) pick.classList.toggle('ready', f + 1e-6 >= SPELLS[Number(pick.dataset.spell)].cost);
    flag('full', f + 1e-6 >= SPELLS[P.selectedSpell].cost, btn.special.el, 'full');
  }

  layout();
  addEventListener('resize', layout);
  addEventListener('orientationchange', layout);

  const sys = {
    update, el: layer, layout,
    dispose() {
      releaseAll();
      offFocus?.();
      removeEventListener('resize', layout); removeEventListener('orientationchange', layout);
      removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true);
      document.removeEventListener('touchmove', noDefault); document.removeEventListener('gesturestart', noDefault);
      document.removeEventListener('visibilitychange', onVis);
      app.remove(sys);
      layer.remove(); rot.remove();
      root.classList.remove('touch', 'portrait', 'rot-seen');
      document.documentElement.classList.remove('wx-touch');
      T.enabled = false;
    },
  };
  app.add(sys);
  return sys;
}

function injectCSS() {
  if (document.getElementById('wx-touch-css')) return;
  const s = document.createElement('style');
  s.id = 'wx-touch-css';
  s.textContent = TOUCH_CSS;
  document.head.appendChild(s);
}

// Scoped to .wx.touch / html.wx-touch and injected only when the controls are on: the desktop page never sees it.
// Brush textures (--t-enso, --t-splat, …) come from the HUD root (ui/textures.js), palette and fonts from HUD_CSS.
const TOUCH_CSS = /* css */`
html.wx-touch,html.wx-touch body{user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none;touch-action:none}
.wx .wxt{position:absolute;inset:0;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .3s;z-index:2}
.wx[data-state=playing] .wxt{opacity:1;visibility:visible}.wxt .zone{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
.wxt .zl{left:0;width:40%}.wxt .zr{left:40%;right:0}.wxt .probe{position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.wxt .stick{position:absolute;left:0;top:0;pointer-events:none;opacity:.55;transition:opacity .2s}.wxt .stick.live{opacity:1}.wxt .stick>*{position:absolute}
.wxt .stick .wash{inset:3%;border-radius:50%;background:#11172099}.wxt .stick .ring{inset:0;border:1px solid #d0b57988;border-radius:50%;box-shadow:inset 0 0 0 6px #13182060}
.wxt .stick .g,.wxt .stick .fast{inset:0;display:grid;place-items:center;font:12px/1 var(--f-serif);color:#d6c9ae}.wxt .stick.live .g{opacity:0}.wxt .stick .fast{opacity:0;color:#e9c57b}
.wxt .stick.fast .ring{border-color:#e9c57b;box-shadow:0 0 12px #d0a05635}.wxt .stick.fast .fast{opacity:1}
.wxt .stick .knob{left:28%;top:28%;width:44%;height:44%;opacity:0;transition:opacity .2s;border:1px solid #e2c991;border-radius:50%;background:radial-gradient(#aa854f44,#101720dd)}
.wxt .stick.live .knob{opacity:1}.wxt .stick .knob i{position:absolute;inset:35%;background:#d7b779;transform:rotate(45deg)}
.wxt .tb,.wxt .tp{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;border-radius:50%;transition:transform .12s}
.wxt .tb:after{content:'';position:absolute;inset:-10%;border-radius:50%}.wxt .tb>*,.wxt .tp>*{position:absolute;pointer-events:none}
.wxt .tb .bg,.wxt .tp .bg{inset:3%;border-radius:50%;background:linear-gradient(135deg,#222931e8,#0d141ddc);box-shadow:0 4px 16px #0005}
.wxt .tb .r,.wxt .tb .rt,.wxt .tp .r{inset:0;border:1px solid #bda47099;border-radius:50%;box-shadow:inset 0 0 0 4px #b59d4f10}
.wxt .tb b{inset:0;display:grid;place-items:center;font:500 calc(var(--d)*.19)/1 var(--f-serif);letter-spacing:.04em;color:#ead9b6;text-shadow:0 1px 3px #0006}
.wxt .tb.main b{font-size:calc(var(--d)*.21)}.wxt .tb.main .r{border-color:#d5b578}.wxt .tb.small b{font-size:calc(var(--d)*.21)}
.wxt .tb .gl{inset:-10%;background:radial-gradient(#e5ba6244,transparent 70%);opacity:0;border-radius:50%}.wxt .tb .bl{inset:-15%;background:radial-gradient(transparent 50%,#d7b77966 60%,transparent 65%);opacity:0}
.wxt .tb.on{transform:scale(.92)}.wxt .tb.on .bg{background:#705c3499}.wxt .tb.act .r,.wxt .tb.lit .r{border-color:#f1d29c;box-shadow:0 0 12px #d0a05644}
.wxt .tb.main.charge b{color:#ffe4ae}.wxt .tb.main.charge .gl{animation:wxt-glow .5s infinite alternate}.wxt .tb.off b{opacity:.55}
.wxt .tb.p1 .bl{animation:wxt-bloom .45s}.wxt .tb.p2 .bl{animation:wxt-bloom .45s}
.wxt .tb[data-a=special] .rt{border-color:#bda47030}.wxt .tb[data-a=special] .r{border:0;background:conic-gradient(#e2be78 calc(var(--f,0)*100%),transparent 0);mask:radial-gradient(transparent 61%,#000 63%,#000 70%,transparent 72%)}
.wxt .tb[data-a=special] b{opacity:.55}.wxt .tb[data-a=special].full b{opacity:1;color:#ffe1a3}.wxt .tb[data-a=special].full .gl{animation:wxt-glow 1.5s infinite alternate}
.wxt .tp .s{left:39%;top:30%;width:7%;height:40%;background:#ddc592}.wxt .tp .s+.s{left:54%}
.wxt .spellpick{position:absolute;display:flex;gap:7px;pointer-events:auto;touch-action:none}.wxt .spellpick button{appearance:none;border:1px solid #b99a6150;border-radius:2px;min-width:48px;height:34px;padding:3px 7px;background:#111720d9;color:#c4b598;display:flex;align-items:center;gap:5px;touch-action:none}
.wxt .spellpick b{font:600 15px/1 Georgia,serif}.wxt .spellpick span{font:11px/1 var(--f-serif);white-space:nowrap}.wxt .spellpick button.selected{color:#f2d59d;border-color:#d7b779a0;background:#6b50295e}.wxt .spellpick button.ready{box-shadow:inset 0 -1px #d7b77955}
.wx.touch .vitals{left:calc(env(safe-area-inset-left) + 12px);top:calc(env(safe-area-inset-top) + 8px);bottom:auto;padding:8px 10px;gap:8px;max-width:calc(100vw - 80px)}
.wx.touch .focus{width:42px;height:42px}.wx.touch .focus .g{font-size:15px}.wx.touch .focus .g:after{bottom:5px;font-size:7px}.wx.touch .vital-stack{width:var(--thw,200px)}.wx.touch .vital-caption{font-size:8px;margin-bottom:5px}.wx.touch .vital-caption small{font-size:8px}.wx.touch .health{height:7px;width:100%}.wx.touch .spellbar{display:none}
.wx.touch .boss.play{width:var(--tbw,300px);top:calc(env(safe-area-inset-top) + 14px)}.wx.touch .boss .nm{font-size:15px}.wx.touch .boss .sb{font-size:10px;margin:0}.wx.touch .boss .bar{height:8px;margin-top:4px}.wx.touch .boss .po{margin-top:4px}
.wx.touch.portrait .boss.play{top:calc(env(safe-area-inset-top) + 95px)}.wx.touch .hint{display:none}.wx.touch .combo{top:32%;right:20px}.wx.touch .combo .n{font-size:36px}
.wx .wxrot{position:absolute;left:8%;right:8%;top:45%;display:none;pointer-events:none;opacity:0;transition:opacity .5s;text-align:center;z-index:3;padding:15px;background:#111720d9;border:1px solid #b99a6140}
.wx.touch.portrait .wxrot{display:block}.wx.touch.portrait[data-state=playing]:not(.rot-seen) .wxrot{opacity:1}.wx .wxrot .ph{display:none}.wx .wxrot b{font:14px/1.5 var(--f-serif);color:#e5c58b}.wx .wxrot em{display:block;font:11px/1.5 var(--f-latin);color:#a39376;margin-top:4px}
@media(max-height:600px){.wx.touch .pause.show-ctl .mn>:is(.vol,.qual){display:none}.wx.touch .pause .ctl{grid-template-columns:85px 1fr 85px 1fr;gap:7px 12px;font-size:10px}.wx.touch .pause .pn{padding:22px 26px;max-height:90vh}.wx.touch .pause button{padding:9px 3px}}
@keyframes wxt-bloom{10%{opacity:.8}100%{opacity:0;transform:scale(1.1)}}@keyframes wxt-glow{from{opacity:.25}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.wxt *{animation-duration:.01s!important;transition-duration:.01s!important}}
`;
