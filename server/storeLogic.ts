import type { HoneyProduct, StoredOrderLine } from "@shared/store";

export function normalizeWhatsAppNumber(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function generateProductSlug(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "منتج"}-${Date.now().toString().slice(-6)}`;
}

export function buildOrderLines(
  catalog: HoneyProduct[],
  requestedItems: Array<{ productId: number; optionLabel: string; quantity: number }>,
) {
  const items: StoredOrderLine[] = requestedItems.map(line => {
    const product = catalog.find(item => item.id === line.productId);
    if (!product) throw new Error("أحد المنتجات لم يعد متاحًا");
    // No fallback to the first weight: silently billing a different option than
    // the customer picked produces a wrong total and an order that does not
    // match what they chose.
    const option = product.priceOptions.find(item => item.label === line.optionLabel);
    if (!option) throw new Error(`الوزن «${line.optionLabel}» لم يعد متاحًا لمنتج «${product.name}». حدّث السلة واختر وزنًا متاحًا.`);
    const quantity = Math.max(1, Math.min(99, line.quantity));
    return { productId: product.id, name: product.name, image: product.primaryImage, option, quantity, lineTotal: option.price * quantity };
  });
  return { items, total: items.reduce((sum, item) => sum + item.lineTotal, 0) };
}

export function formatWhatsAppMessage(input: {
  orderNumber: string;
  customerName: string;
  phone: string;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  items: StoredOrderLine[];
  total: number;
  currency: string;
}) {
  const lines = input.items.map(
    (item, index) =>
      `${index + 1}. ${item.name} — ${item.option.label} × ${item.quantity} = ${item.lineTotal.toLocaleString("ar-YE")} ${input.currency}`,
  );

  return [
    "السلام عليكم، أود تأكيد طلبي من متجر ماجد سراج.",
    "",
    `رقم الطلب: ${input.orderNumber}`,
    "المنتجات:",
    ...lines,
    "",
    `الإجمالي: ${input.total.toLocaleString("ar-YE")} ${input.currency}`,
    "",
    "بيانات العميل:",
    `الاسم: ${input.customerName}`,
    `الهاتف: ${input.phone}`,
    `المدينة: ${input.city || "غير محددة"}`,
    `العنوان: ${input.address || "غير محدد"}`,
    `ملاحظات: ${input.notes || "لا توجد"}`,
  ].join("\n");
}
