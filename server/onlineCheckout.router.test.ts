import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@shared/commerce/types";
import type { HoneyProduct } from "@shared/store";

const mocks = vi.hoisted(() => ({
  listPublicProducts: vi.fn(),
  createOnlineCheckoutOrder: vi.fn(),
  listProducts: vi.fn(),
  createCart: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listPublicProducts: mocks.listPublicProducts,
    createOnlineCheckoutOrder: mocks.createOnlineCheckoutOrder,
  };
});

vi.mock("./_core/shopify", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/shopify")>();
  return { ...actual, listProducts: mocks.listProducts, createCart: mocks.createCart };
});

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const SIDR = "عسل السدر الجبلي";

const localProduct: HoneyProduct = {
  id: 7,
  name: SIDR,
  slug: "sidr-7",
  shortDescription: "وصف مختصر",
  description: "وصف تفصيلي",
  origin: "اليمن",
  category: "عسل سدر",
  priceOptions: [{ label: "250 جم", price: 12000 }, { label: "1 كجم", price: 44000 }],
  primaryImage: "/sidr.jpg",
  galleryImages: ["/sidr.jpg"],
  galleryVideos: [],
  inventoryCount: 10,
  lowStockThreshold: 3,
  isFeatured: true,
  isActive: true,
};

const remoteProduct: Product = {
  id: "gid://shopify/Product/1",
  handle: "sidr",
  title: SIDR,
  description: "",
  descriptionHtml: "",
  productType: null,
  vendor: null,
  tags: [],
  images: [],
  priceRange: { min: { amount: "12.00", currencyCode: "USD" }, max: { amount: "44.00", currencyCode: "USD" } },
  options: [],
  variants: [
    // Deliberately first and available: the old client picked this one for every
    // weight, which is the bug this suite guards against.
    { id: "gid://variant/250", title: "250 جم", price: { amount: "12.00", currencyCode: "USD" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "الوزن", value: "250 جم" }] },
    { id: "gid://variant/1kg", title: "1 كجم", price: { amount: "44.00", currencyCode: "USD" }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: "الوزن", value: "1 كجم" }] },
  ],
};

function publicContext(ip: string) {
  return {
    user: null,
    localAdmin: null,
    req: { protocol: "https", ip, headers: {} } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const customer = { customerName: "أحمد علي", phone: "773207714", city: "صنعاء" };

describe("بدء الدفع الإلكتروني", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicProducts.mockResolvedValue([localProduct]);
    mocks.listProducts.mockResolvedValue([remoteProduct]);
    mocks.createCart.mockResolvedValue({ id: "gid://cart/abc", checkoutUrl: "https://shop.example/checkout?channel=online_store", items: [], itemCount: 1, subtotal: { amount: "44.00", currencyCode: "USD" }, total: { amount: "44.00", currencyCode: "USD" } });
    mocks.createOnlineCheckoutOrder.mockResolvedValue({ orderNumber: "MS-11111111-42", total: 88000 });
  });

  it("يفتح الدفع على المتغير المطابق للوزن المختار", async () => {
    const caller = appRouter.createCaller(publicContext("203.0.113.10"));

    const result = await caller.orders.createOnlineCheckout({ ...customer, items: [{ productId: 7, optionLabel: "1 كجم", quantity: 2 }] });

    expect(mocks.createCart).toHaveBeenCalledWith([{ variantId: "gid://variant/1kg", quantity: 2 }]);
    expect(result.checkoutUrl).toContain("channel=online_store");
    expect(result.orderNumber).toBe("MS-11111111-42");
  });

  it("يسجّل الطلب محليًا بمرجع سلة الدفع ليظهر في اللوحة", async () => {
    const caller = appRouter.createCaller(publicContext("203.0.113.11"));

    await caller.orders.createOnlineCheckout({ ...customer, items: [{ productId: 7, optionLabel: "250 جم", quantity: 1 }] });

    expect(mocks.createOnlineCheckoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: "أحمد علي", phone: "773207714", checkoutReference: "gid://cart/abc" }),
    );
  });

  it("يرفض الوزن غير المهيّأ بدل تحويله إلى متغير آخر", async () => {
    const caller = appRouter.createCaller(publicContext("203.0.113.12"));

    await expect(
      caller.orders.createOnlineCheckout({ ...customer, items: [{ productId: 7, optionLabel: "5 كجم", quantity: 1 }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Neither the cart nor the local order may be created for an unmatched line.
    expect(mocks.createCart).not.toHaveBeenCalled();
    expect(mocks.createOnlineCheckoutOrder).not.toHaveBeenCalled();
  });

  it("يفشل بوضوح إذا لم يُرجع مزوّد الدفع رابط إتمام", async () => {
    mocks.createCart.mockResolvedValue({ id: "gid://cart/empty", checkoutUrl: "", items: [], itemCount: 0, subtotal: { amount: "0", currencyCode: "USD" }, total: { amount: "0", currencyCode: "USD" } });
    const caller = appRouter.createCaller(publicContext("203.0.113.13"));

    await expect(
      caller.orders.createOnlineCheckout({ ...customer, items: [{ productId: 7, optionLabel: "250 جم", quantity: 1 }] }),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(mocks.createOnlineCheckoutOrder).not.toHaveBeenCalled();
  });

  it("يحدّ عدد محاولات الدفع من العنوان نفسه", async () => {
    const caller = appRouter.createCaller(publicContext("203.0.113.99"));
    const line = { productId: 7, optionLabel: "250 جم", quantity: 1 };

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await caller.orders.createOnlineCheckout({ ...customer, items: [line] });
    }
    await expect(caller.orders.createOnlineCheckout({ ...customer, items: [line] })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
