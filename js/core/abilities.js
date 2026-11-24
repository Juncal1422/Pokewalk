import { gameTime } from './clock.js';
import { game } from './state.js';
import { DIR_VEC, TILE } from './constants.js';
import { playerStats } from './benefits.js';
import { attackReach, damageFor } from './stats.js';
import { bodyRadius, canMove, inflictDamage, setState, showToast } from './entities.js';

const sheets = new Map();
const sequence = (id, count, path) => [id, Array.from({length:count}, (_,i) => path(i+1))];
export async function loadEffects() {
  const groups = [
    ['fang',['fang/fang.png']],
    ['spine',['spine/spine.png']],
    ...[['heal',13],['boost',15],['fangaround',12]].map(([name,count]) =>
      sequence(name,count,i=>name+'/'+String(i-1).padStart(3,'0')+'.png')),
    sequence('mine',9,i=>'mine/mine_'+i+'.png'),
    sequence('flare',12,i=>'flare/flare_'+i+'.png'),
    sequence('purple',38,i=>'purple_smite/purple_smite ('+i+').png'),
  ];
  await Promise.all(groups.map(async ([id,paths]) => {
    sheets.set(id, await Promise.all(paths.map(async path => {
      const img = new Image();
      img.src = new URL('../../assets/effects/'+path,import.meta.url).href;
      await img.decode();
      return img;
    })));
  }));
}

export function effect(kind,x,y,ms,dir=0) {
  const sprite = { kind,x,y,ms,dir,start:gameTime() };
  game.effects.push(sprite);
  return sprite;
}

export function pickupEffect(player,kind) {
  effect(kind,player.x,player.y,650).follow = player;
}

export function drawEffects(ctx, zoom, cx, cy) {
  const now = gameTime();
  for (const fx of game.effects) {
    const frames = sheets.get(fx.kind), progress = Math.min(1,(now-fx.start)/fx.ms);
    const img = frames[Math.max(0,Math.min(frames.length-1,Math.floor(progress*frames.length)))];
    const x = (fx.follow?.x ?? fx.x)*zoom-cx, y = (fx.follow?.y ?? fx.y)*zoom-cy;
    const scale = zoom*(fx.follow?.stats.size ?? 100)/100;
    if (fx.kind === 'spine') {
      drawFang(ctx,fx.dir,x,y,scale,1-progress,'spine','sepia(1) saturate(6) hue-rotate(65deg)');
      continue;
    }
    const w = img.width*scale, h = img.height*scale;
    ctx.save();
    if ((fx.owner ?? fx.follow)?.isPlayer && ['flare','fangaround','mine'].includes(fx.kind) && game.held.has('golden_spike'))
      ctx.filter = gold;
    ctx.drawImage(img,x-w/2,y-h*(fx.kind==='purple'?.95:.5),w,h);
    ctx.restore();
  }
}

// La hoja usa parejas abajo/arriba, izquierda/derecha y diagonales.
const gold = 'sepia(1) saturate(5)';
export function drawFang(ctx,dir,x,y,scale,opacity,kind='fang',filter='none') {
  const cell = [0,5,3,7,1,6,2,4][dir];
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.filter = filter;
  ctx.drawImage(sheets.get(kind)[0],cell%2*16,Math.floor(cell/2)*16,16,16,
    x-12*scale,y-12*scale,24*scale,24*scale);
  ctx.restore();
}

// Se paga con un único tipo entre los tres saldos más altos.
function cogCurrency() {
  const pool = Object.entries(game.essences).sort((a,b)=>b[1]-a[1]).slice(0,3).filter(([,n])=>n>=5);
  return pool.length ? pool[Math.floor(Math.random()*pool.length)][0] : null;
}

// Busca una casilla libre junto al punto inicial si un enemigo ocupa la entrada.
function landing(player) {
  const room = game.rooms[0], sites = [];
  const home = player.home ?? {x:(room.cx+.5)*TILE, y:(room.cy+.5)*TILE};
  game.grid.forEach((row,y)=>row.forEach((tile,x)=>{
    if (!tile) sites.push({ x:(x+.5)*TILE,y:(y+.5)*TILE,d:((x+.5)*TILE-home.x)**2+((y+.5)*TILE-home.y)**2 });
  }));
  return sites.sort((a,b)=>a.d-b.d).find(site=>canMove(player,site.x,site.y));
}

