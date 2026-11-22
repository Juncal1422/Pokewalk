import { ATTACK_RANGE, DIR_MAP, MAX_CHARGE_FRAMES, TILE } from './constants.js';
import { rangeScale, rate } from './stats.js';
import { game } from './state.js';

const cell = position => Math.floor(position / TILE);
const center = index => (index + 0.5) * TILE;
const land = (x, y) => game.grid[y]?.[x] === 0;
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// El recorrido puede cruzar un medio permitido, pero su destino siempre es tierra.
// Si el jugador está en terreno inaccesible, se busca la orilla alcanzable más próxima.
function route(enemy, goalX, goalY, terrainFree, nearestLand, escapeDistance = 0) {
  const width = game.grid[0].length;
  const start = cell(enemy.y) * width + cell(enemy.x);
  const queue = [start];
  const previous = new Map([[start, -1]]);
  let best = start;
  let distance = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], x = key % width, y = Math.floor(key / width);
    if (land(x, y)) {
      const d = Math.hypot(x - goalX, y - goalY);
      // En retirada buscamos la primera tierra a distancia segura por el camino más corto.
      const score = escapeDistance ? -d : d;
      if (score < distance) {
        best = key;
        distance = score;
      }
      if (nearestLand || (escapeDistance ? d >= escapeDistance : d === 0)) break;
    }
    for (const [dx, dy] of neighbors) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= game.grid.length - 1 || previous.has(next)) continue;
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

export function updateEnemy(enemy, move, setState, attack, terrainFree, canMove) {
  const player = game.player, dx = player.x - enemy.x, dy = player.y - enemy.y;
  const reach = ATTACK_RANGE * rangeScale(enemy.stats.range);
  const distance = Math.hypot(dx, dy);
  const onLand = land(cell(enemy.x), cell(enemy.y));
  const pursuing = player.hp > 0 && (enemy.tracking || distance <= 10 * reach);
  const fleeing = pursuing && enemy.hp <= enemy.stats.hpMax * 0.25;
  enemy.atkCooldown--;
  if (enemy.state === 'Charge' && !fleeing) {
    // La carga enemiga usa el mismo contador e impacto diferido que la del jugador.
    enemy.chargeTime += rate(enemy.stats.chargespeed);
    if (enemy.chargeTime >= MAX_CHARGE_FRAMES) attack(enemy);
    return;
  }
  if (fleeing && enemy.state === 'Charge') {
    enemy.chargeTime = 0;
    setState(enemy, 'Idle');
  }
  if (fleeing && onLand && distance >= reach * 4) {
    enemy.path = [];
    setState(enemy, 'Idle');
    return;
  }
  if (pursuing && !fleeing && onLand && distance <= reach + 5) {
    enemy.dir = DIR_MAP[[Math.sign(Math.round(dx / 5)), Math.sign(Math.round(dy / 5))]] ?? enemy.dir;
    enemy.path = [];
    enemy.aiTimer = 0;
    enemy.tracking = true;
    setState(enemy, 'Idle');
    if (enemy.atkCooldown <= 0) {
      if (enemy.stats.chargedmg > 2 * enemy.stats.atkdmg && Math.random() < 0.35) {
        enemy.chargeTime = 0;
        setState(enemy, 'Charge');
      } else attack(enemy);
      enemy.atkCooldown = 55 + Math.random() * 30;
    }
    return;
  }

  // Mientras cruza conserva el camino completo hasta la siguiente orilla.
  enemy.aiTimer--;
  if (!enemy.path?.length || (onLand && (enemy.aiTimer <= 0 || pursuing !== enemy.tracking || fleeing !== enemy.fleeing))) {
    const gx = pursuing ? cell(player.x) : cell(enemy.x) + Math.floor(Math.random() * 9) - 4;
    const gy = pursuing ? cell(player.y) : cell(enemy.y) + Math.floor(Math.random() * 9) - 4;
    enemy.path = route(enemy, gx, gy, terrainFree, !onLand && !pursuing, fleeing ? Math.ceil(4 * reach / TILE) + 1 : 0);
    enemy.fleeing = fleeing;
    enemy.aiTimer = pursuing ? 30 : 65;
    enemy.tracking = pursuing;
  }
  const dest = enemy.path[0];
  if (!dest) {
    if (!onLand) recoverOnLand(enemy, canMove);
    setState(enemy, 'Idle');
    return;
  }
  const oldX = enemy.x, oldY = enemy.y;
  move(enemy, dest[0] - oldX, dest[1] - oldY);
  setState(enemy, 'Walk');
  if (Math.hypot(dest[0] - enemy.x, dest[1] - enemy.y) < 1) enemy.path.shift();
  enemy.stuck = Math.hypot(enemy.x - oldX, enemy.y - oldY) < 0.05 ? (enemy.stuck || 0) + 1 : 0;
  if (enemy.stuck >= 20) {
    if (!onLand) recoverOnLand(enemy, canMove);
    enemy.path = [];
    enemy.stuck = 0;
  }
}
