// Fire arts: brush inscription, travelling crescent, rising pillars and small pellets.
import * as THREE from 'three';
import { lamps } from '../core/lamps.js';

function inscriptionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, 1024, 256);
    const ink = ctx.createLinearGradient(0, 50, 0, 220);
    ink.addColorStop(0, '#fff1b4'); ink.addColorStop(0.48, '#ffad43'); ink.addColorStop(1, '#a62310');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '176px "Ma Shan Zheng", "STKaiti", "KaiTi", "Noto Serif SC", serif';
    ctx.shadowColor = 'rgba(255, 55, 8, .9)'; ctx.shadowBlur = 32;
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(37, 7, 4, .9)';
    ctx.strokeText('九逼火斩', 512, 126);
    ctx.fillStyle = ink; ctx.fillText('九逼火斩', 512, 126);
    ctx.shadowBlur = 0;
  };
  draw();
  if (document.fonts?.ready) document.fonts.ready.then(draw).then(() => { texture.needsUpdate = true; });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Fire01.png is a 32-frame, 8 × 4 transparent atlas. Every flame shares one GPU
// texture and a few shared materials; swapping UV geometry selects a frame without uploads.
function flameAtlas() {
  const texture = new THREE.TextureLoader().load('/assets/fx/Fire01.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const frames = Array.from({ length: 32 }, (_, frame) => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const uv = geometry.attributes.uv;
    const col = frame % 8, row = 3 - Math.floor(frame / 8);
    for (let i = 0; i < uv.count; i++) {
      // Inset half a pixel so adjacent frames cannot bleed into the flame.
      uv.setXY(i, (col + 0.004 + uv.getX(i) * 0.992) / 8,
        (row + 0.002 + uv.getY(i) * 0.996) / 4);
    }
    return geometry;
  });
  return { texture, frames };
}

