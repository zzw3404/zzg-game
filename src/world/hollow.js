// 枯林圣堂 · the place itself (the instance behind the south gate). Owner: world (W).
//
//   const hollow = await createHollow(app, { loadPBR })   → { root, colliders, spawn, altar, gate, stats }
//
// Two rules this file lives by, both learned the hard way:
//   1. NOTHING is placed on a flat plane. The ground under every wall, grave, bone, column and tree is sampled with
//      app.world.heightAt(x, z) at that very spot, and every box starts ~1.2 m BELOW its own ground, so terrain
//      undulation can never leave a model hovering or a wall hanging over a dip.
//   2. It has to read as a church from the gate: a long nave with an arcade of round arches between two aisles, a
//      tall west front with a recessed portal, a rose window (R 2.6) and a cross on the gable, a square tower with
//      a broken spire off the north-west corner, a lower ROOFED chancel and a five-sided apse at the east end,
//      A-frame trusses still standing over the roofless nave, flagstones underfoot, graves and bones everywhere.
//
// Geometry is merged per material with the town's Builder (world/town-geo.js) and the town's materials
// (world/citadel-mat.js): stone, dead wood (timber), roof (the chancel's slates and the apse cone) and misc
// (bones in the bone-white part, iron, cloth, dark recesses, the altar fire).
import * as THREE from 'three';
import { Builder } from './town-geo.js';
import { createCitadelMaterials } from './citadel-mat.js';
import { createHollowStoneMaterial } from './hollow-mat.js';
import { hollowCombatClearance } from '../levels/hollow.js';
import { bakeTownLight } from './town-mat.js';
import { boxCollider, boxFromBuilder } from './collision.js';

