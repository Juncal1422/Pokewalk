import { effect, updateBossAbility } from './abilities.js';
import { amount, playerStats } from './benefits.js';
import { attackMotion } from './attack-motion.js';
import { updateEnemy, trySidestep } from './enemy-ai.js';
import { encounters, onDefeat } from './missions.js';
import { collectItems, spawnFloorItems } from './items.js';
import {
  ANIM_SPEED,
  BODY_RADIUS,
  PLAYER_GRACE_MS, PLAYER_STAGGER_MS,
  AI_SPEED,
  DIR_MAP,
  DIR_VEC,
  PLAYER_SPEED,
  TILE,
} from './constants.js';
import { statsFor, emptyBonuses, movementRate, attackRate, levelFor, enemyProgress, attackReach, damageFor } from './stats.js';
import { groundFree } from './terrain.js';
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

export function bodyRadius(entity) {
  const radius = BODY_RADIUS * entity.stats.size / 100;
  return entity.boss ? radius : Math.min(TILE / 2 - 1, radius);
}

function terrainFree(entity, x, y) {
  const radius = bodyRadius(entity);
  const species = game.pokemon.get(entity.dex);
  const crosses = !game.bossArena && game.currentBiome.canCross.some(skill => species[skill]);
  return groundFree(x, y, radius, crosses);
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
  if (attacker.hp === 0 || (attacker.isPlayer && game.cast)) return;
  attacker.impactPending = true;
  setState(attacker, 'Attack');
}

// Consultamos las posiciones actuales en el impacto: el objetivo puede entrar o esquivar.
function resolveImpact(attacker) {
  attacker.impactPending = false;
  const [dx, dy] = DIR_VEC[attacker.dir];
  const norm = Math.hypot(dx, dy), vx = dx / norm, vy = dy / norm;
  const reach = attackReach(attacker.stats);
  const strikeRadius = BODY_RADIUS * attacker.stats.size / 100;
  // Distancia al segmento delantero, común al golpe y a la recogida al atacar.
  function inStrike(x, y, radius) {
    const dx = x - attacker.x, dy = y - attacker.y;
    const forward = dx * vx + dy * vy;
    if (forward <= 0) return false;
    const along = Math.min(reach, forward);
    return Math.hypot(dx - vx * along, dy - vy * along) <= radius;
  }
  if (attacker.isPlayer) collectItems(attacker, (drop) =>
    Math.hypot(drop.x - attacker.x, drop.y - attacker.y) <= reach && inStrike(drop.x, drop.y, strikeRadius));

  if (attacker.isPlayer && game.held.has('big_fang')) {
    effect('fang',attacker.x+vx*reach,attacker.y+vy*reach,250,attacker.dir);
  }
  for (const target of game.entities) {
    if (target === attacker || target.hp === 0 || (!attacker.isPlayer && !target.isPlayer && game.mission.target === target.dex)) continue;
    if (!inStrike(target.x, target.y, strikeRadius + bodyRadius(target))) continue;
    const now = performance.now();
    if (target.isPlayer && now - target.lastHit < PLAYER_GRACE_MS) continue;
    const dodge = .05 + (target.isPlayer ? amount('silvercoat') : 0);
    if (Math.random() < dodge) {
      target.missUntil = now + 750;
      if (attacker.isPlayer && !target.isPlayer) trySidestep(target, attacker, canMove, now);
      continue;
    }
    const critical = Math.random() < 0.10;
    inflictDamage(attacker,target,damageFor(attacker, target, critical),critical);
    if (target.boss && target.hp && (target.bossResponse || target.abilityCast || target.state==='Attack')) continue;
    // El retroceso se detiene en el primer obstáculo del recorrido.
    for (let step = 0; step < 10; step++) {
      if (!canMove(target, target.x + vx, target.y + vy)) break;
      target.x += vx;
      target.y += vy;
    }
  }
}

