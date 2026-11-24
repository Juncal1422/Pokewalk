import { game } from './state.js';
import { gameTime } from './clock.js';
import { playerStats } from './benefits.js';
import { levelFor } from './stats.js';

// El coste corresponde a un nivel, no al total acumulado de la partida.
export const experienceCost = level => Math.ceil(16 * 1.065 ** (level - 5));
export function levelUp() {
  game.progress = Math.min(100, game.progress + 1);
  const p = game.player, row = game.pokemon.get(p.dex);
  p.level = levelFor(row, game.progress);
  p.stats = playerStats(row, game.progress, p.bonuses);
}
export function awardExperience(enemy) {
  const stats = game.pokemon.get(enemy.dex).stats;
  const weight = (stats.hpMax + stats.attack + stats.defense + stats.speed) / 200;
  const xp = Math.max(1, Math.round(enemy.level * weight)) * (enemy.boss ? 2 : 1);
  game.xpNotes.push({xp, time:gameTime()});
  game.xp += xp;
  while (game.progress < 100 && game.xp >= experienceCost(game.progress)) {
    game.xp -= experienceCost(game.progress);
    levelUp();
  }
  if (game.progress === 100) game.xp = 0;
}
