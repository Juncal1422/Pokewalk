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

// Elimina diagonales desconectadas de los vecinos que las sostienen.
function normalize(mask) {
  // Una diagonal del atlas sólo se conecta cuando están presentes sus dos vecinos ortogonales.
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
  let neighborMask = 0;
  neighbors.forEach(([deltaX, deltaY], bit) => {
    if ((grid[y + deltaY]?.[x + deltaX] ?? 1) === terrain) neighborMask |= 1 << bit;
  });
  const mask = normalize(neighborMask);
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

// Ajusta la complejidad de generación al intervalo entero de uno a cinco.
function clampLevel(complexity) {
  return Math.max(1, Math.min(5, Math.round(complexity)));
}

// Talla una casilla asegurando no romper los bordes exteriores del mapa.
function carveTile(grid, x, y, width = 1) {
  for (let deltaY = 0; deltaY < width; deltaY++) {
    for (let deltaX = 0; deltaX < width; deltaX++) {
      const tileX = x + deltaX;
      const tileY = y + deltaY;
      if (tileX > 0 && tileX < MAP_W - 1 && tileY > 0 && tileY < MAP_H - 1) {
        grid[tileY][tileX] = 0;
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
    for (let bendIndex = 1; bendIndex <= numBends; bendIndex++) {
      const bendFraction = bendIndex / (numBends + 1);
      const midX = Math.round(x + (to.cx - x) * bendFraction + randomInt(-3, 3));
      const midY = Math.round(y + (to.cy - y) * bendFraction + randomInt(-3, 3));
      waypoints.push({
        cx: Math.max(2, Math.min(MAP_W - 3, midX)),
        cy: Math.max(2, Math.min(MAP_H - 3, midY)),
      });
    }
  }
  waypoints.push({ cx: to.cx, cy: to.cy });

  for (const target of waypoints) {
    const horizontalFirst = Math.random() < 0.5;
    // Abre el tramo horizontal hasta la columna del siguiente punto.
    const carveHorizontal = () => {
      while (x !== target.cx) {
        x += Math.sign(target.cx - x);
        carveTile(grid, x, y, width);
      }
    };
    // Abre el tramo vertical hasta la fila del siguiente punto.
    const carveVertical = () => {
      while (y !== target.cy) {
        y += Math.sign(target.cy - y);
        carveTile(grid, x, y, width);
      }
    };

    if (horizontalFirst) {
      carveHorizontal();
      carveVertical();
    } else {
      carveVertical();
      carveHorizontal();
    }
  }
}

// Construye una habitación o nodo de cruce según el nivel de 'habitaciones' (1 a 5).
function createRoomInCell(grid, cellColumn, cellRow, cellWidth, cellHeight, habitacionesLevel) {
  const roomSpawnChance = [0, 0.15, 0.85, 1, 1, 1][habitacionesLevel];

  if (Math.random() > roomSpawnChance) {
    const centerX = cellColumn * cellWidth + Math.floor(cellWidth / 2) + randomInt(-1, 1);
    const centerY = cellRow * cellHeight + Math.floor(cellHeight / 2) + randomInt(-1, 1);
    const safeX = Math.max(2, Math.min(MAP_W - 3, centerX));
    const safeY = Math.max(2, Math.min(MAP_H - 3, centerY));
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
  const maxRoomWidth = Math.max(minSize, cellWidth - 2);
  const maxRoomHeight = Math.max(minSize, cellHeight - 2);

  const roomWidth = randomInt(minSize, maxRoomWidth);
  const roomHeight = randomInt(minSize, maxRoomHeight);
  const x = cellColumn * cellWidth + randomInt(1, Math.max(1, cellWidth - roomWidth - 1));
  const y = cellRow * cellHeight + randomInt(1, Math.max(1, cellHeight - roomHeight - 1));
  const centerX = x + Math.floor(roomWidth / 2);
  const centerY = y + Math.floor(roomHeight / 2);

  // 1. Tallar base rectangular.
  for (let row = y; row < y + roomHeight; row++) {
    grid[row].fill(0, x, x + roomWidth);
  }

  // 2. Nivel 3+: Recortar esquinas para formas en L, cruz o irregulares.
  if (habitacionesLevel >= 3 && roomWidth >= 6 && roomHeight >= 6) {
    const corners = new Array(
      new Array(x, y),
      new Array(x + roomWidth - 2, y),
      new Array(x, y + roomHeight - 2),
      new Array(x + roomWidth - 2, y + roomHeight - 2),
    );
    const cuts = habitacionesLevel >= 4 ? randomInt(1, 3) : 1;
    for (let cutIndex = 0; cutIndex < cuts; cutIndex++) {
      const [cutX, cutY] = corners[randomInt(0, corners.length - 1)];
      const cutWidth = randomInt(1, 2);
      const cutHeight = randomInt(1, 2);
      for (let tileRow = cutY; tileRow < cutY + cutHeight; tileRow++) {
        for (let tileColumn = cutX; tileColumn < cutX + cutWidth; tileColumn++) {
          if (Math.abs(tileColumn - centerX) > 1 || Math.abs(tileRow - centerY) > 1) {
            grid[tileRow][tileColumn] = 1;
          }
        }
      }
    }
  }

  // 3. Nivel 4-5: Añadir pilares centrales, muros interiores y loops dentro de la sala.
  if (habitacionesLevel >= 4 && roomWidth >= 7 && roomHeight >= 7) {
    const pattern = randomInt(1, 3);
    if (pattern === 1) {
      for (let tileRow = centerY - 1; tileRow <= centerY + 1; tileRow++) {
        for (let tileColumn = centerX - 1; tileColumn <= centerX + 1; tileColumn++) {
          grid[tileRow][tileColumn] = 1;
        }
      }
      if (habitacionesLevel === 5) {
        grid[centerY][centerX] = 0;
        grid[centerY - 1][centerX] = 0;
      } else {
        grid[centerY][centerX] = 0;
        grid[centerY][centerX + 1] = 0;
      }
    } else if (pattern === 2) {
      grid[y + 2][x + 2] = 1;
      grid[y + 2][x + roomWidth - 3] = 1;
      grid[y + roomHeight - 3][x + 2] = 1;
      grid[y + roomHeight - 3][x + roomWidth - 3] = 1;
    } else if (pattern === 3 && habitacionesLevel === 5) {
      for (let tileColumn = x + 2; tileColumn < x + roomWidth - 2; tileColumn++) {
        if (tileColumn !== centerX) grid[y + 2][tileColumn] = 1;
      }
      for (let tileColumn = x + 2; tileColumn < x + roomWidth - 2; tileColumn++) {
        if (tileColumn !== centerX) grid[y + roomHeight - 3][tileColumn] = 1;
      }
    }
  }

  return { x, y, w: roomWidth, h: roomHeight, cx: centerX, cy: centerY, isNode: false };
}

// Conecta salas y cruces y entrega primero los puntos aptos para situar combatientes.
function carveRooms(grid, corridorComplexity, roomComplexity, junctionComplexity) {
  const rooms = [];

  const columnCount = roomComplexity === 1 && junctionComplexity >= 4 ? 5 : 4;
  const rowCount = roomComplexity === 1 && junctionComplexity >= 4 ? 4 : 3;
  const cellWidth = Math.floor(MAP_W / columnCount);
  const cellHeight = Math.floor(MAP_H / rowCount);

  const extraLinkChance = [0, 0.15, 0.4, 0.65, 0.85, 1.0][junctionComplexity];

  for (let cellRow = 0; cellRow < rowCount; cellRow++) {
    for (let cellColumn = 0; cellColumn < columnCount; cellColumn++) {
      const room = createRoomInCell(grid, cellColumn, cellRow, cellWidth, cellHeight, roomComplexity);
      const roomIndex = rooms.length;

      const left = cellColumn > 0 ? rooms[roomIndex - 1] : null;
      const above = cellRow > 0 ? rooms[roomIndex - columnCount] : null;

      if (left && above) {
        const leftFirst = Math.random() < 0.5;
        connect(grid, room, leftFirst ? left : above, corridorComplexity);
        if (Math.random() < extraLinkChance) {
          connect(grid, room, leftFirst ? above : left, corridorComplexity);
        }
      } else if (left || above) {
        connect(grid, room, left || above, corridorComplexity);
      }

      if (junctionComplexity >= 3 && cellColumn > 0 && cellRow > 0) {
        const diagLeft = rooms[roomIndex - columnCount - 1];
        if (diagLeft && Math.random() < (junctionComplexity - 2) * 0.25) {
          connect(grid, room, diagLeft, corridorComplexity);
        }
      }

      rooms.push(room);
    }
  }

  if (junctionComplexity >= 4) {
    const extraBranches = junctionComplexity === 5 ? 6 : 3;
    for (let branchIndex = 0; branchIndex < extraBranches; branchIndex++) {
      const randomRoom = rooms[randomInt(0, rooms.length - 1)];
      const branchEndpoint = {
        cx: randomInt(3, MAP_W - 4),
        cy: randomInt(3, MAP_H - 4),
      };
      connect(grid, randomRoom, branchEndpoint, corridorComplexity);
    }
  }

  // Priorizar habitaciones reales al principio del array pero conservar todas las celdas
  // para que entities.js nunca reciba undefined al buscar salas por índice.
  return [
    ...rooms.filter((candidateRoom) => !candidateRoom.isNode),
    ...rooms.filter((candidateRoom) => candidateRoom.isNode),
  ];

}

// La arena tiene dos puntos de aparición enfrentados dentro de una sola habitación.
function carveArena(grid) {
  const centerX = Math.floor(MAP_W / 2), centerY = Math.floor(MAP_H / 2);
  for (let y = centerY - 5; y <= centerY + 5; y++) grid[y].fill(0, centerX - 8, centerX + 9);
  return [{ cx: centerX - 5, cy: centerY }, { cx: centerX + 5, cy: centerY }];
}

// Genera el terreno lógico y deriva las capas de autotiles y variantes decorativas del bioma.
export function generateDungeon({ pasillos = 5, habitaciones = 5, cruces = 5, open = false } = {}) {
  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
  const sortedRooms = open ? carveArena(grid) :
    carveRooms(grid, clampLevel(pasillos), clampLevel(habitaciones), clampLevel(cruces));
  console.debug('[Mazmorra] Distribución generada', { pasillos, habitaciones, cruces, abierta: open });
  game.grid = grid;
  game.rooms = sortedRooms;

  game.autotileGrid = grid.map((row, y) =>
    row.map((_, x) => autotile(grid, x, y)),
  );

  game.variantGrid = grid.map((row, y) =>
    row.map((terrain, x) => {
      // Solo se sortean casillas dibujadas en las filas extra de este atlas.
      const variants = game.currentBiome.variants;
      const slots = Object.keys(terrain === 0 ? variants.floors : (game.autotileGrid[y][x].index === 46 ? variants.walls[255] ?? {} : {}));
      if (!slots.length || Math.random() >= (terrain === 0 ? 0.12 : 0.25)) return 0;
      return Number(slots[randomInt(0, slots.length - 1)]);
    }),
  );
}
