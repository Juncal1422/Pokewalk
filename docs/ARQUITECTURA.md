# Arquitectura y decisiones de la versión 0.1

## Objetivo

Juego offline de navegador, HTML + JavaScript sin dependencias, compiladores ni servidor. El archivo `index.html` se abre directamente desde el disco.

## Organización

- `src/data/catalog.js`: catálogos estáticos de especies y movimientos.
- `src/core/state.js`: creación de un nuevo estado de run, sin elementos del DOM.
- `src/core/engine.js`: reglas temporales de combate, progresión, captura, equipo y validaciones.
- `src/storage/json-save.js`: serialización, descarga y lectura de JSON.
- `src/ui/render.js`: botones y texto HTML sin estilos.
- `src/main.js`: arranque y eventos globales.

Los scripts se cargan **en orden** usando `defer`; deliberadamente no emplean `import/export` para que funcionen con `file://` sin servidor local (los módulos ES pueden tener restricciones CORS en ese contexto).

## Reglas del prototipo, sujetas a revisión

1. Elegir Bulbasaur, Charmander o Squirtle comienza una run.
2. Cada especie aporta una cantidad predefinida de movimientos (2 o 3 en este ejemplo).
3. En cada combate se extraen **hasta cuatro movimientos distintos** de todos los Pokémon del equipo; inicialmente, con solo dos movimientos del starter, pueden mostrarse dos en vez de cuatro.
4. Cada movimiento tiene un límite de usos **por combate**, reiniciado al empezar uno nuevo.
5. Usar un movimiento lo consume y roba otro movimiento aleatorio disponible; también puede volver a salir el mismo si conserva usos.
6. Cambiar Pokémon consume un turno y sustituye las cartas visibles del Pokémon saliente por cartas disponibles del entrante. Si no había cartas del saliente en la mano, no se reemplaza ninguna.
7. Para validar la estructura, **el daño de los movimientos es fijo**, no existen efectividades, estadísticas, prioridades, estados, IA real ni capturas durante el combate. Cualquier movimiento de la mano puede utilizarse aunque su propietario no sea el Pokémon activo: es una regla *temporal* del prototipo para probar la reserva compartida.
8. El rival de prueba hace una cantidad fija de daño al Pokémon activo tras cada acción. Si todo el equipo se debilita, la run termina.
9. Ganar cada una de las 8 rutas concede una medalla y permite elegir una recompensa (capturar un Pokémon de ejemplo, obtener baya o descansar).
10. Después siguen cinco encuentros: cuatro de Alto Mando y uno de Campeón. Tras superar el último se gana la run.
11. Las recompensas y rivales son **simulaciones de prueba**: no hay todavía eventos, objetos equipables, tiendas ni un árbol de rutas.

## Datos de partida

Se guarda un documento JSON con `format`, `version`, `savedAt` y `run`. El motor valida los campos principales al importar. Nunca ejecutar código de un archivo de guardado. El guardado **no es automático**: sólo se descarga un JSON al pulsar Guardar. Al cargar el archivo elegido se sustituye el estado en memoria.

Los archivos se descargan en la carpeta que tenga configurada el navegador. No se pueden sobrescribir directamente archivos del disco usando sólo HTML + JavaScript normal por las restricciones de seguridad del navegador.

## Próximos pasos recomendados

- Acordar reglas definitivas de mano global, Pokémon activo y cambios.
- Separar resultados de movimientos en efectos reutilizables y agregar estados alterados.
- Añadir mapa de rutas con nodos (combate, tienda, evento, descanso, captura).
- Modelar objetos, bayas, requisitos y evoluciones como datos.
- Añadir hoja CSS y recursos gráficos cuando el motor esté validado.
- Crear pruebas automatizadas del daño y del progreso y migraciones para versiones de guardado futuras.

## Legal

El prototipo incluye nombres de Pokémon únicamente como datos de prueba y ningún sprite oficial. Si se distribuye públicamente, revisar los derechos sobre los nombres, diseños y recursos de terceros.
