import { gameTime, resetClock, advanceClock } from './core/clock.js';
import { levelFor } from './core/stats.js';
import { loadTerrain } from './core/terrain.js';
import { attachInventory } from './core/inventory.js';
import { newMission, exitKind, rewardOptions, chooseBiome } from './core/missions.js';
import { collectItems, loadItemImages } from './core/items.js';
import { element, tones, portrait } from './core/pokemon-panel.js';
import { loadEncountersCatalog } from './data/encounters.js';
import { chooseReward } from './core/rewards.js';
import { projectReward } from './core/benefits.js';
import { loadEffects, tickAbilities, pickupEffect } from './core/abilities.js';
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
      #poke-walk-app { position:fixed; inset:0; overflow:hidden; background:#11131a; color:#f0f4f8; font:17px system-ui,sans-serif; }
      #canvas-container, #game { width:100%; height:100%; display:block; }
      #game { image-rendering:pixelated; touch-action:none; outline:none; }
      #nearby { position:absolute; right:8px; bottom:8px; box-sizing:border-box; width:max-content; max-width:min(57vw,380px); max-height:40vh; overflow:auto; padding:4px; border:12px solid transparent; border-image-repeat:stretch; background:rgb(0 0 0 / 50%) padding-box; }
      #nearby p { margin:3px 0; }
      #poke-walk-app .portrait, #poke-walk-app .essence { image-rendering:pixelated; vertical-align:middle; }
      #poke-walk-app .essence { width:38.4px; height:38.4px; }
      #roster { position:absolute; top:92px; right:8px; max-width:44vw; max-height:56vh; overflow:auto; color:white; font-size:15px; }
      #roster ul { margin:4px 0; padding:0; list-style:none; display:grid; gap:3px; }
      #roster li, #rewards button { border:8px solid transparent; border-image:url("${new URL('../assets/ui/textbox-b.png', import.meta.url).href}") 16 stretch; background-clip:padding-box; }
      #roster li { display:grid; grid-template-columns:44px 1fr; gap:1px 5px; background-color:#141c27db; font-variant-numeric:tabular-nums; }
      #roster .portrait { width:44px; grid-row:span 2; }
      #rewards { padding:4px; width:max-content; max-width:none; max-height:none; overflow:visible; background:transparent; border:0; color:white; }
      #rewards::backdrop { background:#080d16b0; }
      #rewards h1 { margin:0 0 5px; font:600 22px system-ui; text-align:center; }
      #rewards .cards { display:flex; gap:5px; align-items:stretch; }
      #rewards button { flex:1 1 0; width:clamp(180px,29vw,300px); min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px; background-color:#223040; color:white; font:18px/1.32 system-ui; cursor:pointer; }
      #rewards button:focus-visible, #rewards button:hover { outline:2px solid #d4efff; outline-offset:-4px; }
      #rewards .portrait { width:80px; height:80px; }
      #rewards table { width:100%; margin:4px 0; border-collapse:collapse; font:inherit; font-variant-numeric:tabular-nums; }
      #rewards td { padding:2px 1px; text-align:right; border-bottom:1px solid #ffffff24; }
      #rewards td:first-child { text-align:left; }
      #rewards .evolutions { width:100%; margin-top:auto; text-align:left; font-size:13px; }
      #rewards .evolutions div { display:flex; align-items:center; gap:2px; }
      #rewards progress { flex:1; min-width:8px; height:10px; accent-color:#a4ddab; }
      #rewards .keep-form { width:auto; margin:8px auto 0; flex-direction:row; gap:8px; }
      #rewards .keep-form .portrait { width:44px; height:44px; }
      @media(max-width:440px) { #rewards button { padding:1px; border-width:5px; font-size:15px; } }
      #poke-walk-app #loading { position:absolute; inset:0; background:rgba(17,19,26,.9); display:flex; align-items:center; justify-content:center; font-size:1.25rem; z-index:10; }
      #poke-walk-app #toast { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(220,38,38,.92); color:#fff; padding:5px 12px; border-radius:6px; font-size:1.05rem; font-weight:600; display:none; z-index:12; }
      #poke-walk-app .box { border:8px solid transparent; border-image:url("${new URL('../assets/ui/textbox-b.png', import.meta.url).href}") 16 stretch; background:rgb(12 20 34 / 82%) padding-box; color:white; }
      #poke-walk-app #toast { background:rgb(12 20 34 / 88%) padding-box; }
      #poke-walk-app #loading { inset:50% auto auto 50%; transform:translate(-50%,-50%); padding:7px; width:max-content; max-width:85vw; }
      @media(max-width:579px) { #roster { top:110px; } }
      #inventory,#benefits,#item-tip,#nearby,#rewards,#toast,#loading { zoom:.8; }
      #roster { zoom:1.2; }
      #inventory,#benefits { position:absolute; display:grid; pointer-events:none; gap:1px; }
      #inventory { left:min(223px,38vw); right:min(30vw,380px); bottom:8px;
        grid-template-columns:repeat(25,minmax(0,1fr)); align-items:end; }
      #benefits { left:8px; top:29%; --benefit-side:min(50px,4.6dvh);
        grid-auto-flow:column; grid-template-rows:repeat(9,var(--benefit-side));
        grid-template-columns:repeat(3,var(--benefit-side)); }
      #inventory img,#benefits img { object-fit:contain; pointer-events:auto; image-rendering:pixelated; }
      #inventory img { width:100%; max-width:50px; aspect-ratio:1; }
      #benefits img { width:var(--benefit-side); height:var(--benefit-side); }
      #item-tip { position:absolute; left:205px; bottom:80px; max-width:440px; pointer-events:none; }
      #benefits .active-benefit { position:relative; display:inline-flex; }
      #benefits .active-benefit::before { content:attr(data-key); position:absolute; z-index:1; color:white; background:#182333; padding:0 3px; font:bold 12px system-ui; }
      #benefits .active-benefit::after { content:""; position:absolute; inset:0; border-radius:50%; pointer-events:none; background:conic-gradient(rgb(5 10 20 / 70%) var(--remaining,0deg),transparent 0); }
    </style>
    <div id="canvas-container"><canvas id="game" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="toast" class="box" role="status"></div><div id="loading" class="box">Cargando Pokémon y mazmorra...</div></div>
    <aside id="nearby" class="box" hidden aria-live="polite"></aside>
    <aside id="roster" aria-label="Pokémon del piso"><ul></ul></aside>
    <aside id="benefits" aria-label="Beneficios de especie"></aside>
    <section id="inventory" aria-label="Objetos obtenidos"></section>
    <div id="item-tip" class="box" role="tooltip" hidden></div>
    <dialog id="rewards" aria-labelledby="reward-title"><h1 id="reward-title">Mejoras</h1><div class="cards"></div></dialog>
  </div>`;

// Monta el canvas y los paneles una sola vez en el contenedor del juego.
function mountApp(root) {
  if (root.querySelector('#game')) return;
  root.innerHTML = EMBEDDED_APP;
}

// El portal sustituye un suelo común y nunca se genera bajo el jugador.
function placePortal(playerTileX, playerTileY, kind) {
  const floors = [];
  game.grid.forEach((row, y) =>
    row.forEach((terrain, x) => {
      if (
        terrain === 0 &&

        !game.drops.some(drop => Math.floor(drop.x / TILE) === x && Math.floor(drop.y / TILE) === y) &&
        (x !== playerTileX || y !== playerTileY)
      ) {
        floors.push({ x, y, kind, entered: false });
      }
    }),
  );
  game.portal = floors[Math.floor(Math.random() * floors.length)];
}

// Pausa los controles y gestiona el paso de piso o la selección de mejora y el cambio de misión.
async function nextLevel() {
  game.changingLevel = true;
  game.keys = Object.create(null);
  game.canvas.blur();
  const previousBiome = game.currentBiome;
  const previousTileset = game.tileSheet;
  try {
    const mission = game.mission;
    if (game.portal.kind === 'stairs') {
      game.loadingEl.style.display = 'flex';
      await loadLevel(game.player.dex, mission, game.floor + 1);
    } else {
      // Simulamos ambas elecciones para cobrar esencias y cambiar de activo
      // solo cuando la siguiente misión se ha cargado con éxito.
      let state = { held:game.held, bonuses:game.player.bonuses, balances:game.essences,
        row:game.pokemon.get(game.player.dex), essence:game.formEssence };
      for (let choiceIndex=0; choiceIndex < (state.held.has('facechanger')?2:1); choiceIndex++) {
        const options = rewardOptions(state.row,state.balances,state.essence);
        if (choiceIndex && !options.length) {
          state = projectReward(state,{row:state.row,essence:state.essence,bonus:true});
          break;
        }
        const option = await chooseReward(options,state,choiceIndex>0);
        if (option) state = projectReward(state,option);
      }
      game.loadingEl.style.display = 'flex';
      const biome = chooseBiome(game.biomes.filter(biomeCandidate => biomeCandidate.id !== mission.biome.id), mission.number + 1);
      const nextMission = newMission(mission.number + 1, biome, levelFor(state.row,game.progress));
      await changeBiome(biome);
      const previousHeld = game.held;
      game.held = state.held;
      try { await loadLevel(state.row.dex,nextMission,1,state.bonuses); }
      catch (error) { game.held = previousHeld; throw error; }
      game.essences=state.balances;
      game.formEssence=state.essence;
    }
    if (document.hasFocus()) game.canvas.focus();
  } catch (error) {
    game.currentBiome = previousBiome;
    game.tileSheet = previousTileset;
    showToast(error.message);
    if (document.hasFocus()) game.canvas.focus();
  } finally {
    game.loadingEl.style.display = 'none';
    game.changingLevel = false;
  }
}

// El panel comparte los valores de combate y solo cambia el DOM cuando varían.
function updateRoster() {
  const rosterList = document.querySelector('#roster ul');
  const livingEnemies = game.entities.filter(combatant => !combatant.isPlayer && combatant.hp > 0);
  // Conservamos el nodo y el retrato durante los cambios de PV.
  for (const rosterCard of Array.from(rosterList.children)) if (!livingEnemies.includes(rosterCard.combatant)) rosterCard.remove();
  for (const enemy of livingEnemies) {
    const species = game.pokemon.get(enemy.dex);
    let rosterCard = enemy.rosterCard;
    if (!rosterCard || rosterCard.parentNode !== rosterList) {
      rosterCard = element('li');
      rosterCard.combatant = enemy;
      enemy.rosterCard = rosterCard;
      const [first, second] = species.essences;
      rosterCard.style.backgroundColor = tones[first];
      if (second) rosterCard.style.backgroundImage = 'linear-gradient(135deg,' + tones[first] + ' 50%,' + tones[second] + ' 50%)';
      rosterCard.setAttribute('aria-label', species.name + ' · ' + species.essences.join(', '));
      rosterCard.title = species.essences.join(' / ');
      rosterCard.append(portrait(species), element('strong', species.name + (enemy.boss ? ' · Líder' : '')), element('span'));
      rosterList.append(rosterCard);
    }
    const stats = 'HP ' + enemy.hp + '/' + enemy.stats.hpMax + ' · ATQ ' + enemy.stats.attack + ' · DEF ' + enemy.stats.defense;
    if (rosterCard.children[2].textContent !== stats) rosterCard.children[2].textContent = stats;
  }
}

// Agrupa duplicados y actualiza el panel solo al entrar o salir de su radio.
function updateNearby() {
  const panel = document.getElementById('nearby');
  const counts = new Map();
  for (const drop of game.drops) {
    if (Math.hypot(drop.x - game.player.x, drop.y - game.player.y) <= 3 * TILE)
      {
        const key = drop.id ?? 'essence-' + drop.essence;
        counts.set(key, (counts.get(key) || 0) + (drop.amount ?? 1));
      }
  }
  const objectivePortal = game.portal;
  if (objectivePortal?.kind === 'objective' && Math.hypot((objectivePortal.x + .5) * TILE - game.player.x, (objectivePortal.y + .5) * TILE - game.player.y) <= 3 * TILE)
    counts.set('parcel', 1);
  const signature = JSON.stringify([...counts]);
  if (panel.dataset.signature === signature) return;
  panel.dataset.signature = signature;
  panel.hidden = !counts.size;
  panel.replaceChildren(...Array.from(counts, ([id, count]) => {
    const descriptionParagraph = document.createElement('p');
    const item = game.items[id] ?? (id.startsWith('essence-') ? { name: 'Esencia ' + id.slice(8), description: 'Recógela para acumularla.' } : { name: 'Objeto de misión', description: 'Recógelo para desbloquear el teletransportador.' });
    descriptionParagraph.textContent = item.name + (count > 1 ? ' ×' + count : '') + ' · ' + item.description;
    return descriptionParagraph;
  }));
}

// Ejecuta pasos fijos, procesa recogidas y objetivos y solicita el siguiente repintado.
function frame(timestamp) {
  advanceClock(timestamp, game.changingLevel, () => {
    if (game.changingLevel) return;
    tickAbilities();
    game.entities.forEach(updateEntity);
  });
  if (!game.changingLevel) {
    collectItems(game.player);
    const simulationTime = gameTime();
    game.entities = game.entities.filter(
      (entity) => entity.hp > 0 || simulationTime - entity.deathAt < FADE_MS,
    );
    updateRoster();
    updateNearby();
    game.updateInventory();
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
            pickupEffect(player,'boost');
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

// Prepara interfaz y catálogos, inicia la primera misión y enlaza el ciclo de vida del juego.
export async function startGame({
  root = document.querySelector('#game-root') || document.body,
} = {}) {
  root.__pokeWalkCleanup?.();
  resetGameState();
  resetClock();
  mountApp(root);
  const icon = document.querySelector('link[rel~="icon"]') ?? document.createElement('link');
  icon.rel = 'icon';
  icon.href = new URL('../assets/benefits/cog.png',import.meta.url).href;
  document.head.append(icon);
  game.canvas = document.getElementById('game');
  game.ctx = game.canvas.getContext('2d');
  game.loadingEl = document.getElementById('loading');
  game.toastEl = document.getElementById('toast');
  // Adapta el búfer del canvas al tamaño real de la ventana y vuelve a dibujar.
  const resize = () => {
    game.canvas.width = Math.max(1, game.canvas.clientWidth);
    game.canvas.height = Math.max(1, game.canvas.clientHeight);
    draw();
  };
  resize();
  const benefitsUrl = new URL('./data/benefits.json',import.meta.url);
  const [synergies, benefits] = await Promise.all([fetch(new URL('./data/synergies.json',import.meta.url)).then(response=>response.json()),fetch(benefitsUrl).then(response=>response.json()),preparePortal(),loadHud(),loadTerrain(),loadEffects()]);
  game.synergies = new Map(synergies.map(rule=>[rule.effect,rule]));
  game.benefits = new Map(benefits.map(benefit=>[benefit.id,benefit]));
  game.donors = new Map();
  for (const benefit of benefits) for (const name of benefit.pokemon) {
    if (game.donors.has(name)) throw new Error('Beneficio duplicado para '+name);
    game.donors.set(name,benefit);
  }
  const { pokemon, items } = await loadEncountersCatalog();
  const biomes = await loadBiomes(pokemon);
  game.biomes = biomes;
  game.pokemon = pokemon;
  game.items = items;
  await loadItemImages(items);
  game.progress = 5;
  game.xp = 0;
  game.cooldownDurations = {};
  game.amuletUntil = 0;
  game.adventure = 0;
  game.inventory = new Set();
  game.essences = {};
  game.pickups = [];
  game.held = new Set();
  game.cooldowns = {};
  game.formEssence = null;
  const biome = chooseBiome(biomes, 1);
  await changeBiome(biome);
  await loadLevel(DEFAULT_DEX, newMission(1, biome, levelFor(pokemon.get(DEFAULT_DEX), 5)), 1);
  const input = attachInput();
  game.updateInventory = attachInventory(root, input.signal);
  const observer = new ResizeObserver(resize);
  observer.observe(game.canvas);
  // Libera observador, entradas y temporizadores si se vuelve a montar el juego.
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
