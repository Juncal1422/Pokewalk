// Los medios, permisos y encuentros se resuelven desde el mismo catálogo editable.
export async function loadBiomes() {
  const response = await fetch(new URL('./biomas.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo leer biomas.json');
  const rows = await response.json();
  console.info('[Biomas] Catálogo cargado', rows.length);
  return rows.map(row => ({ ...row, tileset: new URL('../../' + row.tileset, import.meta.url).href }));
}
