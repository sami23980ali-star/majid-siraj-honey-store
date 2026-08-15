import { Link, useLocation } from "wouter";
import { Heart, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";

const navigation = [
  { label: "الرئيسية", href: "/" },
  { label: "المتجر", href: "/shop" },
  { label: "دليل العسل", href: "/knowledge" },
  { label: "من نحن", href: "/about" },
  { label: "تواصل معنا", href: "/contact" },
  { label: "تتبع طلبي", href: "/track-order" },
];

export function StoreShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { count } = useCart();
  const { count: favoritesCount } = useFavorites();

  return (
    <div dir="rtl" className="min-h-screen bg-[#fffaf0] text-[#281806]">
      <header className="sticky top-0 z-50 border-b border-[#e9d7b1]/70 bg-[#fffaf0]/90 backdrop-blur-xl">
        <div className="container flex h-18 items-center justify-between gap-4 py-3">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5e3508] text-lg text-[#f8d783] shadow-[0_8px_20px_rgba(94,53,8,.2)] transition-transform duration-200 group-hover:-rotate-6">م</span>
            <span className="leading-tight"><b className="block font-display text-lg text-[#5e3508]">ماجد سراج</b><small className="text-[10px] tracking-[.15em] text-[#a56a15]">عسل بلدي مختار</small></span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navigation.map(item => <Link key={item.href} href={item.href} className={`text-sm transition-colors ${location === item.href ? "font-bold text-[#a65d08]" : "text-[#69431b] hover:text-[#a65d08]"}`}>{item.label}</Link>)}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/favorites" aria-label="المفضلة" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7c88c] bg-white text-[#77430c] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.97]"><Heart size={18} />{favoritesCount > 0 && <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-[#bd710b] px-1 text-center text-[10px] font-bold leading-5 text-white">{favoritesCount}</span>}</Link>
            <Link href="/cart" aria-label="السلة" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7c88c] bg-white text-[#77430c] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.97]">
              <ShoppingBag size={19} />
              {count > 0 && <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-[#bd710b] px-1 text-center text-[10px] font-bold leading-5 text-white">{count}</span>}
            </Link>
            <button onClick={() => setOpen(!open)} aria-label="فتح القائمة" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5e3508] text-white lg:hidden">{open ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {open && <div className="border-t border-[#eddab5] bg-[#fffdf8] px-5 py-4 lg:hidden"><nav className="flex flex-col gap-3">{navigation.map(item => <Link key={item.href} onClick={() => setOpen(false)} href={item.href} className="rounded-xl px-3 py-2 text-sm font-semibold text-[#5e3508] hover:bg-[#f6e8ce]">{item.label}</Link>)}</nav></div>}
      </header>
      {children}
      <footer className="border-t border-[#e7d1a4] bg-[#4a2907] text-[#f8e6bf]">
        <div className="container grid gap-8 py-11 sm:grid-cols-2 lg:grid-cols-3">
          <div><h2 className="font-display text-2xl text-[#f6cd70]">ماجد سراج</h2><p className="mt-3 max-w-sm text-sm leading-7 text-[#ead5ab]">متجر عربي متخصص في تقديم مختارات العسل البلدي للجملة والتجزئة، بطلب سهل ومباشر عبر واتساب.</p></div>
          <div><h3 className="font-bold text-white">روابط سريعة</h3><div className="mt-3 flex flex-col gap-2 text-sm text-[#ead5ab]">{navigation.map(item => <Link key={item.href} href={item.href} className="hover:text-[#f6cd70]">{item.label}</Link>)}</div></div>
          <div><h3 className="font-bold text-white">خدمة الطلب</h3><p className="mt-3 text-sm leading-7 text-[#ead5ab]">أرسل طلبك وسيُفتح واتساب برسالة تشمل جميع التفاصيل لمتابعته مع فريق «ماجد سراج».</p><Link href="/cart" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#f6cd70]"><MessageCircle size={16} />انتقل إلى السلة</Link></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-[#d9bd85]">© {new Date().getFullYear()} ماجد سراج — جميع الحقوق محفوظة</div>
      </footer>
    </div>
  );
}
