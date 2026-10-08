// Level runtime: the level's own beats that no world module owns. Owner: integrator.
//   createLevelRuntime(app, { env, level }) → { next() }
//   · lightning: fx/storm.js at the level's interval (level.env.lightning = [min, max] s) — flash + bus 'thunder'
//   · title screen: the chapter's name and tagline instead of the game's (level 2 onward)
//   · lanterns: stone lanterns (石灯笼) with a flickering warm lamp each (level.lanterns = [{x, z, yaw?}])
//   · victory: the 'go' seal reads 前行 and bus 'ui:next' loads the next level (a fade, then the page reloads with
//     ?level=next; the quality/audio params survive)
import * as THREE from 'three';
import { bus } from '../core/bus.js';
import { lamps } from '../core/lamps.js';
import { patchMaterial } from '../core/atmosphere.js';
import { LAYERS } from '../core/globals.js';
import { levelUrl, LEVELS, LEVEL_ORDER } from './index.js';
import { grant, captureFrom, applyTo } from '../game/save.js';
import { createLightning } from '../fx/storm.js';
import { REGIONS } from '../ui/theme.js';

export function createLevelRuntime(app, { env = null, level, game = null } = {}) {
  const EV = level.env ?? {};
  let leaving = false;
  if (EV.lightning) createLightning(app, env, { interval: EV.lightning });

  // ---- stone lanterns: plinth, post, fire box (glowing paper windows), roof, finial; one lamp each
  if (level.lanterns?.length && app.world?.heightAt) {
    const stone = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x6b6a62, roughness: 0.92 }));
    const glow = new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: 0xff9a40, emissiveIntensity: 0.9, roughness: 0.8 });
    const parts = (y0) => [
      [new THREE.CylinderGeometry(0.34, 0.4, 0.18, 6), y0 + 0.09, stone],
      [new THREE.CylinderGeometry(0.11, 0.14, 0.72, 6), y0 + 0.54, stone],
      [new THREE.CylinderGeometry(0.3, 0.26, 0.1, 6), y0 + 0.95, stone],
      [new THREE.BoxGeometry(0.3, 0.26, 0.3), y0 + 1.13, glow],
      [new THREE.ConeGeometry(0.46, 0.26, 6), y0 + 1.39, stone],
      [new THREE.SphereGeometry(0.07, 8, 6), y0 + 1.56, stone],
    ];
    const root = new THREE.Group(); root.name = 'lanterns';
    for (const L of level.lanterns) {
      const y0 = app.world.heightAt(L.x, L.z) - 0.05;
      for (const [g, y, m] of parts(y0)) {
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(L.x, y, L.z); mesh.rotation.y = L.yaw ?? 0;
        mesh.castShadow = m === stone; mesh.receiveShadow = true;
        mesh.layers.set(LAYERS.WORLD);
        root.add(mesh);
      }
      lamps.add({ pos: new THREE.Vector3(L.x, y0 + 1.15, L.z), color: [1.0, 0.55, 0.22], weight: L.weight ?? 3.2, flicker: 0.35 });
      app.world.colliders?.push({ x: L.x, z: L.z, r: 0.42 });
    }
    app.scene.add(root);
  }

  // ---- screens
  const hud = document.querySelector('.wx');
  const title = hud?.querySelector('.scr.title');
  if (title) {
    const region = REGIONS[level.id] ?? { title: level.title, en: level.en, tagline: level.tagline };
    const tt = title.querySelector('.col .tt'), tg = title.querySelector('.col .tg');
    const en = title.querySelector('.en b'), ei = title.querySelector('.en i');
    if (tt) tt.textContent = region.title;
    if (tg) tg.textContent = region.tagline ?? '';
    if (en) en.textContent = region.en ?? '';
    if (ei) ei.textContent = '';
  }
  // pause menu: 章 — every chapter of the journey (the current one marked)
  const qual = hud?.querySelector('.pause .qual');
  if (qual && !hud.querySelector('.pause .chap')) {
    const row = document.createElement('div');
    row.className = 'qual chap';
    row.innerHTML = '<b>远征区域</b>' + [...LEVEL_ORDER, 'hollow'].map((id) => `<span class="qo${id === level.id ? ' on' : ''}" data-level="${id}">${REGIONS[id]?.title ?? LEVELS[id].title}</span>`).join('') + '<i>REGIONS</i>';
    qual.after(row);
    row.addEventListener('click', (e) => {
      const id = e.target?.closest?.('[data-level]')?.dataset.level;
      if (!id || id === level.id || leaving) return;
      leaving = true;
      bus.emit('ui:sfx', { kind: 'seal' });
      app.pipeline?.fx?.fade?.(1, 0.8, 'black');
      setTimeout(() => {
        const url = new URL(levelUrl(id), location.href);
        url.searchParams.set('scene', id === 'hollow' ? 'hollow' : 'full');
        location.href = url.href;
      }, 850);
    });
  }
  // ---- the hub loop: a cleared level always pays its first-time reward and sends the hero home to Stonegate.
  //      The town is the hub — from there you pick the next gate, so there is no onward "next chapter" chain.
  const setVictorySeal = () => {
    const go = hud?.querySelector('.scr.victory .go');
    if (!go) return;
    go.dataset.act = 'home';
    go.innerHTML = '<b>返回城镇</b><i>RETURN TO STONEGATE</i>';
  };
  setVictorySeal();
  bus.on('game:state', (p) => { if (p?.state === 'victory') setTimeout(setVictorySeal, 50); });
  {
    bus.on('game:state', (p) => {
      if (p?.state !== 'victory') return;
      if (game) captureFrom(game.player);
      const got = grant(level.id);
      if (game) applyTo(game.player);
      const scr = hud?.querySelector('.scr.victory');
      const line = got
        ? `通关奖励 · ${got.gold} 金${got.potions ? ` · 治疗药水 ×${got.potions}` : ''}`
        : '本区域首通奖励已领取 · 挑战完成';
      if (scr) scr.insertAdjacentHTML('beforeend', `<div class="reward">${line}</div>`);
      console.log('[reward]', level.id, JSON.stringify(got ?? null));
    });
  }
  function goHome() {
    if (leaving) return;
    leaving = true;
    if (game) captureFrom(game.player);
    bus.emit('ui:sfx', { kind: 'seal' });
    app.pipeline?.fx?.fade?.(1, 1.0, 'black');
    const q = new URLSearchParams(location.search);
    q.set('scene', 'citadel');
    q.delete('level'); q.delete('from'); q.delete('wave');
    setTimeout(() => { location.href = `${location.pathname}?${q.toString()}`; }, 1100);
  }

  function next() {
    if (leaving || !level.next) return;
    leaving = true;
    bus.emit('ui:sfx', { kind: 'seal' });
    app.pipeline?.fx?.fade?.(1, 1.1, 'black');
    setTimeout(() => { location.href = levelUrl(level.next); }, 1200);
  }
  bus.on('ui:next', next);
  bus.on('ui:home', goHome);           // the director's victory state and the seal both send the hero home
  // the victory seal (HUD 'data-act' buttons): 回城 goes back to the town, and so does the defeat screen's seal
  hud?.addEventListener('click', (e) => {
    if (e.target?.closest?.('[data-act="next"]')) next();
    else if (e.target?.closest?.('[data-act="home"]')) goHome();
  }, true);

  return { next };
}
