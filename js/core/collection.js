import {game} from './state.js';

const storageKey='pokewalk.pommedew.collection.v1';
export const relics={
  debugger:{name:'Debugger',price:0,image:'items/weird_token.png',description:'Atributos y esencias ×4. Probabilidad de objetos ×1,5.'},
  black_sash:{name:'Cinta Negra',price:12,description:'Fija la defensa base de cada forma. La mitad de los aumentos de defensa se convierte en ataque.'},
  depleted_battery:{name:'Batería agotada',price:18,description:'E · Cada 10 esencias eléctricas almacena una descarga de ataque ×4 y alcance ×3.'}
};

// El archivo conserva IDs y crónicas, nunca referencias a pisos, entidades o catálogos.
export function emptyCollection() {
  return {version:1,intro:false,volume:.6,emblems:0,forms:[],items:[],benefits:[],synergies:[],relics:['debugger'],enabled:[],history:[]};
}

// Valida todo el documento antes de sustituir el guardado, conservando IDs de otras versiones.
export function parseCollection(text) {
  const data=JSON.parse(text);
  const list=(values,test)=>Array.isArray(values)&&values.every(test);
  const id=value=>typeof value==='string'&&value.length>0;
  const count=value=>Number.isSafeInteger(value)&&value>=0;
  const stats=value=>value && typeof value==='object' && !Array.isArray(value) && Object.values(value).every(Number.isFinite);
  if (!data || data.version!==1 || typeof data.intro!=='boolean' || !count(data.emblems) ||
      !Number.isFinite(data.volume)||data.volume<0||data.volume>1||!list(data.forms,count)||
      !['items','benefits','synergies','relics','enabled'].every(key=>list(data[key],id))||
      !data.enabled.every(key=>data.relics.includes(key))||
      !list(data.history,run=>run && id(run.date)&&id(run.status)&&list(run.forms,count)&&list(run.items,id)&&list(run.benefits,id)&&stats(run.stats)&&count(run.level)&&
        list(run.missions,m=>m&&id(m.name)&&id(m.biome)&&id(m.status)&&count(m.floor)&&count(m.floors)&&count(m.reward)&&typeof m.red==='boolean')))
    throw Error('El archivo no contiene una colección válida.');
  const aliases = {"long_horn": "rhyhorn_horn", "cog": "machinery", "deep_scale": "reinforced", "green_scale": "scaled", "golden_spike": "golden", "green_spike": "spiked", "iron_tag": "protected", "lovefool": "heartbreaker", "mint_leaf": "minty", "silvercoat": "swift", "fire_brooch": "hooh_brooch", "spike": "spiky", "amulet": "seer", "gunpowder_rock": "gunpowder_core"};
  for (const record of [data,...data.history]) record.benefits=[...new Set(record.benefits.map(id=>aliases[id]??id))];
  if(!data.relics.includes('debugger'))data.relics.push('debugger');
  return data;
}

// El guardado se escribe como una sola operación. Los errores nunca sustituyen un archivo válido al importar.
export function saveCollection(data=game.collection) {
  localStorage.setItem(storageKey,JSON.stringify(data));
  game.collection=data;
}

// Una recarga termina la aventura anterior. El historial sirve para leerla, no para reanudarla.
export function loadCollection() {
  const saved=localStorage.getItem(storageKey);
  const data=saved===null?emptyCollection():parseCollection(saved);
  for(const run of data.history) if(run.status==='En curso'){run.status='Interrumpida';const last=run.missions.at(-1);if(last?.status==='En curso')last.status='Interrumpida';}
  saveCollection(data);
}

// Abre la crónica solo cuando el jugador ha aceptado su primera misión.
export function beginChronicle() {
  game.chronicle={date:new Date().toISOString(),status:'En curso',forms:[],items:[],benefits:[],stats:{},level:5,missions:[]};
  game.collection.history.push(game.chronicle);
}

// Anota cada descubrimiento una sola vez, incluso si un consumible vuelve a aparecer.
export function discover(kind,id) {
  if(!game.chronicle) return;
  for(const list of [game.collection[kind],game.chronicle[kind]]) if(list && !list.includes(id)) list.push(id);
}

// Actualiza la instantánea legible tras una adquisición, al cambiar de piso o al terminar.
export function checkpoint() {
  if(!game.chronicle||!game.player) return;
  game.chronicle.stats={...game.player.stats};
  game.chronicle.level=game.player.level;
  game.chronicle.hp=game.player.hp;
  const current=game.chronicle.missions.at(-1);
  if(current && game.mission){current.kills=game.mission.kills;current.quota=game.mission.quota;current.form=game.player.dex;}
  for(const id of game.held) discover('benefits',id);
  discover('forms',game.player.dex);
  for(const rule of game.synergies.values()) if((rule.items??[]).every(id=>game.inventory.has(id)) && rule.requires.every(id=>game.held.has(id))&&(!rule.anyOf||rule.anyOf.some(id=>game.held.has(id)))) discover('synergies',rule.effect);
  saveCollection();
}

// Cada misión ocupa una fila; los pisos actualizan la misma fila.
export function recordFloor() {
  const mission=game.mission;
  const missions=game.chronicle.missions;
  if(missions.length<mission.number) missions.push({type:mission.type,name:mission.name,biomeId:mission.biome.id,biome:mission.biome.name,floors:mission.floors,red:mission.red,reward:0,status:'En curso',floor:1});
  missions.at(-1).floor=game.floor;
  checkpoint();
}

// El pago se registra antes de abrir las tarjetas, una sola vez aunque se reintente la transición.
export function settleMission() {
  const entry=game.chronicle.missions.at(-1);
  if(entry.status!=='En curso') return 0;
  entry.status=game.mission.failed?'Rescate fallido':'Completada';
  entry.reward=game.mission.failed?0:game.mission.reward;
  game.collection.emblems+=entry.reward;
  checkpoint();
  return entry.reward;
}
