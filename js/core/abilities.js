import {playSound} from './audio.js';
import { gameTime } from './clock.js';
import { game } from './state.js';
import { DIR_VEC, TILE } from './constants.js';
import { hasSight } from './terrain.js';
import { playerStats, synergyActive } from './benefits.js';
import { attackReach, damageFor } from './stats.js';
import { bodyRadius, canMove, inflictDamage, setState, showToast } from './entities.js';

const effectFrames = new Map();
// Construye la lista ordenada de imágenes que forman un efecto.
const sequence = (id, count, path) => [id, Array.from({length:count}, (_,frameIndex) => path(frameIndex+1))];
// Decodifica todos los fotogramas antes de habilitar las habilidades.
export async function loadEffects() {
  const groups = [
    ['fang',['fang/fang.png']],
    sequence('battery',9,index=>'battery_burst/'+String(index-1).padStart(3,'0')+'.png'),
    ['spine',['spine/spine.png']],
    ...[['heal',13],['boost',15],['fangaround',12]].map(([name,count]) =>
      sequence(name,count,frameIndex=>name+'/'+String(frameIndex-1).padStart(3,'0')+'.png')),
    sequence('mine',9,frameIndex=>'mine/mine_'+frameIndex+'.png'),
    sequence('flare',12,frameIndex=>'flare/flare_'+frameIndex+'.png'),
    sequence('purple',38,frameIndex=>'purple_smite/purple_smite ('+frameIndex+').png'),
  ];
  await Promise.all(groups.map(async ([id,paths]) => {
    effectFrames.set(id, await Promise.all(paths.map(async path => {
      const spriteImage = new Image();
      spriteImage.src = new URL('../../assets/effects/'+path,import.meta.url).href;
      await spriteImage.decode();
      return spriteImage;
    })));
  }));
}

// Registra en el piso un efecto con origen, orientación, duración y hora de inicio.
export function effect(kind,x,y,durationMs,directionIndex=0) {
  const sprite = { kind,x,y,ms: durationMs,dir: directionIndex,start:gameTime() };
  game.effects.push(sprite);
  playSound(({fangaround:'spin',purple:'cog'})[kind]??kind);
  return sprite;
}

// Vincula el efecto de recogida al cuerpo del jugador para acompañarlo mientras dura.
export function pickupEffect(player,kind) {
  effect(kind,player.x,player.y,650).follow = player;
}

// Selecciona el fotograma por tiempo de simulación y proyecta el efecto con su escala y filtro.
export function drawEffects(drawingContext, renderZoom, cameraX, cameraY) {
  const simulationTime = gameTime();
  for (const visualEffect of game.effects) {
    const frames = effectFrames.get(visualEffect.kind), animationProgress = Math.min(1,(simulationTime-visualEffect.start)/visualEffect.ms);
    const spriteImage = frames[Math.max(0,Math.min(frames.length-1,Math.floor(animationProgress*frames.length)))];
    const x = (visualEffect.follow?.x ?? visualEffect.x)*renderZoom-cameraX, y = (visualEffect.follow?.y ?? visualEffect.y)*renderZoom-cameraY;
    const scale = renderZoom*(visualEffect.follow?.stats.size ?? 100)/100*(visualEffect.kind==='mine'?1.6:1);
    if (visualEffect.kind === 'spine') {
      drawFang(drawingContext,visualEffect.dir,x,y,scale,1-animationProgress,'spine','sepia(1) saturate(6) hue-rotate(65deg)');
      continue;
    }
    const width = visualEffect.diameter ? visualEffect.diameter*renderZoom : spriteImage.width*scale, height = visualEffect.diameter ? width : spriteImage.height*scale;
    drawingContext.save();
    if ((visualEffect.owner ?? visualEffect.follow)?.isPlayer && visualEffect.kind === 'fangaround' && synergyActive('goldSpin'))
      drawingContext.filter = goldFilter;
    drawingContext.drawImage(spriteImage,x-width/2,y-height*(visualEffect.kind==='purple'?.95:visualEffect.kind==='fangaround'?.72:.5),width,height);
    drawingContext.restore();
  }
}

// La hoja usa parejas abajo/arriba, izquierda/derecha y diagonales.
const goldFilter = 'sepia(1) saturate(5)';
// Recorta la dirección correspondiente en la hoja de armas y conserva el estado del canvas.
export function drawFang(drawingContext,directionIndex,x,y,scale,opacity,kind='fang',filter='none') {
  const directionCell = [0,5,3,7,1,6,2,4][directionIndex];
  drawingContext.save();
  drawingContext.globalAlpha *= opacity;
  drawingContext.filter = filter;
  drawingContext.drawImage(effectFrames.get(kind)[0],directionCell%2*16,Math.floor(directionCell/2)*16,16,16,
    x-12*scale,y-12*scale,24*scale,24*scale);
  drawingContext.restore();
}

