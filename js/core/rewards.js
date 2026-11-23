import { game } from './state.js';
import { labels, statsFor, levelFor } from './stats.js';
import { rewardBonuses } from '../data/upgrades.js';

function evolutionText(row) {
  return row.evolutions.map(rule => {
    const types = rule.essences.map(type => type + ' ' + (game.essences[type] || 0) + '/' + rule.amount);
    return game.pokemon.get(rule.to).name + ' · ' + types.join(' o ');
  }).join(' | ');
}
// La lista proviene de las bajas de esta planta, incluidas las causadas por la IA.
export function chooseReward(options, catalog) {
  console.info('[Mejoras] Formas ofrecidas', options.map(option => option.row.name));
  const dialog = document.getElementById('rewards');
  const cards = dialog.querySelector('.cards');
  cards.replaceChildren();
  let requirements = dialog.querySelector('.requirements');
  if (!requirements) {
    requirements = document.createElement('p');
    requirements.className = 'requirements';
    cards.before(requirements);
  }
  const current = evolutionText(game.pokemon.get(game.player.dex));
  requirements.hidden = !current;
  requirements.textContent = 'Evolución de tu forma actual: ' + current;
  return new Promise(resolve => {
    for (const option of options) {
      const { row, essence, bonus } = option;
      const dex = row.dex;
      const reward = catalog.find(item => item.id === row.mejora);
      const card = document.createElement('button');
      const portrait = new Image();
      const number = String(dex).padStart(4, '0');
      portrait.src = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/' + number + '/Normal.png';
      portrait.alt = 'Retrato del Pokémon ' + dex;
      portrait.onerror = () => {
        portrait.onerror = null;
        portrait.src = 'https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/portrait/' + number + '/Normal.png';
      };
      card.type = 'button';
      const gem = new Image();
      gem.src = new URL('../../assets/ui/essence-' + essence + '.png', import.meta.url).href;
      gem.alt = essence;
      gem.className = 'essence';
      const bonuses = rewardBonuses(game.player.bonuses, option, reward);
      const progress = game.progress + 1;
      const projected = statsFor(row, progress, bonuses);
      card.append(portrait, row.name + ' · Nv. ' + levelFor(row, progress), gem);
      if (!bonus || reward.effect === 'runPerk') card.append(reward.label);
      for (const [key, label] of Object.entries(labels)) {
        const line = document.createElement('span');
        const change = projected[key] - game.player.stats[key];
        line.textContent = label + ' ' + projected[key] + (change ? ' (' + (change > 0 ? '+' : '') + change + ')' : ' (=)');
        if (change) line.style.color = change > 0 ? '#96edaa' : '#ffadad';
        card.append(line);
      }
      const next = evolutionText(row);
      if (next) card.append('Evolución: ' + next);
      if (bonus) {
        const extra = document.createElement('span');
        extra.className = 'line-bonus';
        extra.textContent = 'Bono de línea: +1 a las cuatro estadísticas';
        card.append(extra);
      }
      card.onclick = () => {
        if (!dialog.open) return;
        dialog.close();
        resolve(option);
      };
      cards.append(card);
    }
    if (!options.length) {
      const button = document.createElement('button');
      button.textContent = 'Continuar con la forma actual';
      button.onclick = () => { dialog.close(); resolve(null); };
      cards.append(button);
    }
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
  });
}
