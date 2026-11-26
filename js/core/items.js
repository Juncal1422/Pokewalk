import {applyShinyAppearance} from '../data/pokemon-data.js';
import {rule} from './modifiers.js';
import { assetUrl } from './asset-url.js';
import { showWorldNotice } from './world-notices.js';
import {discover,checkpoint} from './collection.js';
import {playSound} from './audio.js';
import { levelUp } from './experience.js';
import { effect, pickupEffect } from './abilities.js';
import { gameTime } from './clock.js';
import { canMove } from './entities.js';
import { essenceIcon } from './hud.js';
import { TILE } from './constants.js';
import { game } from './state.js';
import { playerStats, amount, synergyActive } from './benefits.js';

// Todos los objetos que entran en el piso pasan por aquí, incluidos premios y bayas.
export function dropItem(id,site) {
  game.drops.push({id,x:site.x,y:site.y});
  playSound('itemGift');
}

// Selecciona equipo aún disponible y el suelo libre más cercano al origen.
export function dropNewItem(origin) {
  const available=Object.keys(game.items).filter(id=>!game.items[id].consumable && !game.items[id].healFraction && !game.items[id].objective &&
    !game.inventory.has(id) && !game.drops.some(drop=>drop.id===id) && !(id==='revive' && game.reviveSpent) &&
    !(game.items[id].oncePerMission && game.mission.candyPlaced));
  const id=available[Math.floor(Math.random()*available.length)]??'berry_sitrus';
  const sites=[];
  game.grid.forEach((row,y)=>row.forEach((tile,x)=>{
    if(tile===0)sites.push({x:(x+.5)*TILE,y:(y+.5)*TILE});
  }));
  sites.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  const site=sites.find(s=>!game.entities.some(e=>e.hp && Math.hypot(e.x-s.x,e.y-s.y)<12) &&
    !game.drops.some(d=>d.x===s.x && d.y===s.y))??origin;
  if(game.items[id].oncePerMission)game.mission.candyPlaced=true;
  dropItem(id,site);
}

export function refreshEssenceAttack() {
  const player=game.player;
  if (player && [...game.inventory].some(id=>game.items?.[id]?.attackEssence))
    player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
}

const images = new Map();
// Precarga las imágenes por identificador para reutilizarlas en cada piso.
export async function loadItemImages(items) {
  await Promise.all(Object.entries(items).map(async ([itemId, item]) => {
    const spriteImage = new Image();
    spriteImage.src = assetUrl('../../' + item.image, import.meta.url).href;
    await spriteImage.decode();
    images.set(itemId, spriteImage);
  }));
}

// Las bayas tienen una tirada independiente. El cupo cuenta apariciones,
// incluso si el jugador abandona la planta sin recoger el objeto.
export function spawnFloorItems() {
  const mission = game.mission;
  const occupied = new Set(game.entities.map(combatant => Math.floor(combatant.x / TILE) + ',' + Math.floor(combatant.y / TILE)));
  const sites = [];
  game.grid.forEach((row, y) => row.forEach((tile, x) => {
    if (!tile && !occupied.has(x + ',' + y)) sites.push({ x: (x + .5) * TILE, y: (y + .5) * TILE });
  }));
  // Reserva una casilla libre del conjunto de ubicaciones y sitúa el objeto en su centro.
  function place(itemId) {
    const [site] = sites.splice(Math.floor(Math.random() * sites.length), 1);
    dropItem(itemId,site);
  }
  if (sites.length && Math.random()<.5+rule('berryChance')){
    const revive=!game.reviveSpent && !game.inventory.has('revive') && Math.random()<rule('reviveBerry');
    const berries = Object.keys(game.items).filter(id=>game.items[id].berry);
    const berry = synergyActive('sitrusBerries') ? 'berry_sitrus' : berries[Math.floor(Math.random()*berries.length)];
    place(revive ? 'revive' : berry);
  }
  const available = Object.keys(game.items).filter(itemId => {
    const item=game.items[itemId];
    return !(itemId==='revive' && game.reviveSpent) && (item.consumable || game.inventory.size < 75) && !item.berry && !item.objective && !game.inventory.has(itemId) && !(item.oncePerMission && mission.candyPlaced);
  });
  if (sites.length && available.length && mission.itemsPlaced < 3 && Math.random() < (.10 + amount('scaled') + rule('itemChance'))*(game.runRelics?.has('debugger')?1.5:1)) {
    const itemId=available[Math.floor(Math.random() * available.length)];
    place(itemId);
    if (game.items[itemId].oncePerMission) mission.candyPlaced=true;
    mission.itemsPlaced++;
  }
}

