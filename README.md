# PokeWalk

Explorador en tiempo real inspirado en Pokémon Mundo Misterioso. La rama de desarrollo acordada es `develop`.

## Archivos de entrada

- `index.html`: aplicación local servida desde este repositorio; carga los módulos de `js/`.
- `PokeWalk.html`: banco de pruebas independiente con el nombre solicitado. Carga el código de una rama, etiqueta o commit del mismo repositorio a través de jsDelivr. Por defecto usa `develop`; se puede cambiar la referencia en el selector y guardar el enlace con `?ref=nombre-rama`.

Para probar el HTML modular en local, abre la raíz del repositorio con un servidor estático (por ejemplo, la extensión Live Server de VS Code). Los módulos ES no se pueden cargar de forma fiable abriendo `index.html` directamente con `file://`. `test.html` sí se puede abrir como archivo porque descarga los módulos de la referencia elegida.

## Estructura

```text
index.html
test.html
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

## Flujo de ramas

Desarrolla cambios en ramas propias y llévalos a `develop` cuando estén listos. El HTML de `test.html` permite apuntar a `develop`, a otra rama o a una etiqueta para comparar las versiones publicadas en GitHub.
