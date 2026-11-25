import { assetUrl } from '../core/asset-url.js';
// Los medios, permisos y encuentros se resuelven desde el mismo catálogo editable.
export async function loadBiomes(pokemon) {
  const response = await fetch(assetUrl('./biomes.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo leer biomes.json');
  const biomeDefinitions = await response.json();
  console.info('[Biomas] Catálogo cargado', biomeDefinitions.length);
  // El índice inverso evita recorrer la Pokédex por cada nombre de cada franja.
  const byName = new Map([...pokemon.values()].map(species => [species.name, species.dex]));
  // El JSON se edita por nombre. El motor y los sprites comparten el número de Pokédex.
  function roster(encounterBands, biome) {
    return Object.fromEntries(['1-16', '17-36', '37-60', '61-100'].map(levelBand => {
      const names = encounterBands?.[levelBand];
      if (!names?.length) throw new Error('Lista vacía en ' + biome + ' · ' + levelBand);
      return [levelBand, names.map(name => {
        if (!byName.has(name)) throw new Error('Pokémon desconocido en ' + biome + ': ' + name);
        return byName.get(name);
      })];
    }));
  }
  return biomeDefinitions.map(biomeDefinition => {
    if (!Number.isInteger(biomeDefinition.level) || biomeDefinition.level < 1 || biomeDefinition.level > 10) throw new Error('Nivel de bioma inválido: ' + biomeDefinition.name);
    return { ...biomeDefinition, wild: roster(biomeDefinition.wild, biomeDefinition.name), leaders: roster(biomeDefinition.leaders, biomeDefinition.name),
      tileset: assetUrl('../../' + biomeDefinition.tileset, import.meta.url).href };
  });
}
