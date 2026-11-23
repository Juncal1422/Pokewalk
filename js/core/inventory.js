import { game } from './state.js';

// La colección pertenece a la partida. Actualizamos la lista al abrirla
// y cuando cambia mientras está abierta, conservando el foco del usuario.
export function attachInventory(root, signal) {
  const bag = root.querySelector('#bag');
  const panel = root.querySelector('#inventory');
  const tip = root.querySelector('#item-tip');
  let lastSize = -1;
  function render() {
    if (panel.hidden || lastSize === game.inventory.size) return;
    lastSize = game.inventory.size;
    if (!lastSize) { panel.textContent = 'Mochila vacía'; return; }
    if (!panel.children.length) panel.replaceChildren();
    for (const id of game.inventory) {
      if (Array.from(panel.children).some(node => node.dataset.id === id)) continue;
      const item = game.items[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.id = id;
      const img = new Image();
      img.src = new URL('../../' + item.image, import.meta.url).href;
      img.alt = '';
      button.append(img, item.name);
      function show() {
        tip.textContent = item.description;
        tip.hidden = false;
        tip.style.bottom = (innerHeight - panel.getBoundingClientRect().top + 4) + 'px';
        button.setAttribute('aria-describedby', tip.id);
      }
      function hide() { tip.hidden = true; button.removeAttribute('aria-describedby'); }
      button.onpointerenter = button.onfocus = show;
      button.onpointerleave = button.onblur = hide;
      panel.append(button);
    }
  }
  panel.replaceChildren();
  panel.hidden = tip.hidden = true;
  bag.setAttribute('aria-expanded','false');
  bag.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    tip.hidden = true;
    bag.setAttribute('aria-expanded', String(!panel.hidden));
    render();
    game.canvas.focus();
  }, { signal });
  return render;
}
