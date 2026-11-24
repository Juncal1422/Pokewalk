import { drawEffects } from './abilities.js';
import { attackMotion } from './attack-motion.js';
import { drawItems } from './items.js';
import { drawHud } from './hud.js';
import { PLAYER_GRACE_MS, FADE_MS, MAP_H, MAP_W, RTILE, ZOOM } from './constants.js';
import { game } from './state.js';

const tilesets = new Map();
let selection = 0;

function loadTileset(url) {
  if (!tilesets.has(url)) {
    const image = new Image();
    image.src = url;
    tilesets.set(
      url,
      image
        .decode()
        .then(() => {
          const size = image.naturalWidth / 7;
          if (
            !Number.isInteger(size) ||
            size <= 0 ||
            image.naturalHeight !== size * 9
          ) {
            throw new Error(`Atlas 7 × 9 inválido: ${url}`);
          }
          return { image, size };
        })
        .catch((error) => {
          tilesets.delete(url);
          throw error;
        }),
    );
  }
  return tilesets.get(url);
}

export async function changeBiome(biome) {
  const request = ++selection;
  try {
    const sheet = await loadTileset(biome.tileset);
    if (selection !== request) return;
    game.tileSheet = sheet;
    game.currentBiome = biome;
    console.debug('[Render] Atlas preparado', biome.name, biome.terrain);
  } catch (error) {
    if (selection !== request) return;
    throw new Error(`No se pudo cargar el tileset de ${biome.name}`, {
      cause: error,
    });
  }
}

const portalImage = new Image();
portalImage.src = new URL('../../tiled/tilesets/Teleporter.png', import.meta.url).href;

const missImage = new Image();
missImage.src = new URL('../../assets/ui/miss.png', import.meta.url).href;
const stairsImage = new Image();
stairsImage.src = new URL('../../tiled/tilesets/Stairs.png', import.meta.url).href;
const objectiveImage = new Image();
objectiveImage.src = new URL('../../assets/items/goldenapple.png', import.meta.url).href;

export function preparePortal() {
  return Promise.all([portalImage, stairsImage, objectiveImage, missImage].map(image => image.decode()));
}

export function draw() {
  const { player, tileSheet, ctx, canvas } = game;
  if (!player || !tileSheet) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Fuera del mapa se ve el fondo para mantener siempre al jugador centrado.
  const cameraX = Math.floor(player.x * ZOOM - canvas.width / 2);
  const cameraY = Math.floor(player.y * ZOOM - canvas.height / 2);
  const colStart = Math.max(0, Math.floor(cameraX / RTILE));
  const colEnd = Math.min(
    MAP_W - 1,
    Math.ceil((cameraX + canvas.width) / RTILE),
  );
  const rowStart = Math.max(0, Math.floor(cameraY / RTILE));
  const rowEnd = Math.min(
    MAP_H - 1,
    Math.ceil((cameraY + canvas.height) / RTILE),
  );
  for (let y = rowStart; y <= rowEnd; y++) {
    for (let x = colStart; x <= colEnd; x++) {
      const { mask, index } = game.autotileGrid[y][x];
      const variant = game.variantGrid[y][x];
      const { floors, walls } = game.currentBiome.variants;
      const floor = game.grid[y][x] === 0;
      const special = variant !== 0 && !floor ? walls?.[mask]?.[variant] : undefined;
      const col = floor ? (floors?.[variant] ?? 0) : (special ?? index % 7);
      const row = floor ? 7 : special === undefined ? Math.floor(index / 7) : 8;
      const { image, size } = tileSheet;
      ctx.drawImage(
        image,
        col * size,
        row * size,
        size,
        size,
        x * RTILE - cameraX,
        y * RTILE - cameraY,
        RTILE,
        RTILE,
      );
      if (game.portal?.x === x && game.portal.y === y) {
        const icon = { stairs: stairsImage, objective: objectiveImage, portal: portalImage }[game.portal.kind];
        ctx.drawImage(icon, x * RTILE - cameraX, y * RTILE - cameraY, RTILE, RTILE);
      }
    }
  }

  drawItems(ctx, ZOOM, cameraX, cameraY);
  for (const entity of [...game.entities].sort((a, b) => a.y - b.y)) {
    ctx.save();
    if (entity.hp === 0) ctx.globalAlpha = Math.max(0, 1 - (performance.now() - entity.deathAt) / FADE_MS);
    const px = Math.floor(entity.x * ZOOM - cameraX),
      py = Math.floor(entity.y * ZOOM - cameraY);
    ctx.fillStyle = entity.isPlayer
      ? 'rgba(30, 64, 175, 0.42)'
      : 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(px, py + 7, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const animation = entity.anims[entity.state] || entity.anims.Idle;
    const offset = entity.state === 'Attack' ? attackMotion(entity, animation) : { x: 0, y: 0 };
    const scale = ZOOM * entity.stats.size / 100;
    const drawW = animation.fw * scale, drawH = animation.fh * scale;
    const row = Math.min(
      entity.dir,
      Math.floor(animation.img.height / animation.fh) - 1,
    );
    const elapsed = performance.now() - entity.lastHit;
    ctx.save();
    if (entity.isPlayer && elapsed < PLAYER_GRACE_MS && Math.floor(elapsed / 40) % 2) ctx.globalAlpha *= 0.28;
    if (elapsed < 110) ctx.filter = 'sepia(1) saturate(12) hue-rotate(315deg)';
    ctx.drawImage(
      animation.img,
      entity.frame * animation.fw,
      row * animation.fh,
      animation.fw,
      animation.fh,
      Math.floor(px + offset.x * ZOOM - drawW / 2),
      Math.floor(py + offset.y * ZOOM - drawH / 2),
      drawW,
      drawH,
    );

    ctx.restore();
    if (!entity.isPlayer && performance.now() - entity.lastHit < 3000) {
      const fraction = entity.hp / entity.stats.hpMax;
      const x = px - 19, y = Math.round(py - drawH / 2 - 7);
      ctx.fillStyle = '#131921';
      ctx.fillRect(x, y, 38, 6);
      ctx.fillStyle = fraction < 0.25 ? '#ef5350' : fraction <= 0.5 ? '#ffd54f' : '#66cf77';
      ctx.fillRect(x + 1, y + 1, Math.round(36 * fraction), 4);
    }
    const hit = entity.hitNumber;
    if (hit && performance.now() - hit.time < 750) {
      const rise = (performance.now() - hit.time) / 45;
      ctx.font = 'bold 17px system-ui';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#231720';
      ctx.fillStyle = hit.critical ? '#ff9c36' : '#fff';
      ctx.strokeText(hit.damage, px, py - drawH / 2 - rise);
      ctx.fillText(hit.damage, px, py - drawH / 2 - rise);
    }
    if (entity.missUntil > performance.now()) ctx.drawImage(missImage, px - 15, py - drawH / 2 - 22, 30, 16);
    ctx.restore();
  }
  ctx.save();
  drawEffects(ctx, ZOOM, cameraX, cameraY);
  ctx.scale(1.6, 1.6);
  drawHud(ctx, { width: canvas.width / 1.6, height: canvas.height / 1.6 }, player);
  ctx.restore();
}
