// Materials for the medieval walled town (world/citadel.js). Owner: citadel.
//
//   createCitadelMaterials() → { stone, timber, plaster, roof, misc, paving, dispose() }
//
// Five textured/procedural MeshStandardMaterials plus one procedural cobble material. Every material is a single
// draw call for the whole town; per-part colour and detail come from the `aP` vertex attribute written by the
// geometry kit (world/town-geo.js): aP.x = part id (see the part tables below), aP.y = per-object random seed.
//
// Shared uniforms attached here (documented per the globals.js rule):
//   G.uCitLightK   float 0..1 — how "lit up" the town is (torches / windows). The scene drives it from the
//                  environment's night factor, so the baked torch irradiance and the glowing windows fade in at
//                  dusk and are off in daylight at noon.
// Reused from world/town-mat.js: the baked light field itself (bakeTownLight → G.tTownLight / G.uTownRect).
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { U } from '../core/glsl.js';
import { addShaderHook, patchMaterial } from '../core/atmosphere.js';
import { TOWN_LIGHT_GLSL } from './town-mat.js';

G.uCitLightK ??= { value: 0 };

// The light field is baked warm; here it is gated by uCitLightK so a noon town has no lantern glow.
const CT_LIGHT = /* glsl */`
${TOWN_LIGHT_GLSL}
${U('float', 'uCitLightK')}
vec3 ct_light(vec3 wp, vec3 nW) { return town_light(wp, nW) * uCitLightK; }
`;
const CT_LIGHT_APPLY = /* glsl */`
#include <lights_fragment_end>
{
  vec3 ctN = inverseTransformDirection(normal, viewMatrix);
  reflectedLight.indirectDiffuse += material.diffuseColor * ct_light(vWxWorldPos, ctN);
}
`;

/** Read `aP` (part, seed) and the metric uv in the fragment stage; declares the light field + the scratch. */
function preamble(sh, { scratch = 'float ctR = 0.85;' } = {}) {
  sh.vertexShader = sh.vertexShader
    .replace('void main() {', 'attribute vec2 aP;\nvarying vec2 vCtP;\nvarying vec2 vCtUv;\nvoid main() {\nvCtP = aP;\nvCtUv = uv;');
  sh.fragmentShader = sh.fragmentShader
    .replace('void main() {', CT_LIGHT + '\nvarying vec2 vCtP;\nvarying vec2 vCtUv;\nvoid main() {\n' + scratch);
}
const part = (n) => `int ctP = int(vCtP.x + 0.5); float ctS = vCtP.y;`;
/** Apply a flat roughness / emissive that the part branch wrote into ctR / ctE. */
function finish(sh, { emissive = false } = {}) {
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(ctR, 0.04, 1.0);')
    .replace('#include <lights_fragment_end>', CT_LIGHT_APPLY);
  if (emissive) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ctE;');
}

