import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import type { HoneyOption, HoneyProduct, StoredOrderLine } from "@shared/store";
import { adminCredentials, adminLoginAttempts, adminSessions, orders, productReviews, products, storeSettings, type AdminCredential, type InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DatabaseUnavailableError } from "./_core/errors";
import { storagePut } from "./storage";
import { buildOrderLines, formatWhatsAppMessage, generateProductSlug, normalizeWhatsAppNumber } from "./storeLogic";
import { countsTowardSales, resolveStockAction, type OrderStatus } from "./orderStock";
import { parseProductMediaDataUrl } from "./mediaUpload";
import { normalizeReviewPhone, orderIncludesProduct } from "./reviewLogic";
import { aggregateRequestedQuantities } from "./inventoryLogic";

const BRAND_IMAGE = "/manus-storage/majid-siraj-honey-identity_885d8b5c.png";
const DEFAULT_CURRENCY = "ر.ي";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Drizzle يقرأ ويكتب أعمدة الوقت كنص UTC بلا منطقة زمنية (`value + "+0000"`)،
 * فهو يفترض أن جلسة MySQL على UTC. جلسة XAMPP/MariaDB الافتراضية على توقيت
 * النظام (+03 هنا)، فكانت القيم التي يولّدها MySQL نفسه — CURRENT_TIMESTAMP في
 * createdAt/updatedAt وأي قفل — تُقرأ بفارق ثلاث ساعات في المستقبل. تثبيت
 * time_zone على UTC لكل اتصال يجعل الطرفين يتحدثان اللغة نفسها.
 */
function createUtcPool(url: string) {
  const pool = createPool({ uri: url, timezone: "Z" });
  pool.on("connection", connection => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(createUtcPool(process.env.DATABASE_URL));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function hasLocalAdminCredential() {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const rows = await db.select({ id: adminCredentials.id }).from(adminCredentials).limit(1);
  return rows.length > 0;
}

export type LocalAdminRole = "owner" | "manager" | "editor";

export async function createLocalAdminCredential(input: { username: string; passwordHash: string; phone?: string; displayName?: string; role?: LocalAdminRole; createdByCredentialId?: number | null }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.insert(adminCredentials).values({
    username: input.username,
    passwordHash: input.passwordHash,
    phone: input.phone ?? null,
    displayName: input.displayName?.trim() || input.username,
    role: input.role ?? "owner",
    createdByCredentialId: input.createdByCredentialId ?? null,
  });
  const rows = await db.select().from(adminCredentials).where(eq(adminCredentials.username, input.username)).limit(1);
  return rows[0]!;
}

export async function getLocalAdminCredential(username: string) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const rows = await db.select().from(adminCredentials).where(eq(adminCredentials.username, username)).limit(1);
  return rows[0];
}

export async function getLocalAdminCredentialById(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const rows = await db.select().from(adminCredentials).where(eq(adminCredentials.id, id)).limit(1);
  return rows[0];
}

export async function listLocalAdminCredentials() {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  return db.select({
    id: adminCredentials.id,
    username: adminCredentials.username,
    displayName: adminCredentials.displayName,
    phone: adminCredentials.phone,
    role: adminCredentials.role,
    isActive: adminCredentials.isActive,
    createdByCredentialId: adminCredentials.createdByCredentialId,
    createdAt: adminCredentials.createdAt,
    updatedAt: adminCredentials.updatedAt,
  }).from(adminCredentials).orderBy(desc(adminCredentials.createdAt));
}

export async function updateLocalAdminCredential(id: number, input: { displayName?: string; phone?: string | null; role?: LocalAdminRole; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const values: Record<string, unknown> = {};
  if (input.displayName !== undefined) values.displayName = input.displayName.trim();
  if (input.phone !== undefined) values.phone = input.phone;
  if (input.role !== undefined) values.role = input.role;
  if (input.isActive !== undefined) values.isActive = input.isActive ? 1 : 0;
  if (Object.keys(values).length) await db.update(adminCredentials).set(values).where(eq(adminCredentials.id, id));
  if (input.isActive === false) await db.delete(adminSessions).where(eq(adminSessions.adminCredentialId, id));
  return getLocalAdminCredentialById(id);
}

export async function updateLocalAdminPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(adminCredentials).set({ passwordHash, failedAttempts: 0, lockedUntil: null }).where(eq(adminCredentials.id, id));
  await db.delete(adminSessions).where(eq(adminSessions.adminCredentialId, id));
}

export async function registerLocalAdminLoginAttempt(input: { credentialId?: number; username: string; success: boolean; ipAddress?: string }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.insert(adminLoginAttempts).values({
    adminCredentialId: input.credentialId ?? null,
    username: input.username,
    success: input.success ? 1 : 0,
    ipAddress: input.ipAddress ?? null,
  });
}

export async function registerLocalAdminFailure(credential: AdminCredential, lockedUntil: Date | null) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(adminCredentials).set({
    failedAttempts: lockedUntil ? 0 : credential.failedAttempts + 1,
    lockedUntil,
  }).where(eq(adminCredentials.id, credential.id));
}