// Se paga con un único tipo entre los tres saldos más altos.
function cogCurrency() {
  const eligibleCurrencies = Object.entries(game.essences).sort((firstBalance,secondBalance)=>secondBalance[1]-firstBalance[1]).slice(0,3).filter(([,balance])=>balance>=5);
  return eligibleCurrencies.length ? eligibleCurrencies[Math.floor(Math.random()*eligibleCurrencies.length)][0] : null;
}

// Busca una casilla libre junto al punto inicial si un enemigo ocupa la entrada.
function landing(player) {
  const room = game.rooms[0], sites = [];
  const home = player.home ?? {x:(room.cx+.5)*TILE, y:(room.cy+.5)*TILE};
  game.grid.forEach((row,y)=>row.forEach((tile,x)=>{
    if (!tile) sites.push({ x:(x+.5)*TILE,y:(y+.5)*TILE,d:((x+.5)*TILE-home.x)**2+((y+.5)*TILE-home.y)**2 });
  }));
  return sites.sort((firstSite,secondSite)=>firstSite.d-secondSite.d).find(site=>canMove(player,site.x,site.y));
}

// Valida la tecla, el estado del jugador y el coste antes de iniciar el lanzamiento y su recarga.
export function useActive(slot) {
  const player=game.player, simulationTime=gameTime();
  if(slot==='e' && game.runRelics?.has('depleted_battery')){
    if(!player.hp||game.changingLevel||game.cast||['Attack','Hurt'].includes(player.state))return;
    if(game.batteryEnergy<10)return showToast('Batería · '+game.batteryEnergy+'/10 esencias eléctricas');
    game.batteryEnergy-=10;
    const radius=attackReach(player.stats)*3;
    effect('battery',player.x,player.y,650).diameter=radius*2;
    for(const enemy of game.entities) if(!enemy.isPlayer&&!enemy.ally&&enemy.hp&&Math.hypot(enemy.x-player.x,enemy.y-player.y)<=radius+bodyRadius(enemy))
      elementalHit(player,enemy,4*player.stats.attack,'electric');
    return;
  }
  const benefitId=[...game.held].find(key=>game.benefits.get(key).slot === slot);
  if (!benefitId || !player.hp || game.changingLevel || game.cast || ['Attack','Hurt'].includes(player.state)) return;
  const benefit=game.benefits.get(benefitId);
  if ((game.cooldowns[benefitId]??0)>simulationTime) return showToast('Recarga: '+Math.ceil((game.cooldowns[benefitId]-simulationTime)/1000)+' s');
  const currency = benefitId==='cog' ? cogCurrency() : null;
  if (benefitId==='cog' && (!currency || !landing(player))) return showToast('Necesitas 5 esencias del mismo tipo entre tus tres principales y una entrada libre.');
  if (benefitId==='amulet') {
    if (player.hp <= 1) return showToast('Necesitas más de 1 PV');
    player.hp--;
  }
  // La reducción de cada fuente se multiplica una vez, al iniciar la recarga de esta tecla.
  const duration = benefit.amount*1000 * (game.held.has('heritage_water')?.9:1)
    * (game.inventory.has('boost_steroids')?.85:1);
  game.cooldownDurations[benefitId]=duration;
  game.cooldowns[benefitId]=simulationTime+duration;
  game.cast={id: benefitId,start:simulationTime,dir:player.dir,hit:new Set(),currency};
  setState(player,benefitId==='mamoswine_fang'?'Spin':'Charge');
  if (benefitId==='cog') effect('purple',player.x,player.y,520);
  if (benefitId==='mamoswine_fang') effect('fangaround',player.x,player.y,560).follow=player;
}

// Fija el origen, alcance y daño del proyectil en el instante del disparo.
function launchFlare(owner, directionIndex) {
  const projectile = effect('flare',owner.x,owner.y,750,directionIndex);
  const fiery = game.pokemon.get(owner.dex).types.includes('fire');
  Object.assign(projectile,{owner,originX:owner.x,originY:owner.y,reach:4*attackReach(owner.stats),
    element:'fire',damage:Math.round(owner.stats.attack*(fiery?1.5:1))});
}