// ------------------------------------------------------------------------------------------------ stone
// aP.x: 0 coursed wall masonry · 1 rough footing / plinth · 2 dressed stone (voussoirs, quoins, kerbs, cross)
//       3 dark kerb stone · 4 rubble core (the wall's inner faces, sheds)
const STONE_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float n = wx_vnoise(wp.xz * 0.9 + wp.y * 0.5);
  // the scanned wall texture is dark: lift it to a sunlit limestone albedo with a soft roll-off
  float base = lum * 2.5;
  base = base / (1.0 + base * 0.5);
  vec3 c = base * vec3(1.0, 0.985, 0.945);
  float r = 0.93;
  if (ctP == 1) { c = base * vec3(0.78, 0.76, 0.71) * (0.8 + 0.4 * n); r = 0.97; }
  else if (ctP == 2) { c = base * vec3(1.18, 1.16, 1.09); r = 0.88; }
  else if (ctP == 3) { c = base * vec3(0.55, 0.55, 0.53) * (0.85 + 0.3 * n); r = 0.9; }
  else if (ctP == 4) { c = base * vec3(0.88, 0.85, 0.80) * (0.75 + 0.5 * n); r = 0.98; }
  // per-block tone
  float block = wx_hash12(floor(wp.xz * 1.35 + wp.y * 0.7) + ctS * 7.0);
  c *= 0.88 + 0.24 * block;
  // weather: damp darkening in the lower metre, sun-bleached tops, moss in the shaded joints
  float wet = smoothstep(1.4, 0.05, wp.y - wt_groundHeight(wp.xz));
  c *= mix(1.0, 0.74, wet * 0.8);
  float moss = smoothstep(0.55, 0.95, wx_vnoise(wp.xz * 0.55 + 11.0)) * smoothstep(4.0, 0.2, wp.y - wt_groundHeight(wp.xz));
  c = mix(c, c * vec3(0.72, 0.86, 0.5), moss * 0.5);
  c *= 0.9 + 0.2 * wx_fbm(wp.xz * 0.045);
  diffuseColor.rgb = c; ctR = r;
}
`;
export function createStoneMaterial(set) {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:stone', map: set?.map || null, normalMap: set?.normalMap || null, roughnessMap: set?.armMap || null, roughness: 1, metalness: 0, color: 0xcfcabd });
  patchMaterial(m, { wetBias: 0.05 });
  addShaderHook(m, 'ctStone', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.9;' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + STONE_FRAG);
    finish(sh);
  });
  return m;
}

// ------------------------------------------------------------------------------------------------ timber
// aP.x: 0 structural oak (dark, tarred) · 1 plank / board · 2 door leaf · 3 shutter · 4 bare pole (scaffold, cart)
const TIMBER_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float grain = wx_vnoise(vec2(vCtUv.x * 6.0, vCtUv.y * 0.9) + ctS * 13.0);
  vec3 c = vec3(0.30, 0.20, 0.115) * (0.72 + 0.5 * grain);
  float r = 0.9;
  if (ctP == 0) { c = vec3(0.115, 0.075, 0.045) * (0.65 + 0.6 * grain); r = 0.78; }
  else if (ctP == 1) { c = vec3(0.34, 0.245, 0.15) * (0.7 + 0.55 * grain); r = 0.88; }
  else if (ctP == 2) { c = vec3(0.135, 0.09, 0.055) * (0.7 + 0.55 * grain); r = 0.72; }
  else if (ctP == 3) { c = vec3(0.30, 0.30, 0.28) * (0.62 + 0.6 * grain); r = 0.94; }
  else if (ctP == 4) { c = vec3(0.42, 0.33, 0.21) * (0.7 + 0.5 * grain); r = 0.95; }
  c *= 0.86 + 0.28 * wx_hash12(vec2(ctS * 31.0, floor(wp.y * 3.0)));
  diffuseColor.rgb = c; ctR = r;
}
`;
export function createTimberMaterial(set) {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:timber', map: set?.map || null, normalMap: set?.normalMap || null, roughnessMap: set?.armMap || null, roughness: 1, metalness: 0 });
  patchMaterial(m, { wetBias: -0.3 });
  addShaderHook(m, 'ctTimber', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.9;' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + TIMBER_FRAG);
    finish(sh);
  });
  return m;
}

