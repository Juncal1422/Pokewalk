import { MAP_H, MAP_W } from "./constants.js";
import { game } from "./state.js";

// Leo los vecinos desde el norte en sentido horario. Cada posición ocupa un bit.
const neighbors = [[0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1]];
// Una diagonal solo conecta si también están sus dos vecinos laterales.
function normalize(mask) {
  for (const [diagonal, sides] of [[2,5], [8,20], [32,80], [128,65]]) {
    if ((mask & sides) !== sides) mask &= ~diagonal;
  }
  return mask;
}
const indices = new Map();
for (let mask = 0; mask < 256; mask++) {
  if (normalize(mask) === mask) indices.set(mask, indices.size);
}

function autotile(grid, x, y) {
  const terrain = grid[y][x];
  let raw = 0;
  neighbors.forEach(([dx, dy], bit) => {
    if ((grid[y + dy]?.[x + dx] ?? 1) === terrain) raw |= 1 << bit;
  });
  const mask = normalize(raw);
  return { mask, index: indices.get(mask) };
}

export function setFloorVariant(x, y, id = 1) {
  if (game.grid[y]?.[x] !== 0 || !Number.isInteger(id) || id < 0) return false;
  game.variantGrid[y][x] = id;
  return true;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function connect(grid, from, to) {
  let x = from.cx, y = from.cy;
  const width = randomInt(1, 2);
  function horizontal() {
    while (x !== to.cx) {
      x += Math.sign(to.cx - x);
      for (let i = 0; i < width; i++) grid[y + i][x] = 0;
    }
  }
  function vertical() {
    while (y !== to.cy) {
      y += Math.sign(to.cy - y);
      for (let i = 0; i < width; i++) grid[y][x + i] = 0;
    }
  }
  if (Math.random() < 0.5) { horizontal(); vertical(); }
  else { vertical(); horizontal(); }
}

export function generateDungeon() {
  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
  const rooms = [];
  const cols = 4, rows = 3;
  const cellW = Math.floor(MAP_W / cols), cellH = Math.floor(MAP_H / rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const w = randomInt(5, cellW - 2), h = randomInt(5, cellH - 2);
      const x = gx * cellW + randomInt(1, cellW - w - 1);
      const y = gy * cellH + randomInt(1, cellH - h - 1);
      const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
      for (let row = y; row < y + h; row++) grid[row].fill(0, x, x + w);
      const left = gx && rooms[rooms.length - 1], above = gy && rooms[rooms.length - cols];
      if (left && above) {
        const leftFirst = Math.random() < 0.5;
        connect(grid, room, leftFirst ? left : above);
        if (Math.random() < 0.5) connect(grid, room, leftFirst ? above : left);
      } else if (left || above) connect(grid, room, left || above);
      rooms.push(room);
    }
  }
  game.grid = grid;
  game.rooms = rooms;
  game.autotileGrid = grid.map((row, y) => row.map((_, x) => autotile(grid, x, y)));
  game.variantGrid = grid.map((row, y) => row.map((terrain, x) => {
    if (terrain === 0) return Math.random() < 0.12 ? randomInt(2, 6) : 0;
    return game.autotileGrid[y][x].mask === 124 && Math.random() < 0.25 ? 1 : 0;
  }));
}
