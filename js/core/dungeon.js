import { MAP_H, MAP_W } from './constants.js';
import { game } from './state.js';

// Vecinos evaluados desde el norte y en sentido horario.
// Cada vecino ocupa un bit independiente en la máscara de autotile.
const neighbors = new Array(
  new Array(0, -1),
  new Array(1, -1),
  new Array(1, 0),
  new Array(1, 1),
  new Array(0, 1),
  new Array(-1, 1),
  new Array(-1, 0),
  new Array(-1, -1),
);

// Quita una conexión diagonal si no están presentes sus vecinos laterales.
// Esto evita que esquinas incompletas tengan una apariencia inválida.
const diagonalRules = new Array(
  new Array(2, 5),
  new Array(8, 20),
  new Array(32, 80),
  new Array(128, 65),
);

function normalize(mask) {
  for (const [diagonal, sides] of diagonalRules) {
    if ((mask & sides) !== sides) mask &= ~diagonal;
  }
  return mask;
}

// Convierte cada máscara normalizada válida en un índice estable de tileset.
const indices = new Map();
for (let mask = 0; mask < 256; mask++) {
  if (normalize(mask) === mask) indices.set(mask, indices.size);
}

// Calcula la máscara de terreno alrededor de una casilla y su índice de autotile.
function autotile(grid, x, y) {
  const terrain = grid[y][x];
  let raw = 0;
  neighbors.forEach(([dx, dy], bit) => {
    if ((grid[y + dy]?.[x + dx] ?? 1) === terrain) raw |= 1 << bit;
  });
  const mask = normalize(raw);
  return { mask, index: indices.get(mask) };
}

// Cambia la variante visual de una casilla de suelo válida.
// Devuelve false si la posición no está dentro del suelo o el id no es válido.
export function setFloorVariant(x, y, id = 1) {
  if (game.grid[y]?.[x] !== 0 || !Number.isInteger(id) || id < 0) return false;
  game.variantGrid[y][x] = id;
  return true;
}

// Genera un entero aleatorio inclusivo dentro del intervalo [min, max].
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clampLevel(val) {
  return Math.max(1, Math.min(5, Math.round(val)));
}

// Talla una casilla asegurando no romper los bordes exteriores del mapa.
function carveTile(grid, x, y, width = 1) {
  for (let dy = 0; dy < width; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < MAP_W - 1 && ny > 0 && ny < MAP_H - 1) {
        grid[ny][nx] = 0;
      }
    }
  }
}

// Conecta dos puntos según el nivel de complejidad de 'pasillos' (1 a 5).
function connect(grid, from, to, pasillosLevel) {
  let x = from.cx;
  let y = from.cy;

  const width =
    pasillosLevel === 1
      ? 1
      : pasillosLevel <= 3
        ? Math.random() < 0.35
          ? 2
          : 1
        : randomInt(1, 2);

  const bendChance = (pasillosLevel - 1) * 0.22;
  const waypoints = [];

  if (Math.random() < bendChance) {
    const numBends = pasillosLevel >= 4 ? randomInt(1, 2) : 1;
    for (let i = 1; i <= numBends; i++) {
      const t = i / (numBends + 1);
      const midX = Math.round(x + (to.cx - x) * t + randomInt(-3, 3));
      const midY = Math.round(y + (to.cy - y) * t + randomInt(-3, 3));
      waypoints.push({
        cx: Math.max(2, Math.min(MAP_W - 3, midX)),
        cy: Math.max(2, Math.min(MAP_H - 3, midY)),
      });
    }
  }
  waypoints.push({ cx: to.cx, cy: to.cy });

  for (const target of waypoints) {
    const horizFirst = Math.random() < 0.5;
    const stepH = () => {
      while (x !== target.cx) {
        x += Math.sign(target.cx - x);
        carveTile(grid, x, y, width);
      }
    };
    const stepV = () => {
      while (y !== target.cy) {
        y += Math.sign(target.cy - y);
        carveTile(grid, x, y, width);
      }
    };

    if (horizFirst) {
      stepH();
      stepV();
    } else {
      stepV();
      stepH();
    }
  }
}

