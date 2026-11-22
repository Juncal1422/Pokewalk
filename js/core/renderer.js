import { MAP_H, MAP_W, MAX_CHARGE_FRAMES, RTILE, ZOOM } from './constants.js';
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
    game.biomeSel.value = biome.id;
  } catch (error) {
    if (selection !== request) return;
    if (game.currentBiome) game.biomeSel.value = game.currentBiome.id;
    throw new Error(`No se pudo cargar el tileset de ${biome.name}`, {
      cause: error,
    });
  }
}

export function draw() {
  const { player, tileSheet, ctx, canvas } = game;
  if (!player || !tileSheet) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // En los bordes dejo de centrar al jugador para aprovechar toda la vista.
  const cameraX = Math.max(
    0,
    Math.min(
      MAP_W * RTILE - canvas.width,
      Math.floor(player.x * ZOOM - canvas.width / 2),
    ),
  );
  const cameraY = Math.max(
    0,
    Math.min(
      MAP_H * RTILE - canvas.height,
      Math.floor(player.y * ZOOM - canvas.height / 2),
    ),
  );
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
    }
  }

  for (const entity of [...game.entities].sort((a, b) => a.y - b.y)) {
    const px = Math.floor(entity.x * ZOOM - cameraX),
      py = Math.floor(entity.y * ZOOM - cameraY);
    ctx.fillStyle = entity.isPlayer
      ? 'rgba(30, 64, 175, 0.42)'
      : 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(px, py + 7, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (entity.state === 'Charge') {
      const ratio = entity.chargeTime / MAX_CHARGE_FRAMES;
      const pulse = 18 + Math.sin(Date.now() / 65) * 4 + ratio * 8;
      ctx.strokeStyle = ratio >= 1 ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 7, pulse, pulse * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const animation = entity.anims[entity.state] || entity.anims.Idle;
    const drawW = animation.fw * ZOOM,
      drawH = animation.fh * ZOOM;
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
      Math.floor(px - drawW / 2),
      Math.floor(py - drawH / 2),
      drawW,
      drawH,
    );

    if (entity.isPlayer && entity.state === 'Charge') {
      const ratio = entity.chargeTime / MAX_CHARGE_FRAMES,
        width = 44,
        height = 5;
      const x = px - width / 2,
        y = py - drawH / 2 - 12;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
      ctx.fillStyle = ratio >= 1 ? '#facc15' : '#38bdf8';
      ctx.fillRect(x, y, Math.floor(width * ratio), height);
    }
    if (!entity.isPlayer) {
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(px - 22, py - drawH / 2 - 14, 44, 14);
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${entity.dexStr}`, px, py - drawH / 2 - 4);
    }
  }
}
