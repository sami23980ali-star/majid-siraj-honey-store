import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

export default function AdminLocalLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const utils = trpc.useUtils();
  const remainingSeconds = useMemo(() => lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0, [lockedUntil, now]);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil && remainingSeconds === 0) setLockedUntil(null);
  }, [lockedUntil, remainingSeconds]);

  const login = trpc.adminAuth.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.adminAuth.status.invalidate();
      toast.success("تم تسجيل دخول المدير المحلي بنجاح");
    },
    onError: error => {
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        const minutes = Number(error.message.match(/(\d+)/)?.[1] || "10");
        setNow(Date.now());
        setLockedUntil(Date.now() + minutes * 60_000);
      }
      toast.error(error.message);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (remainingSeconds > 0) return;
    login.mutate({ username, password });
  };

  return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] p-5 text-right">
    <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[#ead7aa] bg-white shadow-[0_24px_70px_rgba(74,41,7,0.14)]">
      <div className="bg-[#4a2907] px-7 py-8 text-center text-[#f9e8c4]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6cd70] text-[#4a2907]"><ShieldCheck size={28} /></span>
        <p className="mt-4 text-xs font-bold tracking-wide text-[#e9c76f]">وصول خاص ومشفّر</p>
        <h1 className="mt-2 font-display text-3xl text-white">دخول إدارة ماجد سراج</h1>
        <p className="mt-2 text-xs leading-6 text-[#f3dfb4]">استخدم بيانات المدير المحلي المعتمدة للمتجر.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-6 sm:p-7">
        <div className="space-y-2">
          <Label htmlFor="admin-username" className="text-xs font-bold text-[#6c4a1d]">اسم المستخدم</Label>
          <div className="relative"><UserRound className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="admin-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} disabled={login.isPending || remainingSeconds > 0} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="اسم مستخدم الإدارة" required /></div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-xs font-bold text-[#6c4a1d]">كلمة المرور</Label>
          <div className="relative"><KeyRound className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={login.isPending || remainingSeconds > 0} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="كلمة المرور" required /></div>
        </div>
        {remainingSeconds > 0 && <div className="rounded-2xl border border-[#efc8bb] bg-[#fff1ec] p-3 text-center"><LockKeyhole className="mx-auto text-[#a83a23]" size={18} /><p className="mt-1 text-xs font-bold text-[#963b28]">الدخول مقفل مؤقتًا</p><p className="mt-1 font-mono text-lg font-bold text-[#7b2c1e]" dir="ltr">{formatRemaining(remainingSeconds)}</p></div>}
        <Button type="submit" disabled={login.isPending || remainingSeconds > 0} className="h-11 w-full bg-[#a76008] text-white hover:bg-[#864806]">
          {login.isPending ? <><Loader2 className="ml-2 animate-spin" size={16} />جارٍ التحقق…</> : "تسجيل الدخول"}
        </Button>
        <Button type="button" variant="outline" onClick={() => startLogin("/admin")} className="h-11 w-full border-[#d9b56e] text-[#80500a] hover:bg-[#fff6e3]">
          دخول بحساب مالك المشروع
        </Button>
        <p className="text-center text-[11px] leading-5 text-[#806743]">بعد خمس محاولات غير صحيحة يُقفل الدخول لمدة عشر دقائق لحماية لوحة المتجر.</p>
      </form>
    </section>
  </div>;
}
