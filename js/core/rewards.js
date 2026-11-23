import { game } from './state.js';
import { labels, statsFor, levelFor } from './stats.js';
import { rewardBonuses } from '../data/upgrades.js';
import { element, gem, portrait, tones } from './pokemon-panel.js';

function evolutionBars(row) {
  const footer = element('div');
  footer.className = 'evolutions';
  const current = game.pokemon.get(game.player.dex);
  const incoming = current.evolutions.filter(rule => rule.to === row.dex);
  for (const rule of [...incoming, ...row.evolutions]) {
    const name = game.pokemon.get(rule.to).name;
    footer.append(element('strong', (rule.to === row.dex ? 'Desbloqueada: ' : 'Evolución: ') + name));
    for (const type of rule.essences) {
      const count = game.essences[type] || 0;
      const line = element('div');
      const bar = element('progress');
      bar.max = rule.amount;
      bar.value = Math.min(count, rule.amount);
      bar.setAttribute('aria-label', name + ' · ' + type);
      line.append(gem(type), bar, element('small', count + '/' + rule.amount));
      footer.append(line);
    }
  }
  return footer;
}

function rewardCard(option, catalog) {
  const { row, essence, bonus } = option;
  const reward = catalog.find(item => item.id === row.mejora);
  const progress = game.progress + 1;
  const stats = statsFor(row, progress, rewardBonuses(game.player.bonuses, option, reward));
  const card = element('button');
  card.type = 'button';
  card.style.backgroundColor = tones[essence];
  const heading = element('strong', row.name);
  heading.prepend(gem(essence));
  card.append(portrait(row), heading, element('small', 'Nv. ' + levelFor(row, progress)));
  if (!bonus || reward.effect === 'runPerk') card.append(element('span', reward.label));
  if (bonus) card.append(element('span', 'Bono de línea: −1 Tamaño y +1 al resto'));
  const table = element('table');
  const body = table.createTBody();
  for (const [key, label] of Object.entries(labels)) {
    const tr = body.insertRow();
    const change = stats[key] - game.player.stats[key];
    tr.insertCell().textContent = label;
    tr.insertCell().textContent = stats[key];
    const delta = tr.insertCell();
    delta.textContent = change ? (change > 0 ? '+' : '') + change : '—';
    if (change) delta.style.color = (key === 'size' ? change < 0 : change > 0) ? '#9ce9ab' : '#ffaaa6';
  }
  card.append(table, evolutionBars(row));
  if (option.payment) {
    const cost = element('small', 'Consumir ' + option.payment.amount + ' × ');
    cost.append(gem(option.payment.type));
    card.append(cost);
  }
  return card;
}

export function chooseReward(options, catalog) {
  const dialog = document.getElementById('rewards');
  const cards = dialog.querySelector('.cards');
  cards.replaceChildren();
  return new Promise(resolve => {
    for (const option of options) {
      const card = rewardCard(option, catalog);
      card.onclick = () => {
        dialog.close();
        resolve(option);
      };
      cards.append(card);
    }
    dialog.querySelector('.keep-form')?.remove();
    if (!options.some(option => option.row.dex === game.player.dex)) {
      const keep = element('button', 'Continuar sin mejora');
      keep.type = 'button';
      keep.className = 'keep-form';
      keep.onclick = () => { dialog.close(); resolve(null); };
      cards.after(keep);
    }
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
  });
}
