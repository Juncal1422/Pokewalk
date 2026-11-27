import { loadInterfaceStylesheet, readCanvasTheme } from './core/interface-theme.js';
import { assetUrl } from './core/asset-url.js';
import { warmGuildBackgrounds, visitGuild, selectMission, guildMessage } from './core/guild.js';
import {
  loadCollection,
  beginChronicle,
  recordFloor,
  settleMission,
  checkpoint,
  discover,
} from './core/collection.js';
import { playSound } from './core/audio.js';
import { gameTime, resetClock, advanceClock } from './core/clock.js';
import {rule} from './core/modifiers.js';
import { attackReach, levelFor } from './core/stats.js';
import { loadTerrain } from './core/terrain.js';
import { attachInventory } from './core/inventory.js';
import { missionOffers, exitKind, rewardOptions } from './core/missions.js';
import { collectItems, loadItemImages, refreshEssenceAttack } from './core/items.js';
import { element, portrait } from './core/pokemon-panel.js';
import { loadEncountersCatalog } from './data/encounters.js';
import { chooseReward } from './core/rewards.js';
import { projectReward } from './core/benefits.js';
import { loadEffects, tickAbilities, pickupEffect } from './core/abilities.js';
import { loadHud, essenceNames } from './core/hud.js';
import { loadBiomes } from './data/biomes.js';
import { DEFAULT_DEX, FADE_MS, TILE } from './core/constants.js';
import { updateEntity, loadLevel, showToast } from './core/entities.js';
import { attachInput } from './core/input.js';
import { changeBiome, draw, preparePortal } from './core/renderer.js';
import { game, resetGameState } from './core/state.js';

const EMBEDDED_APP = `
  <div id="poke-walk-app">
    <div id="dungeon-viewport"><canvas id="dungeon-canvas" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="dungeon-notice" role="status" hidden></div></div>
    <aside id="nearby-loot-panel" hidden aria-live="polite"></aside>
    <aside id="floor-pokemon-panel" aria-label="Pokémon del piso"><ul></ul></aside>
    <button type="button" id="toggle-stats" aria-expanded="true">▾ Estadísticas</button>
    <aside id="species-benefit-panel" aria-label="Beneficios de especie"></aside>
    <section id="equipment-panel" aria-label="Objetos obtenidos"></section>
    <div id="equipment-tooltip" role="tooltip" hidden></div>
    <dialog id="guild-screen"></dialog><aside id="emblem-reward-notice" popover="manual"></aside>
    <dialog id="mission-upgrade-dialog" aria-labelledby="mission-upgrade-title"><h1 id="mission-upgrade-title">Mejoras</h1><div class="upgrade-options"></div></dialog>
  </div>`;

// Monta el canvas y los paneles una sola vez en el contenedor del juego.
function mountApp(root) {
  if (root.querySelector('#dungeon-canvas')) return;
  root.innerHTML = EMBEDDED_APP;
}

