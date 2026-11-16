/* Estado serializable: no contiene referencias a elementos HTML. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;

  function newPokemon(run, speciesId) {
    const template = game.data.species[speciesId];
    if (!template) throw new Error('Pokémon desconocido: ' + speciesId);
    const pokemon = {
      id: 'pk_' + run.nextPokemonId++,
      speciesId,
      hp: template.hp,
      maxHp: template.hp,
      moveIds: template.moves.slice()
    };
    return pokemon;
  }

  function createRun(starterId) {
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
    return run;
  }

  game.state = { createRun, newPokemon };
})(window);
