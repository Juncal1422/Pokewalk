import { game } from './state.js';
import { labels } from './stats.js';

const icons = {};
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const formatValue = n => n >= 1000 ? compact.format(n) : String(n);
const essenceNames = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon'.split(' ');
export async function loadHud() {
  // Los iconos se decodifican antes del primer fotograma.
  console.debug('[HUD] Cargando interfaz y esencias');
  await Promise.all(['hp', 'hpbar', ...Object.keys(labels), ...essenceNames.map(id => 'essence-' + id)].map(async key => {
    const image = new Image();
    image.src = new URL('../../assets/ui/' + key + '.png', import.meta.url).href;
    await image.decode();
    icons[key] = image;
  }));
}

// El marco depende solo del máximo. Cada punto ocupa su propia celda de 16 px.
export function healthBar(ctx, entity, x, y, cell) {
  // Agrupar segmentos evita dibujar millones de sprites en aventuras avanzadas.
  const max = Math.min(entity.stats.hpMax, 24);
  const filled = Math.ceil(entity.hp / entity.stats.hpMax * max);
  for (let i = 0; i < max + 2; i++) {
    const frame = i === 0 ? 0 : i === max + 1 ? 2 : 1;
    const left = x + i * cell;
    ctx.drawImage(icons.hpbar, frame * 16, 0, 16, 16, left, y, cell, cell);
    if (i > 0 && i <= filled) ctx.drawImage(icons.hp, left, y, cell, cell);
  }
}

export function drawHud(ctx, canvas, player) {
  const cell = Math.max(1, Math.min(24, Math.floor((canvas.width - 16) / (Math.min(24, player.stats.hpMax) + 2))));
  healthBar(ctx, player, 8, 8, cell);
  ctx.font = 'bold 12px system-ui';
  ctx.textBaseline = 'middle';
  let index = 0;
  const columns = Math.max(1, Math.min(5, Math.floor(canvas.width / 80)));
  for (const [id, count] of Object.entries(game.essences)) {
    const x = 8 + (index % columns) * 48, y = 12 + cell + Math.floor(index / columns) * 19;
    ctx.drawImage(icons['essence-' + id], x, y, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(count, x + 18, y + 8);
    index++;
  }
  const line = Math.min(26, Math.max(12, Math.floor((canvas.height - cell - 20) / 7)));
  let y = canvas.height - line * 7 - 6;
  ctx.font = 'bold 15px system-ui';
  ctx.textBaseline = 'middle';
  for (const key of Object.keys(labels)) {
    ctx.fillStyle = 'rgba(10,16,26,.85)';
    ctx.fillRect(8, y, 52, line - 1);
    ctx.drawImage(icons[key], 10, y, line - 2, line - 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(formatValue(player.stats[key]), 14 + line, y + line / 2);
    y += line;
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
  if (player.stats.hpMax > 24) {
    ctx.save();
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(formatValue(player.hp) + ' / ' + formatValue(player.stats.hpMax), 8 + 13 * cell, 8 + cell / 2);
    ctx.restore();
  }
}
