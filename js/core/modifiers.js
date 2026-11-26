import {DIR_VEC} from './constants.js';
import {gameTime} from './clock.js';
import {game} from './state.js';
import {relics} from './collection.js';

// Un beneficio, objeto o reliquia puede declarar rules y affinity en su ficha.
// El equipo persistente pertenece sólo al jugador; los salvajes usan su donante.
export function* sources(held=game.held, equipment=true) {
  for(const id of held??[]) yield game.benefits?.get(id);
  if(equipment){
    for(const id of game.inventory??[])yield game.items?.[id];
    for(const id of game.runRelics??[])yield relics[id];
  }
}

// Suma modificadores numéricos del mismo evento y permite consultar una proyección.
export function rule(key, held=game.held, equipment=true) {
  let value=0;
  for(const source of sources(held,equipment))value+=source?.rules?.[key]??0;
  return value;
}

// Las resistencias se multiplican por cada fuente equipada.
export function affinity(element,entity) {
  let value=1;
  for(const source of sources(entity.isPlayer?game.held:entity.benefits,entity.isPlayer))
    value*=source?.affinity?.[element]??1;
  return value;
}

export function actorRule(entity,key){
  return rule(key,entity.isPlayer?game.held:entity.benefits,entity.isPlayer);
}

// El HUD y las tiradas comparten el valor temporal y los límites de los tres porcentajes.
export function combatChance(entity,key) {
  if (entity.isPlayer && game.runRelics?.has('cranium') && ['block','critical'].includes(key))return 0;
  let points=entity.stats[key];
  if(key==='evasion'){
    if(actorRule(entity,'noDodge'))return 0;
    if(entity.evasionUntil>gameTime())points+=20;
  }
  if(key==='block' && entity.shellUntil>gameTime())points+=actorRule(entity,'shellBlock');
  return Math.max(0,Math.min(key==='evasion'?50:100,points));
}

// Proyección sobre la mirada del defensor. Los flancos quedan fuera de los dos conos de 90°.
function facingAttacker(attacker,defender){
  const [x,y]=DIR_VEC[defender.dir??0], dx=attacker.x-defender.x,dy=attacker.y-defender.y;
  return (x*dx+y*dy)/(Math.hypot(x,y)*(Math.hypot(dx,dy)||1));
}
export function criticalHit(attacker,target){
  return attacker.isPlayer && game.runRelics?.has('cranium') ? facingAttacker(attacker,target)<-.70 :
    Math.random()*100<combatChance(attacker,'critical');
}
export function criticalBlock(attacker,target){
  return target.isPlayer && game.runRelics?.has('cranium') ? facingAttacker(attacker,target)>.70 :
    Math.random()*100<combatChance(target,'block');
}
