import { game } from './state.js';
import { labels, levelFor } from './stats.js';
import { projectReward, playerStats } from './benefits.js';
import { element, gem, portrait, tones } from './pokemon-panel.js';

function evolutionBars(row,state) {
  const footer = element('div');
  footer.className = 'evolutions';
  const current = state.row;
  const incoming = current.evolutions.filter(rule => rule.to === row.dex);
  for (const rule of [...incoming, ...row.evolutions]) {
    const name = game.pokemon.get(rule.to).name;
    footer.append(element('strong', (rule.to === row.dex ? 'Desbloqueada: ' : 'Evolución: ') + name));
    for (const type of rule.essences) {
      const count = state.balances[type] || 0;
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

function rewardCard(option, state) {
  const { row, essence } = option;
  const projected = projectReward(state,option);
  const progress = game.progress + 1;
  const stats = playerStats(row,progress,projected.bonuses,projected.held);
  const card = element('button');
  card.type = 'button';
  card.style.backgroundColor = tones[essence];
  const heading = element('strong', row.name);
  heading.prepend(gem(essence));
  card.append(portrait(row), heading, element('small', 'Nv. ' + levelFor(row, progress)));
  if (projected.allStats) card.append(element('span', '+1 a todos los atributos'));
  else {
    const benefit = projected.benefit, icon = new Image();
    icon.src = new URL('../../'+benefit.image,import.meta.url).href;
    icon.alt = ''; icon.className = 'essence';
    card.append(icon,element('strong',benefit.name),element('span',benefit.description));
    if (benefit.active) {
      const old = [...state.held].map(id=>game.benefits.get(id)).find(item=>item.active);
      if (old) card.append(element('small','Reemplaza '+old.name));
    }
  }
  const baseline = playerStats(state.row,game.progress,state.bonuses,state.held);
  const table = element('table');
  const body = table.createTBody();
  for (const [key, label] of Object.entries(labels)) {
    const tr = body.insertRow();
    const change = stats[key] - baseline[key];
    tr.insertCell().textContent = label;
    tr.insertCell().textContent = stats[key];
    const delta = tr.insertCell();
    delta.textContent = change ? (change > 0 ? '+' : '') + change : '—';
    if (change) delta.style.color = (key === 'size' ? change < 0 : change > 0) ? '#9ce9ab' : '#ffaaa6';
  }
  card.append(table, evolutionBars(row,state));
  if (option.payment) {
    const cost = element('small', 'Consumir ' + option.payment.amount + ' × ');
    cost.append(gem(option.payment.type));
    card.append(cost);
  }
  return card;
}

export function chooseReward(options, state, extra=false) {
  const dialog = document.getElementById('rewards');
  dialog.querySelector('h1').textContent = extra ? 'Máscara de oro · Mejora adicional' : 'Mejoras';
  const cards = dialog.querySelector('.cards');
  cards.replaceChildren();
  return new Promise(resolve => {
    for (const option of options) {
      const card = rewardCard(option, state);
      card.onclick = () => {
        dialog.close();
        resolve(option);
      };
      cards.append(card);
    }
    dialog.querySelector('.keep-form')?.remove();
    if (!options.some(option => option.row.dex === state.row.dex)) {
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
