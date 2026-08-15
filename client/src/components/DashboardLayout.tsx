import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { adminRoleLabel, resolveAdminCapabilities, resolveAdminGate, visibleAdminTabs } from "@/lib/adminAccess";
import { trpc } from "@/lib/trpc";
import { BarChart3, Boxes, LogOut, PackageCheck, ServerCrash, Settings, Store, UserRound, UsersRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import AdminLocalLogin from "./AdminLocalLogin";
import { Button } from "./ui/button";

/** Icons keyed by tab, so the link list stays derived from lib/adminAccess. */
const tabIcons: Record<string, typeof BarChart3> = {
  overview: BarChart3,
  products: Boxes,
  orders: PackageCheck,
  inventory: Boxes,
  reviews: Store,
  settings: Settings,
  users: UsersRound,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { data: adminStatus, isLoading: adminStatusLoading, error: adminStatusError, isFetching: adminStatusFetching, refetch: refetchAdminStatus } = trpc.adminAuth.status.useQuery();
  const utils = trpc.useUtils();
  const localLogout = trpc.adminAuth.logout.useMutation({ onSuccess: () => utils.adminAuth.status.invalidate() });
  const [location] = useLocation();
  const ownerAdmin = Boolean(adminStatus?.ownerAdmin || user?.role === "admin");
  const localAdmin = adminStatus?.localAdmin;
  const capabilities = resolveAdminCapabilities({ ownerAdmin, role: localAdmin?.role });
  const gate = resolveAdminGate({
    loading: loading || adminStatusLoading,
    failed: Boolean(adminStatusError),
    signedIn: Boolean(user),
    ownerAdmin,
    hasLocalAdmin: Boolean(localAdmin),
    configured: Boolean(adminStatus?.configured),
    canSetup: Boolean(adminStatus?.canSetup),
  });

  if (gate === "loading") return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] text-[#76501f]">يتم التحقق من صلاحية الدخول…</div>;
  // Never guess at membership from a failed request: say the check itself failed
  // and offer to run it again.
  if (gate === "unavailable") return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] p-6"><div className="w-full max-w-md rounded-3xl border border-[#efd0c4] bg-white p-8 text-center shadow-xl"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fde8e3] text-[#a83a23]"><ServerCrash /></span><h1 className="mt-5 font-display text-2xl text-[#7b2c1e]">تعذر التحقق من صلاحية الدخول</h1><p className="mt-3 text-sm leading-7 text-[#8c4a35]">{adminStatusError?.message || "لم يستجب الخادم لطلب حالة الإدارة."}</p><p className="mt-2 text-xs leading-6 text-[#a07a5d]">لوحة الإدارة تحتاج اتصالًا سليمًا بقاعدة البيانات. راجع إعداد <code className="rounded bg-[#fbf1e6] px-1">DATABASE_URL</code> ثم أعد المحاولة.</p><Button disabled={adminStatusFetching} onClick={() => void refetchAdminStatus()} className="mt-6 w-full bg-[#b66d08] hover:bg-[#925404]">{adminStatusFetching ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}</Button><Link href="/" className="mt-4 block text-xs font-bold text-[#a45c08]">العودة إلى المتجر</Link></div></div>;
  if (gate === "localLogin") return <AdminLocalLogin />;
  if (gate === "ownerLogin") return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] p-6"><div className="w-full max-w-md rounded-3xl border border-[#ead7aa] bg-white p-8 text-center shadow-xl"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5e3508] text-[#f6cd70]"><UserRound /></span><h1 className="mt-5 font-display text-2xl text-[#5e3508]">إعداد إدارة ماجد سراج</h1><p className="mt-3 text-sm leading-7 text-[#7e6237]">لم يُنشأ حساب مدير محلي بعد. سجّل دخولك بحساب مالك المشروع لإعداد الحساب الأول.</p><Button onClick={() => startLogin("/admin")} className="mt-6 w-full bg-[#b66d08] hover:bg-[#925404]">دخول مالك المشروع</Button></div></div>;
  if (gate === "denied") return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] p-6 text-center"><div className="max-w-md rounded-3xl border border-[#ead7aa] bg-white p-8"><h1 className="font-display text-3xl text-[#5e3508]">لا تملك صلاحية الإدارة</h1><p className="mt-3 text-sm leading-7 text-[#7e6237]">أنت مسجّل بحساب لا يملك إدارة هذا المتجر. بدّل إلى حساب مالك المشروع، أو استخدم بيانات المدير المحلي بعد إعدادها.</p><Button onClick={async () => { await logout(); startLogin("/admin"); }} className="mt-6 w-full bg-[#b66d08] hover:bg-[#925404]">تبديل الدخول إلى حساب المالك</Button></div></div>;
  // An account claiming the very first admin gets the setup form on its own: it
  // holds no dashboard capability yet, so the sidebar would be a list of links
  // that all refuse to load.
  if (gate === "setup" && !ownerAdmin) return <div dir="rtl" className="min-h-screen bg-[#fffaf0] p-4 sm:p-7">{children}</div>;

  const displayName = ownerAdmin ? (user?.name || "مالك المشروع") : localAdmin?.displayName || localAdmin?.username || "مدير المتجر";
  const displayDetail = ownerAdmin ? (user?.email || "جلسة مالك المشروع") : adminRoleLabel({ ownerAdmin, role: localAdmin?.role });
  const visibleLinks = visibleAdminTabs(capabilities).map(tab => ({
    ...tab,
    href: tab.value === "overview" ? "/admin" : `/admin?tab=${tab.value}`,
    icon: tabIcons[tab.value] ?? BarChart3,
  }));
  return <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#fffaf0]"><aside className="border-b border-[#ead8b2] bg-[#4a2907] p-5 text-[#f9e8c4] lg:fixed lg:inset-y-0 lg:right-0 lg:z-30 lg:w-65 lg:overflow-y-auto lg:border-b-0 lg:border-l"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6cd70] font-display text-xl text-[#4a2907]">م</span><span><b className="block font-display text-lg text-white">ماجد سراج</b><small className="text-[10px] text-[#e9c76f]">لوحة الإدارة</small></span></Link><nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col">{visibleLinks.map(link => { const Icon = link.icon; const active = location === "/admin" && link.href.startsWith("/admin") && (link.href === "/admin" || window.location.search.includes(link.href.split("?")[1] || "")); return <Link key={link.href} href={link.href} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-[#f6cd70] font-bold text-[#4a2907]" : "text-[#f4e1b7] hover:bg-white/10"}`}><Icon size={18} />{link.label}</Link>; })}</nav><div className="mt-7 rounded-2xl bg-white/10 p-3 text-xs leading-6 text-[#ead2a0]"><p className="font-bold text-white">{displayName}</p><p>{displayDetail}</p></div><button onClick={() => ownerAdmin ? logout() : localLogout.mutate()} disabled={localLogout.isPending} className="mt-4 flex items-center gap-2 text-sm text-[#f3d78f] hover:text-white disabled:opacity-60"><LogOut size={16} />تسجيل الخروج</button></aside><main className="min-w-0 p-4 sm:p-7 lg:mr-65">{children}</main></div>;
}
