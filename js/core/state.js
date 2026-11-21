export const game = {
  canvas: null,
  ctx: null,
  loadingEl: null,
  toastEl: null,
  biomeSel: null,
  currentBiome: null,
  tileSheet: null,
  map: [],
  rooms: [],
  entities: [],
  player: null,
  spriteCache: new Map(),
  keys: Object.create(null),
  animationFrame: 0,
  inputController: null,
  toastTimer: 0
};

export function resetGameState() {
  cancelAnimationFrame(game.animationFrame);
  game.canvas = null;
  game.ctx = null;
  game.loadingEl = null;
  game.toastEl = null;
  game.biomeSel = null;
  game.currentBiome = null;
  game.tileSheet = null;
  game.map = [];
  game.rooms = [];
  game.entities = [];
  game.player = null;
  game.spriteCache.clear();
  game.keys = Object.create(null);
  game.animationFrame = 0;
  clearTimeout(game.toastTimer);
}
