// 枯林圣堂 · hollow — the instance behind the south gate of Stonegate (?scene=hollow). Owner: integrator.
//
//   ?scene=hollow                     the hero walks in from the lychgate
//   &game=0  or  &view=<name>         no player: a free camera (gate|nave|altar|yard|graves|tower|aerial|top)
//   &mood=afternoon|golden|ember|blue|night      time of day (default: the level's own 'blue' hour)
//
// Four encounters lead from the churchyard into the nave and to the altar. Victory pays the hub reward.
import * as THREE from 'three';
import { applyTo } from '../game/save.js';
import { loadPBR } from '../core/assets.js';

const VIEWS = {
  gate: [[0, 2.8, 46], [0, 6, 10], 52],
  path: [[0, 2.6, 30], [0, 5, 8], 54],
  nave: [[-6, 2.4, 3], [12, 5, -1], 62],
  altar: [[6.5, 2.6, 1], [19, 3.4, 0], 58],
  yard: [[-18, 3.2, 15], [4, 7, -4], 60],
  graves: [[15, 2.6, 18], [2, 2.4, 4], 58],
  tower: [[-8, 3.4, 14], [-16, 9, 5], 56],
  aerial: [[44, 40, 60], [0, 3, 0], 44],
  top: [[2, 78, 30], [2, 0, 0], 40],
};

export default async function (app) {
  const p = app.params;
  // the level must be the page's level before anything else: the terrain workers bake from it (world/layout.js)
  if (p.get('level') !== 'hollow') {
    p.set('level', 'hollow');
    location.replace(`${location.pathname}?${p.toString()}`);
    return;
  }
  const { LEVELS } = await import('../levels/index.js');
  const L = LEVELS.hollow;
  const EV = L.env ?? {};
  const step = async (v, label) => { app.progress(v, label); await new Promise((r) => setTimeout(r, 0)); };
  const load = async (label, path, fn, ...args) => {
    try {
      const mod = await import(path);
      if (typeof mod[fn] !== 'function') throw new Error(`${path} has no ${fn}`);
      return await mod[fn](...args);
    } catch (err) {
      console.error(`[hollow] ${label} failed:`, err);
      return null;
    }
  };

  await step(0.04, '天 · sky');
  const env = await load('environment', '../world/environment.js', 'createEnvironment', app,
    { mood: p.get('mood') || EV.mood || 'blue', drift: EV.drift ?? true });
  if (env && !p.has('mood') && EV.u !== undefined) env.setU?.(EV.u, 0);
  if (env && EV.exposure) env.exposureMul = EV.exposure;
  { const { setWindStrength } = await import('../core/wind.js'); setWindStrength?.(EV.wind ?? 1.1, 0.01); }

  await step(0.14, '地 · earth');
  const terrain = await load('terrain', '../world/terrain.js', 'createTerrain', app);
  await step(0.22, '丘 · hills');
  await load('mountains', '../world/mountains.js', 'createMountains', app);
  await load('rocks', '../world/rocks.js', 'createRocks', app);

  await step(0.32, '风 · wind');
  const interaction = await load('interaction', '../world/interaction.js', 'createInteraction', app);
  await step(0.4, '草 · grass');
  const grass = await load('grass', '../world/grass.js', 'createGrass', app, { density: app.quality?.grass ?? [1.15, 0.85, 0.65] });
  app.grass = grass;
  { const { applyQuality } = await import('../core/quality.js'); const { bus } = await import('../core/bus.js');
    bus.on('ui:quality', (x) => applyQuality(app, x.name, { grass })); }

  await step(0.55, '圣堂 · the chapel');
  const hollow = await load('hollow', '../world/hollow.js', 'createHollow', app, { loadPBR });
  if (hollow?.colliders?.length) app.world.colliders.push(...hollow.colliders);

  await step(0.68, '尘 · motes');
  const vfx = await load('vfx', '../fx/vfx.js', 'createVFX', app, { interaction });
  await load('ambient', '../fx/ambient.js', 'createAmbient', app);

  await step(0.78, '声 · sound');
  const hud = await load('hud', '../ui/hud.js', 'createHUD', app);
  const audio = await load('audio', '../audio/audio.js', 'createAudio', app);

  // ---- the hero and the four encounters
  const view = p.get('view');
  const walk = p.get('game') !== '0' && !view;
  let game = null;
  if (walk) {
    await step(0.86, '剑 · sword');
    game = await load('game', '../game/game.js', 'createGame', app, { env, terrain, grass, vfx, hud, audio, interaction });
    if (game) {
      applyTo(game.player);
      await load('route guide', '../ui/encounter.js', 'createEncounterGuide', app, { game, hud });
    }
    if (game && hud) await load('touch', '../ui/touch.js', 'createTouchControls', app, { game, hud });
  } else {
    const name = view || 'gate';
    const v = VIEWS[name] ?? VIEWS.gate;
    const H = (x, z) => app.world.heightAt(x, z);
    app.setView({ pos: [v[0][0], H(v[0][0], v[0][2]) + v[0][1], v[0][2]], target: [v[1][0], H(v[1][0], v[1][2]) + v[1][1], v[1][2]], fov: v[2] ?? 52 });
    const f = new THREE.Vector3((v[0][0] + v[1][0]) / 2, 0, (v[0][2] + v[1][2]) / 2);
    f.y = H(f.x, f.z);
    env?.setShadowFocus?.(f);
    if (p.get('orbit') !== '0') app.debugControls();
  }

  // The shared runtime owns the title, defeat/restart screens, reward and return-to-town seal.
  if (game) await load('level runtime', '../levels/runtime.js', 'createLevelRuntime', app, { env, level: L, game });

  await step(0.98, '');
  window.__hollow = { hollow, env, terrain, game, view, views: VIEWS, level: L };
  app.progress(1, '');
  await app.ready();
}
