import {relics} from './collection.js';
import { assetUrl } from './asset-url.js';
import {playSound} from './audio.js';
import { gameTime,cooldownTime } from './clock.js';
import { game } from './state.js';
import { DIR_VEC, TILE } from './constants.js';
import { hasSight } from './terrain.js';
import { settleStats, playerStats, synergyActive } from './benefits.js';
import { attackReach, damageFor } from './stats.js';
import { bodyRadius, canMove, dodgeChance, inflictDamage, setState, showToast } from './entities.js';

import {effectSheets} from '../data/effect-atlas.js';
import {criticalHit,actorRule,affinity} from './modifiers.js';
import {dropNewItem,refreshEssenceAttack} from './items.js';
import {essenceNames} from './hud.js';

const effectAtlas=new Image();
// Todos los efectos comparten una textura; el catálogo localiza su celda y origen.
export async function loadEffects() {
  effectAtlas.src=assetUrl('../../assets/effects/effects.png',import.meta.url).href;
  await effectAtlas.decode();
}
// Registra en el piso un efecto con origen, orientación, duración y hora de inicio.
export function effect(kind,x,y,durationMs,directionIndex=0) {
  const sprite = { kind,x,y,ms: kind==='rock_aura'?1000:durationMs*2,dir: directionIndex,start:gameTime() };
  console.debug('[Animación de efecto]', {kind,x,y,directionIndex,durationMs:sprite.ms,
    frames:effectSheets[kind].columns,framesPerSecond:1000*effectSheets[kind].columns/sprite.ms,start:sprite.start});
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
    const sheet = effectSheets[visualEffect.kind];
    const progress = Math.max(0,Math.min(1,(simulationTime-visualEffect.start)/visualEffect.ms));
    const count=visualEffect.frameCount??sheet.columns;
    const frame=(visualEffect.firstFrame??0)+Math.min(count-1,Math.floor(progress*count));
    const x = (visualEffect.follow?.x ?? visualEffect.x)*renderZoom-cameraX;
    const y = (visualEffect.follow?.y ?? visualEffect.y)*renderZoom-cameraY;
    const scale = renderZoom*(visualEffect.follow?.stats.size ?? 100)/100*(visualEffect.kind==='mine'?2.4:1);
    if (visualEffect.kind === 'spine') {
      const fiery=visualEffect.owner && actorRule(visualEffect.owner,'fireAttack');
      drawFang(drawingContext,visualEffect.dir,x,y,scale,1-progress,fiery?'fire_spike':'spine',fiery?'none':'sepia(1) saturate(6) hue-rotate(65deg)');
      continue;
    }
    const width = visualEffect.diameter ? visualEffect.diameter*renderZoom : sheet.width*scale, height = visualEffect.diameter ? width : sheet.height*scale;
    drawingContext.save();
    if(visualEffect.owner && actorRule(visualEffect.owner,'fireAttack') && (visualEffect.weapon || visualEffect.kind==='flare'))drawingContext.filter=game.canvasTheme.fireFilter;
    if(visualEffect.kind==='rock_throw' && visualEffect.owner.isPlayer && synergyActive('goldRock'))drawingContext.filter=goldFilter;
    if ((visualEffect.owner ?? visualEffect.follow)?.isPlayer && visualEffect.kind === 'fangaround' && synergyActive('goldSpin'))
      drawingContext.filter = goldFilter;
    const base = sheet.base ?? sheet.height / 2;
    const row = sheet.rows === 8 ? visualEffect.dir : 0;
    drawingContext.drawImage(effectAtlas,sheet.x+frame*sheet.width,sheet.y+row*sheet.height,sheet.width,sheet.height,
      x-width/2+sheet.offsetX*scale,y-height*base/sheet.height+sheet.offsetY*scale,width,height);
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
  const sheet=effectSheets[kind];
  const col=kind==='fire_spike'?Math.floor(gameTime()/60)%sheet.columns:directionCell%2;
  const row=kind==='fire_spike'?directionIndex:Math.floor(directionCell/2);
  drawingContext.drawImage(effectAtlas,sheet.x+col*sheet.width,sheet.y+row*sheet.height,sheet.width,sheet.height,
    x+(sheet.offsetX-8)*scale,y+(sheet.offsetY-20)*scale,16*scale,16*scale);
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

// VIP y Engranaje buscan una casilla contigua transitable a la salida actual.
function exitNeighbor(owner){
  const portal=game.portal;
  if(!portal || !['stairs','portal'].includes(portal.kind))return null;
  for(const [dx,dy] of DIR_VEC){
    const x=(portal.x+dx+.5)*TILE,y=(portal.y+dy+.5)*TILE;
    if(game.grid[portal.y+dy]?.[portal.x+dx]===0 && canMove(owner,x,y))return {x,y};
  }
  return null;
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
  const site=id==='machinery' && actorRule(owner,'exitRange')?exitNeighbor(owner):landing(owner,id==='spoink_pearl');
  if(site){effect('purple',owner.x,owner.y,624);Object.assign(owner,site);effect('purple',owner.x,owner.y,624);}
}
const utilities=new Set(['machinery','spoink_pearl','transparent','royalty']);

// La misma reducción de recarga se aplica a beneficios y reliquias.
function cooldownDuration(seconds){
  return seconds*1000*(1-actorRule(game.player,'cooldownReduction')) * (game.held.has('heritage_water')?.9:1)
    * (game.inventory.has('boost_steroids')?.85:1) * (game.inventory.has('golden_disk')?.75:1) * (synergyActive('royalCrown')?.5:1);
}

function wildEnemies(){
  return game.entities.filter(e=>!e.isPlayer && !e.ally && e.hp>0);
}

// Encuentra la primera casilla de suelo conectada al jugador y libre de enemigos.
function ejectSite(owner){
  const start={x:Math.floor(owner.x/TILE),y:Math.floor(owner.y/TILE)};
  const seen=new Set([start.x+','+start.y]), queue=[start];
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
    const x=queue[i].x+dx,y=queue[i].y+dy,key=x+','+y;
    if(seen.has(key)||game.grid[y]?.[x]!==0)continue;
    seen.add(key);queue.push({x,y});
    if(!game.entities.some(e=>e.hp && Math.floor(e.x/TILE)===x && Math.floor(e.y/TILE)===y))return {x,y};
  }
}

