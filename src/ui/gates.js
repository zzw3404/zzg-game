// The four gates of Stonegate: walk out of one and a short way down the road is a travel prompt — confirm and
// the page loads the instance beyond it; win there and you are paid and sent home (levels/runtime.js).
// Owner: UI.
//
//   const gates = createGates(app, { game, gates: citadel.gates })   → { update(dt), stats(), dispose() }
//
//   · each gate has a trigger point a few metres outside the wall; stepping past it (and staying outside) shows
//     the ink panel: destination name, a line of flavour, `E / Enter` to travel, `Esc` to step back
//   · travelling saves the hero's gear, then navigates to the instance with `&from=stonegate`
//   · the gates are keyed by compass side, so the destinations live in one table below
import { REWARDS, captureFrom, loadSave } from '../game/save.js';
import { bus } from '../core/bus.js';
import { REGIONS } from './theme.js';

const SIDE_CN = { west: '西', north: '北', east: '东', south: '南' };
const INK = 'var(--ink, #e8d3ad)';
const GOLD = 'var(--gold, #f4cf86)';
const BRUSH = 'var(--f-serif, "Noto Serif SC", "Microsoft YaHei", serif)';
const SERIF = 'var(--f-serif, "Noto Serif SC", serif)';

/**
 * Which way leads where. `level` is a level in src/levels (the instance), `name` its name in this world's
 * tongue, `line` the flavour line on the panel. A gate with no `level` is sealed for now.
 */
export const DESTINATIONS = {
  west: { level: 'steppe', name: REGIONS.steppe.title, line: REGIONS.steppe.tagline },
  north: { level: 'bamboo', name: REGIONS.bamboo.title, line: REGIONS.bamboo.tagline },
  east: { level: 'town', name: REGIONS.town.title, line: REGIONS.town.tagline },
  south: { scene: 'hollow', level: 'hollow', name: '枯林圣堂', line: '南门外的死林里，立着一座没有屋顶的教堂。' },
};

/** Where the palace gate of each side sits (filled from the citadel spec by the scene). */
export function createGates(app, { game, gates = [] } = {}) {
  if (!game || !gates.length) return { update() {}, stats: () => ({}), dispose() {} };
  const P = game.player;
  const root = document.querySelector('.wx') ?? document.getElementById('hud') ?? document.body;

  const style = document.createElement('style');
  style.textContent = `
.wxg{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.97);width:min(520px,84vw);
  background:linear-gradient(180deg,rgba(23,28,34,.97),rgba(13,18,25,.97));border:1px solid rgba(232,211,173,.22);
  box-shadow:0 26px 70px rgba(0,0,0,.78);padding:22px 26px 18px;color:${INK};font-family:${SERIF};
  opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;text-align:left}
.wxg.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.wxg h3{margin:0 0 4px;font-family:${BRUSH};font-size:30px;font-weight:400;letter-spacing:.06em}
.wxg .where{font-size:11px;letter-spacing:.28em;opacity:.55;text-transform:uppercase;margin-bottom:14px}
.wxg .line{font-size:13px;line-height:1.7;opacity:.82;border-left:2px solid #b99a61;padding-left:12px;margin-bottom:16px}
.wxg .ask{font-size:14px;letter-spacing:.06em}
.wxg .keys{display:flex;gap:18px;margin-top:12px;font-size:12px;letter-spacing:.16em;opacity:.72}
.wxg .keys b{font-family:${BRUSH};font-size:15px;color:${GOLD};font-weight:400;margin-right:5px}
.wxg .cleared{margin-top:10px;font-size:11px;letter-spacing:.14em;color:${GOLD};opacity:.85}
.wxfade{position:absolute;inset:0;background:#070606;opacity:0;pointer-events:none;transition:opacity .55s ease;z-index:4}
.wxfade.on{opacity:1}
`;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'wxg';
  root.appendChild(panel);
  const fade = document.createElement('div');
  fade.className = 'wxfade';
  root.appendChild(fade);

  let near = null;                 // the gate the hero is standing outside of
  let open = null;                 // its destination, when the panel is up
  let leaving = false;

  const S = loadSave();
  function render(dest, side) {
    const open = !!(dest.level || dest.scene);
    const cleared = dest.level ? (S.cleared[dest.level] ?? 0) : 0;
    const reward = dest.level ? REWARDS[dest.level] : null;
    panel.innerHTML = `<h3>${dest.name}</h3><div class="where">${SIDE_CN[side] ?? side}门 · 城墙之外</div>
      <div class="line">${dest.line}</div>
      ${open ? `<div class="ask">现在前往？</div>` : `<div class="ask">城门紧闭。</div>`}
      <div class="keys">${open ? '<span><b>E</b>前往</span><span><b>Esc</b>留下</span>' : '<span><b>Esc</b>退后</span>'}</div>
      ${reward ? `<div class="cleared">${cleared ? `已通关 ${cleared} 次 · 奖励已领` : `首通奖励：${reward.gold} 金${reward.potions ? ` · 药水 ×${reward.potions}` : ''}`}</div>` : ''}`;
  }

  function openGate(side, dest) {
    open = { side, dest };
    render(dest, side);
    panel.classList.add('on');
    bus.emit('ui:sfx', { kind: 'open' });
  }
  function closeGate() {
    open = null;
    panel.classList.remove('on');
  }
  function travel() {
    const dest = open?.dest;
    if (!dest || (!dest.level && !dest.scene) || leaving) return;
    leaving = true;
    captureFrom(P);
    fade.classList.add('on');
    const q = new URLSearchParams(location.search);
    q.set('scene', dest.scene ?? 'full');       // the hollow is its own scene; the three chapters are levels
    q.set('level', dest.level);
    q.set('from', 'stonegate');
    q.delete('view'); q.delete('crowd'); q.delete('shops');
    setTimeout(() => { location.href = `${location.pathname}?${q.toString()}`; }, 620);
    bus.emit('ui:sfx', { kind: 'seal' });
  }

  function onKey(e) {
    if (e.type !== 'keydown') return;
    if (!open) return;
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.stopImmediatePropagation(); travel(); }
    else if (e.code === 'Escape') { e.stopImmediatePropagation(); closeGate(); }
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);

  const sys = {
    update() {
      if (leaving) return;
      // the hero is "out" when he is past the gate's outer face and clear of the wall on that axis
      let hit = null;
      for (const g of gates) {
        const dx = P.pos.x - g.x, dz = P.pos.z - g.z;
        // g.yaw is the side's outward frame rotation: `out` grows away from the wall, `along` runs across the gate
        const out = dx * Math.sin(g.yaw) + dz * Math.cos(g.yaw);
        const along = Math.abs(dx * Math.cos(g.yaw) - dz * Math.sin(g.yaw));
        if (along < 7 && out > 6 && out < 34) { hit = g; break; }
      }
      near = hit;
      if (near && (!open || open.side !== near.side)) {
        const dest = DESTINATIONS[near.side];
        if (dest) openGate(near.side, dest);
      } else if (!near && open) closeGate();
    },
    stats: () => ({ gates: gates.length, near: near?.side ?? null, open: open?.dest?.level ?? null, cleared: { ...S.cleared } }),
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      style.remove(); panel.remove(); fade.remove();
    },
  };
  app.add(sys);
  return sys;
}
