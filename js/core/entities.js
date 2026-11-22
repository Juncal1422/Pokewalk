import {
  ANIM_SPEED,
  BODY_RADIUS,
  MAX_HP,
  ATTACK_RANGE,
  AI_SPEED,
  DEFAULT_DEX,
  DIR_MAP,
  DIR_VEC,
  EXCLUDED_DEX,
  MAX_CHARGE_FRAMES,
  MAX_DEX,
  PLAYER_SPEED,
  TILE,
  MAP_W,
  MAP_H,
} from './constants.js';
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
    hp: MAX_HP,
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

export function canMove(entity, x, y) {
  const radius = BODY_RADIUS;
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
      game.grid[tileY][tileX] === 1
    )
      return false;
  }
  // Movimiento y retroceso comparten el mismo cuerpo circular.
  return !game.entities.some(other => other !== entity && other.hp > 0 &&
    Math.hypot(other.x - x, other.y - y) < radius * 2);
}

export function triggerAttack(attacker) {
  if (attacker.state === 'Attack' || attacker.state === 'Hurt') return;
  if (attacker.hp === 0) return;
  attacker.chargeTime = 0;
  attacker.impactPending = true;
  setState(attacker, 'Attack');
}

// Consultamos las posiciones actuales en el impacto: el objetivo puede entrar o esquivar.
function resolveImpact(attacker) {
  attacker.impactPending = false;
  const [vx, vy] = DIR_VEC[attacker.dir];
  const hitX = attacker.x + vx * ATTACK_RANGE,
    hitY = attacker.y + vy * ATTACK_RANGE;
  for (const target of game.entities) {
    if (
      target === attacker || target.hp === 0 ||
      Math.hypot(target.x - hitX, target.y - hitY) > BODY_RADIUS * 2
    )
      continue;
    target.chargeTime = 0;
    target.hp--;
    target.frame = target.timer = 0;
    target.impactPending = false;
    setState(target, 'Hurt');
    if (target.hp === 0) target.deathAt = performance.now();
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

async function loadEncounters() {
  // Saco las especies sin reposición. Si falta una hoja, pruebo otra para esa sala.
  const pool = Array.from({ length: MAX_DEX }, (_, i) => i + 1).filter(
    (dex) => !EXCLUDED_DEX.has(dex),
  );
  return Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const index = Math.floor(Math.random() * pool.length);
        const [dex] = pool.splice(index, 1);
        const data = await loadPokemonData(dex);
        if (data) return data;
      }
      return null;
    }),
  );
}

export async function loadLevel(dex = DEFAULT_DEX) {
  const [playerData, opponents] = await Promise.all([
    loadPokemonData(dex),
    loadEncounters(),
  ]);
  if (!playerData) throw new Error('No se pudo cargar el Pokémon del jugador.');
  const hp = game.player?.hp ?? MAX_HP;
  generateDungeon();
  game.portal = null;
  game.player = createEntity(playerData, game.rooms[0], true);
  game.player.hp = hp;
  game.entities = [game.player];
  opponents.forEach((data, index) => {
    if (data)
      game.entities.push(createEntity(data, game.rooms[index * 2 + 1], false));
  });
  game.loadingEl.style.display = 'none';
}

function moveEntity(entity, dx, dy) {
  if (dx === 0 && dy === 0) return;
  entity.dir = DIR_MAP[`${dx},${dy}`] ?? entity.dir;
  const length = Math.hypot(dx, dy);
  const vx = (dx / length) * entity.speed,
    vy = (dy / length) * entity.speed;
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
      entity.chargeTime = Math.min(MAX_CHARGE_FRAMES, entity.chargeTime + 1);
      if (dx || dy) entity.dir = DIR_MAP[`${dx},${dy}`] ?? entity.dir;
    } else if (!['Attack', 'Hurt'].includes(entity.state)) {
      if (dx || dy) {
        setState(entity, 'Walk');
        moveEntity(entity, dx, dy);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state)) {
    entity.aiTimer--;
    if (entity.aiTimer <= 0) {
      entity.aiTimer = 50 + Math.floor(Math.random() * 80);
      const directions = [
        [0, 1],
        [1, 1],
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, 0],
      ];
      entity.aiDir = directions[Math.floor(Math.random() * directions.length)];
    }
    const [dx, dy] = entity.aiDir;
    if (dx || dy) {
      setState(entity, 'Walk');
      const previousX = entity.x,
        previousY = entity.y;
      moveEntity(entity, dx, dy);
      if (previousX === entity.x && previousY === entity.y) entity.aiTimer = 0;
    } else setState(entity, 'Idle');

    entity.atkCooldown--;
    if (entity.atkCooldown <= 0) {
      entity.atkCooldown = 130 + Math.floor(Math.random() * 150);
      const nearby = game.entities.find(
        (other) =>
          other !== entity && other.hp > 0 &&
          Math.hypot(other.x - entity.x, other.y - entity.y) < 42,
      );
      if (nearby) {
        const sx = Math.sign(Math.round((nearby.x - entity.x) / 14)),
          sy = Math.sign(Math.round((nearby.y - entity.y) / 14));
        entity.dir = DIR_MAP[`${sx},${sy}`] ?? entity.dir;
      }
      triggerAttack(entity);
    }
  }

  const animation = entity.anims[entity.state] || entity.anims.Idle;
  entity.timer += entity.state === 'Hurt' ? 0.55 : ANIM_SPEED;
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
