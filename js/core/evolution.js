import { game } from './state.js';
import { loadPokemonData } from '../data/pokemon-data.js';
import { canMove, showToast } from './entities.js';
import { levelFor, statsFor } from './stats.js';
import { TILE } from './constants.js';

// Cada rama se desbloquea por separado y las esencias se conservan.
export function updateEvolutionMenu(panel) {
  const player = game.player, row = game.pokemon.get(player.dex);
  const options = row.evolutions.filter(rule => rule.essences.some(type => (game.essences[type] || 0) >= rule.amount));
  const signature = player.dex + '/' + options.map(rule => rule.to).join(',');
  panel.hidden = !player.hp || !options.length;
  if (panel.dataset.options === signature) return;
  panel.dataset.options = signature;
  panel.replaceChildren();
  for (const rule of options) {
    const next = game.pokemon.get(rule.to);
    const button = document.createElement('button');
    button.className = 'box';
    button.textContent = 'Evolucionar a ' + next.name;
    button.onclick = async () => {
      if (game.changingLevel || !player.hp || game.player !== player || player.dex !== row.dex) return;
      game.changingLevel = true;
      game.keys = Object.create(null);
      try {
        const data = await loadPokemonData(next.dex);
        if (!data) throw new Error('No se pudo cargar ' + next.name);
        const stats = statsFor(next, game.progress, player.bonuses);
        // Una evolución más grande o sin la habilidad del terreno necesita
        // espacio. Buscamos primero en la ubicación actual, después en el suelo.
        const previous = { dex: player.dex, stats: player.stats };
        Object.assign(player, { dex: next.dex, stats });
        if (!canMove(player, player.x, player.y)) {
          let nearest, distance = Infinity;
          game.grid.forEach((tiles, y) => tiles.forEach((tile, x) => {
            const px = (x + .5) * TILE, py = (y + .5) * TILE;
            const d = Math.hypot(px - player.x, py - player.y);
            if (!tile && d < distance && canMove(player, px, py)) { nearest = [px, py]; distance = d; }
          }));
          if (!nearest) { Object.assign(player, previous); throw new Error('No hay espacio para evolucionar.'); }
          [player.x, player.y] = nearest;
        }
        Object.assign(player, { dexStr: data.dexStr, anims: data.anims, level: levelFor(next, game.progress),
          hp: Math.min(player.hp, stats.hpMax), state: 'Idle', timer: 0, frame: 0, impactPending: false });
        showToast('Ditto ha evolucionado a ' + next.name);
      } catch (error) { showToast(error.message); }
      finally { game.changingLevel = false; game.canvas.focus(); }
    };
    panel.append(button);
  }
}
