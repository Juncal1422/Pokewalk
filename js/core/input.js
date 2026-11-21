import { BIOMES } from "../data/biomes.js";
import { changeBiome, generateDungeon } from "./dungeon.js";
import { game } from "./state.js";
import { getRandomValidDex, releaseCharge, setPlayerDex, startCharge } from "./entities.js";

export function attachInput() {
  const controller = new AbortController();
  const { signal } = controller;
  const on = (target, type, listener) => target.addEventListener(type, listener, { signal });

  document.getElementById("preset").addEventListener("change", event => {
    if (event.target.value) setPlayerDex(parseInt(event.target.value, 10));
  }, { signal });
  document.getElementById("choose-dex").addEventListener("click", () => setPlayerDex(parseInt(document.getElementById("dex-in").value, 10)), { signal });
  document.getElementById("random-dex").addEventListener("click", () => setPlayerDex(getRandomValidDex()), { signal });
  game.biomeSel.addEventListener("change", event => changeBiome(event.target.value), { signal });
  document.getElementById("new-map").addEventListener("click", async () => {
    changeBiome(BIOMES[Math.floor(Math.random() * BIOMES.length)].id);
    game.biomeSel.value = game.currentBiome.id;
    generateDungeon();
    await setPlayerDex(parseInt(document.getElementById("dex-in").value, 10));
  }, { signal });

  on(window, "keydown", event => {
    const key = event.key.toLowerCase();
    game.keys[key] = true;
    if (key === " ") {
      event.preventDefault();
      if (!event.repeat) startCharge();
    }
  });
  on(window, "keyup", event => {
    const key = event.key.toLowerCase();
    game.keys[key] = false;
    if (key === " ") { event.preventDefault(); releaseCharge(); }
  });
  on(game.canvas, "mousedown", event => { if (event.button === 0) startCharge(); });
  on(window, "mouseup", event => { if (event.button === 0) releaseCharge(); });
  game.inputController = controller;
  return controller;
}
