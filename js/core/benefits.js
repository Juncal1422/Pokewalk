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
  balances = game.essences,
  raw,
) {
  const stats = statsFor(species, playerLevel);
  // Suma equipo y beneficios antes de limitar: Metalizador también descuenta defensa de las reliquias.
  for (const [key,delta] of Object.entries(bonuses ?? {})) stats[key] += delta;
  if (heldBenefits.has('champion')) stats.attack += game.mission?.championAttack ?? 0;
  for (const id of game.inventory ?? []) {
    const item = game.items?.[id];
    if (item?.attackEssence) stats.attack += balances?.[item.attackEssence] ?? 0;
    if (item?.typeDefense?.some(type => species.types.includes(type))) stats.defense += 5;
    for (const [key, value] of Object.entries(item?.equippedStats ?? {})) stats[key] += value;
  }
  const naturalSize = 100;
  applyBenefitStats(stats,heldBenefits,naturalSize,true,raw);
  if (game.runRelics?.has('black_sash')) {
    const entry = game.player?.dex === species.dex ? game.defenseEntryLevel ?? 5 : playerLevel;
    const cap = statsFor(species,entry).defense;
    stats.attack += Math.floor(Math.max(0,stats.defense-cap)/2);
    stats.defense=Math.min(stats.defense,cap);
  }
  bindHealthAttack(stats,heldBenefits,()=>game.player?.hp);
  return stats;
}

// El HUD, los ataques y las curaciones consultan los mismos HP en tiempo real.
export function bindHealthAttack(stats,held,health){
  const bonus=Math.max(0,...[...held].map(id=>game.benefits.get(id)?.lowHPAttack??0));
  if(!bonus)return;
  let base=stats.attack;
  const boost=()=>health()<stats.hpMax/4?bonus:0;
  Object.defineProperty(stats,'attack',{enumerable:true,configurable:true,
    get:()=>base+boost(),set:value=>{base=value-boost();}});
}

// Se comparte entre salvajes, jugador y la comparación previa a elegir carta.
export function applyBenefitStats(stats,held,naturalSize,equipment=false,raw){
  for(const id of held)for(const [key,delta] of Object.entries(game.benefits.get(id)?.stats??{}))stats[key]+=delta;
  if(equipment){
    const half=new Set([...(game.runRelics??[])].map(id=>relics[id]?.halve));
    function equipStat(key,delta){
      const gain=delta>0 && half.has(key)?delta/2:delta;
      stats[key]+=gain;
      if(key!=='speed' && gain>0 && game.runRelics?.has('bike_ticket'))stats.speed+=gain;
    }
    for(const id of game.runRelics??[])for(const [key,delta] of Object.entries(relics[id]?.stats??{}))equipStat(key,delta);
    if(held.has('seer') && game.amuletUntil>gameTime())for(const key of ['attack','speed','attackSpeed'])equipStat(key,50);
    if(synergyActive('royalCrown',held))for(const key of ['attack','defense','speed','attackSpeed','range','size','hpMax'])stats[key]+=key==='size'?50:15;
  }
  const small=rule('normalizeSmall',held,equipment),large=rule('normalizeLarge',held,equipment);
  stats.size=stats.size<100?Math.min(100,stats.size+small):Math.max(100,stats.size-large);
  stats.defense+=(naturalSize-stats.size)*rule('sizeDefense',held,equipment);
  if(rule('noDodge',held,equipment))stats.evasion=0;
  if(equipment && game.runRelics?.has('cranium'))stats.block=stats.critical=0;
  if(held.has('aviodant'))stats.critical=0;
  if(raw)Object.assign(raw,stats);
  for(const key of Object.keys(stats))stats[key]=limitStat(key,Math.round(stats[key]));
  return stats;
}

// Liquida una adquisición una sola vez. Las vistas previas entregan su propia copia de bonos.
export function settleStats(species,level,bonuses,previous,held=game.held,balances=game.essences){
  const raw={};
  const after=playerStats(species,level,bonuses,held,balances,raw);
  const halves=new Set([...held].map(id=>game.benefits.get(id)?.halve));
  let speedGain=0;
  for(const key of Object.keys(raw)){
    const minimum=limitStat(key,-Infinity);
    const overflow=Math.max(0,minimum-raw[key]);
    // Un −10 desde 8 guarda −3; la siguiente mejora comienza realmente en 5.
    if(overflow)bonuses[key]=(bonuses[key]??0)+overflow;
    const gain=Math.max(0,after[key]-previous[key]);
    const discount=halves.has(key)?gain/2:0;
    if(discount)bonuses[key]=(bonuses[key]??0)-discount;
    if(held.has('impregnable') && gain>0){
      if(key==='critical' || key==='evasion')bonuses.block=(bonuses.block??0)+gain;
      if(key==='size')bonuses.hpMax=(bonuses.hpMax??0)+gain;
    }
    if(key!=='speed')speedGain+=gain-discount;
  }
  if(game.runRelics?.has('bike_ticket'))bonuses.speed=(bonuses.speed??0)+speedGain;
  return playerStats(species,level,bonuses,held,balances);
}

// Cuerno y Punzante comparten el ataque direccional. Los otros tres lo sustituyen entero.
const directionalWeapons = new Set(['spiky', 'rhyhorn_horn']);
const exclusiveWeapons = new Set(['acuatic', 'ancient', 'rock_thrower','ofidio','forgotten_bone','magnet','occult_powder','sharp_beak']);
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
    for (const key of ['hpMax','attack','defense','speed','attackSpeed','range']) bonuses[key]++;
    bonuses.size += 3;
  } else {
    if (!benefit) throw new Error('Falta el beneficio de ' + option.row.name);
    for (const id of lostBenefits) heldBenefits.delete(id);
    heldBenefits.add(benefit.id);
  }
  if (option.payment) balances[option.payment.type] -= option.payment.amount;
  const baseline=playerStats(option.row,game.progress,state.bonuses,state.held,state.balances);
  settleStats(option.row,game.progress,bonuses,baseline,heldBenefits,balances);
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

// Las sinergias aparecen únicamente en la ficha del beneficio. Conserva la alternativa «o».
export function benefitSynergies(id){
  const name=key=>game.benefits.get(key)?.name??game.items[key]?.name??key;
  return [...game.synergies.values()]
    .filter(s=>[...s.requires,...(s.anyOf??[]),...(s.items??[])].includes(id))
    .map(s=>{
      const partners=[...s.requires,...(s.items??[])].filter(key=>key!==id).map(name);
      if(s.anyOf?.length && !s.anyOf.includes(id))partners.push(s.anyOf.map(name).join(' o '));
      return [s.name,partners.join(' + '),s.description].filter(Boolean).join(' · ');
    });
}
