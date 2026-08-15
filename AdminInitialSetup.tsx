import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminInitialSetup({ ownerAdmin = true, requiresSetupToken = false }: { ownerAdmin?: boolean; requiresSetupToken?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const utils = trpc.useUtils();
  const setup = trpc.adminAuth.setup.useMutation({
    onSuccess: async () => {
      setPassword("");
      setSetupToken("");
      await utils.adminAuth.status.invalidate();
      toast.success("تم إعداد حساب المدير المحلي. يمكنك الآن تسجيل الدخول به من أي جهاز معتمد.");
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setup.mutate({
      username,
      password,
      phone: phone.trim(),
      displayName: displayName.trim() || undefined,
      // Sent only when the server said it expects one, so the owner path keeps
      // submitting exactly the fields it always did.
      setupToken: requiresSetupToken ? setupToken.trim() : undefined,
    });
  };

  return <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#ead8b3] bg-white p-6 shadow-[0_20px_50px_rgba(74,41,7,0.08)] sm:p-8">
    <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#4a2907] text-[#f6cd70]"><ShieldCheck size={23} /></span><div><p className="text-xs font-bold text-[#b66d08]">خطوة أمان مطلوبة</p><h1 className="mt-1 font-display text-4xl text-[#5e3508]">إعداد حساب مالك المتجر</h1><p className="mt-3 text-sm leading-7 text-[#806743]">{ownerAdmin ? "أنت مسجل حاليًا بحساب مالك المشروع. أنشئ اسم مستخدم وكلمة مرور ورقم هاتف مستقلين للوصول إلى لوحة الإدارة لاحقًا." : "لا يوجد حساب مدير محلي بعد، ولم يُهيَّأ معرّف مالك المشروع. أكمِل الإعداد برمز الإعداد الذي عيّنته في المتغيّر ADMIN_SETUP_TOKEN؛ وبعد الإنشاء يُقفل هذا المسار ولا يُفتح لحساب آخر."}</p></div></div>
    <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
      <label className="space-y-2"><Label htmlFor="setup-username" className="text-xs font-bold text-[#6c4a1d]">اسم المستخدم</Label><div className="relative"><UserRound className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="setup-username" value={username} onChange={event => setUsername(event.target.value)} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="مثال: majid.admin" required /></div></label>
      <label className="space-y-2"><Label htmlFor="setup-password" className="text-xs font-bold text-[#6c4a1d]">كلمة المرور</Label><div className="relative"><KeyRound className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="setup-password" type="password" minLength={10} value={password} onChange={event => setPassword(event.target.value)} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="عشرة أحرف على الأقل" required /></div></label>
      <label className="space-y-2"><Label htmlFor="setup-phone" className="text-xs font-bold text-[#6c4a1d]">رقم هاتف المالك</Label><div className="relative"><Phone className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="setup-phone" inputMode="tel" autoComplete="tel" minLength={7} maxLength={48} value={phone} onChange={event => setPhone(event.target.value)} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="مثال: 967773207714" required /></div><p className="text-[11px] leading-5 text-[#806743]">مطلوب لتوثيق هوية المالك واستعادة الحساب.</p></label>
      <label className="space-y-2"><Label htmlFor="setup-display-name" className="text-xs font-bold text-[#6c4a1d]">الاسم الظاهر (اختياري)</Label><div className="relative"><UserRound className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="setup-display-name" minLength={2} maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="مثال: ماجد سراج" /></div></label>
      {requiresSetupToken ? <label className="space-y-2 sm:col-span-2"><Label htmlFor="setup-token" className="text-xs font-bold text-[#6c4a1d]">رمز الإعداد</Label><div className="relative"><ShieldCheck className="absolute right-3 top-3 text-[#a76008]" size={17} /><Input id="setup-token" type="password" autoComplete="one-time-code" maxLength={200} value={setupToken} onChange={event => setSetupToken(event.target.value)} className="h-11 border-[#ead8b3] pr-10 text-right" placeholder="الرمز المعيّن في ADMIN_SETUP_TOKEN" required /></div><p className="text-[11px] leading-5 text-[#806743]">يُطلب لأنك لست حساب مالك المشروع المهيّأ. يُستخدم مرة واحدة، ويُستحسن حذف المتغيّر بعد إنشاء الحساب.</p></label> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={setup.isPending} className="h-11 bg-[#a76008] px-6 text-white hover:bg-[#864806]">{setup.isPending ? <><Loader2 className="ml-2 animate-spin" size={16} />جارٍ إنشاء الحساب…</> : "إنشاء حساب المالك"}</Button><p className="mt-3 text-[11px] leading-5 text-[#806743]">تُخزَّن كلمة المرور بصورة مشفّرة، ويُقفل الدخول عشر دقائق بعد خمس محاولات خاطئة.</p></div>
    </form>
  </section>;
}
