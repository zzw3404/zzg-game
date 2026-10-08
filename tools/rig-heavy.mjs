// Convert this supplied, posed Tripo mesh into a game-ready T-pose skin.
// Usage: node tools/rig-heavy.mjs [input.glb] [output.glb]
// Landmarks below are specific to the uploaded knight, in metres at its 1 m export scale.
// The original file is never modified. Texture, UVs and mesh detail are preserved.
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import { createSkeleton } from '../src/character/skeleton.js';
import { GRIP_R } from '../src/character/ik.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const input = path.resolve(process.argv[2] ?? 'tripo_convert_41c53f10-4275-44d5-a15e-d95289829c2b.glb');
const output = path.resolve(process.argv[3] ?? 'public/assets/models/enemy-heavy-knight.glb');
if (input === output) throw new Error('Input and output must differ.');
const raw = fs.readFileSync(input);
let gltf, bin;
for (let p = 12; p < raw.length;) {
  const n = raw.readUInt32LE(p), type = raw.readUInt32LE(p + 4);
  if (type === 0x4e4f534a) gltf = JSON.parse(raw.toString('utf8', p + 8, p + 8 + n));
  if (type === 0x004e4942) bin = raw.subarray(p + 8, p + 8 + n);
  p += n + 8;
}
if (gltf.skins?.length) throw new Error('This converter expects the original static mesh.');
const primitive = gltf.meshes[0].primitives[0];
function read(i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView];
  const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
  if (!C || v.byteStride) throw new Error('Unsupported accessor layout.');
  return new C(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), a.count * count);
}
const pos = read(primitive.attributes.POSITION), normals = read(primitive.attributes.NORMAL);
const uv = read(primitive.attributes.TEXCOORD_0), indices = read(primitive.indices);
// The export faces +X and includes the sword in its bounding-box centre.
const canonical = (i) => new T.Vector3(-pos[i * 3 + 2], pos[i * 3 + 1], pos[i * 3] + 0.15);
const canonicalNormal = (i) => new T.Vector3(-normals[i * 3 + 2], normals[i * 3 + 1], normals[i * 3]);
const V = (x, y, z = 0) => new T.Vector3(x, y, z);
const source = {
  Hips: V(.005, .50), Spine: V(.005, .55), Spine1: V(.005, .60), Spine2: V(.005, .66),
  Neck: V(.005, .815), Head: V(.005, .875),
  LeftShoulder: V(.060, .750), LeftArm: V(.135, .737), LeftForeArm: V(.192, .600, -.003), LeftHand: V(.239, .495, -.012),
  RightShoulder: V(-.060, .750), RightArm: V(-.137, .737), RightForeArm: V(-.164, .630, .008), RightHand: V(-.223, .705, .171),
  LeftUpLeg: V(.075, .445), LeftLeg: V(.108, .271, .005), LeftFoot: V(.118, .043, -.020), LeftToeBase: V(.130, .018, .065),
  RightUpLeg: V(-.075, .445), RightLeg: V(-.108, .271, .005), RightFoot: V(-.118, .043, -.020), RightToeBase: V(-.130, .018, .065),
};
const map = {
  hips: 'Hips', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head',
  'shoulder.L': 'LeftShoulder', 'upperArm.L': 'LeftArm', 'lowerArm.L': 'LeftForeArm', 'hand.L': 'LeftHand',
  'shoulder.R': 'RightShoulder', 'upperArm.R': 'RightArm', 'lowerArm.R': 'RightForeArm', 'hand.R': 'RightHand',
  'upperLeg.L': 'LeftUpLeg', 'lowerLeg.L': 'LeftLeg', 'foot.L': 'LeftFoot', 'toes.L': 'LeftToeBase',
  'upperLeg.R': 'RightUpLeg', 'lowerLeg.R': 'RightLeg', 'foot.R': 'RightFoot', 'toes.R': 'RightToeBase',
};
// Match the contract skeleton, including its weapon sockets and hurt capsules.
const rig = createSkeleton(.5), defs = [], target = {};
for (const [contract, name] of Object.entries(map)) {
  const bone = rig.bones[contract];
  target[name] = bone.getWorldPosition(new T.Vector3());
  defs.push({ name, parent: map[bone.parent.name] ?? null });
}
// Hand landmarks are only used to define palm axes: the exported fists are rigidly bound to Hand.
for (const side of ['Left', 'Right']) {
  const sign = side === 'Left' ? 1 : -1, h = target[`${side}Hand`];
  for (const [finger, depth] of [['Thumb', .025], ['Index', .013], ['Middle', 0], ['Ring', -.012], ['Pinky', -.023]]) {
    for (let j = 1; j <= 3; j++) {
      const name = `${side}Hand${finger}${j}`;
      target[name] = h.clone().add(V(sign * (.018 + (j - 1) * .012), -.003, depth));
      defs.push({ name, parent: j === 1 ? `${side}Hand` : `${side}Hand${finger}${j - 1}` });
    }
  }
}
const id = (name) => defs.findIndex((b) => b.name === name);
const grip = V(-.225, .714, .196), bladeZ = V(-.04, .278, .195).normalize();
const bladeX = V(1, 0, 0).addScaledVector(bladeZ, -bladeZ.x).normalize(), bladeY = bladeZ.clone().cross(bladeX).normalize();
const bladeQ = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(bladeX, bladeY, bladeZ));
const qFrom = (from, to) => new T.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
const unpose = {};
const lengthScale = {}, targetAxis = {};
for (const name of Object.keys(source)) unpose[name] = new T.Quaternion();
for (const side of ['Left', 'Right']) {
  for (const [a, b] of [['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['UpLeg', 'Leg'], ['Leg', 'Foot']]) {
    const na = side + a, nb = side + b;
    unpose[na] = qFrom(source[nb].clone().sub(source[na]), target[nb].clone().sub(target[na]));
    lengthScale[na] = target[nb].distanceTo(target[na]) / source[nb].distanceTo(source[na]);
    targetAxis[na] = target[nb].clone().sub(target[na]).normalize();
  }
  // Palms down in T-pose; the right fist originally holds its cleaver upright.
  unpose[side + 'Hand'] = side === 'Right'
    ? GRIP_R.clone().multiply(bladeQ.clone().invert())
    : qFrom(V(.044, -.11, 0), V(1, 0, 0));
}
const handShift = rig.bones['weapon.R'].getWorldPosition(new T.Vector3())
  .sub(grip.clone().sub(source.RightHand).applyQuaternion(unpose.RightHand).add(target.RightHand));
const segments = [];
const seg = (a, b) => segments.push({ name: a, a: source[a], b: source[b], index: id(a) });
seg('Hips', 'Spine'); seg('Spine', 'Spine1'); seg('Spine2', 'Neck'); seg('Neck', 'Head');
segments.push({ name: 'Head', a: source.Head, b: V(.005, .962), index: id('Head') });
for (const s of ['Left', 'Right']) {
  seg(s + 'Shoulder', s + 'Arm'); seg(s + 'Arm', s + 'ForeArm'); seg(s + 'ForeArm', s + 'Hand');
  segments.push({ name: s + 'Hand', a: source[s + 'Hand'], b: source[s + 'Hand'].clone().add(s === 'Right' ? V(-.008, .035, .04) : V(.024, -.06)), index: id(s + 'Hand') });
  seg(s + 'UpLeg', s + 'Leg'); seg(s + 'Leg', s + 'Foot'); seg(s + 'Foot', s + 'ToeBase');
}
const ab = new T.Vector3(), av = new T.Vector3();
function distance(p, a, b) {
  ab.subVectors(b, a); av.subVectors(p, a);
  return av.addScaledVector(ab, -T.MathUtils.clamp(av.dot(ab) / Math.max(1e-10, ab.lengthSq()), 0, 1)).length();
}
function weights(p) {
  let allowed;
  const edge = p.y < .58 ? .185 : p.y < .67 ? .145 : .125;
  if (p.y > .40 && p.y < .835 && Math.abs(p.x) > edge - .025 && (p.x > 0 || p.y > .57)) {
    const side = p.x > 0 ? 'Left' : 'Right';
    const blend = T.MathUtils.smoothstep(Math.abs(p.x), edge - .025, edge + .025);
    allowed = segments.filter((s) => s.name.startsWith(side) && !/Leg|Foot/.test(s.name)).map((s) => ({ ...s, factor: blend }));
    allowed.push(...segments.filter((s) => !/Left|Right/.test(s.name)).map((s) => ({ ...s, factor: 1 - blend })));
  } else if (p.y < .44) {
    const side = p.x > 0 ? 'Left' : 'Right';
    allowed = segments.filter((s) => s.name.startsWith(side) && /Leg|Foot/.test(s.name));
    if (p.y > .30) allowed = [...allowed, segments[0]]; // layered tassets follow the hips above the knees
  } else {
    allowed = segments.filter((s) => !/Left|Right/.test(s.name));
  }
  const best = allowed.map((s) => ({ ...s, d: distance(p, s.a, s.b), value: (s.factor ?? 1) / Math.pow(Math.max(.014, distance(p, s.a, s.b)), 6) })).sort((a, b) => b.value - a.value).slice(0, 4);
  while (best.length < 4) best.push({ ...best[0], d: Infinity, value: 0 });
  const w = best.map((s) => s.value ?? 0), sum = w.reduce((a, b) => a + b);
  return best.map((s, i) => ({ ...s, w: w[i] / sum }));
}

function isBlade(p) {
  const d = p.clone().sub(grip), along = d.dot(bladeZ);
  return p.x < -.18 && along > .041 && d.addScaledVector(bladeZ, -along).length() < .072;
}
const bodyTris = [], bladeTris = [];
for (let f = 0; f < indices.length; f += 3) {
  const tri = [indices[f], indices[f + 1], indices[f + 2]];
  const centroid = tri.reduce((p, i) => p.add(canonical(i)), new T.Vector3()).multiplyScalar(1 / 3);
  (isBlade(centroid) ? bladeTris : bodyTris).push(...tri);
}

// Preserve UV seams and normals while reducing the dense AI-generated topology.
await MeshoptSimplifier.ready;
const attrs = new Float32Array(pos.length / 3 * 5);
for (let i = 0; i < pos.length / 3; i++) { attrs.set(normals.subarray(i * 3, i * 3 + 3), i * 5); attrs.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3); }
function simplify(tris, targetCount, error) {
  const [result, actualError] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(tris), pos, 3, attrs, 5, [.3, .3, .3, 2, 2], null, targetCount * 3, error, ['RegularizeLight']);
  console.log(`Simplified ${tris.length / 3} → ${result.length / 3} triangles, error ${actualError.toFixed(5)}`);
  return Array.from(result);
}
const simpleBody = simplify(bodyTris, 85000, .006), simpleBlade = simplify(bladeTris, 2500, .003);

