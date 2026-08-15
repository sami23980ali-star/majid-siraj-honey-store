import type { HoneyProduct } from "@shared/store";
import { Link } from "wouter";
import { ArrowLeft, Heart, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/store";
import { useFavorites } from "@/contexts/FavoritesContext";
import { StoreImage } from "./StoreImage";

export function ProductCard({ product, priority }: { product: HoneyProduct; priority?: boolean }) {
  const lowestPrice = Math.min(...product.priceOptions.map(option => option.price));
  const { has, toggle } = useFavorites();
  const soldOut = product.inventoryCount <= 0;
  return <article className="group overflow-hidden rounded-[1.6rem] border border-[#ead8b3] bg-white shadow-[0_10px_28px_rgba(86,50,9,.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(86,50,9,.14)]">
    <Link href={`/products/${product.slug}`} className="relative block h-56 overflow-hidden bg-[#f4e1bb]">
      <StoreImage src={product.primaryImage} alt={product.name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4a2907]/85 px-3 py-1 text-[11px] font-bold text-[#f7d477] backdrop-blur"><Sparkles size={12} />{product.category}</span>
      <button onClick={event => { event.preventDefault(); toggle(product.id); }} aria-label={has(product.id) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} className={`absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur ${has(product.id) ? "bg-[#b66d08] text-white" : "bg-white/90 text-[#80521a]"}`}><Heart size={16} className={has(product.id) ? "fill-current" : ""} /></button>
    </Link>
    <div className="p-5"><p className="text-xs text-[#9c671f]">{product.origin}</p><Link href={`/products/${product.slug}`} className="mt-1 block font-display text-2xl font-bold text-[#5e3508] hover:text-[#b66d08]">{product.name}</Link><p className="mt-2 min-h-12 text-xs leading-6 text-[#806743]">{product.shortDescription}</p><div className="mt-3 flex flex-wrap gap-1.5">{product.priceOptions.map(option => <span key={option.label} className="rounded-lg bg-[#f8ecd7] px-2 py-1 text-[10px] font-bold text-[#78501c]">{option.label}</span>)}</div><p className={`mt-3 text-[11px] font-bold ${soldOut ? "text-[#a83a23]" : product.inventoryCount <= product.lowStockThreshold ? "text-[#a45c08]" : "text-[#4c7a2c]"}`}>{soldOut ? "نفدت الكمية مؤقتًا" : product.inventoryCount <= product.lowStockThreshold ? `كمية محدودة: ${product.inventoryCount}` : "متوفر للطلب"}</p><div className="mt-4 flex items-center justify-between gap-3 border-t border-[#f1e3c8] pt-4"><div><span className="block text-[10px] text-[#8b6c40]">يبدأ من</span><b className="text-sm text-[#a45c08]">{formatPrice(lowestPrice)}</b></div><Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#5e3508]">التفاصيل <ArrowLeft size={15} /></Link></div></div>
  </article>;
}