// ------------------------------------------------------------------------------------------------ plaster
// aP.x: 0 lime render (warm off-white) · 1 weathered daub (grey) · 2 soot-stained (near the chimneys)
//      3 limewash trim (bright) · 4 whitewashed stone · 5 foliage · 6 tree trunk · 7 vegetable rows
const PLASTER_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float n = wx_fbm(wp.xz * 0.75 + wp.y * 1.3) - 0.5;
  float macro = wx_fbm(wp.xz * 0.05) - 0.5;
  vec3 c = vec3(0.74, 0.70, 0.615);
  float r = 0.95;
  if (ctP == 1) { c = vec3(0.44, 0.415, 0.365); r = 0.97; }
  else if (ctP == 2) { c = vec3(0.30, 0.275, 0.245); r = 0.98; }
  else if (ctP == 3) { c = vec3(0.86, 0.835, 0.775); r = 0.92; }
  else if (ctP == 4) { c = vec3(0.62, 0.60, 0.555); r = 0.9; }
  else if (ctP == 5) {
    // garden foliage: dark leaves, broken up so the canopy does not read as a smooth blob
    float leaf = wx_vnoise(wp.xz * 2.6 + wp.y * 4.0 + ctS * 9.0);
    c = mix(vec3(0.075, 0.105, 0.045), vec3(0.185, 0.235, 0.085), leaf) * (0.7 + 0.5 * wx_fbm(wp.xz * 1.3));
    r = 0.92;
  }
  else if (ctP == 6) { c = vec3(0.145, 0.115, 0.085) * (0.7 + 0.6 * wx_vnoise(vCtUv * 8.0 + ctS * 3.0)); r = 0.95; }
  else if (ctP == 7) { c = mix(vec3(0.10, 0.16, 0.055), vec3(0.24, 0.30, 0.10), wx_vnoise(wp.xz * 5.0 + ctS)); r = 0.94; }
  c *= 1.0 + 0.22 * n + 0.13 * macro;
  // damp rising up the wall from the ground, and a soft grime band under the eaves
  float y = wp.y - wt_groundHeight(wp.xz);
  float damp = smoothstep(1.6, 0.0, y);
  c *= mix(1.0, 0.78 + 0.1 * n, damp * 0.8 * step(0.5, float(ctP < 5)));
  c *= 0.94 + 0.12 * wx_vnoise(wp.xz * 3.0);
  diffuseColor.rgb = c; ctR = r;
}
`;
export function createPlasterMaterial(set) {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:plaster', normalMap: set?.normalMap || null, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 1, metalness: 0, color: 0xffffff });
  patchMaterial(m, { wetBias: -0.35 });
  addShaderHook(m, 'ctPlaster', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.95;' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + PLASTER_FRAG);
    finish(sh);
  });
  return m;
}

// ------------------------------------------------------------------------------------------------ roof
// aP.x: 0 clay pantile · 1 slate · 2 thatch · 3 lead/ridge cap · 4 shingle
// UV convention on roofs: u runs along the ridge, v up the slope (the geometry writes them explicitly).
const ROOF_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float grain = wx_vnoise(vCtUv * vec2(7.0, 3.0) + ctS * 5.0);
  vec3 c = vec3(0.40, 0.20, 0.135) * (0.75 + 0.45 * grain);
  float r = 0.72;
  if (ctP == 1) { c = vec3(0.19, 0.205, 0.225) * (0.8 + 0.4 * grain); r = 0.6; }
  else if (ctP == 2) {
    // thatch: straw courses running down the slope, streaked and shadowed
    float course = sin(vCtUv.y * 11.0 + grain * 2.0) * 0.5 + 0.5;
    float straw = wx_vnoise(vCtUv * vec2(26.0, 4.0) + ctS * 9.0);
    c = vec3(0.46, 0.375, 0.19) * (0.6 + 0.5 * straw + 0.22 * course);
    r = 0.96;
  } else if (ctP == 3) { c = vec3(0.24, 0.25, 0.26) * (0.85 + 0.3 * grain); r = 0.55; }
  else if (ctP == 4) { c = vec3(0.30, 0.25, 0.19) * (0.6 + 0.6 * grain); r = 0.9; }
  // moss and weathering on the shaded slope, brighter on the sun side
  float shade = clamp(-normalize(vWxWorldPos - cameraPosition).y, 0.0, 1.0);
  c *= 0.9 + 0.2 * wx_fbm(wp.xz * 0.12);
  diffuseColor.rgb = c; ctR = r;
}
`;
export function createRoofMaterial(set) {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:roof', map: set?.map || null, normalMap: set?.normalMap || null, roughnessMap: set?.armMap || null, roughness: 1, metalness: 0 });
  patchMaterial(m, { wetBias: -0.5 });
  addShaderHook(m, 'ctRoof', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.8;' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + ROOF_FRAG);
    finish(sh);
  });
  return m;
}

