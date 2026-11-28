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
  function roster(encounterBands, biome, level) {
    return Object.fromEntries(['1-8','9-16','17-25','26-36','37-50'].map(levelBand => {
      const names = encounterBands?.[levelBand];
      if (level>5 && ['1-8','9-16','17-25'].includes(levelBand))return [levelBand,[]];
      if (!names?.length) throw new Error('Lista vacía en ' + biome + ' · ' + levelBand);
      return [levelBand, names.map(name => {
        if (!byName.has(name)) throw new Error('Pokémon desconocido en ' + biome + ': ' + name);
        return byName.get(name);
      })];
    }));
  }
  return biomeDefinitions.map(biomeDefinition => {
    if (!Number.isInteger(biomeDefinition.level) || biomeDefinition.level < 1 || biomeDefinition.level > 10) throw new Error('Nivel de bioma inválido: ' + biomeDefinition.name);
    return { ...biomeDefinition, wild: roster(biomeDefinition.wild, biomeDefinition.name, biomeDefinition.level), leaders: roster(biomeDefinition.leaders, biomeDefinition.name, biomeDefinition.level),
      tileset: assetUrl('../../' + biomeDefinition.tileset, import.meta.url).href };
  });
}
