import { describe, expect, it } from "vitest";
import { normalizeReviewPhone, orderIncludesProduct } from "./reviewLogic";

describe("منطق مراجعات المنتجات", () => {
  it("يتحقق من وجود المنتج ضمن بنود الطلب الحقيقي", () => {
    const items = [{ productId: 7, quantity: 2 }, { productId: 4, quantity: 1 }] as never[];
    expect(orderIncludesProduct(items, 7)).toBe(true);
    expect(orderIncludesProduct(items, 9)).toBe(false);
  });

  it("يوحّد رقم العميل قبل مطابقته مع الطلب", () => {
    expect(normalizeReviewPhone("+967 773-207-714")).toBe("967773207714");
    expect(normalizeReviewPhone("00967 773207714")).toBe("967773207714");
  });
});
