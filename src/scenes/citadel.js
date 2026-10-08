// 石城 · citadel — the medieval walled town, walkable and peaceful (?scene=citadel).
// Owner: citadel.
//
//   ?scene=citadel                      the hero walks the town (WASD + mouse, click to capture the pointer)
//   &state=title                        start on the title screen instead (the first click begins the walk)
//   &game=0  or  &view=<name>           no player: a free camera on a bookmark (west|east|north|south|street|
//                                       cross|square|church|wall|aerial|top) — for reviewing the map
//   &mood=afternoon|golden|ember|blue|night   time of day (the torches and lit windows come up at dusk)
//   &crowd=0|N                          townsfolk (default by quality: 11 / 16 / 22)
//   &hud=0  &q=low|med|high             as elsewhere
//
// No combat: the level has an empty wave list, so the game runs in the director's 'explore' state — the hero has
// his sword sheathed, there is nothing to fight, and the only other actors are the townsfolk.
import * as THREE from 'three';

const nextTick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

// [pos (y above ground), target (y above ground), fov]
const VIEWS = {
  west: [[-84, 2.4, 2.5], [-60, 6.0, 0], 52],          // walking up to the west gate
  east: [[84, 2.4, -2.5], [60, 6.0, 0], 52],
  north: [[-2.5, 2.4, -68], [0, 6.0, -45], 52],
  south: [[2.5, 2.4, 68], [0, 6.0, 45], 52],
  street: [[-44, 1.7, 0.4], [16, 4.2, 0], 54],         // from just inside the west gate down the main street
  cross: [[0.4, 1.7, 34], [0, 3.2, -24], 54],          // up the cross street, across the square
  square: [[11, 2.0, 13], [-2, 4.6, -19], 54],         // the market square and the guild hall
  church: [[-16, 2.2, -16], [-33, 8.0, -30], 50],
  wall: [[-74, 11, -40], [10, 6.5, -6], 46],           // the curtain wall and its round towers from outside
  aerial: [[92, 66, 122], [0, 0, 0], 44],
  top: [[0, 155, 2], [0, 0, 0], 45],
};

