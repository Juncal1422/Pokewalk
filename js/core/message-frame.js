// Las esquinas conservan su forma; los cuatro bordes se estiran entre ellas.
export function drawFrame(drawingContext, image, x, y, width, height, opacity = .82) {
  const cornerSize = Math.min(6, width / 3, height / 3);
  const columnEdges = [x, x + cornerSize, x + width - cornerSize, x + width];
  const rowEdges = [y, y + cornerSize, y + height - cornerSize, y + height];
  drawingContext.fillStyle = 'rgba(12,20,34,'+opacity+')';
  drawingContext.fillRect(x + cornerSize, y + cornerSize, width - 2*cornerSize, height - 2*cornerSize);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      if (row === 1 && column === 1) continue;
      drawingContext.drawImage(image, column * 16, row * 16, 16, 16, columnEdges[column], rowEdges[row],
        columnEdges[column + 1] - columnEdges[column], rowEdges[row + 1] - rowEdges[row]);
    }
  }
}

// Sitúa una ficha flotante junto al cursor (o al control enfocado). Invierte el lado al tocar un borde.
export function positionTooltip(tip, event, anchor) {
  const keyboardFocus = event.type === 'focus';
  const anchorBox = keyboardFocus && anchor.getBoundingClientRect();
  const x = keyboardFocus ? anchorBox.right : event.clientX;
  const y = keyboardFocus ? anchorBox.bottom : event.clientY;
  const {width, height} = tip.getBoundingClientRect();
  const zoom = tip.currentCSSZoom || width / tip.offsetWidth || 1;
  const left = x + width + 14 <= innerWidth ? x + 12 : x - width - 12;
  const top = y + height + 14 <= innerHeight ? y + 12 : y - height - 12;
  tip.style.left = Math.max(2,left) / zoom + 'px';
  tip.style.top = Math.max(2,top) / zoom + 'px';
}
