import { HOLD_MS } from './constants.js';
import { setState, startCharge, triggerAttack } from './entities.js';
import { game } from './state.js';

export function attachInput() {
  console.debug('[Controles] Activando teclado y puntero');
  const controller = new AbortController();
  const { signal } = controller;
  const canvas = game.canvas;
  let press = null;
  const on = (target, type, listener) => target.addEventListener(type, listener, { signal });

  function cancelInput() {
    clearTimeout(press?.timer);
    press = null;
    game.keys = Object.create(null);
    const player = game.player;
    if (player && ['Walk', 'Charge'].includes(player.state)) {
      player.chargeTime = 0;
      setState(player, 'Idle');
    }
  }

  // Asociar la pulsación a su jugador y PV impide arrastrar un ataque tras
  // recibir daño, cambiar de planta o recuperar el foco.
  function begin(source) {
    const player = game.player;
    if (press || game.changingLevel || !player?.hp || !['Idle', 'Walk'].includes(player.state)) return;
    press = { source, player, hp: player.hp };
    press.timer = setTimeout(() => {
      if (validPress()) startCharge();
    }, HOLD_MS);
  }
  function validPress() {
    return press && !game.changingLevel && press.player === game.player && press.hp === game.player.hp;
  }
  function release(source) {
    if (press?.source !== source) return;
    clearTimeout(press.timer);
    if (validPress()) triggerAttack(game.player);
    press = null;
  }

  on(canvas, 'keydown', event => {
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) return;
    event.preventDefault();
    if (event.repeat || game.changingLevel) return;
    if (key === ' ') begin('space');
    else game.keys[key] = true;
  });
  on(window, 'keyup', event => {
    const key = event.key.toLowerCase();
    delete game.keys[key];
    if (key === ' ') release('space');
  });
  on(canvas, 'pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    begin(event.pointerId);
  });
  on(canvas, 'pointerup', event => release(event.pointerId));
  on(canvas, 'pointercancel', cancelInput);
  on(canvas, 'lostpointercapture', event => {
    if (press?.source === event.pointerId) cancelInput();
  });
  on(document, 'pointerdown', event => { if (event.target !== canvas) cancelInput(); });
  on(canvas, 'blur', cancelInput);
  on(window, 'blur', cancelInput);
  on(document, 'visibilitychange', () => { if (document.hidden) cancelInput(); });
  signal.addEventListener('abort', cancelInput, { once: true });
  canvas.focus();
  return controller;
}
