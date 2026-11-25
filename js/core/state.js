// Los controles, la simulación y el canvas trabajan sobre la misma partida.
export const game = {
  canvas: null,
  ctx: null,
  loadingEl: null,
  toastEl: null,
  portal: null,
  changingLevel: false,
  currentBiome: null,
  tileSheet: null,
  grid: [],
  autotileGrid: [],
  variantGrid: [],
  rooms: [],
  entities: [],
  player: null,
  spriteCache: new Map(),
  keys: Object.create(null),
  animationFrame: 0,
  inputController: null,
  toastTimer: 0,
};

// Cancela el bucle anterior y descarta las referencias al mapa, al jugador y a la interfaz.
export function resetGameState() {
  console.info('[Partida] Reiniciando la simulación');
  cancelAnimationFrame(game.animationFrame);
  game.canvas = null;
  game.ctx = null;
  game.loadingEl = null;
  game.toastEl = null;
  game.portal = null;
  game.changingLevel = false;
  game.currentBiome = null;
  game.tileSheet = null;
  game.grid = [];
  game.autotileGrid = [];
  game.variantGrid = [];
  game.rooms = [];
  game.entities = [];
  game.player = null;
  // Descarta las referencias a sprites de la aventura anterior al volver a montar el juego.
  game.spriteCache.clear();
  game.keys = Object.create(null);
  game.animationFrame = 0;
  clearTimeout(game.toastTimer);
}
