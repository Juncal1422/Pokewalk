// Base wall masks are sorted numerically (clockwise bits starting at north).
// Floor ID 1 is reserved for objects. Wall IDs are scoped to the canonical mask.
function biome(id, name, filename, floors, walls = {}) {
  return {
    id, name,
    tileset: new URL(`../../tiled/tilesets/${filename}`, import.meta.url).href,
    variants: { floors, walls }
  };
}
export const BIOMES = [
  biome("buried", "Buried Relic", "BuriedRelic-blob.png", { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }, { 124: { 1: 0 } }),
  biome("forest", "Purity Forest", "PutiryForest-blob.png", { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }),
  biome("steel", "Steel Aegis Cave", "SteelAegis-blob.png", { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 })
];