function activateRelic(id,owner){
  if(!owner.hp || game.changingLevel || game.cast || !['Idle','Walk'].includes(owner.state))return;
  const config=relics[id], now=cooldownTime(), remaining=(game.cooldowns[id]??0)-now;
  if(remaining>0)return showToast('Recarga: '+Math.ceil(remaining/1000)+' s');
  const site=id==='eject_button'?ejectSite(owner):null;
  if(id==='eject_button' && !site)return showToast('No hay espacio para el teletransportador.');
  const balances=game.essences;
  if(config.cost){
    const available=config.essence?(balances[config.essence]??0):Object.values(balances).reduce((a,b)=>a+b,0);
    if(available<config.cost)return showToast('Esencias insuficientes');
    for(let i=0;i<config.cost;i++){
      const types=Object.keys(balances).filter(k=>balances[k]>0);
      balances[config.essence??types[Math.floor(Math.random()*types.length)]]--;
    }
    refreshEssenceAttack();
  }
  game.cooldownDurations[id]=cooldownDuration(config.cooldown);
  game.cooldowns[id]=now+game.cooldownDurations[id];
  const reach=attackReach(owner.stats);
  if(id==='death_flute'){
    game.cast={id,start:gameTime(),dir:owner.dir};setState(owner,'Charge');playSound('charge');
  }else if(id==='eject_button'){
    game.mission.failed=game.mission.ejected=true;
    game.portal={...site,kind:'portal',entered:false};playSound('machinery');
  }else if(id==='pressure_pill'){
    effect('tornado',owner.x,owner.y,300).follow=owner;
    for(const target of wildEnemies()){
      target.windPush={x:owner.x,y:owner.y,remaining:10*reach,step:10*reach/30};
      setState(target,'Hurt');
    }
  }else{
    const wave=effect('void_zone',owner.x,owner.y,350);
    Object.assign(wave,{owner,radius:3*reach,hit:new Set(),diameter:1});
  }
}

