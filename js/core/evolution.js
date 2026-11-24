// Redondea hacia arriba para que el cobro y las barras usen el mismo número entero.
export const evolutionCost = rule => Math.ceil(rule.amount*13/10);

// Si dos tipos pueden pagar el coste, preferimos el asociado a la forma
// actual y después el de mayor saldo. Una evolución consume un solo tipo.
export function evolutionPayment(rule, balances, preferredEssence) {
  const types = rule.essences.filter(type => (balances[type] || 0) >= evolutionCost(rule));
  types.sort((firstType,secondType) => Number(secondType === preferredEssence) - Number(firstType === preferredEssence) || balances[secondType] - balances[firstType]);
  return types.length ? { type: types[0], amount: evolutionCost(rule) } : null;
}
