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
3. **Controles y simulación.** WASD o flechas mueven, clic principal o espacio atacan y Q/E usan activas. Perder el foco cancela el movimiento. El reloj avanza a pasos de 1/60 s, a velocidad global ×1,1, y se pausa durante las transiciones. El bucle actualiza habilidades y entidades, recoge objetos, comprueba salidas y dibuja.
4. **Combate.** Un ataque normal prepara un impacto que se consume al alcanzar el instante de contacto. Rango y tamaño determinan la distancia. El nivel, ataque y defensa determinan el daño. Evasión base del 5 %, crítico del 10 % y gracia del jugador tras recibir daño. El límite de medio máximo de PV del jugador corresponde a habilidades de líder. Hurt, reacción del líder y fundido de derrota tienen tiempos propios.
5. **IA.** La detección inicial requiere línea de visión y alcanza diez veces el rango de ataque. Un muro bloquea la visión y el vuelo. Si la presa desaparece tras un muro, el enemigo solo investiga la última posición observada. La persecución favorece diagonales si hay visión directa. La búsqueda en anchura usa las mismas restricciones de terreno que el movimiento. Un MISS puede activar una esquiva lateral progresiva. Los terrestres con menos del 15 % de PV pueden hacer una retirada breve. Los salvajes reciben el beneficio de su especie, anuncian las activas durante 0,1 s y tienen la mitad de recarga. Los efectos ofensivos se dirigen al jugador en rango.
6. **Experiencia.** La recompensa es el nivel del rival multiplicado por la suma de sus PV, ataque, defensa y velocidad **base** dividida entre 500, redondeada con mínimo uno. Los líderes dan el doble. El siguiente umbral es `ceil(26 × 1,105^(nivel − 5))`. Se conserva el excedente; el nivel de partida llega a 100 y la forma respeta el máximo de su ficha. Las estadísticas salvajes progresan con la misión. Subir de nivel recalcula los PV máximos sin rellenar la vida actual.
7. **Recogidas.** Las esencias caen en el lugar de la derrota. Los objetos de equipo tienen una tirada base del 22,5 %, con un máximo de dos por bloque de cinco pisos de la misión. Las bayas tienen una tirada separada del 50 % por piso; si sale baya, el 25 % son Zidra. Aranja y Zidra curan el 10 % y el 40 % respectivamente, sujetos al máximo de PV y a Hoja de menta. Los consumibles salen de la lista de equipo. El Carameloraro puede aparecer una vez por misión. Las grajeas duplican las unidades recogidas de su tipo.
8. **Objetivo y salida.** Recuperar objeto exige alcanzar el paquete del último piso. Limpiar exige derrotar a los enemigos de cada piso. Cazar permite subir si ya no queda la presa en el piso y abre el teletransportador al alcanzar la cuota. Líder es una oferta del tablón y abre una sola arena. Rescate permite subir hasta la última planta. Allí el aliado huye y los salvajes lo buscan a cualquier distancia hasta que el jugador les hace daño. Si muere, la salida permite continuar sin mejora ni emblemas. Escaleras y teletransportador tienen efectos distintos sobre la partida.
9. **Transformación.** Al salir de una misión se proyectan hasta tres opciones. Se priorizan evoluciones pagables, se consideran esencias acumuladas y especies derrotadas, y el líder de un encargo rojo derrotado se ofrece expresamente como forma. Una evolución consume el saldo requerido de un solo tipo. La cantidad efectiva es el coste de la ficha multiplicado por 1,30 y redondeado hacia arriba. Se aplican la forma, los beneficios y el pago al cargar la misión siguiente. Continuar con la misma línea o repetir un beneficio suma uno a los atributos. Conservar la forma sin elegir tarjeta no da ese aumento. Cambiacaras permite una elección adicional.
10. **Beneficios y equipo.** Los pasivos se acumulan hasta 27 beneficios (3 columnas de 9). Con la colección llena, una nueva alta sin sustitución da el bono de atributos. El equipo admite 75 objetos (3 filas de 25, desde abajo). Una activa nueva sustituye la de su propia tecla. Q y E conservan recargas independientes y el icono muestra su progreso radial. Los objetos permanentes se muestran abajo y los beneficios a la izquierda. Los colores del panel de atributos comparan el resultado de los beneficios con el mismo nivel, forma y bonos permanentes.

## Pommedew y el tablón

La bienvenida se muestra una vez por colección. Los cuatro mensajes usan Wondermail y textbox-g. Nueva Aventura y los teletransportadores muestran dos encargos ya generados con tipos y biomas distintos. El par tiene un 15 % de probabilidad de contener un único papel rojo. Este usa la franja de especies de nivel +15 y aumenta el nivel efectivo enemigo en 15 sobre el mayor entre su nivel normal y el del jugador, respetando el límite de especie. El aliado rojo usa el nivel actual del jugador. Los pisos de rescate siguen el intervalo de recuperar objeto.

El pago base es el nivel de bioma ×0,7 redondeado hacia arriba, más 0 por recuperar, 1 por cazar o limpiar, 2 por rescatar o 3 por líder, acotado a 1–10. El papel rojo triplica ese importe. La crónica marca el pago antes de abrir las tarjetas y evita volver a cobrar durante un reintento. Al caer Ditto se registra la derrota y se regresa al gremio. La EXP y el equipo de combate empiezan de nuevo en cada aventura.