// El portal sustituye un suelo común y nunca se genera bajo el jugador.
function placePortal(playerTileX, playerTileY, kind) {
  const floors = [];
  const exitRadius = kind==='objective'?0:rule('exitRange')*attackReach(game.player.stats);
  game.grid.forEach((row, y) =>
    row.forEach((terrain, x) => {
      if (
        terrain === 0 &&
        !game.drops.some(
          (drop) =>
            Math.floor(drop.x / TILE) === x && Math.floor(drop.y / TILE) === y,
        ) &&
        (x !== playerTileX || y !== playerTileY)
      ) {
        floors.push({ x, y, kind, entered: false });
      }
    }),
  );
  const distance=tile=>Math.hypot((tile.x+.5)*TILE-game.player.x,(tile.y+.5)*TILE-game.player.y);
  const nearby=exitRadius?floors.filter(tile=>distance(tile)<=exitRadius):floors;
  game.portal=nearby.length?nearby[Math.floor(Math.random()*nearby.length)]:floors.sort((a,b)=>distance(a)-distance(b))[0];
  if(kind==='objective' && game.portal)playSound('itemGift');
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
      await loadLevel(game.player.dex, mission, game.floor + 1);
      if(game.runRelics.has('leftovers')) game.player.hp=Math.min(game.player.stats.hpMax,game.player.hp+1);
      recordFloor();
      playSound('stairs');
    } else {
      // Simulamos ambas elecciones para cobrar esencias y cambiar de activo
      // solo cuando la siguiente misión se ha cargado con éxito.
      let state = {
        held: game.held,
        bonuses: game.player.bonuses,
        balances: game.essences,
        row: game.pokemon.get(game.player.dex),
        essence: game.formEssence,
      };
      const earned = settleMission();
      if (earned && mission.type === 'leader' && game.inventory.has('ambrosia')) {
        game.player.hp=Math.min(game.player.stats.hpMax,game.player.hp+Math.ceil(game.player.stats.hpMax*game.items.ambrosia.leaderHeal));
        pickupEffect(game.player,'heal');playSound('berry');checkpoint();
      }
      if (earned) {
        playSound('reward');
        const notice = document.querySelector('#emblem-reward-notice'),
          image = new Image();
        image.src = assetUrl('../assets/ui/emblem.png', import.meta.url);
        notice.replaceChildren(image, ' +' + earned);
        setTimeout(() => notice.showPopover(), 0);
        setTimeout(() => notice.hidePopover(), 3000);
      }
      // settleMission ya ha guardado el pago y el resultado final en la misma crónica.
      if (game.chronicle.status === 'Exitosa') return;
      const selectedForms = [],
        selectedBenefits = [];
      for (
        let choiceIndex = 0;
        !mission.failed &&
        choiceIndex < (state.held.has('facechanger') ? 2 : 1);
        choiceIndex++
      ) {
        const options = rewardOptions(state.row, state.balances, state.essence);
        if (choiceIndex && !options.length) {
          state = projectReward(state, {
            row: state.row,
            essence: state.essence,
            bonus: true,
          });
          break;
        }
        const option = await chooseReward(options, state, choiceIndex > 0);
        if (option) {
          state = projectReward(state, option);
          selectedForms.push(state.row.dex);
          if (!state.allStats) selectedBenefits.push(state.benefit.id);
        }
      }
      const nextMission = await selectMission(
        missionOffers(1 + game.chronicle.missions.filter(m => m.status === 'Exitosa').length, levelFor(state.row, game.progress),state.held),
      );
      await changeBiome(nextMission.biome);
      const previousHeld = game.held;
      game.held = state.held;
      try {
        await loadLevel(state.row.dex, nextMission, 1, state.bonuses);
      } catch (error) {
        game.held = previousHeld;
        throw error;
      }
      game.essences = state.balances;
      refreshEssenceAttack();
      game.formEssence = state.essence;
      for (const dex of selectedForms) discover('forms', dex);
      for (const benefit of selectedBenefits) discover('benefits', benefit);
      recordFloor();
    }
    if (document.hasFocus()) game.canvas.focus();
  } catch (error) {
    game.currentBiome = previousBiome;
    game.tileSheet = previousTileset;
    showToast(error.message);
    if (document.hasFocus()) game.canvas.focus();
  } finally {
    game.changingLevel = false;
  }
}

// Las flechas cambian la ventana de tarjetas sin desplazar el documento.
function pagePanel(panel, list, pageSize) {
  const entries = Array.from(list.children),
    pages = Math.ceil(entries.length / pageSize);
  const page = Math.max(
    0,
    Math.min(Number(panel.dataset.page) || 0, pages - 1),
  );
  panel.dataset.page = String(page);
  entries.forEach((entry, index) => {
    entry.hidden = Math.floor(index / pageSize) !== page;
  });
  let nav = panel.querySelector('nav');
  if (!nav && pages > 1) {
    nav = element('nav');
    for (const [delta, arrow] of [
      [-1, 'w'],
      [1, 'e'],
    ]) {
      const control = element('button');
      control.type = 'button';
      control.setAttribute('aria-label', delta < 0 ? 'Anterior' : 'Siguiente');
      const img = new Image();
      img.alt = '';
      img.src = assetUrl(
        '../assets/ui/arrow_' + arrow + '.png',
        import.meta.url,
      );
      control.append(img);
      control.onclick = () => {
        panel.dataset.page = String(Number(panel.dataset.page) + delta);
        pagePanel(panel, list, Number(panel.dataset.size));
      };
      nav.append(control);
    }
    panel.append(nav);
  }
  panel.dataset.size = String(pageSize);
  if (nav) {
    nav.hidden = pages <= 1;
    nav.firstChild.disabled = page === 0;
    nav.lastChild.disabled = page >= pages - 1;
  }
}

