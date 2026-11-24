import { ATTACK_RANGE } from './constants.js';

export const labels = {
  hpMax: 'HP',
  attack: 'Ataque',
  defense: 'Defensa',
  speed: 'Velocidad',
  size: 'Tamaño',
  attackSpeed: 'Velocidad de ataque',
  range: 'Rango de ataque',
};
// Crea un conjunto independiente de bonos permanentes con todos sus valores a cero.
export const emptyBonuses = () => ({
  hpMax: 0,
  attack: 0,
  defense: 0,
  speed: 0,
  size: 0,
  attackSpeed: 0,
  range: 0,
});
// Limita el nivel efectivo al máximo de la especie.
export const levelFor = (species, progressionLevel) =>
  Math.min(species.maxLevel, progressionLevel);
// Calcula la progresión de los salvajes a partir de la dificultad de la misión.
export const enemyProgress = (progressionLevel) => 5 + Math.round((progressionLevel - 5) * 1.6);
// Combina alcance y tamaño para obtener la distancia real de ataque.
export const attackReach = (stats) => (stats.range * stats.size) / 100;
// Convierte velocidad en un multiplicador de movimiento y animación.
export const movementRate = (speed) => 0.85 + speed / 150;

// La rama positiva de tanh crece con rendimientos decrecientes. Un 9 mantiene
// el ritmo original de la animación; su fotograma de impacto escala con ella.
export const attackRate = (score) =>
  1 + 1.5 * (Math.tanh((score - 5) / 65) - Math.tanh(4 / 65));

// Calcula un atributo de la especie antes de equipo, beneficios o ajustes del líder.
function naturalStat(species, statKey, level) {
  if (statKey === 'range') return species.stats.range ?? ATTACK_RANGE;
  if (statKey === 'size') return species.stats.size;
  if (statKey === 'hpMax') {
    const startingHP =
      species.dex === 292 ? 1 : Math.floor(species.stats.hpMax / 10) + 15;
    return Math.max(1, startingHP + level - 5);
  }
  const value = Math.floor((2 * species.stats[statKey] * level) / 100) + 5;
  // El crecimiento natural deja un punto de margen para bonos y líderes.
  return statKey === 'speed' || statKey === 'attackSpeed'
    ? Math.min(179, value)
    : value;
}

// Combina nivel, especie, escalado de líder y bonos, y aplica los límites de cada atributo.
export function statsFor(
  species,
  progressionLevel,
  bonuses = {},
  isBoss = false,
  isWild = isBoss,
) {
  const level = levelFor(species, isWild ? enemyProgress(progressionLevel) : progressionLevel);
  const result = {};
  for (const statKey of Object.keys(labels)) {
    // Los PV del líder parten exactamente de la curva anterior antes del ×10.
    const statLevel =
      isBoss && statKey === 'hpMax' ? levelFor(species, progressionLevel) : level;
    let value = naturalStat(species, statKey, statLevel);
    if (isBoss) {
      // progress = misión + 4. Los límites suben al empezar cada bloque de cuatro misiones.
      const tier = Math.max(0, Math.floor((progressionLevel - 5) / 4));
      const limits = {
        hpMax: 38 + tier * 12,
        attack: 16 + tier * 10,
        defense: 16 + tier * 7,
        speed: 20 + tier * 5,
        attackSpeed: 16 + tier * 3,
        size: 185 + tier * 2,
        range: 30 + tier,
      };
      const factors = {
        hpMax: 1.5 + Math.min(1, tier * 0.12),
        attack: 1.15 + Math.min(0.95, tier * 0.14),
        defense: 1.15 + Math.min(0.5, tier * 0.075),
        speed: 1.1,
        attackSpeed: 1.1,
        size: 1.45,
        range: 1.15,
      };
      value = Math.min(limits[statKey], Math.ceil(value * factors[statKey]));
      if (statKey === 'hpMax') value *= 4;
    }
    value += bonuses[statKey] || 0;
    result[statKey] =
      statKey === 'speed' || statKey === 'attackSpeed'
        ? Math.max(5, Math.min(180, value))
        : Math.max(statKey === 'size' ? 40 : 1, value);
  }
  return result;
}

// Calcula el daño de un golpe normal a partir de nivel, ataque, defensa y crítico.
export function damageFor(attacker, target, critical) {
  const power = attacker.boss
    ? 40 + Math.min(30, Math.max(0, attacker.level - 8))
    : 40;
  const baseDamage =
    Math.floor(
      (((2 * attacker.level) / 5 + 2) * power * attacker.stats.attack) /
        target.stats.defense /
        50,
    ) + 2;
  const damage = Math.floor(baseDamage * (critical ? 1.5 : 1));
  return Math.max(1, damage);
}
