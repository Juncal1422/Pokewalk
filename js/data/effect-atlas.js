// Origen y tamaño de cada fotograma en effects.png. Dirección por fila, tiempo por columna.
// offsetX positivo mueve a la derecha; offsetY positivo baja el efecto antes del zoom.
export const effectSheets = {
  // Hoja de air_orb
  air_orb: {"offsetX": 0, "offsetY": 0, "x": 0, "y": 0, "width": 32, "height": 32, "columns": 6, "rows": 1},
  // Hoja de air_vortex
  air_vortex: {"x": 192, "y": 0, "width": 24, "height": 24, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Descarga de la batería.
  battery: {"x": 576, "y": 0, "width": 88, "height": 88, "columns": 9, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 44},
  // Hoja de bell_toll
  bell_toll: {"x": 1368, "y": 0, "width": 64, "height": 64, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de bite
  bite: {"offsetX": 0, "offsetY": 0, "x": 2392, "y": 0, "width": 56, "height": 40, "columns": 4, "rows": 8},
  // Hueso olvidado: vuelo.
  bone_throw: {"x": 2616, "y": 0, "width": 16, "height": 16, "columns": 8, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hueso olvidado: impacto.
  bone_impact: {"x": 0, "y": 320, "width": 56, "height": 48, "columns": 6, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Recogida de equipo.
  boost: {"x": 336, "y": 320, "width": 40, "height": 48, "columns": 15, "rows": 1, "offsetX": 0, "offsetY": 6},
  // Hoja de circle_cut
  circle_cut: {"x": 936, "y": 320, "width": 32, "height": 48, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de cosmic_sphere
  cosmic_sphere: {"offsetX": 0, "offsetY": 0, "x": 0, "y": 368, "width": 72, "height": 64, "columns": 36, "rows": 1},
  // Hoja de cover
  cover: {"offsetX": 0, "offsetY": 0, "x": 0, "y": 432, "width": 56, "height": 40, "columns": 21, "rows": 1},
  // Hoja de dark_cut
  dark_cut: {"x": 1176, "y": 432, "width": 32, "height": 32, "columns": 3, "rows": 8, "offsetX": 0, "offsetY": 0},
  // Hoja de death_chant
  death_chant: {"x": 0, "y": 688, "width": 64, "height": 64, "columns": 35, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de doubleorb
  doubleorb: {"x": 0, "y": 752, "width": 48, "height": 24, "columns": 34, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Cadena de la escama de Groudon; el segundo cuadro propaga la siguiente erupción.
  erupt: {"x": 1632, "y": 752, "width": 32, "height": 32, "columns": 3, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Cuerno de Rhyhorn; una celda por dirección.
  fang: {"x": 1728, "y": 752, "width": 16, "height": 16, "columns": 2, "rows": 4, "offsetX": 0, "offsetY": 0},
  // Giro de Colmillo de Mamoswine.
  fangaround: {"x": 1760, "y": 752, "width": 56, "height": 40, "columns": 12, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 29},
  // Reacción de Emplumado.
  featherfall: {"x": 0, "y": 816, "width": 72, "height": 64, "columns": 23, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Ardiente con Espiga o Cuerno; una fila por dirección.
  fire_spike: {"x": 1656, "y": 816, "width": 16, "height": 16, "columns": 4, "rows": 8, "offsetX": 0, "offsetY": 0},
  // Llamarada del broche.
  flare: {"x": 1720, "y": 816, "width": 32, "height": 32, "columns": 12, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Atacante congelado por un bloqueo de Concha de Shellder.
  frozen: {"x": 2104, "y": 816, "width": 32, "height": 31, "columns": 6, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de gem_aura
  gem_aura: {"x": 0, "y": 944, "width": 48, "height": 40, "columns": 38, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Crecimiento por esencia.
  grow: {"x": 1824, "y": 944, "width": 40, "height": 8, "columns": 8, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Baya, curación de Arbóreo o Regenerativo.
  heal: {"x": 2144, "y": 944, "width": 52, "height": 48, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de heal_aura
  heal_aura: {"x": 0, "y": 992, "width": 72, "height": 64, "columns": 35, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de iron_bomb
  iron_bomb: {"x": 2520, "y": 992, "width": 32, "height": 32, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Impacto de Ancestral.
  iron_hit: {"x": 0, "y": 1056, "width": 72, "height": 56, "columns": 9, "rows": 8, "offsetX": 0, "offsetY": 6},
  // Hoja de leaf
  leaf: {"x": 648, "y": 1056, "width": 24, "height": 16, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de magnet_bombing
  magnet_bombing: {"x": 1128, "y": 1056, "width": 64, "height": 72, "columns": 30, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de meteorfall
  meteorfall: {"x": 0, "y": 1504, "width": 48, "height": 56, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Explosión del núcleo.
  mine: {"x": 960, "y": 1504, "width": 48, "height": 56, "columns": 9, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 48},
  // Hoja de peck
  peck: {"offsetX": 0, "offsetY": 0, "x": 1392, "y": 1504, "width": 64, "height": 56, "columns": 10, "rows": 8},
  // Salida y llegada de un teletransporte.
  purple: {"x": 0, "y": 1952, "width": 32, "height": 240, "columns": 38, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 228},
  // Activación de Revivir.
  revive: {"x": 1216, "y": 1952, "width": 32, "height": 32, "columns": 39, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Área persistente del núcleo de roca.
  rock_aura: {"x": 0, "y": 2192, "width": 80, "height": 56, "columns": 14, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 30},
  // Ataque a distancia con roca.
  rock_throw: {"x": 1120, "y": 2192, "width": 24, "height": 16, "columns": 18, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de shadow_tag
  shadow_tag: {"offsetX": 0, "offsetY": 0, "x": 0, "y": 2248, "width": 152, "height": 72, "columns": 13, "rows": 8},
  // Hoja de slash
  slash: {"x": 1976, "y": 2248, "width": 32, "height": 32, "columns": 4, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de small_explosion
  small_explosion: {"x": 2104, "y": 2248, "width": 32, "height": 32, "columns": 4, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Espiga direccional y descarga de espinas.
  spine: {"x": 2232, "y": 2248, "width": 16, "height": 16, "columns": 2, "rows": 4, "offsetX": 0, "offsetY": 0},
  // Hoja de star_aura
  star_aura: {"x": 0, "y": 2824, "width": 56, "height": 56, "columns": 48, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de tornado
  tornado: {"x": 0, "y": 2880, "width": 56, "height": 80, "columns": 52, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de truelight
  truelight: {"x": 0, "y": 2960, "width": 64, "height": 64, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Hoja de void_zone
  void_zone: {"x": 1280, "y": 2960, "width": 80, "height": 72, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Área y empuje de la escama de Kingdra.
  water_burst: {"x": 2320, "y": 2960, "width": 56, "height": 56, "columns": 8, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Ataque a distancia de Acuático.
  watergun: {"x": 2768, "y": 2960, "width": 32, "height": 24, "columns": 2, "rows": 8, "offsetX": 0, "offsetY": 0},
  // Defensa de Sedal.
  webshield: {"x": 0, "y": 3152, "width": 32, "height": 40, "columns": 11, "rows": 1, "offsetX": 0, "offsetY": 0},
};
