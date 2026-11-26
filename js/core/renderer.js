import {actorRule} from './modifiers.js';
import { assetUrl } from './asset-url.js';
import { drawWorldNotices } from './world-notices.js';
import { synergyActive } from './benefits.js';
import { gameTime } from './clock.js';
import { drawEffects, drawFang } from './abilities.js';
import { attackMotion } from './attack-motion.js';
import { drawItems } from './items.js';
import { drawHud } from './hud.js';
import { PLAYER_GRACE_MS, FADE_MS, MAP_H, MAP_W, RTILE, ZOOM } from './constants.js';
import { game } from './state.js';

import { loadTileset, drawTerrainTile } from './tileset-atlas.js';
let tilesetRequestNumber = 0;

// Activa el atlas solicitado y descarta respuestas de peticiones anteriores.
export async function changeBiome(biome) {
  const request = ++tilesetRequestNumber;
  try {
    const sheet = await loadTileset(biome);
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
portalImage.src = assetUrl('../../tiled/tilesets/Teleporter.png', import.meta.url).href;

const missImage = new Image();
missImage.src = assetUrl('../../assets/ui/miss.png', import.meta.url).href;
const stairsImage = new Image();
stairsImage.src = assetUrl('../../tiled/tilesets/Stairs.png', import.meta.url).href;
const objectiveImage = new Image();
objectiveImage.src = assetUrl('../../assets/items/parcel.png', import.meta.url).href;

// Espera a los recursos de las salidas, el paquete y la indicación de fallo.
export function preparePortal() {
  return Promise.all([portalImage, stairsImage, objectiveImage, missImage].map(image => image.decode()));
}

// Proyecta el piso, ordena combatientes por profundidad y compone efectos, avisos y HUD.
export function draw() {
  const { player, tileSheet, ctx: drawingContext, canvas } = game;
  if (!player || !tileSheet) return;
  const theme = game.canvasTheme;
  drawingContext.imageSmoothingEnabled = false;
  drawingContext.fillStyle = theme.dungeonVoid;
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
  const palettePhase = Math.floor(gameTime() / (game.currentBiome.paletteStepMs ?? 133));
  const sparklePhase = Math.floor(gameTime() / (game.currentBiome.sparkleStepMs ?? game.currentBiome.paletteStepMs ?? 133));
  for (let y = rowStart; y <= rowEnd; y++) {
    for (let x = colStart; x <= colEnd; x++) {
      const terrain = game.grid[y][x];
      const material = terrain === 0 ? 'floor' : terrain === 1 ? 'wall' : game.currentBiome.terrain;
      drawTerrainTile(drawingContext,tileSheet,game.autotileGrid[y][x].mask,material,
        game.variantGrid[y][x],palettePhase,x*RTILE-cameraX,y*RTILE-cameraY,RTILE,sparklePhase);
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
      ? theme.playerShadow
      : theme.otherPokemonShadow;
    drawingContext.beginPath();
    drawingContext.ellipse(screenX, screenY + 7, 15, 7, 0, 0, Math.PI * 2);
    drawingContext.fill();

    const usesWeaponEffect = entity.state === 'Attack' && entity.fangStrike;
    const animation = entity.state === 'Attack' ? entity.attackAnimation ?? entity.anims.Attack : entity.anims[entity.state] || entity.anims.Idle;
    const offset = entity.state === 'Attack' ? attackMotion(entity, animation) : { x: 0, y: 0 };
    const scale = ZOOM * entity.stats.size / 100;
    const spriteWidth = animation.fw * scale, spriteHeight = animation.fh * scale;
    const row = Math.min(
      entity.dir,
      Math.floor(animation.img.height / animation.fh) - 1,
    );
    const correction = entity.state === 'Attack' && !usesWeaponEffect ? animation.offsets?.[row]?.[entity.frame] : null;
    const stationary = usesWeaponEffect || (entity.state === 'Attack' && entity.attackAnimation === entity.anims.Shoot);
    const shiftX = (stationary ? 0 : offset.x*ZOOM) + (correction?.x ?? 0)*scale;
    const shiftY = (stationary ? 0 : offset.y*ZOOM) + (correction?.y ?? 0)*scale;
    const now = gameTime();
    const elapsed = now - entity.lastHit;
    drawingContext.save();
    if (entity.isPlayer && elapsed < PLAYER_GRACE_MS && Math.floor(elapsed / 40) % 2)
      drawingContext.globalAlpha *= theme.graceOpacity;

    // Dorado es el tinte base del jugador. Las señales temporales tienen prioridad.
    if (entity.isPlayer && game.held.has('golden')) drawingContext.filter = theme.goldenFilter;
    if (actorRule(entity,'tropicalEssence')) drawingContext.filter=theme.tropicalFilter;
    if (entity.state==='Attack' && actorRule(entity,'fireAttack')) drawingContext.filter=theme.fireFilter;
    if(entity.shellUntil>now)drawingContext.filter=theme.shellFilter;
    if (entity.isPlayer && game.amuletUntil > now) drawingContext.filter = theme.amuletFilter;
    if (entity.evasionUntil > now) drawingContext.filter = theme.evasionFilter;
    if (elapsed < 110) drawingContext.filter = theme.hitFilter;
    const flash = now - entity.championFlash;
    if (flash >= 0 && flash < 405) drawingContext.filter = theme.leaderFlashFilters[Math.floor(flash / 45) % 3];
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
      const horn = entity.doubleStrike ? offset.secondWeapon : (entity.isPlayer?game.held:entity.benefits).has('rhyhorn_horn');
      const gold = entity.isPlayer && synergyActive(horn?'goldHorn':'goldSpike');
      drawFang(drawingContext,entity.dir,screenX+offset.x*ZOOM,screenY+offset.y*ZOOM,
        ZOOM,offset.opacity,actorRule(entity,'fireAttack')?'fire_spike':horn?'fang':'spine',gold?theme.goldenWeaponFilter:'none');
    }
    if (!entity.isPlayer && gameTime() - entity.lastHit < 3000) {
      const fraction = entity.hp / entity.stats.hpMax;
      const x = screenX - 19, y = Math.round(screenY - spriteHeight / 2 - 7);
      drawingContext.fillStyle = theme.enemyHealthEmpty;
      drawingContext.fillRect(x, y, 38, 6);
      drawingContext.fillStyle = fraction < 0.25 ? theme.healthLow : fraction <= 0.5 ? theme.healthMedium : theme.healthFull;
      drawingContext.fillRect(x + 1, y + 1, Math.round(36 * fraction), 4);
    }
    const hits=(entity.hitNumbers??[]).filter(hit=>gameTime()-hit.time<750);
    for(const [line,hitNumber] of hits.entries()){
      const risePixels = (gameTime() - hitNumber.time) / 45 + line*16;
      drawingContext.font = 'bold 17px Wondermail';
      drawingContext.textAlign = 'center';
      drawingContext.lineWidth = 3;
      drawingContext.strokeStyle = theme.damageOutline;
      drawingContext.fillStyle = hitNumber.critical ? theme.criticalDamageText : theme.damageText;
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

  // Escala sólo el HUD; las coordenadas lógicas conservan el anclaje a las cuatro esquinas.
  drawingContext.save();
  drawingContext.scale(theme.hudScale, theme.hudScale);
  drawHud(drawingContext, {width:canvas.width/theme.hudScale, height:canvas.height/theme.hudScale}, player);
  drawingContext.restore();
  drawingContext.restore();
}
