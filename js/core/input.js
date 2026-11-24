import { useActive } from './abilities.js';
import { setState, triggerAttack } from './entities.js';
import { game } from './state.js';

export function attachInput() {
  console.debug('[Controles] Activando teclado y puntero');
  const controller = new AbortController();
  const { signal } = controller;
  const canvas = game.canvas;
  const on = (target, type, listener) => target.addEventListener(type, listener, { signal });

  function cancelInput() {
    game.keys = Object.create(null);
    const player = game.player;
    if (player?.state === 'Walk') setState(player, 'Idle');
  }
  function attack() {
    if (!game.changingLevel && game.player?.hp) triggerAttack(game.player);
  }

  const isPanel = target => !!target?.closest?.('#benefits, #inventory, #nearby, #roster');
  on(document, 'keydown', event => {
    if (event.target !== canvas && !isPanel(event.target)) return;
    if (game.changingLevel) return;
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', ' '].includes(key)) return;
    event.preventDefault();
    if (event.repeat || game.changingLevel) return;
    if (key === 'e' || key === 'q') useActive(key);
    else if (key === ' ') attack();
    else game.keys[key] = true;
  });
  on(window, 'keyup', event => {
    const key = event.key.toLowerCase();
    delete game.keys[key];
  });
  on(document, 'pointerdown', event => {
    if (event.target !== canvas && !isPanel(event.target)) return;
    event.preventDefault();
    if (event.button !== 0 || !event.isPrimary) return;
    canvas.focus();
    attack();
  });
  on(document, 'pointerdown', event => { if (event.target !== canvas && !isPanel(event.target)) cancelInput(); });
  on(document, 'focusout', event => {
    if ((event.target === canvas || isPanel(event.target)) &&
        event.relatedTarget !== canvas && !isPanel(event.relatedTarget)) cancelInput();
  });
  on(window, 'blur', cancelInput);
  on(document, 'visibilitychange', () => { if (document.hidden) cancelInput(); });
  signal.addEventListener('abort', cancelInput, { once: true });
  canvas.focus();
  return controller;
}
