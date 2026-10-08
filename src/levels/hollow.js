// 枯林圣堂: four encounters along the churchyard → nave → altar route.
// Explicit spawn points keep each encounter on the same side of the chapel walls as the hero.
//
// The paving mask below is read by the terrain bake (src/world/terrain-bake.js): inside it the grass is killed and
// the splat is forced to bare dirt, so the chapel floor and the paths read as stone and mud rather than meadow.
export default {
  id: 'hollow', no: '副本', title: '枯林圣堂', en: '',
  tagline: '墓园 · 断墙 · 守誓者', enTagline: '',
  env: {
    mood: 'blue', u: 0.8, drift: true, wind: 1.15, exposure: 1.8, wet: 0.3,
    victoryMood: null,
  },
  terrain: {
    swell: 4.6, swellFreq: 0.0036, undul: 1.1, undulFreq: 0.019, hummock: 0.16,
    knollH: 1.4, knollR: 30, sunRidge: 0, rim: 62, edgeRise: 6, siteFlatten: 0.9,
  },
  biome: {
    grassDensity: 0.24, drySpread: 0.62, dirt: 0.16, heroTree: false, pines: 0,
    band: 2000, flowers: false, plumes: false, citadel: false, citizens: 0, props: false,
    deadwood: 66,                                     // read by scenes/hollow.js: how many dead trees to plant
  },
  layout: {
    arenaRadius: 60, playableRadius: 60,
    playerSpawn: { x: 0, z: 33, yaw: Math.PI },
    rockOutcrops: [], standingStones: [], enemySpawns: [],
    road: [[0, 160], [0, 90], [0, 40], [0, 24], [0, 12]], roadWidth: 4,
  },
  waves: [
    { title: '墓园伏兵', sub: 'Ambush in the Churchyard', enemies: ['bandit', 'bandit', 'spearman'],
      spawns: [{ x: -2, z: 18 }, { x: 2, z: 18 }, { x: 0, z: 15 }],
      trigger: { x: 0, z: 18, r: 6, hint: '穿过墓园木门，沿石径前行' },
      checkpoint: { x: 0, z: 21, yaw: Math.PI }, wind: 1.15, maxAttackers: 2 },
    { title: '断墙围猎', sub: 'Hunters among the Ruins', enemies: ['shieldman', 'bandit', 'spearman', 'archer'],
      spawns: [{ x: -5, z: 14 }, { x: 5, z: 15 }, { x: -3, z: 18 }, { x: 6, z: 20 }],
      trigger: { x: 0, z: 17, r: 7, hint: '回到圣堂南门前，清除墓园守卫' },
      checkpoint: { x: 0, z: 20, yaw: Math.PI }, wind: 1.25, maxAttackers: 2 },
    { title: '中殿残影', sub: 'Shadows in the Nave', enemies: ['bandit_heavy', 'shieldman', 'spearman', 'archer'],
      spawns: [{ x: -7, z: -2 }, { x: -2, z: -2 }, { x: 4, z: -2 }, { x: 8, z: 2 }],
      trigger: { x: 0, z: 2.5, r: 3, hint: '穿过圣堂南门，进入中殿' },
      checkpoint: { x: 0, z: 3, yaw: Math.PI }, wind: 1.35, maxAttackers: 2 },
    { title: '祭坛守誓', sub: 'The Last Oath', enemies: ['swordmaster'],
      spawns: [{ x: 14.4, z: 0 }],
      trigger: { x: 10.4, z: 0, r: 3.2, hint: '沿中殿向东，前往石祭坛' },
      checkpoint: { x: 8, z: 0, yaw: Math.PI / 2 },
      wind: 1.5, windPhase2: 1.9, boss: true, maxAttackers: 1,
      name: '枯林守誓者', bossSub: 'Oathkeeper of the Hollow' },
  ],
  next: null,
};

/** Leave room to dodge and give melee enemies an unobstructed route to the hero. */
export function hollowCombatClearance(x, z, margin = 0) {
  return (Math.abs(x) < 8.1 + margin && z > 12 - margin && z < 22 + margin)
    || (x > -11.3 - margin && x < 15.5 + margin && Math.abs(z) < 3.3 + margin);
}

/** The chapel, the churchyard floor and the paths: stone and mud, never grass. Local, yaw 0, entry from +z. */
export function hollowPaved(x, z) {
  if (x > -13.8 && x < 13.6 && Math.abs(z) < 10.3) return true;        // nave + both aisles
  if (x >= 13.6 && x < 25.9 && Math.abs(z) < 4.9) return true;         // chancel + apse
  if (Math.abs(x) < 2.6 && z > 9 && z < 40) return true;              // gate → south door
  if (x > -22 && x < 26 && z > -20 && z < 22) {                        // the churchyard: mud and graves
    if (Math.abs(x) < 2.6 && z > 6) return true;                        // the path down to the gate
    if (Math.hypot(x - 3, z + 1) > 9 && Math.hypot(x + 3, z + 1) > 9 && z < -7) return true;
  }
  if (Math.abs(x) < 2.6 && z >= 22 && z < 40) return true;              // the approach through the trees
  return false;
}
