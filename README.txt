# Contexto Base del Proyecto: Explorador Web Estilo Pokémon Mundo Misterioso (PMD)

## 1. Objetivo y Arquitectura Actual
El proyecto consiste en un motor de exploración y combate en tiempo real inspirado en *Pokémon Mundo Misterioso: Exploradores del Tiempo/Oscuridad/Cielo*, diseñado originalmente para ejecutarse desde un **único archivo `.html`** sin dependencias locales ni servidores backend, consumiendo recursos externos mediante URLs con soporte CORS.

### Qué se ha construido en el `.html` hasta ahora:
* **Motor Gráfico en HTML5 `<canvas>`:** Renderizado *pixel art* nítido (`imageSmoothingEnabled = false`) con escala `2x` sobre cuadrícula base de `24×24 px`, ordenación de profundidad por eje `Y` (*Y-sorting*), sombras ajustadas a ras de suelo (`py + 7`) y cámara suavizada centrada en el jugador.
* **Sistema de Mapas y Biomas:**
  * Generador procedural de mazmorras (salas rectangulares conectadas por pasillos en "L") y hojas de *tilesets* DTEF de `24×24 px` generadas en memoria para 4 biomas clásicos (*Amp Plains*, *Beach Cave*, *Mt. Bristle*, *Temporal Tower*).
  * Preparado para migrar a mapas personalizados creados en **Tiled** bajo configuración **Ortogonal**, formato de capa **CSV**, orden de dibujo **Derecha Abajo** y tamaño de patrón **24×24 px** (exportables a `.json` / `.tmj`).
* **Integración Dinámica de Sprites (PMDCollab):**
  * Descarga en tiempo real desde `https://githubusercontent.com{DEX_4_DIGITS}/` leyendo `AnimData.xml` (para extraer `FrameWidth`, `FrameHeight`, `Duration` y alias `CopyOf`) y cargando las hojas PNG (`Walk`, `Idle`, `Charge`, `Attack`, `Hurt`).
  * Ritmo de animación ajustado (`ANIM_SPEED = 0.72`) con extensión extra en `Hurt` (+2 *frames* por fotograma) para mayor claridad visual de impacto.
* **Mecánicas de Jugador e IA:**
  * **Jugador:** Movimiento en 8 direcciones con `WASD` / Flechas y deslizamiento en paredes. Al mantener pulsado el **clic izquierdo** (o `Espacio`), ejecuta la animación `Charge` con aura y barra de energía (permitiendo apuntar con `WASD` sin alterar el rango fijo de ataque); al soltar, ejecuta `Attack`.
  * **6 Entidades de IA:** Se generan automáticamente 6 Pokémon adicionales en la mazmorra aplicando los desplazamientos **`+5, +10, +15, +20, +25, +30`** respecto al número de Pokédex del jugador (restando si superan el máximo `649` y saltando IDs excluidos). Patrullan aleatoriamente, giran hacia objetivos cercanos y atacan, activando la animación `Hurt` y un leve retroceso en cualquier Pokémon impactado (incluido el jugador).

---

## 2. Informe de Cobertura de Pokémon (Generaciones 1 a 5: #0001 – #0649)
El elenco está acotado a las **5 primeras generaciones (649 especies)**. Tras auditar directamente los `AnimData.xml` del repositorio oficial de `PMDCollab/SpriteCollab`:

* **1ª a 4ª Generación (`#0001` – `#0493`):** **100% completas (0 faltantes).** Utilizan los *sprites* oficiales extraídos de Nintendo DS con todas sus animaciones de movimiento y combate.
* **5ª Generación (`#0494` – `#0649`, Teselia):** **141 completas y 15 excluidas.** Al ser *sprites* creados por la comunidad, 15 especies carecen aún de carpeta/XML en el repositorio (devuelven `404 Not Found`) o no disponen del set mínimo requerido (`Walk`, `Idle`, `Attack`, `Hurt`).
* **Total disponible funcional:** **634 Pokémon** verificados al 100%.

### Lista exacta de los 15 Pokémon excluidos (`EXCLUDED_DEX`):
`[514, 516, 520, 522, 523, 538, 558, 564, 565, 591, 592, 593, 616, 618, 626]`
*(Corresponden a: #0514 Simisear, #0516 Simipour, #0520 Tranquill, #0522 Blitzle, #0523 Zebstrika, #0538 Throh, #0558 Crustle, #0564 Tirtouga, #0565 Carracosta, #0591 Amoonguss, #0592 Frillish, #0593 Jellicent, #0616 Shelmet, #0618 Stunfisk y #0626 Bouffalant).*

*Nota sobre animaciones secundarias:* De los 634 Pokémon válidos, casi todos tienen `Charge` (con respaldo automático en `DeepBreath` / `Withdraw` / `Idle`) y la gran mayoría tienen `Shoot` (excepto casos puntuales como `#0035` Clefairy, `#0036` Clefable, `#0554` Darumaka o `#0619` Mienfoo).

---

## 3. Arquitectura Objetivo: Repositorio en GitHub + HTML Único
Para escalar el proyecto sin perder la portabilidad de un único archivo `.html` ni sufrir bloqueos CORS al abrirlo en local (`file://`):

1. **Alojamiento en GitHub:** Subir toda la lógica modular en JavaScript (`/js/engine.js`, `/js/ai.js`, `/js/sprites.js`), los *tilesets* DTEF oficiales en PNG (`/assets/tilesets/`) y los mapas exportados desde Tiled (`/assets/maps/*.json`) a un repositorio público de GitHub (o servirlo mediante **GitHub Pages** / **jsDelivr CDN** `https://jsdelivr.net...`).
2. **Punto de entrada único (`index.html`):** Mantener un único archivo `.html` ligero que contenga únicamente el `<canvas>`, el HUD y las etiquetas `<script src="...">` apuntando a los módulos alojados en el repositorio, permitiendo actualizar mapas, *tilesets* y mecánicas sin redistribuir el archivo principal.

---

## 4. Próximos Pasos Sugeridos para Continuar
* Estructurar los módulos JS y carpetas de *assets* para el repositorio de GitHub.
* Implementar el cargador de mapas JSON exportados desde **Tiled** (capas de suelo, colisiones y puntos de aparición).
* Integrar los *tilesets* reales en PNG (`24×24 px`) con autotiling DTEF por máscara de 8 vecinos.
* Expandir el sistema de combate (barras de PS/HP, animación `Faint`, proyectiles con `Shoot` o cambios de mapa/piso).
