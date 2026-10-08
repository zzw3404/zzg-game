// A small route objective for encounters that start when the player enters a room.
import * as THREE from 'three';
import { bus } from '../core/bus.js';
import { patchMaterial } from '../core/atmosphere.js';
import { displayLabel } from './theme.js';

export function createEncounterGuide(app, { game, hud }) {
  const root = document.createElement('div');
  root.className = 'encounter-guide';
  root.innerHTML = '<span class="encounter-heading"></span><b></b><small></small>';
  const style = document.createElement('style');
  style.textContent = `.encounter-guide{position:absolute;bottom:20%;left:50%;transform:translateX(-50%);text-align:center;color:#e9deca;
    width:max-content;max-width:85%;padding:12px 24px;border:1px solid #b99a6140;background:linear-gradient(120deg,#151a21e0,#0c1119b8);
    font-family:var(--f-serif,serif);text-shadow:0 2px 8px #000;opacity:0;transition:opacity .3s;pointer-events:none}
    .encounter-guide.on{opacity:1}.encounter-guide span,.encounter-guide b,.encounter-guide small{display:block}
    .encounter-guide span{font-size:11px;letter-spacing:.2em;opacity:.68;margin-bottom:7px}
    .encounter-guide b{font-size:15px;font-weight:400;letter-spacing:.12em}.encounter-guide small{margin-top:6px;font-size:11px;opacity:.65}`;
  document.head.appendChild(style);
  (hud?.el ?? document.body).appendChild(root);
  const mat = patchMaterial(new THREE.MeshBasicMaterial({ color: 0xd7b16b, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  const marker = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.1, 48), mat);
  marker.name = 'encounter-waypoint'; marker.rotation.x = -Math.PI / 2; marker.visible = false;
  app.scene.add(marker);
  let target = null;
  const offTravel = bus.on('wave:travel', (p) => {
    target = p;
    root.querySelector('span').textContent = `远征 ${p.index} / ${p.total} · ${displayLabel(p.title).title}`;
    root.querySelector('b').textContent = p.hint;
    marker.position.set(p.x, game.heightAt(p.x, p.z) + 0.14, p.z);
  });
  const offStart = bus.on('wave:start', () => { target = null; });
  app.add({
    update(dt) {
      const visible = !!target && game.state === 'playing' && game.director.state === 'travel' && !game.paused;
      root.classList.toggle('on', visible); marker.visible = visible;
      if (!visible) return;
      const distance = Math.hypot(target.x - game.player.pos.x, target.z - game.player.pos.z);
      root.querySelector('small').textContent = `距离 ${Math.round(distance)} 米 · 金色圆环为前行目标`;
      marker.rotation.z += dt * 0.18;
      mat.opacity = 0.36 + Math.sin(app.time.t * 2) * 0.09;
    },
    dispose() { offTravel(); offStart(); root.remove(); style.remove(); marker.geometry.dispose(); mat.dispose(); app.scene.remove(marker); },
  });
}
