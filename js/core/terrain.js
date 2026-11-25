import { assetUrl } from './asset-url.js';
import { TILE } from './constants.js';
import { game } from './state.js';

let wallShapes;

// Agrupa tramos negros idénticos de filas contiguas. La colisión conserva
// cada píxel del patrón sin recorrer la imagen en cada paso del Pokémon.
export function readWallShapes(pixels, width, height) {
  const size = width / 7;
  if (!Number.isInteger(size) || size < 3 || height !== size * 9) throw new Error('Máscara skeleton-blob inválida');
  const scale = TILE / size;
  return Array.from({ length: 47 }, (_, index) => {
    const tileOriginX = index % 7 * size, tileOriginY = Math.floor(index / 7) * size;
    const boxes = [];
    let previous = new Map();
    // Lee un píxel de la máscara prolongando su interior hasta el borde de la celda.
    function solid(x, y) {
      // El verde delimita las celdas del atlas. Prolongamos hasta ese borde
      // el negro o blanco interior para que no haya ranuras entre muros.
      const sampleX = tileOriginX + Math.max(1, Math.min(size - 2, x));
      const sampleY = tileOriginY + Math.max(1, Math.min(size - 2, y));
      const pixelOffset = (sampleY * width + sampleX) * 4;
      return pixels[pixelOffset + 3] > 0 && pixels[pixelOffset] === 0 && pixels[pixelOffset + 1] === 0 && pixels[pixelOffset + 2] === 0;
    }
    for (let y = 0; y < size; y++) {
      const current = new Map();
      for (let x = 0; x < size;) {
        if (!solid(x, y)) { x++; continue; }
        const start = x;
        while (x < size && solid(x, y)) x++;
        // Codifica los dos extremos; sólo tramos con idéntica anchura y origen se fusionan verticalmente.
        const key = start * (size + 1) + x;
        let solidRectangle = previous.get(key);
        if (!solidRectangle) {
          solidRectangle = { left: start * scale, right: x * scale, top: y * scale };
          boxes.push(solidRectangle);
        }
        solidRectangle.bottom = (y + 1) * scale;
        current.set(key, solidRectangle);
      }
      previous = current;
    }
    return boxes;
  });
}

// Decodifica la máscara de referencia y conserva las formas de colisión comunes a los biomas.
export async function loadTerrain() {
  if (wallShapes) return;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = assetUrl('../../tiled/tilesets/skeleton-blob.png', import.meta.url).href;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const drawingContext = canvas.getContext('2d');
  drawingContext.drawImage(image, 0, 0);
  wallShapes = readWallShapes(drawingContext.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  console.debug('[Terreno] Máscaras de colisión preparadas', wallShapes.length);
}

// Los medios abiertos dejan ver al otro lado. En muros probamos el segmento
// sobre la misma máscara que se usa para mover cuerpos, también en la arena.
export function hasSight(observer,target) {
  const dx=target.x-observer.x, dy=target.y-observer.y;
  const steps=Math.ceil(Math.hypot(dx,dy));
  for (let step=1; step<=steps; step++)
    if (!groundFree(observer.x+dx*step/steps,observer.y+dy*step/steps,.01,true)) return false;
  return true;
}

// Distancia entre un cuerpo circular y las partes sólidas del autotile.
// Las variantes decorativas comparten el índice base de la casilla.
export function groundFree(x, y, radius, crosses = false) {
  const right = game.grid[0].length - 1, bottom = game.grid.length - 1;
  if (x - radius < TILE || y - radius < TILE || x + radius > right * TILE || y + radius > bottom * TILE) return false;
  for (let tileRow = Math.floor((y - radius) / TILE); tileRow <= Math.floor((y + radius) / TILE); tileRow++) {
    for (let tileColumn = Math.floor((x - radius) / TILE); tileColumn <= Math.floor((x + radius) / TILE); tileColumn++) {
      if (game.grid[tileRow][tileColumn] === 0 || (crosses && game.grid[tileRow][tileColumn] === 2)) continue;
      const localX = x - tileColumn * TILE, localY = y - tileRow * TILE;
      for (const solidRectangle of wallShapes[game.autotileGrid[tileRow][tileColumn].index]) {
        const deltaX = Math.max(solidRectangle.left - localX, 0, localX - solidRectangle.right);
        const deltaY = Math.max(solidRectangle.top - localY, 0, localY - solidRectangle.bottom);
        if (deltaX * deltaX + deltaY * deltaY < radius * radius) return false;
      }
    }
  }
  return true;
}