// Resuelve las recogidas por contacto o alcance y aplica sus efectos antes de retirar el objeto.
export function collectItems(player, strike = null) {
  if (!player.hp) return;
  game.drops = game.drops.filter(drop => {
    if (strike) {
      if (game.grid[Math.floor(drop.y / TILE)][Math.floor(drop.x / TILE)] === 0 || !strike(drop)) return true;
    } else if (Math.hypot(drop.x - player.x, drop.y - player.y) > 12) return true;
    if (drop.essence) {
      const type=drop.essence;
      const candy = 'candy_'+(type==='fighting'?'fight':type);
      let quantity=drop.amount*(game.runRelics?.has('debugger')?4:1)*(game.inventory.has(candy)?2:1);
      if(['grass','water','fire'].includes(type))quantity*=rule('tropicalEssence')||1;
      if(type==='grass' && rule('healGrass') && player.hp<player.stats.hpMax){
        const healed=Math.min(quantity,player.stats.hpMax-player.hp);
        player.hp+=healed; quantity-=healed;
        pickupEffect(player,'heal');showWorldNotice(player,healed,'HP');
        if(!quantity)return false;
      }
      if(type==='water' && synergyActive('waterGrowth')){
        player.bonuses.size+=quantity;
        player.bonuses.attack+=quantity;
        player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
      }
      if(type==='water' && game.held.has('blooming')){
        effect('grow',drop.x,drop.y,350);
        const healed=Math.min(quantity,player.stats.hpMax-player.hp);
        player.hp+=healed; quantity-=healed;
        if(healed)showWorldNotice(player,healed,'HP');
        if(!quantity)return false;
      }
      if(type==='electric' && game.runRelics?.has('depleted_battery'))game.batteryEnergy+=quantity;
      else game.essences[type]=(game.essences[type] || 0)+quantity;
      refreshEssenceAttack();
      return false;
    }
    const item = game.items[drop.id];
    if (!item.consumable && game.inventory.size >= 75 && !game.inventory.has(drop.id)) return true;
    if (!item.consumable && game.inventory.has(drop.id)) return false;
    const bonuses = { ...player.bonuses };
    for (const [key, delta] of Object.entries(item.stats)) bonuses[key] = (bonuses[key]??0) + delta;
    if (item.thresholdStat) {
      const {key,threshold,delta} = item.thresholdStat;
      const applies = delta < 0 ? player.stats[key] > threshold : player.stats[key] < threshold;
      bonuses[key] += applies ? delta : Math.sign(delta);
    }
    const oldStats = player.stats;
    const previous = { ...oldStats, hp: player.hp };
    if (!item.consumable) game.inventory.add(drop.id);
    player.stats = playerStats(game.pokemon.get(player.dex), game.progress, bonuses);
    // Al crecer junto a una pared empujamos el cuerpo al punto válido más
    // cercano. Si no cabe en las inmediaciones, el objeto sigue en el suelo.
    if (player.stats.size > oldStats.size && !canMove(player, player.x, player.y)) {
      let freePosition;
      for (let searchRadius = 1; searchRadius <= TILE / 2 && !freePosition; searchRadius++) {
        for (let angleIndex = 0; angleIndex < 32; angleIndex++) {
          const angle = angleIndex * Math.PI / 16;
          const x = player.x + searchRadius * Math.cos(angle), y = player.y + searchRadius * Math.sin(angle);
          if (canMove(player, x, y)) { freePosition = { x, y }; break; }
        }
      }
      if (!freePosition) { player.stats = oldStats; if(!item.consumable)game.inventory.delete(drop.id); return true; }
      Object.assign(player, freePosition);
    }
    player.bonuses = bonuses;
    if (item.frameColor) {
      game.frameColor=item.frameColor;
      const frame='textbox-b'+(item.frameColor==='blue'?'':'-'+item.frameColor)+'.png';
      document.querySelector('#poke-walk-app').style.setProperty('--textbox-blue','url("'+assetUrl('../../assets/ui/'+frame,import.meta.url).href+'")');
    }
    if (drop.id==='shiny_elixir') applyShinyAppearance(player);
    if (drop.id==='rarecandy') { game.xp=0; levelUp(); }
    if (item.doubleEssences) {
      const mostAbundantTypes = Object.keys(game.essences).sort((firstType,secondType)=>game.essences[secondType]-game.essences[firstType]).slice(0,item.doubleEssences);
      for (const type of mostAbundantTypes) game.essences[type]*=2;
    }
    if (item.essence) player.hp = Math.min(player.stats.hpMax,player.hp+(game.essences[item.essence]??0));
    refreshEssenceAttack();
    pickupEffect(player,item.berry || item.essence?'heal':'boost');
    console.info('[Objeto] Recogido', item.name);
    player.hp = Math.min(player.stats.hpMax, player.hp + Math.ceil(player.stats.hpMax * (item.healFraction || 0) * (1 + (item.healFraction?amount('minty'):0))));
    // Usamos la diferencia después del límite de PV para mostrar solo la curación efectiva.
    discover('items',drop.id);checkpoint();playSound(item.berry?'berry':'item');
    if (item.healFraction || item.essence) showWorldNotice(player, player.hp - previous.hp, 'HP');
    const simulationTime = gameTime();
    for (const key of [...Object.keys(item.stats), 'hp']) {
      const delta = (key === 'hp' ? player.hp : player.stats[key]) - previous[key];
      if (delta) game.pickups.push({ key, delta, time: simulationTime });
    }
    return false;
  });
}

// Proyecta las posiciones de los objetos y las esencias del suelo respecto de la cámara.
export function drawItems(drawingContext, renderZoom, cameraX, cameraY) {
  for (const { id: itemId, essence, x, y } of game.drops) {
    const iconSize = essence ? 20 : 24;
    drawingContext.drawImage(essence ? essenceIcon(essence) : images.get(itemId), Math.round((x - iconSize / 2) * renderZoom - cameraX),
      Math.round((y - iconSize / 2) * renderZoom - cameraY), iconSize * renderZoom, iconSize * renderZoom);
  }
}