// Construye una habitación o nodo de cruce según el nivel de 'habitaciones' (1 a 5).
function createRoomInCell(grid, gx, gy, cellW, cellH, habitacionesLevel) {
  const roomSpawnChance = [0, 0.15, 0.85, 1, 1, 1][habitacionesLevel];

  if (Math.random() > roomSpawnChance) {
    const cx = gx * cellW + Math.floor(cellW / 2) + randomInt(-1, 1);
    const cy = gy * cellH + Math.floor(cellH / 2) + randomInt(-1, 1);
    const safeX = Math.max(2, Math.min(MAP_W - 3, cx));
    const safeY = Math.max(2, Math.min(MAP_H - 3, cy));
    grid[safeY][safeX] = 0;
    return {
      x: safeX,
      y: safeY,
      w: 1,
      h: 1,
      cx: safeX,
      cy: safeY,
      isNode: true,
    };
  }

  const minSize = habitacionesLevel >= 4 ? 6 : 4;
  const maxW = Math.max(minSize, cellW - 2);
  const maxH = Math.max(minSize, cellH - 2);

  const w = randomInt(minSize, maxW);
  const h = randomInt(minSize, maxH);
  const x = gx * cellW + randomInt(1, Math.max(1, cellW - w - 1));
  const y = gy * cellH + randomInt(1, Math.max(1, cellH - h - 1));
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);

  // 1. Tallar base rectangular.
  for (let row = y; row < y + h; row++) {
    grid[row].fill(0, x, x + w);
  }

  // 2. Nivel 3+: Recortar esquinas para formas en L, cruz o irregulares.
  if (habitacionesLevel >= 3 && w >= 6 && h >= 6) {
    const corners = new Array(
      new Array(x, y),
      new Array(x + w - 2, y),
      new Array(x, y + h - 2),
      new Array(x + w - 2, y + h - 2),
    );
    const cuts = habitacionesLevel >= 4 ? randomInt(1, 3) : 1;
    for (let i = 0; i < cuts; i++) {
      const [kx, ky] = corners[randomInt(0, corners.length - 1)];
      const cw = randomInt(1, 2);
      const ch = randomInt(1, 2);
      for (let ry = ky; ry < ky + ch; ry++) {
        for (let rx = kx; rx < kx + cw; rx++) {
          if (Math.abs(rx - cx) > 1 || Math.abs(ry - cy) > 1) {
            grid[ry][rx] = 1;
          }
        }
      }
    }
  }

  // 3. Nivel 4-5: Añadir pilares centrales, muros interiores y loops dentro de la sala.
  if (habitacionesLevel >= 4 && w >= 7 && h >= 7) {
    const pattern = randomInt(1, 3);
    if (pattern === 1) {
      for (let ry = cy - 1; ry <= cy + 1; ry++) {
        for (let rx = cx - 1; rx <= cx + 1; rx++) {
          grid[ry][rx] = 1;
        }
      }
      if (habitacionesLevel === 5) {
        grid[cy][cx] = 0;
        grid[cy - 1][cx] = 0;
      } else {
        grid[cy][cx] = 0;
        grid[cy][cx + 1] = 0;
      }
    } else if (pattern === 2) {
      grid[y + 2][x + 2] = 1;
      grid[y + 2][x + w - 3] = 1;
      grid[y + h - 3][x + 2] = 1;
      grid[y + h - 3][x + w - 3] = 1;
    } else if (pattern === 3 && habitacionesLevel === 5) {
      for (let rx = x + 2; rx < x + w - 2; rx++) {
        if (rx !== cx) grid[y + 2][rx] = 1;
      }
      for (let rx = x + 2; rx < x + w - 2; rx++) {
        if (rx !== cx) grid[y + h - 3][rx] = 1;
      }
    }
  }

  return { x, y, w, h, cx, cy, isNode: false };
}

// Genera una cuadrícula nueva, coloca habitaciones y actualiza los datos de dibujo.
// Si no recibe argumentos, usa por defecto { pasillos: 2, habitaciones: 2, cruces: 1 }.
export function generateDungeon(options = {}) {
  const { pasillos = 5, habitaciones = 5, cruces = 5 } = options || {};

  const pLvl = clampLevel(pasillos);
  const hLvl = clampLevel(habitaciones);
  const cLvl = clampLevel(cruces);

  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
  const rooms = [];

  const cols = hLvl === 1 && cLvl >= 4 ? 5 : 4;
  const rows = hLvl === 1 && cLvl >= 4 ? 4 : 3;
  const cellW = Math.floor(MAP_W / cols);
  const cellH = Math.floor(MAP_H / rows);

  const extraLinkChance = [0, 0.15, 0.4, 0.65, 0.85, 1.0][cLvl];

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const room = createRoomInCell(grid, gx, gy, cellW, cellH, hLvl);
      const idx = rooms.length;

      const left = gx > 0 ? rooms[idx - 1] : null;
      const above = gy > 0 ? rooms[idx - cols] : null;

      if (left && above) {
        const leftFirst = Math.random() < 0.5;
        connect(grid, room, leftFirst ? left : above, pLvl);
        if (Math.random() < extraLinkChance) {
          connect(grid, room, leftFirst ? above : left, pLvl);
        }
      } else if (left || above) {
        connect(grid, room, left || above, pLvl);
      }

      if (cLvl >= 3 && gx > 0 && gy > 0) {
        const diagLeft = rooms[idx - cols - 1];
        if (diagLeft && Math.random() < (cLvl - 2) * 0.25) {
          connect(grid, room, diagLeft, pLvl);
        }
      }

      rooms.push(room);
    }
  }

  if (cLvl >= 4) {
    const extraBranches = cLvl === 5 ? 6 : 3;
    for (let i = 0; i < extraBranches; i++) {
      const randomRoom = rooms[randomInt(0, rooms.length - 1)];
      const targetPt = {
        cx: randomInt(3, MAP_W - 4),
        cy: randomInt(3, MAP_H - 4),
      };
      connect(grid, randomRoom, targetPt, pLvl);
    }
  }

  // Priorizar habitaciones reales al principio del array pero conservar todas las celdas
  // para que entities.js nunca reciba undefined al buscar salas por índice.
  const sortedRooms = [
    ...rooms.filter((r) => !r.isNode),
    ...rooms.filter((r) => r.isNode),
  ];

  // El enfrentamiento final necesita espacio para el cuerpo doble del líder.
  if (options.open) {
    for (let y = 1; y < MAP_H - 1; y++) grid[y].fill(0, 1, MAP_W - 1);
    sortedRooms[0] = { cx: Math.floor(MAP_W / 4), cy: Math.floor(MAP_H / 2) };
    sortedRooms[1] = { cx: Math.floor(3 * MAP_W / 4), cy: Math.floor(MAP_H / 2) };
  }
  console.debug('[Mazmorra] Distribución generada', { pasillos, habitaciones, cruces, abierta: !!options.open });
  game.grid = grid;
  game.rooms = sortedRooms;

  game.autotileGrid = grid.map((row, y) =>
    row.map((_, x) => autotile(grid, x, y)),
  );

  game.variantGrid = grid.map((row, y) =>
    row.map((terrain, x) => {
      if (terrain === 0) return Math.random() < 0.12 ? randomInt(2, 6) : 0;
      return game.autotileGrid[y][x].mask === 124 && Math.random() < 0.25
        ? 1
        : 0;
    }),
  );
}
