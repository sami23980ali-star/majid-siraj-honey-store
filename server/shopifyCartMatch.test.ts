import { describe, expect, it } from "vitest";
import type { Product } from "@shared/commerce/types";
import type { HoneyProduct } from "@shared/store";
import { describeLineProblem, findShopifyProduct, findShopifyVariant, normalizeMatchText, resolveOnlineCheckoutLines } from "./shopifyCartMatch";

function variant(id: string, title: string, options: Array<[string, string]> = [], availableForSale = true) {
  return {
    id,
    title,
    price: { amount: "10.00", currencyCode: "USD" },
    compareAtPrice: null,
    availableForSale,
    selectedOptions: options.map(([name, value]) => ({ name, value })),
  };
}

function shopifyProduct(title: string, variants: ReturnType<typeof variant>[]): Product {
  return {
    id: `gid://shopify/Product/${title}`,
    handle: title,
    title,
    description: "",
    descriptionHtml: "",
    productType: null,
    vendor: null,
    tags: [],
    images: [],
    priceRange: { min: { amount: "10.00", currencyCode: "USD" }, max: { amount: "44.00", currencyCode: "USD" } },
    options: [],
    variants,
  };
}

function localProduct(id: number, name: string, labels: string[]): HoneyProduct {
  return {
    id,
    name,
    slug: `slug-${id}`,
    shortDescription: "وصف مختصر",
    description: "وصف تفصيلي",
    origin: "اليمن",
    category: "عسل",
    priceOptions: labels.map((label, index) => ({ label, price: 1000 * (index + 1) })),
    primaryImage: "/image.jpg",
    galleryImages: ["/image.jpg"],
    galleryVideos: [],
    inventoryCount: 10,
    lowStockThreshold: 3,
    isFeatured: false,
    isActive: true,
  };
}

const SIDR = "عسل السدر الجبلي";
const catalog = [localProduct(7, SIDR, ["250 جم", "500 جم", "1 كجم"])];
const remote = [
  shopifyProduct(SIDR, [
    variant("gid://variant/250", "250 جم", [["الوزن", "250 جم"]]),
    variant("gid://variant/500", "500 جم", [["الوزن", "500 جم"]]),
    variant("gid://variant/1kg", "1 كجم", [["الوزن", "1 كجم"]]),
  ]),
];

describe("مطابقة سلة الدفع الإلكتروني", () => {
  it("يوحّد النص العربي قبل المقارنة", () => {
    expect(normalizeMatchText("عَسَلُ السِّدْرِ")).toBe(normalizeMatchText("عسل السدر"));
    expect(normalizeMatchText("مـــاجد")).toBe("ماجد");
    expect(normalizeMatchText("٥٠٠ جم")).toBe("500 جم");
    expect(normalizeMatchText("  إسم   ")).toBe("اسم");
    expect(normalizeMatchText("1 KG")).toBe(normalizeMatchText("1 kg"));
  });

  it("يطابق المنتج بالاسم بعد التوحيد", () => {
    expect(findShopifyProduct(remote, "عَسَل السِّدر الجبلي")?.title).toBe(SIDR);
    expect(findShopifyProduct(remote, "عسل آخر")).toBeUndefined();
  });

  // The whole point of this module: the weight the shopper chose must decide the
  // variant. The old client picked the first available variant regardless.
  it("يطابق الوزن المطلوب ولا يستبدله بوزن آخر", () => {
    expect(findShopifyVariant(remote[0], "1 كجم")?.id).toBe("gid://variant/1kg");
    expect(findShopifyVariant(remote[0], "500 جم")?.id).toBe("gid://variant/500");
    expect(findShopifyVariant(remote[0], "5 كجم")).toBeUndefined();
  });

  it("يقبل الوزن من خيارات المتغير حتى لو اختلف عنوانه", () => {
    const product = shopifyProduct(SIDR, [variant("gid://v/a", "Variant A", [["الوزن", "1 كجم"]])]);
    expect(findShopifyVariant(product, "1 كجم")?.id).toBe("gid://v/a");
  });

  it("يقبل المنتج ذا المتغير الواحد الافتراضي لأي وزن", () => {
    const single = shopifyProduct(SIDR, [variant("gid://v/only", "Default Title")]);
    expect(findShopifyVariant(single, "1 كجم")?.id).toBe("gid://v/only");
    // But a single *named* variant must still match on its own label only.
    const named = shopifyProduct(SIDR, [variant("gid://v/250", "250 جم", [["الوزن", "250 جم"]])]);
    expect(findShopifyVariant(named, "1 كجم")).toBeUndefined();
  });

  it("يحوّل السلة إلى متغيرات Shopify الصحيحة", () => {
    const result = resolveOnlineCheckoutLines({
      catalog,
      shopifyProducts: remote,
      requested: [{ productId: 7, optionLabel: "1 كجم", quantity: 2 }],
    });
    expect(result.problems).toEqual([]);
    expect(result.lines).toEqual([{ variantId: "gid://variant/1kg", quantity: 2 }]);
  });

  it("يبلّغ عن كل سطر غير قابل للمطابقة بدل تمرير متغير خاطئ", () => {
    const result = resolveOnlineCheckoutLines({
      catalog: [...catalog, localProduct(9, "عسل غير منشور", ["500 جم"])],
      shopifyProducts: remote,
      requested: [
        { productId: 7, optionLabel: "5 كجم", quantity: 1 },
        { productId: 9, optionLabel: "500 جم", quantity: 1 },
        { productId: 404, optionLabel: "500 جم", quantity: 1 },
      ],
    });

    expect(result.lines).toEqual([]);
    expect(result.problems.map(problem => problem.reason)).toEqual(["unlisted-weight", "unlisted-product", "unknown-product"]);
    expect(describeLineProblem(result.problems[0])).toContain("5 كجم");
    expect(describeLineProblem(result.problems[1])).toContain("عسل غير منشور");
  });

  it("يرفض المتغير غير المتوفر للبيع", () => {
    const soldOut = [shopifyProduct(SIDR, [variant("gid://v/500", "500 جم", [["الوزن", "500 جم"]], false)])];
    const result = resolveOnlineCheckoutLines({
      catalog,
      shopifyProducts: soldOut,
      requested: [{ productId: 7, optionLabel: "500 جم", quantity: 1 }],
    });
    expect(result.lines).toEqual([]);
    expect(result.problems[0].reason).toBe("out-of-stock");
  });
});