export async function resetLocalAdminLoginState(credentialId: number) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(adminCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(adminCredentials.id, credentialId));
}

export async function createLocalAdminSession(input: { credentialId: number; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.delete(adminSessions).where(eq(adminSessions.adminCredentialId, input.credentialId));
  await db.insert(adminSessions).values({
    adminCredentialId: input.credentialId,
    sessionTokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
  });
}

export async function getLocalAdminSessionByTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    sessionId: adminSessions.id,
    credentialId: adminCredentials.id,
    username: adminCredentials.username,
    displayName: adminCredentials.displayName,
    role: adminCredentials.role,
    isActive: adminCredentials.isActive,
    expiresAt: adminSessions.expiresAt,
  }).from(adminSessions).innerJoin(adminCredentials, eq(adminSessions.adminCredentialId, adminCredentials.id)).where(eq(adminSessions.sessionTokenHash, tokenHash)).limit(1);
  const session = rows[0];
  if (!session) return undefined;
  if (session.expiresAt.getTime() <= Date.now() || !session.isActive) {
    await db.delete(adminSessions).where(eq(adminSessions.id, session.sessionId));
    return undefined;
  }
  return { credentialId: session.credentialId, username: session.username, displayName: session.displayName, role: session.role, expiresAt: session.expiresAt };
}

export async function deleteLocalAdminSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adminSessions).where(eq(adminSessions.sessionTokenHash, tokenHash));
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serializeProduct(row: typeof products.$inferSelect): HoneyProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    origin: row.origin,
    category: row.category,
    priceOptions: safeJson<HoneyOption[]>(row.priceOptions, []),
    primaryImage: row.primaryImage,
    galleryImages: safeJson<string[]>(row.galleryImages, [row.primaryImage]),
    galleryVideos: safeJson<string[]>(row.galleryVideos, []),
    inventoryCount: row.inventoryCount,
    lowStockThreshold: row.lowStockThreshold,
    isFeatured: Boolean(row.isFeatured),
    isActive: Boolean(row.isActive),
  };
}

const starterProducts = [
  {
    name: "عسل السدر الجبلي",
    shortDescription: "مذاق غني ولون ذهبي عميق، مختار لعشّاق العسل البلدي الفاخر.",
    description: "عسل سدر جبلي بملمس كثيف ونكهة دافئة. اختر الوزن المناسب لك أو أضفه إلى طلب الجملة من خلال واتساب.",
    origin: "مختارات ماجد سراج",
    category: "عسل سدر",
    priceOptions: [{ label: "250 جم", price: 12000 }, { label: "500 جم", price: 23000 }, { label: "1 كجم", price: 44000 }],
    image: "/manus-storage/majid-siraj-sidr-honey_8cbc5572.jpg",
  },
  {
    name: "عسل السَّمُر البلدي",
    shortDescription: "نكهة متوازنة ولون كهرماني أصيل للاستخدام اليومي والضيافة.",
    description: "عسل السمر البلدي من الخيارات المحببة على موائد الضيافة. تتوفر أحجام متعددة تتيح لك اختيار الكمية المناسبة.",
    origin: "مختارات ماجد سراج",
    category: "عسل بلدي",
    priceOptions: [{ label: "250 جم", price: 9000 }, { label: "500 جم", price: 17000 }, { label: "1 كجم", price: 32000 }],
    image: "/manus-storage/majid-siraj-samur-honey_b617e7e6.jpg",
  },
  {
    name: "عسل الزهور الموسمية",
    shortDescription: "عسل ذهبي بنكهة لطيفة مستوحاة من تنوع المراعي والزهور.",
    description: "اختيار ناعم القوام ومناسب للتقديم اليومي. يمكنك إضافة ملاحظتك الخاصة للطلب عند الإرسال عبر واتساب.",
    origin: "مختارات ماجد سراج",
    category: "عسل زهور",
    priceOptions: [{ label: "250 جم", price: 7000 }, { label: "500 جم", price: 13000 }, { label: "1 كجم", price: 25000 }],
    image: "/manus-storage/majid-siraj-flower-honey_c3eca10c.jpg",
  },
];

