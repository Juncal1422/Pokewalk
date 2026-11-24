import { experienceCost } from './experience.js';
import { gameTime } from './clock.js';
import { game } from './state.js';
import { labels, statsFor } from './stats.js';

import { drawFrame } from './message-frame.js';

const icons = {};
export const essenceIcon = id => icons['essence-' + id];
export const textBox = (ctx,x,y,w,h) => drawFrame(ctx,icons['textbox-b'],x,y,w,h);
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const formatValue = n => n >= 1000 ? compact.format(n) : String(n);
const essenceNames = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel'.split(' ');
export async function loadHud() {
  // Los iconos se decodifican antes del primer fotograma.
  console.debug('[HUD] Cargando interfaz y esencias');
  await Promise.all([...essenceNames.map(id => 'essence-' + id), 'textbox-b', 'hpbar'].map(async key => {
    const image = new Image();
    image.src = new URL('../../assets/ui/' + key + '.png', import.meta.url).href;
    await image.decode();
    icons[key] = image;
  }));
}

// Un indicador por recogida permite ver dos efectos consecutivos del mismo atributo.
function indicators(ctx,key,x,y,now) {
  ctx.save();
  ctx.textBaseline = 'middle';
  for (const note of game.pickups.filter(entry => entry.key === key)) {
    ctx.globalAlpha = Math.min(1, (1500 - (now-note.time)) / 800);
    ctx.fillStyle = (key === 'size' ? note.delta < 0 : note.delta > 0) ? '#79ed8e' : '#ff7474';
    const text = (note.delta > 0 ? '+' : '') + formatValue(note.delta);
    ctx.fillText(text,x,y); x += ctx.measureText(text).width + 6;
  }
  ctx.restore();
}

export function drawHud(ctx, canvas, player) {
  const now = gameTime();
  game.pickups = game.pickups.filter(note => now - note.time < 1500);
  const baseWidth = Math.min(144, canvas.width * 0.22);
  const length = baseWidth * Math.min(2, player.stats.hpMax / game.initialHP);
  const fraction = player.hp / player.stats.hpMax;
  // Los anchos del hueco siguen las seis filas interiores del nuevo marco.
  const scale = 2, cap = Math.min(16 * scale, length / 3);
  const left = 8, top = 2, bar = icons.hpbar;
  const end = left + cap/2 + fraction*(length-cap);
  [14,12,9,8,9,12].forEach((edge,i) => {
    const inset = edge*cap/16, x=left+inset, y=top+(8+i)*scale, w=length-2*inset;
    ctx.fillStyle = '#15202b';
    ctx.fillRect(x,y,w,scale);
    ctx.fillStyle = fraction < .25 ? '#ef5350' : fraction < .5 ? '#ffd54f' : '#66cf77';
    ctx.fillRect(x,y,Math.max(0,Math.min(w,end-x)),scale);
  });
  const widths = [cap, length - 2 * cap, cap];
  let cursor = left;
  for (let part = 0; part < 3; part++) {
    ctx.drawImage(bar, part * 16, 0, 16, 16, cursor, top, widths[part], 16 * scale);
    cursor += widths[part];
  }
  ctx.font = 'bold 17px system-ui';
  ctx.textBaseline = 'middle';
  const health = player.hp + '/' + player.stats.hpMax;
  textBox(ctx, cursor, 5, ctx.measureText(health).width + 18, 32);
  ctx.fillStyle = '#fff';
  ctx.fillText(health, cursor + 9, 21);
  indicators(ctx, 'hp', cursor + 9, 43, now);
  let index = 0;
  const columns = Math.max(1, Math.min(5, Math.floor(canvas.width / 146)));
  const essenceTop = canvas.width < 580 ? 109 : 48;
  const entries = Object.entries(game.essences);
  if (entries.length) textBox(ctx, 4, essenceTop, Math.min(columns, entries.length) * 80 + 9, Math.ceil(entries.length / columns) * 40 + 10);
  for (const [id, count] of entries) {
    const x = 8 + (index % columns) * 80, y = essenceTop + 4 + Math.floor(index / columns) * 40;
    ctx.drawImage(icons['essence-' + id], x, y, 38.4, 38.4);
    ctx.fillStyle = '#fff';
    ctx.fillText(formatValue(count), x + 40, y + 20);
    index++;
  }
  ctx.font = 'bold 13px system-ui';
  let y = canvas.height - 19 * Object.keys(labels).length - 6;
  drawFrame(ctx, icons['textbox-b'], 4, y - 25, 185, canvas.height - y + 25, .25);
  ctx.fillStyle = '#fff';
  ctx.fillText('Nv. '+player.level+' · '+(game.progress<100 ? game.xp+'/'+experienceCost(game.progress)+' EXP' : 'MÁX'),12,y-10);
  // Comparamos con los mismos objetos y nivel, antes de aplicar los beneficios.
  const baseStats = statsFor(game.pokemon.get(player.dex), game.progress, player.bonuses);
  for (const [key, label] of Object.entries(labels)) {
    const delta = (player.stats[key] - baseStats[key]) * (key === 'size' ? -1 : 1);
    ctx.fillStyle = delta > 0 ? '#79ed8e' : delta < 0 ? '#ff7474' : '#fff';
    ctx.fillText(label + ' ' + player.stats[key], 12, y + 9);
    indicators(ctx, key, 182, y + 9, now);
    y += 19;
  }
  ctx.save();
  ctx.font = 'bold 17px system-ui';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const m = game.mission;
  const counter = 'Aventura ' + game.adventure + ' · Piso ' + game.floor + '/' + m.floors;
  const goal = m.type === 'hunt' ? 'Caza: ' + game.pokemon.get(m.target).name + ' ' + m.kills + '/' + m.quota :
    m.type === 'retrieve' && m.recovered ? 'Objeto recuperado' : m.name;
  const width = Math.ceil(Math.max(ctx.measureText(counter).width, ctx.measureText(goal).width));
  const panelTop = canvas.width < 580 ? 46 : 5;
  textBox(ctx, canvas.width - width - 27, panelTop, width + 22, 59);
  ctx.fillStyle = '#fff';
  ctx.fillText(counter, canvas.width - 15, panelTop + 8);
  ctx.fillText(goal, canvas.width - 15, panelTop + 31);
  ctx.restore();
}
