import { levelUp } from './experience.js';
import { pickupEffect } from './abilities.js';
import { gameTime } from './clock.js';
import { canMove } from './entities.js';
import { essenceIcon } from './hud.js';
import { TILE } from './constants.js';
import { game } from './state.js';
import { playerStats, amount } from './benefits.js';

const images = new Map();
export async function loadItemImages(items) {
  await Promise.all(Object.entries(items).map(async ([id, item]) => {
    const img = new Image();
    img.src = new URL('../../' + item.image, import.meta.url).href;
    await img.decode();
    images.set(id, img);
  }));
}

// Las bayas tienen una tirada independiente. El cupo cuenta apariciones,
// incluso si el jugador abandona la planta sin recoger el objeto.
export function spawnFloorItems() {
  const m = game.mission, block = Math.floor((game.floor - 1) / 5);
  if (m.itemBlock !== block) { m.itemBlock = block; m.itemsPlaced = 0; }
  const occupied = new Set(game.entities.map(e => Math.floor(e.x / TILE) + ',' + Math.floor(e.y / TILE)));
  const sites = [];
  game.grid.forEach((row, y) => row.forEach((tile, x) => {
    if (!tile && !occupied.has(x + ',' + y)) sites.push({ x: (x + .5) * TILE, y: (y + .5) * TILE });
  }));
  function place(id) {
    const [site] = sites.splice(Math.floor(Math.random() * sites.length), 1);
    game.drops.push({ id, ...site });
  }
  if (sites.length && Math.random() < .5) place(Math.random()<.25 ? 'berry_sitrus' : 'berry_oran');
  const available = Object.keys(game.items).filter(id => {
    const item=game.items[id];
    return !item.healFraction && !item.objective && !game.inventory.has(id) && !(item.oncePerMission && m.candyPlaced);
  });
  if (sites.length && available.length && m.itemsPlaced < 2 && Math.random() < .30 + amount('green_scale')) {
    const id=available[Math.floor(Math.random() * available.length)];
    place(id);
    if (game.items[id].oncePerMission) m.candyPlaced=true;
    m.itemsPlaced++;
  }
}

export function collectItems(player, strike = null) {
  if (!player.hp) return;
  game.drops = game.drops.filter(drop => {
    if (strike) {
      if (game.grid[Math.floor(drop.y / TILE)][Math.floor(drop.x / TILE)] === 0 || !strike(drop)) return true;
    } else if (Math.hypot(drop.x - player.x, drop.y - player.y) > 12) return true;
    if (drop.essence) {
      const type=drop.essence;
      // Guardamos medios puntos para que dos recogidas de 1 otorguen 3, incluso en pisos distintos.
      const candy = 'candy_'+(type==='fighting'?'fight':type);
      const total=drop.amount*(game.inventory.has(candy)?1.5:1)+(game.essenceRemainders[type] || 0);
      game.essences[type]=(game.essences[type] || 0)+Math.floor(total);
      game.essenceRemainders[type]=total%1;
      return false;
    }
    const item = game.items[drop.id];
    if (!item.consumable && game.inventory.has(drop.id)) return false;
    const bonuses = { ...player.bonuses };
    for (const [key, delta] of Object.entries(item.stats)) bonuses[key] += delta;
    const oldStats = player.stats;
    const previous = { ...oldStats, hp: player.hp };
    player.stats = playerStats(game.pokemon.get(player.dex), game.progress, bonuses);
    // Al crecer junto a una pared empujamos el cuerpo al punto válido más
    // cercano. Si no cabe en las inmediaciones, el objeto sigue en el suelo.
    if (player.stats.size > oldStats.size && !canMove(player, player.x, player.y)) {
      let spot;
      for (let r = 1; r <= TILE / 2 && !spot; r++) {
        for (let i = 0; i < 32; i++) {
          const angle = i * Math.PI / 16;
          const x = player.x + r * Math.cos(angle), y = player.y + r * Math.sin(angle);
          if (canMove(player, x, y)) { spot = { x, y }; break; }
        }
      }
      if (!spot) { player.stats = oldStats; return true; }
      Object.assign(player, spot);
    }
    player.bonuses = bonuses;
    if (!item.consumable) game.inventory.add(drop.id);
    if (drop.id==='rarecandy') { game.xp=0; levelUp(); }
    if (item.doubleEssences) {
      const top = Object.keys(game.essences).sort((a,b)=>game.essences[b]-game.essences[a]).slice(0,item.doubleEssences);
      for (const type of top) game.essences[type]*=2;
    }
    pickupEffect(player,item.healFraction?'heal':'boost');
    console.info('[Objeto] Recogido', item.name);
    player.hp = Math.min(player.stats.hpMax, player.hp + Math.ceil(player.stats.hpMax * (item.healFraction || 0) * (1 + (item.healFraction?amount('mint_leaf'):0))));
    const now = gameTime();
    for (const key of [...Object.keys(item.stats), 'hp']) {
      const delta = (key === 'hp' ? player.hp : player.stats[key]) - previous[key];
      if (delta) game.pickups.push({ key, delta, time: now });
    }
    return false;
  });
}

export function drawItems(ctx, zoom, cameraX, cameraY) {
  for (const { id, essence, x, y } of game.drops) {
    const side = essence ? 20 : 24;
    ctx.drawImage(essence ? essenceIcon(essence) : images.get(id), Math.round((x - side / 2) * zoom - cameraX),
      Math.round((y - side / 2) * zoom - cameraY), side * zoom, side * zoom);
  }
}
