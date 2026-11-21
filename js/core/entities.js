import { ANIM_SPEED, ATTACK_RANGE, AI_SPEED, DIR_MAP, DIR_VEC, EXCLUDED_DEX, MAX_CHARGE_FRAMES, MAX_DEX, PLAYER_SPEED, TILE, MAP_W, MAP_H } from "./constants.js";
import { game } from "./state.js";
import { loadPokemonData } from "../data/pokemon-data.js";

export function showToast(message) {
  game.toastEl.textContent = message;
  game.toastEl.style.display = "block";
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => { game.toastEl.style.display = "none"; }, 2800);
}

export function normalizeValidDex(raw) {
  let dex = Math.max(1, Math.min(MAX_DEX, Number.isNaN(Number(raw)) ? 25 : Number(raw)));
  while (EXCLUDED_DEX.has(dex)) dex = dex < MAX_DEX ? dex + 1 : 1;
  return dex;
}

export function getRandomValidDex() {
  let dex;
  do { dex = Math.floor(Math.random() * MAX_DEX) + 1; } while (EXCLUDED_DEX.has(dex));
  return dex;
}

export function createEntity(data, room, isPlayer) {
  return {
    isPlayer, dex: data.dex, dexStr: data.dexStr, anims: data.anims,
    x: room.cx * TILE + TILE / 2, y: room.cy * TILE + TILE / 2,
    dir: 0, state: "Idle", frame: 0, timer: 0, chargeTime: 0,
    speed: isPlayer ? PLAYER_SPEED : AI_SPEED,
    aiDir: [0, 0], aiTimer: 45, atkCooldown: 120 + Math.floor(Math.random() * 140)
  };
}

export function setState(entity, state) {
  if (entity.state !== state) { entity.state = state; entity.frame = 0; entity.timer = 0; }
}

export function canMove(x, y) {
  const radius = 9;
  for (const [offsetX, offsetY] of [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]) {
    const tileX = Math.floor((x + offsetX) / TILE), tileY = Math.floor((y + offsetY) / TILE);
    if (tileX < 0 || tileY < 0 || tileX >= MAP_W || tileY >= MAP_H || game.map[tileY][tileX] === 0) return false;
  }
  return true;
}

export function triggerAttack(attacker) {
  if (attacker.state === "Attack" || attacker.state === "Hurt") return;
  setState(attacker, "Attack");
  const [vx, vy] = DIR_VEC[attacker.dir];
  const hitX = attacker.x + vx * ATTACK_RANGE, hitY = attacker.y + vy * ATTACK_RANGE;
  for (const target of game.entities) {
    if (target === attacker || Math.hypot(target.x - hitX, target.y - hitY) >= 28) continue;
    target.chargeTime = 0;
    setState(target, "Hurt");
    if (canMove(target.x + vx * 10, target.y + vy * 10)) { target.x += vx * 10; target.y += vy * 10; }
  }
}

export function startCharge() {
  if (!game.player || ["Attack", "Hurt", "Charge"].includes(game.player.state)) return;
  setState(game.player, "Charge");
  game.player.chargeTime = 0;
}

export function releaseCharge() {
  if (!game.player || game.player.state !== "Charge") return;
  game.player.chargeTime = 0;
  triggerAttack(game.player);
}

