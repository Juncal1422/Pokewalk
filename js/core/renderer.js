import { drawWorldNotices } from './world-notices.js';
import { synergyActive } from './benefits.js';
import { gameTime } from './clock.js';
import { drawEffects, drawFang } from './abilities.js';
import { attackMotion } from './attack-motion.js';
import { drawItems } from './items.js';
import { drawHud } from './hud.js';
import { PLAYER_GRACE_MS, FADE_MS, MAP_H, MAP_W, RTILE, ZOOM } from './constants.js';
import { game } from './state.js';

const tilesets = new Map();
let tilesetRequestNumber = 0;

// Decodifica y valida el atlas de siete por nueve celdas y comparte la carga por URL.
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

// Activa el atlas solicitado y descarta respuestas de peticiones anteriores.
export async function changeBiome(biome) {
  const request = ++tilesetRequestNumber;
  try {
    const sheet = await loadTileset(biome.tileset);
    if (tilesetRequestNumber !== request) return;
    game.tileSheet = sheet;
    game.currentBiome = biome;
    console.debug('[Render] Atlas preparado', biome.name, biome.terrain);
  } catch (error) {
    if (tilesetRequestNumber !== request) return;
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
objectiveImage.src = new URL('../../assets/items/parcel.png', import.meta.url).href;

// Espera a los recursos de las salidas, el paquete y la indicación de fallo.
export function preparePortal() {
  return Promise.all([portalImage, stairsImage, objectiveImage, missImage].map(image => image.decode()));
}

// Proyecta el piso, ordena combatientes por profundidad y compone efectos, avisos y HUD.
export function draw() {
  const { player, tileSheet, ctx: drawingContext, canvas } = game;
  if (!player || !tileSheet) return;
  drawingContext.imageSmoothingEnabled = false;
  drawingContext.fillStyle = '#0b0d12';
  drawingContext.fillRect(0, 0, canvas.width, canvas.height);

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
      const atlasColumn = floor ? (floors?.[variant] ?? 0) : (special ?? index % 7);
      const row = floor ? 7 : special === undefined ? Math.floor(index / 7) : 8;
      const { image, size } = tileSheet;
      drawingContext.drawImage(
        image,
        atlasColumn * size,
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
        drawingContext.drawImage(icon, x * RTILE - cameraX, y * RTILE - cameraY, RTILE, RTILE);
      }
    }
  }

  drawItems(drawingContext, ZOOM, cameraX, cameraY);
  for (const entity of [...game.entities].sort((firstEntity, secondEntity) => firstEntity.y - secondEntity.y)) {
    drawingContext.save();
    if (entity.hp === 0) drawingContext.globalAlpha = Math.max(0, 1 - (gameTime() - entity.deathAt) / FADE_MS);
    const screenX = Math.floor(entity.x * ZOOM - cameraX),
      screenY = Math.floor(entity.y * ZOOM - cameraY);
    drawingContext.fillStyle = entity.isPlayer
      ? 'rgba(30, 64, 175, 0.42)'
      : 'rgba(0, 0, 0, 0.42)';
    drawingContext.beginPath();
    drawingContext.ellipse(screenX, screenY + 7, 15, 7, 0, 0, Math.PI * 2);
    drawingContext.fill();

    const usesWeaponEffect = entity.state === 'Attack' && entity.fangStrike;
    const animation = usesWeaponEffect ? entity.anims.Charge : entity.anims[entity.state] || entity.anims.Idle;
    const offset = entity.state === 'Attack' ? attackMotion(entity, animation) : { x: 0, y: 0 };
    const scale = ZOOM * entity.stats.size / 100;
    const spriteWidth = animation.fw * scale, spriteHeight = animation.fh * scale;
    const row = Math.min(
      entity.dir,
      Math.floor(animation.img.height / animation.fh) - 1,
    );
    const correction = entity.state === 'Attack' && !usesWeaponEffect ? animation.offsets?.[row]?.[entity.frame] : null;
    const shiftX = (usesWeaponEffect ? 0 : offset.x*ZOOM) + (correction?.x ?? 0)*scale;
    const shiftY = (usesWeaponEffect ? 0 : offset.y*ZOOM) + (correction?.y ?? 0)*scale;
    const elapsed = gameTime() - entity.lastHit;
    drawingContext.save();
    if (entity.isPlayer && elapsed < PLAYER_GRACE_MS && Math.floor(elapsed / 40) % 2) drawingContext.globalAlpha *= 0.28;
    if (entity.isPlayer && game.amuletUntil > gameTime()) drawingContext.filter = 'sepia(.35) hue-rotate(235deg) saturate(1.45)';
    if (elapsed < 110) drawingContext.filter = 'sepia(1) saturate(12) hue-rotate(315deg)';
    drawingContext.drawImage(
      animation.img,
      entity.frame * animation.fw,
      row * animation.fh,
      animation.fw,
      animation.fh,
      Math.floor(screenX + shiftX - spriteWidth / 2),
      Math.floor(screenY + shiftY - spriteHeight / 2),
      spriteWidth,
      spriteHeight,
    );

    drawingContext.restore();
    if (usesWeaponEffect) {
      const horn = entity.doubleStrike ? offset.secondWeapon : (entity.isPlayer?game.held:entity.benefits).has('long_horn');
      const gold = entity.isPlayer && synergyActive(horn?'goldHorn':'goldSpike');
      drawFang(drawingContext,entity.dir,screenX+offset.x*ZOOM,screenY+offset.y*ZOOM,
        ZOOM,offset.opacity,horn?'fang':'spine',gold?'sepia(1) saturate(5)':'none');
    }
    if (!entity.isPlayer && gameTime() - entity.lastHit < 3000) {
      const fraction = entity.hp / entity.stats.hpMax;
      const x = screenX - 19, y = Math.round(screenY - spriteHeight / 2 - 7);
      drawingContext.fillStyle = '#131921';
      drawingContext.fillRect(x, y, 38, 6);
      drawingContext.fillStyle = fraction < 0.25 ? '#ef5350' : fraction <= 0.5 ? '#ffd54f' : '#66cf77';
      drawingContext.fillRect(x + 1, y + 1, Math.round(36 * fraction), 4);
    }
    const hitNumber = entity.hitNumber;
    if (hitNumber && gameTime() - hitNumber.time < 750) {
      const risePixels = (gameTime() - hitNumber.time) / 45;
      drawingContext.font = 'bold 17px Wondermail';
      drawingContext.textAlign = 'center';
      drawingContext.lineWidth = 3;
      drawingContext.strokeStyle = '#231720';
      drawingContext.fillStyle = hitNumber.critical ? '#ff9c36' : '#fff';
      drawingContext.strokeText(hitNumber.damage, screenX, screenY - spriteHeight / 2 - risePixels);
      drawingContext.fillText(hitNumber.damage, screenX, screenY - spriteHeight / 2 - risePixels);
    }
    if (entity.missUntil > gameTime()) drawingContext.drawImage(missImage, screenX - 15, screenY - spriteHeight / 2 - 22, 30, 16);
    drawingContext.restore();
  }
  drawingContext.save();
  drawEffects(drawingContext, ZOOM, cameraX, cameraY);
  // Los avisos se superponen a todos los combatientes y efectos, incluso cuando cambia la profundidad del jugador.
  drawWorldNotices(drawingContext, ZOOM, cameraX, cameraY);
  drawingContext.scale(.8, .8);
  drawHud(drawingContext, { width: canvas.width / .8, height: canvas.height / .8 }, player);
  drawingContext.restore();
}