export async function createHollow(app, { loadPBR } = {}) {
  const t0 = performance.now();
  const gy = (x, z) => app.world.heightAt(x, z);            // the ground, wherever we are

  // the materials share the town's baked light field: bake it before they are built, or the light term blows out
  const lightSrc = [
    { x: 17.6, z: 0, h: 1.6, i: 5.4 },                      // the altar fire (the chancel, east end)
    { x: -8, z: 0, h: 1.3, i: 1.4 }, { x: 4, z: 0, h: 1.3, i: 1.4 },   // candles left standing in the nave
  ];
  bakeTownLight(lightSrc, { x0: -34, z0: -30, w: 70, d: 64 }, 0.4);
  const mats = await createCitadelMaterials(loadPBR, { stoneFactory: createHollowStoneMaterial });
  const root = new THREE.Group();
  root.name = 'hollow';
  app.scene.add(root);

  const colliders = [];
  const addC = (x, z, r, h = r * 1.6) => { const c = { x, z, r, y0: gy(x, z) - 1.3, y1: gy(x, z) + h }; colliders.push(c); app.world.addBlocker?.(c); };
  const addB = (c) => { colliders.push(c); app.world.addBlocker?.(c); };
  const solidBox = (b, ...a) => { b.box(...a); addB(boxFromBuilder(b, ...a)); };
  const fallenBox = (b, x, z, hx, hy, hz, angle, seed) => {
    const g = gy(x, z), co = Math.cos(angle), sn = Math.sin(angle);
    b.part(b.p, seed).obox([x, g + hy * 0.7, z], [co, 0, sn], [0, 1, 0], [-sn, 0, co], hx, hy, hz);
    addB(boxCollider(x, z, hx, hz, -angle, g - hy * 0.3, g + hy * 1.7));
  };
  const rand = (() => { let s = 0x9e3779b9; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const rnd = (a = 1, b = 0) => b + rand() * (a - b);

  const builders = { s: new Builder(), w: new Builder(), r: new Builder(), m: new Builder() };
  const bs = builders.s, bw = builders.w, br = builders.r, bm = builders.m;

  // ------------------------------------------------------------------------------------ wall kit (grounded)
  /**
   * A ruined wall along `axis` ('x' or 'z') at coordinate `c`, from a0 to a1, `t` thick. Every slice samples the
   * ground at its own mid-point and runs from `ground - 1.3` up to its own crest, so the base is always buried.
   * `open` ([{ a0, a1, y0, y1 }]) are the window and door holes: they stay empty whatever the crest does.
   * `minH` forces a floor on the height (a wall that is still standing keeps its height along its whole length).
   */
  function ruinWall(b, { axis = 'x', a0, a1, c, t = 0.9, hTop = 9.4, hLow = 0.7, minH = 0, yBase = 0, open = [], part = 0, seed = 0, slice = 1.5, sink = 1.3 }) {
    const n = Math.max(1, Math.round((a1 - a0) / slice));
    b.part(part, seed);
    let h = hTop;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + ((a1 - a0) * i) / n, s1 = a0 + ((a1 - a0) * (i + 1)) / n, mid = (s0 + s1) / 2;
      h = Math.max(minH, Math.min(hTop, h + (rand() - 0.44) * 2.4));
      const crest = rand() < 0.12 ? Math.max(minH, hLow + rand() * 0.7) : h;
      const g = axis === 'x' ? gy(mid, c) : gy(c, mid);
      // Split at opening edges in BOTH dimensions: partial slices must keep their solid jambs.
      const holes = open.filter((q) => q.a1 > s0 && q.a0 < s1);
      const cuts = [...new Set([s0, s1, ...holes.flatMap((o) => [Math.max(s0, o.a0), Math.min(s1, o.a1)])])].sort((a, b) => a - b);
      const j = 0.05 * (rand() - 0.5);
      for (let k = 0; k < cuts.length - 1; k++) {
        const u0 = cuts[k], u1 = cuts[k + 1], um = (u0 + u1) / 2, spans = [];
        let cur = yBase;
        for (const o of holes.filter((o) => o.a0 < um && o.a1 > um).sort((a, b) => a.y0 - b.y0)) {
          if (o.y0 > cur) spans.push([cur, Math.min(o.y0, crest)]);
          cur = Math.max(cur, o.y1);
        }
        if (crest > cur) spans.push([cur, crest]);
        for (const [y0, y1] of spans) {
          if (y1 - y0 < 0.02 || u1 - u0 < 0.02) continue;
          const bottom = y0 === 0 ? g - sink : g + y0;
          if (axis === 'x') solidBox(b, u0, bottom, c - t / 2 + j, u1, g + y1, c + t / 2 + j);
          else solidBox(b, c - t / 2 + j, bottom, u0, c + t / 2 + j, g + y1, u1);
        }
      }
    }
  }

  /**
   * A pointed (lancet) window: jambs, a sill and a two-centre arch head, built proud of the wall face. Returns the
   * opening it wants cut out of the wall (`{ a0, a1, y0, y1 }` in the wall's own run coordinates).
   */
  function lancet(b, { axis = 'z', a, c, w, h, sill, t = 0.9, part = 0, seed = 0, mullion = true }) {
    const g = axis === 'z' ? gy(c, a) : gy(a, c);
    const r = w / 2, spring = Math.max(0.6, h - r * 1.35);
    b.part(part, seed);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const t0 = (Math.PI / 2) * (k / 5), t1 = (Math.PI / 2) * ((k + 1) / 5), tm = (t0 + t1) / 2;
        const rr = r + 0.34, ca = Math.cos(tm) * rr;
        const cy = sill + spring + Math.sin(tm) * r * 1.35;
        const sn = Math.sin(tm), co = Math.cos(tm);
        if (axis === 'z') b.obox([c, g + cy, a + s * ca], [0, sn, s * co], [0, s * co, -sn], [-1, 0, 0], 0.2, 0.34, t / 2);
        else b.obox([a + s * ca, g + cy, c], [s * co, sn, 0], [-sn, s * co, 0], [0, 0, 1], 0.2, 0.34, t / 2);
      }
      if (axis === 'z') b.box(c - t / 2 - 0.16, g + sill - 0.35, a + s * (w / 2 - 0.16), c + t / 2 + 0.16, g + sill + spring, a + s * (w / 2 + 0.16));
      else b.box(a + s * (w / 2 - 0.16), g + sill - 0.35, c - t / 2 - 0.16, a + s * (w / 2 + 0.16), g + sill + spring, c + t / 2 + 0.16);
    }
    if (axis === 'z') b.box(c - t / 2 - 0.22, g + sill - 0.4, a - w / 2 - 0.26, c + t / 2 + 0.22, g + sill, a + w / 2 + 0.26);
    else b.box(a - w / 2 - 0.26, g + sill - 0.4, c - t / 2 - 0.22, a + w / 2 + 0.26, g + sill, c + t / 2 + 0.22);
    if (mullion) {
      if (axis === 'z') b.box(c - t / 2 - 0.1, g + sill, a - 0.09, c + t / 2 + 0.1, g + sill + spring, a + 0.09);
      else b.box(a - 0.09, g + sill, c - t / 2 - 0.1, a + 0.09, g + sill + spring, c + t / 2 + 0.1);
    }
    return { a0: a - w / 2 - 0.1, a1: a + w / 2 + 0.1, y0: sill, y1: sill + spring + r * 1.35 };
  }

  /** A round-headed arch standing in a constant-z plane (the arcade between the columns). */
  function archZ(b, { x, z, y, r, t = 0.85, part = 0, seed = 0, seg = 7, high = 1.1, axis = 'x' }) {
    const g = gy(x, z);
    b.part(part, seed);
    for (let k = 0; k < seg; k++) {
      const a0 = Math.PI * (k / seg), a1 = Math.PI * ((k + 1) / seg), am = (a0 + a1) / 2;
      const ca = Math.cos(am), sa = Math.sin(am);
      b.obox([x + (axis === 'x' ? ca * r : 0), g + y + sa * r * high, z + (axis === 'z' ? ca * r : 0)],
        axis === 'x' ? [ca, sa * high, 0] : [0, sa * high, ca], axis === 'x' ? [-sa * high, ca, 0] : [0, ca, -sa * high], axis === 'x' ? [0, 0, 1] : [-1, 0, 0],
        0.34, r * (a1 - a0) * 0.62, t / 2);
    }
  }

  /** A column from its own ground up; `breakY` snaps it and lays the upper length beside it. */
  function column(b, x, z, { r = 0.72, top = 7.0, breakY = 0, seed = 0, sink = 1.0 }) {
    const g = gy(x, z), h = breakY || top;
    b.part(0, seed);
    b.box(x - r - 0.28, g - sink, z - r - 0.28, x + r + 0.28, g + 0.5, z + r + 0.28);
    b.cyl(x, g + 0.5, z, r * 1.14, r, 0.42, 10, false);
    b.cyl(x, g + 0.92, z, r, r * 0.93, Math.max(0.2, h - 0.42 - 0.92), 10, true);
    if (breakY) {
      for (let k = 0; k < 3; k++) b.box(x + rnd(-0.7, -1.1), g + h - 0.42, z + rnd(-0.5, 0.5), x + rnd(0.3, 1.0), g + h + rnd(0.15, 0.95), z + rnd(-0.3, 0.7));
      const fx = x + rnd(-1.4, 1.4), fz = z + rnd(-3.2, -1.8), yaw = rnd(6.2);
      fallenBox(b, fx, fz, (top - breakY) / 2, 0.74, 0.74, yaw, seed);
    } else {
      b.cyl(x, g + h - 0.42, z, r * 1.18, r * 1.02, 0.4, 10, true);
      b.box(x - r - 0.24, g + h, z - r - 0.24, x + r + 0.24, g + h + 0.3, z + r + 0.24);
    }
    addB(boxCollider(x, z, r + 0.28, r + 0.28, 0, g - sink, g + 0.5));
    addC(x, z, r * 1.18, h + 0.3);
  }

  /** A buttress on the outer face of an aisle wall. */
  function buttress(b, x, z, { w = 0.85, d = 1.2, h = 5.4, seed = 0 }) {
    const g = gy(x, z);
    b.part(0, seed);
    solidBox(b, x - w / 2, g - 1.3, z - w / 2, x + w / 2, g + h * 0.6, z + w / 2);
    solidBox(b, x - w / 2, g + h * 0.6, z - d / 2, x + w / 2, g + h, z + d / 2);
  }

  /** Rubble: broken blocks, tumbled every which way, buried to a third. */
  function rubble(b, cx, cz, spread, n, { big = 0.6, seed = 0 } = {}) {
    b.part(0, seed);
    for (let k = 0; k < n; k++) {
      const x = cx + rnd(-spread, spread), z = cz + rnd(-spread, spread);
      const hx = rnd(big * 0.35, big * 1.2), hy = rnd(0.16, big * 0.7), hz = rnd(big * 0.3, big * 0.9);
      if (hollowCombatClearance(x, z, Math.hypot(hx, hz))) continue;
      const yaw = rnd(6.3), tip = rnd(-0.45, 0.45);
      const ex = [Math.cos(yaw) * Math.cos(tip), Math.sin(tip), Math.sin(yaw) * Math.cos(tip)];
      const ey = [-Math.cos(yaw) * Math.sin(tip), Math.cos(tip), -Math.sin(yaw) * Math.sin(tip)];
      b.obox([x, gy(x, z) + hy * 0.5, z], ex, ey, [-Math.sin(yaw), 0, Math.cos(yaw)], hx, hy, hz);
    }
  }

  // ------------------------------------------------------------------------------------ the church
  // Plan: nave x ∈ [-13, 13] between two arcades, aisles out to z = ±9.75, west front with the portal and the rose
  // window, tower + broken spire off the north-west corner, chancel x ∈ [13, 20.5] (roofed), five-sided apse.
  const NAVE = { x0: -13, x1: 13, hz: 5.25, hAisle: 9.75, h: 9.4, hAisleWall: 6.0 };
  const CH = { x1: 20.5, hz: 4.3, h: 7.0 };
  const SPIRE = { h: 9.4 };

  // aisle outer walls, three tall lancets a side, buttresses between them
  for (const s of [1, -1]) {
    const open = [];
    for (const wx of (s > 0 ? [-8.6, -4.2, 6.2] : [-8.6, -2.2, 4.2])) open.push(lancet(bs, { axis: 'x', a: wx, c: s * NAVE.hAisle, w: 1.7, h: 5.3, sill: 1.5, seed: 100 + Math.round(wx) }));
    if (s > 0) open.push({ a0: -1.6, a1: 1.6, y0: 0, y1: 4.9 });
    ruinWall(bs, { axis: 'x', a0: NAVE.x0 - 0.6, a1: NAVE.x1 + 0.6, c: s * NAVE.hAisle, t: 0.95,
      hTop: NAVE.hAisleWall, hLow: 0.8, minH: 1.5, open, seed: 110 + s });
    for (const bx of (s > 0 ? [-11.4, -5.4, 3.0, 8.4, 12.4] : [-11.4, -5.4, 1.0, 7.4, 12.4])) buttress(bs, bx, s * (NAVE.hAisle + 0.55), { seed: 120 + s * 3 + Math.round(bx) });
    if (s > 0) archZ(bs, { x: 0, z: NAVE.hAisle, y: 3.2, r: 1.6, high: 1.1, seed: 130 });
  }
  // the arcade: four columns a side, round arches between them
  for (const s of [1, -1]) {
    const xs = [-9.8, -3.4, 3.4, 9.8];
    xs.forEach((x, i) => column(bs, x, s * NAVE.hz, { r: 0.72, top: 7.0, breakY: (s < 0 && i === 1) ? 4.4 : 0, seed: 200 + s * 7 + i }));
    for (let i = 0; i < xs.length - 1; i++) {
      archZ(bs, { x: (xs[i] + xs[i + 1]) / 2, z: s * NAVE.hz, y: 6.1, r: (xs[i + 1] - xs[i] - 1.44) / 2, seed: 220 + i });
    }
  }
  // clerestory over the arcade: mostly gone, two lengths still up with their windows
  for (const s of [1, -1]) {
    ruinWall(bs, { axis: 'x', a0: NAVE.x0, a1: NAVE.x1, c: s * NAVE.hz, t: 0.7, hTop: NAVE.h, hLow: 7.7, minH: 6.6, yBase: 6.6, seed: 240 + s,
      open: [{ a0: -5.6, a1: -3.0, y0: 7.4, y1: 9.0 }, { a0: 2.4, a1: 5.0, y0: 7.4, y1: 9.0 }] });
  }
  // the west front: portal, rose window, gable, cross
  {
    const wx = NAVE.x0, hz = NAVE.hAisle;
    ruinWall(bs, { axis: 'z', a0: -hz, a1: hz, c: wx, t: 1.15, hTop: 10.0, hLow: 8.4, minH: 8.4, seed: 300,
      open: [{ a0: -1.9, a1: 1.9, y0: 0, y1: 5.4 }, { a0: -2.7, a1: 2.7, y0: 5.7, y1: 9.3 }] });
    const g0 = gy(wx, 0);
    bs.part(0, 301);
    for (let k = 0; k < 5; k++) {
      const lon = hz * (1 - k / 5) * 0.95;
      if (lon < 0.3) break;
      bs.box(wx - 0.6, g0 + 10.0 + k * 0.9 - 0.3, -lon, wx + 0.6, g0 + 10.0 + (k + 1) * 0.9, lon);
    }
    const cy0 = g0 + 10.0 + 5 * 0.9;
    bs.box(wx - 0.2, cy0, -0.2, wx + 0.2, cy0 + 1.7, 0.2);
    bs.box(wx - 0.2, cy0 + 1.05, -0.8, wx + 0.2, cy0 + 1.28, 0.8);
    // the portal: two recessed arches and their jambs
    for (const [r, t2, seed] of [[1.9, 1.3, 310], [2.55, 1.6, 311]]) {
      bs.part(0, seed);
      for (let k = 0; k < 8; k++) {
        const a0 = Math.PI * (k / 8), a1 = Math.PI * ((k + 1) / 8), am = (a0 + a1) / 2;
        bs.obox([wx, g0 + 3.6 + Math.sin(am) * r * 1.28, Math.cos(am) * (r + 0.4)],
          [0, Math.sin(am) * 1.28, Math.cos(am)], [1, 0, 0], [0, Math.cos(am), -Math.sin(am) * 1.28],
          t2 / 2, 0.34, r * (a1 - a0) * 0.62);
      }
      for (const s of [-1, 1]) bs.box(wx - t2 / 2, g0 - 1.2, s * (r + 0.4) - 0.32, wx + t2 / 2, g0 + 3.6, s * (r + 0.4) + 0.32);
      bs.box(wx - t2 / 2 - 0.1, g0 - 1.2, -r - 0.75, wx + t2 / 2 + 0.1, g0 + 0.22, r + 0.75);
    }
    // the rose window: an outer ring of 20, twelve spokes, a hub
    const cy = g0 + 7.5, R = 2.6;
    bs.part(0, 320);
    for (let k = 0; k < 20; k++) {
      const a = (Math.PI * 2 * k) / 20;
      bs.obox([wx, cy + Math.sin(a) * R, Math.cos(a) * R], [0, Math.sin(a), Math.cos(a)], [0, Math.cos(a), -Math.sin(a)], [1, 0, 0], 0.4, 0.3, 0.58);
    }
    for (let k = 0; k < 12; k++) {
      const a = (Math.PI * 2 * k) / 12;
      bs.obox([wx, cy + Math.sin(a) * R * 0.6, Math.cos(a) * R * 0.6], [0, Math.sin(a), Math.cos(a)], [0, Math.cos(a), -Math.sin(a)], [1, 0, 0], R * 0.58, 0.11, 0.34);
    }
    bs.obox([wx, cy, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.58, 0.28, 0.28);
  }
  // the tower (north-west) with its broken spire
  {
    const { x: tx, z: tz, hx, hz, h } = { x: -15.6, z: -6.4, hx: 2.9, hz: 2.9, h: 15.4 };
    const belfry = (a0, a1) => [{ a0, a1, y0: 11.4, y1: 14.5 }];
    ruinWall(bs, { axis: 'x', a0: tx - hx, a1: tx + hx, c: tz + hz, t: 1.15, hTop: h, hLow: 12.4, minH: 12.4, seed: 400, open: belfry(tx - 1.0, tx + 1.0) });
    ruinWall(bs, { axis: 'x', a0: tx - hx, a1: tx + hx, c: tz - hz, t: 1.15, hTop: h, hLow: 12.4, minH: 12.4, seed: 401, open: belfry(tx - 1.0, tx + 1.0) });
    ruinWall(bs, { axis: 'z', a0: tz - hz, a1: tz + hz, c: tx - hx, t: 1.15, hTop: h, hLow: 12.4, minH: 12.4, seed: 402, open: [{ a0: tz - 1.0, a1: tz + 1.0, y0: 11.4, y1: 14.5 }] });
    ruinWall(bs, { axis: 'z', a0: tz - hz, a1: tz + hz, c: tx + hx, t: 1.15, hTop: h, hLow: 12.4, minH: 12.4, seed: 403,
      open: [{ a0: tz - 1.0, a1: tz + 1.0, y0: 11.4, y1: 14.5 }, { a0: tz - 1.1, a1: tz + 1.1, y0: 0, y1: 3.2 }] });
    const g = gy(tx, tz);
    bs.part(0, 404).box(tx - hx - 0.45, g - 1.6, tz - hz - 0.45, tx + hx + 0.45, g + 0.08, tz + hz + 0.45);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      bs.part(0, 405).box(tx + dx * hx - 0.5, g - 1.3, tz + dz * hz - 0.5, tx + dx * hx + 0.5, g + 10.2, tz + dz * hz + 0.5);
    }
    // the spire: eight courses of an octagon, sheared off above two thirds, stones lying around the base
    const sy = g + h - 0.2, top = SPIRE.h;
    bs.part(0, 410);
    for (let k = 0; k < 8; k++) {
      const y0 = (k / 11) * top, y1 = ((k + 1) / 11) * top;
      const r0 = hx * 1.2 * (1 - y0 / (top * 1.05)), r1 = hx * 1.2 * (1 - y1 / (top * 1.05));
      const rr = (r0 + r1) / 2;
      for (let i = 0; i < 8; i++) {
        const a0 = (Math.PI * 2 * i) / 8, a1 = (Math.PI * 2 * (i + 1)) / 8, am = (a0 + a1) / 2;
        bs.obox([tx + Math.cos(am) * rr, sy + (y0 + y1) / 2, tz + Math.sin(am) * rr],
          [Math.cos(am), (r0 - r1) / Math.max(0.001, top / 11), Math.sin(am)], [-Math.sin(am), 0, Math.cos(am)], [0, 1, 0],
          0.2, (top / 11) * 1.08, rr * Math.sin((a1 - a0) / 2) * 1.08);
      }
    }
    for (let k = 0; k < 6; k++) {
      const fx = tx + rnd(5, -5), fz = tz + rnd(7, 1.5), fg = gy(fx, fz);
      bs.part(0, 420 + k).box(fx - 0.42, fg - 0.3, fz - 0.42, fx + 0.42, fg + rnd(0.6, 0.25), fz + 0.42);
    }
  }
  // chancel: lower, and ROOFED — the one intact roof tells the eye this was a church
  {
    const { x1, hz, h } = CH;
    ruinWall(bs, { axis: 'z', a0: -hz, a1: hz, c: NAVE.x1, t: 1.0, hTop: h, hLow: 6.3, minH: 6.3, seed: 500, open: [{ a0: -2.2, a1: 2.2, y0: 0, y1: 5.7 }] });
    archZ(bs, { x: NAVE.x1, z: 0, y: 3.8, r: 2.2, t: 1.0, seed: 501, seg: 8, high: 1.2, axis: 'z' });
    for (const s of [1, -1]) {
      const open = [lancet(bs, { axis: 'x', a: 17, c: s * hz, w: 1.5, h: 3.6, sill: 1.6, t: 1.0, seed: 510 + s })];
      ruinWall(bs, { axis: 'x', a0: NAVE.x1, a1: x1, c: s * hz, t: 1.0, hTop: h, hLow: 6.1, minH: 6.1, open, seed: 520 + s });
      // Close the aisle ends beside the narrower chancel instead of leaving unmodelled gaps.
      ruinWall(bs, { axis: 'z', a0: s > 0 ? hz : -NAVE.hAisle, a1: s > 0 ? NAVE.hAisle : -hz, c: NAVE.x1, t: 0.95, hTop: NAVE.hAisleWall, minH: 1.5, seed: 525 + s });
    }
    ruinWall(bs, { axis: 'z', a0: -hz, a1: hz, c: x1, t: 1.0, hTop: h + 1.4, hLow: 6.5, minH: 6.5, seed: 530, open: [{ a0: -1.6, a1: 1.6, y0: 0, y1: 4.8 }] });
    for (const s of [1, -1]) {
      const eave = [0, h, s * (hz + 0.4)], ridge = [0, h + 2.6, 0];
      const dl = [ridge[1] - eave[1], ridge[2] - eave[2]], L = Math.hypot(dl[0], dl[1]) || 1;
      const ex = [0, dl[0] / L, dl[1] / L];
      br.part(0, 540);
      br.obox([(NAVE.x1 + x1) / 2, gy(17, 0) + (eave[1] + ridge[1]) / 2, (eave[2] + ridge[2]) / 2], ex, [1, 0, 0], [0, -ex[2], ex[1]], L / 2, (x1 - NAVE.x1) / 2 + 0.45, 0.13);
    }
    const g2 = gy(x1, 0);
    bs.part(0, 541);
    for (let k = 0; k < 4; k++) {
      const lon = CH.hz * (1 - k / 4) * 0.95;
      if (lon < 0.3) break;
      bs.box(x1 - 0.5, g2 + CH.h + 1.4 + k * 0.66 - 0.3, -lon, x1 + 0.5, g2 + CH.h + 1.4 + (k + 1) * 0.66, lon);
    }
  }
  // the apse beyond the chancel: five sides, tall windows, a half-cone roof
  {
    const outline = [[CH.x1, -CH.hz], [23.6, -3.5], [25.4, -1.8], [25.4, 1.8], [23.6, 3.5], [CH.x1, CH.hz]];
    const h = 6.4, ridge = [22.9, gy(22.9, 0) + h + 2.3, 0];
    for (let k = 0; k < outline.length - 1; k++) {
      const [x0, z0] = outline[k], [x1, z1] = outline[k + 1], x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      const hw = Math.hypot(x1 - x0, z1 - z0) / 2, g = gy(x, z), yaw = -Math.atan2(z1 - z0, x1 - x0);
      bs.frame(x, 0, z, yaw).part(0, 600 + k);
      solidBox(bs, -hw, g - 1.3, -0.48, hw, g + 1.4, 0.48);
      for (const s of [-1, 1]) solidBox(bs, s < 0 ? -hw : 0.6, g + 1.4, -0.48, s < 0 ? -0.6 : hw, g + h, 0.48);
      solidBox(bs, -0.6, g + 4.4, -0.48, 0.6, g + h, 0.48);
      bs.frame(0, 0, 0, 0);
      const A = [x0, gy(x0, z0) + h, z0], B = [x1, gy(x1, z1) + h, z1];
      br.part(0, 610 + k).triangle(A, ridge, B);
      br.triangle([A[0], A[1] - 0.15, A[2]], [B[0], B[1] - 0.15, B[2]], [ridge[0], ridge[1] - 0.15, ridge[2]]);
    }
  }
  // the altar, its candles, a fallen statue
  {
    const ax = 17.6, g = gy(ax, 0);
    bs.part(0, 700);
    solidBox(bs, ax - 1.5, g - 0.5, -0.95, ax + 1.5, g + 1.15, 0.95);
    solidBox(bs, ax - 1.72, g + 1.15, -1.15, ax + 1.72, g + 1.34, 1.15);
    bs.box(ax + 0.35, g + 1.34, -1.15, ax + 1.72, g + 1.52, -0.15);
    bm.part(1, 701).box(ax - 1.55, g + 0.9, -1.0, ax + 1.55, g + 1.17, 1.0);
    bm.part(8, 702).obox([ax - 2.8, g + 0.34, 1.95], [0.94, 0, 0.34], [0, 1, 0], [-0.34, 0, 0.94], 0.4, 0.3, 1.0);
    bm.part(10, 703).cyl(ax - 0.9, g + 1.34, -0.5, 0.07, 0.06, 0.42, 6, true);
    bm.part(10, 703).cyl(ax - 0.9, g + 1.76, -0.5, 0.05, 0.04, 0.16, 6, true);
    bm.part(10, 704).cyl(ax + 0.9, g + 1.34, 0.5, 0.06, 0.05, 0.3, 6, true);
    bm.part(10, 704).cyl(ax + 0.9, g + 1.64, 0.5, 0.045, 0.035, 0.12, 6, true);
  }
  // A-frame trusses still standing over the roofless nave (one has come down sideways)
  for (const [tx, lean] of [[-8.2, 0], [-3.0, 0], [2.2, 0.1], [7.4, -0.2]]) {
    const g = gy(tx, 0), y = g + NAVE.h - 0.6;
    bw.part(1, 800 + Math.round(tx));
    for (const s of [1, -1]) {
      bw.beam([tx, y, s * NAVE.hz], [tx + lean * 6, y + 5.4, 0], 0.26, 0.3, [1, 0, 0]);
    }
    bw.beam([tx, y + 3.4, -3.4], [tx, y + 3.4, 3.4], 0.22, 0.26, [0, 0, 1]);
    bw.beam([tx, y - 0.2, 0], [tx, y + 5.2, 0], 0.22, 0.22, [1, 0, 0]);
  }
  // roof timbers on the nave floor
  for (let k = 0; k < 7; k++) {
    const x = rnd(12, -12), z = rnd(9, -9), yaw = rnd(6.3), g = gy(x, z);
    if (hollowCombatClearance(x, z, 4.3)) continue;
    bw.part(1, 830 + k).obox([x, g + 0.24, z], [Math.cos(yaw), 0, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], rnd(4.2, 2.4), 0.24, 0.3);
  }
  // flagstones through the whole church, each on its own ground
  {
    bs.part(1, 900);
    for (let x = -13.4; x <= 24.4; x += 1.3) {
      for (let z = -9.6; z <= 9.6; z += 1.1) {
        if (x > 13.2 && Math.abs(z) > 4.7) continue;
        if (Math.abs(z) > 9.4 && x < 13.2) continue;
        if (x > 21.5 && Math.hypot((x - 23.5) * 2, z) > 8) continue;
        const g = gy(x, z), w = 0.6 + rnd(0.05), d = 0.49 + rnd(0.05);
        bs.box(x - w, g - 0.35, z - d, x + w, g + 0.07 + rnd(0.025), z + d);
      }
    }
  }
  rubble(bs, 0, 0, 10, 64, { big: 0.75, seed: 940 });
  rubble(bs, -14, 2, 5, 24, { big: 0.9, seed: 941 });
  rubble(bs, 16, -6, 5, 22, { big: 0.8, seed: 942 });

  // ------------------------------------------------------------------------------------ churchyard
  const YARD = { hx: 30, hz: 24 };
  ruinWall(bs, { axis: 'x', a0: -YARD.hx, a1: YARD.hx, c: -YARD.hz, t: 0.75, hTop: 1.8, hLow: 0.35, seed: 1000 });
  ruinWall(bs, { axis: 'x', a0: -YARD.hx, a1: -3.2, c: YARD.hz, t: 0.75, hTop: 1.7, hLow: 0.3, seed: 1001 });
  ruinWall(bs, { axis: 'x', a0: 3.2, a1: YARD.hx, c: YARD.hz, t: 0.75, hTop: 1.7, hLow: 0.3, seed: 1002 });
  ruinWall(bs, { axis: 'z', a0: -YARD.hz, a1: YARD.hz, c: -YARD.hx, t: 0.75, hTop: 1.9, hLow: 0.4, seed: 1003 });
  ruinWall(bs, { axis: 'z', a0: -YARD.hz, a1: YARD.hz, c: YARD.hx, t: 0.75, hTop: 1.9, hLow: 0.4, seed: 1004 });

  // the lychgate: two oak posts, a sagging lintel, a scrap of roof
  {
    const gz = YARD.hz, pw = 2.6, g = gy(0, gz);
    bw.part(1, 1100);
    for (const s of [-1, 1]) {
      bw.box(s * pw - 0.3, g - 1.3, gz - 0.3, s * pw + 0.3, g + 3.6, gz + 0.3);
      bs.part(0, 1101).box(s * pw - 0.55, g - 1.3, gz - 0.55, s * pw + 0.55, g + 0.5, gz + 0.55);
      bw.part(1, 1102).box(s * pw - 0.24, g + 3.6, gz - 0.24, s * pw + 0.24, g + 3.84, gz + 0.24);
      addB(boxCollider(s * pw, gz, 0.55, 0.55, 0, g - 1.3, g + 0.5));
      addB(boxCollider(s * pw, gz, 0.3, 0.3, 0, g + 0.5, g + 3.84));
    }
    bw.part(1, 1103).box(-pw - 0.45, g + 3.84, gz - 0.32, pw + 0.45, g + 4.22, gz + 0.32);
    br.part(0, 1104);
    for (const s of [-1, 1]) {
      const eave = [0, 4.32, gz + s * 1.05], ridge = [0, 5.05, gz];
      const dl = [ridge[1] - eave[1], ridge[2] - eave[2]], L = Math.hypot(dl[0], dl[1]) || 1;
      const ex = [0, dl[0] / L, dl[1] / L];
      br.obox([0, g + (eave[1] + ridge[1]) / 2, (eave[2] + ridge[2]) / 2], ex, [1, 0, 0], [0, -ex[2], ex[1]], L / 2, pw + 0.95, 0.09);
    }
  }

  // graves: rows all round the church, four kinds, crooked, every one on its own ground
  const graves = [];
  function headstone(x, z, kind, seed) {
    const g = gy(x, z), yaw = rnd(0.6, -0.6) + (rand() < 0.5 ? Math.PI : 0);
    bs.part(0, seed);
    if (kind === 0) {
      bs.obox([x, g + 0.6, z], [Math.cos(yaw), -0.24, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], 0.44, 0.68, 0.09);
      bs.box(x - 0.54, g - 0.6, z - 0.54, x + 0.54, g + 0.16, z + 0.54);
    } else if (kind === 1) {
      bs.box(x - 0.11, g - 0.5, z - 0.11, x + 0.11, g + 1.35, z + 0.11);
      bs.box(x - 0.46, g + 0.9, z - 0.11, x + 0.46, g + 1.08, z + 0.11);
      bs.box(x - 0.4, g - 0.5, z - 0.4, x + 0.4, g + 0.12, z + 0.4);
    } else if (kind === 2) {
      bs.box(x - 0.98, g - 0.5, z - 0.44, x + 0.98, g + 0.62, z + 0.44);
      bs.box(x - 1.1, g + 0.62, z - 0.56, x + 1.1, g + 0.78, z + 0.56);
    } else {
      bs.obox([x, g + 0.1, z], [Math.cos(yaw), 0, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], 0.92, 0.12, 0.42);
    }
    if (kind === 0) addB(boxCollider(x, z, 0.54, 0.54, 0, g - 0.6, g + 1.28));
    if (kind === 1) addB(boxCollider(x, z, 0.46, 0.11, 0, g - 0.5, g + 1.35));
    if (kind === 2) addB(boxCollider(x, z, 1.1, 0.56, 0, g - 0.5, g + 0.78));
    graves.push({ x, z });
  }
  function openGrave(x, z, seed) {
    const g = gy(x, z), yaw = rnd(0.3, -0.3), c2 = Math.cos(yaw), s2 = Math.sin(yaw);
    bs.part(0, seed);
    const put = (dx, dz, w, d) => {
      const wx = x + dx * c2 + dz * s2, wz = z - dx * s2 + dz * c2;
      bs.obox([wx, g + 0.2, wz], [c2, 0, -s2], [0, 1, 0], [s2, 0, c2], w, 0.3, d);
      addB(boxCollider(wx, wz, w, d, yaw, g - 0.1, g + 0.5));
    };
    put(0, -1.06, 1.35, 0.2); put(0, 1.06, 1.35, 0.2);
    put(-1.22, 0, 0.18, 0.92); put(1.22, 0, 0.18, 0.92);
    bm.part(4, seed + 1).box(x - 0.98, g + 0.02, z - 0.84, x + 0.98, g + 0.04, z + 0.84);
    bw.part(1, seed + 2).box(x - 0.9, g + 0.05, z - 0.78, x + 0.9, g + 0.12, z + 0.78);
    solidBox(bs.part(0, seed + 3), x + 1.55, g - 0.4, z - 0.85, x + 2.95, g + 0.5, z + 0.95);
    graves.push({ x, z });
  }
  openGrave(-11.5, 14.4, 1200); openGrave(5.2, -14.8, 1202); openGrave(17.6, 16.2, 1204);
  for (let gx = 4.6; gx <= 27; gx += 2.3) {
    for (const s of [1, -1]) {
      for (let gz = -21; gz <= 21; gz += 2.9) {
        if (Math.abs(gz) < 3.6) continue;
        if (gx < 25 && Math.abs(gz) < 11.6) continue;                       // the church itself
        const x = s * gx + rnd(0.7, -0.7), z = gz + rnd(0.7, -0.7);
        if (hollowCombatClearance(x, z, 1.4)) continue;
        if (graves.some((q) => Math.hypot(q.x - x, q.z - z) < 2.2)) continue;
        if (rand() < 0.2) continue;
        headstone(x, z, rand() < 0.32 ? 2 : Math.floor(rnd(3)), 1210 + Math.round(x * 7 + z));
      }
    }
  }
  column(bs, -27.4, -20.5, { seed: 1300, top: 5.6, r: 0.6 });               // a monument at the far corner

  // ------------------------------------------------------------------------------------ bones
  function skull(x, z, seed) {
    const g = gy(x, z), c = Math.cos(seed), s = Math.sin(seed);
    bm.part(8, seed);
    bm.obox([x, g + 0.11, z], [c, 0, s], [0, 1, 0], [-s, 0, c], 0.11, 0.12, 0.13);
    bm.part(4, seed + 1);
    for (const e of [-1, 1]) {
      const dx = e * 0.05 * c - 0.12 * s, dz = -e * 0.05 * s - 0.12 * c;
      bm.box(x + dx - 0.036, g + 0.1, z + dz - 0.036, x + dx + 0.036, g + 0.16, z + dz + 0.036);
    }
    bm.part(8, seed + 2).box(x - 0.07, g + 0.02, z - 0.08, x + 0.07, g + 0.07, z + 0.08);
  }
  function bonePile(x, z, seed, { n = 7, skulls = 1 } = {}) {
    const g = gy(x, z);
    bm.part(8, seed);
    for (let k = 0; k < n; k++) {
      const a = rnd(6.3), len = rnd(0.5, 0.28), rr = rnd(0.075, 0.05);
      const bx = x + rnd(0.8, -0.8), bz = z + rnd(0.8, -0.8);
      bm.beam([bx, g + 0.06, bz], [bx + Math.cos(a) * len, g + 0.09, bz + Math.sin(a) * len], rr * 2, rr * 2, [0, 1, 0]);
    }
    for (let k = 0; k < skulls; k++) skull(x + rnd(0.7, -0.7), z + rnd(0.7, -0.7), seed + k + 1);
  }
  for (const [x, z] of [[3.4, 6.4], [-5.2, -3.4], [8.6, -6.6], [-9.4, 4.2], [12.6, 3.4], [-15.2, -4.4], [6.2, -11.2],
    [-6.4, 11.6], [11.2, 10.8], [-13.6, 9.2], [17.4, -3.2], [-19.8, -8.2], [1.4, -10.8], [4.2, 18.4], [-2.6, -18.4],
    [21.4, 4.2], [-22.6, 6.4]]) {
    bonePile(x + rnd(0.6, -0.6), z + rnd(0.6, -0.6), 1400 + Math.round(x * 5 + z * 3), { n: 5 + Math.floor(rnd(7)), skulls: rand() < 0.5 ? 1 : 2 });
  }
  {
    const rx = -6.4, rz = 7.4, g = gy(rx, rz);
    bm.part(8, 1500);
    for (let k = 0; k < 6; k++) {
      const y = g + 0.05 + k * 0.06;
      for (const s of [-1, 1]) bm.beam([rx, y, rz], [rx + s * 0.5, y + 0.07, rz + s * 0.3], 0.05, 0.05, [0, 1, 0]);
    }
    bm.beam([rx, g + 0.05, rz + 0.55], [rx, g + 0.05, rz + 1.6], 0.14, 0.14, [0, 1, 0]);
  }
  for (let k = 0; k < 44; k++) {
    const x = rnd(29, -29), z = rnd(23, -23);
    if (Math.abs(x) < 25 && Math.abs(z) < 11.5) continue;
    const g = gy(x, z), la = rnd(6.3), ll = rnd(0.48, 0.24);
    bm.part(8, 1600 + k).beam([x, g + 0.05, z], [x + Math.cos(la) * ll, g + 0.07, z + Math.sin(la) * ll], 0.11, 0.11, [0, 1, 0]);
  }

  // ------------------------------------------------------------------------------------ dead wood
  /** A tall dead tree on its own ground: a leaning trunk in three lengths and bare branches, mostly two levels. */
  function deadTree(x, z, seed) {
    const g = gy(x, z);
    const h = rnd(25, 13), lean = rnd(0.18, -0.18), yaw = rnd(6.3);
    const r0 = h * 0.042;
    bw.part(2, seed);
    let px = x, pz = z, py = 0;
    for (let k = 0; k < 3; k++) {
      const lh = h / 3, nr = r0 * (1 - (0.4 * (k + 1)) / 3);
      const nx = px + Math.cos(yaw) * lean * lh, nz = pz - Math.sin(yaw) * lean * lh;
      bw.beam([px, g + py - 0.6, pz], [nx, g + py + lh, nz], nr * 2, nr * 2, [1, 0, 0]);
      px = nx; pz = nz; py += lh;
    }
    const nb = 6 + Math.floor(rnd(6));
    for (let k = 0; k < nb; k++) {
      const t = rnd(0.98, 0.34);
      const bx = x + Math.cos(yaw) * lean * h * t, bz = z - Math.sin(yaw) * lean * h * t, by = g + h * t;
      const a = rnd(Math.PI * 2), up = rnd(1.25, 0.4), len = rnd(4.0, 1.4) * (1.2 - t * 0.45);
      const ex = [bx + Math.cos(a) * len * Math.cos(up), by + len * Math.sin(up), bz + Math.sin(a) * len * Math.cos(up)];
      bw.beam([bx, by, bz], ex, rnd(0.34, 0.13), rnd(0.34, 0.13), [1, 0, 0]);
      if (rand() < 0.6) {
        const a2 = a + rnd(1.1, 0.4), l2 = len * 0.5;
        bw.beam(ex, [ex[0] + Math.cos(a2) * l2, ex[1] + l2 * 0.95, ex[2] + Math.sin(a2) * l2], 0.12, 0.12, [1, 0, 0]);
      }
    }
    addC(x, z, Math.max(0.4, r0 * 1.45), h);
    if (rand() < 0.18) {
      const fx = x + rnd(5, -5), fz = z + rnd(5, -5), fl = rnd(10, 4), fa = rnd(6.3), fg = gy(fx, fz);
      fallenBox(bw.part(2, seed + 1), fx, fz, fl / 2, 0.42, 0.42, fa, seed + 1);
    }
  }
  // a DENSE wood: rings out from the churchyard wall, thinning only right at its edge
  const trees = [];
  for (let k = 0; k < 4200 && trees.length < 330; k++) {
    const a = rnd(Math.PI * 2), u = rand();
    const rad = 18 + Math.pow(u, 0.5) * 104;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.94;
    const inYard = Math.abs(x) < YARD.hx + 2 && Math.abs(z) < YARD.hz + 2;
    if (hollowCombatClearance(x, z, 6)) continue;
    if (inYard && !(rand() < 0.04 && Math.abs(x) > 12 && Math.abs(z) > 13)) continue;
    if (Math.abs(x) < 4.5 && z > 21) continue;                              // keep the approach clear
    if (trees.some((t) => (t[0] - x) * (t[0] - x) + (t[1] - z) * (t[1] - z) < 3.4 * 3.4)) continue;
    trees.push([x, z]);
  }
  trees.forEach(([x, z], i) => deadTree(x, z, 2000 + i * 7));
  deadTree(-26.4, 18.6, 2900); deadTree(27.2, -17.4, 2903);                 // two big ones framing the ruin

  // ------------------------------------------------------------------------------------ meshes
  const meshOf = (b, mat, name, uvScale = 1) => {
    const g = b.geometry();
    if (!g.attributes.position || !g.attributes.position.count) { g.dispose?.(); return null; }
    if (uvScale !== 1) { const uv = g.getAttribute('uv'); for (let i = 0; i < uv.array.length; i++) uv.array[i] *= uvScale; }
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
    return m;
  };
  const meshes = [
    meshOf(bs, mats.stone, 'hollow-stone', 0.42),
    meshOf(bw, mats.timber, 'hollow-deadwood', 1.2),
    meshOf(br, mats.roof, 'hollow-roof', 0.8),
    meshOf(bm, mats.misc, 'hollow-misc', 1.0),
  ].filter(Boolean);

  const stats = {
    drawCalls: meshes.length,
    tris: Object.values(builders).reduce((s, b) => s + b.tris, 0),
    graves: graves.length,
    trees: trees.length + 2,
    colliders: colliders.length,
    buildMs: Math.round(performance.now() - t0),
  };
  console.log('[hollow]', JSON.stringify(stats));

  return {
    root, meshes, colliders, stats, mats,
    spawn: { x: 0, z: 34, yaw: Math.PI },
    altar: { x: 17.6, z: 0, r: 5.4 },
    gate: { x: 0, z: 22.6, r: 5.0 },
    dispose() { root.traverse((o) => o.geometry?.dispose?.()); app.scene.remove(root); mats.dispose?.(); },
  };
}
