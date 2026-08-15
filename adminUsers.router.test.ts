import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCredential: vi.fn(),
  getCredential: vi.fn(),
  getCredentialById: vi.fn(),
  listCredentials: vi.fn(),
  updateCredential: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createLocalAdminCredential: mocks.createCredential,
    getLocalAdminCredential: mocks.getCredential,
    getLocalAdminCredentialById: mocks.getCredentialById,
    listLocalAdminCredentials: mocks.listCredentials,
    updateLocalAdminCredential: mocks.updateCredential,
    updateLocalAdminPassword: mocks.updatePassword,
  };
});

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(role: "owner" | "manager" | "editor" = "owner") {
  return {
    user: null,
    localAdmin: { credentialId: 1, username: "store.owner", displayName: "مالك المتجر", role, expiresAt: new Date(Date.now() + 60_000) },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

const ownerRecord = {
  id: 1,
  username: "store.owner",
  displayName: "مالك المتجر",
  passwordHash: "hash",
  phone: null,
  role: "owner" as const,
  isActive: 1,
  createdByCredentialId: null,
  failedAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("adminUsers router", () => {
  it("يحصر إدارة المستخدمين في دور المالك", async () => {
    mocks.listCredentials.mockResolvedValue([]);
    await expect(appRouter.createCaller(context("manager")).adminUsers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("owner")).adminUsers.list()).resolves.toEqual([]);
  });

  it("ينشئ مستخدمًا محليًا بدور محدد مع كلمة مرور مجزأة", async () => {
    mocks.getCredential.mockResolvedValue(undefined);
    mocks.createCredential.mockResolvedValue({ ...ownerRecord, id: 2, username: "orders.manager", role: "manager" });
    const result = await appRouter.createCaller(context()).adminUsers.create({ username: "orders.manager", displayName: "مدير الطلبات", password: "Secure-Password-2026!", role: "manager" });
    expect(result.role).toBe("manager");
    expect(mocks.createCredential).toHaveBeenCalledWith(expect.objectContaining({ username: "orders.manager", displayName: "مدير الطلبات", role: "manager", createdByCredentialId: 1, passwordHash: expect.not.stringContaining("Secure-Password-2026!") }));
  });

  it("يحمي آخر حساب مالك من تغيير دوره أو تعطيله", async () => {
    mocks.getCredentialById.mockResolvedValue(ownerRecord);
    mocks.listCredentials.mockResolvedValue([{ ...ownerRecord, isActive: 1 }]);
    const caller = appRouter.createCaller(context());
    await expect(caller.adminUsers.update({ id: 1, role: "editor" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.adminUsers.update({ id: 1, isActive: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.updateCredential).not.toHaveBeenCalled();
  });

  it("يعطّل حسابًا غير مالك عبر طبقة البيانات التي تلغي جلساته", async () => {
    const editor = { ...ownerRecord, id: 3, username: "catalog.editor", role: "editor" as const, isActive: 1 };
    mocks.getCredentialById.mockResolvedValue(editor);
    mocks.updateCredential.mockResolvedValue({ ...editor, isActive: 0 });
    await expect(appRouter.createCaller(context()).adminUsers.update({ id: 3, isActive: false })).resolves.toMatchObject({ id: 3, isActive: 0 });
    expect(mocks.updateCredential).toHaveBeenCalledWith(3, expect.objectContaining({ isActive: false }));
  });

  it("يحدّث دور مستخدم غير مالك بنجاح", async () => {
    const editor = { ...ownerRecord, id: 4, username: "catalog.editor", role: "editor" as const, isActive: 1 };
    mocks.getCredentialById.mockResolvedValue(editor);
    mocks.updateCredential.mockResolvedValue({ ...editor, role: "manager" });
    await expect(appRouter.createCaller(context()).adminUsers.update({ id: 4, role: "manager" })).resolves.toMatchObject({ id: 4, role: "manager" });
    expect(mocks.updateCredential).toHaveBeenCalledWith(4, expect.objectContaining({ role: "manager" }));
  });

  it("يعيد تعيين كلمة المرور ويعتمد إبطال جلسات الحساب داخل طبقة البيانات", async () => {
    mocks.getCredentialById.mockResolvedValue(ownerRecord);
    mocks.updatePassword.mockResolvedValue(undefined);
    await expect(appRouter.createCaller(context()).adminUsers.resetPassword({ id: 1, password: "Replacement-Password-2026!" })).resolves.toEqual({ success: true });
    expect(mocks.updatePassword).toHaveBeenCalledWith(1, expect.not.stringContaining("Replacement-Password-2026!"));
  });
});