// ------------------------------------------------------------------------------------------------ misc
// aP.x: 0 wrought iron · 1 dyed cloth (banner) · 2 awning cloth (striped) · 3 straw / hay · 4 dark recess
//      (window and arrow-loop interiors) · 5 window glass (lights up with the town) · 6 sackcloth · 7 still water
//      · 8 limewash white · 9 copper / lead sheet · 10 flame · 11 tent canvas
const MISC_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float n = wx_vnoise(wp.xz * 2.5 + wp.y * 3.0 + ctS * 17.0);
  vec3 c = vec3(0.05, 0.048, 0.046); float r = 0.55;
  vec3 e = vec3(0.0);
  if (ctP == 0) { c = vec3(0.075, 0.072, 0.07) * (0.85 + 0.3 * n); r = 0.85; }
  else if (ctP == 1) { c = vec3(0.36, 0.045, 0.035) * (0.85 + 0.25 * n); r = 0.86; }
  else if (ctP == 2) {
    float s = step(0.5, fract((abs(vCtUv.x) + abs(vCtUv.y)) * 1.6));
    c = mix(vec3(0.62, 0.575, 0.48), vec3(0.40, 0.10, 0.075), s) * (0.88 + 0.22 * n); r = 0.9;
  }
  else if (ctP == 3) { c = vec3(0.52, 0.44, 0.22) * (0.6 + 0.6 * wx_vnoise(vCtUv * 9.0 + ctS)); r = 0.98; }
  else if (ctP == 4) { c = vec3(0.055, 0.058, 0.062); r = 1.0; }
  else if (ctP == 5) { c = vec3(0.055, 0.07, 0.085) * (0.8 + 0.4 * n); r = 0.14; }
  else if (ctP == 6) { c = vec3(0.40, 0.36, 0.27) * (0.7 + 0.5 * wx_vnoise(vCtUv * 14.0)); r = 0.96; }
  else if (ctP == 7) { c = vec3(0.028, 0.04, 0.045); r = 0.08; }
  else if (ctP == 8) { c = vec3(0.68, 0.655, 0.60) * (0.9 + 0.15 * n); r = 0.9; }
  else if (ctP == 10) {
    // a torch flame: hottest at the core, always a faint ember, bright once the town lights up
    float core = 1.0 - clamp(length(vCtUv * vec2(1.6, 1.0)), 0.0, 1.0);
    c = mix(vec3(0.55, 0.12, 0.03), vec3(1.0, 0.72, 0.28), core) * (0.6 + 0.5 * n);
    r = 0.9;
  }
  else if (ctP == 11) {
    // tent canvas: dirty oatmeal, streaked with soot and rain
    float streak = wx_vnoise(vCtUv * vec2(9.0, 3.0) + ctS * 4.0);
    c = vec3(0.50, 0.465, 0.395) * (0.78 + 0.3 * streak) * (0.9 + 0.2 * wx_fbm(wp.xz * 0.9));
    c *= 1.0 - 0.25 * smoothstep(0.35, 0.0, wp.y - wt_groundHeight(wp.xz));
    r = 0.95;
  }
  else { c = vec3(0.22, 0.235, 0.245) * (0.85 + 0.3 * n); r = 0.45; }
  // windows and the recesses behind them pick up the baked torch field; the glass glows
  vec3 cn = normalize(cross(dFdx(wp), dFdy(wp)));
  if (ctP == 5 || ctP == 4 || ctP == 10) {
    vec3 gl = ct_light(wp, cn);
    if (ctP == 10) { e = (vec3(1.0, 0.44, 0.12) * 0.35 + vec3(1.0, 0.55, 0.2) * gl * 4.0) * (0.5 + 0.5 * n) * 3.2; c = vec3(0.35, 0.09, 0.02); }
    else { c += vec3(1.0, 0.52, 0.18) * gl * (ctP == 5 ? 3.2 : 0.7); e = vec3(1.0, 0.48, 0.16) * gl * (ctP == 5 ? 2.6 : 0.5); }
  }
  diffuseColor.rgb = c; ctR = r; ctE = e;
}
`;
export function createMiscMaterial() {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:misc', color: 0xffffff, roughness: 0.8, metalness: 0.05 });
  patchMaterial(m);
  addShaderHook(m, 'ctMisc', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.8; vec3 ctE = vec3(0.0);' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + MISC_FRAG);
    finish(sh, { emissive: true });
  });
  return m;
}

// ------------------------------------------------------------------------------------------------ paving
// aP.x: 0 cobbles · 1 flagstone slabs (square, gates, thresholds) · 2 rammed gravel / dirt (the gate aprons)
// aP.y: per-quad seed. Everything is drawn from the world position, so the pattern runs continuously across
// quads; the stone relief is shaded procedurally (there is no normal map: a coursed-wall normal map laid flat
// aliases into a moiré lattice at grazing angles).
const PAVE_FRAG = /* glsl */`
{
  vec3 wp = vWxWorldPos;
  ${part()}
  float cell = ctP == 1 ? 1.5 : ctP == 2 ? 0.0 : 0.34;
  float d1 = 9.0, d2 = 9.0; vec2 fid = vec2(0.0), fpt = vec2(0.0), fgp = vec2(0.0);
  if (cell > 0.0) {
    vec2 gp = wp.xz / cell;
    vec2 base = floor(gp);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cc = base + vec2(float(i), float(j));
        vec2 fp = cc + 0.13 + 0.74 * wx_hash22(cc + ctS * 3.0);
        float d = length(fp - gp);
        if (d < d1) { d2 = d1; d1 = d; fid = cc; fpt = fp; fgp = gp; }
        else if (d < d2) { d2 = d; }
      }
    }
  }
  float joint = ctP == 1 ? 0.05 : 0.1;                    // mortar width in cell units
  float stone = ctP == 2 ? 1.0 : smoothstep(joint * 0.45, joint * 1.55, d2 - d1);
  float tone = wx_hash12(fid * 2.7 + ctS * 5.0);
  vec3 c; float r;
  if (ctP == 2) {
    float g = wx_vnoise(wp.xz * 7.0 + ctS * 2.0);
    c = mix(vec3(0.19, 0.165, 0.125), vec3(0.29, 0.255, 0.195), g);
    r = 0.99;
  } else {
    // stone body: cool grey with per-stone warmth, over dark damp mortar (flagstones read warmer and darker)
    vec3 sc = mix(vec3(0.30, 0.295, 0.285), vec3(0.42, 0.405, 0.37), tone);
    if (ctP == 1) sc *= vec3(0.93, 0.90, 0.85);
    vec3 mc = vec3(0.115, 0.105, 0.09);
    c = mix(mc, sc, stone);
    // mud and dust settle in the joints
    float mud = wx_fbm(wp.xz * 0.5);
    c = mix(c, vec3(0.19, 0.16, 0.115), clamp(mud * (1.0 - stone) * 1.4, 0.0, 0.55));
    // worn cart ruts down each street, polished and slightly darker
    float rut = exp(-pow((abs(wp.z) - 3.1) / 1.05, 2.0)) + exp(-pow((abs(wp.x) - 2.9) / 1.05, 2.0));
    rut *= smoothstep(46.0, 40.0, abs(wp.x)) + smoothstep(46.0, 40.0, abs(wp.z));
    r = 0.94 - 0.42 * rut * stone;
    c *= 1.0 - 0.12 * clamp(rut, 0.0, 1.0);
    // big damp patches (the square is shaded, the gates are draughty)
    float damp = wx_fbm(wp.xz * 0.12 + 7.0);
    c *= mix(0.9, 1.06, smoothstep(0.42, 0.62, damp));
    // a few tufts of grass pushing up between the stones
    float tuft = smoothstep(0.76, 0.96, wx_vnoise(wp.xz * 3.4 + 19.0)) * (1.0 - stone) * step(0.55, wx_hash12(floor(wp.xz * 0.8)));
    c = mix(c, vec3(0.12, 0.155, 0.07), tuft * 0.55);
  }
  diffuseColor.rgb = c; ctR = r;
  // shade each stone as a dome: tilt the normal away from the stone's centre (applied after <normal_fragment_maps>)
  if (cell > 0.0) ctTilt = vec3(fgp.x - fpt.x, 0.0, fgp.y - fpt.y) * stone * 0.22;
}
`;
const PAVE_NORMAL = /* glsl */`
#include <normal_fragment_maps>
normal = normalize(normal + (viewMatrix * vec4(ctTilt, 0.0)).xyz);
`;
export function createPavingMaterial(set) {
  const m = new THREE.MeshStandardMaterial({ name: 'cit:paving', roughness: 1, metalness: 0, color: 0xffffff });
  patchMaterial(m, { wetBias: 0 });
  addShaderHook(m, 'ctPaving', (sh) => {
    preamble(sh, { scratch: 'float ctR = 0.9; vec3 ctTilt = vec3(0.0);' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + PAVE_FRAG)
      .replace('#include <normal_fragment_maps>', PAVE_NORMAL);
    finish(sh);
  });
  return m;
}

/** Load every texture set once and build the six materials. */
export async function createCitadelMaterials(loadPBR, { stoneFactory = createStoneMaterial } = {}) {
  const ids = ['japanese_stone_wall', 'weathered_planks', 'ceramic_roof_01'];
  const sets = await Promise.all(ids.map((id) => loadPBR(id).catch((e) => { console.warn('[citadel] texture failed', id, e); return null; })));
  const [stoneSet, timberSet, roofSet] = sets;
  const mats = {
    stone: stoneFactory(stoneSet),
    timber: createTimberMaterial(timberSet),
    plaster: createPlasterMaterial(stoneSet),
    roof: createRoofMaterial(roofSet),
    misc: createMiscMaterial(),
    paving: createPavingMaterial(stoneSet),
  };
  mats.dispose = () => { for (const k of ['stone', 'timber', 'plaster', 'roof', 'misc', 'paving']) mats[k].dispose(); };
  return mats;
}
