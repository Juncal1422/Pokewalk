import {criticalBlock,criticalHit,actorRule,combatChance,rule} from './modifiers.js';
import {playSound} from './audio.js';
import { gameTime } from './clock.js';
import { paralyze, knockback,updateWildAbility, releaseSpines, effect, attackElement, elementalHit, launchWeapon, featherStun } from './abilities.js';
import { bindHealthAttack,settleStats,applyBenefitStats, amount, combatBenefits, playerStats, synergyActive } from './benefits.js';
import { attackMotion } from './attack-motion.js';
import { updateEnemy, fleeRescue, trySidestep } from './enemy-ai.js';
import { encounters, onDefeat } from './missions.js';
import { collectItems, dropItem, randomBerry, spawnFloorItems } from './items.js';
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
import { loadPokemonData, applyShinyAppearance } from '../data/pokemon-data.js';

// Muestra un aviso temporal y sustituye el temporizador del aviso anterior.
export function showToast(message) {
  game.toastEl.textContent = message;
  game.toastEl.hidden = false;
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => {
    game.toastEl.hidden = true;
  }, 2800);
}

// Construye un combatiente en el centro de su sala con sus estadísticas y animación iniciales.
export function createEntity(spriteData, room, isPlayer) {
  const species = game.pokemon.get(spriteData.dex);
  const stats = statsFor(species, game.progress);
  const entity = {
    isPlayer,
    dex: spriteData.dex,
    dexStr: spriteData.dexStr,
    anims: spriteData.anims,
    x: room.cx * TILE + TILE / 2,
    y: room.cy * TILE + TILE / 2,
    dir: 0,
    state: null,
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
  setState(entity,'Idle');
  return entity;
}

// Reinicia el fotograma y el temporizador únicamente al cambiar de acción.
export function setState(entity, state) {
  if ((state==='Idle' || state==='Walk') && entity.pendingShinyAnims) {
    entity.anims=entity.pendingShinyAnims;
    entity.pendingShinyAnims=null;
    entity.shinySheet=true;
    entity.frame=0;
  }
  if (entity.state !== state) {
    const sheet = state === 'Attack' ? entity.attackAnimation : entity.anims[state] ?? entity.anims.Idle;
    const speed = state === 'Attack' ? attackRate(entity.stats.attackSpeed)*(entity.isPlayer?1:.48) :
      state === 'Walk' ? movementRate(entity.stats.speed) : 1;
    console.debug('[Animación]', {dex:entity.dex, state, sheet:Object.keys(entity.anims).find(key=>entity.anims[key]===sheet),
      x:entity.x,y:entity.y,direction:entity.dir,speed,frames:sheet?.frames,durations:sheet?.durs,time:gameTime()});
    entity.finishingSpecial = false;
    entity.animationCompleted = false;
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
  return groundFree(x, y, radius, canCrossTerrain || !!combatBenefits(entity)?.has('levitating'));
}

// Comprueba la posición contra los muros y los cuerpos vivos del piso.
export function canMove(entity, x, y) {
  if (!terrainFree(entity, x, y)) return false;
  const radius = bodyRadius(entity);
  // Movimiento y retroceso comparten el mismo cuerpo circular.
  return !game.entities.some(other => {
    if (other === entity || !other.hp) return false;
    const separation = Math.hypot(other.x-x,other.y-y);
    if (separation >= radius+bodyRadius(other)) return false;
    if (entity.isPlayer !== other.isPlayer && !entity.ally && !other.ally) {
      const player = entity.isPlayer ? entity : other;
      const wild = entity.isPlayer ? other : entity;
      if (player.nextDashAt > gameTime() || actorRule(player,'phaseEnemies') || actorRule(wild,'phaseEnemies')) return false;
      // Si la recarga termina con dos cuerpos solapados, deja que se separen.
      if (separation > Math.hypot(other.x-entity.x,other.y-entity.y)) return false;
    }
    return true;
  });
}

// Prepara un solo impacto pendiente y selecciona la animación para el arma equipada.
export function triggerAttack(attacker) {
  if (!['Idle','Walk'].includes(attacker.state)) return;
  if (attacker.dash?.until > gameTime() || attacker.frozenUntil>gameTime() || attacker.rockUntil>gameTime() || attacker.paralyzedUntil>gameTime() || attacker.hp === 0 || (attacker.isPlayer && game.cast)) return;
  if(attacker.boneInFlight)return;
  attacker.impactPending = true;
  // Sólo los modificadores direccionales usan la trayectoria del colmillo durante el golpe.
  attacker.relicWeapon=[...(combatBenefits(attacker)??[])].map(id=>game.benefits.get(id)?.weapon).find(Boolean);
  attacker.fangStrike = !attacker.relicWeapon && !['acuatic','rock_thrower','ancient'].some(id=>combatBenefits(attacker)?.has(id)) && (combatBenefits(attacker)?.has('rhyhorn_horn') || combatBenefits(attacker)?.has('spiky'));
  attacker.doubleStrike = attacker.fangStrike && attacker.isPlayer && synergyActive('doubleStrike');
  // Fija una sola hoja para que los fotogramas de impacto y el render usen el mismo reloj.
  const weapon = [...(combatBenefits(attacker) ?? [])].map(id => game.benefits.get(id)).find(benefit => benefit?.spriteanimations);
  attacker.attackAnimation = attacker.relicWeapon ? (['peck','shadow_tag'].includes(attacker.relicWeapon)?attacker.anims.Charge:attacker.relicWeapon==='bite'?attacker.anims.Attack:attacker.anims.Shoot) ?? attacker.anims.Attack : weapon?.spriteanimations.map(name => attacker.anims[name]).find(Boolean) ?? attacker.anims.Attack;
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
  const replacement=attacker.relicWeapon;
  if(replacement==='peck' && (weapons.has('igneous') || weapons.has('flaming'))){
    launchWeapon(attacker,'fire_spike');return;
  }
  const cut=['peck','shadow_tag','bite'].includes(replacement);
  if(replacement && !cut){launchWeapon(attacker,replacement);return;}
  if(replacement==='shadow_tag'){
    effect(replacement,attacker.x,attacker.y,200,attacker.dir,attacker).shadowReach=reach;
  }else if(cut){
    effect(replacement,attacker.x+directionX*reach*.65,attacker.y+directionY*reach*.65,200,attacker.dir,attacker).diameter=2*reach;
  }
  if(!replacement && (weapons?.has('acuatic')||weapons?.has('rock_thrower'))){
    launchWeapon(attacker,weapons.has('rock_thrower')?'rock_throw':'watergun');return;
  }
  if(!replacement && weapons?.has('ancient'))effect('iron_hit',attacker.x+directionX*reach,attacker.y+directionY*reach,230,attacker.dir,attacker);
  for (const target of game.entities) {
    if (!target.hp || target===attacker || (attacker.isPlayer ? target.ally : target!==(attacker.prey??game.player))) continue;
    if (!hasSight(attacker,target)) continue;
    if (cut && replacement!=='shadow_tag' ? ((target.x-attacker.x)*directionX+(target.y-attacker.y)*directionY<=0 ||
        Math.hypot(target.x-attacker.x-directionX*reach*.65,target.y-attacker.y-directionY*reach*.65)>reach+bodyRadius(target))
        : !inStrike(target.x,target.y,strikeRadius+bodyRadius(target))) continue;
    const simulationTime = gameTime();
    if (target.isPlayer && simulationTime - target.lastHit < PLAYER_GRACE_MS) continue;
    const dodge = dodgeChance(target);
    if (Math.random() < dodge) {
      playSound('miss');
      target.missUntil = simulationTime + 750;
      if (attacker.isPlayer && !target.isPlayer && !target.abilityCast) trySidestep(target, attacker, canMove, simulationTime);
      continue;
    }
    const critical = criticalHit(attacker,target);
    const power=damageFor(attacker,target,critical),element=replacement==='peck'?'flying':replacement==='shadow_tag'?'ghost':attackElement(attacker);
    if(!(element ? elementalHit(attacker,target,power,element,false,critical) : inflictDamage(attacker,target,power,critical)))continue;
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

// Modificadores temporales y fijación de evasión se aplican a todo ataque esquivable.
export function dodgeChance(target){
  return combatChance(target,'evasion')/100;
}

// Ataques normales, habilidades y reflejos comparten derrota, botín y Hurt.
export function inflictDamage(attacker,target,incomingDamage,critical=false,ability=false,exact=false) {
  if (!target.hp) return;
  const simulationTime = gameTime();
  if(target.dash?.until > simulationTime)return;
  if(!exact && target.invulnerableUntil>simulationTime)return;
  if (!exact && ability && !critical && attacker.isPlayer && game.runRelics?.has('cranium') && criticalHit(attacker,target)) {
    critical=true; incomingDamage*=1.5;
  }
  let blocked = false;
  const defendingBenefits=combatBenefits(target)??new Set();
  if (!exact && attacker!==target) {
    if (target.isPlayer && simulationTime - target.lastHit < PLAYER_GRACE_MS) return;
    const species = game.pokemon.get(attacker.dex), targetSpecies = game.pokemon.get(target.dex);
    if (attacker !== target && species.essences.some(type => targetSpecies.essences.includes(type))) incomingDamage *= 1 - amount('heartbreaker',defendingBenefits);
    blocked = attacker !== target && criticalBlock(attacker,target);
    if (blocked) {
      if(defendingBenefits.has('impregnable'))effect('gem_aura',target.x,target.y,400).follow=target;
      incomingDamage *= .5;
      if(target.shellUntil>simulationTime){
        const duration=actorRule(target,'freezeMs');
        attacker.frozenUntil=simulationTime+duration;
        effect('frozen',attacker.x,attacker.y,duration/2).follow=attacker;
      }
    }
  }
  let damage = Math.min(target.hp, Math.max(1, Math.round(incomingDamage)));
  if (ability && attacker.boss && target.isPlayer) damage = Math.min(damage, Math.floor(target.stats.hpMax / 2));
  if (!damage) return;
  const previousHP=target.hp;
  target.hp = Math.max(0, previousHP - damage);
  target.hitNumbers=(target.hitNumbers??[]).filter(hit=>simulationTime-hit.time<750);
  target.hitNumbers.push({damage:previousHP-target.hp,critical,time:simulationTime});
  if(critical){
    if(Math.random()<actorRule(target,'criticalBerry'))dropItem(randomBerry(),target);
    if(actorRule(target,'reflectCritical'))for(const enemy of game.entities){
      if(enemy.hp && !enemy.ally && enemy.isPlayer!==target.isPlayer)inflictDamage(target,enemy,damage,false,false,true);
    }
  }
  if(defendingBenefits.has('champion')){
    if(target.isPlayer){game.mission.championAttack=(game.mission.championAttack??0)+10;
      target.stats=settleStats(game.pokemon.get(target.dex),game.progress,target.bonuses,target.stats);}
    else target.stats.attack+=10;
    target.championFlash=simulationTime;
  }
  if(critical && defendingBenefits.has('static') && attacker!==target){
    paralyze(attacker,1000);effect('battery',target.x,target.y,350).follow=target;
  }
  if(critical && defendingBenefits.has('feathered'))featherStun(target);
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
  const protectedAnimation = ['Spin','Charge'].includes(target.state) || target.isPlayer && game.cast ||
    target.state === 'Attack' && target.attackAnimation !== target.anims.Attack;
  if (protectedAnimation && target.hp) return damage;
  if ((target.abilityCast || target.rockUntil>simulationTime) && target.hp)return damage;
  if (target.boss && target.hp && (target.bossResponse || target.state === 'Attack' || target.abilityCast)) return damage;
  if (target.boss && target.hp) {
    target.hitsWithoutAction = (target.hitsWithoutAction || 0) + 1;
    target.bossResponse = target.hitsWithoutAction >= 2;
  }
  if (target.hp && target.state === 'Hurt') return damage;
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
  const [playerData, ...opponents] = await Promise.all([pokedexNumber, ...enemyDexNumbers].map(dex => loadPokemonData(dex)));
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
  if(previousPlayer) for(const timer of ['shellUntil','evasionUntil','invulnerableUntil','paralyzedUntil','nextDashAt']) player[timer]=previousPlayer[timer];
  player.stats = playerStats(game.pokemon.get(pokedexNumber), game.progress, bonuses);
  if (!previousPlayer) game.initialHP = player.stats.hpMax;
  player.hp = previousPlayer ? Math.min(player.stats.hpMax, previousPlayer.hp) : player.stats.hpMax;
  game.player = player;
  if (game.inventory.has('shiny_elixir')) applyShinyAppearance(player);
  game.drops = [];
  game.entities = [player];
  opponents.forEach((spriteData, index) => {
    // Los refuerzos de arena y los pisos con pocas salas toman centros libres de suelo.
    let site=game.rooms[index+1];
    if(!site){
      const free=[];
      game.grid.forEach((row,cy)=>row.forEach((tile,cx)=>{
        if(!tile && game.entities.every(e=>Math.hypot(e.x-(cx+.5)*TILE,e.y-(cy+.5)*TILE)>TILE))free.push({cx,cy});
      }));
      site=free[Math.floor(Math.random()*free.length)];
    }
    if(!site)return;
    const enemy = createEntity(spriteData,site,false);
    enemy.boss = bossFloor && index===0;
    const species = game.pokemon.get(spriteData.dex);
    enemy.level = levelFor(species, enemyProgress(enemyDifficulty));
    enemy.stats = statsFor(species, enemyDifficulty, {}, enemy.boss, true);
    enemy.ally=mission.type==='rescue' && floor===mission.floors && index===opponents.length-1;
    if(mission.red || enemy.ally){
      const level=enemy.ally ? (mission.red?player.level:Math.min(100,player.level+5)) : Math.min(100,enemy.level+10);
      enemy.level=enemy.ally && mission.red ? player.level : levelFor(species,level);
      // Los límites del líder progresan con el encargo rojo, además del nivel efectivo.
      enemy.stats=statsFor(species,enemyDifficulty+(mission.red?10:0),{},enemy.boss,true,enemy.level);
    }
    if(enemy.ally)game.rescueAlly=enemy;
    else if(Math.random() < (game.inventory.has('shiny_elixir') ? .05 : .001)) applyShinyAppearance(enemy);
    {
      const benefit = game.donors.get(species.name);
      enemy.activeBenefit = benefit?.active ? benefit.id : null;
      enemy.home = { x: enemy.x, y: enemy.y };
      enemy.benefits=new Set(benefit?[benefit.id]:[]);
      applyBenefitStats(enemy.stats,enemy.benefits,100);
      enemy.provoked = !enemy.ally && !!rule('floorAggro');
      enemy.tracking = bossFloor || enemy.provoked || !!rule('exitRange');
      if(enemy.provoked || rule('exitRange'))enemy.lastSeen={x:player.x,y:player.y};
    }
    enemy.hp = enemy.stats.hpMax;
    bindHealthAttack(enemy.stats,enemy.benefits,()=>enemy.hp);
    game.entities.push(enemy);
  });
  spawnFloorItems();
  console.info('[Piso]', floor, mission.name, enemyDexNumbers);
}

// Normaliza la dirección y avanza en subpasos para comprobar incluso las esquinas estrechas.
function moveEntity(entity, deltaX, deltaY, multiplier=1) {
  if (deltaX === 0 && deltaY === 0) return;
  entity.dir = DIR_MAP[[Math.sign(deltaX),Math.sign(deltaY)]] ?? entity.dir;
  const length = Math.hypot(deltaX, deltaY);
  const speed = entity.isPlayer ? multiplier * entity.speed * movementRate(entity.stats.speed) : Math.min(length, entity.speed * movementRate(entity.stats.speed));
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

function inputDirection() {
  const keys = game.keys;
  return [Number(!!(keys.d || keys.arrowright))-Number(!!(keys.a || keys.arrowleft)),
    Number(!!(keys.s || keys.arrowdown))-Number(!!(keys.w || keys.arrowup))];
}

export function startDash(player) {
  const now = gameTime();
  if (!player?.hp || game.changingLevel || game.cast || game.runRelics?.has('weighted_tail') ||
      player.nextDashAt > now || player.frozenUntil > now || player.rockUntil > now ||
      player.paralyzedUntil > now || player.windPush || !['Walk','Idle'].includes(player.state)) return;
  const [dx,dy] = inputDirection();
  const dir = DIR_MAP[[dx,dy]] ?? player.dir;
  player.dir = dir;
  player.dash = {dir, until:now+150};
  player.nextDashAt = now+1500/(1+rule('dashRecovery'));
  setState(player,'Walk');
  console.debug('[Dash]',{x:player.x,y:player.y,dir,speed:4*player.speed*movementRate(player.stats.speed),durationMs:150,nextDashAt:player.nextDashAt});
}

// Procesa controles o IA y avanza la animación hasta el impacto y el final de la acción.
export function updateEntity(entity) {
  if(entity.windPush && entity.hp){
    const push=entity.windPush,remaining=Math.min(push.step,push.remaining);
    const x=entity.x,y=entity.y;
    knockback(push,entity,remaining);
    push.remaining-=remaining;
    if(push.remaining<=0 || (x===entity.x && y===entity.y))entity.windPush=null;
    else {const anim=entity.anims.Hurt;entity.timer++;if(entity.timer>=(anim.durs[entity.frame]||8)){entity.timer=0;entity.frame=(entity.frame+1)%anim.frames;}return;}
  }
  if(entity.frozenUntil>gameTime())return;
  if(entity.hp && entity.rockUntil>gameTime()){setState(entity,'Charge');entity.frame=(Math.floor(gameTime()/90)%(entity.anims.Charge??entity.anims.Idle).frames);return;}
  if(entity.state==='Charge' && !entity.finishingSpecial && !entity.abilityCast && !(entity.isPlayer && game.cast) && !(entity.rockUntil>gameTime())) entity.finishingSpecial=true;
  if(entity.hp && entity.paralyzedUntil>gameTime()){
    if(entity.shockUntil>gameTime()){
      setState(entity,'Charge');
      entity.frame=Math.floor(gameTime()/90)%(entity.anims.Charge??entity.anims.Idle).frames;
    }
    return;
  }
  if(entity.shockUntil){entity.shockUntil=0;setState(entity,'Idle');}
  if (entity.isPlayer) {
    if (entity.hp > 0 && entity.state === 'Hurt' && entity.animationCompleted && !(entity.reviveUntil>gameTime()) && gameTime() - entity.lastHit >= PLAYER_STAGGER_MS) setState(entity, 'Idle');
    const [deltaX,deltaY] = inputDirection();
    if (entity.dash?.until > gameTime()) {
      moveEntity(entity,...DIR_VEC[entity.dash.dir],4);
    } else if (!game.cast && ['Idle','Walk'].includes(entity.state)) {
      entity.dash=null;
      if (deltaX || deltaY) {
        setState(entity, 'Walk');
        moveEntity(entity, deltaX, deltaY);
      } else setState(entity, 'Idle');
    }
  } else if (!['Attack', 'Hurt'].includes(entity.state) && (!entity.finishingSpecial || entity.abilityCast)) {
    entity.prey=!rule('rescueAggro') && !entity.provoked && game.rescueAlly?.hp && !entity.ally ? game.rescueAlly : game.player;
    if (entity.ally) fleeRescue(entity,moveEntity,setState,canMove);
    else if ((entity.prey!==game.player && !entity.abilityCast) || !updateWildAbility(entity))
      updateEnemy(entity, moveEntity, setState, triggerAttack, terrainFree, canMove);
  }

  const animation = entity.state === 'Attack' ? entity.attackAnimation ?? entity.anims.Attack : entity.anims[entity.state] || entity.anims.Idle;
  const tempo = entity.state === 'Walk' ? movementRate(entity.stats.speed)*(entity.dash?.until>gameTime()?4:1) :
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
      entity.animationCompleted = true;
      if (entity.finishingSpecial) {
        entity.finishingSpecial = false;
        setState(entity,'Idle');
      }
      if (entity.hp > 0 && !(entity.reviveUntil>gameTime()) && (entity.state === 'Attack' || entity.state === 'Hurt'))
        setState(entity, 'Idle');
    }
  }
}
