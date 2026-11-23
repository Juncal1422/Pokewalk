// Las esquinas conservan su forma; los cuatro bordes se estiran entre ellas.
export function drawFrame(ctx, image, x, y, width, height) {
  const cap = Math.min(6, width / 3, height / 3);
  const cols = [x, x + cap, x + width - cap, x + width];
  const rows = [y, y + cap, y + height - cap, y + height];
  ctx.fillStyle = 'rgba(12,20,34,.82)';
  ctx.fillRect(x + cap / 2, y + cap / 2, width - cap, height - cap);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      ctx.drawImage(image, col * 16, row * 16, 16, 16, cols[col], rows[row],
        cols[col + 1] - cols[col], rows[row + 1] - rows[row]);
    }
  }
}