export async function setPlayerDex(rawDex) {
  const clamped = Math.max(1, Math.min(MAX_DEX, Number.isNaN(Number(rawDex)) ? 25 : Number(rawDex)));
  let dex = normalizeValidDex(clamped);
  if (dex !== clamped) showToast(`#${String(clamped).padStart(4, "0")} no está completo; saltando a #${String(dex).padStart(4, "0")}`);

  game.loadingEl.style.display = "flex";
  let playerData = await loadPokemonData(dex);
  while (!playerData) { dex = getRandomValidDex(); playerData = await loadPokemonData(dex); }
  document.getElementById("dex-in").value = dex;

  const aiDexList = [5, 10, 15, 20, 25, 30].map(offset => normalizeValidDex(dex + offset <= MAX_DEX ? dex + offset : Math.max(1, dex - offset)));
  const aiData = await Promise.all(aiDexList.map(id => loadPokemonData(id)));
  game.player = createEntity(playerData, game.rooms[0], true);
  game.entities = [game.player];
  const roomSlots = [1, 3, 5, 7, 9, 11], loadedIds = [];
  aiData.forEach((data, index) => {
    if (!data) return;
    game.entities.push(createEntity(data, game.rooms[roomSlots[index] % game.rooms.length], false));
    loadedIds.push(`#${data.dexStr}`);
  });
  document.getElementById("ia-info").textContent = `IA (${loadedIds.length}): ${loadedIds.join(" · ") || "Ninguna"}`;
  game.loadingEl.style.display = "none";
}

function moveEntity(entity, dx, dy) {
  if (dx === 0 && dy === 0) return;
  entity.dir = DIR_MAP[`${dx},${dy}`] ?? entity.dir;
  const length = Math.hypot(dx, dy);
  const vx = (dx / length) * entity.speed, vy = (dy / length) * entity.speed;
  if (canMove(entity.x + vx, entity.y)) entity.x += vx;
  if (canMove(entity.x, entity.y + vy)) entity.y += vy;
}

export function updateEntity(entity) {
  if (entity.isPlayer) {
    let dx = 0, dy = 0;
    if (game.keys.w || game.keys.arrowup) dy--;
    if (game.keys.s || game.keys.arrowdown) dy++;
    if (game.keys.a || game.keys.arrowleft) dx--;
    if (game.keys.d || game.keys.arrowright) dx++;
    if (entity.state === "Charge") {
      entity.chargeTime = Math.min(MAX_CHARGE_FRAMES, entity.chargeTime + 1);
      if (dx || dy) entity.dir = DIR_MAP[`${dx},${dy}`] ?? entity.dir;
    } else if (!(["Attack", "Hurt"].includes(entity.state))) {
      if (dx || dy) { setState(entity, "Walk"); moveEntity(entity, dx, dy); }
      else setState(entity, "Idle");
    }
  } else if (!(["Attack", "Hurt"].includes(entity.state))) {
    entity.aiTimer--;
    if (entity.aiTimer <= 0) {
      entity.aiTimer = 50 + Math.floor(Math.random() * 80);
      const directions = [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,0]];
      entity.aiDir = directions[Math.floor(Math.random() * directions.length)];
    }
    const [dx, dy] = entity.aiDir;
    if (dx || dy) {
      setState(entity, "Walk");
      const previousX = entity.x, previousY = entity.y;
      moveEntity(entity, dx, dy);
      if (previousX === entity.x && previousY === entity.y) entity.aiTimer = 0;
    } else setState(entity, "Idle");

    entity.atkCooldown--;
    if (entity.atkCooldown <= 0) {
      entity.atkCooldown = 130 + Math.floor(Math.random() * 150);
      const nearby = game.entities.find(other => other !== entity && Math.hypot(other.x - entity.x, other.y - entity.y) < 42);
      if (nearby) {
        const sx = Math.sign(Math.round((nearby.x - entity.x) / 14)), sy = Math.sign(Math.round((nearby.y - entity.y) / 14));
        entity.dir = DIR_MAP[`${sx},${sy}`] ?? entity.dir;
      }
      triggerAttack(entity);
    }
  }

  const animation = entity.anims[entity.state] || entity.anims.Idle;
  entity.timer += entity.state === "Hurt" ? 0.55 : ANIM_SPEED;
  const duration = (animation.durs[entity.frame] || 8) + (entity.state === "Hurt" ? 2 : 0);
  if (entity.timer >= duration) {
    entity.timer = 0;
    entity.frame++;
    if (entity.frame >= animation.frames) {
      entity.frame = 0;
      if (entity.state === "Attack" || entity.state === "Hurt") setState(entity, "Idle");
    }
  }
}
