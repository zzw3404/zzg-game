// 石城 — the medieval walled town of levels/citadel.js. Owner: citadel.
//
//   const citadel = await createCitadel(app, { citadel: LAYOUT.citadel })
//     → { root, colliders, meshes, paved(x, z), built(x, z), stats(), update(dt), dispose() }
//
// What it builds, all procedural (one draw call per material, see world/citadel-mat.js):
//   · a curtain wall round the town: battered plinth, wall-walk with merlons outside and a low parapet inside,
//     arrow loops, buttresses, and a round tower at each corner
//   · four gatehouses (west, east, north, south): twin towers astride the wall, an arched passage cut through it
//     (voussoir ring + barrel vault), jambs, an open pair of leaves, a raised portcullis, a machicolation band
//     and a pennant
//   · two streets crossing at the market square, cobbled, with cart ruts and flagstones on the square
//   · houses built by the kit in world/citadel-build.js (real wall openings, jettied storeys, slab roofs):
//     rows line both streets, three sides of the square and the lane round the wall
//   · named buildings, all from the kit: the church with its bell tower and churchyard, the guild hall on the
//     square, the tavern, the weapon / armour / potion shops, the smithy, the barn, and outside the east gate the
//     army camp (军队大营) with its palisade, tents and watchtower; inside, the training yard (练习场)
//   · torch brackets on the gates and the square; their light is baked into the shared town light field
//     (world/town-mat.js bakeTownLight) and gated by G.uCitLightK so it only shows at dusk and at night.
//
// Colliders (boxes for walls, circles for round objects) go to app.world.colliders + app.world.addBlocker so the player, the camera and the
// vegetation placement all know where the stone is. The gate passages are deliberately left open.
import * as THREE from 'three';
import { G, LAYERS } from '../core/globals.js';
import { loadPBR } from '../core/assets.js';
import { mulberry32 } from '../core/noise.js';
import { lamps } from '../core/lamps.js';
import { LAYOUT } from './layout.js';
import { Builder } from './town-geo.js';
import { createKit } from './citadel-build.js';
import { bakeTownLight } from './town-mat.js';
import { createCitadelMaterials } from './citadel-mat.js';
import { boxCollider, boxFromBuilder } from './collision.js';
import { citadelPaved } from '../levels/citadel.js';

const _v = new THREE.Vector3();

