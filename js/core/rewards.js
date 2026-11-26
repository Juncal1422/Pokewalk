import { playSound } from './audio.js';
import { assetUrl } from './asset-url.js';
import { evolutionCost } from './evolution.js';
import { game } from './state.js';
import { labels, levelFor, statText } from './stats.js';
import { projectReward, playerStats } from './benefits.js';
import { element, gem, portrait } from './pokemon-panel.js';

// Muestra el saldo disponible por cada esencia admitida en las evoluciones de la tarjeta.
function evolutionBars(species,state) {
  const footer = element('div');
  footer.className = 'upgrade-evolution-costs';
  const current = state.row;
  const incoming = current.evolutions.filter(rule => rule.to === species.dex);
  for (const rule of [...incoming, ...species.evolutions]) {
    const name = game.pokemon.get(rule.to).name;
    footer.append(element('strong', (rule.to === species.dex ? 'Desbloqueada: ' : 'Evolución: ') + name));
    for (const type of rule.essences) {
      const count = state.balances[type] || 0;
      const line = element('div');
      const progressBar = element('progress');
      progressBar.max = evolutionCost(rule);
      progressBar.value = Math.min(count, evolutionCost(rule));
      progressBar.setAttribute('aria-label', name + ' · ' + type);
      line.append(gem(type), progressBar, element('small', count + '/' + evolutionCost(rule)));
      footer.append(line);
    }
  }
  return footer;
}

// Proyecta una transformación y construye su comparación de atributos antes de aceptar el gasto.
function rewardCard(option, state) {
  const { row: species, essence } = option;
  const projected = projectReward(state,option);
  const progress = game.progress;
  const stats = playerStats(species,progress,projected.bonuses,projected.held,projected.balances);
  const card = element('button');
  card.type = 'button';
  card.style.setProperty('--primary-essence-rgb', 'var(--essence-' + essence + ')');
  const heading = element('strong', species.name);
  heading.prepend(gem(essence));
  card.append(portrait(species), heading, element('small', 'Nv. ' + levelFor(species, progress)));
  if (projected.allStats) card.append(element('span', '+3 Tamaño y +1 HP, Ataque, Defensa, Velocidad, Velocidad de ataque y Rango'));
  else {
    const benefit = projected.benefit, icon = new Image();
    icon.src = assetUrl('../../'+benefit.image,import.meta.url).href;
    icon.alt = ''; icon.className = 'essence-icon';
    card.append(icon,element('strong',benefit.name),element('span',benefit.description));
    if (projected.lostBenefits.length) {
      const names = projected.lostBenefits.map(id => game.benefits.get(id).name);
      card.append(element('strong', 'Perderás: ' + names.join(', ')));
    }
  }
  const baseline = playerStats(state.row,game.progress,state.bonuses,state.held);
  const table = element('table');
  const tableBody = table.createTBody();
  for (const [key, label] of Object.entries(labels)) {
    const statRow = tableBody.insertRow();
    const change = stats[key] - baseline[key];
    statRow.insertCell().textContent = label;
    statRow.insertCell().textContent = statText(key,stats[key]);
    const delta = statRow.insertCell();
    delta.textContent = change ? (change > 0 ? '+' : '') + statText(key,change) : '—';
    if (change) delta.className = (key === 'size' ? change < 0 : change > 0) ? 'upgrade-stat-increase' : 'upgrade-stat-decrease';
  }
  card.append(table, evolutionBars(species,state));
  if (option.payment) {
    const cost = element('small', 'Consumir ' + option.payment.amount + ' × ');
    cost.append(gem(option.payment.type));
    card.append(cost);
  }
  return card;
}

// Abre las opciones de final de misión y devuelve la elección o la decisión de conservar la forma.
export function chooseReward(options, state, extra=false) {
  const dialog = document.getElementById('mission-upgrade-dialog');
  dialog.querySelector('h1').textContent = extra ? 'Cambiacaras · Mejora adicional' : 'Mejoras';
  const cards = dialog.querySelector('.upgrade-options');
  cards.replaceChildren();
  return new Promise(resolve => {
    for (const option of options) {
      const card = rewardCard(option, state);
      // El valor resuelto identifica la opción cuya proyección hizo esta tarjeta.
      card.onclick = () => {
        dialog.close();
        playSound('upgrade');
        resolve(option);
      };
      cards.append(card);
    }
    dialog.querySelector('.keep-current-form')?.remove();
    if (!options.some(option => option.row.dex === state.row.dex)) {
      const keepFormButton = element('button', 'Continuar sin mejora');
      keepFormButton.type = 'button';
      keepFormButton.className = 'keep-current-form';
      // Conservar la forma cierra el diálogo sin comprar una mejora.
      keepFormButton.onclick = () => { playSound('select'); dialog.close(); resolve(null); };
      cards.after(keepFormButton);
    }
    // La tecla Escape no debe saltarse la decisión de fin de misión.
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
    // Ajusta las tres tarjetas completas, incluso con varias evoluciones ramificadas.
    const maxZoom = Number(getComputedStyle(dialog).getPropertyValue('--upgrade-max-zoom'));
    function fit() {
      dialog.style.zoom = '1';
      dialog.style.zoom = Math.min(maxZoom,(window.innerWidth-12)/dialog.offsetWidth,
        (window.innerHeight-12)/dialog.offsetHeight);
    }
    fit();
    window.addEventListener('resize',fit);
    dialog.addEventListener('close',()=>window.removeEventListener('resize',fit),{once:true});
  });
}
