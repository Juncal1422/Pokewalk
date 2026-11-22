import { MAX_HP } from './constants.js';

export const labels = {
  size: 'Tamaño', speed: 'Velocidad de movimiento', atkdmg: 'Daño',
  range: 'Rango de ataque', atkspeed: 'Velocidad de ataque',
  chargedmg: 'Daño de carga', chargespeed: 'Velocidad de carga',
};

export function initialStats() {
  return { size: 1, speed: 1, atkdmg: 1, range: 1, atkspeed: 1, chargedmg: 1, chargespeed: 1, hpMax: MAX_HP };
}

// El cuerpo máximo aún cabe por los pasillos de un tile (24 px).
export const sizeScale = stats => 1 + 0.075 * (Math.min(stats.size, 5) - 1);
export const rate = level => 1 + 0.25 * (Math.min(level, 5) - 1);
