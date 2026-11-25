import { gameTime } from './clock.js';
import { game } from './state.js';

const lifetimeMs = 950;
const noticeColors = { EXP: '#8edfff', HP: '#79ed8e' };

// Guarda una copia de la posición del suceso. Los avisos cercanos que nacen
// juntos ocupan líneas distintas y conservan su línea hasta desaparecer.
export function showWorldNotice(source, quantity, unit) {
  if (quantity <= 0) return;
  const startedAt = gameTime();
  const occupiedLines = new Set(game.worldNotices.filter(notice =>
    startedAt - notice.startedAt < lifetimeMs && Math.hypot(source.x-notice.worldX, source.y-notice.worldY)<12
  ).map(notice => notice.line));
  let line = 0;
  // Reutiliza la primera línea libre aunque siga visible un aviso más alto.
  while (occupiedLines.has(line)) line++;
  game.worldNotices.push({
    worldX: source.x, worldY: source.y,
    heightOffset: 12 * source.stats.size / 100, startedAt, line, text: '+' + quantity + ' ' + unit, color: noticeColors[unit],
  });
}

// Proyecta el origen con la cámara actual y anima únicamente el ascenso.
// La capa se dibuja después de los efectos, fuera del filtro y del alfa del sprite.
export function drawWorldNotices(context, renderZoom, cameraX, cameraY) {
  const simulationTime = gameTime();
  game.worldNotices = game.worldNotices.filter(notice => simulationTime - notice.startedAt < lifetimeMs);
  context.save();
  context.textAlign = 'center';
  context.font = 'bold 12px Wondermail';
  context.lineWidth = 2;
  context.strokeStyle = '#123';
  for (const notice of game.worldNotices) {
    const screenX = notice.worldX * renderZoom - cameraX;
    const screenY = (notice.worldY - notice.heightOffset) * renderZoom - cameraY - 12 - (simulationTime-notice.startedAt)/48 - notice.line*14;
    context.fillStyle = notice.color;
    context.strokeText(notice.text, screenX, screenY);
    context.fillText(notice.text, screenX, screenY);
  }
  context.restore();
}
