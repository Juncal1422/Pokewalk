import {gameTime} from './clock.js';
import {checkpoint} from './collection.js';
import {playSound} from './audio.js';
import { game } from './state.js';
import { showWorldNotice } from './world-notices.js';
import { playerStats } from './benefits.js';
import { levelFor } from './stats.js';

// El coste corresponde a un nivel, no al total acumulado de la partida.
export const experienceCost = level => Math.ceil(26 * 1.105 ** (level - 5));
// Actualiza el nivel de la partida y recalcula los atributos de la forma actual respetando su límite.
export function levelUp() {
  game.progress = Math.min(100, game.progress + 1);
  const player = game.player, species = game.pokemon.get(player.dex);
  player.level = levelFor(species, game.progress);
  const previous=player.stats;
  player.stats = playerStats(species, game.progress, player.bonuses);
  // Compara atributos efectivos: un nivel puede aumentar algunos y dejar otros en su tope.
  for (const [key,value] of Object.entries(player.stats)) {
    const delta=value-previous[key];
    if(delta>0)game.pickups.push({key,delta,time:gameTime(),duration:4000});
  }
  playSound('xp');checkpoint();
}
// Pondera la recompensa por nivel y estadísticas base y reparte el excedente entre niveles sucesivos.
export function awardExperience(enemy) {
  const stats = game.pokemon.get(enemy.dex).stats;
  const baseStatMultiplier = (stats.hpMax + stats.attack + stats.defense + stats.speed) / 500;
  const earnedExperience = Math.max(1, Math.round(enemy.level * baseStatMultiplier)) * (enemy.boss ? 2 : 1);
  showWorldNotice(game.player, earnedExperience, 'EXP');
  game.xp += earnedExperience;
  // Una baja puede cubrir varios umbrales. Se conserva la EXP sobrante hasta llegar al nivel 100.
  while (game.progress < 100 && game.xp >= experienceCost(game.progress)) {
    game.xp -= experienceCost(game.progress);
    levelUp();
  }
  if (game.progress === 100) game.xp = 0;
}