async function ensureCatalog() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    await db.insert(products).values(
      starterProducts.map(({ image, priceOptions, ...product }, index) => ({
        ...product,
        slug: generateProductSlug(product.name),
        priceOptions: JSON.stringify(priceOptions),
        primaryImage: image,
        galleryImages: JSON.stringify([image]),
        galleryVideos: "[]",
        isFeatured: index < 3 ? 1 : 0,
        isActive: 1,
      })),
    );
  }
  return db;
}

export async function listPublicProducts() {
  const db = await ensureCatalog();
  if (!db) return [];
  const rows = await db.select().from(products).where(eq(products.isActive, 1)).orderBy(desc(products.id));
  return rows.map(serializeProduct);
}

export async function listAllProducts() {
  const db = await ensureCatalog();
  if (!db) return [];
  const rows = await db.select().from(products).orderBy(desc(products.id));
  return rows.map(serializeProduct);
}

export async function getPublicProduct(slug: string) {
  const db = await ensureCatalog();
  if (!db) return undefined;
  const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  const row = rows[0];
  return row && row.isActive ? serializeProduct(row) : undefined;
}

export async function getStoreSettings() {
  const db = await getDb();
  if (!db) return { whatsappNumber: "967773207714", supportPhone: "773207714", secondaryPhone: "713861074", locationText: "اليمن" };
  const rows = await db.select().from(storeSettings).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(storeSettings).values({
    whatsappNumber: "967773207714",
    supportPhone: "773207714",
    secondaryPhone: "713861074",
    locationText: "اليمن",
  });
  const created = await db.select().from(storeSettings).limit(1);
  return created[0]!;
}

export async function updateStoreSettings(values: { whatsappNumber: string; supportPhone: string; secondaryPhone?: string; locationText: string }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const current = await getStoreSettings();
  if ("id" in current) {
    await db.update(storeSettings).set(values).where(eq(storeSettings.id, current.id));
  }
  return getStoreSettings();
}

export async function createProduct(input: Omit<HoneyProduct, "id" | "slug">) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const slug = generateProductSlug(input.name);
  await db.insert(products).values({
    ...input,
    slug,
    priceOptions: JSON.stringify(input.priceOptions),
    galleryImages: JSON.stringify(input.galleryImages.length ? input.galleryImages : [input.primaryImage]),
    galleryVideos: JSON.stringify(input.galleryVideos),
    isFeatured: input.isFeatured ? 1 : 0,
    isActive: input.isActive ? 1 : 0,
  });
  const created = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return serializeProduct(created[0]!);
}

export async function updateProduct(id: number, input: Omit<HoneyProduct, "id" | "slug">) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(products).set({
    ...input,
    priceOptions: JSON.stringify(input.priceOptions),
    galleryImages: JSON.stringify(input.galleryImages.length ? input.galleryImages : [input.primaryImage]),
    galleryVideos: JSON.stringify(input.galleryVideos),
    isFeatured: input.isFeatured ? 1 : 0,
    isActive: input.isActive ? 1 : 0,
  }).where(eq(products.id, id));
  const updated = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return serializeProduct(updated[0]!);
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.delete(products).where(eq(products.id, id));
  return { success: true };
}

export async function uploadProductImage(input: { dataUrl: string; fileName: string }) {
  const { mimeType, buffer, extension } = parseProductMediaDataUrl(input.dataUrl, "image");
  const imageExtension = mimeType === "image/jpeg" ? "jpg" : extension;
  const cleanName = input.fileName.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "product";
  const stored = await storagePut(`products/${Date.now()}-${cleanName}.${imageExtension}`, buffer, mimeType);
  return { url: stored.url };
}

export async function uploadProductVideo(input: { dataUrl: string; fileName: string }) {
  const { mimeType, buffer, extension } = parseProductMediaDataUrl(input.dataUrl, "video");
  const cleanName = input.fileName.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "product-video";
  const stored = await storagePut(`products/videos/${Date.now()}-${cleanName}.${extension}`, buffer, mimeType);
  return { url: stored.url };
}

function generateOrderNumber() {
  return `MS-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 90 + 10)}`;
}

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Conditional decrement: the `gte` in the WHERE clause is what prevents two
 * concurrent orders from overselling the last jar. A zero-row update means the
 * stock moved between the availability check and this write.
 */
