/**
 * SQLite mirror of drizzle/schema.ts, used only by the local development
 * database (DB_DIALECT=sqlite). Production runs MySQL and keeps schema.ts as the
 * single source of truth for migrations — nothing here is ever deployed.
 *
 * Rules for keeping the two honest:
 *   - Physical column names must match schema.ts exactly (including the enum
 *     columns named `orderChannel` and `adminCredentialRole`), so queries behave
 *     the same whichever dialect is active.
 *   - The inferred TypeScript shape must match too: Date for timestamps, number
 *     for the 0/1 boolean flags, the same string unions for enums. server/db.ts
 *     is typed against the MySQL schema, so a divergence here surfaces as a
 *     runtime surprise rather than a compile error.
 *   - Any column added to schema.ts must be added here in the same change. The
 *     DDL is generated from these definitions (see server/devSqliteSchema.ts),
 *     so there is no third place to update.
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** MySQL `timestamp().defaultNow()`; the default is applied by drizzle, not the DB. */
const createdAt = () => integer("createdAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

/** MySQL `timestamp().defaultNow().onUpdateNow()`. */
const updatedAt = () =>
  integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortDescription: text("shortDescription").notNull(),
  description: text("description").notNull(),
  origin: text("origin").notNull().default("عسل بلدي"),
  category: text("category").notNull().default("عسل بلدي"),
  priceOptions: text("priceOptions").notNull(),
  primaryImage: text("primaryImage").notNull(),
  galleryImages: text("galleryImages").notNull(),
  galleryVideos: text("galleryVideos").notNull(),
  inventoryCount: integer("inventoryCount").notNull().default(20),
  lowStockThreshold: integer("lowStockThreshold").notNull().default(5),
  isFeatured: integer("isFeatured").notNull().default(0),
  isActive: integer("isActive").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
