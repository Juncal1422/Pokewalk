import { statsFor } from './stats.js';
import { game } from './state.js';

export function amount(id, held = game.held) {
  return held?.has(id) ? game.benefits.get(id).amount : 0;
}

// Los porcentajes se calculan de nuevo sobre la forma actual, nunca sobre
// el resultado de una transformación anterior.
export function playerStats(row, progress, bonuses, held = game.held) {
  const stats = statsFor(row, progress, bonuses);
  let attack = amount('big_fang', held);
  for (const id of held) {
    const benefit = game.benefits.get(id);
    if (benefit.types?.some(type => row.types.includes(type))) attack += benefit.amount;
  }
  stats.range = Math.round(stats.range * (1 + amount('big_fang', held)));
  stats.attack = Math.round(stats.attack * (1 + attack) + stats.range * amount('golden_spike', held));
  stats.defense = Math.round(stats.defense * (1 + amount('deep_scale', held)));
  return stats;
}

export function projectReward(state, option) {
  const held = new Set(state.held), bonuses = { ...state.bonuses }, balances = { ...state.balances };
  const benefit = game.donors.get(option.row.name);
  const allStats = option.bonus || held.has(benefit?.id);
  if (allStats) {
    for (const key of Object.keys(bonuses)) bonuses[key]++;
  } else {
    if (!benefit) throw new Error('Falta el beneficio de ' + option.row.name);
    if (benefit.active) for (const id of held) if (game.benefits.get(id).active) held.delete(id);
    held.add(benefit.id);
  }
  if (option.payment) balances[option.payment.type] -= option.payment.amount;
  return { benefitLevels: (state.benefitLevels || 0) + Number(Boolean(allStats)), held, bonuses, balances, row: option.row, essence: option.essence, benefit, allStats };
}
