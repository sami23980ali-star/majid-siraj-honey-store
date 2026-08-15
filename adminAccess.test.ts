import { describe, expect, it } from "vitest";
import { ADMIN_TABS, adminRoleLabel, resolveAdminCapabilities, resolveAdminGate, resolveAdminTab, visibleAdminTabs } from "./adminAccess";

const owner = resolveAdminCapabilities({ ownerAdmin: false, role: "owner" });
const manager = resolveAdminCapabilities({ ownerAdmin: false, role: "manager" });
const editor = resolveAdminCapabilities({ ownerAdmin: false, role: "editor" });

describe("صلاحيات لوحة الإدارة", () => {
  it("يمنح مالك المشروع كل الصلاحيات", () => {
    expect(resolveAdminCapabilities({ ownerAdmin: true })).toEqual({ content: true, operations: true, users: true });
    // The project owner outranks whatever local role happens to be attached.
    expect(resolveAdminCapabilities({ ownerAdmin: true, role: "editor" }).users).toBe(true);
  });

  it("يفصل أدوار المتجر الثلاثة كما تفصلها إجراءات السيرفر", () => {
    expect(owner).toEqual({ content: true, operations: true, users: true });
    expect(manager).toEqual({ content: true, operations: true, users: false });
    expect(editor).toEqual({ content: true, operations: false, users: false });
  });

  it("يرفض كل شيء لحساب بلا دور", () => {
    expect(resolveAdminCapabilities({ ownerAdmin: false, role: null })).toEqual({ content: false, operations: false, users: false });
  });

  it("لا يعرض للمحرر إلا الأقسام التي يستطيع تحميلها", () => {
    // Regression guard: the sidebar used to offer every tab except "users", so an
    // editor opened overview/orders/settings and hit FORBIDDEN with no feedback.
    expect(visibleAdminTabs(editor).map(tab => tab.value)).toEqual(["products", "reviews"]);
    expect(visibleAdminTabs(manager).map(tab => tab.value)).toEqual(["overview", "products", "orders", "inventory", "reviews", "settings"]);
    expect(visibleAdminTabs(owner).map(tab => tab.value)).toEqual(ADMIN_TABS.map(tab => tab.value));
  });

  it("يصحح التبويب المطلوب من الرابط إلى تبويب مسموح", () => {
    expect(resolveAdminTab("orders", manager)).toBe("orders");
    // An editor typing /admin?tab=orders lands on their first allowed section.
    expect(resolveAdminTab("orders", editor)).toBe("products");
    expect(resolveAdminTab("users", editor)).toBe("products");
    expect(resolveAdminTab(null, manager)).toBe("overview");
    expect(resolveAdminTab("قسم-غير-موجود", owner)).toBe("overview");
  });

  it("يسمي الدور بالعربية", () => {
    expect(adminRoleLabel({ ownerAdmin: true })).toBe("مالك المشروع");
    expect(adminRoleLabel({ ownerAdmin: false, role: "owner" })).toBe("مالك المتجر");
    expect(adminRoleLabel({ ownerAdmin: false, role: "manager" })).toBe("مدير المتجر");
    expect(adminRoleLabel({ ownerAdmin: false, role: "editor" })).toBe("محرر المتجر");
  });
});

describe("بوابة صفحة الإدارة", () => {
  const base = { loading: false, failed: false, signedIn: false, ownerAdmin: false, hasLocalAdmin: false, configured: false, canSetup: false };

  it("ينتظر انتهاء تحميل الحالة قبل أي قرار", () => {
    expect(resolveAdminGate({ ...base, loading: true, ownerAdmin: true })).toBe("loading");
  });

  // Regression guard: when adminAuth.status failed, the shell read the missing
  // data as "not configured" and told the visitor no admin account existed yet.
  it("يعلن تعذر التحقق بدلًا من ادّعاء عدم وجود حساب مدير", () => {
    expect(resolveAdminGate({ ...base, failed: true })).toBe("unavailable");
    expect(resolveAdminGate({ ...base, failed: true, signedIn: true, ownerAdmin: true })).toBe("unavailable");
    // A real local session is not enough to trust a failed status response.
    expect(resolveAdminGate({ ...base, failed: true, configured: true, hasLocalAdmin: true })).toBe("unavailable");
  });

  it("يقدّم التحميل على الفشل حتى لا تظهر رسالة خطأ أثناء المحاولة", () => {
    expect(resolveAdminGate({ ...base, loading: true, failed: true })).toBe("loading");
  });

  it("يفتح الإعداد لمالك المشروع قبل إنشاء الحساب المحلي", () => {
    expect(resolveAdminGate({ ...base, signedIn: true, ownerAdmin: true })).toBe("setup");
  });

  // Regression guard: the shell used to refuse this account with "لا تملك صلاحية
  // الإدارة" while the server was willing to let it create the first admin.
  it("يفتح الإعداد لحساب موثّق تسمح له الخدمة بالمطالبة الأولى", () => {
    expect(resolveAdminGate({ ...base, signedIn: true, canSetup: true })).toBe("setup");
  });

  it("يعرض الدخول المحلي بعد إعداد الحساب لكل من لا يملك جلسة", () => {
    expect(resolveAdminGate({ ...base, configured: true })).toBe("localLogin");
    expect(resolveAdminGate({ ...base, signedIn: true, configured: true })).toBe("localLogin");
  });

  it("يدعو الزائر غير المسجّل إلى دخول مالك المشروع قبل أي إعداد", () => {
    expect(resolveAdminGate(base)).toBe("ownerLogin");
  });

  it("يرفض حسابًا موثّقًا لا يملك المطالبة ولا جلسة إدارة", () => {
    expect(resolveAdminGate({ ...base, signedIn: true })).toBe("denied");
  });

  it("يسلّم اللوحة لصاحب جلسة إدارة قائمة", () => {
    expect(resolveAdminGate({ ...base, configured: true, hasLocalAdmin: true })).toBe("dashboard");
    expect(resolveAdminGate({ ...base, signedIn: true, ownerAdmin: true, configured: true })).toBe("dashboard");
  });
});
