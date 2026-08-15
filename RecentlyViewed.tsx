import { ProductCard } from "@/components/ProductCard";
import type { HoneyProduct } from "@shared/store";
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "majid-siraj-recently-viewed";

export function rememberProduct(productId: number) {
  try {
    const current = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as number[];
    const next = [productId, ...current.filter(id => id !== productId)].slice(0, 6);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch { /* التخزين المحلي غير متاح */ }
}

export function RecentlyViewed({ products }: { products: HoneyProduct[] }) {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => { try { const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]"); if (Array.isArray(value)) setIds(value.filter(Number.isInteger)); } catch { /* قيمة غير صالحة */ } }, []);
  const recent = ids.map(id => products.find(product => product.id === id)).filter((product): product is HoneyProduct => Boolean(product));
  if (!recent.length) return null;
  return <section className="mt-16 border-t border-[#ead8b3] pt-10"><div className="flex items-center gap-2"><Clock3 className="text-[#a45c08]" size={20} /><div><p className="text-xs font-bold text-[#a45c08]">تابع من حيث توقفت</p><h2 className="font-display text-4xl text-[#5e3508]">شاهدتها مؤخرًا</h2></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.map(product => <ProductCard key={product.id} product={product} />)}</div></section>;
}
