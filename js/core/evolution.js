// Si dos tipos pueden pagar el coste, preferimos el asociado a la forma
// actual y después el de mayor saldo. Una evolución consume un solo tipo.
export function evolutionPayment(rule, balances, preferred) {
  const types = rule.essences.filter(type => (balances[type] || 0) >= rule.amount);
  types.sort((a,b) => Number(b === preferred) - Number(a === preferred) || balances[b] - balances[a]);
  return types.length ? { type: types[0], amount: rule.amount } : null;
}
