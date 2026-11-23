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

  const isBag = target => !!target?.closest?.('#bag, #inventory');
  on(document, 'keydown', event => {
    if (event.target !== canvas && !isBag(event.target)) return;
    if (game.changingLevel) return;
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) return;
    event.preventDefault();
    if (event.repeat || game.changingLevel) return;
    if (key === ' ') attack();
    else game.keys[key] = true;
  });
  on(window, 'keyup', event => {
    const key = event.key.toLowerCase();
    delete game.keys[key];
  });
  on(canvas, 'pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    canvas.focus();
    attack();
  });
  on(document, 'pointerdown', event => { if (event.target !== canvas && !isBag(event.target)) cancelInput(); });
  on(document, 'focusout', event => {
    if ((event.target === canvas || isBag(event.target)) &&
        event.relatedTarget !== canvas && !isBag(event.relatedTarget)) cancelInput();
  });
  on(window, 'blur', cancelInput);
  on(document, 'visibilitychange', () => { if (document.hidden) cancelInput(); });
  signal.addEventListener('abort', cancelInput, { once: true });
  canvas.focus();
  return controller;
}
