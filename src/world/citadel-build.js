// Building kit for the walled town (world/citadel.js). Owner: citadel.
//
// The houses of the first pass were flat boxes with painted-on windows and the roof gables on the wrong axis.
// This kit builds a house the way a house is built:
//   · walls are solid boxes with REAL rectangular openings cut into them (the reveal comes from the neighbouring
//     boxes' side faces), so a door is a hole you can see into and a window is a hole with a frame;
//   · openings get fittings — a door leaf, sills, mullions, glazing, shutters (open flat on the wall or closed);
//   · timber framing runs only where there is wall: sole plate, head plate, studs and braces in every solid
//     segment between the openings;
//   · the jettied upper storey is carried on a row of corbels, and its floor slab is the ground floor's ceiling;
//   · the roof is a slab (top face, underside, eave and verge fascias) with the ridge along x or along z and the
//     gable walls on the axis that actually matches, with a proper overhang and a chimney standing on the slope.
//
//   const kit = createKit({ K, Y, ... })
//   kit.house(spec, cx, cz, yaw) · kit.shop(spec, cx, cz, yaw) · kit.tavern(spec, cx, cz, yaw)
//   kit.church(cx, cz) · kit.barracksHall(spec, cx, cz, yaw) · kit.camp(cx, cz) · kit.trainingYard(cx, cz)
import * as THREE from 'three';
import { boxCollider, boxFromBuilder } from './collision.js';

