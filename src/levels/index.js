// Levels: each is one self-contained definition — layout overrides, terrain shape, biome (which world modules and
// how), environment (mood, storm, rain, lightning), the wave list and the next level. Owner: integrator.
// PURE data module (no three.js): the terrain workers import it through world/layout.js.
//
//   LEVELS[id] = { id, no, title, en, layout?, terrain?, biome?, env, waves, spawn?, next? }
//   LEVEL_ORDER               the journey, in order
//   levelIdFromEnv()          ?level= on the page (default: the first level); workers get theirs in each job
//   getLevel(id) / LEVEL (the page's level, main thread)
//   levelUrl(id)              same page, same query, another level (quality, audio… params survive)
//   progress: markCleared(id), clearedLevels()   (localStorage 'wx.levels')
import steppe from './steppe.js';
import bamboo from './bamboo.js';
import town from './town.js';
import citadel from './citadel.js';
import hollow from './hollow.js';

// LEVELS holds every level; LEVEL_ORDER is the journey. citadel (the home town) and hollow (the instance behind
// its south gate) are standalone hub destinations, outside the three-chapter journey.
export const LEVELS = { steppe, bamboo, town, citadel, hollow };
export const LEVEL_ORDER = ['steppe', 'bamboo', 'town'];

export function levelIdFromEnv() {
  try {
    // a worker's location is its script URL (no ?level=): it defaults here and is told its level with each job
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const id = q.get('level') ?? { town: 'town', citizens: 'town', hollow: 'hollow' }[q.get('scene')];
    if (id && LEVELS[id]) return id;
  } catch { /* no location */ }
  return LEVEL_ORDER[0];
}
export const getLevel = (id) => LEVELS[id] ?? LEVELS[LEVEL_ORDER[0]];
export const LEVEL = getLevel(levelIdFromEnv());

export function levelUrl(id) {
  const q = new URLSearchParams(location.search);
  q.set('level', id);
  q.delete('wave');
  return `${location.pathname}?${q.toString()}`;
}
export function clearedLevels() {
  try { return JSON.parse(localStorage.getItem('wx.levels') || '[]'); } catch { return []; }
}
export function markCleared(id) {
  try { const s = new Set(clearedLevels()); s.add(id); localStorage.setItem('wx.levels', JSON.stringify([...s])); } catch { /* ignore */ }
}
