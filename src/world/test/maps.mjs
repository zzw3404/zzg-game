// Build the real maps without a GPU or textures, then check geometry and gameplay clearance together.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { boxCollider, colliderBounds, overlapsDisc, blocksBody, pushOutCollider, rayCollider } from '../collision.js';
import { createKit } from '../citadel-build.js';
import { Builder } from '../town-geo.js';
import { createCitadel } from '../citadel.js';
import { createHollow } from '../hollow.js';
import citadelLevel from '../../levels/citadel.js';
import { Game } from '../../game/game.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok   ${name}`); };
const clear = (cs, x, z, r = 0.4, y = 0) => !cs.some((c) => blocksBody(c, y) && overlapsDisc(c, x, z, r));
const app = () => ({ scene: new THREE.Scene(), world: { heightAt: () => 0, colliders: [], addBlocker() {} }, add() {} });
const textures = async () => null;

test('rotated boxes follow Builder yaw, without circular phantom corners', () => {
  const c = boxCollider(10, -5, 4, 0.2, Math.PI / 2, -1, 5);
  const b = colliderBounds(c, 0.4);
  assert(Math.abs(b.x0 - 9.4) < 1e-6 && Math.abs(b.z0 + 9.4) < 1e-6);
  assert(overlapsDisc(c, 10, -8.5, 0.4));
  assert(!overlapsDisc(c, 11, -5, 0.4));
  const p = { x: 10, y: 0, z: -5 };
  assert(pushOutCollider(p, 0.4, c));
  assert(clear([c], p.x, p.z));
});
test('exact-centre circular spawns are pushed out, and overhead arches leave actors free', () => {
  const p = { x: 0, y: 0, z: 0 }, c = { x: 0, z: 0, r: 1 };
  assert(pushOutCollider(p, 0.4, c) && Math.abs(p.x - 1.4) < 2e-6);
  assert(!pushOutCollider(p, 0.4, boxCollider(1.4, 0, 4, 1, 0, 6.6, 9.4)));
  assert(!pushOutCollider(p, 0.4, boxCollider(1.4, 0, 4, 1, 0, -1, 0.12)));
});
test('camera respects wall height, low props and overhead stone', () => {
  const p = { x: -3, y: 2, z: 0 }, q = { x: 3, y: 2, z: 0 };
  assert(rayCollider(p, q, boxCollider(0, 0, 0.4, 5, 0, -1, 10)) > 0);
  assert.equal(rayCollider(p, q, boxCollider(0, 0, 0.4, 5, 0, -1, 0.6)), null);
  assert.equal(rayCollider(p, q, boxCollider(0, 0, 0.4, 5, 0, 6, 10)), null);
  assert(rayCollider(p, { x: 3, y: 9, z: 0 }, boxCollider(0, 0, 1, 5, 0, 5, 10)) !== null);
});
test('real gameplay collision stops fast root motion at a thin fence and permits sliding', () => {
  const game = Object.create(Game.prototype);
  game.app = app(); game.heightAt = () => 0; game.arenaR = 300;
  game.app.world.colliders.push(boxCollider(0, 0, 0.08, 8, 0, -1, 1.25));
  const from = { x: -2, y: 0, z: 0 }, p = { x: 2, y: 0, z: 2 };
  game.collideStatic(p, 0.4, from);
  assert(p.x < -0.479 && Math.abs(p.z - 2) < 1e-6, `tunnel/slide ${JSON.stringify(p)}`);
  game.app.world.colliders = [boxCollider(10, 0, 0.08, 8, 0, -1, 1.25)];
  const q = { x: 2, y: 0, z: 2 }; game.collideStatic(q, 0.4, from);
  assert(Math.abs(q.x - 2) < 1e-6, 'same-length collider list replacement rebuilds the grid');
});