// El panel comparte los valores de combate y solo cambia el DOM cuando varían.
function updateRoster() {
  const rosterList = document.querySelector('#floor-pokemon-panel ul');
  let rosterChanged=false;
  const livingEnemies = game.entities.filter(
    (combatant) => !combatant.isPlayer && combatant.hp > 0,
  );
  // Conservamos el nodo y el retrato durante los cambios de PV.
  for (const rosterCard of Array.from(rosterList.children))
    if (!livingEnemies.includes(rosterCard.combatant)) {rosterCard.remove();rosterChanged=true;}
  for (const enemy of livingEnemies) {
    const species = game.pokemon.get(enemy.dex);
    let rosterCard = enemy.rosterCard;
    if (!rosterCard || rosterCard.parentNode !== rosterList) {
      rosterCard = element('li');
      rosterCard.combatant = enemy;
      enemy.rosterCard = rosterCard;
      const [first, second] = species.essences;
      rosterCard.style.setProperty('--primary-essence-rgb', 'var(--essence-' + first + ')');
      if (second) {
        rosterCard.classList.add('dual-essence-card');
        rosterCard.style.setProperty('--secondary-essence-rgb', 'var(--essence-' + second + ')');
      }
      rosterCard.setAttribute(
        'aria-label',
        species.name + ' · ' + species.essences.join(', '),
      );
      rosterCard.title = species.essences.join(' / ');
      rosterCard.append(
        portrait(species),
        element(
          'strong',
          species.name +
            (enemy.ally ? ' · Aliado' : enemy.boss ? ' · Líder' : '') + (enemy.shiny ? ' ★' : ''),
        ),
        element('span'),
      );
      const benefit = game.donors.get(species.name);
      if (benefit) {
        const image = new Image();
        image.src = assetUrl('../' + benefit.image, import.meta.url).href;
        image.alt = image.title = benefit.name;
        image.className = 'floor-pokemon-benefit-icon';
        rosterCard.append(image);
      }
      rosterList.append(rosterCard);
      rosterChanged=true;
    }
    const stats =
      'HP ' +
      enemy.hp +
      '/' +
      enemy.stats.hpMax +
      ' · ATQ ' +
      enemy.stats.attack +
      ' · DEF ' +
      enemy.stats.defense;
    if (rosterCard.children[2].textContent !== stats)
      rosterCard.children[2].textContent = stats;
  }
  if(rosterChanged)pagePanel(rosterList.parentNode, rosterList, 9);
}

// Agrupa duplicados y actualiza el panel solo al entrar o salir de su radio.
function updateNearby() {
  const panel = document.getElementById('nearby-loot-panel');
  const counts = new Map();
  for (const drop of game.drops) {
    if (
      Math.hypot(drop.x - game.player.x, drop.y - game.player.y) <=
      3 * TILE
    ) {
      const key = drop.id ?? 'essence-' + drop.essence;
      counts.set(key, (counts.get(key) || 0) + (drop.amount ?? 1));
    }
  }
  const objectivePortal = game.portal;
  if (
    objectivePortal?.kind === 'objective' &&
    Math.hypot(
      (objectivePortal.x + 0.5) * TILE - game.player.x,
      (objectivePortal.y + 0.5) * TILE - game.player.y,
    ) <=
      3 * TILE
  )
    counts.set('parcel', 1);
  const signature = JSON.stringify([innerHeight, innerWidth, ...counts]);
  if (panel.dataset.signature === signature) return;
  panel.dataset.signature = signature;
  panel.hidden = !counts.size;
  const descriptions = element('section');
  panel.replaceChildren(descriptions);
  descriptions.replaceChildren(
    ...Array.from(counts, ([id, count]) => {
      const descriptionParagraph = document.createElement('p');
      const item =
        game.items[id] ??
        (id.startsWith('essence-')
          ? {
              name: 'Esencia ' + id.slice(8),
              description: 'Recógela para acumularla.',
            }
          : {
              name: 'Objeto de misión',
              description: 'Recógelo para desbloquear el teletransportador.',
            });
      descriptionParagraph.textContent =
        item.name + (count > 1 ? ' ×' + count : '') + ' · ' + item.description;
      return descriptionParagraph;
    }),
  );
  pagePanel(
    panel,
    descriptions,
    Math.max(1, Math.floor(((innerHeight * 0.4) / 1.4 - 40) / 80)),
  );
}

