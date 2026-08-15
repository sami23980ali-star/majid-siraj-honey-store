import { StoreShell } from "@/components/StoreShell";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/contexts/FavoritesContext";
import { trpc } from "@/lib/trpc";
import { Heart } from "lucide-react";
import { Link } from "wouter";

export default function Favorites() {
  const { ids } = useFavorites();
  const { data: products = [], isLoading } = trpc.catalog.list.useQuery();
  const favorites = products.filter(product => ids.includes(product.id));
  return <StoreShell><main className="container py-10 sm:py-14"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-bold text-[#a45c08]">محفوظة على هذا الجهاز</p><h1 className="mt-2 font-display text-5xl text-[#5e3508]">منتجاتي المفضلة</h1></div><Heart className="text-[#b66d08]" size={28} /></div>{isLoading ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-96 animate-pulse rounded-3xl bg-[#f1e5cf]" />)}</div> : favorites.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{favorites.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-8 rounded-3xl border border-dashed border-[#dfc28c] bg-[#fffdf8] p-10 text-center"><Heart className="mx-auto text-[#b66d08]" size={28} /><h2 className="mt-3 font-display text-3xl text-[#5e3508]">لا توجد منتجات محفوظة</h2><p className="mt-2 text-sm text-[#806743]">اضغط رمز القلب في أي منتج لتجده هنا بسرعة.</p><Link href="/shop" className="mt-5 inline-block rounded-xl bg-[#5e3508] px-5 py-3 text-sm font-bold text-[#f6cd70]">تصفح المتجر</Link></div>}</main></StoreShell>;
}