const townApp = app();
const town = await createCitadel(townApp, { citadel: citadelLevel.layout.citadel, loadPBR: textures });
test('all four town gate centres remain walkable through the wall', () => {
  for (const g of town.gates) for (let d = -4; d <= 4; d += 0.1) {
    assert(clear(town.colliders, g.x + Math.sin(g.yaw) * d, g.z + Math.cos(g.yaw) * d), `${g.side} gate d=${d}`);
  }
});
test('shop doors are open, and counters and side walls stop actors', () => {
  for (const s of town.shops) {
    for (let z = s.hd + 0.8; z > s.hd - 1.4; z -= 0.08) {
      assert(clear(town.colliders, s.cx + s.doorAt, s.cz + z), `${s.kind} doorway z=${z}`);
      assert(clear(town.colliders, s.cx + s.doorAt, s.cz + z, 0.4, 0.3), `${s.kind} doorway with 30 cm terrain rise`);
    }
    assert(!clear(town.colliders, s.cx, s.cz + s.hd - 2.5), `${s.kind} counter`);
    assert(!clear(town.colliders, s.cx + s.hw - 0.16, s.cz), `${s.kind} side wall`);
  }
});
test('camp entrance is a real gap; palisade ends have collision', () => {
  for (let x = 69; x <= 73; x += 0.1) assert(clear(town.colliders, x, 20), `camp entrance x=${x}`);
  assert(!clear(town.colliders, 71, 28));
  assert(!clear(town.colliders, 76, 6));
});
test('training props match translated AND rotated geometry, with no phantom at the origin', () => {
  const cs = [], K = Object.fromEntries(['s', 'w', 'p', 'r', 'm'].map((k) => [k, new Builder()]));
  const kit = createKit({ K, Y: (h) => h, rnd: () => 0.5, R: (a, b) => (a + b) / 2, pick: (a) => a[0], groundMin: () => 0,
    addB: (c) => cs.push(c), addC: (x, z, r, y0, y1) => cs.push({ x, z, r, y0, y1 }), reserve() {}, lightSrc: [] });
  const yaw = 0.73, cx = 140, cz = -90;
  kit.trainingYard(cx, cz, yaw);
  const world = (x, z) => [cx + x * Math.cos(yaw) + z * Math.sin(yaw), cz - x * Math.sin(yaw) + z * Math.cos(yaw)];
  assert(!clear(cs, ...world(-7.5, -3.8)), 'dummy');
  assert(!clear(cs, ...world(-8.2, 5.85)), 'trough');
  assert(!clear(cs, ...world(-10.5, 0)), 'side fence');
  assert(clear(cs, ...world(0, 0)), 'open yard centre');
  assert(clear(cs, 0, -7), 'no local-coordinate fence left at world origin');
});
test('town church west doorway and interior have clearance', () => {
  for (let x = -47; x <= -43.5; x += 0.1) assert(clear(town.colliders, x, -30), `church west x=${x}`);
  assert(clear(town.colliders, -33, -30));
});

const hollowApp = app();
const hollow = await createHollow(hollowApp, { loadPBR: textures });
hollow.root.updateMatrixWorld(true);
test('chapel south approach goes through both gates into the nave', () => {
  for (let z = 34; z >= 0; z -= 0.1) assert(clear(hollow.colliders, 0, z), `approach z=${z}`);
  for (let x = 0; x <= 15.3; x += 0.1) assert(clear(hollow.colliders, x, 0), `altar approach x=${x}`);
});
test('chapel outer walls, yard walls and altar are solid, arcade is walkable', () => {
  assert(!clear(hollow.colliders, 7.4, -9.75));
  assert(!clear(hollow.colliders, -27, 24));
  assert(!clear(hollow.colliders, 17.6, 0));
  assert(clear(hollow.colliders, 0, -5.25), 'under arcade');
  assert(!clear(hollow.colliders, 3.4, -5.25), 'column');
});
test('west portal has no stone across it; windows and arcade are actual mesh openings', () => {
  const stone = hollow.meshes.find((m) => m.name === 'hollow-stone');
  stone.material.side = THREE.DoubleSide;
  const hit = (p, d, far) => new THREE.Raycaster(new THREE.Vector3(...p), new THREE.Vector3(...d), 0, far).intersectObject(stone).length;
  assert.equal(hit([-15, 1.4, 0], [1, 0, 0], 4), 0, 'west portal');
  assert.equal(hit([-8.95, 3.5, -11], [0, 0, 1], 2.4), 0, 'north lancet hole');
  assert.equal(hit([0, 1.4, -6.5], [0, 0, 1], 3), 0, 'arcade below clerestory');
});
test('long fallen trees use their complete length instead of a centre circle', () => {
  const logs = hollow.colliders.filter((c) => c.shape === 'box' && c.hx >= 2 && Math.abs(c.hz - 0.42) < 1e-6);
  assert(logs.length > 10);
  for (const c of logs) {
    const x = c.x + (c.hx - 0.1) * Math.cos(c.yaw), z = c.z - (c.hx - 0.1) * Math.sin(c.yaw);
    assert(overlapsDisc(c, x, z, 0.4));
  }
});
test('generated collider sizes and heights are valid', () => {
  for (const c of [...town.colliders, ...hollow.colliders]) {
    assert(Number.isFinite(c.x) && Number.isFinite(c.z) && c.y1 > c.y0);
    if (c.shape === 'box') assert(c.hx > 0 && c.hz > 0 && Number.isFinite(c.yaw));
    else assert(c.r > 0);
  }
});
town.dispose(); hollow.dispose();
console.log(`\n${passed} map/collision checks passed`);
