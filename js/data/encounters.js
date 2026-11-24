import { labels } from '../core/stats.js';

async function readData(filename) {
  const result = await fetch(new URL(filename, import.meta.url));
  if (!result.ok) throw new Error('No se pudo cargar ' + filename);
  return result.json();
}

// Las especies, sus recompensas y los objetos de piso se editan en JSON.
export async function loadEncountersCatalog() {
  const [rows, items] = await Promise.all([readData('pokemon.json'), readData('items.json')]);
  const pokemon = new Map();
  for (const row of rows) {
    if (pokemon.has(row.dex) ||
        !Number.isInteger(row.maxLevel) || row.maxLevel < 1 || !Object.keys(labels).every(k => (k === 'range' && row.stats[k] === undefined) || (Number.isInteger(row.stats[k]) && row.stats[k] > 0))) {
      throw new Error('Ficha Pokémon inválida: ' + row.dex);
    }
    pokemon.set(row.dex, row);
  }
  console.debug('[Encuentros] Catálogo validado', pokemon.size);
  return { pokemon, items };
}
