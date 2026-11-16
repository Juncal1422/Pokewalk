/* Punto de entrada. Los scripts de index.html se cargan en orden con defer. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;
  game.catalog.initialize();
  game.app = { run: null };

  document.getElementById('new-button').addEventListener('click', () => {
    if (game.app.run && !global.confirm('¿Empezar otra run? Los cambios sin guardar se perderán.')) return;
    game.app.run = null;
    game.ui.setStatus('Elige un Pokémon inicial.');
    game.ui.render();
  });

  document.getElementById('save-button').addEventListener('click', () => {
    try {
      if (!game.app.run) return;
      game.storage.download(game.app.run);
      game.ui.setStatus('Descarga iniciada: slay-pokemon-partida.json');
    } catch (err) {
      game.ui.setStatus('No se ha podido guardar: ' + err.message);
    }
  });

  const fileInput = document.getElementById('load-input');
  document.getElementById('load-button').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    try {
      if (!fileInput.files.length) return;
      const imported = await game.storage.load(fileInput.files[0]);
      if (game.app.run && !global.confirm('¿Sustituir la run actual por la partida del archivo?')) return;
      game.app.run = imported;
      game.ui.setStatus('Partida cargada correctamente.');
      game.ui.render();
    } catch (err) {
      game.ui.setStatus('Error al cargar: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });

  game.ui.render();
})(window);
