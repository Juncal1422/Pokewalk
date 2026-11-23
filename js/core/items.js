import { essenceIcon } from './hud.js';
import { TILE } from './constants.js';
import { game } from './state.js';
import { statsFor } from './stats.js';

const images = new Map();
export async function loadItemImages(items) {
  await Promise.all(Object.entries(items).map(async ([id, item]) => {
    const img = new Image();
    img.src = new URL('../../' + item.image, import.meta.url).href;
    await img.decode();
    images.set(id, img);
  }));
}

// Las pociones tienen una tirada independiente. El cupo cuenta apariciones,
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
  if (sites.length && Math.random() < .5) place('potion');
  const available = Object.keys(game.items).filter(id => !game.items[id].consumable && !game.inventory.has(id));
  if (sites.length && available.length && m.itemsPlaced < 2 && Math.random() < 1 / 3 + game.perks.loot) {
    place(available[Math.floor(Math.random() * available.length)]);
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
      game.essences[drop.essence] = (game.essences[drop.essence] || 0) + drop.amount;
      return false;
    }
    const item = game.items[drop.id];
    if (!item.consumable && game.inventory.has(drop.id)) return false;
    game.inventory.add(drop.id);
    console.info('[Objeto] Recogido', item.name, item.duration);
    for (const [key, delta] of Object.entries(item.stats)) {
      player.bonuses[key] += delta;
    }
    const previous = { ...player.stats, hp: player.hp };
    player.stats = statsFor(game.pokemon.get(player.dex), game.progress, player.bonuses);
    player.hp = Math.min(player.stats.hpMax, player.hp + item.heal + Math.ceil(player.stats.hpMax * (item.healFraction || 0)));
    const now = performance.now();
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
