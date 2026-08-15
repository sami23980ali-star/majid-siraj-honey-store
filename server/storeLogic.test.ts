import { describe, expect, it } from "vitest";
import { buildOrderLines, formatWhatsAppMessage, normalizeWhatsAppNumber } from "./storeLogic";

describe("منطق الطلب عبر واتساب", () => {
  it("ينشئ رسالة عربية تشمل بيانات العميل وبنود الطلب", () => {
    const message = formatWhatsAppMessage({
      orderNumber: "MS-123456",
      customerName: "أحمد علي",
      phone: "773207714",
      city: "صنعاء",
      address: "التحرير",
      notes: "التسليم مساءً",
      total: 24000,
      currency: "ر.ي",
      items: [
        {
          productId: 1,
          name: "عسل سدر جبلي",
          image: "",
          option: { label: "500 جم", price: 12000 },
          quantity: 2,
          lineTotal: 24000,
        },
      ],
    });

    expect(message).toContain("رقم الطلب: MS-123456");
    expect(message).toContain("عسل سدر جبلي");
    expect(message).toContain("الاسم: أحمد علي");
    expect(message).toContain("الإجمالي:");
  });

  it("ينظف رقم واتساب من الرموز والمسافات", () => {
    expect(normalizeWhatsAppNumber("+967 773-207-714")).toBe("967773207714");
  });

  it("يبني بنود الطلب ويحسِب الإجمالي بالاعتماد على سعر الوزن المختار", () => {
    const result = buildOrderLines([
      {
        id: 7,
        name: "عسل سدر جبلي",
        slug: "sidr-7",
        shortDescription: "وصف مختصر",
        description: "وصف تفصيلي للمنتج",
        origin: "اليمن",
        category: "عسل سدر",
        priceOptions: [{ label: "500 جم", price: 12000 }, { label: "1 كجم", price: 22000 }],
        primaryImage: "/test.jpg",
        galleryImages: ["/test.jpg"],
        isFeatured: true,
        isActive: true,
      },
    ], [{ productId: 7, optionLabel: "1 كجم", quantity: 2 }]);

    expect(result.items[0]).toMatchObject({ name: "عسل سدر جبلي", quantity: 2, lineTotal: 44000 });
    expect(result.total).toBe(44000);
  });

  it("يرفض وزنًا غير موجود بدل احتساب سعر وزن آخر", () => {
    // Falling back to priceOptions[0] used to bill the customer for a weight they
    // never chose — a silently wrong total on a real order.
    const catalog = [{
      id: 11,
      name: "عسل السَّمُر البلدي",
      slug: "samur-11",
      shortDescription: "وصف مختصر",
      description: "وصف تفصيلي للمنتج",
      origin: "اليمن",
      category: "عسل بلدي",
      priceOptions: [{ label: "250 جم", price: 9000 }, { label: "500 جم", price: 17000 }],
      primaryImage: "/samur.jpg",
      galleryImages: ["/samur.jpg"],
      galleryVideos: [],
      inventoryCount: 10,
      lowStockThreshold: 3,
      isFeatured: false,
      isActive: true,
    }];

    expect(() => buildOrderLines(catalog, [{ productId: 11, optionLabel: "5 كجم", quantity: 1 }])).toThrow("لم يعد متاحًا");
    expect(() => buildOrderLines(catalog, [{ productId: 999, optionLabel: "250 جم", quantity: 1 }])).toThrow("أحد المنتجات لم يعد متاحًا");
  });

  it("ينقل تفاصيل سلة مكتملة إلى رسالة واتساب قابلة للإرسال", () => {
    const catalog = [{
      id: 9,
      name: "عسل الزهور الموسمية",
      slug: "flowers-9",
      shortDescription: "وصف مختصر",
      description: "وصف تفصيلي للمنتج",
      origin: "اليمن",
      category: "عسل زهور",
      priceOptions: [{ label: "250 جم", price: 7000 }],
      primaryImage: "/flower.jpg",
      galleryImages: ["/flower.jpg"],
      isFeatured: false,
      isActive: true,
    }];
    const cart = buildOrderLines(catalog, [{ productId: 9, optionLabel: "250 جم", quantity: 3 }]);
    const message = formatWhatsAppMessage({
      orderNumber: "MS-FLOW-01",
      customerName: "عميل اختبار المنطق",
      phone: "773207714",
      items: cart.items,
      total: cart.total,
      currency: "ر.ي",
    });

    expect(cart.total).toBe(21000);
    expect(message).toContain("عسل الزهور الموسمية");
    expect(message).toContain("250 جم × 3");
    expect(message).toContain("MS-FLOW-01");
  });
});
