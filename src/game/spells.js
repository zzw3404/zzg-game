// The three fire arts share one 100-point focus meter. Costs are exact thirds.
export const SPELLS = Object.freeze({
  1: Object.freeze({ name: '三逼火柱', cost: 1 / 3, short: '火柱' }),
  2: Object.freeze({ name: '六逼火粒', cost: 2 / 3, short: '火粒' }),
  3: Object.freeze({ name: '九逼火斩', cost: 1, short: '火斩' }),
});

export const spellCost = (index, max) => (SPELLS[index]?.cost ?? 1) * max;