// Valida la tecla, el estado del jugador y el coste antes de iniciar el lanzamiento y su recarga.
export function useActive(slot) {
  const player=game.player, simulationTime=gameTime();
  if(player.frozenUntil>simulationTime || player.paralyzedUntil>simulationTime || player.rockUntil>simulationTime)return;
  if(slot==='r'){
    const id=[...(game.runRelics??[])].find(key=>relics[key]?.slot==='r');
    if(id && id!=='depleted_battery')return activateRelic(id,player);
    if(id!=='depleted_battery')return;
    if(!player.hp||game.changingLevel||game.cast||!['Idle','Walk'].includes(player.state))return;
    if(game.batteryEnergy<4)return showToast('Batería · '+game.batteryEnergy+'/4 esencias eléctricas');
    game.batteryEnergy-=4;
    const radius=attackReach(player.stats)*3;
    effect('battery',player.x,player.y,650).diameter=radius*2;
    for(const enemy of game.entities) if(!enemy.isPlayer&&!enemy.ally&&enemy.hp&&Math.hypot(enemy.x-player.x,enemy.y-player.y)<=radius+bodyRadius(enemy))
      elementalHit(player,enemy,4*player.stats.attack,'electric');
    return;
  }
  const benefitId=[...game.held].find(key=>game.benefits.get(key).slot === slot);
  if (!benefitId || !player.hp || game.changingLevel || game.cast || !['Idle','Walk'].includes(player.state)) return;
  const benefit=game.benefits.get(benefitId);
  if ((game.cooldowns[benefitId]??0)>cooldownTime()) return showToast('Recarga: '+Math.ceil((game.cooldowns[benefitId]-cooldownTime())/1000)+' s');
  if(benefitId==='machinery' && actorRule(player,'exitRange') && !exitNeighbor(player))return showToast('La salida aún no está disponible.');
  if(!payEssences(player,benefitId))return showToast('PV completos o esencias insuficientes');
  if (benefitId==='seer') {
    if (player.hp <= 1) return showToast('Necesitas más de 1 PV');
    player.hp--;
  }
  // La reducción de cada fuente se multiplica una vez, al iniciar la recarga de esta tecla.
  const duration = cooldownDuration(benefit.amount);
  game.cooldownDurations[benefitId]=duration;
  game.cooldowns[benefitId]=cooldownTime()+duration;
  game.cast={id: benefitId,start:simulationTime,dir:player.dir,hit:new Set()};
  setState(player,['dealer','mamoswine_fang'].includes(benefitId)?'Spin':'Charge');

  if (benefitId==='mamoswine_fang') effect('fangaround',player.x,player.y,560).follow=player;
}

// Fija el origen, alcance y daño del proyectil en el instante del disparo.
function launchFlare(owner, directionIndex) {
  const projectile = effect('flare',owner.x,owner.y,750,directionIndex);
  projectile.ms/=1+actorRule(owner,'projectileBonus');
  const fiery = game.pokemon.get(owner.dex).types.includes('fire');
  Object.assign(projectile,{owner,originX:owner.x,originY:owner.y,reach:4*attackReach(owner.stats),
    element:'fire',damage:Math.round(owner.stats.attack*(fiery?1.5:1))});
}

