// Weathered chapel masonry: preserve the scanned stone, its pores and recessed mortar.
import * as THREE from 'three';
import { addShaderHook, patchMaterial } from '../core/atmosphere.js';
import { U } from '../core/glsl.js';
import { TOWN_LIGHT_GLSL } from './town-mat.js';

export function createHollowStoneMaterial(set) {
  const m = new THREE.MeshStandardMaterial({
    name: 'hollow:weathered-stone', color: set?.map ? 0xffffff : 0x77786e,
    map: set?.map ?? null, normalMap: set?.normalMap ?? null,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: set?.armMap ?? null, aoMap: set?.armMap ?? null,
    aoMapIntensity: 0.85, roughness: 1, metalness: 0,
  });
  // Porous masonry stays matte in the evening damp; wall-foot darkening is handled below.
  patchMaterial(m, { wetBias: -0.25 });
  addShaderHook(m, 'hollowStone', (sh) => {
    sh.vertexShader = sh.vertexShader.replace('void main() {',
      'attribute vec2 aP; varying vec2 vHollowPart;\nvoid main() {\nvHollowPart = aP;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `${TOWN_LIGHT_GLSL}\n${U('float', 'uCitLightK')}\nvarying vec2 vHollowPart;\nvoid main() {`)
      .replace('#include <map_fragment>', /* glsl */`
#include <map_fragment>
{
  vec3 wp = vWxWorldPos;
  float above = max(0.0, wp.y - wt_groundHeight(wp.xz));
  float part = floor(vHollowPart.x + 0.5);
  float variation = wx_hash12(vec2(vHollowPart.y, 19.7));
  // Keep the texture's mineral colour and fine grain instead of remapping it to flat luminance.
  diffuseColor.rgb *= 1.45 * mix(0.92, 1.08, variation) * vec3(0.97, 1.0, 0.96);
  if (part == 1.0) diffuseColor.rgb *= vec3(0.76, 0.78, 0.71);
  if (part == 2.0) diffuseColor.rgb *= 1.12;
  float damp = (1.0 - smoothstep(0.1, 1.7, above)) * (0.65 + 0.35 * wx_vnoise(wp.xz * 0.8));
  diffuseColor.rgb *= 1.0 - 0.27 * damp;
  float pockets = 1.0 - smoothstep(0.10, 0.27, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
  float moss = smoothstep(0.50, 0.76, wx_fbm(wp.xz * 1.3 + wp.y * 0.22))
    * (1.0 - smoothstep(0.3, 3.1, above)) * (0.3 + 0.7 * pockets);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.64, 0.78, 0.45), moss * 0.62);
  float streak = smoothstep(0.62, 0.88, wx_vnoise(wp.xz * 4.2 + wp.y * 0.045));
  diffuseColor.rgb *= 1.0 - streak * 0.10;
}
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * 1.12, 0.72, 1.0);')
      .replace('#include <lights_fragment_end>', /* glsl */`
#include <lights_fragment_end>
reflectedLight.indirectDiffuse += material.diffuseColor
  * town_light(vWxWorldPos, inverseTransformDirection(normal, viewMatrix)) * uCitLightK;
`);
  });
  return m;
}
