/* Estado serializable: no contiene referencias a elementos HTML. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;

  function newPokemon(run, speciesId) {
    return game.catalog.createOwnedPokemon(run, speciesId);
  }

  function createRun(starterId) {
    game.catalog.initialize();
    if (!game.data.starters.includes(starterId)) throw new Error('Starter no válido');
    const run = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      phase: 'map',                 // map | battle | reward | won | lost
      stage: { kind: 'route', index: 1 },
      badges: [],
      leagueWins: 0,
      nextPokemonId: 1,
      team: [],
      activePokemonId: null,
      bag: { berries: 1, potions: 0 },
      battle: null,
      rewardOptions: null,
      message: 'Run iniciada. Elige empezar el combate de prueba.'
    };
    const starter = newPokemon(run, starterId);
    run.team.push(starter);
    run.activePokemonId = starter.id;
    game.catalog.updateLocks(run);
    return run;
  }

  game.state = { createRun, newPokemon };
})(window);
