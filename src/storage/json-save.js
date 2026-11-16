/* Guardar = descargar JSON; cargar = leer un archivo JSON. Sin servidor ni base de datos. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon;
  const FORMAT = 'slay-pokemon-save';
  const VERSION = 1;

  function serialize(run) {
    game.engine.validateRun(run);
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      run
    }, null, 2);
  }

  function download(run) {
    const data = serialize(run);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slay-pokemon-partida.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Retrasar la revocación permite completar la descarga en todos los navegadores.
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function deserialize(source) {
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch (_) {
      throw new Error('El archivo no es un JSON válido.');
    }
    if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION) {
      throw new Error('Este archivo no tiene el formato de guardado esperado.');
    }
    game.engine.validateRun(parsed.run);
    return game.catalog.hydrateRun(parsed.run);
  }

  async function load(file) {
    if (!file) throw new Error('No has seleccionado ningún archivo.');
    // Tamaño máximo preventivo; las partidas normales ocupan pocos KB.
    if (file.size > 1024 * 1024) throw new Error('El archivo supera 1 MB; no parece una partida válida.');
    return deserialize(await file.text());
  }

  game.storage = { serialize, deserialize, download, load };
})(window);
