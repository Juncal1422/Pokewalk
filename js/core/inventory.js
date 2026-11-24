import { gameTime } from './clock.js';
import { game } from './state.js';

// Los iconos conservan sus nodos durante el combate para no perder el hover.
export function attachInventory(root) {
  const tooltip = root.querySelector('#item-tip');
  let signature;
  const activeIcons = new Map();
  // Convierte el tiempo restante de cada activa en el ángulo sombreado de su icono.
  function updateCooldown() {
    for (const [id,icon] of activeIcons) {
      const fraction = Math.max(0,Math.min(1,((game.cooldowns[id] ?? 0)-gameTime())/(game.cooldownDurations[id] || 1)));
      icon.style.setProperty('--remaining',fraction*360+'deg');
    }
  }
  // Actualiza el sombreado en cada fotograma y reconstruye los nodos solo cuando cambie la colección.
  return () => {
    const inventorySignature = JSON.stringify([[...game.inventory], [...game.held]]);
    if (signature === inventorySignature) return updateCooldown();
    activeIcons.clear();
    signature = inventorySignature;
    tooltip.hidden = true;
    for (const [selector, entries] of [
      ['#inventory', [...game.inventory].map(id => game.items[id])],
      ['#benefits', [...game.held].map(id => game.benefits.get(id))],
    ]) {
      const panel = root.querySelector(selector);
      panel.replaceChildren();
      for (const [index,entry] of entries.entries()) {
        const iconImage = new Image();
        iconImage.src = new URL('../../' + entry.image, import.meta.url).href;
        iconImage.alt = entry.name;
        if (selector === '#inventory') {
          iconImage.style.gridColumn = String(1 + index%25);
          iconImage.style.gridRow = String(3 - Math.floor(index/25));
        }
        // El tooltip describe el icono bajo el cursor y no captura el clic de ataque.
        iconImage.onpointerenter = () => {
          tooltip.textContent = entry.name + ' · ' + entry.description;
          tooltip.hidden = false;
        };
        // Oculta la descripción en cuanto el cursor abandona el icono.
        iconImage.onpointerleave = () => { tooltip.hidden = true; };
        if (entry.active) {
          const activeIcon = document.createElement('span');
          activeIcons.set(entry.id,activeIcon);
          activeIcon.dataset.key=entry.slot.toUpperCase();
          activeIcon.className = 'active-benefit';
          activeIcon.append(iconImage);
          panel.append(activeIcon);
          updateCooldown();
        } else panel.append(iconImage);
      }
    }
  };
}