export default async function (app) {
  const p = app.params;
  // the town's layout is a level (levels/citadel.js): without it nothing below knows where the streets go, and
  // the terrain workers bake with the wrong layout. Normalise the URL once and reload into it.
  if (p.get('level') !== 'citadel') {
    p.set('level', 'citadel');
    location.replace(`${location.pathname}?${p.toString()}`);
    return;
  }
  const { LAYOUT } = await import('../world/layout.js');
  const { LEVELS } = await import('../levels/index.js');
  const L = LEVELS.citadel;
  const EV = L.env ?? {};
  const q = app.quality?.name ?? 'med';
  const step = async (v, label) => { app.progress(v, label); await nextTick(); };
  const load = async (label, path, fn, ...args) => {
    try {
      const mod = await import(path);
      if (typeof mod[fn] !== 'function') throw new Error(`${path} has no ${fn}`);
      return await mod[fn](...args);
    } catch (err) {
      console.error(`[citadel] ${label} failed:`, err);
      return null;
    }
  };

  await step(0.04, '天 · sky');
  const env = await load('environment', '../world/environment.js', 'createEnvironment', app,
    { mood: p.get('mood') || EV.mood || 'afternoon', drift: EV.drift ?? true });
  if (env && !p.has('mood') && EV.u !== undefined) env.setU?.(EV.u, 0);
  if (env && EV.exposure) env.exposureMul = EV.exposure;
  { const { setWindStrength } = await import('../core/wind.js'); setWindStrength?.(EV.wind ?? 0.9, 0.01); }

  await step(0.12, '地 · earth');
  const terrain = await load('terrain', '../world/terrain.js', 'createTerrain', app);
  await step(0.2, '山 · hills');
  await load('mountains', '../world/mountains.js', 'createMountains', app);
  await load('rocks', '../world/rocks.js', 'createRocks', app);

  await step(0.3, '风 · wind');
  const interaction = await load('interaction', '../world/interaction.js', 'createInteraction', app);
  await step(0.38, '草 · grass');
  const grass = await load('grass', '../world/grass.js', 'createGrass', app, { density: app.quality?.grass ?? [1.15, 0.85, 0.65] });
  app.grass = grass;
  { const { applyQuality } = await import('../core/quality.js'); const { bus } = await import('../core/bus.js');
    bus.on('ui:quality', (x) => applyQuality(app, x.name, { grass })); }
  await step(0.46, '树 · trees');
  await load('trees', '../world/trees.js', 'createTrees', app, {
    hero: false, pines: L.biome.pines, band: L.biome.band,
    // the far band and the pines keep out of the town (its blockers are registered by createCitadel, below)
  });

  await step(0.56, '城 · walls');
  const citadel = await load('citadel', '../world/citadel.js', 'createCitadel', app, { citadel: LAYOUT.citadel });
  if (citadel) console.log('[citadel]', JSON.stringify(citadel.stats()));
  await step(0.68, '尘 · motes');
  const vfx = await load('vfx', '../fx/vfx.js', 'createVFX', app, { interaction });
  await load('ambient', '../fx/ambient.js', 'createAmbient', app);

  await step(0.78, '声 · sound');
  const hud = await load('hud', '../ui/hud.js', 'createHUD', app);
  const audio = await load('audio', '../audio/audio.js', 'createAudio', app);

  // ---- the player: a walk, not a fight
  const wantView = p.get('view');
  const walk = p.get('game') !== '0' && !wantView;
  let game = null;
  if (walk) {
    await step(0.86, '剑 · sword');
    game = await load('game', '../game/game.js', 'createGame', app, { env, terrain, grass, vfx, hud, audio, interaction });
    if (game) {
      const { WAVES } = await import('../game/director.js');
      const D = game.director;
      // this level has no waves: the director's wave machinery is replaced by plain exploration
      if (!WAVES.length) {
        D.begin = () => D.explore();
        D.startWave = () => D.explore();
        D.restartWave = () => D.explore();
      }
      if ((p.get('state') ?? 'explore') !== 'title') {
        D.explore();
        game.camera.setMode('follow', { heading: game.camera.sunHeading, force: true });
        game.camera.snap();
        game.player.setDrawn(false);                 // he has no reason to draw
      }
      const sp = LAYOUT.playerSpawn;
      game.player.place(sp.x, sp.z, sp.yaw);
      game.camera.snap();
      // the saved purse and gear (game/save.js): what you bought, and what you were paid for clearing a gate
      const { applyTo } = await import('../game/save.js');
      applyTo(game.player);
    }
    // phones and tablets: the same ink-brush controls as the rest of the game
    if (game && hud) await load('touch', '../ui/touch.js', 'createTouchControls', app, { game, hud });
  }

  // ---- the town's shops: a modelled keeper behind each counter, an ink panel to buy wares, and the hero's gear
  //      (weapon level, armour value, healing draughts). ?shops=0 turns it all off. Started *after* the crowd so
  //      the townsfolk are not stuck behind the keepers in the character-build queue.
  let rpg = null;

  // ---- townsfolk going about their business
  let crowd = null;
  const crowdN = p.has('crowd') ? parseInt(p.get('crowd'), 10) : Math.round(30 * ({ low: 0.45, med: 0.7, high: 1 }[q] ?? 0.7));
  if (crowdN > 0) {
    crowd = await load('citizens', '../world/citizens.js', 'createCitizens', app, {
      count: crowdN, town: LAYOUT.town,
      avoid: () => (game ? [{ x: game.player.pos.x, z: game.player.pos.z, r: 4 }] : []),
    });
    if (crowd) {
      const { bus } = await import('../core/bus.js');
      bus.on('game:state', (e) => { if (e?.state === 'title') crowd.setPanic(0); });
    }
  }

  // ---- camera: the free review bookmarks, or the debug orbit when there is no player
  function view(name) {
    const v = VIEWS[name] || VIEWS.street;
    const [pp, tt, fov] = v;
    const H = (x, z) => app.world.heightAt(x, z);
    app.setView({
      pos: [pp[0], H(pp[0], pp[2]) + pp[1], pp[2]],
      target: [tt[0], H(tt[0], tt[2]) + tt[1], tt[2]], fov: fov ?? 52,
    });
    const f = new THREE.Vector3(pp[0] + (tt[0] - pp[0]) * 0.5, 0, pp[2] + (tt[2] - pp[2]) * 0.5);
    f.y = H(f.x, f.z);
    env?.setShadowFocus?.(f);
  }
  if (!walk) {
    view(p.get('view') || 'street');
    if (p.get('orbit') !== '0') app.debugControls();
  }

  // ---- the town's shops (after the crowd, see above)
  if (game && p.get('shops') !== '0') {
    await step(0.94, '市 · shops');
    rpg = await load('shops', '../ui/shop.js', 'createShops', app, { game, shops: citadel?.shops ?? [] });
    if (rpg) console.log('[shops]', JSON.stringify(rpg.stats()));
  }

  // ---- the four gates: walk out of one and a travel prompt offers the instance beyond it (ui/gates.js)
  let gateSys = null;
  if (game) {
    gateSys = await load('gates', '../ui/gates.js', 'createGates', app, { game, gates: citadel?.gates ?? [] });
    if (gateSys) console.log('[gates]', JSON.stringify(gateSys.stats()));
  }

  await step(0.98, '');
  await load('level', '../levels/runtime.js', 'createLevelRuntime', app, { env, level: L });
  window.__citadel = { citadel, env, crowd, game, rpg, view, views: VIEWS, level: L };
  app.progress(1, '');
  await app.ready();
}