async function deductStock(tx: Transaction, requested: Map<number, number>) {
  const entries = Array.from(requested.entries());
  for (const [productId, quantity] of entries) {
    const updated = await tx.update(products).set({ inventoryCount: sql`${products.inventoryCount} - ${quantity}` }).where(and(eq(products.id, productId), gte(products.inventoryCount, quantity))).execute();
    if (!updated[0]?.affectedRows) throw new Error("تغير المخزون أثناء تجهيز الطلب، يرجى المحاولة مرة أخرى");
  }
}

async function restoreStock(tx: Transaction, requested: Map<number, number>) {
  const entries = Array.from(requested.entries());
  for (const [productId, quantity] of entries) {
    // Unconditional: giving stock back can never fail on availability.
    await tx.update(products).set({ inventoryCount: sql`${products.inventoryCount} + ${quantity}` }).where(eq(products.id, productId)).execute();
  }
}

export async function createWhatsAppOrder(input: {
  customerName: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
  items: Array<{ productId: number; optionLabel: string; quantity: number }>;
}) {
  const db = await ensureCatalog();
  if (!db) throw new DatabaseUnavailableError();
  const catalog = await listPublicProducts();
  const { items, total } = buildOrderLines(catalog, input.items);
  const requested = aggregateRequestedQuantities(items);
  for (const [productId, quantity] of Array.from(requested.entries())) {
    const product = catalog.find(item => item.id === productId);
    if (!product || product.inventoryCount < quantity) throw new Error(`الكمية المطلوبة من «${product?.name || "المنتج"}» غير متوفرة حاليًا`);
  }
  const orderNumber = generateOrderNumber();
  const settings = await getStoreSettings();
  await db.transaction(async tx => {
    await deductStock(tx, requested);
    await tx.insert(orders).values({
      orderNumber,
      customerName: input.customerName,
      phone: input.phone,
      city: input.city || null,
      address: input.address || null,
      notes: input.notes || null,
      itemsJson: JSON.stringify(items),
      total,
      currency: DEFAULT_CURRENCY,
      status: "new",
      channel: "whatsapp",
      // The WhatsApp flow commits the order immediately, so it holds stock now.
      stockDeducted: 1,
    });
  });
  const message = formatWhatsAppMessage({
    orderNumber,
    customerName: input.customerName,
    phone: input.phone,
    city: input.city,
    address: input.address,
    notes: input.notes,
    items,
    total,
    currency: DEFAULT_CURRENCY,
  });
  const whatsappNumber = normalizeWhatsAppNumber(settings.whatsappNumber);
  return { orderNumber, whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` };
}

/**
 * Records an online checkout so the dashboard is no longer blind to the payment
 * channel. Deliberately does NOT touch inventory: the shopper has only been sent
 * to the hosted checkout page, and reserving stock for an abandoned checkout
 * would make products look sold out. Stock moves when the admin confirms the
 * payment by taking the order out of `awaiting_payment`.
 */
export async function createOnlineCheckoutOrder(input: {
  customerName: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
  items: Array<{ productId: number; optionLabel: string; quantity: number }>;
  checkoutReference?: string;
}) {
  const db = await ensureCatalog();
  if (!db) throw new DatabaseUnavailableError();
  const catalog = await listPublicProducts();
  const { items, total } = buildOrderLines(catalog, input.items);
  const orderNumber = generateOrderNumber();
  await db.insert(orders).values({
    orderNumber,
    customerName: input.customerName,
    phone: input.phone,
    city: input.city || null,
    address: input.address || null,
    notes: input.notes || null,
    itemsJson: JSON.stringify(items),
    total,
    currency: DEFAULT_CURRENCY,
    status: "awaiting_payment",
    channel: "online",
    stockDeducted: 0,
    checkoutReference: input.checkoutReference ?? null,
  });
  return { orderNumber, total };
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return rows.map(row => ({ ...row, items: safeJson<StoredOrderLine[]>(row.itemsJson, []) }));
}

/**
 * Moves an order between statuses and settles inventory in the same transaction.
 *
 * Cancelling returns whatever stock the order held; confirming an online payment
 * takes it. Both directions are driven by the order's recorded `stockDeducted`
 * flag rather than the old status, so the operation is idempotent — repeating it
 * cannot double-count.
 */
export async function updateOrderStatus(id: number, status: OrderStatus) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) throw new Error("الطلب غير موجود");

  const action = resolveStockAction({ nextStatus: status, currentlyDeducted: Boolean(order.stockDeducted) });
  if (action === "none") {
    await db.update(orders).set({ status }).where(eq(orders.id, id));
    return { success: true, stockAction: action } as const;
  }

  const requested = aggregateRequestedQuantities(safeJson<StoredOrderLine[]>(order.itemsJson, []));
  await db.transaction(async tx => {
    if (action === "deduct") await deductStock(tx, requested);
    else await restoreStock(tx, requested);
    await tx.update(orders).set({ status, stockDeducted: action === "deduct" ? 1 : 0 }).where(eq(orders.id, id));
  });
  return { success: true, stockAction: action } as const;
}

export async function trackOrder(input: { orderNumber: string; phone: string }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, input.orderNumber.trim())).limit(1);
  const order = rows[0];
  if (!order || normalizeReviewPhone(order.phone) !== normalizeReviewPhone(input.phone)) return { found: false as const };
  return { found: true as const, orderNumber: order.orderNumber, status: order.status, createdAt: order.createdAt, total: order.total, currency: order.currency, items: safeJson<StoredOrderLine[]>(order.itemsJson, []) };
}

export async function listLowStockProducts() {
  const allProducts = await listAllProducts();
  return allProducts.filter(product => product.inventoryCount <= product.lowStockThreshold);
}

export async function updateProductInventory(id: number, values: { inventoryCount: number; lowStockThreshold: number }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(products).set(values).where(eq(products.id, id));
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return serializeProduct(rows[0]!);
}

export async function getDashboardStats() {
  const allProducts = await listAllProducts();
  const allOrders = await listOrders();
  // Revenue counts only committed orders: an abandoned online checkout sitting in
  // awaiting_payment, or a cancelled order, is not a sale.
  const countedOrders = allOrders.filter(order => countsTowardSales(order.status));
  return {
    productCount: allProducts.length,
    activeProductCount: allProducts.filter(product => product.isActive).length,
    orderCount: countedOrders.length,
    newOrderCount: allOrders.filter(order => order.status === "new").length,
    awaitingPaymentCount: allOrders.filter(order => order.status === "awaiting_payment").length,
    cancelledOrderCount: allOrders.filter(order => order.status === "cancelled").length,
    onlineOrderCount: allOrders.filter(order => order.channel === "online").length,
    lowStockCount: allProducts.filter(product => product.inventoryCount <= product.lowStockThreshold).length,
    salesTotal: countedOrders.reduce((sum, order) => sum + order.total, 0),
  };
}

export async function listPublicReviews(productId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(productReviews).where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved"))).orderBy(desc(productReviews.createdAt));
  return rows.map(row => ({ id: row.id, productId: row.productId, customerName: row.customerName, rating: row.rating, comment: row.comment, imageUrl: row.imageUrl, createdAt: row.createdAt }));
}

export async function submitProductReview(input: { productId: number; orderNumber: string; phone: string; customerName: string; rating: number; comment: string; imageDataUrl?: string; imageFileName?: string }) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const orderRows = await db.select().from(orders).where(eq(orders.orderNumber, input.orderNumber.trim())).limit(1);
  const order = orderRows[0];
  if (!order || normalizeReviewPhone(order.phone) !== normalizeReviewPhone(input.phone)) throw new Error("تعذر التحقق من رقم الطلب أو الهاتف");
  const items = safeJson<StoredOrderLine[]>(order.itemsJson, []);
  if (!orderIncludesProduct(items, input.productId)) throw new Error("هذا المنتج غير موجود في الطلب المحدد");
  const existing = await db.select({ id: productReviews.id }).from(productReviews).where(and(eq(productReviews.orderId, order.id), eq(productReviews.productId, input.productId))).limit(1);
  if (existing[0]) throw new Error("تم إرسال مراجعة لهذا المنتج من هذا الطلب مسبقًا");
  let imageUrl: string | null = null;
  if (input.imageDataUrl) {
    const { mimeType, buffer, extension } = parseProductMediaDataUrl(input.imageDataUrl, "image");
    const cleanName = (input.imageFileName || "review").replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "review";
    const stored = await storagePut(`reviews/${Date.now()}-${cleanName}.${mimeType === "image/jpeg" ? "jpg" : extension}`, buffer, mimeType);
    imageUrl = stored.url;
  }
  await db.insert(productReviews).values({ productId: input.productId, orderId: order.id, customerName: input.customerName.trim(), customerPhone: normalizeReviewPhone(input.phone), rating: input.rating, comment: input.comment.trim(), imageUrl, status: "pending" });
  return { success: true };
}

export async function listAllReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
}

export async function updateReviewStatus(id: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.update(productReviews).set({ status }).where(eq(productReviews.id, id));
  return { success: true };
}

export async function deleteReview(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  await db.delete(productReviews).where(eq(productReviews.id, id));
  return { success: true };
}
