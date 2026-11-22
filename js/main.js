import { newMission, exitKind, rewardOptions, sample } from './core/missions.js';
import { collectItems, loadItemImages } from './core/items.js';
import { refreshStats } from './core/stats.js';
import { loadEncountersCatalog } from './data/encounters.js';
import { chooseReward } from './core/rewards.js';
import { loadUpgrades, applyUpgrade } from './data/upgrades.js';
import { loadHud } from './core/hud.js';
import { loadBiomes } from './data/biomes.js';
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
      #rewards img.essence { width:24px; }
      #roster { position:absolute; right:8px; top:68px; color:#eef6ff; background:#101a25e8; border-radius:6px; max-width:44vw; max-height:60vh; overflow:auto; padding:6px 9px; font-size:12px; }
      #roster summary { cursor:pointer; font-weight:600; }
      #roster ul { list-style:none; margin:6px 0 0; padding:0; }
      #roster li { padding:4px 0; border-top:1px solid #354456; }
      #rewards::backdrop { background:#0b101ddc; }
      #rewards h1 { margin:0 0 12px; font-size:clamp(18px,5vmin,30px); }
      #rewards .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:clamp(4px,1.5vmin,12px); }
      #rewards button { min-width:0; display:grid; justify-items:center; gap:6px; padding:clamp(4px,2vmin,18px); border:2px solid #455d77; border-radius:8px; background:#26374a; color:#fff; font:600 clamp(12px,2.7vmin,18px) system-ui; cursor:pointer; }
      #rewards button:is(:hover,:focus-visible) { outline:2px solid #a7e9e2; background:#324e60; }
      #rewards img { width:min(80px,15vw,17dvh); aspect-ratio:1; image-rendering:pixelated; }
      #poke-walk-app #loading { position:absolute; inset:0; background:rgba(17,19,26,.9); display:flex; align-items:center; justify-content:center; font-size:1rem; z-index:10; }
      #poke-walk-app #toast { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(220,38,38,.92); color:#fff; padding:5px 12px; border-radius:6px; font-size:.82rem; font-weight:600; display:none; z-index:12; }
    </style>
    <div id="canvas-container"><canvas id="game" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="toast" role="status"></div><div id="loading">Cargando Pokémon y mazmorra...</div></div>
    <details id="roster" open><summary>Pokémon del piso</summary><ul></ul></details>
    <dialog id="rewards" aria-labelledby="reward-title"><h1 id="reward-title">Mejoras</h1><div class="cards"></div></dialog>
  </div>`;

function mountApp(root) {
  if (root.querySelector('#game')) return;
  root.innerHTML = EMBEDDED_APP;
}

// El portal sustituye un suelo común y nunca se genera bajo el jugador.
function placePortal(px, py, kind) {
  const floors = [];
  game.grid.forEach((row, y) =>
    row.forEach((terrain, x) => {
      if (
        terrain === 0 &&

        (x !== px || y !== py)
      ) {
        floors.push({ x, y, kind, entered: false });
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
    const m = game.mission;
    if (game.portal.kind === 'stairs') {
      game.loadingEl.style.display = 'flex';
      await loadLevel(game.player.dex, m, game.floor + 1);
    } else {
      const option = await chooseReward(rewardOptions(), game.catalog);
      game.loadingEl.style.display = 'flex';
      const biome = sample(game.biomes.filter(b => b.id !== m.biome.id));
      const next = newMission(m.number + 1, biome);
      await changeBiome(biome);
      await loadLevel(option?.row.dex ?? game.player.dex, next, 1);
      if (option) {
        const ids = [option.row.mejora, option.bonus].filter(Boolean);
        for (const id of ids) applyUpgrade(game.player.baseStats, game.catalog.find(r => r.id === id));
        refreshStats(game.player);
        game.formEssence = option.essence;
        console.info('[Ditto] Transformación', option.row.name, ids);
      }
    }
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

// El panel comparte los valores de combate y solo cambia el DOM cuando varían.
function updateRoster() {
  const list = document.querySelector('#roster ul');
  const rows = game.entities.map(e => {
    const name = game.pokemon.get(e.dex).name + (e.isPlayer ? ' (tú)' : e.boss ? ' (líder)' : '');
    return name + ' · PV ' + e.hp + '/' + e.stats.hpMax + ' · Daño ' + e.stats.atkdmg;
  });
  const signature = rows.join('|');
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren(...rows.map(text => { const li=document.createElement('li'); li.textContent=text; return li; }));
}

function frame() {
  if (!game.changingLevel) {
    game.entities.forEach(updateEntity);
    collectItems(game.player);
    const now = performance.now();
    game.entities = game.entities.filter(
      (entity) => entity.hp > 0 || now - entity.deathAt < FADE_MS,
    );
    updateRoster();
    const player = game.player;
    if (player.hp === 0 && !game.entities.includes(player)) {
      draw();
      game.loadingEl.textContent =
        'Tu Pokémon se ha debilitado. Recarga para volver a jugar.';
      game.loadingEl.style.display = 'flex';
      return;
    }
    // Esperamos a que termine el último fundido antes de habilitar la salida.
    if (player.hp > 0) {
      const x = Math.floor(player.x / TILE),
        y = Math.floor(player.y / TILE);
      const kind = exitKind(game.mission, game.floor, game.entities.length === 1);
      if (kind && game.portal?.kind !== kind) placePortal(x, y, kind);
      const portal = game.portal;
      if (portal) {
        const inside = portal.x === x && portal.y === y;
        if (inside && !portal.entered) {
          if (portal.kind === 'objective') {
            game.mission.recovered = true;
            game.portal = null;
            showToast('Objeto recuperado. Busca el teletransportador.');
          } else void nextLevel();
        }
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
  const [catalog, biomes] = await Promise.all([loadUpgrades(), loadBiomes(), preparePortal(), loadHud()]);
  game.biomes = biomes;
  game.catalog = catalog;
  const { pokemon, items } = await loadEncountersCatalog(catalog);
  game.pokemon = pokemon;
  game.items = items;
  await loadItemImages(items);
  game.adventure = 0;
  game.essences = {};
  game.pickups = [];
  game.perks = { loot: 0, essence: 0, dodge: 0 };
  game.formEssence = null;
  const biome = sample(biomes);
  await changeBiome(biome);
  await loadLevel(DEFAULT_DEX, newMission(1, biome), 1);
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
