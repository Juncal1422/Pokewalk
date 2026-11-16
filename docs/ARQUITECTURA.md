# Arquitectura y decisiones de la versión 0.1

## Objetivo

Juego offline de navegador, desarrollado con HTML y JavaScript sin dependencias, compiladores ni servidor. El archivo `index.html` se abre directamente desde el disco.

## Organización

- `src/core/entities.js`: clases base y subclases de Pokémon, movimientos, objetos, consumibles y eventos.
- `index.html`: bloque JSON local de datos, legible también al abrir el juego con `file://`.
- `src/data/catalog.js`: crea las instancias del catálogo y actualiza sus bloqueos según el progreso.
- `src/core/state.js`: creación de un nuevo estado de run, sin elementos del DOM.
- `src/core/engine.js`: reglas de combate, progresión, captura, equipo, inventario y validaciones.
- `src/storage/json-save.js`: serialización, descarga y lectura de JSON.
- `src/ui/render.js`: botones y texto HTML sin estilos.
- `src/main.js`: arranque y eventos globales.

Los scripts se cargan **en orden** usando `defer`. Deliberadamente no emplean `import/export` para garantizar el funcionamiento mediante `file://` sin servidor local.

## Clases y desbloqueos

El JSON del HTML es la fuente de datos. Al comenzar una run se crean nuevas instancias de cada entidad.

Las entidades comparten `locked` y una condición declarativa de desbloqueo cuando corresponda.

### Pokémon

La clase `Pokemon` representa las criaturas disponibles durante la run.

- Cada especie dispone de **entre 2 y 4 movimientos**, definidos en el catálogo.
- Los Pokémon iniciales pueden seleccionarse al comenzar una run.
- Los Pokémon capturables pueden incorporarse al equipo mediante recompensas o eventos.
- Cada Pokémon conserva sus estadísticas, salud, movimientos y estados propios.
- Los movimientos de los Pokémon del equipo forman la reserva utilizada durante los combates.

Las subclases permiten distinguir Pokémon iniciales y capturables cuando necesiten comportamientos específicos.

### Movimientos

La clase `Movimiento` define las acciones disponibles durante los combates.

Cada movimiento contiene, como mínimo:

- Identificador y nombre.
- Tipo elemental.
- Potencia o efecto.
- Número máximo de usos por combate.
- Número de usos restantes.
- Condiciones de desbloqueo, cuando corresponda.

Las subclases permiten diferenciar movimientos básicos, elementales y otras categorías que se incorporen posteriormente.

### Objetos y consumibles

Los elementos del inventario se dividen en dos categorías principales:

**Objeto**

Representa un elemento que proporciona un **efecto pasivo permanente** mientras forme parte del inventario o esté equipado, según las reglas que se definan.

- No se consume al activar su efecto.
- Puede modificar estadísticas, reglas de combate, recompensas u otras mecánicas.
- Sus efectos pueden activarse al producirse determinadas condiciones.
- Permanece disponible durante la run salvo que alguna mecánica permita retirarlo o sustituirlo.

**Consumible**

Representa un elemento de uso limitado que puede activarse exclusivamente en momentos específicos.

- Dispone de una cantidad en el inventario.
- Se consume cuando su utilización se completa correctamente.
- Cada categoría establece los eventos en los que puede utilizarse.
- No puede utilizarse fuera de sus condiciones permitidas.

Categorías iniciales:

| Consumible | Uso permitido | Función |
|---|---|---|
| Bayas | Eventos de descanso | Recuperación u otros efectos sobre los Pokémon |
| Balls | Eventos de combate | Intentar capturar Pokémon |

La clase base `Consumible` permite incorporar nuevas categorías con otras condiciones de uso.

El motor valida tanto la disponibilidad del consumible como el contexto del evento antes de ejecutar su efecto.

### Eventos

La clase `Evento` representa las situaciones que pueden aparecer durante una ruta.

Las subclases iniciales incluyen:

- `EventoCombate`: enfrentamientos contra Pokémon o entrenadores. Permite utilizar Balls cuando las condiciones de captura se cumplen.
- `EventoDescanso`: recuperación del equipo y utilización de bayas.
- `EventoCaptura`: situaciones especiales relacionadas con la incorporación de Pokémon.
- `EventoTienda`: adquisición de objetos y consumibles.

Cada evento determina las acciones que pueden realizarse durante su ejecución.

