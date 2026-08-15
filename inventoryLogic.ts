export function getInventoryState(inventoryCount: number, lowStockThreshold: number) {
  if (inventoryCount <= 0) return "out" as const;
  if (inventoryCount <= lowStockThreshold) return "low" as const;
  return "available" as const;
}

export function aggregateRequestedQuantities(items: Array<{ productId: number; quantity: number }>) {
  return items.reduce<Map<number, number>>((totals, item) => {
    totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
    return totals;
  }, new Map());
}
