// Persistent save for the town loop: gear, purse, which instances are cleared and their rewards.
// Owner: integrator. One localStorage key, plain JSON, defensive on read (a bad blob never breaks a scene).
//
//   const S = loadSave()          → the live object (mutate it, then save())
//   save()                        → write it back
//   grant(instance)               → the one-off clear reward for an instance (see REWARDS)
//   addGear({ gold, potions, … }) → fold a mutation into the save
import { bus } from '../core/bus.js';

const KEY = 'wx.save';

/** Clear rewards, in gold and draughts. Keyed by level id (the instance the gate leads to). */
export const REWARDS = {
  steppe: { gold: 120, potions: 1, name: 'Windmere Steppe' },
  bamboo: { gold: 180, potions: 2, name: 'The Nightwood' },
  town: { gold: 260, potions: 2, name: 'Lantern Street' },
  hollow: { gold: 220, potions: 2, name: '枯林圣堂' },
};

const DEFAULTS = () => ({ gold: 260, weapon: 1, armour: 0, potions: 1, cleared: {}, claimed: {} });

let cache = null;

export function loadSave() {
  if (cache) return cache;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  cache = { ...DEFAULTS(), ...(raw && typeof raw === 'object' ? raw : {}) };
  cache.cleared = { ...(cache.cleared ?? {}) };
  cache.claimed = { ...(cache.claimed ?? {}) };
  for (const k of ['gold', 'weapon', 'armour', 'potions']) if (!Number.isFinite(cache[k])) cache[k] = DEFAULTS()[k];
  return cache;
}

export function save() {
  const S = loadSave();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: run without a save */ }
  bus.emit('save:changed', { ...S });
  return S;
}

export function resetSave() {
  cache = DEFAULTS();
  save();
  return cache;
}

/** Mark an instance cleared and, the first time only, hand out its reward. */
export function grant(instance) {
  const S = loadSave();
  const R = REWARDS[instance] ?? { gold: 100, potions: 1 };
  S.cleared[instance] = (S.cleared[instance] ?? 0) + 1;
  let got = null;
  if (!S.claimed[instance]) {
    S.claimed[instance] = true;
    S.gold += R.gold ?? 0;
    S.potions += R.potions ?? 0;
    got = { gold: R.gold ?? 0, potions: R.potions ?? 0 };
  }
  save();
  return got;
}

/** Copy the save into a player's gear (called when a scene builds its hero). */
export function applyTo(player) {
  const S = loadSave();
  if (!player?.gear) return S;
  player.gear.gold = S.gold;
  player.gear.weapon = S.weapon;
  player.gear.armour = S.armour;
  player.gear.potions = S.potions;
  return S;
}

/** Read a player's gear back into the save. */
export function captureFrom(player) {
  const S = loadSave();
  if (!player?.gear) return S;
  S.gold = player.gear.gold;
  S.weapon = player.gear.weapon;
  S.armour = player.gear.armour;
  S.potions = player.gear.potions;
  return save();
}
