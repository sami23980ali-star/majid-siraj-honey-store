import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>>, deletes: 0 }));
const fakeDb = vi.hoisted(() => ({
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
  update: vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      calls.updates.push(values);
      return { where: vi.fn().mockResolvedValue([]) };
    }),
  })),
  delete: vi.fn(() => ({ where: vi.fn().mockImplementation(async () => { calls.deletes += 1; return []; }) })),
}));

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => fakeDb) }));

import { updateLocalAdminCredential } from "./db";

describe("إبطال جلسات الحساب المحلي", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
    calls.updates.length = 0;
    calls.deletes = 0;
    vi.clearAllMocks();
  });

  it("يحذف جلسات المستخدم عند تعطيل حسابه", async () => {
    await updateLocalAdminCredential(42, { isActive: false });
    expect(calls.updates).toContainEqual({ isActive: 0 });
    expect(calls.deletes).toBe(1);
  });
});
