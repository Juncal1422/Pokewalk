import { updateEnemy } from './enemy-ai.js';
import { encounters, onDefeat } from './missions.js';
import { dropItem, spawnFloorPotion } from './items.js';
import {
  ANIM_SPEED,
  BODY_RADIUS,
  ATTACK_RANGE,
  AI_SPEED,
  DEFAULT_DEX,
  DIR_MAP,
  DIR_VEC,
  MAX_CHARGE_FRAMES,
  PLAYER_SPEED,
  TILE,
  MAP_W,
  MAP_H,
} from './constants.js';
import { initialStats, rate, sizeScale, rangeScale, scaledStat, refreshStats } from './stats.js';
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
  const stats = isPlayer ? initialStats() : { ...game.pokemon.get(data.dex).stats };
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
    chargeTime: 0,
    speed: isPlayer ? PLAYER_SPEED : AI_SPEED,
    aiDir: [0, 0],
    aiTimer: 45,
    atkCooldown: 120 + Math.floor(Math.random() * 140),
  };
}

export function setState(entity, state) {
  if (entity.state !== state) {
    entity.state = state;
    entity.frame = 0;
    entity.timer = 0;
  }
}

// El radio físico deja margen en los pasillos de una casilla hasta tamaño 15.
function bodyRadius(entity) {
  return Math.min(TILE / 2 - 1, BODY_RADIUS * sizeScale(entity.stats)) * (entity.boss ? 2 : 1);
}

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
  // Las barras completas se liquidan una sola vez en el fotograma de impacto.
  const bars = attacker.state === 'Charge' ? Math.floor(attacker.chargeTime / MAX_CHARGE_FRAMES) : 0;
  attacker.attackDamage = attacker.stats.atkdmg + bars * attacker.stats.chargedmg;
  attacker.chargeTime = 0;
  attacker.impactPending = true;
  setState(attacker, 'Attack');
}

// Consultamos las posiciones actuales en el impacto: el objetivo puede entrar o esquivar.
function resolveImpact(attacker, damage = attacker.attackDamage ?? attacker.stats.atkdmg) {
  attacker.impactPending = false;
  const [vx, vy] = DIR_VEC[attacker.dir];
  const reach = ATTACK_RANGE * rangeScale(attacker.stats.range);
  for (const target of game.entities) {
    if (target === attacker || target.hp === 0 || (!attacker.isPlayer && !target.isPlayer && game.mission.target === target.dex)) continue;
    // Distancia al segmento frontal: al ampliar el alcance siguen entrando
    // los objetivos cercanos, incluso en diagonal.
    const dx = target.x - attacker.x, dy = target.y - attacker.y;
    const distance = dx * vx + dy * vy;
    if (distance <= 0) continue;
    const along = Math.min(reach, distance);
    if (Math.hypot(dx - vx * along, dy - vy * along) > BODY_RADIUS * (1 + sizeScale(target.stats) * (target.boss ? 2 : 1))) continue;
    const dodge = .05 + (target.isPlayer ? game.perks.dodge : 0);
    if (Math.random() < dodge) {
      target.missUntil = performance.now() + 750;
      continue;
    }
    target.chargeTime = 0;
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

export function startCharge() {
  if (!game.player || ['Attack', 'Hurt', 'Charge'].includes(game.player.state))
    return;
  setState(game.player, 'Charge');
  game.player.chargeTime = 0;
}

// Precargamos todos los sprites antes de sustituir el piso actual.
export async function loadLevel(dex, mission, floor) {
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
  const player = createEntity(playerData, game.rooms[0], true);
  player.adventure = game.adventure;
  player.baseStats = old?.baseStats ?? initialStats();
  player.floorStats = {};
  refreshStats(player);
  player.hp = old ? Math.min(player.stats.hpMax, Math.max(1,
    Math.round(old.hp * player.stats.hpMax / old.stats.hpMax))) : player.stats.hpMax;
  game.player = player;
  game.drops = [];
  game.entities = [player];
  opponents.forEach((data, index) => {
    const enemy = createEntity(data, game.rooms[index * 2 + 1], false);
    enemy.boss = bossFloor;
    for (const key of Object.keys(enemy.stats)) enemy.stats[key] = scaledStat(key, enemy.stats[key], game.adventure);
    if (enemy.boss) {
      // Después del escalado de aventura, el líder tiene más aguante y presión ofensiva.
      for (const [key, factor] of Object.entries({ hpMax: 3, atkdmg: 2, chargedmg: 2 })) {
        enemy.stats[key] = Math.min(Number.MAX_SAFE_INTEGER, enemy.stats[key] * factor);
      }
      for (const key of ['speed', 'atkspeed', 'range', 'chargespeed']) {
        enemy.stats[key] = Math.min(15, enemy.stats[key] + 2);
      }
      enemy.tracking = true;
      enemy.atkCooldown = 0;
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
  const speed = entity.isPlayer ? entity.speed * rate(entity.stats.speed) : Math.min(length, entity.speed * rate(entity.stats.speed));
  const vx = (dx / length) * speed, vy = (dy / length) * speed;
  if (canMove(entity, entity.x + vx, entity.y)) entity.x += vx;
  if (canMove(entity, entity.x, entity.y + vy)) entity.y += vy;
}

export function updateEntity(entity) {
  if (entity.isPlayer) {
    let dx = 0,
      dy = 0;
    if (game.keys.w || game.keys.arrowup) dy--;
    if (game.keys.s || game.keys.arrowdown) dy++;
    if (game.keys.a || game.keys.arrowleft) dx--;
    if (game.keys.d || game.keys.arrowright) dx++;
    if (entity.state === 'Charge') {
      if (dx || dy) entity.dir = DIR_MAP[`${dx},${dy}`] ?? entity.dir;
      entity.chargeTime += rate(entity.stats.chargespeed);

    } else if (!['Attack', 'Hurt'].includes(entity.state)) {
      if (dx || dy) {
        setState(entity, 'Walk');
        moveEntity(entity, dx, dy);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state)) {
    updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.anims[entity.state] || entity.anims.Idle;
  const tempo = entity.state === 'Walk' ? rate(entity.stats.speed) :
    entity.state === 'Attack' ? rate(entity.stats.atkspeed) : 1;
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
