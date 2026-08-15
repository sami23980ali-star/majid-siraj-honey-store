import { describe, expect, it } from "vitest";
import { canTransition, countsTowardSales, holdsStock, ORDER_STATUSES, orderChannelLabel, orderStatusLabel, resolveStockAction, type OrderStatus } from "./orderStock";

describe("مخزون الطلب وحالاته", () => {
  it("يحجز المخزون للحالات النشطة فقط", () => {
    expect(holdsStock("new")).toBe(true);
    expect(holdsStock("preparing")).toBe(true);
    expect(holdsStock("completed")).toBe(true);
    // An unpaid checkout must not make a product look sold out.
    expect(holdsStock("awaiting_payment")).toBe(false);
    expect(holdsStock("cancelled")).toBe(false);
  });

  it("يعيد المخزون عند الإلغاء ويخصمه عند تأكيد الدفع", () => {
    // Cancelling an order that holds stock releases it.
    expect(resolveStockAction({ nextStatus: "cancelled", currentlyDeducted: true })).toBe("restore");
    // Confirming an online payment takes the stock for the first time.
    expect(resolveStockAction({ nextStatus: "new", currentlyDeducted: false })).toBe("deduct");
  });

  it("لا يكرر الخصم ولا الإعادة عند تكرار العملية", () => {
    // Idempotency: repeating a transition must not double-count inventory.
    expect(resolveStockAction({ nextStatus: "new", currentlyDeducted: true })).toBe("none");
    expect(resolveStockAction({ nextStatus: "preparing", currentlyDeducted: true })).toBe("none");
    expect(resolveStockAction({ nextStatus: "cancelled", currentlyDeducted: false })).toBe("none");
    expect(resolveStockAction({ nextStatus: "awaiting_payment", currentlyDeducted: false })).toBe("none");
  });

  it("يعيد المخزون عند إرجاع طلب مكتمل إلى انتظار الدفع", () => {
    expect(resolveStockAction({ nextStatus: "awaiting_payment", currentlyDeducted: true })).toBe("restore");
  });

  it("يقصر الطلب المكتمل على الإلغاء فقط", () => {
    expect(canTransition("completed", "cancelled")).toBe(true);
    expect(canTransition("completed", "completed")).toBe(true);
    expect(canTransition("completed", "preparing")).toBe(false);
    expect(canTransition("new", "preparing")).toBe(true);
    expect(canTransition("cancelled", "new")).toBe(true);
  });

  it("يستثني الملغاة وغير المدفوعة من حساب الإيراد", () => {
    expect(countsTowardSales("new")).toBe(true);
    expect(countsTowardSales("preparing")).toBe(true);
    expect(countsTowardSales("completed")).toBe(true);
    expect(countsTowardSales("cancelled")).toBe(false);
    expect(countsTowardSales("awaiting_payment")).toBe(false);
  });

  it("يعطي كل حالة اسمًا عربيًا", () => {
    const labels = ORDER_STATUSES.map(status => orderStatusLabel(status as OrderStatus));
    expect(labels).toEqual(["بانتظار الدفع", "جديد", "قيد التجهيز", "مكتمل", "ملغي"]);
    expect(orderChannelLabel("online")).toBe("دفع إلكتروني");
    expect(orderChannelLabel("whatsapp")).toBe("واتساب");
  });
});