export function useActive(slot) {
  const p=game.player, now=gameTime();
  const id=[...game.held].find(key=>game.benefits.get(key).slot === slot);
  if (!id || !p.hp || game.changingLevel || game.cast || ['Attack','Hurt'].includes(p.state)) return;
  const benefit=game.benefits.get(id);
  if ((game.cooldowns[id]??0)>now) return showToast('Recarga: '+Math.ceil((game.cooldowns[id]-now)/1000)+' s');
  const currency = id==='cog' ? cogCurrency() : null;
  if (id==='cog' && (!currency || !landing(p))) return showToast('Necesitas 5 esencias del mismo tipo entre tus tres principales y una entrada libre.');
  if (id==='amulet') {
    if (p.hp <= 1) return showToast('Necesitas más de 1 PV');
    p.hp--;
  }
  const duration = benefit.amount*1000 * (game.held.has('heritage_water')?.9:1)
    * (game.inventory.has('boost_steroids')?.85:1);
  game.cooldownDurations[id]=duration;
  game.cooldowns[id]=now+duration;
  game.cast={id,start:now,dir:p.dir,hit:new Set(),currency};
  setState(p,id==='mamoswine_fang'?'Spin':'Charge');
  if (id==='cog') effect('purple',p.x,p.y,520);
  if (id==='mamoswine_fang') effect('fangaround',p.x,p.y,560).follow=p;
}

function launchFlare(owner, dir) {
  const shot = effect('flare',owner.x,owner.y,500,dir);
  const fiery = game.pokemon.get(owner.dex).types.includes('fire');
  Object.assign(shot,{owner,originX:owner.x,originY:owner.y,reach:4*attackReach(owner.stats),
    damage:Math.round(owner.stats.attack*(fiery?1.5:1))});
}

export function releaseSpines(owner) {
  for (let dir=0;dir<8;dir++) {
    const shot=effect('spine',owner.x,owner.y,300,dir);
    Object.assign(shot,{owner,originX:owner.x,originY:owner.y,reach:10,damage:Math.max(1,Math.round(owner.stats.defense*.1))});
  }
}

function blast(owner) {
  effect('mine',owner.x,owner.y,600).owner=owner;
  for (const target of game.entities) {
    if (!target.hp || (target!==owner && owner.isPlayer===target.isPlayer)) continue;
    if (Math.hypot(target.x-owner.x,target.y-owner.y)<=50+(target===owner?0:bodyRadius(target))) {
      inflictDamage(owner,target,damageFor(owner,target,false),false,true);
    }
  }
}

function spin(owner, cast, elapsed) {
  owner.dir = (cast.dir + Math.min(16,Math.floor(16*elapsed/560))) % 8;
  for (const target of game.entities) {
    if (target.isPlayer === owner.isPlayer || !target.hp || cast.hit.has(target)) continue;
    if (Math.hypot(target.x-owner.x,target.y-owner.y) > attackReach(owner.stats)+bodyRadius(target)) continue;
    cast.hit.add(target);
    inflictDamage(owner,target,owner.stats.attack,false,true);
  }
}

