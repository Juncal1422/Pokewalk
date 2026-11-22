import { BIOMES } from '../data/biomes.js';
import { changeBiome } from './renderer.js';
import { game } from './state.js';
import {
  loadLevel,
  showToast,
  getRandomValidDex,
  releaseCharge,
  setPlayerDex,
  startCharge,
} from './entities.js';

export function attachInput() {
  const controller = new AbortController();
  const { signal } = controller;
  const on = (target, type, listener) =>
    target.addEventListener(type, listener, { signal });

  // Mientras llegan los recursos, evito que dos cambios de nivel se pisen.
  const hud = document.getElementById('hud');
  async function load(action) {
    if (hud.inert) return;
    hud.inert = true;
    game.loadingEl.style.display = 'flex';
    try {
      await action();
    } catch (error) {
      showToast(error.message);
    } finally {
      hud.inert = false;
      game.loadingEl.style.display = 'none';
    }
  }

  on(document.getElementById('preset'), 'change', (event) => {
    if (event.target.value)
      load(() => setPlayerDex(Number(event.target.value)));
  });
  on(document.getElementById('choose-dex'), 'click', () =>
    load(() => setPlayerDex(document.getElementById('dex-in').valueAsNumber)),
  );
  on(document.getElementById('random-dex'), 'click', () =>
    load(() => setPlayerDex(getRandomValidDex())),
  );
  on(game.biomeSel, 'change', (event) =>
    load(() =>
      changeBiome(BIOMES.find((biome) => biome.id === event.target.value)),
    ),
  );
  on(document.getElementById('new-map'), 'click', () =>
    load(async () => {
      await changeBiome(BIOMES[Math.floor(Math.random() * BIOMES.length)]);
      await loadLevel(game.player.dex);
    }),
  );

  on(window, 'keydown', (event) => {
    const key = event.key.toLowerCase();
    game.keys[key] = true;
    if (key === ' ') {
      event.preventDefault();
      if (!event.repeat) startCharge();
    }
  });
  on(window, 'keyup', (event) => {
    const key = event.key.toLowerCase();
    game.keys[key] = false;
    if (key === ' ') {
      event.preventDefault();
      releaseCharge();
    }
  });
  on(game.canvas, 'mousedown', (event) => {
    if (event.button === 0) startCharge();
  });
  on(window, 'mouseup', (event) => {
    if (event.button === 0) releaseCharge();
  });
  game.inputController = controller;
  return controller;
}
