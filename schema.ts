import { datetime, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  shortDescription: text("shortDescription").notNull(),
  description: text("description").notNull(),
  origin: varchar("origin", { length: 120 }).notNull().default("عسل بلدي"),
  category: varchar("category", { length: 120 }).notNull().default("عسل بلدي"),
  priceOptions: text("priceOptions").notNull(),
  primaryImage: text("primaryImage").notNull(),
  galleryImages: text("galleryImages").notNull(),
  galleryVideos: text("galleryVideos").notNull(),
  inventoryCount: int("inventoryCount").notNull().default(20),
  lowStockThreshold: int("lowStockThreshold").notNull().default(5),
  isFeatured: int("isFeatured").notNull().default(0),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 48 }).notNull(),
  city: varchar("city", { length: 120 }),
  address: text("address"),
  notes: text("notes"),
  itemsJson: text("itemsJson").notNull(),
  total: int("total").notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("ر.ي"),
  // awaiting_payment: an online checkout was opened but payment is unconfirmed,
  // so the order is visible to the admin without counting as a sale.
  // cancelled: withdrawn; any stock this order held is released back.
  status: mysqlEnum("status", ["awaiting_payment", "new", "preparing", "completed", "cancelled"]).notNull().default("new"),
  /** Which surface produced the order, so the dashboard can tell them apart. */
  channel: mysqlEnum("orderChannel", ["whatsapp", "online"]).notNull().default("whatsapp"),
  /**
   * Whether this order currently holds stock. Tracked explicitly because stock
   * is deducted at different moments per channel (WhatsApp at creation, online
   * only once the admin confirms payment), and cancelling must return exactly
   * what was taken — never guess from the status alone.
   */
  stockDeducted: int("stockDeducted").notNull().default(0),
  /** Opaque provider reference (Shopify cart id) for reconciliation. */
  checkoutReference: varchar("checkoutReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productReviews = mysqlTable("productReviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  orderId: int("orderId").notNull(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 48 }).notNull(),
  rating: int("rating").notNull(),
  comment: text("comment").notNull(),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const storeSettings = mysqlTable("storeSettings", {
  id: int("id").autoincrement().primaryKey(),
  whatsappNumber: varchar("whatsappNumber", { length: 32 }).notNull(),
  supportPhone: varchar("supportPhone", { length: 32 }).notNull(),
  secondaryPhone: varchar("secondaryPhone", { length: 32 }),
  locationText: varchar("locationText", { length: 180 }).notNull().default("اليمن"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adminCredentials = mysqlTable("adminCredentials", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 120 }).notNull().default("مستخدم الإدارة"),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 48 }),
  role: mysqlEnum("adminCredentialRole", ["owner", "manager", "editor"]).notNull().default("owner"),
  isActive: int("isActive").notNull().default(1),
  createdByCredentialId: int("createdByCredentialId"),
  failedAttempts: int("failedAttempts").notNull().default(0),
  // datetime لا timestamp: أول عمود TIMESTAMP في جدول MySQL يأخذ ضمنًا
  // `NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` عندما يكون
  // explicit_defaults_for_timestamp مطفأً (الافتراضي في MySQL 5.x و MariaDB).
  // فكان الحساب الجديد يولد وهو «مقفل»، وكل تحديث للصف يعيد ختم القفل، ومحاولة
  // مسحه بـ null تفشل لأن العمود NOT NULL. أما DATETIME فلا يأخذ شيئًا ضمنًا.
  lockedUntil: datetime("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adminLoginAttempts = mysqlTable("adminLoginAttempts", {
  id: int("id").autoincrement().primaryKey(),
  adminCredentialId: int("adminCredentialId"),
  username: varchar("username", { length: 64 }).notNull(),
  success: int("success").notNull().default(0),
  ipAddress: varchar("ipAddress", { length: 64 }),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
});

export const adminSessions = mysqlTable("adminSessions", {
  id: int("id").autoincrement().primaryKey(),
  adminCredentialId: int("adminCredentialId").notNull(),
  sessionTokenHash: varchar("sessionTokenHash", { length: 128 }).notNull().unique(),
  // datetime لنفس سبب lockedUntil: كعمود TIMESTAMP أول في الجدول كان يأخذ ضمنًا
  // `ON UPDATE CURRENT_TIMESTAMP`، فأي تحديث للصف يمدّ عمر الجلسة من تلقاء نفسه.
  expiresAt: datetime("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type AdminCredential = typeof adminCredentials.$inferSelect;
