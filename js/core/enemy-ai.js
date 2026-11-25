import { gameTime } from './clock.js';
import { groundFree, hasSight } from './terrain.js';
import { movementRate, attackReach } from './stats.js';
import { TILE } from './constants.js';
import { game } from './state.js';

// Convierte una posición del mundo en índice de casilla.
const cell = position => Math.floor(position / TILE);
// Devuelve el centro de una casilla en píxeles del mundo.
const center = index => (index + 0.5) * TILE;
// Consulta si una casilla del mapa está marcada como suelo.
const land = (x, y) => game.grid[y]?.[x] === 0;
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cardinalNeighbors = neighbors.slice(0,4);
// Consulta la máscara de colisión en un punto para distinguir suelo y medio especial.
const standingOnLand = (x, y) => groundFree(x, y, 0.01);

// El destino depende del terreno del jugador; terrainFree valida la habilidad del enemigo.
// Si el jugador está en terreno inaccesible, se busca la orilla alcanzable más próxima.
function route(enemy, goalX, goalY, terrainFree, nearestLand, playerOnLand, escapeDistance = 0) {
  const width = game.grid[0].length;
  const start = cell(enemy.y) * width + cell(enemy.x);
  // La visión sigue el dibujo sólido del atlas, incluso para especies que
  // pueden cruzarlo. Sin visión directa buscamos un rodeo por ejes.
  const directions = hasSight(enemy,enemy.prey??game.player) ? neighbors : cardinalNeighbors;
  const queue = [start];
  const previous = new Map([[start, -1]]);
  let bestTile = start;
  let distance = Infinity;
  // La cola crece al descubrir casillas; avanzar un índice evita desplazar toda la cola.
  for (let stepIndex = 0; stepIndex < queue.length; stepIndex++) {
    const tileIndex = queue[stepIndex], x = tileIndex % width, y = Math.floor(tileIndex / width);
    if (!playerOnLand || land(x, y)) {
      const distanceToGoal = Math.hypot(x - goalX, y - goalY);
      // En retirada buscamos la primera tierra a distancia segura por el camino más corto.
      const score = escapeDistance ? -distanceToGoal : distanceToGoal;
      if (score < distance) {
        bestTile = tileIndex;
        distance = score;
      }
      if (nearestLand || (escapeDistance ? distanceToGoal >= escapeDistance : distanceToGoal === 0)) break;
    }
    // Entre rutas del mismo número de pasos, exploramos primero el vecino
    // que más nos acerca a la presa (diagonal cuando difieren ambos ejes).
    const distanceAfter = ([deltaX, deltaY]) => (goalX - x - deltaX) ** 2 + (goalY - y - deltaY) ** 2;
    const ordered = [...directions].sort((firstDirection, secondDirection) => distanceAfter(firstDirection) - distanceAfter(secondDirection));
    for (const [deltaX, deltaY] of ordered) {
      const neighborX = x + deltaX, neighborY = y + deltaY, next = neighborY * width + neighborX;
      if (neighborX <= 0 || neighborY <= 0 || neighborX >= width - 1 || neighborY >= game.grid.length - 1 || previous.has(next)) continue;
      if (deltaX && deltaY) {
        if (!terrainFree(enemy, center(x) + deltaX * TILE / 2, center(y) + deltaY * TILE / 2)) continue;
      }
      if (!terrainFree(enemy, center(neighborX), center(neighborY))) continue;
      previous.set(next, tileIndex);
      queue.push(next);
    }
  }
  const path = [];
  for (let tileIndex = bestTile; tileIndex !== start; tileIndex = previous.get(tileIndex)) {
    path.push([center(tileIndex % width), center(Math.floor(tileIndex / width))]);
  }
  return path.reverse();
}

