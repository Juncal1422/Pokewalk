(function () {
  'use strict';
  const game = window.SlayPokemon;
  const output = document.getElementById('test-results');
  const lines = [];
  function assert(ok, label) {
    if (!ok) throw new Error('FALLO: ' + label);
    lines.push('OK — ' + label);
  }
  try {
    let run = game.state.createRun('bulbasaur');
    assert(run.team.length === 1 && run.team[0].moveIds.length === 2, 'Starter y dos movimientos');
    game.engine.startBattle(run);
    assert(run.phase === 'battle' && run.battle.hand.length === 2, 'Combate y mano inicial');
    const first = run.battle.hand[0];
    const key = first.pokemonId + ':' + first.moveId;
    const before = run.battle.remainingUses[key];
    game.engine.useMove(run, key);
    assert(run.battle.remainingUses[key] === before - 1, 'Uso del movimiento descontado');
    const saved = game.storage.serialize(run);
    run = game.storage.deserialize(saved);
    assert(run.phase === 'battle' && run.battle.hand.length > 0, 'Guardar y restaurar combate');
    // Validación del formato y de los errores de carga.
    let rejected = false;
    try { game.storage.deserialize('{"format":"incorrecto"}'); } catch (_) { rejected = true; }
    assert(rejected, 'Rechazo de archivo inválido');
    // Recorrer todas las etapas usando recompensas y victorias demostrativas del motor.
    // No existe atajo de victoria: se gastan los movimientos hasta bajar la vida del rival.
    run = game.state.createRun('squirtle');
    const totalStages = 13;
    for (let stage = 0; stage < totalStages; stage++) {
      game.engine.startBattle(run);
      // Durante esta prueba ampliamos los usos de la reserva para no depender del balance demo.
      for (const key of Object.keys(run.battle.remainingUses)) run.battle.remainingUses[key] = 100;
      let safety = 0;
      while (run.phase === 'battle' && safety++ < 100) {
        // Restablecemos PS en la simulación de test para evitar derrotas por daño acumulado.
        for (const p of run.team) p.hp = p.maxHp;
        const card = run.battle.hand[0];
        game.engine.useMove(run, card.pokemonId + ':' + card.moveId);
      }
      assert(run.phase === 'reward', 'Recompensa después de ' + game.engine.stageLabel(run));
      game.engine.applyReward(run, 'rest');
    }
    assert(run.phase === 'won' && run.badges.length === 8 && run.leagueWins === 5, 'Ocho medallas y Liga completa');
    game.engine.validateRun(run);
    output.textContent = lines.join('\n') + '\n\nTODAS LAS PRUEBAS HAN PASADO';
  } catch (error) {
    output.textContent = lines.join('\n') + '\n\n' + error.message;
    console.error(error);
  }
})();
