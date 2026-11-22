# PokeWalk

## Archivos de entrada

- `index.html`: aplicación local servida desde este repositorio; carga los módulos de `js/`.
- `PokeWalk.html`: banco de pruebas independiente con el nombre solicitado. Carga el código de una rama, etiqueta o commit del mismo repositorio a través de jsDelivr. Por defecto usa `develop`; se puede cambiar la referencia en el selector y guardar el enlace con `?ref=nombre-rama`.

## Estructura

```text
index.html
PokeWalk.html
js/
  main.js
  core/
    constants.js
    state.js
    dungeon.js
    entities.js
    input.js
    renderer.js
  data/
    biomes.js
    pokemon-data.js
```

El juego conserva los recursos de sprites de PMDCollab y el elenco funcional de las generaciones 1 a 5. `EXCLUDED_DEX` mantiene los IDs sin el conjunto mínimo de animaciones.
