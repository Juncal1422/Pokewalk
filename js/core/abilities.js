import { assetUrl } from './asset-url.js';
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
    ['watergun',['watergun/watergun.png']], ['iron_hit',['iron_hit/iron_hit.png']],
    ...[['featherfall',23],['webshield',11],['rock_aura',14],['grow',8],['rock_throw',18]].map(([id,count])=>
      sequence(id,count,index=>id+'/'+String(index-1).padStart(3,'0')+'.png')),
    sequence('revive',39,index=>'revive/'+String(index-1).padStart(3,'0')+'.png'),
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
      spriteImage.src = assetUrl('../../assets/effects/'+path,import.meta.url).href;
      await spriteImage.decode();
      return spriteImage;
    })));
  }));
}

// Registra en el piso un efecto con origen, orientación, duración y hora de inicio.
export function effect(kind,x,y,durationMs,directionIndex=0) {
  const sprite = { kind,x,y,ms: kind==='rock_aura'?1000:durationMs*2,dir: directionIndex,start:gameTime() };
  game.effects.push(sprite);
  playSound(({fangaround:'spin',purple:'machinery'})[kind]??kind);
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
    const scale = renderZoom*(visualEffect.follow?.stats.size ?? 100)/100*(visualEffect.kind==='mine'?2.4:1);
    // Las filas son las ocho direcciones y las columnas los cuadros de cada golpe.
    if(['iron_hit','watergun'].includes(visualEffect.kind)){
      const columns=visualEffect.kind==='watergun'?2:9, w=spriteImage.width/columns,h=spriteImage.height/8;
      const frame=Math.min(columns-1,Math.floor(animationProgress*columns));
      drawingContext.drawImage(spriteImage,w*frame,h*visualEffect.dir,w,h,x-w*scale/2,y-h*scale/2,w*scale,h*scale);
      continue;
    }
    if (visualEffect.kind === 'spine') {
      drawFang(drawingContext,visualEffect.dir,x,y,scale,1-animationProgress,'spine','sepia(1) saturate(6) hue-rotate(65deg)');
      continue;
    }
    const width = visualEffect.diameter ? visualEffect.diameter*renderZoom : spriteImage.width*scale, height = visualEffect.diameter ? width : spriteImage.height*scale;
    drawingContext.save();
    if(visualEffect.kind==='rock_throw' && visualEffect.owner.isPlayer && synergyActive('goldRock'))drawingContext.filter=goldFilter;
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

// Selecciona suelo libre del piso o de la sala que contiene al lanzador.
// En un pasillo la perla toma como referencia la habitación más cercana.
function landing(owner, roomOnly) {
  const tileX=Math.floor(owner.x/TILE), tileY=Math.floor(owner.y/TILE);
  const contains=(room,x,y)=>x>=room.x && x<room.x+room.w && y>=room.y && y<room.y+room.h;
  const rooms=game.rooms.filter(room=>!room.isNode && room.w>1);
  const room=roomOnly && rooms.length>0 && (rooms.find(room=>contains(room,tileX,tileY)) ??
    rooms.reduce((best,next)=>Math.hypot(next.cx-tileX,next.cy-tileY)<Math.hypot(best.cx-tileX,best.cy-tileY)?next:best));
  const sites=[];
  game.grid.forEach((row,y)=>row.forEach((tile,x)=>{
    if(tile || (x===tileX && y===tileY) || (room && !contains(room,x,y)))return;
    const site={x:(x+.5)*TILE,y:(y+.5)*TILE};
    if(canMove(owner,site.x,site.y))sites.push(site);
  }));
  return sites[Math.floor(Math.random()*sites.length)];
}

// Ejecuta las activas sin proyectil mediante el mismo comportamiento para ambas IAs y Ditto.
function utilityCast(id,owner) {
  if(id==='transparent'){owner.evasionUntil=gameTime()+5000;return;}
  if(id==='royalty'){
    for(const target of game.entities){
      if(!target.hp || target.ally || target.isPlayer===owner.isPlayer)continue;
      if(Math.hypot(owner.x-target.x,owner.y-target.y)<=attackReach(owner.stats)+bodyRadius(target))
        target.paralyzedUntil=gameTime()+1500;
    }
    return;
  }
  const site=landing(owner,id==='spoink_pearl');
  if(site){effect('purple',owner.x,owner.y,624);Object.assign(owner,site);effect('purple',owner.x,owner.y,624);}
}
const utilities=new Set(['machinery','spoink_pearl','transparent','royalty']);

// Valida la tecla, el estado del jugador y el coste antes de iniciar el lanzamiento y su recarga.
export function useActive(slot) {
  const player=game.player, simulationTime=gameTime();
  if(player.paralyzedUntil>simulationTime || player.rockUntil>simulationTime)return;
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
  if(!payEssences(player,benefitId))return showToast('PV completos o esencias insuficientes');
  if (benefitId==='seer') {
    if (player.hp <= 1) return showToast('Necesitas más de 1 PV');
    player.hp--;
  }
  // La reducción de cada fuente se multiplica una vez, al iniciar la recarga de esta tecla.
  const duration = benefit.amount*1000 * (game.held.has('heritage_water')?.9:1)
    * (game.inventory.has('boost_steroids')?.85:1) * (game.inventory.has('golden_disk')?.75:1) * (synergyActive('royalCrown')?.5:1);
  game.cooldownDurations[benefitId]=duration;
  game.cooldowns[benefitId]=simulationTime+duration;
  game.cast={id: benefitId,start:simulationTime,dir:player.dir,hit:new Set()};
  setState(player,benefitId==='mamoswine_fang'?'Spin':'Charge');

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
export function elementalHit(owner,target,power,element,ownerAbility=true) {
  const chart={
    fire:{grass:2,ice:2,bug:2,steel:2,fire:.5,water:.5,rock:.5,dragon:.5},
    water:{fire:2,ground:2,rock:2,water:.5,grass:.5,dragon:.5},
    rock:{fire:2,ice:2,flying:2,bug:2,fighting:.5,ground:.5,steel:.5},
    electric:{water:2,flying:2,electric:.5,grass:.5,dragon:.5,ground:0}
  };
  const factor=game.pokemon.get(target.dex).types.reduce((value,type)=>value*(chart[element]?.[type]??1),1);
  if(factor)return inflictDamage(owner,target,power*factor,false,ownerAbility);
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

// El retroceso recorre pasos cortos y se detiene ante paredes o cuerpos.
export function knockback(owner,target,steps) {
  const dx=target.x-owner.x,dy=target.y-owner.y,length=Math.hypot(dx,dy)||1;
  for(let step=0;step<steps;step++){
    const x=target.x+dx/length,y=target.y+dy/length;
    if(!canMove(target,x,y))break;
    target.x=x;target.y=y;
  }
}

// Un ataque a distancia sustituye al contacto. El primer cuerpo absorbe el proyectil.
export function launchWeapon(owner,kind){
  const projectile=effect(kind,owner.x,owner.y,260,owner.dir);
  Object.assign(projectile,{owner,originX:owner.x,originY:owner.y,reach:attackReach(owner.stats),
    element:kind==='watergun'?'water':'rock',weapon:true});
}

// Emplumado interrumpe los efectos ofensivos del adversario y reinicia su tiempo de reacción.
export function featherStun(owner){
  effect('featherfall',owner.x,owner.y,450).follow=owner;
  const now=gameTime();
  for(const target of game.entities){
    if(!target.hp||target.ally||target.isPlayer===owner.isPlayer||Math.hypot(target.x-owner.x,target.y-owner.y)>2*attackReach(owner.stats))continue;
    target.interruptedAt=now;target.rockUntil=0;target.paralyzedUntil=now+1000;target.impactPending=false;target.abilityCast=null;target.aimSince=null;
    target.nextAttackAt=now+2000;
    if(target.activeBenefit)target.abilityReadyAt=now+game.benefits.get(target.activeBenefit).amount*500;
    if(target.isPlayer){
      game.cast=null;
      for(const id of game.held)if(game.benefits.get(id).active){
        const duration=game.cooldownDurations[id]??game.benefits.get(id).amount*1000;
        game.cooldownDurations[id]=duration;game.cooldowns[id]=now+duration;
      }
    }
    for(const fx of game.effects)if(fx.owner===target||fx.follow===target)fx.cancelled=true;
    setState(target,'Idle');
  }
}

// Los costes se validan completos antes de descontar una sola unidad.
function payEssences(owner,id){
  const balances=owner.isPlayer?game.essences:(owner.essences??={bug:20});
  if(id==='silken'){
    if((balances.bug??0)<10)return false;
    balances.bug-=10;
  }else if(id==='regenerative'){
    if(owner.hp>=owner.stats.hpMax||Object.values(balances).reduce((a,b)=>a+b,0)<20)return false;
    for(let i=0;i<20;i++){
      const types=Object.keys(balances).filter(key=>balances[key]>0);
      balances[types[Math.floor(Math.random()*types.length)]]--;
    }
  }
  return true;
}

// Aplica el beneficio al concluir la carga. El área de roca alcanza una vez a cada rival.
function releaseSpecial(owner,id){
  if(id==='rock_core'){
    const radius=3*attackReach(owner.stats);
    const aura=effect('rock_aura',owner.x,owner.y,1000);
    Object.assign(aura,{owner,follow:owner,diameter:2*radius,radius,hit:new Set()});
    owner.rockUntil=gameTime()+1000;setState(owner,'Charge');
  }else if(id==='silken'){
    if(owner.isPlayer){owner.bonuses.defense+=3;owner.stats=playerStats(game.pokemon.get(owner.dex),game.progress,owner.bonuses);}
    else owner.stats.defense+=3;
    effect('webshield',owner.x,owner.y,400).follow=owner;
  }else if(id==='regenerative'){
    owner.hp=Math.min(owner.stats.hpMax,owner.hp+Math.ceil(owner.stats.hpMax*.3));
    effect('heal',owner.x,owner.y,400).follow=owner;playSound('regenerative');
  }
}
const specials=new Set(['rock_core','regenerative','silken']);

// Cada salvaje anuncia su activa durante 500 ms y comprueba la presa,
// la distancia y la visibilidad antes de empezar. La recarga es la mitad de la del jugador.
export function updateWildAbility(wild) {
  const benefitId = wild.activeBenefit, player = game.player, simulationTime = gameTime();
  if (!benefitId || !wild.hp || !player.hp) return false;
  const distance = Math.hypot(player.x-wild.x, player.y-wild.y);
  const range = (benefitId==='gunpowder_core'?72:attackReach(wild.stats)*(benefitId==='hooh_brooch'?4:benefitId==='rock_core'?3:1)) + bodyRadius(player);
  let activeCast = wild.abilityCast;
  if (!activeCast) {
    if ((benefitId==='seer' && wild.hp<=1) || wild.bossResponse || wild.sidestep || simulationTime < (wild.abilityReadyAt ?? 0) || (distance > range || !hasSight(wild,player))) return false;

    wild.dir = (Math.round(Math.atan2(player.x-wild.x,player.y-wild.y)/(Math.PI/4))+8)%8;
    if(!payEssences(wild,benefitId))return false;
    playSound('charge');
    wild.abilityCast = {start:simulationTime,dir:wild.dir,hit:new Set()};
    wild.path = [];
    setState(wild,'Charge');
    return true;
  }
  if (simulationTime-activeCast.start < 500) return true;
  if (!activeCast.released) {
    activeCast.released=true;
    if (benefitId==='mamoswine_fang') {
      setState(wild,'Spin');
      activeCast.spinStart=simulationTime;
      effect('fangaround',wild.x,wild.y,560).follow=wild;
    } else if (benefitId==='hooh_brooch') {
      const direction=(Math.round(Math.atan2(player.x-wild.x,player.y-wild.y)/(Math.PI/4))+8)%8;
      launchFlare(wild,direction);
    } else if (benefitId==='gunpowder_core') {
      blast(wild);
    } else if (benefitId==='seer') {
      wild.hp=Math.max(1,wild.hp-1);
      wild.unbuffedStats={...wild.stats};
      for (const key of ['attack','speed','attackSpeed']) wild.stats[key]=Math.round(wild.stats[key]*1.5);
      wild.buffUntil=simulationTime+10000;
    } else if(specials.has(benefitId))releaseSpecial(wild,benefitId);
    else if (utilities.has(benefitId)) utilityCast(benefitId,wild);
  }
  if (wild.state==='Spin') {
    spin(wild,activeCast,simulationTime-activeCast.spinStart);
    if (simulationTime-activeCast.spinStart<560) return true;
  }
  if (!(wild.abilityReadyAt > simulationTime)) wild.abilityReadyAt=simulationTime+game.benefits.get(benefitId).amount*500;
  wild.abilityCast=null;
  wild.dir=activeCast.dir;
  if (wild.hp && !(wild.rockUntil>simulationTime) && wild.state!=='Hurt') setState(wild,'Idle');
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
    if (castElapsedMs >= (activeCast.id==='mamoswine_fang'?560:['rock_core','seer'].includes(activeCast.id)?500:activeCast.id==='gunpowder_core'?350:200)) {
      if(specials.has(activeCast.id))releaseSpecial(player,activeCast.id);
      else if (utilities.has(activeCast.id)) utilityCast(activeCast.id,player);
      else if (activeCast.id==='seer') {
        game.amuletUntil=simulationTime+10000;
        player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
      } else if (activeCast.id==='gunpowder_core') blast(player);
      else if (activeCast.id==='hooh_brooch') launchFlare(player,activeCast.dir);
      player.dir=activeCast.dir;
      game.cast=null;
      if (player.hp && !(player.rockUntil>simulationTime) && player.state!=='Hurt') setState(player,'Idle');
    }
  }
  // Una colisión puede crear espinas. Se acumulan aparte hasta el paso siguiente.
  const previousEffects = game.effects;
  game.effects = [];
  const survivingEffects = previousEffects.filter(visualEffect=>{
    const lifetimeFraction=Math.max(0,Math.min(1,(simulationTime-visualEffect.start)/visualEffect.ms));
    if(visualEffect.cancelled || (visualEffect.owner??visualEffect.follow)?.interruptedAt>=visualEffect.start)return false;
    if(visualEffect.kind==='rock_aura'){
      for(const target of game.entities){
        if(!target.hp||target.ally||target.isPlayer===visualEffect.owner.isPlayer||visualEffect.hit.has(target))continue;
        if(Math.hypot(target.x-visualEffect.owner.x,target.y-visualEffect.owner.y)>visualEffect.radius+bodyRadius(target))continue;
        visualEffect.hit.add(target);
        if(elementalHit(visualEffect.owner,target,3*visualEffect.owner.stats.attack,'rock'))knockback(visualEffect.owner,target,16);
      }
    }
    if (visualEffect.weapon || visualEffect.kind==='flare' || visualEffect.kind==='spine') {
      const [deltaX,deltaY]=DIR_VEC[visualEffect.dir], directionLength=Math.hypot(deltaX,deltaY);
      const travel=visualEffect.reach*lifetimeFraction, previousDistance=visualEffect.travel??0;
      visualEffect.x=visualEffect.originX+deltaX/directionLength*travel;visualEffect.y=visualEffect.originY+deltaY/directionLength*travel;
      // Colisión continua del proyectil aunque un fotograma tarde en llegar.
      let closestTarget, nearestDistance=Infinity;
      for (const enemy of game.entities) {
        if (enemy.ally || enemy.isPlayer === visualEffect.owner.isPlayer || !enemy.hp) continue;
        const x=enemy.x-visualEffect.originX,y=enemy.y-visualEffect.originY,along=(x*deltaX+y*deltaY)/directionLength;
        if(along<0 || along>visualEffect.reach+bodyRadius(enemy))continue;
        const closestDistance=Math.max(previousDistance,Math.min(travel,along));
        if (Math.hypot(x-closestDistance*deltaX/directionLength,y-closestDistance*deltaY/directionLength)<=10+bodyRadius(enemy) && along<nearestDistance) {
          closestTarget=enemy;nearestDistance=along;
        }
      }
      if(!hasSight({x:visualEffect.originX,y:visualEffect.originY},closestTarget??visualEffect))return false;
      if (closestTarget) {
        if(visualEffect.weapon && Math.random()<.05+(closestTarget.evasionUntil>simulationTime?.2:0)+
          ((closestTarget.isPlayer?game.held:closestTarget.benefits)?.has('swift')?.05:0)){
          closestTarget.missUntil=simulationTime+750;playSound('miss');return false;
        }
        const power=visualEffect.weapon?damageFor(visualEffect.owner,closestTarget,false):visualEffect.damage;
        if(elementalHit(visualEffect.owner,closestTarget,power,visualEffect.element,!visualEffect.weapon) && visualEffect.weapon){
          knockback(visualEffect.owner,closestTarget,visualEffect.kind==='rock_throw'?20:10);
          if(visualEffect.kind==='rock_throw')playSound('rockImpact');
        }
        return false;
      }
      visualEffect.travel=travel;
    }
    return lifetimeFraction<1;
  });
  game.effects = survivingEffects.concat(game.effects);
}
