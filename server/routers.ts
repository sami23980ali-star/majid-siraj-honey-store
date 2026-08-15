import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createLocalAdminCredential,
  createLocalAdminSession,
  getLocalAdminCredentialById,
  createProduct,
  createOnlineCheckoutOrder,
  createWhatsAppOrder,
  deleteLocalAdminSession,
  deleteReview,
  deleteProduct,
  getDashboardStats,
  getLocalAdminCredential,
  getPublicProduct,
  listLowStockProducts,
  getStoreSettings,
  hasLocalAdminCredential,
  listLocalAdminCredentials,
  listAllProducts,
  listOrders,
  listPublicProducts,
  listPublicReviews,
  listAllReviews,
  submitProductReview,
  trackOrder,
  uploadProductImage,
  uploadProductVideo,
  updateOrderStatus,
  updateProductInventory,
  updateReviewStatus,
  updateProduct,
  updateLocalAdminCredential,
  updateLocalAdminPassword,
  updateStoreSettings,
  registerLocalAdminFailure,
  registerLocalAdminLoginAttempt,
  resetLocalAdminLoginState,
} from "./db";
import { ADMIN_SESSION_COOKIE, COOKIE_NAME } from "@shared/const";
import { ADMIN_SESSION_DURATION_MS, createAdminSessionToken, getLockUntilAfterFailure, getRemainingAttempts, hashAdminPassword, hashAdminSessionToken, isAdminLocked, matchesAdminSetupToken, normalizeAdminPhone, normalizeAdminUsername, verifyAdminPassword } from "./adminAuth";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { getClientIp } from "./_core/requestIp";
import { createCart, listProducts } from "./_core/shopify";
import { describeLineProblem, resolveOnlineCheckoutLines } from "./shopifyCartMatch";
import { ORDER_STATUSES } from "./orderStock";
import { systemRouter } from "./_core/systemRouter";
import { commerceRouter } from "./routers/commerce";
import {
  adminLoginProcedure,
  adminProcedure,
  adminSetupProcedure,
  isOwnerIdentity,
  managerProcedure,
  onlineCheckoutProcedure,
  orderCreateProcedure,
  orderTrackProcedure,
  ownerProcedure,
  publicProcedure,
  reviewSubmitProcedure,
  router,
} from "./_core/trpc";

const optionSchema = z.object({ label: z.string().min(1), price: z.number().int().min(0) });
const productSchema = z.object({
  name: z.string().min(2),
  shortDescription: z.string().min(10),
  description: z.string().min(15),
  origin: z.string().min(2),
  category: z.string().min(2),
  priceOptions: z.array(optionSchema).min(1),
  primaryImage: z.string().min(1),
  galleryImages: z.array(z.string()).default([]),
  galleryVideos: z.array(z.string()).default([]),
  inventoryCount: z.number().int().min(0).default(20),
  lowStockThreshold: z.number().int().min(0).default(5),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const localAdminCredentialsSchema = z.object({
  username: z.string().trim().min(3, "اسم المستخدم يجب أن يحتوي ثلاثة أحرف على الأقل").max(64),
  password: z.string().min(10, "كلمة المرور يجب أن تحتوي عشرة أحرف على الأقل").max(160),
  phone: z.string().trim().min(7, "اكتب رقم هاتف صحيح").max(48).optional(),
  displayName: z.string().trim().min(2, "اكتب اسمًا واضحًا للمستخدم").max(120).optional(),
});

/** Only the first-run claim carries a bootstrap secret; later users never do. */
const localAdminSetupSchema = localAdminCredentialsSchema.extend({
  setupToken: z.string().trim().min(1, "اكتب رمز الإعداد").max(200).optional(),
});

const localAdminLoginSchema = z.object({
  username: z.string().trim().min(3, "اسم المستخدم يجب أن يحتوي ثلاثة أحرف على الأقل").max(64),
  password: z.string().min(10, "كلمة المرور يجب أن تحتوي عشرة أحرف على الأقل").max(160),
});

const localAdminRoleSchema = z.enum(["owner", "manager", "editor"]);

function getCookieValue(cookieHeader: string | undefined, name: string) {
  const prefix = `${name}=`;
  const entry = cookieHeader?.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return undefined;
  }
}

/**
 * Who may create the *first* local admin account.
 *
 * Exactly two positive proofs of ownership are accepted:
 *   1. the configured project owner identity (OWNER_OPEN_ID / role=admin), or
 *   2. the one-time `ADMIN_SETUP_TOKEN` secret, typed into the setup form.
 *
 * Absence of configuration is deliberately *not* a proof. The previous
 * `|| !ENV.ownerOpenId` fallback meant a deployment that left OWNER_OPEN_ID
 * empty handed the store to whichever authenticated visitor reached /admin
 * first — the owner's only protection was arriving before a stranger. Now an
 * unconfigured deployment refuses everyone until one of the two secrets exists,
 * and the escape hatch keeps the real owner from being locked out.
 *
 * This predicate answers "may this identity see the form"; the token value
 * itself is verified inside the mutation, since `status` has nothing to compare
 * against. Both paths close the moment a credential exists: `configured` is
 * checked here and again inside the mutation, so the claim window never reopens
 * and the claiming identity gains no owner privilege of its own — it only owns
 * the local username and password it just created.
 */
function canBootstrapLocalAdmin(user: TrpcContext["user"], configured: boolean) {
  if (configured || !user) return false;
  return isOwnerIdentity(user) || Boolean(ENV.adminSetupToken);
}

const orderCustomerSchema = {
  customerName: z.string().min(2, "اكتب الاسم الكامل"),
  phone: z.string().min(7, "اكتب رقم هاتف صحيح"),
  city: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({ productId: z.number().int().positive(), optionLabel: z.string().min(1), quantity: z.number().int().min(1).max(99) })).min(1, "السلة فارغة"),
};

