export const labels = { hpMax: 'HP', attack: 'Ataque', defense: 'Defensa', speed: 'Velocidad' };
export const emptyBonuses = () => ({ hpMax: 0, attack: 0, defense: 0, speed: 0 });
export const levelFor = (species, progress) => Math.min(species.maxLevel, progress);
export const movementRate = speed => 0.85 + speed / 150;

// Fórmula simplificada de Pokémon, sin IV, EV ni naturaleza. Los bonos duran
// según su origen y se aplican después del cálculo por especie y nivel.
export function statsFor(species, progress, bonuses = {}, floor = {}, boss = false) {
  const level = levelFor(species, progress);
  const result = {};
  for (const key of Object.keys(labels)) {
    let value = Math.floor(2 * species.stats[key] * level / 100) + (key === 'hpMax' ? level + 10 : 5);
    if (species.dex === 292 && key === 'hpMax') value = 1;
    if (boss) value = Math.ceil(value * ({ hpMax: 3, attack: 2, defense: 1.25, speed: 1.2 })[key]);
    value += (bonuses[key] || 0) + (floor[key] || 0);
    result[key] = key === 'speed' ? Math.max(5, Math.min(180, value)) : Math.max(1, value);
  }
  return result;
}

export function damageFor(attacker, target, critical) {
  const power = 40;
  const base = Math.floor((2 * attacker.level / 5 + 2) * power * attacker.stats.attack / target.stats.defense / 50) + 2;
  return Math.max(1, Math.floor(base * (critical ? 1.5 : 1)));
}
