// La simulación conserva pasos de 1/60 s. El acumulador avanza el reloj un
// 10 % más rápido y desacopla combate, animaciones y recargas del monitor.
const step = 1000 / 60;
let previous, pending = 0, elapsed = 0;
export const gameTime = () => elapsed;
export function resetClock() { previous = undefined; pending = elapsed = 0; }
export function advanceClock(timestamp, paused, update) {
  const delta = previous === undefined ? step : Math.min(100, Math.max(0, timestamp - previous));
  previous = timestamp;
  if (paused) { pending = 0; return; }
  pending += delta * 1.1;
  while (pending >= step) {
    elapsed += step;
    pending -= step;
    update();
  }
}