// El líder fija la dirección al anunciar la habilidad. Durante ese segundo
// el jugador puede apartarse del disparo o salir del radio del giro.
export function updateBossAbility(boss) {
  const id = boss.activeBenefit, player = game.player, now = gameTime();
  if (!id || !boss.hp || !player.hp) return false;
  const distance = Math.hypot(player.x-boss.x, player.y-boss.y);
  const range = (id==='gunpowder_rock'?50:attackReach(boss.stats)*(id==='fire_brooch'?4:1)) + bodyRadius(player);
  let cast = boss.abilityCast;
  if (!cast) {
    if (boss.bossResponse || boss.sidestep || now < (boss.abilityReadyAt ?? 0) || distance > range) return false;
    if (id==='cog' && Math.hypot(boss.x-boss.home.x,boss.y-boss.home.y)<TILE) return false;
    boss.dir = (Math.round(Math.atan2(player.x-boss.x,player.y-boss.y)/(Math.PI/4))+8)%8;
    boss.abilityCast = {start:now,dir:boss.dir,hit:new Set()};
    boss.path = [];
    setState(boss,'Charge');
    return true;
  }
  if (now-cast.start < 1000) return true;
  if (boss.state==='Charge') {
    if (distance > range) {
      boss.abilityReadyAt = now+1000;
    } else if (id==='mamoswine_fang') {
      setState(boss,'Spin');
      cast.spinStart=now;
      effect('fangaround',boss.x,boss.y,560).follow=boss;
    } else if (id==='fire_brooch') {
      launchFlare(boss,cast.dir);
    } else if (id==='gunpowder_rock') {
      blast(boss);
    } else if (id==='amulet' && boss.hp>1) {
      boss.hp--;
      boss.unbuffedStats={...boss.stats};
      for (const key of ['attack','speed','attackSpeed']) boss.stats[key]=Math.round(boss.stats[key]*1.5);
      boss.buffUntil=now+10000;
    } else if (id==='cog') {
      const site=landing(boss);
      if (site) {
        effect('purple',boss.x,boss.y,520);
        boss.x=site.x; boss.y=site.y;
        effect('purple',boss.x,boss.y,520);

      }
    }
  }
  if (boss.state==='Spin') {
    spin(boss,cast,now-cast.spinStart);
    if (now-cast.spinStart<560) return true;
  }
  if (!(boss.abilityReadyAt > now)) boss.abilityReadyAt=now+game.benefits.get(id).amount*1000;
  boss.abilityCast=null;
  boss.dir=cast.dir;
  if (boss.hp && boss.state!=='Hurt') setState(boss,'Idle');
  return true;
}

export function tickAbilities() {
  const now=gameTime(), p=game.player, cast=game.cast;
  if (game.amuletUntil && now>=game.amuletUntil) {
    game.amuletUntil=0;
    p.stats=playerStats(game.pokemon.get(p.dex),game.progress,p.bonuses);
  }
  for (const enemy of game.entities) if (enemy.buffUntil && now>=enemy.buffUntil) {
    enemy.stats=enemy.unbuffedStats;
    enemy.buffUntil=0;
  }
  if (cast && (!p.hp || p.state==='Hurt')) game.cast=null;
  else if (cast) {
    const elapsed=now-cast.start;
    if (cast.id==='mamoswine_fang') spin(p,cast,elapsed);
    if (elapsed >= (cast.id==='mamoswine_fang'?560:['amulet','gunpowder_rock'].includes(cast.id)?500:200)) {
      if (cast.id==='cog') {
        const site=landing(p);
        if (site && game.essences[cast.currency]>=5) {
          game.essences[cast.currency]-=5;
          p.x=site.x; p.y=site.y;
          effect('purple',p.x,p.y,520);
        }
      } else if (cast.id==='amulet') {
        game.amuletUntil=now+10000;
        p.stats=playerStats(game.pokemon.get(p.dex),game.progress,p.bonuses);
      } else if (cast.id==='gunpowder_rock') blast(p);
      else if (cast.id==='fire_brooch') launchFlare(p,cast.dir);
      p.dir=cast.dir;
      game.cast=null;
      if (p.hp && p.state!=='Hurt') setState(p,'Idle');
    }
  }
  game.effects=game.effects.filter(fx=>{
    const t=Math.max(0,Math.min(1,(now-fx.start)/fx.ms));
    if (fx.kind==='flare' || fx.kind==='spine') {
      const [dx,dy]=DIR_VEC[fx.dir], norm=Math.hypot(dx,dy);
      const travel=fx.reach*t, prev=fx.travel??0;
      fx.x=fx.originX+dx/norm*travel;fx.y=fx.originY+dy/norm*travel;
      // Colisión continua del proyectil aunque un fotograma tarde en llegar.
      let first, nearest=Infinity;
      for (const enemy of game.entities) {
        if (enemy.isPlayer === fx.owner.isPlayer || !enemy.hp) continue;
        const x=enemy.x-fx.originX,y=enemy.y-fx.originY,along=(x*dx+y*dy)/norm;
        const pos=Math.max(prev,Math.min(travel,along));
        if (Math.hypot(x-pos*dx/norm,y-pos*dy/norm)<=10+bodyRadius(enemy) && along<nearest) {
          first=enemy;nearest=along;
        }
      }
      if (first) { inflictDamage(fx.owner,first,fx.damage,false,true);return false; }
      fx.travel=travel;
    }
    return t<1;
  });
}
