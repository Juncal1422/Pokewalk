import { game } from './state.js';
import { labels } from './stats.js';

const icons = {};
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const formatValue = n => n >= 1000 ? compact.format(n) : String(n);
const essenceNames = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel'.split(' ');
export async function loadHud() {
  // Los iconos se decodifican antes del primer fotograma.
  console.debug('[HUD] Cargando interfaz y esencias');
  await Promise.all(essenceNames.map(id => 'essence-' + id).map(async key => {
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
  ctx.fillStyle = '#15202b';
  ctx.fillRect(8, 9, length + 4, 16);
  ctx.fillStyle = fraction < 0.25 ? '#ef5350' : fraction < 0.5 ? '#ffd54f' : '#66cf77';
  ctx.fillRect(10, 11, length * fraction, 12);
  ctx.font = 'bold 13px system-ui';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(player.hp + '/' + player.stats.hpMax, 18 + length, 17);
  indicators(ctx, 'hp', 18 + length, 33, now);
  let index = 0;
  const columns = Math.max(1, Math.min(5, Math.floor(canvas.width / 80)));
  for (const [id, count] of Object.entries(game.essences)) {
    const x = 8 + (index % columns) * 48, y = 40 + Math.floor(index / columns) * 19;
    ctx.drawImage(icons['essence-' + id], x, y, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(count, x + 18, y + 8);
    index++;
  }
  let y = canvas.height - 19 * Object.keys(labels).length - 6;
  for (const [key, label] of Object.entries(labels)) {
    ctx.fillStyle = '#101924dc';
    ctx.fillRect(8, y, 170, 18);
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
  ctx.fillStyle = 'rgba(10,16,26,.85)';
  ctx.fillRect(canvas.width - width - 20, 8, width + 12, 43);
  ctx.fillStyle = '#fff';
  ctx.fillText(counter, canvas.width - 14, 12);
  ctx.fillText(goal, canvas.width - 14, 32);
  ctx.restore();
}