## Reglas del prototipo, sujetas a revisión

1. Elegir Bulbasaur, Charmander o Squirtle comienza una run.
2. Cada especie aporta **entre 2 y 4 movimientos**, definidos individualmente en el catálogo.
3. En cada combate se extraen **hasta cuatro movimientos distintos** de todos los Pokémon del equipo. Inicialmente, con solo dos movimientos del starter, pueden mostrarse dos en vez de cuatro.
4. Cada movimiento tiene un límite de usos **por combate**, reiniciado al comenzar uno nuevo.
5. Usar un movimiento consume uno de sus usos y roba otro movimiento aleatorio disponible. Puede volver a aparecer el mismo movimiento si conserva usos.
6. Cambiar Pokémon consume un turno y sustituye las cartas visibles del Pokémon saliente por cartas disponibles del entrante. Si no había cartas del saliente en la mano, no se reemplaza ninguna.
7. Para validar la estructura, **el daño de los movimientos es fijo**. Todavía no existen efectividades, estadísticas aplicadas al daño, prioridades, estados alterados ni IA avanzada. Cualquier movimiento de la mano puede utilizarse aunque su propietario no sea el Pokémon activo. Esta es una regla temporal para probar la reserva compartida.
8. El rival de prueba inflige una cantidad fija de daño al Pokémon activo después de cada acción. Si todo el equipo se debilita, la run termina.
9. Durante los combates que permitan capturas, el jugador puede utilizar Balls de su inventario. Las condiciones de captura y sus probabilidades se definirán posteriormente.
10. Durante los eventos de descanso, el jugador puede utilizar bayas disponibles en su inventario.
11. Los objetos proporcionan efectos pasivos permanentes, cuya aplicación corresponde al motor del juego.
12. Ganar cada una de las ocho rutas concede una medalla y permite elegir una recompensa.
13. Las recompensas pueden incluir nuevos Pokémon, objetos, consumibles o recuperación del equipo.
14. Después de completar las ocho rutas siguen cinco encuentros: cuatro del Alto Mando y uno contra el Campeón. Superar el último supone ganar la run.
15. Las recompensas y rivales actuales son **simulaciones de prueba**. Las clases de eventos, objetos y consumibles están preparadas para futuras implementaciones, pero todavía no existe una secuencia completa de eventos, tiendas ni un árbol de rutas definitivo.

## Datos de partida

Se guarda un documento JSON con `format`, `version`, `savedAt` y `run`.

El estado de la run incluye:

- Pokémon del equipo y sus condiciones actuales.
- Movimientos asociados a cada Pokémon.
- Objetos permanentes adquiridos.
- Consumibles y cantidades disponibles.
- Ruta actual y medallas obtenidas.
- Progreso de la Liga.
- Estado del combate o evento actual, cuando corresponda.

El motor valida los campos principales al importar.

Los guardados contienen el progreso y los identificadores necesarios para reconstruir las instancias de las clases. No se serializan funciones ni se ejecuta código procedente de los archivos JSON.

Al cargar una partida se reconstruyen las entidades, se restauran sus estados y se recalculan los bloqueos según el progreso.

El guardado **no es automático**: únicamente se descarga un JSON al pulsar Guardar. Al cargar el archivo elegido se sustituye el estado actual en memoria.

Los archivos se descargan en la carpeta configurada por el navegador. No se pueden sobrescribir directamente archivos del disco utilizando únicamente HTML y JavaScript convencional debido a las restricciones de seguridad del navegador.

## Próximos pasos recomendados

- Definir las reglas definitivas de la mano global, el Pokémon activo y los cambios.
- Establecer el funcionamiento de los movimientos y separar sus resultados en efectos reutilizables.
- Implementar el sistema de objetos pasivos y sus condiciones de activación.
- Implementar consumibles con validación del contexto de uso.
- Definir el sistema de captura mediante Balls durante los combates.
- Incorporar los efectos de las bayas en eventos de descanso.
- Añadir mapa de rutas con nodos de combate, tienda, evento, descanso y captura.
- Modelar estadísticas, estados alterados, habilidades y evoluciones.
- Crear pruebas automatizadas del combate, los efectos de objetos, el uso de consumibles y la progresión.
- Preparar migraciones para futuras versiones de los archivos de guardado.
- Añadir hojas CSS y recursos gráficos cuando las mecánicas principales estén validadas.