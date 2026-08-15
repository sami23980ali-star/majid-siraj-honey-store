import { describe, expect, it } from "vitest";
import { aggregateRequestedQuantities, getInventoryState } from "./inventoryLogic";

describe("منطق المخزون", () => {
  it("يحدد حالة التوفر والتنبيه والنفاد", () => {
    expect(getInventoryState(12, 5)).toBe("available");
    expect(getInventoryState(5, 5)).toBe("low");
    expect(getInventoryState(0, 5)).toBe("out");
  });

  it("يجمع الكميات المتكررة للمنتج نفسه", () => {
    expect([...aggregateRequestedQuantities([{ productId: 1, quantity: 2 }, { productId: 1, quantity: 3 }, { productId: 2, quantity: 1 }])]).toEqual([[1, 5], [2, 1]]);
  });
});
