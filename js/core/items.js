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

// Un solo sorteo por piso, después de colocar a todos los combatientes.
export function spawnFloorPotion() {
  if (Math.random() >= 0.5) return;
  const sites = [];
  game.grid.forEach((row, y) => row.forEach((tile, x) => {
    if (tile !== 0 || game.entities.some(e => Math.floor(e.x / TILE) === x && Math.floor(e.y / TILE) === y)) return;
    sites.push({ id: 'potion', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
  }));
  if (sites.length) game.drops.push(sites[Math.floor(Math.random() * sites.length)]);
}

export function dropItem(entity, attacker) {
  const ids = game.pokemon.get(entity.dex).drops;
  if (!entity.boss && (!ids.length || Math.random() >= 1 / 3 + (attacker.isPlayer ? game.perks.loot : 0))) return;
  const id = ids.length ? ids[Math.floor(Math.random() * ids.length)] : 'potion';
  const center = pos => (Math.floor(pos / TILE) + .5) * TILE;
  game.drops.push({ x: center(entity.x), y: center(entity.y), id });
}

export function collectItems(player) {
  if (!player.hp) return;
  game.drops = game.drops.filter(drop => {
    if (Math.hypot(drop.x - player.x, drop.y - player.y) > 12) return true;
    const item = game.items[drop.id];
    console.info('[Objeto] Recogido', item.name, item.duration);
    for (const [key, delta] of Object.entries(item.stats)) {
      if (item.duration === 'floor') player.floorStats[key] = (player.floorStats[key] || 0) + delta;
      else player.bonuses[key] += delta;
    }
    const previous = { ...player.stats, hp: player.hp };
    player.stats = statsFor(game.pokemon.get(player.dex), game.progress, player.bonuses, player.floorStats);
    player.hp = Math.min(player.stats.hpMax, player.hp + item.heal);
    const now = performance.now();
    for (const key of [...Object.keys(item.stats), 'hp']) {
      const delta = (key === 'hp' ? player.hp : player.stats[key]) - previous[key];
      if (delta) game.pickups.push({ key, delta, time: now });
    }
    return false;
  });
}

export function drawItems(ctx, zoom, cameraX, cameraY) {
  for (const { id, x, y } of game.drops) {
    ctx.drawImage(images.get(id), Math.round((x - 8) * zoom - cameraX),
      Math.round((y - 8) * zoom - cameraY), 16 * zoom, 16 * zoom);
  }
}
