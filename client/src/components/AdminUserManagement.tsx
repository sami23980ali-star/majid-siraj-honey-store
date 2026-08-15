import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Role = "owner" | "manager" | "editor";
const roleLabels: Record<Role, string> = { owner: "مالك", manager: "مدير", editor: "محرر" };

export default function AdminUserManagement() {
  const utils = trpc.useUtils();
  const { data: users, isLoading, error } = trpc.adminUsers.list.useQuery();
  const [form, setForm] = useState({ username: "", displayName: "", password: "", phone: "", role: "editor" as Role });
  const [passwordTarget, setPasswordTarget] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const invalidate = () => utils.adminUsers.list.invalidate();
  const create = trpc.adminUsers.create.useMutation({
    onSuccess: async () => {
      setForm({ username: "", displayName: "", password: "", phone: "", role: "editor" });
      await invalidate();
      toast.success("تم إنشاء المستخدم بنجاح");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.adminUsers.update.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const resetPassword = trpc.adminUsers.resetPassword.useMutation({
    onSuccess: async () => {
      setPasswordTarget(null);
      setNewPassword("");
      toast.success("تم تغيير كلمة المرور وإلغاء الجلسات السابقة");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (error) return <section className="mt-7 rounded-3xl border border-[#efd0c4] bg-[#fff8f3] p-6 text-center"><ShieldCheck className="mx-auto text-[#a83a23]" /><h2 className="mt-3 font-display text-3xl text-[#7b2c1e]">إدارة المستخدمين للمالك فقط</h2><p className="mt-2 text-sm text-[#8c4a35]">لا تملك صلاحية إنشاء الحسابات أو تعديل أدوارها.</p></section>;

  return <section className="mt-7 space-y-5">
    <div className="rounded-3xl border border-[#ead8b3] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Users className="text-[#a45c08]" size={22} /><h2 className="font-display text-3xl text-[#5e3508]">المستخدمون والصلاحيات</h2></div><p className="mt-2 max-w-2xl text-xs leading-6 text-[#806743]">المالك يدير الحسابات والصلاحيات. المدير يدير المنتجات والطلبات والمخزون، والمحرر يدير المنتجات والمراجعات فقط.</p></div><span className="rounded-full bg-[#f7ead3] px-3 py-1 text-xs font-bold text-[#80521a]">{users?.length ?? 0} مستخدمين</span></div>
      <form onSubmit={event => { event.preventDefault(); create.mutate({ ...form, phone: form.phone || undefined }); }} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1"><Label className="text-xs">الاسم الظاهر</Label><Input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="مثال: مدير الطلبات" required /></label>
        <label className="space-y-1"><Label className="text-xs">اسم المستخدم</Label><Input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} placeholder="orders.manager" required /></label>
        <label className="space-y-1"><Label className="text-xs">كلمة المرور</Label><Input type="password" minLength={10} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="10 أحرف على الأقل" required /></label>
        <label className="space-y-1"><Label className="text-xs">الدور</Label><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as Role })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="editor">محرر</option><option value="manager">مدير</option><option value="owner">مالك</option></select></label>
        <Button type="submit" disabled={create.isPending} className="self-end bg-[#a76008] text-white hover:bg-[#864806]">{create.isPending ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}<span className="mr-2">إضافة مستخدم</span></Button>
      </form>
    </div>

    <div className="overflow-hidden rounded-3xl border border-[#ead8b3] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-190 text-right text-xs"><thead className="bg-[#f9edda] text-[#6c4a1d]"><tr><th className="p-4">المستخدم</th><th className="p-4">اسم الدخول</th><th className="p-4">الدور</th><th className="p-4">الحالة</th><th className="p-4">أدوات الأمان</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="p-8 text-center text-[#806743]">جارٍ تحميل الحسابات…</td></tr> : users?.map(user => <tr key={user.id} className="border-t border-[#f1e5cf]"><td className="p-4"><b className="text-[#5e3508]">{user.displayName}</b>{user.phone && <p className="mt-1 text-[11px] text-[#806743]">{user.phone}</p>}</td><td className="p-4 font-mono text-[#80521a]">{user.username}</td><td className="p-4"><select value={user.role} onChange={event => update.mutate({ id: user.id, role: event.target.value as Role })} disabled={update.isPending} className="rounded-lg border border-[#ead8b3] bg-[#fffdf8] px-2 py-1.5 text-xs"><option value="owner">مالك</option><option value="manager">مدير</option><option value="editor">محرر</option></select><span className="mr-2 text-[11px] text-[#806743]">{roleLabels[user.role]}</span></td><td className="p-4"><button onClick={() => update.mutate({ id: user.id, isActive: !Boolean(user.isActive) })} disabled={update.isPending} className={`rounded-full px-3 py-1.5 font-bold ${user.isActive ? "bg-[#e4f3df] text-[#34622e]" : "bg-[#f8dfd9] text-[#9b3e2d]"}`}>{user.isActive ? "نشط" : "موقوف"}</button></td><td className="p-4"><Button type="button" size="sm" variant="outline" onClick={() => setPasswordTarget(user.id)} className="border-[#d9b56e] text-[#80500a]"><KeyRound size={14} /><span className="mr-1">تغيير كلمة المرور</span></Button></td></tr>)}</tbody></table></div></div>

    {passwordTarget && <div className="rounded-3xl border border-[#d9b56e] bg-[#fffaf0] p-5"><div className="flex flex-wrap items-center gap-3"><UserCog className="text-[#a76008]" /><div className="grow"><p className="font-bold text-[#5e3508]">تعيين كلمة مرور جديدة</p><p className="mt-1 text-xs text-[#806743]">سيتم تسجيل خروج المستخدم من أجهزته الحالية للحفاظ على الأمان.</p></div><Input type="password" minLength={10} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="max-w-xs" placeholder="10 أحرف على الأقل" /><Button onClick={() => resetPassword.mutate({ id: passwordTarget, password: newPassword })} disabled={newPassword.length < 10 || resetPassword.isPending} className="bg-[#5e3508] text-[#f6cd70]">حفظ كلمة المرور</Button><Button type="button" variant="ghost" onClick={() => { setPasswordTarget(null); setNewPassword(""); }}>إلغاء</Button></div></div>}
  </section>;
}