// Solo los efectos tipados consultan afinidades. Los dos tipos defensivos
// se combinan multiplicando, con resistencia parcial de Tierra a Eléctrico.
export function elementalHit(owner,target,power,element,ownerAbility=true,critical=false,fixedElement=false) {
  const chart={
    fire:{grass:2,ice:2,bug:2,steel:2,fire:.5,water:.5,rock:.5,dragon:.5},
    water:{fire:2,ground:2,rock:2,water:.5,grass:.5,dragon:.5},
    rock:{fire:2,ice:2,flying:2,bug:2,fighting:.5,ground:.5,steel:.5},
    psychic:{fighting:2,poison:2,psychic:.5,steel:.5,dark:.5},
    ground:{electric:2,fire:2,rock:2,steel:2,poison:2,grass:.5,bug:.5,flying:.5},
    steel:{rock:2,ice:2,steel:.5,fire:.5,water:.5,electric:.5},
    dark:{psychic:2,ghost:2,dark:.5,fighting:.5},
    ghost:{ghost:2,psychic:2,dark:.5,normal:.5},
    flying:{grass:2,fighting:2,bug:2,electric:.5,rock:.5,steel:.5},
    electric:{water:2,flying:2,electric:.5,grass:.5,dragon:.5,ground:.5}
  };
  if (!ownerAbility && !fixedElement) element=attackElement(owner)??element;
  const factor=affinity(element,target)*game.pokemon.get(target.dex).types.reduce((value,type)=>value*(chart[element]?.[type]??1),1);
  const damage = inflictDamage(owner,target,power*factor,critical,ownerAbility);
  const scorched = damage && target.isPlayer && [...game.inventory].find(id=>game.items[id]?.burnsOn===element);
  if (scorched) {
    game.inventory.delete(scorched);
    target.stats=playerStats(game.pokemon.get(target.dex),game.progress,target.bonuses);
    showToast('El fuego ha quemado '+game.items[scorched].name+'.');
    playSound('inflame');
  }
  return damage;
}

// El ataque elemental se comparte entre contacto, proyectiles y habilidades.
export function attackElement(owner){
  if(actorRule(owner,'fireAttack'))return 'fire';
  if(actorRule(owner,'psychicAttack'))return 'psychic';
}
// Crea ocho proyectiles equidistantes cuyo daño depende de la defensa al recibir el crítico.
export function releaseSpines(owner) {
  for (let directionIndex=0;directionIndex<8;directionIndex++) {
    const projectile=effect('spine',owner.x,owner.y,680,directionIndex);
    projectile.ms/=1+actorRule(owner,'projectileBonus');
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
  projectile.ms/=1+actorRule(owner,'projectileBonus');
  const relicShot=['bone_throw','iron_bomb'].includes(kind);
  Object.assign(projectile,{owner,originX:owner.x,originY:owner.y,reach:attackReach(owner.stats)*(relicShot?2:1),
    element:({watergun:'water',rock_throw:'rock',bone_throw:'ground',iron_bomb:'steel'})[kind],weapon:true,relicShot});
  if(kind==='iron_bomb')projectile.frameCount=9;
}

// Impacto terminal de un proyectil. La bomba reserva los fotogramas 10–12 para la explosión.
function projectileImpact(projectile,x,y){
  if(projectile.kind==='bone_throw')effect('bone_impact',x,y,130);
  if(projectile.kind==='iron_bomb'){
    const blast=effect('iron_bomb',x,y,140);
    blast.firstFrame=9;blast.frameCount=3;
    playSound('bombImpact');
  }
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
        game.cooldownDurations[id]=duration;game.cooldowns[id]=cooldownTime()+duration;
      }
    }
    for(const fx of game.effects)if(fx.owner===target||fx.follow===target)fx.cancelled=true;
    setState(target,'Idle');
  }
}

// Los costes se validan completos antes de descontar una sola unidad.
function payEssences(owner,id){
  const balances=owner.isPlayer?game.essences:(owner.essences??={bug:20});
  const cost=game.benefits.get(id)?.rules?.lootCost;
  if(cost){
    if(Object.values(balances).reduce((sum,n)=>sum+n,0)<cost)return false;
    for(let i=0;i<cost;i++){
      const types=Object.keys(balances).filter(type=>balances[type]>0);
      balances[types[Math.floor(Math.random()*types.length)]]--;
    }
  }else if(id==='silken'){
    if((balances.bug??0)<10)return false;
    balances.bug-=10;
  }else if(id==='regenerative'){
    if(owner.hp>=owner.stats.hpMax||Object.values(balances).reduce((a,b)=>a+b,0)<20)return false;
    for(let i=0;i<20;i++){
      const types=Object.keys(balances).filter(key=>balances[key]>0);
      balances[types[Math.floor(Math.random()*types.length)]]--;
    }
  }
  if (owner.isPlayer) refreshEssenceAttack();
  return true;
}

