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
  let points=entity.stats[key];
  if(key==='evasion'){
    if(actorRule(entity,'noDodge'))return 0;
    if(entity.evasionUntil>gameTime())points+=20;
  }
  if(key==='block' && entity.shellUntil>gameTime())points+=actorRule(entity,'shellBlock');
  return Math.max(0,Math.min(key==='evasion'?50:100,points));
}
