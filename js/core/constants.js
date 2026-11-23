// La lógica usa píxeles del mapa. El zoom solo se aplica al dibujar.
export const TILE = 24;
export const ZOOM = 2;
export const RTILE = TILE * ZOOM;
export const MAP_W = 44;
export const MAP_H = 34;
export const DEFAULT_DEX = 132;
export const EXCLUDED_DEX = new Set([
  513, 514, 515, 516, 519, 520, 521, 522, 523, 538, 557, 558, 564, 565, 590, 591, 592, 593, 616, 617, 618, 626,
]);

export const ANIM_SPEED = 0.72;
export const PLAYER_SPEED = 2.25;
export const AI_SPEED = 1.3;
export const ATTACK_RANGE = 25;
export const PLAYER_GRACE_MS = 1000;
export const PLAYER_STAGGER_MS = 140;

export const DIR_MAP = {
  '0,1': 0,
  '1,1': 1,
  '1,0': 2,
  '1,-1': 3,
  '0,-1': 4,
  '-1,-1': 5,
  '-1,0': 6,
  '-1,1': 7,
};
export const DIR_VEC = [
  [0, 1],
  [0.7, 0.7],
  [1, 0],
  [0.7, -0.7],
  [0, -1],
  [-0.7, -0.7],
  [-1, 0],
  [-0.7, 0.7],
];

// Las colisiones se miden en píxeles del mapa, los tiempos de entrada y muerte en ms.
export const BODY_RADIUS = 7.8;
export const FADE_MS = 1500;
// Una sola traza al cargar el módulo permite comprobar la escala de simulación.
console.debug('[PokeWalk] Escala del mapa', { TILE, ZOOM, MAP_W, MAP_H });
