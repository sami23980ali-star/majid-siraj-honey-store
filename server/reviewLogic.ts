import type { StoredOrderLine } from "@shared/store";

export function normalizeReviewPhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^00/, "");
}

export function orderIncludesProduct(items: StoredOrderLine[], productId: number) {
  return items.some(item => item.productId === productId && item.quantity > 0);
}
