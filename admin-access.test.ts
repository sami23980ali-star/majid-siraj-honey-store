import { describe, expect, it, vi } from "vitest";

// A concrete owner id, because the guards must reject the empty string. Reading
// ENV.ownerOpenId straight from the environment used to make this suite pass for
// the wrong reason: with OWNER_OPEN_ID unset, `user.openId === ENV.ownerOpenId`
// compared "" to "" and granted admin to any identity with a blank openId.
// vi.hoisted, because vi.mock factories are lifted above module-level consts.
const { OWNER_OPEN_ID } = vi.hoisted(() => ({ OWNER_OPEN_ID: "owner-open-id-fixture" }));

vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ENV: { ...actual.ENV, ownerOpenId: OWNER_OPEN_ID } };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { adminProcedure, managerProcedure, ownerProcedure, router } from "./_core/trpc";

const localAdminTestRouter = router({
  guarded: adminProcedure.query(() => "ok"),
  manager: managerProcedure.query(() => "manager-ok"),
  owner: ownerProcedure.query(() => "owner-ok"),
});

describe("حماية الإدارة", () => {
  it("يرفض الوصول إلى إحصاءات الإدارة عند عدم تسجيل الدخول", async () => {
    const ctx = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;

    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("يقبل هوية مالك المشروع الموثقة حتى إذا كان الدور القديم user", async () => {
    const ctx = {
      user: { openId: OWNER_OPEN_ID, role: "user" } as TrpcContext["user"],
      localAdmin: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const caller = localAdminTestRouter.createCaller(ctx);
    await expect(caller.guarded()).resolves.toBe("ok");
    await expect(caller.manager()).resolves.toBe("manager-ok");
    await expect(caller.owner()).resolves.toBe("owner-ok");
  });

  it("يرفض هوية بمعرّف فارغ ولا يعاملها كمالك المشروع", async () => {
    const ctx = {
      user: { openId: "", role: "user" } as TrpcContext["user"],
      localAdmin: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const caller = localAdminTestRouter.createCaller(ctx);
    await expect(caller.guarded()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.manager()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.owner()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يقبل جلسة المدير المحلية للوصول إلى إجراءات الإدارة", async () => {
    const ctx = {
      user: null,
      localAdmin: { credentialId: 1, username: "majid.admin", displayName: "ماجد المدير", role: "owner", expiresAt: new Date(Date.now() + 60_000) },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;

    const caller = localAdminTestRouter.createCaller(ctx);
    await expect(caller.guarded()).resolves.toBe("ok");
  });

  it("يسمح للمدير بعمليات التشغيل ويرفض عمليات مالك المتجر", async () => {
    const ctx = {
      user: null,
      localAdmin: { credentialId: 2, username: "operations.manager", displayName: "مدير العمليات", role: "manager" as const, expiresAt: new Date(Date.now() + 60_000) },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const caller = localAdminTestRouter.createCaller(ctx);
    await expect(caller.manager()).resolves.toBe("manager-ok");
    await expect(caller.owner()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنع المحرر من عمليات المدير مع السماح بعمليات المحتوى العامة", async () => {
    const ctx = {
      user: null,
      localAdmin: { credentialId: 3, username: "catalog.editor", displayName: "محرر المحتوى", role: "editor" as const, expiresAt: new Date(Date.now() + 60_000) },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const caller = localAdminTestRouter.createCaller(ctx);
    await expect(caller.guarded()).resolves.toBe("ok");
    await expect(caller.manager()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
