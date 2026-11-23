import { ATTACK_RANGE } from './constants.js';

export const labels = { hpMax: 'HP', attack: 'Ataque', defense: 'Defensa', speed: 'Velocidad', size: 'Tamaño', attackSpeed: 'Velocidad de ataque', range: 'Rango de ataque' };
export const emptyBonuses = () => ({ hpMax: 0, attack: 0, defense: 0, speed: 0, size: 0, attackSpeed: 0, range: 0 });
export const levelFor = (species, progress) => Math.min(species.maxLevel, progress);
export const movementRate = speed => 0.85 + speed / 150;

// La rama positiva de tanh crece con rendimientos decrecientes. Un 9 mantiene
// el ritmo original de la animación; su fotograma de impacto escala con ella.
export const attackRate = score => 1 + 1.5 * (Math.tanh((score - 5) / 65) - Math.tanh(4 / 65));

function naturalStat(species, key, level) {
  if (key === 'range') return species.stats.range ?? ATTACK_RANGE;
  if (key === 'size') return species.stats.size;
  if (key === 'hpMax') {
    const startingHP = species.dex === 292 ? 1 : Math.floor(species.stats.hpMax / 10) + 15;
    return Math.max(1, startingHP + level - 5);
  }
  const value = Math.floor(2 * species.stats[key] * level / 100) + 5;
  // El crecimiento natural deja un punto de margen para bonos y líderes.
  return key === 'speed' || key === 'attackSpeed' ? Math.min(179, value) : value;
}

export function statsFor(species, progress, bonuses = {}, boss = false) {
  const level = levelFor(species, progress);
  const result = {};
  for (const key of Object.keys(labels)) {
    let value = naturalStat(species, key, level);
    if (boss) {
      const peak = naturalStat(species, key, species.maxLevel);
      const factor = { hpMax: 1.25, attack: 1.1, defense: 1.1, speed: 1.1, attackSpeed: 1.1, size: 1.6, range: 1.2 }[key];
      value = Math.max(peak + 1, Math.ceil(peak * factor));
    }
    value += bonuses[key] || 0;
    result[key] = key === 'speed' || key === 'attackSpeed' ? Math.max(5, Math.min(180, value)) :
      Math.max(key === 'size' ? 40 : 1, value);
  }
  return result;
}

export function damageFor(attacker, target, critical) {
  const power = 40;
  const base = Math.floor((2 * attacker.level / 5 + 2) * power * attacker.stats.attack / target.stats.defense / 50) + 2;
  return Math.max(1, Math.floor(base * (critical ? 1.5 : 1)));
}