// Aplica el beneficio al concluir la carga. El área de roca alcanza una vez a cada rival.
function releaseSpecial(owner,id){
  const config=game.benefits.get(id)?.rules??{};
  if(config.shellMs){
    owner.shellUntil=gameTime()+config.shellMs;
    playSound('shell');
  }else if(config.shuffleMs){
    const balances=owner.isPlayer?game.essences:owner.essences;
    const total=Object.values(balances).reduce((sum,n)=>sum+n,0);
    for(const type of Object.keys(balances))balances[type]=0;
    for(let i=0;i<total;i++){
      const type=essenceNames[Math.floor(Math.random()*essenceNames.length)];
      balances[type]=(balances[type]??0)+1;
    }
    if (owner.isPlayer) refreshEssenceAttack();
    playSound('dealer');
  }else if(config.lootCost)dropNewItem(owner);
  else if(config.burstRange){
    const radius=config.burstRange*attackReach(owner.stats);
    effect('water_burst',owner.x,owner.y,350).diameter=radius*2;
    for(const target of game.entities){
      if(!target.hp || target.ally || target.isPlayer===owner.isPlayer || Math.hypot(target.x-owner.x,target.y-owner.y)>radius+bodyRadius(target))continue;
      if(elementalHit(owner,target,owner.stats.attack,'water'))knockback(owner,target,config.push);
    }
  }else if(config.eruptionStep){
    const chain={owner,dir:owner.dir,step:config.eruptionStep,damage:config.power*owner.stats.attack,hit:new Set()};
    erupt(owner.x,owner.y,chain);
  }else if(id==='rock_core'){
    const radius=3*attackReach(owner.stats);
    const aura=effect('rock_aura',owner.x,owner.y,1000);
    Object.assign(aura,{owner,follow:owner,diameter:2*radius,radius,hit:new Set()});
    owner.rockUntil=gameTime()+1000;setState(owner,'Charge');
  }else if(id==='silken'){
    if(owner.isPlayer){owner.bonuses.defense+=3;owner.stats=settleStats(game.pokemon.get(owner.dex),game.progress,owner.bonuses,owner.stats);}
    else owner.stats.defense+=3;
    effect('webshield',owner.x,owner.y,400).follow=owner;
  }else if(id==='regenerative'){
    owner.hp=Math.min(owner.stats.hpMax,owner.hp+Math.ceil(owner.stats.hpMax*.3));
    effect('heal',owner.x,owner.y,400).follow=owner;playSound('regenerative');
  }
}
// Cada segmento atraviesa cuerpos. El segundo cuadro inicia el siguiente segmento.
function erupt(x,y,chain){
  const fx=effect('erupt',x,y,180,chain.dir);
  fx.chain=chain;
  for(const target of game.entities){
    if(!target.hp || target.ally || target.isPlayer===chain.owner.isPlayer || chain.hit.has(target))continue;
    if(Math.hypot(target.x-x,target.y-y)>chain.step/2+bodyRadius(target) || !hasSight({x,y},target))continue;
    chain.hit.add(target);elementalHit(chain.owner,target,chain.damage,'fire');
  }
}
const specials=new Set(['rock_core','regenerative','silken','shelders_shell','dealer','linoone_loot','groudons_scale','kingdra_scale']);

// El efecto se resuelve a su hora; la pose especial puede necesitar más fotogramas.
function finishCastAnimation(owner) {
  if (owner.animationCompleted) setState(owner,'Idle');
  else owner.finishingSpecial = true;
}

