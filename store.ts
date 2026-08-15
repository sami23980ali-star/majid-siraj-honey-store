export function formatPrice(value: number) {
  return `${value.toLocaleString("ar-YE")} ر.ي`;
}

export type OrderStatus = "awaiting_payment" | "new" | "preparing" | "completed" | "cancelled";
export type OrderChannel = "whatsapp" | "online";

/** Kept in step with the enum in drizzle/schema.ts and server/orderStock.ts. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "بانتظار الدفع",
  new: "جديد",
  preparing: "قيد التجهيز",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, string> = {
  awaiting_payment: "bg-[#fff1d9] text-[#8a5a06]",
  new: "bg-[#f7ead3] text-[#80521a]",
  preparing: "bg-[#e7f0fb] text-[#245a8d]",
  completed: "bg-[#e5f3df] text-[#37711d]",
  cancelled: "bg-[#f1ecea] text-[#6f5a53]",
};

export function orderStatusLabel(status: OrderStatus) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderChannelLabel(channel: OrderChannel) {
  return channel === "online" ? "دفع إلكتروني" : "واتساب";
}

/** Customer-facing explanation of what a tracked order's status means. */
export function orderStatusHint(status: OrderStatus) {
  switch (status) {
    case "awaiting_payment":
      return "لم يصل تأكيد الدفع بعد. أكمل الدفع من صفحة الدفع الآمن، أو تواصل معنا لإتمام الطلب عبر واتساب.";
    case "new":
      return "استلمنا طلبك وسيبدأ التجهيز قريبًا.";
    case "preparing":
      return "طلبك قيد التجهيز الآن.";
    case "completed":
      return "تم إكمال الطلب. شكرًا لثقتك.";
    case "cancelled":
      return "تم إلغاء هذا الطلب. تواصل معنا إذا كان الإلغاء غير مقصود.";
  }
}
