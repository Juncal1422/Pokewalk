import { BIOMES } from "./data/biomes.js";
import { DEFAULT_DEX } from "./core/constants.js";
import { updateEntity, loadLevel } from "./core/entities.js";
import { attachInput } from "./core/input.js";
import { changeBiome, draw } from "./core/renderer.js";
import { game, resetGameState } from "./core/state.js";

const EMBEDDED_APP = `
  <div id="poke-walk-app">
    <style>
      #poke-walk-app { min-height:100vh; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#11131a; color:#f0f4f8; font:14px 'Segoe UI',system-ui,sans-serif; }
      #poke-walk-app * { box-sizing:border-box; margin:0; }
      #poke-walk-app #hud { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:center; background:#1c202b; padding:10px 16px; border-radius:10px; border:2px solid #353c52; margin-bottom:10px; max-width:1020px; }
      #poke-walk-app .group { display:flex; align-items:center; gap:6px; background:#252a38; padding:5px 10px; border-radius:8px; }
      #poke-walk-app label { font-size:.82rem; color:#cbd5e1; font-weight:600; }
      #poke-walk-app input,#poke-walk-app select { background:#141821; color:#f8fafc; border:1px solid #475569; border-radius:5px; padding:4px 6px; font-size:.85rem; }
      #poke-walk-app input { width:68px; }
      #poke-walk-app button { background:#3b82f6; color:white; border:0; padding:6px 11px; border-radius:6px; font-weight:600; font-size:.85rem; cursor:pointer; }
      #poke-walk-app button:hover { background:#2563eb; } #poke-walk-app button.sec { background:#10b981; }
      #poke-walk-app #canvas-container { position:relative; max-width:100%; border:4px solid #353c52; border-radius:8px; overflow:hidden; background:#000; }
      #poke-walk-app canvas { display:block; max-width:100%; height:auto; image-rendering:pixelated; cursor:crosshair; user-select:none; }
      #poke-walk-app #loading { position:absolute; inset:0; background:rgba(17,19,26,.9); display:flex; align-items:center; justify-content:center; font-size:1rem; z-index:10; }
      #poke-walk-app #toast { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(220,38,38,.92); color:#fff; padding:5px 12px; border-radius:6px; font-size:.82rem; font-weight:600; display:none; z-index:12; }
      #poke-walk-app .hint { margin-top:8px; font-size:.82rem; color:#94a3b8; } #poke-walk-app kbd { background:#1e293b; border:1px solid #475569; border-radius:4px; padding:1px 5px; color:#e2e8f0; }
    </style>
    <div id="hud">
      <div class="group"><label for="dex-in">Dex (1-649):</label><input type="number" id="dex-in" min="1" max="649" value="${DEFAULT_DEX}">
        <select id="preset" aria-label="Pokémon clásico">
          <option value="">Clásicos...</option><option value="${DEFAULT_DEX}" selected>#0132 Ditto</option><option value="25">#0025 Pikachu</option><option value="447">#0447 Riolu</option><option value="133">#0133 Eevee</option><option value="252">#0252 Treecko</option><option value="255">#0255 Torchic</option><option value="258">#0258 Mudkip</option><option value="390">#0390 Chimchar</option><option value="393">#0393 Piplup</option><option value="37">#0037 Vulpix</option><option value="403">#0403 Shinx</option><option value="495">#0495 Snivy</option><option value="498">#0498 Tepig</option><option value="501">#0501 Oshawott</option><option value="570">#0570 Zorua</option><option value="483">#0483 Dialga</option><option value="491">#0491 Darkrai</option>
        </select><button id="choose-dex">Elegir</button><button class="sec" id="random-dex" aria-label="Pokémon aleatorio">🎲</button>
      </div>
      <div class="group"><label for="biome-sel">Bioma:</label><select id="biome-sel"></select><button class="sec" id="new-map">Nuevo Mapa</button></div>
      <div class="group" id="ia-info" style="font-size:.8rem;color:#93c5fd">IA: --</div>
    </div>
    <div id="canvas-container"><canvas id="game" width="1920" height="1320"></canvas><div id="toast" role="status"></div><div id="loading">Cargando Pokémon y mazmorra...</div></div>
    <div class="hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o <kbd>Flechas</kbd> mover · Mantener <kbd>Clic</kbd> o <kbd>Espacio</kbd> cargar y soltar para atacar</div>
  </div>`;

function mountApp(root) {
  if (root.querySelector("#game")) return;
  root.innerHTML = EMBEDDED_APP;
}

// Primero actualizo el movimiento y los ataques, luego dibujo ese fotograma.
function frame() {
  game.entities.forEach(updateEntity);
  draw();
  game.animationFrame = requestAnimationFrame(frame);
}

export async function startGame({ root = document.querySelector("#game-root") || document.body } = {}) {
  root.__pokeWalkCleanup?.();
  resetGameState();
  mountApp(root);
  game.canvas = document.getElementById("game");
  game.ctx = game.canvas.getContext("2d");
  game.loadingEl = document.getElementById("loading");
  game.toastEl = document.getElementById("toast");
  game.biomeSel = document.getElementById("biome-sel");
  game.biomeSel.replaceChildren(...BIOMES.map(biome => {
    const option = document.createElement("option");
    option.value = biome.id;
    option.textContent = biome.name;
    return option;
  }));

  await changeBiome(BIOMES[0]);
  await loadLevel(DEFAULT_DEX);
  const input = attachInput();
  root.__pokeWalkCleanup = () => {
    input.abort();
    cancelAnimationFrame(game.animationFrame);
    clearTimeout(game.toastTimer);
  };
  game.animationFrame = requestAnimationFrame(frame);
}

if (document.querySelector("#game") && !document.querySelector("#game-root")) startGame();
