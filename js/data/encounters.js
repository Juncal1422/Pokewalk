import { initialStats, clampStat } from '../core/stats.js';

async function readData(filename) {
  const result = await fetch(new URL(filename, import.meta.url));
  if (!result.ok) throw new Error('No se pudo cargar ' + filename);
  return result.json();
}

// Las especies, sus recompensas y sus tablas de botín se editan en JSON.
export async function loadEncountersCatalog(upgrades) {
  const [rows, items] = await Promise.all([readData('pokemon.json'), readData('items.json')]);
  const pokemon = new Map();
  const rewards = new Set(upgrades.map(item => item.id));
  for (const row of rows) {
    if (pokemon.has(row.dex) || !rewards.has(row.mejora) || !row.drops.every(id => Object.hasOwn(items, id)) ||
        !Object.keys(initialStats()).every(k => Number.isInteger(row.stats[k]) && clampStat(k,row.stats[k]) === row.stats[k])) {
      throw new Error('Ficha Pokémon inválida: ' + row.dex);
    }
    pokemon.set(row.dex, row);
  }
  return { pokemon, items };
}
