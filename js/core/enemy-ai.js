import { groundFree } from './terrain.js';
import { TILE } from './constants.js';
import { game } from './state.js';

const cell = position => Math.floor(position / TILE);
const center = index => (index + 0.5) * TILE;
const land = (x, y) => game.grid[y]?.[x] === 0;
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const standingOnLand = (x, y) => groundFree(x, y, 0.01);

// El destino depende del terreno del jugador; terrainFree valida la habilidad del enemigo.
// Si el jugador está en terreno inaccesible, se busca la orilla alcanzable más próxima.
function route(enemy, goalX, goalY, terrainFree, nearestLand, playerOnLand, escapeDistance = 0) {
  const width = game.grid[0].length;
  const start = cell(enemy.y) * width + cell(enemy.x);
  const queue = [start];
  const previous = new Map([[start, -1]]);
  let best = start;
  let distance = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], x = key % width, y = Math.floor(key / width);
    if (!playerOnLand || land(x, y)) {
      const d = Math.hypot(x - goalX, y - goalY);
      // En retirada buscamos la primera tierra a distancia segura por el camino más corto.
      const score = escapeDistance ? -d : d;
      if (score < distance) {
        best = key;
        distance = score;
      }
      if (nearestLand || (escapeDistance ? d >= escapeDistance : d === 0)) break;
    }
    // Entre rutas del mismo número de pasos, exploramos primero el vecino
    // que más nos acerca a la presa (diagonal cuando difieren ambos ejes).
    const distanceAfter = ([dx, dy]) => (goalX - x - dx) ** 2 + (goalY - y - dy) ** 2;
    const ordered = [...neighbors].sort((a, b) => distanceAfter(a) - distanceAfter(b));
    for (const [dx, dy] of ordered) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= game.grid.length - 1 || previous.has(next)) continue;
      if (dx && dy) {
        if (!terrainFree(enemy, center(x) + dx * TILE / 2, center(y) + dy * TILE / 2)) continue;
      }
      if (!terrainFree(enemy, center(nx), center(ny))) continue;
      previous.set(next, key);
      queue.push(next);
    }
  }
  const path = [];
  for (let key = best; key !== start; key = previous.get(key)) {
    path.push([center(key % width), center(Math.floor(key / width))]);
  }
  return path.reverse();
}

// Si un retroceso o varios cuerpos bloquean la salida, una casilla libre de
// la orilla permite seguir combatiendo incluso con un Ditto que no sabe cruzar.
function recoverOnLand(enemy, canMove) {
  let best = Infinity;
  let dest;
  game.grid.forEach((row, y) => row.forEach((tile, x) => {
    if (tile !== 0) return;
    const px = center(x), py = center(y), d = Math.hypot(px - enemy.x, py - enemy.y);
    if (d < best && canMove(enemy, px, py)) {
      best = d;
      dest = [px, py];
    }
  }));
  if (dest) [enemy.x, enemy.y] = dest;
}

// Tras un MISS, elige un flanco. Cada paso comprueba cuerpos,
// paredes y tierra firme antes de mover al enemigo.
export function trySidestep(enemy, attacker, canMove, now) {
  if (now < (enemy.evadeAfter ?? 0)) return false;
  const dx = enemy.x - attacker.x, dy = enemy.y - attacker.y;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const side = Math.random() < 0.5 ? -1 : 1;
  for (const sign of [side, -side]) {
    const sx = -dy / length * sign, sy = dx / length * sign;
    let distance = 0;
    for (let d = 2; d <= TILE; d += 2) {
      const x = enemy.x + sx * d, y = enemy.y + sy * d;
      if ((standingOnLand(attacker.x, attacker.y) && !standingOnLand(x, y)) || !canMove(enemy, x, y)) break;
      distance = d;
    }
    if (distance < TILE / 2) continue;
    enemy.sidestep = { sx, sy, remaining: distance };
    enemy.path = [];
    enemy.aimSince = null;
    enemy.tracking = true;

    enemy.evadeAfter = now + 2600;
    return true;
  }
  return false;
}

