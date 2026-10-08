// Shops, keepers and the hero's gear (the walled town, ?scene=citadel). Owner: UI.
//
// The town's three shops are enterable buildings (world/citadel-build.js gives them a flush floor, a wall ring of
// colliders with the doorway left open, a counter and back shelves). This module adds the living half:
//
//   const shops = await createShops(app, { game, shops: citadel.shops })   → { update(dt), gear(), dispose() }
//
//   · a modelled keeper at each counter (a procedural character + animator + Mixamo idle, looking at the hero)
//   · a walk-up prompt inside the shop, and an ink-brush panel: press E at the counter, 1/2/3 to buy, E/Esc out
//   · the wares are real: weapon level multiplies the hero's strike damage, armour cuts incoming damage by
//     15 / 30 / 45 %, a healing draught heals 45 hp (press G to drink)
//
// Gear lives on the player (`player.gear`), so the effects are felt by the combat code, not just the HUD.
import * as THREE from 'three';
import { createCharacter } from '../character/character.js';
import { Animator } from '../character/animator.js';
import { crowdLayer } from '../character/crowdMocap.js';
import { bus } from '../core/bus.js';
import { applyTo, captureFrom } from '../game/save.js';

const INK = 'var(--ink, #e8d3ad)';
const BRUSH = 'var(--f-serif, "Noto Serif SC", "Microsoft YaHei", serif)';
const SERIF = 'var(--f-serif, "Noto Serif SC", serif)';

/** Per shop: who runs it, what they say, and what is for sale. Prices in gold. */
const SHOPS = {
  weapon: {
    title: '铁匠工坊', keeper: { kind: 'citizen_m', seed: 3, name: '铁手布兰', line: '选一把可靠的剑，为下一段旅程做好准备。' },
    wares: [
      { id: 'w2', name: '精工长剑', note: '武器 II · 伤害 ×1.25', price: 130, has: (P) => P.gear.weapon >= 2, apply: (P) => { P.gear.weapon = 2; } },
      { id: 'w3', name: '大师长剑', note: '武器 III · 伤害 ×1.5', price: 320, has: (P) => P.gear.weapon >= 3, apply: (P) => { P.gear.weapon = 3; } },
      { id: 'wp', name: '治疗药水', note: '一瓶 · 按 G 服用', price: 30, apply: (P) => { P.gear.potions += 1; } },
    ],
  },
  armour: {
    title: '护甲工坊', keeper: { kind: 'citizen_m', seed: 15, name: '锻炉的莫德', line: '这一身，箭也穿不透，我担保。' },
    wares: [
      { id: 'a1', name: '铆钉皮甲', note: '护甲 I · 减伤 15%', price: 90, has: (P) => P.gear.armour >= 1, apply: (P) => { P.gear.armour = 1; } },
      { id: 'a2', name: '锁子甲', note: '护甲 II · 减伤 30%', price: 210, has: (P) => P.gear.armour >= 2, apply: (P) => { P.gear.armour = 2; } },
      { id: 'a3', name: '鳞甲胸铠', note: '护甲 III · 减伤 45%', price: 400, has: (P) => P.gear.armour >= 3, apply: (P) => { P.gear.armour = 3; } },
    ],
  },
  potion: {
    title: '炼金药房', keeper: { kind: 'citizen_old', seed: 1, name: '鹪鹩长老', line: '带上药水，活着回来。' },
    wares: [
      { id: 'p1', name: '治疗药水', note: '一瓶 · 回血 45 · 按 G 服用', price: 35, apply: (P) => { P.gear.potions += 1; } },
      { id: 'p3', name: '治疗药水 ×3', note: '每瓶回血 45 · 按 G 服用', price: 90, apply: (P) => { P.gear.potions += 3; } },
      { id: 'pw', name: '精工长剑', note: '武器 II · 伤害 ×1.25', price: 150, has: (P) => P.gear.weapon >= 2, apply: (P) => { P.gear.weapon = 2; } },
    ],
  },
};