export function createKit(ctx) {
  const { K, Y, rnd, R, pick, groundMin, addC, addB, reserve, lightSrc, lamps } = ctx;
  const solidBox = (b, ...a) => { b.box(...a); addB(boxFromBuilder(b, ...a)); };
  const localCircle = (b, x, z, r, y0, y1) => addC(b.ox + x * b.c + z * b.s, b.oz - x * b.s + z * b.c, r, Y(y0), Y(y1));
  const localBox = (b, x, z, hx, hz, yaw, y0, y1) => addB(boxCollider(b.ox + x * b.c + z * b.s, b.oz - x * b.s + z * b.c,
    hx, hz, Math.atan2(b.s, b.c) + yaw, Y(y0), Y(y1)));
  const fenceCollider = (b, x0, z0, x1, z1, t, h) => localBox(b, (x0 + x1) / 2, (z0 + z1) / 2,
    Math.hypot(x1 - x0, z1 - z0) / 2 + t / 2, t / 2, -Math.atan2(z1 - z0, x1 - x0), -0.4, h);
  const stats = { houses: 0, shops: 0, landmarks: 0, rooms: 0 };

  // ================================================================================================== primitives
  /**
   * A wall panel with rectangular openings. Heights are given as metres ABOVE THE DATUM (Y(0)); the outer face is
   * at local z = zf and the wall grows `t` in `dir` (-1 = inward along -z, for a face that looks toward +z).
   * Solid piers, sills and lintels are emitted as boxes, so every opening comes out as a genuine hole with jambs.
   */
  function wallWith(b, { x0, x1, y0, y1, zf, t = 0.34, dir = -1, part = 0, seed = 0, openings = [] }) {
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return;
    const za = Math.min(zf, zf + dir * t), zb = Math.max(zf, zf + dir * t);
    const ops = openings
      .filter((o) => o.x1 > x0 + 0.02 && o.x0 < x1 - 0.02 && o.y1 > y0 + 0.02 && o.y0 < y1 - 0.02)
      .map((o) => ({ x0: Math.max(o.x0, x0), x1: Math.min(o.x1, x1), y0: Math.max(o.y0, y0), y1: Math.min(o.y1, y1) }))
      .sort((a, b2) => a.x0 - b2.x0);
    b.part(part, seed);
    let cur = x0;
    for (const o of ops) {
      if (o.x0 > cur + 0.02) solidBox(b, cur, Y(y0), za, o.x0, Y(y1), zb);
      if (o.y0 > y0 + 0.02) solidBox(b, o.x0, Y(y0), za, o.x1, Y(o.y0), zb);      // under the sill
      if (o.y1 < y1 - 0.02) solidBox(b, o.x0, Y(o.y1), za, o.x1, Y(y1), zb);      // over the head
      cur = Math.max(cur, o.x1);
    }
    if (cur < x1 - 0.02) solidBox(b, cur, Y(y0), za, x1, Y(y1), zb);
  }

  /** A window fitting inside an opening at local z = zf, looking toward `face` (+1 = +z). */
  function fitWindow(bw, bm, { x, w, sill, h, zf, face = 1, glass = true, shutters = 'open', mullion = true, seed = 0 }) {
    const o = face * 0.05, hw = w / 2;
    // sill stone + timber frame
    bw.part(2, seed).box(x - hw - 0.1, Y(sill - 0.09), zf - face * 0.13, x + hw + 0.1, Y(sill), zf + o + 0.07);
    for (const s of [-1, 1]) bw.part(0, seed).box(x + s * hw - 0.045, Y(sill), zf - face * 0.06, x + s * hw + 0.045, Y(sill + h), zf + o);
    bw.part(0, seed).box(x - hw, Y(sill + h - 0.07), zf - face * 0.06, x + hw, Y(sill + h), zf + o);
    if (mullion) {
      bw.part(0, seed).box(x - 0.035, Y(sill), zf - face * 0.04, x + 0.035, Y(sill + h), zf + o - face * 0.02);
      bw.part(0, seed).box(x - hw, Y(sill + h * 0.52), zf - face * 0.04, x + hw, Y(sill + h * 0.52 + 0.06), zf + o - face * 0.02);
    }
    if (glass) bm.part(5, seed).box(x - hw + 0.02, Y(sill + 0.02), zf - face * 0.03, x + hw - 0.02, Y(sill + h - 0.02), zf + o - face * 0.05);
    else bm.part(4, seed).box(x - hw + 0.02, Y(sill + 0.02), zf - face * 0.2, x + hw - 0.02, Y(sill + h - 0.02), zf + o - face * 0.05);
    if (shutters === 'open') for (const s of [-1, 1]) {
      const sx = x + s * hw;
      bw.part(3, seed).box(sx + (s > 0 ? 0.04 : -0.42), Y(sill - 0.02), zf - face * 0.03, sx + (s > 0 ? 0.46 : -0.04), Y(sill + h), zf + o + 0.03);
      bw.part(0, seed).box(sx + (s > 0 ? 0.04 : -0.42), Y(sill + h * 0.45), zf + o, sx + (s > 0 ? 0.46 : -0.04), Y(sill + h * 0.45 + 0.05), zf + o + 0.05);
    }
    else if (shutters === 'closed') bw.part(3, seed).box(x - hw, Y(sill), zf - face * 0.02, x + hw, Y(sill + h), zf + o + 0.02);
  }

  /** A door fitting: leaf (closed), or swung open inward, plus iron work and a threshold. */
  function fitDoor(bw, bm, bp, { x, w, h, sill = 0.35, zf, face = 1, open = false, seed = 0, arch = false }) {
    const hw = w / 2, o = face * 0.05;
    bp.part(2, seed).box(x - hw - 0.16, Y(sill - 0.16), zf - face * 0.2, x + hw + 0.16, Y(sill), zf + o + 0.1);   // step
    if (arch) {
      // a segmental arch head: seven dressed stones over the opening
      for (let k = 0; k < 7; k++) {
        const a0 = Math.PI * (k / 7), a1 = Math.PI * ((k + 1) / 7);
        const R0 = hw + 0.05, R1 = hw + 0.42;
        const A = [x + R0 * Math.cos(a0), Y(sill + h - 0.35 + R0 * Math.sin(a0) * 0.55)];
        const B = [x + R0 * Math.cos(a1), Y(sill + h - 0.35 + R0 * Math.sin(a1) * 0.55)];
        const Cc = [x + R1 * Math.cos(a1), Y(sill + h - 0.35 + R1 * Math.sin(a1) * 0.55)];
        const Dd = [x + R1 * Math.cos(a0), Y(sill + h - 0.35 + R1 * Math.sin(a0) * 0.55)];
        bp.part(2, (k & 1) ? 0.5 : 0.1).quad([A[0], A[1], zf + o], [B[0], B[1], zf + o], [Cc[0], Cc[1], zf + o], [Dd[0], Dd[1], zf + o]);
      }
    } else {
      bw.part(0, seed).box(x - hw - 0.1, Y(sill + h - 0.16), zf - face * 0.1, x + hw + 0.1, Y(sill + h), zf + o + 0.04);   // lintel
    }
    for (const s of [-1, 1]) bw.part(0, seed).box(x + s * hw - 0.05, Y(sill), zf - face * 0.08, x + s * hw + 0.05, Y(sill + h), zf + o);   // jambs
    if (open) {
      // the leaf folded back against the inner reveal (drawn from both sides)
      const hx = x - hw + 0.06;
      solidBox(bw.part(2, seed), hx - 0.05, Y(sill + 0.02), zf - face * (w - 0.1), hx + 0.05, Y(sill + h - 0.05), zf);
    } else {
      solidBox(bw.part(2, seed), x - hw + 0.04, Y(sill + 0.02), zf - face * 0.1, x + hw - 0.04, Y(sill + h - 0.05), zf + o - face * 0.02);
      for (const s of [-1, 1]) bw.part(0, seed).box(x + s * hw * 0.55, Y(sill + 0.28), zf + o - face * 0.02, x + s * hw * 0.55 + 0.12 * s, Y(sill + 0.38), zf + o + 0.02);
      bm.part(0, seed).box(x + hw * 0.45, Y(sill + 1.0), zf + o - face * 0.02, x + hw * 0.62, Y(sill + 1.1), zf + o + 0.06);
    }
  }

  /** Timber framing over a plaster face: plates across, studs and braces only in the solid segments. */
  function timberFace(bw, { x0, x1, y0, y1, zf, part = 0, seed = 0, openings = [], spacing = 0.82 }) {
    const T = 0.11, P = 0.075;                                     // member depth / proud of the wall
    bw.part(part, seed);
    bw.box(x0, Y(y0), zf, x1, Y(y0 + 0.19), zf + P);              // sole plate
    bw.box(x0, Y(y1 - 0.2), zf, x1, Y(y1), zf + P);               // head plate
    const ops = openings.filter((o) => o.x1 > x0 && o.x0 < x1).sort((a, b2) => a.x0 - b2.x0);
    const segs = [];
    let cur = x0;
    for (const o of ops) { if (o.x0 > cur + 0.05) segs.push([cur, o.x0, o.y1 ?? null]); cur = Math.max(cur, o.x1); }
    if (cur < x1 - 0.05) segs.push([cur, x1, null]);
    for (const [a, b2, from] of segs) {
      const lo = from ?? y0 + 0.19, hi = y1 - 0.2;
      if (b2 - a < 0.22 || hi - lo < 0.4) continue;
      const n = Math.max(1, Math.round((b2 - a) / spacing));
      for (let k = 0; k <= n; k++) {
        const x = a + ((b2 - a) * k) / n;
        bw.box(x - T / 2, Y(lo), zf, x + T / 2, Y(hi), zf + P);
      }
      if (b2 - a > 1.5) {                                          // a brace in each wide bay
        for (let k = 0; k < n; k += 3) {
          const xa = a + ((b2 - a) * k) / n, xb = a + ((b2 - a) * Math.min(n, k + 2)) / n;
          bw.beam([xa + 0.1, Y(lo + 0.1), zf + P * 0.6], [xb - 0.1, Y(hi - 0.1), zf + P * 0.6], T, T * 1.1, [0, 0, 1]);
        }
      }
    }
  }

  /**
   * A pitched roof as a slab. axis 'x': the ridge runs along x and the slopes fall to ±z (gable walls at x = ±W/2).
   * axis 'z': the ridge runs along z, the slopes fall to ±x, the gable faces ±z (a gable front). 'pent': one slope.
   */
  function roofSlab(br, bp, { W, D, eaveY, rise, axis = 'x', ov = 0.42, kind = 'tile', gablePart = 1, gableSeed = 0, side = 1 }) {
    const th = kind === 'thatch' ? 0.32 : kind === 'tile' ? 0.17 : 0.14;
    const partR = kind === 'slate' ? 1 : kind === 'thatch' ? 2 : kind === 'shingle' ? 4 : 0;
    const eY = Y(eaveY), aY = Y(eaveY + rise), eYt = Y(eaveY - th), aYt = Y(eaveY + rise - th);
    const slope = (x0, z0, x1, z1, up) => {
      // a slope from the eave line to the ridge line: top surface, underside, and a fascia along the eave
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz, rise);
      const a = [x0, eY, z0], b = [x1, eY, z1], c = [x1, aY, z1 - dz], d = [x0, aY, z0 - dz];
      const a2 = [x0 - dx * 0.02, eYt, z0 - dz * 0.02], b2 = [x1 - dx * 0.02, eYt, z1 - dz * 0.02];
      const c2 = [x1 - dx * 0.02, aYt, z1 - dz - dz * 0.02], d2 = [x0 - dx * 0.02, aYt, z0 - dz - dz * 0.02];
      const uvs = [0, 0, Math.hypot(dx, dz), 0, Math.hypot(dx, dz), L, 0, L];
      br.part(partR, gableSeed);
      if (up) { br.quad(a, b, c, d, uvs); br.part(3, gableSeed).quad(b2, a2, d2, c2, uvs); br.part(3, gableSeed).quad(a, b, b2, a2); }
      else { br.quad(a, d, c, b, uvs); br.part(3, gableSeed).quad(d2, a2, b2, c2, uvs); br.part(3, gableSeed).quad(b, a, a2, b2); }
    };
    if (axis === 'pent') {
      const z1 = side * (D / 2 + ov), z0 = -side * (D / 2 + 0.05);
      slope(-(W / 2 + ov * 0.7), z0, W / 2 + ov * 0.7, z1, side > 0);
    } else if (axis === 'x') {
      const zE = D / 2 + ov, xV = W / 2 + ov * 0.8;
      for (const s of [1, -1]) {
        // the slope falls from the ridge (z = 0) to the eave at z = s·zE
        const a = [-xV, eY, s * zE], b = [xV, eY, s * zE], c = [xV, aY, 0], d = [-xV, aY, 0];
        const a2 = [-xV, eYt, s * (zE - 0.02)], b2 = [xV, eYt, s * (zE - 0.02)];
        const c2 = [xV, aYt, 0], d2 = [-xV, aYt, 0];
        const L = Math.hypot(zE, rise);
        const uv = [0, 0, 2 * xV, 0, 2 * xV, L, 0, L];
        br.part(partR, gableSeed);
        if (s > 0) { br.quad(a, b, c, d, uv); br.part(3, gableSeed).quad(b2, a2, d2, c2, uv); br.part(3, gableSeed).quad(a, b, b2, a2); }
        else { br.quad(b, a, d, c, uv); br.part(3, gableSeed).quad(a2, b2, c2, d2, uv); br.part(3, gableSeed).quad(b, a, a2, b2); }
        for (const sx of [-1, 1]) {
          const p0 = [sx * xV, eY, s * zE], p1 = [sx * xV, aY, 0];
          const q0 = [sx * xV, eYt, s * (zE - 0.02)], q1 = [sx * xV, aYt, 0];
          br.part(3, gableSeed).quad(p0, p1, q1, q0);
        }
      }
      for (const sx of [-1, 1]) {
        const P1 = [sx * (W / 2 + 0.01), eY + 0.02, -D / 2], P2 = [sx * (W / 2 + 0.01), eY + 0.02, D / 2], P3 = [sx * (W / 2 + 0.01), aYt - th * 0.4, 0];
        bp.part(gablePart, gableSeed);
        if (sx > 0) bp.triangle(P1, P3, P2); else bp.triangle(P2, P3, P1);
      }
    } else {   // axis 'z': the ridge runs front to back and the gable faces ±z
      const xE = W / 2 + ov, zV = D / 2 + ov * 0.8;
      for (const s of [1, -1]) {
        const a = [s * xE, eY, -zV], b = [s * xE, eY, zV], c = [0, aY, zV], d = [0, aY, -zV];
        const a2 = [s * (xE - 0.02), eYt, -zV], b2 = [s * (xE - 0.02), eYt, zV];
        const c2 = [0, aYt, zV], d2 = [0, aYt, -zV];
        const L = Math.hypot(xE, rise);
        const uv = [0, 0, 2 * zV, 0, 2 * zV, L, 0, L];
        br.part(partR, gableSeed);
        if (s > 0) { br.quad(b, a, d, c, uv); br.part(3, gableSeed).quad(a2, b2, c2, d2, uv); br.part(3, gableSeed).quad(a, b, b2, a2); }
        else { br.quad(a, b, c, d, uv); br.part(3, gableSeed).quad(b2, a2, d2, c2, uv); br.part(3, gableSeed).quad(b, a, a2, b2); }
        for (const sz of [-1, 1]) {
          const p0 = [s * xE, eY, sz * zV], p1 = [0, aY, sz * zV];
          const q0 = [s * (xE - 0.02), eYt, sz * zV], q1 = [0, aYt, sz * zV];
          br.part(3, gableSeed).quad(p0, p1, q1, q0);
        }
      }
      for (const sz of [-1, 1]) {
        const P1 = [-W / 2, eY + 0.02, sz * (D / 2 + 0.01)], P2 = [W / 2, eY + 0.02, sz * (D / 2 + 0.01)], P3 = [0, aYt - th * 0.4, sz * (D / 2 + 0.01)];
        bp.part(gablePart, gableSeed);
        if (sz > 0) bp.triangle(P1, P3, P2); else bp.triangle(P2, P3, P1);
      }
    }
    // ridge cap
    if (axis === 'x') br.part(3, gableSeed).beam([-W / 2 - ov * 0.8, aY + 0.04, 0], [W / 2 + ov * 0.8, aY + 0.04, 0], kind === 'thatch' ? 0.5 : 0.34, kind === 'thatch' ? 0.3 : 0.16, [0, 1, 0]);
    else if (axis === 'z') br.part(3, gableSeed).beam([0, aY + 0.04, -D / 2 - ov * 0.8], [0, aY + 0.04, D / 2 + ov * 0.8], kind === 'thatch' ? 0.5 : 0.34, kind === 'thatch' ? 0.3 : 0.16, [0, 1, 0]);
  }

  /**
   * A wall in a plane of constant local **X** (so it spans local Z): the side walls of a house, the end walls of
   * the church nave, the east and west walls of the bell tower. Heights are metres above the datum; openings are
   * given as { z0, z1, y0, y1 }. `dir` = -1 grows toward -x (a face looking toward +x).
   *
   * Every one of these used to be built with `wallWith`, which spans X and stands in a Z plane — the result was a
   * slab lying 90° across the building, which is why every house looked like its side wall was turned sideways.
   */
  function wallAlongX(b, { z0, z1, y0, y1, xf, t = 0.34, dir = -1, part = 0, seed = 0, openings = [] }) {
    if (z1 - z0 < 0.05 || y1 - y0 < 0.05) return;
    const xa = Math.min(xf, xf + dir * t), xb = Math.max(xf, xf + dir * t);
    const ops = openings
      .filter((o) => o.z1 > z0 + 0.02 && o.z0 < z1 - 0.02 && o.y1 > y0 + 0.02 && o.y0 < y1 - 0.02)
      .map((o) => ({ z0: Math.max(o.z0, z0), z1: Math.min(o.z1, z1), y0: Math.max(o.y0, y0), y1: Math.min(o.y1, y1) }))
      .sort((a, b2) => a.z0 - b2.z0);
    b.part(part, seed);
    let cur = z0;
    for (const o of ops) {
      if (o.z0 > cur + 0.02) solidBox(b, xa, Y(y0), cur, xb, Y(y1), o.z0);
      if (o.y0 > y0 + 0.02) solidBox(b, xa, Y(y0), o.z0, xb, Y(o.y0), o.z1);
      if (o.y1 < y1 - 0.02) solidBox(b, xa, Y(o.y1), o.z0, xb, Y(y1), o.z1);
      cur = Math.max(cur, o.z1);
    }
    if (cur < z1 - 0.02) solidBox(b, xa, Y(y0), cur, xb, Y(y1), z1);
  }

  /** A window in a constant-X wall (spans Z). `face` = +1 for a face looking toward +x. */
  function fitWindowX(bw, bm, { z, w, sill, h, xf, face = 1, glass = true, shutters = 'open', mullion = true, seed = 0 }) {
    const o = face * 0.05, hw = w / 2;
    bw.part(2, seed).box(xf - face * 0.13, Y(sill - 0.09), z - hw - 0.1, xf + o + 0.07, Y(sill), z + hw + 0.1);
    for (const s of [-1, 1]) bw.part(0, seed).box(xf - face * 0.06, Y(sill), z + s * hw - 0.045, xf + o, Y(sill + h), z + s * hw + 0.045);
    bw.part(0, seed).box(xf - face * 0.06, Y(sill + h - 0.07), z - hw, xf + o, Y(sill + h), z + hw);
    if (mullion) {
      bw.part(0, seed).box(xf - face * 0.04, Y(sill), z - 0.035, xf + o - face * 0.02, Y(sill + h), z + 0.035);
      bw.part(0, seed).box(xf - face * 0.04, Y(sill + h * 0.52), z - hw, xf + o - face * 0.02, Y(sill + h * 0.52 + 0.06), z + hw);
    }
    if (glass) bm.part(5, seed).box(xf - face * 0.03, Y(sill + 0.02), z - hw + 0.02, xf + o - face * 0.05, Y(sill + h - 0.02), z + hw - 0.02);
    else bm.part(4, seed).box(xf - face * 0.2, Y(sill + 0.02), z - hw + 0.02, xf + o - face * 0.05, Y(sill + h - 0.02), z + hw - 0.02);
    if (shutters === 'open') for (const s of [-1, 1]) {
      const sz = z + s * hw;
      bw.part(3, seed).box(xf - face * 0.03, Y(sill - 0.02), sz + (s > 0 ? 0.04 : -0.42), xf + o + 0.03, Y(sill + h), sz + (s > 0 ? 0.46 : -0.04));
      bw.part(0, seed).box(xf + o, Y(sill + h * 0.45), sz + (s > 0 ? 0.04 : -0.42), xf + o + 0.05, Y(sill + h * 0.45 + 0.05), sz + (s > 0 ? 0.46 : -0.04));
    } else if (shutters === 'closed') bw.part(3, seed).box(xf - face * 0.02, Y(sill), z - hw, xf + o + 0.02, Y(sill + h), z + hw);
  }

  /** A door in a constant-X wall (spans Z). */
  function fitDoorX(bw, bm, bp, { z, w, h, sill = 0.35, xf, face = 1, open = false, arch = false, seed = 0 }) {
    const hw = w / 2, o = face * 0.05;
    bp.part(2, seed).box(xf - face * 0.2, Y(sill - 0.16), z - hw - 0.16, xf + o + 0.1, Y(sill), z + hw + 0.16);
    if (arch) {
      for (let k = 0; k < 7; k++) {
        const a0 = Math.PI * (k / 7), a1 = Math.PI * ((k + 1) / 7);
        const R0 = hw + 0.05, R1 = hw + 0.42;
        const A = [z + R0 * Math.cos(a0), Y(sill + h - 0.35 + R0 * Math.sin(a0) * 0.55)];
        const B = [z + R0 * Math.cos(a1), Y(sill + h - 0.35 + R0 * Math.sin(a1) * 0.55)];
        const Cc = [z + R1 * Math.cos(a1), Y(sill + h - 0.35 + R1 * Math.sin(a1) * 0.55)];
        const Dd = [z + R1 * Math.cos(a0), Y(sill + h - 0.35 + R1 * Math.sin(a0) * 0.55)];
        bp.part(2, (k & 1) ? 0.5 : 0.1).quad([xf + o, A[1], A[0]], [xf + o, B[1], B[0]], [xf + o, Cc[1], Cc[0]], [xf + o, Dd[1], Dd[0]]);
      }
    } else {
      bw.part(0, seed).box(xf - face * 0.1, Y(sill + h - 0.16), z - hw - 0.1, xf + o + 0.04, Y(sill + h), z + hw + 0.1);
    }
    for (const s of [-1, 1]) bw.part(0, seed).box(xf - face * 0.08, Y(sill), z + s * hw - 0.05, xf + o, Y(sill + h), z + s * hw + 0.05);
    if (open) {
      const hz = z - hw + 0.06;
      solidBox(bw.part(2, seed), xf, Y(sill + 0.02), hz - 0.05, xf - face * (w - 0.1), Y(sill + h - 0.05), hz + 0.05);
    } else {
      solidBox(bw.part(2, seed), xf - face * 0.1, Y(sill + 0.02), z - hw + 0.04, xf + o - face * 0.02, Y(sill + h - 0.05), z + hw - 0.04);
      for (const s of [-1, 1]) bw.part(0, seed).box(xf + o - face * 0.02, Y(sill + 0.28), z + s * hw * 0.55, xf + o + 0.02, Y(sill + 0.38), z + s * hw * 0.55 + 0.12 * s);
    }
  }

  /** Timber framing on a constant-X face (spans Z). */
  function timberFaceX(bw, { z0, z1, y0, y1, xf, part = 0, seed = 0, openings = [], spacing = 0.82 }) {
    const T = 0.11, P = 0.075;
    bw.part(part, seed);
    bw.box(xf, Y(y0), z0, xf + P, Y(y0 + 0.19), z1);
    bw.box(xf, Y(y1 - 0.2), z0, xf + P, Y(y1), z1);
    const ops = openings.filter((o) => o.z1 > z0 && o.z0 < z1).sort((a, b2) => a.z0 - b2.z0);
    const segs = [];
    let cur = z0;
    for (const o of ops) { if (o.z0 > cur + 0.05) segs.push([cur, o.z0, o.y1 ?? null]); cur = Math.max(cur, o.z1); }
    if (cur < z1 - 0.05) segs.push([cur, z1, null]);
    for (const [a, b2, from] of segs) {
      const lo = from ?? y0 + 0.19, hi = y1 - 0.2;
      if (b2 - a < 0.22 || hi - lo < 0.4) continue;
      const n = Math.max(1, Math.round((b2 - a) / spacing));
      for (let k = 0; k <= n; k++) bw.box(xf, Y(lo), a + ((b2 - a) * k) / n - T / 2, xf + P, Y(hi), a + ((b2 - a) * k) / n + T / 2);
    }
  }

  /** Corbels under a jettied storey. */
  function corbels(bw, { x0, x1, y, zf, n = 5, out = 0.42, seed = 0 }) {
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * (k + 0.5)) / n;
      bw.part(0, seed + k).box(x - 0.09, Y(y - 0.34), zf - 0.06, x + 0.09, Y(y), zf + out * 0.55);
      bw.part(0, seed + k).beam([x, Y(y - 0.3), zf], [x, Y(y - 0.08), zf + out * 0.8], 0.14, 0.14, [0, 1, 0]);
    }
  }

  /** A hanging shop sign on an iron bracket, with a painted emblem built from boxes. */
  function signBoard(bw, bm, { x, y, z, w = 1.5, h = 0.9, face = 1, emblem = null, seed = 0, cloth = false }) {
    const o = face * 0.06;
    bm.part(0, seed).box(x - 0.05, Y(y + h * 0.5), z, x + 0.05, Y(y + h * 0.5 + 0.06), z + face * 0.85);
    bm.part(0, seed).box(x - 0.05, Y(y + 0.1), z + face * 0.78, x + 0.05, Y(y + h * 0.5 + 0.06), z + face * 0.84);
    if (cloth) {
      bw.part(1, seed).box(x - w / 2, Y(y - h), z + face * 0.78, x + w / 2, Y(y + h * 0.35), z + face * 0.84);
      return;
    }
    bw.part(1, seed).box(x - w / 2, Y(y - h), z + face * 0.74, x + w / 2, Y(y + h * 0.35), z + face * 0.82);
    bm.part(8, seed).box(x - w / 2 + 0.06, Y(y - h + 0.06), z + face * 0.82, x + w / 2 - 0.06, Y(y + h * 0.35 - 0.06), z + face * 0.85);
    // emblem (dark on the pale board)
    const ez = z + face * 0.87, ex = x, ey = y - h * 0.35, u = Math.min(w, h * 1.6) * 0.3;
    bm.part(0, seed);
    if (emblem === 'sword') {
      bm.box(ex - 0.045 * u, Y(ey - 1.5 * u), ez, ex + 0.045 * u, Y(ey + 1.7 * u), ez + face * 0.03);
      bm.box(ex - 0.5 * u, Y(ey - 0.1 * u), ez, ex + 0.5 * u, Y(ey + 0.1 * u), ez + face * 0.03);
      bm.box(ex - 0.1 * u, Y(ey - 1.9 * u), ez, ex + 0.1 * u, Y(ey - 1.5 * u), ez + face * 0.03);
    } else if (emblem === 'shield') {
      bm.box(ex - 0.7 * u, Y(ey - 0.5 * u), ez, ex + 0.7 * u, Y(ey + 1.0 * u), ez + face * 0.03);
      bm.box(ex - 0.45 * u, Y(ey - 1.1 * u), ez, ex + 0.45 * u, Y(ey - 0.5 * u), ez + face * 0.03);
      bm.box(ex - 0.12 * u, Y(ey - 1.6 * u), ez, ex + 0.12 * u, Y(ey - 1.1 * u), ez + face * 0.03);
    } else if (emblem === 'bottle') {
      bm.box(ex - 0.5 * u, Y(ey - 1.2 * u), ez, ex + 0.5 * u, Y(ey + 0.4 * u), ez + face * 0.03);
      bm.box(ex - 0.16 * u, Y(ey + 0.4 * u), ez, ex + 0.16 * u, Y(ey + 1.2 * u), ez + face * 0.03);
    } else if (emblem === 'mug') {
      bm.box(ex - 0.42 * u, Y(ey - 0.8 * u), ez, ex + 0.42 * u, Y(ey + 0.9 * u), ez + face * 0.03);
      bm.box(ex + 0.42 * u, Y(ey - 0.35 * u), ez, ex + 0.72 * u, Y(ey + 0.45 * u), ez + face * 0.03);
    } else if (emblem === 'cross') {
      bm.box(ex - 0.14 * u, Y(ey - 1.7 * u), ez, ex + 0.14 * u, Y(ey + 1.5 * u), ez + face * 0.03);
      bm.box(ex - 0.8 * u, Y(ey + 0.3 * u), ez, ex + 0.8 * u, Y(ey + 0.58 * u), ez + face * 0.03);
    }
  }

  // ================================================================================================== props
  function barrel(b, x, z, y, r = 0.36, h = 0.88, seed = 0) {
    localCircle(b, x, z, r * 1.03, y, y + h);
    b.part(1, seed).cyl(x, Y(y), z, r, r * 0.86, h, 9, true);
    b.part(0, seed).cyl(x, Y(y + h * 0.18), z, r * 1.03, r * 1.03, 0.06, 9, false);
    b.part(0, seed).cyl(x, Y(y + h * 0.74), z, r * 0.98, r * 0.98, 0.06, 9, false);
  }
  function crate(b, x, z, y, s = 0.8, seed = 0) {
    solidBox(b.part(4, seed), x - s / 2, Y(y), z - s / 2, x + s / 2, Y(y + s), z + s / 2);
    b.part(1, seed).box(x - s / 2, Y(y + s), z - s / 2, x + s / 2, Y(y + s + 0.05), z + s / 2);
  }
  function sack(bm, x, z, y, s = 0.5, seed = 0) {
    bm.part(6, seed).lathe(x, Y(y), z, [[s * 0.45, 0], [s * 0.5, s * 0.3], [s * 0.42, s * 0.8], [s * 0.2, s * 1.05], [0.03, s * 1.2]], 7);
  }
  function lanternPost(b, bm, x, z, y, h = 3.1, seed = 0) {
    bm.part(0, seed).cyl(x, Y(y), z, 0.07, 0.06, h, 6, false);
    bm.part(0, seed).box(x - 0.24, Y(y + h), z - 0.24, x + 0.24, Y(y + h + 0.08), z + 0.24);
    bm.part(5, seed).box(x - 0.17, Y(y + h + 0.08), z - 0.17, x + 0.17, Y(y + h + 0.42), z + 0.17);
    bm.part(0, seed).box(x - 0.22, Y(y + h + 0.42), z - 0.22, x + 0.22, Y(y + h + 0.5), z + 0.22);
    bm.part(9, seed).lathe(x, Y(y + h + 0.52), z, [[0.13, 0], [0.17, 0.16], [0.1, 0.34], [0.03, 0.48]], 7);
    return { x, y: y + h + 0.2, z };
  }
  function torchBracket(b, bm, x, y, z, face = 1, seed = 0) {
    bm.part(0, seed).box(x - 0.05, Y(y), z, x + 0.05, Y(y + 0.06), z + face * 0.42);
    bm.part(0, seed).box(x - 0.05, Y(y - 0.3), z + face * 0.34, x + 0.05, Y(y), z + face * 0.4);
    bm.part(10, seed).lathe(x, Y(y + 0.02), z + face * 0.34, [[0.11, 0], [0.15, 0.14], [0.09, 0.3], [0.03, 0.42]], 7);
  }
  /** A tent: the canvas is striped awning cloth (misc part 2), the pole iron, the ropes sackcloth. */
  function tent(bm, x, z, y, r, h, seed = 0, stripe = true) {
    bm.part(0, seed).cyl(x, Y(y), z, 0.06, 0.05, h + 0.35, 5, false);                 // centre pole
    bm.part(stripe ? 11 : 6, seed).lathe(x, Y(y), z, [[r * 0.98, 0], [r * 0.86, h * 0.2], [r * 0.5, h * 0.72], [r * 0.16, h]], 8);
    for (let k = 0; k < 5; k++) {                                                     // guy ropes + pegs
      const a = (k / 5) * Math.PI * 2 + 0.4;
      bm.part(6, seed).beam([x + Math.cos(a) * r * 0.95, Y(y + 0.02), z + Math.sin(a) * r * 0.95], [x + Math.cos(a) * r * 1.5, Y(y), z + Math.sin(a) * r * 1.5], 0.03, 0.03, [0, 1, 0]);
    }
    bm.part(1, seed).box(x - r * 0.2, Y(y), z + r * 0.86, x + r * 0.2, Y(y + h * 0.55), z + r * 0.94);   // door flap
    bm.part(0, seed).cyl(x, Y(y + h), z, 0.02, 0.02, 0.6, 4, false);
  }
  /** A practice dummy: a timber post with a straw body and a crossbar. */
  function dummy(bw, bm, x, z, y, seed = 0) {
    localBox(bw, x, z, 0.55, 0.22, 0, y, y + 1.85);
    bw.part(4, seed).cyl(x, Y(y), z, 0.11, 0.09, 1.5, 6, false);
    bw.part(4, seed).box(x - 0.55, Y(y + 1.05), z - 0.07, x + 0.55, Y(y + 1.17), z + 0.07);
    bm.part(3, seed).box(x - 0.3, Y(y + 1.25), z - 0.22, x + 0.3, Y(y + 1.85), z + 0.22);
    bm.part(6, seed).box(x - 0.34, Y(y + 1.5), z - 0.1, x + 0.34, Y(y + 1.56), z + 0.1);
  }
  /** An archery butt: an upright straw block on timber legs, with a painted bull facing the yard. */
  function target(bw, bm, x, z, y, seed = 0) {
    localBox(bw, x, z, 0.58, 0.35, 0, y, y + 1.6);
    const h = 1.5, w = 1.15, t = 0.42;
    for (const s of [-1, 1]) {
      bw.part(4, seed).cyl(x + s * 0.5, Y(y), z + s * 0.28, 0.07, 0.06, 1.35, 5, false);
      bw.part(4, seed).cyl(x + s * 0.5, Y(y), z - s * 0.28, 0.07, 0.06, 1.35, 5, false);
    }
    bm.part(3, seed).obox([x, Y(y + 0.85), z], [1, 0, 0], [0, 1, 0], [0, 0, 1], w / 2, h / 2, t / 2);
    bm.part(8, seed).obox([x, Y(y + 0.85), z - t / 2 - 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.44, 0.44, 0.02);
    bm.part(1, seed).obox([x, Y(y + 0.85), z - t / 2 - 0.05], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.24, 0.24, 0.02);
    bm.part(0, seed).obox([x, Y(y + 0.85), z - t / 2 - 0.07], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.07, 0.07, 0.02);
  }
  function weaponRack(bw, x, z, y, yaw = 0, n = 5, seed = 0) {
    localBox(bw, x, z, 1.17, 0.1, yaw, y, y + 1.85);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const k of [-1, 1]) bw.part(4, seed).cyl(x + k * 1.1 * c, Y(y), z - k * 1.1 * s, 0.07, 0.06, 1.3, 5, false);
    bw.part(1, seed).beam([x - 1.1 * c, Y(y + 1.1), z + 1.1 * s], [x + 1.1 * c, Y(y + 1.1), z - 1.1 * s], 0.1, 0.12, [0, 1, 0]);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5, px = x + t * 2.2 * c, pz = z - t * 2.2 * s;
      bw.part(0, seed + k).cyl(px, Y(y + 0.15), pz, 0.035, 0.03, 1.5 + 0.2 * ((k & 1) ? 1 : 0), 5, false);
    }
  }
  function shieldRack(bw, bm, x, z, y, yaw = 0, n = 3, seed = 0) {
    localBox(bw, x, z, 1.25, 0.18, yaw, y, y + 2.0);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    bw.part(4, seed).cyl(x, Y(y), z, 0.09, 0.08, 2.0, 6, false);
    bw.part(1, seed).beam([x - 1.2 * c, Y(y + 1.8), z + 1.2 * s], [x + 1.2 * c, Y(y + 1.8), z - 1.2 * s], 0.1, 0.1, [0, 1, 0]);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5, px = x + t * 2.2 * c, pz = z - t * 2.2 * s;
      bm.part(1, seed + k).cyl(px, Y(y + 1.05), pz, 0.42, 0.4, 0.14, 10, true);
      bm.part(5, seed + k).cyl(px, Y(y + 1.2), pz, 0.09, 0.08, 0.1, 8, true);
    }
  }
  function grindstone(bs, bw, x, z, y, seed = 0) {
    localCircle(bw, x, z, 0.45, y, y + 0.91);
    bw.part(4, seed).cyl(x, Y(y), z, 0.1, 0.08, 0.75, 6, false);
    bs.part(2, seed).cyl(x, Y(y + 0.75), z, 0.45, 0.45, 0.16, 14, true);
    bw.part(1, seed).box(x - 0.14, Y(y + 0.35), z - 0.5, x + 0.14, Y(y + 0.42), z + 0.5);
  }
  function cauldron(bm, x, z, y, r = 0.42, seed = 0) {
    localCircle(bm, x, z, r * 1.02, y, y + 0.85);
    bm.part(9, seed).lathe(x, Y(y + 0.35), z, [[r * 0.75, 0], [r, 0.1], [r * 1.02, 0.3], [r * 0.9, 0.45], [r * 0.5, 0.5]], 10);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; bm.part(0, seed).cyl(x + Math.cos(a) * r * 0.6, Y(y), z + Math.sin(a) * r * 0.6, 0.035, 0.03, 0.36, 4, false); }
    bm.part(7, seed).cyl(x, Y(y + 0.4), z, r * 0.85, r * 0.85, 0.04, 10, true);
  }
  function firePit(b, bm, x, z, y, r = 1.1, seed = 0) {
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; bs_(b, x + Math.cos(a) * r, z + Math.sin(a) * r, y, 0.16 + (k % 3) * 0.03, seed + k); }
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 2.4; bwBeam(b, x, z, y, a, 0.9, seed + k); }
    bm.part(10, seed).lathe(x, Y(y + 0.1), z, [[0.34, 0], [0.42, 0.3], [0.24, 0.72], [0.06, 1.05]], 7);
    return { x, y: y + 0.5, z };
  }
  const bs_ = (b, x, z, y, r, seed) => b.part(1, seed).cyl(x, Y(y), z, r, r * 0.9, 0.16, 6, true);
  const bwBeam = (b, x, z, y, a, len, seed) => b.part(0, seed).beam([x - Math.cos(a) * len * 0.3, Y(y), z - Math.sin(a) * len * 0.3], [x + Math.cos(a) * len * 0.5, Y(y + 0.2), z + Math.sin(a) * len * 0.5], 0.11, 0.11, [0, 1, 0]);

  // ================================================================================================== the house
  /**
   * spec: { W, D, st, H1, H2, jet, roof, axis, rise, stone, doorAt, doorOpen, doorArch, windows, upperWindows,
   *         sideWindows, shutters, shop, bay, seed, sign, lit }
   */
  function build(spec, cx, cz, yaw) {
    const W = spec.W, D = spec.D, st = spec.st ?? 2;
    const H1 = spec.H1 ?? 3.0, H2 = spec.H2 ?? 2.55;
    const hw = W / 2, hd = D / 2;
    const seed = spec.seed ?? rnd();
    const gmin = groundMin(cx - hw - 0.4, cz - hd - 0.4, cx + hw + 0.4, cz + hd + 0.4, 3);
    const fh = Y(0) - gmin + 0.55;                       // the footing reaches below the lowest ground
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const bs = K.s, bw = K.w, bp = K.p, br = K.r, bm = K.m;
    const jet = spec.jet ? 0.5 : 0;
    const jx = spec.jet ? 0.14 : 0;
    const enterable = spec.flush || spec.doorOpen === true;
    const wallT = 0.34, floorY = enterable ? 0 : 0.35;
    const shopBay = spec.shop ? { w: spec.bay ?? 2.9, h: spec.bayH ?? 2.15 } : null;

    // ---- foundation, floor
    const doorX = spec.doorAt ?? -hw * 0.35;
    const dW = spec.doorW ?? 1.05, dH = spec.doorH ?? (enterable ? 2.4 : 2.05);
    if (enterable) {
      // an enterable building: the inside floor sits on the ground (the player walks straight in) and the stone
      // plinth is a skirt round the outside, broken at the doorway
      const dp = doorX, dw2 = dW / 2;
      bs.part(1, seed).box(-hw - 0.3, Y(0) - 0.6, -hd - 0.3, hw + 0.3, Y(0.26), -hd - 0.02);            // back skirt
      bs.part(1, seed).box(-hw - 0.3, Y(0) - 0.6, -hd, -hw + 0.02, Y(0.26), hd + 0.3);             // left skirt
      bs.part(1, seed).box(hw - 0.02, Y(0) - 0.6, -hd, hw + 0.3, Y(0.26), hd + 0.3);              // right skirt
      bs.part(1, seed).box(-hw - 0.3, Y(0) - 0.6, hd, dp - dw2 - 0.3, Y(0.26), hd + 0.3);              // front-left
      bs.part(1, seed).box(dp + dw2 + 0.3, Y(0) - 0.6, hd, hw + 0.3, Y(0.26), hd + 0.3);               // front-right
      bs.part(2, seed).box(dp - dw2 - 0.1, Y(0) - 0.05, hd + 0.02, dp + dw2 + 0.1, Y(0.09), hd + 0.6);  // threshold
      // (the floor itself is the same cobbled paving as the street: levels/citadel.js floors these footprints)
    } else {
      bs.part(1, seed).box(-hw - 0.24, Y(0) - fh, -hd - 0.24, hw + 0.24, Y(0.42), hd + 0.24);
      bs.part(0, seed).box(-hw - 0.02, Y(0.34), -hd - 0.02, hw + 0.02, Y(floorY + 0.1), hd + 0.02);
    }
    // ---- ground storey: four walls with real openings
    const gWins = [];
    const nWin = spec.windows ?? Math.max(1, Math.round((W - 2.6) / 2.4));
    for (let k = 0; k < nWin; k++) {
      const x = nWin === 1 ? hw * 0.45 : -hw + 1.5 + ((W - 3.0) * k) / (nWin - 1);
      if (spec.shop) { if (Math.abs(x - doorX) < 0.9) continue; }
      else if (Math.abs(x - doorX) < 1.1) continue;
      gWins.push({ x, w: 0.85, h: 1.0, sill: 1.25 });
    }
    const front = [];
    front.push({ x0: doorX - dW / 2, x1: doorX + dW / 2, y0: floorY, y1: floorY + dH });
    for (const w of gWins) front.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, y0: Y0(w.sill), y1: Y0(w.sill + w.h) });
    const bay = shopBay;
    if (bay) front.push({ x0: doorX + 2.35 - bay.w / 2, x1: doorX + 2.35 + bay.w / 2, y0: Y0(0.95), y1: Y0(0.95 + bay.h) });
    const mat = spec.stone ? bs : bp;
    const wallPart = spec.stone ? 4 : (spec.daub ? 1 : 0);
    const y1g = H1 + 0.2;
    wallWith(mat, { x0: -hw, x1: hw, y0: floorY, y1: y1g, zf: hd, dir: -1, part: wallPart, seed, openings: front });
    wallWith(mat, { x0: -hw, x1: hw, y0: floorY, y1: y1g, zf: -hd, dir: 1, part: wallPart, seed, openings: [{ x0: -0.6, x1: 0.6, y0: Y0(1.5), y1: Y0(2.4) }] });
    const sideOps = (n) => {                                       // openings in a SIDE wall: they span local z
      const out = [];
      for (let k = 0; k < n; k++) {
        const z = -hd + 1.6 + ((D - 3.2) * k) / Math.max(1, n - 1);
        out.push({ z0: z - 0.42, z1: z + 0.42, y0: 1.3, y1: 2.3 });
      }
      return out;
    };
    wallAlongX(mat, { z0: -hd, z1: hd, y0: floorY, y1: y1g, xf: hw, dir: -1, part: wallPart, seed: seed + 1, openings: sideOps(D > 5 ? 2 : 1) });
    wallAlongX(mat, { z0: -hd, z1: hd, y0: floorY, y1: y1g, xf: -hw, dir: 1, part: wallPart, seed: seed + 2, openings: sideOps(D > 5 ? 2 : 1) });
    void wallT;
    // fittings
    fitDoor(bw, bm, bs, { x: doorX, w: dW, h: dH, sill: floorY, zf: hd, open: spec.doorOpen ?? false, arch: spec.doorArch, seed });
    for (const w of gWins) fitWindow(bw, bm, { x: w.x, w: w.w, h: w.h, sill: w.sill, zf: hd, glass: rnd() < 0.55, shutters: spec.shutters ?? (rnd() < 0.6 ? 'open' : 'closed'), seed });
    for (const sx of [1, -1]) {
      for (const o of sideOps(D > 5 ? 2 : 1)) {
        fitWindowX(bw, bm, { z: (o.z0 + o.z1) / 2, w: 0.8, h: 0.95, sill: 1.35, xf: sx * hw, face: sx, glass: rnd() < 0.5, shutters: rnd() < 0.5 ? 'open' : 'closed', seed: seed + 3 });
      }
    }
    if (spec.shop && bay) {
      // shopfront: heavy lintel, mullion posts, a counter board and a pent awning
      const bx = doorX + 2.35, bz = hd;
      bw.part(0, seed).box(bx - bay.w / 2 - 0.2, Y(0.95 + bay.h), bz - 0.1, bx + bay.w / 2 + 0.2, Y(0.95 + bay.h + 0.24), bz + 0.14);
      for (const s of [-1, 1]) bw.part(1, seed).box(bx + s * (bay.w / 2 - 0.06), Y(0.95), bz - 0.05, bx + s * (bay.w / 2 + 0.06), Y(0.95 + bay.h), bz + 0.1);
      bw.part(1, seed).box(bx - bay.w / 2 - 0.1, Y(0.86), bz - 0.05, bx + bay.w / 2 + 0.1, Y(0.98), bz + 0.55);
      for (const s of [-1, 1]) bw.part(0, seed).box(bx + s * (bay.w / 2 - 0.12), Y(0.5), bz + 0.3, bx + s * (bay.w / 2 - 0.02), Y(0.9), bz + 0.48);
      // pent awning over the bay
      roofSlab(br, bp, { W: bay.w + 0.5, D: 1.6, eaveY: 0.95 + bay.h + 0.2, rise: 0.75, axis: 'pent', ov: 0.12, kind: spec.awning ?? 'shingle', side: 1 });
      br.frame(cx, 0, cz, yaw);
    }
    // timber framing over the plaster faces (never across an opening)
    if (!spec.stone) {
      timberFace(bw, { x0: -hw + 0.08, x1: hw - 0.08, y0: floorY, y1: H1 + 0.1, zf: hd, seed, openings: front });
      timberFace(bw, { x0: -hw + 0.08, x1: hw - 0.08, y0: floorY, y1: H1 + 0.1, zf: -hd - 0.1, seed: seed + 1, openings: [] });
    }
    // ---- upper storey (jettied over the street)
    let eaveY = H1 + 0.1;
    if (st > 1) {
      const fz = hd + jet, xw = hw + jx;
      const uY0 = H1 + 0.1, uY1 = H1 + 0.1 + H2;
      // the floor slab over the ground storey (also the ground floor's ceiling)
      solidBox(bp.part(1, seed), -xw - 0.02, Y(uY0 - 0.18), -hd - jx - 0.02, xw + 0.02, Y(uY0), fz + 0.02);
      if (jet) { corbels(bw, { x0: -hw + 0.2, x1: hw - 0.2, y: uY0, zf: hd, n: Math.max(3, Math.round(W / 1.7)), seed }); bw.part(0, seed).box(-xw, Y(uY0 - 0.14), hd - 0.02, xw, Y(uY0), fz + 0.04); }
      const uWins = [];
      const nU = Math.max(1, Math.round(W / 2.3));
      for (let k = 0; k < nU; k++) {
        const x = nU === 1 ? 0 : -xw + 1.1 + ((2 * xw - 2.2) * k) / (nU - 1);
        uWins.push({ x, w: 0.82, h: 1.12 });
      }
      const uFront = uWins.map((w) => ({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, y0: Y0(uY0 + 0.75), y1: Y0(uY0 + 0.75 + w.h) }));
      wallWith(spec.stone ? bs : bp, { x0: -xw, x1: xw, y0: uY0, y1: uY1 + 0.2, zf: fz, dir: -1, part: wallPart, seed: seed + 5, openings: uFront });
      wallWith(spec.stone ? bs : bp, { x0: -xw, x1: xw, y0: uY0, y1: uY1 + 0.2, zf: -hd - jx, dir: 1, part: wallPart, seed: seed + 6, openings: [] });
      const uSide = () => {
        const out = [];
        for (let k = 0; k < (D > 5 ? 2 : 1); k++) {
          const z = -hd + 1.7 + ((D - 3.4) * k) / Math.max(1, (D > 5 ? 2 : 1) - 1);
          out.push({ z0: z - 0.42, z1: z + 0.42, y0: uY0 + 0.8, y1: uY0 + 1.85 });
        }
        return out;
      };
      wallAlongX(spec.stone ? bs : bp, { z0: -hd - jx, z1: hd + jx, y0: uY0, y1: uY1 + 0.2, xf: xw, dir: -1, part: wallPart, seed: seed + 7, openings: uSide() });
      wallAlongX(spec.stone ? bs : bp, { z0: -hd - jx, z1: hd + jx, y0: uY0, y1: uY1 + 0.2, xf: -xw, dir: 1, part: wallPart, seed: seed + 8, openings: uSide() });
      for (const sx of [1, -1]) for (const o of uSide()) fitWindowX(bw, bm, { z: (o.z0 + o.z1) / 2, w: 0.82, h: 1.05, sill: uY0 + 0.8, xf: sx * xw, face: sx, glass: rnd() < 0.6, shutters: rnd() < 0.5 ? 'open' : 'closed', seed: seed + 11 });
      if (!spec.stone) { timberFaceX(bw, { z0: -hd - jx + 0.1, z1: hd + jx - 0.1, y0: uY0, y1: uY1 - 0.1, xf: xw + 0.01, seed: seed + 12, openings: uSide() }); timberFaceX(bw, { z0: -hd - jx + 0.1, z1: hd + jx - 0.1, y0: uY0, y1: uY1 - 0.1, xf: -xw - 0.085, seed: seed + 13, openings: uSide() }); }
      for (const w of uWins) fitWindow(bw, bm, { x: w.x, w: w.w, h: w.h, sill: uY0 + 0.75, zf: fz, glass: rnd() < 0.7, shutters: rnd() < 0.45 ? 'open' : 'closed', seed: seed + 9 });
      if (!spec.stone) timberFace(bw, { x0: -xw + 0.08, x1: xw - 0.08, y0: uY0, y1: uY1, zf: fz + 0.01, seed: seed + 10, openings: uFront });
      eaveY = uY1 + 0.1;
    }
    // ---- roof
    const rise = spec.rise ?? R(2.3, 3.1);
    const axis = spec.axis ?? (rnd() < 0.5 ? 'z' : 'x');
    roofSlab(br, bp, { W: W + (st > 1 ? jx * 2 : 0), D: D + (st > 1 ? jet : 0), eaveY, rise, axis, ov: 0.46, kind: spec.roof ?? 'tile', gablePart: spec.stone ? 4 : 1, gableSeed: seed });
    // ---- chimney on the slope
    if (spec.chim !== false) {
      const chx = (spec.chimAt ?? (rnd() < 0.5 ? -1 : 1)) * (hw - 0.6);
      const base = eaveY + rise * (axis === 'x' ? 0.55 : 0.5);
      bs.part(1, seed).box(chx - 0.34, Y(base - 0.3), -0.34, chx + 0.34, Y(eaveY + rise + 1.05), 0.34);
      bs.part(2, seed).box(chx - 0.44, Y(eaveY + rise + 1.05), -0.44, chx + 0.44, Y(eaveY + rise + 1.25), 0.44);
      bm.part(4, seed).box(chx - 0.2, Y(eaveY + rise + 1.25), -0.2, chx + 0.2, Y(eaveY + rise + 1.3), 0.2);
    }
    // ---- sign
    if (spec.sign) signBoard(bw, bm, { x: spec.signAt ?? (hw - 1.1), y: H1 + 0.6, z: hd + jet, emblem: spec.sign, seed, cloth: spec.signCloth });
    // ---- lit window for the dusk bake
    if (spec.lit !== false) lightSrc.push({ x: cx + Math.sin(yaw) * (hd - 0.2), z: cz + Math.cos(yaw) * (hd - 0.2), h: 1.9, i: 1.3 });
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.houses++; if (spec.shop) stats.shops++;
    return { eaveY, hw, hd, seed };
  }
  const Y0 = (v) => v;                                   // heights in this kit are already absolute-ish via Y()

  // ================================================================================================== buildings
  function house(spec, cx, cz, yaw) { return build(spec, cx, cz, yaw); }

  /**
   * A shop: an enterable building — flush floor, a stone plinth broken at the doorway, an interior behind a
   * counter (where the keeper stands) and the trade's own fittings inside and out. Returns the descriptor the
   * RPG layer (ui/shop.js) needs: the keeper's spot, the door and the shop's own frame.
   */
  function shop(kind, cx, cz, yaw, spec = {}) {
    reserve(cx - 4.8, cz - 5.8, cx + 4.8, cz + 6.2);              // the shop plot (footprint + the wares outside)
    const s = {
      W: spec.W ?? 7.4, D: 9.2, st: spec.st ?? 2, jet: true, roof: spec.roof ?? 'tile',
      axis: spec.axis ?? 'z', shop: true, sign: kind === 'weapon' ? 'sword' : kind === 'armour' ? 'shield' : 'bottle',
      doorAt: -1.9, doorW: 1.5, doorH: 2.5, doorOpen: true, windows: 0, rise: 2.7, seed: spec.seed, flush: true,
      ...spec,
    };
    const b = build(s, cx, cz, yaw);
    // wares outside, in the shop's own frame
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const bs = K.s, bw = K.w, bm = K.m, bp = K.p;
    const bz = b.hd + 0.55, bx = s.doorAt + 2.35;
    if (kind === 'weapon') {
      weaponRack(bw, bx - 1.4, bz - 0.3, 0.35, Math.PI / 2, 5, b.seed);
      grindstone(bs, bw, bx + 1.5, bz - 0.2, 0.35, b.seed);
      barrel(bw, bx + 0.2, bz + 0.75, 0.35, 0.3, 0.7, b.seed);
      for (let k = 0; k < 6; k++) bw.part(4, b.seed + k).cyl(bx + 0.2 + Math.cos(k * 1.1) * 0.16, Y(0.35 + 0.7), bz + 0.75 + Math.sin(k * 1.1) * 0.16, 0.022, 0.022, 0.85, 4, false);
    } else if (kind === 'armour') {
      shieldRack(bw, bm, bx - 1.3, bz - 0.2, 0.35, Math.PI / 2, 3, b.seed);
      // a breastplate and a helm on a stand
      bw.part(4, b.seed).cyl(bx + 1.3, Y(0.35), bz - 0.1, 0.09, 0.08, 1.35, 6, false);
      bm.part(8, b.seed).box(bx + 1.04, Y(1.35), bz - 0.32, bx + 1.56, Y(2.05), bz + 0.12);
      bm.part(8, b.seed).box(bx + 1.1, Y(2.05), bz - 0.26, bx + 1.5, Y(2.3), bz + 0.06);
      bm.part(0, b.seed + 3).box(bx + 1.16, Y(1.75), bz + 0.12, bx + 1.44, Y(1.82), bz + 0.2);
      for (let k = 0; k < 3; k++) barrel(bw, bx - 0.3 + k * 0.75, bz + 0.7, 0.35, 0.32, 0.8, b.seed + k);
    } else {
      // apothecary: shelves of jars, a mortar, hanging herbs, a cauldron
      cauldron(bm, bx + 1.35, bz - 0.1, 0.35, 0.4, b.seed);
      for (let k = 0; k < 7; k++) {
        const x = bx - 1.5 + k * 0.5;
        bm.part(k % 3 === 0 ? 5 : 8, b.seed + k).cyl(x, Y(0.95), bz + 0.32, 0.1 + 0.02 * (k % 3), 0.09, 0.26 + 0.05 * (k % 2), 7, true);
      }
      for (let k = 0; k < 5; k++) bp.part(5, b.seed + k * 2).lathe(bx - 0.9 + k * 0.45, Y(2.5), bz + 0.5, [[0.03, 0.42], [0.11, 0.3], [0.13, 0.05], [0.09, 0]], 6);
      barrel(bw, bx - 1.5, bz + 0.9, 0.35, 0.3, 0.75, b.seed + 4);
    }
    // ---- the interior: counter, back shelves, a rug, a hanging lantern and the trade's own fittings
    const cxp = s.doorAt + 1.9;                       // the counter sits across the room, a step inside the door
    const czp = b.hd - 2.5;
    solidBox(bw.part(1, b.seed), cxp - 1.7, Y(0.04), czp - 0.32, cxp + 1.7, Y(1.02), czp + 0.32);      // counter
    solidBox(bw.part(0, b.seed), cxp - 1.76, Y(1.02), czp - 0.4, cxp + 1.76, Y(1.14), czp + 0.4);      // counter top
    bm.part(1, b.seed).box(cxp - 1.7, Y(0.34), czp - 0.34, cxp + 1.7, Y(1.0), czp - 0.29);       // cloth front
    bp.part(1, b.seed).box(-b.hw + 1.2, Y(0.04), czp - 0.9, b.hw - 1.2, Y(0.07), czp + 1.6);    // rug
    torchBracket(bw, bm, cxp, 2.35, -0.05, 1, b.seed + 2);
    lightSrc.push({ x: cx + Math.cos(yaw) * cxp - Math.sin(yaw) * 0, z: cz - Math.sin(yaw) * cxp, h: 2.2, i: 2.6 });
    for (let k = 0; k < 3; k++) {                                                                 // back shelves
      bw.part(1, b.seed + k).box(-b.hw + 1.3, Y(0.55 + k * 0.55), -b.hd + 0.45, b.hw - 1.3, Y(0.62 + k * 0.55), -b.hd + 1.0);
      bw.part(0, b.seed + k).box(-b.hw + 1.3, Y(0.5 + k * 0.55), -b.hd + 0.42, -b.hw + 1.36, Y(1.75), -b.hd + 1.03);
      bw.part(0, b.seed + k).box(b.hw - 1.36, Y(0.5 + k * 0.55), -b.hd + 0.42, b.hw - 1.3, Y(1.75), -b.hd + 1.03);
    }
    if (kind === 'weapon') {
      weaponRack(bw, -b.hw + 1.6, -b.hd + 2.2, 0.04, 0, 4, b.seed);                              // rack on the floor
      for (let k = 0; k < 3; k++) {                                                              // blades on the shelves
        const x = -1.5 + k * 1.5;
        bw.part(0, b.seed + k).box(x - 0.06, Y(0.62), -b.hd + 0.5, x + 0.06, Y(1.65), -b.hd + 0.62);
        bw.part(0, b.seed + k).box(x - 0.34, Y(1.0), -b.hd + 0.5, x + 0.34, Y(1.08), -b.hd + 0.62);
      }
      grindstone(bs, bw, b.hw - 1.8, -b.hd + 2.4, 0.04, b.seed + 5);
      for (let k = 0; k < 4; k++) bw.part(4, b.seed + k).cyl(b.hw - 1.6, Y(0.9), -b.hd + 1.0, 0.03, 0.03, 1.1 + 0.15 * k, 4, false);
    } else if (kind === 'armour') {
      for (let k = 0; k < 2; k++) {                                                              // two armour stands
        const x = -1.6 + k * 1.5;
        bw.part(4, b.seed + k).cyl(x, Y(0.04), -b.hd + 1.9, 0.1, 0.09, 1.3, 6, false);
        bm.part(8, b.seed + k).box(x - 0.3, Y(1.34), -b.hd + 1.62, x + 0.3, Y(2.06), -b.hd + 2.16);
        bm.part(8, b.seed + k).box(x - 0.24, Y(2.06), -b.hd + 1.68, x + 0.24, Y(2.32), -b.hd + 2.1);
        bm.part(0, b.seed + k).box(x - 0.26, Y(1.76), -b.hd + 2.16, x + 0.26, Y(1.84), -b.hd + 2.22);
      }
      for (let k = 0; k < 4; k++) bm.part(1, b.seed + k).cyl(b.hw - 1.5, Y(0.72 + Math.floor(k / 2) * 0.6), -b.hd + 0.85, 0.34, 0.32, 0.1, 10, true);
      for (let k = 0; k < 3; k++) bw.part(1, b.seed + k).box(-b.hw + 1.5, Y(0.04), -b.hd + 1.3 + k * 0.5, -b.hw + 2.6, Y(0.5 + k * 0.1), -b.hd + 1.7 + k * 0.5);
    } else {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {                                   // jars on the shelves
        const x = -b.hw + 1.7 + k * 0.75;
        bm.part((k + r) % 3 === 0 ? 5 : 8, b.seed + r * 5 + k).cyl(x, Y(0.62 + r * 0.55), -b.hd + 0.72, 0.11, 0.1, 0.2 + 0.06 * ((k + r) % 2), 7, true);
      }
      cauldron(bm, b.hw - 1.9, -b.hd + 1.9, 0.04, 0.42, b.seed + 7);
      for (let k = 0; k < 5; k++) bp.part(5, b.seed + k).lathe(-1.2 + k * 0.6, Y(2.45), -b.hd + 1.4, [[0.03, 0.42], [0.11, 0.3], [0.13, 0.05], [0.09, 0]], 6);
      bw.part(1, b.seed).box(-b.hw + 1.4, Y(0.04), -b.hd + 1.5, -b.hw + 2.7, Y(0.82), -b.hd + 2.4);   // work table
      for (let k = 0; k < 4; k++) bm.part(8, b.seed + k).cyl(-b.hw + 1.7 + k * 0.3, Y(0.82), -b.hd + 1.95, 0.075, 0.07, 0.18, 6, true);
    }
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    return {
      kind, cx, cz, yaw, seed: b.seed, hw: b.hw, hd: b.hd, doorAt: s.doorAt, doorW: s.doorW,
      // the keeper stands behind the counter, facing the doorway
      keeper: { x: cx + Math.cos(yaw) * cxp + Math.sin(yaw) * (czp - 1.15), z: cz - Math.sin(yaw) * cxp + Math.cos(yaw) * (czp - 1.15), yaw },
      door: { x: cx + Math.cos(yaw) * s.doorAt + Math.sin(yaw) * (b.hd + 1.2), z: cz - Math.sin(yaw) * s.doorAt + Math.cos(yaw) * (b.hd + 1.2) },
    };
  }

  /** The tavern: two storeys, a wide arched door, a big mug sign, benches and barrels outside, a stable wing. */
  function tavern(cx, cz, yaw = 0, spec = {}) {
    reserve(cx - 8, cz - 6.5, cx + 8, cz + 13.5);                // hall, courtyard and the stable wing behind
    const s = { W: 13.5, D: 10.5, st: 2, jet: true, roof: 'tile', axis: 'x', rise: 3.3, doorAt: -2.6, doorW: 1.5, doorH: 2.3, doorOpen: true, doorArch: true, windows: 2, H1: 3.3, H2: 2.8, ...spec };
    const b = build(s, cx, cz, yaw);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const bw = K.w, bm = K.m, bp = K.p, bs = K.s;
    // a big cloth sign with a mug, a lantern over the door, benches and a table
    signBoard(bw, bm, { x: b.hw - 1.6, y: s.H1 + 0.9, z: b.hd + 0.5, w: 2.0, h: 1.2, emblem: 'mug', seed: b.seed, cloth: false });
    torchBracket(bw, bm, s.doorAt + 1.2, s.H1 + 0.2, b.hd, 1, b.seed);
    lightSrc.push({ x: cx + Math.sin(yaw) * (b.hd + 0.4) + Math.cos(yaw) * (s.doorAt + 1.2), z: cz + Math.cos(yaw) * (b.hd + 0.4) - Math.sin(yaw) * (s.doorAt + 1.2), h: 3.6, i: 4.2 });
    for (const [bx, bz] of [[2.6, 1.5], [3.9, 1.5], [-4.2, 1.6]]) {
      // trestle table and benches
      bw.part(1, b.seed).box(bx - 1.1, Y(0.72), bz - 0.5, bx + 1.1, Y(0.84), bz + 0.5);
      for (const [dx, dz] of [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]]) bw.part(4, b.seed).cyl(bx + dx, Y(0), bz + dz, 0.06, 0.05, 0.72, 5, false);
      for (const s2 of [-1, 1]) { bw.part(1, b.seed).box(bx - 1.0, Y(0.44), bz + s2 * 0.75 - 0.16, bx + 1.0, Y(0.52), bz + s2 * 0.75 + 0.16); for (const dx of [-0.85, 0.85]) bw.part(4, b.seed).cyl(bx + dx, Y(0), bz + s2 * 0.75, 0.05, 0.045, 0.44, 5, false); }
    }
    for (let k = 0; k < 5; k++) barrel(bw, -b.hw + 1.2 + k * 0.78, b.hd + 1.1, 0.35, 0.34, 0.86, b.seed + k);
    for (let k = 0; k < 3; k++) barrel(bw, -b.hw + 1.4 + k * 0.78, b.hd + 1.1, 1.21, 0.3, 0.72, b.seed + 8 + k);
    // stable wing behind, with a fenced yard
    K.w.frame(cx + Math.cos(yaw) * (b.hd + 5.2), 0, cz - Math.sin(yaw) * (b.hd + 5.2), yaw);
    K.s.frame(cx + Math.cos(yaw) * (b.hd + 5.2), 0, cz - Math.sin(yaw) * (b.hd + 5.2), yaw);
    K.r.frame(cx + Math.cos(yaw) * (b.hd + 5.2), 0, cz - Math.sin(yaw) * (b.hd + 5.2), yaw);
    const sw = 9, sd = 5;
    K.s.part(1, b.seed).box(-sw / 2 - 0.2, Y(0) - 0.7, -sd / 2 - 0.2, sw / 2 + 0.2, Y(0.36), sd / 2 + 0.2);
    K.w.part(1, b.seed).box(-sw / 2, Y(0.32), -sd / 2, sw / 2, Y(3.1), sd / 2);
    K.w.part(2, b.seed).box(-1.0, Y(0.36), sd / 2 - 0.06, 1.0, Y(2.5), sd / 2 + 0.06);
    roofSlab(K.r, K.p, { W: sw, D: sd, eaveY: 3.1, rise: 2.0, axis: 'x', ov: 0.45, kind: 'thatch', gableSeed: b.seed });
    for (let k = 0; k < 4; k++) K.w.part(3, b.seed + k).cyl(-sw / 2 + 1.4 + k * 2, Y(0.1), sd / 2 + 1.6, 0.55, 0.5, 0.75, 8, true);
    localBox(K.w, 0, 0, sw / 2 + 0.2, sd / 2 + 0.2, 0, -0.7, 5.1);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }

  /** The church: nave, buttresses, lancet windows, rose window, porch, bell tower with a spire, churchyard. */
  function church(cx, cz, spec = {}) {
    const naveL = spec.naveL ?? 24, naveW = spec.naveW ?? 10.5, naveH = spec.naveH ?? 6.6, ridge = spec.ridge ?? 10.6;
    const tw = 5.6, th = spec.towerH ?? 15.8;
    const bs = K.s, bw = K.w, bm = K.m, bp = K.p, br = K.r;
    const seed = spec.seed ?? 7;
    reserve(cx - naveL / 2 - 6.5, cz - naveW / 2 - 7, cx + naveL / 2 + tw + 2, cz + naveW / 2 + 7);
    bs.frame(cx, 0, cz, 0); br.frame(cx, 0, cz, 0); bp.frame(cx, 0, cz, 0); bm.frame(cx, 0, cz, 0); bw.frame(cx, 0, cz, 0);
    const hx = naveL / 2, hz = naveW / 2;
    const fh = Y(0) - Math.min(groundMin(cx - hx, cz - hz, cx + hx, cz + hz, 4) - 0.9, 0);
    // ---- nave: solid walls with lancet windows cut through, a plinth, buttresses inside and out
    bs.part(1, seed).box(-hx - 0.34, Y(0) - fh, -hz - 0.34, hx + 0.34, Y(0.06), hz + 0.34);
    const lancet = (k) => {
      const out = [];
      for (let i = 0; i < k; i++) {
        const x = -hx + 3.4 + ((naveL - 6.8) * i) / Math.max(1, k - 1);
        out.push({ x0: x - 0.52, x1: x + 0.52, y0: 2.5, y1: 5.5 });
      }
      return out;
    };
    wallWith(bs, { x0: -hx, x1: hx, y0: 0.5, y1: naveH, zf: hz, dir: -1, part: 0, seed, openings: lancet(4) });
    wallWith(bs, { x0: -hx, x1: hx, y0: 0.5, y1: naveH, zf: -hz, dir: 1, part: 0, seed: seed + 1, openings: lancet(4) });
    // the two END walls stand in constant-X planes and span Z (this is the axis mix-up that made every side
    // wall lie across its building)
    wallAlongX(bs, { z0: -hz, z1: hz, y0: 0, y1: naveH, xf: -hx, dir: 1, part: 0, seed: seed + 2, openings: [{ z0: -1.15, z1: 1.15, y0: 0, y1: 3.9 }] });
    wallAlongX(bs, { z0: -hz, z1: hz, y0: 0, y1: naveH, xf: hx, dir: -1, part: 0, seed: seed + 3, openings: [{ z0: -1.1, z1: 1.1, y0: 0, y1: 4.2 }] });
    // buttresses
    for (const s of [-1, 1]) for (let i = 0; i <= 4; i++) {
      const x = -hx + 1.4 + ((naveL - 2.8) * i) / 4;
      bs.part(0, seed).box(x - 0.42, Y(0.5), s * (hz - 0.04), x + 0.42, Y(naveH - 1.3), s * (hz + 0.66));
      bs.part(2, seed).box(x - 0.5, Y(naveH - 1.4), s * (hz - 0.04), x + 0.5, Y(naveH - 1.1), s * (hz + 0.74));
      localBox(bs, x, s * (hz + 0.31), 0.42, 0.35, 0, 0.5, naveH - 1.1);
    }
    // lancet glazing + stone surrounds
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = -hx + 3.4 + ((naveL - 6.8) * i) / 3;
      bm.part(5, seed).box(x - 0.46, Y(2.6), s * (hz - 0.3), x + 0.46, Y(5.4), s * (hz - 0.08));
      bs.part(2, seed).box(x - 0.62, Y(5.4), s * (hz - 0.14), x + 0.62, Y(5.75), s * (hz + 0.14));
      for (const t of [-1, 1]) bs.part(2, seed).box(x + t * 0.56, Y(2.5), s * (hz - 0.14), x + t * 0.7, Y(5.6), s * (hz + 0.14));
      for (let j = 1; j < 5; j++) bm.part(5, seed).box(x - 0.46, Y(2.5 + j * 0.66), s * (hz - 0.3), x + 0.46, Y(2.5 + j * 0.66 + 0.07), s * (hz - 0.08));
    }
    // roof (ridge along x → the slopes fall to ±z) and the churchyard
    roofSlab(br, bp, { W: naveL, D: naveW, eaveY: naveH, rise: ridge - naveH, axis: 'x', ov: 0.5, kind: 'slate', gablePart: 4, gableSeed: seed });
    // ---- bell tower at the east end (it faces the square) + porch + spire
    const tx = hx + tw / 2 + 0.4;
    const th2 = Math.max(1.0, Y(0) - groundMin(cx + tx - 3, cz - 3, cx + tx + 3, cz + 3, 3) + 0.9);
    bs.part(1, seed).box(tx - tw / 2 - 0.34, Y(0) - th2, -tw / 2 - 0.34, tx + tw / 2 + 0.34, Y(0.06), tw / 2 + 0.34);
    wallAlongX(bs, { z0: -tw / 2, z1: tw / 2, y0: 0.6, y1: th, xf: tx + tw / 2, dir: -1, part: 0, seed: seed + 4, openings: [{ z0: -0.85, z1: 0.85, y0: 11.6, y1: 14.6 }] });
    wallAlongX(bs, { z0: -tw / 2, z1: tw / 2, y0: 0.6, y1: th, xf: tx - tw / 2, dir: 1, part: 0, seed: seed + 5, openings: [{ z0: -0.85, z1: 0.85, y0: 11.6, y1: 14.6 }] });
    wallWith(bs, { x0: tx - tw / 2, x1: tx + tw / 2, y0: 0.6, y1: th, zf: -tw / 2, dir: 1, part: 0, seed: seed + 6, openings: [{ x0: tx - 0.85, x1: tx + 0.85, y0: 11.6, y1: 14.6 }] });
    wallWith(bs, { x0: tx - tw / 2, x1: tx + tw / 2, y0: 0.6, y1: th, zf: tw / 2, dir: -1, part: 0, seed: seed + 7, openings: [{ x0: tx - 0.85, x1: tx + 0.85, y0: 11.6, y1: 14.6 }, { x0: tx - 1.4, x1: tx + 1.4, y0: 0.6, y1: 4.0 }] });
    for (const [dx, dz] of [[0, tw / 2], [0, -tw / 2], [tw / 2, 0], [-tw / 2, 0]]) {
      bm.part(4, seed).box(tx + dx * 1.02 - (dz ? 0.8 : 0.1), Y(11.7), dz * 1.02 - (dx ? 0.8 : 0.1), tx + dx * 1.02 + (dz ? 0.8 : 0.1), Y(14.5), dz * 1.02 + (dx ? 0.8 : 0.1));
      bs.part(2, seed).box(tx + dx * 1.05 - (dz ? 1.0 : 0.14), Y(14.4), dz * 1.05 - (dx ? 1.0 : 0.14), tx + dx * 1.05 + (dz ? 1.0 : 0.14), Y(14.8), dz * 1.05 + (dx ? 1.0 : 0.14));
    }
    bs.part(2, seed).cyl(tx, Y(th), 0, tw * 0.62, tw * 0.52, 0.5, 8, true);
    br.part(3, seed).lathe(tx, Y(th + 0.5), 0, [[tw * 0.78, 0], [tw * 0.52, 2.2], [tw * 0.27, 4.8], [0.06, 7.6]], 8);
    bm.part(0, seed).cyl(tx, Y(th + 8.1), 0, 0.05, 0.04, 1.4, 5, false);
    bm.part(0, seed).box(tx + 0.05, Y(th + 9.3), 0, tx + 0.85, Y(th + 9.55), 0.06);
    bm.part(0, seed).box(tx + 0.05, Y(th + 9.15), 0, tx + 0.7, Y(th + 9.35), 0.05);
    // rose window + porch on the square side of the tower
    bm.part(5, seed + 9).cyl(tx + 0.05, Y(7.4), 0, 1.15, 1.15, 0.1, 16, true);
    for (let k = 0; k < 4; k++) bs.part(2, seed).box(tx - 0.06 + (k < 2 ? 0 : 0.1), Y(7.4 + (k % 2 ? 1.0 : -0.06)), -1.2, tx + 0.12, Y(7.4 + (k % 2 ? 1.12 : 0.06)), 1.2);
    bs.part(2, seed).box(tx - 0.02, Y(7.4), -1.3, tx + 0.16, Y(7.52), 1.3);
    bs.part(2, seed).box(tx - 0.02, Y(8.5), -1.3, tx + 0.16, Y(8.62), 1.3);
    // west door under a stone arch, with a gabled porch in front of it (the porch roof is a ridge along z)
    fitDoorX(bw, bm, bs, { z: 0, w: 2.3, h: 3.4, sill: 0.08, xf: -hx, face: -1, open: true, arch: true, seed });
    for (const s of [-1, 1]) solidBox(bs.part(0, seed), -hx - 0.9, Y(0), s * 1.5 - 0.35, -hx - 0.34, Y(3.9), s * 1.5 + 0.35);
    for (const s of [-1, 1]) bs.part(0, seed).box(-hx - 0.9, Y(3.4), s * 2.2 - 0.25, -hx - 0.34, Y(3.9), s * 2.2 + 0.25);
    K.r.frame(cx - hx - 0.62, 0, cz, 0); K.p.frame(cx - hx - 0.62, 0, cz, 0);
    roofSlab(K.r, K.p, { W: 2.2, D: 5.0, eaveY: 3.9, rise: 1.2, axis: 'z', ov: 0.32, kind: 'slate', gablePart: 4, gableSeed: seed + 8 });
    K.r.frame(cx, 0, cz, 0); K.p.frame(cx, 0, cz, 0);
    // Wall pieces above already register their own boxes and preserve the door openings.
    if (ctx.app?.world?.addBlocker) { ctx.app.world.addBlocker({ x: cx, z: cz, r: 13 }); ctx.app.world.addBlocker({ x: cx + tx, z: cz, r: 4 }); }
    lightSrc.push({ x: cx + tx + 1.2, z: cz, h: 2.8, i: 2.2 });
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    // churchyard: a low wall, headstones, a yew
    const yardX = cx - hx - 1.5, yardW = 13, yardZ = cz + hz + 5.5, yardD = 9;
    for (const [x0, z0, x1, z1] of [[yardX - yardW / 2, yardZ - yardD / 2, yardX + yardW / 2, yardZ - yardD / 2],
      [yardX - yardW / 2, yardZ + yardD / 2, yardX + yardW / 2, yardZ + yardD / 2],
      [yardX - yardW / 2, yardZ - yardD / 2, yardX - yardW / 2, yardZ + yardD / 2]]) {
      bs.part(1, seed).beam([x0, Y(0), z0], [x1, Y(0), z1], 0.34, 0.62, [0, 1, 0]);
      fenceCollider(bs, x0, z0, x1, z1, 0.34, 0.31);
    }
    for (let k = 0; k < 9; k++) {
      const gx = yardX - yardW / 2 + 1.2 + (k % 5) * 2.3, gz = yardZ - yardD / 2 + 2 + Math.floor(k / 5) * 3.2;
      const h = 0.7 + 0.25 * ((k % 3) / 2);
      bs.part(2, seed + k).box(gx - 0.24, Y(0), gz - 0.07, gx + 0.24, Y(h), gz + 0.07);
      bs.part(2, seed + k).cyl(gx, Y(h), gz, 0.24, 0.2, 1.0, 8, true);
      localBox(bs, gx, gz, 0.24, 0.24, 0, 0, h + 1.0);
    }
    bp.part(6, seed).cyl(yardX + yardW / 2 - 1.4, Y(0), yardZ - yardD / 2 + 1.4, 0.22, 0.16, 2.4, 7, false);
    bp.part(5, seed).lathe(yardX + yardW / 2 - 1.4, Y(2.1), yardZ - yardD / 2 + 1.4, [[0.3, 0], [1.7, 0.7], [2.0, 1.8], [1.4, 2.9], [0.3, 3.5]], 8);
    addC(yardX + yardW / 2 - 1.4, yardZ - yardD / 2 + 1.4, 0.6);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }
  const floorY0 = () => 0.35;

  /** A long barracks hall for the camp: stone foot, timber upper, tiled roof, a banner over the door. */
  function barracksHall(spec, cx, cz, yaw) {
    const s = { W: 16, D: 7.5, st: 1, H1: 4.3, roof: 'tile', axis: 'x', rise: 2.6, doorAt: 1.5, doorW: 1.5, doorH: 2.5, doorOpen: true, windows: 3, timber: true, ...spec };
    const b = build(s, cx, cz, yaw);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    // banner over the door + a spear rack
    K.m.part(1, b.seed).box(s.doorAt - 1.2, Y(s.H1 - 0.9), b.hd + 0.06, s.doorAt + 1.2, Y(s.H1 + 0.5), b.hd + 0.1);
    weaponRack(K.w, s.doorAt - 3.6, b.hd + 1.0, 0.35, Math.PI / 2, 4, b.seed);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }

  /** 军队大营: a palisaded camp on the road outside the gate — tents, a watchtower, a fire, stores. */
  function camp(cx, cz) {
    const bs = K.s, bw = K.w, bm = K.m, bp = K.p, br = K.r;
    const seed = 21;
    const hw = 17, hd = 14;                                   // palisade half extents
    reserve(cx - hw - 2, cz - hd - 2, cx + hw + 2, cz + hd + 2);
    bw.frame(0, 0, 0, 0); bs.frame(0, 0, 0, 0); bm.frame(0, 0, 0, 0); bp.frame(0, 0, 0, 0); br.frame(0, 0, 0, 0);
    // palisade: panels with posts, taller pointed posts every few metres, a gate gap on the road side
    const panel = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.15));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const tall = (k % 4 === 0);
        bw.part((k & 1) ? 1 : 0, seed + k).box(x - 0.09, Y(0) - 0.4, z - 0.09, x + 0.09, Y(tall ? 2.9 : 2.35), z + 0.09);
        if (tall) bw.part(1, seed + k).cyl(x, Y(2.9), z, 0.09, 0.02, 0.35, 4, false);
        if (k < n) {
          const t2 = (k + 0.5) / n;
          const mx = x0 + (x1 - x0) * t2, mz = z0 + (z1 - z0) * t2;
          bw.part(1, seed + k).box(mx - 0.075, Y(0.5), mz - 0.075, mx + 0.075, Y(2.2), mz + 0.075);
        }
      }
      bw.part(1, seed).beam([x0, Y(0.85), z0], [x1, Y(0.85), z1], 0.14, 0.15);
      bw.part(1, seed).beam([x0, Y(1.85), z0], [x1, Y(1.85), z1], 0.14, 0.15);
      fenceCollider(bw, x0, z0, x1, z1, 0.18, 3.25);
    };
    panel(cx - hw, cz - hd, cx + hw, cz - hd);
    panel(cx - hw, cz + hd, cx + hw, cz + hd);
    panel(cx - hw, cz - hd, cx - hw, cz - 1.6);
    panel(cx - hw, cz + 1.6, cx - hw, cz + hd);
    panel(cx + hw, cz - hd, cx + hw, cz + hd);
    // the gate on the road (west) side: two posts + a beam + a banner
    bw.part(2, seed).box(cx - hw - 0.3, Y(0), cz - 1.6, cx - hw + 0.3, Y(3.4), cz - 1.0);
    bw.part(2, seed).box(cx - hw - 0.3, Y(0), cz + 1.0, cx - hw + 0.3, Y(3.4), cz + 1.6);
    bw.part(0, seed).beam([cx - hw, Y(3.5), cz - 1.3], [cx - hw, Y(3.5), cz + 1.3], 0.24, 0.2, [0, 1, 0]);
    bm.part(1, seed).box(cx - hw + 0.1, Y(2.3), cz - 0.45, cx - hw + 0.16, Y(3.4), cz + 0.45);
    // watchtower in the far corner with a ladder
    const tx = cx + hw - 2.4, tz = cz - hd + 2.4, tw = 3.4, th = 7.6;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bw.part(0, seed).box(tx + dx * tw / 2 - 0.12, Y(0), tz + dz * tw / 2 - 0.12, tx + dx * tw / 2 + 0.12, Y(th), tz + dz * tw / 2 + 0.12);
    for (let k = 1; k <= 3; k++) bw.part(1, seed).box(tx - tw / 2, Y(k * 1.7), tz - tw / 2, tx + tw / 2, Y(k * 1.7 + 0.12), tz + tw / 2);
    bw.part(1, seed).box(tx - tw / 2 - 0.3, Y(th), tz - tw / 2 - 0.3, tx + tw / 2 + 0.3, Y(th + 0.2), tz + tw / 2 + 0.3);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      bw.part(1, seed + k).obox([tx + ca * (tw * 0.62), Y(th + 0.2 + 0.5), tz + sa * (tw * 0.62)], [ca, 0, sa], [0, 1, 0], [-sa, 0, ca], 0.06, 0.5, 0.5);
    }
    bw.part(3, seed).box(tx - tw / 2 - 1.6, Y(3.2), tz - tw / 2 - 0.1, tx - tw / 2 - 1.4, Y(6.4), tz - tw / 2 + 0.1);
    bm.part(1, seed).box(tx + tw / 2 - 0.1, Y(th + 1.2), tz - 0.5, tx + tw / 2 + 0.05, Y(th + 2.6), tz + 0.5);
    bm.part(0, seed).cyl(tx + tw / 2 - 0.02, Y(th + 0.2), tz, 0.05, 0.04, 3.2, 5, false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) localBox(bw, tx + dx * tw / 2, tz + dz * tw / 2, 0.12, 0.12, 0, 0, th);
    localBox(bw, tx, tz, tw / 2, tw / 2, 0, 1.7, th + 0.2);
    // tents
    const tents = [[-10, -6.5, 3.6, 2.9], [-3, -7.5, 3.2, 2.7], [4.5, -7, 3.4, 2.8], [-9, 5.5, 3.4, 2.8], [-1.5, 6.5, 3.8, 3.0], [7, 6, 3.2, 2.6], [11, 0.5, 3.0, 2.5]];
    for (let k = 0; k < tents.length; k++) {
      const [dx, dz, r, h] = tents[k];
      tent(bm, cx + dx, cz + dz, 0, r, h, seed + k, k % 2 === 0);
      addC(cx + dx, cz + dz, r * 0.98, Y(0), Y(h));
      lightSrc.push({ x: cx + dx, z: cz + dz, h: 1.4, i: 0.9 });
    }
    // the fire in the middle of the camp, with a tripod and logs
    const fp = firePit(bs, bm, cx + 1.5, cz + 0.5, 0, 1.2, seed);
    for (let k = 0; k < 3; k++) bw.part(0, seed + k).beam([fp.x - Math.cos(k * 2.1) * 0.8, Y(0.1), fp.z - Math.sin(k * 2.1) * 0.8], [fp.x + Math.cos(k * 2.1) * 0.8, Y(0.1), fp.z + Math.sin(k * 2.1) * 0.8], 0.16, 0.16, [0, 1, 0]);
    bw.part(0, seed).cyl(fp.x, Y(0), fp.z + 1.6, 0.08, 0.07, 2.0, 6, false);
    bm.part(9, seed).lathe(fp.x, Y(1.1), fp.z + 1.6, [[0.28, 0.5], [0.34, 0.3], [0.3, 0], [0.26, 0.0]], 8);
    lamps.add({ pos: new THREE.Vector3(fp.x, Y(0.8), fp.z), color: [1.0, 0.45, 0.15], weight: 4.2, flicker: 0.55 });
    lightSrc.push({ x: fp.x, z: fp.z, h: 0.8, i: 4.6 });
    // stores: crates, barrels, a cart, hay, weapon and shield racks
    for (let k = 0; k < 9; k++) crate(bw, cx - 13 + (k % 5) * 1.1, cz + hd - 3.2 - Math.floor(k / 5) * 1.2, 0, 0.85, seed + k);
    for (let k = 0; k < 6; k++) barrel(bw, cx + 12.5, cz - hd + 3 + k * 0.9, 0, 0.36, 0.88, seed + k);
    weaponRack(bw, cx - 6, cz + hd - 1.4, 0, 0, 6, seed);
    shieldRack(bw, bm, cx + 3.6, cz + hd - 1.4, 0, 0, 4, seed);
    // a big banner beside the gate
    bw.part(4, seed).cyl(cx - hw + 1.5, Y(0), cz - 3.4, 0.1, 0.08, 5.2, 6, false);
    bm.part(1, seed).box(cx - hw + 1.35, Y(3.4), cz - 3.4, cx - hw + 1.65, Y(5.1), cz - 2.0);
    bm.part(8, seed).box(cx - hw + 1.45, Y(4.5), cz - 3.35, cx - hw + 1.55, Y(4.8), cz - 2.05);
    addC(cx - hw + 1.5, cz - 3.4, 0.5);
    stats.landmarks++;
  }

  /** 练习场: a fenced drill yard — dummies, archery butts, a pell, racks, a water trough. */
  function trainingYard(cx, cz, yaw = 0) {
    const bs = K.s, bw = K.w, bm = K.m, bp = K.p;
    const seed = 31, W = 21, D = 14;
    reserve(cx - W / 2 - 1.5, cz - D / 2 - 1.5, cx + W / 2 + 1.5, cz + D / 2 + 1.5);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const hw = W / 2, hd = D / 2;
    // a post-and-rail fence round three sides (the street side is open)
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.1));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        bw.part(4, seed + k).cyl(x, Y(0), z, 0.08, 0.07, 1.25, 5, false);
        if (k < n) {
          bw.part(1, seed + k).beam([x, Y(0.99), z], [x0 + (x1 - x0) * ((k + 1) / n), Y(0.99), z0 + (z1 - z0) * ((k + 1) / n)], 0.08, 0.08);
        }
      }
      fenceCollider(bw, x0, z0, x1, z1, 0.16, 1.25);
    };
    fence(-hw, -hd, hw, -hd);
    fence(-hw, -hd, -hw, hd);
    fence(hw, -hd, hw, hd);
    // four practice dummies in a row, three archery butts, a pell, racks and a trough
    for (let k = 0; k < 4; k++) dummy(bw, bm, -hw + 3 + k * 3.4, -hd + 3.2, 0, seed + k);
    for (let k = 0; k < 3; k++) target(bw, bm, -hw + 5 + k * 4.2, hd - 2.0, 0, seed + k);
    bw.part(4, seed).cyl(hw - 3.0, Y(0), hd - 4.5, 0.22, 0.18, 2.6, 7, false);
    bw.part(6, seed).box(hw - 3.2, Y(1.5), hd - 4.7, hw - 2.8, Y(2.6), hd - 4.3);
    localBox(bw, hw - 3.0, hd - 4.5, 0.22, 0.22, 0, 0, 2.6);
    weaponRack(bw, 0, hd - 1.2, 0, 0, 6, seed);
    shieldRack(bw, bm, 3.4, hd - 1.2, 0, 0, 3, seed);
    // water trough
    bs.part(1, seed).box(-hw + 1.0, Y(0), hd - 1.6, -hw + 3.6, Y(0.68), hd - 0.7);
    bm.part(7, seed).box(-hw + 1.1, Y(0.52), hd - 1.5, -hw + 3.5, Y(0.66), hd - 0.8);
    localBox(bs, -hw + 2.3, hd - 1.15, 1.3, 0.45, 0, 0, 0.68);
    // a rack of straw bales and a bench for onlookers
    for (let k = 0; k < 3; k++) bm.part(3, seed + k).cyl(hw - 6.5 + k * 1.3, Y(0), -hd + 2.4, 0.55, 0.5, 1.0, 7, true);
    bw.part(1, seed).box(2.0, Y(0.42), -hd + 1.0, 4.6, Y(0.52), -hd + 1.5);
    for (const dx of [2.2, 4.4]) bw.part(4, seed).cyl(dx, Y(0), -hd + 1.25, 0.07, 0.06, 0.42, 5, false);
    // a banner on a pole at the open corner
    bw.part(4, seed).cyl(-hw + 0.6, Y(0), hd - 0.8, 0.1, 0.08, 4.6, 6, false);
    bm.part(1, seed).box(-hw + 0.45, Y(2.9), hd - 0.8, -hw + 0.75, Y(4.4), hd + 0.4);
    localCircle(bw, -hw + 0.6, hd - 0.8, 0.1, 0, 4.6);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }

  /** The smithy: a low stone shed with a forge glowing behind an open front and a big chimney. */
  function smithy(cx, cz, yaw) {
    reserve(cx - 5.5, cz - 5.5, cx + 5.5, cz + 5.5);
    const s = { W: 8.6, D: 7.0, st: 1, H1: 3.3, roof: 'thatch', axis: 'x', rise: 2.3, doorAt: 0.4, doorW: 3.0, doorH: 2.4, doorOpen: true, windows: 0, stone: true, chim: false, lit: false, ...{} };
    const b = build(s, cx, cz, yaw);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const bs = K.s, bw = K.w, bm = K.m;
    bs.part(1, b.seed).box(-b.hw + 0.7, Y(2.6), -1.4, -b.hw + 1.9, Y(7.4), -0.2);          // forge chimney
    bs.part(2, b.seed).box(-b.hw + 0.6, Y(7.4), -1.5, -b.hw + 2.0, Y(7.7), -0.1);
    bm.part(10, b.seed).lathe(0.6, Y(0.35), -b.hd + 0.9, [[0.34, 0], [0.42, 0.2], [0.22, 0.5], [0.07, 0.72]], 7);   // forge fire
    bw.part(0, b.seed).box(1.6, Y(1.15), -b.hd + 1.0, 2.6, Y(1.4), -b.hd + 1.6);           // anvil
    bs.part(2, b.seed).cyl(2.1, Y(0), -b.hd + 1.3, 0.3, 0.26, 1.15, 6, true);
    bm.part(7, b.seed).box(-0.4, Y(0.15), -b.hd + 0.5, 1.8, Y(0.72), -b.hd + 1.9);         // quench trough
    grindstone(bs, bw, 2.9, b.hd + 0.7, 0.35, b.seed);
    for (let k = 0; k < 6; k++) bw.part(4, b.seed + k).cyl(-3.0 + (k % 3) * 0.44, Y(0.12 * (k % 2)), -b.hd + 0.7 + Math.floor(k / 3) * 0.5, 0.2, 0.2, 1.2, 6, true);
    lamps.add({ pos: new THREE.Vector3(cx + Math.sin(yaw) * (-b.hd + 0.9), Y(1.7), cz + Math.cos(yaw) * (-b.hd + 0.9)), color: [1.0, 0.42, 0.13], weight: 3.4, flicker: 0.5 });
    lightSrc.push({ x: cx + Math.sin(yaw) * (-b.hd + 0.9), z: cz + Math.cos(yaw) * (-b.hd + 0.9), h: 1.6, i: 5.0 });
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }

  /** A barn with a yard: mostly timber, a big cart door, straw inside. */
  function barn(cx, cz, yaw) {
    reserve(cx - 8, cz - 6.5, cx + 8, cz + 6.5);
    const s = { W: 13, D: 8, st: 1, H1: 4.2, roof: 'thatch', axis: 'z', rise: 3.1, doorAt: 0, doorW: 3.6, doorH: 3.0, doorOpen: true, windows: 0, daub: true, chim: false, lit: false };
    const b = build(s, cx, cz, yaw);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(cx, 0, cz, yaw);
    const bw = K.w, bm = K.m;
    for (let k = 0; k < 5; k++) bw.part(3, b.seed + k).cyl(-4 + k * 1.6, Y(0), 1.0, 0.6, 0.5, 1.0, 8, true);
    bm.part(3, b.seed).box(-2.0, Y(0), -2.6, 2.6, Y(1.1), 0.4);
    for (const k of ['s', 'w', 'p', 'r', 'm']) K[k].frame(0, 0, 0, 0);
    stats.landmarks++;
  }

  return { wallWith, wallAlongX, fitWindow, fitWindowX, fitDoor, fitDoorX, timberFace, timberFaceX, roofSlab, corbels, signBoard, barrel, crate, sack, lanternPost, torchBracket, tent, dummy, target, weaponRack, shieldRack, grindstone, cauldron, firePit, house, build, shop, tavern, church, barracksHall, camp, trainingYard, smithy, barn, stats };
}
