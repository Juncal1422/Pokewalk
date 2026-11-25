import { useActive } from './abilities.js';
import { setState, triggerAttack } from './entities.js';
import { game } from './state.js';

// Vincula teclado, puntero y pérdida de foco al canvas y devuelve el controlador de los eventos.
export function attachInput() {
  console.debug('[Controles] Activando teclado y puntero');
  const controller = new AbortController();
  const { signal } = controller;
  const gameCanvas = game.canvas;
  // Registra cada evento con la misma señal para poder desmontar todos los controles.
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal });

  // Vacía las direcciones pulsadas y detiene la marcha al perder el foco.
  function cancelInput() {
    game.keys = Object.create(null);
    const player = game.player;
    // Soltar movimiento detiene la marcha sin interrumpir un impacto o un ataque en curso.
    if (player?.state === 'Walk') setState(player, 'Idle');
  }
  // Inicia el ataque del jugador si el piso está activo y el jugador sigue vivo.
  function attack() {
    if (!game.changingLevel && game.player?.hp) triggerAttack(game.player);
  }

  // Reconoce los paneles que permiten transmitir el clic como ataque.
  const isPanel = target => !!target?.closest?.('#species-benefit-panel, #equipment-panel, #nearby-loot-panel, #floor-pokemon-panel');
  // Las acciones puntuales ignoran la repetición de tecla. El movimiento conserva su estado hasta keyup.
  listen(document, 'keydown', event => {
    if (event.target !== gameCanvas && !isPanel(event.target)) return;
    if (game.changingLevel) return;
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'r', ' '].includes(key)) return;
    event.preventDefault();
    if (event.repeat || game.changingLevel) return;
    if (['q','e','r'].includes(key)) useActive(key);
    else if (key === ' ') attack();
    else game.keys[key] = true;
  });
  // El puntero usa coordenadas del búfer; el HUD las convierte a su escala al dibujar.
  listen(gameCanvas, 'pointermove', event => {
    const rect=gameCanvas.getBoundingClientRect();
    game.hudPointer={x:(event.clientX-rect.left)*gameCanvas.width/rect.width,
      y:(event.clientY-rect.top)*gameCanvas.height/rect.height};
  });
  listen(gameCanvas,'pointerleave',()=>{game.hudPointer=null;});
  listen(window, 'keyup', event => {
    const key = event.key.toLowerCase();
    delete game.keys[key];
  });
  listen(document, 'pointerdown', event => {
    if(event.target.closest?.('nav button'))return;
    if (event.target !== gameCanvas && !isPanel(event.target)) return;
    event.preventDefault();
    if (event.button !== 0 || !event.isPrimary) return;
    gameCanvas.focus();
    attack();
  });
  listen(document, 'pointerdown', event => {
    if(event.target.closest?.('nav button'))return; if (event.target !== gameCanvas && !isPanel(event.target)) cancelInput(); });
  listen(document, 'focusout', event => {
    if ((event.target === gameCanvas || isPanel(event.target)) &&
        event.relatedTarget !== gameCanvas && !isPanel(event.relatedTarget)) cancelInput();
  });
  listen(window, 'blur', cancelInput);
  listen(document, 'visibilitychange', () => { if (document.hidden) cancelInput(); });
  signal.addEventListener('abort', cancelInput, { once: true });
  gameCanvas.focus();
  return controller;
}