export async function createShops(app, { game, shops = [] } = {}) {
  if (!game || !shops.length) return { update() {}, gear: () => null, dispose() {} };
  const P = game.player;
  applyTo(P);                                   // the purse and gear bought on earlier visits
  const saveGear = () => captureFrom(P);
  const heightAt = app.world.heightAt;
  const root = document.querySelector('.wx') ?? document.getElementById('hud') ?? document.body;

  // ------------------------------------------------------------------ style (ink brush, same palette as the HUD)
  const style = document.createElement('style');
  style.textContent = `
.wxs{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);text-align:center;pointer-events:none;
  font-family:${SERIF};color:${INK};opacity:0;transition:opacity .25s ease}
.wxs.on{opacity:.95}
.wxs b{display:block;font-family:${BRUSH};font-size:22px;letter-spacing:.12em;text-shadow:0 2px 10px rgba(0,0,0,.8)}
.wxs i{display:block;font-style:normal;font-size:12px;letter-spacing:.28em;opacity:.7;margin-top:4px}
.wxshop{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.97);width:min(560px,86vw);
  background:linear-gradient(180deg,rgba(23,28,34,.97),rgba(13,18,25,.97));border:1px solid rgba(232,211,173,.22);
  box-shadow:0 24px 70px rgba(0,0,0,.75);padding:22px 26px 18px;color:${INK};font-family:${SERIF};
  opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease}
.wxshop.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
.wxshop h3{margin:0 0 2px;font-family:${BRUSH};font-size:30px;font-weight:400;letter-spacing:.1em}
.wxshop .who{font-size:12px;letter-spacing:.2em;opacity:.62;margin-bottom:14px}
.wxshop .line{font-size:13px;opacity:.8;margin-bottom:16px;border-left:2px solid #b99a61;padding-left:10px}
.wxshop .it{display:flex;align-items:baseline;gap:12px;padding:9px 4px;border-bottom:1px solid rgba(232,211,173,.12)}
.wxshop .it .k{width:22px;font-size:12px;color:var(--gold,#f4cf86);opacity:.9}
.wxshop .it .n{flex:1}
.wxshop .it .n b{font-size:16px;font-weight:400;font-family:${BRUSH};letter-spacing:.06em}
.wxshop .it .n i{display:block;font-style:normal;font-size:11px;opacity:.6;letter-spacing:.1em;margin-top:2px}
.wxshop .it .p{font-size:14px;color:var(--gold,#f4cf86);white-space:nowrap}
.wxshop .it.have{opacity:.42}
.wxshop .it.have .p::after{content:' 已有';color:${INK};opacity:.6;font-size:11px}
.wxshop .foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12px;letter-spacing:.14em;opacity:.75}
.wxshop .msg{color:var(--verm,#b8322a);font-size:12px;letter-spacing:.16em;min-height:1em;margin-top:6px}
.wxgear{position:absolute;left:clamp(18px,3.2vw,56px);bottom:calc(clamp(18px,4vh,44px) + 125px);
  display:flex;gap:14px;font-family:${SERIF};font-size:13px;letter-spacing:.1em;color:${INK};text-shadow:0 1px 6px rgba(0,0,0,.8);pointer-events:none}
.wxgear em{font-style:normal;opacity:.55;font-size:11px;letter-spacing:.2em;margin-right:3px}
.wxgear .pulse{color:var(--gold,#f4cf86);transition:color .2s}
.wx:not([data-state=playing]) .wxgear{opacity:0}
.wx.touch .wxgear{top:calc(env(safe-area-inset-top) + 88px);bottom:auto;font-size:10px;gap:8px}
`;
  document.head.appendChild(style);

  // ------------------------------------------------------------------ DOM: prompt, panel, gear strip
  const prompt = document.createElement('div');
  prompt.className = 'wxs';
  prompt.innerHTML = '<b>按 E 交谈</b><i>与商人交易</i>';
  root.appendChild(prompt);

  const panel = document.createElement('div');
  panel.className = 'wxshop';
  root.appendChild(panel);

  const gearEl = document.createElement('div');
  gearEl.className = 'wxgear';
  root.appendChild(gearEl);

  let open = null;                 // the shop descriptor whose panel is open
  let msg = '', msgT = 0;

  function gearLine() {
    const g = P.gear;
    return `<span><em>护甲</em>${g.armour ? ['—', '皮甲', '锁子甲', '鳞甲'][g.armour] : '旅行服'}</span>` +
      `<span><em>武器</em>Lv.${g.weapon}</span>` +
      `<span><em>药水</em>×${g.potions}</span>` +
      `<span><em>金币</em>${g.gold}</span>`;
  }
  function refreshGear(flash = false) {
    gearEl.innerHTML = gearLine();
    if (flash) { gearEl.classList.add('pulse'); setTimeout(() => gearEl.classList.remove('pulse'), 420); }
    bus.emit('player:gear', { ...P.gear });
  }

  function renderPanel() {
    if (!open) return;
    const def = SHOPS[open.kind];
    const rows = def.wares.map((w, i) => {
      const have = w.has ? w.has(P) : false;
      const afford = P.gear.gold >= w.price;
      return `<div class="it${have ? ' have' : ''}" data-i="${i}">
        <span class="k">${i + 1}</span>
        <span class="n"><b>${w.name}</b><i>${w.note}</i></span>
        <span class="p">${afford || have ? '' : '金币不足 · '}${w.price} 金币</span></div>`;
    }).join('');
    panel.innerHTML = `<h3>${def.title}</h3><div class="who">${def.keeper.name} · 商人</div>
      <div class="line">「${def.keeper.line}」</div>${rows}
      <div class="msg">${msg}</div>
      <div class="foot"><span>1 / 2 / 3 购买 · E 或 Esc 离开</span><span>金币 ${P.gear.gold}</span></div>`;
  }

  function openShop(shop) {
    open = shop;
    msg = '';
    renderPanel();
    panel.classList.add('on');
    prompt.classList.remove('on');
  }
  function closeShop() {
    open = null;
    panel.classList.remove('on');
  }
  function buy(i) {
    if (!open) return;
    const def = SHOPS[open.kind], w = def.wares[i];
    if (!w) return;
    if (w.has ? w.has(P) : false) { msg = '这件您已经置办了。'; }
    else if (P.gear.gold < w.price) { msg = '金币不足。'; }
    else {
      P.gear.gold -= w.price;
      w.apply(P);
      msg = `购得 ${w.name}。`;
      refreshGear(true);
      saveGear();
    }
    msgT = 2.2;
    renderPanel();
  }

  // ------------------------------------------------------------------ input: swallow the keys while the panel is open
  function onKey(e, down) {
    if (!down) return;
    const code = e.code;
    const near = nearShop;
    if (open) {
      e.stopImmediatePropagation();
      if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') buy(Number(code.slice(5)) - 1);
      else if (code === 'KeyE' || code === 'Escape') closeShop();
      return;
    }
    if (code === 'KeyE' && near) { e.stopImmediatePropagation(); openShop(near); bus.emit('ui:sfx', { kind: 'open' }); return; }
    if (code === 'KeyG') {
      e.stopImmediatePropagation();
      if (P.gear.potions <= 0) { msg = '没有药水了。'; msgT = 1.6; }
    else if (P.hp >= P.maxHp) { msg = '生命值已满。'; msgT = 1.6; }
    else { P.gear.potions--; const got = P.heal(45); msg = `饮用药水，恢复 ${got} 点生命。`; msgT = 2.0; refreshGear(true); saveGear(); }
    }
  }
  const kd = (e) => onKey(e, true);
  window.addEventListener('keydown', kd, true);

  // ------------------------------------------------------------------ the keepers
  const keepers = [];
  let nearShop = null;
  const jobs = shops.map(async (shop) => {
    const def = SHOPS[shop.kind];
    if (!def) return;
    try {
      const ch = await createCharacter({ kind: def.keeper.kind, seed: def.keeper.seed });
      const anim = new Animator(ch.rig, { heightAt, normalAt: app.world.normalAt, style: 'bandit', kind: def.keeper.kind });
      anim.setArmed(false);
      const y = heightAt(shop.keeper.x, shop.keeper.z);
      ch.group.position.set(shop.keeper.x, y, shop.keeper.z);
      ch.group.rotation.y = shop.keeper.yaw;
      ch.sword?.setDrawn?.(false);
      ch.group.updateMatrixWorld(true);
      ch.resetCloth?.();
      app.scene.add(ch.group);
      // the body is in the world from here on; the mocap idle is attached when (if) the take pack arrives
      keepers.push({ ch, anim, layer: null, shop, def });
      crowdLayer(ch, def.keeper.kind, { alias: (n) => (n === 'idle' ? 'idle:chat' : n) })
        .then((L) => { const k = keepers.find((x) => x.shop === shop); if (k) k.layer = L; })
        .catch((e) => console.warn('[shops] keeper mocap failed', shop.kind, e?.message ?? e));
    } catch (e) { console.warn('[shops] keeper failed', shop.kind, e); }
  });

  refreshGear();

  const P3 = new THREE.Vector3();
  const sys = {
    update(dt, t = 0) {
      if (msgT > 0) { msgT -= dt; if (msgT <= 0 && open) { msg = ''; renderPanel(); } }
      // keepers: idle in place, watching the hero when he comes in
      const chest = P.chest(P3);
      let best = null, bestD = 3.6;
      for (const k of keepers) {
        const s = k.shop;
        const dx = P.pos.x - s.cx, dz = P.pos.z - s.cz;
        const inside = Math.abs(dx) < s.hw + 1.2 && Math.abs(dz) < s.hd + 1.2;
        const d = Math.hypot(P.pos.x - s.keeper.x, P.pos.z - s.keeper.z);
        if (inside && d < bestD) { bestD = d; best = s; }
        k.anim.setLocomotion({ speed: 0, dirX: 0, dirZ: 0, combat: false, turn: 0 });
        k.anim.lookAt(d < 9 ? chest : null);
        k.anim.update(dt, k.ch.group);
        k.ch.update(dt, t);
      }
      nearShop = best;
      prompt.classList.toggle('on', !!best && !open);
      if (best && !open) prompt.querySelector('b').textContent = `按 E 与 ${SHOPS[best.kind].keeper.name} 交谈`;
      if (open && (!best || best !== open)) closeShop();          // walked away: the panel closes itself
    },
    gear: () => ({ ...P.gear, hp: P.hp, maxHp: P.maxHp, weaponMul: P.weaponMul, armourCut: P.armourCut }),
    stats: () => ({ shops: shops.length, keepers: keepers.length, open: open?.kind ?? null }),
    dispose() {
      window.removeEventListener('keydown', kd, true);
      jobs.forEach(() => {});
      for (const k of keepers) { app.scene.remove(k.ch.group); k.ch.dispose?.(); }
      style.remove(); prompt.remove(); panel.remove(); gearEl.remove();
    },
  };
  app.add(sys);
  return sys;
}
