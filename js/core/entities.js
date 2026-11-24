import { gameTime } from './clock.js';
import { updateBossAbility, releaseSpines } from './abilities.js';
import { amount, playerStats, synergyActive } from './benefits.js';
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
import { groundFree, hasSight } from './terrain.js';
import { generateDungeon } from './dungeon.js';
import { game } from './state.js';
import { loadPokemonData } from '../data/pokemon-data.js';

// Muestra un aviso temporal y sustituye el temporizador del aviso anterior.
export function showToast(message) {
  game.toastEl.textContent = message;
  game.toastEl.style.display = 'block';
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => {
    game.toastEl.style.display = 'none';
  }, 2800);
}

// Construye un combatiente en el centro de su sala con sus estadísticas y animación iniciales.
export function createEntity(spriteData, room, isPlayer) {
  const species = game.pokemon.get(spriteData.dex);
  const stats = statsFor(species, game.progress);
  return {
    isPlayer,
    dex: spriteData.dex,
    dexStr: spriteData.dexStr,
    anims: spriteData.anims,
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

// Reinicia el fotograma y el temporizador únicamente al cambiar de acción.
export function setState(entity, state) {
  if (entity.state !== state) {
    entity.state = state;
    entity.frame = 0;
    entity.timer = 0;
  }
}

// Calcula el radio físico de la entidad a partir de su tamaño y la regla de paso por corredores.
export function bodyRadius(entity) {
  const radius = BODY_RADIUS * entity.stats.size / 100;
  return entity.boss ? radius : Math.min(TILE / 2 - 1, radius);
}

// Combina las habilidades del Pokémon y el medio del bioma con la geometría del terreno.
function terrainFree(entity, x, y) {
  const radius = bodyRadius(entity);
  const species = game.pokemon.get(entity.dex);
  const canCrossTerrain = !game.bossArena && ['water','void','lava'].includes(game.currentBiome.terrain) && game.currentBiome.canCross.some(skill => species[skill]);
  return groundFree(x, y, radius, canCrossTerrain);
}

// Comprueba la posición contra los muros y los cuerpos vivos del piso.
export function canMove(entity, x, y) {
  if (!terrainFree(entity, x, y)) return false;
  const radius = bodyRadius(entity);
  // Movimiento y retroceso comparten el mismo cuerpo circular.
  return !game.entities.some(other => other !== entity && other.hp > 0 &&
    Math.hypot(other.x - x, other.y - y) < radius + bodyRadius(other));
}

// Prepara un solo impacto pendiente y selecciona la animación para el arma equipada.
export function triggerAttack(attacker) {
  if (attacker.state === 'Attack' || attacker.state === 'Hurt') return;
  if (attacker.hp === 0 || (attacker.isPlayer && game.cast)) return;
  attacker.impactPending = true;
  attacker.fangStrike = attacker.isPlayer && (game.held.has('long_horn') || game.held.has('spike'));
  attacker.doubleStrike = attacker.isPlayer && synergyActive('doubleStrike');
  attacker.strikesDone = 0;
  setState(attacker, 'Attack');
}

// Consultamos las posiciones actuales en el impacto: el objetivo puede entrar o esquivar.
function resolveImpact(attacker) {
  attacker.strikesDone++;
  attacker.impactPending = attacker.doubleStrike && attacker.strikesDone < 2;
  const [deltaX, deltaY] = DIR_VEC[attacker.dir];
  const directionLength = Math.hypot(deltaX, deltaY), directionX = deltaX / directionLength, directionY = deltaY / directionLength;
  const reach = attackReach(attacker.stats);
  const strikeRadius = BODY_RADIUS * attacker.stats.size / 100;
  // Distancia al segmento delantero, común al golpe y a la recogida al atacar.
  function inStrike(x, y, radius) {
    const deltaX = x - attacker.x, deltaY = y - attacker.y;
    const forward = deltaX * directionX + deltaY * directionY;
    if (forward <= 0) return false;
    const along = Math.min(reach, forward);
    return Math.hypot(deltaX - directionX * along, deltaY - directionY * along) <= radius;
  }
  if (attacker.isPlayer) collectItems(attacker, (drop) =>
    Math.hypot(drop.x - attacker.x, drop.y - attacker.y) <= reach && inStrike(drop.x, drop.y, strikeRadius));

  for (const target of game.entities) {
    if (target === attacker || target.hp === 0 || (!attacker.isPlayer && !target.isPlayer && game.mission.target === target.dex)) continue;
    if (!hasSight(attacker,target)) continue;
    if (!inStrike(target.x, target.y, strikeRadius + bodyRadius(target))) continue;
    const simulationTime = gameTime();
    if (target.isPlayer && simulationTime - target.lastHit < PLAYER_GRACE_MS) continue;
    const dodge = .05 + (target.isPlayer ? amount('silvercoat') : 0);
    if (Math.random() < dodge) {
      target.missUntil = simulationTime + 750;
      if (attacker.isPlayer && !target.isPlayer) trySidestep(target, attacker, canMove, simulationTime);
      continue;
    }
    const critical = Math.random() < 0.10;
    inflictDamage(attacker,target,damageFor(attacker, target, critical),critical);
    if (target.boss && target.hp && (target.bossResponse || target.abilityCast || target.state==='Attack')) continue;
    if (attacker.impactPending || (attacker.boss && target.isPlayer)) continue;
    // El retroceso se detiene en el primer obstáculo del recorrido.
    for (let step = 0; step < 10; step++) {
      if (!canMove(target, target.x + directionX, target.y + directionY)) break;
      target.x += directionX;
      target.y += directionY;
    }
  }
}

// Ataques normales, habilidades y reflejos comparten derrota, botín y Hurt.
export function inflictDamage(attacker,target,incomingDamage,critical=false,ability=false) {
  if (!target.hp) return;
  const simulationTime = gameTime();
  let blocked = false;
  if (target.isPlayer) {
    if (attacker !== target && simulationTime - target.lastHit < PLAYER_GRACE_MS) return;
    const species = game.pokemon.get(attacker.dex), targetSpecies = game.pokemon.get(target.dex);
    if (attacker !== target && species.essences.some(type => targetSpecies.essences.includes(type))) incomingDamage *= 1 - amount('lovefool');
    blocked = attacker !== target && Math.random() < amount('iron_tag') + amount('deep_scale');
    if (blocked) incomingDamage *= .5;
  }
  let damage = Math.min(target.hp, Math.max(1, Math.round(incomingDamage)));
  if (ability && attacker.boss && target.isPlayer) damage = Math.min(damage, Math.floor(target.stats.hpMax / 2));
  if (!damage) return;
  target.hitNumber = { damage, critical, time: simulationTime };
  target.hp = Math.max(0, target.hp - damage);
  target.lastHit = simulationTime;
  target.sidestep = null;
  if (target.isPlayer && game.held.has('green_spike') &&
      (critical || synergyActive('damageSpines') || (blocked && synergyActive('blockSpines')))) releaseSpines(target);
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
export async function loadLevel(pokedexNumber, mission, floor, bonuses = game.player?.bonuses ?? emptyBonuses()) {
  const enemyDexNumbers = encounters(mission, floor);
  const [playerData, ...opponents] = await Promise.all([pokedexNumber, ...enemyDexNumbers].map(loadPokemonData));
  if (!playerData || opponents.some(spriteData => !spriteData)) throw new Error('No se pudieron cargar los Pokémon de este piso.');
  // Los recursos se validan antes de reemplazar el piso. La nueva forma conserva los PV actuales hasta su máximo.
  const previousPlayer = game.player;
  const bossFloor = mission.type === 'leader' && floor === mission.floors;
  game.bossArena = bossFloor;
  generateDungeon({ ...mission.layout, open: bossFloor });
  game.worldNotices = [];
  game.effects = [];
  game.cast = null;
  game.portal = null;
  game.mission = mission;
  game.floor = floor;
  game.adventure = mission.number - 1;
  const enemyDifficulty = 4 + mission.number;
  const player = createEntity(playerData, game.rooms[0], true);
  player.bonuses = bonuses;
  player.stats = playerStats(game.pokemon.get(pokedexNumber), game.progress, bonuses);
  if (!previousPlayer) game.initialHP = player.stats.hpMax;
  player.hp = previousPlayer ? Math.min(player.stats.hpMax, previousPlayer.hp) : player.stats.hpMax;
  game.player = player;
  game.drops = [];
  game.entities = [player];
  opponents.forEach((spriteData, index) => {
    const enemy = createEntity(spriteData, game.rooms[index + 1], false);
    enemy.boss = bossFloor;
    const species = game.pokemon.get(spriteData.dex);
    enemy.level = levelFor(species, enemyProgress(enemyDifficulty));
    enemy.stats = statsFor(species, enemyDifficulty, {}, bossFloor, true);
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
  console.info('[Piso]', floor, mission.name, enemyDexNumbers);
}

// Normaliza la dirección y avanza en subpasos para comprobar incluso las esquinas estrechas.
function moveEntity(entity, deltaX, deltaY) {
  if (deltaX === 0 && deltaY === 0) return;
  entity.dir = DIR_MAP[[Math.sign(deltaX),Math.sign(deltaY)]] ?? entity.dir;
  const length = Math.hypot(deltaX, deltaY);
  const speed = entity.isPlayer ? entity.speed * movementRate(entity.stats.speed) : Math.min(length, entity.speed * movementRate(entity.stats.speed));
  const movementX = (deltaX / length) * speed, movementY = (deltaY / length) * speed;
  // Primero probamos la diagonal real: separar siempre los ejes bloqueaba
  // cuerpos pequeños justo en el punto más estrecho entre dos esquinas.
  const steps = Math.ceil(speed);
  for (let substepIndex = 0; substepIndex < steps; substepIndex++) {
    const x = entity.x + movementX / steps, y = entity.y + movementY / steps;
    if (canMove(entity, x, y)) { entity.x = x; entity.y = y; }
    else if (movementX && canMove(entity, x, entity.y)) entity.x = x;
    else if (movementY && canMove(entity, entity.x, y)) entity.y = y;
    else break;
  }
}

// Procesa controles o IA y avanza la animación hasta el impacto y el final de la acción.
export function updateEntity(entity) {
  if (entity.isPlayer) {
    if (entity.hp > 0 && entity.state === 'Hurt' && gameTime() - entity.lastHit >= PLAYER_STAGGER_MS) setState(entity, 'Idle');
    let deltaX = 0,
      deltaY = 0;
    if (game.keys.w || game.keys.arrowup) deltaY--;
    if (game.keys.s || game.keys.arrowdown) deltaY++;
    if (game.keys.a || game.keys.arrowleft) deltaX--;
    if (game.keys.d || game.keys.arrowright) deltaX++;
    if (!game.cast && !['Attack', 'Hurt'].includes(entity.state)) {
      if (deltaX || deltaY) {
        setState(entity, 'Walk');
        moveEntity(entity, deltaX, deltaY);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state)) {
    if (!entity.boss || !updateBossAbility(entity))
      updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.state === 'Attack' && entity.fangStrike ? entity.anims.Charge : entity.anims[entity.state] || entity.anims.Idle;
  const tempo = entity.state === 'Walk' ? movementRate(entity.stats.speed) :
    entity.state === 'Attack' ? attackRate(entity.stats.attackSpeed) * (entity.isPlayer ? 1 : 0.48) : 1;
  const isHurt = entity.state === 'Hurt';
  const frameTime = animation.durs[entity.frame] || 8;
  const duration = isHurt ? Math.ceil((frameTime + 2) / 0.55) : frameTime;
  entity.timer += isHurt ? (entity.boss ? 2 : 1) : ANIM_SPEED * tempo;
  if (entity.state === 'Attack' && entity.impactPending) {
    const { impactsDue } = attackMotion(entity,animation);
    while (entity.impactPending && entity.strikesDone < impactsDue) resolveImpact(entity);
  }
  if (entity.timer >= duration) {
    entity.timer -= duration;
    entity.frame++;
    if (entity.frame >= animation.frames) {
      entity.frame = 0;
      if (entity.hp > 0 && (entity.state === 'Attack' || entity.state === 'Hurt'))
        setState(entity, 'Idle');
    }
  }
}
