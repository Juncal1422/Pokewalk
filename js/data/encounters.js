import { labels } from '../core/stats.js';

async function readData(filename) {
  const result = await fetch(new URL(filename, import.meta.url));
  if (!result.ok) throw new Error('No se pudo cargar ' + filename);
  return result.json();
}

// Las especies, sus recompensas y los objetos de piso se editan en JSON.
export async function loadEncountersCatalog(upgrades) {
  const [rows, items] = await Promise.all([readData('pokemon.json'), readData('items.json')]);
  const pokemon = new Map();
  const rewards = new Set(upgrades.map(item => item.id));
  for (const row of rows) {
    if (pokemon.has(row.dex) || !rewards.has(row.mejora) ||
        !Number.isInteger(row.maxLevel) || row.maxLevel < 1 || !Object.keys(labels).every(k => (k === 'range' && row.stats[k] === undefined) || (Number.isInteger(row.stats[k]) && row.stats[k] > 0))) {
      throw new Error('Ficha Pokémon inválida: ' + row.dex);
    }
    pokemon.set(row.dex, row);
  }
  // Acumula el coste real de la cadena. La ordenación también cubre bebés
  // cuyo número de Pokédex es posterior al de la evolución.
  for (const row of [...rows].sort((a, b) => a.stage - b.stage)) {
    row.evolutionCost ??= 0;
    for (const rule of row.evolutions) {
      const child = pokemon.get(rule.to);
      const cost = row.evolutionCost + rule.amount;
      if (child) child.evolutionCost = Math.min(child.evolutionCost ?? Infinity, cost);
    }
  }
  console.debug('[Encuentros] Catálogo validado', pokemon.size);
  return { pokemon, items };
}