export function createFireEffects(app) {
  const textMap = inscriptionTexture();
  const { texture: flameMap, frames } = flameAtlas();
  const flameMat = new THREE.MeshBasicMaterial({ map: flameMap, transparent: true,
    blending: THREE.NormalBlending, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false, opacity: 0.9 });
  const waveMat = flameMat.clone();
  waveMat.opacity = 0.82;
  const pillarMat = flameMat.clone();
  pillarMat.opacity = 0.96;
  const ballGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xffdc89, toneMapped: false });
  const titleGeo = new THREE.PlaneGeometry(4.9, 1.25);
  const titles = [];
  const waves = new Set();
  const pillars = new Set();
  const away = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const right = new THREE.Vector3();

  function makeFlame(material, name) {
    const mesh = new THREE.Mesh(frames[0], material);
    mesh.name = name; mesh.layers.set(1); mesh.renderOrder = 24; mesh.frustumCulled = false;
    app.scene.add(mesh);
    return mesh;
  }

  function title(actor) {
    const material = new THREE.MeshBasicMaterial({ map: textMap, transparent: true, depthTest: true,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0 });
    const mesh = new THREE.Mesh(titleGeo, material);
    mesh.name = 'fx.fire.inscription'; mesh.layers.set(1); mesh.renderOrder = 23; mesh.frustumCulled = false;
    app.scene.add(mesh);
    titles.push({ actor, mesh, material, age: 0 });
  }

  function pillar(pos) {
    const specs = [
      { x: -0.46, depth: -0.12, y: 1.30, w: 1.12, h: 2.75, phase: 0 },
      { x: 0.42, depth: 0.08, y: 1.43, w: 1.05, h: 2.95, phase: 11 },
      { x: 0.03, depth: 0.24, y: 1.33, w: 1.17, h: 2.82, phase: 23 },
    ];
    const flames = specs.map(spec => ({ spec, mesh: makeFlame(pillarMat, 'fx.fire.pillar') }));
    const light = lamps.add({ pos: pos.clone().add(new THREE.Vector3(0, 1.3, 0)),
      color: [1, 0.27, 0.045], weight: 5, flicker: 0.36 });
    const effect = { pos: pos.clone(), flames, light, age: 0, dead: false, dispose() {
      if (effect.dead) return;
      effect.dead = true;
      for (const { mesh } of flames) mesh.removeFromParent();
      light.remove(); pillars.delete(effect);
    } };
    pillars.add(effect);
    return effect;
  }

  function fireball(pos, dir) {
    const flame = makeFlame(flameMat, 'fx.fire.pellet');
    const core = new THREE.Mesh(ballGeo, ballMat);
    core.name = 'fx.fire.pelletCore'; core.layers.set(1); core.renderOrder = 25;
    app.scene.add(core);
    const effect = { dead: false,
      update(p, d, age) {
        if (effect.dead) return;
        flame.geometry = frames[Math.floor(age * 32 + 6) % 32];
        flame.position.copy(p).addScaledVector(d, -0.18);
        flame.quaternion.copy(app.camera.quaternion);
        flame.scale.set(0.47, 0.7, 1);
        core.position.copy(p);
      },
      dispose() {
        if (effect.dead) return;
        effect.dead = true;
        flame.removeFromParent(); core.removeFromParent();
      },
    };
    effect.update(pos, dir, 0);
    return effect;
  }

  function wave(parent, dir) {
    const specs = Array.from({ length: 7 }, (_, i) => {
      const u = (i + 0.5) / 7;
      const angle = (u - 0.5) * 2.1;
      return { x: Math.sin(angle) * 1.63, z: Math.cos(angle) * 1.63 - 1.22,
        y: 0.34, w: 0.52 + Math.sin(u * Math.PI) * 0.18,
        h: 0.83 + Math.sin(u * Math.PI) * 0.27, phase: (i * 9) % 32 };
    });
    const flames = specs.map(spec => ({ spec, mesh: makeFlame(waveMat, 'fx.fire.wave') }));
    const effect = { parent, dir: dir.clone(), flames, age: 0, dead: false, dispose() {
      if (effect.dead) return;
      effect.dead = true;
      for (const { mesh } of flames) mesh.removeFromParent();
      waves.delete(effect);
    } };
    waves.add(effect);
    return effect;
  }

  function update(dt) {
    for (let i = titles.length - 1; i >= 0; i--) {
      const item = titles[i];
      item.age += dt;
      if (item.age >= 1.35) {
        item.mesh.removeFromParent(); item.material.dispose(); titles.splice(i, 1); continue;
      }
      const p = item.actor.pos;
      away.set(p.x - app.camera.position.x, 0, p.z - app.camera.position.z);
      if (away.lengthSq() < 1e-5) away.set(0, 0, 1); else away.normalize();
      item.mesh.position.set(p.x, p.y + 2.2 + item.age * 0.22, p.z).addScaledVector(away, 1.25);
      item.mesh.quaternion.copy(app.camera.quaternion);
      item.mesh.scale.setScalar(0.87 + Math.min(item.age / 0.35, 1) * 0.18);
      item.material.opacity = Math.min(1, item.age / 0.13) * (1 - THREE.MathUtils.smoothstep(item.age, 0.78, 1.35));
    }
    for (const effect of pillars) {
      effect.age += dt;
      toward.set(app.camera.position.x - effect.pos.x, 0, app.camera.position.z - effect.pos.z);
      if (toward.lengthSq() < 1e-5) toward.set(0, 0, 1); else toward.normalize();
      right.set(toward.z, 0, -toward.x);
      const rise = THREE.MathUtils.smoothstep(effect.age, 0, 0.22);
      const fade = 1 - THREE.MathUtils.smoothstep(effect.age, 0.9, 1.25);
      effect.light.weight = 5 * fade;
      for (const { spec, mesh } of effect.flames) {
        const flicker = Math.sin(effect.age * 19 + spec.phase);
        mesh.geometry = frames[Math.floor(effect.age * 26 + spec.phase) % 32];
        mesh.position.copy(effect.pos).addScaledVector(right, spec.x)
          .addScaledVector(toward, spec.depth);
        mesh.position.y += spec.y * rise;
        mesh.quaternion.copy(app.camera.quaternion);
        mesh.scale.set(spec.w * (1 + flicker * 0.12) * fade,
          spec.h * rise * (1 - flicker * 0.07) * fade, 1);
      }
      if (effect.age >= 1.25) effect.dispose();
    }
    for (const effect of waves) {
      effect.age += dt;
      right.set(effect.dir.z, 0, -effect.dir.x);
      for (const { spec, mesh } of effect.flames) {
        const flicker = Math.sin(effect.age * 23 + spec.phase);
        mesh.geometry = frames[Math.floor(effect.age * 28 + spec.phase) % 32];
        mesh.position.copy(effect.parent.position).addScaledVector(right, spec.x)
          .addScaledVector(effect.dir, spec.z);
        mesh.position.y += spec.y + flicker * 0.05;
        mesh.quaternion.copy(app.camera.quaternion);
        const fade = 1 - THREE.MathUtils.smoothstep(effect.age, 0.55, 0.8);
        mesh.scale.set(spec.w * (0.9 + flicker * 0.1) * fade,
          spec.h * (0.9 + flicker * 0.08) * fade, 1);
      }
    }
  }

  return { title, pillar, fireball, wave, update };
}