// Tras un MISS, elige un flanco. Cada paso comprueba cuerpos,
// paredes y tierra firme antes de mover al enemigo.
export function trySidestep(enemy, attacker, canMove, simulationTime) {
  if (simulationTime < (enemy.evadeAfter ?? 0)) return false;
  const deltaX = enemy.x - attacker.x, deltaY = enemy.y - attacker.y;
  const length = Math.hypot(deltaX, deltaY);
  if (!length) return false;
  const side = Math.random() < 0.5 ? -1 : 1;
  for (const sign of [side, -side]) {
    const sidestepDirectionX = -deltaY / length * sign, sidestepDirectionY = deltaX / length * sign;
    let distance = 0;
    for (let testDistance = 2; testDistance <= TILE; testDistance += 2) {
      const x = enemy.x + sidestepDirectionX * testDistance, y = enemy.y + sidestepDirectionY * testDistance;
      if ((standingOnLand(attacker.x, attacker.y) && !standingOnLand(x, y)) || !canMove(enemy, x, y)) break;
      distance = testDistance;
    }
    if (distance < TILE / 2) continue;
    console.debug('[IA] Esquivar',{dex:enemy.dex,x:enemy.x,y:enemy.y,distance});
    enemy.sidestep = { sx: sidestepDirectionX, sy: sidestepDirectionY, remaining: distance };
    enemy.path = [];
    enemy.aimSince = null;
    enemy.tracking = true;

    enemy.evadeAfter = simulationTime + 2600;
    return true;
  }
  return false;
}

