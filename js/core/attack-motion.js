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
  const fraction = elapsed <= peak ? elapsed / peak : (total - elapsed) / (total - peak);
  const distance = attackReach(entity.stats) * Math.max(0, fraction);
  const [vx, vy] = DIR_VEC[entity.dir];
  const norm = Math.hypot(vx, vy);
  return { x: vx / norm * distance, y: vy / norm * distance, impact: elapsed >= peak };
}
