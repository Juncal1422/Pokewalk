import { assetUrl } from './core/asset-url.js';
import { visitGuild, selectMission, guildMessage } from './core/guild.js';
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
import { levelFor } from './core/stats.js';
import { loadTerrain } from './core/terrain.js';
import { attachInventory } from './core/inventory.js';
import { missionOffers, exitKind, rewardOptions } from './core/missions.js';
import { collectItems, loadItemImages } from './core/items.js';
import { element, tones, portrait } from './core/pokemon-panel.js';
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
    <style>
      @font-face { font-family:Wondermail; src:url("${assetUrl('../assets/ui/wondermail.ttf', import.meta.url).href}") format('truetype'); }
      html *,html *::before,html *::after { font-family:Wondermail !important; scrollbar-width:none; }
      *::-webkit-scrollbar { display:none; }
      #guild { position:fixed; inset:0; max-width:none; max-height:none; width:100%; height:100%; margin:0; box-sizing:border-box;
        border:0; padding:clamp(6px,3vmin,30px); background:#111b26; color:#f2ecd7; overflow:hidden; }
      #guild[open] { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:min(1.4dvh,12px); }
      #guild h1,#guild p { margin:0; }
      #guild h1 { color:#0d4132;font-size:clamp(20px,5vmin,42px); }
      #guild button,#guild label,#guild .guild-list p { box-sizing:border-box; padding:clamp(3px,1vmin,12px); color:#fff; background:#24364a; border:2px solid #74938b; font-size:clamp(16px,3.5vmin,29px); }
      #guild button { cursor:pointer; } #guild button:disabled { opacity:.65; }
      #guild .offers { width:min(850px,97%);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2vmin; }
      #guild .offers button { border:8px solid transparent; border-image:url("${assetUrl('../assets/ui/textbox-g.png', import.meta.url).href}") 16 stretch; display:grid;justify-items:center;align-content:center;gap:1vmin; }
      #guild .offers .red { background-color:#531e26; }
      #guild img { width:clamp(20px,5vmin,44px);vertical-align:middle;image-rendering:pixelated; }
      #guild .offers .portrait {width:clamp(15px,4.5vmin,38px);}
      #guild .guild-list { display:grid;gap:4px;max-width:min(94vw,800px); }
      #guild .catalog-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(22vw,120px),1fr));gap:1vmin;width:min(92vw,800px);}
      #guild .catalog-grid button {display:grid;justify-items:center;align-content:center;min-width:0;font-size:clamp(12px,2.6vmin,23px);}
      #guild .catalog-grid img {width:clamp(26px,7vmin,70px);}
      #guild .contracts {width:min(98vw,1200px);grid-template-columns:repeat(var(--cards),minmax(0,1fr));}
      @media(max-aspect-ratio:1/1){#guild .contracts {grid-template-columns:repeat(2,minmax(0,1fr));}}
      #guild .offers button,#guild .letterbox,#guild .offers .red {background-clip:padding-box;}
      #guild .offers .red {border-image-source:url("${assetUrl('../assets/ui/textbox-p.png', import.meta.url).href}");}
      #guild nav {display:flex;align-items:center;gap:10px;}
      #guild.story {background:black;} #guild .letterbox { text-align:left;width:min(760px,96%);min-height:5em;background:#15211d padding-box;
       border:12px solid transparent;border-image:url("${assetUrl('../assets/ui/textbox-g.png', import.meta.url).href}") 16 stretch; }
      #guild strong {color:#f0cf7e;}
      #emblem-award {position:fixed;inset:65px 8px auto auto;margin:0;color:white;background:#192b39;border:2px solid #91a886;pointer-events:none;font-size:22px;}
      #emblem-award img {width:24px;vertical-align:middle;image-rendering:pixelated;}
      html, body { margin:0; width:100%; height:100%; overflow:hidden; }
      #poke-walk-app { position:fixed; inset:0; overflow:hidden; background:#11131a; color:#f0f4f8; font:17px Wondermail; }
      #canvas-container, #game { width:100%; height:100%; display:block; }
      #game { image-rendering:pixelated; touch-action:none; outline:none; }
      #nearby { position:absolute; right:8px; bottom:8px; box-sizing:border-box; width:max-content; max-width:min(57vw,380px); max-height:40vh; overflow:hidden; padding:4px; border:12px solid transparent; border-image-repeat:stretch; background:rgb(0 0 0 / 50%) padding-box; }
      #nearby p { margin:3px 0; }
      #poke-walk-app .portrait, #poke-walk-app .essence { image-rendering:pixelated; vertical-align:middle; }
      #poke-walk-app .essence { width:38.4px; height:38.4px; }
      #roster { position:absolute; top:92px; right:8px; max-width:44vw; max-height:56vh; overflow:hidden; color:white; font-size:15px; }
      #roster ul { margin:4px 0; padding:0; list-style:none; display:grid; gap:3px; }
      #roster li, #rewards button { border:8px solid transparent; border-image:url("${assetUrl('../assets/ui/textbox-b.png', import.meta.url).href}") 16 stretch; background-clip:padding-box; }
      #roster li { display:grid; grid-template-columns:44px 1fr; gap:1px 5px; background-color:#141c27db; font-variant-numeric:tabular-nums; }
      #roster [hidden],#nearby [hidden] {display:none!important;}
      #roster nav img,#nearby nav img {width:18px;height:18px;}
      #roster nav button,#nearby nav button {background:#192b39;border:1px solid #789486;}
      #roster .portrait { width:44px; grid-row:span 2; }
      #rewards { padding:4px; width:max-content; max-width:none; max-height:none; overflow:visible; background:transparent; border:0; color:white; }
      #rewards::backdrop { background:#080d16b0; }
      #rewards h1 { margin:0 0 5px; font:600 22px Wondermail; text-align:center; }
      #rewards .cards { display:flex; gap:5px; align-items:stretch; }
      #rewards button { flex:1 1 0; width:clamp(180px,29vw,300px); min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px; background-color:#223040; color:white; font:18px/1.32 Wondermail; cursor:pointer; }
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
      #poke-walk-app .box { border:8px solid transparent; border-image:url("${assetUrl('../assets/ui/textbox-b.png', import.meta.url).href}") 16 stretch; background:rgb(12 20 34 / 82%) padding-box; color:white; }
      #poke-walk-app #toast { background:rgb(12 20 34 / 88%) padding-box; }
      #poke-walk-app #loading { inset:50% auto auto 50%; transform:translate(-50%,-50%); padding:7px; width:max-content; max-width:85vw; }
      @media(max-width:579px) { #roster { top:110px; } }
      #inventory,#benefits,#item-tip,#nearby,#rewards,#toast,#loading { zoom:1; }
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
      #benefits .active-benefit::before { content:attr(data-key); position:absolute; z-index:1; color:white; background:#182333; padding:0 3px; font:bold 12px Wondermail; }
      #benefits .active-benefit::after { content:""; position:absolute; inset:0; border-radius:50%; pointer-events:none; background:conic-gradient(rgb(5 10 20 / 70%) var(--remaining,0deg),transparent 0); }
      #poke-walk-app {--blue:url("${assetUrl('../assets/ui/textbox-b.png', import.meta.url)}");--green:url("${assetUrl('../assets/ui/textbox-g.png', import.meta.url)}");--pink:url("${assetUrl('../assets/ui/textbox-p.png', import.meta.url)}");}
      #guild,#rewards,#emblem-award,#poke-walk-app nav,#poke-walk-app button,#guild .guild-list,#guild .species-card,#guild label,#guild .catalog-grid,#guild .contracts,#guild .catalog-tip {
        border:6px solid transparent;border-image:var(--blue) 16 stretch;background-clip:padding-box;box-sizing:border-box;
      }
      #guild button,#guild .offers button,#guild .letterbox {border:6px solid transparent;border-image:var(--green) 16 stretch;background-clip:padding-box;}
      #guild .offers .red {border-image-source:var(--pink);}
      #guild .catalog-board {width:min(93vw,71dvh);aspect-ratio:1;box-sizing:border-box;display:grid;grid-template:repeat(8,minmax(0,1fr))/repeat(8,minmax(0,1fr));border:clamp(6px,2vmin,16px) solid transparent;border-image:var(--catalog-art) 48 stretch;image-rendering:pixelated;}
      #guild .catalog-board>* {min-width:0;min-height:0;padding:0;background:var(--catalog-art) center/300% 300% no-repeat padding-box;display:grid;place-items:center;}
      #guild .catalog-board button {border:2px solid transparent;border-image:var(--blue) 16 stretch;}
      #guild .catalog-board img {width:74%;height:74%;object-fit:contain;}
      #guild .catalog-board [aria-pressed=true] {border-image-source:var(--pink);}
      #guild .catalog-tip,#poke-walk-app #item-tip {background:rgb(6 12 20 / 20%) padding-box;text-shadow:0 1px 2px black;color:white;pointer-events:none;}
      #guild .catalog-tip {position:absolute;bottom:1%;right:1%;max-width:min(520px,90vw);padding:5px;z-index:3;}
      #guild .catalog-tip[hidden]{display:none;}
      #inventory,#benefits,#toast,#loading,#emblem-award {zoom:1.2;}
      #roster {zoom:1.08;}
      #nearby {zoom:1.4;max-width:min(41vw,380px);max-height:28.5vh;}
      #guild {zoom:1.2;}
      #guild .contracts {width:min(100%,1200px);}
      #guild .catalog-board {width:min(100%,59dvh);}
      #guild:has(.contracts),#guild .contracts,#rewards,#guild .catalog-board,#guild .catalog-board button,#guild .catalog-grid {border:0;border-image:none;}
      #guild .catalog-board [aria-pressed=true] {outline:2px solid #eca6ca;outline-offset:-2px;}
      #guild .catalog-tip,#poke-walk-app #item-tip {position:fixed;inset:auto;width:max-content;max-width:min(440px,78vw);font-size:22px;line-height:1.18;overflow-wrap:anywhere;z-index:20;}
      #guild {background-size:cover;background-position:center;border:0;}
      #guild .guild-list,#poke-walk-app nav,#roster nav button {border:0;border-image:none;background:transparent;}
      #guild .run-record {flex:none;width:min(760px,78vw);color:white;background:#111a24cc;padding:8px;box-sizing:border-box;}
      #guild .run-record img {width:28px;height:28px;object-fit:contain;vertical-align:middle;}
      #guild .run-record ol {columns:2;margin:5px 0;padding-left:2em;}
      #guild .run-record li {break-inside:avoid;}
      #guild .catalog-tip,#poke-walk-app #item-tip,#poke-walk-app #nearby {background-color:rgb(0 0 0 / 50%);}
      #roster {max-height:none;max-width:min(52vw,740px);}
      #roster ul {grid-auto-flow:column;grid-template-rows:repeat(3,auto);}
      #roster li {grid-template-columns:auto minmax(0,1fr) auto;font-size:clamp(10px,1.7vmin,15px);}
      #roster .portrait {grid-column:1;grid-row:1/3;width:clamp(20px,4vmin,44px);}
      #roster li strong,#roster li span {grid-column:2;}
      #roster .roster-benefit {grid-column:3;grid-row:1/3;align-self:center;width:clamp(14px,2.8vmin,26px);}
      @media(max-width:680px){#roster ul{grid-template-rows:repeat(5,auto);}#roster li{gap:0;border-width:3px;}}
      #rewards::backdrop {background:#101923 url("${assetUrl('../assets/ui/bgdefault.png', import.meta.url)}") center/cover;}
    </style>
    <div id="canvas-container"><canvas id="game" tabindex="0" aria-label="Mazmorra de PokeWalk" width="1750" height="800"></canvas><div id="toast" class="box" role="status"></div></div>
    <aside id="nearby" class="box" hidden aria-live="polite"></aside>
    <aside id="roster" aria-label="Pokémon del piso"><ul></ul></aside>
    <aside id="benefits" aria-label="Beneficios de especie"></aside>
    <section id="inventory" aria-label="Objetos obtenidos"></section>
    <div id="item-tip" class="box" role="tooltip" hidden></div>
    <dialog id="guild"></dialog><aside id="emblem-award" popover="manual"></aside>
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
      if (earned) {
        playSound('reward');
        const notice = document.querySelector('#emblem-award'),
          image = new Image();
        image.src = assetUrl('../assets/ui/emblem.png', import.meta.url);
        notice.replaceChildren(image, ' +' + earned);
        setTimeout(() => notice.showPopover(), 0);
        setTimeout(() => notice.hidePopover(), 3000);
      }
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
      game.loadingEl.style.display = 'flex';
      const nextMission = await selectMission(
        missionOffers(mission.number + 1, levelFor(state.row, game.progress)),
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
    game.loadingEl.style.display = 'none';
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
  const rosterList = document.querySelector('#roster ul');
  const livingEnemies = game.entities.filter(
    (combatant) => !combatant.isPlayer && combatant.hp > 0,
  );
  // Conservamos el nodo y el retrato durante los cambios de PV.
  for (const rosterCard of Array.from(rosterList.children))
    if (!livingEnemies.includes(rosterCard.combatant)) rosterCard.remove();
  for (const enemy of livingEnemies) {
    const species = game.pokemon.get(enemy.dex);
    let rosterCard = enemy.rosterCard;
    if (!rosterCard || rosterCard.parentNode !== rosterList) {
      rosterCard = element('li');
      rosterCard.combatant = enemy;
      enemy.rosterCard = rosterCard;
      const [first, second] = species.essences;
      rosterCard.style.backgroundColor = tones[first];
      if (second)
        rosterCard.style.backgroundImage =
          'linear-gradient(135deg,' +
          tones[first] +
          ' 50%,' +
          tones[second] +
          ' 50%)';
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
            (enemy.ally ? ' · Aliado' : enemy.boss ? ' · Líder' : ''),
        ),
        element('span'),
      );
      const benefit = game.donors.get(species.name);
      if (benefit) {
        const image = new Image();
        image.src = assetUrl('../' + benefit.image, import.meta.url).href;
        image.alt = image.title = benefit.name;
        image.className = 'roster-benefit';
        rosterCard.append(image);
      }
      rosterList.append(rosterCard);
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
  pagePanel(rosterList.parentNode, rosterList, 9);
}

// Agrupa duplicados y actualiza el panel solo al entrar o salir de su radio.
function updateNearby() {
  const panel = document.getElementById('nearby');
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
      game.chronicle.status = 'Rescatada';
      game.chronicle.ended = new Date().toISOString();
      if (game.chronicle.missions.at(-1).status === 'En curso')
        game.chronicle.missions.at(-1).status = 'Derrota';
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
  const benefitsUrl = assetUrl('./data/benefits.json', import.meta.url);
  const [synergies, benefits] = await Promise.all([
    fetch(assetUrl('./data/synergies.json', import.meta.url)).then((response) =>
      response.json(),
    ),
    fetch(benefitsUrl).then((response) => response.json()),
    preparePortal(),
    loadHud(),
    loadTerrain(),
    loadEffects(),
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
  game.reviveSpent = false;
  game.essences = {};
  game.pickups = [];
  game.held = new Set();
  game.cooldowns = {};
  game.formEssence = null;
  game.batteryEnergy = 0;
  // Si falla un recurso remoto se puede volver al tablón sin abrir una crónica vacía.
  while (!game.player) {
    await visitGuild();
    const firstMission = await selectMission(missionOffers(1, 5));
    game.runRelics = new Set(game.collection.enabled);
    // Asignar el saldo inicial también hace idempotente un reintento de carga desde el gremio.
    game.essences = game.runRelics.has('debugger')
      ? Object.fromEntries(essenceNames.map((type) => [type, 100]))
      : {};
    try {
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

if (document.querySelector('#game') && !document.querySelector('#game-root'))
  startGame();
