import { MAX_HP } from './constants.js';

export const labels = {
  size: 'Tamaño', speed: 'Velocidad de movimiento', atkdmg: 'Daño',
  range: 'Rango de ataque', atkspeed: 'Velocidad de ataque',
  chargedmg: 'Daño de carga', chargespeed: 'Velocidad de carga',
};

export function initialStats() {
  return { hpMax: MAX_HP, size: 5, speed: 4, atkdmg: 1, atkspeed: 4, range: 4, chargedmg: 2, chargespeed: 4 };
}

export const clampStat = (key, value) => Math.max(1, Math.min(key === 'hpMax' ? 20 : 10, value));
export const sizeScale = stats => 1 + 0.10 * (stats.size - 5);
export const rate = level => 1 + 0.20 * (level - 4);
export const rangeScale = level => 1 + 0.10 * (level - 4);

// Los modificadores de piso se suman a los permanentes antes de aplicar los límites.
export function refreshStats(player) {
  for (const key of Object.keys(player.baseStats)) {
    player.stats[key] = clampStat(key, player.baseStats[key] + (player.floorStats[key] || 0));
  }
}
