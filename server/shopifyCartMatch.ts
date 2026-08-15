/**
 * Maps the local honey catalog onto Shopify variants for the online checkout.
 *
 * This used to live in the browser (`OnlinePaymentButton`), which matched a
 * product by title and then took `variants.find(v => v.availableForSale)` —
 * ignoring the weight the shopper had selected. Someone ordering 1 كجم could be
 * sent to a checkout for the 250 جم variant. Two rules follow from that:
 *
 *   1. The weight must be matched explicitly, never defaulted.
 *   2. A line that cannot be matched is an error the shopper sees, not a
 *      silently substituted variant.
 */

import type { Product, ProductVariant } from "@shared/commerce/types";
import type { HoneyProduct } from "@shared/store";

/**
 * Folds the differences that make two Arabic strings look unequal to a computer
 * but identical to a reader: diacritics, tatweel, alef/ya/ta-marbuta spelling,
 * Arabic-Indic digits, and whitespace. Also lowercases so Latin unit
 * abbreviations ("KG" vs "kg") compare equal.
 */
export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFKD")
    // Harakat, superscript alef, and tatweel carry no meaning for matching.
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[آأإا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    // Arabic-Indic and Eastern Arabic-Indic digits to ASCII.
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function findShopifyProduct(products: Product[], productName: string): Product | undefined {
  const target = normalizeMatchText(productName);
  return products.find(candidate => normalizeMatchText(candidate.title) === target);
}

/**
 * Finds the variant for a weight label. Checks the variant title and every
 * selected option value, because a store may model the weight either way.
 * Single-variant products ("Default Title") match any label — such a product has
 * only one thing to sell, so there is nothing to get wrong.
 */
export function findShopifyVariant(product: Product, optionLabel: string): ProductVariant | undefined {
  const target = normalizeMatchText(optionLabel);
  const exact = product.variants.find(variant => {
    if (normalizeMatchText(variant.title) === target) return true;
    return variant.selectedOptions.some(option => normalizeMatchText(option.value) === target);
  });
  if (exact) return exact;

  if (product.variants.length === 1) {
    const only = product.variants[0];
    const onlyTitle = normalizeMatchText(only.title);
    if (onlyTitle === "default title" || onlyTitle === "") return only;
  }
  return undefined;
}

export type RequestedLine = { productId: number; optionLabel: string; quantity: number };
export type ResolvedLine = { variantId: string; quantity: number };

export type LineProblem = {
  productName: string;
  optionLabel: string;
  reason: "unknown-product" | "unlisted-product" | "unlisted-weight" | "out-of-stock";
};

export function describeLineProblem(problem: LineProblem): string {
  switch (problem.reason) {
    case "unknown-product":
      return "أحد المنتجات في سلتك لم يعد متاحًا. حدّث السلة ثم أعد المحاولة.";
    case "unlisted-product":
      return `«${problem.productName}» غير مُهيَّأ للدفع الإلكتروني بعد. أكمل الطلب عبر واتساب أو أزله من السلة.`;
    case "unlisted-weight":
      return `الوزن «${problem.optionLabel}» من «${problem.productName}» غير مُهيَّأ للدفع الإلكتروني. اختر وزنًا آخر أو أكمل عبر واتساب.`;
    case "out-of-stock":
      return `الوزن «${problem.optionLabel}» من «${problem.productName}» غير متوفر حاليًا للدفع الإلكتروني.`;
  }
}

/**
 * Resolves a whole cart. Returns problems instead of throwing so the caller can
 * report every unmatched line at once rather than one per retry.
 */
export function resolveOnlineCheckoutLines(input: {
  catalog: HoneyProduct[];
  shopifyProducts: Product[];
  requested: RequestedLine[];
}): { lines: ResolvedLine[]; problems: LineProblem[] } {
  const lines: ResolvedLine[] = [];
  const problems: LineProblem[] = [];

  input.requested.forEach(line => {
    const local = input.catalog.find(product => product.id === line.productId);
    if (!local) {
      problems.push({ productName: `#${line.productId}`, optionLabel: line.optionLabel, reason: "unknown-product" });
      return;
    }

    const remote = findShopifyProduct(input.shopifyProducts, local.name);
    if (!remote) {
      problems.push({ productName: local.name, optionLabel: line.optionLabel, reason: "unlisted-product" });
      return;
    }

    const variant = findShopifyVariant(remote, line.optionLabel);
    if (!variant) {
      problems.push({ productName: local.name, optionLabel: line.optionLabel, reason: "unlisted-weight" });
      return;
    }

    if (!variant.availableForSale) {
      problems.push({ productName: local.name, optionLabel: line.optionLabel, reason: "out-of-stock" });
      return;
    }

    lines.push({ variantId: variant.id, quantity: line.quantity });
  });

  return { lines, problems };
}
