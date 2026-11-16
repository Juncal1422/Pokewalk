/* Interfaz sin estilos. Todo el texto de datos pasa por textContent (no innerHTML). */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;

  function el(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function line(parent, tag, text) {
    const node = el(tag, text);
    parent.appendChild(node);
    return node;
  }
  function button(parent, label, action, disabled) {
    const node = el('button', label);
    node.type = 'button';
    node.disabled = Boolean(disabled);
    node.addEventListener('click', action);
    parent.appendChild(node);
    return node;
  }
  function section(parent, title) {
    const node = el('section');
    line(node, 'h2', title);
    parent.appendChild(node);
    return node;
  }
  function name(pokemon) { return game.data.species[pokemon.speciesId].name; }
  function message(action) {
    try { action(); } catch (err) { game.ui.setStatus('Error: ' + err.message); }
    game.ui.render();
  }

  function renderStart(root) {
    const first = section(root, 'Elegir starter');
    line(first, 'p', 'Cada starter comienza con 2 movimientos. Elige uno para iniciar la run.');
    for (const id of game.data.starters) {
      const species = game.data.species[id];
      const moves = species.moves.map(moveId => game.data.moves[moveId].name).join(', ');
      button(first, species.name + ' — ' + moves, () => message(() => {
        game.app.run = game.state.createRun(id);
        game.ui.setStatus('Nueva run iniciada.');
      }));
    }
  }
  function renderTeam(root, run) {
    const area = section(root, 'Equipo Pokémon');
    const list = el('ul');
    for (const p of run.team) {
      const active = p.id === run.activePokemonId ? ' [activo]' : '';
      const node = el('li', name(p) + active + ' — PS ' + p.hp + '/' + p.maxHp + ' — movimientos: ' + p.moveIds.map(id => game.data.moves[id].name).join(', '));
      list.appendChild(node);
    }
    area.appendChild(list);
    line(area, 'p', 'Mochila: ' + run.bag.berries + ' bayas.');
    button(area, 'Usar baya (+12 PS)', () => message(() => game.engine.useBerry(run)), run.bag.berries < 1 || !['map','battle'].includes(run.phase));
  }
  function renderProgress(root, run) {
    const area = section(root, 'Progreso');
    line(area, 'p', 'Etapa: ' + game.engine.stageLabel(run));
    line(area, 'p', 'Medallas: ' + run.badges.length + '/8' + (run.badges.length ? ' — ' + run.badges.join(', ') : ''));
    line(area, 'p', 'Liga: ' + run.leagueWins + '/5 combates completados (4 Alto Mando + Campeón).');
    line(area, 'p', 'Estado de la run: ' + run.phase);
    line(area, 'p', run.message);
  }
  function renderMap(root, run) {
    const area = section(root, 'Mapa / siguiente encuentro');
    line(area, 'p', 'No existe aún un mapa visual. Este botón inicia el encuentro de prueba de la etapa actual.');
    button(area, 'Iniciar combate — ' + game.engine.stageLabel(run), () => message(() => game.engine.startBattle(run)));
  }
  function renderBattle(root, run) {
    const battle = run.battle;
    const area = section(root, 'Combate (demostración)');
    line(area, 'h3', battle.enemyName);
    line(area, 'p', 'Rival: ' + battle.enemyHp + '/' + battle.enemyMaxHp + ' PS · Turno ' + battle.turns);
    const hand = section(area, 'Movimientos en mano (máximo 4)');
    if (!battle.hand.length) line(hand, 'p', 'No quedan movimientos disponibles. Puedes abandonar la run.');
    for (const card of battle.hand) {
      const move = game.data.moves[card.moveId];
      const actor = run.team.find(p => p.id === card.pokemonId);
      const key = card.pokemonId + ':' + card.moveId;
      const remaining = battle.remainingUses[key];
      button(hand, name(actor) + ' → ' + move.name + ' (' + move.power + ' daño, ' + remaining + ' usos)', () => message(() => game.engine.useMove(run, key)));
    }
    line(hand, 'p', 'Las cartas proceden de la reserva de movimientos del equipo; usar una consume 1 uso y roba un reemplazo disponible.');
    const switchArea = section(area, 'Cambiar Pokémon (consume turno)');
    for (const p of run.team) {
      if (p.id === run.activePokemonId) continue;
      button(switchArea, 'Cambiar a ' + name(p), () => message(() => game.engine.switchPokemon(run, p.id)), p.hp <= 0);
    }
    const logs = section(area, 'Registro de acciones');
    const list = el('ol');
    for (const item of battle.log) list.appendChild(el('li', item));
    logs.appendChild(list);
    button(area, 'Abandonar run', () => {
      if (global.confirm('¿Abandonar esta run?')) message(() => game.engine.abandon(run));
    });
  }
  function renderReward(root, run) {
    const area = section(root, 'Recompensa');
    line(area, 'p', 'Elige una recompensa para pasar a la siguiente etapa.');
    if (run.rewardOptions && run.rewardOptions.length) {
      for (const id of run.rewardOptions) {
        button(area, 'Capturar ' + game.data.species[id].name + ' (+' + game.data.species[id].moves.length + ' movimientos)', () => message(() => game.engine.applyReward(run, 'capture', id)), run.team.length >= 6);
      }
    }
    button(area, 'Obtener 1 baya', () => message(() => game.engine.applyReward(run, 'berry')));
    button(area, 'Descansar: recuperar todos los PS', () => message(() => game.engine.applyReward(run, 'rest')));
  }
  function renderEnd(root, run) {
    const area = section(root, run.phase === 'won' ? '¡Run completada!' : 'Fin de la run');
    line(area, 'p', run.message);
    line(area, 'p', 'Puedes guardar este resultado en JSON o iniciar una nueva run.');
  }
  function render() {
    const root = document.getElementById('app');
    root.replaceChildren();
    const run = game.app.run;
    document.getElementById('save-button').disabled = !run;
    if (!run) return renderStart(root);
    renderProgress(root, run);
    renderTeam(root, run);
    if (run.phase === 'map') renderMap(root, run);
    if (run.phase === 'battle') renderBattle(root, run);
    if (run.phase === 'reward') renderReward(root, run);
    if (run.phase === 'won' || run.phase === 'lost') renderEnd(root, run);
  }
  function setStatus(value) { document.getElementById('status').textContent = value; }
  game.ui = { render, setStatus };
})(window);