export async function createCitadel(app, opts = {}) {
  const t0 = performance.now();
  const C = opts.citadel ?? LAYOUT.citadel;
  if (!C) throw new Error('createCitadel: no LAYOUT.citadel (load with ?level=citadel)');
  const heightAt = app.world.heightAt;
  const rnd = mulberry32(20250924);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const O = C.outer, W = C.wall, GT = C.gate, CO = C.corner, ST = C.street, PZ = C.plaza;
  const OX = O.x, OZ = O.z, T = W.t, WALK = W.walk;
  const IX = OX - T, IZ = OZ - T;                    // inner faces of the curtain wall
  const D = heightAt(0, 0);                          // datum: everything is levelled off the square
  const Y = (h) => D + h;

  const K = { s: new Builder(), w: new Builder(), p: new Builder(), r: new Builder(), m: new Builder(), g: new Builder() };
  const colliders = [], blocked = [], lightSrc = [], lampHandles = [];
  const reserved = [];                               // rectangles landmarks own; house rows skip them
  const addC = (x, z, r, y0 = Y(-1), y1 = Y(r * 1.6)) => { const c = { x, z, r, y0, y1 }; colliders.push(c); return c; };
  const addB = (c) => { colliders.push(c); return c; };
  const solidBox = (b, ...a) => { b.box(...a); addB(boxFromBuilder(b, ...a)); };
  const reserve = (x0, z0, x1, z1) => reserved.push({ x0: Math.min(x0, x1) - 0.7, z0: Math.min(z0, z1) - 0.7, x1: Math.max(x0, x1) + 0.7, z1: Math.max(z0, z1) + 0.7 });
  /** Reserve a rect exactly (no margin): neighbours along the same row must still fit. */
  const reserveTight = (x0, z0, x1, z1) => reserved.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  /** Does the axis-aligned rect (x0,z0)-(x1,z1) touch anything already reserved? */
  const free = (x0, z0, x1, z1) => !reserved.some((b) => x1 > b.x0 && x0 < b.x1 && z1 > b.z0 && z0 < b.z1);
  const groundMin = (x0, z0, x1, z1, n = 4) => {
    let lo = Infinity;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) lo = Math.min(lo, heightAt(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * j) / n));
    return lo;
  };

  // ------------------------------------------------------------------------------------------------ curtain wall
  /** One straight run of wall in the local side frame: x along the wall, z across (outer at +T/2). */
  function wallRun(b, x0, x1, o) {
    if (x1 - x0 < 0.5) return;
    const len = x1 - x0;
    const top = Y(WALK), base = Y(0) - 1.1;
    const ht = T / 2;
    b.part(1).box(x0, base, -ht - 0.42, x1, Y(W.plinth), ht + 0.42);            // battered footing
    b.part(0).box(x0, Y(W.plinth) - 0.05, -ht, x1, top, ht);                    // body
    b.part(2).box(x0, top - 0.14, -ht - 0.06, x1, top, ht + 0.06);              // string course under the walk
    // wall-walk: a stone top with a low inner parapet, merlons along the outer edge
    b.part(0).box(x0, top, -ht, x1, top + 0.12, ht);
    b.part(2).box(x0, top + 0.12, -ht + 0.1, x1, top + W.parapetIn, -ht + 0.62);
    const step = W.merlon + W.gap;
    for (let x = x0 + 0.5; x < x1 - 0.4; x += step) {
      b.part(2).box(x, top + 0.12, ht - 0.62, x + W.merlon, top + 0.12 + W.merlon, ht);
      b.part(3).box(x + 0.08, top + 0.12 + W.merlon, ht - 0.6, x + W.merlon - 0.08, top + 0.16 + W.merlon, ht - 0.02);
    }
    // arrow loops on the outer face, buttresses inside
    for (let x = x0 + 4.5; x < x1 - 2.5; x += 7.5) {
      b.part(4).box(x, Y(3.1), ht - 0.16, x + 0.22, Y(4.15), ht + 0.02);
      b.part(4).box(x - 0.35, Y(3.45), ht - 0.16, x + 0.57, Y(3.8), ht + 0.02);
      b.part(4).box(x, Y(3.1), -ht - 0.02, x + 0.22, Y(4.15), -ht + 0.16);
    }
    for (let x = x0 + 6; x < x1 - 3; x += 9.5) solidBox(b.part(0), x, Y(0) - 0.6, -ht - 0.72, x + 0.9, Y(4.4), -ht + 0.05);
    // Rectangles follow the actual footing and wall; their ends never bulge into the gate.
    const c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
    const lx = (x0 + x1) / 2;
    addB(boxCollider(o.cx + lx * c, o.cz - lx * sn, len / 2, ht + 0.42, o.yaw, base, Y(W.plinth)));
    addB(boxCollider(o.cx + lx * c, o.cz - lx * sn, len / 2, ht + 0.06, o.yaw, Y(W.plinth), top + W.merlon + 0.16));
  }

  /**
   * The arched passage through the wall at a gate. The face is built as five pieces — two piers, the band over
   * the crown, and the two shoulders that follow the arch — because the material round an arch is not star-shaped
   * and a naive fan would seal the opening. Walls, vault, ring, leaves and portcullis all follow from those.
   */
  function gateBay(b, bm, bw, origin) {
    const BW = GT.bay, OW = GT.ow, RR = OW, RISE = Y(GT.rise), TOP = Y(WALK);
    const Y0 = Y(0) - 1.1, Fz = T / 2, Bz = -T / 2, NS = 12;
    const CrownY = RISE + RR;
    /** A face quad given as 2-D [x, y] points in either winding: emitted CCW seen from +dir·z. */
    const faceQuad = (pts, z, dir = 1) => {
      const [a, q, c, d] = pts;
      const area = (q[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (q[1] - a[1]);
      const o = area >= 0 ? pts : [a, d, c, q];
      const p = z === Fz ? o : [o[0], o[3], o[2], o[1]];      // the inner face looks the other way
      void dir;
      b.quad([p[0][0], p[0][1], z], [p[1][0], p[1][1], z], [p[2][0], p[2][1], z], [p[3][0], p[3][1], z]);
    };
    // the arch: points from the left springing over the crown to the right springing
    const arc = [];
    for (let k = 0; k <= NS; k++) { const th = Math.PI - (k * Math.PI) / NS; arc.push([RR * Math.cos(th), RISE + RR * Math.sin(th)]); }
    for (const z of [Fz, Bz]) {
      b.part(0);
      faceQuad([[-BW, Y0], [-OW, Y0], [-OW, TOP], [-BW, TOP]], z);                    // left pier
      faceQuad([[OW, Y0], [BW, Y0], [BW, TOP], [OW, TOP]], z);                        // right pier
      faceQuad([[-OW, CrownY], [OW, CrownY], [OW, TOP], [-OW, TOP]], z);              // over the crown
      for (let k = 0; k < NS; k++) {                                                  // shoulders beside the arch
        const A = arc[k], B = arc[k + 1];
        faceQuad([[A[0], A[1]], [B[0], B[1]], [B[0], CrownY], [A[0], CrownY]], z);
      }
    }
    b.part(0);
    // the solid spandrel over the arch: fills the wall behind the shaped faces and backs the portcullis
    b.box(-OW, CrownY, Bz, OW, TOP, Fz);
    // jamb faces and the barrel vault (the material is outside the arch, so these look into the passage)
    const side = (A, C) => b.quad([A[0], A[1], Bz], [C[0], C[1], Bz], [C[0], C[1], Fz], [A[0], A[1], Fz]);
    side([-OW, Y0], [-OW, RISE]);
    side([OW, RISE], [OW, Y0]);
    for (let k = 0; k < NS; k++) side(arc[k], arc[k + 1]);
    // wall-walk over the gate
    b.quad([BW, TOP, Bz], [-BW, TOP, Bz], [-BW, TOP, Fz], [BW, TOP, Fz]);
    // voussoir ring, dressed and standing a couple of centimetres proud on both faces
    for (let k = 0; k < NS; k++) {
      const A = arc[k], B = arc[k + 1];
      const ro = RR + 0.5;
      const A2 = [A[0] * (ro / RR), RISE + (A[1] - RISE) * (ro / RR)];
      const B2 = [B[0] * (ro / RR), RISE + (B[1] - RISE) * (ro / RR)];
      b.part(2, (k & 1) ? 0.6 : 0.1);
      faceQuad([A, B, B2, A2], Fz + 0.035);
      faceQuad([A, B, B2, A2], Bz - 0.035);
    }
    // keystone
    b.part(2, 0.9).box(-0.28, CrownY - 0.1, Fz - 0.05, 0.28, CrownY + 0.62, Fz + 0.09);
    b.part(2, 0.9).box(-0.28, CrownY - 0.1, Bz - 0.09, 0.28, CrownY + 0.62, Bz + 0.05);
    // threshold slabs
    b.part(1, 0).box(-OW, Y(0) - 0.06, Bz - 0.5, OW, Y(0) + 0.06, Fz + 0.5);
    // door leaves, folded back flat against the passage walls (both faces drawn: they are seen from either side)
    for (const s of [-1, 1]) {
      const lx = s * (OW - 0.09), z0 = Fz - 0.35, z1 = Fz - 3.3, y0 = Y(0.05), y1 = Y(GT.rise + 1.6);
      bw.part(2, 0.4).quad([lx, y0, z0], [lx, y1, z0], [lx, y1, z1], [lx, y0, z1]);
      bw.part(2, 0.4).quad([lx, y0, z1], [lx, y1, z1], [lx, y1, z0], [lx, y0, z0]);
      for (const y of [0.9, 2.4]) bm.part(0).box(lx - s * 0.03, Y(y), z1 + 0.1, lx + s * 0.07, Y(y + 0.12), z0 - 0.1);
    }
    // a portcullis wound up under the crown
    const py = CrownY - 1.5;
    for (let x = -OW + 0.25; x <= OW - 0.2; x += 0.44) bm.part(0).box(x, Y(py), -0.12, x + 0.07, Y(py + 1.5), 0.12);
    for (const y of [py + 0.1, py + 1.4]) bm.part(0).box(-OW + 0.2, Y(y), -0.14, OW - 0.2, Y(y + 0.09), 0.14);
    // passage + gate jamb colliders (the passage itself stays open)
    for (const s of [-1, 1]) {
      const lx = s * (OW + BW) / 2, c = Math.cos(origin.yaw), sn = Math.sin(origin.yaw);
      addB(boxCollider(origin.cx + lx * c, origin.cz - lx * sn, (BW - OW) / 2, T / 2, origin.yaw, Y0, TOP));
    }
  }

  /** Twin towers astride the wall either side of a gate, with a machicolation band, merlons and a pennant. */
  function gateTowers(b, bm, side, origin) {
    const Bz = -T / 2, Fz = T / 2;
    for (const sd of [-1, 1]) {
      const cx = sd * (GT.bay + GT.towerW / 2), base = Y(0) - 1.2, top = Y(GT.towerH);
      const hx = GT.towerW / 2, hz = GT.towerD / 2;
      b.part(1).box(cx - hx - 0.3, base, -hz - 0.3, cx + hx + 0.3, Y(0.9), hz + 0.3);
      b.part(0).box(cx - hx, Y(0.9), -hz, cx + hx, top, hz);
      b.part(2).box(cx - hx - 0.07, Y(6.6), -hz - 0.07, cx + hx + 0.07, Y(6.9), hz + 0.07);
      // machicolation: corbels, then a projecting band
      for (let k = -2; k <= 2; k++) {
        b.part(0).box(cx + k * 1.05 - 0.18, top - 1.5, hz - 0.02, cx + k * 1.05 + 0.18, top - 0.85, hz + 0.42);
        b.part(0).box(cx + k * 1.05 - 0.18, top - 1.5, -hz - 0.42, cx + k * 1.05 + 0.18, top - 0.85, hz + 0.02);
      }
      b.part(0).box(cx - hx - 0.45, top - 0.9, -hz - 0.45, cx + hx + 0.45, top, hz + 0.45);
      // merlons all round
      for (let k = -2; k <= 2; k++) for (const sz of [-1, 1]) b.part(2).box(cx + k * 1.5 - 0.45, top, sz > 0 ? hz + 0.05 : -hz - 0.45, cx + k * 1.5 + 0.45, top + W.merlon, sz > 0 ? hz + 0.45 : -hz - 0.05);
      for (let k = -2; k <= 2; k++) for (const sx of [-1, 1]) b.part(2).box(cx + sx * (hx + (sx > 0 ? 0.05 : -0.45)), top, k * 1.5 - 0.45, cx + sx * (hx + (sx > 0 ? 0.45 : -0.05)), top + W.merlon, k * 1.5 + 0.45);
      // arrow loops on the outer face
      for (const y of [3.4, 7.4]) {
        b.part(4).box(cx - 0.11, Y(y), hz - 0.16, cx + 0.11, Y(y + 1.05), hz + 0.02);
        b.part(4).box(cx - 0.46, Y(y + 0.35), hz - 0.16, cx + 0.46, Y(y + 0.7), hz + 0.02);
        bm.part(4).box(cx - 0.11, Y(y), -hz - 0.02, cx + 0.11, Y(y + 1.05), -hz + 0.16);
      }
      // pennant on the outer tower
      if (sd > 0) {
        bm.part(0).cyl(cx, top + W.merlon, 0, 0.045, 0.04, 3.2, 6, false);
        bm.part(1).quad([cx + 0.05, Y(GT.towerH + 3.0), 0], [cx + 0.05, Y(GT.towerH + 3.9), 0], [cx + 1.5, Y(GT.towerH + 3.55), 0.25], [cx + 1.5, Y(GT.towerH + 3.35), 0.25]);
        bm.part(1).quad([cx + 1.5, Y(GT.towerH + 3.35), 0.25], [cx + 1.5, Y(GT.towerH + 3.55), 0.25], [cx + 0.05, Y(GT.towerH + 3.9), 0], [cx + 0.05, Y(GT.towerH + 3.0), 0]);
      }
      // torch bracket beside the passage
      const tx = sd * (GT.bay - 0.35);
      bm.part(0).box(tx - 0.06, Y(3.0), Bz - 0.2, tx + 0.06, Y(3.06), Bz + 0.5);
      bm.part(0).box(tx - 0.06, Y(2.6), Bz - 0.06, tx + 0.06, Y(3.0), Bz + 0.06);
      bm.part(10).lathe(tx, Y(2.75), Bz + 0.14, [[0.12, 0], [0.16, 0.14], [0.1, 0.3], [0.03, 0.42]], 7);
      lightSrc.push({ x: origin.cx + tx * Math.cos(origin.yaw), z: origin.cz - tx * Math.sin(origin.yaw), h: 3.0, i: 3.4 });
      lightSrc.push({ x: origin.cx + tx * Math.cos(origin.yaw), z: origin.cz - tx * Math.sin(origin.yaw), h: 6.0, i: 1.2 });
      // tower collider + blocker
      const c = Math.cos(origin.yaw), sn = Math.sin(origin.yaw);
      const wx = origin.cx + (cx * c + 0 * sn), wz = origin.cz - cx * sn;
      addB(boxCollider(wx, wz, hx + 0.3, hz + 0.3, origin.yaw, base, Y(0.9)));
      addB(boxCollider(wx, wz, hx, hz, origin.yaw, Y(0.9), top + W.merlon));
    }
  }

  // sides: local x runs along the wall, local +z faces outward
  const SIDES = [
    { id: 'W', cx: -OX, cz: 0, yaw: -Math.PI / 2, len: 2 * OZ },
    { id: 'E', cx: OX, cz: 0, yaw: Math.PI / 2, len: 2 * OZ },
    { id: 'N', cx: 0, cz: -OZ, yaw: Math.PI, len: 2 * OX },
    { id: 'S', cx: 0, cz: OZ, yaw: 0, len: 2 * OX },
  ];
  for (const sd of SIDES) {
    K.s.frame(sd.cx, 0, sd.cz, sd.yaw);
    K.m.frame(sd.cx, 0, sd.cz, sd.yaw);
    K.w.frame(sd.cx, 0, sd.cz, sd.yaw);
    const half = sd.len / 2;
    // raise/lower the base to the lowest ground the run crosses: the local frame has x along the wall
    wallRun(K.s, -half, -GT.bay, sd);
    wallRun(K.s, GT.bay, half, sd);
    gateBay(K.s, K.m, K.w, sd);
    gateTowers(K.s, K.m, sd, sd);
    K.s.frame(0, 0, 0, 0); K.m.frame(0, 0, 0, 0); K.w.frame(0, 0, 0, 0);
  }

  // corner towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * (OX - 1.7), cz = sz * (OZ - 1.7), r = CO.r, base = Y(0) - 1.2;
    K.s.part(1).cyl(cx, base, cz, r + 0.35, r + 0.2, Y(0.9) - base, 16, false);
    K.s.part(0).cyl(cx, Y(0.9), cz, r, r - 0.25, CO.h - 0.9, 16, false);
    K.s.part(2).cyl(cx, Y(CO.h), cz, r - 0.25, r - 0.05, 0.42, 16, true);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      K.s.part(2, k & 1 ? 0.5 : 0).obox([cx + ca * (r - 0.45), Y(CO.h + 0.42 + W.merlon / 2), cz + sa * (r - 0.45)],
        [ca, 0, sa], [0, 1, 0], [-sa, 0, ca], 0.22, W.merlon / 2, 0.5);
    }
    // arrow loops round the tower
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const y of [3.2, 7.6]) K.s.part(4).obox([cx + ca * (r - 0.1), Y(y + 0.5), cz + sa * (r - 0.1)], [ca, 0, sa], [0, 1, 0], [-sa, 0, ca], 0.1, 0.5, 0.06);
    }
    addC(cx, cz, r + 0.35, Y(-1), Y(CO.h + W.merlon));
    if (app.world.addBlocker) app.world.addBlocker({ x: cx, z: cz, r: r + 0.4 });
  }

  // ------------------------------------------------------------------------------------------------ paving
  {
    // The pavers are laid on the terrain's own lattice (0.75 m, aligned to the world origin) so the two surfaces
    // agree vertex for vertex and nothing pokes through between them.
    const g = K.g, step = 0.75;
    const nx = Math.ceil((OX + 6.5) / step), nz = Math.ceil((OZ + 6.5) / step);
    const x0 = -nx * step, x1 = nx * step, z0 = -nz * step, z1 = nz * step;
    void x1; void z1;
    const offx = Math.round(-x0 / step), offz = Math.round(-z0 / step);   // absolute index of the first column/row
    const H = (x, z) => heightAt(x, z) + 0.045;
    const P = (x, z) => citadelPaved(x, z, C);
    const isPlaza = (x, z) => Math.abs(x - PZ.x) < PZ.w / 2 + 1.4 && Math.abs(z - PZ.z) < PZ.d / 2 + 1.4;
    for (let i = 0; i < nx * 2; i++) for (let j = 0; j < nz * 2; j++) {
      const ax = x0 + i * step, bx = ax + step, az = z0 + j * step, bz = az + step;
      if (!(P(ax, az) && P(bx, az) && P(ax, bz) && P(bx, bz))) continue;
      const mxx = (ax + bx) / 2, mzz = (az + bz) / 2;
      // flagstones on the square, cobbles in the town, rammed gravel on the approaches and in the training yard
      const yard = mxx > 28 && mxx < 52 && mzz > 9 && mzz < 27;
      const outside = Math.abs(mxx) > OX || Math.abs(mzz) > OZ || yard;
      g.part(outside ? 2 : isPlaza(mxx, mzz) ? 1 : 0, (i * 7 + j * 13) % 8);
      const A = [ax, H(ax, az), az], B = [bx, H(bx, az), az], Cc = [bx, H(bx, bz), bz], Dd = [ax, H(ax, bz), bz];
      // both triangles must wind counter-clockwise seen from above (the terrain's checkerboard parity included,
      // so the paving follows the same creases as the ground it lies on)
      if (((offx + i + offz + j) & 1) === 0) { g.triangle(A, Cc, B); g.triangle(A, Dd, Cc); }
      else { g.triangle(A, Dd, B); g.triangle(B, Dd, Cc); }
    }
  }

  // ------------------------------------------------------------------------------------------------ houses
  // ------------------------------------------------------------------------------------------------ houses
  // The building kit (world/citadel-build.js) owns walls-with-openings, roofs, shopfronts and the named buildings.
  const kit = createKit({ K, Y, rnd, R, pick, groundMin, addC, addB, reserve, free, lightSrc, lamps, app });
  const wallWithLocal = kit.wallWith;

  /** A row of houses along a line, facing `yaw`; skips slots reserved by landmarks or already built on. */
  const HOUSE_D = 9.5;                                 // the depth the rows are laid out on (footprint centre offset)
  /** The axis-aligned box a rotated footprint (W along the wall, D deep) actually occupies. */
  const footBox = (cx, cz, yaw, W, D) => {
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const ex = (W / 2) * c + (D / 2) * s, ez = (W / 2) * s + (D / 2) * c;
    return [cx - ex, cz - ez, cx + ex, cz + ez];
  };
  function row(ax, az, bx, bz, yaw, opt = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    let acc = 0;
    while (acc < len - 3) {
      let w = opt.fixedW ?? R(4.6, 7.2);
      if (len - acc - w < 3.6) w = len - acc;
      const cx = ax + ux * (acc + w / 2), cz = az + uz * (acc + w / 2);
      acc += w + 0.12;
      const d = opt.D ?? 9;
      const [x0, z0, x1, z1] = footBox(cx, cz, yaw, w, d);
      // the margin must stay below the 0.12 m gap left between houses, or every neighbour in the row is rejected
      if (!free(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05)) continue;
      if (rnd() < (opt.gap ?? 0.1)) continue;
      const st = rnd() < (opt.two ?? 0.55) ? 2 : 1;
      const D = d + R(-0.6, 0.8);
      kit.house({
        W: w, D, st,
        roof: pick(opt.roofs ?? ['tile', 'tile', 'slate', 'thatch']),
        axis: rnd() < 0.5 ? 'z' : 'x',
        jet: st > 1 && rnd() < 0.7, rise: R(2.2, 3.2),
        stone: rnd() < (opt.stone ?? 0.18), daub: rnd() < 0.4,
        windows: w > 6 ? 3 : 2, doorAt: R(-w / 4, w / 4), doorOpen: rnd() < 0.35,
        H1: R(2.85, 3.15), H2: R(2.3, 2.7),
        shutters: rnd() < 0.5 ? 'open' : rnd() < 0.7 ? 'closed' : 'none',
      }, cx, cz, yaw);
      reserveTight(...footBox(cx, cz, yaw, w + 0.06, D + 0.06));          // keep the next rows off this one
    }
  }

  // ------------------------------------------------------------------------------------------------ landmarks
  // ---- the church (north-west quarter): nave running east–west, buttresses, lancets, rose window, bell tower,
  //      spire, porch and a walled churchyard. The tower sits at the east end so it faces the square.
  kit.church(-33, -30, { naveL: 24, naveW: 10.5, naveH: 6.6, ridge: 10.6, towerH: 15.8, seed: 7 });

  // ---- the guild hall on the north side of the square (stone arcade below, timber hall above, bell-cote)
  {
    const cx = 0, cz = -18.5, Wd = 18, Dd = 9.5, yaw = 0;
    reserve(cx - Wd / 2, cz - Dd / 2, cx + Wd / 2, cz + Dd / 2);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const hw = Wd / 2, hd = Dd / 2, seed = 12;
    K.s.part(1, seed).box(-hw - 0.34, Y(0) - 1.3, -hd - 0.34, hw + 0.34, Y(0.06), hd + 0.34);
    // ground floor: an open arcade of three arches facing the square, a solid wall behind
    const bays = [-5.6, 0, 5.6];
    wallWithLocal(K.s, { x0: -hw, x1: hw, y0: 0.45, y1: 3.6, zf: hd, dir: -1, part: 0, seed, openings: bays.map((bx) => ({ x0: bx - 1.5, x1: bx + 1.5, y0: 0.45, y1: 2.9 })) });
    solidBox(K.s.part(0, seed), -hw, Y(0), -hd, hw, Y(3.6), -hd + 0.34);
    solidBox(K.s.part(0, seed), -hw, Y(0), -hd, -hw + 0.34, Y(3.6), hd);
    solidBox(K.s.part(0, seed), hw - 0.34, Y(0), -hd, hw, Y(3.6), hd);
    for (const bx of bays) for (let k = 0; k <= 7; k++) {                       // arch heads
      const a0 = Math.PI * (k / 7), a1 = Math.PI * ((k + 1) / 7);
      K.s.part(2, k & 1 ? 0.4 : 0).quad(
        [bx + 1.5 * Math.cos(a1), Y(2.9 + 1.5 * Math.sin(a1)), hd + 0.02], [bx + 1.5 * Math.cos(a0), Y(2.9 + 1.5 * Math.sin(a0)), hd + 0.02],
        [bx + 1.2 * Math.cos(a0), Y(2.9 + 1.2 * Math.sin(a0)), hd + 0.02], [bx + 1.2 * Math.cos(a1), Y(2.9 + 1.2 * Math.sin(a1)), hd + 0.02]);
    }
    for (const s of [-1, 1]) K.s.part(0, seed).box(s * hw, Y(0.45), -hd, s * (hw + 0.2), Y(3.6), hd);
    K.w.part(0, seed).box(-hw - 0.3, Y(3.5), -hd - 0.3, hw + 0.3, Y(3.9), hd + 0.3);       // jetty beam
    wallWithLocal(K.p, { x0: -hw - 0.2, x1: hw + 0.2, y0: 3.9, y1: 6.4, zf: hd + 0.24, dir: -1, part: 1, seed: seed + 1, openings: [-3, -1.5, 0, 1.5, 3].map((x) => ({ x0: x - 0.5, x1: x + 0.5, y0: 4.6, y1: 5.7 })) });
    K.p.part(1, seed).box(-hw - 0.2, Y(3.9), -hd - 0.2, hw + 0.2, Y(6.4), -hd - 0.2);
    for (const x of [-3, -1.5, 0, 1.5, 3]) kit.fitWindow(K.w, K.m, { x, w: 1.0, h: 1.1, sill: 4.6, zf: hd + 0.24, glass: true, shutters: 'none', seed });
    kit.timberFace(K.w, { x0: -hw + 0.2, x1: hw - 0.2, y0: 3.9, y1: 6.3, zf: hd + 0.26, seed: seed + 2, openings: [-3, -1.5, 0, 1.5, 3].map((x) => ({ x0: x - 0.5, x1: x + 0.5 })) });
    kit.roofSlab(K.r, K.p, { W: Wd + 0.4, D: Dd + 0.4, eaveY: 6.4, rise: 3.4, axis: 'x', ov: 0.55, kind: 'slate', gablePart: 4, gableSeed: seed });
    K.s.part(2, seed).box(-0.8, Y(9.9), -0.4, 0.8, Y(11.9), 0.4);                          // bell-cote on the ridge
    K.m.part(4, seed).box(-0.55, Y(10.3), 0.34, 0.55, Y(11.6), 0.46);
    K.s.part(2, seed).lathe(0, Y(11.9), 0, [[1.0, 0], [0.55, 0.75], [0.08, 1.35]], 6);
    for (let k = -3; k <= 3; k++) K.s.part(1, seed).box(k * 2.6 - 0.42, Y(9.2), -0.55, k * 2.6 + 0.42, Y(11.1), -0.44);
    K.m.part(1, seed).box(-0.95, Y(2.0), hd + 0.4, 0.95, Y(3.35), hd + 0.46);              // banner over the arcade
    lightSrc.push({ x: cx, z: cz + hd + 0.3, h: 2.4, i: 2.4 });
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
  }

  // ---- the three shops on the north side of the main street, west of the square, plus the tavern opposite.
  //      Each has a counter bay, a pent awning, a painted hanging sign and its own wares outside — and an interior
  //      you can walk into, with a counter and a keeper behind it (the RPG layer in ui/shop.js uses these).
  const shops = [];
  shops.push(kit.shop('weapon', -49, -10.6, 0, { seed: 41 }));
  shops.push(kit.shop('armour', -40.5, -10.6, 0, { seed: 42 }));
  shops.push(kit.shop('potion', -32, -10.6, 0, { seed: 43, st: 1, roof: 'thatch', axis: 'x' }));
  kit.tavern(-44, 11.4, Math.PI, { seed: 44 });

  // ---- the smithy (south-east quarter): a low stone shed with a forge glowing behind an open front
  kit.smithy(21, 30, -Math.PI / 2);

  // ---- the barn and its yard (north-east quarter)
  kit.barn(25, -26, Math.PI / 2);

  // ---- 练习场 the training yard: a fenced drill ground inside the south-east quarter (dummies, butts, pell)
  kit.trainingYard(40, 18, 0);

  // ---- 军队大营 the army camp: a palisaded camp on the road outside the east gate
  kit.camp(88, 20);

  // ---- (the tavern on the south side of the main street is built above, by kit.tavern)

  // ---- the market square: well, cross, stalls, barrels, cart
  {
    // well
    const wx = -3.5, wz = 4.0;
    K.s.part(1).cyl(wx, Y(0), wz, 1.5, 1.35, 1.05, 10, false);
    K.s.part(2).cyl(wx, Y(1.02), wz, 1.45, 1.35, 0.16, 10, true);
    K.m.part(7).cyl(wx, Y(0.72), wz, 1.05, 1.05, 0.22, 10, true);
    for (const s of [-1, 1]) K.w.part(0).box(wx + s * 1.15 - 0.09, Y(1.0), wz - 0.09, wx + s * 1.15 + 0.09, Y(2.6), wz + 0.09);
    K.w.part(0).box(wx - 1.24, Y(2.5), wz - 0.09, wx + 1.24, Y(2.68), wz + 0.09);
    K.r.frame(wx, 0, wz, 0); K.p.frame(wx, 0, wz, 0);
    kit.roofSlab(K.r, K.p, { W: 3.4, D: 2.2, eaveY: 2.68, rise: 1.0, axis: 'z', ov: 0.3, kind: 'shingle', gablePart: 1, gableSeed: 3 });
    K.r.frame(0, 0, 0, 0); K.p.frame(0, 0, 0, 0);
    K.w.part(4).cyl(wx, Y(2.3), wz, 0.06, 0.06, 0.22, 6, false);
    addC(wx, wz, 1.5, Y(0), Y(1.18));
    lightSrc.push({ x: wx, z: wz, h: 1.8, i: 1.0 });

    // market cross on three steps
    const mx = 4.5, mz = -5.5;
    for (let k = 0; k < 3; k++) K.s.part(2, k * 0.3).cyl(mx, Y(k * 0.22), mz, 1.5 - k * 0.28, 1.4 - k * 0.28, 0.22, 8, true);
    K.s.part(2).cyl(mx, Y(0.66), mz, 0.24, 0.2, 2.5, 6, false);
    K.s.part(2).box(mx - 0.5, Y(2.8), mz - 0.16, mx + 0.5, Y(3.1), mz + 0.16);
    K.s.part(2).box(mx - 0.16, Y(2.9), mz - 0.16, mx + 0.16, Y(3.7), mz + 0.16);
    addC(mx, mz, 1.22, Y(0.22), Y(0.66));
    addC(mx, mz, 0.26, Y(0.66), Y(3.7));

    // stalls: a table, four posts and a striped awning
    const stalls = [[-12, 2.5, 0.2], [-8.5, -3.0, -0.4], [-11.5, -7.5, 0.1], [9.0, 3.0, 0.3], [12.0, -2.0, -0.2], [7.5, 7.0, 0.15]];
    for (const [sx, sz, sa] of stalls) {
      K.w.frame(sx, 0, sz, sa);
      for (const [dx, dz] of [[-1.35, -0.75], [1.35, -0.75], [-1.35, 0.75], [1.35, 0.75]]) K.w.part(0, 0.2).cyl(dx, Y(0), dz, 0.09, 0.085, 2.3, 6, false);
      K.w.part(1).box(-1.5, Y(0.78), -0.85, 1.5, Y(0.95), 0.85);
      K.w.part(0).box(-1.55, Y(0.63), -0.9, 1.55, Y(0.8), -0.72);
      K.m.frame(sx, 0, sz, sa);
      K.m.part(2).box(-1.6, Y(2.3), -0.95, 1.6, Y(2.42), 0.95);
      K.m.part(2).box(-1.6, Y(2.3), 0.95, 1.6, Y(2.14), 1.05);
      K.m.part(2).box(-1.6, Y(2.3), -1.05, 1.6, Y(2.14), -0.95);
      for (let k = 0; k < 5; k++) K.m.part(3, k).box(-1.2 + k * 0.6, Y(0.95), -0.5, -0.95 + k * 0.6, Y(1.22), 0.3);
      addB(boxCollider(sx, sz, 1.55, 0.9, sa, Y(0), Y(1.22)));
      lightSrc.push({ x: sx, z: sz, h: 2.2, i: 0.8 });
      K.w.frame(0, 0, 0, 0);
      K.m.frame(0, 0, 0, 0);
    }
    // barrels and crates round the square
    for (let k = 0; k < 14; k++) {
      const a = R(0, Math.PI * 2), rr = R(11, 15);
      const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr * 0.72;
      if (rnd() < 0.45) { K.w.part(1, k * 0.1).cyl(bx, Y(0), bz, 0.36, 0.32, 0.86, 9, true); addC(bx, bz, 0.36, Y(0), Y(0.86)); }
      else solidBox(K.w.part(4, k * 0.1), bx - 0.42, Y(0), bz - 0.42, bx + 0.42, Y(0.72), bz + 0.42);
    }
    // a cart by the north-east corner of the square
    const cx2 = 13.5, cz2 = -9.5;
    K.w.frame(cx2, 0, cz2, 0.5);
    K.w.part(1).box(-2.2, Y(0.75), -0.85, 0.4, Y(0.95), 0.85);
    K.w.part(0).box(-2.3, Y(0.55), -0.9, 0.5, Y(0.8), -0.75);
    K.w.part(0).box(-2.3, Y(0.55), 0.75, 0.5, Y(0.8), 0.9);
    for (const s of [-1, 1]) K.w.part(0).box(0.4, Y(0.6), s * 0.72, 2.0, Y(0.78), s * 0.86);
    for (const s of [-1, 1]) {
      K.w.part(0).cyl(-1.3, Y(0.42), s * 0.98, 0.42, 0.42, 0.16, 12, true);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; K.w.part(4).box(-1.3, Y(0.42 + Math.sin(a) * 0.36 - 0.03), s * 0.98, -1.3 + Math.cos(a) * 0.36, Y(0.42 + Math.sin(a) * 0.36 + 0.03), s * 0.98 + Math.cos(a) * 0.03); }
    }
    K.m.frame(cx2, 0, cz2, 0.5);
    K.m.part(3).box(-1.9, Y(0.95), -0.6, -0.3, Y(1.35), 0.6);
    addB(boxFromBuilder(K.w, -2.3, Y(0), -1.15, 0.5, Y(1.35), 1.15));
    for (const s of [-1, 1]) addB(boxFromBuilder(K.w, 0.4, Y(0.55), s * 0.72, 2.0, Y(0.78), s * 0.86));
    K.w.frame(0, 0, 0, 0);
    K.m.frame(0, 0, 0, 0);

    // four torch posts on the square
    for (const [tx, tz] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) {
      K.w.part(4).cyl(tx, Y(0), tz, 0.12, 0.1, 3.1, 6, false);
      K.m.part(0).box(tx - 0.28, Y(3.1), tz - 0.28, tx + 0.28, Y(3.2), tz + 0.28);
      K.m.part(10).lathe(tx, Y(3.2), tz, [[0.16, 0], [0.21, 0.2], [0.12, 0.42], [0.04, 0.6]], 7);
      addC(tx, tz, 0.12, Y(0), Y(3.8));
      lightSrc.push({ x: tx, z: tz, h: 3.3, i: 3.2 });
      if (lampHandles.length < 7) lampHandles.push(lamps.add({ pos: new THREE.Vector3(tx, Y(3.3), tz), color: [1.0, 0.46, 0.16], weight: 3.6, flicker: 0.4 }));
    }
  }

  // ---- streets, square and lane lining with houses, in the four quarters
  // the kitchen gardens claim their ground first, so the rows leave a hole for them
  garden(-24, 25, 12, 8, 0.2);
  garden(27, -21, 10, 7, -0.3);
  garden(-27, -17, 9, 7, 0.15);
  garden(30, 19, 11, 8, 0.1);
  garden(-33, 18, 10, 7, -0.2);
  garden(34, -13, 9, 6, 0.25);
  garden(-41, -17, 8, 6, 0);
  garden(14, 30, 9, 6, -0.15);
  const plazaMouth = PZ.w / 2 + 5.6;
  const laneZ = OZ - T - ST.ringInset - ST.ring;        // inner edge of the cobbled lane round the wall
  const laneX = OX - T - ST.ringInset - ST.ring;
  for (const sz of [-1, 1]) {
    // main street: both sides, either side of the square mouth
    for (const [a, b] of [[-IX + 1.0, -plazaMouth], [plazaMouth, IX - 1.0]]) {
      row(a, sz * (ST.w / 2 + HOUSE_D / 2), b, sz * (ST.w / 2 + HOUSE_D / 2), sz > 0 ? Math.PI : 0, { gap: 0.12 });
    }
    // the square's own sides (split by the cross street)
    for (const [a, b] of [[-PZ.w / 2, -ST.w2 / 2 - 1.6], [ST.w2 / 2 + 1.6, PZ.w / 2]]) {
      row(a, sz * (PZ.d / 2 + HOUSE_D / 2), b, sz * (PZ.d / 2 + HOUSE_D / 2), sz > 0 ? Math.PI : 0, { gap: 0.1, two: 0.7 });
    }
    // the cross street: both sides, outside the square
    for (const [a, b] of [[-IZ + 2.0, -PZ.d / 2 - HOUSE_D / 2 - 1.5], [PZ.d / 2 + HOUSE_D / 2 + 1.5, IZ - 2.0]]) {
      row(sz * (ST.w2 / 2 + HOUSE_D / 2), a, sz * (ST.w2 / 2 + HOUSE_D / 2), b, sz > 0 ? -Math.PI / 2 : Math.PI / 2, { gap: 0.12, two: 0.5 });
    }
    // the lane round the wall: houses facing the lane, backs to the town
    for (const [a, b] of [[-IX + 2.0, -13], [13, IX - 2.0]]) {
      row(a, sz * (laneZ - 3.75), b, sz * (laneZ - 3.75), sz > 0 ? 0 : Math.PI, { gap: 0.14, D: 7.5, two: 0.45, roofs: ['thatch', 'tile'] });
    }
    for (const [a, b] of [[-IZ + 2.0, -13], [13, IZ - 2.0]]) {
      row(sz * (laneX - 3.75), a, sz * (laneX - 3.75), b, sz > 0 ? Math.PI / 2 : -Math.PI / 2, { gap: 0.14, D: 7.5, two: 0.45, roofs: ['thatch', 'tile'] });
    }
  }

  // ---- kitchen gardens in the quarters: a fence, a few trees, rows of vegetables
  function garden(cx, cz, w, d, yaw) {
    if (!free(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2)) return;      // a house got here first
    reserve(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    K.w.frame(cx, 0, cz, yaw); K.p.frame(cx, 0, cz, yaw);
    const hw = w / 2, hd = d / 2;
    const nf = Math.max(2, Math.round(w / 1.6));
    for (let k = 0; k <= nf; k++) {
      const x = -hw + (w * k) / nf;
      K.w.part(4).cyl(x, Y(0), -hd, 0.06, 0.05, 1.05, 5, false);
      K.w.part(4).cyl(x, Y(0), hd, 0.06, 0.05, 1.05, 5, false);
      if (k < nf) {
        K.w.part(1).box(x, Y(0.72), -hd - 0.04, x + w / nf, Y(0.80), -hd + 0.04);
        K.w.part(1).box(x, Y(0.72), hd - 0.04, x + w / nf, Y(0.80), hd + 0.04);
      }
    }
    for (const s of [-1, 1]) addB(boxFromBuilder(K.w, -hw - 0.06, Y(0), s * hd - 0.06, hw + 0.06, Y(1.05), s * hd + 0.06));
    // three fruit trees, a trunk and a canopy
    for (let k = 0; k < 3; k++) {
      const tx = -hw + 1.8 + (w - 3.6) * (k / 2), tz = (k % 2 ? hd * 0.45 : -hd * 0.45);
      const t = R(0.85, 1.15);
      K.p.part(6).cyl(tx, Y(0), tz, 0.16 * t, 0.11 * t, 1.6 * t, 7, false);
      K.p.part(5, k * 0.3).lathe(tx, Y(1.4 * t), tz, [[0.22 * t, 0], [1.3 * t, 0.6 * t], [1.55 * t, 1.4 * t], [1.0 * t, 2.3 * t], [0.25 * t, 2.8 * t]], 8);
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      addC(cx + tx * c + tz * sn, cz - tx * sn + tz * c, 0.5);
    }
    // vegetable beds
    for (let r = 0; r < 3; r++) for (let k = 0; k < Math.floor(w / 0.9); k++)
      K.p.part(5, 0.7 + r * 0.1).box(-hw + 0.6 + k * 0.9, Y(0), -hd + 1.4 + r * 1.5, -hw + 0.95 + k * 0.9, Y(0.34), -hd + 1.75 + r * 1.5);
    K.w.frame(0, 0, 0, 0); K.p.frame(0, 0, 0, 0);
  }

  // ------------------------------------------------------------------------------------------------ light + meshes
  const rect = { x0: -OX - 12, z0: -OZ - 12, w: 2 * OX + 24, d: 2 * OZ + 24 };
  bakeTownLight(lightSrc, rect, 0.5);

  const mats = await createCitadelMaterials(opts.loadPBR ?? loadPBR);
  const root = new THREE.Group();
  root.name = 'citadel';
  const meshes = [];
  const mk = (b, mat, name, { shadow = true, uvScale = 1, order = -2, frustum = false } = {}) => {
    const g = b.geometry();
    if (!g.getAttribute('position') || g.getAttribute('position').count === 0) { g.dispose(); return null; }
    if (uvScale !== 1) { const uv = g.getAttribute('uv'); for (let i = 0; i < uv.array.length; i++) uv.array[i] *= uvScale; }
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
    mesh.layers.set(LAYERS.WORLD);
    mesh.renderOrder = order;                  // before the terrain (0): the ground under the town is early-Z rejected
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.frustumCulled = !frustum;
    root.add(mesh); meshes.push(mesh);
    return mesh;
  };
  mk(K.r, mats.roof, 'citadel:roof', { order: -5 });
  mk(K.p, mats.plaster, 'citadel:plaster', { order: -4, uvScale: 0.5 });
  mk(K.w, mats.timber, 'citadel:timber', { order: -4 });
  mk(K.s, mats.stone, 'citadel:stone', { order: -3, uvScale: 0.42 });
  mk(K.m, mats.misc, 'citadel:misc', { order: -3 });
  mk(K.g, mats.paving, 'citadel:paving', { shadow: false, order: -2 });
  root.updateMatrixWorld(true);
  app.scene.add(root);

  app.world.colliders ||= [];
  app.world.colliders.push(...colliders);
  if (app.world.addBlocker) for (const c of colliders) app.world.addBlocker(c);
  // keep the loose street trees and the far pines out of the walled town
  if (app.world.addBlocker) app.world.addBlocker({ x: 0, z: 0, r: Math.hypot(OX, OZ) * 0.62 });

  const built = (x, z) => Math.abs(x) < OX && Math.abs(z) < OZ && !citadelPaved(x, z, C);
  const tris = meshes.reduce((s, m) => s + (m.geometry.index ? m.geometry.index.count / 3 : 0), 0);

  // the four gates, for the travel prompts (ui/gates.js): (x, z) is the gate centre in the wall, yaw the side's
  // outward frame rotation, so a point outside satisfies (p - g)·(sin yaw, cos yaw) > 0
  const GATE_SIDE = { W: 'west', E: 'east', N: 'north', S: 'south' };
  const gates = SIDES.map((sd) => ({ side: GATE_SIDE[sd.id], x: sd.cx, z: sd.cz, yaw: sd.yaw }));

  const sys = {
    root, colliders, meshes, lightRect: rect, shops, gates,
    paved: (x, z) => citadelPaved(x, z, C),
    built,
    update() {
      // torches and lit windows fade in with the environment's night factor
      const k = Math.min(1, Math.max(0, (G.uNight.value - 0.04) / 0.3));
      G.uCitLightK.value = k * k * (3 - 2 * k);
    },
    stats() {
      return {
        drawCalls: meshes.length, tris: Math.round(tris), houses: kit.stats.houses, shops: kit.stats.shops, landmarks: kit.stats.landmarks, colliders: colliders.length,
        lightSources: lightSrc.length, lamps: lampHandles.length, buildMs: Math.round(performance.now() - t0),
      };
    },
    dispose() {
      app.remove?.(sys);
      app.scene.remove(root);
      for (const m of meshes) m.geometry.dispose();
      mats.dispose();
      G.tTownLight.value?.dispose();
      for (const h of lampHandles) h.remove();
      const set = new Set(colliders);
      if (app.world.colliders) app.world.colliders = app.world.colliders.filter((c) => !set.has(c));
    },
  };
  app.add?.(sys);
  void _v; void blocked;
  return sys;
}
