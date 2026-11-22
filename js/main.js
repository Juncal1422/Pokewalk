import { BIOMES } from './data/biomes.js';
import { DEFAULT_DEX, FADE_MS, TILE } from './core/constants.js';
import { updateEntity, loadLevel, showToast } from './core/entities.js';
import { attachInput } from './core/input.js';
import { changeBiome, draw, preparePortal } from './core/renderer.js';
import { game, resetGameState } from './core/state.js';

const EMBEDDED_APP = `
  <div id="poke-walk-app">
    <style>
      #poke-walk-app { min-height:100vh; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#11131a; color:#f0f4f8; font:14px 'Segoe UI',system-ui,sans-serif; }
      #poke-walk-app * { box-sizing:border-box; margin:0; }
      #poke-walk-app #canvas-container { position:relative; max-width:100%; border:4px solid #353c52; border-radius:8px; overflow:hidden; background:#000; }
      #poke-walk-app canvas { display:block; max-width:100%; height:auto; image-rendering:pixelated; cursor:crosshair; user-select:none; }
      #poke-walk-app #loading { position:absolute; inset:0; background:rgba(17,19,26,.9); display:flex; align-items:center; justify-content:center; font-size:1rem; z-index:10; }
      #poke-walk-app #toast { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(220,38,38,.92); color:#fff; padding:5px 12px; border-radius:6px; font-size:.82rem; font-weight:600; display:none; z-index:12; }
      #poke-walk-app .hint { margin-top:8px; font-size:.82rem; color:#94a3b8; } #poke-walk-app kbd { background:#1e293b; border:1px solid #475569; border-radius:4px; padding:1px 5px; color:#e2e8f0; }
    </style>
    <div id="canvas-container"><canvas id="game" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="toast" role="status"></div><div id="loading">Cargando Pokémon y mazmorra...</div></div>
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
  game.loadingEl.style.display = 'flex';
  try {
    const choices = BIOMES.filter((biome) => biome !== game.currentBiome);
    await changeBiome(choices[Math.floor(Math.random() * choices.length)]);
    await loadLevel(game.player.dex);
    if (document.hasFocus()) game.canvas.focus();
  } catch (error) {
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
  await Promise.all([changeBiome(BIOMES[0]), preparePortal()]);
  await loadLevel(DEFAULT_DEX);
  const input = attachInput();
  root.__pokeWalkCleanup = () => {
    input.abort();
    cancelAnimationFrame(game.animationFrame);
    clearTimeout(game.toastTimer);
  };
  game.animationFrame = requestAnimationFrame(frame);
}

if (document.querySelector('#game') && !document.querySelector('#game-root'))
  startGame();