// Cada salvaje anuncia su activa durante 500 ms y comprueba la presa,
// la distancia y la visibilidad antes de empezar. La recarga es la mitad de la del jugador.
export function updateWildAbility(wild) {
  const benefitId = wild.activeBenefit, player = game.player, simulationTime = gameTime();
  if (wild.frozenUntil>simulationTime || !benefitId || !wild.hp || !player.hp) return false;
  const distance = Math.hypot(player.x-wild.x, player.y-wild.y);
  const range = (benefitId==='gunpowder_core'?72:attackReach(wild.stats)*(benefitId==='hooh_brooch'?4:benefitId==='rock_core'?3:1)) + bodyRadius(player);
  let activeCast = wild.abilityCast;
  if (!activeCast) {
    if ((benefitId==='seer' && wild.hp<=1) || wild.bossResponse || wild.sidestep || simulationTime < (wild.abilityReadyAt ?? 0) || (distance > range || !hasSight(wild,player))) return false;

    wild.dir = (Math.round(Math.atan2(player.x-wild.x,player.y-wild.y)/(Math.PI/4))+8)%8;
    if(!payEssences(wild,benefitId))return false;
    playSound('charge');
    console.debug('[IA] Preparar habilidad',{dex:wild.dex,benefitId,x:wild.x,y:wild.y,distance,range});
    wild.abilityCast = {start:simulationTime,dir:wild.dir,hit:new Set()};
    wild.path = [];
    setState(wild,'Charge');
    return true;
  }
  // La onda de roca concede un segundo de reacción; el resto mantiene su aviso habitual.
  if(benefitId==='dealer')wild.dir=(activeCast.dir+Math.floor((simulationTime-activeCast.start)/100))%8;
  const chargeDuration = game.benefits.get(benefitId)?.rules?.shuffleMs ?? (benefitId === 'rock_core' ? 1000 : 500);
  if (simulationTime-activeCast.start < chargeDuration) return true;
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
      for (const key of ['attack','speed','attackSpeed']) wild.stats[key]+=50;
      wild.buffUntil=simulationTime+10000;
    } else if(specials.has(benefitId))releaseSpecial(wild,benefitId);
    else if (utilities.has(benefitId)) utilityCast(benefitId,wild);
  }
  if (wild.state==='Spin') {
    spin(wild,activeCast,simulationTime-activeCast.spinStart);
    if (simulationTime-activeCast.spinStart<560) return true;
  }
  if (!(wild.abilityReadyAt > simulationTime)) wild.abilityReadyAt=simulationTime+game.benefits.get(benefitId).amount*500*(1-actorRule(wild,'cooldownReduction'));
  wild.abilityCast=null;
  wild.dir=activeCast.dir;
  if (wild.hp && !(wild.rockUntil>simulationTime) && wild.state!=='Hurt') finishCastAnimation(wild);
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
  else if (activeCast && !(player.frozenUntil>simulationTime)) {
    const castElapsedMs=simulationTime-activeCast.start;
    if (activeCast.id==='mamoswine_fang') spin(player,activeCast,castElapsedMs);
    if(activeCast.id==='dealer')player.dir=(activeCast.dir+Math.floor(castElapsedMs/100))%8;
    if (castElapsedMs >= (relics[activeCast.id]?.charge ?? game.benefits.get(activeCast.id)?.rules?.shuffleMs ?? (activeCast.id==='mamoswine_fang'?560:['rock_core','seer'].includes(activeCast.id)?500:activeCast.id==='gunpowder_core'?350:200))) {
      if(activeCast.id==='death_flute'){
        effect('death_chant',player.x,player.y,600).follow=player;
        for(const enemy of wildEnemies())inflictDamage(player,enemy,enemy.hp,false,false,true);
      }else if(specials.has(activeCast.id))releaseSpecial(player,activeCast.id);
      else if (utilities.has(activeCast.id)) utilityCast(activeCast.id,player);
      else if (activeCast.id==='seer') {
        game.amuletUntil=simulationTime+10000;
        player.stats=playerStats(game.pokemon.get(player.dex),game.progress,player.bonuses);
      } else if (activeCast.id==='gunpowder_core') blast(player);
      else if (activeCast.id==='hooh_brooch') launchFlare(player,activeCast.dir);
      player.dir=activeCast.dir;
      game.cast=null;
      if (player.hp && !(player.rockUntil>simulationTime) && player.state!=='Hurt') finishCastAnimation(player);
    }
  }
  // Una colisión puede crear espinas. Se acumulan aparte hasta el paso siguiente.
  const previousEffects = game.effects;
  game.effects = [];
  const survivingEffects = previousEffects.filter(visualEffect=>{
    const lifetimeFraction=Math.max(0,Math.min(1,(simulationTime-visualEffect.start)/visualEffect.ms));
    // Tras un impacto o interrupción, termina la secuencia visual sin volver a aplicar daño.
    if (visualEffect.finishedImpact || visualEffect.cancelled ||
        (visualEffect.owner??visualEffect.follow)?.interruptedAt>=visualEffect.start) return lifetimeFraction<1;
    if(visualEffect.chain && !visualEffect.chained && lifetimeFraction>=1/effectSheets.erupt.columns){
      visualEffect.chained=true;
      const chain=visualEffect.chain,[dx,dy]=DIR_VEC[chain.dir],length=Math.hypot(dx,dy);
      const dest={x:visualEffect.x+chain.step*dx/length,y:visualEffect.y+chain.step*dy/length};
      if(hasSight(visualEffect,dest))erupt(dest.x,dest.y,chain);
    }
    if(visualEffect.kind==='void_zone' && visualEffect.hit){
      const radius=visualEffect.radius*lifetimeFraction;
      visualEffect.diameter=Math.max(1,2*radius);
      for(const target of wildEnemies()){
        if(visualEffect.hit.has(target) || Math.hypot(target.x-visualEffect.x,target.y-visualEffect.y)>radius+bodyRadius(target))continue;
        visualEffect.hit.add(target);
        if(elementalHit(visualEffect.owner,target,visualEffect.owner.stats.attack,'dark'))knockback(visualEffect,target,visualEffect.radius);
      }
    }
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
      if(!hasSight({x:visualEffect.originX,y:visualEffect.originY},closestTarget??visualEffect)){
        if(visualEffect.relicShot){
          projectileImpact(visualEffect,visualEffect.originX+previousDistance*deltaX/directionLength,
            visualEffect.originY+previousDistance*deltaY/directionLength);
          return false;
        }
        visualEffect.finishedImpact=true;
        return lifetimeFraction<1;
      }
      if (closestTarget) {
        if(visualEffect.relicShot)projectileImpact(visualEffect,closestTarget.x,closestTarget.y);
        if(visualEffect.weapon && Math.random()<dodgeChance(closestTarget)){
          closestTarget.missUntil=simulationTime+750;playSound('miss');visualEffect.finishedImpact=true;return !visualEffect.relicShot && lifetimeFraction<1;
        }
        const critical=visualEffect.weapon && criticalHit(visualEffect.owner,closestTarget);
        const power=(visualEffect.weapon?damageFor(visualEffect.owner,closestTarget,critical):visualEffect.damage)*(1+actorRule(visualEffect.owner,'projectileBonus'));
        if(elementalHit(visualEffect.owner,closestTarget,power,visualEffect.element,!visualEffect.weapon,critical,visualEffect.relicShot) && visualEffect.weapon){
          knockback(visualEffect.owner,closestTarget,visualEffect.kind==='rock_throw'?20:10);
          if(visualEffect.kind==='rock_throw')playSound('rockImpact');
        }
        visualEffect.finishedImpact=true;
        return !visualEffect.relicShot && lifetimeFraction<1;
      }
      visualEffect.travel=travel;
    }
    return lifetimeFraction<1;
  });
  game.effects = survivingEffects.concat(game.effects);
}
