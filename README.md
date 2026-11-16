# Slay Pokémon — esqueleto web 0.1

Prototipo local de un juego de runs Pokémon inspirado levemente en los deckbuilders. Está hecho con **HTML y JavaScript puro**, no utiliza Java, Node.js, JavaFX, npm, Gradle, ejecutables ni compilación. **No tiene estilos CSS**.

## 1. Cómo abrirlo (Windows + VS Code)

1. Descomprime el ZIP en la carpeta de tu repositorio GitHub, o copia su contenido en el repositorio ya clonado.
2. En Visual Studio Code elige **Archivo → Abrir carpeta** y selecciona la carpeta que contiene `index.html`.
3. En el Explorador de VS Code localiza `index.html`. Puedes hacer clic derecho → **Mostrar en Explorador de archivos** y abrirlo con doble clic, o abrir el fichero directamente en Chrome, Edge o Firefox.
4. Se abrirá el juego en el navegador. **No hay que ejecutar comandos ni instalar extensiones.**
5. Verás tres starters. Selecciona uno para iniciar la run.

**IMPORTANTE:** abre `index.html`, no uno de los ficheros JS individualmente. No hace falta Live Server. Si editas el código, guarda el archivo en VS Code y actualiza la página del navegador con `Ctrl + R`.

## 2. Cómo funciona este prototipo

- Elige un starter: Bulbasaur, Charmander o Squirtle. Cada uno aporta dos movimientos.
- Haz clic en **Iniciar combate**. Se muestran hasta cuatro movimientos aleatorios del equipo (con un solo starter inicialmente aparecen dos).
- Pulsa un movimiento: inflige daño fijo de demostración, consume uno de sus usos por combate y se roba otro movimiento si lo hay.
- Puedes cambiar el Pokémon activo si has capturado otro. El cambio gasta un turno y reemplaza sus movimientos visibles correspondientes.
- Cuando derrotas al rival, recibes una medalla en las rutas y eliges entre capturar un nuevo Pokémon, conseguir una baya o descansar.
- Hay ocho rutas, seguidas de cuatro combates del Alto Mando y uno contra el Campeón.
- No hay gráficos, balance definitivo, tipos implementados ni un mapa interactivo todavía. La pantalla es deliberadamente **HTML básico**.

## 3. Guardar y cargar en JSON

- **Guardar partida (.json):** descarga `slay-pokemon-partida.json`, con los datos de tu run actual. Puede aparecer un sufijo numérico si ya existe un archivo con ese nombre.
- **Cargar partida (.json):** selecciona ese archivo desde tu ordenador. Recuperarás progreso, equipo, medallas, movimientos y combate en curso.
- **Nueva run:** descarta el estado actual en memoria; guarda antes si quieres conservarlo.

**No hay guardado automático.** Por seguridad, un navegador no puede modificar silenciosamente un JSON de tu disco: cada guardado produce una descarga y para cargar eliges el fichero. No es una base de datos ni un servidor; es un sistema de partidas mediante archivos JSON.

## 4. Estructura

```text
SlayPokemon_Web/
├── index.html                # Abre esto para jugar
├── README.md                 # Estas instrucciones
├── .gitignore
├── .vscode/
│   └── extensions.json
├── assets/
│   └── README.md             # Reservado a gráficos y sonidos
├── docs/
│   └── ARQUITECTURA.md       # Reglas provisionales y puntos de extensión
├── src/
│   ├── data/
│   │   └── catalog.js       # Pokémon y movimientos de muestra
│   ├── core/
│   │   ├── state.js         # Estado de la run
│   │   └── engine.js        # Combate y progreso (demo)
│   ├── storage/
│   │   └── json-save.js     # Exportación/importación de JSON
│   ├── ui/
│   │   └── render.js        # HTML y botones sin estilo
│   └── main.js              # Inicialización
└── tests/
    ├── index.html          # Pruebas sencillas desde el navegador
    └── smoke.js
```

## 5. Subir los cambios a GitHub con VS Code

1. Copia el **contenido** de la carpeta del ZIP en la raíz del repositorio que ya tienes clonado.
2. Abre el repositorio desde VS Code.
3. Abre el panel **Control de código fuente** (icono de rama).
4. Revisa los cambios, escribe un mensaje como `Inicio del prototipo web` y pulsa **Confirmar / Commit**.
5. Pulsa **Sincronizar cambios / Push** para enviarlo a GitHub.

Si aún no lo has clonado, desde VS Code puedes utilizar **Git: Clone** e introducir la URL de tu repositorio. No subas archivos personales de guardado al repositorio.

## 6. Comprobar las pruebas

También puedes abrir `tests/index.html` en el navegador. Deberías ver varios resultados **OK**, sin instalar herramientas.

## 7. Decisiones pendientes

La mano global compartida y la interpretación exacta de los cambios de Pokémon siguen siendo **provisionales**. Consulta `docs/ARQUITECTURA.md` antes de desarrollar reglas más complejas. La prioridad de esta versión es verificar el arranque offline, la estructura de una run y el guardado manual en JSON.
