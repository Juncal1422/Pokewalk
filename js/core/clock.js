// La simulación conserva pasos de 1/60 s. El acumulador avanza el reloj un
// 10 % más rápido y desacopla combate, animaciones y recargas del monitor.
import {game} from './state.js';
let combatMs=0;
export const cooldownTime=()=>combatMs;
const fixedStepMs = 1000 / 60;
let previousTimestamp, pendingMs = 0, simulationMs = 0;
// Devuelve los milisegundos transcurridos en la simulación.
export const gameTime = () => simulationMs;
// Descarta el tiempo acumulado y el instante del fotograma anterior al reiniciar.
export function resetClock() { previousTimestamp = undefined; pendingMs = simulationMs = combatMs = 0; }
// Convierte el intervalo real entre fotogramas en pasos fijos de simulación acelerada.
export function advanceClock(timestamp, paused, update) {
  // Limitar la deuda a 100 ms evita ejecutar segundos de combate al recuperar una pestaña.
  const frameDeltaMs = previousTimestamp === undefined ? fixedStepMs : Math.min(100, Math.max(0, timestamp - previousTimestamp));
  previousTimestamp = timestamp;
  if (paused) { pendingMs = 0; return; }
  pendingMs += frameDeltaMs * 1.1;
  while (pendingMs >= fixedStepMs) {
    simulationMs += fixedStepMs;
    if (game.entities.some(e=>!e.isPlayer && !e.ally && e.hp>0)) combatMs+=fixedStepMs;
    pendingMs -= fixedStepMs;
    update();
  }
}
