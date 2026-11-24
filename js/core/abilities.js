import { game } from './state.js';
import { DIR_VEC, TILE } from './constants.js';
import { attackReach } from './stats.js';
import { canMove, inflictDamage, setState, showToast } from './entities.js';

const sheets = new Map();
const sequence = (id, count, path) => [id, Array.from({length:count}, (_,i) => path(i+1))];
export async function loadEffects() {
  const groups = [
    ['fang',['fang/fang.png']],
    sequence('circle',8,i=>'circle_cut/circle_cut ('+i+').png'),
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
  const sprite = { kind,x,y,ms,dir,start:performance.now() };
  game.effects.push(sprite);
  return sprite;
}

export function drawEffects(ctx, zoom, cx, cy) {
  const now = performance.now();
  for (const fx of game.effects) {
    const frames = sheets.get(fx.kind), progress = Math.min(1,(now-fx.start)/fx.ms);
    const img = frames[Math.max(0,Math.min(frames.length-1,Math.floor(progress*frames.length)))];
    const x = fx.x*zoom-cx, y = fx.y*zoom-cy;
    if (fx.kind === 'fang') {
      // El atlas agrupa abajo/arriba, izquierda/derecha y las diagonales.
      const cell=[0,5,3,7,1,6,2,4][fx.dir];
      ctx.drawImage(img,(cell%2)*16,Math.floor(cell/2)*16,16,16,x-12*zoom,y-12*zoom,24*zoom,24*zoom);
    } else {
      const w = img.width*zoom, h = img.height*zoom;
      ctx.drawImage(img,x-w/2,y-h*(fx.kind==='purple'?.95:.5),w,h);
    }
  }
}

function spendFive() {
  const balances = game.essences;
  let total = Object.values(balances).reduce((a,b)=>a+b,0);
  if (total < 5) return false;
  for (let i=0;i<5;i++) {
    let roll = Math.floor(Math.random()*total--);
    for (const type of Object.keys(balances)) {
      roll -= balances[type];
      if (roll < 0) { balances[type]--; break; }
    }
  }
  return true;
}

// Busca una casilla libre junto al punto inicial si un enemigo ocupa la entrada.
function landing(player) {
  const room = game.rooms[0], sites = [];
  game.grid.forEach((row,y)=>row.forEach((tile,x)=>{
    if (!tile) sites.push({ x:(x+.5)*TILE,y:(y+.5)*TILE,d:(x-room.cx)**2+(y-room.cy)**2 });
  }));
  return sites.sort((a,b)=>a.d-b.d).find(site=>canMove(player,site.x,site.y));
}

export function useActive() {
  const p=game.player, now=performance.now();
  const id=[...game.held].find(key=>game.benefits.get(key).active);
  if (!id || !p.hp || game.changingLevel || game.cast || ['Attack','Hurt'].includes(p.state)) return;
  const benefit=game.benefits.get(id);
  if ((game.cooldowns[id]??0)>now) return showToast('Recarga: '+Math.ceil((game.cooldowns[id]-now)/1000)+' s');
  if (id==='cog') {
    if (game.mission.usedCog) return showToast('Engranaje usado en esta misión');
    if (!landing(p)) return;
    if (Object.values(game.essences).reduce((a,b)=>a+b,0) < 5) return showToast('Necesitas 5 esencias');
    effect('purple',p.x,p.y,520);
  } else game.cooldowns[id]=now+benefit.amount*1000;
  game.cast={id,start:now,dir:p.dir,hit:new Set()};
  setState(p,id==='mamoswine_fang'?'Spin':'Charge');
  if (id==='mamoswine_fang') effect('circle',p.x,p.y,560);
}

export function tickAbilities() {
  const now=performance.now(), p=game.player, cast=game.cast;
  if (cast && (!p.hp || p.state==='Hurt')) game.cast=null;
  else if (cast) {
    const elapsed=now-cast.start;
    if (cast.id==='mamoswine_fang') {
      p.dir=(cast.dir+Math.min(16,Math.floor(16*elapsed/560)))%8;
      for (const enemy of game.entities) {
        if (!enemy.isPlayer && enemy.hp && !cast.hit.has(enemy) && Math.hypot(enemy.x-p.x,enemy.y-p.y)<=attackReach(p.stats)) {
          cast.hit.add(enemy);
          inflictDamage(p,enemy,p.stats.attack);
        }
      }
    }
    if (elapsed >= (cast.id==='mamoswine_fang'?560:200)) {
      if (cast.id==='cog') {
        const site=landing(p);
        if (site && spendFive()) {
          game.mission.usedCog=true;
          p.x=site.x; p.y=site.y;
          effect('purple',p.x,p.y,520);
        }
      } else if (cast.id==='fire_brooch') {
        const shot=effect('flare',p.x,p.y,500,cast.dir);
        Object.assign(shot,{originX:p.x,originY:p.y,reach:4*attackReach(p.stats),
          damage:Math.round(p.stats.attack*(game.pokemon.get(p.dex).types.includes('fire')?1.5:1))});
      }
      p.dir=cast.dir;
      game.cast=null;
      setState(p,'Idle');
    }
  }
  game.effects=game.effects.filter(fx=>{
    const t=Math.max(0,Math.min(1,(now-fx.start)/fx.ms));
    if (fx.kind==='flare') {
      const [dx,dy]=DIR_VEC[fx.dir], norm=Math.hypot(dx,dy);
      const travel=fx.reach*t, prev=fx.travel??0;
      fx.x=fx.originX+dx/norm*travel;fx.y=fx.originY+dy/norm*travel;
      // Colisión continua del proyectil aunque un fotograma tarde en llegar.
      let first, nearest=Infinity;
      for (const enemy of game.entities) {
        if (enemy.isPlayer || !enemy.hp) continue;
        const x=enemy.x-fx.originX,y=enemy.y-fx.originY,along=(x*dx+y*dy)/norm;
        const pos=Math.max(prev,Math.min(travel,along));
        if (Math.hypot(x-pos*dx/norm,y-pos*dy/norm)<=10+Math.min(11,7.8*enemy.stats.size/100) && along<nearest) {
          first=enemy;nearest=along;
        }
      }
      if (first) { inflictDamage(p,first,fx.damage);return false; }
      fx.travel=travel;
    }
    return t<1;
  });
}
