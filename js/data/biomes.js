// Los muros del atlas siguen el orden numérico de las máscaras.
// Reservo la variante 1 del suelo para objetos. En los muros depende de la máscara.
function biome(id, name, filename, floors, walls = {}) {
  return {
    id,
    name,
    tileset: new URL(`../../tiled/tilesets/${filename}`, import.meta.url).href,
    variants: { floors, walls },
  };
}
export const BIOMES = [
  biome(
    'buried',
    'Buried Relic',
    'BuriedRelic-blob.png',
    { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
    { 124: { 1: 0 } },
  ),
  biome('forest', 'Purity Forest', 'PutiryForest-blob.png', {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
  }),
  biome('steel', 'Steel Aegis Cave', 'SteelAegis-blob.png', {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
  }),
];
