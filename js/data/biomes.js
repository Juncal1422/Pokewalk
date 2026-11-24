// Los medios, permisos y encuentros se resuelven desde el mismo catálogo editable.
export async function loadBiomes(pokemon) {
  const response = await fetch(new URL('./biomes.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo leer biomes.json');
  const rows = await response.json();
  console.info('[Biomas] Catálogo cargado', rows.length);
  const byName = new Map([...pokemon.values()].map(row => [row.name, row.dex]));
  // El JSON se edita por nombre. El motor y los sprites comparten el número de Pokédex.
  function roster(groups, biome) {
    return Object.fromEntries(['1-16', '17-36', '37-60', '61-100'].map(band => {
      const names = groups?.[band];
      if (!names?.length) throw new Error('Lista vacía en ' + biome + ' · ' + band);
      return [band, names.map(name => {
        if (!byName.has(name)) throw new Error('Pokémon desconocido en ' + biome + ': ' + name);
        return byName.get(name);
      })];
    }));
  }
  return rows.map(row => {
    if (!Number.isInteger(row.level) || row.level < 1 || row.level > 10) throw new Error('Nivel de bioma inválido: ' + row.name);
    return { ...row, wild: roster(row.wild, row.name), leaders: roster(row.leaders, row.name),
      tileset: new URL('../../' + row.tileset, import.meta.url).href };
  });
}
