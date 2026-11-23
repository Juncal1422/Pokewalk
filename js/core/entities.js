import { updateEnemy } from './enemy-ai.js';
import { encounters, onDefeat } from './missions.js';
import { collectItems, dropItem, spawnFloorPotion } from './items.js';
import {
  ANIM_SPEED,
  BODY_RADIUS,
  PLAYER_GRACE_MS, PLAYER_STAGGER_MS,
  AI_SPEED,
  DIR_MAP,
  DIR_VEC,
  PLAYER_SPEED,
  TILE,
  MAP_W,
  MAP_H,
} from './constants.js';
import { statsFor, emptyBonuses, movementRate, attackRate, levelFor, damageFor } from './stats.js';
import { generateDungeon } from './dungeon.js';
import { game } from './state.js';
import { loadPokemonData } from '../data/pokemon-data.js';

export function showToast(message) {
  game.toastEl.textContent = message;
  game.toastEl.style.display = 'block';
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => {
    game.toastEl.style.display = 'none';
  }, 2800);
}

export function createEntity(data, room, isPlayer) {
  const species = game.pokemon.get(data.dex);
  const stats = statsFor(species, game.progress);
  return {
    isPlayer,
    dex: data.dex,
    dexStr: data.dexStr,
    anims: data.anims,
    x: room.cx * TILE + TILE / 2,
    y: room.cy * TILE + TILE / 2,
    dir: 0,
    state: 'Idle',
    frame: 0,
    timer: 0,
    stats,
    hp: stats.hpMax,
    lastHit: -Infinity,
    deathAt: null,
    impactPending: false,
    level: levelFor(species, game.progress),
    speed: isPlayer ? PLAYER_SPEED : AI_SPEED,
    aiTimer: 45,
  };
}

export function setState(entity, state) {
  if (entity.state !== state) {
    entity.state = state;
    entity.frame = 0;
    entity.timer = 0;
  }
}

function bodyRadius(entity) { return Math.min(TILE / 2 - 1, BODY_RADIUS * entity.stats.size / 100); }

function terrainFree(entity, x, y) {
  const radius = bodyRadius(entity);
  const species = game.pokemon.get(entity.dex);
  const crosses = !game.bossArena && game.currentBiome.canCross.some(skill => species[skill]);
  for (const [offsetX, offsetY] of [
    [-radius, -radius],
    [radius, -radius],
    [-radius, radius],
    [radius, radius],
  ]) {
    const tileX = Math.floor((x + offsetX) / TILE),
      tileY = Math.floor((y + offsetY) / TILE);
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= MAP_W ||
      tileY >= MAP_H ||
      (game.grid[tileY][tileX] === 1 && (!crosses || tileX === 0 || tileY === 0 || tileX === MAP_W - 1 || tileY === MAP_H - 1))
    )
      return false;
  }
  return true;
}

export function canMove(entity, x, y) {
  if (!terrainFree(entity, x, y)) return false;
  const radius = bodyRadius(entity);
  // Movimiento y retroceso comparten el mismo cuerpo circular.
  return !game.entities.some(other => other !== entity && other.hp > 0 &&
    Math.hypot(other.x - x, other.y - y) < radius + bodyRadius(other));
}

export function triggerAttack(attacker) {
  if (attacker.state === 'Attack' || attacker.state === 'Hurt') return;
  if (attacker.hp === 0) return;
  attacker.impactPending = true;
  setState(attacker, 'Attack');
}

// Consultamos las posiciones actuales en el impacto: el objetivo puede entrar o esquivar.
function resolveImpact(attacker) {
  attacker.impactPending = false;
  const [vx, vy] = DIR_VEC[attacker.dir];
  const reach = attacker.stats.range;
  // Distancia al segmento delantero, común al golpe y a la recogida al atacar.
  function inStrike(x, y, radius) {
    const dx = x - attacker.x, dy = y - attacker.y;
    const forward = dx * vx + dy * vy;
    if (forward <= 0) return false;
    const along = Math.min(reach, forward);
    return Math.hypot(dx - vx * along, dy - vy * along) <= radius;
  }
  if (attacker.isPlayer) collectItems(attacker, (drop) =>
    Math.hypot(drop.x - attacker.x, drop.y - attacker.y) <= reach && inStrike(drop.x, drop.y, BODY_RADIUS));

  for (const target of game.entities) {
    if (target === attacker || target.hp === 0 || (!attacker.isPlayer && !target.isPlayer && game.mission.target === target.dex)) continue;
    if (!inStrike(target.x, target.y, BODY_RADIUS + bodyRadius(target))) continue;
    const now = performance.now();
    if (target.isPlayer && now - target.lastHit < PLAYER_GRACE_MS) continue;
    const dodge = .05 + (target.isPlayer ? game.perks.dodge : 0);
    if (Math.random() < dodge) {
      target.missUntil = performance.now() + 750;
      continue;
    }
    const critical = Math.random() < 0.10;
    const damage = Math.min(target.hp, damageFor(attacker, target, critical));
    target.hitNumber = { damage, critical, time: now };
    target.hp = Math.max(0, target.hp - damage);
    target.lastHit = performance.now();
    target.frame = target.timer = 0;
    target.impactPending = false;
    setState(target, 'Hurt');
    if (target.hp === 0) {
      target.deathAt = target.lastHit;
      if (!target.isPlayer) {
        onDefeat(target, attacker);
        dropItem(target, attacker);
      }
    }
    if (canMove(target, target.x + vx * 10, target.y + vy * 10)) {
      target.x += vx * 10;
      target.y += vy * 10;
    }
  }
}

