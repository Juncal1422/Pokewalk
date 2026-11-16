/* Construye las instancias del catálogo a partir del bloque JSON del HTML. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;
  const types = game.entities;

  function indexById(entries, create) {
    const result = {};
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || result[entry.id]) {
        throw new Error('El JSON del catálogo contiene una entidad no válida o duplicada.');
      }
      result[entry.id] = create(entry);
    }
    return result;
  }

  function initialize() {
    const node = global.document.getElementById('game-data');
    if (!node) throw new Error('No se encuentra el JSON de datos del juego.');

    let source;
    try {
      source = JSON.parse(node.textContent);
    } catch (error) {
      throw new Error('El JSON de datos del juego no es válido: ' + error.message);
    }
    if (!source || !Array.isArray(source.starters) || !Array.isArray(source.captures) ||
        !Array.isArray(source.species) || !Array.isArray(source.moves) ||
        !Array.isArray(source.items) || !Array.isArray(source.events)) {
      throw new Error('El JSON de datos del juego no contiene todos los catálogos.');
    }

    const species = indexById(source.species, data => {
      if (data.kind === 'starter') return new types.StarterPokemon(data);
      if (data.kind === 'wild') return new types.WildPokemon(data);
      throw new Error('Tipo de Pokémon desconocido: ' + data.kind);
    });
    const moves = indexById(source.moves, data => {
      if (data.kind === 'elemental') return new types.ElementalMove(data);
      if (data.kind === 'basic') return new types.BasicMove(data);
      throw new Error('Tipo de movimiento desconocido: ' + data.kind);
    });
    const items = indexById(source.items, data => {
      if (data.kind === 'potion') return new types.PotionItem(data);
      if (data.kind === 'berry') return new types.BerryItem(data);
      throw new Error('Tipo de objeto desconocido: ' + data.kind);
    });
    const events = indexById(source.events, data => {
      if (data.kind === 'rest') return new types.RestEvent(data);
      if (data.kind === 'battle') return new types.BattleEvent(data);
      throw new Error('Tipo de evento desconocido: ' + data.kind);
    });

    game.data = {
      species,
      moves,
      items,
      events,
      starters: source.starters.slice(),
      captures: source.captures.slice(),
      all: Object.values(species).concat(Object.values(moves), Object.values(items), Object.values(events))
    };
    return game.data;
  }

  function conditionMet(condition, run) {
    if (condition.type === 'always') return true;
    if (condition.type === 'firstVictory') return run.badges.length > 0;
    if (condition.type === 'badgeCount') return run.badges.length >= condition.count;
    if (condition.type === 'leagueWins') return run.leagueWins >= condition.count;
    throw new Error('Condición de desbloqueo desconocida: ' + condition.type);
  }

  function updateLocks(run) {
    // Los bloqueos de todas las entidades reflejan el progreso de esta run.
    for (const entity of game.data.all) {
      entity.locked = !conditionMet(entity.unlockCondition, run);
    }
  }

  function createOwnedPokemon(run, speciesId) {
    const template = game.data.species[speciesId];
    if (!template || template.locked) throw new Error('Pokémon bloqueado o desconocido: ' + speciesId);
    return template.createOwned('pk_' + run.nextPokemonId++);
  }

  function hydrateRun(run) {
    updateLocks(run);
    run.team = run.team.map(saved => {
      const template = game.data.species[saved.speciesId];
      if (!template) throw new Error('Pokémon desconocido: ' + saved.speciesId);
      return Object.assign(template.createOwned(saved.id), saved);
    });
    return run;
  }

  game.catalog = { initialize, updateLocks, createOwnedPokemon, hydrateRun };
})(window);
