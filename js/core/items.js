import { assetUrl } from './asset-url.js';
import { showWorldNotice } from './world-notices.js';
import {discover,checkpoint} from './collection.js';
import {playSound} from './audio.js';
import { levelUp } from './experience.js';
import { pickupEffect } from './abilities.js';
import { gameTime } from './clock.js';
import { canMove } from './entities.js';
import { essenceIcon } from './hud.js';
import { TILE } from './constants.js';
import { game } from './state.js';
import { playerStats, amount, synergyActive } from './benefits.js';

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
  const mission = game.mission, fiveFloorBlock = Math.floor((game.floor - 1) / 5);
  if (mission.itemBlock !== fiveFloorBlock) { mission.itemBlock = fiveFloorBlock; mission.itemsPlaced = 0; }
  const occupied = new Set(game.entities.map(combatant => Math.floor(combatant.x / TILE) + ',' + Math.floor(combatant.y / TILE)));
  const sites = [];
  game.grid.forEach((row, y) => row.forEach((tile, x) => {
    if (!tile && !occupied.has(x + ',' + y)) sites.push({ x: (x + .5) * TILE, y: (y + .5) * TILE });
  }));
  // Reserva una casilla libre del conjunto de ubicaciones y sitúa el objeto en su centro.
  function place(itemId) {
    const [site] = sites.splice(Math.floor(Math.random() * sites.length), 1);
    game.drops.push({ id: itemId, ...site });
  }
  if (sites.length && Math.random() < .5) place(synergyActive('sitrusBerries') || Math.random()<.25 ? 'berry_sitrus' : 'berry_oran');
  const available = Object.keys(game.items).filter(itemId => {
    const item=game.items[itemId];
    return (item.consumable || game.inventory.size < 75) && !item.healFraction && !item.objective && !game.inventory.has(itemId) && !(item.oncePerMission && mission.candyPlaced);
  });
  if (sites.length && available.length && mission.itemsPlaced < 2 && Math.random() < .225 + amount('green_scale')) {
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
      const quantity=drop.amount*(game.inventory.has(candy)?2:1);
      if(type==='electric' && game.runRelics?.has('depleted_battery'))game.batteryEnergy+=quantity;
      else game.essences[type]=(game.essences[type] || 0)+quantity;
      return false;
    }
    const item = game.items[drop.id];
    if (!item.consumable && game.inventory.size >= 75 && !game.inventory.has(drop.id)) return true;
    if (!item.consumable && game.inventory.has(drop.id)) return false;
    const bonuses = { ...player.bonuses };
    for (const [key, delta] of Object.entries(item.stats)) bonuses[key] += delta;
    const oldStats = player.stats;
    const previous = { ...oldStats, hp: player.hp };
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
      if (!freePosition) { player.stats = oldStats; return true; }
      Object.assign(player, freePosition);
    }
    player.bonuses = bonuses;
    if (!item.consumable) game.inventory.add(drop.id);
    if (drop.id==='rarecandy') { game.xp=0; levelUp(); }
    if (item.doubleEssences) {
      const mostAbundantTypes = Object.keys(game.essences).sort((firstType,secondType)=>game.essences[secondType]-game.essences[firstType]).slice(0,item.doubleEssences);
      for (const type of mostAbundantTypes) game.essences[type]*=2;
    }
    pickupEffect(player,item.healFraction?'heal':'boost');
    console.info('[Objeto] Recogido', item.name);
    player.hp = Math.min(player.stats.hpMax, player.hp + Math.ceil(player.stats.hpMax * (item.healFraction || 0) * (1 + (item.healFraction?amount('mint_leaf'):0))));
    // Usamos la diferencia después del límite de PV para mostrar solo la curación efectiva.
    discover('items',drop.id);checkpoint();playSound(item.healFraction?'berry':'item');
    if (item.healFraction) showWorldNotice(player, player.hp - previous.hp, 'HP');
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
