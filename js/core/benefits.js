import { gameTime } from './clock.js';
import { statsFor } from './stats.js';
import { game } from './state.js';

// Resuelve las combinaciones del catálogo sobre los beneficios equipados.
export function synergyActive(effect, held = game.held) {
  const rule = game.synergies.get(effect);
  return (
    !!rule &&
    (rule.items ?? []).every((id) => game.inventory.has(id)) &&
    rule.requires.every((id) => held.has(id)) &&
    (!rule.anyOf || rule.anyOf.some((id) => held.has(id)))
  );
}

// Devuelve la magnitud del beneficio si pertenece a la colección consultada.
export function amount(benefitId, heldBenefits = game.held) {
  return heldBenefits?.has(benefitId) ? game.benefits.get(benefitId).amount : 0;
}

// Las reglas de combate leen la colección del propietario de cada golpe.
export function combatBenefits(entity) {
  return entity.isPlayer ? game.held : entity.benefits;
}

// Los porcentajes se calculan de nuevo sobre la forma actual, nunca sobre
// el resultado de una transformación anterior.
export function playerStats(
  species,
  playerLevel,
  bonuses,
  heldBenefits = game.held,
) {
  const stats = statsFor(species, playerLevel, {
    ...bonuses,
    attack:
      (bonuses?.attack ?? 0) +
      (heldBenefits.has('champion') ? (game.mission?.championAttack ?? 0) : 0),
  });
  if (game.runRelics?.has('black_sash')) {
    // Una transformación fija un nuevo valor base al nivel de entrada de esa forma.
    const entryLevel =
      game.player?.dex === species.dex
        ? (game.defenseEntryLevel ?? 5)
        : playerLevel;
    const base = statsFor(species, entryLevel).defense;
    stats.attack += Math.floor(Math.max(0, stats.defense - base) / 2);
    stats.defense = Math.min(base, stats.defense);
  }
  const modifiers = {
    size: 0,
    hpMax: 0,
    attack: 0,
    range: 0,
    speed: 0,
    defense: 0,
    attackSpeed: 0,
  };
  for (const benefitId of heldBenefits) {
    for (const [statKey, value] of Object.entries(
      game.benefits.get(benefitId).stats ?? {},
    ))
      modifiers[statKey] += value;
  }
  if (heldBenefits.has('seer') && game.amuletUntil > gameTime()) {
    for (const statKey of ['attack', 'speed', 'attackSpeed'])
      modifiers[statKey] += 0.5;
  }
  if (synergyActive('royalCrown', heldBenefits))
    for (const key of Object.keys(modifiers))
      modifiers[key] += key === 'size' ? 0.5 : 0.15;
  for (const [statKey, modifier] of Object.entries(modifiers)) {
    stats[statKey] = Math.round(stats[statKey] * (1 + modifier));
    if (statKey === 'speed' || statKey === 'attackSpeed')
      stats[statKey] = Math.min(180, stats[statKey]);
  }
  // La cinta también convierte la mejora porcentual de defensa una vez calculada.
  if (game.runRelics?.has('black_sash')) {
    const entry =
      game.player?.dex === species.dex
        ? (game.defenseEntryLevel ?? 5)
        : playerLevel;
    const cap = statsFor(species, entry).defense;
    stats.attack += Math.floor(Math.max(0, stats.defense - cap) / 2);
    stats.defense = Math.min(stats.defense, cap);
  }
  if (game.runRelics?.has('debugger')) {
    for (const key of Object.keys(stats)) stats[key] *= 2;
    // Conserva el tamaño de la forma y aplica el extra de movilidad sobre la velocidad duplicada.
    stats.size *= 0.5;
    stats.speed = Math.round(stats.speed * 1.5);
  }
  return stats;
}

// Cuerno y Punzante comparten el ataque direccional. Los otros tres lo sustituyen entero.
const directionalWeapons = new Set(['spiky', 'rhyhorn_horn']);
const exclusiveWeapons = new Set(['acuatic', 'ancient', 'rock_thrower']);
function weaponConflict(owned, incoming) {
  if (exclusiveWeapons.has(incoming)) return directionalWeapons.has(owned) || exclusiveWeapons.has(owned);
  return directionalWeapons.has(incoming) && exclusiveWeapons.has(owned);
}

// Calcula en copias el coste, los atributos y las activas que resultarían de elegir una tarjeta.
export function projectReward(state, option) {
  const heldBenefits = new Set(state.held),
    bonuses = { ...state.bonuses },
    balances = { ...state.balances };
  const benefit = game.donors.get(option.row.name);
  // Una sustitución libera una plaza incluso cuando el inventario ya contiene 27 beneficios.
  const conflicts = [...heldBenefits].filter(id => benefit && (
    weaponConflict(id, benefit.id) || (benefit.active && game.benefits.get(id).slot === benefit.slot)
  ));
  const allStats = option.bonus || heldBenefits.has(benefit?.id) || (heldBenefits.size >= 27 && !conflicts.length);
  const lostBenefits = allStats ? [] : conflicts;
  if (allStats) {
    for (const statKey of Object.keys(bonuses)) bonuses[statKey]++;
  } else {
    if (!benefit) throw new Error('Falta el beneficio de ' + option.row.name);
    for (const id of lostBenefits) heldBenefits.delete(id);
    heldBenefits.add(benefit.id);
  }
  if (option.payment) balances[option.payment.type] -= option.payment.amount;
  return {
    held: heldBenefits,
    bonuses,
    balances,
    row: option.row,
    essence: option.essence,
    benefit,
    allStats,
    lostBenefits,
  };
}

// Presenta cada combinación relevante por su nombre y por el efecto que concede.
export function synergyText(id) {
  return [...game.synergies.values()]
    .filter((rule) =>
      [...rule.requires, ...(rule.anyOf ?? []), ...(rule.items ?? [])].includes(
        id,
      ),
    )
    .map((rule) => rule.name + ' · ' + rule.description)
    .join(' · ');
}