// Decide la acción del enemigo según el terreno, la visibilidad, la distancia y los tiempos de reacción.
export function updateEnemy(enemy, move, setState, attack, terrainFree, canMove) {
  // Se ejecuta solo cuando Hurt y Attack han terminado. Revalida el tramo
  // en cada fotograma porque otro combatiente puede ocuparlo durante la esquiva.
  const player=enemy.prey??game.player;
  const playerOnLand = standingOnLand(player.x, player.y);
  if (enemy.sidestep && !enemy.bossResponse) {
    const step = enemy.sidestep;
    const length = Math.min(2 * enemy.speed * movementRate(enemy.stats.speed), step.remaining);
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
      enemy.counterUntil = gameTime() + 1400;
    }
    return;
  }
  const deltaX = player.x - enemy.x, deltaY = player.y - enemy.y;
  const reach = attackReach(enemy.stats);
  const distance = Math.hypot(deltaX, deltaY);
  const onLand = standingOnLand(enemy.x, enemy.y);
  const returnToLand = playerOnLand && !onLand;
  const seesPlayer = player.hp > 0 && (player.ally || ((enemy.tracking || distance <= 10*reach) && hasSight(enemy,player)));
  if (seesPlayer) enemy.lastSeen = {x:player.x,y:player.y};
  // Al perder visión solo puede investigar la última posición observada.
  if (!seesPlayer && enemy.lastSeen && Math.hypot(enemy.x-enemy.lastSeen.x,enemy.y-enemy.lastSeen.y)<TILE/2) enemy.lastSeen=null;
  const pursuing = !!enemy.lastSeen && player.hp>0;
  const species = game.pokemon.get(enemy.dex);
  // Una sola retirada breve por enemigo terrestre. Tras ella vuelve a combatir.
  const canRetreat = !enemy.boss && !species.fly && !species.swim && !species.lavawalk;
  if (pursuing && canRetreat && !enemy.retreated && enemy.hp < enemy.stats.hpMax * 0.15 && distance <= 2 * reach) {
    console.debug('[IA] Retirarse',{dex:enemy.dex,hp:enemy.hp,distance});
    enemy.retreated = true;
    enemy.retreatTicks = 30;
    enemy.path = [];
  }
  const fleeing = enemy.retreatTicks > 0;
  if (fleeing) enemy.retreatTicks--;
  const inRange = seesPlayer && hasSight(enemy,player) && !fleeing && !returnToLand && distance <= reach + 5;
  const simulationTime = gameTime();
  if (!inRange) enemy.aimSince = null;
  if (fleeing && onLand && distance >= reach * 2) {
    console.debug('[IA] Finalizar retirada',{dex:enemy.dex,distance});
    enemy.retreatTicks = 0;
    enemy.path = [];
    setState(enemy, 'Idle');
    return;
  }
  if (inRange) {
    enemy.dir = (Math.round(Math.atan2(deltaX, deltaY) / (Math.PI / 4)) + 8) % 8;
    enemy.path = [];
    enemy.aiTimer = 0;
    enemy.tracking = true;
    setState(enemy, 'Idle');
    // Exige exposición continua antes del primer golpe y deja respirar entre ataques.
    if(enemy.aimSince==null)console.debug('[IA] Apuntar',{dex:enemy.dex,x:enemy.x,y:enemy.y,distance});
    enemy.aimSince ??= simulationTime;
    const afterDodge = simulationTime < enemy.counterUntil;
    const ready = simulationTime - enemy.aimSince >= (afterDodge ? 180 : 600) &&
      (afterDodge || simulationTime >= (enemy.nextAttackAt ?? 0));
    if (enemy.bossResponse || ready) {
      enemy.bossResponse = false;
      enemy.hitsWithoutAction = 0;
      console.debug('[IA] Atacar',{dex:enemy.dex,distance,reach});
      attack(enemy);
      enemy.counterUntil = 0;
      enemy.aimSince = null;
      enemy.nextAttackAt = simulationTime + (enemy.boss ? 1500 : 2000);
    }
    return;
  }

  // Mientras cruza conserva el camino completo hasta la siguiente orilla.
  enemy.aiTimer--;
  if (!enemy.path?.length || enemy.bossResponse || enemy.playerOnLand !== playerOnLand || (!returnToLand && (enemy.aiTimer <= 0 || pursuing !== enemy.tracking || fleeing !== enemy.fleeing))) {
    const goalTileX = pursuing ? cell(enemy.lastSeen.x) : cell(enemy.x) + Math.floor(Math.random() * 9) - 4;
    const goalTileY = pursuing ? cell(enemy.lastSeen.y) : cell(enemy.y) + Math.floor(Math.random() * 9) - 4;
    // Tras un bloqueo buscamos otro camino a pie teniendo en cuenta los cuerpos.
    const passable = enemy.avoidBodies ? canMove : terrainFree;
    console.debug('[IA] Buscar ruta',{dex:enemy.dex,goalTileX,goalTileY,fleeing,pursuing,returnToLand,seesPlayer});
    enemy.path = route(enemy, goalTileX, goalTileY, passable, returnToLand, playerOnLand, fleeing ? Math.ceil(2 * reach / TILE) + 1 : 0);
    enemy.avoidBodies = false;
    enemy.playerOnLand = playerOnLand;
    enemy.fleeing = fleeing;
    enemy.aiTimer = pursuing ? 30 : 65;
    enemy.tracking = pursuing;
  }
  const nextWaypoint = enemy.path[0];
  if (!nextWaypoint) {
    console.debug('[IA] Esperar sin ruta',{dex:enemy.dex,x:enemy.x,y:enemy.y});
    setState(enemy, 'Idle');
    return;
  }
  const oldX = enemy.x, oldY = enemy.y;
  move(enemy, nextWaypoint[0] - oldX, nextWaypoint[1] - oldY);
  if (oldX !== enemy.x || oldY !== enemy.y) {
    enemy.hitsWithoutAction = 0;
    enemy.bossResponse = false;
  }
  setState(enemy, 'Walk');
  if (Math.hypot(nextWaypoint[0] - enemy.x, nextWaypoint[1] - enemy.y) < 1) enemy.path.shift();
  enemy.stuck = Math.hypot(enemy.x - oldX, enemy.y - oldY) < 0.05 ? (enemy.stuck || 0) + 1 : 0;
  if (enemy.stuck >= 20) {
    console.debug('[IA] Recalcular por bloqueo',{dex:enemy.dex,x:enemy.x,y:enemy.y});
    enemy.avoidBodies = true;
    enemy.path = [];
    enemy.stuck = 0;
  }
}

// La víctima busca espacio respecto de todos los cuerpos. Comprueba cada paso
// y se queda quieta si no puede ganar distancia en ninguna dirección.
export function fleeRescue(ally,move,setState,canMove) {
  const threats=game.entities.filter(entity=>entity!==ally && entity.hp);
  const clearance=(x,y)=>Math.min(...threats.map(entity=>Math.hypot(entity.x-x,entity.y-y)));
  let best=clearance(ally.x,ally.y), heading=null;
  for(const [dx,dy] of neighbors){
    const length=Math.hypot(dx,dy), x=ally.x+dx*3/length,y=ally.y+dy*3/length;
    const score=clearance(x,y);
    if(score>best && canMove(ally,x,y)){best=score;heading=[dx,dy]}
  }
  console.debug('[IA] Rescate',{dex:ally.dex,x:ally.x,y:ally.y,heading});
  setState(ally,heading?'Walk':'Idle');
  if(heading)move(ally,...heading);
}