// Solo los efectos tipados consultan afinidades. Los dos tipos defensivos
// se combinan multiplicando, incluida la inmunidad eléctrica de Tierra.
export function elementalHit(owner,target,power,element) {
  const chart={
    fire:{grass:2,ice:2,bug:2,steel:2,fire:.5,water:.5,rock:.5,dragon:.5},
    electric:{water:2,flying:2,electric:.5,grass:.5,dragon:.5,ground:0}
  };
  const factor=game.pokemon.get(target.dex).types.reduce((value,type)=>value*(chart[element]?.[type]??1),1);
  if(factor)inflictDamage(owner,target,power*factor,false,true);
}

// Crea ocho proyectiles equidistantes cuyo daño depende de la defensa al recibir el crítico.
export function releaseSpines(owner) {
  for (let directionIndex=0;directionIndex<8;directionIndex++) {
    const projectile=effect('spine',owner.x,owner.y,680,directionIndex);
    Object.assign(projectile,{owner,originX:owner.x,originY:owner.y,reach:32,damage:Math.max(1,Math.round(owner.stats.defense*.1))});
  }
}

// Resuelve la explosión circular, incluido el daño que recibe su propietario.
function blast(owner) {
  effect('mine',owner.x,owner.y,1000).owner=owner;
  for (const target of game.entities) {
    if (target.ally || !target.hp || (target!==owner && owner.isPlayer===target.isPlayer)) continue;
    if (Math.hypot(target.x-owner.x,target.y-owner.y)<=72+(target===owner?0:bodyRadius(target))) {
      inflictDamage(owner,target,damageFor(owner,target,false),false,true);
    }
  }
}

// Gira al atacante y registra a quién ha alcanzado para evitar impactos repetidos durante las dos vueltas.
function spin(owner, activeCast, elapsed) {
  owner.dir = (activeCast.dir + Math.min(16,Math.floor(16*elapsed/560))) % 8;
  for (const target of game.entities) {
    if (target.ally || target.isPlayer === owner.isPlayer || !target.hp || activeCast.hit.has(target)) continue;
    if (Math.hypot(target.x-owner.x,target.y-owner.y) > attackReach(owner.stats)+bodyRadius(target)) continue;
    activeCast.hit.add(target);
    inflictDamage(owner,target,owner.stats.attack,false,true);
  }
}

// Cada salvaje anuncia su activa durante 100 ms y comprueba la presa,
// la distancia y la visibilidad al resolverla. La recarga es la mitad de la del jugador.
export function updateWildAbility(wild) {
  const benefitId = wild.activeBenefit, player = game.player, simulationTime = gameTime();
  if (!benefitId || !wild.hp || !player.hp) return false;
  const distance = Math.hypot(player.x-wild.x, player.y-wild.y);
  const range = (benefitId==='gunpowder_rock'?72:attackReach(wild.stats)*(benefitId==='fire_brooch'?4:1)) + bodyRadius(player);
  let activeCast = wild.abilityCast;
  if (!activeCast) {
    if ((benefitId==='amulet' && wild.hp<=1) || wild.bossResponse || wild.sidestep || simulationTime < (wild.abilityReadyAt ?? 0) || (distance > range || !hasSight(wild,player))) return false;
    if (benefitId==='cog' && Math.hypot(wild.x-wild.home.x,wild.y-wild.home.y)<TILE) return false;
    wild.dir = (Math.round(Math.atan2(player.x-wild.x,player.y-wild.y)/(Math.PI/4))+8)%8;
    playSound('charge');
    wild.abilityCast = {start:simulationTime,dir:wild.dir,hit:new Set()};
    wild.path = [];
    setState(wild,'Charge');
    return true;
  }
  if (simulationTime-activeCast.start < 100) return true;
  if (wild.state==='Charge') {
    if ((wild.prey!==player || distance > range || !hasSight(wild,player))) {
      wild.abilityReadyAt = simulationTime+1000;
    } else if (benefitId==='mamoswine_fang') {
      setState(wild,'Spin');
      activeCast.spinStart=simulationTime;
      effect('fangaround',wild.x,wild.y,560).follow=wild;
    } else if (benefitId==='fire_brooch') {
      const direction=(Math.round(Math.atan2(player.x-wild.x,player.y-wild.y)/(Math.PI/4))+8)%8;
      launchFlare(wild,direction);
    } else if (benefitId==='gunpowder_rock') {
      blast(wild);
    } else if (benefitId==='amulet' && wild.hp>1) {
      wild.hp--;
      wild.unbuffedStats={...wild.stats};
      for (const key of ['attack','speed','attackSpeed']) wild.stats[key]=Math.round(wild.stats[key]*1.5);
      wild.buffUntil=simulationTime+10000;
    } else if (benefitId==='cog') {
      const site=landing(wild);
      if (site) {
        effect('purple',wild.x,wild.y,520);
        wild.x=site.x; wild.y=site.y;
        effect('purple',wild.x,wild.y,520);

      }
    }
  }
  if (wild.state==='Spin') {
    spin(wild,activeCast,simulationTime-activeCast.spinStart);
    if (simulationTime-activeCast.spinStart<560) return true;
  }
  if (!(wild.abilityReadyAt > simulationTime)) wild.abilityReadyAt=simulationTime+game.benefits.get(benefitId).amount*500;
  wild.abilityCast=null;
  wild.dir=activeCast.dir;
  if (wild.hp && wild.state!=='Hurt') setState(wild,'Idle');
  return true;
}

