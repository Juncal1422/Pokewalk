// Los medios, permisos y encuentros se resuelven desde el mismo catálogo editable.
export async function loadBiomes(pokemon) {
  const response = await fetch(new URL('./biomas.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo leer biomas.json');
  const rows = await response.json();
  console.info('[Biomas] Catálogo cargado', rows.length);
  const byName = new Map([...pokemon.values()].map(row => [row.name, row.dex]));
  // El JSON se edita por nombre. El motor y los sprites comparten el número de Pokédex.
  return rows.map(row => ({ ...row, wild: row.wild.map(name => {
    if (!byName.has(name)) throw new Error('Pokémon desconocido en ' + row.name + ': ' + name);
    return byName.get(name);
  }), tileset: new URL('../../' + row.tileset, import.meta.url).href }));
}