// Ejecuta pasos fijos, procesa recogidas y objetivos y solicita el siguiente repintado.
function frame(timestamp) {
  // Reinicia desde el límite entre fotogramas, cuando la transición del portal ya ha terminado.
  if (game.chronicle?.status === 'Exitosa') {
    void startGame({root:game.canvas.closest('#poke-walk-app').parentElement});
    return;
  }
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
      game.chronicle.status = 'Fallida';
      game.chronicle.ended = new Date().toISOString();
      if (game.chronicle.missions.at(-1).status === 'En curso')
        game.chronicle.missions.at(-1).status = 'Fallida';
      checkpoint();
      playSound('defeat');
      void startGame({
        root: game.canvas.closest('#poke-walk-app').parentElement,
      });
      return;
    }
    // Esperamos a que termine el último fundido antes de habilitar la salida.
    if (player.hp > 0) {
      const x = Math.floor(player.x / TILE),
        y = Math.floor(player.y / TILE);
      const kind = exitKind(
        game.mission,
        game.floor,
        game.entities.length === 1,
      );
      if (kind && game.portal?.kind !== kind) placePortal(x, y, kind);
      const portal = game.portal;
      if (portal) {
        const inside = portal.x === x && portal.y === y;
        if (inside && !portal.entered) {
          if (portal.kind === 'objective') {
            pickupEffect(player, 'boost');
            discover('items', 'parcel');
            checkpoint();
            playSound('item');
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
  await loadInterfaceStylesheet();
  const app = root.querySelector('#poke-walk-app');
  warmGuildBackgrounds(app.querySelector('#guild-screen'));
  app.style.removeProperty('--textbox-blue');
  game.frameColor = 'blue';
  game.statsCollapsed = false;
  const toggle=app.querySelector('#toggle-stats');
  toggle.textContent='▾ Estadísticas';
  toggle.setAttribute('aria-expanded','true');
  toggle.onclick=()=>{
    game.statsCollapsed=!game.statsCollapsed;
    toggle.setAttribute('aria-expanded',String(!game.statsCollapsed));
    toggle.textContent=(game.statsCollapsed?'▸':'▾')+' Estadísticas';
    game.canvas.focus();
  };
  game.canvasTheme = readCanvasTheme(app);
  await document.fonts.load('16px Wondermail');
  loadCollection();
  game.chronicle = null;
  const icon =
    document.querySelector('link[rel~="icon"]') ??
    document.createElement('link');
  icon.rel = 'icon';
  icon.href = assetUrl(
    '../assets/benefits/machinery.png',
    import.meta.url,
  ).href;
  document.head.append(icon);
  game.canvas = document.getElementById('dungeon-canvas');
  game.ctx = game.canvas.getContext('2d');
  game.toastEl = document.getElementById('dungeon-notice');
  game.toastEl.hidden = true;
  // Adapta el búfer del canvas al tamaño real de la ventana y vuelve a dibujar.
  const resize = () => {
    game.canvas.width = Math.max(1, game.canvas.clientWidth);
    game.canvas.height = Math.max(1, game.canvas.clientHeight);
    draw();
  };
  resize();
  const benefitsUrl = assetUrl('./data/benefits.json', import.meta.url);
  const [catalog,synergies, benefits] = await Promise.all([
    loadEncountersCatalog().then(async ({pokemon,items})=>{
      const biomes=await loadBiomes(pokemon);
      return {pokemon,items,biomes};
    }),
    fetch(assetUrl('./data/synergies.json', import.meta.url)).then((response) =>
      response.json(),
    ),
    fetch(benefitsUrl).then((response) => response.json()),

  ]);
  game.synergies = new Map(synergies.map((rule) => [rule.effect, rule]));
  game.benefits = new Map(benefits.map((benefit) => [benefit.id, benefit]));
  game.donors = new Map();
  for (const benefit of benefits)
    for (const name of benefit.pokemon) {
      if (game.donors.has(name))
        throw new Error('Beneficio duplicado para ' + name);
      game.donors.set(name, benefit);
    }
  const {pokemon,items,biomes}=catalog;
  game.biomes = biomes;
  game.pokemon = pokemon;
  game.items = items;

  game.progress = 5;
  game.xp = 0;
  game.cooldownDurations = {};
  game.amuletUntil = 0;
  game.adventure = 0;
  game.inventory = new Set();
  game.reviveSpent = false;
  game.essences = {};
  game.pickups = [];
  game.held = new Set();
  game.cooldowns = {};
  game.formEssence = null;
  game.batteryEnergy = 0;
  // Si falla un recurso remoto se puede volver al tablón sin abrir una crónica vacía.
  let battleResources;
  while (!game.player) {
    const visit = visitGuild();
    // El gremio ya está visible mientras se preparan los recursos de la primera mazmorra.
    battleResources ??= Promise.all([preparePortal(),loadHud(),loadTerrain(),loadEffects(),loadItemImages(items)])
      .then(() => null, error => error);
    await visit;
    const firstMission = await selectMission(missionOffers(1, 5));
    game.runRelics = new Set(game.collection.enabled);
    // Asignar el saldo inicial también hace idempotente un reintento de carga desde el gremio.
    game.essences = game.runRelics.has('debugger')
      ? Object.fromEntries(essenceNames.map((type) => [type, 100]))
      : {};
    try {
      const resourceError = await battleResources;
      if (resourceError) {
        battleResources = null;
        throw resourceError;
      }
      await changeBiome(firstMission.biome);
      await loadLevel(DEFAULT_DEX, firstMission, 1);
    } catch (error) {
      game.player = null;
      await guildMessage(error.message);
    }
  }
  beginChronicle();
  game.adventure = game.collection.history.length;
  recordFloor();
  game.canvas.focus();
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

if (document.querySelector('#dungeon-canvas') && !document.querySelector('#game-root'))
  startGame();
