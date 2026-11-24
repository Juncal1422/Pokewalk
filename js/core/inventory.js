import { gameTime } from './clock.js';
import { game } from './state.js';

// Los iconos conservan sus nodos durante el combate para no perder el hover.
export function attachInventory(root) {
  const tip = root.querySelector('#item-tip');
  let signature;
  const actives = new Map();
  function updateCooldown() {
    for (const [id,icon] of actives) {
      const fraction = Math.max(0,Math.min(1,((game.cooldowns[id] ?? 0)-gameTime())/(game.cooldownDurations[id] || 1)));
      icon.style.setProperty('--remaining',fraction*360+'deg');
    }
  }
  return () => {
    const next = JSON.stringify([[...game.inventory], [...game.held]]);
    if (signature === next) return updateCooldown();
    actives.clear();
    signature = next;
    tip.hidden = true;
    for (const [selector, entries] of [
      ['#inventory', [...game.inventory].map(id => game.items[id])],
      ['#benefits', [...game.held].map(id => game.benefits.get(id))],
    ]) {
      const panel = root.querySelector(selector);
      panel.replaceChildren();
      for (const entry of entries) {
        const img = new Image();
        img.src = new URL('../../' + entry.image, import.meta.url).href;
        img.alt = entry.name;
        img.onpointerenter = () => {
          tip.textContent = entry.name + ' · ' + entry.description;
          tip.hidden = false;
        };
        img.onpointerleave = () => { tip.hidden = true; };
        if (entry.active) {
          const activeIcon = document.createElement('span');
          actives.set(entry.id,activeIcon);
          activeIcon.dataset.key=entry.slot.toUpperCase();
          activeIcon.className = 'active-benefit';
          activeIcon.append(img);
          panel.append(activeIcon);
          updateCooldown();
        } else panel.append(img);
      }
    }
  };
}
