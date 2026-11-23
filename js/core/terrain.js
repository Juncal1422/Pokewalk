import { TILE } from './constants.js';
import { game } from './state.js';

let shapes;

// Agrupa tramos negros idénticos de filas contiguas. La colisión conserva
// cada píxel del patrón sin recorrer la imagen en cada paso del Pokémon.
export function readWallShapes(pixels, width, height) {
  const size = width / 7;
  if (!Number.isInteger(size) || size < 3 || height !== size * 9) throw new Error('Máscara skeleton-blob inválida');
  const scale = TILE / size;
  return Array.from({ length: 47 }, (_, index) => {
    const ox = index % 7 * size, oy = Math.floor(index / 7) * size;
    const boxes = [];
    let previous = new Map();
    function solid(x, y) {
      // El verde delimita las celdas del atlas. Prolongamos hasta ese borde
      // el negro o blanco interior para que no haya ranuras entre muros.
      const px = ox + Math.max(1, Math.min(size - 2, x));
      const py = oy + Math.max(1, Math.min(size - 2, y));
      const i = (py * width + px) * 4;
      return pixels[i + 3] > 0 && pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0;
    }
    for (let y = 0; y < size; y++) {
      const current = new Map();
      for (let x = 0; x < size;) {
        if (!solid(x, y)) { x++; continue; }
        const start = x;
        while (x < size && solid(x, y)) x++;
        const key = start * (size + 1) + x;
        let rect = previous.get(key);
        if (!rect) {
          rect = { left: start * scale, right: x * scale, top: y * scale };
          boxes.push(rect);
        }
        rect.bottom = (y + 1) * scale;
        current.set(key, rect);
      }
      previous = current;
    }
    return boxes;
  });
}

export async function loadTerrain() {
  if (shapes) return;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = new URL('../../tiled/tilesets/skeleton-blob.png', import.meta.url).href;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  shapes = readWallShapes(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  console.debug('[Terreno] Máscaras de colisión preparadas', shapes.length);
}

// Distancia entre un cuerpo circular y las partes sólidas del autotile.
// Las variantes decorativas comparten el índice base de la casilla.
export function groundFree(x, y, radius, crosses = false) {
  const right = game.grid[0].length - 1, bottom = game.grid.length - 1;
  if (x - radius < TILE || y - radius < TILE || x + radius > right * TILE || y + radius > bottom * TILE) return false;
  if (crosses) return true;
  for (let ty = Math.floor((y - radius) / TILE); ty <= Math.floor((y + radius) / TILE); ty++) {
    for (let tx = Math.floor((x - radius) / TILE); tx <= Math.floor((x + radius) / TILE); tx++) {
      if (game.grid[ty][tx] === 0) continue;
      const lx = x - tx * TILE, ly = y - ty * TILE;
      for (const rect of shapes[game.autotileGrid[ty][tx].index]) {
        const dx = Math.max(rect.left - lx, 0, lx - rect.right);
        const dy = Math.max(rect.top - ly, 0, ly - rect.bottom);
        if (dx * dx + dy * dy < radius * radius) return false;
      }
    }
  }
  return true;
}
