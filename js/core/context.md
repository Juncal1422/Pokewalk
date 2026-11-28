# PokeWalk · guía de continuidad

Ditto explora una mazmorra en tiempo real, derrota Pokémon, recoge esencias y cambia de forma al terminar misiones. Una **partida** comprende varias misiones; una **misión** tiene uno o más pisos de un mismo bioma. Cada run es una aventura numerada desde uno. El teletransportador conduce al tablón para elegir la siguiente misión. El nivel del jugador, el nivel del bioma y el número de misión son tres valores distintos.

## Retomar el desarrollo

El repositorio es [Juncal1422/Pokewalk](https://github.com/Juncal1422/Pokewalk). La versión que carga el juego se publica en [develop](https://github.com/Juncal1422/Pokewalk/tree/develop). El historial de esa rama contiene también los cambios de gráficos que sube el autor.

```sh
git clone --branch develop https://github.com/Juncal1422/Pokewalk.git
cd Pokewalk
git status --short --branch
git pull --ff-only origin develop
git log -5 --oneline
python -m http.server 8000
```

Abre [LOCAL_Pokewalk.html](http://localhost:8000/LOCAL_Pokewalk.html) y recarga después de editar los módulos. El servidor debe usar la raíz del repositorio. Los módulos ES y las lecturas de JSON necesitan HTTP. La versión local sigue descargando los sprites externos de PMDCollab. El juego arranca al importar `startGame` desde `js/main.js`, sin compilación ni instalación de paquetes. Recargar interrumpe la aventura y devuelve al gremio con los descubrimientos guardados.

`PokeWalk.html` consulta la API pública de GitHub para obtener el SHA de la punta de `develop` e importa `js/main.js` desde RawCDN de Githack, fijado a ese SHA. Los recursos propios se resuelven con `assetUrl` respecto de la URL del módulo. En RawCDN se solicita el archivo directamente a raw.githubusercontent.com para evitar su redirección 301 sin cabecera CORS al abrir desde disco. Las copias antiguas del conector importan el mismo SHA desde jsDelivr. Para mantener la distribución por debajo de 50 MB, .gitattributes excluye del archivo de distribución los WAV de reserva. El clon conserva el banco completo. Al vincular un nuevo sonido en audio.js, añade su ruta con -export-ignore en .gitattributes. Para publicar con una sesión de Git autorizada, revisa `git diff`, prepara los archivos de la tarea **incluido este contexto**, crea el commit y ejecuta `git push origin develop`. Verifica que `git ls-remote origin refs/heads/develop` devuelve el commit publicado. El acceso de escritura corresponde a la cuenta autorizada; las credenciales se gestionan fuera del proyecto.

Si se usa el conector GitHub, lee primero la referencia de `develop`. Construye el árbol sobre el del commit leído, conserva las rutas sin cambios, crea el commit con ese padre y actualiza la rama con el SHA anterior como condición. Si el autor ha subido algo entretanto, integra sus cambios antes de publicar. El historial publicado se consulta con `git log --oneline -- js/core` o por ruta concreta.

## Principios del proyecto

- Actualiza esta guía **en el mismo commit que cada cambio**. Revisa las reglas afectadas, contratos de datos, controles, índice de métodos y la entrada de avance. El historial completo vive en Git. Mantén las instrucciones de arranque utilizables desde una copia limpia.
- Usa nombres que expresen qué se mide y dónde. Distingue coordenadas de casilla, píxeles del mundo y píxeles de pantalla; indica la unidad en duraciones y distancias ambiguas. Comenta cada método y las decisiones internas que afecten a orden, colisiones, costes o persistencia.
- Comparte cálculos entre la simulación, la previsión de recompensas y el dibujo. Las reglas de combate usan posiciones del mundo y el reloj de simulación. El zoom, el tamaño de la ventana y la frecuencia del monitor pertenecen a presentación.
- Conserva los contratos entre módulos y catálogos. Los identificadores de objetos, beneficios y esencias enlazan los datos con el comportamiento y los PNG. Las listas de bioma se editan por nombre de especie y se resuelven a número de Pokédex al cargar.
- Usa tilesets reales con su paleta original y las máscaras de colisión del atlas. Mantén transparencia en los gráficos, orientación de las hojas y aspecto pixelado. Para paneles usa el marco azul de nueve partes. Los números de combate se dibujan directamente en el mundo.

## Flujo de una partida

1. **Arranque.** `startGame` reinicia el estado y el reloj, monta la interfaz, valida los catálogos, precarga efectos y abre el gremio. Ditto comienza en el nivel 5. El favicon se establece desde JavaScript. El mundo vive en memoria. La colección, los emblemas, las preferencias y las crónicas se guardan en el navegador.
2. **Piso.** La generación trabaja con suelo y medio sólido, añade autotiles y variantes, y coloca los combatientes en centros de sala. Las habilidades `fly`, `swim` y `lavawalk` de la especie se cruzan con las permitidas por el bioma. El mapa lógico tiene 44 × 34 casillas de 24 píxeles. La cámara sigue al jugador. El dibujo del techo interior puede variar en el autotile 46.
3. **Controles y simulación.** WASD o flechas mueven, el clic principal ataca, espacio hace un dash y Q/E/R usan activas. Perder el foco cancela el movimiento. El reloj avanza a pasos de 1/60 s, a velocidad global ×1,1, y se pausa durante las transiciones. El bucle actualiza habilidades y entidades, recoge objetos, comprueba salidas y dibuja.
4. **Combate.** Un ataque normal prepara un impacto que se consume al alcanzar el instante de contacto. Rango y tamaño determinan la distancia. Ataque y defensa determinan el daño del golpe. El nivel influye a través de las estadísticas. Evasión base del 5 %, crítico del 10 % y gracia del jugador tras recibir daño. El límite de medio máximo de PV del jugador corresponde a habilidades de líder. Hurt, reacción del líder y fundido de derrota tienen tiempos propios.
5. **IA.** La detección inicial requiere línea de visión y alcanza diez veces el rango de ataque. Un muro bloquea la visión y el vuelo. Si la presa desaparece tras un muro, el enemigo solo investiga la última posición observada. La persecución favorece diagonales si hay visión directa. La búsqueda en anchura usa las mismas restricciones de terreno que el movimiento. Un MISS puede activar una esquiva lateral progresiva. Los terrestres con menos del 15 % de PV pueden hacer una retirada breve. Los salvajes reciben el beneficio de su especie, anuncian las activas durante 0,5 s y tienen la mitad de recarga. Los efectos ofensivos se dirigen al jugador en rango.
6. **Experiencia.** La recompensa es el nivel del rival multiplicado por la suma de sus PV, ataque, defensa y velocidad **base** dividida entre 500, redondeada con mínimo uno. Los líderes dan el doble. El siguiente umbral es `ceil(26 × 1,105^(nivel − 5))`. Se conserva el excedente; el nivel de partida llega a 100 y la forma respeta el máximo de su ficha. Las estadísticas salvajes progresan con la misión. Subir de nivel recalcula los PV máximos sin rellenar la vida actual.
7. **Recogidas.** Las esencias caen en el lugar de la derrota. Los objetos aleatorios tienen una tirada base del 10 % por piso y un máximo de tres por misión. Las bayas tienen una tirada separada del 50 % por piso que selecciona entre las cinco variedades. Aranja y Zidra curan el 10 % y el 40 % respectivamente, sujetos al máximo de PV y a Mentolado. Los consumibles salen de la lista de equipo. El Carameloraro puede aparecer una vez por misión. Las grajeas curan al recogerlas según el saldo de su tipo y duplican las futuras recogidas de ese tipo.
8. **Objetivo y salida.** Recuperar objeto exige alcanzar el paquete del último piso. Limpiar exige derrotar a los enemigos de cada piso. Cazar permite subir si ya no queda la presa en el piso y abre el teletransportador al alcanzar la cuota. Líder es una oferta del tablón y abre una sola arena. Rescate permite subir hasta la última planta. Allí el aliado huye y los salvajes lo buscan a cualquier distancia hasta que el jugador les hace daño. Si muere, la salida permite continuar sin mejora ni emblemas. Escaleras y teletransportador tienen efectos distintos sobre la partida.
9. **Transformación.** Al salir de una misión se proyectan hasta tres opciones. Se priorizan evoluciones pagables, se consideran esencias acumuladas y especies derrotadas, y el líder de un encargo rojo derrotado se ofrece expresamente como forma. Una evolución con un don distinto concede el beneficio de su nueva forma y consume el saldo requerido de un solo tipo. La cantidad efectiva es el coste de la ficha multiplicado por 1,30 y redondeado hacia arriba. Se aplican la forma, los beneficios y el pago al cargar la misión siguiente. Mantener la forma o repetir un beneficio suma tres al tamaño y uno a cada otro atributo plano. Conservar la forma sin elegir tarjeta no da ese aumento. Cambiacaras permite una elección adicional.
10. **Beneficios y equipo.** Los pasivos se acumulan hasta 27 beneficios (3 columnas de 9). Con la colección llena, una nueva alta sin sustitución da el bono de atributos. El equipo admite 75 objetos (3 filas de 25, desde abajo). Una activa nueva sustituye la de su propia tecla. Q y E conservan recargas independientes y el icono muestra su progreso radial. Los objetos permanentes se muestran abajo y los beneficios a la izquierda. Los colores del panel de atributos comparan el resultado de los beneficios con el mismo nivel, forma y bonos permanentes.

## Pommedew y el tablón

La bienvenida se muestra una vez por colección. Los cuatro mensajes usan Wondermail y textbox-g. Nueva Aventura y los teletransportadores muestran tres encargos de tipos distintos, o cuatro con Ticket perdido. El tablón tiene un 15 % (22,5 % con Mapa perdido) de probabilidad de contener un único papel rojo. Este conserva la franja de la misión y aumenta en 10 el nivel normal del enemigo, respetando el límite de especie. El aliado rojo usa el nivel actual del jugador. Los pisos de rescate siguen el intervalo de recuperar objeto.

El pago base es el nivel de bioma ×0,7 redondeado hacia arriba, más 0 por recuperar, 1 por cazar o limpiar, 2 por rescatar o 3 por líder, acotado a 1–10. El papel rojo triplica ese importe. La crónica marca el pago antes de abrir las tarjetas y evita volver a cobrar durante un reintento. Al caer Ditto se registra la derrota y se regresa al gremio. La EXP y el equipo de combate empiezan de nuevo en cada aventura.

La clave local `pokewalk.pommedew.collection.v1` conserva metadatos, identificadores y datos históricos. No serializar catálogos, combatientes, inventarios jugables ni mapas. En historial se guardan las formas, el equipo descubierto, los beneficios, el nivel, los atributos y las misiones con su bioma, piso, estado y pago. El reinicio no reanuda una crónica interrumpida. Los ID desconocidos siguen siendo consultables tras importar. Exportar e importar usan el mismo JSON; se valida antes de reemplazar.

Las reliquias ordinarias se pueden activar desde el inicio. Los tres huevos y las tres reliquias de los Regis se ganan por victoria con su objeto. La tienda desbloquea beneficios por un emblema. En Colección → Beneficios se elige uno para empezar o se desactiva. Los interruptores se fijan al aceptar el primer encargo. Cinta Negra limita defensa a la base de entrada de cada forma y convierte la mitad entera del excedente en ataque. La batería se activa con R. Cada 4 esencias eléctricas compran una descarga en la aventura. Las afinidades de Fuego y Eléctrico se multiplican por cada tipo defensor; una antigua inmunidad aplica un multiplicador de 0,5. Punzante y los ataques normales conservan daño neutro.

## Archivos y ámbitos de estado

| Ruta | Responsabilidad |
| --- | --- |
| `js/main.js` | Montaje del DOM, arranque, transiciones, paneles del piso y bucle principal. |
| `css/pokewalk.css`, `js/core/interface-theme.js` | Tema de todas las pantallas. Define paleta, opacidades, fondos, escalas y variantes de textbox. El módulo carga la hoja desde la misma revisión que el juego y prepara el tema del canvas al arrancar. |
| `js/core/state.js`, `clock.js` | Estado compartido y tiempo de simulación. La partida conserva experiencia, objetos, bonos y esencias. La misión conserva cuota, bajas y apariciones. Cada piso reemplaza entidades, efectos, objetos caídos, salida y avisos de mundo. |
| `js/data/pokemon.json` | Fichas de especie, estadísticas base, límite de nivel, tipo, esencias, evolución, medios transitables y lista de animaciones. |
| `js/data/biomes.json` | Atlas, medio, permisos, nivel 1–10, variantes, modificadores de generación y listas de salvajes/líderes para las misiones 1–8, 9–16, 17–25, 26–36 y 37–50. Los límites de pisos y cantidad de encuentros están en `missions.js`. |
| `js/data/items.json`, `benefits.json` | Catálogos de objetos y beneficios, texto visible, PNG y parámetros. Cada donante tiene un único beneficio. Las mecánicas específicas se resuelven en `items.js`, `benefits.js`, `abilities.js` y `entities.js`. |
| `js/data/synergies.json` | Cada efecto exige todos los beneficios de `requires` y, cuando existe `anyOf`, al menos uno de ese segundo grupo. El combate y la generación de objetos consultan este catálogo. |
| `js/data/biomeeditor.html` | Editor de biomas, apariciones por franja y exportación de biomes.json. Admite apertura de archivos desde disco. |
| `assets/`, `tiled/tilesets/` | Gráficos propios de IU, objetos, beneficios, efectos, atlas y máscaras. Los sprites y retratos de especies proceden de PMDCollab/SpriteCollab. |

## Avance y comprobaciones para continuar

La introducción, el gremio, el tablón, Rescate, las reliquias y los sonidos se incorporaron sobre `eca3bf7`. Para ampliar el futuro mapa del gremio, reutiliza las acciones de tienda, colección y selección de misión de `guild.js`. Las páginas largas usan las flechas de `assets/ui`. `audio.js` vincula eventos del juego con el banco `sounds/`; todos los textos de la aplicación y el canvas usan `assets/ui/wondermail.ttf`.


La revisión del 24 de noviembre de 2026 parte de `85bffb3`, que incorporó experiencia, objetos, activas Q/E y Magma Cavern. La base incluye 627 fichas, 14 biomas, 32 objetos y 20 beneficios. Esta revisión documenta los módulos y separa los avisos de EXP y curación del dibujo de la entidad. Ambos guardan una posición del mundo al nacer y duran 950 ms de simulación. Una baya muestra los HP efectivamente recuperados. La animación gráfica de curación sigue al Pokémon.

Revisión de equilibrio posterior a `bf968d0`. Los atributos del jugador parten de una reducción del 20 % sobre el valor de nivel 5 de la forma, antes de los bonos y respetando los mínimos. Desde la misión 5 aumenta el crecimiento de nivel enemigo y hay un aumento acumulativo de ataque, defensa y PV. Las combinaciones del catálogo cubren los tres efectos dorados, Punzante seguida de Cuerno con tiradas independientes, sustitución de bayas y descargas de ocho espinas al bloquear o recibir daño. Las espinas recorren 32 unidades en 680 ms. Flare recorre su alcance en 750 ms. Núcleo de pólvora carga 350 ms para el jugador y explota durante 1 s con radio 72. El amuleto tiñe el sprite mientras dura su bonificación.

Para comprobar cambios en este flujo, recoge una baya a pocos PV, a un PV del máximo y con la vida llena. Derrota enemigos, ataca y camina mientras se ve el aviso azul. Dos avisos simultáneos deben conservar líneas separadas y desaparecer al cambiar de piso. Comprueba también una transición de misión, una transformación y una activa de cada tecla. Para revisar la sintaxis desde la raíz, usa `find js -name '*.js' -exec node --check {} \;` con Node moderno.

### [js/core/asset-url.js](asset-url.js)

- `assetUrl` — Resuelve la ruta de recursos estáticos, conservando el SHA y el servidor local de desarrollo.

## Índice de métodos

Las rutas son relativas a este documento. Se incluyen funciones exportadas, auxiliares internos y funciones locales con nombre. Los manejadores asociados directamente a un evento se explican junto a su registro.

### [js/core/abilities.js](abilities.js)

- `sequence` — Construye la lista ordenada de imágenes que forman un efecto.
- `loadEffects` — Decodifica todos los fotogramas antes de habilitar las habilidades.
- `effect` — Registra en el piso un efecto con origen, orientación, duración y hora de inicio.
- `pickupEffect` — Vincula el efecto de recogida al cuerpo del jugador para acompañarlo mientras dura.
- `drawEffects` — Selecciona el fotograma por tiempo de simulación y proyecta el efecto con su escala y filtro.
- `drawFang` — Recorta la dirección correspondiente en la hoja de armas y conserva el estado del canvas.
- `utilityCast` — Comparte salto de sala, teletransporte de piso, parálisis y evasión entre Ditto y los salvajes.
- `landing` — Sortea un destino libre de suelo en la sala o el piso teniendo en cuenta los cuerpos que la ocupan.
- `useActive` — Valida la tecla, el estado del jugador y el coste antes de iniciar el lanzamiento y su recarga.
- `launchFlare` — Fija el origen, alcance y daño del proyectil en el instante del disparo.
- `releaseSpines` — Crea ocho proyectiles equidistantes cuyo daño depende de la defensa al recibir el crítico.
- `blast` — Resuelve la explosión circular, incluido el daño que recibe su propietario.
- `spin` — Gira al atacante y registra a quién ha alcanzado para evitar impactos repetidos durante las dos vueltas.
- `updateWildAbility` — Alterna entre apuntar, anunciar y ejecutar la activa de un salvaje, y vuelve a comprobar la distancia.
- `tickAbilities` — Actualiza lanzamientos, bonificaciones temporales y colisiones continuas de proyectiles.

### [js/core/attack-motion.js](attack-motion.js)

- `attackMotion` — Sincroniza desplazamiento, impacto y desvanecimiento con los tiempos de la hoja de animación.

### [js/core/benefits.js](benefits.js)

- `synergyActive` — Evalúa los requisitos del efecto en la colección de beneficios.
- `amount` — Devuelve la magnitud del beneficio si pertenece a la colección consultada.
- `playerStats` — Aplica los modificadores pasivos y temporales sobre la forma, el nivel y los bonos permanentes.
- `projectReward` — Calcula en copias el coste, los atributos y las activas que resultarían de elegir una tarjeta.

### [js/core/clock.js](clock.js)

- `gameTime` — Devuelve los milisegundos transcurridos en la simulación.
- `resetClock` — Descarta el tiempo acumulado y el instante del fotograma anterior al reiniciar.
- `advanceClock` — Convierte el intervalo real entre fotogramas en pasos fijos de simulación acelerada.

### [js/core/constants.js](constants.js)

Constantes de escala, temporización, direcciones y especies excluidas.

### [js/core/dungeon.js](dungeon.js)

- `normalize` — Elimina diagonales desconectadas de los vecinos que las sostienen.
- `autotile` — Convierte los vecinos de una casilla en una máscara y un índice del atlas.
- `setFloorVariant` — Asigna una variante visual a una casilla válida de suelo.
- `randomInt` — Genera un entero aleatorio con ambos límites incluidos.
- `clampLevel` — Ajusta la complejidad de generación al intervalo entero de uno a cinco.
- `carveTile` — Abre suelo de la anchura pedida sin perforar el borde exterior.
- `connect` — Une centros de sala mediante tramos ortogonales y desvíos según la complejidad.
- `carveHorizontal` — Abre el tramo horizontal hasta la columna del siguiente punto.
- `carveVertical` — Abre el tramo vertical hasta la fila del siguiente punto.
- `createRoomInCell` — Construye una sala o un cruce dentro de una celda de generación.
- `carveRooms` — Conecta salas y cruces y entrega primero los puntos aptos para situar combatientes.
- `carveArena` — Abre una sola sala con puntos de aparición enfrentados para jugador y líder.
- `generateDungeon` — Genera el terreno lógico y deriva las capas de autotiles y variantes decorativas del bioma.

### [js/core/enemy-ai.js](enemy-ai.js)

- `cell` — Convierte una posición del mundo en índice de casilla.
- `center` — Devuelve el centro de una casilla en píxeles del mundo.
- `land` — Consulta si una casilla del mapa está marcada como suelo.
- `standingOnLand` — Consulta la máscara de colisión en un punto para distinguir suelo y medio especial.
- `route` — Explora casillas en anchura y reconstruye un camino de persecución, retirada o vuelta a tierra.
- `distanceAfter` — Ordena vecinos a igual profundidad según su distancia cuadrática a la meta.
- `trySidestep` — Prueba ambos flancos tras un fallo y reserva un tramo de esquiva que pueda recorrerse a pie.
- `updateEnemy` — Decide la acción del enemigo según el terreno, la visibilidad, la distancia y los tiempos de reacción.

### [js/core/entities.js](entities.js)

- `showToast` — Muestra un aviso temporal y sustituye el temporizador del aviso anterior.
- `createEntity` — Construye un combatiente en el centro de su sala con sus estadísticas y animación iniciales.
- `setState` — Reinicia el fotograma y el temporizador únicamente al cambiar de acción.
- `bodyRadius` — Calcula el radio físico de la entidad a partir de su tamaño y la regla de paso por corredores.
- `terrainFree` — Combina las habilidades del Pokémon y el medio del bioma con la geometría del terreno.
- `canMove` — Comprueba la posición contra los muros y los cuerpos vivos del piso.
- `triggerAttack` — Prepara un solo impacto pendiente y selecciona la animación para el arma equipada.
- `resolveImpact` — Comprueba objetivos en el instante de contacto y resuelve evasión, crítico y retroceso.
- `inStrike` — Mide la distancia al segmento frontal del ataque incluyendo el radio de contacto.
- `inflictDamage` — Aplica defensas, gracia, daño, reacción Hurt y consecuencias de la derrota.
- `loadLevel` — Precarga combatientes y prepara la geometría, enemigos, objetos y efectos del siguiente piso.
- `moveEntity` — Normaliza la dirección y avanza en subpasos para comprobar incluso las esquinas estrechas.
- `updateEntity` — Procesa controles o IA y avanza la animación hasta el impacto y el final de la acción.

### [js/core/evolution.js](evolution.js)

- `evolutionCost` — Calcula el coste entero compartido por pago, elegibilidad y barras.
- `evolutionPayment` — Selecciona una esencia con saldo suficiente y devuelve el coste de esa evolución.

### [js/core/experience.js](experience.js)

- `experienceCost` — Calcula el coste exponencial del siguiente nivel.
- `levelUp` — Actualiza el nivel de la partida y recalcula los atributos de la forma actual respetando su límite.
- `awardExperience` — Pondera la recompensa por nivel y estadísticas base y reparte el excedente entre niveles sucesivos.

### [js/core/hud.js](hud.js)

- `essenceIcon` — Obtiene la imagen precargada de un tipo de esencia.
- `textBox` — Dibuja el marco de mensajes con el recurso compartido de la interfaz.
- `formatValue` — Abrevia cantidades grandes para que quepan en los contadores.
- `loadHud` — Precarga las esencias y los marcos utilizados por la interfaz del canvas.
- `indicators` — Dibuja los cambios temporales de un atributo junto a su valor.
- `drawHud` — Compone la vida, experiencia, esencias, atributos y objetivo en coordenadas de interfaz.

### [js/core/interface-theme.js](interface-theme.js)

- `loadInterfaceStylesheet` — Carga la hoja una sola vez y resuelve las URLs de fuentes, fondos y marcos contra su ruta de origen.
- `readCanvasTheme` — Lee las propiedades CSS de los paneles del HUD y los efectos del mundo antes del primer dibujo.

### [js/core/input.js](input.js)

- `attachInput` — Vincula teclado, puntero y pérdida de foco al canvas y devuelve el controlador de los eventos.
- `listen` — Registra cada evento con la misma señal para poder desmontar todos los controles.
- `cancelInput` — Vacía las direcciones pulsadas y detiene la marcha al perder el foco.
- `attack` — Inicia el ataque del jugador si el piso está activo y el jugador sigue vivo.
- `isPanel` — Reconoce los paneles que permiten transmitir el clic como ataque.

### [js/core/inventory.js](inventory.js)

- `attachInventory` — Enlaza los iconos de objetos y beneficios y devuelve la actualización del panel.
- `updateCooldown` — Convierte el tiempo restante de cada activa en el ángulo sombreado de su icono.

### [js/core/items.js](items.js)

- `loadItemImages` — Precarga las imágenes por identificador para reutilizarlas en cada piso.
- `spawnFloorItems` — Sortea por separado la baya y el objeto de equipo, respetando el cupo del bloque de pisos.
- `place` — Reserva una casilla libre del conjunto de ubicaciones y sitúa el objeto en su centro.
- `collectItems` — Resuelve las recogidas por contacto o alcance y aplica sus efectos antes de retirar el objeto.
- `drawItems` — Proyecta las posiciones de los objetos y las esencias del suelo respecto de la cámara.

### [js/core/message-frame.js](message-frame.js)

- `drawFrame` — Conserva las esquinas del marco y estira sus bordes alrededor del fondo translúcido.

### [js/core/missions.js](missions.js)

- `sample` — Elige un elemento de una lista con distribución uniforme.
- `between` — Sortea una cantidad entera entre los dos límites incluidos.
- `chooseBiome` — Pondera cada bioma por la distancia entre su nivel y la dificultad preferida de la misión.
- `newMission` — Selecciona tipo, franja de encuentros, número de pisos, presa y parámetros de generación.
- `encounters` — Sortea el grupo del piso y garantiza una presa en caza o un único líder en la arena.
- `onDefeat` — Deja las esencias en el suelo y atribuye experiencia y progreso de misión a las bajas del jugador.
- `exitKind` — Determina qué salida u objetivo se puede colocar según el estado de la misión.
- `rewardOptions` — Prioriza las evoluciones pagables y completa las opciones con especies derrotadas y esencias acumuladas.
- `add` — Registra una opción de transformación y marca su especie para evitar duplicados.

### [js/core/pokemon-panel.js](pokemon-panel.js)

- `portrait` — Crea el retrato de especie con un segundo origen para fallos de carga.
- `gem` — Crea el icono accesible de un tipo de esencia.
- `element` — Crea un nodo de interfaz y asigna su texto cuando se proporciona.

### [js/core/renderer.js](renderer.js)

- `loadTileset` — Compila la hoja rotulada en tileset-atlas.js y lee sus bancos de paleta.
- `changeBiome` — Activa el atlas solicitado y descarta respuestas de peticiones anteriores.
- `preparePortal` — Espera a los recursos de las salidas, el paquete y la indicación de fallo.
- `draw` — Proyecta el piso, ordena combatientes por profundidad y compone efectos, avisos y HUD.

### [js/core/rewards.js](rewards.js)

- `evolutionBars` — Muestra el saldo disponible por cada esencia admitida en las evoluciones de la tarjeta.
- `rewardCard` — Proyecta una transformación y construye su comparación de atributos antes de aceptar el gasto.
- `chooseReward` — Abre las opciones de final de misión y devuelve la elección o la decisión de conservar la forma.
- `fit` — Ajusta el diálogo completo a las dos dimensiones de la ventana.

### [js/core/state.js](state.js)

- `resetGameState` — Cancela el bucle anterior y descarta las referencias al mapa, al jugador y a la interfaz.

### [js/core/stats.js](stats.js)

- `emptyBonuses` — Crea un conjunto independiente de bonos permanentes con todos sus valores a cero.
- `levelFor` — Limita el nivel efectivo al máximo de la especie.
- `enemyProgress` — Calcula la progresión de los salvajes a partir de la dificultad de la misión.
- `attackReach` — Combina alcance y tamaño para obtener la distancia real de ataque.
- `movementRate` — Convierte velocidad en un multiplicador de movimiento y animación.
- `attackRate` — Aplica rendimientos decrecientes al ritmo de ataque a partir de su atributo.
- `naturalStat` — Calcula un atributo de la especie antes de equipo, beneficios o ajustes del líder.
- `statsFor` — Combina nivel, especie, escalado de líder y bonos, y aplica los límites de cada atributo.
- `damageFor` — Calcula el daño de un golpe normal a partir de nivel, ataque, defensa y crítico.

### [js/core/terrain.js](terrain.js)

- `readWallShapes` — Agrupa los píxeles sólidos de cada máscara en rectángulos para las pruebas de colisión.
- `solid` — Lee un píxel de la máscara prolongando su interior hasta el borde de la celda.
- `loadTerrain` — Decodifica la máscara de referencia y conserva las formas de colisión comunes a los biomas.
- `hasSight` — Comprueba la línea de visión con las máscaras de los muros.
- `groundFree` — Comprueba el borde del mapa y la distancia entre el cuerpo circular y las zonas sólidas.

### [js/core/world-notices.js](world-notices.js)

- `showWorldNotice` — Registra cantidad, color y coordenadas de aparición del texto en el piso actual.
- `drawWorldNotices` — Dibuja los avisos en su posición de mundo hasta que termina su duración.

### [js/data/biomes.js](../data/biomes.js)

- `loadBiomes` — Valida el nivel del bioma y convierte nombres de especie y rutas del catálogo en datos de juego.
- `roster` — Resuelve las cuatro franjas de encuentro y señala la primera especie desconocida.

### [js/data/encounters.js](../data/encounters.js)

- `readData` — Lee un catálogo relativo al módulo y conserva el nombre del fichero en el error de carga.
- `loadEncountersCatalog` — Carga especies y objetos y valida las estadísticas antes de indexar por Pokédex.

### [js/data/pokemon-data.js](../data/pokemon-data.js)

- `frameCenters` — Mide el centro de los píxeles opacos de cada pose para compensar los saltos internos de la hoja.
- `fetchAnimation` — Prueba las acciones disponibles en orden y resuelve CopyOf antes de descargar la hoja y sus duraciones.
- `loadPokemonData` — Carga y almacena en caché las acciones de una especie, con alternativas cuando falta una animación.

### [js/main.js](../main.js)

- `mountApp` — Monta el canvas y los paneles una sola vez en el contenedor del juego.
- `placePortal` — Escoge suelo libre para escaleras, teletransportador o paquete fuera de la casilla del jugador.
- `nextLevel` — Pausa los controles y gestiona el paso de piso o la selección de mejora y el cambio de misión.
- `updateRoster` — Sincroniza las tarjetas de enemigos vivos conservando sus nodos y retratos.
- `updateNearby` — Agrupa objetos próximos por tipo y actualiza el panel si ha cambiado su contenido.
- `frame` — Ejecuta pasos fijos, procesa recogidas y objetivos y solicita el siguiente repintado.
- `startGame` — Prepara interfaz y catálogos, inicia la primera misión y enlaza el ciclo de vida del juego.
- `resize` — Adapta el búfer del canvas al tamaño real de la ventana y vuelve a dibujar.


### Gremio, sonido y persistencia

- [guild.js](guild.js) — `visitGuild`, `home`, `introduction`, `screen`, `button` e `icon` presentan la bienvenida y la navegación. `selectMission` espera la selección de una oferta. `listPage`, `historyDetail`, `collectionMenu` y `open` paginan y consultan descubrimientos. `shop`, `settings`, `confirmChange` y `guildMessage` gestionan compras, archivos y avisos.
- [collection.js](collection.js) — `emptyCollection`, `parseCollection`, `saveCollection` y `loadCollection` gestionan el esquema y la persistencia. `beginChronicle`, `discover`, `checkpoint`, `recordFloor` y `settleMission` registran la aventura y liquidan el pago una vez.
- [audio.js](audio.js) — `playSound` reproduce el efecto con el volumen de la colección.
- [missions.js](missions.js) — `missionOffers` genera la pareja de contratos.
- [enemy-ai.js](enemy-ai.js) — `fleeRescue` escoge un paso transitable que aumente la separación respecto de las amenazas.
- [abilities.js](abilities.js) — `elementalHit` aplica afinidades antes del daño compartido.
- [benefits.js](benefits.js) — `combatBenefits` obtiene el conjunto del combatiente que recibe o ejecuta el golpe.
- [main.js](../main.js) — `pagePanel` pagina los avisos y fichas del piso con las flechas de interfaz.

## Catálogos y combate del gremio

Las cuadrículas de colección usan los gráficos de ui. `speciesPage` muestra la ficha base y `catalogCard` permite consultar donantes. `benefitSynergies` resuelve los nombres y efectos de las combinaciones en la ficha de cada beneficio. Al cargar o importar una colección, se traducen los identificadores históricos de beneficios.

Los objetos y beneficios aportan bonos planos. Ditto parte de tamaño 100. Corona real y Brote acuático consultan tanto el equipo como los beneficios. Revivir se consume en el primer golpe letal y no vuelve a aparecer en esa aventura. La carga salvaje dura 500 ms y un golpe ordinario no la cancela. Los aliados de rescate usan colisión de suelo y los encuentros se sortean con reemplazo. Los indicadores de subida de nivel duran cuatro segundos.

## Pruebas del gremio y combate elemental

La tienda, objetos, beneficios, reliquias y Pokédex muestran el catálogo de pruebas en páginas de 8 × 8. Cada tabla recorta la pieza central del atlas en cada celda y conserva su marco exterior de nueve piezas. El historial sigue registrando descubrimientos reales. Debugger está disponible desde el inicio y se equipa voluntariamente. Multiplica por cuatro los atributos finales y las esencias brutas y por 1,5 la probabilidad de objetos de equipo.

Las cinco franjas contienen 7/6/6/5/5 salvajes y 4/4/3/3/2 líderes. La cobertura se revisa en sin-encuentro.md. Las hojas direccionales ordenan las direcciones por fila y los fotogramas por columna. Los efectos se reproducen a media velocidad, salvo la duración expresa de un segundo del aura de roca. Los impactos aceptados guardan un aviso por golpe con la diferencia real de PV. El HUD lee esos mismos PV en cada dibujo.

- `launchWeapon` crea el proyectil que sustituye el ataque normal.
- `knockback` comprueba la colisión a cada paso de empuje.
- `featherStun` interrumpe a los enemigos dentro del rango tras recibir un crítico. El aturdimiento dura 300 ms.
- `payEssences` valida y descuenta el coste completo de Sedal y Regenerativo.
- `releaseSpecial` resuelve defensa, curación y aura tras la carga.

La hoja de featherfall contiene sus 23 cuadros consecutivos en el orden de los originales. La precarga señala el nombre de ruta si no se puede decodificar un recurso.

### Compatibilidad del ataque básico e interfaz

- `weaponConflict` en benefits.js mantiene compatibles Punzante y Cuerno de Rhyhorn. Acuático, Ancestral y Tirarrocas sustituyen el ataque completo. `projectReward` calcula en una copia los beneficios desplazados, también por la ranura activa. La tarjeta muestra sus nombres y la selección aplica esa misma proyección. Un bono de atributos conserva el equipo.
- Debugger activo inicia cada aventura con 100 esencias de cada uno de los 17 tipos. Mantiene el tamaño normal, cuadruplica ataque y defensa, triplica velocidad y duplica los demás atributos salvo tamaño. Las recogidas de esencias siguen multiplicándose por cuatro.
- El aviso del Núcleo de roca salvaje dura 1000 ms de simulación. El jugador y las demás activas salvajes conservan sus tiempos.
- El HUD se amplía un 20 %. El detalle del piso utiliza el 90 % de su escala anterior y pagina hasta nueve fichas. Las descripciones cercanas tienen escala 1,4. `positionTooltip` (message-frame.js) ancla la ficha al puntero o al control enfocado y escoge el lado disponible. Las tarjetas de oferta conservan su propio marco y las cuadrículas de colección muestran la casilla central sin bordes.

### Hojas de efectos, crónicas y gremio

Cada efecto tiene su PNG en assets/effects/nombre/nombre.png. Las secuencias lineales avanzan de izquierda a derecha. loadEffects carga sólo las hojas que usa el combate. drawEffects alinea el anclaje vertical del fotograma al origen del efecto antes de escalarlo. Mine usa 48 px, boost 39 y rock_aura 30. Las armas direccionales conservan la distribución de sus celdas.
Los beneficios que cambian el ataque declaran spriteanimations con los nombres de PMDCollab en orden de prioridad y Charge al final. triggerAttack fija la hoja para toda la acción y para la detección de impacto.
El detalle de crónica reúne stats, misiones, formas y equipo en una vista. Las flechas del piso paginan de nueve en nueve. El HUD identifica las esencias bajo el cursor. El gremio sortea uno de dos fondos por apertura de menú y usa bgdefault para las demás pantallas, con introducción en negro. Cursor acompaña la navegación, Exclamation la selección de misión y Use TM la mejora.

### Carga de menús y final de aventura

Cada pantalla carga su fondo y su atlas de catálogo a través del CSS al abrirse. El tablero muestra las ocho partes exteriores del atlas alrededor de sus 64 celdas. Las confirmaciones del gremio usan textbox-p. La crónica reserva los retratos para la lista de formas.
Los pisos se cargan desde loadLevel sin depender de un indicador de carga en el DOM. settleMission liquida una sola vez el premio final y registra Exitosa al completar 50 misiones con éxito. El siguiente fotograma devuelve al gremio. Si falla un rescate, la siguiente oferta conserva el número de dificultad y abre un nuevo registro de misión. Una derrota cierra la aventura como Fallida y una recarga como Interrumpida.


### Tema de la interfaz y beneficio Dorado

Edita [css/pokewalk.css](../../css/pokewalk.css) y recarga para aplicar el tema. El primer bloque reúne la paleta, las opacidades, el escalado, los fondos del gremio y los atlas de catálogo. En la asignación de textbox, `--textbox-frame` selecciona la imagen del panel y `--frame-width` ajusta su ancho. Usa `none` y un ancho de cero para retirar el marco y su espacio. Los paneles de canvas eligen su variante con `--hud-*-textbox`. El resumen de aventura usa el marco azul.

Los fondos pixelados se escalan con `image-rendering`. Mejoras conserva visible el último fotograma de la mazmorra mediante un diálogo y un backdrop transparentes. Dorado aplica `--player-golden-filter` al sprite del jugador mientras conserva el beneficio. Los filtros temporales tienen prioridad y el tinte vuelve cuando terminan.

### Atlas rotulados, animaciones y diagnóstico

Los PNG de tiled/tilesets comparten una plantilla física. Para añadir biomas y ajustar las probabilidades consulta [biomeguide.md](../../tiled/tilesets/biomeguide.md).

mediumFrequency controla la proporción esperada de manchas de terreno secundario dentro de los obstáculos. Cero genera sólo muros. El suelo, el muro y el medio secundario tienen valores lógicos 0, 1 y 2. La conexión visual exige igualdad de material. Los muros bloquean la visión y el paso incluso para especies con vuelo. Las cuatro franjas de wild y leaders se editan por nombre de especie.

La consola registra decisiones con [IA], transiciones de sprite con [Animación] y secuencias visuales con [Animación de efecto]. El daño ordinario permite terminar las hojas alternativas y los lanzamientos especiales. Los proyectiles que han impactado terminan sus fotogramas en el punto de contacto.

### Combate, catálogo y arte de noviembre

La guía de la plantilla física, las paletas y las probabilidades del piso está en [biomeguide.md](../../tiled/tilesets/biomeguide.md). Los suelos se sortean entre piezas únicas. Las cantidades de esencia se muestran en una fila inferior.

Los campos stats de los catálogos son puntos planos. Evasión, bloqueo y ataque crítico parten de 5, 0 y 10, con máximos de 50, 100 y 100. Los demás atributos tienen mínimo 5. Compacto compara el tamaño efectivo con 100 al recalcular la defensa. applyBenefitStats y playerStats se usan también en la previsión. modifiers.js reúne rules y affinity de beneficios, equipo y reliquias. rule suma magnitudes por evento, actorRule selecciona las fuentes del combatiente y affinity multiplica resistencias.

Las activas especifican slot y amount (segundos de recarga). Crupier y Botín carecen de recarga adicional: los limitan su animación y el coste que corresponda. dropItem reproduce Item Gift al colocar el objeto. dropNewItem escoge equipo disponible y usa Zidra como respaldo. El atlas visual compartido es assets/effects/effects.png. El mapa de celdas, direcciones y desplazamientos editables está en js/data/effect-atlas.js.

Las asignaciones fijas incluyen los ancestros evolutivos. La lista de especies sin encuentros se encuentra en [sin-encuentro.md](../data/sin-encuentro.md).

### Combate, equipo y aventuras de 50 misiones

La dificultad del tablón y de los enemigos es uno más que el número de éxitos. Hasta la misión 25 se ofrecen biomas de nivel 1–5. Desde la 26 todos los niveles disponibles tienen probabilidad positiva. El papel rojo eleva el nivel de combate sin cambiar la franja de encuentros. Las reliquias equipadas sustituyen el líder de su bioma desde la misión 25. Cada gema y llave declara su desbloqueo de victoria. isUnlocked consulta la colección cuando se desactiva testingUnlocks.

damageFor aplica Ataque × 100 / (100 + Defensa) antes de afinidades y bloqueo. Las subidas por EXP suman 3 de tamaño. Los porcentajes dependen de equipo y beneficios. La velocidad llega a 200. Un salvaje shiny siempre deja equipo como recompensa de combate. El cupo de tres limita los objetos aleatorios de exploración de la misión.

items.json configura efectos de umbral, equipo condicional, filtro, tinte de marco y desbloqueo. refreshEssenceAttack actualiza las gemas tras variaciones del saldo. applyShinyAppearance carga la variante de SpriteCollab y conserva el ataque en curso. Cuando falta la hoja se distingue la variante con un tinte. Los grupos de paleta avanzan al 80% de su frecuencia original.

### Reliquias del Gremio y combate

Colección permite equipar las reliquias disponibles. equipRelic sustituye la otra activa R. Los ataques de hueso, bomba, tajo y pico son beneficios. cooldownTime avanza en pasos de simulación con al menos un salvaje vivo. Los relojes de animación, empuje y carga siguen usando gameTime.

settleStats liquida los aumentos de equipo, niveles y recompensas, conserva el límite inferior sin deuda y comparte la proyección con las tarjetas. Velocidad de ataque va de 5 a 200. El nivel da tres puntos de tamaño. collectEssence aplica Brote acuático al recoger agua cuando ya se posee Semilla. La cartera sortea cada unidad por separado.

activateRelic comprueba coste y recarga antes del gasto. La Flauta vence salvajes tras cuatro segundos, el Botón crea una salida del encargo fallido, la Píldora desplaza en Hurt y el Orbe expande su zona una vez por enemigo. projectileImpact usa las hojas de impacto del hueso y los cuadros 10–12 de la bomba. criticalHit y criticalBlock consultan la orientación del defensor con Cráneo.

### Cadencia y rendimiento

Las 622 fichas tienen la velocidad de ataque base triplicada. La progresión de este atributo parte de 15 antes de aplicar los ajustes de forma, y los límites efectivos siguen en 5–200. attackRate acelera más los primeros puntos y alcanza 2,5 en 200. Ditto inicia el nivel 5 con 18 HP, 9 de Ataque, 9 de Defensa y 23 de Velocidad de ataque.

loadPokemonData comparte las solicitudes en curso de cada especie y variante. fetchAnimation comparte la imagen física de acciones CopyOf. Los fallos de carga de especie se pueden reintentar. El catálogo y los recursos de combate se preparan en paralelo. loadTileset lee los píxeles del canvas una vez. draw conserva el terreno visible hasta que cambia el piso, el área visible o la fase de paleta. La salida, los objetos y los Pokémon se dibujan por separado en cada fotograma. La IA espera hasta 200 ms para repetir una búsqueda sin ruta al mismo destino.

Las Cañas secas son el único objeto con `burnsOn: "fire"`. `elementalHit` comprueba que el jugador haya recibido daño de fuego antes de consultar esa propiedad. Las espinas sin elemento conservan todo el inventario.

### Acceso, fondos y efectos

En Colección → Biomas, biomeAvailable y biomeLeaderList alimentan la lista y el generador de encargos. testingUnlocks en collection.js mantiene abiertos los permisos de prueba. En estable se comprueba el bioma ganado con su objeto o la reliquia del líder. Las aves y los tres Regis conservan la condición de equipar su reliquia y alcanzar la misión 25.

warmGuildBackgrounds decodifica una variante por sección al arrancar. screen conserva el último fondo disponible durante la navegación. drawTerrainChunk conserva bloques nativos de 8 × 8 por piso y actualiza las casillas con colores animados. El lector de la leyenda interpreta el blanco transparente como blanco.

Tras actualizar assets/effects, ejecutar python tools/build_effects.py con Pillow. Compone las secuencias numéricas y las filas direccionales, conserva las hojas de autor y regenera effects.png y effect-atlas.js con sus offsets. El impacto del hueso y las piezas del aura tienen entradas independientes.

### Dash, ritmo global y ataques elementales

startDash fija la dirección de movimiento (o la orientación en reposo), usa Walk acelerada y comprueba colisiones en subpasos durante 150 ms de simulación. El dash protege frente al daño y su recarga se mide entre activaciones. Sedarrápida aporta dashRecovery=1 para pasar de 1500 a 750 ms. Cola pesada cuesta un emblema e impide el dash durante la aventura.

loadEncountersCatalog suma 20 a la velocidad de ataque base de cada especie salvo Ditto. movementRate y attackRate aplican ×1,2 al ritmo de todos los combatientes. Con Cola pesada usan ×1 y conservan el +20. El tinte de Ardiente y Sibila se aplica al cuerpo durante el golpe normal o al efecto que lo sustituye. Los efectos de sustituciones básicas, incluidos sus impactos terminales, se reproducen en silencio.

Durante la recuperación del dash los cuerpos del jugador y de los salvajes pueden atravesarse. La inmunidad al daño sigue limitada a los 150 ms de desplazamiento. Insepulto permite el paso permanente y añade una tirada del 15 % para Revivir por piso, dentro del cupo de objetos. Levitante conserva la posición física en el suelo al dibujar la sombra y eleva el sprite y sus efectos siete píxeles. Tóxico convierte el ataque básico en veneno y usa los HP efectivamente curados por cada baya para dañar a todos los enemigos a 2×Rango. Los botines generados por este daño se conservan para la siguiente recogida.

### Beneficios iniciales y combate elemental

Las 622 especies de PokeWalk.txt tienen un único donante en benefits.json. starterBenefits guarda las compras y starterBenefit la selección. parseCollection migra las cuatro armas antiguas a beneficios iniciales y conserva las demás reliquias equipadas. Una oferta roja paga el triple del importe normal, también con Leyenda del Gremio.

bindHealthAttack calcula el Ataque efectivo al consultar los HP, incluido el umbral estricto de un cuarto. attackElement y attackTint resuelven Fuego, Planta y Agua. paralyze interrumpe la acción y mantiene Charge durante el filtro amarillo. advanceBone comprueba impactos por tramo y bloquea un nuevo ataque hasta el regreso al lanzador. machinerySite busca suelo junto a objetos o enemigos. Botín de Linoone coloca el objeto al terminar la secuencia invertida de cover. build_effects.py elimina el blanco RGB exacto de los iconos y fuentes de efectos y recompone hojas y atlas.

### Catálogo de encuentros y descripciones

biomes.json se ordena por nivel. _probabilidadPorOferta contiene los pesos porcentuales para el primer encargo de cada bloque con todos los biomas disponibles. chooseBiome renormaliza entre las opciones restantes al construir el tablón. Los niveles 6–10 tienen franjas iniciales vacías. Se mantienen seis líderes exclusivos de reliquia. El bloque inicial admite únicamente especies de primera etapa.

randomBerry reparte la probabilidad de piso entre Aranja, Safre, Meloc, Atania y Zidra (15, 10, 10, 10 y 5 %). Un cambio de probabilidad total reparte la diferencia a partes iguales entre las cinco. Cosecha de Zidra se aplica después de decidir que aparece una baya.

js/core/descriptions.js contiene las plantillas compartidas de objetos, beneficios y reliquias. basicAttack controla la redacción común de armas y tipos de ataque básico. Las fichas declaran sus parámetros y los marcadores de stats, slot y cooldown usan los valores del propio catálogo.

La progresión de encuentros sigue los cinco bloques de BST de la clasificación. Los intervalos son <300, 300–365, 366–478, 479–514 y ≥515. Las evoluciones de menos de 300 BST pasan al segundo bloque. Los legendarios y míticos ordinarios ocupan plazas de líder del último bloque. Los seis líderes de reliquia siguen su requisito propio. En cada bioma los líderes ordinarios se eligen entre los más fuertes del tramo.

Los encuentros se restringen a familias compatibles con el hábitat concreto. Las evoluciones de Eevee se asignan por separado. Los manglares usan fauna de aguas someras, lodo y raíces; las cuevas de magma combinan fauna volcánica con habitantes de túneles minerales. En el primer bloque del Mar Milagro, Monte Helado y las dos cavernas de magma se admiten también primeras formas afines hasta 330 BST para completar las once especies. Las plazas de líder de reliquia conservan sus requisitos propios.
