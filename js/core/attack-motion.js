import { attackReach } from './stats.js';
import { DIR_VEC } from './constants.js';

// La punta del desplazamiento y el impacto usan el mismo reloj de animación.
// Se incluye la segunda mitad del fotograma de impacto y toda la recuperación.
export function attackMotion(entity, animation) {
  const marker = Number.isInteger(animation.hitFrame) ? animation.hitFrame : Math.floor(animation.frames / 2);
  const hit = Math.max(0, Math.min(animation.frames - 1, marker));
  let elapsed = entity.timer, peak = 0, total = 0;
  for (let frame = 0; frame < animation.frames; frame++) {
    const duration = animation.durs[frame] || 8;
    if (frame < entity.frame) elapsed += duration;
    if (frame === hit) peak = total + duration / 2;
    total += duration;
  }
  // Algunas hojas (Mothim) marcan impacto en el primer cuadro. Reservamos
  // tiempo para que la aproximación y el regreso sean visibles en ambos extremos.
  peak = Math.max(total * .25, Math.min(total * .75, peak));
  const impact = elapsed >= peak;
  const phase = Math.min(1, Math.max(0, impact ? (total-elapsed)/(total-peak) : elapsed/peak));
  // La derivada es cero en el impacto: la embestida cambia de sentido sin tirón.
  const ease = phase * phase * (3 - 2 * phase);
  const distance = attackReach(entity.stats) * (entity.fangStrike && impact ? 1 : ease);
  const [vx, vy] = DIR_VEC[entity.dir];
  const norm = Math.hypot(vx, vy);
  return { x: vx / norm * distance, y: vy / norm * distance, impact, opacity: impact ? phase : 1 };
}
