import {formatDescription} from '../core/descriptions.js';
import { assetUrl } from '../core/asset-url.js';
import { labels, chanceBases } from '../core/stats.js';

// Lee un catálogo relativo al módulo y conserva el nombre del fichero en el error de carga.
async function readData(filename) {
  const result = await fetch(assetUrl(filename, import.meta.url));
  if (!result.ok) throw new Error('No se pudo cargar ' + filename);
  return result.json();
}

// Las especies, sus recompensas y los objetos de piso se editan en JSON.
export async function loadEncountersCatalog() {
  const [speciesDefinitions, items] = await Promise.all([readData('pokemon.json'), readData('items.json')]);
  for(const item of Object.values(items))item.description=formatDescription(item);
  const pokemon = new Map();
  // El rango ausente hereda el alcance estándar; los demás atributos deben ser positivos.
  const statKeys = Object.keys(labels).filter(key=>!(key in chanceBases));
  for (const speciesDefinition of speciesDefinitions) {
    if (pokemon.has(speciesDefinition.dex) ||
        !Number.isInteger(speciesDefinition.maxLevel) || speciesDefinition.maxLevel < 1 || !statKeys.every(statKey => (statKey === 'range' && speciesDefinition.stats[statKey] === undefined) || (Number.isInteger(speciesDefinition.stats[statKey]) && speciesDefinition.stats[statKey] > 0))) {
      throw new Error('Ficha Pokémon inválida: ' + speciesDefinition.dex);
    }
    // Ajuste de base común a todas las formas salvo el Ditto inicial.
    if (speciesDefinition.dex !== 132) speciesDefinition.stats.attackSpeed += 20;
    pokemon.set(speciesDefinition.dex, speciesDefinition);
  }
  console.debug('[Encuentros] Catálogo validado', pokemon.size);
  return { pokemon, items };
}
