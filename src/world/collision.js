// Static map shapes shared by actors, townsfolk, cameras and vegetation.
// Boxes use the same +Y yaw convention as town-geo.Builder; y0/y1 are world heights.
export function boxCollider(x, z, hx, hz, yaw = 0, y0 = -Infinity, y1 = Infinity) {
  return { shape: 'box', x, z, hx, hz, yaw, y0, y1 };
}

export function boxFromBuilder(b, x0, y0, z0, x1, y1, z1) {
  const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
  return boxCollider(b.ox + x * b.c + z * b.s, b.oz - x * b.s + z * b.c,
    Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, Math.atan2(b.s, b.c),
    b.oy + Math.min(y0, y1), b.oy + Math.max(y0, y1));
}

export function colliderBounds(c, margin = 0) {
  let x = c.r ?? 1, z = x;
  if (c.shape === 'box') {
    const co = Math.abs(Math.cos(c.yaw)), sn = Math.abs(Math.sin(c.yaw));
    x = c.hx * co + c.hz * sn; z = c.hx * sn + c.hz * co;
  }
  return { x0: c.x - x - margin, x1: c.x + x + margin, z0: c.z - z - margin, z1: c.z + z + margin };
}

export function overlapsDisc(c, x, z, r = 0) {
  const dx = x - c.x, dz = z - c.z;
  if (c.shape !== 'box') return dx * dx + dz * dz < ((c.r ?? 1) + r) ** 2;
  const co = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  const lx = dx * co - dz * sn, lz = dx * sn + dz * co;
  const qx = Math.max(Math.abs(lx) - c.hx, 0), qz = Math.max(Math.abs(lz) - c.hz, 0);
  return (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) || qx * qx + qz * qz < r * r;
}

export function blocksBody(c, feet, height = 1.8, step = 0.24) {
  return (c.y1 ?? Infinity) > feet + step && (c.y0 ?? -Infinity) < feet + height;
}

// Minimum translation of a disc out of a circle or oriented rectangle, including exact-centre spawns.
export function pushOutCollider(pos, r, c, feet = pos.y ?? 0) {
  if (!blocksBody(c, feet)) return false;
  const dx = pos.x - c.x, dz = pos.z - c.z;
  if (c.shape !== 'box') {
    const R = (c.r ?? 1) + r, d = Math.hypot(dx, dz);
    if (d >= R) return false;
    if (d < 1e-8) pos.x += R + 1e-6;
    else { const k = (R + 1e-6 - d) / d; pos.x += dx * k; pos.z += dz * k; }
    return true;
  }
  const co = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  let x = dx * co - dz * sn, z = dx * sn + dz * co;
  const qx = Math.max(-c.hx, Math.min(c.hx, x)), qz = Math.max(-c.hz, Math.min(c.hz, z));
  const ex = x - qx, ez = z - qz, d = Math.hypot(ex, ez);
  if (d >= r) return false;
  if (d > 1e-8) { const k = (r + 1e-6 - d) / d; x += ex * k; z += ez * k; }
  else if (c.hx - Math.abs(x) < c.hz - Math.abs(z)) x = (x < 0 ? -1 : 1) * (c.hx + r + 1e-6);
  else z = (z < 0 ? -1 : 1) * (c.hz + r + 1e-6);
  pos.x = c.x + x * co + z * sn; pos.z = c.z - x * sn + z * co;
  return true;
}

// Entry fraction of a camera segment against a padded shape with its actual vertical extent.
export function rayCollider(start, end, c, pad = 0.35, ground = 0) {
  let lo = 0, hi = 1;
  const slab = (p, d, a, b) => {
    if (Math.abs(d) < 1e-8) return p >= a && p <= b;
    let t0 = (a - p) / d, t1 = (b - p) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1); return lo <= hi;
  };
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  if (c.shape === 'box') {
    const co = Math.cos(c.yaw), sn = Math.sin(c.yaw), fx = start.x - c.x, fz = start.z - c.z;
    if (!slab(fx * co - fz * sn, dx * co - dz * sn, -c.hx - pad, c.hx + pad)
      || !slab(fx * sn + fz * co, dx * sn + dz * co, -c.hz - pad, c.hz + pad)) return null;
  } else {
    const fx = start.x - c.x, fz = start.z - c.z, R = (c.r ?? 1) + pad, a = dx * dx + dz * dz;
    if (a < 1e-8) { if (fx * fx + fz * fz > R * R) return null; }
    else {
      const b = 2 * (fx * dx + fz * dz), disc = b * b - 4 * a * (fx * fx + fz * fz - R * R);
      if (disc < 0) return null;
      lo = Math.max(lo, (-b - Math.sqrt(disc)) / (2 * a)); hi = Math.min(hi, (-b + Math.sqrt(disc)) / (2 * a));
      if (lo > hi) return null;
    }
  }
  const bottom = c.y0 ?? -Infinity, top = c.y1 ?? ground + (c.h ?? (c.r ?? 1) * 1.6);
  return slab(start.y, dy, bottom - pad, top + pad) && lo <= hi ? lo : null;
}