// Ataques normales, habilidades y reflejos comparten derrota, botín y Hurt.
export function inflictDamage(attacker,target,raw,critical=false) {
  if (!target.hp) return;
  const now = performance.now();
  if (target.isPlayer) {
    if (now - target.lastHit < PLAYER_GRACE_MS) return;
    const species = game.pokemon.get(attacker.dex), form = game.pokemon.get(target.dex);
    if (species.essences.some(type => form.essences.includes(type))) raw *= 1 - amount('lovefool');
    if (Math.random() < amount('iron_tag')) raw *= .5;
  }
  let damage = Math.min(target.hp, Math.max(1, Math.round(raw)));
  if (attacker.boss && target.isPlayer) damage = Math.min(damage, Math.floor(target.stats.hpMax / 2));
  if (!damage) return;
  target.hitNumber = { damage, critical, time: now };
  target.hp = Math.max(0, target.hp - damage);
  target.lastHit = now;
  target.sidestep = null;
  if (target.isPlayer && game.held.has('green_spike') && attacker.hp) {
    inflictDamage(target, attacker, Math.max(1, target.stats.defense * amount('green_spike')));
  }
  // Tras el segundo impacto el líder termina Hurt y ejecuta una respuesta.
  // Los impactos adicionales siguen descontando PV, incluso durante la réplica.
  if (target.boss && target.hp && (target.bossResponse || target.state === 'Attack' || target.abilityCast)) return;
  if (target.boss && target.hp) {
    target.hitsWithoutAction = (target.hitsWithoutAction || 0) + 1;
    target.bossResponse = target.hitsWithoutAction >= 2;
  }
  target.frame = target.timer = 0;
  target.impactPending = false;
  setState(target, 'Hurt');
  if (target.hp === 0) {
    target.deathAt = target.lastHit;
    if (!target.isPlayer) {
      onDefeat(target, attacker);
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
  game.effects = [];
  game.cast = null;
  game.portal = null;
  game.mission = mission;
  game.floor = floor;
  game.adventure = mission.number - 1;
  game.progress = 4 + mission.number;
  const player = createEntity(playerData, game.rooms[0], true);
  player.bonuses = bonuses;
  player.stats = playerStats(game.pokemon.get(dex), game.progress, bonuses);
  if (!old) game.initialHP = player.stats.hpMax;
  player.hp = old ? Math.min(player.stats.hpMax, old.hp) : player.stats.hpMax;
  game.player = player;
  game.drops = [];
  game.entities = [player];
  opponents.forEach((data, index) => {
    const enemy = createEntity(data, game.rooms[index + 1], false);
    enemy.boss = bossFloor;
    const species = game.pokemon.get(data.dex);
    enemy.level = levelFor(species, enemyProgress(game.progress));
    enemy.stats = statsFor(species, game.progress, {}, bossFloor, true);
    if (bossFloor) {
      const benefit = game.donors.get(species.name);
      enemy.activeBenefit = benefit?.active ? benefit.id : null;
      enemy.home = { x: enemy.x, y: enemy.y };
      enemy.tracking = true;
    }
    enemy.hp = enemy.stats.hpMax;
    game.entities.push(enemy);
  });
  spawnFloorItems();
  game.loadingEl.style.display = 'none';
  console.info('[Piso]', floor, mission.name, ids);
}

function moveEntity(entity, dx, dy) {
  if (dx === 0 && dy === 0) return;
  entity.dir = DIR_MAP[[Math.sign(dx),Math.sign(dy)]] ?? entity.dir;
  const length = Math.hypot(dx, dy);
  const speed = entity.isPlayer ? entity.speed * movementRate(entity.stats.speed) : Math.min(length, entity.speed * movementRate(entity.stats.speed));
  const vx = (dx / length) * speed, vy = (dy / length) * speed;
  // Primero probamos la diagonal real: separar siempre los ejes bloqueaba
  // cuerpos pequeños justo en el punto más estrecho entre dos esquinas.
  const steps = Math.ceil(speed);
  for (let i = 0; i < steps; i++) {
    const x = entity.x + vx / steps, y = entity.y + vy / steps;
    if (canMove(entity, x, y)) { entity.x = x; entity.y = y; }
    else if (vx && canMove(entity, x, entity.y)) entity.x = x;
    else if (vy && canMove(entity, entity.x, y)) entity.y = y;
    else break;
  }
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
    if (!game.cast && !['Attack', 'Hurt'].includes(entity.state)) {
      if (dx || dy) {
        setState(entity, 'Walk');
        moveEntity(entity, dx, dy);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state)) {
    if (!entity.boss || !updateBossAbility(entity))
      updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.anims[entity.state] || entity.anims.Idle;
  const tempo = entity.state === 'Walk' ? movementRate(entity.stats.speed) :
    entity.state === 'Attack' ? attackRate(entity.stats.attackSpeed) * (entity.isPlayer ? 1 : 0.48) : 1;
  const hurt = entity.state === 'Hurt';
  const frameTime = animation.durs[entity.frame] || 8;
  const duration = hurt ? Math.ceil((frameTime + 2) / 0.55) : frameTime;
  entity.timer += hurt ? (entity.boss ? 2 : 1) : ANIM_SPEED * tempo;
  if (entity.state === 'Attack' && entity.impactPending && attackMotion(entity, animation).impact) {
    resolveImpact(entity);
  }
  if (entity.timer >= duration) {
    entity.timer = hurt ? entity.timer - duration : 0;
    entity.frame++;
    if (entity.frame >= animation.frames) {
      entity.frame = 0;
      if (entity.hp > 0 && (entity.state === 'Attack' || entity.state === 'Hurt'))
        setState(entity, 'Idle');
    }
  }
}
