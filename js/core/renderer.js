import { drawItems } from './items.js';
import { drawHud } from './hud.js';
import { sizeScale, rangeScale } from './stats.js';
import { DIR_VEC, ATTACK_RANGE, FADE_MS, MAP_H, MAP_W, MAX_CHARGE_FRAMES, RTILE, ZOOM } from './constants.js';
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
      const special = variant && !floor ? walls?.[mask]?.[variant] : undefined;
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
      if (!floor && game.currentBiome.terrain !== 'wall') {
        const colors = { water: 'rgba(26,126,209,.62)', lava: 'rgba(219,68,16,.7)', void: 'rgba(16,8,35,.91)' };
        ctx.fillStyle = colors[game.currentBiome.terrain];
        ctx.fillRect(x * RTILE - cameraX, y * RTILE - cameraY, RTILE, RTILE);
      }
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

    if (entity.state === 'Charge') {
      const ratio = (entity.chargeTime % MAX_CHARGE_FRAMES) / MAX_CHARGE_FRAMES;
      const pulse = 18 + Math.sin(Date.now() / 65) * 4 + ratio * 8;
      ctx.strokeStyle = entity.chargeTime >= MAX_CHARGE_FRAMES ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 7, pulse, pulse * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const animation = entity.anims[entity.state] || entity.anims.Idle;
    const scale = ZOOM * sizeScale(entity.stats) * (entity.boss ? 2 : 1);
    const drawW = animation.fw * scale, drawH = animation.fh * scale;
    // El alcance extra desplaza solo el dibujo del ataque, nunca el cuerpo físico.
    const phase = (entity.frame + entity.timer / (animation.durs[entity.frame] || 8)) / animation.frames;
    const extension = entity.state === 'Attack'
      ? Math.sin(Math.PI * Math.min(1, phase)) * ATTACK_RANGE * (rangeScale(entity.stats.range) - 1) * ZOOM : 0;
    const [vx, vy] = DIR_VEC[entity.dir];
    const row = Math.min(
      entity.dir,
      Math.floor(animation.img.height / animation.fh) - 1,
    );
    ctx.drawImage(
      animation.img,
      entity.frame * animation.fw,
      row * animation.fh,
      animation.fw,
      animation.fh,
      Math.floor(px + vx * extension - drawW / 2),
      Math.floor(py + vy * extension - drawH / 2),
      drawW,
      drawH,
    );

    if (entity.isPlayer && entity.state === 'Charge') {
      const ratio = (entity.chargeTime % MAX_CHARGE_FRAMES) / MAX_CHARGE_FRAMES,
        width = 44,
        height = 5;
      const x = px - width / 2,
        y = py - drawH / 2 - 12;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
      ctx.fillStyle = entity.chargeTime >= MAX_CHARGE_FRAMES ? '#facc15' : '#38bdf8';
      ctx.fillRect(x, y, Math.floor(width * ratio), height);
    }
    if (!entity.isPlayer && performance.now() - entity.lastHit < 3000) {
      const fraction = entity.hp / entity.stats.hpMax;
      const x = px - 19, y = Math.round(py - drawH / 2 - 7);
      ctx.fillStyle = '#131921';
      ctx.fillRect(x, y, 38, 6);
      ctx.fillStyle = fraction < 0.25 ? '#ef5350' : fraction <= 0.5 ? '#ffd54f' : '#66cf77';
      ctx.fillRect(x + 1, y + 1, Math.round(36 * fraction), 4);
    }
    if (entity.missUntil > performance.now()) ctx.drawImage(missImage, px - 15, py - drawH / 2 - 22, 30, 16);
    ctx.restore();
  }
  drawHud(ctx, canvas, player);
}
