import {playSound} from './audio.js';
import { gameTime } from './clock.js';
import { updateWildAbility, releaseSpines, effect, launchWeapon, featherStun } from './abilities.js';
import { amount, combatBenefits, playerStats, synergyActive } from './benefits.js';
import { attackMotion } from './attack-motion.js';
import { updateEnemy, fleeRescue, trySidestep } from './enemy-ai.js';
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
  const canCrossTerrain = !entity.ally && !game.bossArena && ['water','void','lava'].includes(game.currentBiome.terrain) && game.currentBiome.canCross.some(skill => species[skill]);
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
  if (attacker.rockUntil>gameTime() || attacker.paralyzedUntil>gameTime() || attacker.hp === 0 || (attacker.isPlayer && game.cast)) return;
  attacker.impactPending = true;
  // Sólo los modificadores direccionales usan la trayectoria del colmillo durante el golpe.
  attacker.fangStrike = !['acuatic','rock_thrower','ancient'].some(id=>combatBenefits(attacker)?.has(id)) && (combatBenefits(attacker)?.has('rhyhorn_horn') || combatBenefits(attacker)?.has('spiky'));
  attacker.doubleStrike = attacker.fangStrike && attacker.isPlayer && synergyActive('doubleStrike');
  // Fija una sola hoja para que los fotogramas de impacto y el render usen el mismo reloj.
  const weapon = [...(combatBenefits(attacker) ?? [])].map(id => game.benefits.get(id)).find(benefit => benefit?.spriteanimations);
  attacker.attackAnimation = weapon?.spriteanimations.map(name => attacker.anims[name]).find(Boolean) ?? attacker.anims.Attack;
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

  const weapons=combatBenefits(attacker);
  if(weapons?.has('acuatic')||weapons?.has('rock_thrower')){
    launchWeapon(attacker,weapons.has('rock_thrower')?'rock_throw':'watergun');return;
  }
  if(weapons?.has('ancient'))effect('iron_hit',attacker.x+directionX*reach,attacker.y+directionY*reach,230,attacker.dir);
  for (const target of game.entities) {
    if (!target.hp || target===attacker || (attacker.isPlayer ? target.ally : target!==(attacker.prey??game.player))) continue;
    if (!hasSight(attacker,target)) continue;
    if (!inStrike(target.x, target.y, strikeRadius + bodyRadius(target))) continue;
    const simulationTime = gameTime();
    if (target.isPlayer && simulationTime - target.lastHit < PLAYER_GRACE_MS) continue;
    const dodge = .05 + (target.evasionUntil>simulationTime?.2:0) + amount('swift',combatBenefits(target)??new Set());
    if (Math.random() < dodge) {
      playSound('miss');
      target.missUntil = simulationTime + 750;
      if (attacker.isPlayer && !target.isPlayer && !target.abilityCast) trySidestep(target, attacker, canMove, simulationTime);
      continue;
    }
    const critical = Math.random() < 0.10;
    if(!inflictDamage(attacker,target,damageFor(attacker, target, critical),critical))continue;
    if (target.hp && (target.abilityCast || (target.boss && (target.bossResponse || target.state==='Attack')))) continue;
    if (attacker.impactPending || (attacker.boss && target.isPlayer)) continue;
    // El retroceso se detiene en el primer obstáculo del recorrido.
    for (let step = 0; step < (weapons?.has('ancient')?16:10); step++) {
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
  if(target.invulnerableUntil>simulationTime)return;
  let blocked = false;
  const defendingBenefits=combatBenefits(target)??new Set();
  if (attacker!==target) {
    if (target.isPlayer && simulationTime - target.lastHit < PLAYER_GRACE_MS) return;
    const species = game.pokemon.get(attacker.dex), targetSpecies = game.pokemon.get(target.dex);
    if (attacker !== target && species.essences.some(type => targetSpecies.essences.includes(type))) incomingDamage *= 1 - amount('heartbreaker',defendingBenefits);
    blocked = attacker !== target && Math.random() < amount('protected',defendingBenefits) + amount('reinforced',defendingBenefits);
    if (blocked) incomingDamage *= .5;
  }
  let damage = Math.min(target.hp, Math.max(1, Math.round(incomingDamage)));
  if (ability && attacker.boss && target.isPlayer) damage = Math.min(damage, Math.floor(target.stats.hpMax / 2));
  if (!damage) return;
  const previousHP=target.hp;
  target.hp = Math.max(0, previousHP - damage);
  target.hitNumbers=(target.hitNumbers??[]).filter(hit=>simulationTime-hit.time<750);
  target.hitNumbers.push({damage:previousHP-target.hp,critical,time:simulationTime});
  if(defendingBenefits.has('champion')){
    if(target.isPlayer){game.mission.championAttack=(game.mission.championAttack??0)+10;
      target.stats=playerStats(game.pokemon.get(target.dex),game.progress,target.bonuses);}
    else target.stats.attack+=10;
    target.championFlash=simulationTime;
  }
  if(defendingBenefits.has('feathered'))featherStun(target);
  if(target.isPlayer && !target.hp && game.inventory.delete('revive')){
    game.reviveSpent=true;
    target.hp=Math.max(1,Math.ceil(target.stats.hpMax*.2));
    const revival=effect('revive',target.x,target.y,650);revival.follow=target;
    target.reviveUntil=simulationTime+revival.ms;
    target.invulnerableUntil=target.reviveUntil+1000;
  }
  playSound('hit');
  if(attacker.isPlayer&&!target.isPlayer&&!target.provoked){target.provoked=true;target.prey=attacker;target.aimSince=null;}
  target.lastHit = simulationTime;
  target.sidestep = null;
  if (defendingBenefits.has('spiked') &&
      (critical || synergyActive('damageSpines',defendingBenefits) || (blocked && synergyActive('blockSpines',defendingBenefits)))) releaseSpines(target);
  // Tras el segundo impacto el líder termina Hurt y ejecuta una respuesta.
  // Los impactos adicionales siguen descontando PV, incluso durante la réplica.
  if ((target.abilityCast || target.rockUntil>simulationTime) && target.hp)return damage;
  if (target.boss && target.hp && (target.bossResponse || target.state === 'Attack' || target.abilityCast)) return damage;
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
  return damage;
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
  game.adventure = game.collection?.history.length || 1;
  game.rescueAlly=null;
  if(previousPlayer?.dex!==pokedexNumber)game.defenseEntryLevel=game.progress;
  const enemyDifficulty = 4 + mission.number;
  const player = createEntity(playerData, game.rooms[0], true);
  player.bonuses = bonuses;
  if(previousPlayer) for(const timer of ['evasionUntil','invulnerableUntil','paralyzedUntil']) player[timer]=previousPlayer[timer];
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
    enemy.ally=mission.type==='rescue' && floor===mission.floors && index===opponents.length-1;
    if(mission.red || enemy.ally){
      const level=enemy.ally ? (mission.red?player.level:Math.min(100,player.level+5)) : Math.min(100,Math.max(enemy.level,player.level)+15);
      enemy.level=enemy.ally && mission.red ? player.level : levelFor(species,level);
      // Los límites del líder progresan con el encargo rojo, además del nivel efectivo.
      enemy.stats=statsFor(species,enemyDifficulty+(mission.red?15:0),{},bossFloor,true,enemy.level);
    }
    if(enemy.ally)game.rescueAlly=enemy;
    {
      const benefit = game.donors.get(species.name);
      enemy.activeBenefit = benefit?.active ? benefit.id : null;
      enemy.home = { x: enemy.x, y: enemy.y };
      enemy.benefits=new Set(benefit?[benefit.id]:[]);
      for(const [key,modifier] of Object.entries(benefit?.stats??{})){
        enemy.stats[key]=Math.round(enemy.stats[key]*(1+modifier));
        if(['speed','attackSpeed'].includes(key))enemy.stats[key]=Math.min(180,enemy.stats[key]);
      }
      enemy.tracking = bossFloor;
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
  if(entity.hp && entity.rockUntil>gameTime()){setState(entity,'Charge');entity.frame=(Math.floor(gameTime()/90)%(entity.anims.Charge??entity.anims.Idle).frames);return;}
  if(entity.hp && entity.paralyzedUntil>gameTime() && !entity.abilityCast)return;
  if (entity.isPlayer) {
    if (entity.hp > 0 && entity.state === 'Hurt' && !(entity.reviveUntil>gameTime()) && gameTime() - entity.lastHit >= PLAYER_STAGGER_MS) setState(entity, 'Idle');
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
    entity.prey=!entity.provoked && game.rescueAlly?.hp && !entity.ally ? game.rescueAlly : game.player;
    if (entity.ally) fleeRescue(entity,moveEntity,setState,canMove);
    else if ((entity.prey!==game.player && !entity.abilityCast) || !updateWildAbility(entity))
      updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.state === 'Attack' ? entity.attackAnimation ?? entity.anims.Attack : entity.anims[entity.state] || entity.anims.Idle;
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
      if (entity.hp > 0 && !(entity.reviveUntil>gameTime()) && (entity.state === 'Attack' || entity.state === 'Hurt'))
        setState(entity, 'Idle');
    }
  }
}
