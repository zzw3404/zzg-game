// Exercise the chapel's real level, map colliders, pooled enemies and director together in an isolated process.
import assert from 'node:assert/strict';
import { fakeApp, fakeCharacter, FakeAnimator } from './fakes.mjs';
globalThis.location = { search: '?level=hollow' };
globalThis.document = { getElementById: () => null };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
const { createGame } = await import('../game.js');
const { createHollow } = await import('../../world/hollow.js');
const { LEVEL } = await import('../../levels/index.js');
const { bus } = await import('../../core/bus.js');
const { overlapsDisc, blocksBody } = await import('../../world/collision.js');
const { createHollowStoneMaterial } = await import('../../world/hollow-mat.js');
const { Texture } = await import('three');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok   ${name}`); }
const { app } = fakeApp('state=playing&nointro');
const map = await createHollow(app, { loadPBR: async () => null });
app.world.colliders.push(...map.colliders);
const g = await createGame(app, { createCharacter: async (o) => fakeCharacter(o), AnimatorClass: FakeAnimator });
const D = g.director;
const living = () => g.enemies.filter((e) => e.active && e.alive);
const clear = (x, z, r = 0.65) => !map.colliders.some((c) => blocksBody(c, 0) && overlapsDisc(c, x, z, r));
let victories = 0;
const off = bus.on('game:state', (p) => { if (p.state === 'victory') victories++; });
test('chapel uses diffuse, normal, roughness and AO maps with matte stone relief', () => {
  const map = new Texture(), normalMap = new Texture(), armMap = new Texture();
  const mat = createHollowStoneMaterial({ map, normalMap, armMap });
  assert.equal(mat.map, map); assert.equal(mat.normalMap, normalMap);
  assert.equal(mat.roughnessMap, armMap); assert.equal(mat.aoMap, armMap);
  assert(mat.normalScale.x >= 1 && mat.roughness === 1 && mat.metalness === 0);
  mat.dispose(); map.dispose(); normalMap.dispose(); armMap.dispose();
});
test('all four spawn lists and restart checkpoints fit the real chapel geometry', () => {
  assert.equal(LEVEL.waves.length, 4);
  for (const W of LEVEL.waves) {
    assert.equal(W.enemies.length, W.spawns.length);
    for (const p of [...W.spawns, W.checkpoint, W.trigger]) assert(clear(p.x, p.z), `${W.title} blocked at ${p.x},${p.z}`);
    for (const p of W.spawns) {
      const n = Math.ceil(Math.hypot(p.x - W.checkpoint.x, p.z - W.checkpoint.z) / 0.1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        assert(clear(p.x * (1 - t) + W.checkpoint.x * t, p.z * (1 - t) + W.checkpoint.z * t, 0.5), `${W.title} melee route blocked`);
      }
    }
  }
});
test('entering the churchyard starts the first encounter; waiting outside spawns nobody', () => {
  D.update(1.1); assert.equal(D.state, 'travel');
  D.update(30); assert.equal(living().length, 0); assert.equal(victories, 0);
  g.player.place(0, 22, Math.PI); D.update(0.02); D.update(0.02);
  assert.equal(D.wave, 0); assert.equal(living().length, 3);
});
function clearCurrentWave() {
  const active = living();
  for (const e of active) {
    const last = D.isLastKill(e);
    e.alive = false; e.state = 'dead';
    D.onKill(e, last);
  }
  assert.equal(D.state, 'clear');
  D.update(6);
}
test('clears lead to the next room; the nave stays empty until entered', () => {
  clearCurrentWave();
  g.player.place(0, 18, Math.PI); D.update(0.02); D.update(0.02);
  assert.equal(D.wave, 1); assert.equal(living().length, 4);
  clearCurrentWave(); D.update(30);
  assert.equal(D.state, 'travel'); assert.equal(D.nextWave, 2);
  assert.equal(living().length, 0); assert.equal(victories, 0);
});
test('restarting during travel starts the destination wave at its checkpoint', () => {
  D.requestRestart(); D.update(0.02);
  assert.equal(D.wave, 2); assert.equal(living().length, 4);
  assert(Math.hypot(g.player.pos.x, g.player.pos.z - 3) < 1e-6);
});
test('defeat restarts only the current room, revives the hero and replaces its enemies', () => {
  g.player.hp = 0; g.player.alive = false; D.onPlayerDeath(); D.update(4);
  assert.equal(g.state, 'defeat'); D.restartWave(); D.update(0.02);
  assert.equal(D.wave, 2); assert.equal(living().length, 4);
  assert(g.player.alive && g.player.hp === g.player.maxHp);
  assert(Math.hypot(g.player.pos.x, g.player.pos.z - 3) < 1e-6);
});
test('the altar alone grants no victory; the named boss must be killed', () => {
  clearCurrentWave(); g.player.place(17.6, 3, 0); D.update(10);
  assert.equal(D.state, 'travel'); assert.equal(victories, 0);
  g.player.place(8, 0, Math.PI / 2); D.update(0.02); D.update(0.02);
  assert.equal(D.wave, 3); assert.equal(living().length, 1);
  assert.equal(living()[0].nameOverride.name, '枯林守誓者');
  clearCurrentWave(); assert.equal(g.state, 'victory'); assert.equal(victories, 1);
  D.update(10); assert.equal(victories, 1);
});
test('URL wave jumps place the hero in the destination room', () => {
  D.begin(2); D.update(1.1); D.update(0.02);
  assert.equal(D.wave, 2); assert.equal(D.state, 'intro');
  assert(Math.hypot(g.player.pos.x, g.player.pos.z - 3) < 1e-6);
});
off(); g.dispose(); map.dispose();
console.log(`\n${passed} chapel material/encounter checks passed`);
