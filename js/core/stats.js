import { ATTACK_RANGE } from './constants.js';

export const chanceBases = {evasion:5,block:0,critical:10};
// Las probabilidades se almacenan en puntos y se convierten sólo al tirar.
export const limitStat = (key,value) => key in chanceBases ? Math.max(0,Math.min(key==='evasion'?50:100,value)) :
  Math.max(5,['speed','attackSpeed'].includes(key)?Math.min(200,value):value);
export const statText = (key,value) => String(value)+(key in chanceBases?'%':'');
export const labels = {
  evasion:'Evasión',block:'Bloqueo crítico',critical:'Ataque crítico',
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
  evasion:0, block:0, critical:0,
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
export const enemyProgress = (progressionLevel) => 5 + Math.round((progressionLevel - 5) * 1.6 + Math.max(0,progressionLevel-8)*1.7);
// Combina alcance y tamaño para obtener la distancia real de ataque.
export const attackReach = (stats) => (stats.range * stats.size) / 100;
// Convierte velocidad en un multiplicador de movimiento y animación.
export const movementRate = (speed) => 0.85 + speed / 150;

// A 5, la hoja avanza a un cuarto de su cadencia. A 200 alcanza 2,5 veces la cadencia.
export function attackRate(score) {
  const progress=(limitStat('attackSpeed',score)-5)/195;
  return .25+2.25*progress*(2-progress);
}

// Calcula un atributo de la especie antes de equipo, beneficios o ajustes del líder.
function naturalStat(species, statKey, level) {
  // Las fichas antiguas sin rango explícito comparten el alcance estándar del combate.
  if (statKey === 'range') return species.stats.range ?? ATTACK_RANGE;
  if (statKey === 'size') return species.stats.size;
  if (statKey === 'hpMax') {
    const startingHP =
      species.dex === 292 ? 1 : Math.floor(species.stats.hpMax / 10) + 15;
    return Math.max(1, startingHP + level - 5);
  }
  const value = Math.floor((2 * species.stats[statKey] * level) / 100) + (statKey==='attackSpeed'?15:5);
  // El crecimiento natural deja un punto de margen para bonos y líderes.
  return statKey === 'speed' || statKey === 'attackSpeed'
    ? Math.min(200, value)
    : value;
}

// Combina nivel, especie, escalado de líder y bonos, y aplica los límites de cada atributo.
export function statsFor(
  species,
  progressionLevel,
  bonuses = {},
  isBoss = false,
  isWild = isBoss,
  effectiveLevel,
) {
  const level = effectiveLevel ?? levelFor(species, isWild ? enemyProgress(progressionLevel) : progressionLevel);
  const result = {};
  for (const statKey of Object.keys(labels)) {
    if(statKey in chanceBases){result[statKey]=limitStat(statKey,chanceBases[statKey]+(bonuses[statKey]??0));continue;}
    // Los PV del líder parten exactamente de la curva anterior antes del ×10.
    const statLevel =
      effectiveLevel==null && isBoss && statKey === 'hpMax' ? levelFor(species, progressionLevel) : level;
    let value = naturalStat(species, statKey, statLevel);
    // El ajuste inicial pertenece al jugador; los bonos adquiridos se suman íntegros.
    if (!isWild) value -= Math.round(naturalStat(species,statKey,5)*.2);
    if (isWild && ['attack','defense','hpMax'].includes(statKey))
      value = Math.round(value*(1 + Math.max(0,progressionLevel-8)*.035));
    if (isBoss) {
      // progress = misión + 4. Los límites suben al empezar cada bloque de cuatro misiones.
      const tier = Math.max(0, Math.floor((progressionLevel - 5) / 4));
      const limits = {
        hpMax: 38 + tier * 12,
        attack: 16 + tier * 10,
        defense: 16 + tier * 7,
        speed: 20 + tier * 5,
        attackSpeed: 48 + tier * 9,
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
    if (!isWild && statKey==='size' && species.dex===132) value=100;
    value += bonuses[statKey] || 0;
    result[statKey] = limitStat(statKey,value);
  }
  return result;
}

// La defensa absorbe una fracción del golpe: daño = ataque × 100 / (100 + defensa).
// Con 375 de ataque y 80 de defensa son 208 PV antes de afinidad o bloqueo.
// Un crítico multiplica el resultado por 1,5. El nivel ya influye a través de los atributos.
export function damageFor(attacker, target, critical) {
  return Math.max(1, Math.round(attacker.stats.attack * 100 / (100 + target.stats.defense) * (critical ? 1.5 : 1)));
}