// Actualiza lanzamientos, bonificaciones temporales y colisiones continuas de proyectiles.
export function tickAbilities() {
  const simulationTime=gameTime(), player=game.player, activeCast=game.cast;
  // El reloj de simulación pausa también la duración de los atributos temporales.
  if (game.amuletUntil && simulationTime>=game.amuletUntil) {
    game.amuletUntil=0;
    player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
  }
  for (const enemy of game.entities) if (enemy.buffUntil && simulationTime>=enemy.buffUntil) {
    enemy.stats=enemy.unbuffedStats;
    enemy.buffUntil=0;
  }
  if (activeCast && (!player.hp || player.state==='Hurt')) game.cast=null;
  else if (activeCast) {
    const castElapsedMs=simulationTime-activeCast.start;
    if (activeCast.id==='mamoswine_fang') spin(player,activeCast,castElapsedMs);
    if (castElapsedMs >= (activeCast.id==='mamoswine_fang'?560:activeCast.id==='amulet'?500:activeCast.id==='gunpowder_rock'?350:200)) {
      if (activeCast.id==='cog') {
        const site=landing(player);
        if (site && game.essences[activeCast.currency]>=5) {
          game.essences[activeCast.currency]-=5;
          player.x=site.x; player.y=site.y;
          effect('purple',player.x,player.y,520);
        }
      } else if (activeCast.id==='amulet') {
        game.amuletUntil=simulationTime+10000;
        player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
      } else if (activeCast.id==='gunpowder_rock') blast(player);
      else if (activeCast.id==='fire_brooch') launchFlare(player,activeCast.dir);
      player.dir=activeCast.dir;
      game.cast=null;
      if (player.hp && player.state!=='Hurt') setState(player,'Idle');
    }
  }
  // Una colisión puede crear espinas. Se acumulan aparte hasta el paso siguiente.
  const previousEffects = game.effects;
  game.effects = [];
  const survivingEffects = previousEffects.filter(visualEffect=>{
    const lifetimeFraction=Math.max(0,Math.min(1,(simulationTime-visualEffect.start)/visualEffect.ms));
    if (visualEffect.kind==='flare' || visualEffect.kind==='spine') {
      const [deltaX,deltaY]=DIR_VEC[visualEffect.dir], directionLength=Math.hypot(deltaX,deltaY);
      const travel=visualEffect.reach*lifetimeFraction, previousDistance=visualEffect.travel??0;
      visualEffect.x=visualEffect.originX+deltaX/directionLength*travel;visualEffect.y=visualEffect.originY+deltaY/directionLength*travel;
      // Colisión continua del proyectil aunque un fotograma tarde en llegar.
      let closestTarget, nearestDistance=Infinity;
      for (const enemy of game.entities) {
        if (enemy.ally || enemy.isPlayer === visualEffect.owner.isPlayer || !enemy.hp) continue;
        const x=enemy.x-visualEffect.originX,y=enemy.y-visualEffect.originY,along=(x*deltaX+y*deltaY)/directionLength;
        const closestDistance=Math.max(previousDistance,Math.min(travel,along));
        if (Math.hypot(x-closestDistance*deltaX/directionLength,y-closestDistance*deltaY/directionLength)<=10+bodyRadius(enemy) && along<nearestDistance) {
          closestTarget=enemy;nearestDistance=along;
        }
      }
      if (closestTarget) { elementalHit(visualEffect.owner,closestTarget,visualEffect.damage,visualEffect.element);return false; }
      visualEffect.travel=travel;
    }
    return lifetimeFraction<1;
  });
  game.effects = survivingEffects.concat(game.effects);
}
