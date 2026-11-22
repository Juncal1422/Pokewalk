import { MAX_HP } from './constants.js';

export const labels = {
  size: 'Tamaño', speed: 'Velocidad de movimiento', atkdmg: 'Daño',
  range: 'Rango de ataque', atkspeed: 'Velocidad de ataque',
  chargedmg: 'Daño de carga', chargespeed: 'Velocidad de carga',
};

export function initialStats() {
  // Se crea una copia independiente al iniciar una run.

  return { hpMax: MAX_HP, size: 5, speed: 4, atkdmg: 1, atkspeed: 4, range: 4, chargedmg: 2, chargespeed: 4 };
}

export const powerStats = ['hpMax', 'atkdmg', 'chargedmg'];
export const clampStat = (key, value) => Math.max(1, Math.min(powerStats.includes(key) ? Number.MAX_SAFE_INTEGER : 10, value));
// Los rangos base siguen siendo editables. Solo las tres magnitudes absolutas
// crecen con la aventura, hasta el mayor entero exacto de JavaScript.
export function scaledStat(key, value, adventure) {
  return powerStats.includes(key)
    ? clampStat(key, Math.round(value * Math.pow(1.18, adventure))) : clampStat(key, value);
}
export const sizeScale = stats => 1 + 0.10 * (stats.size - 5);
export const rate = level => 1 + 0.20 * (level - 4);
export const rangeScale = level => 1 + 0.10 * (level - 4);

// Los modificadores de piso se suman a los permanentes antes de aplicar los límites.
export function refreshStats(player) {
  for (const key of Object.keys(player.baseStats)) {
    player.stats[key] = scaledStat(key, player.baseStats[key] + (player.floorStats[key] || 0), player.adventure);
  }
}

console.debug('[Stats] Escala exponencial habilitada para', powerStats);
