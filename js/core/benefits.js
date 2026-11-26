import {relics} from './collection.js';
import { gameTime } from './clock.js';
import {rule} from './modifiers.js';
import { limitStat, statsFor } from './stats.js';
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

// Se recomputan los bonos planos desde la forma y el nivel actuales, sin reutilizar
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
  const naturalSize = 100;
  applyBenefitStats(stats,heldBenefits,naturalSize,true);
  if (game.runRelics?.has('black_sash')) {
    const entry = game.player?.dex === species.dex ? game.defenseEntryLevel ?? 5 : playerLevel;
    const cap = statsFor(species,entry).defense;
    stats.attack += Math.floor(Math.max(0,stats.defense-cap)/2);
    stats.defense=Math.min(stats.defense,cap);
  }
  return stats;
}

// Se comparte entre salvajes, jugador y la comparación previa a elegir carta.
export function applyBenefitStats(stats,held,naturalSize,equipment=false){
  for(const id of held)for(const [key,delta] of Object.entries(game.benefits.get(id)?.stats??{}))stats[key]+=delta;
  if(equipment){
    for(const id of game.runRelics??[])for(const [key,delta] of Object.entries(relics[id]?.stats??{}))stats[key]+=delta;
    if(held.has('seer') && game.amuletUntil>gameTime())for(const key of ['attack','speed','attackSpeed'])stats[key]+=50;
    if(synergyActive('royalCrown',held))for(const key of ['attack','defense','speed','attackSpeed','range','size','hpMax'])stats[key]+=key==='size'?50:15;
  }
  const small=rule('normalizeSmall',held,equipment),large=rule('normalizeLarge',held,equipment);
  stats.size=limitStat('size',stats.size<100?Math.min(100,stats.size+small):Math.max(100,stats.size-large));
  stats.defense+=(naturalSize-stats.size)*rule('sizeDefense',held,equipment);
  if(rule('noDodge',held,equipment))stats.evasion=0;
  for(const key of Object.keys(stats))stats[key]=limitStat(key,Math.round(stats[key]));
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
    benefit.excludes?.includes(id) || game.benefits.get(id)?.excludes?.includes(benefit.id) || weaponConflict(id, benefit.id) || (benefit.active && game.benefits.get(id).slot === benefit.slot)
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
