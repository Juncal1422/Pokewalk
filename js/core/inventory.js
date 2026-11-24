import { gameTime } from './clock.js';
import { game } from './state.js';

// Los iconos conservan sus nodos durante el combate para no perder el hover.
export function attachInventory(root) {
  const tip = root.querySelector('#item-tip');
  let signature, activeIcon, active;
  function updateCooldown() {
    if (!activeIcon) return;
    const fraction = active.id === 'cog' ? Number(!!game.mission.usedCog) :
      Math.max(0, Math.min(1, ((game.cooldowns[active.id] ?? 0) - gameTime()) / (1000 * active.amount)));
    activeIcon.style.setProperty('--remaining', (fraction * 360) + 'deg');
  }
  return () => {
    const next = JSON.stringify([[...game.inventory], [...game.held]]);
    if (signature === next) return updateCooldown();
    activeIcon = null;
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
          active = entry;
          activeIcon = document.createElement('span');
          activeIcon.className = 'active-benefit';
          activeIcon.append(img);
          panel.append(activeIcon);
          updateCooldown();
        } else panel.append(img);
      }
    }
  };
}
