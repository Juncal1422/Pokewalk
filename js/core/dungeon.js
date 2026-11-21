import { MAP_H, MAP_W, TILE } from "./constants.js";
import { BIOMES } from "../data/biomes.js";
import { game } from "./state.js";

export function buildTileSheet(biome) {
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = biome.floor;
  ctx.fillRect(0, 0, 24, 24);
  ctx.fillStyle = biome.floor2;
  ctx.fillRect(24, 0, 24, 24);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
    ctx.fillRect((i * 7) % 22 + 1, (i * 11) % 22 + 1, 2, 2);
    ctx.fillRect(24 + ((i * 13) % 22) + 1, (i * 5) % 22 + 1, 2, 2);
  }
  ctx.fillStyle = biome.wall;
  ctx.fillRect(0, 24, 24, 24);
  ctx.fillStyle = biome.border;
  ctx.fillRect(0, 24, 24, 4);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 44, 24, 4);
  ctx.fillStyle = biome.wallTop;
  ctx.fillRect(24, 24, 24, 24);
  ctx.fillStyle = biome.border;
  ctx.fillRect(25, 25, 22, 2);
  return canvas;
}

export function changeBiome(id) {
  game.currentBiome = BIOMES.find(biome => biome.id === id) || BIOMES[0];
  game.tileSheet = buildTileSheet(game.currentBiome);
}

export function generateDungeon() {
  game.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
  game.rooms = [];
  const cols = 4, rows = 3, cellW = Math.floor(MAP_W / cols), cellH = Math.floor(MAP_H / rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const roomW = Math.floor(Math.random() * (cellW - 5)) + 5;
      const roomH = Math.floor(Math.random() * (cellH - 5)) + 5;
      const x = gx * cellW + Math.floor(Math.random() * (cellW - roomW - 2)) + 1;
      const y = gy * cellH + Math.floor(Math.random() * (cellH - roomH - 2)) + 1;
      game.rooms.push({ x, y, w: roomW, h: roomH, cx: Math.floor(x + roomW / 2), cy: Math.floor(y + roomH / 2) });
      for (let row = y; row < y + roomH; row++) for (let col = x; col < x + roomW; col++) game.map[row][col] = 1;
    }
  }
  for (let i = 0; i < game.rooms.length - 1; i++) {
    let x = game.rooms[i].cx, y = game.rooms[i].cy;
    const targetX = game.rooms[i + 1].cx, targetY = game.rooms[i + 1].cy;
    while (x !== targetX) { game.map[y][x] = 1; x += x < targetX ? 1 : -1; }
    while (y !== targetY) { game.map[y][x] = 1; y += y < targetY ? 1 : -1; }
  }
}
