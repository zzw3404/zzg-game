// 石城 · citadel — a standalone level for the medieval town review scene (?scene=citadel&level=citadel).
// NOT part of the journey (kept out of LEVEL_ORDER): it has no waves at all — the scene runs the game in
// 'explore' state, so there is no combat. PURE data (no three.js): the terrain workers import it through
// world/layout.js, so every number the bake reads has to live here.
//
// The walled town: a rectangular curtain wall with a gate in the middle of each side, a cross of two streets
// meeting at the market square, houses and landmarks in the four quarters. Coordinates in metres, +x east,
// +z south, the market square at the origin. `layout.citadel` is the single source of truth read by
// world/citadel.js (geometry) and world/terrain-bake.js (grass keep-out on the paving).

/**
 * Is (x, z) on the cobbles? The two streets, the market square, the lane round the inside of the wall and the
 * four gate passages. Shared by the paving mesh (world/citadel.js) and the terrain bake's grass keep-out
 * (world/terrain-bake.js) so the grass never grows through a stone.
 *    citadelPaved(x, z, spec)   spec = layout.citadel
 */
export function citadelPaved(x, z, C) {
  const S = C.street, P = C.plaza, W = C.wall, O = C.outer;
  // the three shops are enterable: their footprints are floored (and kept free of grass) like the streets —
  // the shop interiors are at x ≈ -49 / -40.5 / -32, z ≈ -10.6 with a 7.4 × 9.2 plan
  for (const sx of [-49, -40.5, -32]) if (Math.abs(x - sx) < 4.2 && Math.abs(z + 10.6) < 5.1) return true;
  // 练习场 (the training yard, south-east quarter) and 军队大营 (the army camp outside the east gate) are trodden
  // gravel, not grass — the kit builds their fences and buildings on top of this.
  if (x > 28 && x < 52 && z > 9 && z < 27) return true;
  if (x > 70 && x < 106 && z > 5 && z < 35) return true;
  // the gate passages and the strips outside them (the road shoulders) run past the wall faces
  const apron = 5.5;
  const inGateEW = Math.abs(z) < S.w * 0.5 + 0.9 && Math.abs(x) < O.x + apron;
  const inGateNS = Math.abs(x) < S.w2 * 0.5 + 0.9 && Math.abs(z) < O.z + apron;
  if (inGateEW || inGateNS) return true;
  if (Math.abs(x) > O.x || Math.abs(z) > O.z) return false;      // outside the walls: nothing but the aprons
  const laneX = O.x - W.t - S.ringInset - S.ring;                // inner edge of the lane round the wall
  const laneZ = O.z - W.t - S.ringInset - S.ring;
  if (Math.abs(x) > laneX || Math.abs(z) > laneZ) return true;
  if (Math.abs(x - P.x) < P.w * 0.5 + 1.6 && Math.abs(z - P.z) < P.d * 0.5 + 1.6) return true;
  // the market square widens into the two street mouths
  return Math.abs(x - P.x) < P.w * 0.5 + 6 && Math.abs(z) < S.w * 0.5 + 0.9;
}
export default {
  id: 'citadel', no: '自由城邦', title: '石闸堡', en: '',
  tagline: '四门各通一路', enTagline: '',
  env: { mood: 'afternoon', u: 0.6, drift: true, wind: 0.9, victoryMood: null },
  layout: {
    arenaRadius: 300, playableRadius: 300,
    // inside the west gate, facing east up the main street toward the market square and the guild hall
    playerSpawn: { x: -42, z: 0, yaw: Math.PI / 2 },
    // the knoll pad is reused as a flat pad under the market square (padR = flat radius, r = ramp-out)
    knoll: { x: 0, z: 0, r: 13, padR: 13 },
    duelCircle: { x: 0, z: 0, r: 20 },
    oldTree: { x: 900, z: 900, r: 0.5, crown: 2 },      // no lone golden tree here (code reads it)
    stele: { x: 900, z: -900, r: 0.5, yaw: 0 },
    pavilion: { x: -900, z: 900, r: 4, yaw: 0 },
    graves: [], cairn: { x: 900, z: 900, r: 0.5 }, higanbana: [],
    rockOutcrops: [
      { x: -150, z: -120, r: 9, size: 4.6, n: 3 },
      { x: 165, z: 95, r: 11, size: 5.2, n: 4 },
      { x: -95, z: 140, r: 8, size: 4.0, n: 3 },
    ],
    standingStones: [],
    // one straight-ish road in from the west and out to the east (the terrain grades and dirties it; inside the
    // walls the cobbled paving covers it; the north and south roads are cut by the citadel's own paving)
    road: [
      [-640, 9], [-400, 4], [-220, 1.4], [-120, 0.5], [-62, 0], [0, 0], [62, 0], [120, 0.5], [220, 1.4], [400, 4], [640, 9],
    ],
    roadWidth: 7,
    roadMarkers: [],
    enemySpawns: [],
    views: {
      hero: { pos: [-42, 1.7, 0], target: [0, 3.2, 0] },
      aerial: { pos: [96, 74, 132], target: [0, 0, 0] },
    },
    citadel: {
      outer: { x: 62, z: 47 },                          // outer face half-extents of the curtain wall
      wall: { t: 3.4, walk: 6.8, merlon: 1.3, gap: 1.0, parapetIn: 0.5, plinth: 0.8 },
      gate: { ow: 2.9, rise: 2.6, bay: 4.9, towerW: 5.4, towerD: 7.0, towerH: 12.8, project: 2.0 },
      corner: { r: 4.4, h: 12.0 },
      street: { w: 10, w2: 8.6, ringInset: 6.5, ring: 6 },
      plaza: { x: 0, z: 0, w: 34, d: 26 },
    },
    // The walkable space for the townsfolk (world/citizens.js). It reuses the Jiangnan town's model — a street
    // band along x, a rectangular square, alley corridors — plus the additive `cross` band for the north–south
    // street, so the crowd strolls both streets and out through all four gates.
    town: {
      street: { x0: -104, x1: 122, width: 10 },
      plaza: { x: 0, z: 0, w: 34, d: 26 },
      frontage: 5.6,
      depth: 10,
      alleys: [-30, -13, 14, 31],
      canal: null,
      cross: { x: 0, width: 8.6, z0: -52, z1: 52 },
    },
  },
  // broad plateau: the site is flat under the town, rolling fields and low hills away from it
  terrain: { swell: 3.4, swellFreq: 0.0042, undul: 0.5, undulFreq: 0.02, hummock: 0.06, knollH: 0, knollR: 30, sunRidge: 0, rim: 58, edgeRise: 4, siteFlatten: 1.0 },
  biome: {
    grassDensity: 0.7, drySpread: 0.12, dirt: 0.03, leafCarpet: null,
    heroTree: false, pines: 3, band: 2600, flowers: false, plumes: false, bamboo: null,
    props: { stele: false, markers: false, graves: false, cairn: false, pavilion: false },
    citadel: true,                                    // world/terrain-bake.js: no grass on the paving
    citizens: 30,                                     // townsfolk (world/citizens.js, scaled by quality)
  },
  waves: [],                                          // no combat: nothing to fight, no director beats
  next: null,
};
