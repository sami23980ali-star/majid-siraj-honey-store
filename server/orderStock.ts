/**
 * When an order holds stock, and what a status change must do about it.
 *
 * Pulled out of db.ts as pure functions because this is the one place where a
 * mistake silently corrupts inventory: the old code deducted stock at order
 * creation and had no way to give it back, so the admin was told in the UI to
 * "adjust the quantity by hand when an order is cancelled".
 */

export type OrderStatus = "awaiting_payment" | "new" | "preparing" | "completed" | "cancelled";
export type OrderChannel = "whatsapp" | "online";

export const ORDER_STATUSES: OrderStatus[] = ["awaiting_payment", "new", "preparing", "completed", "cancelled"];

/**
 * Statuses that reserve inventory. `awaiting_payment` deliberately does not:
 * an unpaid online checkout must never make a product look sold out, since the
 * shopper may simply abandon the hosted checkout page.
 */
const STOCK_HOLDING_STATUSES = new Set<OrderStatus>(["new", "preparing", "completed"]);

export function holdsStock(status: OrderStatus) {
  return STOCK_HOLDING_STATUSES.has(status);
}

export type StockAction = "deduct" | "restore" | "none";

/**
 * What to do with inventory when moving an order between statuses.
 *
 * `currentlyDeducted` is the order's recorded state rather than something
 * derived from the old status, so a row that was migrated, edited by hand, or
 * created before this logic existed still settles correctly.
 */
export function resolveStockAction(input: {
  nextStatus: OrderStatus;
  currentlyDeducted: boolean;
}): StockAction {
  const shouldHold = holdsStock(input.nextStatus);
  if (shouldHold && !input.currentlyDeducted) return "deduct";
  if (!shouldHold && input.currentlyDeducted) return "restore";
  return "none";
}

/** Status transitions the admin is allowed to make from the dashboard. */
export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  // A completed order is terminal except for cancellation (refund / return).
  if (from === "completed") return to === "cancelled";
  return true;
}

export function orderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "awaiting_payment":
      return "بانتظار الدفع";
    case "new":
      return "جديد";
    case "preparing":
      return "قيد التجهيز";
    case "completed":
      return "مكتمل";
    case "cancelled":
      return "ملغي";
  }
}

export function orderChannelLabel(channel: OrderChannel) {
  return channel === "online" ? "دفع إلكتروني" : "واتساب";
}

/** Orders that count toward revenue: paid-or-committed, and not cancelled. */
export function countsTowardSales(status: OrderStatus) {
  return status !== "awaiting_payment" && status !== "cancelled";
}
