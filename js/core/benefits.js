import { gameTime } from './clock.js';
import { statsFor } from './stats.js';
import { game } from './state.js';

export function amount(id, held = game.held) {
  return held?.has(id) ? game.benefits.get(id).amount : 0;
}

// Los porcentajes se calculan de nuevo sobre la forma actual, nunca sobre
// el resultado de una transformación anterior.
export function playerStats(row, progress, bonuses, held = game.held) {
  const stats = statsFor(row, progress, bonuses);
  const modifiers = {attack:0, range:0, speed:0, defense:0, attackSpeed:0};
  for (const id of held) {
    for (const [key,value] of Object.entries(game.benefits.get(id).stats ?? {})) modifiers[key] += value;
  }
  if (held.has('amulet') && game.amuletUntil > gameTime()) {
    for (const key of ['attack','speed','attackSpeed']) modifiers[key] += .5;
  }
  for (const [key,modifier] of Object.entries(modifiers)) {
    stats[key] = Math.round(stats[key]*(1+modifier));
    if (key === 'speed' || key === 'attackSpeed') stats[key] = Math.min(180,stats[key]);
  }
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
    if (benefit.active) for (const id of held) if (game.benefits.get(id).slot === benefit.slot) held.delete(id);
    held.add(benefit.id);
  }
  if (option.payment) balances[option.payment.type] -= option.payment.amount;
  return { held, bonuses, balances, row: option.row, essence: option.essence, benefit, allStats };
}
