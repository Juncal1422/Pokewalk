import { game } from './state.js';
import { labels } from './stats.js';

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
  const now = performance.now();
  game.pickups = game.pickups.filter(note => now - note.time < 1500);
  const baseWidth = Math.min(110, canvas.width * 0.22);
  const length = baseWidth * Math.min(2, player.stats.hpMax / game.initialHP);
  const fraction = player.hp / player.stats.hpMax;
  // El hueco del PNG ocupa las filas 10–13. Las tapas mantienen su
  // proporción y el tramo central absorbe el crecimiento de los PV máximos.
  const scale = 1.5, cap = Math.min(16 * scale, length / 3);
  const left = 8, top = 2, bar = icons.hpbar;
  const inset = cap * 10 / 16, innerWidth = length - inset * 2;
  ctx.fillStyle = '#15202b';
  ctx.fillRect(left + inset, top + 10 * scale, innerWidth, 4 * scale);
  ctx.fillStyle = fraction < .25 ? '#ef5350' : fraction < .5 ? '#ffd54f' : '#66cf77';
  ctx.fillRect(left + inset, top + 10 * scale, innerWidth * fraction, 4 * scale);
  const widths = [cap, length - 2 * cap, cap];
  let cursor = left;
  for (let part = 0; part < 3; part++) {
    ctx.drawImage(bar, part * 16, 0, 16, 16, cursor, top, widths[part], 16 * scale);
    cursor += widths[part];
  }
  ctx.font = 'bold 13px system-ui';
  ctx.textBaseline = 'middle';
  const health = player.hp + '/' + player.stats.hpMax;
  textBox(ctx, cursor, 5, ctx.measureText(health).width + 14, 24);
  ctx.fillStyle = '#fff';
  ctx.fillText(health, cursor + 7, 17);
  indicators(ctx, 'hp', cursor + 7, 35, now);
  let index = 0;
  const columns = Math.max(1, Math.min(5, Math.floor(canvas.width / 80)));
  const entries = Object.entries(game.essences);
  if (entries.length) textBox(ctx, 4, 39, Math.min(columns, entries.length) * 48 + 9, Math.ceil(entries.length / columns) * 19 + 10);
  for (const [id, count] of entries) {
    const x = 8 + (index % columns) * 48, y = 43 + Math.floor(index / columns) * 19;
    ctx.drawImage(icons['essence-' + id], x, y, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(count, x + 18, y + 8);
    index++;
  }
  let y = canvas.height - 19 * Object.keys(labels).length - 6;
  textBox(ctx, 4, y - 6, 185, canvas.height - y + 5);
  for (const [key, label] of Object.entries(labels)) {
    ctx.fillStyle = '#fff';
    ctx.fillText(label + ' ' + player.stats[key], 12, y + 9);
    indicators(ctx, key, 182, y + 9, now);
    y += 19;
  }
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const m = game.mission;
  const counter = 'Aventura ' + game.adventure + ' · Piso ' + game.floor + '/' + m.floors;
  const goal = m.type === 'hunt' ? 'Caza: ' + game.pokemon.get(m.target).name + ' ' + m.kills + '/' + m.quota :
    m.type === 'retrieve' && m.recovered ? 'Objeto recuperado' : m.name;
  const width = Math.ceil(Math.max(ctx.measureText(counter).width, ctx.measureText(goal).width));
  textBox(ctx, canvas.width - width - 24, 5, width + 20, 49);
  ctx.fillStyle = '#fff';
  ctx.fillText(counter, canvas.width - 14, 12);
  ctx.fillText(goal, canvas.width - 14, 32);
  ctx.restore();
}
