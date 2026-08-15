import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { adminCredentials, adminLoginAttempts, adminSessions, orders, productReviews, products, storeSettings, users } from "../drizzle/schema";

const TABLES: Table[] = [users, products, orders, productReviews, adminCredentials, adminLoginAttempts, adminSessions, storeSettings];

/**
 * حارس مخطط لا يحتاج قاعدة بيانات: عمود `TIMESTAMP` بلا قيمة افتراضية صريحة
 * يأخذ من MySQL — عندما يكون `explicit_defaults_for_timestamp` مطفأً، وهو
 * الافتراضي في MariaDB/XAMPP — القيد الضمني
 * `NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
 *
 * أوقعنا هذا في `adminCredentials.lockedUntil`: كل حساب مدير كان يُنشأ مقفلًا،
 * وكل تحديث للصف يعيد ختم القفل، ومسحه بـ null مستحيل لأن العمود صار NOT NULL.
 * وفي `adminSessions.expiresAt` كان أي تحديث للصف يمدّ عمر الجلسة. الأعمدة التي
 * يكتب فيها التطبيق وقتًا من عنده يجب أن تكون `datetime`.
 */
describe("حراسة أنواع أعمدة الوقت في المخطط", () => {
  it("لا يوجد عمود timestamp بلا قيمة افتراضية صريحة", () => {
    const offenders: string[] = [];
    for (const table of TABLES) {
      for (const [name, column] of Object.entries(getTableColumns(table))) {
        if (column.getSQLType() === "timestamp" && !column.hasDefault) {
          offenders.push(`${getTableName(table)}.${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("يحفظ نوع datetime لعمودي القفل وانتهاء الجلسة", () => {
    expect(getTableColumns(adminCredentials).lockedUntil.getSQLType()).toBe("datetime");
    expect(getTableColumns(adminSessions).expiresAt.getSQLType()).toBe("datetime");
  });
});