export function updateEnemy(enemy, move, setState, attack, terrainFree, canMove) {
  // Se ejecuta solo cuando Hurt y Attack han terminado. Revalida el tramo
  // en cada fotograma porque otro combatiente puede ocuparlo durante la esquiva.
  const playerOnLand = standingOnLand(game.player.x, game.player.y);
  if (enemy.sidestep && !enemy.bossResponse) {
    const step = enemy.sidestep;
    const length = Math.min(2, step.remaining);
    const x = enemy.x + length * step.sx, y = enemy.y + length * step.sy;
    if ((!playerOnLand || standingOnLand(x, y)) && canMove(enemy, x, y)) {
      setState(enemy, 'Walk');
      enemy.hitsWithoutAction = 0;
      enemy.x = x;
      enemy.y = y;
      step.remaining -= length;
    } else step.remaining = 0;
    if (step.remaining <= 0) {
      enemy.sidestep = null;
      enemy.counterUntil = performance.now() + 1400;
    }
    return;
  }
  const player = game.player, dx = player.x - enemy.x, dy = player.y - enemy.y;
  const reach = enemy.stats.range;
  const distance = Math.hypot(dx, dy);
  const onLand = standingOnLand(enemy.x, enemy.y);
  const returnToLand = playerOnLand && !onLand;
  const pursuing = player.hp > 0 && (enemy.tracking || distance <= 10 * reach);
  const species = game.pokemon.get(enemy.dex);
  // Una sola retirada breve por enemigo terrestre. Tras ella vuelve a combatir.
  const canRetreat = !enemy.boss && !species.fly && !species.swim && !species.lavawalk;
  if (pursuing && canRetreat && !enemy.retreated && enemy.hp < enemy.stats.hpMax * 0.15 && distance <= 2 * reach) {
    enemy.retreated = true;
    enemy.retreatTicks = 30;
    enemy.path = [];
  }
  const fleeing = enemy.retreatTicks > 0;
  if (fleeing) enemy.retreatTicks--;
  const inRange = pursuing && !fleeing && !returnToLand && distance <= reach + 5;
  const now = performance.now();
  if (!inRange) enemy.aimSince = null;
  if (fleeing && onLand && distance >= reach * 2) {
    enemy.retreatTicks = 0;
    enemy.path = [];
    setState(enemy, 'Idle');
    return;
  }
  if (inRange) {
    enemy.dir = (Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8;
    enemy.path = [];
    enemy.aiTimer = 0;
    enemy.tracking = true;
    setState(enemy, 'Idle');
    // Exige exposición continua antes del primer golpe y deja respirar entre ataques.
    enemy.aimSince ??= now;
    const afterDodge = now < enemy.counterUntil;
    const ready = now - enemy.aimSince >= (afterDodge ? 180 : 600) &&
      (afterDodge || now >= (enemy.nextAttackAt ?? 0));
    if (enemy.bossResponse || ready) {
      enemy.finishingCounter = !!enemy.bossResponse;
      enemy.bossResponse = false;
      enemy.hitsWithoutAction = 0;
      attack(enemy);
      enemy.counterUntil = 0;
      enemy.aimSince = null;
      enemy.nextAttackAt = now + (enemy.boss ? 1500 : 2000);
    }
    return;
  }

  // Mientras cruza conserva el camino completo hasta la siguiente orilla.
  enemy.aiTimer--;
  if (!enemy.path?.length || enemy.bossResponse || enemy.playerOnLand !== playerOnLand || (!returnToLand && (enemy.aiTimer <= 0 || pursuing !== enemy.tracking || fleeing !== enemy.fleeing))) {
    const gx = pursuing ? cell(player.x) : cell(enemy.x) + Math.floor(Math.random() * 9) - 4;
    const gy = pursuing ? cell(player.y) : cell(enemy.y) + Math.floor(Math.random() * 9) - 4;
    enemy.path = route(enemy, gx, gy, terrainFree, returnToLand, playerOnLand, fleeing ? Math.ceil(2 * reach / TILE) + 1 : 0);
    enemy.playerOnLand = playerOnLand;
    enemy.fleeing = fleeing;
    enemy.aiTimer = pursuing ? 30 : 65;
    enemy.tracking = pursuing;
  }
  const dest = enemy.path[0];
  if (!dest) {
    if (returnToLand) recoverOnLand(enemy, canMove);
    setState(enemy, 'Idle');
    return;
  }
  const oldX = enemy.x, oldY = enemy.y;
  move(enemy, dest[0] - oldX, dest[1] - oldY);
  if (oldX !== enemy.x || oldY !== enemy.y) {
    enemy.hitsWithoutAction = 0;
    enemy.bossResponse = false;
  }
  setState(enemy, 'Walk');
  if (Math.hypot(dest[0] - enemy.x, dest[1] - enemy.y) < 1) enemy.path.shift();
  enemy.stuck = Math.hypot(enemy.x - oldX, enemy.y - oldY) < 0.05 ? (enemy.stuck || 0) + 1 : 0;
  if (enemy.stuck >= 20) {
    if (returnToLand) recoverOnLand(enemy, canMove);
    enemy.path = [];
    enemy.stuck = 0;
  }
}