La clave local `pokewalk.pommedew.collection.v1` conserva metadatos, identificadores y datos históricos. No serializar catálogos, combatientes, inventarios jugables ni mapas. En historial se guardan las formas, el equipo descubierto, los beneficios, el nivel, los atributos y las misiones con su bioma, piso, estado y pago. El reinicio no reanuda una crónica interrumpida. Los ID desconocidos siguen siendo consultables tras importar. Exportar e importar usan el mismo JSON; se valida antes de reemplazar.

La tienda inicial vende Cinta Negra por 12 emblemas y Batería agotada por 18. Las compras quedan activadas y se pueden alternar en Colección → Reliquias. Los interruptores se fijan al aceptar el primer encargo. Cinta Negra limita defensa a la base de entrada de cada forma y convierte la mitad entera del excedente en ataque. La batería ocupa E mientras esté equipada; cada 10 esencias eléctricas compran una descarga en la aventura. Las afinidades de Fuego y Eléctrico se multiplican por cada tipo defensor; la inmunidad evita el impacto. Espiga y los ataques normales conservan daño neutro.

## Archivos y ámbitos de estado

| Ruta | Responsabilidad |
| --- | --- |
| `js/main.js` | Montaje de DOM y CSS, arranque, transiciones, paneles del piso y bucle principal. |
| `js/core/state.js`, `clock.js` | Estado compartido y tiempo de simulación. La partida conserva experiencia, objetos, bonos y esencias. La misión conserva cuota, bajas y apariciones. Cada piso reemplaza entidades, efectos, objetos caídos, salida y avisos de mundo. |
| `js/data/pokemon.json` | Fichas de especie, estadísticas base, límite de nivel, tipo, esencias, evolución, medios transitables y lista de animaciones. |
| `js/data/biomes.json` | Atlas, medio, permisos, nivel 1–10, variantes, modificadores de generación y listas de salvajes/líderes para los niveles 1–16, 17–36, 37–60 y 61–100. Los límites de pisos y cantidad de encuentros están en `missions.js`. |
| `js/data/items.json`, `benefits.json` | Catálogos de objetos y beneficios, texto visible, PNG y parámetros. Cada donante tiene un único beneficio. Las mecánicas específicas se resuelven en `items.js`, `benefits.js`, `abilities.js` y `entities.js`. |
| `js/data/synergies.json` | Cada efecto exige todos los beneficios de `requires` y, cuando existe `anyOf`, al menos uno de ese segundo grupo. El combate y la generación de objetos consultan este catálogo. |
| `js/data/json-view.html` | Visor local de catálogos y archivos JSON, accesible desde el mismo servidor HTTP. |
| `assets/`, `tiled/tilesets/` | Gráficos propios de IU, objetos, beneficios, efectos, atlas y máscaras. Los sprites y retratos de especies proceden de PMDCollab/SpriteCollab. |

## Avance y comprobaciones para continuar

La introducción, el gremio, el tablón, Rescate, las reliquias y los sonidos se incorporaron sobre `eca3bf7`. Para ampliar el futuro mapa del gremio, reutiliza las acciones de tienda, colección y selección de misión de `guild.js`. Las páginas largas usan las flechas de `assets/ui`. `audio.js` vincula eventos del juego con el banco `sounds/`; todos los textos de la aplicación y el canvas usan `assets/ui/wondermail.ttf`.


La revisión del 24 de noviembre de 2026 parte de `85bffb3`, que incorporó experiencia, objetos, activas Q/E y Magma Cavern. La base incluye 627 fichas, 14 biomas, 32 objetos y 20 beneficios. Esta revisión documenta los módulos y separa los avisos de EXP y curación del dibujo de la entidad. Ambos guardan una posición del mundo al nacer y duran 950 ms de simulación. Una baya muestra los HP efectivamente recuperados. La animación gráfica de curación sigue al Pokémon.

Revisión de equilibrio posterior a `bf968d0`. Los atributos del jugador parten de una reducción del 20 % sobre el valor de nivel 5 de la forma, antes de los bonos y respetando los mínimos. Desde la misión 5 aumenta el crecimiento de nivel enemigo y hay un aumento acumulativo de ataque, defensa y PV. Las combinaciones del catálogo cubren los tres efectos dorados, Espiga seguida de Cuerno con tiradas independientes, sustitución de bayas y descargas de ocho espinas al bloquear o recibir daño. Las espinas recorren 32 unidades en 680 ms. Flare recorre su alcance en 750 ms. Roca de pólvora carga 350 ms para el jugador y explota durante 1 s con radio 72. El amuleto tiñe el sprite mientras dura su bonificación.

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
- `cogCurrency` — Elige entre los tres mayores saldos que permiten pagar cinco esencias de un solo tipo.
- `landing` — Busca un destino transitable cerca de la entrada teniendo en cuenta los cuerpos que la ocupan.
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

- `loadTileset` — Decodifica y valida el atlas de siete por nueve celdas y comparte la carga por URL.
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
