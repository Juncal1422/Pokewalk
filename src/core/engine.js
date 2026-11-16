/* Reglas de DEMOSTRACIÓN. El motor no toca el DOM ni conoce el formato del guardado. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;
  const MAX_HAND = 4;
  const MAX_TEAM = 6;

  function randomPick(values) {
    return values[Math.floor(Math.random() * values.length)];
  }
  function member(run, id) {
    return run.team.find(pokemon => pokemon.id === id);
  }
  function cardKey(card) { return card.pokemonId + ':' + card.moveId; }
  function availableCards(run, ownerId) {
    const battle = run.battle;
    return run.team
      .filter(p => p.hp > 0 && (!ownerId || p.id === ownerId))
      .flatMap(p => p.moveIds.map(moveId => ({ pokemonId: p.id, moveId })))
      .filter(card => !game.data.moves[card.moveId].locked)
      .filter(card => battle.remainingUses[cardKey(card)] > 0)
      .filter(card => !battle.hand.some(held => cardKey(held) === cardKey(card)));
  }
  function refillHand(run) {
    while (run.battle.hand.length < MAX_HAND) {
      const options = availableCards(run);
      if (!options.length) break;
      run.battle.hand.push(randomPick(options));
    }
  }
  function stageLabel(run) {
    if (run.stage.kind === 'route') return 'Ruta ' + run.stage.index;
    if (run.stage.index <= 4) return 'Alto Mando ' + run.stage.index;
    return 'Campeón';
  }
  function startBattle(run) {
    if (run.phase !== 'map') throw new Error('No se puede iniciar un combate ahora.');
    const base = run.stage.kind === 'route' ? 20 + run.stage.index * 8 : 55 + run.stage.index * 12;
    const remainingUses = {};
    for (const pokemon of run.team) {
      for (const moveId of pokemon.moveIds) {
        remainingUses[pokemon.id + ':' + moveId] = game.data.moves[moveId].uses;
      }
    }
    run.battle = {
      enemyName: 'Rival de prueba — ' + stageLabel(run),
      enemyHp: base,
      enemyMaxHp: base,
      remainingUses,
      hand: [],
      turns: 1,
      log: ['Combate de prueba iniciado.']
    };
    run.phase = 'battle';
    if (!member(run, run.activePokemonId) || member(run, run.activePokemonId).hp <= 0) {
      const next = run.team.find(p => p.hp > 0);
      if (next) run.activePokemonId = next.id;
    }
    refillHand(run);
    run.message = 'Combate iniciado: juega un movimiento o cambia de Pokémon.';
  }
  function log(run, message) {
    run.battle.log.unshift(message);
    run.battle.log = run.battle.log.slice(0, 10);
    run.message = message;
  }
  function winBattle(run) {
    const wasRoute = run.stage.kind === 'route';
    if (wasRoute) run.badges.push('Medalla ' + run.stage.index);
    else run.leagueWins += 1;
    game.catalog.updateLocks(run);
    run.phase = 'reward';
    run.battle = null;
    const availableCaptures = game.data.captures.filter(id => !game.data.species[id].locked);
    const offset = availableCaptures.length ? (run.stage.index - 1) % availableCaptures.length : 0;
    const orderedCaptures = availableCaptures.slice(offset).concat(availableCaptures.slice(0, offset));
    run.rewardOptions = wasRoute ? orderedCaptures.slice(0, 2) : [];
    run.message = '¡Victoria! ' + (wasRoute ? 'Has obtenido una medalla.' : 'Has superado un combate de Liga.');
  }
  function takeEnemyTurn(run) {
    if (run.phase !== 'battle') return;
    const active = member(run, run.activePokemonId);
    if (!active) throw new Error('No hay Pokémon activo.');
    const damage = 2 + (run.stage.kind === 'league' ? 1 : 0);
    active.hp = Math.max(0, active.hp - damage);
    log(run, run.battle.enemyName + ' inflige ' + damage + ' PS a ' + game.data.species[active.speciesId].name + '.');
    if (active.hp === 0) {
      const substitute = run.team.find(p => p.hp > 0);
      if (substitute) {
        run.activePokemonId = substitute.id;
        log(run, 'Tu Pokémon se debilita. Sale ' + game.data.species[substitute.speciesId].name + '.');
      } else {
        run.phase = 'lost';
        run.battle = null;
        run.message = 'La run ha terminado: todos los Pokémon se han debilitado.';
      }
    }
    if (run.battle) run.battle.turns++;
  }
  function useMove(run, selectedKey) {
    if (run.phase !== 'battle') throw new Error('No hay un combate activo.');
    const hand = run.battle.hand;
    const index = hand.findIndex(card => cardKey(card) === selectedKey);
    if (index < 0) throw new Error('El movimiento no está en la mano.');
    const card = hand.splice(index, 1)[0];
    if (run.battle.remainingUses[selectedKey] <= 0) throw new Error('El movimiento no tiene usos restantes.');
    const move = game.data.moves[card.moveId];
    const actor = member(run, card.pokemonId);
    run.battle.remainingUses[selectedKey]--;
    run.battle.enemyHp = Math.max(0, run.battle.enemyHp - move.power);
    log(run, game.data.species[actor.speciesId].name + ' usa ' + move.name + ' (-' + move.power + ' PS).');
    if (run.battle.enemyHp <= 0) {
      winBattle(run);
      return;
    }
    takeEnemyTurn(run);
    if (run.phase === 'battle') refillHand(run);
  }
  function switchPokemon(run, pokemonId) {
    if (run.phase !== 'battle') throw new Error('Sólo se puede cambiar durante un combate.');
    const next = member(run, pokemonId);
    if (!next || next.hp <= 0 || next.id === run.activePokemonId) throw new Error('Cambio de Pokémon no válido.');
    const oldId = run.activePokemonId;
    const removedCount = run.battle.hand.filter(card => card.pokemonId === oldId).length;
    run.battle.hand = run.battle.hand.filter(card => card.pokemonId !== oldId);
    run.activePokemonId = pokemonId;
    for (let i = 0; i < removedCount; i++) {
      const choices = availableCards(run, pokemonId);
      if (!choices.length) break;
      run.battle.hand.push(randomPick(choices));
    }
    log(run, 'Cambio a ' + game.data.species[next.speciesId].name + '. Se sustituyen ' + removedCount + ' movimientos de la mano.');
    takeEnemyTurn(run);
    if (run.phase === 'battle') refillHand(run);
  }
  function useBerry(run) {
    if (run.phase !== 'battle' && run.phase !== 'map') throw new Error('No puedes usar una baya ahora.');
    if (run.bag.berries <= 0) throw new Error('No quedan bayas.');
    const pokemon = member(run, run.activePokemonId);
    if (!pokemon || pokemon.hp === 0 || pokemon.hp === pokemon.maxHp) throw new Error('El Pokémon activo no puede recuperar más PS.');
    const recovered = Math.min(12, pokemon.maxHp - pokemon.hp);
    pokemon.hp += recovered;
    run.bag.berries--;
    run.message = 'Baya usada: +' + recovered + ' PS.';
    if (run.phase === 'battle') {
      log(run, run.message);
      takeEnemyTurn(run);
    }
  }
  function applyReward(run, kind, speciesId) {
    if (run.phase !== 'reward') throw new Error('No hay una recompensa pendiente.');
    if (kind === 'capture') {
      if (!run.rewardOptions.includes(speciesId) || game.data.species[speciesId].locked) throw new Error('Pokémon no disponible para capturar.');
      if (run.team.length >= MAX_TEAM) throw new Error('Equipo lleno (máximo seis Pokémon).');
      run.team.push(game.state.newPokemon(run, speciesId));
      run.message = '¡Capturado ' + game.data.species[speciesId].name + '! Sus movimientos se suman al equipo.';
    } else if (kind === 'berry') {
      run.bag.berries += 1;
      run.message = 'Has obtenido una baya.';
    } else if (kind === 'rest') {
      for (const p of run.team) p.hp = p.maxHp;
      run.message = 'Tu equipo ha recuperado todos sus PS.';
    } else {
      throw new Error('Recompensa desconocida.');
    }
    advance(run);
  }
  function advance(run) {
    run.rewardOptions = null;
    if (run.stage.kind === 'route') {
      if (run.stage.index < 8) run.stage.index++;
      else run.stage = { kind: 'league', index: 1 };
      run.phase = 'map';
    } else if (run.stage.index < 5) {
      run.stage.index++;
      run.phase = 'map';
    } else {
      run.phase = 'won';
      run.message = '¡Has superado las ocho rutas, el Alto Mando y el Campeón!';
    }
  }
  function abandon(run) {
    if (run.phase !== 'battle') throw new Error('No hay un combate que abandonar.');
    run.phase = 'lost';
    run.battle = null;
    run.message = 'Run abandonada.';
  }
  function validateRun(run) {
    if (!run || typeof run !== 'object' || Array.isArray(run)) throw new Error('El JSON no contiene una run válida.');
    if (run.schemaVersion !== 1) throw new Error('Versión de partida no compatible.');
    if (!['map','battle','reward','won','lost'].includes(run.phase)) throw new Error('Fase desconocida.');
    if (!run.stage || !['route','league'].includes(run.stage.kind) || !Number.isInteger(run.stage.index)) throw new Error('Etapa no válida.');
    if (run.stage.kind === 'route' && (run.stage.index < 1 || run.stage.index > 8)) throw new Error('Ruta no válida.');
    if (run.stage.kind === 'league' && (run.stage.index < 1 || run.stage.index > 5)) throw new Error('Combate de Liga no válido.');
    if (!Array.isArray(run.team) || run.team.length < 1 || run.team.length > MAX_TEAM) throw new Error('Equipo no válido.');
    if (!Number.isInteger(run.nextPokemonId) || run.nextPokemonId < 2) throw new Error('Contador de Pokémon no válido.');
    const ids = new Set();
    for (const p of run.team) {
      if (!p || typeof p.id !== 'string' || ids.has(p.id) || !game.data.species[p.speciesId]) throw new Error('Pokémon desconocido o duplicado.');
      ids.add(p.id);
      if (!Number.isInteger(p.hp) || !Number.isInteger(p.maxHp) || p.hp < 0 || p.hp > p.maxHp || p.maxHp < 1) throw new Error('PS del Pokémon no válidos.');
      if (!Array.isArray(p.moveIds) || !p.moveIds.length || p.moveIds.some(id => !game.data.moves[id])) throw new Error('Movimientos no válidos.');
    }
    if (!ids.has(run.activePokemonId)) throw new Error('Pokémon activo no válido.');
    if (!run.bag || !Number.isInteger(run.bag.berries) || run.bag.berries < 0) throw new Error('Mochila no válida.');
    if (!Array.isArray(run.badges) || !Number.isInteger(run.leagueWins) || run.leagueWins < 0 || run.leagueWins > 5) throw new Error('Progreso no válido.');
    if (run.phase === 'battle') {
      const b = run.battle;
      if (!b || !Array.isArray(b.hand) || b.hand.length > MAX_HAND || !b.remainingUses || !Number.isFinite(b.enemyHp) || b.enemyHp < 0 || !Number.isFinite(b.enemyMaxHp) || b.enemyMaxHp <= 0) throw new Error('Combate guardado no válido.');
      const handIds = new Set();
      for (const card of b.hand) {
        if (!ids.has(card.pokemonId) || !game.data.moves[card.moveId] || !member(run,card.pokemonId).moveIds.includes(card.moveId) || handIds.has(cardKey(card))) throw new Error('Carta guardada no válida.');
        handIds.add(cardKey(card));
      }
      for (const p of run.team) for (const moveId of p.moveIds) {
        const value = b.remainingUses[p.id + ':' + moveId];
        if (!Number.isInteger(value) || value < 0 || value > game.data.moves[moveId].uses) throw new Error('Usos guardados no válidos.');
      }
      if (!Array.isArray(b.log)) throw new Error('Registro de combate no válido.');
    } else if (run.battle !== null) throw new Error('Combate inesperado en la partida.');
    if (run.phase === 'reward' && !Array.isArray(run.rewardOptions)) throw new Error('Recompensa guardada no válida.');
    return true;
  }
  game.engine = { stageLabel, startBattle, useMove, switchPokemon, useBerry, applyReward, abandon, validateRun };
})(window);
