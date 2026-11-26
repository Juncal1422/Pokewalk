// Origen y tamaño de cada fotograma en effects.png. Dirección por fila, tiempo por columna.
// offsetX positivo mueve a la derecha; offsetY positivo baja el efecto antes del zoom.
export const effectSheets = {
  // Hueso olvidado: vuelo.
  bone_throw: {x:0,y:1824,width:16,height:16,columns:8,rows:1,offsetX:0,offsetY:0},
  // Hueso olvidado: impacto.
  bone_impact: {x:128,y:1824,width:56,height:48,columns:6,rows:1,offsetX:0,offsetY:0},
  air_vortex: {"x": 0, "y": 0, "width": 24, "height": 24, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Descarga de la batería.
  battery: {"x": 384, "y": 0, "width": 88, "height": 88, "columns": 9, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 44},
  bell_toll: {"x": 1176, "y": 0, "width": 64, "height": 64, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Recogida de equipo.
  boost: {"x": 2200, "y": 0, "width": 40, "height": 48, "columns": 15, "rows": 1, "offsetX": 0, "offsetY": 6},
  circle_cut: {"x": 0, "y": 88, "width": 32, "height": 48, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  dark_cut: {"x": 512, "y": 88, "width": 32, "height": 32, "columns": 4, "rows": 8, "offsetX": 0, "offsetY": 0},
  death_chant: {"x": 640, "y": 88, "width": 64, "height": 64, "columns": 35, "rows": 1, "offsetX": 0, "offsetY": 0},
  doubleorb: {"x": 0, "y": 344, "width": 48, "height": 24, "columns": 34, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Cadena de la escama de Groudon; el segundo cuadro propaga la siguiente erupción.
  erupt: {"x": 1632, "y": 344, "width": 32, "height": 32, "columns": 3, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Cuerno de Rhyhorn; una celda por dirección.
  fang: {"x": 1728, "y": 344, "width": 16, "height": 16, "columns": 2, "rows": 4, "offsetX": 0, "offsetY": 0},
  // Giro de Colmillo de Mamoswine.
  fangaround: {"x": 1760, "y": 344, "width": 56, "height": 40, "columns": 12, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 29},
  // Reacción de Emplumado.
  featherfall: {"x": 0, "y": 408, "width": 72, "height": 64, "columns": 23, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Ardiente con Espiga o Cuerno; una fila por dirección.
  fire_spike: {"x": 1656, "y": 408, "width": 16, "height": 16, "columns": 4, "rows": 8, "offsetX": 0, "offsetY": 0},
  // Llamarada del broche.
  flare: {"x": 1720, "y": 408, "width": 32, "height": 32, "columns": 12, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Atacante congelado por un bloqueo de Concha de Shellder.
  frozen: {"x": 2104, "y": 408, "width": 32, "height": 31, "columns": 6, "rows": 1, "offsetX": 0, "offsetY": 0},
  gem_aura: {"x": 0, "y": 536, "width": 48, "height": 40, "columns": 38, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Crecimiento por esencia.
  grow: {"x": 1824, "y": 536, "width": 40, "height": 8, "columns": 8, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Baya, curación de Arbóreo o Regenerativo.
  heal: {"x": 2144, "y": 536, "width": 52, "height": 48, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  heal_aura: {"x": 0, "y": 584, "width": 72, "height": 64, "columns": 35, "rows": 1, "offsetX": 0, "offsetY": 0},
  iron_bomb: {"x": 2520, "y": 584, "width": 32, "height": 32, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Impacto de Ancestral.
  iron_hit: {"x": 0, "y": 648, "width": 72, "height": 56, "columns": 9, "rows": 8, "offsetX": 0, "offsetY": 6},
  leaf: {"x": 648, "y": 648, "width": 24, "height": 16, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  magnet_bombing: {"x": 1128, "y": 648, "width": 64, "height": 72, "columns": 30, "rows": 1, "offsetX": 0, "offsetY": 0},
  meteorfall: {"x": 0, "y": 1096, "width": 48, "height": 56, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Explosión del núcleo.
  mine: {"x": 960, "y": 1096, "width": 48, "height": 56, "columns": 9, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 48},
  // Salida y llegada de un teletransporte.
  purple: {"x": 1392, "y": 1096, "width": 32, "height": 240, "columns": 38, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 228},
  // Activación de Revivir.
  revive: {"x": 0, "y": 1336, "width": 32, "height": 32, "columns": 39, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Área persistente del núcleo de roca.
  rock_aura: {"x": 1248, "y": 1336, "width": 80, "height": 56, "columns": 14, "rows": 1, "offsetX": 0, "offsetY": 0, "base": 30},
  // Ataque a distancia con roca.
  rock_throw: {"x": 2368, "y": 1336, "width": 24, "height": 16, "columns": 18, "rows": 1, "offsetX": 0, "offsetY": 0},
  slash: {"x": 0, "y": 1392, "width": 48, "height": 48, "columns": 16, "rows": 1, "offsetX": 0, "offsetY": 0},
  small_explosion: {"x": 768, "y": 1392, "width": 32, "height": 32, "columns": 4, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Espiga direccional y descarga de espinas.
  spine: {"x": 896, "y": 1392, "width": 16, "height": 16, "columns": 2, "rows": 4, "offsetX": 0, "offsetY": 0},
  star_aura: {"x": 0, "y": 1456, "width": 56, "height": 56, "columns": 48, "rows": 1, "offsetX": 0, "offsetY": 0},
  tornado: {"x": 0, "y": 1512, "width": 56, "height": 80, "columns": 52, "rows": 1, "offsetX": 0, "offsetY": 0},
  truelight: {"x": 0, "y": 1592, "width": 64, "height": 64, "columns": 20, "rows": 1, "offsetX": 0, "offsetY": 0},
  void_zone: {"x": 1280, "y": 1592, "width": 80, "height": 72, "columns": 13, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Área y empuje de la escama de Kingdra.
  water_burst: {"x": 2320, "y": 1592, "width": 56, "height": 56, "columns": 8, "rows": 1, "offsetX": 0, "offsetY": 0},
  // Ataque a distancia de Acuático.
  watergun: {"x": 2768, "y": 1592, "width": 32, "height": 24, "columns": 2, "rows": 8, "offsetX": 0, "offsetY": 0},
  // Defensa de Sedal.
  webshield: {"x": 0, "y": 1784, "width": 32, "height": 40, "columns": 11, "rows": 1, "offsetX": 0, "offsetY": 0},
};