// Keep only embedded images from the original buffer; geometry is rebuilt below.
const originalBin = bin, imageParts = [], imageViews = []; let imageOffset = 0;
for (const image of gltf.images) {
  const view = gltf.bufferViews[image.bufferView], bytes = originalBin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  image.bufferView = imageViews.length;
  imageViews.push({ buffer: 0, byteOffset: imageOffset, byteLength: bytes.length });
  imageParts.push(bytes); imageOffset += bytes.length;
  const pad = Buffer.alloc((4 - imageOffset % 4) % 4); imageParts.push(pad); imageOffset += pad.length;
}
bin = Buffer.concat(imageParts); gltf.bufferViews = imageViews; gltf.accessors = [];
const added = [], views = [], accessors = [];
let cursor = bin.length;
function append(array, type, componentType, min, max) {
  const pad = (4 - cursor % 4) % 4;
  if (pad) { added.push(Buffer.alloc(pad)); cursor += pad; }
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const viewIndex = gltf.bufferViews.length + views.length;
  views.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.length });
  cursor += bytes.length; added.push(bytes);
  const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
  const index = gltf.accessors.length + accessors.length;
  accessors.push({ bufferView: viewIndex, componentType, type, count: array.length / count, ...(min ? { min, max } : {}) });
  return index;
}
function makeMesh(tris, isWeapon) {
  const used = [...new Set(tris)], remap = new Map(used.map((v, i) => [v, i]));
  const P = new Float32Array(used.length * 3), N = new Float32Array(P.length), U = new Float32Array(used.length * 2);
  const J = new Uint16Array(used.length * 4), W = new Float32Array(J.length);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < used.length; v++) {
    const i = used[v], p = canonical(i), n = canonicalNormal(i), out = new T.Vector3(), normal = new T.Vector3();
    if (isWeapon) {
      p.sub(grip); out.set(p.dot(bladeX), p.dot(bladeY), p.dot(bladeZ));
      normal.set(n.dot(bladeX), n.dot(bladeY), n.dot(bladeZ));
    } else {
      for (const [k, s] of weights(p).entries()) {
        const name = s.name === 'Spine1' ? 'Spine' : s.name;
        const offset = p.clone().sub(source[name]).applyQuaternion(unpose[name]);
        const transformedNormal = n.clone().applyQuaternion(unpose[name]);
        if (targetAxis[name]) {
          const axis = targetAxis[name], k = lengthScale[name];
          offset.addScaledVector(axis, offset.dot(axis) * (k - 1));
          transformedNormal.addScaledVector(axis, transformedNormal.dot(axis) * (1 / k - 1));
        }
        const transformed = offset.add(target[name]);
        if (name === 'RightHand') transformed.add(handShift);
        out.addScaledVector(transformed, s.w);
        normal.addScaledVector(transformedNormal, s.w);
        J[v * 4 + k] = s.index; W[v * 4 + k] = s.w;
      }
      normal.normalize();
    }
    out.toArray(P, v * 3); normal.toArray(N, v * 3); U.set(uv.subarray(i * 2, i * 2 + 2), v * 2);
    for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], P[v * 3 + j]); hi[j] = Math.max(hi[j], P[v * 3 + j]); }
  }
  const attributes = { POSITION: append(P, 'VEC3', 5126, lo, hi), NORMAL: append(N, 'VEC3', 5126), TEXCOORD_0: append(U, 'VEC2', 5126) };
  if (!isWeapon) { attributes.JOINTS_0 = append(J, 'VEC4', 5123); attributes.WEIGHTS_0 = append(W, 'VEC4', 5126); }
  const index = append(new Uint32Array(tris.map((v) => remap.get(v))), 'SCALAR', 5125);
  return { name: isWeapon ? 'HeavyBlade' : 'HeavyKnight', primitives: [{ attributes, indices: index, material: primitive.material }] };
}
gltf.meshes = [makeMesh(simpleBody, false), makeMesh(simpleBlade, true)];
const nodes = [{ name: 'HeavyKnight', mesh: 0, skin: 0 }, { name: 'HeavyBlade', mesh: 1 }];
const nodeOf = new Map(defs.map((b, i) => [b.name, i + 2]));
for (const b of defs) {
  const p = target[b.name].clone(); if (b.parent) p.sub(target[b.parent]);
  nodes.push({ name: 'mixamorig:' + b.name, translation: p.toArray(), children: defs.filter((d) => d.parent === b.name).map((d) => nodeOf.get(d.name)) });
}
const inverse = new Float32Array(defs.length * 16);
defs.forEach((b, i) => new T.Matrix4().makeTranslation(...target[b.name].toArray()).invert().toArray(inverse, i * 16));
gltf.nodes = nodes;
gltf.skins = [{ name: 'HeavyKnightRig', skeleton: nodeOf.get('Hips'), joints: defs.map((b) => nodeOf.get(b.name)), inverseBindMatrices: append(inverse, 'MAT4', 5126) }];
gltf.scenes = [{ name: 'HeavyKnight', nodes: [0, 1, nodeOf.get('Hips')] }]; gltf.scene = 0;
gltf.bufferViews.push(...views); gltf.accessors.push(...accessors);
const allBin = Buffer.concat([bin, ...added]), binPad = Buffer.alloc((4 - allBin.length % 4) % 4);
gltf.buffers = [{ byteLength: allBin.length }];
gltf.asset.generator = 'Tripo + long-wind knight rig adapter';
gltf.asset.extras = { source: path.basename(input), binding: 'Approximate landmark skin; fists and armour retain the supplied geometry.' };
const json = Buffer.from(JSON.stringify(gltf)), jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + jsonPad.length + 8 + allBin.length + binPad.length, 8);
jh.writeUInt32LE(json.length + jsonPad.length); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(allBin.length + binPad.length); bh.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, jh, json, jsonPad, bh, allBin, binPad]));
console.log(JSON.stringify({ output, bones: defs.length, bodyTriangles: simpleBody.length / 3, bladeTriangles: simpleBlade.length / 3, bytes: fs.statSync(output).size }, null, 2));
