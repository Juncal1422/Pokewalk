import { collectItems, loadItemImages } from './core/items.js';
import { refreshStats } from './core/stats.js';
import { loadEncountersCatalog } from './data/encounters.js';
import { chooseReward } from './core/rewards.js';
import { loadUpgrades, applyUpgrade } from './data/upgrades.js';
import { loadHud } from './core/hud.js';
import { BIOMES } from './data/biomes.js';
import { DEFAULT_DEX, FADE_MS, TILE } from './core/constants.js';
import { updateEntity, loadLevel, showToast } from './core/entities.js';
import { attachInput } from './core/input.js';
import { changeBiome, draw, preparePortal } from './core/renderer.js';
import { game, resetGameState } from './core/state.js';

const EMBEDDED_APP = `
  <div id="poke-walk-app">
    <style>
      html, body { margin:0; width:100%; height:100%; overflow:hidden; }
      #poke-walk-app { position:fixed; inset:0; overflow:hidden; background:#11131a; color:#f0f4f8; font:14px system-ui,sans-serif; }
      #canvas-container, #game { width:100%; height:100%; display:block; }
      #game { image-rendering:pixelated; touch-action:none; outline:none; }
      #rewards { box-sizing:border-box; width:min(92vw,760px); max-height:96dvh; padding:clamp(8px,3vmin,28px); color:#f3f6ff; background:#172233; border:2px solid #526681; border-radius:12px; }
      #rewards::backdrop { background:#0b101ddc; }
      #rewards h1 { margin:0 0 12px; font-size:clamp(18px,5vmin,30px); }
      #rewards .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:clamp(4px,1.5vmin,12px); }
      #rewards button { min-width:0; display:grid; justify-items:center; gap:6px; padding:clamp(4px,2vmin,18px); border:2px solid #455d77; border-radius:8px; background:#26374a; color:#fff; font:600 clamp(12px,2.7vmin,18px) system-ui; cursor:pointer; }
      #rewards button:is(:hover,:focus-visible) { outline:2px solid #a7e9e2; background:#324e60; }
      #rewards img { width:min(80px,15vw,17dvh); aspect-ratio:1; image-rendering:pixelated; }
      #poke-walk-app #loading { position:absolute; inset:0; background:rgba(17,19,26,.9); display:flex; align-items:center; justify-content:center; font-size:1rem; z-index:10; }
      #poke-walk-app #toast { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(220,38,38,.92); color:#fff; padding:5px 12px; border-radius:6px; font-size:.82rem; font-weight:600; display:none; z-index:12; }
    </style>
    <div id="canvas-container"><canvas id="game" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="toast" role="status"></div><div id="loading">Cargando Pokémon y mazmorra...</div></div>
    <dialog id="rewards" aria-labelledby="reward-title"><h1 id="reward-title">Mejoras</h1><div class="cards"></div></dialog>
  </div>`;

function mountApp(root) {
  if (root.querySelector('#game')) return;
  root.innerHTML = EMBEDDED_APP;
}

// El portal sustituye un suelo común y nunca se genera bajo el jugador.
function placePortal(px, py) {
  const floors = [];
  game.grid.forEach((row, y) =>
    row.forEach((terrain, x) => {
      if (
        terrain === 0 &&
        game.variantGrid[y][x] === 0 &&
        (x !== px || y !== py)
      ) {
        floors.push({ x, y, entered: false });
      }
    }),
  );
  game.portal = floors[Math.floor(Math.random() * floors.length)];
}

async function nextLevel() {
  game.changingLevel = true;
  game.keys = Object.create(null);
  game.canvas.blur();
  const previousBiome = game.currentBiome;
  const previousSheet = game.tileSheet;
  try {
    const reward = await chooseReward(game.defeated, game.catalog, game.pokemon);
    game.loadingEl.style.display = 'flex';
    const choices = BIOMES.filter((biome) => biome !== game.currentBiome);
    await changeBiome(choices[Math.floor(Math.random() * choices.length)]);
    await loadLevel(game.player.dex);
    // Se concede una sola vez, después de cargar el nuevo piso con éxito.
    applyUpgrade(game.player.baseStats, reward);
    refreshStats(game.player);
    game.adventure++;
    if (document.hasFocus()) game.canvas.focus();
  } catch (error) {
    game.currentBiome = previousBiome;
    game.tileSheet = previousSheet;
    showToast(error.message);
    if (document.hasFocus()) game.canvas.focus();
  } finally {
    game.loadingEl.style.display = 'none';
    game.changingLevel = false;
  }
}

function frame() {
  if (!game.changingLevel) {
    game.entities.forEach(updateEntity);
    collectItems(game.player);
    const now = performance.now();
    game.entities = game.entities.filter(
      (entity) => entity.hp > 0 || now - entity.deathAt < FADE_MS,
    );
    const player = game.player;
    if (player.hp === 0 && !game.entities.includes(player)) {
      draw();
      game.loadingEl.textContent =
        'Tu Pokémon se ha debilitado. Recarga para volver a jugar.';
      game.loadingEl.style.display = 'flex';
      return;
    }
    // Esperamos a que termine el último fundido antes de habilitar la salida.
    if (player.hp > 0 && game.entities.length === 1) {
      const x = Math.floor(player.x / TILE),
        y = Math.floor(player.y / TILE);
      if (!game.portal) placePortal(x, y);
      const portal = game.portal;
      if (portal) {
        const inside = portal.x === x && portal.y === y;
        if (inside && !portal.entered) void nextLevel();
        portal.entered = inside;
      }
    }
    draw();
  }
  game.animationFrame = requestAnimationFrame(frame);
}

export async function startGame({
  root = document.querySelector('#game-root') || document.body,
} = {}) {
  root.__pokeWalkCleanup?.();
  resetGameState();
  mountApp(root);
  game.canvas = document.getElementById('game');
  game.ctx = game.canvas.getContext('2d');
  game.loadingEl = document.getElementById('loading');
  game.toastEl = document.getElementById('toast');
  const resize = () => {
    game.canvas.width = Math.max(1, game.canvas.clientWidth);
    game.canvas.height = Math.max(1, game.canvas.clientHeight);
    draw();
  };
  resize();
  const [catalog] = await Promise.all([loadUpgrades(), changeBiome(BIOMES[0]), preparePortal(), loadHud()]);
  game.catalog = catalog;
  const { pokemon, items } = await loadEncountersCatalog(catalog);
  game.pokemon = pokemon;
  game.items = items;
  await loadItemImages(items);
  game.adventure = 0;
  await loadLevel(DEFAULT_DEX);
  const input = attachInput();
  const observer = new ResizeObserver(resize);
  observer.observe(game.canvas);
  root.__pokeWalkCleanup = () => {
    observer.disconnect();
    input.abort();
    cancelAnimationFrame(game.animationFrame);
    clearTimeout(game.toastTimer);
  };
  game.animationFrame = requestAnimationFrame(frame);
}

if (document.querySelector('#game') && !document.querySelector('#game-root'))
  startGame();
