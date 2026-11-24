// Las esquinas conservan su forma; los cuatro bordes se estiran entre ellas.
export function drawFrame(drawingContext, image, x, y, width, height, opacity = .82) {
  const cornerSize = Math.min(6, width / 3, height / 3);
  const columnEdges = [x, x + cornerSize, x + width - cornerSize, x + width];
  const rowEdges = [y, y + cornerSize, y + height - cornerSize, y + height];
  drawingContext.fillStyle = 'rgba(12,20,34,'+opacity+')';
  drawingContext.fillRect(x + cornerSize / 2, y + cornerSize / 2, width - cornerSize, height - cornerSize);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      if (row === 1 && column === 1) continue;
      drawingContext.drawImage(image, column * 16, row * 16, 16, 16, columnEdges[column], rowEdges[row],
        columnEdges[column + 1] - columnEdges[column], rowEdges[row + 1] - rowEdges[row]);
    }
  }
}