// Precargamos todos los sprites antes de sustituir el piso actual.
export async function loadLevel(dex, mission, floor, bonuses = game.player?.bonuses ?? emptyBonuses()) {
  const ids = encounters(mission, floor);
  const [playerData, ...opponents] = await Promise.all([dex, ...ids].map(loadPokemonData));
  if (!playerData || opponents.some(data => !data)) throw new Error('No se pudieron cargar los Pokémon de este piso.');
  const old = game.player;
  const bossFloor = mission.type === 'leader' && floor === mission.floors;
  game.bossArena = bossFloor;
  generateDungeon({ ...mission.layout, open: bossFloor });
  game.portal = null;
  game.mission = mission;
  game.floor = floor;
  game.adventure = mission.number - 1;
  game.progress = 4 + mission.number;
  const player = createEntity(playerData, game.rooms[0], true);
  player.bonuses = bonuses;
  player.stats = statsFor(game.pokemon.get(dex), game.progress, bonuses);
  if (!old) game.initialHP = player.stats.hpMax;
  player.hp = old ? Math.min(player.stats.hpMax, old.hp) : player.stats.hpMax;
  game.player = player;
  game.drops = [];
  game.entities = [player];
  opponents.forEach((data, index) => {
    const enemy = createEntity(data, game.rooms[index * 2 + 1], false);
    enemy.boss = bossFloor;
    enemy.stats = statsFor(game.pokemon.get(data.dex), game.progress, {}, bossFloor);
    if (bossFloor) {
      enemy.tracking = true;
    }
    enemy.hp = enemy.stats.hpMax;
    game.entities.push(enemy);
  });
  spawnFloorPotion();
  game.loadingEl.style.display = 'none';
  console.info('[Piso]', floor, mission.name, ids);
}

function moveEntity(entity, dx, dy) {
  if (dx === 0 && dy === 0) return;
  entity.dir = DIR_MAP[[Math.sign(dx),Math.sign(dy)]] ?? entity.dir;
  const length = Math.hypot(dx, dy);
  const speed = entity.isPlayer ? entity.speed * movementRate(entity.stats.speed) : Math.min(length, entity.speed * movementRate(entity.stats.speed));
  const vx = (dx / length) * speed, vy = (dy / length) * speed;
  if (canMove(entity, entity.x + vx, entity.y)) entity.x += vx;
  if (canMove(entity, entity.x, entity.y + vy)) entity.y += vy;
}

export function updateEntity(entity) {
  if (entity.isPlayer) {
    if (entity.hp > 0 && entity.state === 'Hurt' && performance.now() - entity.lastHit >= PLAYER_STAGGER_MS) setState(entity, 'Idle');
    let dx = 0,
      dy = 0;
    if (game.keys.w || game.keys.arrowup) dy--;
    if (game.keys.s || game.keys.arrowdown) dy++;
    if (game.keys.a || game.keys.arrowleft) dx--;
    if (game.keys.d || game.keys.arrowright) dx++;
    if (!['Attack', 'Hurt'].includes(entity.state)) {
      if (dx || dy) {
        setState(entity, 'Walk');
        moveEntity(entity, dx, dy);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state)) {
    updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.anims[entity.state] || entity.anims.Idle;
  const tempo = entity.state === 'Walk' ? movementRate(entity.stats.speed) :
    entity.state === 'Attack' ? attackRate(entity.stats.attackSpeed) * (entity.isPlayer ? 1 : 0.48) : 1;
  entity.timer += entity.state === 'Hurt' ? 0.55 : ANIM_SPEED * tempo;
  const duration =
    (animation.durs[entity.frame] || 8) + (entity.state === 'Hurt' ? 2 : 0);
  if (entity.state === 'Attack' && entity.impactPending) {
    // Sin marca de impacto usamos el centro de la animación. Una hoja de un
    // fotograma impacta a media duración para conservar la anticipación.
    const marker = Number.isInteger(animation.hitFrame) ? animation.hitFrame : Math.floor(animation.frames / 2);
    const frame = Math.min(animation.frames - 1, Math.max(1, marker));
    if (entity.frame === frame && (frame !== 0 || entity.timer >= duration / 2)) resolveImpact(entity);
  }
  if (entity.timer >= duration) {
    entity.timer = 0;
    entity.frame++;
    if (entity.frame >= animation.frames) {
      entity.frame = 0;
      if (entity.hp > 0 && (entity.state === 'Attack' || entity.state === 'Hurt'))
        setState(entity, 'Idle');
    }
  }
}
