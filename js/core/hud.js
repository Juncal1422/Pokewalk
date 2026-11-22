import { game } from './state.js';
import { labels } from './stats.js';

const icons = {};
export async function loadHud() {
  await Promise.all(['hp', 'hpbar', ...Object.keys(labels)].map(async key => {
    const image = new Image();
    image.src = new URL('../../assets/ui/' + key + '.png', import.meta.url).href;
    await image.decode();
    icons[key] = image;
  }));
}

// El marco depende solo del máximo. Cada punto ocupa su propia celda de 16 px.
export function healthBar(ctx, entity, x, y, cell) {
  const max = entity.stats.hpMax;
  for (let i = 0; i < max + 2; i++) {
    const frame = i === 0 ? 0 : i === max + 1 ? 2 : 1;
    const left = x + i * cell;
    ctx.drawImage(icons.hpbar, frame * 16, 0, 16, 16, left, y, cell, cell);
    if (i > 0 && i <= entity.hp) ctx.drawImage(icons.hp, left, y, cell, cell);
  }
}

export function drawHud(ctx, canvas, player) {
  const cell = Math.max(1, Math.min(24, Math.floor((canvas.width - 16) / (player.stats.hpMax + 2))));
  healthBar(ctx, player, 8, 8, cell);
  const line = Math.min(26, Math.max(12, Math.floor((canvas.height - cell - 20) / 7)));
  let y = canvas.height - line * 7 - 6;
  ctx.font = 'bold 15px system-ui';
  ctx.textBaseline = 'middle';
  for (const key of Object.keys(labels)) {
    ctx.fillStyle = 'rgba(10,16,26,.85)';
    ctx.fillRect(8, y, 52, line - 1);
    ctx.drawImage(icons[key], 10, y, line - 2, line - 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(player.stats[key], 14 + line, y + line / 2);
    y += line;
  }
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const counter = 'Aventura ' + game.adventure;
  const width = Math.ceil(ctx.measureText(counter).width);
  ctx.fillStyle = 'rgba(10,16,26,.85)';
  ctx.fillRect(canvas.width - width - 20, 8, width + 12, 23);
  ctx.fillStyle = '#fff';
  ctx.fillText(counter, canvas.width - 14, 12);
  ctx.restore();
}