export const appRouter = router({
  system: systemRouter,
  commerce: commerceRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  adminAuth: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const configured = await hasLocalAdminCredential();
      const ownerAdmin = isOwnerIdentity(ctx.user);
      const canSetup = canBootstrapLocalAdmin(ctx.user, configured);
      return {
        configured,
        localAdmin: ctx.localAdmin ? { username: ctx.localAdmin.username, displayName: ctx.localAdmin.displayName, role: ctx.localAdmin.role, expiresAt: ctx.localAdmin.expiresAt } : null,
        ownerAdmin,
        // Lets the dashboard show the setup form instead of a permission refusal
        // to exactly the identities the mutation below would accept.
        canSetup,
        // The owner identity is proof enough on its own; anyone else reaching the
        // form got there through ADMIN_SETUP_TOKEN and must supply it. Only the
        // requirement is exposed here, never the secret.
        requiresSetupToken: canSetup && !ownerAdmin,
      };
    }),
    setup: adminSetupProcedure.input(localAdminSetupSchema).mutation(async ({ ctx, input }) => {
      const configured = await hasLocalAdminCredential();
      if (configured) throw new TRPCError({ code: "CONFLICT", message: "تم إعداد حساب المدير المحلي بالفعل" });
      if (!canBootstrapLocalAdmin(ctx.user, configured)) throw new TRPCError({ code: "FORBIDDEN", message: "إعداد حساب المدير يتطلب تسجيل دخول مالك المشروع" });
      // Reached only when the guard passed without an owner identity, i.e. purely
      // on the strength of ADMIN_SETUP_TOKEN being configured — so the submitted
      // token has to actually match it.
      if (!isOwnerIdentity(ctx.user) && !matchesAdminSetupToken(input.setupToken ?? "", ENV.adminSetupToken)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "رمز الإعداد غير صحيح" });
      }
      const username = normalizeAdminUsername(input.username);
      const phone = normalizeAdminPhone(input.phone ?? "");
      if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب رقم هاتف صحيح" });
      await createLocalAdminCredential({ username, phone, displayName: input.displayName, role: "owner", passwordHash: await hashAdminPassword(input.password) });
      return { success: true } as const;
    }),
    login: adminLoginProcedure.input(localAdminLoginSchema).mutation(async ({ ctx, input }) => {
      const username = normalizeAdminUsername(input.username);
      const credential = await getLocalAdminCredential(username);
      const ipAddress = getClientIp(ctx.req);
      const genericError = "تعذر التحقق من بيانات الدخول";
      if (!credential || !credential.isActive) {
        await registerLocalAdminLoginAttempt({ credentialId: credential?.id, username, success: false, ipAddress });
        throw new TRPCError({ code: "UNAUTHORIZED", message: genericError });
      }
      if (isAdminLocked(credential.lockedUntil)) {
        const remainingMinutes = Math.max(1, Math.ceil((credential.lockedUntil!.getTime() - Date.now()) / 60_000));
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `تم قفل الدخول مؤقتًا. حاول مجددًا بعد ${remainingMinutes} دقائق.` });
      }
      if (!(await verifyAdminPassword(input.password, credential.passwordHash))) {
        const lockUntil = getLockUntilAfterFailure(credential.failedAttempts);
        await registerLocalAdminLoginAttempt({ credentialId: credential.id, username, success: false, ipAddress });
        await registerLocalAdminFailure(credential, lockUntil);
        if (lockUntil) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم قفل الدخول لمدة 10 دقائق بعد خمس محاولات غير صحيحة." });
        throw new TRPCError({ code: "UNAUTHORIZED", message: `${genericError}. المحاولات المتبقية: ${getRemainingAttempts(credential.failedAttempts + 1)}.` });
      }
      await resetLocalAdminLoginState(credential.id);
      await registerLocalAdminLoginAttempt({ credentialId: credential.id, username, success: true, ipAddress });
      const sessionToken = createAdminSessionToken();
      const expiresAt = new Date(Date.now() + ADMIN_SESSION_DURATION_MS);
      await createLocalAdminSession({ credentialId: credential.id, tokenHash: hashAdminSessionToken(sessionToken), expiresAt });
      ctx.res.cookie(ADMIN_SESSION_COOKIE, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ADMIN_SESSION_DURATION_MS });
      return { success: true, username: credential.username, displayName: credential.displayName, role: credential.role, expiresAt } as const;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getCookieValue(ctx.req.headers.cookie, ADMIN_SESSION_COOKIE);
      if (token) await deleteLocalAdminSession(hashAdminSessionToken(token));
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
    changeOwnPassword: adminProcedure.input(z.object({ currentPassword: z.string().min(10), newPassword: z.string().min(10).max(160) })).mutation(async ({ ctx, input }) => {
      if (!ctx.localAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "غيّر كلمة المرور من حساب المدير المحلي نفسه" });
      const credential = await getLocalAdminCredentialById(ctx.localAdmin.credentialId);
      if (!credential || !credential.isActive || !(await verifyAdminPassword(input.currentPassword, credential.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
      }
      await updateLocalAdminPassword(credential.id, await hashAdminPassword(input.newPassword));
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  adminUsers: router({
    list: ownerProcedure.query(() => listLocalAdminCredentials()),
    create: ownerProcedure.input(z.object({
      username: z.string().trim().min(3).max(64),
      displayName: z.string().trim().min(2).max(120),
      password: z.string().min(10).max(160),
      phone: z.string().trim().max(48).optional(),
      role: localAdminRoleSchema.default("editor"),
    })).mutation(async ({ ctx, input }) => {
      const username = normalizeAdminUsername(input.username);
      if (await getLocalAdminCredential(username)) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم مستخدم بالفعل" });
      const phone = input.phone ? normalizeAdminPhone(input.phone) : null;
      return createLocalAdminCredential({
        username,
        displayName: input.displayName,
        phone: phone ?? undefined,
        role: input.role,
        createdByCredentialId: ctx.localAdmin?.credentialId ?? null,
        passwordHash: await hashAdminPassword(input.password),
      });
    }),
    update: ownerProcedure.input(z.object({
      id: z.number().int().positive(),
      displayName: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(48).nullable().optional(),
      role: localAdminRoleSchema.optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const target = await getLocalAdminCredentialById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
      if (ctx.localAdmin?.credentialId === input.id && input.isActive === false) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك تعطيل حسابك الحالي" });
      const removesOwnerRole = target.role === "owner" && (input.role !== undefined && input.role !== "owner" || input.isActive === false);
      if (removesOwnerRole) {
        const activeOwners = (await listLocalAdminCredentials()).filter(item => item.role === "owner" && Boolean(item.isActive));
        if (activeOwners.length <= 1) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يبقى مالك واحد نشط على الأقل" });
      }
      const phone = input.phone === undefined ? undefined : input.phone ? normalizeAdminPhone(input.phone) : null;
      return updateLocalAdminCredential(input.id, { displayName: input.displayName, phone, role: input.role, isActive: input.isActive });
    }),
    resetPassword: ownerProcedure.input(z.object({ id: z.number().int().positive(), password: z.string().min(10).max(160) })).mutation(async ({ input }) => {
      const target = await getLocalAdminCredentialById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
      await updateLocalAdminPassword(target.id, await hashAdminPassword(input.password));
      return { success: true } as const;
    }),
  }),
  catalog: router({
    list: publicProcedure.query(() => listPublicProducts()),
    detail: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(({ input }) => getPublicProduct(input.slug)),
    settings: publicProcedure.query(() => getStoreSettings()),
  }),
  orders: router({
    create: orderCreateProcedure.input(z.object(orderCustomerSchema)).mutation(({ input }) => createWhatsAppOrder(input)),
    /**
     * Starts a hosted checkout. Variant matching happens here, not in the
     * browser: the client used to fetch the first 25 Shopify products and pick
     * `variants.find(availableForSale)`, which ignored the selected weight and
     * could send the shopper to a checkout for a different jar size.
     */
    createOnlineCheckout: onlineCheckoutProcedure.input(z.object(orderCustomerSchema)).mutation(async ({ input }) => {
      const [catalog, shopifyProducts] = await Promise.all([listPublicProducts(), listProducts({ first: 100 })]);
      const { lines, problems } = resolveOnlineCheckoutLines({ catalog, shopifyProducts, requested: input.items });
      if (problems.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: problems.map(describeLineProblem).join(" ") });
      }
      const cart = await createCart(lines);
      if (!cart.checkoutUrl) throw new TRPCError({ code: "BAD_GATEWAY", message: "تعذر فتح صفحة الدفع الآمن. حاول مرة أخرى أو أكمل الطلب عبر واتساب." });
      // Recorded before the shopper leaves so the dashboard sees the attempt.
      // Stock is untouched until an admin confirms the payment.
      const order = await createOnlineCheckoutOrder({ ...input, checkoutReference: cart.id });
      return { orderNumber: order.orderNumber, checkoutUrl: cart.checkoutUrl, total: order.total };
    }),
    track: orderTrackProcedure.input(z.object({ orderNumber: z.string().min(4).max(32), phone: z.string().min(7).max(48) })).query(({ input }) => trackOrder(input)),
  }),
  reviews: router({
    list: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => listPublicReviews(input.productId)),
    submit: reviewSubmitProcedure.input(z.object({
      productId: z.number().int().positive(),
      orderNumber: z.string().min(4).max(32),
      phone: z.string().min(7).max(48),
      customerName: z.string().min(2).max(160),
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(8).max(1200),
      imageDataUrl: z.string().max(6_000_000).optional(),
      imageFileName: z.string().max(180).optional(),
    })).mutation(({ input }) => submitProductReview(input)),
  }),
  admin: router({
    stats: managerProcedure.query(() => getDashboardStats()),
    products: adminProcedure.query(() => listAllProducts()),
    createProduct: adminProcedure.input(productSchema).mutation(({ input }) => createProduct(input)),
    updateProduct: adminProcedure.input(productSchema.extend({ id: z.number().int().positive() })).mutation(({ input }) => {
      const { id, ...values } = input;
      return updateProduct(id, values);
    }),
    deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteProduct(input.id)),
    uploadProductImage: adminProcedure.input(z.object({ dataUrl: z.string().max(6_000_000), fileName: z.string().max(180) })).mutation(({ input }) => uploadProductImage(input)),
    uploadProductVideo: adminProcedure.input(z.object({ dataUrl: z.string().max(28_000_000), fileName: z.string().max(180) })).mutation(({ input }) => uploadProductVideo(input)),
    reviews: adminProcedure.query(() => listAllReviews()),
    updateReviewStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })).mutation(({ input }) => updateReviewStatus(input.id, input.status)),
    deleteReview: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteReview(input.id)),
    orders: managerProcedure.query(() => listOrders()),
    updateOrderStatus: managerProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(ORDER_STATUSES as [string, ...string[]]) })).mutation(({ input }) => updateOrderStatus(input.id, input.status as (typeof ORDER_STATUSES)[number])),
    lowStock: managerProcedure.query(() => listLowStockProducts()),
    updateInventory: managerProcedure.input(z.object({ id: z.number().int().positive(), inventoryCount: z.number().int().min(0), lowStockThreshold: z.number().int().min(0) })).mutation(({ input }) => updateProductInventory(input.id, input)),
    settings: managerProcedure.query(() => getStoreSettings()),
    updateSettings: managerProcedure.input(z.object({
      whatsappNumber: z.string().min(7),
      supportPhone: z.string().min(7),
      secondaryPhone: z.string().optional(),
      locationText: z.string().min(2),
    })).mutation(({ input }) => updateStoreSettings(input)),
  }),
});

export type AppRouter = typeof appRouter;
